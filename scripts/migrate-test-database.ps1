# Migrate Test Database Script
# 
# This script runs database migrations on the test database
# 
# Usage:
#   .\scripts\migrate-test-database.ps1

Write-Host "🔧 Migrating Test Database" -ForegroundColor Cyan
Write-Host ""

# Check if TEST_DATABASE_URL exists in .env
$envFile = Get-Content .env -ErrorAction SilentlyContinue
$testDbUrl = $envFile | Where-Object { $_ -match "^TEST_DATABASE_URL=" }

if (-not $testDbUrl) {
    Write-Host "❌ TEST_DATABASE_URL not found in .env file" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Add this to your .env file:" -ForegroundColor Yellow
    Write-Host "TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/salvage_test"
    Write-Host ""
    exit 1
}

Write-Host "✅ TEST_DATABASE_URL found in .env" -ForegroundColor Green
Write-Host ""

# Extract TEST_DATABASE_URL value
$testDbUrlValue = ($testDbUrl -split "=", 2)[1].Trim()

# Backup current DATABASE_URL
$originalDbUrl = $env:DATABASE_URL

Write-Host "🔄 Temporarily setting DATABASE_URL to TEST_DATABASE_URL..." -ForegroundColor Cyan

# Set DATABASE_URL to TEST_DATABASE_URL for this session
$env:DATABASE_URL = $testDbUrlValue

Write-Host "✅ DATABASE_URL set to test database" -ForegroundColor Green
Write-Host ""

# Run migrations
Write-Host "📦 Running database migrations..." -ForegroundColor Cyan
Write-Host ""

try {
    npm run db:push
    
    Write-Host ""
    Write-Host "✅ Migrations completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Test database is ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ You can now run integration tests:" -ForegroundColor Cyan
    Write-Host "   npm run test:integration -- tests/integration/auction-deposit/bid-placement-e2e-optimized.test.ts"
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Migration failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Is PostgreSQL running?"
    Write-Host "   2. Does the database exist?"
    Write-Host "   3. Is the connection string correct?"
    Write-Host ""
    Write-Host "   To create the database:" -ForegroundColor Yellow
    Write-Host "   psql -U postgres -c `"CREATE DATABASE salvage_test;`""
    Write-Host ""
    exit 1
} finally {
    # Restore original DATABASE_URL
    if ($originalDbUrl) {
        $env:DATABASE_URL = $originalDbUrl
        Write-Host "🔄 Restored original DATABASE_URL" -ForegroundColor Cyan
    }
}
