# PvP Multiplayer Setup Instructions

## Overview
This game now supports both **Single Player (VS AI)** and **Player vs Player (PvP)** modes.

## Setup

### 1. Install Dependencies
```bash
npm install
```

This will install:
- `socket.io-client` (for client)
- `express`, `socket.io`, `cors` (for server)

### 2. Start the Game Server
```bash
npm run server
```

The server will run on `http://localhost:3000` by default.

### 3. Start the Game Client
In a separate terminal:
```bash
npm run dev
```

The game will be available at the URL shown (usually `http://localhost:5173`).

## How to Play PvP

1. **Open the game** in your browser
2. **Click "PLAYER VS PLAYER"** button in the main menu
3. **Wait for matchmaking** - the game will search for another player
4. **Once matched**, both players need to be ready
5. **Battle begins** - fight against a real player!

## Features

### PvP Mode:
- Real-time multiplayer battles
- Matchmaking system pairs players automatically
- Synchronized health, ammo, and actions
- Dodge mechanics work in PvP
- Victory/Defeat tracking

### Single Player Mode:
- Battle against AI opponents
- Original game mechanics preserved
- Enemy attack patterns and phases

## Server Configuration

To change the server URL, edit `main.js`:
```javascript
const SERVER_URL = 'http://localhost:3000'; // Change this to your server URL
```

For production, update this to your deployed server URL.

## Troubleshooting

- **"Not connected to server"**: Make sure the server is running (`npm run server`)
- **Can't find opponent**: You need at least 2 players in matchmaking
- **Connection issues**: Check that port 3000 is not blocked by firewall

## Development Notes

- The server uses Socket.io for real-time communication
- Game state is synchronized between players
- Latency compensation is handled client-side
- Disconnections are handled gracefully

