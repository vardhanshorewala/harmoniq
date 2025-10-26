"""Build and manage knowledge graphs for regulations"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import networkx as nx
import numpy as np

from app.models.regulation import RegulationClause, RegulationTriplet


class RegulationGraphBuilder:
    """Build knowledge graph from regulations"""
    
    def __init__(self):
        """Initialize graph builder"""
        self.graph = nx.DiGraph()
        self.node_embeddings: Dict[str, np.ndarray] = {}
    
    def add_clause_node(self, clause: RegulationClause):
        """
        Add a regulation clause as a node in the graph
        
        Args:
            clause: RegulationClause object
        """
        self.graph.add_node(
            clause.id,
            type="clause",
            text=clause.text,
            section=clause.section,
            clause_number=clause.clause_number,
            requirement_type=clause.requirement_type,
            severity=clause.severity,
        )
        
        # Store embedding if available
        if clause.embedding:
            self.node_embeddings[clause.id] = np.array(clause.embedding)
    
    def add_triplet(self, triplet: RegulationTriplet):
        """
        Add a triplet (relationship) to the graph
        
        Args:
            triplet: RegulationTriplet object
        """
        # Ensure both nodes exist
        if not self.graph.has_node(triplet.subject):
            self.graph.add_node(triplet.subject, type="unknown")
        if not self.graph.has_node(triplet.object):
            self.graph.add_node(triplet.object, type="unknown")
        
        # Add edge with relationship
        self.graph.add_edge(
            triplet.subject,
            triplet.object,
            relation=triplet.predicate,
            confidence=triplet.confidence,
            source=triplet.source,
        )
    
    def add_nearby_chunk_edges(self, clauses: List[RegulationClause]):
        """
        Connect each requirement to its immediate neighbors (+1 and -1)
        Creates a simple sequential chain through the document
        
        Args:
            clauses: List of RegulationClause objects (in order)
        """
        for i, clause in enumerate(clauses):
            # Connect to next requirement only
            if i < len(clauses) - 1:
                self.add_triplet(RegulationTriplet(
                    subject=clause.id,
                    predicate="NEARBY",
                    object=clauses[i + 1].id,
                    confidence=1.0,
                ))
    
    def add_semantic_similarity_edges(
        self,
        clauses: List[RegulationClause],
        similarity_threshold: float = 0.75,
        max_edges_per_node: int = 5
    ):
        """
        Add edges based on embedding similarity (vector-based)
        
        Args:
            clauses: List of RegulationClause objects
            similarity_threshold: Minimum cosine similarity (default: 0.75)
            max_edges_per_node: Max similar clauses to connect (default: 5)
        """
        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity
        
        # Get embeddings
        embeddings = []
        clause_ids = []
        for clause in clauses:
            if clause.id in self.node_embeddings:
                embeddings.append(self.node_embeddings[clause.id])
                clause_ids.append(clause.id)
        
        if len(embeddings) < 2:
            return
        
        # Compute similarity matrix
        embeddings_array = np.array(embeddings)
        similarity_matrix = cosine_similarity(embeddings_array)
        
        # Add edges for similar clauses
        for i, clause_id in enumerate(clause_ids):
            # Get similarities for this clause
            similarities = similarity_matrix[i]
            
            # Find top-K most similar (excluding self)
            similar_indices = np.argsort(similarities)[::-1][1:max_edges_per_node + 1]
            
            for j in similar_indices:
                sim_score = similarities[j]
                if sim_score >= similarity_threshold:
                    self.add_triplet(RegulationTriplet(
                        subject=clause_id,
                        predicate="SIMILAR_TO",
                        object=clause_ids[j],
                        confidence=float(sim_score),
                    ))
    
    def get_neighbors(self, node_id: str, relation: Optional[str] = None) -> List[str]:
        """
        Get neighboring nodes
        
        Args:
            node_id: Node ID
            relation: Optional filter by relation type
            
        Returns:
            List of neighbor node IDs
        """
        if not self.graph.has_node(node_id):
            return []
        
        neighbors = []
        for neighbor in self.graph.successors(node_id):
            if relation is None:
                neighbors.append(neighbor)
            else:
                edge_data = self.graph[node_id][neighbor]
                if edge_data.get("relation") == relation:
                    neighbors.append(neighbor)
        
        return neighbors
    
    def personalized_pagerank(
        self,
        seed_nodes: List[str],
        alpha: float = 0.85,
        max_iter: int = 100,
    ) -> Dict[str, float]:
        """
        Run Personalized PageRank from seed nodes
        
        Args:
            seed_nodes: Starting nodes for PPR
            alpha: Damping factor (default: 0.85)
            max_iter: Maximum iterations
            
        Returns:
            Dict mapping node IDs to PPR scores
        """
        # Create personalization vector (uniform over seeds)
        personalization = {node: 0.0 for node in self.graph.nodes()}
        for seed in seed_nodes:
            if seed in personalization:
                personalization[seed] = 1.0 / len(seed_nodes)
        
        # Run PPR
        try:
            ppr_scores = nx.pagerank(
                self.graph,
                alpha=alpha,
                personalization=personalization,
                max_iter=max_iter,
            )
            return ppr_scores
        except Exception as e:
            print(f"PPR failed: {e}")
            return {node: 0.0 for node in self.graph.nodes()}
    
    def get_node_data(self, node_id: str) -> Optional[Dict]:
        """
        Get data for a node
        
        Args:
            node_id: Node ID
            
        Returns:
            Node data dict or None
        """
        if self.graph.has_node(node_id):
            return dict(self.graph.nodes[node_id])
        return None
    
    def save(self, filepath: str):
        """
        Save graph to file
        
        Args:
            filepath: Path to save graph
        """
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        # Save graph
        graph_data = nx.node_link_data(self.graph)
        with open(filepath, 'w') as f:
            json.dump(graph_data, f, indent=2)
        
        # Save embeddings separately
        embedding_file = filepath.with_suffix('.embeddings.npz')
        np.savez(embedding_file, **self.node_embeddings)
    
    def load(self, filepath: str):
        """
        Load graph from file
        
        Args:
            filepath: Path to load graph from
        """
        filepath = Path(filepath)
        
        # Load graph
        with open(filepath, 'r') as f:
            graph_data = json.load(f)
        self.graph = nx.node_link_graph(graph_data)
        
        # Load embeddings
        embedding_file = filepath.with_suffix('.embeddings.npz')
        if embedding_file.exists():
            embeddings_data = np.load(embedding_file)
            self.node_embeddings = {
                key: embeddings_data[key] 
                for key in embeddings_data.files
            }
    
    def get_stats(self) -> Dict:
        """Get graph statistics"""
        return {
            "num_nodes": self.graph.number_of_nodes(),
            "num_edges": self.graph.number_of_edges(),
            "node_types": self._count_node_types(),
            "edge_types": self._count_edge_types(),
        }
    
    def _count_node_types(self) -> Dict[str, int]:
        """Count nodes by type"""
        counts = {}
        for node in self.graph.nodes():
            node_type = self.graph.nodes[node].get("type", "unknown")
            counts[node_type] = counts.get(node_type, 0) + 1
        return counts
    
    def _count_edge_types(self) -> Dict[str, int]:
        """Count edges by relation type"""
        counts = {}
        for u, v, data in self.graph.edges(data=True):
            relation = data.get("relation", "unknown")
            counts[relation] = counts.get(relation, 0) + 1
        return counts

