# -*- coding: utf-8 -*-
"""Stock-scope helpers for ask-stock follow-up chat turns."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Set


SWITCH_CLEANUP_KEYS = {
    "stock_name",
    "previous_analysis_summary",
    "previous_strategy",
    "previous_price",
    "previous_change_pct",
    "realtime_quote",
    "daily_history",
    "chip_distribution",
    "trend_result",
    "news_context",
    "fundamental_context",
    "analysis_context_pack_summary",
    "market_phase_context",
}

_STRONG_COMPARE_PATTERN = re.compile(r"比较|对比|vs\b|和[^，。,.!?！？]{0,40}比", re.IGNORECASE)
_WEAK_COMPARE_HINT_PATTERN = re.compile(r"差异(?!化)|区别|不同|相比|对照|比一比|和")
_CHOICE_COMPARE_PATTERN = re.compile(r"哪个|哪只|哪一个|谁更|更值得|更适合|怎么选|选哪|二选一")
_LINKED_COMPARE_PATTERN = re.compile(
    r"(?:和|与|跟|同)(?P<body>[^，。,.!?！？]{0,40})(?:差异(?!化)|区别|不同|相比|对照|比一比)"
)
_SWITCH_PATTERN = re.compile(r"换成|改看|分析|看看|研究|诊断")
_LOWERCASE_TICKER_PATTERN = re.compile(r"(?<![a-zA-Z.])([a-z]{2,5}(?:\.[a-z]{1,2})?)(?![a-zA-Z0-9])")
_EXCHANGE_TOKEN_CANDIDATES = {"SH", "SZ", "BJ", "HK", "SS"}
_CONTEXTUAL_INDICATOR_TOKENS = {"MA"}
_INDICATOR_CONTEXT_PATTERN = re.compile(
    r"指标|均线|移动平均|排列|多头|空头|金叉|死叉|支撑|压力|MA\d|SMA|EMA",
    re.IGNORECASE,
)

# Lazy-loaded stock name -> code reverse index
_STOCK_NAME_REVERSE_MAP: Optional[Dict[str, str]] = None
_STOCK_NAME_SORTED: Optional[List[str]] = None


@dataclass(frozen=True)
class StockScope:
    """Runtime stock-scope contract for one chat turn."""

    expected_stock_code: str = ""
    allowed_stock_codes: Set[str] = field(default_factory=set)
    mode: str = "maintain"

    def as_log_payload(self) -> Dict[str, Any]:
        return {
            "expected_stock_code": self.expected_stock_code,
            "allowed_stock_codes": sorted(self.allowed_stock_codes),
            "mode": self.mode,
        }

    def as_llm_hint(self) -> str:
        """Generate a human-readable hint for the LLM about the stock scope.

        - compare mode: list all allowed stocks and instruct to query all
        - switch mode: only the target stock is allowed
        - maintain mode: no hint needed (single stock, business as usual)
        """
        if self.mode == "compare" and len(self.allowed_stock_codes) > 1:
            stock_list = "、".join(sorted(self.allowed_stock_codes))
            return (
                f"本回合涉及多只股票分析，允许查询的股票范围：{stock_list}。\n"
                f"请逐一调用 get_realtime_quote 和 get_daily_history 获取每只股票的行情数据，"
                f"然后综合对比分析。"
            )
        if self.mode == "switch" and self.expected_stock_code:
            return f"本回合已切换到股票 {self.expected_stock_code}，请仅查询该股票的数据。"
        return ""


@dataclass(frozen=True)
class StockScopeResolution:
    """Result produced before a chat turn enters the agent loop."""

    effective_context: Dict[str, Any]
    stock_scope: Optional[StockScope]


def _normalize_stock_code(value: Any) -> str:
    """Normalize a code with the runner's canonical stock-code rules."""
    if not isinstance(value, str):
        return ""
    text = value.strip()
    if not text:
        return ""
    try:
        from src.agent.runner import _normalize_tool_stock_code

        normalized = _normalize_tool_stock_code(text)
    except Exception:
        normalized = text.strip().upper()
    return normalized if isinstance(normalized, str) else str(normalized)


def _is_denied_candidate(candidate: str, text: str = "") -> bool:
    token = candidate.strip().upper()
    if token in _EXCHANGE_TOKEN_CANDIDATES:
        return True
    if token in _CONTEXTUAL_INDICATOR_TOKENS and _INDICATOR_CONTEXT_PATTERN.search(text or ""):
        return True
    try:
        from src.agent.orchestrator import _COMMON_WORDS

        return token in _COMMON_WORDS
    except Exception:
        return False


def _append_candidate(candidates: List[str], candidate: str, text: str = "") -> None:
    normalized = _normalize_stock_code(candidate)
    if not normalized or _is_denied_candidate(normalized, text):
        return
    if normalized not in candidates:
        candidates.append(normalized)


def _contains_cjk(text: str) -> bool:
    """Return True when text contains CJK (Chinese) characters."""
    return any("\u3400" <= ch <= "\u9fff" for ch in text)


def _build_stock_name_reverse_index() -> Dict[str, str]:
    """Build name->code reverse map from STOCK_NAME_MAP, excluding ambiguous names."""
    from src.data.stock_mapping import STOCK_NAME_MAP

    name_to_codes: Dict[str, Set[str]] = {}
    for code, name in STOCK_NAME_MAP.items():
        if not name or not code:
            continue
        name_str = name.strip()
        if not name_str:
            continue
        name_to_codes.setdefault(name_str, set()).add(code)

    # Only include names that map to exactly one code (exclude ambiguous names)
    return {
        name: next(iter(codes))
        for name, codes in name_to_codes.items()
        if len(codes) == 1
    }


def _get_stock_name_index() -> tuple[Dict[str, str], List[str]]:
    """Lazy-load and return (name_to_code_map, sorted_names_by_length)."""
    global _STOCK_NAME_REVERSE_MAP, _STOCK_NAME_SORTED
    if _STOCK_NAME_REVERSE_MAP is None:
        _STOCK_NAME_REVERSE_MAP = _build_stock_name_reverse_index()
        _STOCK_NAME_SORTED = sorted(
            _STOCK_NAME_REVERSE_MAP.keys(),
            key=len,
            reverse=True,
        )
    return _STOCK_NAME_REVERSE_MAP, _STOCK_NAME_SORTED


def _extract_stock_names_from_text(text: str) -> List[str]:
    """Extract Chinese stock names from text and return their stock codes.

    Uses longest-match-first strategy to handle overlapping names
    (e.g., '阿里巴巴' matched before '阿里').

    Also supports partial / fuzzy name matching for common abbreviations
    (e.g., '茅台' -> '贵州茅台' -> '600519').
    """
    if not text or not _contains_cjk(text):
        return []

    name_to_code, sorted_names = _get_stock_name_index()
    found_codes: Set[str] = set()
    remaining = text

    # First pass: exact name matching (longest first)
    for name in sorted_names:
        if name in remaining:
            code = name_to_code[name]
            found_codes.add(code)
            remaining = remaining.replace(name, "")

    # Second pass: partial name matching for common abbreviations.
    # e.g., when user types "茅台" but the map only has "贵州茅台",
    # check if any CJK token in the text is a substring of a stock name.
    if not found_codes:
        # Extract CJK sequences of 2+ characters (user's keywords)
        cjk_tokens = re.findall(r'[\u4e00-\u9fff]{2,}', text)
        for token in cjk_tokens:
            for name, code in name_to_code.items():
                # token is a substring of a full stock name, e.g. "茅台" in "贵州茅台"
                if token in name:
                    found_codes.add(code)
                    break

    return list(found_codes)


def extract_stock_codes(text: str) -> List[str]:
    """Extract all explicit stock-code candidates from free text."""
    if not text:
        return []

    candidates: List[str] = []

    for pattern, flags in (
        (r"(?<![a-zA-Z])(?:SH|SZ|BJ)\d{6}(?!\d)", re.IGNORECASE),
        (r"(?<![a-zA-Z])hk\d{4,5}(?!\d)", re.IGNORECASE),
        (r"(?<![a-zA-Z])\d{1,5}\.HK(?![a-zA-Z])", re.IGNORECASE),
        (r"(?<!\d)(?:[03648]\d{5}|92\d{4})(?!\d)", 0),
        (r"(?<!\d)\d{5}(?!\d)", 0),
        (r"(?<![a-zA-Z.])([A-Z]{2,5}(?:\.[A-Z]{1,2})?)(?![a-zA-Z0-9])", 0),
    ):
        for match in re.finditer(pattern, text, flags):
            raw = match.group(1) if match.lastindex else match.group(0)
            _append_candidate(candidates, raw, text)

    if (
        _SWITCH_PATTERN.search(text)
        or _STRONG_COMPARE_PATTERN.search(text)
        or _WEAK_COMPARE_HINT_PATTERN.search(text)
        or _CHOICE_COMPARE_PATTERN.search(text)
    ):
        for match in _LOWERCASE_TICKER_PATTERN.finditer(text):
            _append_candidate(candidates, match.group(1), text)

    # Chinese stock name resolution (e.g., "长江电力" -> "600900")
    for code in _extract_stock_names_from_text(text):
        _append_candidate(candidates, code, text)

    return candidates


def _is_compare_message(message: str, candidates: List[str], current_code: str) -> bool:
    if _STRONG_COMPARE_PATTERN.search(message):
        return True
    new_candidates = {code for code in candidates if code != current_code}
    if len(new_candidates) >= 2:
        return True
    if _CHOICE_COMPARE_PATTERN.search(message) and len(candidates) >= 2:
        return True
    if not _WEAK_COMPARE_HINT_PATTERN.search(message):
        return False
    if len(candidates) >= 2:
        return True

    if not new_candidates:
        return False

    for match in _LINKED_COMPARE_PATTERN.finditer(message):
        body_candidates = set(extract_stock_codes(f"比较 {match.group('body')}"))
        if body_candidates & new_candidates:
            return True
    return False


def _with_skills(context: Dict[str, Any], skills: Optional[Iterable[str]]) -> Dict[str, Any]:
    if skills is None:
        return context
    next_context = dict(context)
    next_context["skills"] = list(skills)
    return next_context


def _switch_context(context: Dict[str, Any], stock_code: str) -> Dict[str, Any]:
    next_context = {
        key: value
        for key, value in context.items()
        if key not in SWITCH_CLEANUP_KEYS and key != "allowed_stock_codes"
    }
    next_context["stock_code"] = stock_code
    next_context["stock_name"] = ""
    return next_context


def resolve_stock_scope(
    message: str,
    context: Optional[Dict[str, Any]],
    *,
    skills: Optional[Iterable[str]] = None,
) -> StockScopeResolution:
    """Resolve the effective context and stock tool scope for one chat turn."""
    original_context = dict(context or {})
    message_text = message or ""
    current_code = _normalize_stock_code(original_context.get("stock_code"))
    invalid_context_code = bool(current_code and _is_denied_candidate(current_code, message_text))
    original_context.pop("allowed_stock_codes", None)
    if invalid_context_code:
        original_context.pop("stock_code", None)
        original_context.pop("stock_name", None)
        current_code = ""

    if not current_code:
        if invalid_context_code:
            candidates = extract_stock_codes(message_text)
            allowed = set(candidates)
            expected = candidates[0] if len(candidates) == 1 else ""
            effective_context = dict(original_context)
            mode = "switch" if expected else ("compare" if len(candidates) > 1 else "maintain")
            if expected:
                effective_context["stock_code"] = expected
                effective_context["stock_name"] = ""
            return StockScopeResolution(
                effective_context=_with_skills(effective_context, skills),
                stock_scope=StockScope(
                    expected_stock_code=expected,
                    allowed_stock_codes=allowed,
                    mode=mode,
                ),
            )
        return StockScopeResolution(
            effective_context=_with_skills(original_context, skills),
            stock_scope=None,
        )

    candidates = extract_stock_codes(message_text)
    new_candidates = [code for code in candidates if code != current_code]
    mode = "maintain"
    effective_context = dict(original_context)
    expected = current_code
    allowed = {current_code}

    if _is_compare_message(message_text, candidates, current_code):
        mode = "compare"
        allowed.update(candidates)
    elif _SWITCH_PATTERN.search(message_text) and len(new_candidates) == 1:
        mode = "switch"
        expected = new_candidates[0]
        allowed = {expected}
        effective_context = _switch_context(original_context, expected)
    elif len(new_candidates) == 1 and not _is_compare_message(message_text, candidates, current_code):
        # Implicit switch: user mentioned a different stock code/name
        # without explicit switch keywords like "分析/看看".
        # Treat it as a switch to the newly mentioned stock.
        mode = "switch"
        expected = new_candidates[0]
        allowed = {expected}
        effective_context = _switch_context(original_context, expected)

    effective_context["stock_code"] = expected if mode == "switch" else current_code
    effective_context = _with_skills(effective_context, skills)

    return StockScopeResolution(
        effective_context=effective_context,
        stock_scope=StockScope(
            expected_stock_code=expected,
            allowed_stock_codes=allowed,
            mode=mode,
        ),
    )