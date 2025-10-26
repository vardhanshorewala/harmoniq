"""
Compliance checking agent that determines if protocol text complies with regulations
"""

import json
import re
from typing import Dict, List
from app.agents.openrouter_agent import OpenRouterAgent


class ComplianceAgent:
    """Agent that checks protocol compliance against regulations"""
    
    def __init__(self):
        self.agent = OpenRouterAgent()
    
    async def check_compliance(
        self,
        protocol_paragraph: str,
        relevant_regulations: List[Dict]
    ) -> Dict:
        """
        Check if a protocol paragraph complies with relevant regulations
        
        Args:
            protocol_paragraph: Text from protocol to check
            relevant_regulations: List of regulation clauses with metadata
            
        Returns:
            Dict with compliance analysis
        """
        # Format regulations for the prompt
        regulations_text = "\n\n".join([
            f"[{reg['clause_id']}] (Severity: {reg['severity']})\n"
            f"Topic: {reg['section']}\n"
            f"Requirement: {reg['text']}"
            for reg in relevant_regulations
        ])
        
        prompt = f"""
        You are a clinical trial compliance expert. Analyze whether a protocol paragraph complies with FDA regulations.

        PROTOCOL PARAGRAPH TO CHECK:
        {protocol_paragraph}

        RELEVANT FDA REGULATIONS (from HippoRAG retrieval):
        {regulations_text}

        For each regulation, determine:
        1. Is this regulation actually RELATED to the protocol paragraph? (not all retrieved reqs may be relevant)
        2. If related, does the protocol paragraph COMPLY with this requirement?
        3. If non-compliant, what is the probability of non-compliance (0.0 to 1.0)?
        4. Provide a brief explanation

        Return as JSON array:
        [
        {{
            "regulation_id": "FDA-CHUNK0-REQ-001",
            "is_related": true,
            "is_compliant": false,
            "non_compliance_probability": 0.85,
            "severity": "critical",
            "explanation": "Protocol mentions informed consent but does not specify that participation is voluntary, which is required by this regulation",
            "missing_elements": ["voluntary participation statement", "withdrawal rights"]
        }},
        {{
            "regulation_id": "FDA-CHUNK0-REQ-005",
            "is_related": false,
            "is_compliant": null,
            "non_compliance_probability": 0.0,
            "severity": "high",
            "explanation": "This regulation about data retention is not relevant to the protocol paragraph about consent procedures"
        }},
        ...
        ]

        IMPORTANT COMPLIANCE CRITERIA:
        - Only mark as "related" if the regulation directly applies to the protocol text
        - Mark as COMPLIANT if the protocol addresses the CORE requirement, even if not every sub-detail is listed
        - Mark as NON-COMPLIANT only if:
        a) The protocol CONTRADICTS the regulation, OR
        b) The protocol is MISSING a CRITICAL element that the regulation requires
        - If the protocol mentions the general concept (e.g., "informed consent will be obtained"), assume details will be in the full protocol/consent form
        - Don't penalize for missing procedural details if the high-level concept is addressed
        - non_compliance_probability: 0.0 = definitely compliant, 1.0 = definitely non-compliant, 0.5 = unclear
        - Provide actionable feedback in "missing_elements" only for CRITICAL omissions

        EXAMPLES:
        ✅ COMPLIANT: Protocol says "IRB will review consent form" + Regulation requires "IRB approval" → COMPLIANT
        ✅ COMPLIANT: Protocol says "risks explained to participants" + Regulation requires "informed consent includes risks" → COMPLIANT
        ❌ NON-COMPLIANT: Protocol says "no informed consent needed" + Regulation requires "informed consent" → NON-COMPLIANT
        ❌ NON-COMPLIANT: Protocol says nothing about consent + Regulation requires "informed consent" → NON-COMPLIANT
        """
        
        try:
            response = await self.agent.call(prompt, temperature=0.2)
            response_text = self.agent.get_text_response(response)
            
            # Extract JSON
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                compliance_results = json.loads(json_match.group())
            else:
                compliance_results = json.loads(response_text)
            
            # Filter to only related regulations
            related_results = [r for r in compliance_results if r.get('is_related')]
            
            # Calculate summary statistics (only for related regulations)
            related_count = len(related_results)
            compliant_count = sum(1 for r in related_results if r.get('is_compliant'))
            non_compliant = [r for r in related_results if not r.get('is_compliant')]
            
            # Overall compliance score (weighted by severity)
            severity_weights = {'critical': 1.0, 'high': 0.8, 'medium': 0.5, 'low': 0.3}
            
            total_weight = 0
            weighted_compliance = 0
            for result in related_results:
                weight = severity_weights.get(result.get('severity', 'medium'), 0.5)
                total_weight += weight
                if result.get('is_compliant'):
                    weighted_compliance += weight
            
            overall_compliance_score = weighted_compliance / total_weight if total_weight > 0 else 1.0
            
            # If no related regulations found, return COMPLIANT (nothing to violate)
            if related_count == 0:
                return {
                    "protocol_text": protocol_paragraph,
                    "total_regulations_checked": 0,
                    "related_regulations": 0,
                    "compliant_count": 0,
                    "non_compliant_count": 0,
                    "overall_compliance_score": 1.0,
                    "status": "COMPLIANT",
                    "detailed_results": [],
                    "critical_violations": [],
                    "recommendations": [],
                    "note": "No regulations were found to be related to this protocol paragraph"
                }
            
            return {
                "protocol_text": protocol_paragraph,
                "total_regulations_checked": related_count,
                "related_regulations": related_count,
                "compliant_count": compliant_count,
                "non_compliant_count": len(non_compliant),
                "overall_compliance_score": round(overall_compliance_score, 3),
                "status": "COMPLIANT" if len(non_compliant) == 0 else "NON_COMPLIANT",
                "detailed_results": related_results,  # Only related regulations
                "critical_violations": [
                    r for r in non_compliant 
                    if r.get('severity') == 'critical'
                ],
                "recommendations": [
                    r.get('missing_elements', []) 
                    for r in non_compliant
                    if r.get('missing_elements')
                ]
            }
            
        except Exception as e:
            print(f"Error in compliance check: {e}")
            return {
                "error": str(e),
                "status": "ERROR",
                "protocol_text": protocol_paragraph
            }

