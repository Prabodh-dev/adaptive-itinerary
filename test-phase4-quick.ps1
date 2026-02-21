# Quick Phase 4 Test Script
# Creates trip, adds activities, posts crowd data, and verifies suggestions

Write-Host "=== Phase 4 Quick Test ===" -ForegroundColor Cyan
Write-Host ""

$API_URL = "http://localhost:8080"

# Step 1: Create trip
Write-Host "1. Creating test trip..." -ForegroundColor Green
$tripPayload = @{
    city = "Chennai"
    date = "2026-02-27"
    startTime = "09:00"
    endTime = "22:00"
    preferences = @{
        pace = "medium"
        interests = @("culture", "food")
        avoid = @()
        budget = "medium"
    }
}

try {
    $trip = Invoke-RestMethod -Uri "$API_URL/trip" -Method Post -Body ($tripPayload | ConvertTo-Json -Depth 10) -ContentType "application/json"
    $tripId = $trip.tripId
    Write-Host "Trip created: $tripId" -ForegroundColor Yellow
} catch {
    Write-Host "Error creating trip: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Add activities
Write-Host "2. Adding activities..." -ForegroundColor Green
$activitiesPayload = @{
    activities = @(
        @{
            place = @{
                provider = "foursquare"
                providerPlaceId = "place_marina_beach"
                name = "Marina Beach"
                lat = 13.0477
                lng = 80.2807
                category = "Beach"
                isIndoor = $false
            }
            durationMin = 60
            locked = $false
        },
        @{
            place = @{
                provider = "foursquare"
                providerPlaceId = "place_phoenix_mall"
                name = "Phoenix Market City"
                lat = 13.0827
                lng = 80.2707
                category = "Shopping Mall"
                isIndoor = $true
            }
            durationMin = 90
            locked = $false
        },
        @{
            place = @{
                provider = "foursquare"
                providerPlaceId = "place_fort_museum"
                name = "Fort Museum"
                lat = 13.0878
                lng = 80.2785
                category = "Museum"
                isIndoor = $true
            }
            durationMin = 45
            locked = $false
        }
    )
}

try {
    $addResult = Invoke-RestMethod -Uri "$API_URL/trip/$tripId/activities" -Method Post -Body ($activitiesPayload | ConvertTo-Json -Depth 10) -ContentType "application/json"
    Write-Host "Activities added: $($addResult.count)" -ForegroundColor Yellow
} catch {
    Write-Host "Error adding activities: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Generate itinerary
Write-Host "3. Generating itinerary..." -ForegroundColor Green
$itineraryPayload = @{
    mode = "driving"
    optimizeOrder = $true
}

try {
    $itinerary = Invoke-RestMethod -Uri "$API_URL/trip/$tripId/itinerary" -Method Post -Body ($itineraryPayload | ConvertTo-Json) -ContentType "application/json"
    Write-Host "Itinerary generated (version $($itinerary.version))" -ForegroundColor Yellow
    Write-Host "Activities scheduled:" -ForegroundColor White
    foreach ($item in $itinerary.itinerary.items) {
        Write-Host "  - $($item.placeName): $($item.startTime) - $($item.endTime)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error generating itinerary: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Check initial signals (should be empty)
Write-Host "4. Checking initial signals..." -ForegroundColor Green
try {
    $signals = Invoke-RestMethod -Uri "$API_URL/trip/$tripId/signals" -Method Get
    Write-Host "Weather: $($signals.weather.summary)" -ForegroundColor Gray
    Write-Host "Crowds: $($signals.crowds.Count) places" -ForegroundColor Gray
} catch {
    Write-Host "Error getting signals: $_" -ForegroundColor Red
}

Write-Host ""

# Step 5: Post crowd data
Write-Host "5. Posting crowd signals..." -ForegroundColor Green
$crowdPayload = @{
    observedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    crowds = @(
        @{
            placeId = "place_marina_beach"
            placeName = "Marina Beach"
            busyNow = 85
            peakHours = @("17:00", "18:00", "19:00")
        },
        @{
            placeId = "place_phoenix_mall"
            placeName = "Phoenix Market City"
            busyNow = 65
            peakHours = @("12:00", "13:00", "14:00")
        },
        @{
            placeId = "place_fort_museum"
            placeName = "Fort Museum"
            busyNow = 45
            peakHours = @("11:00", "15:00")
        }
    )
    raw = @{
        source = "test-script"
    }
}

try {
    $crowdResult = Invoke-RestMethod -Uri "$API_URL/internal/trip/$tripId/signals/crowds" -Method Post -Body ($crowdPayload | ConvertTo-Json -Depth 10) -ContentType "application/json"
    Write-Host "Crowd signals posted successfully" -ForegroundColor Yellow
} catch {
    Write-Host "Error posting crowd signals: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 6: Verify signals updated
Write-Host "6. Verifying signals updated..." -ForegroundColor Green
try {
    $updatedSignals = Invoke-RestMethod -Uri "$API_URL/trip/$tripId/signals" -Method Get
    Write-Host "Crowds count: $($updatedSignals.crowds.Count)" -ForegroundColor Yellow
    foreach ($crowd in $updatedSignals.crowds) {
        Write-Host "  - $($crowd.placeName): $($crowd.busyNow)% busy, peak hours: $($crowd.peakHours -join ', ')" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error getting updated signals: $_" -ForegroundColor Red
}

Write-Host ""

# Step 7: Trigger recompute
Write-Host "7. Triggering recompute to generate suggestions..." -ForegroundColor Green
try {
    $recompute = Invoke-RestMethod -Uri "$API_URL/internal/trip/$tripId/recompute" -Method Post -ContentType "application/json"
    Write-Host "Recompute result: OK=$($recompute.ok)" -ForegroundColor Yellow
    if ($recompute.suggestions -and $recompute.suggestions.Count -gt 0) {
        Write-Host "Suggestions generated: $($recompute.suggestions.Count)" -ForegroundColor Green
    } else {
        Write-Host "No suggestions generated" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error triggering recompute: $_" -ForegroundColor Red
}

Write-Host ""

# Step 8: Get all suggestions
Write-Host "8. Getting all suggestions..." -ForegroundColor Green
try {
    $suggestions = Invoke-RestMethod -Uri "$API_URL/trip/$tripId/suggestions" -Method Get
    Write-Host "Total suggestions: $($suggestions.suggestions.Count)" -ForegroundColor Yellow
    
    foreach ($suggestion in $suggestions.suggestions) {
        Write-Host ""
        Write-Host "  Suggestion ID: $($suggestion.suggestionId)" -ForegroundColor Cyan
        Write-Host "  Kind: $($suggestion.kind)" -ForegroundColor Cyan
        Write-Host "  Reasons:" -ForegroundColor White
        foreach ($reason in $suggestion.reasons) {
            Write-Host "    - $reason" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "Error getting suggestions: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Phase 4 Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Trip URL: http://localhost:3000/trip/$tripId" -ForegroundColor Green
Write-Host "Trip ID: $tripId" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Start worker to test automatic crowd polling: pnpm dev:worker" -ForegroundColor Gray
Write-Host "2. View trip in web UI (if running): http://localhost:3000/trip/$tripId" -ForegroundColor Gray
