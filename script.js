import { AppState, clamp, lerp, setPointerFromEvent, setPointerInactive, setPointerDown } from './js/state.js';
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

            const targetRate = state.reducedMotion ? 0.08 : (state.pointer.down ? 0.08 : 1);
            const rateEase = targetRate < motion.rate ? 0.18 : 0.08;
            motion.rate = lerp(motion.rate, targetRate, rateEase);

            motion.animations.forEach((animation) => {
                animation.playbackRate = motion.rate;
            });
        },
        refresh
    };
}

function createAudioController(state) {
    const button = document.getElementById('audioToggle');
    const audio = document.getElementById('siteAudio');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const startAt = 26;
    const normalRate = 1;
    const slowRate = 0.4;

    if (!button || !audio || !AudioContextClass) {
        button?.setAttribute('disabled', '');
        return { update() {} };
    }

    const sourceUrl = new URL(audio.getAttribute('src'), window.location.href).href;
    const controller = {
        context: null,
        gain: null,
        buffer: null,
        bufferPromise: null,
        source: null,
        isPlaying: false,
        requested: false,
        rate: normalRate,
        offset: startAt,
        lastContextTime: 0
    };

    audio.removeAttribute('src');
    audio.load();

    window.setTimeout(() => {
        loadBuffer().catch(() => {
            controller.bufferPromise = null;
        });
    }, 350);

    button.addEventListener('click', () => {
        if (controller.requested) {
            return;
        }

        if (!controller.isPlaying) {
            playAudio();
        } else {
            pauseAudio();
        }
    });

    function setPlayingUi() {
        controller.isPlaying = true;
        button.classList.add('is-playing');
        button.setAttribute('aria-label', 'Pause soundtrack');
        button.setAttribute('aria-pressed', 'true');
        button.title = 'Pause soundtrack';
    }

    function setPausedUi() {
        controller.isPlaying = false;
        button.classList.remove('is-playing');
        button.setAttribute('aria-label', 'Play soundtrack');
        button.setAttribute('aria-pressed', 'false');
        button.title = 'Play soundtrack';
    }

    async function playAudio() {
        controller.requested = true;
        button.classList.add('is-loading');

        try {
            const context = ensureContext();
            await context.resume();
            const buffer = await loadBuffer();
            startSource(buffer);
            setPlayingUi();
        } catch {
            stopSource();
            controller.offset = startAt;
            setPausedUi();
        } finally {
            controller.requested = false;
            button.classList.remove('is-loading');
        }
    }

    function pauseAudio() {
        syncOffset();
        stopSource();
        setPausedUi();
    }

    function ensureContext() {
        if (!controller.context) {
            controller.context = new AudioContextClass();
            controller.gain = controller.context.createGain();
            controller.gain.gain.value = 0.68;
            controller.gain.connect(controller.context.destination);
        }

        return controller.context;
    }

    function loadBuffer() {
        if (controller.buffer) {
            return Promise.resolve(controller.buffer);
        }

        if (!controller.bufferPromise) {
            const context = ensureContext();
            controller.bufferPromise = fetch(sourceUrl)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error('Audio file failed to load.');
                    }

                    return response.arrayBuffer();
                })
                .then((data) => context.decodeAudioData(data))
                .then((buffer) => {
                    controller.buffer = buffer;
                    return buffer;
                })
                .catch((error) => {
                    controller.bufferPromise = null;
                    throw error;
                });
        }

        return controller.bufferPromise;
    }

    function startSource(buffer) {
        stopSource();

        const source = controller.context.createBufferSource();
        const maxOffset = Math.max(0, buffer.duration - 0.05);
        const offset = clamp(controller.offset, 0, maxOffset);

        source.buffer = buffer;
        source.playbackRate.value = controller.rate;
        source.connect(controller.gain);
        source.addEventListener('ended', () => {
            if (controller.source !== source) {
                return;
            }

            controller.source = null;
            controller.offset = startAt;
            controller.rate = normalRate;
            setPausedUi();
        });

        controller.source = source;
        controller.offset = offset;
        controller.lastContextTime = controller.context.currentTime;
        source.start(0, offset);
    }

    function stopSource() {
        const source = controller.source;
        controller.source = null;

        if (!source) {
            return;
        }

        source.disconnect();

        try {
            source.stop();
        } catch {
            // The source may already have stopped naturally.
        }
    }

    function syncOffset() {
        if (!controller.isPlaying || !controller.context) {
            return;
        }

        const now = controller.context.currentTime;
        const delta = Math.max(0, now - controller.lastContextTime);
        controller.offset += delta * controller.rate;
        controller.lastContextTime = now;
    }

    return {
        update() {
            if (!controller.isPlaying) {
                return;
            }

            syncOffset();

            const targetRate = state.reducedMotion ? normalRate : (state.pointer.down ? slowRate : normalRate);
            const rateEase = targetRate < controller.rate ? 0.18 : 0.08;
            controller.rate = lerp(controller.rate, targetRate, rateEase);

            if (controller.source) {
                controller.source.playbackRate.value = controller.rate;
            }
        }
    };
}

const scene = createSceneController(AppState);
const interactions = createInteractionController(AppState);
const scroll = createScrollController(AppState);
const cssMotion = createCssMotionController(AppState);
const audio = createAudioController(AppState);

function restoreHashTarget(attempt = 0) {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('chapter') || (window.location.hash ? window.location.hash.slice(1) : '');
    const target = targetId ? document.getElementById(targetId) : null;

    if (target) {
        scroll.scrollTo(target, { immediate: true });

        if (attempt < 2) {
            window.setTimeout(() => restoreHashTarget(attempt + 1), 120);
        }
    }
}

requestAnimationFrame(() => restoreHashTarget());

function tick(time) {
    scroll.update(time);
    scene.update(time);
    interactions.update();
    cssMotion.update();
    audio.update();
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

const cursor = document.querySelector('.custom-cursor');

if (cursor && window.gsap) {
    window.gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    const xTo = window.gsap.quickTo(cursor, "x", { duration: 0.15, ease: "power3" });
    const yTo = window.gsap.quickTo(cursor, "y", { duration: 0.15, ease: "power3" });

    document.addEventListener('mousemove', (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
    });
} else if (cursor) {
    document.addEventListener('mousemove', (e) => {
        cursor.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;
    });
}

const interactables = document.querySelectorAll('a, button, .project-card, .card');

interactables.forEach((el) => {
    el.addEventListener('mouseenter', () => {
        cursor?.classList.add('active');
    });
    
    el.addEventListener('mouseleave', () => {
        cursor?.classList.remove('active');
    });
});
