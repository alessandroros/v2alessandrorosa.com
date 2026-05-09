# Test Redis Health Endpoint
# This script tests the Redis keep-alive endpoint locally or on production

param(
    [string]$Url = "http://localhost:3000/api/health/redis",
    [switch]$Production
)

if ($Production) {
    $Url = "https://alessandror.dk/api/health/redis"
}

Write-Host "`n🔍 Testing Redis Health Endpoint..." -ForegroundColor Cyan
Write-Host "URL: $Url`n" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $Url -Method Get -ErrorAction Stop

    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 3 | Write-Host

    if ($response.status -eq "healthy") {
        Write-Host "`n✓ Redis is healthy and active" -ForegroundColor Green
    } else {
        Write-Host "`n⚠ Redis status: $($response.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red

    if ($_.Exception.Response) {
        Write-Host "`nHTTP Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    }
}

Write-Host ""

