"""OpenRouter AI Agent for making LLM API calls"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings


class OpenRouterAgent:
    """Agent for interacting with OpenRouter API"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        """
        Initialize OpenRouter agent

        Args:
            api_key: OpenRouter API key (defaults to settings)
            model: Model to use (defaults to settings)
            base_url: Base URL for OpenRouter API (defaults to settings)
        """
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.model = model or settings.OPENROUTER_MODEL
        self.base_url = base_url or settings.OPENROUTER_BASE_URL

        if not self.api_key:
            raise ValueError("OpenRouter API key is required")

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for OpenRouter API requests"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.OPENROUTER_SITE_URL,
            "X-Title": settings.OPENROUTER_SITE_NAME,
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
        Make a call to OpenRouter API

        Args:
            prompt: User prompt/message
            system_prompt: Optional system prompt
            temperature: Temperature for generation (0.0 to 2.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters for the API

        Returns:
            Dict containing the response from OpenRouter

        Raises:
            httpx.HTTPError: If the API request fails
        """
        messages: List[Dict[str, str]] = []

        # Add system prompt if provided
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Add user prompt
        messages.append({"role": "user", "content": prompt})

        # Prepare request payload
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            **kwargs,
        }

        if max_tokens:
            payload["max_tokens"] = max_tokens

        # Make API request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._get_headers(),
                json=payload,
                timeout=60.0,
            )
            response.raise_for_status()
            return response.json()

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
            Dict containing the response from OpenRouter
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
        Extract text response from OpenRouter API response

        Args:
            response: Response dict from OpenRouter API

        Returns:
            The text content of the response
        """
        return response["choices"][0]["message"]["content"]

    async def stream_call(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ):
        """
        Make a streaming call to OpenRouter API

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

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
            **kwargs,
        }

        if max_tokens:
            payload["max_tokens"] = max_tokens

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
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

