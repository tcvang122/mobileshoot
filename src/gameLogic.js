// Game Logic: Shooting, Opponent AI, Game End

import * as THREE from 'three';
import * as gameState from './gameState.js';
import { setGameStarted, setOpponentHealth, setPlayerHealth, setLastAttackTime, setLastImportantMessageTime, setEnemyAttackPhase, setEnemyPatternType, setEnemyPatternAttackCount, setEnemyNextPatternTime, setOpponentLastAttackTime, setOrientationEnabled, setIsAttacking, setAttackCooldown, setOPPONENT_ATTACK_INTERVAL, setOpponentIncomingAttackDirection, setOpponentAttackWindupTime, setOpponentCurrentDirection, setOpponentGuardDirection, setPlayerStamina, setParryWindow, setOpponentAttackType, consumeCharge, consumeOpponentCharge, incrementPlayerBlocks, incrementPlayerHits, incrementOpponentHits, setAvailableCharges } from './gameState.js';
import { weapons, ATTACK_TYPES, ATTACK_COOLDOWN, OPPONENT_ATTACK_WINDUP_TIME, PARRY_WINDOW, GUARD_DIRECTIONS, BLOCK_TIMING_SLIDER_DURATION, MAX_ATTACK_CHARGES } from './config.js';
import { updateOpponentAttackIndicator, showBlockNotification, showBlockTimingSlider, triggerBlockTiming, hideBlockTimingSlider } from './ui.js';
import { combatController } from './controls.js';
import { scene, camera, renderer } from './sceneSetup.js';
import { gunGroup, muzzleLight, opponentGroup, opponentModel, opponentMixer, opponentActions, opponentMuzzleLight } from './gameObjects.js';
import { updateHealthBar, updateDirectionIndicator, updateOpponentHealthBar, updateStaminaBar, updateHUD } from './ui.js';
import { saveUserStats, updateRank } from './auth.js';

// TWEEN implementation (simplified)
const TWEEN = {
    tweens: [],
    getAll() { return this.tweens; },
    removeAll() { this.tweens = []; },
    add(tween) { this.tweens.push(tween); },
    remove(tween) {
        const i = this.tweens.indexOf(tween);
        if (i !== -1) this.tweens.splice(i, 1);
    },
    update(time) {
        if (this.tweens.length === 0) return false;
        let i = 0;
        while (i < this.tweens.length) {
            if (this.tweens[i].update(time)) {
                i++;
            } else {
                this.tweens.splice(i, 1);
            }
        }
        return true;
    },
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
            this.duration = 1000;
            this.startTime = null;
            this.easingFunction = TWEEN.Easing.Quadratic.Out;
            this.onUpdateCallback = null;
            this.onCompleteCallback = null;
        }
        to(properties, duration) {
            this.valuesEnd = properties;
            if (duration !== undefined) this.duration = duration;
            return this;
        }
        start(time) {
            TWEEN.add(this);
            this.startTime = time !== undefined ? time : performance.now();
            for (const property in this.valuesEnd) {
                this.valuesStart[property] = parseFloat(this.object[property]);
            }
            return this;
        }
        easing(easing) { this.easingFunction = easing; return this; }
        onUpdate(callback) { this.onUpdateCallback = callback; return this; }
        onComplete(callback) { this.onCompleteCallback = callback; return this; }
        update(time) {
            let elapsed = (time || performance.now()) - this.startTime;
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
            }
            return !isComplete;
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
        const selectedPattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
        setEnemyPatternType(selectedPattern);
        setEnemyPatternAttackCount(0);
        
        const patternDurations = {
            'single': 2000,
            'burst': 3000,
            'rapid': 4000
        };
        setEnemyNextPatternTime(now + (patternDurations[selectedPattern] || 2000));
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
    
    // Opponent is stationary, always use Idle animation
    if (gameState.opponentHealth <= 0) {
        playOpponentAnimation('Death', false);
    } else if (opponentActions['Idle'] || opponentActions['idle']) {
        const idleAnim = opponentActions['Idle'] || opponentActions['idle'];
        if (opponentGroup.userData.currentAnimation !== idleAnim) {
            playOpponentAnimation('Idle', true);
        }
    }
}

// Opponent melee attack
export function opponentAttack() {
    if (!gameState.gameStarted || gameState.opponentHealth <= 0 || gameState.playerHealth <= 0) return;
    
    // Check opponent attack charges (opponent can attack anytime if they have charges)
    if (gameState.opponentAvailableCharges <= 0) {
        return; // No charges available, wait for regen
    }
    
    const now = Date.now();
    
    // Minimum cooldown between attacks (even with charges available) to prevent spam
    // This ensures charges are the main limiter, but we still have a small delay between attacks
    const MIN_ATTACK_COOLDOWN = 1200; // 1200ms (1.2 seconds) minimum between attacks
    if (now - gameState.opponentLastAttackTime < MIN_ATTACK_COOLDOWN) {
        return; // Too soon since last attack
    }
    
    // Consume a charge before attacking
    if (!consumeOpponentCharge()) {
        console.warn('Failed to consume opponent charge - charges:', gameState.opponentAvailableCharges);
        return; // Failed to consume charge (shouldn't happen, but safety check)
    }
    
    console.log('Opponent attacking - remaining charges:', gameState.opponentAvailableCharges);
    
    // Update attack time immediately to prevent rapid attacks
    setOpponentLastAttackTime(now);
    
    const newPhase = getEnemyAttackPhase();
    setEnemyAttackPhase(newPhase);
    const pattern = getEnemyAttackPattern(newPhase);
    
    // Note: Pattern logic removed - charges are now the main limiter
    // Patterns can be re-added later if needed for variety, but for now charges control attack frequency
    setEnemyPatternAttackCount(0);
    
    // Randomly select opponent attack direction (For Honor: only UP, LEFT, RIGHT for guard)
    const guardDirections = ['up', 'left', 'right'];
    const attackDirection = guardDirections[Math.floor(Math.random() * guardDirections.length)];
    setOpponentCurrentDirection(attackDirection);
    
    // Update opponent guard indicator to show guard direction (always visible when opponent has guard)
    updateOpponentAttackIndicator(attackDirection, false); // Show guard (cyan) before attack
    
    // Also set opponent guard direction for blocking checks
    setOpponentGuardDirection(attackDirection);
    
    // Randomly select light or heavy attack
    const attackType = Math.random() > 0.5 ? ATTACK_TYPES.HEAVY : ATTACK_TYPES.LIGHT;
    
    console.log('=== OPPONENT STARTING ATTACK ===');
    console.log('Direction:', attackDirection, 'Type:', attackType);
    console.log('Windup time:', OPPONENT_ATTACK_WINDUP_TIME, 'ms');
    
    // Set windup phase - show incoming attack direction (arrow turns red)
    const windupEndTime = now + OPPONENT_ATTACK_WINDUP_TIME;
    setOpponentIncomingAttackDirection(attackDirection);
    setOpponentAttackWindupTime(windupEndTime);
    
    // Set parry window (last 200ms before attack lands)
    const parryWindowStart = windupEndTime - PARRY_WINDOW;
    const parryWindowEnd = windupEndTime;
    setParryWindow(parryWindowStart, parryWindowEnd);
    
    // Store opponent attack type
    setOpponentAttackType(attackType);
    
    updateOpponentAttackIndicator(attackDirection, true);
    
    // Show block timing slider when opponent attacks
    showBlockTimingSlider(BLOCK_TIMING_SLIDER_DURATION, (blocked, timing) => {
        // Callback is called when slider times out or is triggered
        // The actual blocking is handled in the blockCheckInterval
    });
    
    // Track if attack was blocked during windup
    let attackBlocked = false;
    let attackCancelled = false;
    let attackTimeoutId = null; // Store timeout reference for cleanup
    
    // Schedule the actual attack after windup (if not blocked) - set this up first
    attackTimeoutId = setTimeout(() => {
        // Make sure interval is cleared
        clearInterval(blockCheckInterval);
        
        // Double-check if attack was blocked or cancelled
        if (attackCancelled || attackBlocked) {
            console.log('Attack already cancelled/blocked, not landing');
            setOpponentIncomingAttackDirection(null);
            updateOpponentAttackIndicator(null, false);
            hideBlockTimingSlider();
            return;
        }
        
        // Additional safety check - if direction is cleared, attack was blocked
        if (!gameState.opponentIncomingAttackDirection || gameState.opponentIncomingAttackDirection !== attackDirection) {
            console.log('Attack direction cleared, assuming blocked');
            hideBlockTimingSlider();
            return;
        }
        
        console.log('=== ATTACK TIMEOUT FIRED ===');
        console.log('Game started:', gameState.gameStarted);
        console.log('Opponent health:', gameState.opponentHealth);
        console.log('Player health:', gameState.playerHealth);
        
        if (!gameState.gameStarted || gameState.opponentHealth <= 0 || gameState.playerHealth <= 0) {
            console.log('Attack cancelled - game not active');
            setOpponentIncomingAttackDirection(null);
            updateOpponentAttackIndicator(null, false);
            return;
        }
        
        const attackTime = Date.now();
        setOpponentLastAttackTime(attackTime);
        
        // Check if attack hits player
        const opponentPos = opponentGroup.position.clone();
        opponentPos.y += 1.5;
        const playerPos = camera.position.clone();
        const distance = opponentPos.distanceTo(playerPos);
        
        console.log('Attack distance check:', distance.toFixed(2), '(needs to be < 14)');
        console.log('Opponent pos:', opponentPos);
        console.log('Player pos:', playerPos);
        
        if (distance < 14) { // Melee range (increased to account for opponent being further back)
            console.log('✓ In melee range');
            
            if (attackTime < gameState.dodgeInvincibilityEnd) {
                console.log('Player dodging, attack cancelled');
                setOpponentIncomingAttackDirection(null);
                updateOpponentAttackIndicator(null, false);
                return; // Player is dodging
            }
            
            // Final check if player blocked (shouldn't happen if checking during windup, but safety check)
            const playerGuard = gameState.guardDirection || gameState.currentDirection || combatController.currentDirection;
            const playerBlocked = playerGuard === attackDirection;
            
            // Check for parry
            const inParryWindow = attackTime >= gameState.parryWindowStart && attackTime <= gameState.parryWindowEnd;
            const isParry = playerBlocked && inParryWindow;
            
            // Heavy attacks are unblockable (must parry or dodge)
            const isUnblockable = attackType === ATTACK_TYPES.HEAVY;
            
            console.log('=== OPPONENT ATTACK LANDING ===');
            console.log('Attack direction:', attackDirection);
            console.log('Attack type:', attackType);
            console.log('Player gameState direction:', gameState.currentDirection);
            console.log('Player controller direction:', combatController.currentDirection);
            console.log('Player guard used for block check:', playerGuard);
            console.log('Blocked?', playerBlocked);
            console.log('Distance:', distance);
            
            // Check timing slider if blocking (fallback check at attack landing)
            let timingResult = null;
            if (playerBlocked) {
                timingResult = triggerBlockTiming();
            }
            
            if (timingResult === 'perfect') {
                // Perfect parry! - Gives a charge back as reward
                console.log('✓ PERFECT PARRY - Perfect timing! Counter-attack opportunity!');
                incrementPlayerBlocks();
                if (gameState.availableCharges < MAX_ATTACK_CHARGES) {
                    setAvailableCharges(gameState.availableCharges + 1);
                    updateStaminaBar();
                }
                updateHUD("PERFECT BLOCK! COUNTER-ATTACK!", "#00ff00");
                showBlockNotification('opponent');
                hideBlockTimingSlider();
            } else if (timingResult === 'good' && !isUnblockable) {
                // Good block
                console.log('✓ GOOD BLOCK - Blocked with good timing!');
                incrementPlayerBlocks();
                updateHUD("BLOCKED!", "#00ffff");
                showBlockNotification('opponent');
                hideBlockTimingSlider();
            } else if (playerBlocked && !isUnblockable && timingResult === null) {
                // Blocked but timing slider wasn't active (fallback)
                console.log('✓ BLOCKED - No damage taken!');
                incrementPlayerBlocks();
                updateHUD("BLOCKED!", "#00ffff");
                showBlockNotification('opponent');
                hideBlockTimingSlider();
            } else if (playerBlocked && !isUnblockable) {
                // Attack blocked at the last moment!
                console.log('✓ BLOCKED - No damage taken!');
                const blockGeometry = new THREE.SphereGeometry(0.6, 8, 8);
                const blockMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x00ffff, 
                    transparent: true, 
                    opacity: 0.9,
                    emissive: 0x00ffff,
                    emissiveIntensity: 0.8
                });
                const blockEffect = new THREE.Mesh(blockGeometry, blockMaterial);
                blockEffect.position.copy(playerPos);
                scene.add(blockEffect);
                
                new TWEEN.Tween(blockEffect.scale)
                    .to({ x: 0, y: 0, z: 0 }, 400)
                    .onComplete(() => {
                        scene.remove(blockEffect);
                        blockEffect.geometry.dispose();
                        blockEffect.material.dispose();
                    })
                    .start();
                
            if (isParry) {
                incrementPlayerBlocks();
                updateHUD("PARRY! COUNTER-ATTACK!", "#00ff00");
                // Parry gives a charge back as reward
                if (gameState.availableCharges < MAX_ATTACK_CHARGES) {
                    setAvailableCharges(gameState.availableCharges + 1);
                    updateStaminaBar();
                }
            } else {
                incrementPlayerBlocks();
                updateHUD("BLOCKED!", "#00ffff");
            }
            
            // Show block notification popup
            showBlockNotification('opponent');
            } else {
                // Attack hits! Player didn't block in time
                console.log('✗ NOT BLOCKED - Taking damage!');
                const baseDamage = gameState.currentOpponentData ? gameState.currentOpponentData.damage : 15;
                let damage;
                if (attackType === ATTACK_TYPES.HEAVY) {
                    damage = baseDamage * 1.5; // Heavy attacks do more damage
                } else {
                    damage = baseDamage;
                }
                const oldHealth = gameState.playerHealth;
                const newPlayerHealth = Math.max(0, oldHealth - damage);
                
                console.log(`Damage: ${damage} (${attackType === ATTACK_TYPES.HEAVY ? 'HEAVY' : 'LIGHT'})`);
                console.log(`Health: ${oldHealth} → ${newPlayerHealth}`);
                
                setPlayerHealth(newPlayerHealth);
                incrementOpponentHits();
                updateHealthBar();
                
                // Visual effect at player position
                const hitGeometry = new THREE.SphereGeometry(0.5, 8, 8);
                const hitMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0xff0000, 
                    transparent: true, 
                    opacity: 0.8,
                    emissive: 0xff4400,
                    emissiveIntensity: 0.6
                });
                const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
                hitEffect.position.copy(playerPos);
                scene.add(hitEffect);
                
                new TWEEN.Tween(hitEffect.scale)
                    .to({ x: 0, y: 0, z: 0 }, 300)
                    .onComplete(() => {
                        scene.remove(hitEffect);
                        hitEffect.geometry.dispose();
                        hitEffect.material.dispose();
                    })
                    .start();
                
                updateHUD("HIT!", "#ff0000");
                
                // Screen shake effect
                const hud = document.getElementById('hud');
                if (hud) {
                    hud.style.animation = 'none';
                    setTimeout(() => {
                        hud.style.animation = 'damageShake 0.3s';
                        setTimeout(() => {
                            hud.style.animation = '';
                        }, 300);
                    }, 10);
                }
                
                if (newPlayerHealth <= 0) {
                    setLastImportantMessageTime(Date.now());
                    updateHUD("DEFEAT! MISSION FAILED", "#ff0000");
                    endGame(false);
                }
            }
            
            // Clear attack indicator but keep guard direction visible
            setOpponentIncomingAttackDirection(null);
            // Keep guard indicator visible with current guard direction
            if (gameState.opponentGuardDirection) {
                updateOpponentAttackIndicator(gameState.opponentGuardDirection, false);
            } else {
                updateOpponentAttackIndicator(null, false);
            }
            hideBlockTimingSlider(); // Hide slider if still showing
            
            // Reset attack timer after attack lands
            setOpponentLastAttackTime(Date.now());
            
            // Visual effect at opponent position when attack lands
            const attackPos = opponentGroup.position.clone();
            attackPos.y += 1.5;
            
            const flashGeometry = new THREE.SphereGeometry(0.3, 8, 8);
            const flashMaterial = new THREE.MeshBasicMaterial({ 
                color: attackType === ATTACK_TYPES.HEAVY ? 0xff0000 : 0xff8800, 
                transparent: true, 
                opacity: 0.9 
            });
            const flash = new THREE.Mesh(flashGeometry, flashMaterial);
            flash.position.copy(attackPos);
            scene.add(flash);
            
            setTimeout(() => {
                scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
            }, 200);
        } else {
            console.log('✗ Out of range');
            // Still reset timer even if out of range
            setOpponentLastAttackTime(Date.now());
        }
    }, OPPONENT_ATTACK_WINDUP_TIME);
    
    // Continuously check for blocking during windup phase (when arrow is red)
    const blockCheckInterval = setInterval(() => {
        if (!gameState.gameStarted || gameState.opponentHealth <= 0 || gameState.playerHealth <= 0) {
            attackCancelled = true;
            clearInterval(blockCheckInterval);
            setOpponentIncomingAttackDirection(null);
            updateOpponentAttackIndicator(null, false);
            hideBlockTimingSlider();
            return;
        }
        
        // Check if windup time has passed (shouldn't happen, but safety check)
        if (Date.now() >= windupEndTime) {
            clearInterval(blockCheckInterval);
            hideBlockTimingSlider();
            return;
        }
        
        // For Honor style blocking: Check if player's guard matches attack direction
        const playerGuard = gameState.guardDirection || gameState.currentDirection || combatController.currentDirection;
        const isBlocking = playerGuard === attackDirection;
        
        // Check timing slider if blocking
        if (isBlocking && !attackBlocked) {
            const timingResult = triggerBlockTiming();
            
            if (timingResult && (timingResult === 'perfect' || timingResult === 'good')) {
                // Block successful with good timing!
                attackBlocked = true;
                attackCancelled = true;
                clearInterval(blockCheckInterval);
                if (attackTimeoutId !== null) {
                    clearTimeout(attackTimeoutId);
                    attackTimeoutId = null;
                }
                
                const isParry = timingResult === 'perfect';
                
                if (isParry) {
                    console.log('=== PERFECT PARRY! ===');
                    console.log('Attack direction:', attackDirection);
                    console.log('Player guard:', playerGuard);
                    console.log('✓ PERFECT TIMING - Perfect block! Counter-attack opportunity!');
                } else {
                    console.log('=== GOOD BLOCK ===');
                    console.log('Attack direction:', attackDirection);
                    console.log('Player guard:', playerGuard);
                    console.log('✓ BLOCKED - Good timing!');
                }
                
                // Show block effect
                const playerPos = camera.position.clone();
                const blockGeometry = new THREE.SphereGeometry(0.6, 8, 8);
                const blockMaterial = new THREE.MeshStandardMaterial({ 
                    color: isParry ? 0x00ff00 : 0x00ffff, 
                    transparent: true, 
                    opacity: 0.9,
                    emissive: isParry ? 0x00ff00 : 0x00ffff,
                    emissiveIntensity: 0.8
                });
                const blockEffect = new THREE.Mesh(blockGeometry, blockMaterial);
                blockEffect.position.copy(playerPos);
                scene.add(blockEffect);
                
                new TWEEN.Tween(blockEffect.scale)
                    .to({ x: 0, y: 0, z: 0 }, 400)
                    .onComplete(() => {
                        scene.remove(blockEffect);
                        blockEffect.geometry.dispose();
                        blockEffect.material.dispose();
                    })
                    .start();
                
                if (isParry) {
                    incrementPlayerBlocks();
                    updateHUD("PERFECT BLOCK! COUNTER-ATTACK!", "#00ff00");
                    // Perfect block gives a charge back (bonus)
                    if (gameState.availableCharges < MAX_ATTACK_CHARGES) {
                        setAvailableCharges(gameState.availableCharges + 1);
                        updateStaminaBar();
                    }
                } else {
                    incrementPlayerBlocks();
                    updateHUD("BLOCKED!", "#00ffff");
                }
                
                // Show block notification popup
                showBlockNotification('opponent');
                
                // Clear the attack indicator but keep guard visible
                setOpponentIncomingAttackDirection(null);
                // Keep guard indicator visible with current guard direction
                if (gameState.opponentGuardDirection) {
                    updateOpponentAttackIndicator(gameState.opponentGuardDirection, false);
                } else {
                    updateOpponentAttackIndicator(null, false);
                }
                hideBlockTimingSlider();
                
                // Reset attack timer to prevent immediate next attack
                const blockedTime = Date.now();
                setOpponentLastAttackTime(blockedTime);
                console.log('Attack timer reset after block. Next attack can happen after:', blockedTime + gameState.OPPONENT_ATTACK_INTERVAL);
                
                // Make sure the setTimeout doesn't fire
                return;
            }
            // If timing was wrong (miss), continue - player will take damage
        }
    }, 50); // Check every 50ms for responsive blocking
}

// Player melee attack (called from MeleeCombatController)
export function handlePlayerAttack(direction, attackType) {
    if (!gameState.gameStarted || (gameState.isPvPMode ? gameState.playerHealth <= 0 : gameState.opponentHealth <= 0)) return;
    
    // For Honor style: Can attack from guard direction or change direction mid-attack
    // If no direction specified, use current guard direction
    const attackDirection = direction || gameState.guardDirection || gameState.currentDirection;
    
    if (attackDirection === null) {
        updateHUD("SET GUARD STANCE FIRST", "#ffaa00");
        return;
    }
    
    // Check attack charges
    if (gameState.availableCharges <= 0) {
        updateHUD("NO ATTACK CHARGES! WAIT FOR REGEN", "#ff0000");
        return;
    }
    
    // Consume a charge
    if (!consumeCharge()) {
        updateHUD("NO ATTACK CHARGES! WAIT FOR REGEN", "#ff0000");
        return;
    }
    updateStaminaBar();
    
    if (gameState.isAttacking || gameState.attackCooldown) {
        return;
    }
    
    const now = Date.now();
    
    // Get selected weapon for attack speeds
    const selectedWeapon = weapons.find(w => w.id === gameState.userStats.selectedWeapon) || weapons[0];
    
    // Use For Honor style attack speeds
    let attackSpeed;
    if (attackType === ATTACK_TYPES.GUARD_BREAK) {
        attackSpeed = selectedWeapon.guardBreakSpeed || 800;
    } else if (attackType === ATTACK_TYPES.HEAVY) {
        attackSpeed = selectedWeapon.heavyAttackSpeed || 1000;
    } else {
        attackSpeed = selectedWeapon.lightAttackSpeed || 500;
    }
    
    if (now - gameState.lastAttackTime < attackSpeed) return;
    
    setLastAttackTime(now);
    setIsAttacking(true);
    setAttackCooldown(true);
    
    // Reset cooldown after attack animation
    setTimeout(() => {
        setIsAttacking(false);
        setAttackCooldown(false);
    }, attackSpeed);
    
    if (gameState.isPvPMode && window.sendPlayerAction) {
        window.sendPlayerAction({ type: 'attack', direction, attackType, timestamp: Date.now() });
    }
    
    const attackTypeName = attackType === ATTACK_TYPES.HEAVY ? 'HEAVY' : 'LIGHT';
    const directionName = direction.toUpperCase();
    updateHUD(`${attackTypeName} ATTACK ${directionName}!`, "#00ffff");
    const hud = document.getElementById('hud');
    hud.classList.add('firing');
    
    // Weapon swing animation
    if (gunGroup) {
        const originalZ = gunGroup.position.z;
        const originalRotX = gunGroup.rotation.x;
        const swingAmount = attackType === ATTACK_TYPES.HEAVY ? 0.3 : 0.15;
        gunGroup.position.z += swingAmount;
        gunGroup.rotation.x += swingAmount;
        
        setTimeout(() => {
            gunGroup.position.z = originalZ;
            gunGroup.rotation.x = originalRotX;
            hud.classList.remove('firing');
        }, attackSpeed * 0.5);
    }
    
    // Check if attack hits opponent
    const playerPos = camera.position.clone();
    const opponentPos = opponentGroup.position.clone();
    opponentPos.y += 1.5;
    const distance = playerPos.distanceTo(opponentPos);
    
    console.log('=== PLAYER ATTACK ===');
    console.log('Distance:', distance.toFixed(2), '(needs to be < 14)');
    console.log('Attack direction:', direction);
    console.log('Opponent guard direction:', gameState.opponentCurrentDirection);
    
    // For Honor style: Check if opponent's guard matches attack direction
    const opponentGuard = gameState.opponentGuardDirection || gameState.opponentCurrentDirection;
    const isBlocked = opponentGuard === direction;
    
    // Heavy attacks are unblockable (must parry or dodge)
    const isUnblockable = attackType === ATTACK_TYPES.HEAVY;
    
    if (distance < 14) { // Melee range (increased to match opponent being further back)
        if (isBlocked && !isUnblockable) {
            // Attack blocked!
            const blockGeometry = new THREE.SphereGeometry(0.4, 8, 8);
            const blockMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xffff00, 
                transparent: true, 
                opacity: 0.9,
                emissive: 0xffff00,
                emissiveIntensity: 0.8
            });
            const blockEffect = new THREE.Mesh(blockGeometry, blockMaterial);
            blockEffect.position.copy(opponentPos);
            scene.add(blockEffect);
            
            new TWEEN.Tween(blockEffect.scale)
                .to({ x: 0, y: 0, z: 0 }, 300)
                .onComplete(() => {
                    scene.remove(blockEffect);
                    blockEffect.geometry.dispose();
                    blockEffect.material.dispose();
                })
                .start();
            
            setLastImportantMessageTime(Date.now());
            updateHUD("BLOCKED!", "#ffff00");
            
            // Show block notification popup
            showBlockNotification('player');
            
            setTimeout(() => {
                if (Date.now() - gameState.lastImportantMessageTime >= 1000) {
                    updateHUD("STATUS: READY", "");
                }
            }, 1000);
        } else {
            // Attack hits!
            const hitPoint = opponentPos.clone();
            
            const hitGeometry = new THREE.SphereGeometry(0.4, 8, 8);
            const hitMaterial = new THREE.MeshStandardMaterial({ 
                color: attackType === ATTACK_TYPES.HEAVY ? 0xff0000 : 0x00ffff, 
                transparent: true, 
                opacity: 0.9,
                emissive: attackType === ATTACK_TYPES.HEAVY ? 0xff4400 : 0x00aaff,
                emissiveIntensity: 0.6
            });
            const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
            hitEffect.position.copy(hitPoint);
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
            
            let damage;
            if (attackType === ATTACK_TYPES.GUARD_BREAK) {
                damage = selectedWeapon.guardBreakDamage || 5;
            } else if (attackType === ATTACK_TYPES.HEAVY) {
                damage = selectedWeapon.heavyDamage;
            } else {
                damage = selectedWeapon.lightDamage;
            }
            const oldHealth = gameState.opponentHealth;
            const newOpponentHealth = Math.max(0, oldHealth - damage);
            
            console.log(`Player dealt ${damage} damage (${attackType === ATTACK_TYPES.HEAVY ? 'HEAVY' : 'LIGHT'})`);
            console.log(`Opponent health: ${oldHealth} → ${newOpponentHealth}`);
            
            setOpponentHealth(newOpponentHealth);
            incrementPlayerHits();
            
            if (gameState.isPvPMode && window.sendPlayerHit) {
                window.sendPlayerHit(damage);
            }
            
            updateOpponentHealthBar();
            
            const attackTypeName = attackType === ATTACK_TYPES.HEAVY ? 'HEAVY' : 'LIGHT';
            updateHUD(`${attackTypeName} HIT! -${damage} OPPONENT HEALTH: ${newOpponentHealth}%`, "#00ff00");
            
            if (newOpponentHealth <= 0) {
                setLastImportantMessageTime(Date.now());
                const reward = gameState.currentOpponentData ? gameState.currentOpponentData.reward : 0;
                updateHUD(`VICTORY! OPPONENT DEFEATED\n+${reward} CREDITS`, "#00ffff");
                
                new TWEEN.Tween(opponentGroup.rotation)
                    .to({ x: -Math.PI / 2 }, 500)
                    .easing(TWEEN.Easing.Bounce.Out)
                    .start();
                
                endGame(true);
            } else {
                setLastImportantMessageTime(Date.now());
                updateHUD(`${attackTypeName} HIT! ENEMY HEALTH: ${newOpponentHealth}%`, "");
                setTimeout(() => {
                    if (Date.now() - gameState.lastImportantMessageTime >= 2000) {
                        updateHUD("STATUS: READY", "");
                    }
                }, 2000);
            }
        }
    } else {
        // Out of range
        setLastImportantMessageTime(Date.now());
        updateHUD("OUT OF RANGE!", "#ffaa00");
        setTimeout(() => {
            if (Date.now() - gameState.lastImportantMessageTime >= 1000) {
                updateHUD("STATUS: READY", "");
            }
        }, 1000);
    }
}

// Game end
export function endGame(victory) {
    setGameStarted(false);
    setOrientationEnabled(false);
    
    opponentGroup.visible = false;
    gunGroup.visible = false;
    document.getElementById('health-bar-container').classList.remove('visible');
    document.getElementById('stamina-bar-container').classList.remove('visible');
    document.getElementById('direction-indicator').classList.remove('visible');
    document.getElementById('light-attack-button').classList.remove('visible');
    document.getElementById('heavy-attack-button').classList.remove('visible');
    
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
    
    // Show game over screen with stats
    showGameOverScreen(victory);
}

function showGameOverScreen(victory) {
    const gameOverScreen = document.getElementById('game-over-screen');
    const title = document.getElementById('game-over-title');
    const playerHp = document.getElementById('stat-player-hp');
    const opponentHp = document.getElementById('stat-opponent-hp');
    const blocks = document.getElementById('stat-blocks');
    const playerHits = document.getElementById('stat-player-hits');
    const opponentHits = document.getElementById('stat-opponent-hits');
    
    if (!gameOverScreen) return;
    
    // Update title
    if (victory) {
        title.textContent = 'VICTORY';
        title.style.color = '#00ff00';
        title.style.textShadow = '0 0 10px rgba(0, 255, 0, 0.5)';
    } else {
        title.textContent = 'DEFEAT';
        title.style.color = '#ff0000';
        title.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
    }
    
    // Update stats
    playerHp.textContent = Math.max(0, Math.round(gameState.playerHealth)) + ' HP';
    opponentHp.textContent = Math.max(0, Math.round(gameState.opponentHealth)) + ' HP';
    blocks.textContent = gameState.playerBlocks;
    playerHits.textContent = gameState.playerHits;
    opponentHits.textContent = gameState.opponentHits;
    
    // Show screen
    gameOverScreen.classList.remove('hidden');
}

// Export TWEEN for use in other modules
export { TWEEN };

