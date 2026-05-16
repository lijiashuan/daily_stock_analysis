# Scheduler Status Check Implementation

**Date**: 2026-05-16  
**Issue**: 启动调度器按钮没有状态检查，已在运行时仍尝试启动

---

## Implementation Summary

### Backend Changes

#### 1. SimulationScheduler Service (`src/services/simulation_scheduler.py`)

**Added `get_status()` method**:
```python
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
```

**Modified `start()` method**:
- Returns status dict instead of None
- Checks if already running before starting
- Returns `{"status": "already_running"}` if already running

**Modified `stop()` method**:
- Returns status dict instead of None
- Checks if not running before stopping
- Returns `{"status": "not_running"}` if not running

#### 2. API Endpoints (`api/v1/endpoints/simulation.py`)

**Updated endpoints**:
- `POST /scheduler/start` - Returns proper error if already running (400)
- `POST /scheduler/stop` - Returns proper error if not running (400)
- `GET /scheduler/status` - **NEW** endpoint for status check

**Status API Response**:
```json
{
  "running": true,
  "job_count": 3,
  "jobs": [
    {
      "id": "daily_suggestions",
      "name": "生成每日交易建议",
      "next_run_time": "2026-05-17 09:00:00"
    },
    {
      "id": "midday_check",
      "name": "盘中检查",
      "next_run_time": "2026-05-17 11:30:00"
    },
    {
      "id": "daily_review",
      "name": "生成每日复盘报告",
      "next_run_time": "2026-05-17 15:30:00"
    }
  ]
}
```

### Frontend Changes

#### 1. State Management (`apps/dsa-web/src/pages/SimulationTradingPage.tsx`)

**Added state**:
```typescript
const [schedulerRunning, setSchedulerRunning] = useState(false);
```
Previously hardcoded to `false`, now dynamically managed.

**Added status check function**:
```typescript
const checkSchedulerStatus = async () => {
  try {
    const response = await fetch('/api/v1/simulation/scheduler/status');
    if (response.ok) {
      const data = await response.json();
      setSchedulerRunning(data.running || false);
      console.log('[checkSchedulerStatus] Status:', data);
    }
  } catch (error) {
    console.error('[checkSchedulerStatus] Error:', error);
  }
};
```

**Added lifecycle hook**:
```typescript
useEffect(() => {
  checkSchedulerStatus();
}, []);
```
Checks status on component mount.

#### 2. Button Handlers

**Updated `handleStartScheduler()`**:
- Calls `checkSchedulerStatus()` after successful start
- Refreshes UI state

**Updated `handleStopScheduler()`**:
- Calls `checkSchedulerStatus()` after successful stop
- Refreshes UI state

#### 3. UI Improvements

**Added status alert**:
```tsx
<Alert
  message={`调度器状态: ${schedulerRunning ? '运行中' : '已停止'}`}
  type={schedulerRunning ? 'success' : 'warning'}
  showIcon
/>
```

**Updated buttons**:
- 启动/停止调度器 - Dynamic based on state
- 触发每日建议 - Unchanged
- **刷新状态** - New button to manually refresh status

---

## User Experience

### Before
1. User clicks "启动调度器"
2. If already running → 500 error
3. No indication of current state
4. No way to refresh state

### After
1. Page loads → Automatically checks scheduler status
2. Shows status alert (运行中/已停止)
3. Button changes based on state:
   - 运行中 → "停止调度器" (default button)
   - 已停止 → "启动调度器" (primary button)
4. Clicking "刷新状态" refreshes both scheduler and account status
5. Actions automatically refresh state after completion

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/simulation/scheduler/status` | 获取调度器状态 |
| POST | `/api/v1/simulation/scheduler/start` | 启动调度器 |
| POST | `/api/v1/simulation/scheduler/stop` | 停止调度器 |
| POST | `/api/v1/simulation/scheduler/daily-suggestions` | 触发每日建议 |

---

## Files Modified

### Backend
- `src/services/simulation_scheduler.py` - Added status tracking
- `api/v1/endpoints/simulation.py` - Added status endpoint

### Frontend
- `apps/dsa-web/src/pages/SimulationTradingPage.tsx` - State management and UI

---

## Testing

### Manual Test Steps

1. **访问页面**
   ```
   http://localhost:5173/simulation
   ```

2. **检查初始状态**
   - 查看"调度器状态"提示框
   - 应该显示"运行中"或"已停止"

3. **测试启动**
   - 如果状态是"已停止"，点击"启动调度器"
   - 应该成功启动并自动刷新状态

4. **测试已运行检测**
   - 如果状态是"运行中"，再次点击"启动调度器"
   - 应该显示"调度器已在运行中"

5. **测试停止**
   - 如果状态是"运行中"，点击"停止调度器"
   - 应该成功停止并自动刷新状态

6. **测试刷新**
   - 点击"刷新状态"按钮
   - 状态应该更新

### Console Logs
```
[checkSchedulerStatus] Status: {running: true, job_count: 3, jobs: [...]}
[handleStartScheduler] Starting scheduler...
[handleStartScheduler] Response status: 200
[handleStartScheduler] Response: {message: "调度器已启动"}
```

---

## Technical Details

### APScheduler Integration

The scheduler uses APScheduler's `BackgroundScheduler`:
```python
self.scheduler = BackgroundScheduler()
self.scheduler.running  # Boolean flag
self.scheduler.get_jobs()  # List of scheduled jobs
```

### Error Handling

**HTTP Status Codes**:
- `200` - Success
- `400` - Bad request (already running/not running)
- `500` - Server error

**Frontend Error Messages**:
- Extract error detail from API response
- Display user-friendly messages

---

## Future Enhancements

1. **Auto-refresh**: Periodically check status (e.g., every 30 seconds)
2. **Job details modal**: Show detailed job information in a modal
3. **Job execution logs**: Show last execution time and result
4. **WebSocket**: Real-time status updates
5. **Job enable/disable**: Toggle individual jobs without stopping scheduler

---

**Implementation Date**: 2026-05-16  
**Build Status**: ✅ Success  
**Test Status**: Pending user testing
