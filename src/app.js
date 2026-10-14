import { initializeChart } from './chart.js';
import { initializeBooking } from './booking.js';

if (document.querySelector('#hero-art')) {
  history.scrollRestoration = 'manual';
  const startAtTop = () => {
    if (!location.hash || location.hash === '#top') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  };
  startAtTop();
  window.addEventListener('pageshow', startAtTop);
}

const intro = document.querySelector('#brand-intro');
if (intro && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let seen = false;
  try { seen = localStorage.getItem('wdi-intro-seen') === '1'; } catch {}
  if (!seen) {
    intro.hidden = false;
    document.documentElement.dataset.introActive = 'true';
    document.body.classList.add('intro-active');
    const content = [...document.querySelectorAll('body > header, body > main, body > footer')];
    content.forEach(element => { element.inert = true; });
    let finished = false;
    function finishIntro() {
      if (finished) return;
      finished = true;
      intro.hidden = true;
      delete document.documentElement.dataset.introActive;
      document.body.classList.remove('intro-active');
      content.forEach(element => { element.inert = false; });
      try { localStorage.setItem('wdi-intro-seen', '1'); } catch {}
      document.dispatchEvent(new Event('wdi:intro-complete'));
    }
    document.querySelector('#skip-intro').addEventListener('click', finishIntro);
    setTimeout(finishIntro, 2000);
  }
}

if (document.querySelector('#hero-art')) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = document.querySelector('#motion-toggle');
  const word = document.querySelector('#typed-word');
  const phrases = ['for AI data.', 'for training.', 'for live AI.'];
  let paused = reduced.matches;
  let heroVisible = true;
  let timer;
  let phrase = 0;
  let length = 0;
  let deleting = false;

  function schedule(delay) {
    clearTimeout(timer);
    if (!paused && !document.hidden && heroVisible && !document.documentElement.dataset.introActive) timer = setTimeout(typeNext, delay);
  }
  function typeNext() {
    const text = phrases[phrase];
    length += deleting ? -1 : 1;
    word.textContent = text.slice(0, length);
    if (!deleting && length === text.length) {
      deleting = true;
      schedule(4800);
    } else if (deleting && length === 0) {
      deleting = false;
      phrase = (phrase + 1) % phrases.length;
      schedule(220);
    } else {
      schedule(deleting ? 32 : 75);
    }
  }
  function updateMotion() {
    document.body.classList.toggle('motion-paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Play animations' : 'Pause animations');
    document.dispatchEvent(new CustomEvent('wdi:motion', { detail: { paused } }));
    clearTimeout(timer);
    // Pausing leaves a complete readable headline, including reduced-motion users.
    if (paused) {
      word.textContent = phrases[0];
      phrase = 0;
      length = phrases[0].length;
      deleting = true;
    } else {
      schedule(length === phrases[phrase].length ? 4800 : 300);
    }
  }
  if (!paused) word.textContent = '';
  updateMotion();
  reduced.addEventListener('change', event => { paused = event.matches; updateMotion(); });
  motionButton.addEventListener('click', () => { paused = !paused; updateMotion(); });
  document.addEventListener('visibilitychange', () => schedule(500));
  document.addEventListener('wdi:intro-complete', () => schedule(250));
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    schedule(length === phrases[phrase].length ? 4800 : 300);
  }).observe(document.querySelector('.hero'));

  const scene = document.querySelector('#hardware-scene');
  const art = document.querySelector('#hero-art');
  art.addEventListener('pointermove', event => {
    if (paused || event.pointerType !== 'mouse') return;
    const bounds = art.getBoundingClientRect();
    scene.style.setProperty('--turn-x', `${(event.clientY - bounds.top) / bounds.height * -4 + 2}deg`);
    scene.style.setProperty('--turn-y', `${(event.clientX - bounds.left) / bounds.width * 6 - 3}deg`);
  });
  art.addEventListener('pointerleave', () => {
    scene.style.setProperty('--turn-x', '0deg');
    scene.style.setProperty('--turn-y', '0deg');
  });
  document.body.classList.add('motion-ready');
  const reveal = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.dataset.visible = 'true';
        reveal.unobserve(entry.target);
      }
    });
  }, { threshold: .15 });
  reveal.observe(document.querySelector('.operation'));
  document.querySelectorAll('[data-reveal]').forEach(element => reveal.observe(element));
  document.querySelector('#method-toggle').addEventListener('click', event => {
    const button = event.currentTarget;
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    document.querySelector('#method-details').hidden = expanded;
  });
  initializeChart();
}
initializeBooking();
