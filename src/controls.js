// Controls: Tilt-Based Directional Combat System (For Honor Style)

import * as THREE from 'three';
import * as gameState from './gameState.js';
import { setCurrentDirection, setAttackType } from './gameState.js';
import { ATTACK_DIRECTIONS, ATTACK_TYPES, GUARD_DIRECTIONS, TILT_THRESHOLD, TILT_DEADZONE } from './config.js';
import { renderer, camera } from './sceneSetup.js';
import { updateHUD, updateDirectionIndicator } from './ui.js';
import { MESSAGE_DISPLAY_TIME } from './config.js';
import { handlePlayerAttack } from './gameLogic.js';

// Directional Combat Controller
export class MeleeCombatController {
    constructor(options) {
        this.onDirectionChange = options.onDirectionChange || (() => {});
        this.onAttack = options.onAttack || (() => {});
        
        this.currentDirection = null;
        this.lastDirectionChangeTime = 0;
        this.directionChangeCooldown = 200; // Prevent rapid direction changes (reduced for smoother blocking)
        this.directionStabilityTime = 0; // Time direction has been stable
        this.stabilityThreshold = 150; // Must hold direction for 150ms before visual update (reduced for responsiveness)
        
        // Calibration
        this.calibrated = false;
        this.baseAlpha = 0;
        this.baseBeta = 0;
        this.baseGamma = 0;
    }

    async initialize() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        (typeof window.orientation !== 'undefined') ||
                        ('ontouchstart' in window) ||
                        (navigator.maxTouchPoints > 0);
        
        if (!isMobile) {
            return false;
        }
        
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    this.addListeners();
                    return true;
                }
                return false;
            } catch (e) {
                console.error(e);
                return false;
            }
        } else {
            this.addListeners();
            return true;
        }
    }

    addListeners() {
        if (this._orientationHandler) {
            window.removeEventListener('deviceorientation', this._orientationHandler);
        }
        
        this._orientationHandler = this.handleOrientation.bind(this);
        window.addEventListener('deviceorientation', this._orientationHandler);
        
        console.log('Melee combat controller initialized');
    }

    calibrate(alpha, beta, gamma) {
        this.baseAlpha = alpha || 0;
        this.baseBeta = beta || 0;
        this.baseGamma = gamma || 0;
        this.calibrated = true;
        console.log('Combat controller calibrated:', { alpha: this.baseAlpha, beta: this.baseBeta, gamma: this.baseGamma });
    }

    handleOrientation(event) {
        if (!gameState.gameStarted || !gameState.gyroEnabled) {
            return;
        }
        
        const { alpha, beta, gamma } = event;
        
        if (alpha === null || beta === null || gamma === null) {
            return;
        }
        
        // Auto-calibrate on first valid reading
        if (!this.calibrated) {
            this.calibrate(alpha, beta, gamma);
            return;
        }
        
        // Calculate relative tilt from calibrated position
        const deltaAlpha = alpha - this.baseAlpha;
        const deltaBeta = beta - this.baseBeta;
        const deltaGamma = gamma - this.baseGamma;
        
        // Normalize angles to [-180, 180]
        const normalizeAngle = (angle) => {
            while (angle > 180) angle -= 360;
            while (angle < -180) angle += 360;
            return angle;
        };
        
        const normalizedAlpha = normalizeAngle(deltaAlpha);
        const normalizedBeta = normalizeAngle(deltaBeta);
        const normalizedGamma = normalizeAngle(deltaGamma);
        
        // Determine direction based on tilt
        // Beta: front/back tilt (up/down)
        // Gamma: left/right tilt
        let newDirection = null;
        
        const now = Date.now();
        
        // Check for direction based on dominant tilt
        const absBeta = Math.abs(normalizedBeta);
        const absGamma = Math.abs(normalizedGamma);
        
        let detectedDirection = null;
        
        if (absBeta > TILT_THRESHOLD || absGamma > TILT_THRESHOLD) {
            // Determine which axis has more tilt
            if (absBeta > absGamma) {
                // Front/back tilt (up/down)
                if (normalizedBeta > TILT_THRESHOLD) {
                    detectedDirection = GUARD_DIRECTIONS.UP; // Phone tilted forward (up guard)
                } else if (normalizedBeta < -TILT_THRESHOLD) {
                    detectedDirection = null; // Phone tilted back - clear guard (for dodging)
                }
            } else {
                // Left/right tilt
                if (normalizedGamma > TILT_THRESHOLD) {
                    detectedDirection = GUARD_DIRECTIONS.RIGHT; // Phone tilted right
                } else if (normalizedGamma < -TILT_THRESHOLD) {
                    detectedDirection = GUARD_DIRECTIONS.LEFT; // Phone tilted left
                }
            }
        } else {
            // Within deadzone - keep current guard (For Honor style: guard persists)
            detectedDirection = this.currentDirection; // Don't clear guard when neutral
        }
        
        // For Honor style: Guard direction persists until changed
        // Update guard direction immediately for blocking
        if (detectedDirection !== this.currentDirection) {
            // Guard direction changed
            this.directionStabilityTime = now;
            if (now - this.lastDirectionChangeTime >= this.directionChangeCooldown) {
                this.currentDirection = detectedDirection;
                this.lastDirectionChangeTime = now;
                // Update guard direction in gameState
                setGuardDirection(detectedDirection);
                setCurrentDirection(detectedDirection); // Keep for compatibility
                this.onDirectionChange(detectedDirection);
            }
        } else if (detectedDirection === this.currentDirection && this.currentDirection !== null) {
            // Same guard direction - ensure it's set in gameState
            if (gameState.guardDirection !== this.currentDirection) {
                setGuardDirection(this.currentDirection);
                setCurrentDirection(this.currentDirection);
            }
            // Update visual indicator after stability period
            if (this.directionStabilityTime === 0) {
                this.directionStabilityTime = now;
            } else if (now - this.directionStabilityTime >= this.stabilityThreshold) {
                this.onDirectionChange(this.currentDirection);
            }
        }
        // Note: Guard persists when neutral (detectedDirection === this.currentDirection === null)
        // This is For Honor style - guard stays until you change it
    }
    
    // Public method to perform attack
    attack(attackType) {
        console.log('=== attack() method called ===');
        console.log('Attack type:', attackType);
        console.log('Game started:', gameState.gameStarted);
        console.log('Current direction:', this.currentDirection);
        
        if (!gameState.gameStarted) {
            console.log('Game not started, returning');
            return;
        }
        if (this.currentDirection === null) {
            console.log('No direction selected');
            updateHUD("TILT PHONE TO SELECT DIRECTION", "#ffaa00");
            return;
        }
        console.log('=== EXECUTING ATTACK ===');
        console.log('Direction:', this.currentDirection);
        console.log('Attack Type:', attackType);
        this.onAttack(this.currentDirection, attackType);
    }
}

// Create MeleeCombatController instance
export const combatController = new MeleeCombatController({
    onDirectionChange: (direction) => {
        if (!gameState.gameStarted) return;
        
        const directionNames = {
            [ATTACK_DIRECTIONS.UP]: 'UP',
            [ATTACK_DIRECTIONS.DOWN]: 'DOWN',
            [ATTACK_DIRECTIONS.LEFT]: 'LEFT',
            [ATTACK_DIRECTIONS.RIGHT]: 'RIGHT'
        };
        
        const directionName = direction ? directionNames[direction] : 'NEUTRAL';
        updateHUD(`DIRECTION: ${directionName}`, "#00ffff");
        updateDirectionIndicator();
    },
    
    onAttack: (direction, attackType) => {
        handlePlayerAttack(direction, attackType);
    }
});

// Touch/Click handlers for attack buttons
let lightAttackButton = null;
let heavyAttackButton = null;
let buttonsSetup = false;

export function setupAttackButtons() {
    console.log('setupAttackButtons called');
    
    // Create or get attack buttons
    if (!lightAttackButton) {
        lightAttackButton = document.getElementById('light-attack-button');
        console.log('Light attack button found:', lightAttackButton);
    }
    if (!heavyAttackButton) {
        heavyAttackButton = document.getElementById('heavy-attack-button');
        console.log('Heavy attack button found:', heavyAttackButton);
    }
    
    if (lightAttackButton && !buttonsSetup) {
        console.log('Setting up light attack button listeners');
        lightAttackButton.addEventListener('click', (e) => {
            console.log('=== LIGHT ATTACK BUTTON CLICKED ===');
            console.log('Current direction:', combatController.currentDirection);
            console.log('Game started:', gameState.gameStarted);
            e.preventDefault();
            e.stopPropagation();
            combatController.attack(ATTACK_TYPES.LIGHT);
        });
        lightAttackButton.addEventListener('touchstart', (e) => {
            console.log('=== LIGHT ATTACK BUTTON TOUCHED ===');
            console.log('Current direction:', combatController.currentDirection);
            console.log('Game started:', gameState.gameStarted);
            e.preventDefault();
            e.stopPropagation();
            combatController.attack(ATTACK_TYPES.LIGHT);
        }, { passive: false });
    }
    
    if (heavyAttackButton && !buttonsSetup) {
        console.log('Setting up heavy attack button listeners');
        heavyAttackButton.addEventListener('click', (e) => {
            console.log('=== HEAVY ATTACK BUTTON CLICKED ===');
            console.log('Current direction:', combatController.currentDirection);
            console.log('Game started:', gameState.gameStarted);
            e.preventDefault();
            e.stopPropagation();
            combatController.attack(ATTACK_TYPES.HEAVY);
        });
        heavyAttackButton.addEventListener('touchstart', (e) => {
            console.log('=== HEAVY ATTACK BUTTON TOUCHED ===');
            console.log('Current direction:', combatController.currentDirection);
            console.log('Game started:', gameState.gameStarted);
            e.preventDefault();
            e.stopPropagation();
            combatController.attack(ATTACK_TYPES.HEAVY);
        }, { passive: false });
    }
    
    buttonsSetup = true;
}

// Keyboard controls for desktop testing
export function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        if (!gameState.gameStarted) return;
        
        // Set direction with arrow keys or WASD
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            setCurrentDirection(ATTACK_DIRECTIONS.UP);
            combatController.currentDirection = ATTACK_DIRECTIONS.UP;
            updateDirectionIndicator();
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            setCurrentDirection(ATTACK_DIRECTIONS.DOWN);
            combatController.currentDirection = ATTACK_DIRECTIONS.DOWN;
            updateDirectionIndicator();
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            setCurrentDirection(ATTACK_DIRECTIONS.LEFT);
            combatController.currentDirection = ATTACK_DIRECTIONS.LEFT;
            updateDirectionIndicator();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            setCurrentDirection(ATTACK_DIRECTIONS.RIGHT);
            combatController.currentDirection = ATTACK_DIRECTIONS.RIGHT;
            updateDirectionIndicator();
        } else if (e.key === ' ' || e.key === 'j' || e.key === 'J') {
            // Space or J for light attack
            e.preventDefault();
            console.log('Light attack key pressed (Space/J) - Current direction:', combatController.currentDirection);
            combatController.attack(ATTACK_TYPES.LIGHT);
        } else if (e.key === 'Shift' || e.key === 'Enter' || e.key === 'k' || e.key === 'K') {
            // Shift/Enter/K for heavy attack
            e.preventDefault();
            console.log('Heavy attack key pressed (Shift/Enter/K) - Current direction:', combatController.currentDirection);
            combatController.attack(ATTACK_TYPES.HEAVY);
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key.startsWith('Arrow') || 
            e.key === 'w' || e.key === 'W' ||
            e.key === 's' || e.key === 'S' ||
            e.key === 'a' || e.key === 'A' ||
            e.key === 'd' || e.key === 'D') {
            // Reset direction when direction key released
            setCurrentDirection(null);
            combatController.currentDirection = null;
            updateDirectionIndicator();
        }
    });
}

export function recalibrateCombatController() {
    combatController.calibrated = false;
    console.log('Combat controller recalibrated');
}

// Initialize keyboard controls
setupKeyboardControls();
