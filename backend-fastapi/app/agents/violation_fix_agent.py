"""
Agent that generates specific diffs to fix compliance violations
"""

import json
import re
from typing import Dict, List
from app.agents.lava_agent import LavaAgent


class ViolationFixAgent:
    """Agent that generates targeted diffs to fix compliance violations"""
    
    def __init__(self):
        self.agent = LavaAgent()
    
    async def fix_violations(
        self,
        original_text: str,
        violations: List[Dict]
    ) -> Dict:
        """
        Generate specific diffs to fix compliance violations
        
        Args:
            original_text: Original protocol text that has violations
            violations: List of violation details with regulation requirements
            
        Returns:
            Dict with list of specific changes (diffs)
        """
        # Format violations for the prompt
        violations_text = "\n\n".join([
            f"VIOLATION {i+1}:\n"
            f"Requirement: {v.get('regulation_text', 'N/A')}\n"
            f"Issue: {v.get('explanation', 'N/A')}"
            for i, v in enumerate(violations)
        ])
        
        prompt = f"""
        You are a compliance fixer. Generate MINIMAL, TARGETED changes to fix violations.

        ⚠️ IMPORTANT: THIS TEXT CHUNK HAS {len(violations)} VIOLATIONS TO FIX ⚠️
        - Address ALL {len(violations)} violations in your response
        - Each violation may require separate changes
        - Generate multiple changes if needed to fix all violations
        - Prioritize critical violations first
        - Make sure ALL violations are addressed

        ORIGINAL TEXT:
        {original_text}

        VIOLATIONS TO FIX ({len(violations)} total):
        {violations_text}

        Generate ONLY the specific changes needed to fix ALL {len(violations)} violations above.
        Return as JSON array with changes for EACH violation:
        [
          {{
            "type": "replace",
            "original": "exact text to find and replace",
            "replacement": "new compliant text",
            "reason": "brief explanation"
          }},
          {{
            "type": "add",
            "after": "text snippet to add after",
            "content": "new text to insert",
            "reason": "brief explanation"
          }},
          {{
            "type": "delete",
            "text": "exact text to remove",
            "reason": "brief explanation"
          }}
        ]

        RULES:
        1. Be MINIMAL - change only what's needed to fix violations
        2. Use exact text snippets (not line numbers)
        3. Keep changes small and targeted
        4. "original" must be exact match from the text (10-50 words)
        5. Include enough context so text is unique
        6. Generate 1-2 changes per violation (if there are 3 violations, expect ~3-6 changes)
        7. Prefer "replace" over "add"+"delete"
        8. **MUST address ALL {len(violations)} violations** - do not skip any
        9. Label each change with which violation it addresses
        
        Example (for 2 violations):
        [
          {{
            "type": "replace",
            "original": "Protocol changes do not require FDA notification",
            "replacement": "Protocol changes require FDA notification within 30 days",
            "reason": "VIOLATION 1: FDA requires notification of protocol changes per 21 CFR 312.30",
            "addresses_violation": 1
          }},
          {{
            "type": "add",
            "after": "Adverse events will be monitored",
            "content": " and reported to the IRB within 24 hours of becoming aware",
            "reason": "VIOLATION 2: Missing required AE reporting timeline per 21 CFR 56.108",
            "addresses_violation": 2
          }}
        ]
        
        ⚠️ CRITICAL: If there are {len(violations)} violations, generate changes to address ALL {len(violations)} violations! ⚠️
        """
        
        try:
            response = await self.agent.call(prompt, temperature=0.3)
            response_text = self.agent.get_text_response(response)
            
            # Extract JSON from response
            changes = self._extract_and_clean_json(response_text)
            
            if not changes:
                return {
                    "error": "Failed to generate changes",
                    "status": "ERROR",
                    "changes": []
                }
            
            return {
                "changes": changes,
                "violations_addressed": len(violations),
                "status": "SUCCESS"
            }
            
        except Exception as e:
            print(f"Error generating fixes: {e}")
            return {
                "error": str(e),
                "status": "ERROR",
                "changes": []
            }
    
    def _extract_and_clean_json(self, response_text: str) -> List[Dict]:
        """Extract and parse JSON from LLM response"""
        # Remove markdown code blocks
        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*', '', response_text)
        
        # Try to extract JSON array
        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group()
        else:
            json_str = response_text.strip()
        
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            return []

