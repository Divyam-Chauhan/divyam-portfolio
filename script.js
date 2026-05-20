import { AppState, setPointerFromEvent, setPointerInactive } from './js/state.js';
import { createCursorController } from './js/cursor.js';
import { createInteractionController } from './js/interactions.js';
import { createSceneController } from './js/scene.js';
import { createScrollController } from './js/scroll.js';

document.addEventListener('pointermove', setPointerFromEvent, { passive: true });
document.addEventListener('pointerleave', setPointerInactive, { passive: true });

const scene = createSceneController(AppState);
const interactions = createInteractionController(AppState);
const cursor = createCursorController(AppState);
const scroll = createScrollController(AppState);

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
