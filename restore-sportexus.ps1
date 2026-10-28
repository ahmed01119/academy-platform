# SPORTEXUS — Database Restore Utility
# Restores data into Sportexus PostgreSQL database from a chosen backup file.
param (
    [string]$BackupFile
)

$ErrorActionPreference = 'Stop'

Write-Host '==================================================' -ForegroundColor Cyan
Write-Host '  SPORTEXUS — Local Database Restore Utility      ' -ForegroundColor Yellow
Write-Host '==================================================' -ForegroundColor Cyan

if (-not $BackupFile) {
    $latest = Get-ChildItem -Path 'backups' -Filter 'sportexus_backup_*.json' -ErrorAction SilentlyContinue | Sort-Object CreationTime -Descending | Select-Object -First 1
    if ($latest) {
        $BackupFile = $latest.FullName
        Write-Host "[*] No file specified. Auto-selected latest backup: $($latest.Name)" -ForegroundColor Yellow
    } else {
        Write-Error "No backup files found in 'backups' directory."
        exit 1
    }
}

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found at: $BackupFile"
    exit 1
}

node scripts/db-restore.js $BackupFile

Write-Host '==================================================' -ForegroundColor Green
Write-Host '  Database Restore Succeeded!                     ' -ForegroundColor Green
Write-Host '==================================================' -ForegroundColor Green
