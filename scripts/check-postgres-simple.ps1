# Simple PostgreSQL Check

Write-Host "Checking PostgreSQL Installation..." -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL directory exists
$pgPath18 = "C:\Program Files\PostgreSQL\18"
$pgPath13 = "C:\Program Files\PostgreSQL\13"

if (Test-Path "$pgPath18\bin\psql.exe") {
    Write-Host "[OK] PostgreSQL 18 is installed" -ForegroundColor Green
    Write-Host "    Location: $pgPath18" -ForegroundColor Gray
    $pgBin = "$pgPath18\bin"
} elseif (Test-Path "$pgPath13\bin\psql.exe") {
    Write-Host "[OK] PostgreSQL 13 is installed" -ForegroundColor Green
    Write-Host "    Location: $pgPath13" -ForegroundColor Gray
    $pgBin = "$pgPath13\bin"
} else {
    Write-Host "[FAIL] PostgreSQL not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check if in PATH
$inPath = $env:Path -split ";" | Where-Object { $_ -like "*PostgreSQL*bin*" }

if ($inPath) {
    Write-Host "[OK] PostgreSQL is in PATH" -ForegroundColor Green
} else {
    Write-Host "[WARN] PostgreSQL is NOT in PATH" -ForegroundColor Yellow
    Write-Host "    Add this to your PATH: $pgBin" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    Adding to PATH for this session..." -ForegroundColor Cyan
    $env:Path += ";$pgBin"
    Write-Host "    [OK] Added to PATH (this session only)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Create database: psql -U postgres -c `"CREATE DATABASE salvage_test;`"" -ForegroundColor White
Write-Host "  2. Update .env with: TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/salvage_test" -ForegroundColor White
Write-Host "  3. Run migrations: .\scripts\migrate-test-database.ps1" -ForegroundColor White
Write-Host ""
