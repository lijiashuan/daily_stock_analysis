# -*- coding: utf-8 -*-
"""
数据库增量同步模块

职责：
1. 本地与云端备份的增量比较与合并
2. 基于唯一标识集合做差集合并
3. 冲突检测与报告
4. 多账户安全隔离
"""

from __future__ import annotations

import json
import logging
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from src.storage_backup import (
    _BACKUP_FILE_PREFIX,
    _BACKUP_FILE_SUFFIX,
    _cleanup_old_backups,
    _compute_file_sha256,
    perform_startup_backup,
)

logger = logging.getLogger(__name__)

SyncTable = str
SyncKey = Tuple[str, ...]
SyncRow = Dict[str, Any]

_TABLES_TO_SYNC = [
    "portfolio_accounts",
    "portfolio_trades",
    "portfolio_cash_ledger",
    "portfolio_corporate_actions",
    "portfolio_stock_notes",
]

_TABLE_ID_KEYS: Dict[str, List[str]] = {
    "portfolio_accounts": ["id"],
    "portfolio_trades": ["account_id", "trade_uid", "dedup_hash"],
    "portfolio_cash_ledger": ["account_id", "dedup_hash"],
    "portfolio_corporate_actions": ["account_id", "effective_date", "action_type", "symbol"],
    "portfolio_stock_notes": ["account_id", "symbol"],
}

_TABLE_IMPORT_COLUMNS: Dict[str, List[str]] = {
    "portfolio_accounts": [
        "id", "owner_id", "name", "broker", "market", "base_currency",
        "account_type", "is_active", "created_at", "updated_at",
    ],
    "portfolio_trades": [
        "id", "account_id", "symbol", "market", "trade_date", "side",
        "quantity", "price", "fee", "tax", "currency", "trade_uid",
        "dedup_hash", "note", "created_at", "updated_at",
    ],
    "portfolio_cash_ledger": [
        "id", "account_id", "event_date", "direction", "amount",
        "currency", "dedup_hash", "note", "created_at", "updated_at",
    ],
    "portfolio_corporate_actions": [
        "id", "account_id", "symbol", "action_type", "effective_date",
        "ratio", "amount_per_share", "currency", "note", "created_at", "updated_at",
    ],
    "portfolio_stock_notes": [
        "id", "account_id", "symbol", "cost_method", "content", "updated_at",
    ],
}


def _open_db_readonly(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _open_db_rw(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def _extract_table_rows(conn: sqlite3.Connection, table: str) -> List[SyncRow]:
    id_keys = _TABLE_ID_KEYS.get(table, ["id"])
    cols = _TABLE_IMPORT_COLUMNS.get(table, ["*"])
    col_str = ", ".join(cols)
    try:
        rows = conn.execute(f"SELECT {col_str} FROM {table}").fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError as exc:
        logger.debug("读取表 %s 失败: %s", table, exc)
        return []


def _build_key(row: SyncRow, id_keys: List[str]) -> SyncKey:
    return tuple(str(row.get(k, "")) for k in id_keys)


def _rows_equal(a: SyncRow, b: SyncRow, id_keys: List[str]) -> bool:
    if set(a.keys()) != set(b.keys()):
        return False
    for k in a:
        if k in id_keys:
            continue
        if str(a.get(k)) != str(b.get(k)):
            return False
    return True


def _get_latest_cloud_backup(cloud_dir: Path) -> Optional[Path]:
    if not cloud_dir.exists():
        return None
    backups = sorted(
        [f for f in cloud_dir.iterdir()
         if f.is_file() and f.name.startswith(_BACKUP_FILE_PREFIX) and f.name.endswith(_BACKUP_FILE_SUFFIX)],
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    return backups[0] if backups else None


def analyze_sync_diff(
    local_db_path: str,
    cloud_backup_dir: Path,
) -> Dict[str, Any]:
    """
    分析本地与云端数据库的差异。

    返回：
    {
        "cloud_backup_found": bool,
        "cloud_backup_path": str | None,
        "local_only": {table: [row, ...]},
        "cloud_only": {table: [row, ...]},
        "conflicts": {table: [{"local": row, "cloud": row}, ...]},
        "summary": {
            "local_only_count": int,
            "cloud_only_count": int,
            "conflict_count": int,
        },
    }
    """
    local_file = Path(local_db_path)
    if not local_file.exists():
        return {"error": "本地数据库不存在", "cloud_backup_found": False}

    latest_cloud = _get_latest_cloud_backup(cloud_backup_dir)
    if latest_cloud is None:
        return {
            "cloud_backup_found": False,
            "cloud_backup_path": None,
            "local_only": {},
            "cloud_only": {},
            "conflicts": {},
            "summary": {
                "local_only_count": 0,
                "cloud_only_count": 0,
                "conflict_count": 0,
            },
        }

    local_conn = _open_db_readonly(local_file)
    cloud_conn = _open_db_readonly(latest_cloud)

    local_only: Dict[str, list] = {}
    cloud_only: Dict[str, list] = {}
    conflicts: Dict[str, list] = {}

    total_local_only = 0
    total_cloud_only = 0
    total_conflicts = 0

    try:
        for table in _TABLES_TO_SYNC:
            id_keys = _TABLE_ID_KEYS.get(table, ["id"])
            local_rows = _extract_table_rows(local_conn, table)
            cloud_rows = _extract_table_rows(cloud_conn, table)

            local_map: Dict[SyncKey, SyncRow] = {_build_key(r, id_keys): r for r in local_rows}
            cloud_map: Dict[SyncKey, SyncRow] = {_build_key(r, id_keys): r for r in cloud_rows}

            local_keys = set(local_map.keys())
            cloud_keys = set(cloud_map.keys())

            table_local_only = []
            for key in local_keys - cloud_keys:
                table_local_only.append(local_map[key])
            if table_local_only:
                local_only[table] = table_local_only
                total_local_only += len(table_local_only)

            table_cloud_only = []
            for key in cloud_keys - local_keys:
                table_cloud_only.append(cloud_map[key])
            if table_cloud_only:
                cloud_only[table] = table_cloud_only
                total_cloud_only += len(table_cloud_only)

            table_conflicts = []
            for key in local_keys & cloud_keys:
                if not _rows_equal(local_map[key], cloud_map[key], id_keys):
                    table_conflicts.append({
                        "key": list(key),
                        "local": local_map[key],
                        "cloud": cloud_map[key],
                    })
            if table_conflicts:
                conflicts[table] = table_conflicts
                total_conflicts += len(table_conflicts)

    finally:
        local_conn.close()
        cloud_conn.close()

    return {
        "cloud_backup_found": True,
        "cloud_backup_path": str(latest_cloud),
        "local_only": local_only,
        "cloud_only": cloud_only,
        "conflicts": conflicts,
        "summary": {
            "local_only_count": total_local_only,
            "cloud_only_count": total_cloud_only,
            "conflict_count": total_conflicts,
        },
    }


def merge_cloud_to_local(
    local_db_path: str,
    cloud_backup_dir: Path,
    diff: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    将云端独有的数据合并到本地数据库。

    返回合并结果。
    """
    if diff is None:
        diff = analyze_sync_diff(local_db_path, cloud_backup_dir)

    if not diff.get("cloud_backup_found"):
        return {"merged": False, "reason": "未找到云端备份", "imported": 0}

    cloud_only = diff.get("cloud_only", {})
    if not cloud_only:
        return {"merged": True, "reason": "没有需要合并的数据", "imported": 0}

    local_file = Path(local_db_path)
    conn = _open_db_rw(local_file)
    total_imported = 0

    try:
        for table, rows in cloud_only.items():
            if not rows:
                continue
            cols = _TABLE_IMPORT_COLUMNS.get(table, [])
            if not cols:
                continue

            placeholders = ", ".join(["?" for _ in cols])
            col_str = ", ".join(cols)

            imported = 0
            for row in rows:
                try:
                    values = [row.get(c) for c in cols]
                    conn.execute(
                        f"INSERT OR IGNORE INTO {table} ({col_str}) VALUES ({placeholders})",
                        values,
                    )
                    imported += 1
                except Exception as exc:
                    logger.warning("导入 %s 行失败: %s -> %s", table, row, exc)

            if imported > 0:
                conn.commit()
                total_imported += imported
                logger.info("从云端导入 %s: %d 条记录", table, imported)

    except Exception as exc:
        conn.rollback()
        logger.error("云端合并失败: %s", exc)
        return {"merged": False, "reason": str(exc), "imported": total_imported}
    finally:
        conn.close()

    return {"merged": True, "reason": "合并完成", "imported": total_imported}


def sync_local_to_cloud(
    local_db_path: str,
    cloud_backup_dir: Path,
    cloud_keep_days: int = 30,
) -> Optional[str]:
    """
    将本地数据库同步到云端备份目录。

    返回云端备份文件路径。
    """
    local_file = Path(local_db_path)
    if not local_file.exists():
        logger.warning("本地数据库不存在，无法同步到云端: %s", local_db_path)
        return None

    cloud_backup_dir.mkdir(parents=True, exist_ok=True)

    current_hash = _compute_file_sha256(local_file)
    latest_cloud = _get_latest_cloud_backup(cloud_backup_dir)

    if latest_cloud is not None:
        cloud_hash = _compute_file_sha256(latest_cloud)
        if cloud_hash == current_hash:
            logger.debug("云端备份已是最新，跳过同步")
            return str(latest_cloud)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"{_BACKUP_FILE_PREFIX}{timestamp}{_BACKUP_FILE_SUFFIX}"
    cloud_dest = cloud_backup_dir / backup_filename

    try:
        shutil.copy2(local_file, cloud_dest)
        logger.info("云端同步完成: %s", cloud_dest)

        _cleanup_old_backups(cloud_backup_dir, cloud_keep_days)

        return str(cloud_dest)
    except Exception as exc:
        logger.error("云端同步失败: %s", exc)
        return None


def perform_full_sync(
    local_db_path: str,
    cloud_backup_dir: Path,
    local_keep_days: int = 7,
    cloud_keep_days: int = 30,
) -> Dict[str, Any]:
    """
    执行完整的双向同步流程。

    1. 分析差异
    2. 合并云端数据到本地
    3. 同步本地到云端
    """
    result: Dict[str, Any] = {
        "sync_time": datetime.now().isoformat(),
        "cloud_backup_found": False,
        "diff": {},
        "merge": {},
        "cloud_upload": None,
        "conflicts_exist": False,
        "conflict_count": 0,
    }

    diff = analyze_sync_diff(local_db_path, cloud_backup_dir)
    result["diff"] = diff
    result["cloud_backup_found"] = diff.get("cloud_backup_found", False)
    result["conflict_count"] = diff.get("summary", {}).get("conflict_count", 0)
    result["conflicts_exist"] = result["conflict_count"] > 0

    if diff.get("cloud_backup_found") and diff.get("cloud_only"):
        merge_result = merge_cloud_to_local(local_db_path, cloud_backup_dir, diff)
        result["merge"] = merge_result

    if not diff.get("conflicts"):
        cloud_path = sync_local_to_cloud(local_db_path, cloud_backup_dir, cloud_keep_days)
        result["cloud_upload"] = cloud_path

    return result