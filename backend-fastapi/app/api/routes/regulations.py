"""API endpoints for regulation processing"""

import os
import math
import json
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import fitz  # PyMuPDF

from app.services import RegulationService
from app.agents.violation_fix_agent import ViolationFixAgent

router = APIRouter()

# Initialize services per country (one instance per country)
_regulation_services = {}


def get_regulation_service(country: str = "USA"):
    """
    Get or create regulation service instance for specific country
    
    Args:
        country: Country code (USA, EU, Japan)
        
    Returns:
        RegulationService instance for the country
    """
    global _regulation_services
    country_normalized = country.upper()
    
    # Map country names to directory names
    country_map = {
        "USA": "usa",
        "EU": "eu", 
        "JAPAN": "japan"
    }
    
    # Get directory name
    country_dir = country_map.get(country_normalized, country.lower())
    
    if country_dir not in _regulation_services:
        _regulation_services[country_dir] = RegulationService(country=country_dir)
    
    return _regulation_services[country_dir]


def pdf_to_markdown(pdf_path: str) -> str:
    """
    Convert PDF to plain text preserving original formatting
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Plain text with preserved line breaks
    """
    doc = fitz.open(pdf_path)
    all_text = []
    
    for page in doc:
        # Get text with layout preserved
        text = page.get_text("text")
        if text.strip():
            all_text.append(text)
    
    doc.close()
    
    # Join all pages
    full_text = "\n".join(all_text)
    
    return full_text


class RegulationUploadResponse(BaseModel):
    """Response for regulation upload"""
    regulation_id: str
    title: str
    num_clauses: int
    graph_stats: dict


class RetrievalQuery(BaseModel):
    """Query for HippoRAG retrieval"""
    query_text: str
    country: str = "USA"
    top_k: int = 10


class RetrievalResult(BaseModel):
    """Single retrieval result"""
    clause_id: str
    text: str
    ppr_score: float
    section: str
    severity: str


class RetrievalResponse(BaseModel):
    """Response for retrieval query"""
    query: str
    results: List[RetrievalResult]
    num_results: int


class ComplianceCheckRequest(BaseModel):
    """Request for compliance checking"""
    protocol_paragraph: str
    country: str = "USA"
    top_k: int = 10


class ComplianceCheckResponse(BaseModel):
    """Response for compliance checking"""
    protocol_text: str
    total_regulations_checked: int
    related_regulations: int
    compliant_count: int
    non_compliant_count: int
    overall_compliance_score: float
    status: str
    detailed_results: List[dict]
    critical_violations: List[dict]
    recommendations: List[List[str]]


class PDFChunkResult(BaseModel):
    """Result for a single PDF chunk compliance check"""
    chunk_index: int
    chunk_text: str
    total_regulations_checked: int
    compliant_count: int
    non_compliant_count: int
    compliance_score: float
    status: str
    violations: List[dict]


class PDFComplianceResponse(BaseModel):
    """Response for full PDF compliance checking"""
    filename: str
    total_chunks: int
    processed_chunks: int
    overall_compliance_score: float
    overall_status: str
    total_violations: int
    critical_violations: int
    chunk_results: List[PDFChunkResult]
    processing_time_seconds: float


@router.post("/upload", response_model=RegulationUploadResponse)
async def upload_regulation(
    file: UploadFile = File(...),
    country: str = Form(...),
    authority: str = Form(...),
    title: str = Form(...),
    version: str = Form("2024"),
):
    """
    Upload and process a regulation PDF
    
    Args:
        file: PDF file
        country: Country code (USA, EU, Japan)
        authority: Authority (FDA, EMA, PMDA)
        title: Regulation title
        version: Version string
        
    Returns:
        Upload response with regulation details
    """
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Save uploaded file temporarily
    temp_path = f"./data/temp/{file.filename}"
    import os
    os.makedirs("./data/temp", exist_ok=True)
    
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Process regulation
    service = get_regulation_service(country=country)
    try:
        reg_doc = await service.ingest_regulation(
            pdf_path=temp_path,
            country=country,
            authority=authority,
            title=title,
            version=version,
        )
        
        # Get graph stats
        graph_stats = service.graph_builder.get_stats()
        
        return RegulationUploadResponse(
            regulation_id=reg_doc.id,
            title=reg_doc.title,
            num_clauses=len(reg_doc.clauses),
            graph_stats=graph_stats,
        )
    
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/retrieve", response_model=RetrievalResponse)
async def retrieve_regulations(query: RetrievalQuery):
    """
    Retrieve relevant regulations using HippoRAG
    
    Args:
        query: Query object with text and parameters
        
    Returns:
        Retrieval results with PPR scores
    """
    service = get_regulation_service(country=query.country)
    
    results = service.retrieve_with_hipporag(
        query_text=query.query_text,
        country=query.country,
        top_k=query.top_k,
    )
    
    retrieval_results = [
        RetrievalResult(**result)
        for result in results
    ]
    
    return RetrievalResponse(
        query=query.query_text,
        results=retrieval_results,
        num_results=len(retrieval_results),
    )


@router.get("/graph/stats")
async def get_graph_stats(country: str = "USA"):
    """
    Get current knowledge graph statistics
    
    Args:
        country: Country code (USA, EU, Japan)
    """
    service = get_regulation_service(country=country)
    return service.graph_builder.get_stats()


@router.get("/graph/data")
async def get_graph_data(country: str = "USA"):
    """
    Get complete knowledge graph data for visualization
    
    Args:
        country: Country code (USA, EU, Japan)
        
    Returns:
        Graph data with nodes and edges in a format suitable for visualization
    """
    service = get_regulation_service(country=country)
    graph = service.graph_builder.graph
    
    # Extract nodes
    nodes = []
    for node_id in graph.nodes():
        node_data = dict(graph.nodes[node_id])
        nodes.append({
            "id": node_id,
            "type": node_data.get("type", "unknown"),
            "text": node_data.get("text", ""),
            "section": node_data.get("section", ""),
            "clause_number": node_data.get("clause_number", ""),
            "requirement_type": node_data.get("requirement_type", ""),
            "severity": node_data.get("severity", ""),
        })
    
    # Extract edges
    edges = []
    for source, target, edge_data in graph.edges(data=True):
        edges.append({
            "source": source,
            "target": target,
            "relation": edge_data.get("relation", ""),
            "confidence": edge_data.get("confidence", 0.0),
            "source_type": edge_data.get("source", ""),
        })
    
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": service.graph_builder.get_stats(),
    }


@router.post("/check-compliance", response_model=ComplianceCheckResponse)
async def check_protocol_compliance(request: ComplianceCheckRequest):
    """
    Check if a protocol paragraph complies with regulations
    
    This endpoint:
    1. Uses HippoRAG to find top-K relevant regulations for the paragraph
    2. Sends paragraph + regulations to compliance agent (LLM)
    3. Agent analyzes each regulation for:
       - Relevance to the paragraph
       - Compliance status
       - Non-compliance probability
       - Missing elements
    
    Args:
        request: Compliance check request with protocol text and parameters
        
    Returns:
        Detailed compliance analysis with violations and recommendations
        
    Example:
        ```
        POST /api/regulations/check-compliance
        {
          "protocol_paragraph": "Participants will be informed about the study...",
          "country": "USA",
          "top_k": 10
        }
        ```
    """
    service = get_regulation_service(country=request.country)
    
    try:
        result = await service.check_protocol_compliance(
            protocol_paragraph=request.protocol_paragraph,
            country=request.country,
            top_k=request.top_k
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return ComplianceCheckResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compliance check failed: {str(e)}")


@router.post("/check-pdf-compliance", response_model=PDFComplianceResponse)
async def check_pdf_compliance(
    file: UploadFile = File(...),
    country: str = Form("USA"),
    top_k: int = Form(10),
    num_chunks: int = Form(12),
    compliance_focus: str = Form("all"),
):
    """
    Check compliance of an entire PDF document
    
    This endpoint:
    1. Extracts text from uploaded PDF
    2. Chunks the PDF into N parts (default 12)
    3. Uses concurrent.futures to send all chunks to LavaLabs in parallel
    4. For each chunk, retrieves relevant regulations using HippoRAG
    5. Returns aggregated compliance results
    
    Args:
        file: PDF file to check
        country: Country code (USA, EU, Japan)
        top_k: Number of regulations to retrieve per chunk
        num_chunks: Number of chunks to split PDF into (10-15 recommended)
        compliance_focus: Focus area (all, consent, data, safety)
        
    Returns:
        Detailed compliance analysis for entire PDF with per-chunk breakdowns
    """
    import time
    start_time = time.time()
    
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Save uploaded file temporarily
    temp_path = f"./data/temp/{file.filename}"
    os.makedirs("./data/temp", exist_ok=True)
    
    try:
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Get service and extract PDF text
        service = get_regulation_service(country=country)
        pdf_text = service.extract_text_from_pdf(temp_path)
        
        if not pdf_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Chunk the PDF text
        chunk_size = math.ceil(len(pdf_text) / num_chunks)
        chunks = service._chunk_text(pdf_text, chunk_size)
        
        # Ensure we have the right number of chunks
        if len(chunks) > num_chunks:
            # Merge smaller chunks
            target_chunk_size = math.ceil(len(pdf_text) / num_chunks)
            chunks = service._chunk_text(pdf_text, target_chunk_size)
        
        print(f"PDF split into {len(chunks)} chunks")
        
        # Function to process a single chunk
        async def process_chunk(chunk_index: int, chunk_text: str):
            """Process a single chunk with compliance checking"""
            try:
                # Use existing check_protocol_compliance method
                result = await service.check_protocol_compliance(
                    protocol_paragraph=chunk_text,
                    country=country,
                    top_k=top_k
                )
                
                return PDFChunkResult(
                    chunk_index=chunk_index,
                    chunk_text=chunk_text[:200] + "..." if len(chunk_text) > 200 else chunk_text,
                    total_regulations_checked=result.get("total_regulations_checked", 0),
                    compliant_count=result.get("compliant_count", 0),
                    non_compliant_count=result.get("non_compliant_count", 0),
                    compliance_score=result.get("overall_compliance_score", 0.0),
                    status=result.get("status", "ERROR"),
                    violations=[
                        v for v in result.get("detailed_results", [])
                        if not v.get("is_compliant")
                    ]
                )
            except Exception as e:
                print(f"Error processing chunk {chunk_index}: {e}")
                return PDFChunkResult(
                    chunk_index=chunk_index,
                    chunk_text=chunk_text[:200] + "..." if len(chunk_text) > 200 else chunk_text,
                    total_regulations_checked=0,
                    compliant_count=0,
                    non_compliant_count=0,
                    compliance_score=0.0,
                    status="ERROR",
                    violations=[]
                )
        
        # Process all chunks concurrently using asyncio.gather
        import asyncio
        tasks = [process_chunk(i, chunk) for i, chunk in enumerate(chunks)]
        chunk_results = await asyncio.gather(*tasks)
        
        # Calculate overall statistics
        total_regulations = sum(r.total_regulations_checked for r in chunk_results)
        total_compliant = sum(r.compliant_count for r in chunk_results)
        total_non_compliant = sum(r.non_compliant_count for r in chunk_results)
        
        # Overall compliance score (weighted average)
        overall_score = 0.0
        if total_regulations > 0:
            overall_score = total_compliant / total_regulations
        
        # Count critical violations
        critical_violations = 0
        for result in chunk_results:
            critical_violations += sum(
                1 for v in result.violations
                if v.get("severity") == "critical"
            )
        
        processing_time = time.time() - start_time
        
        return PDFComplianceResponse(
            filename=file.filename,
            total_chunks=len(chunks),
            processed_chunks=len(chunk_results),
            overall_compliance_score=round(overall_score, 3),
            overall_status="COMPLIANT" if total_non_compliant == 0 else "NON_COMPLIANT",
            total_violations=total_non_compliant,
            critical_violations=critical_violations,
            chunk_results=chunk_results,
            processing_time_seconds=round(processing_time, 2)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF compliance check failed: {str(e)}")
    
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/fix-pdf-violations")
async def fix_pdf_violations(
    file: UploadFile = File(...),
    compliance_results: str = Form(...),
    country: str = Form("USA"),
):
    """
    Generate targeted diffs to fix compliance violations
    
    This endpoint:
    1. Converts PDF to Markdown
    2. Identifies chunks with violations
    3. Uses AI to generate specific diffs (add/delete/replace)
    4. Returns list of changes with context
    
    Args:
        file: Original PDF file
        compliance_results: JSON string of compliance check results
        country: Country code (USA, EU, Japan)
        
    Returns:
        JSON with list of diffs and metadata
    """
    import time
    import json
    import asyncio
    
    start_time = time.time()
    
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Parse compliance results
    try:
        results = json.loads(compliance_results)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid compliance results JSON")
    
    # Save uploaded file temporarily
    temp_path = f"./data/temp/{file.filename}"
    os.makedirs("./data/temp", exist_ok=True)
    
    try:
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Get service and extract PDF text
        service = get_regulation_service(country=country)
        pdf_text = service.extract_text_from_pdf(temp_path)
        
        # Initialize fix agent
        fix_agent = ViolationFixAgent()
        
        # Process chunks with violations
        chunk_results = results.get("chunk_results", [])
        fixed_chunks = []
        
        async def fix_chunk(chunk_data):
            """Fix a single chunk if it has violations"""
            violations = chunk_data.get("violations", [])
            chunk_index = chunk_data.get("chunk_index")
            
            # Get full chunk text from original PDF
            num_chunks = results.get("total_chunks", 12)
            chunk_size = math.ceil(len(pdf_text) / num_chunks)
            start_idx = chunk_index * chunk_size
            end_idx = min(start_idx + chunk_size, len(pdf_text))
            full_chunk_text = pdf_text[start_idx:end_idx]
            
            if len(violations) == 0:
                # No violations, keep original text exactly as is
                return {
                    "chunk_index": chunk_index,
                    "text": full_chunk_text,  # Use full original text
                    "was_fixed": False
                }
            
            
            # Prepare violation details with regulation text
            violations_with_context = []
            for v in violations:
                reg_id = v.get("regulation_id")
                # Try to find the regulation text from graph
                reg_node = next(
                    (n for n in service.graph_builder.graph.nodes() 
                     if n == reg_id), 
                    None
                )
                reg_text = ""
                if reg_node:
                    reg_text = service.graph_builder.graph.nodes[reg_node].get("text", "")
                
                violations_with_context.append({
                    "regulation_id": reg_id,
                    "regulation_text": reg_text,
                    "explanation": v.get("explanation", ""),
                    "missing_elements": v.get("missing_elements", []),
                })
            
            # Call fix agent to generate diffs
            fix_result = await fix_agent.fix_violations(
                original_text=full_chunk_text,
                violations=violations_with_context
            )
            
            return {
                "chunk_index": chunk_index,
                "changes": fix_result.get("changes", []),
                "was_fixed": True if fix_result.get("changes") else False,
                "violations_addressed": len(violations)
            }
        
        # Process all chunks concurrently
        tasks = [fix_chunk(chunk) for chunk in chunk_results]
        fixed_chunks = await asyncio.gather(*tasks)
        
        # Collect all changes from all chunks
        all_changes = []
        for chunk in fixed_chunks:
            if chunk.get('changes'):
                all_changes.extend(chunk['changes'])
        
        processing_time = time.time() - start_time
        print(f"Generated {len(all_changes)} changes in {processing_time:.2f} seconds")
        
        # Return list of changes as JSON
        return JSONResponse({
            "changes": all_changes,
            "original_filename": file.filename,
            "total_changes": len(all_changes),
            "processing_time": round(processing_time, 2),
            "chunks_processed": len(fixed_chunks)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fix violations: {str(e)}")
    
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/pdf-to-markdown")
async def convert_pdf_to_markdown(
    file: UploadFile = File(...),
):
    """
    Convert a PDF to Markdown format
    
    Args:
        file: PDF file to convert
        
    Returns:
        JSON with markdown content
    """
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Save uploaded file temporarily
    temp_path = f"./data/temp/{file.filename}"
    os.makedirs("./data/temp", exist_ok=True)
    
    try:
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Convert to markdown
        markdown_content = pdf_to_markdown(temp_path)
        
        return JSONResponse({
            "markdown": markdown_content,
            "filename": file.filename
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to convert PDF: {str(e)}")
    
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.get("/test")
async def test_endpoint():
    """Test endpoint"""
    return {"message": "Regulations API is working!"}

