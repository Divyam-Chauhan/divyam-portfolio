import * as THREE from 'three';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.03);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 15;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 2);
mainLight.position.set(5, 10, 7);
scene.add(mainLight);

const blueRimLight = new THREE.PointLight(0x0044ff, 5, 50);
blueRimLight.position.set(-10, -5, 5);
scene.add(blueRimLight);

const cylinderGeo = new THREE.CylinderGeometry(0.6, 0.6, 3.5, 32);

const materials = [
    new THREE.MeshPhysicalMaterial({ color: 0x1a53ff, roughness: 0.1, metalness: 0.1, clearcoat: 1.0 }),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1, clearcoat: 1.0 }),
    new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.5, clearcoat: 1.0 })
];

function createJack() {
    const group = new THREE.Group();
    const mat = materials[Math.floor(Math.random() * materials.length)];

    const m1 = new THREE.Mesh(cylinderGeo, mat);
    const m2 = new THREE.Mesh(cylinderGeo, mat);
    m2.rotation.z = Math.PI / 2;
    const m3 = new THREE.Mesh(cylinderGeo, mat);
    m3.rotation.x = Math.PI / 2;

    group.add(m1, m2, m3);
    return group;
}

const objects = [];
const count = 35;

for (let i = 0; i < count; i++) {
    const jack = createJack();

    jack.position.x = (Math.random() - 0.5) * 35;
    jack.position.y = (Math.random() - 0.5) * 35;
    jack.position.z = (Math.random() - 0.5) * 15;

    jack.rotation.x = Math.random() * Math.PI;
    jack.rotation.y = Math.random() * Math.PI;

    jack.userData = {
        velocity: new THREE.Vector3(0, 0, 0),
        rotateVel: new THREE.Vector3(0, 0, 0)
    };

    scene.add(jack);
    objects.push(jack);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const mouseTarget = new THREE.Vector3();

document.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, mouseTarget);
});

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    raycaster.setFromCamera(mouse, camera);

    objects.forEach(obj => {
        const objectPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -obj.position.z);
        const mouseAtObjectDepth = new THREE.Vector3();

        raycaster.ray.intersectPlane(objectPlane, mouseAtObjectDepth);

        const dx = obj.position.x - mouseAtObjectDepth.x;
        const dy = obj.position.y - mouseAtObjectDepth.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
            const force = (5 - dist) * 0.08;

            obj.userData.velocity.x += dx * force;
            obj.userData.velocity.y += dy * force;

            obj.userData.rotateVel.x += (Math.random() - 0.5) * 0.1;
            obj.userData.rotateVel.y += (Math.random() - 0.5) * 0.1;
        }
    });

    const collisionRadius = 2.5;

    for (let i = 0; i < objects.length; i++) {
        for (let j = i + 1; j < objects.length; j++) {
            const obj1 = objects[i];
            const obj2 = objects[j];

            const dx = obj2.position.x - obj1.position.x;
            const dy = obj2.position.y - obj1.position.y;
            const dz = obj2.position.z - obj1.position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const minDistance = collisionRadius * 2;

            if (distance < minDistance && distance > 0) {
                const nx = dx / distance;
                const ny = dy / distance;
                const nz = dz / distance;

                const overlap = minDistance - distance;

                const separation = overlap * 0.5;
                obj1.position.x -= nx * separation;
                obj1.position.y -= ny * separation;
                obj1.position.z -= nz * separation;

                obj2.position.x += nx * separation;
                obj2.position.y += ny * separation;
                obj2.position.z += nz * separation;

                const relativeVelX = obj2.userData.velocity.x - obj1.userData.velocity.x;
                const relativeVelY = obj2.userData.velocity.y - obj1.userData.velocity.y;
                const relativeVelZ = obj2.userData.velocity.z - obj1.userData.velocity.z;

                const velAlongNormal = relativeVelX * nx + relativeVelY * ny + relativeVelZ * nz;

                if (velAlongNormal < 0) {
                    const speed = Math.abs(velAlongNormal);
                    const restitution = speed > 0.1 ? 0.6 : 0.3;
                    const impulse = -(1 + restitution) * velAlongNormal * 0.5;

                    obj1.userData.velocity.x -= impulse * nx;
                    obj1.userData.velocity.y -= impulse * ny;
                    obj1.userData.velocity.z -= impulse * nz;

                    obj2.userData.velocity.x += impulse * nx;
                    obj2.userData.velocity.y += impulse * ny;
                    obj2.userData.velocity.z += impulse * nz;

                    obj1.userData.rotateVel.x += (Math.random() - 0.5) * 0.01;
                    obj1.userData.rotateVel.y += (Math.random() - 0.5) * 0.01;
                    obj2.userData.rotateVel.x += (Math.random() - 0.5) * 0.01;
                    obj2.userData.rotateVel.y += (Math.random() - 0.5) * 0.01;
                }
            }
        }
    }

    objects.forEach(obj => {
        obj.position.add(obj.userData.velocity);
        obj.rotation.x += obj.userData.rotateVel.x;
        obj.rotation.y += obj.userData.rotateVel.y;

        obj.userData.velocity.multiplyScalar(0.96);
        obj.userData.rotateVel.multiplyScalar(0.05);

        const gravityStrength = 0.0002;
        obj.userData.velocity.x -= obj.position.x * gravityStrength;
        obj.userData.velocity.y -= obj.position.y * gravityStrength;
        obj.userData.velocity.z -= obj.position.z * gravityStrength;
    });

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function initTiltEffect() {
    document.querySelectorAll('.card').forEach(wrapper => {
        const visual = wrapper.querySelector('.card-visual');

        wrapper.addEventListener('mousemove', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            visual.style.setProperty('--mouse-x', `${x}px`);
            visual.style.setProperty('--mouse-y', `${y}px`);

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -1;
            const rotateY = (x - centerX) / centerX;

            visual.style.transform = `
                perspective(1000px) 
                rotateX(${rotateX * 4}deg) 
                rotateY(${rotateY * 4}deg) 
                scale3d(1.02, 1.02, 1.02)
            `;
        });

        wrapper.addEventListener('mouseleave', () => {
            visual.style.transition = 'transform 0.5s ease';
            visual.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            setTimeout(() => { visual.style.transition = 'transform 0.1s'; }, 500);
        });
    });
}

document.addEventListener('DOMContentLoaded', initTiltEffect);
initTiltEffect();

const btn = document.getElementById('contactBtn');

if (btn) {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px) scale(1.1)`;
        btn.style.background = 'white';
        btn.style.color = 'black';
        btn.style.borderColor = 'white';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0px, 0px) scale(1)';
        btn.style.background = 'rgba(255, 255, 255, 0.05)';
        btn.style.color = 'white';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
}

function initVoidGravity() {
    const voidZone = document.querySelector('.void-zone');
    const footerTitle = document.querySelector('.footer-title');
    const projectGrid = document.querySelector('.project-grid');

    if (!voidZone || !footerTitle || !projectGrid) return;

    let isUserInteracting = false;
    let interactionTimeout;
    let currentDriftDir = 0; // 0 = Idle, 1 = Down, -1 = Up

    const onUserInteract = () => {
        isUserInteracting = true;
        currentDriftDir = 0; // Break latch immediately
        clearTimeout(interactionTimeout);

        interactionTimeout = setTimeout(() => {
            isUserInteracting = false;
        }, 50);
    };

    window.addEventListener('wheel', onUserInteract, { passive: true });
    window.addEventListener('touchmove', onUserInteract, { passive: true });
    window.addEventListener('keydown', onUserInteract, { passive: true });

    function gravityLoop() {
        requestAnimationFrame(gravityLoop);

        if (isUserInteracting) return;

        const voidRect = voidZone.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const screenCenter = viewportHeight / 2;

        // --- PHASE 1: TRIGGER LATCH ---
        if (currentDriftDir === 0) {
            if (voidRect.top < screenCenter && voidRect.bottom > screenCenter) {
                const offsetFromTop = screenCenter - voidRect.top;
                const progress = offsetFromTop / voidRect.height;

                // Trigger Zone: Middle 40%
                if (progress > 0.1 && progress < 0.9) {
                    currentDriftDir = (progress < 0.5) ? 1 : -1;
                }
            }
        }

        // --- PHASE 2: EXECUTE WITH EASING ---
        if (currentDriftDir === 1) {
            // GOING DOWN -> Target: Center of Footer Title
            const footerRect = footerTitle.getBoundingClientRect();
            const footerCenter = footerRect.top + (footerRect.height / 2);

            // Distance remaining to target
            const dist = footerCenter - screenCenter;

            if (dist <= 2) {
                // Close enough to snap and stop
                currentDriftDir = 0;
            } else {
                // Easing Formula: Speed = 5% of remaining distance
                // Clamp: Minimum 2px (to finish), Maximum 60px (to prevent warping)
                const speed = Math.max(2, Math.min(dist * 0.02, 60));
                window.scrollBy(0, speed);
            }

        } else if (currentDriftDir === -1) {
            // GOING UP -> Target: Bottom of Project Grid enters view
            const projectRect = projectGrid.getBoundingClientRect();

            // We want the bottom of the grid to be roughly 50px above the bottom of the viewport
            // This creates a nice "parked" view of the projects
            const targetY = viewportHeight - 50;
            const dist = targetY - projectRect.bottom;

            if (dist <= 2) {
                currentDriftDir = 0;
            } else {
                const speed = Math.max(2, Math.min(dist * 0.02, 60));
                window.scrollBy(0, -speed);
            }
        }
    }

    gravityLoop();
}

document.addEventListener('DOMContentLoaded', initVoidGravity);
initVoidGravity();