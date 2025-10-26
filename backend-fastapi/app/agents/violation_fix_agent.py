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

        ORIGINAL TEXT:
        {original_text}

        VIOLATIONS TO FIX:
        {violations_text}

        Generate ONLY the specific changes needed. Return as JSON array:
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
        6. Maximum 1-2 changes per violation
        7. Prefer "replace" over "add"+"delete"
        
        Example:
        [
          {{
            "type": "replace",
            "original": "Protocol changes do not require FDA notification",
            "replacement": "Protocol changes require FDA notification within 30 days",
            "reason": "FDA requires notification of protocol changes per 21 CFR 312.30"
          }}
        ]
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

