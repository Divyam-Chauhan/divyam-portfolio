import { lerp } from './state.js';

export function createCursorController(state) {
    const pointerFine = window.matchMedia('(pointer: fine)').matches;

    if (!pointerFine || state.reducedMotion) {
        return { update() {} };
    }

    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);
    document.body.classList.add('has-custom-cursor');

    const local = {
        x: state.pointer.clientX,
        y: state.pointer.clientY,
        active: false
    };

    document.addEventListener('pointerover', (event) => {
        local.active = Boolean(event.target.closest('a, button, .card'));
        cursor.classList.toggle('is-active', local.active);
    });

    document.addEventListener('pointerout', (event) => {
        if (!event.relatedTarget || !event.relatedTarget.closest?.('a, button, .card')) {
            local.active = false;
            cursor.classList.remove('is-active');
        }
    });

    return {
        update() {
            local.x = lerp(local.x, state.pointer.clientX, 0.18);
            local.y = lerp(local.y, state.pointer.clientY, 0.18);
            cursor.style.transform = `translate3d(${local.x}px, ${local.y}px, 0) translate(-50%, -50%)`;
        }
    };
}
