# -*- coding: utf-8 -*-
"""
数据库备份与恢复模块

职责：
1. 启动时完整性校验（PRAGMA integrity_check）
2. 自动备份到本地目录
3. 云端备份同步（坚果云）
4. 定期 WAL checkpoint
5. 备份文件过期清理
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from src.config import get_config

logger = logging.getLogger(__name__)

_BACKUP_META_FILENAME = "backup_meta.json"
_BACKUP_FILE_PREFIX = "stock_analysis_"
_BACKUP_FILE_SUFFIX = ".db"


def _compute_file_sha256(file_path: Path) -> str:
    chunk_size = 64 * 1024
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            sha.update(chunk)
    return sha.hexdigest()


def _load_backup_meta(backup_dir: Path) -> Dict[str, Any]:
    meta_path = backup_dir / _BACKUP_META_FILENAME
    if not meta_path.exists():
        return {}
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("读取备份元数据失败: %s", exc)
        return {}


def _save_backup_meta(backup_dir: Path, meta: Dict[str, Any]) -> None:
    backup_dir.mkdir(parents=True, exist_ok=True)
    meta_path = backup_dir / _BACKUP_META_FILENAME
    try:
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning("保存备份元数据失败: %s", exc)


def _cleanup_old_backups(backup_dir: Path, keep_days: int) -> int:
    cutoff = datetime.now() - timedelta(days=keep_days)
    removed = 0
    if not backup_dir.exists():
        return removed
    for entry in backup_dir.iterdir():
        if not entry.is_file():
            continue
        if not entry.name.startswith(_BACKUP_FILE_PREFIX):
            continue
        if not entry.name.endswith(_BACKUP_FILE_SUFFIX):
            continue
        try:
            mtime = datetime.fromtimestamp(entry.stat().st_mtime)
            if mtime < cutoff:
                entry.unlink()
                removed += 1
                logger.debug("清理过期备份: %s", entry.name)
        except Exception as exc:
            logger.warning("清理备份文件 %s 失败: %s", entry.name, exc)
    return removed


def check_database_integrity(db_path: str) -> Tuple[bool, str]:
    """
    检查数据库完整性。

    返回 (是否正常, 错误信息)
    """
    import sqlite3

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("PRAGMA integrity_check")
        result = cursor.fetchone()[0]
        conn.close()
        if result == "ok":
            logger.info("数据库完整性检查通过: %s", db_path)
            return True, ""
        else:
            logger.error("数据库完整性检查失败: %s -> %s", db_path, result)
            return False, str(result)
    except Exception as exc:
        logger.error("数据库完整性检查异常: %s -> %s", db_path, exc)
        return False, str(exc)


def attempt_restore_from_backup(db_path: str, backup_dir: Path) -> bool:
    """
    尝试从最近备份恢复数据库。

    返回是否成功恢复。
    """
    if not backup_dir.exists():
        logger.warning("备份目录不存在，无法恢复: %s", backup_dir)
        return False

    backups = sorted(
        [f for f in backup_dir.iterdir()
         if f.is_file() and f.name.startswith(_BACKUP_FILE_PREFIX) and f.name.endswith(_BACKUP_FILE_SUFFIX)],
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    if not backups:
        logger.warning("备份目录中没有可用备份: %s", backup_dir)
        return False

    latest = backups[0]
    logger.warning("正在从备份恢复数据库: %s -> %s", latest, db_path)

    try:
        db_file = Path(db_path)
        damaged_path = db_file.with_suffix(db_file.suffix + ".damaged." + datetime.now().strftime("%Y%m%d_%H%M%S"))
        shutil.copy2(db_path, damaged_path)
        logger.info("已保留损坏的数据库副本: %s", damaged_path)

        shutil.copy2(str(latest), db_path)
        logger.info("数据库已从备份恢复: %s", latest.name)
        return True
    except Exception as exc:
        logger.error("从备份恢复失败: %s", exc)
        return False


def perform_startup_backup(db_path: str, local_backup_dir: Path, cloud_backup_dir: Optional[Path] = None) -> Optional[str]:
    """
    执行启动时备份。

    如果数据库内容与上次备份相同则跳过。
    返回备份文件路径，如果跳过则返回 None。
    """
    db_file = Path(db_path)
    if not db_file.exists():
        logger.warning("数据库文件不存在，跳过备份: %s", db_path)
        return None

    local_backup_dir.mkdir(parents=True, exist_ok=True)

    current_hash = _compute_file_sha256(db_file)
    meta = _load_backup_meta(local_backup_dir)
    last_hash = meta.get("last_backup_sha256", "")

    if current_hash == last_hash and meta.get("last_backup_path"):
        last_path = Path(meta["last_backup_path"])
        if last_path.exists():
            logger.debug("数据库内容未变化，跳过备份: %s", db_path)
            return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"{_BACKUP_FILE_PREFIX}{timestamp}{_BACKUP_FILE_SUFFIX}"
    backup_path = local_backup_dir / backup_filename

    try:
        shutil.copy2(db_path, backup_path)
        meta["last_backup_sha256"] = current_hash
        meta["last_backup_path"] = str(backup_path)
        meta["last_backup_time"] = timestamp
        _save_backup_meta(local_backup_dir, meta)
        logger.info("本地备份完成: %s", backup_path)

        if cloud_backup_dir and cloud_backup_dir.exists():
            try:
                cloud_backup_dir.mkdir(parents=True, exist_ok=True)
                cloud_dest = cloud_backup_dir / backup_filename
                shutil.copy2(backup_path, cloud_dest)
                logger.info("云端备份完成: %s", cloud_dest)
            except Exception as exc:
                logger.warning("云端备份失败: %s", exc)

        return str(backup_path)
    except Exception as exc:
        logger.error("备份失败: %s", exc)
        return None


def perform_startup_backup_with_cleanup(
    db_path: str,
    local_backup_dir: Path,
    local_keep_days: int,
    cloud_backup_dir: Optional[Path] = None,
    cloud_keep_days: int = 30,
) -> Optional[str]:
    result = perform_startup_backup(db_path, local_backup_dir, cloud_backup_dir)

    local_removed = _cleanup_old_backups(local_backup_dir, local_keep_days)
    if local_removed > 0:
        logger.info("清理 %d 个过期本地备份", local_removed)

    if cloud_backup_dir and cloud_backup_dir.exists():
        cloud_removed = _cleanup_old_backups(cloud_backup_dir, cloud_keep_days)
        if cloud_removed > 0:
            logger.info("清理 %d 个过期云端备份", cloud_removed)

    return result


def get_backup_status(local_backup_dir: Path, cloud_backup_dir: Optional[Path] = None) -> Dict[str, Any]:
    meta = _load_backup_meta(local_backup_dir)
    status: Dict[str, Any] = {
        "last_local_backup": meta.get("last_backup_time"),
        "last_local_backup_path": meta.get("last_backup_path"),
        "local_backup_count": 0,
        "cloud_backup_count": 0,
        "cloud_enabled": cloud_backup_dir is not None and str(cloud_backup_dir) != "",
    }

    if local_backup_dir.exists():
        status["local_backup_count"] = sum(
            1 for f in local_backup_dir.iterdir()
            if f.is_file() and f.name.startswith(_BACKUP_FILE_PREFIX) and f.name.endswith(_BACKUP_FILE_SUFFIX)
        )

    if cloud_backup_dir and cloud_backup_dir.exists():
        status["cloud_backup_count"] = sum(
            1 for f in cloud_backup_dir.iterdir()
            if f.is_file() and f.name.startswith(_BACKUP_FILE_PREFIX) and f.name.endswith(_BACKUP_FILE_SUFFIX)
        )

    return status