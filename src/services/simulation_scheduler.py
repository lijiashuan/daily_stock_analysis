# -*- coding: utf-8 -*-
"""
模拟交易调度器

负责定时执行以下任务：
1. 每日开盘前生成交易建议
2. 盘中监控持仓
3. 收盘后生成复盘报告
4. 发送通知推送
"""

import logging
from datetime import datetime, time
from typing import Dict, List, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from src.services.simulation_trading_service import get_simulation_service, SimulationTradingService
from src.services.portfolio_service import PortfolioService
# from src.notification import NotificationManager

logger = logging.getLogger(__name__)


class SimulationScheduler:
    """
    模拟交易调度器
    
    使用 APScheduler 实现定时任务
    """
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.service = get_simulation_service()
        self.portfolio_service = PortfolioService()  # 用于获取模拟账户
        # self.notification_manager = NotificationManager()
        
        logger.info("SimulationScheduler 初始化完成")
    
    def start(self):
        """启动调度器"""
        if self.scheduler.running:
            logger.warning("调度器已在运行中")
            return {"status": "already_running", "message": "调度器已在运行中"}
        
        # 1. 每日 9:00 生成交易建议（开盘前）
        self.scheduler.add_job(
            func=self.generate_daily_suggestions,
            trigger=CronTrigger(hour=9, minute=0),
            id='daily_suggestions',
            name='生成每日交易建议',
            replace_existing=True
        )
        
        # 2. 每日 11:30 盘中检查（上午收盘前）
        self.scheduler.add_job(
            func=self.midday_check,
            trigger=CronTrigger(hour=11, minute=30),
            id='midday_check',
            name='盘中检查',
            replace_existing=True
        )
        
        # 3. 每日 15:30 生成复盘报告（收盘后）
        self.scheduler.add_job(
            func=self.generate_daily_review,
            trigger=CronTrigger(hour=15, minute=30),
            id='daily_review',
            name='生成每日复盘报告',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("调度器已启动，注册了3个定时任务")
        return {"status": "started", "message": "调度器已启动"}
    
    def stop(self):
        """停止调度器"""
        if not self.scheduler.running:
            logger.warning("调度器未运行")
            return {"status": "not_running", "message": "调度器未运行"}
        
        self.scheduler.shutdown()
        logger.info("调度器已停止")
        return {"status": "stopped", "message": "调度器已停止"}
    
    def get_status(self) -> Dict:
        """获取调度器状态"""
        job_count = len(self.scheduler.get_jobs()) if self.scheduler.running else 0
        return {
            "running": self.scheduler.running,
            "job_count": job_count,
            "jobs": [
                {
                    "id": job.id,
                    "name": job.name,
                    "next_run_time": str(job.next_run_time) if job.next_run_time else None
                }
                for job in self.scheduler.get_jobs()
            ] if self.scheduler.running else []
        }
    
    def generate_daily_suggestions(self):
        """
        生成每日交易建议
        
        执行时间：每日 9:00
        """
        logger.info("="*60)
        logger.info("开始生成每日交易建议")
        logger.info("="*60)
        
        try:
            # 只获取模拟账户
            accounts = self.portfolio_service.list_accounts(account_type="simulation")
            
            if not accounts:
                logger.info("没有活跃的模拟账户，跳过")
                return
            
            suggestions = []
            
            for account in accounts:
                # 双重校验：确保是模拟账户
                if account.get('account_type') != 'simulation':
                    logger.warning(f"跳过非模拟账户: {account['name']} (type={account.get('account_type')})")
                    continue
                
                logger.info(f"处理账户: {account['name']} (ID={account['id']})")
                
                # TODO: 从配置或数据库获取该账户关注的股票列表
                # 这里暂时使用测试股票代码
                stock_codes = ['TEST001']
                
                for stock_code in stock_codes:
                    try:
                        suggestion = self.service.generate_trading_suggestion(
                            stock_code=stock_code,
                            account_id=account['id'],
                            use_auction=True
                        )
                        
                        suggestions.append({
                            'account_id': account['id'],
                            'account_name': account['name'],
                            'stock_code': stock_code,
                            'suggestion': suggestion
                        })
                        
                        logger.info(f"✓ 生成建议: {stock_code}")
                        
                    except Exception as e:
                        logger.error(f"✗ 生成建议失败 {stock_code}: {e}")
            
            # 发送通知
            if suggestions:
                self._send_suggestion_notification(suggestions)
            
            logger.info(f"每日交易建议生成完成，共 {len(suggestions)} 条")
            
        except Exception as e:
            logger.error(f"生成每日交易建议失败: {e}", exc_info=True)
    
    def midday_check(self):
        """
        盘中检查
        
        执行时间：每日 11:30
        """
        logger.info("="*60)
        logger.info("开始盘中检查")
        logger.info("="*60)
        
        try:
            accounts = self.portfolio_service.list_accounts(account_type="simulation")
            
            for account in accounts:
                # 双重校验
                if account.get('account_type') != 'simulation':
                    continue
                
                # TODO: 获取账户快照并检查
                logger.info(f"账户 {account['name']}: 检查中...")
            
            logger.info("盘中检查完成")
            
        except Exception as e:
            logger.error(f"盘中检查失败: {e}", exc_info=True)
    
    def generate_daily_review(self):
        """
        生成每日复盘报告
        
        执行时间：每日 15:30
        """
        logger.info("="*60)
        logger.info("开始生成每日复盘报告")
        logger.info("="*60)
        
        try:
            accounts = self.service.list_accounts()
            
            reviews = []
            
            for account in accounts:
                summary = account.get_account_summary()
                
                review = {
                    'account_id': account.account_id,
                    'account_name': account.account_name,
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'total_assets': summary['total_assets'],
                    'profit_loss': summary['profit_loss'],
                    'profit_loss_pct': summary['profit_loss_pct'],
                    'trade_count': summary['trade_count'],
                    'positions': summary['positions']
                }
                
                reviews.append(review)
                
                logger.info(
                    f"账户 {account.account_name}: "
                    f"今日交易 {summary['trade_count']} 笔, "
                    f"盈亏 ¥{summary['profit_loss']:,.2f} ({summary['profit_loss_pct']:.2f}%)"
                )
            
            # 发送复盘报告通知
            if reviews:
                self._send_review_notification(reviews)
            
            logger.info(f"每日复盘报告生成完成，共 {len(reviews)} 个账户")
            
        except Exception as e:
            logger.error(f"生成每日复盘报告失败: {e}", exc_info=True)
    
    def _send_suggestion_notification(self, suggestions: List[dict]):
        """发送交易建议通知"""
        try:
            title = "📊 每日交易建议"
            
            content_lines = [f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}"]
            content_lines.append("")
            
            for item in suggestions:
                content_lines.append(f"账户: {item['account_name']}")
                content_lines.append(f"股票: {item['stock_code']}")
                
                sugg = item['suggestion']
                if 'current_price' in sugg:
                    content_lines.append(f"当前价格: ¥{sugg['current_price']:.2f}")
                
                if 'grid_orders' in sugg and sugg['grid_orders']:
                    content_lines.append(f"网格订单: {len(sugg['grid_orders'])} 个")
                
                content_lines.append("")
            
            content = "\n".join(content_lines)
            
            # 发送通知（如果配置了通知渠道）
            # self.notification_manager.send(title, content)
            
            logger.info(f"交易建议通知已准备: {len(suggestions)} 条")
            
        except Exception as e:
            logger.error(f"发送交易建议通知失败: {e}")
    
    def _send_review_notification(self, reviews: List[dict]):
        """发送复盘报告通知"""
        try:
            title = "📈 每日复盘报告"
            
            content_lines = [f"日期: {datetime.now().strftime('%Y-%m-%d')}"]
            content_lines.append("")
            
            total_profit = 0
            
            for review in reviews:
                profit = review['profit_loss']
                total_profit += profit
                
                profit_symbol = "+" if profit >= 0 else ""
                
                content_lines.append(f"账户: {review['account_name']}")
                content_lines.append(f"  总资产: ¥{review['total_assets']:,.2f}")
                content_lines.append(f"  今日盈亏: {profit_symbol}¥{profit:,.2f} ({review['profit_loss_pct']:.2f}%)")
                content_lines.append(f"  交易次数: {review['trade_count']}")
                content_lines.append("")
            
            profit_symbol = "+" if total_profit >= 0 else ""
            content_lines.append(f"总计盈亏: {profit_symbol}¥{total_profit:,.2f}")
            
            content = "\n".join(content_lines)
            
            # 发送通知
            # self.notification_manager.send(title, content)
            
            logger.info(f"复盘报告通知已准备: {len(reviews)} 个账户")
            
        except Exception as e:
            logger.error(f"发送复盘报告通知失败: {e}")


# 全局调度器实例
_scheduler: Optional[SimulationScheduler] = None


def get_scheduler() -> SimulationScheduler:
    """获取调度器实例（单例）"""
    global _scheduler
    
    if _scheduler is None:
        _scheduler = SimulationScheduler()
    
    return _scheduler


def start_scheduler():
    """启动调度器"""
    scheduler = get_scheduler()
    scheduler.start()
    logger.info("模拟交易调度器已启动")


def stop_scheduler():
    """停止调度器"""
    global _scheduler
    
    if _scheduler:
        _scheduler.stop()
        _scheduler = None
        logger.info("模拟交易调度器已停止")
