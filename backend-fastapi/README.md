# Harmoniq Backend API

FastAPI backend for the Harmoniq application.

## Setup

1. **Install dependencies:**

```bash
pip install -e .
```

Or if using Poetry:
```bash
poetry install
```

2. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Run the development server:**

```bash
# Direct method
python -m app.main

# Or using uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Project Structure

```
backend-fastapi/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py        # Configuration settings
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes/          # API route modules
│   │       ├── __init__.py
│   │       └── health.py
│   ├── models/              # Database models (SQLAlchemy, etc.)
│   │   └── __init__.py
│   ├── schemas/             # Pydantic models for request/response
│   │   └── __init__.py
│   └── services/            # Business logic
│       └── __init__.py
├── pyproject.toml
├── .env.example
├── .gitignore
└── README.md
```

## API Documentation

Once the server is running, access:
- **Swagger UI:** http://localhost:8000/api/docs
- **ReDoc:** http://localhost:8000/api/redoc
- **OpenAPI JSON:** http://localhost:8000/api/openapi.json

## Available Endpoints

- `GET /` - Root endpoint with API information
- `GET /api/health` - Health check endpoint
- `GET /api/ping` - Ping endpoint

## Development

### Adding New Routes

1. Create a new route module in `app/api/routes/`
2. Define your router and endpoints
3. Include the router in `app/main.py`

Example:
```python
# app/api/routes/users.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
async def get_users():
    return {"users": []}
```

Then in `app/main.py`:
```python
from app.api.routes import users
app.include_router(users.router, prefix="/api", tags=["users"])
```

### Configuration

All configuration is managed through `app/core/config.py` using Pydantic Settings.
Environment variables can be set in `.env` file.

## License

MIT

