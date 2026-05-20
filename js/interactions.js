import { lerp, setCardFocus } from './state.js';

export function createInteractionController(state) {
    const cards = Array.from(document.querySelectorAll('.card')).map(createCardController);
    const magnetic = createMagneticController(document.getElementById('contactBtn'), state);

    document.querySelectorAll('a[target="_blank"]').forEach((link) => {
        link.rel = 'noopener noreferrer';
    });

    function update() {
        cards.forEach((card) => card.update(state));
        magnetic.update();
    }

    return { update };
}

function createCardController(card) {
    const visual = card.querySelector('.card-visual');
    const content = ensureLensContent(visual);
    const state = {
        hovering: false,
        targetX: 0,
        targetY: 0,
        lensX: 0,
        lensY: 0
    };

    card.addEventListener('pointerenter', () => {
        state.hovering = true;
        card.classList.add('is-focused');
        setCardFocus(true);
    });

    card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        state.targetX = x - rect.width / 2;
        state.targetY = y - rect.height / 2;
        visual.style.setProperty('--mouse-x', `${x}px`);
        visual.style.setProperty('--mouse-y', `${y}px`);
    });

    card.addEventListener('pointerleave', () => {
        state.hovering = false;
        card.classList.remove('is-focused');
        setCardFocus(false);
    });

    card.addEventListener('focusin', () => {
        card.classList.add('is-focused');
        setCardFocus(true);
    });

    card.addEventListener('focusout', () => {
        card.classList.remove('is-focused');
        setCardFocus(false);
    });

    return {
        update(appState) {
            if (!state.hovering || appState.reducedMotion) {
                state.targetX = 0;
                state.targetY = 0;
            }

            state.lensX = lerp(state.lensX, state.targetX, 0.08);
            state.lensY = lerp(state.lensY, state.targetY, 0.08);

            if (appState.reducedMotion) {
                content.style.transform = 'translate3d(0, 0, 0)';
                return;
            }

            const moveX = state.lensX * -0.12;
            const moveY = state.lensY * -0.12;
            const scale = state.hovering ? 1.025 : 1;
            content.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale(${scale})`;
        }
    };
}

function ensureLensContent(visual) {
    const existing = visual.querySelector(':scope > .lens-content');

    if (existing) {
        return existing;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'lens-content';

    while (visual.firstChild) {
        wrapper.appendChild(visual.firstChild);
    }

    visual.appendChild(wrapper);
    return wrapper;
}

function createMagneticController(button, appState) {
    const state = {
        active: false,
        targetX: 0,
        targetY: 0,
        x: 0,
        y: 0
    };

    if (!button) {
        return { update() {} };
    }

    button.addEventListener('pointerenter', () => {
        state.active = true;
    });

    button.addEventListener('pointermove', (event) => {
        const rect = button.getBoundingClientRect();
        state.targetX = (event.clientX - rect.left - rect.width / 2) * 0.24;
        state.targetY = (event.clientY - rect.top - rect.height / 2) * 0.24;
    });

    button.addEventListener('pointerleave', () => {
        state.active = false;
        state.targetX = 0;
        state.targetY = 0;
    });

    return {
        update() {
            state.x = lerp(state.x, state.active ? state.targetX : 0, 0.18);
            state.y = lerp(state.y, state.active ? state.targetY : 0, 0.18);

            if (appState.reducedMotion) {
                button.style.transform = 'translate3d(0, 0, 0)';
                return;
            }

            const scale = state.active ? 1.04 : 1;
            button.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${scale})`;
        }
    };
}
