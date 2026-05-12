"""
Groq AI client using the OpenAI Python SDK.

Groq is fully compatible with the OpenAI API — we just point the base_url
at Groq's endpoint and use the GROQ_API_KEY instead of an OpenAI key.

Model configured via GROQ_MODEL env var (default: meta-llama/llama-4-scout-17b-16e-instruct
which is the ~109-120B parameter model available on Groq).
"""
from __future__ import annotations
import json
import logging
import re
from typing import Any

from openai import AsyncOpenAI, APIStatusError

from .config import settings

logger = logging.getLogger(__name__)

_client = AsyncOpenAI(
    api_key=settings.GROQ_API_KEY,
    base_url=settings.GROQ_BASE_URL,
)


async def groq_chat(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.6,
    max_tokens: int = 800,
    json_mode: bool = False,
    model: str | None = None,
) -> str:
    """
    Send a chat completion request to Groq via the OpenAI SDK.
    Includes automatic fallback on model errors and JSON-mode retry logic.
    """
    chosen_model = model or settings.GROQ_MODEL

    async def _call(msgs: list[dict[str, str]], mdl: str, jm: bool) -> str:
        kwargs: dict[str, Any] = {
            "model": mdl,
            "messages": msgs,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if jm:
            kwargs["response_format"] = {"type": "json_object"}

        response = await _client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content
        if content is None:
            raise ValueError("Groq returned no content")
        return content.strip()

    try:
        return await _call(messages, chosen_model, json_mode)

    except Exception as err:
        msg = str(err)

        # JSON mode validation failure → retry without JSON mode
        if json_mode and re.search(r"json_validate_failed|Failed to validate JSON", msg, re.I):
            logger.warning("Groq JSON mode failed; retrying without JSON mode: %s", msg)
            relaxed_messages = [
                *messages[:-1],
                {
                    "role": "user",
                    "content": (
                        messages[-1]["content"]
                        + "\n\nIMPORTANT: Reply with ONLY a single valid JSON object, "
                        "no markdown fences, no commentary."
                    ),
                },
            ]
            return await _call(relaxed_messages, chosen_model, False)

        # Model not found → try fallback
        if (
            re.search(r"model.*not.*found|decommissioned|invalid_model", msg, re.I)
            and chosen_model != settings.GROQ_FALLBACK_MODEL
        ):
            logger.warning("Primary model unavailable; using fallback: %s", msg)
            return await _call(messages, settings.GROQ_FALLBACK_MODEL, json_mode)

        raise


def extract_json(raw: str) -> Any | None:
    """
    Extract the first valid JSON object/array from a model response that may
    contain markdown fences or stray prose.
    """
    if not raw:
        return None

    cleaned = re.sub(r"^\s*```(?:json)?", "", raw, flags=re.I)
    cleaned = re.sub(r"```\s*$", "", cleaned, flags=re.I).strip()

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Find first { or [
    start_obj = cleaned.find("{")
    start_arr = cleaned.find("[")

    if start_obj == -1 and start_arr == -1:
        return None

    if start_obj == -1 or (start_arr != -1 and start_arr < start_obj):
        start = start_arr
        end_char = "]"
    else:
        start = start_obj
        end_char = "}"

    depth = 0
    in_str = False
    esc = False

    for i in range(start, len(cleaned)):
        ch = cleaned[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            continue
        if ch in ("{", "["):
            depth += 1
        elif ch in ("}", "]"):
            depth -= 1
            if depth == 0 and ch == end_char:
                candidate = cleaned[start : i + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    return None

    return None
