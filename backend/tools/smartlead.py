import httpx
import os
from typing import Any

SMARTLEAD_BASE = "https://server.smartlead.ai/api/v1"


def _api_key() -> str:
    return os.environ["SMARTLEAD_API_KEY"]


async def create_campaign(name: str, settings: dict[str, Any] | None = None) -> dict:
    """Create a new campaign in SmartLead and return the campaign object."""
    payload: dict[str, Any] = {
        "name": name,
        "client_id": None,
        **(settings or {}),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{SMARTLEAD_BASE}/campaigns/create",
            params={"api_key": _api_key()},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def add_email_sequence(campaign_id: int, sequences: list[dict]) -> dict:
    """
    Upload email sequence (touchpoints) to a campaign.
    sequences: list of {seq_number, subject, email_body, reply_to_thread}
    """
    payload = {
        "sequences": [
            {
                "seq_number": s["seq_number"],
                "seq_delay_details": {"delay_in_days": s.get("delay_days", 1)},
                "subject": s["subject"],
                "email_body": s["email_body"],
                "reply_to_thread": s.get("reply_to_thread", seq_idx > 0),
            }
            for seq_idx, s in enumerate(sequences)
        ]
    }
    print(f"[SmartLead] Uploading {len(sequences)} sequences to campaign {campaign_id}")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{SMARTLEAD_BASE}/campaigns/{campaign_id}/sequences",
            params={"api_key": _api_key()},
            json=payload,
        )
        print(f"[SmartLead] Sequence upload status={resp.status_code} body={resp.text[:500]}")
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and data.get("ok") is False:
            raise ValueError(f"SmartLead sequence upload failed: {data}")
        return data


async def add_leads_to_campaign(campaign_id: int, leads: list[dict]) -> dict:
    """
    Enroll leads into a campaign.
    leads: list of {email, first_name, last_name, company_name, ...custom fields}
    """
    lead_list = []
    for lead in leads:
        entry: dict[str, Any] = {
            "email": lead["email"],
            "first_name": lead.get("first_name", ""),
            "last_name": lead.get("last_name", ""),
            "company_name": lead.get("company", ""),
            "phone_number": lead.get("phone", ""),
            "website": lead.get("website", ""),
            "linkedin_profile": lead.get("linkedin", ""),
            "custom_fields": {
                "industry": lead.get("industry", ""),
                "title": lead.get("title", ""),
                "city": lead.get("city", ""),
            },
        }
        lead_list.append(entry)

    payload = {"lead_list": lead_list, "settings": {"ignore_global_block_list": False}}
    print(f"[SmartLead] Enrolling {len(lead_list)} leads into campaign {campaign_id}")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{SMARTLEAD_BASE}/campaigns/{campaign_id}/leads",
            params={"api_key": _api_key()},
            json=payload,
        )
        print(f"[SmartLead] Lead enroll status={resp.status_code} body={resp.text[:300]}")
        resp.raise_for_status()
        return resp.json()


async def set_campaign_schedule(campaign_id: int, schedule: dict | None = None) -> dict:
    """Set sending schedule for a campaign."""
    default_schedule = {
        "timezone": "Asia/Dubai",
        "days_of_the_week": [1, 2, 3, 4, 5],  # Mon–Fri
        "start_hour": "08:00",
        "end_hour": "18:00",
        "min_time_btw_emails": 10,
        "max_new_leads_per_day": 50,
    }
    payload = schedule or default_schedule
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{SMARTLEAD_BASE}/campaigns/{campaign_id}/schedule",
            params={"api_key": _api_key()},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def launch_campaign(campaign_id: int) -> dict:
    """Set campaign status to START (active sending)."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{SMARTLEAD_BASE}/campaigns/{campaign_id}/status",
            params={"api_key": _api_key()},
            json={"status": "START"},
        )
        resp.raise_for_status()
        return resp.json()
