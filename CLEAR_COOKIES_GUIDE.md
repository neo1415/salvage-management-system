# How to Clear Browser Cookies - Visual Guide

## Why This Is Critical

The session hijacking fix requires clearing ALL browser cookies to ensure old session tokens are removed. Without this step, the fix won't work properly.

## Step-by-Step Instructions

### Method 1: Using DevTools (Recommended)

#### For Chrome/Edge/Brave:

1. **Open DevTools**
   - Press `F12` on your keyboard
   - OR Right-click anywhere → "Inspect"
   - OR Press `Ctrl+Shift+I`

2. **Navigate to Application Tab**
   - Click the "Application" tab at the top
   - If you don't see it, click the `>>` button to find it

3. **Find Cookies**
   - In the left sidebar, expand "Cookies"
   - Click on `http://localhost:3000`

4. **Clear All Cookies**
   - You should see cookies like:
     - `authjs.session-token`
     - `authjs.callback-url`
     - `authjs.csrf-token`
   - Right-click in the cookie list
   - Select "Clear" or "Delete All"
   - OR select each cookie and press `Delete` key

5. **Verify Cookies Are Gone**
   - The cookie list should be empty
   - If any cookies remain, delete them manually

#### For Firefox:

1. **Open Developer Tools**
   - Press `F12` on your keyboard
   - OR Press `Ctrl+Shift+I`

2. **Navigate to Storage Tab**
   - Click the "Storage" tab at the top

3. **Find Cookies**
   - In the left sidebar, expand "Cookies"
   - Click on `http://localhost:3000`

4. **Clear All Cookies**
   - Right-click in the cookie list
   - Select "Delete All"
   - OR select each cookie and press `Delete` key

### Method 2: Using Browser Settings

#### For Chrome/Edge/Brave:

1. **Open Settings**
   - Press `Ctrl+Shift+Delete`
   - OR Go to Settings → Privacy and security → Clear browsing data

2. **Select Options**
   - Time range: "All time"
   - Check ONLY "Cookies and other site data"
   - Uncheck everything else (unless you want to clear them too)

3. **Clear Data**
   - Click "Clear data" button
   - Wait for confirmation

#### For Firefox:

1. **Open Settings**
   - Press `Ctrl+Shift+Delete`
   - OR Go to Settings → Privacy & Security → Cookies and Site Data

2. **Select Options**
   - Time range: "Everything"
   - Check ONLY "Cookies"
   - Uncheck everything else

3. **Clear Now**
   - Click "Clear Now" button
   - Wait for confirmation

### Method 3: Incognito/Private Mode (Alternative)

If you don't want to clear your regular browser cookies:

#### Chrome/Edge/Brave:
- Press `Ctrl+Shift+N` for Incognito mode
- Go to `http://localhost:3000/login`
- Test login flow

#### Firefox:
- Press `Ctrl+Shift+P` for Private Window
- Go to `http://localhost:3000/login`
- Test login flow

**Note**: This only works if you haven't used incognito mode before for this site.

## Critical: Close ALL Browser Windows

After clearing cookies, you MUST:

1. **Close ALL browser windows**
   - Not just the current tab
   - ALL windows of the browser
   - Including other Google profiles
   - Including minimized windows

2. **Wait 5 seconds**
   - Let the browser fully close
   - Ensure all processes are terminated

3. **Open a fresh browser window**
   - Start the browser again
   - Open a new window
   - Navigate to `http://localhost:3000/login`

## Verification Checklist

Before testing the login:

- [ ] Opened DevTools (F12)
- [ ] Went to Application > Cookies (or Storage > Cookies in Firefox)
- [ ] Clicked on `http://localhost:3000`
- [ ] Verified cookie list is empty
- [ ] Closed ALL browser windows
- [ ] Waited 5 seconds
- [ ] Opened fresh browser window

## What Cookies to Look For (and Delete)

These are the cookies that need to be cleared:

### Development (localhost):
- `authjs.session-token` ← **CRITICAL**
- `authjs.callback-url`
- `authjs.csrf-token`
- `next-auth.session-token` (old format)
- `next-auth.callback-url` (old format)
- `next-auth.csrf-token` (old format)

### Production (HTTPS):
- `__Secure-authjs.session-token` ← **CRITICAL**
- `__Secure-authjs.callback-url`
- `__Host-authjs.csrf-token`

## Common Mistakes to Avoid

### ❌ Mistake 1: Only Closing the Tab
**Wrong**: Closing just the current tab
**Right**: Close ALL browser windows

### ❌ Mistake 2: Not Checking DevTools
**Wrong**: Assuming cookies are cleared
**Right**: Verify in DevTools that cookies are gone

### ❌ Mistake 3: Clearing Only One Browser
**Wrong**: Clearing cookies in Chrome but testing in Edge
**Right**: Clear cookies in ALL browsers you're testing with

### ❌ Mistake 4: Not Closing Other Profiles
**Wrong**: Leaving other Google profiles open
**Right**: Close ALL browser windows including other profiles

### ❌ Mistake 5: Testing Immediately
**Wrong**: Testing right after clearing cookies
**Right**: Close browser, wait 5 seconds, then test

## Testing After Clearing Cookies

### Test 1: Admin Login

1. Open fresh browser window
2. Go to `http://localhost:3000/login`
3. Log in as admin:
   ```
   Email: adneo502@gmail.com
   Password: [your admin password]
   ```
4. **Expected**: See admin dashboard
5. **Verify**: Check DevTools > Application > Cookies
6. **Should see**: New `authjs.session-token` cookie

### Test 2: New User Login (Different Browser)

1. Open different browser OR incognito window
2. Go to `http://localhost:3000/login`
3. Log in as new user:
   ```
   Email: adetimilehin502@gmail.com
   Password: [the password you set]
   ```
4. **Expected**: See "Change Password" prompt
5. **NOT Expected**: See admin dashboard
6. **Verify**: Check DevTools > Application > Cookies
7. **Should see**: Different `authjs.session-token` than admin

## Troubleshooting

### Issue: Cookies Won't Delete

**Solution 1**: Try Method 2 (Browser Settings)
- Use `Ctrl+Shift+Delete`
- Select "All time"
- Clear cookies

**Solution 2**: Try Different Browser
- If Chrome doesn't work, try Firefox
- Or use Incognito/Private mode

**Solution 3**: Restart Browser
- Close browser completely
- End browser process in Task Manager
- Start browser again

### Issue: Cookies Reappear

**Cause**: Browser is still running in background

**Solution**:
1. Open Task Manager (`Ctrl+Shift+Esc`)
2. Find browser processes (Chrome, Edge, Firefox)
3. End ALL browser processes
4. Wait 5 seconds
5. Start browser again

### Issue: Still Seeing Wrong Account

**Solution**:
1. Clear cookies again (verify in DevTools)
2. Run: `npx tsx scripts/clear-all-sessions.ts`
3. Close ALL browser windows
4. Restart computer (if necessary)
5. Try again

## Quick Reference

### Keyboard Shortcuts
- Open DevTools: `F12` or `Ctrl+Shift+I`
- Clear Browsing Data: `Ctrl+Shift+Delete`
- Incognito Mode: `Ctrl+Shift+N` (Chrome) or `Ctrl+Shift+P` (Firefox)
- Close Window: `Alt+F4`
- Task Manager: `Ctrl+Shift+Esc`

### DevTools Path
```
DevTools (F12)
  → Application tab
    → Cookies (left sidebar)
      → http://localhost:3000
        → Right-click → Clear
```

### Browser Settings Path
```
Settings (Ctrl+Shift+Delete)
  → Time range: All time
    → Cookies and other site data ✓
      → Clear data
```

## Need Help?

If you're still having issues after following this guide:

1. Run the debug script:
   ```bash
   npx tsx scripts/test-session-isolation.ts
   ```

2. Check the detailed documentation:
   - `SESSION_HIJACKING_FIX_QUICK_START.md`
   - `SESSION_HIJACKING_FIX.md`

3. Verify the fix is applied:
   - Check `src/lib/auth/next-auth.config.ts` has cookie configuration
   - Check server logs for errors

---

**Remember**: The most important steps are:
1. ✅ Clear cookies in DevTools
2. ✅ Verify cookies are gone
3. ✅ Close ALL browser windows
4. ✅ Wait 5 seconds
5. ✅ Test with fresh browser window
