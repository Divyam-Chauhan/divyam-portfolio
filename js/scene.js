import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, smoothState } from './state.js';

export function createSceneController(state) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020204, 0.026); // Moody charcoal-velvet museum fog

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    
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
    const ambientLight = new THREE.AmbientLight(0x05060d, 0.03);
    scene.add(ambientLight);

    // 1. Define winding 3D Spline Path
    const splinePoints = [
        new THREE.Vector3(0, 0, 25),
        new THREE.Vector3(1.2, 0.8, 5),
        new THREE.Vector3(-2.2, -1.0, -15),
        new THREE.Vector3(2.6, 1.4, -38),
        new THREE.Vector3(-3.0, -0.8, -62),
        new THREE.Vector3(3.2, 1.6, -88),
        new THREE.Vector3(-2.4, -1.2, -118),
        new THREE.Vector3(1.8, 0.8, -148),
        new THREE.Vector3(-1.0, -0.4, -178),
        new THREE.Vector3(0, 0, -205)
    ];
    const splinePath = new THREE.CatmullRomCurve3(splinePoints);
    
    // Set initial camera position along spline
    const initCamPos = splinePath.getPointAt(0);
    camera.position.copy(initCamPos);

    // 2. Generate Twisting Octagonal Collars (Rings) along Spline
    // Muted, high-end metallic platinum/charcoal wireframes
    const collars = [];
    const collarCount = 120;
    const collarGroup = new THREE.Group();
    scene.add(collarGroup);

    for (let i = 0; i < collarCount; i++) {
        const t = i / (collarCount - 1);
        const pos = splinePath.getPointAt(t);
        const tangent = splinePath.getTangentAt(t);

        // Architectural octagonal loop
        const size = 3.6 + Math.sin(t * Math.PI * 6.5) * 0.35;
        const geo = new THREE.TorusGeometry(size, 0.032, 8, 8); 

        // Monochromatic, highly desaturated premium metallic gradient (Silver -> Platinum -> Soft Gold Accent)
        let colorHex;
        if (t < 0.5) {
            colorHex = new THREE.Color().lerpColors(new THREE.Color(0x8a929e), new THREE.Color(0x2c3e50), t / 0.5);
        } else {
            colorHex = new THREE.Color().lerpColors(new THREE.Color(0x2c3e50), new THREE.Color(0xdfd5c6), (t - 0.5) / 0.5);
        }

        const mat = new THREE.MeshBasicMaterial({
            color: colorHex,
            wireframe: true,
            transparent: true,
            opacity: 0.22, // Faint architectural outlines
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);

        // Align to local curve tangent
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, tangent);
        mesh.quaternion.copy(quaternion);

        mesh.userData = {
            t,
            rotSpeed: (0.12 + Math.random() * 0.18) * (Math.random() < 0.5 ? 1 : -1),
            baseOpacity: 0.08 + (1 - t) * 0.22
        };

        collarGroup.add(mesh);
        collars.push(mesh);
    }

    // 3. Generate Flowing Dual Helix Star Trails wrapping around Spline (Classy Silver Dust)
    const helixCount = window.innerWidth < 768 || state.reducedMotion ? 640 : 1100;
    const helix1Geo = new THREE.BufferGeometry();
    const helix2Geo = new THREE.BufferGeometry();
    const h1Positions = new Float32Array(helixCount * 3);
    const h2Positions = new Float32Array(helixCount * 3);
    
    helix1Geo.setAttribute('position', new THREE.BufferAttribute(h1Positions, 3));
    helix2Geo.setAttribute('position', new THREE.BufferAttribute(h2Positions, 3));
    
    const helixData = [];
    const frames = splinePath.computeFrenetFrames(helixCount - 1, false);
    
    for (let i = 0; i < helixCount; i++) {
        const t = i / (helixCount - 1);
        const pos = splinePath.getPointAt(t);
        const normal = frames.normals[i];
        const binormal = frames.binormals[i];
        
        helixData.push({
            t,
            pos: pos.clone(),
            normal: normal.clone(),
            binormal: binormal.clone()
        });
    }
    
    const texture = createCircleTexture();
    const helix1Mat = new THREE.PointsMaterial({
        color: 0xeaeaea, // Elegant Platinum White
        size: 0.08,      // Tiny luxury star trails
        transparent: true,
        opacity: 0.45,
        map: texture,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const helix2Mat = new THREE.PointsMaterial({
        color: 0xd2c6b4, // Faint desaturated Champagne Gold
        size: 0.07,
        transparent: true,
        opacity: 0.40,
        map: texture,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const helix1System = new THREE.Points(helix1Geo, helix1Mat);
    const helix2System = new THREE.Points(helix2Geo, helix2Mat);
    scene.add(helix1System);
    scene.add(helix2System);

    // 4. Generate Particle Nebula distributed along Spline (Delicate Diamond Dust)
    const particleCount = window.innerWidth < 768 || state.reducedMotion ? 1100 : 2600;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const initialOffsets = [];
    
    const particleFrames = splinePath.computeFrenetFrames(particleCount - 1, false);
    
    for (let i = 0; i < particleCount; i++) {
        const t = Math.random();
        const frameIdx = Math.floor(t * (particleCount - 1));
        const pos = splinePath.getPointAt(t);
        const normal = particleFrames.normals[frameIdx] || new THREE.Vector3(0, 1, 0);
        const binormal = particleFrames.binormals[frameIdx] || new THREE.Vector3(1, 0, 0);
        
        const angle = Math.random() * Math.PI * 2;
        const r = 2.0 + Math.pow(Math.random(), 1.25) * 5.0; // Shell distribution around tube
        
        const px = pos.x + (Math.cos(angle) * normal.x + Math.sin(angle) * binormal.x) * r;
        const py = pos.y + (Math.cos(angle) * normal.y + Math.sin(angle) * binormal.y) * r;
        const pz = pos.z + (Math.cos(angle) * normal.z + Math.sin(angle) * binormal.z) * r;
        
        positions[i * 3] = px;
        positions[i * 3 + 1] = py;
        positions[i * 3 + 2] = pz;
        
        initialOffsets.push({
            t,
            angle,
            radius: r,
            normal: normal.clone(),
            binormal: binormal.clone(),
            pos: pos.clone(),
            phase: Math.random() * Math.PI * 2,
            speed: 0.35 + Math.random() * 0.75
        });
    }
    
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.10,
        transparent: true,
        opacity: 0.55,
        map: texture,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const particleSystem = new THREE.Points(particleGeo, particleMaterial);
    scene.add(particleSystem);

    // 5. Generate Shards along Spline
    const shards = createGlassShards(scene, splinePath, particleCount, particleFrames, state);

    // 6. Generate 4 Stationary Faint Light Beacons (Classy Monochrome & Warm tones)
    const beacons = [
        { color: 0xffffff, t: 0.18, intensity: 5 },  // Faint Silver
        { color: 0xe3e6ec, t: 0.45, intensity: 5 },  // Faint Cool Gray
        { color: 0xdfd3b6, t: 0.72, intensity: 6 },  // Faint Champagne Gold
        { color: 0xcfc8bb, t: 0.92, intensity: 5 }   // Faint Warm Slate
    ];
    const beaconLights = [];
    beacons.forEach(b => {
        const pos = splinePath.getPointAt(b.t);
        const light = new THREE.PointLight(b.color, b.intensity, 20);
        light.position.copy(pos);
        scene.add(light);
        beaconLights.push(light);
    });

    // 7. Mount Volumetric spotlight cones directly to Camera (Soft Silver & Champagne Mist)
    const spotlightCone = createSpotlightCone(0xdfd3b6, 0.025, 6.0); // Super faint champagne
    camera.add(spotlightCone);

    const coreSpotlight = createSpotlightCone(0xffffff, 0.04, 3.0); // Extremely subtle white
    camera.add(coreSpotlight);

    const cameraHeadlight = new THREE.PointLight(0xffffff, 1.6, 15); // Classy, desaturated headlight fill
    cameraHeadlight.position.set(0, 0, 0);
    camera.add(cameraHeadlight);

    // 8. Slate/Steel and Champagne Rim Lights (Desaturated luxury tones)
    const blueRimLight = new THREE.PointLight(0x8fa1b3, state.blueLightTarget, 40); // Faint Slate Blue
    blueRimLight.position.set(-8, -4, 4);
    scene.add(blueRimLight);

    const warmRimLight = new THREE.PointLight(0xdfd3b6, 0, 45); // Faint Champagne Gold
    warmRimLight.position.set(8, -4, -4);
    scene.add(warmRimLight);

    // Dynamic mouse spotlights moving inside the dust nebula
    const cursorLightCyan = new THREE.PointLight(0xffffff, 1.8, 18); // Faint White
    scene.add(cursorLightCyan);

    const cursorLightMagenta = new THREE.PointLight(0xdfd3b6, 1.5, 18); // Faint Champagne
    scene.add(cursorLightMagenta);

    // Add camera to scene so parent-child transforms compile correctly
    scene.add(camera);

    const composer = createComposer({ renderer, scene, camera, state });
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerAtDepth = new THREE.Vector3();

    // Local look-at tracking and helix holding animation variables
    let currentLookAt = null;
    let lastTime = 0;
    let helixPhaseAccumulator = 0;
    const helixNormalSpeed = 1.5;
    const helixHoldSpeed = 0.12;
    const helixReducedMotionSpeed = 0.08;
    let currentHelixSpeed = helixNormalSpeed;
    let currentHelixRadiusScale = 1.0;

    function update(time) {
        smoothState();

        const seconds = time * 0.001;
        const compactScene = window.innerWidth < 768 || state.reducedMotion;
        const hero = chapterPresence(state.heroProgress);
        const identity = chapterPresence(state.identityProgress);
        const capabilities = chapterPresence(state.capabilitiesProgress);
        const archive = chapterPresence(state.archiveProgress);
        const lab = chapterPresence(state.labProgress);
        const footer = chapterPresence(state.footerProgress);
        const monolith = state.footerProgress;
        const readabilityCalm = archive * 0.72;
        const experimentalEnergy = lab * 1.35;
        const finalThin = footer * 0.72;
        pointer.set(state.pointer.x, state.pointer.y);
        raycaster.setFromCamera(pointer, camera);

        scene.fog.density = lerp(scene.fog.density, 0.024 + identity * 0.012 - archive * 0.008 + footer * 0.016, 0.035);
        renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, 1.02 + identity * 0.12 + lab * 0.08 + footer * 0.1 - archive * 0.06, 0.035);

        // 1. DOUBLE-LERP CAMERA POSITION & FLIGHT PATH Sync
        const targetCamPos = splinePath.getPointAt(state.scrollProgress);

        camera.position.x = lerp(camera.position.x, targetCamPos.x + state.pointer.x * 0.35, 0.045);
        camera.position.y = lerp(camera.position.y, targetCamPos.y + state.pointer.y * 0.22, 0.045);
        camera.position.z = lerp(camera.position.z, targetCamPos.z, 0.045);

        // Smoothly interpolate the look-at point slightly ahead
        const lookAheadT = Math.min(state.scrollProgress + 0.038, 0.995);
        const targetLookAt = splinePath.getPointAt(lookAheadT);

        if (!currentLookAt) {
            currentLookAt = new THREE.Vector3().copy(targetLookAt);
        } else {
            currentLookAt.lerp(targetLookAt, 0.045);
        }

        // Add subtle mouse look-around offset
        const activeLookAt = currentLookAt.clone().add(new THREE.Vector3(state.pointer.x * 0.8, state.pointer.y * 0.6, 0));
        camera.lookAt(activeLookAt);

        // 2. SWEEPING VOLUMETRIC FLASHLIGHT / HEADLIGHT EFFECT
        // Tilt the headlight slightly in response to mouse movement
        const coneSwayX = state.pointer.x * 0.22;
        const coneSwayY = state.pointer.y * 0.18;
        spotlightCone.rotation.y = lerp(spotlightCone.rotation.y, -coneSwayX, 0.045);
        spotlightCone.rotation.x = lerp(spotlightCone.rotation.x, coneSwayY, 0.045);
        coreSpotlight.rotation.y = spotlightCone.rotation.y;
        coreSpotlight.rotation.x = spotlightCone.rotation.x;

        ambientLight.intensity = lerp(ambientLight.intensity, 0.03 + identity * 0.035 + footer * 0.025, 0.04);
        blueRimLight.intensity = lerp(blueRimLight.intensity, state.blueLightTarget * 0.8, 0.04);
        warmRimLight.intensity = lerp(warmRimLight.intensity, state.warmLightTarget * 0.8, 0.05);

        // Project mouse coordinate to Z-plane for particle swarm reactions
        const particlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 2); // z = -2 plane relative to camera
        raycaster.ray.intersectPlane(particlePlane, pointerAtDepth);

        // Track spotlights dynamically to follow pointer movement
        if (state.pointer.active) {
            const lightTargetX = state.pointer.x * 12;
            const lightTargetY = state.pointer.y * 9;
            
            cursorLightCyan.position.x = lerp(cursorLightCyan.position.x, lightTargetX, 0.06);
            cursorLightCyan.position.y = lerp(cursorLightCyan.position.y, lightTargetY, 0.06);
            cursorLightCyan.position.z = 2.5;
            cursorLightCyan.intensity = lerp(cursorLightCyan.intensity, 2.0, 0.06);

            cursorLightMagenta.position.x = lerp(cursorLightMagenta.position.x, -lightTargetX * 0.8, 0.06);
            cursorLightMagenta.position.y = lerp(cursorLightMagenta.position.y, -lightTargetY * 0.8, 0.06);
            cursorLightMagenta.position.z = 1.5;
            cursorLightMagenta.intensity = lerp(cursorLightMagenta.intensity, 1.6, 0.06);
        } else {
            cursorLightCyan.intensity = lerp(cursorLightCyan.intensity, 0, 0.05);
            cursorLightMagenta.intensity = lerp(cursorLightMagenta.intensity, 0, 0.05);
        }

        // 3. SPIN & SCALE GEOMETRIC TUNNEL COLLARS based on camera proximity
        collarGroup.rotation.z = lerp(collarGroup.rotation.z, identity * 0.34 - lab * 0.18 + footer * 0.12, 0.035);
        collarGroup.rotation.x = lerp(collarGroup.rotation.x, capabilities * 0.08 - identity * 0.06, 0.035);

        collars.forEach((collar) => {
            collar.rotateZ(collar.userData.rotSpeed * 0.008 * (1 + experimentalEnergy));

            const distToCam = collar.position.distanceTo(camera.position);
            const chapterScale = 1 + capabilities * 0.2 + lab * 0.12 + footer * 0.18 - readabilityCalm * 0.08;
            const opacityMultiplier = clamp(1 + hero * 0.35 + identity * 0.8 + capabilities * 0.22 + lab * 0.45 - readabilityCalm * 0.52 - finalThin * 0.55, 0.16, 2.1);
            if (distToCam < 16) {
                // High glow and slight dilation when close to camera
                const scaleVal = (1.0 + (16 - distToCam) * 0.016) * chapterScale;
                collar.scale.set(scaleVal, scaleVal, scaleVal);
                collar.material.opacity = collar.userData.baseOpacity * (1.0 + (16 - distToCam) * 0.09) * opacityMultiplier;
            } else {
                collar.scale.set(chapterScale, chapterScale, chapterScale);
                collar.material.opacity = collar.userData.baseOpacity * opacityMultiplier;
            }
        });

        // 4. ANIMATE FLOWING DUAL HELIX TRAILS
        // Slow the dotted helix while the primary pointer is held down.
        const delta = lastTime === 0 ? 0.016 : (time - lastTime) * 0.001;
        lastTime = time;

        const targetHelixSpeed = state.reducedMotion
            ? helixReducedMotionSpeed
            : (state.pointer.down ? helixHoldSpeed : helixNormalSpeed);
        currentHelixSpeed = lerp(currentHelixSpeed, targetHelixSpeed, 0.06);

        const targetRadiusScale = state.pointer.down && !state.reducedMotion ? 0.84 : 1.0;
        currentHelixRadiusScale = lerp(currentHelixRadiusScale, targetRadiusScale, 0.06);

        helixPhaseAccumulator += delta * currentHelixSpeed;

        const helixOpacityScale = compactScene ? 0.42 : 1;
        const helixOpacityTarget = clamp(0.42 + hero * 0.2 + identity * 0.26 + capabilities * 0.14 + lab * 0.18 - readabilityCalm * 0.24 - finalThin * 0.32, 0.08, 0.82) * helixOpacityScale;
        helix1Mat.opacity = lerp(helix1Mat.opacity, state.reducedMotion ? 0.22 : helixOpacityTarget, 0.04);
        helix2Mat.opacity = lerp(helix2Mat.opacity, state.reducedMotion ? 0.18 : helixOpacityTarget * 0.82, 0.04);
        helix1Mat.size = lerp(helix1Mat.size, (0.075 + identity * 0.04 + lab * 0.025 - readabilityCalm * 0.02) * (compactScene ? 0.72 : 1), 0.04);
        helix2Mat.size = lerp(helix2Mat.size, (0.065 + identity * 0.035 + lab * 0.02 - readabilityCalm * 0.018) * (compactScene ? 0.72 : 1), 0.04);

        const h1Arr = helix1Geo.attributes.position.array;
        const h2Arr = helix2Geo.attributes.position.array;
        
        for (let i = 0; i < helixCount; i++) {
            const data = helixData[i];
            const turns = 36 - identity * 9 + capabilities * 8 + lab * 12 - footer * 6;
            const angle1 = data.t * Math.PI * turns + helixPhaseAccumulator;
            const angle2 = angle1 + Math.PI;
            
            // Pulsate base radius and apply interactive scaling
            const baseRadius = 2.4 + capabilities * 1.2 + identity * 0.55 + lab * 0.35 - readabilityCalm * 0.55 + footer * 0.2 + Math.sin(data.t * Math.PI * 4 + seconds * 0.5) * 0.25;
            const radius = baseRadius * currentHelixRadiusScale;
            
            const offsetX1 = (Math.cos(angle1) * data.normal.x + Math.sin(angle1) * data.binormal.x) * radius;
            const offsetY1 = (Math.cos(angle1) * data.normal.y + Math.sin(angle1) * data.binormal.y) * radius;
            const offsetZ1 = (Math.cos(angle1) * data.normal.z + Math.sin(angle1) * data.binormal.z) * radius;
            
            const offsetX2 = (Math.cos(angle2) * data.normal.x + Math.sin(angle2) * data.binormal.x) * radius;
            const offsetY2 = (Math.cos(angle2) * data.normal.y + Math.sin(angle2) * data.binormal.y) * radius;
            const offsetZ2 = (Math.cos(angle2) * data.normal.z + Math.sin(angle2) * data.binormal.z) * radius;
            
            const idx = i * 3;
            h1Arr[idx] = data.pos.x + offsetX1;
            h1Arr[idx + 1] = data.pos.y + offsetY1;
            h1Arr[idx + 2] = data.pos.z + offsetZ1;
            
            h2Arr[idx] = data.pos.x + offsetX2;
            h2Arr[idx + 1] = data.pos.y + offsetY2;
            h2Arr[idx + 2] = data.pos.z + offsetZ2;
        }
        helix1Geo.attributes.position.needsUpdate = true;
        helix2Geo.attributes.position.needsUpdate = true;

        // 5. UPDATE NEBULA DUST PARTICLES
        const posAttr = particleSystem.geometry.attributes.position;
        const count = posAttr.count;
        particleMaterial.opacity = lerp(particleMaterial.opacity, clamp(0.48 + hero * 0.18 + identity * 0.34 + lab * 0.24 - readabilityCalm * 0.26 - finalThin * 0.34, 0.08, 0.86), 0.04);
        particleMaterial.size = lerp(particleMaterial.size, 0.09 + identity * 0.055 + lab * 0.03 - readabilityCalm * 0.025, 0.04);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const offset = initialOffsets[i];
            
            // Swirling tube rotation
            const currentAngle = offset.angle + seconds * (0.05 + lab * 0.08) * offset.speed;
            const driftRadius = (offset.radius + Math.sin(seconds * 0.25 + offset.phase) * 0.12) * (1 + identity * 0.72 + capabilities * 0.28 + lab * 0.18 - readabilityCalm * 0.18);
            
            let targetX = offset.pos.x + (Math.cos(currentAngle) * offset.normal.x + Math.sin(currentAngle) * offset.binormal.x) * driftRadius;
            let targetY = offset.pos.y + (Math.cos(currentAngle) * offset.normal.y + Math.sin(currentAngle) * offset.binormal.y) * driftRadius;
            let targetZ = offset.pos.z + (Math.cos(currentAngle) * offset.normal.z + Math.sin(currentAngle) * offset.binormal.z) * driftRadius;

            if (identity > 0.001) {
                targetY = lerp(targetY, offset.pos.y * 0.16 + Math.sin(offset.t * Math.PI * 12 + seconds) * 0.08, identity * 0.72);
                targetX += Math.sin(offset.t * Math.PI * 10 + offset.phase) * identity * 0.55;
            }

            if (capabilities > 0.001) {
                targetZ += Math.sin(offset.t * Math.PI * 16 + seconds * 0.35) * capabilities * 0.55;
            }

            // Pointer swarming physics - only computed if close to the camera for optimization!
            const distToCam = Math.abs(posAttr.array[i3 + 2] - camera.position.z);
            if (distToCam < 14 && state.pointer.active && !state.reducedMotion) {
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

        // 6. UPDATE TRANSMISSIVE CRYSTAL SHARDS
        shards.forEach((shard, index) => {
            updateShard({
                shard,
                index,
                seconds,
                monolith,
                raycaster,
                pointerAtDepth,
                camera,
                state,
                lab,
                archive,
                footer
            });
        });

        // 7. VOLUME AMPLIFICATION ON SCROLL
        const coneTargetOpacity = (0.02 + hero * 0.012 + capabilities * 0.018 + lab * 0.026 + monolith * 0.04 - readabilityCalm * 0.012) * (compactScene ? 0.58 : 1);
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
        state.reducedMotion ? 0.04 : 0.28, // Desaturated, low-intensity subtle glow
        0.5,
        0.92
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
    const coneGeo = new THREE.CylinderGeometry(0.02, bottomRadius, 24, 32, 1, true);
    // Rotate to face down the negative Z-axis (camera's forward direction)
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, -12); // extend forward from camera apex
    
    const coneMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    
    const mesh = new THREE.Mesh(coneGeo, coneMaterial);
    mesh.position.set(0, 0, 0); // centered at camera
    return mesh;
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

function createGlassShards(scene, splinePath, particleCount, particleFrames, state) {
    const octahedronGeo = new THREE.OctahedronGeometry(1.2, 0);
    const torusKnotGeo = new THREE.TorusKnotGeometry(0.64, 0.18, 64, 8);

    // Strict premium, monochromatic, desaturated materials
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

    const frostedCrystalMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xe5e9f0,
        roughness: 0.28, // Elegant Frosted look
        metalness: 0.08,
        transmission: 0.92,
        ior: 1.48,
        thickness: 1.8,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });

    const champagneFrostedMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xebdcb9, // Super subtle desaturated champagne
        roughness: 0.08,
        metalness: 0.12,
        transmission: 0.94,
        ior: 1.58,
        thickness: 2.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
    });

    const materials = [clearDiamondMaterial, obsidianGlassMaterial, frostedCrystalMaterial, champagneFrostedMaterial];
    const count = state.reducedMotion ? 6 : (window.innerWidth < 768 ? 9 : 16);
    const shards = [];

    for (let i = 0; i < count; i++) {
        const geometry = i % 2 === 0 ? octahedronGeo : torusKnotGeo;
        const mesh = new THREE.Mesh(geometry, materials[i % materials.length]);

        // Distribute shards uniformly along spline (0.06 to 0.94)
        const t = 0.06 + (i / count) * 0.88;
        const pos = splinePath.getPointAt(t);
        const frameIdx = Math.floor(t * (particleCount - 1));
        
        const normal = particleFrames.normals[frameIdx] || new THREE.Vector3(0, 1, 0);
        const binormal = particleFrames.binormals[frameIdx] || new THREE.Vector3(1, 0, 0);

        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const radius = 1.6 + Math.random() * 1.4;
        
        const home = pos.clone().add(
            normal.clone().multiplyScalar(Math.cos(angle) * radius)
        ).add(
            binormal.clone().multiplyScalar(Math.sin(angle) * radius)
        );

        mesh.position.copy(home);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        
        mesh.userData = {
            t,
            home: home.clone(),
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

function updateShard({ shard, index, seconds, monolith, raycaster, pointerAtDepth, camera, state, lab, archive, footer }) {
    const distToCam = Math.abs(shard.position.z - camera.position.z);
    
    // Smooth magnetic pull back to designated floating home
    const target = shard.userData.home.clone();
    const drift = Math.sin(seconds * (0.38 + lab * 0.35) + shard.userData.phase) * (1.0 - monolith) * (0.18 + lab * 0.22);
    target.y += drift;
    target.x += Math.sin(seconds * 0.42 + shard.userData.phase) * lab * 0.16;
    
    shard.userData.velocity.add(target.sub(shard.position).multiplyScalar(0.005));

    // Pointer kinetic reaction - only calculated if shard is close to camera
    if (distToCam < 15 && state.pointer.active && !state.reducedMotion) {
        const shardPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -shard.position.z);
        raycaster.ray.intersectPlane(shardPlane, pointerAtDepth);

        const dx = shard.position.x - pointerAtDepth.x;
        const dy = shard.position.y - pointerAtDepth.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const influence = state.focusCount > 0 ? 1.6 : 3.8;

        if (distance < influence && distance > 0.001) {
            const force = (influence - distance) * 0.012 * state.currentShapeSpeed;
            shard.userData.velocity.x += dx * force;
            shard.userData.velocity.y += dy * force;
        }
    }

    shard.position.add(shard.userData.velocity);
    shard.userData.velocity.multiplyScalar(0.9);

    const targetScale = clamp(1 + lab * 0.22 - archive * 0.1 + footer * 0.14, 0.78, 1.38);
    shard.scale.setScalar(lerp(shard.scale.x, targetScale, 0.04));

    const speed = state.currentShapeSpeed * (0.55 + (index % 4) * 0.05) * (1 + lab * 1.7 - archive * 0.22);
    shard.rotation.x += shard.userData.rotateVel.x * speed;
    shard.rotation.y += shard.userData.rotateVel.y * speed;
    shard.rotation.z += shard.userData.rotateVel.z * speed;
}

function updatePostProcessing(composer, state, monolith) {
    const hero = chapterPresence(state.heroProgress);
    const identity = chapterPresence(state.identityProgress);
    const capabilities = chapterPresence(state.capabilitiesProgress);
    const archive = chapterPresence(state.archiveProgress);
    const lab = chapterPresence(state.labProgress);
    const footer = chapterPresence(state.footerProgress);
    const bloomTarget = state.reducedMotion
        ? 0.04
        : clamp(0.2 + hero * 0.1 + identity * 0.18 + capabilities * 0.08 + lab * 0.24 + footer * 0.1 - archive * 0.08 + monolith * 0.08, 0.08, 0.62);

    composer.bloom.strength = lerp(composer.bloom.strength, bloomTarget, 0.05);
    composer.bloom.radius = lerp(composer.bloom.radius, 0.46 + identity * 0.16 + lab * 0.18 + footer * 0.18, 0.05);

    if (composer.bokeh.uniforms?.maxblur) {
        composer.bokeh.uniforms.maxblur.value = state.currentBlur;
    }

    if (composer.bokeh.uniforms?.aperture) {
        composer.bokeh.uniforms.aperture.value = 0.000025 + state.currentBlur * 0.004;
    }

    if (composer.bokeh.uniforms?.focus) {
        composer.bokeh.uniforms.focus.value = 7.5 + archive * 1.8 - monolith * 4.2;
    }
}

function chapterPresence(progress) {
    return Math.sin(clamp(progress, 0, 1) * Math.PI);
}

function getPixelRatio(state) {
    const cap = window.innerWidth < 768 || state.reducedMotion ? 1.25 : 1.75;
    return Math.min(window.devicePixelRatio || 1, cap);
}
