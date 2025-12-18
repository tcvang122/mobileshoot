// Reload Skill System

import * as gameState from './gameState.js';
import { PERFECT_ZONE_WIDTH } from './config.js';
import { updateAmmoCount } from './ui.js';
import { updateHUD } from './ui.js';

const hud = document.getElementById('hud');

export function startReloadSkillGame() {
    if (gameState.isReloading || gameState.playerAmmo >= gameState.maxAmmo) return;
    
    gameState.isReloading = true;
    gameState.reloadSliderPosition = 0;
    gameState.reloadSliderDirection = 1;
    
    const skillBar = document.getElementById('reload-skill-bar');
    const slider = document.getElementById('reload-skill-bar-slider');
    const track = document.getElementById('reload-skill-bar-track');
    const label = document.getElementById('reload-skill-bar-label');
    
    if (!skillBar || !slider || !track || !label) {
        console.error('Reload skill bar elements not found!');
        gameState.isReloading = false;
        return;
    }
    
    skillBar.classList.add('active');
    label.textContent = 'TAP TO STOP';
    label.style.color = '#00ffff';
    
    const reloadBtn = document.getElementById('reload-button');
    if (reloadBtn) {
        reloadBtn.disabled = true;
    }
    
    gameState.reloadSliderPosition = 0;
    gameState.reloadSliderDirection = 1;
    slider.style.transform = 'translateX(0%)';
    
    const minZoneStart = 10;
    const maxZoneStart = 90 - PERFECT_ZONE_WIDTH;
    const randomZoneStart = Math.random() * (maxZoneStart - minZoneStart) + minZoneStart;
    gameState.reloadPerfectZoneStart = Math.round(randomZoneStart);
    gameState.reloadPerfectZoneEnd = gameState.reloadPerfectZoneStart + PERFECT_ZONE_WIDTH;
    
    const perfectZone = document.getElementById('reload-skill-bar-perfect-zone');
    if (perfectZone) {
        perfectZone.style.left = gameState.reloadPerfectZoneStart + '%';
        perfectZone.style.width = PERFECT_ZONE_WIDTH + '%';
    }
    
    const sliderSpeed = 2;
    gameState.reloadLastAnimationTime = performance.now();
    
    const animateSlider = (currentTime) => {
        if (!gameState.isReloading) {
            if (gameState.reloadSkillBarAnimationFrame) {
                cancelAnimationFrame(gameState.reloadSkillBarAnimationFrame);
                gameState.reloadSkillBarAnimationFrame = null;
            }
            return;
        }
        
        const deltaTime = currentTime - gameState.reloadLastAnimationTime;
        const frameMultiplier = Math.min(deltaTime / 16.67, 2);
        
        gameState.reloadSliderPosition += sliderSpeed * gameState.reloadSliderDirection * frameMultiplier;
        
        if (gameState.reloadSliderPosition >= 100) {
            gameState.reloadSliderPosition = 100;
            gameState.reloadSliderDirection = -1;
        } else if (gameState.reloadSliderPosition <= 0) {
            gameState.reloadSliderPosition = 0;
            gameState.reloadSliderDirection = 1;
        }
        
        const trackWidth = track.offsetWidth;
        const sliderWidth = slider.offsetWidth;
        const maxPosition = trackWidth - sliderWidth;
        const pixelPosition = (gameState.reloadSliderPosition / 100) * maxPosition;
        
        slider.style.transform = `translateX(${pixelPosition}px)`;
        
        gameState.reloadLastAnimationTime = currentTime;
        gameState.reloadSkillBarAnimationFrame = requestAnimationFrame(animateSlider);
    };
    
    gameState.reloadSkillBarAnimationFrame = requestAnimationFrame(animateSlider);
    
    const stopSlider = () => {
        if (!gameState.isReloading) return;
        
        if (gameState.reloadSkillBarAnimationFrame) {
            cancelAnimationFrame(gameState.reloadSkillBarAnimationFrame);
            gameState.reloadSkillBarAnimationFrame = null;
        }
        
        const inPerfectZone = gameState.reloadSliderPosition >= gameState.reloadPerfectZoneStart && 
                             gameState.reloadSliderPosition <= gameState.reloadPerfectZoneEnd;
        
        if (inPerfectZone) {
            label.textContent = 'PERFECT RELOAD!';
            label.style.color = '#00ff00';
            gameState.playerAmmo = gameState.maxAmmo;
            updateAmmoCount();
            updateHUD("PERFECT RELOAD!", "#00ff00");
            
            if (gameState.isPvPMode) {
                // sendPlayerAction will be imported from networking
                if (window.sendPlayerAction) {
                    window.sendPlayerAction({ type: 'reload', timestamp: Date.now(), perfect: true });
                }
            }
            
            setTimeout(() => {
                skillBar.classList.remove('active');
                gameState.isReloading = false;
                label.style.color = '#00ffff';
                if (reloadBtn) reloadBtn.disabled = false;
                updateHUD("STATUS: AIMING (Ready)", "");
            }, 500);
        } else {
            const distanceFromPerfect = Math.min(
                Math.abs(gameState.reloadSliderPosition - gameState.reloadPerfectZoneStart),
                Math.abs(gameState.reloadSliderPosition - gameState.reloadPerfectZoneEnd)
            );
            const reloadTime = 1000 + (distanceFromPerfect * 20);
            
            label.textContent = 'RELOADING...';
            label.style.color = '#ffaa00';
            updateHUD("RELOADING...", "#ffaa00");
            
            if (gameState.isPvPMode) {
                if (window.sendPlayerAction) {
                    window.sendPlayerAction({ type: 'reload', timestamp: Date.now(), perfect: false });
                }
            }
            
            setTimeout(() => {
                gameState.playerAmmo = gameState.maxAmmo;
                updateAmmoCount();
                skillBar.classList.remove('active');
                gameState.isReloading = false;
                label.style.color = '#00ffff';
                if (reloadBtn) reloadBtn.disabled = false;
                updateHUD("RELOADED", "");
                setTimeout(() => {
                    updateHUD("STATUS: AIMING (Ready)", "");
                }, 500);
            }, reloadTime);
        }
    };
    
    skillBar.addEventListener('click', stopSlider, { once: true });
    skillBar.addEventListener('touchend', stopSlider, { once: true });
}

export function setupReloadButton() {
    const reloadBtn = document.getElementById('reload-button');
    if (reloadBtn) {
        console.log('Setting up reload button...');
        
        const newBtn = reloadBtn.cloneNode(true);
        reloadBtn.parentNode.replaceChild(newBtn, reloadBtn);
        
        const handleReload = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!gameState.isReloading && gameState.playerAmmo < gameState.maxAmmo && gameState.gameStarted) {
                startReloadSkillGame();
            }
        };
        
        newBtn.addEventListener('click', handleReload);
        newBtn.addEventListener('touchend', handleReload);
    }
}

