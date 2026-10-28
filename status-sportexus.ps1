# SPORTEXUS — Server Status Checker
param (
    [switch]$Detailed
)

Write-Host ''
Write-Host '==================================================' -ForegroundColor Cyan
Write-Host '          SPORTEXUS SERVER STATUS REPORT          ' -ForegroundColor Yellow
Write-Host '==================================================' -ForegroundColor Cyan

# 1. Check PostgreSQL Database (port 5432)
$dbStatus = 'DOWN'
$dbColor = 'Red'
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect('127.0.0.1', 5432, $null, $null)
    $wait = $iar.AsyncWaitHandle.WaitOne(1000, $false)
    if ($wait -and $tcp.Connected) {
        $dbStatus = 'ONLINE (Port 5432)'
        $dbColor = 'Green'
    }
    $tcp.Close()
} catch {}
Write-Host "  Database (PostgreSQL):   $dbStatus" -ForegroundColor $dbColor

# 2. Check API Server (port 3001)
$apiStatus = 'DOWN'
$apiColor = 'Red'
try {
    $res = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/v1/health/ready' -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($res) {
        $apiStatus = "ONLINE (Status: $($res.status))"
        $apiColor = 'Green'
    }
} catch {}
Write-Host "  Backend API (NestJS):    $apiStatus" -ForegroundColor $apiColor

# 3. Check Next.js Frontend (port 3000)
$webStatus = 'DOWN'
$webColor = 'Red'
try {
    $res = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) {
        $webStatus = 'ONLINE (Port 3000)'
        $webColor = 'Green'
    }
} catch {}
Write-Host "  Frontend (Next.js):      $webStatus" -ForegroundColor $webColor

# 4. Check Cloudflare Tunnel
$tunnelStatus = 'DOWN'
$tunnelColor = 'Red'
$publicUrl = $null

if (Test-Path 'sportexus-live-url.txt') {
    $publicUrl = (Get-Content 'sportexus-live-url.txt' -Raw).Trim()
}

$cfProcess = Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue
if ($cfProcess) {
    $tunnelStatus = "ONLINE (PID: $($cfProcess.Id))"
    $tunnelColor = 'Green'
}

Write-Host "  Cloudflare Tunnel:       $tunnelStatus" -ForegroundColor $tunnelColor

if ($publicUrl) {
    Write-Host "  Public HTTPS URL:        $publicUrl" -ForegroundColor Cyan
    # Test Public Connectivity
    try {
        $pubRes = Invoke-RestMethod -Uri "$publicUrl/v1/health/ready" -TimeoutSec 12 -ErrorAction SilentlyContinue
        if ($pubRes) {
            Write-Host "  Public Access Check:     VERIFIED ONLINE (HTTP 200)" -ForegroundColor Green
        } else {
            Write-Host "  Public Access Check:     UNREACHABLE" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  Public Access Check:     FAILED TO CONNECT" -ForegroundColor Red
    }
} else {
    Write-Host "  Public HTTPS URL:        NOT FOUND (Run .\start-sportexus.ps1)" -ForegroundColor Yellow
}

# 5. Disk Space
Write-Host ''
Write-Host '--- Storage & Memory ---' -ForegroundColor DarkGray
Get-PSDrive C, D -ErrorAction SilentlyContinue | ForEach-Object {
    $freeGb = [math]::Round($_.Free / 1GB, 1)
    $usedGb = [math]::Round($_.Used / 1GB, 1)
    Write-Host "  Drive $($_.Name): Free ${freeGb} GB / Used ${usedGb} GB" -ForegroundColor White
}

Write-Host '==================================================' -ForegroundColor Cyan
Write-Host ''
