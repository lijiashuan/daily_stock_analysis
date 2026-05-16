# 快速激活虚拟环境脚本
$venvPath = "$PSScriptRoot\venv\Scripts\Activate.ps1"

if (Test-Path $venvPath) {
    & $venvPath
    Write-Host "✓ 虚拟环境已激活" -ForegroundColor Green
    Write-Host "Python: $(where python | Select-Object -First 1)" -ForegroundColor Cyan
} else {
    Write-Host "✗ 虚拟环境不存在: $venvPath" -ForegroundColor Red
}
