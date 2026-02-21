# 🌤️ How to Get OpenWeather API Key

## Quick Steps (5 minutes)

### Step 1: Sign Up

1. **Open this URL in your browser**:
   ```
   https://home.openweathermap.org/users/sign_up
   ```

2. **Fill in the registration form**:
   - **Username**: Choose any username (e.g., your name)
   - **Email**: Your email address
   - **Password**: Create a strong password
   - **Age Confirmation**: Check the box "I am 16 years old and over"
   - **Terms**: Check "I agree with Privacy Policy..."
   - **Captcha**: Complete the "I'm not a robot" verification

3. **Click "Create Account"**

4. **Check your email inbox**:
   - Look for email from "OpenWeather"
   - Subject: "OpenWeatherMap - Activate Your Account"
   - Click the activation link in the email

---

### Step 2: Get Your API Key

1. **After activating, sign in**:
   ```
   https://home.openweathermap.org/users/sign_in
   ```

2. **Enter your credentials**:
   - Email
   - Password
   - Click "Sign In"

3. **You'll land on the dashboard**

4. **Click on "API keys" tab**:
   - It's in the top navigation menu
   - URL will be: `https://home.openweathermap.org/api_keys`

5. **You'll see a default API key already created**:
   - Look for a section called "Key"
   - You'll see a long string of letters and numbers
   - Example format: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

6. **Copy the API key**:
   - Click the copy icon next to the key
   - OR select the entire key and copy it (Ctrl+C / Cmd+C)

---

### Step 3: Test Your API Key (Optional)

To verify your key works, open this URL in your browser (replace YOUR_API_KEY):

```
https://api.openweathermap.org/data/2.5/weather?q=Chennai&appid=YOUR_API_KEY
```

**If it works**, you'll see JSON data with weather information.

**If you see an error** like `{"cod":401,"message":"Invalid API key"}`:
- Your key might not be activated yet (wait 10 minutes)
- You copied the wrong key
- Try regenerating a new key on the API keys page

---

## What to Do After Getting the Key

Once you have your API key:

1. **Copy the key** (it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

2. **Tell me**: "I got the key: YOUR_API_KEY"

3. **I'll automatically**:
   - Add it to your `.env` file
   - Test the worker
   - Verify weather data is fetching
   - Check your Chennai trip for weather signals

---

## Troubleshooting

### "Email not received"
- Check spam/junk folder
- Wait 5 minutes
- Try resending activation email from sign-in page

### "Invalid API key" error
- Wait 10-15 minutes after signup (activation delay)
- Make sure you copied the entire key
- No spaces before/after the key

### "Account suspended" or other issues
- Try creating a new account with different email
- Use the free tier (no credit card required)

---

## Free Tier Limits

The free tier includes:
- ✅ 1,000 API calls per day (more than enough)
- ✅ 5-day weather forecast (what we need)
- ✅ 3-hour forecast intervals
- ✅ No credit card required

Our worker polls every 2 minutes = 720 calls per day (well within limit)

---

## Quick Links

- Sign Up: https://home.openweathermap.org/users/sign_up
- Sign In: https://home.openweathermap.org/users/sign_in
- API Keys Page: https://home.openweathermap.org/api_keys
- Documentation: https://openweathermap.org/forecast5

---

**Ready? Go ahead and sign up, then paste your API key here when you have it!**
