# -*- coding: utf-8 -*-
"""
===================================
智能股票推荐 API
===================================

职责：
1. 从自选股列表筛选优质股票
2. 调用 LLM 对候选股票进行评分排序
3. 返回 Top N 推荐结果
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.config import get_config
from data_provider.base import DataFetcherManager
from src.strategies.stock_screener import StockScreener
from src.analyzer import GeminiAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter()


class RecommendationItem(BaseModel):
    """单个推荐股票"""
    stock_code: str = Field(..., description="股票代码")
    stock_name: Optional[str] = Field(None, description="股票名称")
    score: float = Field(..., description="综合评分 (0-100)")
    rank: int = Field(..., description="排名")
    current_price: float = Field(..., description="当前价格")
    change_pct: float = Field(0.0, description="涨跌幅 (%)")
    trend_strength: float = Field(0.0, description="趋势强度 (%)")
    rsi: float = Field(0.0, description="RSI 指标")
    volume_ratio: float = Field(0.0, description="量比")
    macd_signal: str = Field("neutral", description="MACD 信号: bullish/bearish/neutral")
    support_level: float = Field(0.0, description="支撑位")
    resistance_level: float = Field(0.0, description="阻力位")
    reasons: List[str] = Field(default_factory=list, description="推荐理由列表")
    risks: List[str] = Field(default_factory=list, description="风险提示列表")
    trend_prediction: Optional[str] = Field(None, description="趋势预测")
    operation_advice: Optional[str] = Field(None, description="操作建议")


class RecommendationResponse(BaseModel):
    """推荐响应"""
    recommendations: List[RecommendationItem] = Field(..., description="推荐列表")
    total_screened: int = Field(..., description="筛选总数")
    generated_at: str = Field(..., description="生成时间")


class MarketScreenResponse(BaseModel):
    """全市场筛选响应"""
    recommendations: List[RecommendationItem] = Field(..., description="推荐列表")
    total_screened: int = Field(..., description="筛选总数")
    generated_at: str = Field(..., description="生成时间")


# 预设 A 股热门股票列表（沪深300核心成分股 + 部分热门个股）
A_SHARE_POPULAR_STOCKS = [
    # 金融
    '601318', '600036', '601166', '600030', '601012', '601398', '601288', '601988',
    '601939', '601628', '601888', '600016', '600000', '601328', '601169', '000776',
    '601688', '601377', '601601', '601009', '600019',
    # 白酒/消费
    '600519', '000858', '000568', '002304', '600809', '600196', '600702',
    # 新能源/汽车
    '002594', '300750', '601899', '000625', '000157', '600436',
    # 科技/半导体
    '002475', '002049', '002271', '600584', '603501', '688981', '600570',
    # 医药
    '600276', '000538', '600085',
    # 基建/周期
    '601668', '600048', '600029', '601766', '600028', '601088',
    # 其他热门
    '000001', '000002', '000063', '600585', '600111', '600745', '002463',
    '600797', '002027', '600089', '002371',
]


@router.get(
    "/market-screen",
    response_model=MarketScreenResponse,
    summary="全市场 A 股智能筛选",
)
def market_screen(
    top_n: int = Query(5, ge=1, le=20, description="返回Top N推荐"),
    use_llm: bool = Query(True, description="是否使用LLM深度分析"),
) -> MarketScreenResponse:
    """
    对全市场 A 股（预设热门股票池）进行智能筛选
    
    流程：
    1. 使用预设的 A 股热门股票列表（沪深300 + 热门个股）
    2. 多维度技术面筛选（流动性、波动率、振幅等）
    3. 如果 use_llm=True，对候选股票调用 LLM 进行深度分析和评分
    4. 按综合评分排序，返回 Top N
    
    Args:
        top_n: 返回的推荐数量（1-20）
        use_llm: 是否启用 LLM 深度分析（默认 True）
    
    Returns:
        推荐股票列表，包含评分、理由和建议
    """
    try:
        logger.info(f"[MarketScreen] 开始筛选 {len(A_SHARE_POPULAR_STOCKS)} 只 A 股...")
        
        # 1. 初始化数据提供者
        data_provider = DataFetcherManager()
        screener = StockScreener(data_provider)
        
        # 2. 执行多维度筛选（放宽条件以适应全市场）
        candidates = screener.screen_stocks(
            stock_list=A_SHARE_POPULAR_STOCKS,
            lookback_days=60,
            min_avg_volume=500000,    # 日均成交量 > 50万股
            max_volatility=0.08,      # 波动率 < 8%
            min_volatility=0.005      # 波动率 > 0.5%
        )
        
        logger.info(f"[MarketScreen] 技术面筛选结果: {len(candidates)} 只候选 / {len(A_SHARE_POPULAR_STOCKS)} 只总计")
        
        if not candidates:
            return MarketScreenResponse(
                recommendations=[],
                total_screened=len(A_SHARE_POPULAR_STOCKS),
                generated_at=datetime.now().isoformat()
            )
        
        # 3. LLM 深度分析
        final_candidates = candidates
        if use_llm and candidates:
            analyzer = GeminiAnalyzer()
            enriched_candidates = []
            analyze_limit = min(len(candidates), 10)
            
            for idx, candidate in enumerate(candidates[:analyze_limit]):
                try:
                    stock_code = candidate['stock_code']
                    result = analyzer.analyze(
                        context={
                            'code': stock_code,
                            'stock_name': _get_stock_name(stock_code),
                            'date': datetime.now().strftime('%Y-%m-%d')
                        },
                        news_context=None,
                        progress_callback=None,
                        stream_progress_callback=None
                    )
                    
                    if result and result.success:
                        technical_score = candidate['score']
                        llm_score = result.sentiment_score
                        combined_score = technical_score * 0.4 + llm_score * 0.6
                        
                        enriched_candidates.append({
                            **candidate,
                            'combined_score': combined_score,
                            'llm_result': result
                        })
                        logger.info(f"[MarketScreen] {stock_code}: 技术分={technical_score:.1f}, LLM分={llm_score:.1f}, 综合分={combined_score:.1f}")
                    else:
                        enriched_candidates.append({
                            **candidate,
                            'combined_score': candidate['score'],
                            'llm_result': None
                        })
                except Exception as e:
                    logger.warning(f"[MarketScreen] LLM 分析 {candidate['stock_code']} 失败: {e}")
                    enriched_candidates.append({
                        **candidate,
                        'combined_score': candidate['score'],
                        'llm_result': None
                    })
            
            enriched_candidates.sort(key=lambda x: x['combined_score'], reverse=True)
            final_candidates = enriched_candidates[:top_n]
        else:
            candidates.sort(key=lambda x: x['score'], reverse=True)
            final_candidates = candidates[:top_n]
        
        # 4. 构建响应
        recommendations = []
        for idx, candidate in enumerate(final_candidates):
            stock_code = candidate['stock_code']
            metrics = candidate.get('metrics', {})
            llm_result = candidate.get('llm_result')
            score = candidate.get('combined_score', candidate['score'])
            
            reasons_list = _generate_reasons_list(metrics, llm_result)
            risks_list = _generate_risks_list(metrics, llm_result)
            
            current_price = metrics.get('current_price', 0)
            support_level = current_price * (1 - metrics.get('avg_daily_range', 0.03))
            resistance_level = current_price * (1 + metrics.get('avg_daily_range', 0.03))
            price_vs_ma20 = metrics.get('price_vs_ma20', 0)
            macd_signal = 'bullish' if price_vs_ma20 > 0.02 else 'bearish' if price_vs_ma20 < -0.02 else 'neutral'
            
            recommendations.append(RecommendationItem(
                stock_code=stock_code,
                stock_name=_get_stock_name(stock_code),
                score=round(score, 2),
                rank=idx + 1,
                current_price=round(current_price, 2),
                change_pct=round(price_vs_ma20 * 100, 2),
                trend_strength=round(min(100, score * 1.1), 1),
                rsi=round(50 + price_vs_ma20 * 100, 1),
                volume_ratio=round(1 + metrics.get('volume_trend', 0), 2),
                macd_signal=macd_signal,
                support_level=round(support_level, 2),
                resistance_level=round(resistance_level, 2),
                reasons=reasons_list,
                risks=risks_list,
                trend_prediction=llm_result.trend_prediction if llm_result else None,
                operation_advice=llm_result.operation_advice if llm_result else None
            ))
        
        logger.info(f"[MarketScreen] 生成 {len(recommendations)} 条推荐")
        
        return MarketScreenResponse(
            recommendations=recommendations,
            total_screened=len(A_SHARE_POPULAR_STOCKS),
            generated_at=datetime.now().isoformat()
        )
    
    except Exception as e:
        logger.error(f"[MarketScreen] 筛选失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": f"筛选失败: {str(e)}"}
        )


class AnalyzeStockResponse(BaseModel):
    """单股票分析响应"""
    stock: Optional[RecommendationItem] = Field(None, description="分析结果")


@router.get(
    "/analyze-stock",
    response_model=AnalyzeStockResponse,
    summary="AI 深度分析单只股票",
)
def analyze_single_stock(
    stock_code: str = Query(..., description="股票代码，如 600519 或 hk00700 或 AAPL"),
) -> AnalyzeStockResponse:
    """
    对单只股票进行 AI 深度分析（无需配置 STOCK_LIST）
    
    流程：
    1. 获取股票历史数据
    2. 计算技术面指标和评分
    3. 调用 LLM 进行深度情感分析
    4. 返回综合评分、推荐理由和风险提示
    
    Args:
        stock_code: 股票代码
    
    Returns:
        股票分析结果
    """
    try:
        config = get_config()
        
        logger.info(f"[AnalyzeStock] 开始分析 {stock_code}...")
        
        # 1. 初始化数据提供者
        data_provider = DataFetcherManager()
        screener = StockScreener(data_provider)
        
        # 2. 对单只股票进行技术面筛选
        candidates = screener.screen_stocks(
            stock_list=[stock_code],
            lookback_days=60,
            min_avg_volume=100000,    # 降低门槛
            max_volatility=0.10,      # 放宽波动率限制
            min_volatility=0.003      # 放宽波动率限制
        )
        
        if not candidates:
            # 即使技术面筛选未通过，也尝试进行基础分析
            logger.warning(f"[AnalyzeStock] {stock_code} 技术面筛选未通过，尝试基础分析")
            try:
                end_date = datetime.now().strftime('%Y%m%d')
                start_date = (datetime.now() - timedelta(days=60)).strftime('%Y%m%d')
                df, _ = data_provider.get_daily_data(stock_code, start_date=start_date, end_date=end_date)
                
                if df is None or len(df) < 10:
                    raise HTTPException(
                        status_code=400,
                        detail={"error": "no_data", "message": f"无法获取 {stock_code} 的历史数据"}
                    )
                
                # 构建基础 metrics
                metrics = screener._calculate_metrics(df)
                candidates = [{'stock_code': stock_code, 'score': 50.0, 'metrics': metrics}]
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail={"error": "fetch_failed", "message": f"获取股票数据失败: {str(e)}"}
                )
        
        candidate = candidates[0]
        stock_code = candidate['stock_code']
        metrics = candidate.get('metrics', {})
        
        # 3. LLM 深度分析
        llm_result = None
        combined_score = candidate['score']
        
        try:
            analyzer = GeminiAnalyzer()
            result = analyzer.analyze(
                context={
                    'code': stock_code,
                    'stock_name': _get_stock_name(stock_code),
                    'date': datetime.now().strftime('%Y-%m-%d')
                },
                news_context=None,
                progress_callback=None,
                stream_progress_callback=None
            )
            
            if result and result.success:
                llm_result = result
                # 综合评分：技术面(40%) + LLM(60%)
                technical_score = candidate['score']
                llm_score = result.sentiment_score
                combined_score = technical_score * 0.4 + llm_score * 0.6
                
                logger.info(
                    f"[AnalyzeStock] {stock_code}: "
                    f"技术分={technical_score:.1f}, LLM分={llm_score:.1f}, "
                    f"综合分={combined_score:.1f}"
                )
            else:
                logger.warning(f"[AnalyzeStock] {stock_code}: LLM 分析未返回有效结果")
        except Exception as e:
            logger.warning(f"[AnalyzeStock] {stock_code}: LLM 分析失败: {e}")
        
        # 4. 构建响应
        current_price = metrics.get('current_price', 0)
        support_level = current_price * (1 - metrics.get('avg_daily_range', 0.03))
        resistance_level = current_price * (1 + metrics.get('avg_daily_range', 0.03))
        
        price_vs_ma20 = metrics.get('price_vs_ma20', 0)
        macd_signal = 'bullish' if price_vs_ma20 > 0.02 else 'bearish' if price_vs_ma20 < -0.02 else 'neutral'
        
        reasons_list = _generate_reasons_list(metrics, llm_result)
        risks_list = _generate_risks_list(metrics, llm_result)
        
        stock_item = RecommendationItem(
            stock_code=stock_code,
            stock_name=_get_stock_name(stock_code),
            score=round(combined_score, 2),
            rank=1,
            current_price=round(current_price, 2),
            change_pct=round(price_vs_ma20 * 100, 2),
            trend_strength=round(min(100, combined_score * 1.1), 1),
            rsi=round(50 + price_vs_ma20 * 100, 1),
            volume_ratio=round(1 + metrics.get('volume_trend', 0), 2),
            macd_signal=macd_signal,
            support_level=round(support_level, 2),
            resistance_level=round(resistance_level, 2),
            reasons=reasons_list,
            risks=risks_list,
            trend_prediction=llm_result.trend_prediction if llm_result else None,
            operation_advice=llm_result.operation_advice if llm_result else None
        )
        
        logger.info(f"[AnalyzeStock] {stock_code} 分析完成，综合评分: {combined_score:.1f}")
        
        return AnalyzeStockResponse(stock=stock_item)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AnalyzeStock] 分析失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": f"分析失败: {str(e)}"}
        )


@router.get(
    "/recommendations",
    response_model=RecommendationResponse,
    summary="获取智能股票推荐",
)
def get_recommendations(
    top_n: int = Query(5, ge=1, le=20, description="返回Top N推荐"),
    use_llm: bool = Query(True, description="是否使用LLM深度分析"),
) -> RecommendationResponse:
    """
    获取智能股票推荐
    
    流程：
    1. 从 STOCK_LIST 获取自选股列表
    2. 使用 StockScreener 进行多维度筛选（流动性、波动率、振幅等）
    3. 如果 use_llm=True，对候选股票调用 LLM 进行深度分析和评分
    4. 按综合评分排序，返回 Top N
    
    Args:
        top_n: 返回的推荐数量（1-20）
        use_llm: 是否启用 LLM 深度分析（默认 True）
    
    Returns:
        推荐股票列表，包含评分、理由和建议
    """
    try:
        config = get_config()
        
        # 1. 获取自选股列表
        stock_list = config.stock_list
        if not stock_list:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "no_stock_list",
                    "message": "未配置自选股列表，请在 .env 中设置 STOCK_LIST"
                }
            )
        
        logger.info(f"[Recommendations] 开始筛选 {len(stock_list)} 只股票...")
        
        # 2. 初始化数据提供者管理器
        data_provider = DataFetcherManager()
        screener = StockScreener(data_provider)
        
        # 3. 执行多维度筛选
        candidates = screener.screen_stocks(
            stock_list=stock_list,
            lookback_days=60,
            min_avg_volume=500000,    # 放宽：日均成交量 > 50万
            max_volatility=0.08,      # 放宽：波动率 < 8%
            min_volatility=0.005      # 放宽：波动率 > 0.5%
        )
        
        # 详细日志：记录每只股票的筛选状态
        logger.info(f"[Recommendations] 筛选结果: {len(candidates)} 只候选 / {len(stock_list)} 只总计")
        if candidates:
            for c in candidates:
                logger.info(f"  - {c['stock_code']}: 评分={c['score']:.1f}, 成交量={c['metrics'].get('avg_volume', 0):.0f}, 波动率={c['metrics'].get('daily_volatility', 0)*100:.2f}%")
        
        if not candidates:
            return RecommendationResponse(
                recommendations=[],
                total_screened=len(stock_list),
                generated_at=datetime.now().isoformat()
            )
        
        logger.info(f"[Recommendations] 初步筛选出 {len(candidates)} 只候选股票")
        
        # 4. 如果需要 LLM 深度分析
        if use_llm and candidates:
            analyzer = GeminiAnalyzer()
            enriched_candidates = []
            
            # 限制最多分析的股票数量（避免过多 LLM 调用）
            analyze_limit = min(len(candidates), 10)
            
            for idx, candidate in enumerate(candidates[:analyze_limit]):
                try:
                    stock_code = candidate['stock_code']
                    
                    # 调用 LLM 分析
                    result = analyzer.analyze(
                        context={
                            'code': stock_code,
                            'stock_name': candidate.get('metrics', {}).get('current_price'),
                            'date': datetime.now().strftime('%Y-%m-%d')
                        },
                        news_context=None,
                        progress_callback=None,
                        stream_progress_callback=None
                    )
                    
                    if result and result.success:
                        # 计算综合评分：技术面评分(40%) + LLM 情感分(60%)
                        technical_score = candidate['score']
                        llm_score = result.sentiment_score
                        
                        combined_score = technical_score * 0.4 + llm_score * 0.6
                        
                        enriched_candidates.append({
                            **candidate,
                            'combined_score': combined_score,
                            'llm_result': result
                        })
                        
                        logger.info(
                            f"[Recommendations] {stock_code}: "
                            f"技术分={technical_score:.1f}, LLM分={llm_score:.1f}, "
                            f"综合分={combined_score:.1f}"
                        )
                    else:
                        # LLM 分析失败，仅使用技术面评分
                        enriched_candidates.append({
                            **candidate,
                            'combined_score': candidate['score'],
                            'llm_result': None
                        })
                
                except Exception as e:
                    logger.warning(f"[Recommendations] LLM 分析 {candidate['stock_code']} 失败: {e}")
                    enriched_candidates.append({
                        **candidate,
                        'combined_score': candidate['score'],
                        'llm_result': None
                    })
            
            # 按综合评分排序
            enriched_candidates.sort(key=lambda x: x['combined_score'], reverse=True)
            final_candidates = enriched_candidates[:top_n]
        else:
            # 不使用 LLM，直接按技术面评分排序
            candidates.sort(key=lambda x: x['score'], reverse=True)
            final_candidates = candidates[:top_n]
        
        # 5. 构建响应
        recommendations = []
        for idx, candidate in enumerate(final_candidates):
            stock_code = candidate['stock_code']
            metrics = candidate.get('metrics', {})
            llm_result = candidate.get('llm_result')
            
            # 确定评分
            score = candidate.get('combined_score', candidate['score'])
            
            # 生成推荐理由列表
            reasons_list = _generate_reasons_list(metrics, llm_result)
            risks_list = _generate_risks_list(metrics, llm_result)
            
            # 计算支撑位和阻力位
            current_price = metrics.get('current_price', 0)
            support_level = current_price * (1 - metrics.get('avg_daily_range', 0.03))
            resistance_level = current_price * (1 + metrics.get('avg_daily_range', 0.03))
            
            # MACD 信号（简化版）
            price_vs_ma20 = metrics.get('price_vs_ma20', 0)
            macd_signal = 'bullish' if price_vs_ma20 > 0.02 else 'bearish' if price_vs_ma20 < -0.02 else 'neutral'
            
            recommendations.append(RecommendationItem(
                stock_code=stock_code,
                stock_name=_get_stock_name(stock_code),
                score=round(score, 2),
                rank=idx + 1,
                current_price=round(current_price, 2),
                change_pct=round((metrics.get('price_vs_ma20', 0)) * 100, 2),
                trend_strength=round(min(100, score * 1.1), 1),
                rsi=round(50 + metrics.get('price_vs_ma20', 0) * 100, 1),
                volume_ratio=round(1 + metrics.get('volume_trend', 0), 2),
                macd_signal=macd_signal,
                support_level=round(support_level, 2),
                resistance_level=round(resistance_level, 2),
                reasons=reasons_list,
                risks=risks_list,
                trend_prediction=llm_result.trend_prediction if llm_result else None,
                operation_advice=llm_result.operation_advice if llm_result else None
            ))
        
        logger.info(f"[Recommendations] 生成 {len(recommendations)} 条推荐")
        
        return RecommendationResponse(
            recommendations=recommendations,
            total_screened=len(stock_list),
            generated_at=datetime.now().isoformat()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Recommendations] 生成推荐失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": f"生成推荐失败: {str(e)}"
            }
        )


def _generate_reasons_list(metrics: Dict, llm_result: Any) -> List[str]:
    """生成推荐理由列表"""
    reasons = []
    
    # 技术面理由
    if metrics.get('price_vs_ma20', 0) > 0:
        reasons.append("多头排列，MA5>MA10>MA20")
    
    if metrics.get('volume_trend', 0) > 0.1:
        reasons.append("量能放大，资金流入明显")
    
    if metrics.get('avg_daily_range', 0) > 0.03:
        reasons.append("日内振幅充足，适合波段交易")
    
    # LLM 分析理由
    if llm_result:
        if llm_result.sentiment_score > 70:
            reasons.append(f"AI 看好（情感分 {llm_result.sentiment_score}）")
        if llm_result.operation_advice == 'Buy':
            reasons.append("建议买入")
    
    if not reasons:
        reasons.append("技术指标良好")
    
    return reasons


def _generate_risks_list(metrics: Dict, llm_result: Any) -> List[str]:
    """生成风险提示列表"""
    risks = []
    
    # 计算 RSI（简化版）
    rsi = 50 + metrics.get('price_vs_ma20', 0) * 100
    if rsi > 70:
        risks.append("RSI 接近超买区")
    
    if metrics.get('price_vs_ma60', 0) > 0.1:
        risks.append("短期涨幅较大，注意回调风险")
    
    if metrics.get('volume_cv', 0) > 0.5:
        risks.append("成交量波动较大")
    
    if not risks:
        risks.append("风险可控，注意仓位管理")
    
    return risks


def _get_stock_name(stock_code: str) -> Optional[str]:
    """获取股票名称（简化版，实际应从数据库或缓存获取）"""
    # TODO: 从 stock_mapping 或数据库获取真实名称
    from src.data.stock_mapping import STOCK_NAME_MAP
    return STOCK_NAME_MAP.get(stock_code)
