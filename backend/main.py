"""
FlapKap GTM Agent — FastAPI Backend
"""

import json
import uuid
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

from agent import get_or_create_session, reset_session
from tools.hubspot import get_owners
from tools.millionverifier import verify_emails_batch
from tools.sheet_parser import group_by_industry, parse_sheet

app = FastAPI(title="FlapKap GTM Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict to your Vercel domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ──────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    message: str


class ResetRequest(BaseModel):
    session_id: str


class VerifyRequest(BaseModel):
    emails: list[str]


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/bdr-list")
async def bdr_list():
    """Return the list of HubSpot owners (BDRs). Returns empty list on failure."""
    try:
        bdrs = await get_owners()
        return {"bdrs": bdrs}
    except Exception:
        return {"bdrs": []}


@app.post("/verify-emails")
async def verify_emails_endpoint(request: VerifyRequest):
    """
    Verify a list of email addresses via Millionverifier.
    Returns per-email quality: valid | risky | invalid
    """
    try:
        results = await verify_emails_batch(request.emails)
        summary = {
            "valid": sum(1 for r in results if r["quality"] == "valid"),
            "risky": sum(1 for r in results if r["quality"] == "risky"),
            "invalid": sum(1 for r in results if r["quality"] == "invalid"),
        }
        return {"results": results, "summary": summary}
    except Exception as exc:
        raise HTTPException(500, f"Verification failed: {exc}")


@app.post("/upload")
async def upload_sheet(
    file: UploadFile = File(...),
    session_id: str = Form(default=None),
):
    """
    Upload a leads sheet (Excel/CSV).
    Returns:
    - session_id: use for subsequent chat calls
    - leads_summary: grouped by industry with counts
    - leads: full list of parsed leads
    - industry_groups: dict of industry → [leads]
    """
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(400, "Only Excel (.xlsx, .xls) and CSV files are accepted.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(400, "File too large. Max 10 MB.")

    try:
        leads = parse_sheet(contents, file.filename)
    except Exception as exc:
        raise HTTPException(422, f"Could not parse file: {exc}")

    if not leads:
        raise HTTPException(422, "No valid leads found. Make sure there's an 'email' column.")

    if not session_id:
        session_id = str(uuid.uuid4())

    # Reset the session for a new upload
    reset_session(session_id)

    groups = group_by_industry(leads)
    summary = [
        {"industry": k, "count": len(v)} for k, v in sorted(groups.items(), key=lambda x: -len(x[1]))
    ]

    return {
        "session_id": session_id,
        "total_leads": len(leads),
        "industry_groups": groups,
        "leads_summary": summary,
    }


@app.post("/generate-plan")
async def generate_plan(request: ChatRequest):
    """
    Ask the agent to generate the full campaign plan for the uploaded leads.
    Streams SSE events.
    """
    agent = get_or_create_session(request.session_id)

    return StreamingResponse(
        agent.run_stream(request.message, leads_context=None),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Send a follow-up message (feedback) to the agent.
    Streams SSE events.
    """
    agent = get_or_create_session(request.session_id)

    return StreamingResponse(
        agent.run_stream(request.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/launch")
async def launch_campaigns(request: ChatRequest):
    """
    Instruct the agent to create and launch campaigns in SmartLead.
    Streams SSE events.
    """
    agent = get_or_create_session(request.session_id)
    launch_prompt = (
        "The BDR has approved the campaign plan. Please proceed to:\n"
        "1. Create one SmartLead campaign per industry group\n"
        "2. Upload the email sequences for each campaign\n"
        "3. Enroll the leads into their respective campaigns\n"
        "Do NOT activate or launch the campaigns. Stop after enrolling leads and confirm the campaigns are ready in SmartLead but not yet active."
    )

    return StreamingResponse(
        agent.run_stream(launch_prompt),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/reset")
async def reset(request: ResetRequest):
    reset_session(request.session_id)
    return {"status": "reset", "session_id": request.session_id}
