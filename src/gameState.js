// Game State Management

import { PERFECT_ZONE_WIDTH } from './config.js';

// Game state variables
export let opponentHealth = 100;
export let playerHealth = 100;
export let playerAmmo = 6;
export let maxAmmo = 6;
export let isReloading = false;
export let gameStarted = false;
export let orientationEnabled = false;
export let lastFireTime = 0;
export let lastImportantMessageTime = 0;

// Reload system state
export let reloadSkillBarAnimationFrame = null;
export let reloadSliderPosition = 0;
export let reloadSliderDirection = 1;
export let reloadLastAnimationTime = 0;
export let reloadPerfectZoneStart = 45;
export let reloadPerfectZoneEnd = 55;

// Opponent AI state
export let opponentLastShotTime = 0;
export let OPPONENT_SHOOT_INTERVAL = 1500;
export let currentOpponentData = null;
export let currentPvPOpponentStats = null;
export let enemyAttackPhase = 'normal';
export let enemyPatternShotCount = 0;
export let enemyPatternType = 'single';
export let enemyNextPatternTime = 0;

// Dodge state (removed but keeping for compatibility)
export let isDodging = false;
export let dodgeCooldown = false;
export let dodgeCooldownTime = 0;
export let dodgeInvincibilityEnd = 0;

// Reticle state
export let reticleX = 0;
export let reticleY = 0;

// Gyroscope state
export let gyroCalibration = { alpha: 0, beta: 0, gamma: 0 };
export let gyroSmoothing = 0.15;
export let lastGyroValues = { alpha: 0, beta: 0, gamma: 0 };
export let gyroEnabled = false;
export let gyroscopePermissionGranted = false;

// PvP state
export let socket = null;
export let isPvPMode = false;
export let currentRoomId = null;
export let opponentPlayer = null;
export let isPlayer1 = false;
export let gameMode = 'singleplayer';
export let matchmakingActive = false;

// User state
export let currentUser = null;
export let isAuthenticated = false;
export let selectedOpponent = null;
export let userStats = {
    name: 'Player',
    rank: 'Bronze',
    wins: 0,
    credits: 100,
    avatar: null,
    selectedWeapon: 'pistol',
    selectedCharacter: 'default',
    characterCustomization: {
        primaryColor: '#00ffff',
        secondaryColor: '#ff00ff'
    }
};

// Online players
export let onlinePlayersList = [];

// Reset game state
export function resetGameState() {
    opponentHealth = 100;
    playerHealth = 100;
    playerAmmo = 6;
    maxAmmo = 6;
    isReloading = false;
    gameStarted = false;
    orientationEnabled = false;
    reloadSkillBarAnimationFrame = null;
    reloadSliderPosition = 0;
    reloadSliderDirection = 1;
    reticleX = 0;
    reticleY = 0;
    gyroCalibration = { alpha: 0, beta: 0, gamma: 0 };
    lastGyroValues = { alpha: 0, beta: 0, gamma: 0 };
}

