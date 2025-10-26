"""
Test script for regulation processing

Usage:
    python test_regulation.py
"""

import asyncio
from app.services import RegulationService


async def test_regulation_processing():
    """Test the regulation service"""
    
    print("\n" + "="*60)
    print("TESTING REGULATION SERVICE")
    print("="*60 + "\n")
    
    # Initialize service
    print("Initializing RegulationService...")
    service = RegulationService()
    print("✓ Service initialized\n")
    
    # Test with sample text (simulating PDF extraction)
    sample_regulation_text = """
    21 CFR Part 11 - Electronic Records; Electronic Signatures
    
    Subpart B - Electronic Records
    
    § 11.10 Controls for closed systems.
    Persons who use closed systems to create, modify, maintain, or transmit 
    electronic records shall employ procedures and controls designed to ensure 
    the authenticity, integrity, and, when appropriate, the confidentiality of 
    electronic records, and to ensure that the signer cannot readily repudiate 
    the signed record as not genuine. Such procedures and controls shall include 
    the following:
    
    (a) Validation of systems to ensure accuracy, reliability, consistent intended 
    performance, and the ability to discern invalid or altered records.
    
    (b) The ability to generate accurate and complete copies of records in both 
    human readable and electronic form suitable for inspection, review, and copying 
    by the agency. Persons should contact the agency if there are any questions 
    regarding the ability of the agency to perform such review and copying of the 
    electronic records.
    
    (c) Protection of records to enable their accurate and ready retrieval throughout 
    the records retention period.
    
    (d) Limiting system access to authorized individuals.
    
    (e) Use of secure, computer-generated, time-stamped audit trails to independently 
    record the date and time of operator entries and actions that create, modify, or 
    delete electronic records. Record changes shall not obscure previously recorded 
    information. Such audit trail documentation shall be retained for a period at 
    least as long as that required for the subject electronic records and shall be 
    available for agency review and copying.
    
    § 11.50 Signature manifestations.
    (a) Signed electronic records shall contain information associated with the 
    signing that clearly indicates all of the following:
    (1) The printed name of the signer;
    (2) The date and time when the signature was executed; and
    (3) The meaning (such as review, approval, responsibility, or authorship) 
    associated with the signature.
    
    (b) The items identified in paragraphs (a)(1), (a)(2), and (a)(3) of this 
    section shall be subject to the same controls as for electronic records and 
    shall be included as part of any human readable form of the electronic record 
    (such as electronic display or printout).
    """
    
    print("Step 1: Parsing regulation text...")
    clauses = await service.parse_regulation_with_agent(
        text=sample_regulation_text,
        country="USA",
        authority="FDA"
    )
    print(f"✓ Extracted {len(clauses)} clauses\n")
    
    for i, clause in enumerate(clauses[:3], 1):
        print(f"Clause {i}:")
        print(f"  ID: {clause.id}")
        print(f"  Number: {clause.clause_number}")
        print(f"  Text: {clause.text[:80]}...")
        print(f"  Type: {clause.requirement_type}")
        print(f"  Severity: {clause.severity}\n")
    
    print("Step 2: Generating embeddings...")
    clauses = service.embed_clauses(clauses)
    print(f"✓ Generated embeddings (dim={len(clauses[0].embedding)})\n")
    
    print("Step 3: Extracting relationship triplets...")
    triplets = await service.extract_triplets_with_agent(clauses)
    print(f"✓ Extracted {len(triplets)} triplets\n")
    
    for i, triplet in enumerate(triplets[:3], 1):
        print(f"Triplet {i}:")
        print(f"  {triplet.subject} --[{triplet.predicate}]--> {triplet.object}")
        print(f"  Confidence: {triplet.confidence}\n")
    
    print("Step 4: Building knowledge graph...")
    from app.models.regulation import RegulationDocument
    reg_doc = RegulationDocument(
        id="FDA-CFR21-Part11-Test",
        title="21 CFR Part 11",
        country="USA",
        authority="FDA",
        version="test",
        clauses=clauses
    )
    service.build_knowledge_graph(reg_doc, triplets)
    stats = service.graph_builder.get_stats()
    print(f"✓ Graph built:")
    print(f"  Nodes: {stats['num_nodes']}")
    print(f"  Edges: {stats['num_edges']}")
    print(f"  Node types: {stats['node_types']}")
    print(f"  Edge types: {stats['edge_types']}\n")
    
    # Print detailed graph structure
    print("="*60)
    print("DETAILED GRAPH STRUCTURE")
    print("="*60)
    
    graph = service.graph_builder.graph
    
    # Print all nodes
    print("\n=== ALL NODES ===")
    for i, (node_id, node_data) in enumerate(graph.nodes(data=True), 1):
        text = node_data.get('text', '')[:50]
        section = node_data.get('section', '')
        severity = node_data.get('severity', '')
        print(f"{i}. {node_id}")
        print(f"   Topic: {section}, Severity: {severity}")
        print(f"   Text: {text}...")
    
    # Print edges by type
    print("\n=== EDGES BY TYPE ===")
    edge_types = {}
    for u, v, data in graph.edges(data=True):
        relation = data.get('relation', 'unknown')
        if relation not in edge_types:
            edge_types[relation] = []
        confidence = data.get('confidence', 1.0)
        edge_types[relation].append((u, v, confidence))
    
    for relation, edges in sorted(edge_types.items()):
        print(f"\n{relation} ({len(edges)} edges):")
        for u, v, conf in edges[:8]:  # Show first 8
            print(f"  {u} --[{conf:.2f}]--> {v}")
        if len(edges) > 8:
            print(f"  ... and {len(edges) - 8} more")
    
    print("\n" + "="*60 + "\n")
    
    print("Step 5: Storing in ChromaDB...")
    service.store_in_chromadb(reg_doc)
    print("✓ Stored in vector database\n")
    
    print("Step 6: Testing HippoRAG retrieval...")
    query = "Electronic data capture systems with validation"
    print(f"Query: '{query}'")
    results = service.retrieve_with_hipporag(
        query_text=query,
        country="USA",
        top_k=5
    )
    print(f"✓ Found {len(results)} results\n")
    
    for i, result in enumerate(results, 1):
        print(f"Result {i} (PPR score: {result['ppr_score']:.4f}):")
        print(f"  Clause: {result['clause_id']}")
        print(f"  Text: {result['text'][:100]}...")
        print(f"  Section: {result['section']}")
        print(f"  Severity: {result['severity']}\n")
    
    print("="*60)
    print("✓ ALL TESTS PASSED!")
    print("="*60 + "\n")
    
    print("You can now:")
    print("1. Run the API server: uvicorn app.main:app --reload")
    print("2. Upload real FDA PDFs via POST /api/regulations/upload")
    print("3. Query with HippoRAG via POST /api/regulations/retrieve")


if __name__ == "__main__":
    asyncio.run(test_regulation_processing())

