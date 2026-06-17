$ErrorActionPreference = 'Stop'

$target = Join-Path (Get-Location) '.next\dev'

if (-not (Test-Path -LiteralPath $target)) {
  Write-Host 'No .next/dev cache found.'
  exit 0
}

for ($attempt = 1; $attempt -le 8; $attempt++) {
  try {
    Remove-Item -LiteralPath $target -Recurse -Force
    Write-Host 'Removed .next/dev cache.'
    exit 0
  } catch {
    if ($attempt -eq 8) {
      Write-Error "Unable to remove .next/dev. Close dev servers, editors indexing the folder, or antivirus scans, then retry. Last error: $($_.Exception.Message)"
      exit 1
    }

    Start-Sleep -Milliseconds (250 * $attempt)
  }
}
