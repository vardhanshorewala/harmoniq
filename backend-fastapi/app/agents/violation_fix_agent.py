"""
Agent that fixes compliance violations by rewriting protocol text
"""

import json
import re
from typing import Dict, List
from app.agents.openrouter_agent import OpenRouterAgent


class ViolationFixAgent:
    """Agent that rewrites protocol text to fix compliance violations"""
    
    def __init__(self):
        self.agent = OpenRouterAgent()
    
    async def fix_violations(
        self,
        original_text: str,
        violations: List[Dict]
    ) -> Dict:
        """
        Rewrite protocol text to fix compliance violations
        
        Args:
            original_text: Original protocol text that has violations
            violations: List of violation details with regulation requirements
            
        Returns:
            Dict with rewritten compliant text
        """
        # Format violations for the prompt
        violations_text = "\n\n".join([
            f"VIOLATION {i+1}:\n"
            f"Regulation: {v.get('regulation_id', 'N/A')}\n"
            f"Requirement: {v.get('regulation_text', 'N/A')}\n"
            f"Issue: {v.get('explanation', 'N/A')}\n"
            f"Missing Elements: {', '.join(v.get('missing_elements', []))}"
            for i, v in enumerate(violations)
        ])
        
        prompt = f"""
        You are a text editor. Fix the violations in the text. Preserve ALL line breaks and formatting EXACTLY.

        TEXT TO FIX:
        {original_text}

        VIOLATIONS:
        {violations_text}

        RULES:
        1. Return ONLY the corrected text - NO other content whatsoever
        2. Keep EVERY line break, space, and newline EXACTLY as in the original
        3. Only change the specific words/sentences that violate regulations
        4. NO brackets [], NO tags <>, NO notes, NO explanations
        5. NO [TRACKED CHANGES], NO [MODIFIED], NO metadata
        6. If original has "XYZ\n\nABC" keep it as "XYZ\n\nABC" (preserve double line breaks)
        7. If original has short lines, keep them short
        8. Match the exact formatting structure
        
        OUTPUT:
        Corrected text with exact same line breaks and formatting.
        """
        
        try:
            response = await self.agent.call(prompt, temperature=0.2)  # Very low for consistency
            rewritten_text = self.agent.get_text_response(response)
            
            # Aggressive cleanup - remove ALL metadata and annotations
            rewritten_text = rewritten_text.strip()
            
            # Remove markdown code blocks
            rewritten_text = re.sub(r'^```[a-z]*\n', '', rewritten_text, flags=re.MULTILINE)
            rewritten_text = re.sub(r'\n```$', '', rewritten_text)
            
            # Remove any bracketed annotations [TRACKED CHANGES:...], [MODIFIED:...], etc.
            rewritten_text = re.sub(r'\[TRACKED CHANGES:.*?\]', '', rewritten_text, flags=re.DOTALL | re.IGNORECASE)
            rewritten_text = re.sub(r'\[MODIFIED:.*?\]', '', rewritten_text, flags=re.DOTALL | re.IGNORECASE)
            rewritten_text = re.sub(r'\[CHANGES TRACKED:.*?\]', '', rewritten_text, flags=re.DOTALL | re.IGNORECASE)
            rewritten_text = re.sub(r'\[.*?EXPLANATION.*?\]', '', rewritten_text, flags=re.DOTALL | re.IGNORECASE)
            rewritten_text = re.sub(r'\[NOTE:.*?\]', '', rewritten_text, flags=re.DOTALL | re.IGNORECASE)
            
            # Remove strikethrough and other markdown
            rewritten_text = re.sub(r'~~(.*?)~~', r'\1', rewritten_text)
            
            # Remove "Note:" or "Tracked changes" paragraphs
            rewritten_text = re.sub(r'\n\s*Note:.*?(?=\n\n|\Z)', '', rewritten_text, flags=re.DOTALL | re.IGNORECASE)
            rewritten_text = re.sub(r'\n\s*Tracked changes.*?(?=\n\n|\Z)', '', rewritten_text, flags=re.DOTALL | re.IGNORECASE)
            
            # Clean up multiple newlines
            rewritten_text = re.sub(r'\n{3,}', '\n\n', rewritten_text)
            
            return {
                "original_text": original_text,
                "rewritten_text": rewritten_text.strip(),
                "violations_fixed": len(violations),
                "status": "SUCCESS"
            }
            
        except Exception as e:
            print(f"Error fixing violations: {e}")
            return {
                "error": str(e),
                "status": "ERROR",
                "original_text": original_text
            }

