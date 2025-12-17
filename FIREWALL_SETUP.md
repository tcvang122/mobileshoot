# Windows Firewall Configuration Guide

## Quick Method: Allow Node.js Through Firewall

### Option 1: Allow Node.js Application (Recommended)

1. **Open Windows Defender Firewall:**
   - Press `Windows Key + R`
   - Type: `firewall.cpl` and press Enter
   - OR search "Windows Defender Firewall" in Start menu

2. **Click "Allow an app or feature through Windows Defender Firewall"** (on the left side)

3. **Click "Change settings"** (top right) - you may need admin privileges

4. **Click "Allow another app..."** (bottom right)

5. **Click "Browse..."** and navigate to:
   ```
   C:\Program Files\nodejs\node.exe
   ```
   (Or wherever Node.js is installed - check with `where node` in Command Prompt)

6. **Click "Add"**

7. **Make sure both "Private" and "Public" checkboxes are checked** for Node.js

8. **Click "OK"**

### Option 2: Allow Specific Ports (Alternative)

1. **Open Windows Defender Firewall** (same as above)

2. **Click "Advanced settings"** (on the left side)

3. **Click "Inbound Rules"** (on the left)

4. **Click "New Rule..."** (on the right)

5. **Select "Port"** → Click "Next"

6. **Select "TCP"** → Enter port: `5173` → Click "Next"

7. **Select "Allow the connection"** → Click "Next"

8. **Check all three boxes** (Domain, Private, Public) → Click "Next"

9. **Name it:** "Vite Dev Server" → Click "Finish"

10. **Repeat steps 4-9 for port `3000`** (name it "Game Server")

## Quick Method: Temporarily Disable Firewall (Testing Only)

⚠️ **WARNING: Only do this for testing! Re-enable it after testing!**

1. **Open Windows Defender Firewall**

2. **Click "Turn Windows Defender Firewall on or off"** (on the left)

3. **Turn off firewall for "Private network settings"** (temporarily)

4. **Click "OK"**

5. **Test your phone connection**

6. **Re-enable the firewall after testing!**

## Verify Firewall Settings

After configuring, test if ports are accessible:

1. **Open Command Prompt as Administrator**

2. **Check if ports are listening:**
   ```bash
   netstat -an | findstr "5173"
   netstat -an | findstr "3000"
   ```

3. **You should see entries like:**
   ```
   TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING
   TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING
   ```
   
   If you see `0.0.0.0` instead of `127.0.0.1` or `::1`, the server is accessible from the network!

## Troubleshooting

**Still can't connect?**

1. **Check if both servers are running:**
   - Vite dev server (port 5173)
   - Game server (port 3000)

2. **Verify IP address:**
   - Run `ipconfig` in Command Prompt
   - Make sure you're using the correct IPv4 address

3. **Check network:**
   - Phone and computer must be on the same Wi-Fi network
   - Some public Wi-Fi networks block device-to-device communication

4. **Try disabling antivirus temporarily:**
   - Some antivirus software has its own firewall
   - Temporarily disable to test (remember to re-enable!)

5. **Check router settings:**
   - Some routers have "AP Isolation" enabled
   - This prevents devices on the same network from communicating
   - Check your router admin panel

## Security Note

Allowing Node.js through the firewall only affects your local network. It's safe for development/testing on your home Wi-Fi. Don't do this on public networks!

