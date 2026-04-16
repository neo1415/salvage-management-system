# Check Test Database Prerequisites
#
# This script checks if everything is ready for local PostgreSQL testing
#
# Usage:
#   .\scripts\check-test-db-prerequisites.ps1

Write-Host "Checking Test Database Prerequisites" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check 1: PostgreSQL installed
Write-Host "1. Checking PostgreSQL installation..." -ForegroundColor Cyan

try {
    $psqlVersion = psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] PostgreSQL is installed: $psqlVersion" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] PostgreSQL is not installed" -ForegroundColor Red
        Write-Host "   Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "   [FAIL] PostgreSQL is not installed or not in PATH" -ForegroundColor Red
    Write-Host "   Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "   Or add to PATH: C:\Program Files\PostgreSQL\16\bin" -ForegroundColor Yellow
    $allGood = $false
}

Write-Host ""

# Check 2: TEST_DATABASE_URL in .env
Write-Host "2. Checking .env configuration..." -ForegroundColor Cyan

if (Test-Path .env) {
    $envContent = Get-Content .env
    $testDbUrl = $envContent | Where-Object { $_ -match "^TEST_DATABASE_URL=" }
    
    if ($testDbUrl) {
        Write-Host "   [OK] TEST_DATABASE_URL found in .env" -ForegroundColor Green
        $dbUrlValue = ($testDbUrl -split "=", 2)[1].Trim()
        $maskedUrl = $dbUrlValue -replace ":[^:@]+@", ":****@"
        Write-Host "   $maskedUrl" -ForegroundColor Gray
    } else {
        Write-Host "   [FAIL] TEST_DATABASE_URL not found in .env" -ForegroundColor Red
        Write-Host "   Add this line to your .env file:" -ForegroundColor Yellow
        Write-Host "   TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/salvage_test" -ForegroundColor Yellow
        $allGood = $false
    }
} else {
    Write-Host "   [FAIL] .env file not found" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

# Check 3: PostgreSQL service running
Write-Host "3. Checking PostgreSQL service..." -ForegroundColor Cyan

try {
    $service = Get-Service postgresql* -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($service) {
        if ($service.Status -eq "Running") {
            Write-Host "   [OK] PostgreSQL service is running" -ForegroundColor Green
        } else {
            Write-Host "   [WARN] PostgreSQL service is not running" -ForegroundColor Yellow
            Write-Host "   Start it with: Start-Service $($service.Name)" -ForegroundColor Yellow
            $allGood = $false
        }
    } else {
        Write-Host "   [WARN] PostgreSQL service not found (might be OK if using custom setup)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [WARN] Could not check service status" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

if ($allGood) {
    Write-Host "SUCCESS: All prerequisites met!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Run migrations: .\scripts\migrate-test-database.ps1" -ForegroundColor White
    Write-Host "   2. Verify setup: tsx scripts/setup-test-database.ts" -ForegroundColor White
    Write-Host "   3. Run tests: npm run test:integration" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "WARNING: Some prerequisites are missing" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See full setup guide:" -ForegroundColor Cyan
    Write-Host "   docs/LOCAL_POSTGRESQL_SETUP_GUIDE.md" -ForegroundColor White
    Write-Host ""
    Write-Host "Quick start guide:" -ForegroundColor Cyan
    Write-Host "   docs/LOCAL_POSTGRESQL_QUICK_START.md" -ForegroundColor White
    Write-Host ""
}
