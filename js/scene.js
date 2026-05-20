import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { lerp, smoothState } from './state.js';

const OBJECT_COUNT_DESKTOP = 36;
const OBJECT_COUNT_MOBILE = 22;

export function createSceneController(state) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.035);

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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'webgl-canvas';
    document.body.prepend(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x060918, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 12, 8);
    scene.add(mainLight);

    const blueRimLight = new THREE.PointLight(0x00f0ff, state.blueLightTarget, 55);
    blueRimLight.position.set(-12, -6, 6);
    scene.add(blueRimLight);

    const warmRimLight = new THREE.PointLight(0xff007f, 0, 60);
    warmRimLight.position.set(10, -5, -6);
    scene.add(warmRimLight);

    // Lusion-Inspired Real-time Interactive Spotlights
    const cursorLightCyan = new THREE.PointLight(0x00f0ff, 4.5, 38);
    scene.add(cursorLightCyan);

    const cursorLightMagenta = new THREE.PointLight(0xff007f, 3.8, 38);
    scene.add(cursorLightMagenta);

    const objects = createObjects(scene);
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

        camera.position.z = lerp(camera.position.z, state.cameraTargetZ, 0.04);
        camera.position.x = lerp(camera.position.x, state.pointer.x * 0.75, 0.035);
        camera.position.y = lerp(camera.position.y, state.pointer.y * 0.45, 0.035);
        camera.lookAt(0, 0, 0);

        blueRimLight.intensity = lerp(blueRimLight.intensity, state.blueLightTarget, 0.04);
        warmRimLight.intensity = lerp(warmRimLight.intensity, state.warmLightTarget, 0.05);

        // Track spotlights dynamically to follow pointer movement
        if (state.pointer.active) {
            const lightTargetX = state.pointer.x * 14;
            const lightTargetY = state.pointer.y * 10;
            
            cursorLightCyan.position.x = lerp(cursorLightCyan.position.x, lightTargetX, 0.06);
            cursorLightCyan.position.y = lerp(cursorLightCyan.position.y, lightTargetY, 0.06);
            cursorLightCyan.position.z = 4;
            cursorLightCyan.intensity = lerp(cursorLightCyan.intensity, 5.0, 0.06);

            cursorLightMagenta.position.x = lerp(cursorLightMagenta.position.x, -lightTargetX * 0.8, 0.06);
            cursorLightMagenta.position.y = lerp(cursorLightMagenta.position.y, -lightTargetY * 0.8, 0.06);
            cursorLightMagenta.position.z = 2;
            cursorLightMagenta.intensity = lerp(cursorLightMagenta.intensity, 4.0, 0.06);
        } else {
            cursorLightCyan.intensity = lerp(cursorLightCyan.intensity, 0, 0.05);
            cursorLightMagenta.intensity = lerp(cursorLightMagenta.intensity, 0, 0.05);
        }

        objects.forEach((object, index) => {
            updateObject({
                object,
                index,
                seconds,
                monolith,
                raycaster,
                pointerAtDepth,
                state
            });
        });

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
        state.reducedMotion ? 0.1 : 0.35,
        0.45,
        0.82
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

function createObjects(scene) {
    const octahedronGeo = new THREE.OctahedronGeometry(1.3, 0);
    const torusKnotGeo = new THREE.TorusKnotGeometry(0.72, 0.22, 64, 8);

    // Highly premium transmissive/refractive crystalline glass materials
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.05,
        metalness: 0.05,
        transmission: 0.96,
        ior: 1.54,
        thickness: 2.2,
        specularIntensity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
    });

    const activeMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x00f0ff,
        roughness: 0.08,
        metalness: 0.1,
        transmission: 0.88,
        ior: 1.52,
        thickness: 1.8,
        clearcoat: 1.0
    });

    const magentaMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xff007f,
        roughness: 0.12,
        metalness: 0.2,
        transmission: 0.82,
        ior: 1.5,
        thickness: 2.0,
        clearcoat: 1.0
    });

    const goldMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xd9a441,
        roughness: 0.1,
        metalness: 0.35,
        transmission: 0.72,
        ior: 1.56,
        thickness: 1.5,
        clearcoat: 1.0
    });

    const materials = [glassMaterial, activeMaterial, magentaMaterial, goldMaterial];
    const count = window.innerWidth < 768 ? OBJECT_COUNT_MOBILE : OBJECT_COUNT_DESKTOP;
    const objects = [];

    for (let i = 0; i < count; i++) {
        // Alternate geometries (Octahedrons & Torus Knots) for sophisticated balance
        const geometry = i % 2 === 0 ? octahedronGeo : torusKnotGeo;
        const object = new THREE.Mesh(geometry, materials[i % materials.length]);
        
        const home = new THREE.Vector3(
            (Math.random() - 0.5) * 35,
            (Math.random() - 0.5) * 28,
            (Math.random() - 0.5) * 15
        );
        const angle = (i / count) * Math.PI * 2;
        const radius = 2.2 + (i % 5) * 0.28;
        const monolith = new THREE.Vector3(
            Math.cos(angle) * radius,
            (i - count / 2) * 0.22,
            Math.sin(angle) * radius - 4
        );

        object.position.copy(home);
        object.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        object.userData = {
            home,
            monolith,
            velocity: new THREE.Vector3(),
            rotateVel: new THREE.Vector3(
                (Math.random() - 0.5) * 0.012,
                (Math.random() - 0.5) * 0.012,
                (Math.random() - 0.5) * 0.012
            ),
            phase: Math.random() * Math.PI * 2
        };

        scene.add(object);
        objects.push(object);
    }

    return objects;
}

function updateObject({ object, index, seconds, monolith, raycaster, pointerAtDepth, state }) {
    const target = object.userData.home.clone().lerp(object.userData.monolith, monolith);
    const drift = Math.sin(seconds * 0.45 + object.userData.phase) * (1 - monolith) * 0.28;

    target.y += drift;
    object.userData.velocity.add(target.sub(object.position).multiplyScalar(0.0045 + monolith * 0.008));

    if (state.pointer.active && !state.reducedMotion) {
        const objectPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -object.position.z);
        raycaster.ray.intersectPlane(objectPlane, pointerAtDepth);

        const dx = object.position.x - pointerAtDepth.x;
        const dy = object.position.y - pointerAtDepth.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const influence = state.focusCount > 0 ? 1.8 : 4.8;

        if (distance < influence && distance > 0.001) {
            const force = (influence - distance) * 0.012 * state.currentShapeSpeed;
            object.userData.velocity.x += dx * force;
            object.userData.velocity.y += dy * force;
        }
    }

    object.position.add(object.userData.velocity);
    object.userData.velocity.multiplyScalar(0.92);

    const speed = state.currentShapeSpeed * (0.65 + (index % 5) * 0.05);
    object.rotation.x += object.userData.rotateVel.x * speed;
    object.rotation.y += object.userData.rotateVel.y * speed;
    object.rotation.z += object.userData.rotateVel.z * speed;
}

function updatePostProcessing(composer, state, monolith) {
    composer.bloom.strength = lerp(composer.bloom.strength, 0.22 + monolith * 0.18, 0.05);
    composer.bloom.radius = lerp(composer.bloom.radius, 0.42 + monolith * 0.16, 0.05);

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
