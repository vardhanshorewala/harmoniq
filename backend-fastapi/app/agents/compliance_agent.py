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
        You are a LENIENT clinical trial compliance expert. Your job is to identify SERIOUS, CLEAR violations - not minor omissions or technicalities.

        PROTOCOL PARAGRAPH TO CHECK:
        {protocol_paragraph}

        RELEVANT FDA REGULATIONS (from HippoRAG retrieval):
        {regulations_text}

        For each regulation, determine:
        1. Is this regulation actually RELATED to the protocol paragraph? (Be VERY strict - many retrieved reqs won't be relevant)
        2. If related, does the protocol paragraph COMPLY with this requirement?
        3. If non-compliant, what is the probability of non-compliance (0.0 to 1.0)?
        4. Provide a brief explanation

        Return as JSON array:
        [
        {{
            "regulation_id": "FDA-CHUNK0-REQ-001",
            "is_related": true,
            "is_compliant": false,
            "non_compliance_probability": 0.9,
            "severity": "critical",
            "explanation": "Protocol explicitly states no informed consent will be obtained, which directly contradicts this regulation",
            "missing_elements": ["informed consent process"]
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

        ⚠️ CRITICAL: BE EXTREMELY LENIENT - ASSUME COMPLIANCE UNLESS OBVIOUSLY WRONG ⚠️
        
        COMPLIANCE CRITERIA (strongly favor COMPLIANT):
        
        ✅ Mark as COMPLIANT if:
        - Protocol mentions the topic AT ALL (even vaguely or indirectly)
        - Protocol implies the requirement MIGHT be met
        - Protocol addresses ANY RELATED CONCEPT
        - Protocol is silent on the topic (assume it's in another section)
        - Protocol has vague language but doesn't directly contradict
        - Only PARTIAL or INDIRECT match exists (that's OK!)
        - Missing procedural details (assume they're in SOPs)
        - Missing timelines or specifics (assume operational details)
        - "Should" vs "must" differences (both acceptable)
        - General statement without full details (high-level coverage counts)
        
        ❌ Mark as NON-COMPLIANT **ONLY** if:
        - Protocol EXPLICITLY STATES the opposite (e.g., "no IRB approval" when regulation requires it)
        - Protocol COMPLETELY OMITS a CRITICAL, LIFE-THREATENING safety requirement
        - There is CLEAR, UNAMBIGUOUS language that violates the regulation
        - Non-compliance probability must be > 0.85 (very high threshold)
        
        📋 Key Rules:
        - If unclear or ambiguous → COMPLIANT (benefit of the doubt)
        - Missing minor details → COMPLIANT (assume they're elsewhere)
        - Procedural specifics not mentioned → COMPLIANT (operational detail)
        - General statement without full details → COMPLIANT (high-level coverage is enough)
        - Only flag TOP 10% most serious violations
        - When in doubt, mark COMPLIANT
        
        EXAMPLES OF COMPLIANT (default to these):
        ✅ Protocol: "consent will be obtained" + Regulation: "informed consent with risks" → **COMPLIANT** (details assumed)
        ✅ Protocol: "IRB review" + Regulation: "IRB approval required" → **COMPLIANT** (review implies approval)  
        ✅ Protocol: "safety monitoring" + Regulation: "AE reporting within 24h" → **COMPLIANT** (timeframe in SOP)
        ✅ Protocol: [silent] + Regulation: [any requirement] → **COMPLIANT** (covered elsewhere)
        ✅ Protocol: "data will be retained" + Regulation: "retain for 2 years" → **COMPLIANT** (duration not critical)
        ✅ Protocol: "participants may withdraw" + Regulation: "informed of withdrawal rights" → **COMPLIANT** (implies informed)
        ✅ Protocol: "study drug administered subcutaneously" + Regulation: "proper administration documented" → **COMPLIANT** (implies documentation)
        
        EXAMPLES OF NON-COMPLIANT (very rare, must be obvious):
        ❌ Protocol: "NO IRB approval required" + Regulation: "IRB approval mandatory" → **NON-COMPLIANT** (explicit contradiction)
        ❌ Protocol: "participants will NOT be informed" + Regulation: "informed consent required" → **NON-COMPLIANT** (explicit violation)
        """
        
        try:
            response = await self.agent.call(prompt, temperature=0.3)  # Slightly higher for nuanced reasoning
            response_text = self.agent.get_text_response(response)
            
            # Extract JSON
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                compliance_results = json.loads(json_match.group())
            else:
                compliance_results = json.loads(response_text)
            
            # Filter to only related regulations
            related_results = [r for r in compliance_results if r.get('is_related')]
            
            # Filter out weak non-compliance (probability < 0.85) - be VERY lenient
            for result in related_results:
                if not result.get('is_compliant'):
                    prob = result.get('non_compliance_probability', 0.0)
                    if prob < 0.85:
                        # Low confidence violation -> mark as compliant
                        result['is_compliant'] = True
                        result['explanation'] = f"Low confidence violation (prob={prob:.2f} < 0.85) - marked as compliant. " + result.get('explanation', '')
            
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

