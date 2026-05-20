import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { lerp, smoothState } from './state.js';

export function createSceneController(state) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020204, 0.038); // Match obsidian ink background

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = state.cameraTargetZ;

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(getPixelRatio(state));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'webgl-canvas';
    document.body.prepend(renderer.domElement);

    // Deep velvet darkness - almost no ambient washing
    const ambientLight = new THREE.AmbientLight(0x050714, 0.04);
    scene.add(ambientLight);

    // Intense central directional spotlight
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.8);
    mainLight.position.set(0, 15, -4);
    scene.add(mainLight);

    const blueRimLight = new THREE.PointLight(0x0df5d6, state.blueLightTarget, 40);
    blueRimLight.position.set(-8, -4, 4);
    scene.add(blueRimLight);

    const warmRimLight = new THREE.PointLight(0xff2a85, 0, 45);
    warmRimLight.position.set(8, -4, -4);
    scene.add(warmRimLight);

    // Dynamic mouse spotlights moving inside the dust nebula
    const cursorLightCyan = new THREE.PointLight(0x0df5d6, 5.0, 30);
    scene.add(cursorLightCyan);

    const cursorLightMagenta = new THREE.PointLight(0xff2a85, 4.5, 30);
    scene.add(cursorLightMagenta);

    // Volumetric Spotlight Cones shining down from top center
    const spotlightCone = createSpotlightCone(0x0df5d6, 0.07, 7.0);
    scene.add(spotlightCone);

    const coreSpotlight = createSpotlightCone(0xffffff, 0.12, 3.2);
    scene.add(coreSpotlight);

    // Particle Nebula Swarm & High-Refraction Crystal Shards
    const particles = createParticleNebula(scene);
    const shards = createGlassShards(scene);

    const composer = createComposer({ renderer, scene, camera, state });
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerAtDepth = new THREE.Vector3();

    function update(time) {
        smoothState();

        const seconds = time * 0.001;
        const monolith = state.monolithProgress;
        pointer.set(state.pointer.x, state.pointer.y);
        raycaster.setFromCamera(pointer, camera);

        // Smooth camera drift following pointer
        camera.position.z = lerp(camera.position.z, state.cameraTargetZ, 0.04);
        camera.position.x = lerp(camera.position.x, state.pointer.x * 0.95, 0.035);
        camera.position.y = lerp(camera.position.y, state.pointer.y * 0.55, 0.035);
        camera.lookAt(0, 0, 0);

        // Volumetric Cone responsive sway following mouse coordinates
        const coneSwayX = state.pointer.x * 1.8;
        const coneSwayY = state.pointer.y * 1.2;
        spotlightCone.rotation.z = lerp(spotlightCone.rotation.z, -coneSwayX * 0.08, 0.04);
        spotlightCone.rotation.x = lerp(spotlightCone.rotation.x, coneSwayY * 0.08, 0.04);
        coreSpotlight.rotation.z = spotlightCone.rotation.z;
        coreSpotlight.rotation.x = spotlightCone.rotation.x;

        blueRimLight.intensity = lerp(blueRimLight.intensity, state.blueLightTarget, 0.04);
        warmRimLight.intensity = lerp(warmRimLight.intensity, state.warmLightTarget, 0.05);

        // Project mouse coordinate to Z-plane for particle swarm reactions
        const particlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 2); // z = -2 plane
        raycaster.ray.intersectPlane(particlePlane, pointerAtDepth);

        // Track spotlights dynamically to follow pointer movement
        if (state.pointer.active) {
            const lightTargetX = state.pointer.x * 12;
            const lightTargetY = state.pointer.y * 9;
            
            cursorLightCyan.position.x = lerp(cursorLightCyan.position.x, lightTargetX, 0.06);
            cursorLightCyan.position.y = lerp(cursorLightCyan.position.y, lightTargetY, 0.06);
            cursorLightCyan.position.z = 2.5;
            cursorLightCyan.intensity = lerp(cursorLightCyan.intensity, 6.0, 0.06);

            cursorLightMagenta.position.x = lerp(cursorLightMagenta.position.x, -lightTargetX * 0.8, 0.06);
            cursorLightMagenta.position.y = lerp(cursorLightMagenta.position.y, -lightTargetY * 0.8, 0.06);
            cursorLightMagenta.position.z = 1.5;
            cursorLightMagenta.intensity = lerp(cursorLightMagenta.intensity, 5.0, 0.06);
        } else {
            cursorLightCyan.intensity = lerp(cursorLightCyan.intensity, 0, 0.05);
            cursorLightMagenta.intensity = lerp(cursorLightMagenta.intensity, 0, 0.05);
        }

        // 1. Swirl & Swarm Particles
        updateParticles(particles, seconds, pointerAtDepth, state);

        // 2. Rotate & Drift Glass Shards
        shards.forEach((shard, index) => {
            updateShard({
                shard,
                index,
                seconds,
                monolith,
                raycaster,
                pointerAtDepth,
                state
            });
        });

        // Volume animation on scroll
        const coneTargetOpacity = 0.07 + monolith * 0.12;
        spotlightCone.material.opacity = lerp(spotlightCone.material.opacity, coneTargetOpacity, 0.05);
        coreSpotlight.material.opacity = lerp(coreSpotlight.material.opacity, coneTargetOpacity * 1.5, 0.05);

        updatePostProcessing(composer, state, monolith);
        composer.instance.render();
    }

    function resize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(getPixelRatio(state));
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.instance.setSize(window.innerWidth, window.innerHeight);
        composer.bloom.setSize(window.innerWidth, window.innerHeight);
    }

    return { update, resize };
}

function createComposer({ renderer, scene, camera, state }) {
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        state.reducedMotion ? 0.08 : 0.42,
        0.5,
        0.88
    );
    const bokeh = new BokehPass(scene, camera, {
        focus: 8.0,
        aperture: 0.00003,
        maxblur: 0
    });
    const output = new OutputPass();

    composer.addPass(renderPass);
    composer.addPass(bloom);
    composer.addPass(bokeh);
    composer.addPass(output);

    return { instance: composer, bloom, bokeh };
}

function createSpotlightCone(color, opacity, bottomRadius) {
    const coneGeo = new THREE.CylinderGeometry(0.04, bottomRadius, 24, 32, 1, true);
    // Offset pivot so rotation origin is at the apex
    coneGeo.translate(0, -12, 0); 
    
    const coneMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    
    const mesh = new THREE.Mesh(coneGeo, coneMaterial);
    mesh.position.set(0, 11, -5);
    return mesh;
}

function createParticleNebula(scene) {
    const particleCount = window.innerWidth < 768 ? 1200 : 2500;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const initialPositions = [];
    const phases = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        // Distribute in a cosmic swirling nebula disc in the center core
        const theta = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 1.6) * 9.5; 
        const x = Math.cos(theta) * r;
        const y = (Math.random() - 0.5) * 8.0;
        const z = Math.sin(theta) * r - 2;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        initialPositions.push(new THREE.Vector3(x, y, z));
        phases[i] = Math.random() * Math.PI * 2;
        speeds[i] = 0.45 + Math.random() * 0.85;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Dynamic procedural anti-aliased glowing dot texture
    const texture = createCircleTexture();

    const particleMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.13,
        transparent: true,
        opacity: 0.72,
        map: texture,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particleSystem = new THREE.Points(particleGeo, particleMaterial);
    scene.add(particleSystem);

    return {
        system: particleSystem,
        initialPositions,
        phases,
        speeds
    };
}

function createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    return new THREE.CanvasTexture(canvas);
}

function updateParticles(particles, seconds, pointerAtDepth, state) {
    const system = particles.system;
    const posAttr = system.geometry.attributes.position;
    const count = posAttr.count;

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const initial = particles.initialPositions[i];
        const phase = particles.phases[i];
        const speed = particles.speeds[i];

        // Swirling vortex mathematics around the volumetric shaft
        const timeFactor = seconds * 0.12 * speed;
        const r = Math.sqrt(initial.x * initial.x + initial.z * initial.z);
        const theta = Math.atan2(initial.z, initial.x) + timeFactor;

        let targetX = Math.cos(theta) * r;
        let targetY = initial.y + Math.sin(seconds * 0.35 + phase) * 0.45;
        let targetZ = Math.sin(theta) * r;

        // Pointer dynamic kinetic swirl
        if (state.pointer.active && !state.reducedMotion) {
            const dx = posAttr.array[i3] - pointerAtDepth.x;
            const dy = posAttr.array[i3 + 1] - pointerAtDepth.y;
            const dz = posAttr.array[i3 + 2] - pointerAtDepth.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (dist < 4.8) {
                const force = (4.8 - dist) * 0.08 * state.currentShapeSpeed;
                targetX += dx * force;
                targetY += dy * force;
                targetZ += dz * force;
            }
        }

        posAttr.array[i3] = lerp(posAttr.array[i3], targetX, 0.045);
        posAttr.array[i3 + 1] = lerp(posAttr.array[i3 + 1], targetY, 0.045);
        posAttr.array[i3 + 2] = lerp(posAttr.array[i3 + 2], targetZ, 0.045);
    }
    posAttr.needsUpdate = true;
}

function createGlassShards(scene) {
    const octahedronGeo = new THREE.OctahedronGeometry(1.2, 0);
    const torusKnotGeo = new THREE.TorusKnotGeometry(0.64, 0.18, 64, 8);

    // Dark and clear crystal physical transmission materials (zero ambient light dependencies)
    const clearDiamondMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.02,
        metalness: 0.05,
        transmission: 0.98,
        ior: 2.42, // High diamond refraction
        thickness: 2.2,
        specularIntensity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02
    });

    const obsidianGlassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x05070a,
        roughness: 0.04,
        metalness: 0.9,
        transmission: 0.35,
        ior: 1.72,
        thickness: 1.8,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
    });

    const tealGlassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x0df5d6,
        roughness: 0.06,
        metalness: 0.1,
        transmission: 0.88,
        ior: 1.54,
        thickness: 2.0,
        clearcoat: 1.0
    });

    const amberGlassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xe2c98a,
        roughness: 0.05,
        metalness: 0.15,
        transmission: 0.86,
        ior: 1.56,
        thickness: 1.6,
        clearcoat: 1.0
    });

    const materials = [clearDiamondMaterial, obsidianGlassMaterial, tealGlassMaterial, amberGlassMaterial];
    const count = 14; 
    const shards = [];

    for (let i = 0; i < count; i++) {
        const geometry = i % 2 === 0 ? octahedronGeo : torusKnotGeo;
        const mesh = new THREE.Mesh(geometry, materials[i % materials.length]);

        const home = new THREE.Vector3(
            (Math.random() - 0.5) * 22,
            (Math.random() - 0.5) * 16,
            (Math.random() - 0.5) * 8 - 4
        );
        const angle = (i / count) * Math.PI * 2;
        const radius = 2.4 + (i % 4) * 0.35;
        const monolith = new THREE.Vector3(
            Math.cos(angle) * radius,
            (i - count / 2) * 0.42,
            Math.sin(angle) * radius - 4
        );

        mesh.position.copy(home);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mesh.userData = {
            home,
            monolith,
            velocity: new THREE.Vector3(),
            rotateVel: new THREE.Vector3(
                (Math.random() - 0.5) * 0.008,
                (Math.random() - 0.5) * 0.008,
                (Math.random() - 0.5) * 0.008
            ),
            phase: Math.random() * Math.PI * 2
        };

        scene.add(mesh);
        shards.push(mesh);
    }

    return shards;
}

function updateShard({ shard, index, seconds, monolith, raycaster, pointerAtDepth, state }) {
    const target = shard.userData.home.clone().lerp(shard.userData.monolith, monolith);
    const drift = Math.sin(seconds * 0.38 + shard.userData.phase) * (1 - monolith) * 0.22;

    target.y += drift;
    shard.userData.velocity.add(target.sub(shard.position).multiplyScalar(0.004 + monolith * 0.006));

    if (state.pointer.active && !state.reducedMotion) {
        const shardPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -shard.position.z);
        raycaster.ray.intersectPlane(shardPlane, pointerAtDepth);

        const dx = shard.position.x - pointerAtDepth.x;
        const dy = shard.position.y - pointerAtDepth.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const influence = state.focusCount > 0 ? 1.6 : 3.8;

        if (distance < influence && distance > 0.001) {
            const force = (influence - distance) * 0.008 * state.currentShapeSpeed;
            shard.userData.velocity.x += dx * force;
            shard.userData.velocity.y += dy * force;
        }
    }

    shard.position.add(shard.userData.velocity);
    shard.userData.velocity.multiplyScalar(0.91);

    const speed = state.currentShapeSpeed * (0.55 + (index % 4) * 0.05);
    shard.rotation.x += shard.userData.rotateVel.x * speed;
    shard.rotation.y += shard.userData.rotateVel.y * speed;
    shard.rotation.z += shard.userData.rotateVel.z * speed;
}

function updatePostProcessing(composer, state, monolith) {
    composer.bloom.strength = lerp(composer.bloom.strength, 0.38 + monolith * 0.22, 0.05);
    composer.bloom.radius = lerp(composer.bloom.radius, 0.5 + monolith * 0.18, 0.05);

    if (composer.bokeh.uniforms?.maxblur) {
        composer.bokeh.uniforms.maxblur.value = state.currentBlur;
    }

    if (composer.bokeh.uniforms?.aperture) {
        composer.bokeh.uniforms.aperture.value = 0.000025 + state.currentBlur * 0.004;
    }

    if (composer.bokeh.uniforms?.focus) {
        composer.bokeh.uniforms.focus.value = 7.5 - monolith * 4.2;
    }
}

function getPixelRatio(state) {
    const cap = window.innerWidth < 768 || state.reducedMotion ? 1.25 : 1.75;
    return Math.min(window.devicePixelRatio || 1, cap);
}
