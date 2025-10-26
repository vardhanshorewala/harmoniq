"""Service for handling regulation documents and compliance checking"""

import asyncio
import json
import re
from pathlib import Path
from typing import Dict, List, Optional

from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

from app.agents import LavaAgent
from app.agents.compliance_agent import ComplianceAgent
from app.chroma import get_chroma_client
from app.graph.graph_builder import RegulationGraphBuilder
from app.models.regulation import (
    RegulationClause,
    RegulationDocument,
    RegulationTriplet,
)


class RegulationService:
    """Service for processing MESSY, UNSTRUCTURED regulations and building knowledge graphs"""
    
    def __init__(self, country: str = "USA"):
        """
        Initialize regulation service
        
        Args:
            country: Country code (USA, JAPAN, EU, etc.) - determines storage paths
        """
        self.country = country.lower()
        self.agent = LavaAgent()
        self.compliance_agent = ComplianceAgent()
        
        # Set up country-specific paths
        self.data_dir = Path(f"./data/{self.country}")
        self.graph_dir = self.data_dir / "graphs"
        self.chroma_dir = self.data_dir / "chroma"
        
        # Create directories
        self.graph_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize ChromaDB with country-specific directory
        self.chroma_client = get_chroma_client(persist_directory=str(self.chroma_dir))
        self.graph_builder = RegulationGraphBuilder()
        
        # Initialize embedding model (local, no API needed)
        print("Loading embedding model...")
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        print("Embedding model loaded")
        
        # Load existing graph if available (try to find any graph in the country directory)
        existing_graphs = list(self.graph_dir.glob("*.json"))
        if existing_graphs:
            # Load the first graph found (you can modify this logic)
            graph_path = existing_graphs[0]
            print(f"Loading existing graph from {graph_path}...")
            self.graph_builder.load(str(graph_path))
            stats = self.graph_builder.get_stats()
            print(f"Graph loaded: {stats['num_nodes']} nodes, {stats['num_edges']} edges")
        else:
            print(f"No existing graph found for {country}, starting with empty graph")
        
        # Get or create ChromaDB collection for regulations
        self.collection = self.chroma_client.get_or_create_collection(
            name="regulations",
            metadata={"description": "Regulation clauses and requirements", "country": country}
        )
    
    def _extract_and_clean_json(self, response_text: str) -> Optional[List]:
        """
        Robustly extract and parse JSON from LLM response.
        Handles: markdown code blocks, extra text, common formatting issues.
        
        Args:
            response_text: Raw response from LLM
            
        Returns:
            Parsed JSON array or None if parsing fails
        """
        # Remove markdown code blocks
        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*', '', response_text)
        
        # Try to extract JSON array using regex
        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group()
        else:
            json_str = response_text.strip()
        
        # Clean common issues
        # Fix unescaped quotes in strings (simple heuristic)
        # This is a best-effort fix for common LLM mistakes
        
        # Try parsing multiple times with different cleaning strategies
        strategies = [
            lambda s: s,  # Try as-is first
            lambda s: s.replace('\n', ' '),  # Remove newlines
            lambda s: re.sub(r',\s*([}\]])', r'\1', s),  # Remove trailing commas
            lambda s: s.replace('\\"', '"').replace('"', '\\"').replace('\\"', '"', 1),  # Fix quote escaping (basic)
        ]
        
        for i, clean_fn in enumerate(strategies):
            try:
                cleaned = clean_fn(json_str)
                return json.loads(cleaned)
            except json.JSONDecodeError as e:
                if i == len(strategies) - 1:
                    # Last strategy failed, give up
                    print(f"    JSON parse error after all strategies: {str(e)[:100]}")
                    return None
                # Try next strategy
                continue
        
        return None
    
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
        """
        Split text into chunks - force split if no natural breaks
        """
        # Try paragraph breaks first
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        
        # If only 1-2 paragraphs, try single newlines
        if len(paragraphs) <= 2:
            paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
        
        # If still minimal splits, try sentences
        if len(paragraphs) <= 5:
            import re
            paragraphs = [s.strip() for s in re.split(r'[.!?]\s+', text) if s.strip()]
        
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            if len(current_chunk) + len(para) + 2 < chunk_size:
                current_chunk += para + " "
            else:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                current_chunk = para + " "
        
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        # Force split if still too few chunks
        if len(chunks) < 10 and len(text) > chunk_size * 10:
            print(f"  Warning: Only {len(chunks)} natural chunks found, forcing split...")
            chunks = []
            for i in range(0, len(text), chunk_size):
                chunk = text[i:i + chunk_size].strip()
                if chunk:
                    chunks.append(chunk)
        
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
        
        Your task: Extract ATOMIC REQUIREMENTS (one specific action per requirement).
        Each requirement must be SHORT (1 sentence, under 150 characters if possible).
        
        Text:
        {text}
        
        For each requirement found:
        - Give it a unique ID (REQ-001, REQ-002, etc.)
        - Extract ONE SPECIFIC requirement in 1 SHORT sentence
        - Classify if mandatory ("must"/"shall") or recommended ("should"/"may")
        - Rate severity: critical/high/medium/low
        - Identify the TOPIC (e.g., "data validation", "user authentication", "audit trails")
        
        CRITICAL RULES: 
        - ONE requirement = ONE specific action or rule
        - BREAK DOWN complex paragraphs into multiple atomic requirements
        - PREFER short, focused requirements (1 sentence each)
        - If a sentence contains "and" or multiple clauses, split them
        - Extract EVERY distinct requirement, no matter how small
        
        Return as JSON array:
        [
          {{
            "id": "REQ-001",
            "text": "Sponsors must obtain FDA approval before starting trials",
            "topic": "approval process",
            "requirement_type": "mandatory",
            "severity": "critical"
          }},
          {{
            "id": "REQ-002",
            "text": "Informed consent forms must be signed by participants",
            "topic": "informed consent",
            "requirement_type": "mandatory",
            "severity": "critical"
          }},
          ...
        ]
        
        Extract 3-8 atomic requirements from this small text chunk. Be thorough.
        """
        
        try:
            response = await self.agent.call(prompt, temperature=0.3)
            response_text = self.agent.get_text_response(response)
            
            # Extract and clean JSON
            requirements_data = self._extract_and_clean_json(response_text)
            
            if not requirements_data:
                print(f"    ⚠️  Failed to parse JSON from chunk {chunk_id}, skipping")
                return []
            
            # Convert to RegulationClause objects
            clauses = []
            for req_data in requirements_data:
                try:
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
                except (KeyError, TypeError) as e:
                    print(f"    ⚠️  Skipping malformed requirement in chunk {chunk_id}: {e}")
                    continue
            
            return clauses
        
        except Exception as e:
            print(f"    ⚠️  Error parsing chunk {chunk_id}: {e}")
            return []
    
    async def parse_regulation_with_agent(
        self,
        text: str,
        country: str,
        authority: str,
        batch_size: int = 10  # 15 concurrent requests per batch (balanced for rate limits)
    ) -> List[RegulationClause]:
        """
        Use agent to parse MESSY regulation text into semantic requirement chunks
        Optimized with concurrent batch processing
        
        Args:
            text: Regulation text (unstructured, messy)
            country: Country (USA, EU, Japan)
            authority: Authority (FDA, EMA, PMDA)
            batch_size: Number of chunks to process concurrently (default: 50)
            
        Returns:
            List of RegulationClause objects
        """
        # Chunk text if too long (API limits)
        max_chunk_size = 1500  # Very small chunks (2-3 sentences) for atomic extraction
        if len(text) > max_chunk_size:
            # Process in chunks and combine
            chunks = self._chunk_text(text, max_chunk_size)
            all_clauses = []
            print(f"  Total chunks to process: {len(chunks)}")
            print(f"  Processing in batches of {batch_size} for speed...")
            
            # Process chunks in batches concurrently
            for batch_start in range(0, len(chunks), batch_size):
                batch_end = min(batch_start + batch_size, len(chunks))
                batch = chunks[batch_start:batch_end]
                
                print(f"  Processing batch {batch_start//batch_size + 1} (chunks {batch_start+1}-{batch_end})...")
                
                # Process batch concurrently (10 at a time)
                tasks = [
                    self._parse_chunk(chunk, country, authority, batch_start + i)
                    for i, chunk in enumerate(batch)
                ]
                batch_results = await asyncio.gather(*tasks)
                
                # Combine results
                for chunk_clauses in batch_results:
                    all_clauses.extend(chunk_clauses)
                
                print(f"    → Extracted {sum(len(r) for r in batch_results)} requirements from batch")
                
                # Wait 2 seconds between batches to avoid rate limiting
                if batch_start + batch_size < len(chunks):  # Don't wait after last batch
                    wait_time = 4.0  # 2 seconds between batches
                    print(f"    Waiting {wait_time}s before next batch...")
                    await asyncio.sleep(wait_time)
            
            print(f"  ✓ Total requirements extracted: {len(all_clauses)}")
            return all_clauses
        else:
            return await self._parse_chunk(text, country, authority, 0)
    
    async def _extract_triplets_for_batch(
        self,
        batch_clauses: List[RegulationClause],
        batch_num: int
    ) -> List[RegulationTriplet]:
        """Extract triplets for a single batch of clauses"""
        clauses_summary = "\n".join([
            f"{clause.id} [{clause.section}]: {clause.text[:80]}..."
            for clause in batch_clauses
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
        
        Return as JSON array (find at least 15-20 relationships - be thorough!):
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
        
        Be GENEROUS with relationships - find ALL meaningful connections!
        Look for: same topic, related processes, prerequisite relationships, complementary requirements.
        """
        
        try:
            response = await self.agent.call(prompt, temperature=0.3)
            response_text = self.agent.get_text_response(response)
            
            # Extract and clean JSON
            triplets_data = self._extract_and_clean_json(response_text)
            
            if not triplets_data:
                print(f"  ⚠️  Failed to parse JSON from batch {batch_num}, skipping")
                return []
            
            # Convert to RegulationTriplet objects
            batch_triplets = []
            for triplet_data in triplets_data:
                try:
                    triplet = RegulationTriplet(
                        subject=triplet_data['subject'],
                        predicate=triplet_data['predicate'],
                        object=triplet_data['object'],
                        confidence=triplet_data.get('confidence', 0.8),
                    )
                    batch_triplets.append(triplet)
                except (KeyError, TypeError) as e:
                    print(f"    ⚠️  Skipping malformed triplet in batch {batch_num}: {e}")
                    continue
            return batch_triplets
        
        except Exception as e:
            print(f"  ⚠️  Error extracting triplets for batch {batch_num}: {e}")
            return []
    
    async def extract_triplets_with_agent(
        self,
        clauses: List[RegulationClause],
        batch_size: int = 30,
        concurrent_batches: int = 10
    ) -> List[RegulationTriplet]:
        """
        Use agent to extract SEMANTIC relationships between requirements
        Optimized with concurrent batch processing
        
        Args:
            clauses: List of regulation clauses
            batch_size: Number of clauses per batch (default: 30)
            concurrent_batches: Number of batches to process concurrently (default: 10)
            
        Returns:
            List of RegulationTriplet objects
        """
        print(f"  Processing {len(clauses)} clauses in batches of {batch_size}")
        
        # Split clauses into batches
        batches = []
        for batch_start in range(0, len(clauses), batch_size):
            batch_end = min(batch_start + batch_size, len(clauses))
            batches.append(clauses[batch_start:batch_end])
        
        all_triplets = []
        
        # Process batches sequentially with delays
        for i, batch in enumerate(batches):
            print(f"  Processing relationship batch {i+1}/{len(batches)}...")
            
            try:
                batch_triplets = await self._extract_triplets_for_batch(batch, i)
                all_triplets.extend(batch_triplets)
            except Exception as e:
                print(f"  ⚠️  Error extracting triplets for batch {i}: {str(e)}")
            
            # Wait 2 seconds between batches
            if i < len(batches) - 1:
                wait_time = 2.0  # 2 seconds between batches
                print(f"    Waiting {wait_time}s before next batch...")
                await asyncio.sleep(wait_time)
        
        print(f"  ✓ Extracted {len(all_triplets)} relationships")
        return all_triplets
    
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
        Build knowledge graph with 2 edge types (weighted differently in PPR):
        1. LLM-based edges (RELATED_TO) - HIGH weight, contextual understanding
        2. Semantic similarity edges (SIMILAR_TO) - LOW weight, backup connections
        
        Args:
            regulation_doc: RegulationDocument
            triplets: List of extracted triplets from agent
        """
        # Add clause nodes
        for clause in regulation_doc.clauses:
            self.graph_builder.add_clause_node(clause)
        
        # Edge Type 1: LLM-based semantic relationships (HIGH WEIGHT)
        # These are high-quality, contextual relationships identified by the LLM
        for triplet in triplets:
            # Mark as high weight for PPR
            triplet.confidence = 1.0  # High weight
            self.graph_builder.add_triplet(triplet)
        
        # Edge Type 2: Semantic similarity edges (LOW WEIGHT)
        # Sparse backup connections based on embeddings
        self.graph_builder.add_semantic_similarity_edges(
            regulation_doc.clauses,
            similarity_threshold=0.80,  # Higher threshold = fewer edges
            max_edges_per_node=2,  # Very sparse (was 5)
            edge_weight=0.1  # Low weight for PPR
        )
    
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
        
        # Step 8: Save graph persistently
        print("Step 7: Saving graph...")
        graph_path = self.graph_dir / f"{authority}-{version}.json"
        self.graph_builder.save(str(graph_path))
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
            print(f"Vector search returned no results for country={country}")
            return []
        
        seed_node_ids = vector_results['ids'][0]
        print(f"Vector search found {len(seed_node_ids)} seed nodes")
        
        # Verify seeds exist in graph
        valid_seeds = []
        missing_seeds = []
        for sid in seed_node_ids:
            if self.graph_builder.graph.has_node(sid):
                valid_seeds.append(sid)
            else:
                missing_seeds.append(sid)
        
        if missing_seeds:
            print(f"⚠️  WARNING: {len(missing_seeds)} seed nodes not in graph:")
            for msid in missing_seeds[:3]:
                print(f"   - {msid}")
        
        print(f"✓ Valid seeds in graph: {len(valid_seeds)}/{len(seed_node_ids)}")
        
        if not valid_seeds:
            print("ERROR: No seed nodes found in graph! Vector DB and graph are out of sync.")
            return []
        
        # Step 2: Run Personalized PageRank
        ppr_scores = self.graph_builder.personalized_pagerank(
            seed_nodes=seed_node_ids,  # Will be filtered internally
            alpha=0.85
        )
        
        if not ppr_scores:
            print("ERROR: PPR returned empty scores")
            return []
        
        # Step 3: Rank all nodes by PPR score
        ranked_nodes = sorted(
            ppr_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        print(f"Top 3 PPR scores: {[(nid[:20], f'{score:.4f}') for nid, score in ranked_nodes[:3]]}")
        
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
        
        print(f"Returning {len(results)} regulation clauses")
        return results
    
    async def check_protocol_compliance(
        self,
        protocol_paragraph: str,
        country: str,
        top_k: int = 10
    ) -> Dict:
        """
        Check if a protocol paragraph complies with regulations
        
        Workflow:
        1. Use HippoRAG to find top-K relevant regulations
        2. Send paragraph + regulations to compliance agent
        3. Agent determines compliance and provides detailed analysis
        
        Args:
            protocol_paragraph: Text from protocol to check
            country: Country to check against (e.g., "USA")
            top_k: Number of regulations to check against (default: 10)
            
        Returns:
            Compliance analysis with detailed results
        """
        # Step 1: Find relevant regulations using HippoRAG
        relevant_regs = self.retrieve_with_hipporag(
            query_text=protocol_paragraph,
            country=country,
            top_k=top_k
        )
        
        if not relevant_regs:
            return {
                "error": "No relevant regulations found",
                "status": "ERROR",
                "protocol_text": protocol_paragraph
            }
        
        # Step 2: Check compliance with agent
        compliance_result = await self.compliance_agent.check_compliance(
            protocol_paragraph=protocol_paragraph,
            relevant_regulations=relevant_regs
        )
        
        return compliance_result
