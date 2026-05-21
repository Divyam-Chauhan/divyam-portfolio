import { AppState, lerp, setPointerFromEvent, setPointerInactive, setPointerDown } from './js/state.js';
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

const governedMotionSelector = [
    '.scroll-indicator',
    '.identity-orbit',
    '.map-node',
    '.status-dot',
    '.pulse-ring'
].join(', ');

function createCssMotionController(state) {
    if (!document.getAnimations) {
        return { update() {}, refresh() {} };
    }

    const motion = {
        rate: state.reducedMotion ? 0.08 : 1,
        frames: 0,
        animations: []
    };

    document.body.classList.add('has-motion-governor');

    function refresh() {
        motion.animations = document.getAnimations().filter((animation) => {
            const target = animation.effect?.target;
            return target?.matches?.(governedMotionSelector);
        });

        motion.animations.forEach((animation) => {
            animation.playbackRate = motion.rate;
        });
    }

    refresh();

    return {
        update() {
            if (motion.frames % 90 === 0) {
                refresh();
            }
            motion.frames += 1;

            const targetRate = state.reducedMotion ? 0.08 : (state.pointer.down ? 0.12 : 1);
            motion.rate = lerp(motion.rate, targetRate, 0.08);

            motion.animations.forEach((animation) => {
                animation.playbackRate = motion.rate;
            });
        },
        refresh
    };
}

const scene = createSceneController(AppState);
const interactions = createInteractionController(AppState);
const cursor = createCursorController(AppState);
const scroll = createScrollController(AppState);
const cssMotion = createCssMotionController(AppState);

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
    cssMotion.update();
    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

window.addEventListener('resize', () => {
    scene.resize();
    scroll.refresh();
    cssMotion.refresh();
});

window.addEventListener('pagehide', () => {
    scroll.destroy();
});
