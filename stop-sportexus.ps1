# SPORTEXUS — Graceful Stop Utility
# Stops all running application services and tunnels WITHOUT touching persistent data.

$ErrorActionPreference = 'SilentlyContinue'

Write-Host ''
Write-Host '==================================================' -ForegroundColor Cyan
Write-Host '          STOPPING SPORTEXUS SERVICES             ' -ForegroundColor Yellow
Write-Host '==================================================' -ForegroundColor Cyan

# 1. Stop Cloudflare Tunnel
Write-Host '[*] Stopping Cloudflare Tunnel...' -ForegroundColor Cyan
Get-Process -Name 'cloudflared' | Stop-Process -Force
Write-Host '    + Cloudflare Tunnel stopped.' -ForegroundColor Green

# 2. Stop Docker Compose services if running (DO NOT delete volumes)
$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
    Write-Host '[*] Checking Docker services...' -ForegroundColor Cyan
    docker compose -f docker-compose.selfhost.yml stop 2>$null
}

# 3. Stop Node web and API background processes
Write-Host '[*] Stopping web and API daemons...' -ForegroundColor Cyan
Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -like '*@academy/web*' -or
    $_.CommandLine -like '*apps/api/dist/main.js*' -or
    $_.CommandLine -like '*next start*'
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    Write-Host "    + Stopped PID $($_.ProcessId)" -ForegroundColor DarkGray
}

Write-Host ''
Write-Host '==================================================' -ForegroundColor Green
Write-Host '  All Sportexus public services stopped safely.   ' -ForegroundColor Green
Write-Host '  Local database & storage volumes PRESERVED.     ' -ForegroundColor White
Write-Host '==================================================' -ForegroundColor Green
Write-Host ''
