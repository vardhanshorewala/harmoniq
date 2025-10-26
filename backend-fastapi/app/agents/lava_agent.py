"""LavaLabs AI Agent for making LLM API calls (forwards to Anthropic)"""

import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings


class LavaAgent:
    """Agent for interacting with Anthropic API via LavaLabs"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        """
        Initialize LavaLabs agent

        Args:
            api_key: LavaLabs API key (defaults to settings)
            model: Anthropic model to use (defaults to settings)
            base_url: Base URL for LavaLabs API (defaults to settings)
        """
        self.api_key = api_key or settings.LAVA_API_KEY
        self.model = model or settings.ANTHROPIC_MODEL
        self.base_url = base_url or settings.LAVA_BASE_URL

        if not self.api_key:
            raise ValueError("LavaLabs API key is required")

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for LavaLabs/Anthropic API requests"""
        return {
            "x-api-key": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "anthropic-version": settings.ANTHROPIC_VERSION,
        }

    async def call(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Make a call to Anthropic API via LavaLabs

        Args:
            prompt: User prompt/message
            system_prompt: Optional system prompt
            temperature: Temperature for generation (0.0 to 2.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters for the API

        Returns:
            Dict containing the response from Anthropic

        Raises:
            httpx.HTTPError: If the API request fails
        """
        messages: List[Dict[str, str]] = []

        # Add user prompt (system is separate in Anthropic API)
        messages.append({"role": "user", "content": prompt})

        # Prepare request payload (Anthropic format)
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens or 4096,  # Anthropic requires max_tokens
            "temperature": temperature,
            **kwargs,
        }

        # Add system prompt if provided (separate field in Anthropic)
        if system_prompt:
            payload["system"] = system_prompt

        # Make API request with retry logic for rate limiting
        max_retries = 5
        base_delay = 2.0  # Start with 2 second delay
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        self.base_url,
                        headers=self._get_headers(),
                        json=payload,
                        timeout=60.0,
                    )
                    response.raise_for_status()
                    return response.json()
                    
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:  # Rate limit
                    if attempt < max_retries - 1:
                        # Exponential backoff: 2s, 4s, 8s, 16s, 32s
                        delay = base_delay * (2 ** attempt)
                        print(f"    Rate limited, waiting {delay}s before retry {attempt + 1}/{max_retries}...")
                        await asyncio.sleep(delay)
                        continue
                raise  # Re-raise if not rate limit or final attempt

    async def call_with_prompt_file(
        self,
        prompt_name: str,
        variables: Optional[Dict[str, str]] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Make a call using a prompt file from the prompts directory

        Args:
            prompt_name: Name of the prompt file (without .txt extension)
            variables: Variables to substitute in the prompt template
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters for the API

        Returns:
            Dict containing the response from Anthropic
        """
        # Load prompt from file
        prompt_path = Path(__file__).parent / "prompts" / f"{prompt_name}.txt"
        
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

        with open(prompt_path, "r", encoding="utf-8") as f:
            prompt_template = f.read()

        # Substitute variables if provided
        if variables:
            prompt = prompt_template.format(**variables)
        else:
            prompt = prompt_template

        return await self.call(
            prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )

    def get_text_response(self, response: Dict[str, Any]) -> str:
        """
        Extract text response from Anthropic API response

        Args:
            response: Response dict from Anthropic API

        Returns:
            The text content of the response
        """
        # Anthropic format: {"content": [{"type": "text", "text": "..."}]}
        return response["content"][0]["text"]

    async def stream_call(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ):
        """
        Make a streaming call to Anthropic API via LavaLabs

        Args:
            prompt: User prompt/message
            system_prompt: Optional system prompt
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters for the API

        Yields:
            Chunks of the streaming response
        """
        messages: List[Dict[str, str]] = []

        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens or 4096,
            "temperature": temperature,
            "stream": True,
            **kwargs,
        }

        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                self.base_url,
                headers=self._get_headers(),
                json=payload,
                timeout=60.0,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            yield json.loads(data)
                        except json.JSONDecodeError:
                            continue


