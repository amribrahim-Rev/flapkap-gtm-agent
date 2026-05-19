import io
import pandas as pd
from typing import Any

COLUMN_ALIASES = {
    "first_name": ["first name", "firstname", "first", "fname", "given name"],
    "last_name": ["last name", "lastname", "last", "lname", "surname", "family name"],
    "full_name": ["name", "full name", "fullname", "contact name", "contact"],
    "email": ["email", "email address", "e-mail", "mail"],
    "company": ["company", "company name", "organization", "organisation", "account", "business"],
    "title": ["title", "job title", "position", "role", "designation"],
    "industry": ["industry", "sector", "vertical", "category", "business type"],
    "phone": ["phone", "phone number", "mobile", "tel", "telephone", "contact number"],
    "website": ["website", "url", "domain", "web"],
    "linkedin": ["linkedin", "linkedin url", "linkedin profile"],
    "city": ["city", "location", "emirate", "region"],
    "country": ["country"],
    "revenue": ["revenue", "annual revenue", "turnover", "annual turnover"],
    "employees": ["employees", "headcount", "team size", "staff"],
}


def _normalize_col(col: str) -> str:
    return col.strip().lower().replace("_", " ").replace("-", " ")


def _map_columns(df: pd.DataFrame) -> dict[str, str]:
    """Map DataFrame columns to canonical field names."""
    mapping: dict[str, str] = {}
    normalized_cols = {_normalize_col(c): c for c in df.columns}
    for field, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in normalized_cols:
                mapping[field] = normalized_cols[alias]
                break
    return mapping


def parse_sheet(file_bytes: bytes, filename: str) -> list[dict[str, Any]]:
    """Parse an Excel or CSV file and return a list of lead dicts."""
    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes))
    else:
        df = pd.read_excel(io.BytesIO(file_bytes))

    df.dropna(how="all", inplace=True)
    df.columns = [str(c).strip() for c in df.columns]

    col_map = _map_columns(df)

    leads = []
    for _, row in df.iterrows():
        lead: dict[str, Any] = {}

        for field, original_col in col_map.items():
            val = row.get(original_col)
            if pd.notna(val) and str(val).strip():
                lead[field] = str(val).strip()

        # Derive full_name from first + last if not present
        if "full_name" not in lead:
            parts = [lead.get("first_name", ""), lead.get("last_name", "")]
            combined = " ".join(p for p in parts if p)
            if combined:
                lead["full_name"] = combined

        # Derive first_name from full_name if not present
        if "first_name" not in lead and "full_name" in lead:
            lead["first_name"] = lead["full_name"].split()[0]

        if lead.get("email"):
            leads.append(lead)

    return leads


def group_by_industry(leads: list[dict]) -> dict[str, list[dict]]:
    """Group leads by their industry field."""
    groups: dict[str, list[dict]] = {}
    for lead in leads:
        industry = lead.get("industry", "Unknown").strip()
        if not industry:
            industry = "Unknown"
        groups.setdefault(industry, []).append(lead)
    return groups
