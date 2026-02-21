# Phase 4 Manual Test Guide

Since the automated script is having connection issues, here's a step-by-step manual test.

## Prerequisites

Make sure API server is running in one terminal:
```bash
cd C:\Prabodh\Projects\adaptive-itinerary
pnpm dev:api
```

Then open a NEW PowerShell window and run these commands:

---

## Step 1: Create Trip

```powershell
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
} | ConvertTo-Json -Depth 10

$trip = Invoke-RestMethod -Uri "http://localhost:8080/trip" -Method Post -Body $tripPayload -ContentType "application/json"
$tripId = $trip.tripId
Write-Host "Trip ID: $tripId"
```

**Save the `$tripId` for next steps!**

---

## Step 2: Add Activities

```powershell
$activitiesPayload = @{
    activities = @(
        @{
            place = @{
                provider = "foursquare"
                providerPlaceId = "place_marina"
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
                providerPlaceId = "place_phoenix"
                name = "Phoenix Mall"
                lat = 13.0827
                lng = 80.2707
                category = "Mall"
                isIndoor = $true
            }
            durationMin = 90
            locked = $false
        }
    )
} | ConvertTo-Json -Depth 10

$result = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/activities" -Method Post -Body $activitiesPayload -ContentType "application/json"
Write-Host "Added $($result.count) activities"
```

---

## Step 3: Generate Itinerary

```powershell
$itineraryPayload = @{
    mode = "driving"
    optimizeOrder = $true
} | ConvertTo-Json

$itinerary = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/itinerary" -Method Post -Body $itineraryPayload -ContentType "application/json"
Write-Host "Itinerary generated (version $($itinerary.version))"
$itinerary.itinerary.items | Format-Table placeName, startTime, endTime
```

---

## Step 4: Check Initial Signals

```powershell
$signals = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/signals"
Write-Host "Weather: $($signals.weather.summary)"
Write-Host "Crowds: $($signals.crowds.Count) places"
$signals | ConvertTo-Json -Depth 10
```

**Expected:** Crowds array should be empty `[]`

---

## Step 5: Post Crowd Signals

```powershell
$crowdPayload = @{
    observedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    crowds = @(
        @{
            placeId = "place_marina"
            placeName = "Marina Beach"
            busyNow = 85
            peakHours = @("17:00", "18:00", "19:00")
        },
        @{
            placeId = "place_phoenix"
            placeName = "Phoenix Mall"
            busyNow = 65
            peakHours = @("12:00", "13:00")
        }
    )
    raw = @{ source = "manual-test" }
} | ConvertTo-Json -Depth 10

$crowdResult = Invoke-RestMethod -Uri "http://localhost:8080/internal/trip/$tripId/signals/crowds" -Method Post -Body $crowdPayload -ContentType "application/json"
Write-Host "Crowd signals posted: $($crowdResult.ok)"
```

**Expected:** Should return `ok: true`

---

## Step 6: Verify Signals Updated

```powershell
$updatedSignals = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/signals"
Write-Host "`nCrowd Signals ($($updatedSignals.crowds.Count) places):"
$updatedSignals.crowds | ForEach-Object {
    Write-Host "  - $($_.placeName): $($_.busyNow)% busy, peak: $($_.peakHours -join ', ')"
}
```

**Expected:** Should show 2 places with crowd data

---

## Step 7: Trigger Recompute

```powershell
$recompute = Invoke-RestMethod -Uri "http://localhost:8080/internal/trip/$tripId/recompute" -Method Post -ContentType "application/json"
Write-Host "`nRecompute result:"
Write-Host "  OK: $($recompute.ok)"
Write-Host "  Suggestions count: $($recompute.suggestions.Count)"
$recompute.suggestions | ConvertTo-Json -Depth 10
```

**Expected:** Should generate crowd suggestions if activities overlap with peak hours

---

## Step 8: Get All Suggestions

```powershell
$suggestions = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/suggestions"
Write-Host "`nTotal Suggestions: $($suggestions.suggestions.Count)"

foreach ($sug in $suggestions.suggestions) {
    Write-Host "`n--- Suggestion: $($sug.suggestionId) ---"
    Write-Host "Kind: $($sug.kind)"
    Write-Host "Reasons:"
    $sug.reasons | ForEach-Object { Write-Host "  - $_" }
}
```

**Expected:** Should show crowd-based suggestions with reasons like:
- "Marina Beach is very busy right now (85% capacity)"
- "Shifted crowded stops earlier to avoid peak hours"

---

## Success Criteria

✅ Trip created successfully  
✅ Activities added (2 places)  
✅ Itinerary generated  
✅ Initial signals show empty crowds  
✅ Crowd signals posted successfully  
✅ Updated signals show 2 places with crowd data  
✅ Recompute generates suggestions  
✅ Suggestions explain crowd conditions  

---

## Testing Worker (Optional)

In a third terminal, start the worker:

```bash
pnpm dev:worker
```

Watch the logs for:
```
[Crowds] Polling crowd data...
[Crowds] Found 1 trips
[Crowds][trp_xxx] Fetching crowd data for 2 places...
[Crowds][trp_xxx] Marina Beach: XX% busy, peak HH:mm
[Crowds][trp_xxx] Crowd signals posted
[Crowds][trp_xxx] Recompute triggered
```

**Note:** Worker uses BestTime API key. With `pub_` key, it will fallback to mock data (20-80% random).

---

## Troubleshooting

### "Unable to connect to the remote server"
- Make sure API is running: `pnpm dev:api`
- Check if port 8080 is free
- Try restarting the API server

### "BestTime API returned 401"
- You have a **public key** (`pub_`) but need a **private key** (`pri_`)
- Go to https://besttime.app/api/v1/keys
- Copy the **private** key (starts with `pri_`)
- Update `.env`: `BESTTIME_API_KEY=pri_your_key_here`

### "No suggestions generated"
- Check if activities overlap with peak hours
- Verify busyNow >= 80 or times match peakHours ±1hr
- Ensure itinerary was generated before posting crowds

---

## Quick Copy-Paste Test (All Steps Combined)

```powershell
# 1. Create trip
$trip = Invoke-RestMethod -Uri "http://localhost:8080/trip" -Method Post -Body (@{city="Chennai";date="2026-02-27";startTime="09:00";endTime="22:00";preferences=@{pace="medium";interests=@("culture");avoid=@();budget="medium"}} | ConvertTo-Json -Depth 10) -ContentType "application/json"
$tripId = $trip.tripId; Write-Host "Trip: $tripId"

# 2. Add activities  
Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/activities" -Method Post -Body (@{activities=@(@{place=@{provider="foursquare";providerPlaceId="place_1";name="Marina Beach";lat=13.0477;lng=80.2807;isIndoor=$false};durationMin=60;locked=$false},@{place=@{provider="foursquare";providerPlaceId="place_2";name="Phoenix Mall";lat=13.0827;lng=80.2707;isIndoor=$true};durationMin=90;locked=$false})} | ConvertTo-Json -Depth 10) -ContentType "application/json"

# 3. Generate itinerary
Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/itinerary" -Method Post -Body (@{mode="driving";optimizeOrder=$true} | ConvertTo-Json) -ContentType "application/json"

# 4. Post crowd data
Invoke-RestMethod -Uri "http://localhost:8080/internal/trip/$tripId/signals/crowds" -Method Post -Body (@{observedAt=(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");crowds=@(@{placeId="place_1";placeName="Marina Beach";busyNow=85;peakHours=@("17:00","18:00")},@{placeId="place_2";placeName="Phoenix Mall";busyNow=65;peakHours=@("12:00","13:00")});raw=@{source="test"}} | ConvertTo-Json -Depth 10) -ContentType "application/json"

# 5. Check signals
$signals = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/signals"; $signals.crowds | Format-Table

# 6. Trigger recompute
$recompute = Invoke-RestMethod -Uri "http://localhost:8080/internal/trip/$tripId/recompute" -Method Post -ContentType "application/json"; Write-Host "Suggestions: $($recompute.suggestions.Count)"

# 7. Get suggestions
$suggestions = Invoke-RestMethod -Uri "http://localhost:8080/trip/$tripId/suggestions"; $suggestions.suggestions | ConvertTo-Json -Depth 10

# Trip URL
Write-Host "`nTrip URL: http://localhost:3000/trip/$tripId" -ForegroundColor Green
```

---

That's it! Copy the combined script above and paste into PowerShell for a quick end-to-end test. 🚀
