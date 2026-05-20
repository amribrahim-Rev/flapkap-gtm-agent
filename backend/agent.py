"""
Claude GTM agent for FlapKap cold email campaigns.
Manages conversation history per session and handles tool calls.
"""

import json
import os
from typing import Any, AsyncGenerator

import anthropic

from prompts import FLAPKAP_SYSTEM_PROMPT
from tools.hubspot import check_ownership_batch
from tools.smartlead import (
    add_email_sequence,
    add_leads_to_campaign,
    create_campaign,
    set_campaign_schedule,
)

MODEL = "claude-opus-4-7"

TOOLS: list[dict] = [
    {
        "name": "check_hubspot_ownership",
        "description": (
            "Check if a list of email addresses are already owned by a FlapKap BDR "
            "in HubSpot CRM. Returns a dict mapping email → owner name (or null if not owned). "
            "Always call this before generating the campaign plan."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "emails": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of email addresses to check in HubSpot.",
                }
            },
            "required": ["emails"],
        },
    },
    {
        "name": "create_smartlead_campaign",
        "description": "Create a new campaign in SmartLead for a specific industry group.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Campaign name, e.g. 'FlapKap - F&B UAE - May 2025'"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "upload_email_sequence",
        "description": "Upload the email touchpoint sequence to a SmartLead campaign.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "integer", "description": "SmartLead campaign ID."},
                "sequences": {
                    "type": "array",
                    "description": "List of email touchpoints.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "seq_number": {"type": "integer"},
                            "delay_days": {"type": "integer", "description": "Days after previous email."},
                            "subject": {"type": "string"},
                            "email_body": {"type": "string", "description": "HTML or plain text email body."},
                            "reply_to_thread": {"type": "boolean"},
                        },
                        "required": ["seq_number", "subject", "email_body"],
                    },
                },
            },
            "required": ["campaign_id", "sequences"],
        },
    },
    {
        "name": "enroll_leads",
        "description": "Enroll a list of leads into a SmartLead campaign.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "integer"},
                "leads": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "email": {"type": "string"},
                            "first_name": {"type": "string"},
                            "last_name": {"type": "string"},
                            "company": {"type": "string"},
                            "title": {"type": "string"},
                            "industry": {"type": "string"},
                            "phone": {"type": "string"},
                            "linkedin": {"type": "string"},
                        },
                        "required": ["email"],
                    },
                },
            },
            "required": ["campaign_id", "leads"],
        },
    },
]


async def _execute_tool(name: str, inputs: dict) -> Any:
    if name == "check_hubspot_ownership":
        return await check_ownership_batch(inputs["emails"])

    if name == "create_smartlead_campaign":
        result = await create_campaign(inputs["name"])
        # Also set a default schedule
        cid = result.get("id")
        if cid:
            await set_campaign_schedule(cid)
        return result

    if name == "upload_email_sequence":
        return await add_email_sequence(inputs["campaign_id"], inputs["sequences"])

    if name == "enroll_leads":
        return await add_leads_to_campaign(inputs["campaign_id"], inputs["leads"])

    raise ValueError(f"Unknown tool: {name}")


class GTMAgent:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.history: list[dict] = []

    def reset(self):
        self.history = []

    async def run_stream(
        self, user_message: str, leads_context: str | None = None
    ) -> AsyncGenerator[str, None]:
        """
        Send a message to the agent and stream the response as Server-Sent Events.
        Yields strings in SSE format: "data: <json>\n\n"
        """
        # Build the user content
        content = user_message
        if leads_context:
            content = f"{user_message}\n\n<leads_data>\n{leads_context}\n</leads_data>"

        self.history.append({"role": "user", "content": content})

        while True:
            # Stream from Claude
            full_text = ""
            tool_calls: list[dict] = []
            current_tool: dict | None = None
            input_json_acc = ""

            async with self.client.messages.stream(
                model=MODEL,
                max_tokens=16000,
                system=FLAPKAP_SYSTEM_PROMPT,
                messages=self.history,
                tools=TOOLS,
                thinking={"type": "adaptive"},
            ) as stream:
                async for event in stream:
                    etype = event.type

                    if etype == "content_block_start":
                        block = event.content_block
                        if block.type == "text":
                            pass
                        elif block.type == "tool_use":
                            current_tool = {"id": block.id, "name": block.name, "input": ""}
                            input_json_acc = ""

                    elif etype == "content_block_delta":
                        delta = event.delta
                        if delta.type == "text_delta":
                            full_text += delta.text
                            yield f"data: {json.dumps({'type': 'text', 'content': delta.text})}\n\n"
                        elif delta.type == "input_json_delta":
                            input_json_acc += delta.partial_json

                    elif etype == "content_block_stop":
                        if current_tool is not None:
                            try:
                                current_tool["input"] = json.loads(input_json_acc) if input_json_acc else {}
                            except json.JSONDecodeError:
                                current_tool["input"] = {}
                            tool_calls.append(current_tool)
                            current_tool = None
                            input_json_acc = ""

                    elif etype == "message_delta":
                        stop_reason = getattr(event.delta, "stop_reason", None)

            # Get the final message to capture all content blocks
            final_msg = await stream.get_final_message()

            # Add assistant turn to history
            self.history.append({"role": "assistant", "content": final_msg.content})

            if not tool_calls:
                # No tool calls — conversation turn is done
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                break

            # Execute tools
            tool_results = []
            for tc in tool_calls:
                yield f"data: {json.dumps({'type': 'tool_call', 'tool': tc['name'], 'inputs': tc['input']})}\n\n"
                try:
                    result = await _execute_tool(tc["name"], tc["input"])
                    result_str = json.dumps(result)
                    yield f"data: {json.dumps({'type': 'tool_result', 'tool': tc['name'], 'result': result})}\n\n"
                except Exception as exc:
                    result_str = json.dumps({"error": str(exc)})
                    yield f"data: {json.dumps({'type': 'tool_error', 'tool': tc['name'], 'error': str(exc)})}\n\n"

                tool_results.append(
                    {"type": "tool_result", "tool_use_id": tc["id"], "content": result_str}
                )

            # Add tool results to history and loop for next Claude response
            self.history.append({"role": "user", "content": tool_results})


# Session store — in production replace with Redis or DB-backed sessions
_sessions: dict[str, GTMAgent] = {}


def get_or_create_session(session_id: str) -> GTMAgent:
    if session_id not in _sessions:
        _sessions[session_id] = GTMAgent()
    return _sessions[session_id]


def reset_session(session_id: str):
    if session_id in _sessions:
        _sessions[session_id].reset()
