from typing import Optional

# Canonical units used by backend and database writes.
ALLOWED_UNITS = ("kg", "g", "l", "ml", "unit")

_UNIT_ALIASES = {
    "unidad": "unit",
    "unidades": "unit",
}


def normalize_unit(value: Optional[str]) -> str:
    """Normalize a unit value to canonical backend format."""
    normalized = (value or "").strip().lower()
    if not normalized:
        return ""
    return _UNIT_ALIASES.get(normalized, normalized)


def to_display_unit(value: Optional[str]) -> str:
    """Map stored units to UI-friendly labels expected by frontend."""
    normalized = normalize_unit(value)
    if normalized == "unit":
        return "unidad"
    return normalized
