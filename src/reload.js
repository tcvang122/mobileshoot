// Reload Skill System

import * as gameState from './gameState.js';
import { setIsReloading, setPlayerAmmo, setReloadSkillBarAnimationFrame, setReloadSliderPosition, setReloadSliderDirection, setReloadLastAnimationTime, setReloadPerfectZoneStart, setReloadPerfectZoneEnd } from './gameState.js';
import { PERFECT_ZONE_WIDTH } from './config.js';
import { updateAmmoCount } from './ui.js';
import { updateHUD } from './ui.js';

const hud = document.getElementById('hud');

export function startReloadSkillGame() {
    if (gameState.isReloading || gameState.playerAmmo >= gameState.maxAmmo) return;
    
    setIsReloading(true);
    setReloadSliderPosition(0);
    setReloadSliderDirection(1);
    
    const skillBar = document.getElementById('reload-skill-bar');
    const slider = document.getElementById('reload-skill-bar-slider');
    const track = document.getElementById('reload-skill-bar-track');
    const label = document.getElementById('reload-skill-bar-label');
    
    if (!skillBar || !slider || !track || !label) {
        console.error('Reload skill bar elements not found!');
        setIsReloading(false);
        return;
    }
    
    skillBar.classList.add('active');
    label.textContent = 'TAP TO STOP';
    label.style.color = '#00ffff';
    
    const reloadBtn = document.getElementById('reload-button');
    if (reloadBtn) {
        reloadBtn.disabled = true;
    }
    
    setReloadSliderPosition(0);
    setReloadSliderDirection(1);
    slider.style.transform = 'translateX(0%)';
    
    const minZoneStart = 10;
    const maxZoneStart = 90 - PERFECT_ZONE_WIDTH;
    const randomZoneStart = Math.random() * (maxZoneStart - minZoneStart) + minZoneStart;
    const zoneStart = Math.round(randomZoneStart);
    setReloadPerfectZoneStart(zoneStart);
    setReloadPerfectZoneEnd(zoneStart + PERFECT_ZONE_WIDTH);
    
    const perfectZone = document.getElementById('reload-skill-bar-perfect-zone');
    if (perfectZone) {
        perfectZone.style.left = gameState.reloadPerfectZoneStart + '%';
        perfectZone.style.width = PERFECT_ZONE_WIDTH + '%';
    }
    
    const sliderSpeed = 2;
    setReloadLastAnimationTime(performance.now());
    
    const animateSlider = (currentTime) => {
        if (!gameState.isReloading) {
            if (gameState.reloadSkillBarAnimationFrame) {
                cancelAnimationFrame(gameState.reloadSkillBarAnimationFrame);
                setReloadSkillBarAnimationFrame(null);
            }
            return;
        }
        
        const deltaTime = currentTime - gameState.reloadLastAnimationTime;
        const frameMultiplier = Math.min(deltaTime / 16.67, 2);
        
        const newPosition = gameState.reloadSliderPosition + sliderSpeed * gameState.reloadSliderDirection * frameMultiplier;
        setReloadSliderPosition(newPosition);
        
        if (gameState.reloadSliderPosition >= 100) {
            setReloadSliderPosition(100);
            setReloadSliderDirection(-1);
        } else if (gameState.reloadSliderPosition <= 0) {
            setReloadSliderPosition(0);
            setReloadSliderDirection(1);
        }
        
        const trackWidth = track.offsetWidth;
        const sliderWidth = slider.offsetWidth;
        const maxPosition = trackWidth - sliderWidth;
        const pixelPosition = (gameState.reloadSliderPosition / 100) * maxPosition;
        
        slider.style.transform = `translateX(${pixelPosition}px)`;
        
        setReloadLastAnimationTime(currentTime);
        setReloadSkillBarAnimationFrame(requestAnimationFrame(animateSlider));
    };
    
    setReloadSkillBarAnimationFrame(requestAnimationFrame(animateSlider));
    
    const stopSlider = () => {
        if (!gameState.isReloading) return;
        
        if (gameState.reloadSkillBarAnimationFrame) {
            cancelAnimationFrame(gameState.reloadSkillBarAnimationFrame);
            setReloadSkillBarAnimationFrame(null);
        }
        
        const inPerfectZone = gameState.reloadSliderPosition >= gameState.reloadPerfectZoneStart && 
                             gameState.reloadSliderPosition <= gameState.reloadPerfectZoneEnd;
        
        if (inPerfectZone) {
            label.textContent = 'PERFECT RELOAD!';
            label.style.color = '#00ff00';
            setPlayerAmmo(gameState.maxAmmo);
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
                setIsReloading(false);
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
                setPlayerAmmo(gameState.maxAmmo);
                updateAmmoCount();
                skillBar.classList.remove('active');
                setIsReloading(false);
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
    if (!reloadBtn) {
        console.error('Reload button not found!');
        return;
    }
    
    console.log('Setting up reload button...', {
        isReloading: gameState.isReloading,
        playerAmmo: gameState.playerAmmo,
        maxAmmo: gameState.maxAmmo,
        gameStarted: gameState.gameStarted
    });
    
    // Remove old event listeners by cloning
    const newBtn = reloadBtn.cloneNode(true);
    reloadBtn.parentNode.replaceChild(newBtn, reloadBtn);
    
    const handleReload = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Reload button clicked!', {
            isReloading: gameState.isReloading,
            playerAmmo: gameState.playerAmmo,
            maxAmmo: gameState.maxAmmo,
            gameStarted: gameState.gameStarted
        });
        
        if (!gameState.isReloading && gameState.playerAmmo < gameState.maxAmmo && gameState.gameStarted) {
            console.log('Starting reload skill game...');
            startReloadSkillGame();
        } else {
            console.log('Cannot reload:', {
                isReloading: gameState.isReloading,
                playerAmmo: gameState.playerAmmo,
                maxAmmo: gameState.maxAmmo,
                gameStarted: gameState.gameStarted
            });
        }
    };
    
    newBtn.addEventListener('click', handleReload);
    newBtn.addEventListener('touchend', handleReload);
    
    // Also make sure button is enabled
    newBtn.disabled = false;
    newBtn.style.pointerEvents = 'auto';
    newBtn.style.opacity = '1';
}

