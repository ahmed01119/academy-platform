# SPORTEXUS — Automated Database Backup Script
# Creates a timestamped local backup of the Sportexus PostgreSQL database.
param (
    [string]$BackupDir = 'backups',
    [int]$RetentionCount = 10
)

$ErrorActionPreference = 'Stop'

Write-Host '==================================================' -ForegroundColor Cyan
Write-Host '  SPORTEXUS — Local Database Backup Utility       ' -ForegroundColor Yellow
Write-Host '==================================================' -ForegroundColor Cyan

# 1. Run Node.js database export
node scripts/db-backup.js

# 2. If pg_dump is available, also produce raw SQL dump
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($pgDump) {
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $sqlBackup = Join-Path $BackupDir "sportexus_dump_$timestamp.sql"
    Write-Host "[*] Creating raw SQL dump with pg_dump: $sqlBackup" -ForegroundColor Cyan
    try {
        & pg_dump -h 127.0.0.1 -p 5432 -U academy -d academy -F p -f $sqlBackup
        Write-Host '[+] SQL dump complete.' -ForegroundColor Green
    } catch {
        Write-Warning 'pg_dump failed'
    }
}

# 3. Retention cleanup
if (Test-Path $BackupDir) {
    $backups = Get-ChildItem -Path $BackupDir -Filter 'sportexus_backup_*.json' | Sort-Object CreationTime -Descending
    if ($backups.Count -gt $RetentionCount) {
        Write-Host "[*] Pruning older backups..." -ForegroundColor Yellow
        $toDelete = $backups | Select-Object -Skip $RetentionCount
        foreach ($item in $toDelete) {
            Remove-Item $item.FullName -Force
            Write-Host "    - Removed: $($item.Name)" -ForegroundColor DarkGray
        }
    }
}

Write-Host '==================================================' -ForegroundColor Green
Write-Host '  Database Backup Succeeded!                      ' -ForegroundColor Green
Write-Host '==================================================' -ForegroundColor Green
