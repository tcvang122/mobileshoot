// UI Management

import * as gameState from './gameState.js';
import { camera } from './sceneSetup.js';
import { opponentGroup } from './gameObjects.js';
import { ATTACK_DIRECTIONS, BLOCK_PERFECT_ZONE_START, BLOCK_PERFECT_ZONE_END, BLOCK_GOOD_ZONE_START, BLOCK_GOOD_ZONE_END } from './config.js';

// Get UI elements
const hud = document.getElementById('hud');
const healthBarFill = document.getElementById('health-bar-fill');
const staminaBarFill = document.getElementById('stamina-bar-fill');
const directionIndicator = document.getElementById('direction-indicator');

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

// Update direction indicator
export function updateDirectionIndicator() {
    if (!directionIndicator) return;
    
    const direction = gameState.currentDirection;
    
    // Clear all direction classes
    directionIndicator.classList.remove('up', 'down', 'left', 'right', 'active');
    
    if (direction) {
        directionIndicator.classList.add(direction, 'active');
        
        // Update direction arrows
        const upArrow = directionIndicator.querySelector('.arrow-up');
        const downArrow = directionIndicator.querySelector('.arrow-down');
        const leftArrow = directionIndicator.querySelector('.arrow-left');
        const rightArrow = directionIndicator.querySelector('.arrow-right');
        
        // Reset all arrows - only change opacity, let CSS handle transforms
        [upArrow, downArrow, leftArrow, rightArrow].forEach(arrow => {
            if (arrow) {
                arrow.style.opacity = '0.3';
                // Don't set transform - let CSS handle positioning
            }
        });
        
        // Highlight active direction
        let activeArrow = null;
        switch(direction) {
            case ATTACK_DIRECTIONS.UP:
                activeArrow = upArrow;
                break;
            case ATTACK_DIRECTIONS.DOWN:
                activeArrow = downArrow;
                break;
            case ATTACK_DIRECTIONS.LEFT:
                activeArrow = leftArrow;
                break;
            case ATTACK_DIRECTIONS.RIGHT:
                activeArrow = rightArrow;
                break;
        }
        
        if (activeArrow) {
            activeArrow.style.opacity = '1';
            // Don't set transform - let CSS handle positioning
        }
    }
}

// Update player stamina bar
export function updateStaminaBar() {
    if (!staminaBarFill) return;
    const percentage = Math.max(0, Math.min(100, gameState.playerStamina));
    staminaBarFill.style.width = percentage + '%';
    
    // Change color based on stamina level
    if (percentage > 60) {
        staminaBarFill.style.background = 'linear-gradient(90deg, #ffff00, #ffaa00)';
    } else if (percentage > 30) {
        staminaBarFill.style.background = 'linear-gradient(90deg, #ffaa00, #ff6600)';
    } else {
        staminaBarFill.style.background = 'linear-gradient(90deg, #ff6600, #ff0000)';
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

// Update opponent stamina bar (3D)
export function updateOpponentStaminaBar() {
    const percentage = Math.max(0, Math.min(100, gameState.opponentStamina));
    
    if (opponentGroup.userData.staminaBarFill) {
        const staminaBarFill3D = opponentGroup.userData.staminaBarFill;
        staminaBarFill3D.scale.x = percentage / 100;
        
        // Change color based on stamina level
        if (percentage > 60) {
            staminaBarFill3D.material.color.setHex(0xffff00);
        } else if (percentage > 30) {
            staminaBarFill3D.material.color.setHex(0xffaa00);
        } else {
            staminaBarFill3D.material.color.setHex(0xff6600);
        }
        
        staminaBarFill3D.lookAt(camera.position);
        if (opponentGroup.userData.staminaBarBg) {
            opponentGroup.userData.staminaBarBg.lookAt(camera.position);
        }
    }
}

// Update opponent guard indicator (3D above opponent's head - For Honor style)
export function updateOpponentGuardIndicator(direction, isAttacking = false) {
    if (!opponentGroup.userData.guardIndicator) return;
    
    const guardIndicator = opponentGroup.userData.guardIndicator;
    
    // Hide all arrows
    guardIndicator.children.forEach(child => {
        if (child.name && child.name.startsWith('guard-')) {
            child.visible = false;
        }
    });
    
    // Show guard indicator if direction is set
    if (direction) {
        let targetArrow = null;
        switch(direction) {
            case 'up':
                targetArrow = guardIndicator.children.find(c => c.name === 'guard-up');
                break;
            case 'left':
                targetArrow = guardIndicator.children.find(c => c.name === 'guard-left');
                break;
            case 'right':
                targetArrow = guardIndicator.children.find(c => c.name === 'guard-right');
                break;
        }
        
        if (targetArrow) {
            targetArrow.visible = true;
            // Change color if attacking (red) vs guarding (cyan)
            if (isAttacking) {
                targetArrow.material.color.setHex(0xff0000);
                if (targetArrow.material.emissive) {
                    targetArrow.material.emissive.setHex(0xff0000);
                    targetArrow.material.emissiveIntensity = 0.5;
                }
            } else {
                targetArrow.material.color.setHex(0x00ffff);
                if (targetArrow.material.emissive) {
                    targetArrow.material.emissive.setHex(0x00ffff);
                    targetArrow.material.emissiveIntensity = 0.3;
                }
            }
        }
        guardIndicator.visible = true;
    } else {
        guardIndicator.visible = false;
    }
}

// Update opponent incoming attack indicator - deprecated, now using 3D indicator
export function updateOpponentAttackIndicator(direction, show) {
    // Use the new 3D guard indicator instead
    updateOpponentGuardIndicator(direction, show);
}

// Update HUD text
export function updateHUD(text, color = '') {
    if (hud) {
        hud.innerText = text;
        hud.style.color = color;
    }
}

// Block timing slider management
let blockTimingSliderActive = false;
let blockTimingSliderStartTime = 0;
let blockTimingSliderCallback = null;

export function showBlockTimingSlider(duration, onBlock) {
    const slider = document.getElementById('block-timing-slider');
    if (!slider) return;
    
    blockTimingSliderActive = true;
    blockTimingSliderStartTime = Date.now();
    blockTimingSliderCallback = onBlock;
    
    // Reset slider
    const indicator = slider.querySelector('.block-timing-indicator');
    const feedback = slider.querySelector('.block-timing-feedback');
    if (indicator) {
        // Reset animation
        indicator.style.animation = 'none';
        indicator.offsetHeight; // Force reflow
        indicator.style.left = '0';
        indicator.style.animation = `slideIndicator ${duration}ms linear`;
    }
    if (feedback) {
        feedback.textContent = 'BLOCK NOW!';
        feedback.className = 'block-timing-feedback';
    }
    
    // Show slider
    slider.classList.add('show');
    
    // Auto-hide after duration
    setTimeout(() => {
        if (blockTimingSliderActive) {
            hideBlockTimingSlider();
            if (onBlock) {
                onBlock(false, 'miss'); // Timeout = miss
            }
        }
    }, duration);
}

export function hideBlockTimingSlider() {
    const slider = document.getElementById('block-timing-slider');
    if (slider) {
        slider.classList.remove('show');
    }
    blockTimingSliderActive = false;
    blockTimingSliderCallback = null;
}

export function checkBlockTiming() {
    if (!blockTimingSliderActive) return null;
    
    const now = Date.now();
    const elapsed = now - blockTimingSliderStartTime;
    const slider = document.getElementById('block-timing-slider');
    if (!slider) return null;
    
    const indicator = slider.querySelector('.block-timing-indicator');
    if (!indicator) return null;
    
    // Get current position (0-1)
    const sliderDuration = parseFloat(indicator.style.animationDuration) || 1000;
    const position = Math.min(1, elapsed / sliderDuration);
    
    // Check which zone we're in
    if (position >= BLOCK_PERFECT_ZONE_START && position <= BLOCK_PERFECT_ZONE_END) {
        return 'perfect';
    } else if (position >= BLOCK_GOOD_ZONE_START && position <= BLOCK_GOOD_ZONE_END) {
        return 'good';
    } else {
        return 'miss';
    }
}

export function triggerBlockTiming() {
    if (!blockTimingSliderActive) return null;
    
    const timing = checkBlockTiming();
    if (!timing) return null;
    
    const feedback = document.getElementById('block-timing-slider')?.querySelector('.block-timing-feedback');
    if (feedback) {
        if (timing === 'perfect') {
            feedback.textContent = 'PERFECT BLOCK!';
            feedback.className = 'block-timing-feedback perfect';
        } else if (timing === 'good') {
            feedback.textContent = 'GOOD BLOCK';
            feedback.className = 'block-timing-feedback good';
        } else {
            feedback.textContent = 'TOO EARLY/LATE';
            feedback.className = 'block-timing-feedback miss';
        }
    }
    
    // Don't hide immediately - let the game logic handle it
    // hideBlockTimingSlider();
    
    if (blockTimingSliderCallback) {
        blockTimingSliderCallback(true, timing);
    }
    
    return timing; // Return the timing result
}

// Show block notification popup
export function showBlockNotification(type = 'player') {
    const blockPopup = document.getElementById('block-popup');
    if (!blockPopup) return;
    
    // Update icon and text based on who blocked
    const icon = blockPopup.querySelector('.block-popup-icon');
    const text = blockPopup.querySelector('.block-popup-text');
    
    if (type === 'player') {
        // Player's attack was blocked by opponent
        if (icon) icon.textContent = '🛡️';
        if (text) text.textContent = 'BLOCKED!';
        blockPopup.querySelector('.block-popup-content').style.background = 
            'linear-gradient(135deg, rgba(255, 255, 0, 0.95) 0%, rgba(255, 200, 0, 0.95) 100%)';
    } else {
        // Player blocked opponent's attack
        if (icon) icon.textContent = '✓';
        if (text) text.textContent = 'BLOCKED!';
        blockPopup.querySelector('.block-popup-content').style.background = 
            'linear-gradient(135deg, rgba(0, 255, 255, 0.95) 0%, rgba(0, 200, 255, 0.95) 100%)';
    }
    
    // Show popup
    blockPopup.classList.add('show');
    
    // Hide after animation
    setTimeout(() => {
        blockPopup.classList.remove('show');
    }, 1500);
}

