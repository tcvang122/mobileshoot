// 3D Game Objects (Gun, Opponent, etc.)

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';
import { scene, materialGunBody } from './sceneSetup.js';

// Gun objects
export const gunGroup = new THREE.Group();
gunGroup.visible = false;
scene.add(gunGroup);

export const muzzleLight = new THREE.PointLight(0x00ffff, 0, 5);
gunGroup.add(muzzleLight);

export let gunModel = null;
export let muzzlePosition = new THREE.Vector3(0, 0, -0.5);

// Opponent objects
export const opponentGroup = new THREE.Group();
opponentGroup.position.set(0, 0, -20);
opponentGroup.visible = false;
scene.add(opponentGroup);

export let opponentModel = null;
export let opponentMixer = null;
export let opponentActions = {};
export let opponentMuzzleLight = null;

const loader = new GLTFLoader();

// Load gun model
export function loadGunModel(modelPath) {
    return new Promise((resolve, reject) => {
        loader.load(
            modelPath,
            (gltf) => {
                gunModel = gltf.scene;
                gunModel.scale.set(0.4608, 0.4608, 0.4608);
                gunModel.position.set(0.15, -0.15, -0.1);
                gunModel.rotation.set(-2, 1.5, 2);
                
                const cleanGunMaterial = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    roughness: 0.3,
                    metalness: 0.8
                });
                
                gunModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.material = cleanGunMaterial;
                    }
                });
                
                gunGroup.add(gunModel);
                
                const box = new THREE.Box3().setFromObject(gunModel);
                const size = box.getSize(new THREE.Vector3());
                muzzlePosition.set(
                    gunModel.position.x,
                    gunModel.position.y,
                    gunModel.position.z - size.z * 0.5 - 0.15
                );
                muzzleLight.position.copy(muzzlePosition);
                
                console.log('Gun loaded successfully');
                resolve();
            },
            (progress) => {
                console.log('Loading gun model:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading gun model:', error);
                // Fallback
                const gunBodyGeo = new THREE.BoxGeometry(0.12, 0.18, 0.45);
                const gunBody = new THREE.Mesh(gunBodyGeo, materialGunBody);
                gunBody.position.set(0.15, -0.15, -0.3);
                gunGroup.add(gunBody);
                
                const barrelGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.45, 16);
                const gunBarrel = new THREE.Mesh(barrelGeo, materialGunBody);
                gunBarrel.rotation.x = Math.PI / 2;
                gunBarrel.position.set(0.15, -0.1, -0.55);
                gunGroup.add(gunBarrel);
                
                muzzleLight.position.set(0.15, -0.1, -0.8);
                reject(error);
            }
        );
    });
}

// Load opponent model
export function loadOpponentModel() {
    return new Promise((resolve, reject) => {
        loader.load(
            './Assets/PFC.glb',
            (gltf) => {
                opponentModel = gltf.scene;
                opponentModel.scale.set(3.0, 3.0, 3.0);
                
                const box = new THREE.Box3().setFromObject(opponentModel);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                opponentModel.position.set(0, size.y / 2 - center.y, 0);
                
                opponentModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                opponentGroup.add(opponentModel);
                
                // Create 3D health bar
                const healthBarWidth = 2;
                const healthBarHeight = 0.3;
                const healthBarGeo = new THREE.PlaneGeometry(healthBarWidth, healthBarHeight);
                const healthBarBgMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0x000000, 
                    transparent: true, 
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });
                const healthBarBg = new THREE.Mesh(healthBarGeo, healthBarBgMaterial);
                healthBarBg.position.set(0, size.y + 1, 0);
                opponentGroup.add(healthBarBg);
                
                const healthBarFillGeo = new THREE.PlaneGeometry(healthBarWidth, healthBarHeight);
                const healthBarFillMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xff0000, 
                    transparent: true, 
                    opacity: 0.9,
                    side: THREE.DoubleSide
                });
                const healthBarFill3D = new THREE.Mesh(healthBarFillGeo, healthBarFillMaterial);
                healthBarFill3D.position.set(0, size.y + 1, 0.01);
                healthBarFill3D.scale.x = 1;
                opponentGroup.add(healthBarFill3D);
                
                opponentGroup.userData.healthBarFill = healthBarFill3D;
                opponentGroup.userData.healthBarBg = healthBarBg;
                
                // Opponent muzzle light
                opponentMuzzleLight = new THREE.PointLight(0xff0000, 0, 5);
                opponentMuzzleLight.position.set(0, size.y * 0.6, size.z * 0.3);
                opponentGroup.add(opponentMuzzleLight);
                opponentGroup.userData.muzzlePosition = opponentMuzzleLight.position.clone();
                
                // Set up animations
                if (gltf.animations && gltf.animations.length > 0) {
                    opponentMixer = new AnimationMixer(opponentModel);
                    opponentActions = {};
                    gltf.animations.forEach((clip) => {
                        const action = opponentMixer.clipAction(clip);
                        action.setLoop(THREE.LoopRepeat);
                        opponentActions[clip.name] = action;
                    });
                    
                    if (opponentActions['Idle'] || opponentActions['idle']) {
                        const idleAction = opponentActions['Idle'] || opponentActions['idle'];
                        idleAction.play();
                        opponentGroup.userData.currentAnimation = idleAction;
                    } else if (Object.keys(opponentActions).length > 0) {
                        const firstAction = Object.values(opponentActions)[0];
                        firstAction.play();
                        opponentGroup.userData.currentAnimation = firstAction;
                    }
                }
                
                console.log('PFC opponent loaded successfully');
                resolve();
            },
            (progress) => {
                console.log('Loading opponent model:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading opponent model:', error);
                reject(error);
            }
        );
    });
}

