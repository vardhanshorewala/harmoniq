"""Health check endpoints"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "API is running",
    }


@router.get("/ping")
async def ping():
    """Ping endpoint"""
    return {"message": "pong"}

