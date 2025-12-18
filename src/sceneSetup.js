// Three.js Scene Setup

import * as THREE from 'three';

// Scene
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.01);

// Camera
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.7, 0);
camera.lookAt(0, 1.7, -10);

// Renderer
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-container').appendChild(renderer.domElement);

// Materials
export const materialMetal = new THREE.MeshStandardMaterial({ 
    color: 0x888888,
    roughness: 0.2, 
    metalness: 0.9 
});

export const materialMetalDark = new THREE.MeshStandardMaterial({ 
    color: 0x333333,
    roughness: 0.1, 
    metalness: 0.95 
});

export const materialFloor = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a2e,
    roughness: 0.3, 
    metalness: 0.8 
});

export const materialBuilding = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    roughness: 0.1, 
    metalness: 0.7 
});

export const materialAccent = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00aaff,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.5
});

export const materialEnemy = new THREE.MeshStandardMaterial({
    color: 0xff4757,
    roughness: 0.3,
    metalness: 0.8,
    emissive: 0x330000,
    emissiveIntensity: 0.2
});

export const materialRobotHead = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00aaff,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.9
});

export const materialGunBody = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.2,
    metalness: 0.95,
    emissive: 0x001122,
    emissiveIntensity: 0.1
});

// Lighting
const ambientLight = new THREE.AmbientLight(0x4444ff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);

const accentLight1 = new THREE.PointLight(0x00ffff, 0.5, 30);
accentLight1.position.set(-20, 10, -30);
scene.add(accentLight1);

const accentLight2 = new THREE.PointLight(0xff00ff, 0.5, 30);
accentLight2.position.set(20, 10, -30);
scene.add(accentLight2);

// Scene objects
export function setupScene() {
    // Main ground platform
    const mainPlatformGeo = new THREE.PlaneGeometry(100, 80);
    const mainPlatform = new THREE.Mesh(mainPlatformGeo, materialFloor);
    mainPlatform.rotation.x = -Math.PI / 2;
    mainPlatform.position.set(0, 0, -15);
    mainPlatform.receiveShadow = true;
    scene.add(mainPlatform);

    // Grid helper
    const gridHelper = new THREE.GridHelper(100, 20, 0x4a90e2, 0x2a5a8a);
    gridHelper.position.set(0, 0.01, -15);
    scene.add(gridHelper);

    // Elevated side platforms
    for (let i = 0; i < 2; i++) {
        const sidePlatformGeo = new THREE.PlaneGeometry(30, 40);
        const sidePlatform = new THREE.Mesh(sidePlatformGeo, materialMetalDark);
        sidePlatform.rotation.x = -Math.PI / 2;
        sidePlatform.position.set(
            (i === 0 ? -35 : 35),
            1.5,
            -20 - i * 10
        );
        sidePlatform.receiveShadow = true;
        scene.add(sidePlatform);
        
        // Railings
        const railingGeo = new THREE.BoxGeometry(30, 0.3, 0.3);
        const railingMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9, roughness: 0.2 });
        for (let j = 0; j < 2; j++) {
            const railing = new THREE.Mesh(railingGeo, railingMat);
            railing.position.set(
                (i === 0 ? -35 : 35),
                1.65,
                -20 - i * 10 + (j === 0 ? -20 : 20)
            );
            scene.add(railing);
        }
    }

    // Support pillars
    for (let i = 0; i < 6; i++) {
        const pillarGeo = new THREE.CylinderGeometry(1.5, 1.5, 8, 16);
        const pillar = new THREE.Mesh(pillarGeo, materialMetal);
        pillar.position.set(
            -40 + (i % 3) * 40,
            4,
            -25 - Math.floor(i / 3) * 15
        );
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        scene.add(pillar);
        
        // Glowing rings
        const ringGeo = new THREE.TorusGeometry(1.6, 0.1, 8, 16);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00aaff,
            emissiveIntensity: 0.8
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pillar.position);
        ring.position.y = pillar.position.y + 2;
        scene.add(ring);
    }

    // Overhead walkways
    for (let i = 0; i < 3; i++) {
        const bridgeGeo = new THREE.BoxGeometry(25, 0.5, 3);
        const bridge = new THREE.Mesh(bridgeGeo, materialMetalDark);
        bridge.position.set(
            -30 + i * 30,
            6,
            -20 - i * 5
        );
        bridge.castShadow = true;
        bridge.receiveShadow = true;
        scene.add(bridge);
        
        // Support cables
        const cableGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
        const cableMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        for (let j = 0; j < 2; j++) {
            const cable = new THREE.Mesh(cableGeo, cableMat);
            cable.rotation.z = Math.PI / 2;
            cable.position.set(
                -30 + i * 30 + (j === 0 ? -12 : 12),
                4,
                -20 - i * 5
            );
            scene.add(cable);
        }
    }

    // Circular platforms
    for (let i = 0; i < 4; i++) {
        const padGeo = new THREE.CylinderGeometry(4, 4, 0.2, 32);
        const padMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a3a,
            metalness: 0.8,
            roughness: 0.3
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(
            -30 + (i % 2) * 60,
            0.1,
            -30 - Math.floor(i / 2) * 20
        );
        pad.receiveShadow = true;
        scene.add(pad);
        
        // Glowing center
        const centerGeo = new THREE.CylinderGeometry(1, 1, 0.1, 16);
        const centerMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00aaff,
            emissiveIntensity: 0.6
        });
        const center = new THREE.Mesh(centerGeo, centerMat);
        center.rotation.x = -Math.PI / 2;
        center.position.copy(pad.position);
        center.position.y = 0.15;
        scene.add(center);
    }

    // Tech panels
    for (let i = 0; i < 8; i++) {
        const panelGeo = new THREE.BoxGeometry(3, 2, 0.2);
        const panelMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            emissive: 0x003366,
            emissiveIntensity: 0.3
        });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(
            -35 + (i % 4) * 23,
            2,
            -15 - Math.floor(i / 4) * 25
        );
        scene.add(panel);
        
        // Glowing lines
        const lineGeo = new THREE.BoxGeometry(2.5, 0.1, 0.05);
        const lineMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00aaff,
            emissiveIntensity: 1.0
        });
        for (let j = 0; j < 3; j++) {
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.position.copy(panel.position);
            line.position.y = panel.position.y - 0.5 + j * 0.5;
            line.position.z = panel.position.z + 0.1;
            scene.add(line);
        }
    }

    // Decorative shapes
    for (let i = 0; i < 5; i++) {
        const shapeType = Math.floor(Math.random() * 3);
        let shape;
        
        if (shapeType === 0) {
            shape = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), materialAccent);
        } else if (shapeType === 1) {
            shape = new THREE.Mesh(new THREE.TetrahedronGeometry(1, 0), materialAccent);
        } else {
            shape = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), materialAccent);
        }
        
        shape.position.set(
            -20 + Math.random() * 40,
            1 + Math.random() * 2,
            -25 - Math.random() * 20
        );
        shape.castShadow = true;
        scene.add(shape);
    }
}

// Handle window resize
export function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

