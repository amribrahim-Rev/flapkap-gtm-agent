import httpx
import os
from typing import Optional

HUBSPOT_BASE = "https://api.hubapi.com"


def _headers() -> dict:
    token = os.environ["HUBSPOT_TOKEN"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def check_ownership_batch(emails: list[str]) -> dict[str, Optional[str]]:
    """
    Given a list of email addresses, return a dict mapping each email
    to the owner's name (str) if owned, or None if not in HubSpot.
    """
    results: dict[str, Optional[str]] = {e: None for e in emails}
    if not emails:
        return results

    # HubSpot batch read contacts by email
    payload = {
        "filterGroups": [
            {
                "filters": [
                    {"propertyName": "email", "operator": "IN", "values": emails[:100]}
                ]
            }
        ],
        "properties": ["email", "hubspot_owner_id", "hs_object_id"],
        "limit": 100,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{HUBSPOT_BASE}/crm/v3/objects/contacts/search",
            json=payload,
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()

    # Collect owner IDs to resolve names
    owner_ids: set[str] = set()
    contact_owner_map: dict[str, str] = {}  # email -> owner_id

    for result in data.get("results", []):
        props = result.get("properties", {})
        email = props.get("email", "").lower().strip()
        owner_id = props.get("hubspot_owner_id")
        if email and owner_id:
            contact_owner_map[email] = owner_id
            owner_ids.add(owner_id)

    if not owner_ids:
        return results

    # Resolve owner names
    owner_names: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{HUBSPOT_BASE}/crm/v3/owners",
            headers=_headers(),
        )
        resp.raise_for_status()
        owners_data = resp.json()

    for owner in owners_data.get("results", []):
        oid = str(owner.get("id", ""))
        first = owner.get("firstName", "")
        last = owner.get("lastName", "")
        owner_names[oid] = f"{first} {last}".strip() or owner.get("email", oid)

    for email in emails:
        key = email.lower().strip()
        if key in contact_owner_map:
            oid = contact_owner_map[key]
            results[email] = owner_names.get(oid, f"Owner #{oid}")

    return results
