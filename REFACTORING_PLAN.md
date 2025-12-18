# Main.js Refactoring Plan

This document outlines how `main.js` (3886 lines) has been split into modular files.

## Module Structure

### 1. `src/config.js`
- Game configuration constants
- Weapons array
- Opponents array
- Constants (PERFECT_ZONE_WIDTH, MESSAGE_DISPLAY_TIME, etc.)

### 2. `src/gameState.js`
- All game state variables (health, ammo, reload state, etc.)
- PvP state variables
- User state variables
- Gyroscope state
- Export functions to reset state

### 3. `src/sceneSetup.js`
- Three.js scene, camera, renderer setup
- Materials definitions
- Lighting setup
- Scene geometry creation (platforms, structures, etc.)
- Window resize handler

### 4. `src/gameObjects.js`
- Gun model loading and management
- Opponent model loading and management
- 3D health bar creation
- Animation mixer setup

### 5. `src/ui.js`
- Health bar updates
- Ammo count updates
- Opponent health bar updates
- HUD text updates

### 6. `src/controls.js` (To be created)
- Mouse/touch controls
- Gyroscope handling
- Reticle movement
- GunController integration

### 7. `src/gameLogic.js` (To be created)
- Shooting mechanics
- Hit detection
- Opponent AI
- Enemy attack patterns
- Animation updates

### 8. `src/auth.js` (To be created)
- Account creation
- Login/logout
- Session management
- User stats persistence

### 9. `src/menu.js` (To be created)
- Menu initialization
- Opponent card creation
- Online player display
- Menu button handlers

### 10. `src/networking.js` (To be created)
- Socket.io connection
- PvP matchmaking
- Challenge system
- Player synchronization

### 11. `src/reload.js` (To be created)
- Reload skill game
- Reload button setup
- Perfect zone logic

### 12. `main.js` (Updated)
- Main entry point
- Imports all modules
- Initializes game
- Animation loop
- Error handlers

## Import Strategy

All modules use ES6 imports/exports. The main.js file imports from all modules and coordinates initialization.

## Workflow Preservation

The same workflow is maintained:
1. Error handlers setup
2. Scene initialization
3. Game objects loading
4. Authentication check
5. Menu initialization
6. Game start
7. Animation loop

