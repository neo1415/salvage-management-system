# Clear Next.js cache and restart dev server
# Run this script if you're seeing old cached pages

Write-Host "Clearing Next.js cache..." -ForegroundColor Yellow

# Remove .next directory
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✓ Cleared .next directory" -ForegroundColor Green
} else {
    Write-Host "✓ .next directory doesn't exist" -ForegroundColor Green
}

Write-Host ""
Write-Host "Cache cleared! Now:" -ForegroundColor Cyan
Write-Host "1. Restart your Next.js dev server (npm run dev)" -ForegroundColor White
Write-Host "2. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)" -ForegroundColor White
Write-Host ""
