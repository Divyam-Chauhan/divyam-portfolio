import { clamp, lerp, setChapterProgress, setScrollMetrics, setSection } from './state.js';

const CHAPTERS = [
    { name: 'hero', selector: '.hero-section' },
    { name: 'identity', selector: '.identity-section' },
    { name: 'capabilities', selector: '.capabilities-section' },
    { name: 'archive', selector: '.archive-section' },
    { name: 'lab', selector: '.lab-section' },
    { name: 'footer', selector: '.footer-section' }
];

export function createScrollController(state) {
    const progressBar = document.querySelector('.scroll-progress__bar');
    const titleChars = splitFooterTitle();
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const Lenis = window.Lenis;
    let lenis = null;
    let cleanupAnimations = null;
    let nativeHandler = null;

    setSection('hero');

    if (!state.reducedMotion && gsap && ScrollTrigger && Lenis) {
        gsap.registerPlugin(ScrollTrigger);

        lenis = new Lenis({
            anchors: true,
            lerp: 0.06,
            smoothWheel: true,
            wheelMultiplier: 0.5
        });

        lenis.on('scroll', (event) => {
            ScrollTrigger.update();
            setScrollMetrics({
                progress: event.progress,
                velocity: event.velocity
            });
            updateProgress(progressBar, event.progress);
            updateSceneTargets(state);
        });

        cleanupAnimations = initScrollAnimations({ state, gsap, ScrollTrigger, titleChars });
        updateSceneTargets(state);
    } else {
        nativeHandler = () => updateNativeScrollState(state, progressBar);
        window.addEventListener('scroll', nativeHandler, { passive: true });
        updateNativeScrollState(state, progressBar);
        revealStaticContent(titleChars);
    }

    return {
        refresh() {
            ScrollTrigger?.refresh?.();
            lenis?.resize?.();
        },
        update(time) {
            lenis?.raf(time);
        },
        scrollTo(target, options = {}) {
            if (!target) return;

            if (lenis) {
                lenis.scrollTo(target, {
                    immediate: options.immediate ?? false,
                    force: true
                });
            } else {
                target.scrollIntoView({ block: 'start' });
            }

            ScrollTrigger?.refresh?.();
            ScrollTrigger?.update?.();
        },
        destroy() {
            cleanupAnimations?.();
            lenis?.destroy?.();
            if (nativeHandler) {
                window.removeEventListener('scroll', nativeHandler);
            }
        }
    };
}

function initScrollAnimations({ state, gsap, ScrollTrigger, titleChars }) {
    gsap.fromTo('.overlay h1', { autoAlpha: 0, y: 42 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: 'power3.out' });
    gsap.fromTo('.overlay p', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.1, delay: 0.2, ease: 'power3.out' });
    gsap.fromTo('.hero-proof span', { autoAlpha: 0, x: 18 }, { autoAlpha: 1, x: 0, duration: 0.9, stagger: 0.08, delay: 0.45, ease: 'power3.out' });

    const setHeroSkew = gsap.quickSetter('.overlay h1', 'skewY', 'deg');
    const updateHeroSkew = () => {
        const targetSkew = clamp(state.scrollVelocity * -0.016, -4.5, 4.5);
        state.kineticSkew = lerp(state.kineticSkew, targetSkew, 0.16);
        setHeroSkew(state.kineticSkew);
    };
    gsap.ticker.add(updateHeroSkew);

    gsap.timeline({
        scrollTrigger: {
            trigger: '.hero-section',
            start: '35% top',
            end: 'bottom top',
            scrub: true
        }
    })
        .to('.overlay', { autoAlpha: 0, y: -90, scale: 0.92, ease: 'none' }, 0)
        .to('.hero-proof', { autoAlpha: 0, y: -60, ease: 'none' }, 0)
        .to('.scroll-indicator', { autoAlpha: 0, y: -40, ease: 'none' }, 0);

    gsap.set('.identity-heading, .identity-thesis, .interest-pill, .identity-copy p, .prime-line, .identity-map, .chapter-heading, .capability-line, .archive-intro, .card, .lab-heading, .lab-note', {
        autoAlpha: 0,
        y: 46
    });

    revealOnEnter(gsap, ScrollTrigger, '.identity-heading, .identity-thesis, .interest-pill, .identity-copy p, .prime-line, .identity-map', '.identity-section', 0.08);
    revealOnEnter(gsap, ScrollTrigger, '.chapter-heading', '.capabilities-section', 0);

    ScrollTrigger.batch('.capability-line', {
        start: 'top 82%',
        once: true,
        onEnter: (batch) => revealBatch(gsap, batch, 0.1)
    });

    revealOnEnter(gsap, ScrollTrigger, '.archive-intro', '.archive-section', 0);

    ScrollTrigger.batch('.card', {
        start: 'top 84%',
        once: true,
        onEnter: (batch) => revealBatch(gsap, batch, 0.12)
    });

    revealOnEnter(gsap, ScrollTrigger, '.lab-heading', '.lab-section', 0);

    ScrollTrigger.batch('.lab-note', {
        start: 'top 84%',
        once: true,
        onEnter: (batch) => revealBatch(gsap, batch, 0.12)
    });

    initChapterProgress({ state, ScrollTrigger });

    if (titleChars.length) {
        gsap.set(titleChars, { autoAlpha: 0, y: 34, rotateX: -45 });
        gsap.to(titleChars, {
            autoAlpha: 1,
            y: 0,
            rotateX: 0,
            duration: 0.8,
            stagger: 0.025,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.footer-section',
                start: 'top 62%',
                once: true
            }
        });
    }

    ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: ({ progress }) => updateProgress(document.querySelector('.scroll-progress__bar'), progress)
    });

    return () => gsap.ticker.remove(updateHeroSkew);
}

function revealOnEnter(gsap, ScrollTrigger, targets, trigger, stagger) {
    gsap.to(targets, {
        autoAlpha: 1,
        y: 0,
        duration: 0.85,
        stagger,
        ease: 'power3.out',
        scrollTrigger: {
            trigger,
            start: 'top 72%',
            once: true
        }
    });
}

function revealBatch(gsap, batch, stagger) {
    gsap.to(batch, {
        autoAlpha: 1,
        y: 0,
        duration: 0.85,
        stagger,
        ease: 'power3.out',
        overwrite: true
    });
}

function initChapterProgress({ state, ScrollTrigger }) {
    CHAPTERS.forEach(({ name, selector }) => {
        ScrollTrigger.create({
            trigger: selector,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            onUpdate: ({ progress }) => {
                setChapterProgress(name, progress);
                updateSceneTargets(state);
            }
        });

        ScrollTrigger.create({
            trigger: selector,
            start: 'top 52%',
            end: 'bottom 52%',
            onEnter: () => setSection(name),
            onEnterBack: () => setSection(name)
        });
    });
}

function updateNativeScrollState(state, progressBar) {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = window.scrollY / maxScroll;
    let active = 'hero';

    setScrollMetrics({ progress, velocity: 0 });
    updateProgress(progressBar, progress);

    CHAPTERS.forEach(({ name, selector }) => {
        const section = document.querySelector(selector);
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const chapterProgress = clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1);
        setChapterProgress(name, chapterProgress);

        if (rect.top <= window.innerHeight * 0.52 && rect.bottom >= window.innerHeight * 0.52) {
            active = name;
        }
    });

    setSection(active);
    updateSceneTargets(state);
}

function updateSceneTargets(state) {
    const hero = bell(state.heroProgress);
    const identity = bell(state.identityProgress);
    const capabilities = bell(state.capabilitiesProgress);
    const archive = bell(state.archiveProgress);
    const lab = bell(state.labProgress);
    const footer = bell(state.footerProgress);

    state.monolithProgress = state.footerProgress;
    state.ambientBlurTarget = state.reducedMotion ? 0 : Math.max(archive * 0.001, footer * 0.0025);
    state.blueLightTarget = 3.6 + hero * 1.6 + capabilities * 2.2 + lab * 1.2 - archive * 1.3;
    state.warmLightTarget = identity * 2.2 + lab * 3.4 + footer * 7.5;
}

function bell(progress) {
    return Math.sin(clamp(progress, 0, 1) * Math.PI);
}

function updateProgress(bar, progress) {
    if (!bar) return;
    bar.style.transform = `scaleY(${clamp(progress, 0, 1)})`;
}

function splitFooterTitle() {
    const title = document.querySelector('.footer-title');

    if (!title || title.querySelector('.char')) {
        return [];
    }

    const lines = title.innerHTML.split(/<br\s*\/?>/i).map((line) => line.replace(/<[^>]+>/g, '').trim());
    const label = lines.join(' ');
    title.setAttribute('aria-label', label);
    title.innerHTML = lines.map((line) => {
        return line
            .split('')
            .map((char) => `<span class="char" aria-hidden="true">${char === ' ' ? '&nbsp;' : char}</span>`)
            .join('');
    }).join('<br>');

    return Array.from(title.querySelectorAll('.char'));
}

function revealStaticContent(chars) {
    document.querySelectorAll('.identity-heading, .identity-thesis, .interest-pill, .identity-copy p, .prime-line, .identity-map, .chapter-heading, .capability-line, .archive-intro, .card, .lab-heading, .lab-note').forEach((element) => {
        element.style.opacity = '1';
        element.style.transform = 'translate3d(0, 0, 0)';
    });

    chars.forEach((char) => {
        char.style.opacity = '1';
        char.style.transform = 'translate3d(0, 0, 0)';
    });
}
