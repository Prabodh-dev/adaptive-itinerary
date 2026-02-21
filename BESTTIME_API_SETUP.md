# BestTime API Key Setup Guide

## 🎯 What is BestTime?

BestTime provides **foot traffic data** and **live busyness** information for public venues worldwide (restaurants, museums, parks, shopping malls, etc.).

- **Foot traffic forecasts** - Hourly predictions (0-100%) for each day of the week
- **Live busyness** - Real-time activity vs. forecast baseline
- **Peak hours** - Identifies when places are busiest
- **Coverage** - 150+ countries worldwide

---

## 🔑 How to Get a BestTime API Key

### Step 1: Sign Up for Free Account

1. **Visit**: https://besttime.app/signup
2. **Create account**:
   - Email address
   - Password
   - Company name (optional)
   - Name
3. **Verify email** - Check your inbox for verification link
4. **No credit card required** for testing!

### Step 2: Get Your API Key

Once logged in:

1. **Navigate to Dashboard**: https://besttime.app/api/v1/keys
2. **Find "API Keys" section**
3. **Copy your private API key** - Format: `pri_xxxxxxxxxxxxx`
4. **Keep it secure** - Don't share publicly!

### Step 3: Add to Your Project

Edit `.env` file:
```bash
# BestTime API Key (for crowd monitoring)
BESTTIME_API_KEY=pri_your_actual_key_here

# Crowd polling interval in seconds (3 minutes)
CROWD_POLL_INTERVAL_SEC=180
```

### Step 4: Restart Services

```bash
# Stop any running services (Ctrl+C)
# Then restart
pnpm dev
```

---

## 💳 Free Trial Details

**What you get for FREE:**

- ✅ **Test credits** - Limited API calls to test the service
- ✅ **All features** - Access to forecasts, live data, and filters
- ✅ **Website tools** - Use Radar tool and forecast demo
- ✅ **No credit card** - Start testing immediately
- ✅ **No time limit** - Credits don't expire

**Free tier limitations:**
- Limited number of API calls (check dashboard for quota)
- Once credits run out, you'll need to upgrade

---

## 📊 Pricing (After Free Trial)

Visit: https://besttime.app/subscription/pricing

**Plans:**
- **Starter** - ~$49/month - Good for small apps
- **Professional** - ~$199/month - Higher volume
- **Enterprise** - Custom pricing - Unlimited, SLAs

*(Prices may vary - check website for current rates)*

---

## 🧪 Testing Without API Key

**Good news:** Our Phase 4 implementation includes **fallback mode**!

If no API key is set, the system automatically uses **mock data**:
- `busyNow`: Random value between 20-80
- `peakHours`: Default to `["17:00", "18:00"]`
- All Phase 4 features still work!

This means you can:
- ✅ Test the entire Phase 4 implementation
- ✅ See crowd suggestions in action
- ✅ Develop and demo without spending money
- ✅ Upgrade to real data when ready

---

## 📖 API Documentation

**Official docs**: https://besttime.app/api/v1/docs

### Key Endpoints We Use

#### 1. Venue Forecasts
```bash
POST https://besttime.app/api/v1/forecasts
{
  "api_key_private": "pri_xxx",
  "venue_name": "Marina Beach",
  "venue_address": "Chennai, India"
}
```

**Response:**
```json
{
  "analysis": {
    "venue_forecasted_busyness": 60,  // Current hour prediction
    "hour_analysis": [
      {
        "hour": 17,
        "day_int": 5,  // 0=Sunday
        "intensity_nr": 85  // Busyness 0-100
      }
    ]
  }
}
```

### What Our Integration Does

Our `fetchBestTimeCrowd()` function:
1. Calls BestTime API with venue name + lat/lng
2. Extracts `busyNow` from current hour forecast
3. Identifies `peakHours` where intensity >= 75
4. Falls back to mock data if API fails

---

## 🔍 Verifying Your API Key

### Method 1: Test with curl

```bash
curl -X POST https://besttime.app/api/v1/forecasts \
  -H "Content-Type: application/json" \
  -d '{
    "api_key_private": "pri_YOUR_KEY_HERE",
    "venue_name": "Times Square",
    "venue_address": "Manhattan, NY, USA"
  }'
```

**Success response:**
```json
{
  "status": "OK",
  "analysis": { ... }
}
```

**Error response:**
```json
{
  "status": "Error",
  "message": "Invalid API key"
}
```

### Method 2: Use Website Tools

1. Go to: https://besttime.app/api/v1/chooseforecast
2. Enter venue name + address
3. Click "Create Forecast"
4. If logged in, uses your API key automatically

### Method 3: Check Worker Logs

Start the worker and watch for logs:

```bash
pnpm dev:worker
```

**With valid API key:**
```
[Crowds] Marina Beach: 85% busy, peak 17:00, 18:00
```

**Without API key or invalid:**
```
WARNING: BESTTIME_API_KEY not set, using fallback crowd data
BestTime API returned 401, using fallback
```

---

## 🚨 Troubleshooting

### "Invalid API key" Error

**Possible causes:**
1. ❌ Key is incorrect - Double-check copy/paste
2. ❌ Using public key instead of private - Should start with `pri_`
3. ❌ Account not verified - Check email for verification link
4. ❌ Free credits exhausted - Check dashboard quota

**Solution:**
- Verify key in dashboard: https://besttime.app/api/v1/keys
- Regenerate key if needed
- Or continue using fallback mode for testing

### "Rate limit exceeded" Error

**Cause:** Too many API calls

**Solutions:**
1. Increase `CROWD_POLL_INTERVAL_SEC` (e.g., from 180 to 600)
2. Reduce number of trips being monitored
3. Upgrade to higher tier plan

### Worker Not Fetching Crowds

**Check:**
1. `.env` file has `BESTTIME_API_KEY` set
2. Services restarted after adding key
3. Worker is running (`pnpm dev:worker`)
4. Activities have valid lat/lng coordinates

---

## 🎯 Recommended Setup

### For Development (No API Key)
```bash
# .env
BESTTIME_API_KEY=
CROWD_POLL_INTERVAL_SEC=300  # 5 minutes to reduce mock data noise
```

Uses fallback mode - perfect for:
- ✅ Development and testing
- ✅ Demo presentations
- ✅ Understanding Phase 4 features
- ✅ Frontend integration work

### For Production (With API Key)
```bash
# .env
BESTTIME_API_KEY=pri_your_actual_key_here
CROWD_POLL_INTERVAL_SEC=180  # 3 minutes for real-time updates
```

Gets real crowd data:
- ✅ Accurate busyness predictions
- ✅ Live crowd monitoring
- ✅ Actual peak hours for venues
- ✅ Production-ready experience

---

## 📚 Additional Resources

### BestTime Resources
- **Sign up**: https://besttime.app/signup
- **API Keys**: https://besttime.app/api/v1/keys
- **Documentation**: https://besttime.app/api/v1/docs
- **Pricing**: https://besttime.app/subscription/pricing
- **Radar Tool** (explore venues): https://besttime.app/api/v1/radar/filter
- **Blog/Tutorials**: https://blog.besttime.app/

### Our Documentation
- **Phase 4 Testing Guide**: `TESTING_PHASE4.md`
- **Phase 4 Summary**: `PHASE4_SUMMARY.md`
- **Test Script**: `test-phase4.ps1`

---

## 🎉 You're All Set!

Now you can:
1. ✅ Test Phase 4 without API key (fallback mode)
2. ✅ Sign up for free BestTime account when ready
3. ✅ Get real crowd data for production deployment
4. ✅ Monitor foot traffic patterns worldwide

**Remember:** The fallback mode is perfectly fine for development and demos. Only get an API key when you need real crowd data for production!

Happy coding! 🚀
