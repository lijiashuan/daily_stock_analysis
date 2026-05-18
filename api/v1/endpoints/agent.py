# -*- coding: utf-8 -*-
"""
Agent API endpoints.
"""

import asyncio
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from src.config import get_config
from src.services.agent_model_service import list_agent_model_deployments

# Tool name -> Chinese display name mapping
TOOL_DISPLAY_NAMES: Dict[str, str] = {
    "get_realtime_quote":         "获取实时行情",
    "get_daily_history":          "获取历史K线",
    "get_chip_distribution":      "分析筹码分布",
    "get_analysis_context":       "获取分析上下文",
    "get_stock_info":             "获取股票基本面",
    "search_stock_news":          "搜索股票新闻",
    "search_comprehensive_intel": "搜索综合情报",
    "analyze_trend":              "分析技术趋势",
    "calculate_ma":               "计算均线系统",
    "get_volume_analysis":        "分析量能变化",
    "analyze_pattern":            "识别K线形态",
    "get_market_indices":         "获取市场指数",
    "get_sector_rankings":        "分析行业板块",
    "get_skill_backtest_summary": "获取技能回测概览",
    "get_strategy_backtest_summary": "获取策略回测概览",
    "get_stock_backtest_summary": "获取个股回测数据",
}

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str
    session_id: Optional[str] = None
    skills: Optional[List[str]] = Field(
        default=None,
        validation_alias=AliasChoices("skills", "strategies"),
    )
    context: Optional[Dict[str, Any]] = None  # Previous analysis context for data reuse

    @property
    def effective_skills(self) -> Optional[List[str]]:
        """Return skill ids from the unified request shape."""
        return self.skills

class ChatResponse(BaseModel):
    success: bool
    content: str
    session_id: str
    error: Optional[str] = None

class SkillInfo(BaseModel):
    id: str
    name: str
    description: str

class SkillsResponse(BaseModel):
    skills: List[SkillInfo]
    default_skill_id: str = ""


class StrategiesResponse(BaseModel):
    strategies: List[SkillInfo]
    default_strategy_id: str = ""


class AgentModelDeployment(BaseModel):
    deployment_id: str
    model: str
    provider: str
    source: str
    api_base: Optional[str] = None
    deployment_name: Optional[str] = None
    is_primary: bool = False
    is_fallback: bool = False


class AgentModelsResponse(BaseModel):
    models: List[AgentModelDeployment]


@router.get("/models", response_model=AgentModelsResponse)
async def get_agent_models():
    """Get configured Agent model deployments for frontend selection."""
    config = get_config()
    return AgentModelsResponse(
        models=[AgentModelDeployment(**item) for item in list_agent_model_deployments(config)]
    )


def _build_skills_response(config) -> SkillsResponse:
    from src.agent.factory import get_skill_manager
    from src.agent.skills.defaults import get_primary_default_skill_id

    skill_manager = get_skill_manager(config)
    available_skills = sorted(
        [
            skill
            for skill in skill_manager.list_skills()
            if getattr(skill, "user_invocable", True)
        ],
        key=lambda skill: (
            int(getattr(skill, "default_priority", 100)),
            skill.display_name,
            skill.name,
        ),
    )
    skills = [
        SkillInfo(id=skill.name, name=skill.display_name, description=skill.description)
        for skill in available_skills
    ]
    return SkillsResponse(
        skills=skills,
        default_skill_id=get_primary_default_skill_id(available_skills),
    )


@router.get("/skills", response_model=SkillsResponse)
async def get_skills():
    """
    Get available agent strategy skills.
    """
    return _build_skills_response(get_config())


@router.get("/strategies", response_model=StrategiesResponse, include_in_schema=False)
async def get_strategies():
    """Compatibility alias for legacy clients."""
    payload = _build_skills_response(get_config())
    return StrategiesResponse(
        strategies=payload.skills,
        default_strategy_id=payload.default_skill_id,
    )

@router.post("/chat", response_model=ChatResponse)
async def agent_chat(request: ChatRequest):
    """
    Chat with the AI Agent.
    """
    config = get_config()
    
    if not config.is_agent_available():
        raise HTTPException(status_code=400, detail="Agent mode is not enabled")
        
    session_id = request.session_id or str(uuid.uuid4())
    
    try:
        skills = request.effective_skills
        executor = _build_executor(config, skills or None)

        # Pass explicit skills into context for the orchestrator.
        # Direct assignment so caller-provided skills always take precedence
        # over any stale value carried in the context dict.
        ctx = dict(request.context or {})
        if skills is not None:
            ctx["skills"] = skills

        # Offload the blocking call to a thread to avoid blocking the event loop.
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: executor.chat(message=request.message, session_id=session_id,
                                  context=ctx),
        )

        return ChatResponse(
            success=result.success,
            content=result.content,
            session_id=session_id,
            error=result.error
        )
            
    except Exception as e:
        logger.error(f"Agent chat API failed: {e}")
        logger.exception("Agent chat error details:")
        raise HTTPException(status_code=500, detail=str(e))


class SessionItem(BaseModel):
    session_id: str
    title: str
    message_count: int
    created_at: Optional[str] = None
    last_active: Optional[str] = None

class SessionsResponse(BaseModel):
    sessions: List[SessionItem]

class SessionMessagesResponse(BaseModel):
    session_id: str
    messages: List[Dict[str, Any]]


@router.get("/chat/sessions", response_model=SessionsResponse)
async def list_chat_sessions(limit: int = 50, user_id: Optional[str] = None):
    """获取聊天会话列表

    Args:
        limit: Maximum number of sessions to return.
        user_id: Optional platform-prefixed user identifier for session
            isolation.  When provided, only sessions whose session_id
            starts with this prefix are returned.  The value must
            include the platform prefix, e.g. ``telegram_12345``,
            ``feishu_ou_abc``.
    """
    from src.storage import get_db
    sessions = get_db().get_chat_sessions(
        limit=limit,
        session_prefix=user_id,
        extra_session_ids=[user_id] if user_id else None,
    )
    return SessionsResponse(sessions=sessions)


@router.get("/chat/sessions/{session_id}", response_model=SessionMessagesResponse)
async def get_chat_session_messages(session_id: str, limit: int = 100):
    """获取单个会话的完整消息"""
    from src.storage import get_db
    messages = get_db().get_conversation_messages(session_id, limit=limit)
    return SessionMessagesResponse(session_id=session_id, messages=messages)


@router.delete("/chat/sessions/{session_id}")
async def delete_chat_session(session_id: str):
    """删除指定会话"""
    from src.storage import get_db
    count = get_db().delete_conversation_session(session_id)
    return {"deleted": count}


class SendChatRequest(BaseModel):
    """Request body for sending chat content to notification channels."""

    content: str = Field(..., min_length=1, max_length=50000)
    title: Optional[str] = None


@router.post("/chat/send")
async def send_chat_to_notification(request: SendChatRequest):
    """
    Send chat session content to configured notification channels.
    Uses run_in_executor to avoid blocking the event loop.
    """
    from src.notification import NotificationService

    loop = asyncio.get_running_loop()
    success = await loop.run_in_executor(
        None,
        lambda: NotificationService().send(request.content),
    )
    if not success:
        return {
            "success": False,
            "error": "no_channels",
            "message": "未配置通知渠道，请先在设置中配置",
        }
    return {"success": True}


def _build_executor(config, skills: Optional[List[str]] = None):
    """Build and return a configured AgentExecutor (sync helper)."""
    from src.agent.factory import build_agent_executor
    return build_agent_executor(config, skills=skills)


async def _run_research_in_background(
    agent,
    question: str,
    context: Optional[Dict[str, Any]],
    *,
    timeout: int,
):
    """Run deep research off the event loop with an internal overall timeout."""
    return await asyncio.to_thread(
        agent.research,
        question,
        context,
        timeout_seconds=timeout,
    )


# ============================================================
# Deep research endpoint
# ============================================================

class ResearchRequest(BaseModel):
    question: str
    stock_code: Optional[str] = None

class ResearchResponse(BaseModel):
    success: bool
    content: str
    sources: List[str] = Field(default_factory=list)
    token_usage: int = 0
    error: Optional[str] = None


@router.post("/research", response_model=ResearchResponse)
async def agent_research(request: ResearchRequest):
    """Run a deep-research query via the ResearchAgent.

    Similar to the ``/research`` bot command but exposed as a REST endpoint.
    """
    config = get_config()
    if not config.is_agent_available():
        raise HTTPException(status_code=400, detail="Agent mode is not enabled")

    question = request.question
    context: Optional[Dict[str, Any]] = None
    if request.stock_code:
        question = f"[Stock: {request.stock_code}] {question}"
        context = {"stock_code": request.stock_code}

    try:
        from src.agent.research import ResearchAgent
        from src.agent.factory import get_tool_registry
        from src.agent.llm_adapter import LLMToolAdapter

        registry = get_tool_registry()
        llm_adapter = LLMToolAdapter(config)
        budget = getattr(config, "agent_deep_research_budget", 30000)

        agent = ResearchAgent(
            tool_registry=registry,
            llm_adapter=llm_adapter,
            token_budget=budget,
        )

        research_timeout = getattr(config, "agent_deep_research_timeout", 180)

        result = await _run_research_in_background(
            agent,
            question,
            context,
            timeout=research_timeout,
        )
        if getattr(result, "timed_out", False):
            logger.warning("Agent research API timed out after %ss", research_timeout)
            return ResearchResponse(
                success=False,
                content="",
                sources=[],
                token_usage=0,
                error=f"Deep research timed out after {research_timeout}s",
            )

        return ResearchResponse(
            success=result.success,
            content=result.report,
            sources=[f"Sub-question {i+1}: {q}" for i, q in enumerate(result.sub_questions)],
            token_usage=result.total_tokens,
            error=result.error if not result.success else None,
        )
    except Exception as e:
        logger.error("Agent research API failed: %s", e)
        logger.exception("Agent research error details:")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def agent_chat_stream(request: ChatRequest):
    """
    Chat with the AI Agent, streaming progress via SSE.
    Each SSE event is a JSON object with a 'type' field:
      - thinking: AI is deciding next action
      - tool_start: a tool call has begun
      - tool_done: a tool call finished
      - generating: final answer being generated
      - done: analysis complete, contains 'content' and 'success'
      - error: error occurred, contains 'message'
    """
    config = get_config()
    if not config.is_agent_available():
        raise HTTPException(status_code=400, detail="Agent mode is not enabled")

    session_id = request.session_id or str(uuid.uuid4())
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    # Pass explicit skills into context for the orchestrator.
    # Direct assignment so caller-provided skills always take precedence.
    skills = request.effective_skills
    stream_ctx = dict(request.context or {})
    if skills is not None:
        stream_ctx["skills"] = skills

    def progress_callback(event: dict):
        # Enrich tool events with display names
        if event.get("type") in ("tool_start", "tool_done"):
            tool = event.get("tool", "")
            event["display_name"] = TOOL_DISPLAY_NAMES.get(tool, tool)
        asyncio.run_coroutine_threadsafe(queue.put(event), loop)

    def run_sync():
        try:
            executor = _build_executor(config, skills or None)
            result = executor.chat(
                message=request.message,
                session_id=session_id,
                progress_callback=progress_callback,
                context=stream_ctx,
            )
            asyncio.run_coroutine_threadsafe(
                queue.put({
                    "type": "done",
                    "success": result.success,
                    "content": result.content,
                    "error": result.error,
                    "total_steps": result.total_steps,
                    "session_id": session_id,
                }),
                loop,
            )
        except Exception as exc:
            logger.error(f"Agent stream error: {exc}")
            asyncio.run_coroutine_threadsafe(
                queue.put({"type": "error", "message": str(exc)}),
                loop,
            )

    async def event_generator():
        # Start executor in a thread so we don't block the event loop
        fut = loop.run_in_executor(None, run_sync)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=300.0)
                except asyncio.TimeoutError:
                    yield "data: " + json.dumps({"type": "error", "message": "分析超时"}, ensure_ascii=False) + "\n\n"
                    break
                yield "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"
                if event.get("type") in ("done", "error"):
                    break
        finally:
            try:
                await asyncio.wait_for(fut, timeout=5.0)
            except asyncio.CancelledError:
                pass
            except asyncio.TimeoutError:
                # Cleanup taking longer than 5s is treated as an expected timeout; no warning.
                logger.debug("agent executor cleanup timed out after 5s for session %s", session_id)
            except Exception as exc:
                logger.warning("agent executor cleanup error (ignored): %s", exc, exc_info=True)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ============================================================
# Chat session export endpoint
# ============================================================

from api.v1.schemas.history import ExportFormatEnum
from datetime import datetime

@router.get("/chat/sessions/{session_id}/export")
async def export_chat_session(
    session_id: str,
    format: ExportFormatEnum = Query(default=ExportFormatEnum.MD, description="导出格式: md, docx, rtf, html, pdf"),
):
    """
    Export chat session content in specified format.
    
    Args:
        session_id: Chat session ID
        format: Export format (md, docx, rtf, html, pdf)
    
    Returns:
        File response with the exported content
    """
    from fastapi.responses import FileResponse
    from pathlib import Path
    from src.storage import get_db
    from src.services.report_export_service import ReportExportService
    
    # Get chat messages from database
    db = get_db()
    messages = db.get_conversation_messages(session_id, limit=1000)
    
    if not messages:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "session_not_found",
                "message": f"Session {session_id} not found or empty"
            }
        )
    
    # Format messages as Markdown
    markdown_lines = ["# 问股会话", ""]
    for msg in messages:
        role_label = "用户" if msg.get("role") == "user" else "AI"
        markdown_lines.append(f"## {role_label}")
        markdown_lines.append("")
        markdown_lines.append(msg.get("content", ""))
        markdown_lines.append("")
    
    markdown_content = "\n".join(markdown_lines)
    
    # Export based on format
    try:
        if format == ExportFormatEnum.MD:
            # Generate filename
            now = datetime.now()
            date_str = now.strftime("%Y%m%d")
            time_str = now.strftime("%H%M")
            filename = f"问股_{date_str}_{time_str}.md"
            
            reports_dir = Path(__file__).parent.parent.parent.parent / 'reports'
            reports_dir.mkdir(parents=True, exist_ok=True)
            filepath = reports_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            
            return FileResponse(
                path=str(filepath),
                media_type="text/markdown",
                filename=filename
            )
        
        elif format == ExportFormatEnum.DOCX:
            filepath_str = ReportExportService.export_to_docx(markdown_content)
            filepath = Path(filepath_str)
            return FileResponse(
                path=str(filepath),
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                filename=filepath.name
            )
        
        elif format == ExportFormatEnum.RTF:
            filepath_str = ReportExportService.export_to_rtf(markdown_content)
            filepath = Path(filepath_str)
            return FileResponse(
                path=str(filepath),
                media_type="application/rtf",
                filename=filepath.name
            )
        
        elif format == ExportFormatEnum.HTML:
            filepath_str = ReportExportService.export_to_html(markdown_content)
            filepath = Path(filepath_str)
            return FileResponse(
                path=str(filepath),
                media_type="text/html",
                filename=filepath.name
            )
        
        elif format == ExportFormatEnum.PDF:
            filepath_str = ReportExportService.export_to_pdf(markdown_content)
            filepath = Path(filepath_str)
            return FileResponse(
                path=str(filepath),
                media_type="application/pdf",
                filename=filepath.name
            )
        
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    except Exception as e:
        logger.error(f"Failed to export chat session: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "export_failed",
                "message": f"Export failed: {str(e)}"
            }
        )


@router.get(
    "/chat/sessions/{session_id}/export-message",
    summary="Export single message from chat session",
    description="Export a single message in various formats (md, docx, pdf, html, rtf)",
)
async def export_chat_message(
    session_id: str,
    message_id: str = Query(..., description="ID or index of the message to export"),
    format: ExportFormatEnum = Query(ExportFormatEnum.MD, description="Export format"),
) -> Any:
    """
    Export a single message from a chat session.
    
    This endpoint allows exporting individual messages in various formats.
    The message content is converted using ReportExportService for consistent formatting.
    
    Note: message_id can be either:
    - A numeric string representing the message index (0-based)
    - The actual message ID from the database
    """
    from fastapi.responses import FileResponse, Response
    from pathlib import Path
    from src.storage import get_db
    from src.services.report_export_service import ReportExportService
    from datetime import datetime
    
    try:
        # Get chat messages from database
        db = get_db()
        messages = db.get_conversation_messages(session_id, limit=1000)
        
        if not messages:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "session_not_found",
                    "message": f"Session {session_id} not found or empty"
                }
            )
        
        # Find the specific message
        target_message = None
        
        # First, try to interpret message_id as an index (for frontend compatibility)
        try:
            msg_index = int(message_id)
            if 0 <= msg_index < len(messages):
                target_message = messages[msg_index]
                logger.debug(f"Found message by index: {msg_index}")
        except (ValueError, IndexError):
            pass
        
        # If not found by index, try to find by ID (UUID or database ID)
        if not target_message:
            for msg in messages:
                # Match by string comparison (works for both UUID and numeric IDs)
                if str(msg.get('id')) == str(message_id):
                    target_message = msg
                    logger.debug(f"Found message by ID: {message_id}")
                    break
        
        # If still not found, try to match by content hash as fallback
        if not target_message:
            logger.warning(f"Message {message_id} not found in session {session_id}. Available message IDs: {[m.get('id') for m in messages]}")
        
        if not target_message:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "message_not_found",
                    "message": f"Message {message_id} not found in session {session_id}"
                }
            )
        
        # Generate markdown content for the single message
        role_label = "用户" if target_message.get("role") == "user" else "AI"
        
        markdown_content = f"""# 问股会话 - 单条消息导出

## {role_label}

{target_message.get("content", "")}
"""
        
        # Generate filename
        now = datetime.now()
        date_str = now.strftime("%Y%m%d")
        time_str = now.strftime("%H%M")
        filename_base = f"{role_label}_消息_{date_str}_{time_str}"
        
        # Export based on format
        if format == ExportFormatEnum.MD:
            # Add UTF-8 BOM to ensure proper encoding in all editors
            markdown_with_bom = '\ufeff' + markdown_content
            return Response(
                content=markdown_with_bom.encode('utf-8'),
                media_type="text/markdown;charset=utf-8",
                headers={
                    "Content-Disposition": f"attachment; filename*=UTF-8''{filename_base}.md"
                }
            )
        
        elif format == ExportFormatEnum.DOCX:
            filepath_str = ReportExportService.export_to_docx(markdown_content)
            filepath = Path(filepath_str)
            return FileResponse(
                path=str(filepath),
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                filename=f"{filename_base}.docx"
            )
        
        elif format == ExportFormatEnum.RTF:
            filepath_str = ReportExportService.export_to_rtf(markdown_content)
            filepath = Path(filepath_str)
            return FileResponse(
                path=str(filepath),
                media_type="application/rtf",
                filename=f"{filename_base}.rtf"
            )
        
        elif format == ExportFormatEnum.HTML:
            filepath_str = ReportExportService.export_to_html(markdown_content)
            filepath = Path(filepath_str)
            return FileResponse(
                path=str(filepath),
                media_type="text/html;charset=utf-8",
                filename=f"{filename_base}.html"
            )
        
        elif format == ExportFormatEnum.PDF:
            filepath_str = ReportExportService.export_to_pdf(markdown_content)
            filepath = Path(filepath_str)
            # URL-encode the filename for PDF to avoid browser issues
            from urllib.parse import quote
            encoded_filename = quote(f"{filename_base}.pdf", safe='')
            return FileResponse(
                path=str(filepath),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
                }
            )
        
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export chat message: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "export_failed",
                "message": f"Export failed: {str(e)}"
            }
        )
