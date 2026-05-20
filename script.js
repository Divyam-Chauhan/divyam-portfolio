import { AppState, setPointerFromEvent, setPointerInactive, setPointerDown } from './js/state.js';
import { createCursorController } from './js/cursor.js';
import { createInteractionController } from './js/interactions.js';
import { createSceneController } from './js/scene.js';
import { createScrollController } from './js/scroll.js';

function handlePointerDown(event) {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) {
        return;
    }

    setPointerFromEvent(event);
    setPointerDown(true);
}

function handlePointerEnd(event) {
    if (event?.isPrimary === false) {
        return;
    }

    setPointerDown(false);
}

document.addEventListener('pointermove', setPointerFromEvent, { passive: true });
document.addEventListener('pointerleave', setPointerInactive, { passive: true });
document.addEventListener('pointerdown', handlePointerDown, { passive: true });
window.addEventListener('pointerup', handlePointerEnd, { passive: true });
window.addEventListener('pointercancel', handlePointerEnd, { passive: true });
window.addEventListener('blur', handlePointerEnd);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        setPointerDown(false);
    }
});

const scene = createSceneController(AppState);
const interactions = createInteractionController(AppState);
const cursor = createCursorController(AppState);
const scroll = createScrollController(AppState);

function restoreHashTarget(attempt = 0) {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('chapter') || (window.location.hash ? window.location.hash.slice(1) : '');
    const target = targetId ? document.getElementById(targetId) : null;

    if (target) {
        scroll.scrollTo(target);

        if (attempt < 2) {
            window.setTimeout(() => restoreHashTarget(attempt + 1), 120);
        }
    }
}

requestAnimationFrame(() => restoreHashTarget());

function tick(time) {
    scene.update(time);
    interactions.update();
    cursor.update();
    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

window.addEventListener('resize', () => {
    scene.resize();
    scroll.refresh();
});

window.addEventListener('pagehide', () => {
    scroll.destroy();
});
