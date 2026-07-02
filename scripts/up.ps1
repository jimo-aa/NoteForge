#!/usr/bin/env pwsh
# NoteForge — 全栈启动脚本
# Usage: .\scripts\up.ps1 [dev|prod]

param (
    [string]$Mode = "dev"
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   NoteForge — 全栈启动               ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan

# ── 1. 启动基础设施 ──
Write-Host "`n🐳 启动基础设施 (PostgreSQL/Redis/MinIO)..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\infra"
docker-compose up -d postgres redis minio
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker 启动失败" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ 基础设施已启动" -ForegroundColor Green

# ── 2. 构建 Rust Core ──
Write-Host "`n📦 构建 Rust Core 引擎..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\core"
cargo build --release 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Rust Core 构建成功" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Rust Core 构建失败（可后续单独构建）" -ForegroundColor Red
}

# ── 3. 启动 Tauri 桌面端 ──
Write-Host "`n🖥️  启动 Tauri 桌面端..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\desktop"
npm install --silent 2>&1 | Out-Null

if ($Mode -eq "dev") {
    Start-Process powershell -ArgumentList "-NoExit cd $ProjectRoot\desktop; cargo tauri dev"
    Write-Host "   ✅ Tauri 桌面端开发模式已启动 (新窗口)" -ForegroundColor Green
} else {
    cargo tauri build
    Write-Host "   ✅ Tauri 桌面端构建完成" -ForegroundColor Green
}

# ── 4. 启动 Java 后端 ──
Write-Host "`n☕ 启动 Java 后端..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\backend\note-service"
Start-Process powershell -ArgumentList "-NoExit cd $ProjectRoot\backend\note-service; ./gradlew bootRun"
Write-Host "   ✅ Java 后端正在启动 (新窗口)" -ForegroundColor Green

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   NoteForge MVP 已启动！             ║" -ForegroundColor Cyan
Write-Host "║                                      ║" -ForegroundColor Cyan
Write-Host "║   🐳  PostgreSQL :5432               ║" -ForegroundColor Cyan
Write-Host "║   🐳  Redis      :6379               ║" -ForegroundColor Cyan
Write-Host "║   🐳  MinIO      :9000               ║" -ForegroundColor Cyan
Write-Host "║   🖥️  Desktop   Tauri 开发模式        ║" -ForegroundColor Cyan
Write-Host "║   ☕  Backend   :8081                 ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
