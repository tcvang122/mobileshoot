# Testing on Your Phone

## Quick Setup Guide

### Step 1: Find Your Computer's IP Address

**Windows:**
1. Open Command Prompt
2. Type: `ipconfig`
3. Look for "IPv4 Address" under your active network adapter
4. Example: `192.168.12.187`

**Mac/Linux:**
1. Open Terminal
2. Type: `ifconfig` or `ip addr`
3. Look for your local network IP (usually starts with 192.168.x.x or 10.x.x.x)

### Step 2: Start Both Servers

You need to run **TWO** servers:

**Terminal 1 - Game Server (Socket.io):**
```bash
cd "D:\HTML Games\mobile-gun-game"
npm run server
```
This will start on port **3000**

**Terminal 2 - Vite Dev Server (Game Client):**
```bash
cd "D:\HTML Games\mobile-gun-game"
npm run dev
```
This will start on port **5173** (or another port if 5173 is taken)

**IMPORTANT:** After creating `vite.config.js`, you MUST restart the Vite server for the changes to take effect!

### Step 3: Update SERVER_URL (if needed)

If your phone can't connect, you may need to manually set the IP in `main.js`:

1. Open `mobile-gun-game/main.js`
2. Find line with `const SERVER_URL = ...`
3. Replace `localhost` with your computer's IP address:
   ```javascript
   const SERVER_URL = 'http://192.168.12.187:3000';
   ```
   (Use YOUR actual IP address!)

### Step 4: Connect from Your Phone

1. Make sure your phone is on the **same Wi-Fi network** as your computer
2. Open your phone's browser (Chrome, Safari, etc.)
3. Go to: `http://192.168.12.187:5173`
   (Replace `192.168.12.187` with YOUR computer's IP address)
   (Replace `5173` with the port Vite shows in Terminal 2)

### Step 5: Test the Game

- The game should load on your phone
- For PvP features, make sure the game server (port 3000) is running
- Test touch controls, reload button, and all game features

## Troubleshooting

**Can't connect from phone?**
- Check firewall: Windows Firewall might be blocking ports 3000 and 5173
- Check network: Phone and computer must be on same Wi-Fi
- Check IP: Make sure you're using the correct IP address
- Check ports: Make sure both servers are running

**Firewall Fix (Windows):**
1. Open Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Allow Node.js and your browser through the firewall
4. Or temporarily disable firewall for testing

**Connection refused?**
- Make sure both servers are running
- Check that ports 3000 and 5173 are not in use by other programs
- Try restarting both servers

## Current Setup

Based on your system:
- **Your Computer IP:** `192.168.12.187`
- **Game Server Port:** `3000`
- **Vite Dev Server Port:** `5173` (check Terminal 2 for actual port)

**Phone URL:** `http://192.168.12.187:5173`

