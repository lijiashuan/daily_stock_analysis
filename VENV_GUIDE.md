# 虚拟环境使用指南

## 快速激活虚拟环境

### 方法 1：使用快捷脚本（推荐）
```powershell
.\activate_env.ps1
```

### 方法 2：手动激活
```powershell
.\venv\Scripts\Activate.ps1
```

### 方法 3：自动激活（永久生效）
已在 PowerShell 配置文件中设置自动激活，每次打开 PowerShell 都会自动激活虚拟环境。

配置文件位置：`$PROFILE` (D:\Users\jys\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1)

## 验证虚拟环境是否激活成功

```powershell
# 检查 Python 路径
where python
# 应该显示：D:\py2026\daily_stock_analysis\venv\Scripts\python.exe

# 检查 pip 路径
where pip
# 应该显示：D:\py2026\daily_stock_analysis\venv\Scripts\pip.exe

# 查看已安装的包
pip list
```

## VS Code 配置

已创建 `.vscode/settings.json` 配置文件，VS Code 会自动：
- 使用虚拟环境的 Python 解释器
- 在终端中自动激活虚拟环境

如果需要手动选择解释器：
1. 按 `Ctrl+Shift+P`
2. 输入 "Python: Select Interpreter"
3. 选择 `.\venv\Scripts\python.exe`

## 常见问题

### Q1: 为什么虚拟环境会失效？
**原因：**
- 打开了新的 PowerShell 窗口
- 重启了终端或编辑器
- 运行了 `deactivate` 命令
- PATH 环境变量被其他程序修改

**解决：**
- 使用自动激活配置（已设置）
- 使用快捷脚本 `.\activate_env.ps1`
- 在 VS Code 中使用内置终端

### Q2: 提示 "ModuleNotFoundError"？
**原因：** 使用了系统 Python 而非虚拟环境

**解决：**
```powershell
# 先激活虚拟环境
.\activate_env.ps1

# 然后再运行程序
python server.py
```

### Q3: 如何完全重置虚拟环境？
```powershell
# 删除现有虚拟环境
Remove-Item -Recurse -Force venv

# 重新创建
python -m venv venv

# 激活并安装依赖
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Q4: 如何退出虚拟环境？
```powershell
deactivate
```

## 常用命令

```powershell
# 启动后端服务
python server.py

# 启动 Web UI
python main.py --webui-only

# 运行分析任务
python main.py

# 安装新依赖
pip install <package_name>

# 更新依赖列表
pip freeze > requirements.txt
```

## 故障排查

如果遇到问题，按以下步骤排查：

1. **检查虚拟环境是否存在**
   ```powershell
   Test-Path .\venv\Scripts\Activate.ps1
   # 应返回 True
   ```

2. **检查 Python 版本**
   ```powershell
   python --version
   # 应显示 Python 3.x.x
   ```

3. **检查关键依赖**
   ```powershell
   pip show python-dotenv fastapi sqlalchemy
   ```

4. **重新安装依赖**
   ```powershell
   pip install -r requirements.txt --force-reinstall
   ```

## 注意事项

⚠️ **重要提示：**
- 始终在激活虚拟环境后运行项目
- 不要将 `venv/` 目录提交到 Git
- 定期更新依赖以保持安全性
- 遇到问题时优先检查虚拟环境状态
