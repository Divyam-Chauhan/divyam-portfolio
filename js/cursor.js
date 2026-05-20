import { lerp } from './state.js';

export function createCursorController(state) {
    const pointerFine = window.matchMedia('(pointer: fine)').matches;

    if (!pointerFine || state.reducedMotion || window.innerWidth < 768) {
        return { update() {} };
    }

    // Create outer ring container
    const ring = document.createElement('div');
    ring.className = 'custom-cursor-ring';
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);

    // Create inner dot
    const dot = document.createElement('div');
    dot.className = 'custom-cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);

    document.body.classList.add('has-custom-cursor');

    const current = {
        x: state.pointer.clientX,
        y: state.pointer.clientY,
        scale: 1,
        angle: 0,
        stretch: 1
    };

    const target = {
        x: state.pointer.clientX,
        y: state.pointer.clientY,
        scale: 1,
        prevX: state.pointer.clientX,
        prevY: state.pointer.clientY
    };

    let isHovered = false;
    let snapTarget = null;

    document.addEventListener('pointerover', (event) => {
        const interactive = event.target.closest('a, button, .card');
        if (interactive) {
            isHovered = true;
            ring.classList.add('is-active');
            dot.classList.add('is-active');
            
            // Magnetic snap: snap to center of specific interactive elements
            if (interactive.matches('a, button')) {
                snapTarget = interactive;
            }
        }
    });

    document.addEventListener('pointerout', (event) => {
        if (!event.relatedTarget || !event.relatedTarget.closest?.('a, button, .card')) {
            isHovered = false;
            snapTarget = null;
            ring.classList.remove('is-active');
            dot.classList.remove('is-active');
        }
    });

    return {
        update() {
            let targetX = state.pointer.clientX;
            let targetY = state.pointer.clientY;

            if (snapTarget) {
                const rect = snapTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                // snaps ring closer to center, but allows subtle physical offset
                targetX = lerp(centerX, state.pointer.clientX, 0.28);
                targetY = lerp(centerY, state.pointer.clientY, 0.28);
            }

            // Snappy inner dot tracking
            current.x = lerp(current.x, targetX, 0.35);
            current.y = lerp(current.y, targetY, 0.35);
            dot.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) translate(-50%, -50%)`;

            // Calculate velocity for organic ring deformation
            const dx = state.pointer.clientX - target.prevX;
            const dy = state.pointer.clientY - target.prevY;
            const speed = Math.min(Math.sqrt(dx * dx + dy * dy), 90);

            target.prevX = state.pointer.clientX;
            target.prevY = state.pointer.clientY;

            // Fluid ring tracking (slower for beautiful organic delay)
            const ringX = lerp(current.x, targetX, 0.22);
            const ringY = lerp(current.y, targetY, 0.22);

            // Calculate stretch parameters based on velocity
            const targetStretch = 1 + (speed * 0.0075);
            const targetScale = isHovered ? 1.6 : 1;
            
            current.stretch = lerp(current.stretch, targetStretch, 0.12);
            current.scale = lerp(current.scale, targetScale, 0.14);

            if (speed > 4) {
                current.angle = Math.atan2(dy, dx) * (180 / Math.PI);
            }

            // Apply fluid liquid transformation to outer ring
            ring.style.transform = `
                translate3d(${ringX}px, ${ringY}px, 0) 
                translate(-50%, -50%) 
                rotate(${current.angle}deg) 
                scaleX(${current.stretch * current.scale}) 
                scaleY(${(2 - current.stretch) * current.scale})
            `;
        }
    };
}
