"""HTTP request execution API routes."""

from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/http", tags=["http"])


class HttpRequestPayload(BaseModel):
    """HTTP request configuration."""
    method: str  # GET, POST, PUT, PATCH, DELETE
    url: str
    headers: dict[str, str] | None = None
    body: Any | None = None
    timeout: int = 30


class HttpResponse(BaseModel):
    """HTTP response data."""
    status: int
    statusText: str
    headers: dict[str, str]
    data: Any


@router.post("/execute")
async def execute_http_request(payload: HttpRequestPayload) -> dict:
    """
    Execute an HTTP request and return the response.

    This endpoint is used by workflow HTTP Request nodes to make
    external API calls.
    """
    method = payload.method.upper()

    if method not in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        return {
            "error": f"Invalid HTTP method: {method}",
            "status": 400,
            "statusText": "Bad Request",
        }

    try:
        async with httpx.AsyncClient(timeout=payload.timeout) as client:
            # Build request kwargs
            kwargs: dict[str, Any] = {
                "method": method,
                "url": payload.url,
            }

            if payload.headers:
                kwargs["headers"] = payload.headers

            if payload.body is not None and method in ("POST", "PUT", "PATCH"):
                # If body is dict/list, send as JSON
                if isinstance(payload.body, (dict, list)):
                    kwargs["json"] = payload.body
                else:
                    kwargs["content"] = str(payload.body)

            response = await client.request(**kwargs)

            # Try to parse response as JSON, fall back to text
            try:
                data = response.json()
            except Exception:
                data = response.text

            return {
                "status": response.status_code,
                "statusText": response.reason_phrase or "",
                "headers": dict(response.headers),
                "data": data,
            }

    except httpx.TimeoutException:
        return {
            "error": f"Request timed out after {payload.timeout}s",
            "status": 408,
            "statusText": "Request Timeout",
        }
    except httpx.ConnectError as e:
        return {
            "error": f"Connection failed: {str(e)}",
            "status": 503,
            "statusText": "Service Unavailable",
        }
    except Exception as e:
        return {
            "error": str(e),
            "status": 500,
            "statusText": "Internal Server Error",
        }
