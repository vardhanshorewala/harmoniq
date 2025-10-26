# Harmoniq Backend - Clinical Trial Compliance API

FastAPI backend for clinical trial protocol compliance checking using **Hybrid HippoRAG/GraphRAG**, **Knowledge Graphs**, and **Diffusion-Based PageRank**.

---

## Problem

When FDA/EMA/PMDA regulations change, pharma companies waste **130-160 days** manually checking affected protocols. Each day costs **$6M** = **$780M-$960M** lost per regulation change.

**Solution:** Automated multi-jurisdiction compliance checking in **<15 seconds**.

---

## Hybrid Retrieval Architecture

### HippoRAG + GraphRAG Integration

Combines two complementary approaches:

**1. HippoRAG (Vector-Seeded Graph Diffusion)**
- Dense retrieval seeds graph walk
- Multi-hop relevance propagation
- Captures indirect relationships

**2. GraphRAG (Knowledge Graph Construction)**
- LLM-extracted requirement relationships
- Multi-edge type graph (RELATED_TO, SIMILAR_TO, NEARBY)
- Structured regulatory knowledge

**Hybrid Pipeline:**

```
Protocol Text
    ↓
[Dense Retrieval] sentence-transformers → ChromaDB
    ↓
Top-K Seed Nodes (k=10)
    ↓
[Graph Diffusion] Personalized PageRank (α=0.85)
    ↓
Multi-hop propagation through:
  - RELATED_TO edges (weight: 1.0) - semantic relationships
  - SIMILAR_TO edges (weight: 0.1) - embedding similarity
  - NEARBY edges (weight: 0.3) - document structure
    ↓
[Fusion] Re-rank by PPR scores
    ↓
[Agent Analysis] Multi-violation compliance check
    ↓
Comprehensive Compliance Report
```

### Diffusion-Based PageRank

**Mathematical Foundation:**

```
PR(v) = (1 - α) · p(v) + α · Σ(w(u,v) · PR(u) / deg_out(u))

Where:
- α = 0.85 (damping factor)
- p(v) = personalization vector (1/k for seeds, 0 otherwise)
- w(u,v) = edge weight (1.0 for RELATED_TO, 0.1 for SIMILAR_TO, 0.3 for NEARBY)
- deg_out(u) = weighted out-degree of node u
```

**Multi-Hop Diffusion:**
- Iteration 1: Immediate neighbors of seed nodes
- Iteration 2-10: Propagate through indirect connections
- Convergence: <100 iterations (typical: 20-30)

**Example:**
```
Seed: FDA-REQ-001 "informed consent"
Hop 1: FDA-REQ-005 "IRB approval" (RELATED_TO, score: 0.85)
Hop 2: FDA-REQ-012 "adverse event reporting" (RELATED_TO from REQ-005, score: 0.72)
Hop 3: FDA-REQ-018 "data retention" (SIMILAR_TO from REQ-012, score: 0.31)

Traditional vector search: only FDA-REQ-001
HippoRAG retrieval: REQ-001, REQ-005, REQ-012, REQ-018 (4x coverage)
```

---

## Multi-Jurisdiction Architecture

### Country-Specific Isolation

```
data/
├── usa/
│   ├── chroma/          # FDA vector database
│   └── graphs/          # FDA knowledge graphs (179 nodes, 431 edges)
├── eu/
│   ├── chroma/          # EMA vector database
│   └── graphs/          # EMA knowledge graphs (250+ nodes, 600+ edges)
└── japan/
    ├── chroma/          # PMDA vector database
    └── graphs/          # PMDA knowledge graphs (200+ nodes, 500+ edges)
```

**Routing Logic:**
```python
def get_regulation_service(country: str):
    country_map = {"USA": "usa", "EU": "eu", "JAPAN": "japan"}
    country_dir = country_map[country.upper()]
    
    # Each service instance manages:
    # - ChromaDB at data/{country_dir}/chroma
    # - Graphs at data/{country_dir}/graphs
    return RegulationService(country=country_dir)
```

---

## System Components

### 1. Agent Layer

**Parser Agent:**
- Extracts 10-20 atomic requirements per 1500-char chunk
- Handles messy, unstructured PDFs
- Identifies topic, severity, requirement type

**Relationship Agent:**
- Processes requirements in batches of 30
- Finds semantic relationships (LLM-based)
- Generates confidence scores (0-1)

**Compliance Agent:**
- **Multi-violation detection** (checks ALL regulations independently)
- Reports 0 to N violations per chunk
- Filters low-confidence violations (<0.85 threshold)
- Severity-weighted compliance scoring

**Fix Agent:**
- Generates 1-2 targeted diffs per violation
- Labels each change with violation it addresses
- Prioritizes critical violations
- Minimal changes for compliance

### 2. Storage Layer

**ChromaDB (Per Country):**
- Vector dimension: 384 (all-MiniLM-L6-v2)
- Stores: embeddings, metadata (country, severity, section)
- Index: HNSW (approximate nearest neighbors)
- Query time: ~100ms

**NetworkX Graphs (Per Country):**
- Node attributes: text, section, severity, country, authority
- Edge attributes: relation type, confidence, weight
- Saved as JSON (persistent)
- Load time: ~200ms

### 3. Retrieval Layer

**Vector Search:**
```python
query_embedding = embedder.encode(protocol_text)
results = chromadb.query(
    query_embeddings=[query_embedding],
    where={"country": "EU"},
    n_results=10
)
seed_nodes = results['ids'][0]
```

**Graph Diffusion:**
```python
personalization = {seed: 1/len(seeds) for seed in seed_nodes}
ppr_scores = nx.pagerank(
    graph,
    personalization=personalization,
    alpha=0.85,
    max_iter=100,
    weight='confidence'  # Edge weight attribute
)
ranked = sorted(ppr_scores.items(), key=lambda x: x[1], reverse=True)[:10]
```

---

## API Endpoints

### Upload Regulation (Country-Specific)

```bash
POST /api/regulations/upload

curl -X POST "http://localhost:8000/api/regulations/upload" \
  -F "file=@regulation.pdf" \
  -F "country=EU" \
  -F "authority=EMA" \
  -F "title=Clinical Trials Regulation" \
  -F "version=2024"
```

Response:
```json
{
  "regulation_id": "EMA-2024",
  "num_clauses": 25,
  "graph_stats": {
    "num_nodes": 25,
    "num_edges": 87,
    "edge_types": {"RELATED_TO": 12, "SIMILAR_TO": 45, "NEARBY": 30}
  }
}
```

### Check PDF Compliance (Multi-Chunk + Multi-Violation)

```bash
POST /api/regulations/check-pdf-compliance

curl -X POST "http://localhost:8000/api/regulations/check-pdf-compliance" \
  -F "file=@protocol.pdf" \
  -F "country=EU" \
  -F "num_chunks=12" \
  -F "top_k=10"
```

Response:
```json
{
  "filename": "protocol.pdf",
  "total_chunks": 12,
  "overall_compliance_score": 0.783,
  "total_violations": 5,
  "critical_violations": 2,
  "chunk_results": [
    {
      "chunk_index": 0,
      "compliance_score": 0.800,
      "violations": [
        {
          "regulation_id": "EMA-CHUNK40-REQ-001",
          "severity": "critical",
          "non_compliance_probability": 0.92,
          "explanation": "Missing informed consent elements per EU CTR Article 29",
          "missing_elements": ["risks", "benefits", "withdrawal rights"]
        }
      ]
    }
  ],
  "processing_time_seconds": 12.45
}
```

### Fix PDF Violations (Targeted Amendments)

```bash
POST /api/regulations/fix-pdf-violations

curl -X POST "http://localhost:8000/api/regulations/fix-pdf-violations" \
  -F "file=@protocol.pdf" \
  -F "country=EU" \
  -F "compliance_results=@results.json"
```

Response:
```json
{
  "changes": [
    {
      "type": "replace",
      "original": "Participants will be informed about the study",
      "replacement": "Participants will receive written informed consent including purpose, risks, benefits, and withdrawal rights",
      "reason": "VIOLATION 1: Missing Article 29 elements",
      "addresses_violation": 1
    }
  ],
  "total_changes": 2
}
```

### Query Knowledge Graph

```bash
GET /api/regulations/graph/data?country=USA

curl "http://localhost:8000/api/regulations/graph/data?country=EU"
```

### HippoRAG Retrieval

```bash
POST /api/regulations/retrieve

curl -X POST "http://localhost:8000/api/regulations/retrieve" \
  -H "Content-Type: application/json" \
  -d '{
    "query_text": "informed consent requirements",
    "country": "EU",
    "top_k": 5
  }'
```

---

## Project Structure

```
backend-fastapi/
├── app/
│   ├── main.py                    # FastAPI entry point
│   ├── agents/
│   │   ├── lava_agent.py          # LLM wrapper
│   │   ├── compliance_agent.py    # Multi-violation checker
│   │   ├── violation_fix_agent.py # Fix generator
│   │   └── prompts/
│   ├── api/routes/regulations.py  # Endpoints + country routing
│   ├── chroma/client.py           # ChromaDB client (per country)
│   ├── graph/graph_builder.py     # NetworkX + PageRank
│   ├── models/regulation.py       # Data models
│   └── services/regulation_service.py  # Main pipeline
├── data/{country}/
│   ├── chroma/                    # Vector DB
│   └── graphs/                    # Knowledge graphs
├── Dockerfile                     # Production image
├── docker-compose.yml             # Orchestration
└── pyproject.toml                 # Dependencies
```

---

## Installation

### Docker (Recommended)

```bash
cd backend-fastapi
echo "LAVA_API_KEY=your_key" > .env
docker-compose up -d
docker-compose logs -f backend
```

### Manual

```bash
cd backend-fastapi
poetry install
poetry shell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Access:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs

---

## Performance Benchmarks

| Metric | Value |
|--------|-------|
| Regulation Upload | 20-30s per PDF |
| Requirements per Chunk | 10-20 (1500 chars) |
| Graph Construction | <1s |
| Vector Search | ~100ms |
| PageRank Computation | ~200ms |
| HippoRAG Total | ~500ms |
| Compliance Check (single chunk) | 3-5s |
| Full PDF (12 chunks, parallel) | 12-15s |
| Jurisdictions | 3 (USA, EU, Japan) |
| Total Nodes | 600+ |
| Total Edges | 1500+ |

---

## Technical Details

### Knowledge Graph Construction

**Step 1: Requirement Extraction**
```python
# LLM extracts atomic requirements
prompt = """
Extract REQUIREMENTS from this regulation text.
Return JSON: [{"id": "REQ-001", "text": "...", "severity": "critical"}, ...]
"""
requirements = await agent.parse_regulation(text, country, authority)
```

**Step 2: Relationship Extraction**
```python
# LLM finds semantic relationships
prompt = """
Find which requirements are RELATED (similar topics, dependencies).
Return JSON: [{"subject": "REQ-001", "object": "REQ-005", "confidence": 0.85}, ...]
"""
triplets = await agent.extract_triplets(requirements)
```

**Step 3: Graph Building**
```python
# Add LLM edges (RELATED_TO)
for triplet in triplets:
    graph.add_edge(triplet.subject, triplet.object,
                   relation="RELATED_TO", weight=1.0, confidence=triplet.confidence)

# Add similarity edges (SIMILAR_TO)
similarity_matrix = cosine_similarity(embeddings)
for i, j in high_similarity_pairs(similarity_matrix, threshold=0.75):
    graph.add_edge(req[i], req[j], relation="SIMILAR_TO", weight=0.1)

# Add sequential edges (NEARBY)
for i in range(len(requirements) - 1):
    graph.add_edge(req[i], req[i+1], relation="NEARBY", weight=0.3)
```

### Multi-Violation Detection

**Compliance Agent Prompt:**
```
⚠️ IMPORTANT: A SINGLE PROTOCOL PARAGRAPH CAN VIOLATE MULTIPLE REGULATIONS
- Check EVERY regulation independently
- Report ALL violations found (not just first one)
- Each chunk may have 0, 1, or MULTIPLE violations
- Do NOT stop after finding one violation

For each regulation, return:
{"regulation_id": "...", "is_compliant": true/false, "explanation": "..."}
```

**Implementation:**
```python
# Agent returns array with one entry per regulation
results = await compliance_agent.check_compliance(chunk, regulations)

# Filter to violations only
violations = [r for r in results if not r['is_compliant'] 
              and r['non_compliance_probability'] >= 0.85]

# Each chunk can have 0 to N violations
return {
    "chunk_index": i,
    "violations": violations,  # Can be empty list or multiple items
    "compliance_score": compliant_count / total_count
}
```

---

## Configuration

### Environment Variables

```bash
# .env
LAVA_API_KEY=your_lava_api_key
ANTHROPIC_MODEL=claude-3-5-sonnet-20240620
ANTHROPIC_VERSION=2023-06-01
HOST=0.0.0.0
PORT=8000
WORKERS=4
```

### Docker Configuration

**Multi-stage build** for optimized image size:
```dockerfile
FROM python:3.11-slim as builder
# Install dependencies
FROM python:3.11-slim
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/
# Run as non-root user
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--workers", "4"]
```

**Docker Compose:**
```yaml
services:
  backend:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data  # Persist ChromaDB and graphs
    environment:
      - LAVA_API_KEY=${LAVA_API_KEY}
```

---

## Algorithm Complexity

| Operation | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| Vector Search (HNSW) | O(log N) | O(N × d) |
| PageRank | O(E × k) | O(N) |
| Graph Construction | O(N² + E) | O(N + E) |
| Compliance Check | O(R × T) | O(R) |

Where:
- N = number of regulations
- E = number of edges
- d = embedding dimension (384)
- k = PageRank iterations (~20-30)
- R = retrieved regulations (typically 10)
- T = LLM inference time (~3s)

---

## Future Enhancements

**v2.0 Roadmap:**
- Additional jurisdictions (Health Canada, Australia TGA)
- Regulation version tracking and diff computation
- Conflict detection between jurisdictions
- Advanced graph analytics (community detection, centrality)
- Batch protocol processing
- GraphQL API
- Alternative embedding models (ada-002, e5-large)
- Approximate PageRank for large graphs

---

## Tech Stack

- **FastAPI** - Async API framework
- **LavaLabs** - LLM API (Claude 3.5 Sonnet)
- **ChromaDB** - Vector database (HNSW index)
- **NetworkX** - Graph library (PageRank implementation)
- **sentence-transformers** - Embeddings (all-MiniLM-L6-v2)
- **PyMuPDF** - PDF extraction
- **scikit-learn** - Cosine similarity
- **asyncio** - Concurrent chunk processing
- **Docker** - Containerization

---

## References

- **HippoRAG**: "HippoRAG: Neurobiologically Inspired Long-Term Memory for Large Language Models" (NeurIPS 2024)
- **GraphRAG**: Microsoft Research, 2024
- **Personalized PageRank**: "The PageRank Citation Ranking" (Page et al., 1998)
- **ChromaDB**: Open-source embedding database
- **NetworkX**: Python graph library

---

## License

MIT License

---

## Support

- API Documentation: `/docs` endpoint
- Docker Guide: `README.Docker.md`
- Agent Prompts: `app/agents/prompts/`

---

**Built for clinical research teams navigating complex global regulations.**
