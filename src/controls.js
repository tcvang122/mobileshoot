// Controls: Mouse/Touch and Gyroscope

import * as THREE from 'three';
import * as gameState from './gameState.js';
import { renderer, camera, handleResize } from './sceneSetup.js';
import { gunGroup } from './gameObjects.js';
import { updateHUD } from './ui.js';
import { MESSAGE_DISPLAY_TIME } from './config.js';
import { GunController } from '../GunController.js';
import { handlePlayerFire } from './gameLogic.js';

let isDragging = false;
let touchStartX = 0;
let touchStartY = 0;

// Create GunController instance
export const gun = new GunController({
    // AIMING
    onAim: ({ alpha, beta, gamma }) => {
        if (!gameState.gameStarted || !gameState.gyroEnabled) {
            return;
        }
        
        if (alpha === null || beta === null || gamma === null) {
            return;
        }
        
        // Auto-calibrate on first valid reading
        if (gameState.gyroCalibration.alpha === 0 && gameState.gyroCalibration.beta === 0 && gameState.gyroCalibration.gamma === 0) {
            gameState.gyroCalibration.alpha = alpha;
            gameState.gyroCalibration.beta = beta;
            gameState.gyroCalibration.gamma = gamma;
            console.log('Gyroscope auto-calibrated:', gameState.gyroCalibration);
        }
        
        const calibratedAlpha = alpha - gameState.gyroCalibration.alpha;
        const calibratedBeta = beta - gameState.gyroCalibration.beta;
        const calibratedGamma = gamma - gameState.gyroCalibration.gamma;
        
        gameState.lastGyroValues.alpha = gameState.lastGyroValues.alpha + (calibratedAlpha - gameState.lastGyroValues.alpha) * (1 - gameState.gyroSmoothing);
        gameState.lastGyroValues.beta = gameState.lastGyroValues.beta + (calibratedBeta - gameState.lastGyroValues.beta) * (1 - gameState.gyroSmoothing);
        gameState.lastGyroValues.gamma = gameState.lastGyroValues.gamma + (calibratedGamma - gameState.lastGyroValues.gamma) * (1 - gameState.gyroSmoothing);
        
        const sensitivity = 1.5;
        const normalizedGamma = (gameState.lastGyroValues.gamma / 45) * sensitivity;
        const normalizedBeta = (gameState.lastGyroValues.beta / 45) * sensitivity;
        
        const targetX = THREE.MathUtils.clamp(normalizedGamma, -1, 1);
        const targetY = THREE.MathUtils.clamp(-normalizedBeta, -1, 1);
        
        gameState.reticleX = gameState.reticleX + (targetX - gameState.reticleX) * 0.5;
        gameState.reticleY = gameState.reticleY + (targetY - gameState.reticleY) * 0.5;
        
        const crosshair = document.getElementById('crosshair');
        if (!crosshair) return;
        const rect = renderer.domElement.getBoundingClientRect();
        const screenX = ((gameState.reticleX + 1) / 2) * rect.width;
        const screenY = ((1 - gameState.reticleY) / 2) * rect.height;
        crosshair.style.left = screenX + 'px';
        crosshair.style.top = screenY + 'px';
    },

    // HOLSTERING
    onHolsterStatus: (isHolstered) => {
        const timeSinceLastMessage = Date.now() - gameState.lastImportantMessageTime;
        if (timeSinceLastMessage < MESSAGE_DISPLAY_TIME && !isHolstered) {
            return;
        }
        
        if (isHolstered) {
            if (gameState.playerAmmo < gameState.maxAmmo) {
                updateHUD("STATUS: READY (Tap Reload)", "");
            } else {
                updateHUD("STATUS: READY", "");
            }
            
            const hud = document.getElementById('hud');
            hud.classList.remove('holstered');
            document.getElementById('crosshair').classList.add('visible');
            gunGroup.visible = true;
        } else if (gameState.gameStarted) {
            updateHUD("STATUS: AIMING (Ready)", "");
            const hud = document.getElementById('hud');
            hud.classList.remove('holstered');
            document.getElementById('crosshair').classList.add('visible');
            gunGroup.visible = true;
        }
    },

    // FIRING
    onFire: () => {
        handlePlayerFire(gun);
    }
});

// Mouse/Touch Reticle Setup
export function setupMouseLook() {
    const crosshair = document.getElementById('crosshair');
    
    const updateReticle = (clientX, clientY) => {
        if (!gameState.gameStarted) return;
        if (gameState.gyroEnabled) return;
        
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        gameState.reticleX = THREE.MathUtils.clamp(x, -1, 1);
        gameState.reticleY = THREE.MathUtils.clamp(y, -1, 1);
        
        crosshair.style.left = clientX + 'px';
        crosshair.style.top = clientY + 'px';
    };
    
    const handleMouseMove = (e) => {
        updateReticle(e.clientX, e.clientY);
    };
    
    const handleTouchStart = (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isDragging = false;
        }
    };
    
    const handleTouchMove = (e) => {
        if (!gameState.gameStarted) return;
        if (e.touches.length === 1) {
            const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
            const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
            if (deltaX > 10 || deltaY > 10) {
                isDragging = true;
            }
            
            if (!gameState.gyroEnabled) {
                e.preventDefault();
                updateReticle(e.touches[0].clientX, e.touches[0].clientY);
            }
        }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    let lastTapTime = 0;
    let lastMouseClickTime = 0;
    
    document.addEventListener('touchend', (e) => {
        if (!isDragging) {
            const now = Date.now();
            if (lastTapTime && now - lastTapTime < 300) {
                recalibrateGyroscope();
                const hud = document.getElementById('hud');
                if (hud) {
                    const originalText = hud.innerText;
                    updateHUD("GYROSCOPE RECALIBRATED", "#00ffff");
                    setTimeout(() => {
                        updateHUD(originalText, "");
                    }, 1000);
                }
            }
            lastTapTime = now;
        }
        isDragging = false;
    });
    
    document.addEventListener('click', (e) => {
        const now = Date.now();
        if (lastMouseClickTime && now - lastMouseClickTime < 300) {
            recalibrateGyroscope();
            const hud = document.getElementById('hud');
            if (hud) {
                const originalText = hud.innerText;
                updateHUD("GYROSCOPE RECALIBRATED", "#00ffff");
                setTimeout(() => {
                    updateHUD(originalText, "");
                }, 1000);
            }
        }
        lastMouseClickTime = now;
    });
}

export function recalibrateGyroscope() {
    gameState.gyroCalibration = { ...gameState.lastGyroValues };
    gameState.reticleX = 0;
    gameState.reticleY = 0;
    console.log('Gyroscope recalibrated');
}

// Window resize handler
window.addEventListener('resize', handleResize);

