"""ChromaDB client for persistent vector storage"""

from pathlib import Path
from typing import Optional

import chromadb
from chromadb.config import Settings


class ChromaClient:
    """Client for interacting with ChromaDB with persistent storage"""

    def __init__(self, persist_directory: str = "./data/chroma"):
        """
        Initialize ChromaDB client with persistent storage

        Args:
            persist_directory: Directory path for persistent storage (default: ./data/chroma)
        """
        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(parents=True, exist_ok=True)

        # Initialize ChromaDB client with persistent storage
        self.client = chromadb.PersistentClient(
            path=str(self.persist_directory),
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True,
            ),
        )

    def get_or_create_collection(self, name: str, metadata: Optional[dict] = None):
        """
        Get or create a collection

        Args:
            name: Collection name
            metadata: Optional metadata for the collection

        Returns:
            ChromaDB collection
        """
        return self.client.get_or_create_collection(
            name=name,
            metadata=metadata or {},
        )

    def get_collection(self, name: str):
        """
        Get an existing collection

        Args:
            name: Collection name

        Returns:
            ChromaDB collection
        """
        return self.client.get_collection(name=name)

    def list_collections(self):
        """
        List all collections

        Returns:
            List of collection objects
        """
        return self.client.list_collections()

    def delete_collection(self, name: str):
        """
        Delete a collection

        Args:
            name: Collection name
        """
        self.client.delete_collection(name=name)

    def reset(self):
        """Reset the database (delete all collections)"""
        self.client.reset()


# Singleton instance
_chroma_client: Optional[ChromaClient] = None


def get_chroma_client(persist_directory: str = "./data/chroma") -> ChromaClient:
    """
    Get singleton ChromaDB client instance

    Args:
        persist_directory: Directory path for persistent storage

    Returns:
        ChromaClient instance
    """
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = ChromaClient(persist_directory=persist_directory)
    return _chroma_client

