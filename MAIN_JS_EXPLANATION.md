# Main.js Files Explanation

## Current Status

### ✅ **Active File: `main.js`** (645 lines)
- **Location**: Root directory (`mobile-gun-game/main.js`)
- **Status**: ✅ **CURRENTLY IN USE**
- **Purpose**: Refactored modular entry point that imports all modules from `src/`
- **Referenced by**: `index.html` line 1238: `<script type="module" src="/main.js"></script>`
- **Description**: This is the clean, refactored version that coordinates all the modular components

### 📦 **Backup Files** (Not in use)

1. **`main1.js`** (3886 lines)
   - **Purpose**: Original monolithic file (backup)
   - **Status**: Backup - not used
   - **Why it exists**: Kept as a reference/backup of the original code

2. **`main-new.js`** (232 lines)
   - **Purpose**: Earlier refactoring attempt
   - **Status**: Not used - superseded by `main.js`
   - **Why it exists**: Intermediate version during refactoring

3. **`src/main.js`** (25 lines)
   - **Purpose**: Vite template file (leftover from project setup)
   - **Status**: Not used - just a template
   - **Why it exists**: Default Vite starter template that wasn't removed

## Which One Should You Use?

**✅ Use `main.js` (root directory)** - This is the active, refactored version.

## Recommendation: Clean Up

You can safely delete:
- `main-new.js` (superseded by `main.js`)
- `src/main.js` (just a Vite template)

**Keep:**
- `main.js` (active file)
- `main1.js` (backup of original - good to keep as reference)

## File Structure

```
mobile-gun-game/
├── main.js          ← ✅ ACTIVE (refactored, uses modules)
├── main1.js         ← 📦 Backup (original monolithic)
├── main-new.js      ← 🗑️ Can delete (old attempt)
└── src/
    ├── main.js      ← 🗑️ Can delete (Vite template)
    ├── config.js    ← ✅ Module
    ├── gameState.js ← ✅ Module
    ├── sceneSetup.js ← ✅ Module
    └── ... (other modules)
```

## Summary

**The game is using `main.js` in the root directory**, which is the refactored version that imports all the modular components from `src/`. The other files are backups or unused templates.

