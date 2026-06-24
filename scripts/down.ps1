#!/usr/bin/env pwsh
# NoteForge — 停止脚本
# Usage: .\scripts\down.ps1

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location "$ProjectRoot\infra"

docker-compose down

Write-Host "✅ NoteForge 已停止" -ForegroundColor Green
