# -*- coding: utf-8 -*-
"""Portfolio CSV import service with extensible parser registry."""

from __future__ import annotations

import hashlib
import io
import logging
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from data_provider.base import canonical_stock_code
from src.repositories.portfolio_repo import PortfolioRepository
from src.services.portfolio_service import (
    PortfolioBusyError,
    PortfolioConflictError,
    PortfolioOversellError,
    PortfolioService,
)

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class CsvParserSpec:
    """CSV parser specification for one broker."""

    broker: str
    aliases: Tuple[str, ...]
    display_name: str
    column_hints: Dict[str, Tuple[str, ...]]


DEFAULT_PARSER_SPECS: Tuple[CsvParserSpec, ...] = (
    CsvParserSpec(
        broker="huatai",
        aliases=(),
        display_name="华泰",
        column_hints={
            "trade_date": ("成交日期", "成交时间", "发生日期", "日期", "交易日期"),
            "symbol": ("证券代码", "股票代码", "代码"),
            "side": ("买卖标志", "买卖方向", "操作", "交易方向"),
            "quantity": ("成交数量", "数量", "成交股数", "交易数量"),
            "price": ("成交均价", "成交价格", "价格", "成交价", "均价", "交易价格"),
            "trade_uid": ("成交编号", "成交序号", "流水号", "交易流水号"),
        },
    ),
    CsvParserSpec(
        broker="citic",
        aliases=("zhongxin",),
        display_name="中信",
        column_hints={
            "trade_date": ("发生日期", "成交日期", "日期", "交易日期"),
            "symbol": ("证券代码", "股票代码", "代码"),
            "side": ("买卖方向", "买卖标志", "业务名称", "交易方向"),
            "quantity": ("成交数量", "数量", "成交股数", "交易数量"),
            "price": ("成交价格", "成交均价", "价格", "成交价", "交易价格"),
            "trade_uid": ("合同编号", "成交编号", "委托编号", "交易流水号"),
        },
    ),
    CsvParserSpec(
        broker="cmb",
        aliases=("zhaoshang", "cmbchina"),
        display_name="招商",
        column_hints={
            "trade_date": ("日期", "成交日期", "发生日期", "交易日期"),
            "symbol": ("证券代码", "股票代码", "代码"),
            "side": ("交易方向", "买卖方向", "买卖标志"),
            "quantity": ("成交股数", "成交数量", "数量", "交易数量"),
            "price": ("成交价", "成交价格", "成交均价", "均价", "交易价格"),
            "trade_uid": ("流水号", "成交编号", "成交序号", "交易流水号"),
        },
    ),
)


class PortfolioImportService:
    """Parse broker CSV and commit normalized trade records with dedup."""
    _shared_parser_registry: Dict[str, CsvParserSpec] = {}
    _shared_broker_alias_map: Dict[str, str] = {}
    _shared_registry_initialized: bool = False

    def __init__(
        self,
        *,
        portfolio_service: Optional[PortfolioService] = None,
        repo: Optional[PortfolioRepository] = None,
    ):
        self.portfolio_service = portfolio_service or PortfolioService()
        self.repo = repo or PortfolioRepository()
        self._parser_registry = self.__class__._shared_parser_registry
        self._broker_alias_map = self.__class__._shared_broker_alias_map
        if not self.__class__._shared_registry_initialized:
            self._init_default_parsers()
            self.__class__._shared_registry_initialized = True

    def _init_default_parsers(self) -> None:
        for spec in DEFAULT_PARSER_SPECS:
            self.register_parser(spec)

    def register_parser(self, spec: CsvParserSpec) -> None:
        """Register or replace one broker parser spec."""
        broker = (spec.broker or "").strip().lower()
        if not broker:
            raise ValueError("broker is required")
        new_aliases = tuple(sorted({alias.strip().lower() for alias in spec.aliases if alias}))
        for alias in new_aliases:
            if alias == broker:
                raise ValueError(f"alias '{alias}' cannot be the same as broker id")
            existing_target = self._broker_alias_map.get(alias)
            if existing_target and existing_target != broker:
                raise ValueError(
                    f"alias '{alias}' already registered by broker '{existing_target}'"
                )
        for alias, target in list(self._broker_alias_map.items()):
            if target == broker and alias not in new_aliases:
                self._broker_alias_map.pop(alias, None)
        self._parser_registry[broker] = CsvParserSpec(
            broker=broker,
            aliases=new_aliases,
            display_name=spec.display_name or broker,
            column_hints=dict(spec.column_hints or {}),
        )
        for alias in self._parser_registry[broker].aliases:
            self._broker_alias_map[alias] = broker

    def list_supported_brokers(self) -> List[Dict[str, Any]]:
        """List canonical broker ids and aliases for frontend selector."""
        items: List[Dict[str, Any]] = []
        for broker in sorted(self._parser_registry.keys()):
            aliases = sorted(alias for alias, target in self._broker_alias_map.items() if target == broker)
            items.append(
                {
                    "broker": broker,
                    "aliases": aliases,
                    "display_name": self._parser_registry[broker].display_name,
                }
            )
        return items

    def parse_trade_csv(
        self,
        *,
        broker: str,
        content: bytes,
        filename: str = "",
    ) -> Dict[str, Any]:
        """
        Parse broker CSV/Excel file into normalized trade records.
        
        Args:
            broker: Broker identifier (huatai/citic/cmb)
            content: File content as bytes
            filename: Original filename to detect format (.csv/.xls/.xlsx)
            
        Returns:
            Dictionary with parsed records and statistics
        """
        broker_norm = self._normalize_broker(broker)
        parser_spec = self._parser_registry[broker_norm]
        df = self._read_spreadsheet(content, filename=filename)
        
        # Log column names for debugging
        logger.info(f"Parsed DataFrame columns: {list(df.columns)}")
        logger.info(f"DataFrame shape: {df.shape}")
        if len(df) > 0:
            logger.info(f"First row sample: {df.iloc[0].to_dict()}")

        records: List[Dict[str, Any]] = []
        skipped = 0
        errors: List[str] = []
        skip_reasons: Dict[str, int] = {}  # Track why rows are skipped

        for idx, row in df.iterrows():
            normalized, skip_reason = self._normalize_trade_row_with_reason(row=row, parser_spec=parser_spec)
            if normalized is None:
                skipped += 1
                if skip_reason:
                    skip_reasons[skip_reason] = skip_reasons.get(skip_reason, 0) + 1
                continue
            try:
                # Keep a stable line-level marker so repeated imports of the same
                # file remain idempotent, while identical split fills on separate
                # CSV lines do not collapse into one dedup key.
                normalized["_source_line_number"] = int(idx) + 2
                normalized["dedup_hash"] = self._build_dedup_hash(normalized)
                records.append(normalized)
            except Exception as exc:  # pragma: no cover - defensive path
                skipped += 1
                errors.append(f"row={idx + 1}: {exc}")
        
        # Log skip reasons summary
        if skip_reasons:
            logger.warning(f"Skip reasons summary: {skip_reasons}")

        return {
            "broker": broker_norm,
            "record_count": len(records),
            "skipped_count": skipped,
            "error_count": len(errors),
            "records": records,
            "errors": errors[:20],
            "skip_reasons": skip_reasons,  # Include skip reasons in response
        }

    def commit_trade_records(
        self,
        *,
        account_id: int,
        broker: str,
        records: List[Dict[str, Any]],
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        broker_norm = self._normalize_broker(broker)

        inserted_count = 0
        duplicate_count = 0
        failed_count = 0
        errors: List[str] = []
        seen_trade_uids: set[str] = set()
        seen_dedup_hashes: set[str] = set()

        for i, record in enumerate(records):
            try:
                trade_uid = (record.get("trade_uid") or "").strip() or None
                dedup_hash = (record.get("dedup_hash") or "").strip()
                if not dedup_hash:
                    dedup_hash = self._build_dedup_hash(record)

                if trade_uid and self.repo.has_trade_uid(account_id, trade_uid):
                    duplicate_count += 1
                    continue
                dedup_hash_to_use: Optional[str] = dedup_hash or None
                if dedup_hash_to_use and self.repo.has_trade_dedup_hash(account_id, dedup_hash_to_use):
                    duplicate_count += 1
                    continue

                if dry_run:
                    if trade_uid and trade_uid in seen_trade_uids:
                        duplicate_count += 1
                        continue
                    if dedup_hash_to_use and dedup_hash_to_use in seen_dedup_hashes:
                        duplicate_count += 1
                        continue
                    inserted_count += 1
                    if trade_uid:
                        seen_trade_uids.add(trade_uid)
                    if dedup_hash_to_use:
                        seen_dedup_hashes.add(dedup_hash_to_use)
                    continue

                trade_date_value = record.get("trade_date")
                if isinstance(trade_date_value, date):
                    trade_date_obj = trade_date_value
                else:
                    trade_date_obj = date.fromisoformat(str(trade_date_value))

                self.portfolio_service.record_trade(
                    account_id=account_id,
                    symbol=str(record["symbol"]),
                    trade_date=trade_date_obj,
                    side=str(record["side"]),
                    quantity=float(record["quantity"]),
                    price=float(record["price"]),
                    fee=float(record.get("fee", 0.0) or 0.0),
                    tax=float(record.get("tax", 0.0) or 0.0),
                    market=record.get("market"),
                    currency=record.get("currency"),
                    trade_uid=trade_uid,
                    dedup_hash=dedup_hash_to_use,
                    note=(record.get("note") or "").strip() or f"csv_import:{broker_norm}",
                )
                inserted_count += 1
            except PortfolioConflictError:
                duplicate_count += 1
            except PortfolioOversellError as exc:
                failed_count += 1
                errors.append(f"idx={i}: {exc}")
            except PortfolioBusyError as exc:
                failed_count += 1
                errors.append(f"idx={i}: portfolio_busy: {exc}")
            except Exception as exc:
                failed_count += 1
                errors.append(f"idx={i}: {exc}")

        return {
            "account_id": account_id,
            "record_count": len(records),
            "inserted_count": inserted_count,
            "duplicate_count": duplicate_count,
            "failed_count": failed_count,
            "dry_run": bool(dry_run),
            "errors": errors[:20],
        }

    def _normalize_broker(self, value: str) -> str:
        broker = (value or "").strip().lower()
        broker = self._broker_alias_map.get(broker, broker)
        if broker not in self._parser_registry:
            supported = ", ".join(sorted(self._parser_registry.keys()))
            raise ValueError(f"broker must be one of: {supported}")
        return broker

    @staticmethod
    def _read_spreadsheet(content: bytes, filename: str = "") -> pd.DataFrame:
        """
        Read spreadsheet file (CSV, XLS, XLSX, HTML, TXT) with automatic format detection.
        
        Args:
            content: Raw file content as bytes
            filename: Original filename to help detect format
            
        Returns:
            DataFrame with all columns as strings
            
        Raises:
            ValueError: If file cannot be parsed
        """
        # Detect format from filename extension or content
        ext = ""
        if filename:
            ext = filename.lower().split('.')[-1] if '.' in filename else ""
        
        # Try Excel formats first if extension suggests it
        if ext in ('xls', 'xlsx'):
            return PortfolioImportService._read_excel(content, ext=ext)
        
        # Try TXT format (tab-separated or space-separated)
        if ext == 'txt':
            try:
                return PortfolioImportService._read_txt_file(content)
            except Exception as txt_error:
                # If TXT parsing fails, try CSV as fallback
                try:
                    return PortfolioImportService._read_csv_robust(content)
                except Exception:
                    pass
                raise txt_error
        
        # Try CSV format
        if ext in ('csv', ''):
            try:
                return PortfolioImportService._read_csv_robust(content)
            except Exception as csv_error:
                # If CSV parsing fails and no explicit extension, try Excel
                if not ext:
                    try:
                        return PortfolioImportService._read_excel(content, ext='auto')
                    except Exception:
                        pass
                    # Also try HTML table format
                    try:
                        return PortfolioImportService._read_html_table(content)
                    except Exception:
                        pass
                    # Also try TXT format
                    try:
                        return PortfolioImportService._read_txt_file(content)
                    except Exception:
                        pass
                raise csv_error
        
        # Fallback: try both formats
        if ext not in ('csv', 'xls', 'xlsx', 'txt'):
            # Try CSV first
            try:
                return PortfolioImportService._read_csv_robust(content)
            except Exception:
                pass
            # Then try Excel
            try:
                return PortfolioImportService._read_excel(content, ext='auto')
            except Exception:
                pass
            # Then try HTML table
            try:
                return PortfolioImportService._read_html_table(content)
            except Exception:
                pass
            # Finally try TXT
            try:
                return PortfolioImportService._read_txt_file(content)
            except Exception:
                pass
        
        raise ValueError(
            f"不支持的文件格式：'{ext}'\n\n"
            f"支持的格式：.csv, .xls, .xlsx, .txt"
        )
    
    @staticmethod
    def _detect_excel_format(content: bytes) -> str:
        """
        Detect Excel format by examining file header/magic bytes.
        
        Args:
            content: Raw file content as bytes
            
        Returns:
            'xlsx' for Office Open XML, 'xls' for old Excel format, 
            'html' for HTML table masquerading as Excel, or None if unknown
        """
        if len(content) < 4:
            return None
        
        # Check magic bytes
        # XLSX (ZIP format): starts with PK (0x50 0x4B)
        if content[:2] == b'PK':
            return 'xlsx'
        
        # XLS (OLE2/Compound Document): starts with D0 CF 11 E0
        if content[:4] == b'\xD0\xCF\x11\xE0':
            return 'xls'
        
        # HTML table saved as .xls: check for HTML tags in first few KB
        try:
            text_start = content[:2048].decode('utf-8', errors='ignore').lower()
            if '<table' in text_start or '<html' in text_start or '<!doctype html' in text_start:
                logger.info("Detected HTML table format (commonly exported by some brokers)")
                return 'html'
        except Exception:
            pass
        
        return None
    
    @staticmethod
    def _read_excel(content: bytes, ext: str = "auto") -> pd.DataFrame:
        """
        Read Excel file (.xls or .xlsx) with intelligent format detection.
        
        Args:
            content: Raw Excel file content as bytes
            ext: File extension hint ('xls', 'xlsx', or 'auto')
            
        Returns:
            DataFrame with all columns as strings
        """
        # If auto-detection requested, examine file content
        detected_ext = ext
        if ext == 'auto':
            detected_ext = PortfolioImportService._detect_excel_format(content)
            if detected_ext:
                logger.info(f"Auto-detected Excel format: {detected_ext}")
        
        # If detected as HTML table, handle it separately
        if detected_ext == 'html':
            return PortfolioImportService._read_html_table(content)
        
        errors = []
        
        # Try the detected/specified format first
        if detected_ext in ('xlsx',):
            try:
                df = pd.read_excel(
                    io.BytesIO(content),
                    engine='openpyxl',
                    dtype=str,
                    keep_default_na=False,
                )
                if not df.empty:
                    logger.info(f"Successfully read Excel using openpyxl engine")
                    return df
            except Exception as e:
                errors.append(f"openpyxl: {str(e)}")
                logger.debug(f"openpyxl failed: {e}")
        
        if detected_ext in ('xls',):
            try:
                df = pd.read_excel(
                    io.BytesIO(content),
                    engine='xlrd',
                    dtype=str,
                    keep_default_na=False,
                )
                if not df.empty:
                    logger.info(f"Successfully read Excel using xlrd engine")
                    return df
            except Exception as e:
                errors.append(f"xlrd: {str(e)}")
                logger.debug(f"xlrd failed: {e}")
        
        # If auto mode and specific engine failed, try the other one as fallback
        if ext == 'auto':
            if detected_ext == 'xlsx':
                # Try xlrd as fallback
                try:
                    df = pd.read_excel(
                        io.BytesIO(content),
                        engine='xlrd',
                        dtype=str,
                        keep_default_na=False,
                    )
                    if not df.empty:
                        logger.info(f"Fallback to xlrd succeeded")
                        return df
                except Exception as e:
                    errors.append(f"xlrd (fallback): {str(e)}")
            elif detected_ext == 'xls':
                # Try openpyxl as fallback
                try:
                    df = pd.read_excel(
                        io.BytesIO(content),
                        engine='openpyxl',
                        dtype=str,
                        keep_default_na=False,
                    )
                    if not df.empty:
                        logger.info(f"Fallback to openpyxl succeeded")
                        return df
                except Exception as e:
                    errors.append(f"openpyxl (fallback): {str(e)}")
            else:
                # Unknown format, try both engines
                for engine_name, engine in [('openpyxl', 'openpyxl'), ('xlrd', 'xlrd')]:
                    try:
                        df = pd.read_excel(
                            io.BytesIO(content),
                            engine=engine,
                            dtype=str,
                            keep_default_na=False,
                        )
                        if not df.empty:
                            logger.info(f"Successfully read Excel using {engine_name} engine")
                            return df
                    except Exception as e:
                        errors.append(f"{engine_name}: {str(e)}")
                        logger.debug(f"{engine_name} failed: {e}")
                
                # Last resort: try HTML table parsing
                try:
                    return PortfolioImportService._read_html_table(content)
                except Exception as e:
                    errors.append(f"html: {str(e)}")
        
        # All attempts failed
        error_details = "\n".join([f"  - {err}" for err in errors]) if errors else "No detailed error information"
        
        # If ext is 'xls' and all Excel engines failed, try TSV/CSV parsing
        # Many brokers export TSV files with .xls extension
        if detected_ext == 'xls' or ext == 'xls':
            logger.info("Excel parsing failed, attempting TSV/CSV parsing for .xls file")
            try:
                return PortfolioImportService._read_csv_robust(content)
            except Exception as csv_err:
                errors.append(f"TSV fallback: {str(csv_err)}")
                logger.debug(f"TSV fallback also failed: {csv_err}")
            
            # Also try HTML table as last resort
            try:
                return PortfolioImportService._read_html_table(content)
            except Exception as html_err:
                errors.append(f"HTML fallback: {str(html_err)}")
        
        raise ValueError(
            f"无法解析Excel文件\n\n"
            f"可能的原因：\n"
            f"1. 文件不是有效的Excel格式（可能是CSV/TSV或其他格式）\n"
            f"2. 文件已损坏或不完整\n"
            f"3. 文件格式与扩展名不匹配（如.xls实际是.xlsx）\n"
            f"4. 文件实际上是HTML表格而非真正的Excel\n\n"
            f"建议解决方案：\n"
            f"• 用Excel打开文件，另存为新的.xlsx文件\n"
            f"• 或转换为CSV格式后重新上传\n"
            f"• 检查文件是否可以从券商系统正常导出\n\n"
            f"技术详情：\n{error_details}"
        )
    
    @staticmethod
    def _read_html_table(content: bytes) -> pd.DataFrame:
        """
        Read HTML table (commonly exported by brokers as .xls).
        
        Args:
            content: Raw HTML content as bytes
            
        Returns:
            DataFrame with all columns as strings
        """
        try:
            # Try to decode with various encodings
            html_text = None
            for encoding in ('utf-8', 'gbk', 'gb18030'):
                try:
                    html_text = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            
            if html_text is None:
                html_text = content.decode('utf-8', errors='ignore')
            
            # Use pandas to read HTML tables
            from io import StringIO
            
            # Find all <table> tags
            tables = pd.read_html(StringIO(html_text), dtype=str, keep_default_na=False)
            
            if not tables:
                raise ValueError("No tables found in HTML")
            
            # Return the first (and usually only) table
            df = tables[0]
            logger.info(f"Successfully parsed HTML table with {len(df)} rows and {len(df.columns)} columns")
            return df
            
        except ImportError:
            raise ValueError(
                "无法解析HTML表格：需要安装 lxml 或 html5lib\n\n"
                "请运行：pip install lxml html5lib"
            )
        except Exception as e:
            raise ValueError(
                f"无法解析HTML表格：{str(e)}\n\n"
                f"建议：用Excel打开文件，另存为真正的.xlsx格式"
            )
    
    @staticmethod
    def _read_csv_robust(content: bytes) -> pd.DataFrame:
        """
        Read CSV/TSV file with robust error handling.
        Tries tab-separated (TSV) first, then comma-separated (CSV).
        """
        errors = []
        
        # Strategy 1: Try TSV (tab-separated) - most common for broker exports
        for encoding in ("utf-8-sig", "gbk", "gb18030"):
            try:
                df = pd.read_csv(
                    io.BytesIO(content),
                    encoding=encoding,
                    sep='\t',  # Tab separator
                    dtype=str,
                    keep_default_na=False,
                    engine='python',
                )
                if not df.empty and len(df.columns) > 1:
                    logger.info(f"Successfully parsed as TSV with {encoding} encoding, {len(df)} rows, {len(df.columns)} columns")
                    return df
            except UnicodeDecodeError:
                continue
            except Exception as e:
                errors.append(f"TSV ({encoding}): {str(e)}")
                logger.debug(f"TSV parsing failed with {encoding}: {e}")
        
        # Strategy 2: Try CSV (comma-separated)
        for encoding in ("utf-8-sig", "gbk", "gb18030"):
            try:
                df = pd.read_csv(
                    io.BytesIO(content),
                    encoding=encoding,
                    sep=',',  # Comma separator
                    dtype=str,
                    keep_default_na=False,
                    engine='python',
                )
                if not df.empty and len(df.columns) > 1:
                    logger.info(f"Successfully parsed as CSV with {encoding} encoding, {len(df)} rows, {len(df.columns)} columns")
                    return df
            except UnicodeDecodeError:
                continue
            except Exception as e:
                errors.append(f"CSV ({encoding}): {str(e)}")
                logger.debug(f"CSV parsing failed with {encoding}: {e}")
        
        # Strategy 3: Try with on_bad_lines='skip' for TSV
        for encoding in ("utf-8-sig", "gbk", "gb18030"):
            try:
                df = pd.read_csv(
                    io.BytesIO(content),
                    encoding=encoding,
                    sep='\t',
                    dtype=str,
                    keep_default_na=False,
                    on_bad_lines='skip',
                    engine='python',
                )
                if not df.empty and len(df.columns) > 1:
                    logger.info(f"Successfully parsed as TSV (lenient) with {encoding} encoding")
                    return df
            except Exception:
                continue
        
        # Strategy 4: Try auto-detect separator
        try:
            text = content.decode('utf-8-sig', errors='ignore')
            df = pd.read_csv(
                io.StringIO(text),
                sep=None,  # Auto-detect
                engine='python',
                dtype=str,
                keep_default_na=False,
            )
            if not df.empty and len(df.columns) > 1:
                logger.info(f"Successfully parsed with auto-detected separator")
                return df
        except Exception as e:
            errors.append(f"Auto-detect: {str(e)}")
            logger.debug(f"Auto-detect parsing failed: {e}")
        
        # Strategy 5: Last resort - try without any encoding specification
        try:
            df = pd.read_csv(
                io.BytesIO(content),
                dtype=str,
                keep_default_na=False,
                on_bad_lines='skip',
                engine='python',
            )
            if not df.empty and len(df.columns) > 1:
                logger.info(f"Successfully parsed with default settings")
                return df
        except Exception as e:
            errors.append(f"Default: {str(e)}")
            logger.debug(f"Default parsing failed: {e}")
        
        # All strategies failed
        error_details = "\n".join([f"  - {err}" for err in errors[:10]]) if errors else "No detailed error information"
        
        raise ValueError(
            f"无法解析CSV/TSV文件\n\n"
            f"可能的原因：\n"
            f"1. 文件格式不是标准的CSV或TSV\n"
            f"2. 文件中包含特殊字符或空行\n"
            f"3. 某些行的列数不一致\n"
            f"4. 文件编码不支持\n\n"
            f"建议：\n"
            f"• 确保文件使用制表符(TAB)或逗号分隔\n"
            f"• 检查文件是否可以从券商系统正常导出\n"
            f"• 尝试用Excel打开后另存为CSV格式\n\n"
            f"技术详情：\n{error_details}"
        )

    def _normalize_trade_row_with_reason(
        self,
        *,
        row: Any,
        parser_spec: CsvParserSpec,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Normalize a trade row and return skip reason if failed.
        
        Returns:
            Tuple of (normalized_record, skip_reason)
            If successful: (record_dict, None)
            If failed: (None, reason_string)
        """
        broker_hints = parser_spec.column_hints

        # Check trade date
        trade_date_raw = self._pick(
            row,
            *(broker_hints.get("trade_date") or ()),
            "成交日期",
            "发生日期",
            "日期",
            "成交时间",
        )
        if trade_date_raw is None:
            return None, "missing_trade_date_column"
        
        trade_date_obj = self._parse_date(trade_date_raw)
        if trade_date_obj is None:
            return None, f"invalid_trade_date: {trade_date_raw}"

        # Check symbol
        symbol_raw = self._pick(
            row,
            *(broker_hints.get("symbol") or ()),
            "证券代码",
            "股票代码",
            "代码",
        )
        if symbol_raw is None:
            return None, "missing_symbol_column"
        
        symbol = canonical_stock_code(str(symbol_raw or "").strip())
        if not symbol:
            return None, f"invalid_symbol: {symbol_raw}"

        # Check side
        side_raw = self._pick(
            row,
            *(broker_hints.get("side") or ()),
            "买卖标志",
            "买卖方向",
            "交易方向",
            "业务名称",
            "操作",
        )
        if side_raw is None:
            return None, "missing_side_column"
        
        side = self._normalize_side(side_raw)
        if side is None:
            return None, f"invalid_side: {side_raw}"

        # Check quantity
        quantity_raw = self._pick(row, *(broker_hints.get("quantity") or ()), "成交数量", "数量", "成交股数")
        if quantity_raw is None:
            return None, "missing_quantity_column"
        
        quantity = self._parse_float(quantity_raw)
        if quantity is None:
            return None, f"invalid_quantity: {quantity_raw}"
        
        # Handle negative quantity: brokers use negative for sell orders
        # Convert to positive and adjust side if needed
        if quantity < 0:
            quantity = abs(quantity)
            # If side is already determined, keep it; negative quantity just means sell
            # The side was already normalized from text like "卖出"
        
        if quantity <= 0:
            return None, f"invalid_quantity: {quantity_raw}"

        # Check price
        price_raw = self._pick(row, *(broker_hints.get("price") or ()), "成交均价", "成交价格", "价格", "成交价", "均价")
        if price_raw is None:
            return None, "missing_price_column"
        
        price = self._parse_float(price_raw)
        if price is None or price <= 0:
            return None, f"invalid_price: {price_raw}"

        # Parse optional fields
        fee = 0.0
        for col in ("手续费", "佣金", "交易费", "规费", "过户费"):
            value = self._parse_float(self._pick(row, col))
            if value is not None:
                fee += value

        tax = 0.0
        for col in ("印花税", "税费", "其他税费"):
            value = self._parse_float(self._pick(row, col))
            if value is not None:
                tax += value

        trade_uid = self._pick(
            row,
            *(broker_hints.get("trade_uid") or ()),
            "成交编号",
            "成交序号",
            "合同编号",
            "委托编号",
            "流水号",
        )
        currency = self._pick(row, "币种", "货币")

        return {
            "trade_date": trade_date_obj,
            "symbol": symbol,
            "side": side,
            "quantity": float(quantity),
            "price": float(price),
            "fee": float(fee),
            "tax": float(tax),
            "trade_uid": (str(trade_uid).strip() if trade_uid is not None else None) or None,
            "currency": (str(currency).strip().upper() if currency is not None else None) or None,
        }, None

    def _normalize_trade_row(
        self,
        *,
        row: Any,
        parser_spec: CsvParserSpec,
    ) -> Optional[Dict[str, Any]]:
        broker_hints = parser_spec.column_hints

        trade_date_raw = self._pick(
            row,
            *(broker_hints.get("trade_date") or ()),
            "成交日期",
            "发生日期",
            "日期",
            "成交时间",
        )
        trade_date_obj = self._parse_date(trade_date_raw)
        if trade_date_obj is None:
            return None

        symbol_raw = self._pick(
            row,
            *(broker_hints.get("symbol") or ()),
            "证券代码",
            "股票代码",
            "代码",
        )
        symbol = canonical_stock_code(str(symbol_raw or "").strip())
        if not symbol:
            return None

        side_raw = self._pick(
            row,
            *(broker_hints.get("side") or ()),
            "买卖标志",
            "买卖方向",
            "交易方向",
            "业务名称",
            "操作",
        )
        side = self._normalize_side(side_raw)
        if side is None:
            return None

        quantity = self._parse_float(
            self._pick(row, *(broker_hints.get("quantity") or ()), "成交数量", "数量", "成交股数")
        )
        price = self._parse_float(
            self._pick(row, *(broker_hints.get("price") or ()), "成交均价", "成交价格", "价格", "成交价", "均价")
        )
        if quantity is None or quantity <= 0 or price is None or price <= 0:
            return None

        fee = 0.0
        for col in ("手续费", "佣金", "交易费", "规费", "过户费"):
            value = self._parse_float(self._pick(row, col))
            if value is not None:
                fee += value

        tax = 0.0
        for col in ("印花税", "税费", "其他税费"):
            value = self._parse_float(self._pick(row, col))
            if value is not None:
                tax += value

        trade_uid = self._pick(
            row,
            *(broker_hints.get("trade_uid") or ()),
            "成交编号",
            "成交序号",
            "合同编号",
            "委托编号",
            "流水号",
        )
        currency = self._pick(row, "币种", "货币")

        return {
            "trade_date": trade_date_obj,
            "symbol": symbol,
            "side": side,
            "quantity": float(quantity),
            "price": float(price),
            "fee": float(fee),
            "tax": float(tax),
            "trade_uid": (str(trade_uid).strip() if trade_uid is not None else None) or None,
            "currency": (str(currency).strip().upper() if currency is not None else None) or None,
        }

    @staticmethod
    def _pick(row: Any, *candidates: str) -> Any:
        for name in candidates:
            if name in row.index:
                value = row.get(name)
                if value is not None and str(value).strip() != "" and str(value).strip().lower() != "nan":
                    return value
        return None

    @staticmethod
    def _parse_float(value: Any) -> Optional[float]:
        if value is None:
            return None
        text = str(value).strip().replace(",", "")
        if not text or text.lower() == "nan":
            return None
        try:
            return float(text)
        except ValueError:
            return None

    @staticmethod
    def _parse_date(value: Any) -> Optional[date]:
        if value is None:
            return None
        text = str(value).strip()
        if not text or text.lower() == "nan":
            return None
        parsed = pd.to_datetime(text, errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.date()

    @staticmethod
    def _normalize_side(value: Any) -> Optional[str]:
        text = str(value or "").strip().lower()
        if not text:
            return None
        compact = text.replace(" ", "")
        buy_exact = {"buy", "b", "买", "买入", "证券买入", "普通买入"}
        sell_exact = {"sell", "s", "卖", "卖出", "证券卖出", "普通卖出"}
        if compact in buy_exact:
            return "buy"
        if compact in sell_exact:
            return "sell"
        if "买入" in compact or compact.startswith("买"):
            return "buy"
        if "卖出" in compact or compact.startswith("卖"):
            return "sell"
        return None

    @staticmethod
    def _build_dedup_hash(record: Dict[str, Any]) -> str:
        payload = "|".join(
            [
                str(record.get("trade_date") or ""),
                str(record.get("symbol") or ""),
                str(record.get("side") or ""),
                f"{float(record.get('quantity', 0.0)):.8f}",
                f"{float(record.get('price', 0.0)):.8f}",
                f"{float(record.get('fee', 0.0)):.8f}",
                f"{float(record.get('tax', 0.0)):.8f}",
                str(record.get("currency") or ""),
                str(record.get("_source_line_number") or record.get("source_line_number") or ""),
            ]
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
