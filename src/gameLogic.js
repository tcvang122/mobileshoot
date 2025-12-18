// Game Logic: Shooting, Opponent AI, Game End

import * as THREE from 'three';
import * as gameState from './gameState.js';
import { weapons } from './config.js';
import { scene, camera, renderer } from './sceneSetup.js';
import { gunGroup, muzzleLight, opponentGroup, opponentModel, opponentMixer, opponentActions, opponentMuzzleLight } from './gameObjects.js';
import { updateHealthBar, updateAmmoCount, updateOpponentHealthBar, updateHUD } from './ui.js';
import { saveUserStats, updateRank } from './auth.js';

// TWEEN implementation (simplified)
const TWEEN = {
    Easing: {
        Quadratic: {
            Out: (t) => t * (2 - t),
            In: (t) => t * t
        },
        Bounce: {
            Out: (t) => {
                if (t < 1 / 2.75) {
                    return 7.5625 * t * t;
                } else if (t < 2 / 2.75) {
                    return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
                } else if (t < 2.5 / 2.75) {
                    return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
                } else {
                    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
                }
            }
        }
    },
    Tween: class {
        constructor(object) {
            this.object = object;
            this.valuesStart = {};
            this.valuesEnd = {};
            this.duration = 0;
            this.startTime = 0;
            this.easingFunction = (t) => t;
            this.onUpdateCallback = null;
            this.onCompleteCallback = null;
        }
        to(values, duration) {
            this.valuesEnd = values;
            this.duration = duration;
            return this;
        }
        easing(fn) {
            this.easingFunction = fn;
            return this;
        }
        onUpdate(callback) {
            this.onUpdateCallback = callback;
            return this;
        }
        onComplete(callback) {
            this.onCompleteCallback = callback;
            return this;
        }
        start() {
            this.startTime = performance.now();
            for (const property in this.valuesEnd) {
                this.valuesStart[property] = this.object[property];
            }
            const update = () => {
                const time = performance.now();
                let elapsed = time - this.startTime;
                const isComplete = elapsed >= this.duration;
                if (isComplete) elapsed = this.duration;
                const value = this.easingFunction(elapsed / this.duration);
                for (const property in this.valuesEnd) {
                    const start = this.valuesStart[property];
                    const end = this.valuesEnd[property];
                    this.object[property] = start + (end - start) * value;
                }
                if (this.onUpdateCallback) this.onUpdateCallback(this.object);
                if (isComplete && this.onCompleteCallback) {
                    this.onCompleteCallback();
                } else if (!isComplete) {
                    requestAnimationFrame(update);
                }
            };
            update();
        }
    }
};

// Enemy attack phase and pattern
export function getEnemyAttackPhase() {
    const healthPercent = (gameState.opponentHealth / (gameState.currentOpponentData?.health || 100)) * 100;
    if (healthPercent <= 30) {
        return 'desperate';
    } else if (healthPercent <= 60) {
        return 'aggressive';
    }
    return 'normal';
}

export function getEnemyAttackPattern(phase) {
    const now = Date.now();
    
    if (now > gameState.enemyNextPatternTime) {
        const patterns = {
            'normal': ['single', 'single', 'burst'],
            'aggressive': ['burst', 'single', 'rapid', 'burst'],
            'desperate': ['rapid', 'rapid', 'burst', 'rapid']
        };
        
        const availablePatterns = patterns[phase] || ['single'];
        gameState.enemyPatternType = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
        gameState.enemyPatternShotCount = 0;
        
        const patternDurations = {
            'single': 2000,
            'burst': 3000,
            'rapid': 4000
        };
        gameState.enemyNextPatternTime = now + (patternDurations[gameState.enemyPatternType] || 2000);
    }
    
    return gameState.enemyPatternType;
}

// Animation functions
export function playOpponentAnimation(animationName, loop = true, fadeIn = 0.3) {
    if (!opponentMixer || !opponentActions[animationName]) {
        return;
    }
    
    const newAction = opponentActions[animationName];
    const currentAction = opponentGroup.userData.currentAnimation;
    
    if (currentAction === newAction && newAction.isRunning()) {
        return;
    }
    
    if (currentAction) {
        currentAction.fadeOut(fadeIn);
    }
    
    if (loop) {
        newAction.setLoop(THREE.LoopRepeat);
    } else {
        newAction.setLoop(THREE.LoopOnce);
        newAction.clampWhenFinished = true;
    }
    
    newAction.reset().fadeIn(fadeIn).play();
    opponentGroup.userData.currentAnimation = newAction;
}

export function updateOpponentAnimation() {
    if (!opponentMixer || gameState.opponentHealth <= 0) return;
    
    const isMoving = Math.abs(opponentGroup.position.x - (Math.sin(Date.now() * 0.001) * 8)) < 0.1;
    
    if (gameState.opponentHealth <= 0) {
        playOpponentAnimation('Death', false);
    } else if (isMoving && (opponentActions['Walk'] || opponentActions['walk'] || opponentActions['Running'])) {
        const walkAnim = opponentActions['Walk'] || opponentActions['walk'] || opponentActions['Running'];
        if (opponentGroup.userData.currentAnimation !== walkAnim) {
            playOpponentAnimation('Walk', true);
        }
    } else if (opponentActions['Idle'] || opponentActions['idle']) {
        const idleAnim = opponentActions['Idle'] || opponentActions['idle'];
        if (opponentGroup.userData.currentAnimation !== idleAnim) {
            playOpponentAnimation('Idle', true);
        }
    }
}

// Opponent shooting
export function opponentShoot() {
    if (!gameState.gameStarted || gameState.opponentHealth <= 0 || gameState.playerHealth <= 0) return;
    
    const now = Date.now();
    gameState.enemyAttackPhase = getEnemyAttackPhase();
    const pattern = getEnemyAttackPattern(gameState.enemyAttackPhase);
    
    let baseInterval = gameState.OPPONENT_SHOOT_INTERVAL;
    const phaseMultipliers = {
        'normal': 1.0,
        'aggressive': 0.7,
        'desperate': 0.5
    };
    baseInterval *= (phaseMultipliers[gameState.enemyAttackPhase] || 1.0);
    
    const patternIntervals = {
        'single': baseInterval,
        'burst': baseInterval * 0.3,
        'rapid': baseInterval * 0.2
    };
    const currentInterval = patternIntervals[pattern] || baseInterval;
    
    if (now - gameState.opponentLastShotTime < currentInterval) return;
    
    if (pattern === 'burst') {
        if (gameState.enemyPatternShotCount >= 3) {
            gameState.enemyPatternShotCount = 0;
            gameState.opponentLastShotTime = now;
            gameState.enemyNextPatternTime = now + 1000;
            return;
        }
        gameState.enemyPatternShotCount++;
    } else if (pattern === 'rapid') {
        if (gameState.enemyPatternShotCount >= 5) {
            gameState.enemyPatternShotCount = 0;
            gameState.opponentLastShotTime = now;
            gameState.enemyNextPatternTime = now + 800;
            return;
        }
        gameState.enemyPatternShotCount++;
    } else {
        gameState.enemyPatternShotCount = 0;
    }
    
    gameState.opponentLastShotTime = now;
    
    const muzzleWorldPos = new THREE.Vector3();
    muzzleWorldPos.copy(opponentGroup.position);
    muzzleWorldPos.y += 1.5;
    
    const playerPos = camera.position.clone();
    const direction = new THREE.Vector3()
        .subVectors(playerPos, muzzleWorldPos)
        .normalize();
    
    const spread = 0.15;
    direction.x += (Math.random() - 0.5) * spread;
    direction.y += (Math.random() - 0.5) * spread;
    direction.normalize();
    
    const raycaster = new THREE.Raycaster();
    raycaster.set(muzzleWorldPos, direction);
    
    const hitDistance = raycaster.ray.distanceToPoint(camera.position);
    
    if (hitDistance < 30) {
        const now = Date.now();
        if (now < gameState.dodgeInvincibilityEnd) {
            return;
        }
        
        const damage = gameState.currentOpponentData ? gameState.currentOpponentData.damage : 15;
        gameState.playerHealth -= damage;
        updateHealthBar();
        
        const hitGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const hitMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.8,
            emissive: 0xff4400,
            emissiveIntensity: 0.6
        });
        const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
        hitEffect.position.copy(camera.position);
        scene.add(hitEffect);
        
        new TWEEN.Tween(hitEffect.scale)
            .to({ x: 0, y: 0, z: 0 }, 300)
            .onComplete(() => {
                scene.remove(hitEffect);
                hitEffect.geometry.dispose();
                hitEffect.material.dispose();
            })
            .start();
        
        new TWEEN.Tween(hitEffect.material)
            .to({ opacity: 0 }, 300)
            .start();
        
        const hud = document.getElementById('hud');
        hud.style.color = "#ff0000";
        updateHUD(`TAKEN DAMAGE! HEALTH: ${gameState.playerHealth}%`, "#ff0000");
        setTimeout(() => {
            updateHUD("STATUS: AIMING (Ready)", "");
        }, 500);
        
        if (gameState.playerHealth <= 0) {
            gameState.lastImportantMessageTime = Date.now();
            updateHUD("DEFEAT! MISSION FAILED", "#ff0000");
            endGame(false);
        }
    }
    
    if (opponentMuzzleLight) {
        opponentMuzzleLight.intensity = 3;
        opponentMuzzleLight.color.setHex(0xff0000);
        
        const flashGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.9 
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(muzzleWorldPos);
        scene.add(flash);
        
        setTimeout(() => {
            opponentMuzzleLight.intensity = 0;
            scene.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
        }, 100);
    }
}

// Player shooting (called from GunController)
export function handlePlayerFire(gunController) {
    if (!gameState.gameStarted || (gameState.isPvPMode ? gameState.playerHealth <= 0 : gameState.opponentHealth <= 0)) return;
    
    if (gameState.isReloading) {
        updateHUD("RELOADING...", "");
        return;
    }
    
    if (gameState.playerAmmo <= 0) {
        updateHUD("OUT OF AMMO!", "");
        return;
    }
    
    const selectedWeapon = weapons.find(w => w.id === gameState.userStats.selectedWeapon) || weapons[0];
    const now = Date.now();
    if (now - gameState.lastFireTime < selectedWeapon.fireRate) return;
    gameState.lastFireTime = now;
    
    gameState.playerAmmo--;
    updateAmmoCount();
    
    if (gameState.isPvPMode && window.sendPlayerAction) {
        window.sendPlayerAction({ type: 'shoot', timestamp: Date.now() });
    }
    
    updateHUD("STATUS: 🔥 FIRE! 🔥", "");
    const hud = document.getElementById('hud');
    hud.classList.add('firing');
    
    const originalZ = gunGroup.position.z;
    const originalRotX = gunGroup.rotation.x;
    gunGroup.position.z += 0.15;
    gunGroup.rotation.x += 0.15;
    gunGroup.position.y -= 0.05;
    
    muzzleLight.intensity = 4;
    muzzleLight.color.setHex(0x00ffff);
    
    const flashGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.9 
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(muzzleLight.position);
    gunGroup.add(flash);
    
    setTimeout(() => {
        gunGroup.position.z = originalZ;
        gunGroup.rotation.x = originalRotX;
        gunGroup.position.y += 0.05;
        muzzleLight.intensity = 0;
        gunGroup.remove(flash);
        flash.geometry.dispose();
        flash.material.dispose();
        hud.classList.remove('firing');
    }, 150);
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(gameState.reticleX, gameState.reticleY), camera);
    
    const opponentMeshes = [];
    if (opponentModel) {
        opponentModel.traverse((child) => {
            if (child.isMesh && child !== opponentGroup.userData.healthBarFill && child !== opponentGroup.userData.healthBarBg) {
                opponentMeshes.push(child);
            }
        });
    }
    
    const intersects = raycaster.intersectObjects(opponentMeshes, false);
    
    if (intersects.length > 0) {
        const hitPoint = intersects[0].point;
        
        const hitGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const hitMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.9,
            emissive: 0x00aaff,
            emissiveIntensity: 0.5
        });
        const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
        hitEffect.position.copy(hitPoint);
        scene.add(hitEffect);
        
        new TWEEN.Tween(hitEffect.scale)
            .to({ x: 0, y: 0, z: 0 }, 200)
            .onComplete(() => {
                scene.remove(hitEffect);
                hitEffect.geometry.dispose();
                hitEffect.material.dispose();
            })
            .start();
        
        new TWEEN.Tween(hitEffect.material)
            .to({ opacity: 0 }, 200)
            .start();
        
        const damage = selectedWeapon.damage;
        gameState.opponentHealth -= damage;
        
        if (gameState.isPvPMode && window.sendPlayerHit) {
            window.sendPlayerHit(damage);
        }
        
        updateOpponentHealthBar();
        
        const hitObj = intersects[0].object;
        if (hitObj.material && hitObj.material.color) {
            const originalColor = hitObj.material.color.getHex();
            hitObj.material.color.setHex(0xff0000);
            setTimeout(() => hitObj.material.color.setHex(originalColor), 150);
        }
        
        if (gameState.opponentHealth <= 0) {
            gameState.lastImportantMessageTime = Date.now();
            const reward = gameState.currentOpponentData ? gameState.currentOpponentData.reward : 0;
            updateHUD(`VICTORY! TARGET NEUTRALIZED\n+${reward} CREDITS`, "#00ffff");
            
            new TWEEN.Tween(opponentGroup.rotation)
                .to({ x: -Math.PI / 2 }, 500)
                .easing(TWEEN.Easing.Bounce.Out)
                .start();
            
            endGame(true);
        } else {
            gameState.lastImportantMessageTime = Date.now();
            updateHUD(`HIT! ENEMY HEALTH: ${gameState.opponentHealth}%`, "");
            setTimeout(() => {
                if (Date.now() - gameState.lastImportantMessageTime >= 2000) {
                    if (gunController.isHolstered) {
                        updateHUD("STATUS: READY", "");
                    } else {
                        updateHUD("STATUS: AIMING (Ready)", "");
                    }
                }
            }, 2000);
        }
    } else {
        gameState.lastImportantMessageTime = Date.now();
        updateHUD("MISS!", "");
        setTimeout(() => {
            if (Date.now() - gameState.lastImportantMessageTime >= 500) {
                if (gunController.isHolstered) {
                    updateHUD("STATUS: READY", "");
                } else {
                    updateHUD("STATUS: AIMING (Ready)", "");
                }
            }
        }, 500);
    }
}

// Game end
export function endGame(victory) {
    gameState.gameStarted = false;
    gameState.orientationEnabled = false;
    
    opponentGroup.visible = false;
    gunGroup.visible = false;
    document.getElementById('crosshair').classList.remove('visible');
    document.getElementById('health-bar-container').classList.remove('visible');
    document.getElementById('ammo-count').classList.remove('visible');
    document.getElementById('reload-button').classList.remove('visible');
    document.getElementById('reload-skill-bar').classList.remove('active');
    
    if (gameState.reloadSkillBarAnimationFrame) {
        cancelAnimationFrame(gameState.reloadSkillBarAnimationFrame);
        gameState.reloadSkillBarAnimationFrame = null;
    }
    gameState.isReloading = false;
    
    if (victory) {
        if (gameState.isPvPMode && gameState.currentPvPOpponentStats) {
            const reward = window.calculatePlayerReward ? window.calculatePlayerReward(gameState.currentPvPOpponentStats) : 100;
            gameState.userStats.wins++;
            gameState.userStats.credits += reward;
            updateHUD(`VICTORY! TARGET NEUTRALIZED\n+${reward} CREDITS`, "#00ffff");
            updateRank();
        } else if (gameState.currentOpponentData) {
            gameState.userStats.wins++;
            gameState.userStats.credits += gameState.currentOpponentData.reward;
            updateRank();
        }
    }
    
    saveUserStats();
    
    setTimeout(() => {
        document.getElementById('main-menu').classList.remove('hidden');
        if (window.updateUserProfile) window.updateUserProfile();
        updateHUD("STATUS: WAITING", "");
        const hud = document.getElementById('hud');
        hud.classList.remove('holstered', 'firing');
        if (opponentModel) {
            opponentGroup.rotation.set(0, 0, 0);
        }
    }, 3000);
}

// Export TWEEN for use in other modules
export { TWEEN };

