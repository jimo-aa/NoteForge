<#
.SYNOPSIS
  NoteForge Security Audit — runs npm audit, cargo audit, and Gradle dependencyCheck.
.DESCRIPTION
  Scans all three platform layers for known vulnerabilities.
  Exits with code 0 only when all audits pass (or known issues are ignored).
.EXAMPLE
  ./scripts/security-audit.ps1
#>

$ErrorActionPreference = 'Continue'
$exitCode = 0
$ROOT = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   NoteForge Security Audit          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan

# ── 1. npm audit ──
Write-Host "`n── 1/3: npm audit ──" -ForegroundColor Yellow
Push-Location "$ROOT\desktop"
try {
  npm audit --audit-level=high 2>&1 | Tee-Object -Variable npmResult
  if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ npm audit found issues (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
    # Non-zero exit from npm audit = vulnerabilities found
    # This is informational for now; we only fail on high/critical
    if ($npmResult -match "high|critical") {
      Write-Host "✗ npm audit: HIGH/CRITICAL vulnerabilities detected" -ForegroundColor Red
      $exitCode = 1
    }
  } else {
    Write-Host "✓ npm audit: passed" -ForegroundColor Green
  }
} catch {
  Write-Host "✗ npm audit: failed to run — $_" -ForegroundColor Red
  $exitCode = 1
} finally {
  Pop-Location
}

# ── 2. cargo audit ──
Write-Host "`n── 2/3: cargo audit ──" -ForegroundColor Yellow
Push-Location "$ROOT\core"
try {
  # Check if cargo-audit is installed
  $auditInstalled = cargo audit --version 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  → Installing cargo-audit..." -ForegroundColor DarkYellow
    cargo install cargo-audit 2>&1 | Out-Null
  }
  cargo audit 2>&1 | Tee-Object -Variable cargoResult
  if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ cargo audit: vulnerabilities found (exit code: $LASTEXITCODE)" -ForegroundColor Red
    $exitCode = 1
  } else {
    Write-Host "✓ cargo audit: passed" -ForegroundColor Green
  }
} catch {
  Write-Host "✗ cargo audit: failed to run — $_" -ForegroundColor Red
  $exitCode = 1
} finally {
  Pop-Location
}

# ── 3. Gradle dependencyCheck ──
Write-Host "`n── 3/3: Gradle dependencyCheck ──" -ForegroundColor Yellow
Push-Location "$ROOT\backend"
try {
  ./gradlew dependencyCheckAnalyze 2>&1 | Tee-Object -Variable gradleResult
  if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Gradle dependencyCheck: vulnerabilities found (exit code: $LASTEXITCODE)" -ForegroundColor Red
    $exitCode = 1
  } else {
    Write-Host "✓ Gradle dependencyCheck: passed" -ForegroundColor Green
  }
} catch {
  Write-Host "✗ Gradle dependencyCheck: failed to run — $_" -ForegroundColor Red
  $exitCode = 1
} finally {
  Pop-Location
}

# ── Summary ──
Write-Host "`n╔══════════════════════════════════════╗" -ForegroundColor Cyan
if ($exitCode -eq 0) {
  Write-Host "║   ✓ All security audits passed       ║" -ForegroundColor Green
} else {
  Write-Host "║   ✗ Some audits reported issues      ║" -ForegroundColor Red
}
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
exit $exitCode
