"""API endpoints for regulation processing"""

from typing import List

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from pydantic import BaseModel

from app.services import RegulationService

router = APIRouter()

# Initialize service (singleton pattern)
_regulation_service = None


def get_regulation_service():
    """Get or create regulation service instance"""
    global _regulation_service
    if _regulation_service is None:
        _regulation_service = RegulationService()
    return _regulation_service


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
    service = get_regulation_service()
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
    service = get_regulation_service()
    
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
async def get_graph_stats():
    """Get current knowledge graph statistics"""
    service = get_regulation_service()
    return service.graph_builder.get_stats()


@router.get("/graph/data")
async def get_graph_data():
    """
    Get complete knowledge graph data for visualization
    
    Returns:
        Graph data with nodes and edges in a format suitable for visualization
    """
    service = get_regulation_service()
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
    service = get_regulation_service()
    
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


@router.get("/test")
async def test_endpoint():
    """Test endpoint"""
    return {"message": "Regulations API is working!"}

