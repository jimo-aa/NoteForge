#!/usr/bin/env pwsh
# NoteForge — 运行 Rust Core 测试
# Usage: .\scripts\test.ps1

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location "$ProjectRoot\core"

Write-Host "🧪 运行 Rust Core 测试..." -ForegroundColor Cyan
cargo test

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 所有测试通过!" -ForegroundColor Green
} else {
    Write-Host "`n❌ 测试失败" -ForegroundColor Red
    exit 1
}
