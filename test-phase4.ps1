# Phase 4 - Crowd Monitoring Test Script (PowerShell)
# Tests crowd signals, crowd-based suggestions, and SSE updates

param(
    [Parameter(Mandatory=$true)]
    [string]$TripId
)

$API_URL = "http://localhost:8080"

Write-Host "=== Phase 4 - Crowd Monitoring Test ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Testing trip: $TripId" -ForegroundColor Yellow
Write-Host ""

# Step 1: Check trip exists
Write-Host "1. Checking trip exists..." -ForegroundColor Green
$tripData = Invoke-RestMethod -Uri "$API_URL/trip/$TripId" -Method Get
Write-Host "City: $($tripData.trip.city)"
Write-Host ""

# Step 2: Get current signals
Write-Host "2. Getting current signals..." -ForegroundColor Green
$signals = Invoke-RestMethod -Uri "$API_URL/trip/$TripId/signals" -Method Get
$signals | ConvertTo-Json -Depth 10
Write-Host ""

# Step 3: Post mock crowd signals
Write-Host "3. Posting mock crowd signals..." -ForegroundColor Green
$crowdPayload = @{
    observedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    crowds = @(
        @{
            placeId = "place_1"
            placeName = "Marina Beach"
            busyNow = 85
            peakHours = @("17:00", "18:00", "19:00")
        },
        @{
            placeId = "place_2"
            placeName = "Phoenix Market City"
            busyNow = 65
            peakHours = @("12:00", "13:00")
        }
    )
    raw = @{
        source = "test-script-ps"
    }
}

$crowdPayload | ConvertTo-Json -Depth 10
$result = Invoke-RestMethod -Uri "$API_URL/internal/trip/$TripId/signals/crowds" -Method Post -Body ($crowdPayload | ConvertTo-Json -Depth 10) -ContentType "application/json"
$result | ConvertTo-Json
Write-Host ""

# Step 4: Verify signals updated
Write-Host "4. Verifying signals include crowds..." -ForegroundColor Green
$updatedSignals = Invoke-RestMethod -Uri "$API_URL/trip/$TripId/signals" -Method Get
Write-Host "Crowds count: $($updatedSignals.crowds.Count)"
$updatedSignals.crowds | ConvertTo-Json -Depth 10
Write-Host ""

# Step 5: Trigger recompute
Write-Host "5. Triggering recompute..." -ForegroundColor Green
$recompute = Invoke-RestMethod -Uri "$API_URL/internal/trip/$TripId/recompute" -Method Post -ContentType "application/json"
$recompute | ConvertTo-Json -Depth 10
Write-Host ""

# Step 6: Get suggestions
Write-Host "6. Getting suggestions..." -ForegroundColor Green
$suggestions = Invoke-RestMethod -Uri "$API_URL/trip/$TripId/suggestions" -Method Get
$suggestions | ConvertTo-Json -Depth 10
Write-Host ""

Write-Host "=== Phase 4 Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected results:" -ForegroundColor Yellow
Write-Host "- Signals endpoint returns crowds array with 2 places"
Write-Host "- Marina Beach shows 85% busy with peak hours 17:00-19:00"
Write-Host "- Recompute generates crowd-based suggestion (kind: shift)"
Write-Host "- Suggestion explains which places are busy and why they're rescheduled"
