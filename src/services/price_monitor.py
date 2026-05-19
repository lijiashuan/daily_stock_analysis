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
    """价格预警规则（支持 v1.0 和 v2.0）"""
    stock_code: str
    stock_name: str
    watch_price: float = 0.0  # v1.0 预警价
    operation: str = "关注"  # v1.0 操作说明
    note: str = ""
    triggered: bool = False  # 是否已触发
    triggered_at: Optional[datetime] = None
    pushed: bool = False  # 是否已推送
    
    # v2.0 新字段
    rule_id: Optional[str] = None  # 规则 ID（如 W001）
    direction: Optional[str] = None  # buy/sell/none
    quantity: int = 0
    trigger_type: Optional[str] = None  # price_drop_to, price_rise_to, volume_surge_and_price_break, price_alert
    trigger_params: Dict = field(default_factory=dict)  # 触发参数
    condition_reject: Optional[Dict] = None  # 拒绝条件
    condition_cancel: Optional[Dict] = None  # 撤销条件
    execution_mode: Optional[str] = None  # auto_limit, auto_market, notify_only
    execution_params: Dict = field(default_factory=dict)  # 执行参数
    priority: int = 3
    validity: str = "until_canceled"  # today / until_canceled


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
                    is_triggered = False
                    
                    # v2.0 结构化触发条件
                    if rule.trigger_type:
                        is_triggered = self._check_v2_trigger(rule, current_price, quote)
                    # v1.0 关键词匹配触发
                    else:
                        is_triggered = self._check_v1_trigger(rule, current_price)

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

    def _check_v1_trigger(self, rule: WatchRule, current_price: float) -> bool:
        """v1.0 关键词匹配触发逻辑"""
        # 卖出/减仓操作：当前价 >= 预警价（涨到目标价卖出）
        if "卖出" in rule.operation or "减仓" in rule.operation or rule.operation == "sell":
            return current_price >= rule.watch_price
        # 买入/补仓操作：当前价 <= 预警价（跌到目标价买入）
        elif "买入" in rule.operation or "补仓" in rule.operation or rule.operation == "buy":
            return current_price <= rule.watch_price
        # 跌破止损操作：当前价 <= 预警价（跌破支撑位）
        elif "跌破" in rule.operation or "止损" in rule.operation:
            return current_price <= rule.watch_price
        # 反弹到某个价格：当前价 >= 预警价
        elif "反弹" in rule.operation or "关注" in rule.operation:
            return current_price >= rule.watch_price
        else:
            # 如果没有明确的操作关键词，默认不触发（避免误触发）
            logger.debug(
                f"[PriceMonitor] {rule.stock_code} 预警规则缺少操作关键词，跳过: {rule.operation}"
            )
            return False

    def _check_v2_trigger(self, rule: WatchRule, current_price: float, quote) -> bool:
        """v2.0 结构化触发条件判断"""
        trigger_type = rule.trigger_type
        trigger_params = rule.trigger_params
        
        # 先检查拒绝条件
        if rule.condition_reject:
            reject_triggered = self._check_reject_condition(rule.condition_reject, quote)
            if reject_triggered:
                logger.debug(f"[PriceMonitor] {rule.stock_code} 触发拒绝条件，跳过检查")
                return False
        
        # 根据不同的触发类型判断
        if trigger_type == "price_drop_to":
            # 价格跌至目标价
            target = trigger_params.get("target", rule.watch_price)
            return current_price <= target
            
        elif trigger_type == "price_rise_to":
            # 价格上涨至目标价
            target = trigger_params.get("target", rule.watch_price)
            return current_price >= target
            
        elif trigger_type == "price_alert":
            # 价格提醒（只通知，不执行）
            target = trigger_params.get("target", rule.watch_price)
            return current_price >= target or current_price <= target
            
        elif trigger_type == "volume_surge_and_price_break":
            # 放量突破（需要量比和价格同时满足）
            volume_ratio_threshold = trigger_params.get("volume_ratio_threshold", 1.5)
            price_above = trigger_params.get("price_above", rule.watch_price)
            
            # 获取量比（如果 quote 有 volume_ratio 属性）
            volume_ratio = getattr(quote, 'volume_ratio', None)
            if volume_ratio is None:
                logger.debug(f"[PriceMonitor] {rule.stock_code} 无法获取量比，跳过放量检查")
                return False
            
            return volume_ratio >= volume_ratio_threshold and current_price >= price_above
        
        else:
            logger.debug(f"[PriceMonitor] {rule.stock_code} 未知的触发类型: {trigger_type}")
            return False

    def _check_reject_condition(self, reject_if: Dict, quote) -> bool:
        """检查拒绝条件（满足任一条件则拒绝触发）"""
        # 量比低于阈值
        volume_ratio_below = reject_if.get("volume_ratio_below")
        if volume_ratio_below is not None:
            volume_ratio = getattr(quote, 'volume_ratio', None)
            if volume_ratio is not None and volume_ratio < volume_ratio_below:
                logger.debug(f"[PriceMonitor] 拒绝条件触发: 量比 {volume_ratio} < {volume_ratio_below}")
                return True
        
        # 卖盘挂单 >= 阈值（暂未实现，需要五档行情数据）
        market_depth_sell_wall = reject_if.get("market_depth_sell_wall_gte")
        if market_depth_sell_wall is not None:
            logger.debug(f"[PriceMonitor] 拒绝条件: 卖盘挂单检查暂未实现")
            # 暂时返回 False，不拒绝
        
        # 价格跌破
        price_drop_to = reject_if.get("price_drop_to")
        if price_drop_to is not None:
            current_price = getattr(quote, 'price', 0)
            if current_price <= price_drop_to:
                logger.debug(f"[PriceMonitor] 拒绝条件触发: 价格 {current_price} <= {price_drop_to}")
                return True
        
        return False

    def _push_alert(self, rule: WatchRule, current_price: float) -> None:
        """推送预警消息到飞书"""
        # 判断操作类型
        if rule.trigger_type:
            # v2.0 结构化操作
            if rule.direction == "buy":
                operation_type = "买入"
            elif rule.direction == "sell":
                operation_type = "卖出"
            else:
                operation_type = "监控"
        else:
            # v1.0 关键词匹配
            operation_type = "卖出" if "卖出" in rule.operation else "买入" if "买入" in rule.operation else "关注"
        
        # 构建推送消息
        alert_message = (
            f" 价格预警 | {rule.stock_name}\n\n"
            f"股票：{rule.stock_name}（{rule.stock_code}）\n"
            f"当前价：¥{current_price:.2f}\n"
            f"预警价：¥{rule.watch_price:.2f}\n"
            f"建议操作：{operation_type}"
        )
        
        # v2.0 附加信息
        if rule.trigger_type:
            if rule.quantity > 0:
                alert_message += f"\n数量：{rule.quantity}股"
            if rule.execution_mode:
                mode_name = {
                    "auto_limit": "自动限价",
                    "auto_market": "自动市价",
                    "notify_only": "仅通知"
                }.get(rule.execution_mode, rule.execution_mode)
                alert_message += f"\n执行模式：{mode_name}"
            if rule.priority:
                alert_message += f"\n优先级：P{rule.priority}"
        
        alert_message += f"\n说明：{rule.note}\n\n—— 自动监盘系统"

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
        从操作指令看板的预警数据加载规则（v1.0 格式）
        
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
        
        logger.info(f"[PriceMonitor] 从看板加载 {len(watch_prices)} 条预警规则（v1.0 格式）")

    def load_from_auto_watch(self, auto_watch_list: List[Dict]) -> None:
        """
        从 v2.0 auto_watch 数组加载规则
        
        Args:
            auto_watch_list: v2.0 格式的 auto_watch 数组
        """
        self.clear_rules()
        
        for item in auto_watch_list:
            trigger = item.get("trigger", {})
            condition = item.get("condition", {})
            execution = item.get("execution", {})
            
            # 提取目标价格
            watch_price = 0.0
            if trigger.get("target") is not None:
                watch_price = float(trigger["target"])
            elif trigger.get("value") is not None:
                watch_price = float(trigger["value"])
            elif trigger.get("price_above") is not None:
                watch_price = float(trigger["price_above"])
            
            # 构建操作说明
            direction = item.get("direction", "none")
            if direction == "buy":
                operation = "买入"
            elif direction == "sell":
                operation = "卖出"
            else:
                operation = "监控"
            
            rule = WatchRule(
                stock_code=item["stock_code"],
                stock_name=item["stock_name"],
                watch_price=watch_price,
                operation=operation,
                note=item.get("reason", ""),
                # v2.0 字段
                rule_id=item.get("id"),
                direction=direction,
                quantity=item.get("quantity", 0),
                trigger_type=trigger.get("type"),
                trigger_params=trigger,
                condition_reject=condition.get("reject_if"),
                condition_cancel=condition.get("cancel_if"),
                execution_mode=execution.get("mode"),
                execution_params=execution,
                priority=item.get("priority", 3),
                validity=execution.get("validity", "until_canceled"),
            )
            self.add_rule(rule)
        
        logger.info(f"[PriceMonitor] 从 auto_watch 加载 {len(auto_watch_list)} 条预警规则（v2.0 格式）")


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
