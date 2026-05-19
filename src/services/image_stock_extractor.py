# -*- coding: utf-8 -*-
"""
===================================
图片股票代码提取 (百度智能云 OCR)
===================================

从截图/图片中提取股票代码，使用百度智能云 OCR API。
支持通用文字识别和高精度识别。
"""

from __future__ import annotations

import base64
import json
import logging
import random
import re
import time
from typing import List, Optional, Tuple

from src.config import Config, get_config

logger = logging.getLogger(__name__)

# 百度智能云 OCR SDK
try:
    from aip import AipOcr
    BAIDU_AIP_AVAILABLE = True
except ImportError:
    BAIDU_AIP_AVAILABLE = False
    AipOcr = None

EXTRACT_PROMPT = """请分析以下股票市场截图中的文字内容，提取其中所有可见的股票代码及名称。

重要：若文本中包含股票名称和代码（如自选股列表、ETF 列表），必须同时提取两者。

输出格式：仅返回有效的 JSON 数组，不要 markdown、不要解释。
每个元素为对象：{"code":"股票代码","name":"股票名称","confidence":"high|medium|low"}
- code: 必填，股票代码（A股6位、港股5位、美股1-5字母、ETF 如 159887/512880）
- name: 若文本中有名称则必填（如 贵州茅台、银行ETF、证券ETF），与代码一一对应；仅当确实无名称时可省略
- confidence: 必填，识别置信度，high=确定、medium=较确定、low=不确定

示例（文本中同时有名称和代码时）：
- 个股：600519 贵州茅台、300750 宁德时代
- 港股：00700 腾讯控股、09988 阿里巴巴
- 美股：AAPL 苹果、TSLA 特斯拉
- ETF：159887 银行ETF、512880 证券ETF、512000 券商ETF、512480 半导体ETF、515030 新能源车ETF

输出示例：[{"code":"600519","name":"贵州茅台","confidence":"high"},{"code":"159887","name":"银行ETF","confidence":"high"}]

禁止只返回代码数组如 ["159887","512880"]，必须使用对象格式。若未找到任何股票代码，返回：[]"""

# Valid confidence values; invalid ones normalized to medium
_VALID_CONFIDENCE = frozenset({"high", "medium", "low"})

# LLM sometimes returns JSON field names or markdown labels as "code"; filter these out
_FAKE_CODES = frozenset({"CODE", "NAME", "HIGH", "LOW", "MEDIUM", "CONFIDENCE", "JSON"})

ALLOWED_MIME = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
VISION_API_TIMEOUT = 60  # seconds; avoid long blocks on network/API issues

# Magic bytes for server-side MIME validation (client Content-Type can be forged)
_IMAGE_SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"],  # bytes[8:12] must be WEBP, checked separately
}


def _verify_image_magic_bytes(image_bytes: bytes, mime_type: str) -> None:
    """Verify actual file content matches declared MIME type (rejects forged Content-Type)."""
    if len(image_bytes) < 12:
        raise ValueError("图片文件过小或损坏")
    if mime_type not in _IMAGE_SIGNATURES:
        raise ValueError(f"无法验证类型: {mime_type}")
    if mime_type == "image/webp":
        if image_bytes[:4] != b"RIFF" or image_bytes[8:12] != b"WEBP":
            raise ValueError("文件内容与声明的类型 image/webp 不匹配，可能被篡改")
        return
    for sig in _IMAGE_SIGNATURES[mime_type]:
        if image_bytes.startswith(sig):
            return
    raise ValueError(f"文件内容与声明的类型 {mime_type} 不匹配，可能被篡改")


def _normalize_code(raw: str) -> Optional[str]:
    """Normalize and validate a single stock code. A-shares & HK: 5-6 digits; US: 1-5 letters."""
    s = raw.strip().upper()
    if not s:
        return None
    # A-shares & HK: 5-6 digit codes (600519, 00700, 09988)
    if s.isdigit() and len(s) in (5, 6):
        return s
    # US stocks: 1-5 letters, optionally with . (e.g. BRK.B)
    if re.match(r"^[A-Z]{1,5}(\.[A-Z])?$", s):
        return s
    # 尝试去除 SH/SZ 后缀
    for suffix in (".SH", ".SZ", ".SS"):
        if s.endswith(suffix):
            base = s[: -len(suffix)].strip()
            if base.isdigit() and len(base) in (5, 6):
                return base
    return None


def _parse_codes_from_text(text: str) -> List[str]:
    """从 LLM 响应文本解析股票代码（legacy format）。"""
    seen: set[str] = set()
    result: List[str] = []

    # 优先尝试 JSON 数组；只移除开头的 markdown 围栏，避免 find("```") 误删结尾导致清空
    cleaned = text.strip()
    for start in ("```json", "```"):
        if cleaned.startswith(start):
            cleaned = cleaned[len(start) :].strip()
            break
    end_idx = cleaned.rfind("```")
    if end_idx >= 0:
        cleaned = cleaned[:end_idx].strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            for item in data:
                if isinstance(item, str):
                    c = _normalize_code(item)
                    if c and c not in seen and c not in _FAKE_CODES:
                        seen.add(c)
                        result.append(c)
            return result
    except json.JSONDecodeError:
        pass

    # 兜底：查找 5-6 位数字及美股代码
    for m in re.finditer(r"\b([0-9]{5,6}|[A-Z]{1,5}(\.[A-Z])?)\b", text, re.IGNORECASE):
        c = _normalize_code(m.group(1))
        if c and c not in seen and c not in _FAKE_CODES:
            seen.add(c)
            result.append(c)

    return result


def _parse_items_from_text(text: str) -> List[Tuple[str, Optional[str], str]]:
    """
    Parse LLM response into items (code, name, confidence).
    Tries new format first, fallback to legacy codes-only format.
    """
    cleaned = text.strip()
    for start in ("```json", "```"):
        if cleaned.startswith(start):
            cleaned = cleaned[len(start) :].strip()
            break
    end_idx = cleaned.rfind("```")
    if end_idx >= 0:
        cleaned = cleaned[:end_idx].strip()

    # Try new format: list of objects
    parsed_data = None
    try:
        parsed_data = json.loads(cleaned)
    except json.JSONDecodeError:
        try:
            from json_repair import repair_json

            parsed_data = repair_json(cleaned, return_objects=True)
            logger.debug("[ImageExtractor] json.loads failed, repaired malformed JSON response")
        except Exception:
            parsed_data = None

    if isinstance(parsed_data, list):
        seen: set[str] = set()
        result: List[Tuple[str, Optional[str], str]] = []
        for item in parsed_data:
            if not isinstance(item, dict):
                continue
            code_raw = item.get("code") if isinstance(item.get("code"), str) else None
            if not code_raw:
                continue
            code = _normalize_code(code_raw)
            if not code or code in seen or code in _FAKE_CODES:
                continue
            seen.add(code)
            name = item.get("name")
            if isinstance(name, str) and name.strip():
                name = name.strip()
            else:
                name = None
            conf = item.get("confidence")
            if isinstance(conf, str) and conf.lower() in _VALID_CONFIDENCE:
                conf = conf.lower()
            else:
                conf = "medium"
            result.append((code, name, conf))
        if result:
            return result

    # Fallback: legacy format (codes only)
    codes = _parse_codes_from_text(text)
    if not codes:
        logger.info("[ImageExtractor] 无法解析为结构化 items，且 legacy code 提取为空")
    return [(c, None, "medium") for c in codes]


def _init_baidu_ocr_client(cfg: Config):
    """初始化百度智能云 OCR 客户端"""
    if not BAIDU_AIP_AVAILABLE:
        raise ValueError(
            "百度智能云 SDK 未安装，请执行: pip install baidu-aip"
        )
    
    if not cfg.baidu_ocr_app_id or not cfg.baidu_ocr_api_key or not cfg.baidu_ocr_secret_key:
        raise ValueError(
            "未配置百度智能云 OCR。请设置 BAIDU_OCR_APP_ID、BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY。"
        )
    
    return AipOcr(cfg.baidu_ocr_app_id, cfg.baidu_ocr_api_key, cfg.baidu_ocr_secret_key)


def _call_baidu_ocr(image_bytes: bytes, mime_type: str, cfg: Config) -> str:
    """使用百度智能云 OCR 识别图片中的文字"""
    client = _init_baidu_ocr_client(cfg)
    
    # 使用通用文字识别（高精度版）
    # 参考: https://cloud.baidu.com/doc/OCR/s/zk3h7xz52
    options = {
        "language_type": "CHN_ENG",  # 中英文混合
        "detect_direction": "true",  # 检测图片朝向
        "detect_language": "true",   # 检测语言
        "probability": "true",       # 返回置信度
    }
    
    try:
        # 调用通用文字识别 API
        result = client.basicAccurate(image_bytes, options)
        
        if "error_code" in result:
            error_code = result.get("error_code")
            error_msg = result.get("error_msg", "Unknown error")
            raise ValueError(f"百度 OCR 调用失败: error_code={error_code}, error_msg={error_msg}")
        
        # 提取识别结果
        words_result = result.get("words_result", [])
        if not words_result:
            logger.warning("[ImageExtractor] 百度 OCR 返回空结果")
            return ""
        
        # 合并所有识别出的文字
        text_lines = [item.get("words", "") for item in words_result if "words" in item]
        full_text = "\n".join(text_lines)
        
        logger.debug(f"[ImageExtractor] 百度 OCR 识别结果:\n{full_text}")
        return full_text
        
    except Exception as e:
        logger.error(f"[ImageExtractor] 百度 OCR 调用异常: {e}")
        raise


def extract_stock_codes_from_image(
    image_bytes: bytes,
    mime_type: str,
) -> Tuple[List[Tuple[str, Optional[str], str]], str]:
    """
    从图片中提取股票代码及名称（使用百度智能云 OCR）。

    支持多 Key 轮询与重试（最多 3 次，指数退避）。

    Args:
        image_bytes: 原始图片字节
        mime_type: MIME 类型（如 image/jpeg, image/png）

    Returns:
        (items, raw_text) - items 为 [(code, name?, confidence), ...]，raw_text 为原始 OCR 响应。

    Raises:
        ValueError: 图片无效、未配置 OCR API 或提取失败时。
    """
    mime_type = (mime_type or "image/jpeg").strip().lower().split(";")[0].strip()
    if mime_type not in ALLOWED_MIME:
        raise ValueError(f"不支持的图片类型: {mime_type}。允许: {list(ALLOWED_MIME)}")

    if not image_bytes:
        raise ValueError("图片内容为空")

    if len(image_bytes) > MAX_SIZE_BYTES:
        raise ValueError(f"Image too large (max {MAX_SIZE_BYTES // (1024 * 1024)}MB)")

    _verify_image_magic_bytes(image_bytes, mime_type)

    cfg = get_config()
    last_error: Optional[Exception] = None
    
    for attempt in range(3):
        try:
            # 调用百度 OCR 识别图片文字
            raw_text = _call_baidu_ocr(image_bytes, mime_type, cfg)
            
            if not raw_text:
                logger.info("[ImageExtractor] 百度 OCR 返回空文本")
                return [], ""
            
            # 从识别的文本中解析股票代码
            items = _parse_items_from_text(raw_text)
            logger.info(
                f"[ImageExtractor] 百度 OCR 提取 {len(items)} 个: "
                f"{[(i[0], i[1]) for i in items[:5]]}{'...' if len(items) > 5 else ''}"
            )
            return items, raw_text
            
        except Exception as e:
            last_error = e
            if attempt < 2:
                delay = 2 ** attempt
                logger.warning(f"[ImageExtractor] 尝试 {attempt + 1}/3 失败，{delay}s 后重试: {e}")
                time.sleep(delay)

    raise ValueError(
        f"百度 OCR API 调用失败，请检查配置与网络: {last_error}"
    ) from last_error
