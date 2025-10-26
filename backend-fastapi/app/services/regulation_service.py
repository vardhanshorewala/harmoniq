"""Service for handling regulation documents and compliance checking"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional

from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

from app.agents import OpenRouterAgent
from app.chroma import get_chroma_client
from app.graph.graph_builder import RegulationGraphBuilder
from app.models.regulation import (
    RegulationClause,
    RegulationDocument,
    RegulationTriplet,
)


class RegulationService:
    """Service for processing MESSY, UNSTRUCTURED regulations and building knowledge graphs"""
    
    def __init__(self):
        """Initialize regulation service"""
        self.agent = OpenRouterAgent()
        self.chroma_client = get_chroma_client()
        self.graph_builder = RegulationGraphBuilder()
        
        # Initialize embedding model (local, no API needed)
        print("Loading embedding model...")
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        print("Embedding model loaded")
        
        # Get or create ChromaDB collection for regulations
        self.collection = self.chroma_client.get_or_create_collection(
            name="regulations",
            metadata={"description": "Regulation clauses and requirements"}
        )
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extract text from PDF file (handles messy/scanned PDFs)
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Extracted text
        """
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:  # Skip empty pages
                text += page_text + "\n"
        return text
    
    def _chunk_text(self, text: str, chunk_size: int) -> List[str]:
        """Split text into chunks at paragraph boundaries"""
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            if len(current_chunk) + len(para) < chunk_size:
                current_chunk += para + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = para + "\n\n"
        
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    async def _parse_chunk(
        self,
        text: str,
        country: str,
        authority: str,
        chunk_id: int
    ) -> List[RegulationClause]:
        """Parse a single chunk of messy regulation text"""
        
        prompt = f"""
        This is UNSTRUCTURED regulatory text from {authority}. It may have:
        - No clear section numbers
        - Inconsistent formatting
        - Mixed requirements in paragraphs
        - OCR errors or poor quality
        
        Your task: Extract individual REQUIREMENTS (not sections).
        Each requirement is something a company must/should do to comply.
        
        Text:
        {text}
        
        For each requirement found:
        - Give it a unique ID (REQ-001, REQ-002, etc.)
        - Extract the full requirement text (1-3 sentences)
        - Classify if mandatory ("must"/"shall") or recommended ("should"/"may")
        - Rate severity: critical/high/medium/low
        - Identify the TOPIC (e.g., "data validation", "user authentication", "audit trails")
        
        IMPORTANT: 
        - Extract semantic requirements, not structural sections
        - One requirement = one specific thing to comply with
        - Requirements can come from anywhere in the text
        
        Return as JSON array:
        [
          {{
            "id": "REQ-001",
            "text": "Systems must be validated to ensure accuracy and reliability",
            "topic": "validation",
            "requirement_type": "mandatory",
            "severity": "critical"
          }},
          {{
            "id": "REQ-002",
            "text": "Organizations should implement access controls to limit system access",
            "topic": "access control",
            "requirement_type": "recommended",
            "severity": "high"
          }},
          ...
        ]
        
        Extract 10-20 requirements. Be thorough.
        """
        
        try:
            response = await self.agent.call(prompt, temperature=0.3)
            response_text = self.agent.get_text_response(response)
            
            # Extract JSON from response
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                requirements_data = json.loads(json_match.group())
            else:
                requirements_data = json.loads(response_text)
            
            # Convert to RegulationClause objects
            clauses = []
            for req_data in requirements_data:
                # Generate unique ID
                req_id = f"{authority}-CHUNK{chunk_id}-{req_data['id']}"
                
                clause = RegulationClause(
                    id=req_id,
                    text=req_data['text'],
                    section=req_data.get('topic', 'general'),  # Use topic as "section"
                    clause_number=req_data['id'],
                    requirement_type=req_data.get('requirement_type'),
                    severity=req_data.get('severity'),
                )
                clauses.append(clause)
            
            return clauses
        
        except Exception as e:
            print(f"Error parsing chunk: {e}")
            return []
    
    async def parse_regulation_with_agent(
        self,
        text: str,
        country: str,
        authority: str
    ) -> List[RegulationClause]:
        """
        Use agent to parse MESSY regulation text into semantic requirement chunks
        
        Args:
            text: Regulation text (unstructured, messy)
            country: Country (USA, EU, Japan)
            authority: Authority (FDA, EMA, PMDA)
            
        Returns:
            List of RegulationClause objects
        """
        # Chunk text if too long (API limits)
        max_chunk_size = 8000
        if len(text) > max_chunk_size:
            # Process in chunks and combine
            chunks = self._chunk_text(text, max_chunk_size)
            all_clauses = []
            for i, chunk in enumerate(chunks[:3]):  # Limit to 3 chunks for demo
                print(f"  Processing chunk {i+1}/{min(3, len(chunks))}...")
                chunk_clauses = await self._parse_chunk(chunk, country, authority, i)
                all_clauses.extend(chunk_clauses)
            return all_clauses
        else:
            return await self._parse_chunk(text, country, authority, 0)
    
    async def extract_triplets_with_agent(
        self,
        clauses: List[RegulationClause]
    ) -> List[RegulationTriplet]:
        """
        Use agent to extract SEMANTIC relationships between requirements
        (No structural assumptions - pure semantic analysis)
        
        Args:
            clauses: List of regulation clauses
            
        Returns:
            List of RegulationTriplet objects
        """
        # Create summary of all clauses
        clauses_summary = "\n".join([
            f"{clause.id} [{clause.section}]: {clause.text[:80]}..."
            for clause in clauses[:25]  # Limit for token constraints
        ])
        
        prompt = f"""
        Analyze these regulatory requirements and find which ones are RELATED to each other.
        
        These are extracted from MESSY, UNSTRUCTURED text.
        Find relationships based on MEANING - which requirements:
        - Cover similar topics
        - Work together for compliance
        - Depend on each other
        - Implement related concepts
        
        Requirements:
        {clauses_summary}
        
        Return as JSON array (find at least 10-15 relationships):
        [
          {{
            "subject": "FDA-CHUNK0-REQ-001",
            "predicate": "RELATED_TO",
            "object": "FDA-CHUNK0-REQ-005",
            "confidence": 0.85,
            "reason": "both about system validation and quality control"
          }},
          {{
            "subject": "FDA-CHUNK0-REQ-003",
            "predicate": "RELATED_TO",
            "object": "FDA-CHUNK0-REQ-007",
            "confidence": 0.78,
            "reason": "both address data integrity and record keeping"
          }},
          ...
        ]
        
        Focus on MEANINGFUL relationships. Higher confidence for stronger relationships.
        """
        
        try:
            response = await self.agent.call(prompt, temperature=0.3)
            response_text = self.agent.get_text_response(response)
            
            # Extract JSON
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                triplets_data = json.loads(json_match.group())
            else:
                triplets_data = json.loads(response_text)
            
            # Convert to RegulationTriplet objects
            triplets = []
            for triplet_data in triplets_data:
                triplet = RegulationTriplet(
                    subject=triplet_data['subject'],
                    predicate=triplet_data['predicate'],
                    object=triplet_data['object'],
                    confidence=triplet_data.get('confidence', 0.8),
                )
                triplets.append(triplet)
            
            return triplets
        
        except Exception as e:
            print(f"Error extracting triplets: {e}")
            return []
    
    def embed_clauses(self, clauses: List[RegulationClause]) -> List[RegulationClause]:
        """
        Generate embeddings for clauses
        
        Args:
            clauses: List of clauses without embeddings
            
        Returns:
            Clauses with embeddings added
        """
        texts = [clause.text for clause in clauses]
        embeddings = self.embedder.encode(texts, show_progress_bar=True)
        
        for clause, embedding in zip(clauses, embeddings):
            clause.embedding = embedding.tolist()
        
        return clauses
    
    def store_in_chromadb(self, regulation_doc: RegulationDocument):
        """
        Store regulation clauses in ChromaDB
        
        Args:
            regulation_doc: RegulationDocument to store
        """
        ids = []
        embeddings = []
        documents = []
        metadatas = []
        
        for clause in regulation_doc.clauses:
            ids.append(clause.id)
            embeddings.append(clause.embedding)
            documents.append(clause.text)
            metadatas.append({
                "country": regulation_doc.country,
                "authority": regulation_doc.authority,
                "section": clause.section,
                "clause_number": clause.clause_number,
                "requirement_type": clause.requirement_type or "",
                "severity": clause.severity or "",
            })
        
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )
    
    def build_knowledge_graph(
        self,
        regulation_doc: RegulationDocument,
        triplets: List[RegulationTriplet]
    ):
        """
        Build knowledge graph with 3 edge types:
        1. LLM-based edges (from agent triplets)
        2. Semantic similarity edges (from embeddings)
        3. Nearby chunk edges (connect adjacent requirements)
        
        Args:
            regulation_doc: RegulationDocument
            triplets: List of extracted triplets from agent
        """
        # Add clause nodes
        for clause in regulation_doc.clauses:
            self.graph_builder.add_clause_node(clause)
        
        # Edge Type 1: LLM-based semantic relationships (from agent)
        for triplet in triplets:
            self.graph_builder.add_triplet(triplet)
        
        # Edge Type 2: Semantic similarity edges (from embeddings)
        self.graph_builder.add_semantic_similarity_edges(
            regulation_doc.clauses,
            similarity_threshold=0.75,  # High similarity only
            max_edges_per_node=5  # Keep it sparse
        )
        
        # Edge Type 3: Nearby chunk edges (connect to immediate neighbor only)
        self.graph_builder.add_nearby_chunk_edges(regulation_doc.clauses)
    
    async def ingest_regulation(
        self,
        pdf_path: str,
        country: str,
        authority: str,
        title: str,
        version: str = "2024"
    ) -> RegulationDocument:
        """
        Complete workflow: ingest MESSY regulation PDF and build knowledge graph
        
        Args:
            pdf_path: Path to regulation PDF
            country: Country code (USA, EU, Japan)
            authority: Authority (FDA, EMA, PMDA)
            title: Regulation title
            version: Version string
            
        Returns:
            RegulationDocument object
        """
        print(f"\n=== Ingesting {authority} Regulation (Messy/Unstructured) ===")
        
        # Step 1: Extract text from PDF
        print("Step 1: Extracting text from PDF...")
        text = self.extract_text_from_pdf(pdf_path)
        print(f"Extracted {len(text)} characters")
        
        # Step 2: Parse with agent (handles messy text)
        print("Step 2: Parsing messy regulation with agent...")
        clauses = await self.parse_regulation_with_agent(text, country, authority)
        print(f"Extracted {len(clauses)} requirements")
        
        # Step 3: Generate embeddings
        print("Step 3: Generating embeddings...")
        clauses = self.embed_clauses(clauses)
        print("Embeddings generated")
        
        # Step 4: Create regulation document
        reg_doc = RegulationDocument(
            id=f"{authority}-{version}",
            title=title,
            country=country,
            authority=authority,
            version=version,
            clauses=clauses,
        )
        
        # Step 5: Store in ChromaDB
        print("Step 4: Storing in ChromaDB...")
        self.store_in_chromadb(reg_doc)
        print("Stored in vector database")
        
        # Step 6: Extract semantic triplets
        print("Step 5: Extracting semantic relationships with agent...")
        triplets = await self.extract_triplets_with_agent(clauses)
        print(f"Extracted {len(triplets)} triplets")
        
        # Step 7: Build knowledge graph
        print("Step 6: Building knowledge graph...")
        self.build_knowledge_graph(reg_doc, triplets)
        graph_stats = self.graph_builder.get_stats()
        print(f"Graph built: {graph_stats}")
        
        # Step 8: Save graph
        print("Step 7: Saving graph...")
        graph_path = f"./data/graphs/{authority}-{version}.json"
        self.graph_builder.save(graph_path)
        print(f"Graph saved to {graph_path}")
        
        print(f"\n=== {authority} Regulation Ingestion Complete ===\n")
        
        return reg_doc
    
    def retrieve_with_hipporag(
        self,
        query_text: str,
        country: str,
        top_k: int = 10
    ) -> List[Dict]:
        """
        Retrieve relevant regulations using HippoRAG (vector + graph)
        
        Args:
            query_text: Query text (e.g., protocol section)
            country: Filter by country
            top_k: Number of results to return
            
        Returns:
            List of relevant regulation clauses with scores
        """
        # Step 1: Vector search for seeds
        query_embedding = self.embedder.encode([query_text])[0]
        
        vector_results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            where={"country": country},
            n_results=5,  # Get top 5 seeds
        )
        
        if not vector_results['ids'][0]:
            return []
        
        seed_node_ids = vector_results['ids'][0]
        
        # Step 2: Run Personalized PageRank
        ppr_scores = self.graph_builder.personalized_pagerank(
            seed_nodes=seed_node_ids,
            alpha=0.85
        )
        
        # Step 3: Rank all nodes by PPR score
        ranked_nodes = sorted(
            ppr_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        # Step 4: Get top-K nodes
        results = []
        for node_id, ppr_score in ranked_nodes[:top_k]:
            node_data = self.graph_builder.get_node_data(node_id)
            if node_data and node_data.get('type') == 'clause':
                results.append({
                    "clause_id": node_id,
                    "text": node_data.get('text', ''),
                    "ppr_score": ppr_score,
                    "section": node_data.get('section', ''),
                    "severity": node_data.get('severity', ''),
                })
        
        return results
