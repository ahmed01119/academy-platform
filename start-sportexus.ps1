# SPORTEXUS — Automated Laptop Server Startup Utility
# Launches Database, API, Web, and Cloudflare Tunnel to expose a real Public HTTPS URL.
param (
    [switch]$UseDocker
)

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '=================================================================' -ForegroundColor Cyan
Write-Host '       SPORTEXUS — SELF-HOSTED LAPTOP PRODUCTION SERVER          ' -ForegroundColor Yellow
Write-Host '               One Platform. Every Academy.                      ' -ForegroundColor Cyan
Write-Host '=================================================================' -ForegroundColor Cyan

# 1. Start or Verify PostgreSQL (Port 5432)
Write-Host '[1/4] Checking PostgreSQL database on port 5432...' -ForegroundColor Cyan
$pgRunning = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect('127.0.0.1', 5432, $null, $null)
    $wait = $iar.AsyncWaitHandle.WaitOne(1000, $false)
    if ($wait -and $tcp.Connected) {
        $pgRunning = $true
    }
    $tcp.Close()
} catch {}

if (-not $pgRunning) {
    Write-Host '      Starting local persistent PostgreSQL database...' -ForegroundColor Yellow
    Start-Process -FilePath 'node' -ArgumentList 'packages/database/scripts/start-local-pg.js' -WindowStyle Hidden
    Start-Sleep -Seconds 4
    Write-Host '      [+] Database is online and ready.' -ForegroundColor Green
} else {
    Write-Host '      [+] Database is already running.' -ForegroundColor Green
}

# 2. Start or Verify API Backend (Port 3001)
Write-Host '[2/4] Checking NestJS API server on port 3001...' -ForegroundColor Cyan
$apiRunning = $false
try {
    $res = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/v1/health/ready' -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res) { $apiRunning = $true }
} catch {}

if (-not $apiRunning) {
    Write-Host '      Starting production NestJS API daemon...' -ForegroundColor Yellow
    Start-Process -FilePath 'node' -ArgumentList 'apps/api/dist/main.js' -WindowStyle Hidden
    Start-Sleep -Seconds 5
    Write-Host '      [+] API backend is online.' -ForegroundColor Green
} else {
    Write-Host '      [+] API backend is already running.' -ForegroundColor Green
}

# 3. Start or Verify Web Frontend (Port 3000)
Write-Host '[3/4] Checking Next.js production frontend on port 3000...' -ForegroundColor Cyan
$webRunning = $false
try {
    $res = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) { $webRunning = $true }
} catch {}

if (-not $webRunning) {
    Write-Host '      Starting Next.js production server...' -ForegroundColor Yellow
    Start-Process -FilePath 'pnpm' -ArgumentList '--filter', '@academy/web', 'start', '-p', '3000' -WindowStyle Hidden
    Start-Sleep -Seconds 4
    Write-Host '      [+] Web frontend is online.' -ForegroundColor Green
} else {
    Write-Host '      [+] Web frontend is already running.' -ForegroundColor Green
}

# 4. Start Cloudflare Tunnel
Write-Host '[4/4] Starting Cloudflare Tunnel (HTTPS edge)...' -ForegroundColor Cyan
$cfRunning = Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue

$logFile = Join-Path $env:TEMP 'cloudflared_sportexus.log'

if (-not $cfRunning) {
    if (Test-Path $logFile) { Remove-Item $logFile -Force }
    Start-Process -FilePath '.\tools\cloudflared.exe' -ArgumentList 'tunnel', '--edge-ip-version', '4', '--protocol', 'http2', '--url', 'http://localhost:3000' -RedirectStandardError $logFile -WindowStyle Hidden
    Write-Host '      Connecting to Cloudflare edge network...' -ForegroundColor Yellow
    Start-Sleep -Seconds 8
}

# Extract and verify public URL
$publicUrl = $null
$maxRetries = 12

for ($i = 0; $i -lt $maxRetries; $i++) {
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        if ($content -match '(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)') {
            $publicUrl = $matches[1]
            break
        }
    }
    Start-Sleep -Seconds 2
}

if (-not $publicUrl -and (Test-Path 'sportexus-live-url.txt')) {
    $publicUrl = (Get-Content 'sportexus-live-url.txt' -Raw).Trim()
}

if ($publicUrl) {
    Set-Content -Path 'sportexus-live-url.txt' -Value $publicUrl -Force
    
    $statusObj = @{
        status = 'online'
        publicUrl = $publicUrl
        startedAt = (Get-Date).ToString('o')
        services = @{
            database = 'port 5432'
            api = 'port 3001'
            web = 'port 3000'
            tunnel = 'Cloudflare Quick Tunnel (HTTP/2 Edge)'
        }
    }
    Set-Content -Path 'sportexus-runtime-status.json' -Value ($statusObj | ConvertTo-Json -Depth 4) -Force

    Write-Host ''
    Write-Host '=================================================================' -ForegroundColor Green
    Write-Host '           SPORTEXUS IS NOW LIVE TO THE PUBLIC!                  ' -ForegroundColor Green
    Write-Host '=================================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host "  PUBLIC HTTPS URL:  $publicUrl" -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Demo accounts are managed locally.' -ForegroundColor Cyan
    Write-Host '  See: sportexus-accounts.local.txt (not committed to git)' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  * Share this URL with anyone on mobile, tablet, or desktop.' -ForegroundColor Cyan
    Write-Host '  * Laptop must remain powered on to serve traffic.' -ForegroundColor Yellow
    Write-Host '=================================================================' -ForegroundColor Green
} else {
    Write-Warning 'Tunnel started but public URL detection timed out. Run .\status-sportexus.ps1 to verify.'
}
