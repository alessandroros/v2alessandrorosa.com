# Cache Invalidation Script
# Usage: .\invalidate-cache.ps1 [target]
# Examples:
#   .\invalidate-cache.ps1 github
#   .\invalidate-cache.ps1 strava
#   .\invalidate-cache.ps1 all

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('github', 'strava', 'wakatime', 'npm', 'leetcode', 'all')]
    [string]$Target = 'all'
)

$url = "http://localhost:3000/api/cache/invalidate?target=$Target"

Write-Host "Invalidating cache for: $Target" -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Get

    if ($response.success) {
        Write-Host "✓ Cache invalidated successfully!" -ForegroundColor Green
        Write-Host "  Message: $($response.message)" -ForegroundColor White
        Write-Host "  Deleted: $($response.deleted) keys" -ForegroundColor White

        if ($response.keys) {
            Write-Host "  Keys cleared:" -ForegroundColor Yellow
            foreach ($key in $response.keys) {
                Write-Host "    - $key" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "✗ Failed to invalidate cache" -ForegroundColor Red
        Write-Host "  Error: $($response.error)" -ForegroundColor Red

        if ($response.available) {
            Write-Host "  Available targets: $($response.available -join ', ')" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "✗ Error connecting to server" -ForegroundColor Red
    Write-Host "  Make sure the dev server is running (npm run dev)" -ForegroundColor Yellow
    $errorMsg = $_.Exception.Message
    Write-Host "  Error: $errorMsg" -ForegroundColor Red
}

