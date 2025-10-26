"""Data models for regulations"""

from typing import List, Optional
from pydantic import BaseModel


class RegulationClause(BaseModel):
    """A single regulation clause/requirement"""
    
    id: str  # e.g., "FDA-CFR21-11.10.a"
    text: str
    section: str  # e.g., "11.10"
    clause_number: str  # e.g., "11.10.a"
    requirement_type: Optional[str] = None  # "mandatory", "recommended"
    severity: Optional[str] = None  # "critical", "high", "medium", "low"
    embedding: Optional[List[float]] = None


class RegulationDocument(BaseModel):
    """A complete regulation document"""
    
    id: str  # e.g., "FDA-CFR21-Part11-v2024"
    title: str
    country: str  # "USA", "EU", "Japan"
    authority: str  # "FDA", "EMA", "PMDA"
    version: str
    effective_date: Optional[str] = None
    clauses: List[RegulationClause] = []


class RegulationTriplet(BaseModel):
    """A knowledge graph triplet extracted from regulations"""
    
    subject: str  # Node ID
    predicate: str  # Relationship type
    object: str  # Node ID
    confidence: float = 1.0
    source: Optional[str] = None  # Which regulation this came from

