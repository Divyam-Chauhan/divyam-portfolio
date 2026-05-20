import { clamp, lerp, setScrollMetrics, setSection } from './state.js';

export function createScrollController(state) {
    const progressBar = document.querySelector('.scroll-progress__bar');
    const titleChars = splitFooterTitle();
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const Lenis = window.Lenis;
    let lenis = null;
    let cleanupTicker = null;
    let nativeHandler = null;

    if (!state.reducedMotion && gsap && ScrollTrigger && Lenis) {
        gsap.registerPlugin(ScrollTrigger);

        lenis = new Lenis({
            anchors: true,
            lerp: 0.08,
            smoothWheel: true,
            wheelMultiplier: 0.9
        });

        lenis.on('scroll', (event) => {
            ScrollTrigger.update();
            setScrollMetrics({
                progress: event.progress,
                velocity: event.velocity
            });
            updateProgress(progressBar, event.progress);
        });

        const ticker = (time) => {
            lenis.raf(time * 1000);
        };

        gsap.ticker.add(ticker);
        gsap.ticker.lagSmoothing(0);
        cleanupTicker = () => gsap.ticker.remove(ticker);

        initScrollAnimations({ state, gsap, ScrollTrigger, titleChars });
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
        destroy() {
            cleanupTicker?.();
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

    const setHeroSkew = gsap.quickSetter('.overlay h1', 'skewY', 'deg');
    gsap.ticker.add(() => {
        const targetSkew = clamp(state.scrollVelocity * -0.016, -4.5, 4.5);
        state.kineticSkew = lerp(state.kineticSkew, targetSkew, 0.16);
        setHeroSkew(state.kineticSkew);
    });

    gsap.set('.card', { autoAlpha: 0, y: 46 });
    ScrollTrigger.batch('.card', {
        start: 'top 86%',
        once: true,
        onEnter: (batch) => {
            gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.85,
                stagger: 0.12,
                ease: 'power3.out',
                overwrite: true
            });
        }
    });

    ScrollTrigger.create({
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: () => {
            setSection('hero');
            state.ambientBlurTarget = 0;
            state.monolithProgress = 0;
        }
    });

    ScrollTrigger.create({
        trigger: '.content-section',
        start: 'top bottom',
        end: 'top 15%',
        scrub: 1,
        onEnter: () => setSection('archive'),
        onEnterBack: () => setSection('archive'),
        onLeaveBack: () => setSection('hero'),
        onUpdate: () => {
            state.monolithProgress = 0;
            state.ambientBlurTarget = 0;
            state.blueLightTarget = 5;
            state.warmLightTarget = 0;
        }
    });

    ScrollTrigger.create({
        trigger: '.footer-section',
        start: 'top bottom',
        end: 'center center',
        scrub: 1.2,
        onEnter: () => setSection('footer'),
        onEnterBack: () => setSection('footer'),
        onLeaveBack: () => setSection('archive'),
        onUpdate: ({ progress }) => {
            state.monolithProgress = progress;
            state.ambientBlurTarget = progress * 0.0025;
            state.blueLightTarget = 4 + progress * 2.4;
            state.warmLightTarget = progress * 7.5;
        }
    });

    if (titleChars.length) {
        gsap.set(titleChars, { autoAlpha: 0, y: 34, rotateX: -45 });
        gsap.to(titleChars, {
            autoAlpha: 1,
            y: 0,
            rotateX: 0,
            duration: 0.8,
            stagger: 0.035,
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
}

function updateNativeScrollState(state, progressBar) {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = window.scrollY / maxScroll;
    const content = document.querySelector('.content-section');
    const footer = document.querySelector('.footer-section');
    const contentTop = content?.offsetTop || window.innerHeight;
    const footerTop = footer?.offsetTop || maxScroll;

    setScrollMetrics({ progress, velocity: 0 });
    updateProgress(progressBar, progress);

    if (window.scrollY >= footerTop - window.innerHeight) {
        const footerProgress = clamp((window.scrollY - (footerTop - window.innerHeight)) / window.innerHeight, 0, 1);
        setSection('footer');
        state.monolithProgress = footerProgress;
        state.ambientBlurTarget = footerProgress * 0.0025;
        return;
    }

    if (window.scrollY >= contentTop - window.innerHeight * 0.7) {
        setSection('archive');
        state.monolithProgress = 0;
        state.ambientBlurTarget = 0;
        return;
    }

    setSection('hero');
    state.monolithProgress = 0;
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
    document.querySelectorAll('.card').forEach((card) => {
        card.style.opacity = '1';
        card.style.transform = 'translate3d(0, 0, 0)';
    });

    chars.forEach((char) => {
        char.style.opacity = '1';
        char.style.transform = 'translate3d(0, 0, 0)';
    });
}
