export const AppState = {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    pointer: {
        active: false,
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 2,
        x: 0,
        y: 0
    },
    scrollVelocity: 0,
    scrollProgress: 0,
    currentSection: 'hero',
    cameraTargetZ: 15,
    monolithProgress: 0,
    targetShapeSpeed: 1,
    currentShapeSpeed: 1,
    focusBlurTarget: 0,
    ambientBlurTarget: 0,
    currentBlur: 0,
    blueLightTarget: 5,
    warmLightTarget: 0,
    kineticSkew: 0,
    focusCount: 0
};

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

motionQuery.addEventListener?.('change', (event) => {
    AppState.reducedMotion = event.matches;
    if (event.matches) {
        AppState.targetShapeSpeed = 0.35;
        AppState.focusBlurTarget = 0;
        AppState.ambientBlurTarget = 0;
    }
});

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function lerp(current, target, amount) {
    return current + (target - current) * amount;
}

export function setPointerFromEvent(event) {
    AppState.pointer.active = true;
    AppState.pointer.clientX = event.clientX;
    AppState.pointer.clientY = event.clientY;
    AppState.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    AppState.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

export function setPointerInactive() {
    AppState.pointer.active = false;
}

export function setCardFocus(isFocused) {
    AppState.focusCount = Math.max(0, AppState.focusCount + (isFocused ? 1 : -1));
    const active = AppState.focusCount > 0;

    AppState.targetShapeSpeed = active ? 0.15 : 1;
    AppState.focusBlurTarget = active && !AppState.reducedMotion ? 0.007 : 0;
    document.body.classList.toggle('is-card-focused', active);
}

export function setScrollMetrics({ progress, velocity }) {
    if (Number.isFinite(progress)) {
        AppState.scrollProgress = clamp(progress, 0, 1);
    }

    if (Number.isFinite(velocity)) {
        AppState.scrollVelocity = velocity;
    }
}

export function setSection(section) {
    AppState.currentSection = section;
    document.body.dataset.section = section;
}

export function smoothState() {
    const blurTarget = AppState.reducedMotion ? 0 : Math.max(AppState.focusBlurTarget, AppState.ambientBlurTarget);
    const speedTarget = AppState.reducedMotion ? 0.25 : AppState.targetShapeSpeed;

    AppState.currentShapeSpeed = lerp(AppState.currentShapeSpeed, speedTarget, 0.055);
    AppState.currentBlur = lerp(AppState.currentBlur, blurTarget, 0.075);
    AppState.kineticSkew = lerp(AppState.kineticSkew, 0, 0.08);
}
