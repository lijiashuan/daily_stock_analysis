# -*- coding: utf-8 -*-
"""
股票价格监控服务

职责：
1. 定时查询股票实时价格
2. 判断是否达到预警价
3. 自动推送到飞书
4. 防重复推送（每个预警只推送一次）
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

from src.config import Config, get_config
from src.notification_sender.feishu_sender import FeishuSender

logger = logging.getLogger(__name__)


@dataclass
class WatchRule:
    """价格预警规则"""
    stock_code: str
    stock_name: str
    watch_price: float
    operation: str = "关注"
    note: str = ""
    triggered: bool = False  # 是否已触发
    triggered_at: Optional[datetime] = None
    pushed: bool = False  # 是否已推送


@dataclass
class MonitorState:
    """监控器状态"""
    enabled: bool = False
    rules: Dict[str, WatchRule] = field(default_factory=dict)
    last_check_time: Optional[datetime] = None
    check_count: int = 0
    trigger_count: int = 0
    push_success_count: int = 0
    push_fail_count: int = 0


class PriceMonitor:
    """股票价格监控器"""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or get_config()
        self.state = MonitorState()
        self.feishu_sender = FeishuSender(self.config)
        self._lock = False  # 防止并发执行

    def enable(self) -> None:
        """启用监控"""
        self.state.enabled = True
        logger.info("[PriceMonitor] 监控已启用")

    def disable(self) -> None:
        """禁用监控"""
        self.state.enabled = False
        logger.info("[PriceMonitor] 监控已禁用")

    def is_enabled(self) -> bool:
        """是否已启用"""
        return self.state.enabled

    def add_rule(self, rule: WatchRule) -> None:
        """添加预警规则"""
        self.state.rules[rule.stock_code] = rule
        logger.info(f"[PriceMonitor] 添加预警规则: {rule.stock_name}({rule.stock_code}) @ {rule.watch_price}")

    def add_rules(self, rules: List[WatchRule]) -> None:
        """批量添加预警规则"""
        for rule in rules:
            self.add_rule(rule)

    def remove_rule(self, stock_code: str) -> bool:
        """移除预警规则"""
        if stock_code in self.state.rules:
            del self.state.rules[stock_code]
            logger.info(f"[PriceMonitor] 移除预警规则: {stock_code}")
            return True
        return False

    def clear_rules(self) -> None:
        """清空所有规则"""
        self.state.rules.clear()
        logger.info("[PriceMonitor] 已清空所有预警规则")

    def reset_rule_status(self, stock_code: str) -> None:
        """重置某只股票的触发状态（允许再次推送）"""
        if stock_code in self.state.rules:
            rule = self.state.rules[stock_code]
            rule.triggered = False
            rule.pushed = False
            rule.triggered_at = None
            logger.info(f"[PriceMonitor] 重置规则状态: {stock_code}")

    def get_status(self) -> Dict:
        """获取监控状态"""
        return {
            "enabled": self.state.enabled,
            "rule_count": len(self.state.rules),
            "rules": [
                {
                    "stock_code": r.stock_code,
                    "stock_name": r.stock_name,
                    "watch_price": r.watch_price,
                    "operation": r.operation,
                    "triggered": r.triggered,
                    "pushed": r.pushed,
                    "triggered_at": r.triggered_at.isoformat() if r.triggered_at else None,
                }
                for r in self.state.rules.values()
            ],
            "last_check_time": self.state.last_check_time.isoformat() if self.state.last_check_time else None,
            "check_count": self.state.check_count,
            "trigger_count": self.state.trigger_count,
            "push_success_count": self.state.push_success_count,
            "push_fail_count": self.state.push_fail_count,
        }

    def check_once(self) -> List[WatchRule]:
        """
        执行一次价格检查
        
        Returns:
            触发的预警规则列表
        """
        if not self.state.enabled:
            logger.debug("[PriceMonitor] 监控未启用，跳过检查")
            return []

        if self._lock:
            logger.warning("[PriceMonitor] 上次检查仍在执行，跳过本次")
            return []

        self._lock = True
        triggered_rules = []

        try:
            self.state.check_count += 1
            self.state.last_check_time = datetime.now()

            logger.info(f"[PriceMonitor] 开始检查 {len(self.state.rules)} 只股票...")

            from data_provider.base import DataFetcherManager
            manager = DataFetcherManager()

            for stock_code, rule in list(self.state.rules.items()):
                # 已推送的跳过
                if rule.pushed:
                    continue

                try:
                    quote = manager.get_realtime_quote(stock_code, log_final_failure=False)
                    if quote is None or quote.price is None:
                        logger.debug(f"[PriceMonitor] {stock_code} 无法获取实时价格")
                        continue

                    current_price = float(quote.price)
                    
                    # 判断是否达到预警价
                    # 对于卖出操作：当前价 >= 预警价
                    # 对于买入操作：当前价 <= 预警价
                    is_triggered = False
                    if "卖出" in rule.operation or rule.operation == "sell":
                        is_triggered = current_price >= rule.watch_price
                    elif "买入" in rule.operation or rule.operation == "buy":
                        is_triggered = current_price <= rule.watch_price
                    else:
                        # 默认：价格波动超过 1%
                        if rule.watch_price > 0:
                            change_pct = abs(current_price - rule.watch_price) / rule.watch_price * 100
                            is_triggered = change_pct >= 1.0

                    if is_triggered:
                        rule.triggered = True
                        rule.triggered_at = datetime.now()
                        triggered_rules.append(rule)
                        self.state.trigger_count += 1
                        
                        logger.info(
                            f"[PriceMonitor] 触发预警: {rule.stock_name}({stock_code}) "
                            f"当前价={current_price}, 预警价={rule.watch_price}"
                        )

                        # 自动推送到飞书
                        self._push_alert(rule, current_price)

                except Exception as e:
                    logger.error(f"[PriceMonitor] 检查 {stock_code} 失败: {e}")

            logger.info(
                f"[PriceMonitor] 检查完成: 触发 {len(triggered_rules)} 条预警"
            )

        finally:
            self._lock = False

        return triggered_rules

    def _push_alert(self, rule: WatchRule, current_price: float) -> None:
        """推送预警消息到飞书"""
        operation_type = "卖出" if "卖出" in rule.operation else "买入" if "买入" in rule.operation else "关注"
        
        alert_message = (
            f"🔔 价格预警 | {rule.stock_name}\n\n"
            f"股票：{rule.stock_name}（{rule.stock_code}）\n"
            f"当前价：¥{current_price:.2f}\n"
            f"预警价：¥{rule.watch_price:.2f}\n"
            f"建议操作：{operation_type}\n"
            f"说明：{rule.note}\n\n"
            f"—— 自动监盘系统"
        )

        try:
            success = self.feishu_sender.send_to_feishu(alert_message)
            if success:
                rule.pushed = True
                self.state.push_success_count += 1
                logger.info(f"[PriceMonitor] 预警推送成功: {rule.stock_name}")
            else:
                self.state.push_fail_count += 1
                logger.error(f"[PriceMonitor] 预警推送失败: {rule.stock_name}")
        except Exception as e:
            self.state.push_fail_count += 1
            logger.error(f"[PriceMonitor] 预警推送异常: {rule.stock_name}, {e}")

    def load_from_dashboard(self, watch_prices: Dict) -> None:
        """
        从操作指令看板的预警数据加载规则
        
        Args:
            watch_prices: 格式如 { "002544": { "name": "普天科技", "operation": "卖出500股", "watch_price": 25.80, "note": "..." } }
        """
        self.clear_rules()
        
        for stock_code, item in watch_prices.items():
            rule = WatchRule(
                stock_code=stock_code,
                stock_name=item.get("name", stock_code),
                watch_price=item.get("watch_price", 0),
                operation=item.get("operation", "关注"),
                note=item.get("note", ""),
            )
            self.add_rule(rule)
        
        logger.info(f"[PriceMonitor] 从看板加载 {len(watch_prices)} 条预警规则")


# 全局单例
_global_monitor: Optional[PriceMonitor] = None


def get_price_monitor() -> PriceMonitor:
    """获取全局监控器实例"""
    global _global_monitor
    if _global_monitor is None:
        _global_monitor = PriceMonitor()
    return _global_monitor


def run_price_monitor_once() -> List[WatchRule]:
    """执行一次价格监控检查（供后台任务调用）"""
    monitor = get_price_monitor()
    return monitor.check_once()
