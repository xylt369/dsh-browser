# dsh-browser one-click installer for DeepSeek Harness (PowerShell / Windows)
# Installs the browser capability into the `web` profile from npm:
#   - @yeesy369/dsh-browser-playwright  (Playwright provider — headed Edge by default)
#   - @yeesy369/dsh-tool-browser        (browser_* model-facing tools)
#   - @yeesy369/dsh-web-permission      (web/browser permission gate)
# then adds an example allowlist entry to the profile patch.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File install.ps1
# or from the repository root:
#   ./install.ps1

$ErrorActionPreference = 'Stop'

if (-not (Get-Command dsh -ErrorAction SilentlyContinue)) {
  Write-Host '[dsh-browser] dsh CLI not found on PATH. Install DeepSeek Harness first, e.g. `npm i -g @deepseek-ai/dsh` or run it via npx.' -ForegroundColor Red
  exit 1
}

Write-Host '[dsh-browser] Installing browser bundles into the web profile...' -ForegroundColor Cyan
dsh plugin --profile web add @yeesy369/dsh-browser-playwright @yeesy369/dsh-tool-browser @yeesy369/dsh-web-permission
if ($LASTEXITCODE -ne 0) {
  Write-Host '[dsh-browser] Install failed (see output above).' -ForegroundColor Red
  exit $LASTEXITCODE
}

$patchPath = Join-Path $env:USERPROFILE '.dsh\profiles\web\cordis.patch.yml'
if (Test-Path $patchPath) {
  $content = Get-Content $patchPath -Raw
  if ($content -notmatch 'web-permission') {
    $entry = @"

- id: web-permission
  config:
    allowHosts:
      - example.com
"@
    Add-Content -Path $patchPath -Value $entry
    Write-Host '[dsh-browser] Added example.com to the web-permission allowlist (edit cordis.patch.yml to add your own domains).' -ForegroundColor Yellow
  }
} else {
  Write-Host '[dsh-browser] WARNING: cordis.patch.yml not found; skipping allowlist setup.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '[dsh-browser] Done! Restart your profile to load the plugins:' -ForegroundColor Green
Write-Host '  1) Ctrl+C the running `dsh web`, then run `dsh web` again.'
Write-Host '  2) A headed Microsoft Edge window opens on first browser use — keep it open while browsing.'
Write-Host '  3) Logins persist in ~/.dsh/edge-profile.'
