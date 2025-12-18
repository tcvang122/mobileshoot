// UI Management

import * as gameState from './gameState.js';
import { camera } from './sceneSetup.js';
import { opponentGroup } from './gameObjects.js';

// Get UI elements
const hud = document.getElementById('hud');
const healthBarFill = document.getElementById('health-bar-fill');
const ammoCount = document.getElementById('ammo-count');

// Update health bar
export function updateHealthBar() {
    const percentage = Math.max(0, Math.min(100, gameState.playerHealth));
    healthBarFill.style.width = percentage + '%';
    
    if (percentage > 60) {
        healthBarFill.style.background = 'linear-gradient(90deg, #00ff00, #00cc00)';
    } else if (percentage > 30) {
        healthBarFill.style.background = 'linear-gradient(90deg, #ffaa00, #ff8800)';
    } else {
        healthBarFill.style.background = 'linear-gradient(90deg, #ff0000, #cc0000)';
    }
}

// Update ammo count
export function updateAmmoCount() {
    const bullets = ammoCount.querySelectorAll('.bullet');
    bullets.forEach((bullet, index) => {
        if (index < gameState.playerAmmo) {
            bullet.classList.remove('empty');
        } else {
            bullet.classList.add('empty');
        }
    });
    
    if (gameState.playerAmmo <= 2) {
        ammoCount.classList.add('low');
    } else {
        ammoCount.classList.remove('low');
    }
    
    const reloadBtn = document.getElementById('reload-button');
    if (reloadBtn) {
        if (gameState.playerAmmo >= gameState.maxAmmo) {
            reloadBtn.disabled = true;
            reloadBtn.style.opacity = '0.5';
            reloadBtn.style.pointerEvents = 'none';
        } else if (!gameState.isReloading) {
            reloadBtn.disabled = false;
            reloadBtn.style.opacity = '1';
            reloadBtn.style.pointerEvents = 'auto';
        }
    }
}

// Update opponent health bar (3D)
export function updateOpponentHealthBar() {
    const percentage = Math.max(0, Math.min(100, gameState.opponentHealth));
    
    if (opponentGroup.userData.healthBarFill) {
        const healthBarFill3D = opponentGroup.userData.healthBarFill;
        healthBarFill3D.scale.x = percentage / 100;
        
        if (percentage > 60) {
            healthBarFill3D.material.color.setHex(0xff0000);
        } else if (percentage > 30) {
            healthBarFill3D.material.color.setHex(0xff6600);
        } else {
            healthBarFill3D.material.color.setHex(0xff3333);
        }
        
        healthBarFill3D.lookAt(camera.position);
        if (opponentGroup.userData.healthBarBg) {
            opponentGroup.userData.healthBarBg.lookAt(camera.position);
        }
    }
}

// Update HUD text
export function updateHUD(text, color = '') {
    if (hud) {
        hud.innerText = text;
        hud.style.color = color;
    }
}

