# Tauri Updater Setup Guide

> 本文档说明如何为 NoteForge 桌面端配置 Tauri 2 自动更新机制。

---

## 1. 生成签名密钥

Tauri 使用 Ed25519 密钥对签名更新包。在本地生成：

```bash
# 安装 Tauri CLI（如未安装）
cargo install tauri-cli --version "^2"

# 生成签名密钥（将保存到 ~/.tauri/noteforge.key）
tauri signer generate -w ~/.tauri/noteforge.key
```

系统会提示输入密码——**务必记住此密码**。

生成后你会看到：
- 私钥文件：`~/.tauri/noteforge.key`
- 公钥字符串（屏幕上显示），类似：`dW50dGhpcyBpcyBhIHRlc3Qg...`

## 2. 配置公钥到 tauri.conf.json

将公钥复制到 `desktop/src-tauri/tauri.conf.json`：

```json
"plugins": {
  "updater": {
    "pubkey": "刚才生成的公钥字符串",
    "endpoints": [
      "https://github.com/noteforge/noteforge/releases/latest/download/update-{target}.json"
    ],
    "windows": {
      "installMode": "passive"
    }
  }
}
```

## 3. 设置 GitHub Secrets

将私钥和密码添加到 GitHub 仓库的 Secrets：

| Secret | 值 |
|--------|-----|
| `TAURI_PRIVATE_KEY` | `~/.tauri/noteforge.key` 的内容（整个文件文本） |
| `TAURI_KEY_PASSWORD` | 生成密钥时输入的密码 |

### macOS 额外 Secrets（如需要签名 DMG）

| Secret | 值 |
|--------|-----|
| `APPLE_SIGNING_IDENTITY` | Apple Developer 签名标识 |
| `APPLE_CERTIFICATE` | Base64 编码的 Apple 开发者证书 |
| `APPLE_CERTIFICATE_PASSWORD` | 证书密码 |
| `APPLE_ID` | Apple ID 邮箱 |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Team ID |

## 4. 发布新版流程

### 4.1 更新版本号

编辑 `desktop/src-tauri/tauri.conf.json` 中的 `version` 字段：

```json
"version": "1.0.0"
```

同时更新 `desktop/package.json` 中的 `version` 字段。

### 4.2 更新 CHANGELOG

在 `CHANGELOG.md` 中添加发布说明。

### 4.3 打 Tag 并推送

```bash
git add .
git commit -m "chore: bump version to v1.0.0"
git tag v1.0.0
git push origin main --tags
```

### 4.4 GitHub Actions 自动构建

Tag 推送后，`.github/workflows/release.yml` 会自动：

1. 创建 GitHub Draft Release
2. 在 Windows (MSI) 和 macOS (DMG) 上构建 Tauri 应用
3. 使用 `TAURI_PRIVATE_KEY` 签名构建产物
4. 上传安装包到 Release
5. 生成更新 JSON 清单
6. 发布 Release（从 Draft 转为正式）

## 5. 验证更新

构建完成后：

1. 在已安装的 NoteForge 中检查设置 → 关于 → "检查更新"
2. 应用应检测到新版本并提示下载
3. 更新应自动下载并安装（Windows 为 passive 模式）

---

## 常见问题

### Q: 更新检查失败？
- 确认 `tauri.conf.json` 中的 `endpoints` URL 是否正确
- 确认 GitHub Release 中的更新 JSON 文件已发布
- 检查网络连接

### Q: 签名验证失败？
- 确认 `pubkey` 与私钥匹配
- 确认 CI 中使用了正确的 `TAURI_PRIVATE_KEY` Secret

### Q: Windows SmartScreen 拦截？
- 需要购买代码签名证书并配置 Windows 签名
- 在 release.yml 中添加 Windows 签名步骤
