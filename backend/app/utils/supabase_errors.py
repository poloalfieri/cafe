from typing import Iterable, List, Tuple

from postgrest.exceptions import APIError


def _extract_messages_and_code(exc: Exception) -> Tuple[List[str], str]:
    messages = [str(exc).lower()]
    code = ""

    if isinstance(exc, APIError):
        payload = getattr(exc, "json", {}) or {}
        code = str(payload.get("code") or "").upper()
        messages.extend([
            str(payload.get("message") or "").lower(),
            str(payload.get("details") or "").lower(),
            str(payload.get("hint") or "").lower(),
        ])

    return messages, code


def _contains_any(messages: Iterable[str], needles: Iterable[str]) -> bool:
    for message in messages:
        for needle in needles:
            if needle and needle in message:
                return True
    return False


def is_missing_relation_error(exc: Exception, *relation_names: str) -> bool:
    messages, code = _extract_messages_and_code(exc)
    relation_tokens = tuple(
        (name or "").lower() for name in relation_names if name
    )
    relation_match = not relation_tokens or _contains_any(messages, relation_tokens)

    if code in {"42P01", "PGRST204", "404"} and relation_match:
        return True

    text_markers = (
        "does not exist",
        "could not find the table",
        "schema cache",
        "json could not be generated",
    )
    return relation_match and _contains_any(messages, text_markers)


def is_undefined_column_error(exc: Exception, column_name: str = "") -> bool:
    messages, code = _extract_messages_and_code(exc)
    column_token = (column_name or "").lower()

    if code == "42703":
        return not column_token or _contains_any(messages, (column_token,))

    if column_token and not _contains_any(messages, (column_token,)):
        return False

    return any("column" in message and "does not exist" in message for message in messages)
