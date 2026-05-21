import asyncio
import os

import httpx

MV_BASE = "https://api.millionverifier.com/api/v3"
CONCURRENCY = 10  # max simultaneous requests


def _api_key() -> str:
    return os.environ["MILLIONVERIFIER_API_KEY"]


async def _verify_one(email: str, client: httpx.AsyncClient, sem: asyncio.Semaphore) -> dict:
    async with sem:
        try:
            resp = await client.get(
                f"{MV_BASE}/",
                params={"api": _api_key(), "email": email},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            result = data.get("result", "unknown")
            quality = _quality(result)
            return {
                "email": email,
                "result": result,           # ok | catch_all | unknown | invalid | error
                "quality": quality,         # valid | risky | invalid
                "free": bool(data.get("free")),
                "role": bool(data.get("role")),
                "disposable": bool(data.get("disposable")),
            }
        except Exception as exc:
            return {
                "email": email,
                "result": "error",
                "quality": "risky",
                "error": str(exc),
                "free": False,
                "role": False,
                "disposable": False,
            }


def _quality(result: str) -> str:
    if result == "ok":
        return "valid"
    if result in ("catch_all", "unknown", "error"):
        return "risky"
    return "invalid"  # invalid, disposable, etc.


async def verify_emails_batch(emails: list[str]) -> list[dict]:
    """Verify a list of emails concurrently. Returns one result dict per email."""
    if not emails:
        return []
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(timeout=20) as client:
        tasks = [_verify_one(e, client, sem) for e in emails]
        return list(await asyncio.gather(*tasks))
