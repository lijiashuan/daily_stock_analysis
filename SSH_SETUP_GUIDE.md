# SSH Key 配置指南

## ✅ 已完成的步骤

1. **SSH Key 已生成**
   - 私钥位置：`C:\Users\admin\.ssh\id_ed25519`
   - 公钥位置：`C:\Users\admin\.ssh\id_ed25519.pub`
   - 密钥类型：ED25519（推荐）

2. **远程仓库已配置为 SSH**
   ```
   origin  git@github.com:lijiashuan/daily_stock_analysis.git (fetch)
   origin  git@github.com:lijiashuan/daily_stock_analysis.git (push)
   ```

## 📋 接下来需要做的步骤

### 步骤 1：复制你的 SSH 公钥

你的 SSH 公钥内容是：
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBJg8H2OBVYY5nsnekEyWqzl1UnlIcYkmjTe2XU7Di1l your_email@example.com
```

或者你可以运行以下命令再次查看：
```powershell
Get-Content ~/.ssh/id_ed25519.pub
```

**请完整复制这行内容**（从 `ssh-ed25519` 开始到邮箱结束）

### 步骤 2：添加到 GitHub

1. 打开浏览器，访问：https://github.com/settings/keys

2. 点击 **"New SSH key"** 按钮

3. 填写表单：
   - **Title**: 给你的电脑起个名字，例如 "My Windows PC" 或 "Daily Stock Analysis PC"
   - **Key type**: 选择 **"Authentication Key"**
   - **Key**: 粘贴你刚才复制的公钥内容

4. 点击 **"Add SSH key"** 按钮

5. 如果提示输入 GitHub 密码，请输入你的 GitHub 账户密码确认

### 步骤 3：测试 SSH 连接

在 PowerShell 中运行：
```powershell
ssh -T git@github.com
```

你应该看到类似这样的消息：
```
Hi lijiashuan! You've successfully authenticated, but GitHub does not provide shell access.
```

如果出现这个提示，说明 SSH 配置成功！✅

### 步骤 4：推送到 GitHub

现在可以推送代码了：
```powershell
git push origin main
```

## 🔧 常见问题

### 问题 1：提示需要 passphrase

如果在推送时提示输入 passphrase，请输入你在生成 SSH key 时设置的密码。

如果你没有设置密码（直接按回车），那么就不会有 passphrase 提示。

### 问题 2：Permission denied (publickey)

如果出现这个错误，可能的原因：
1. SSH key 还没有添加到 GitHub（完成步骤 2）
2. 使用了错误的 SSH key
3. GitHub 账户不匹配

解决方法：
```powershell
# 测试 SSH 连接
ssh -T git@github.com

# 检查使用的 key
ssh-add -l
```

### 问题 3：想重新生成 SSH key

如果需要重新生成：
```powershell
# 删除旧的 key
Remove-Item ~/.ssh/id_ed25519
Remove-Item ~/.ssh/id_ed25519.pub

# 重新生成
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### 问题 4：想切换回 HTTPS

如果想用 HTTPS 而不是 SSH：
```powershell
git remote set-url origin https://github.com/lijiashuan/daily_stock_analysis.git
```

## 💡 提示

- **推荐使用 ED25519**：比 RSA 更安全、更快
- **建议设置 passphrase**：增加安全性
- **一个 key 可以用于多个仓库**：不需要为每个仓库生成新的 key
- **妥善保管私钥**：不要分享 `id_ed25519` 文件

## 📝 当前状态

- ✅ SSH Key 已生成
- ✅ 远程仓库已配置为 SSH
- ⏳ 等待你将公钥添加到 GitHub
- ⏳ 等待你推送代码

添加完公钥后，记得运行 `git push origin main` 推送代码！
