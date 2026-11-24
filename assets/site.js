(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const make = (tag, cls, props = {}) => Object.assign(document.createElement(tag), { className: cls }, props);
  const assets = new URL('.', document.currentScript.src).href;

  /* Language: remember the choice, close the list on an outside click */
  $$('.langs a').forEach(a => a.addEventListener('click', () => { try { localStorage.setItem('lang', a.hreflang); } catch { /* storage is blocked: nothing to remember */ } }));
  const list = $('.lang');
  if (list) document.addEventListener('click', e => { if (!list.contains(e.target)) list.open = false; });

  /* Live moles: a still picture at first; the animation comes after the visitor's first move and only where it is seen */
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;
  const wakers = ['pointermove', 'pointerdown', 'scroll', 'keydown'];
  const liven = () => {
    wakers.forEach(w => removeEventListener(w, liven));
    const seen = new IntersectionObserver(es => es.filter(e => e.isIntersecting).forEach(({ target }) => {
      seen.unobserve(target);
      const live = new Image(); live.src = target.dataset.live;
      live.decode().then(() => { target.removeAttribute('srcset'); target.src = live.src; }, () => { /* not loaded: the still picture stays */ });
    }));
    $$('[data-live]').forEach(i => seen.observe(i));
  };
  if (!calm) wakers.forEach(w => addEventListener(w, liven, { passive: true }));

  /* Theme: the <head> script has set the starting one */
  const theme = $('#theme'), page = document.documentElement;
  theme.addEventListener('click', () => {
    const next = page.dataset.theme === 'dark' ? 'light' : 'dark';
    const system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    page.dataset.theme = next;
    /* Back to the device's theme means following it again */
    try { if (next === system) localStorage.removeItem('theme'); else localStorage.setItem('theme', next); } catch { /* storage is blocked: the choice lasts until the page closes */ }
  });

  /* Wardrobe */
  $$('.hat').forEach(b => b.addEventListener('click', () => {
    $$('.hat').forEach(o => o.setAttribute('aria-pressed', o === b));
    const next = $('#worn').cloneNode(); next.src = `${assets}costume-${b.dataset.id}.webp`; $('#worn').replaceWith(next);
  }));

  /* Board: level 3 of the campaign, played with the game's own controls */
  const board = $('#board');
  if (board) {
    const T = JSON.parse($('#texts').textContent);
    const fill = (text, ...args) => text.replace(/\{(\d)\}/g, (_, i) => args[i]);
    const REGIONS = [[3,3,3,1,1],[2,3,3,1,1],[2,2,0,0,1],[2,2,0,0,1],[2,2,0,4,1]], SOLUTION = [1,4,2,0,3], DOUBLE_TAP = 400, TRY = 3;
    const say = $('#say'), all = [...Array(25).keys()], row = i => Math.floor(i / 5), col = i => i % 5, bed = i => REGIONS[row(i)][col(i)];
    const near = (a, b) => Math.abs(row(a) - row(b)) < 2 && Math.abs(col(a) - col(b)) < 2;
    const broken = (a, b) => a === b ? null : row(a) === row(b) ? 'row' : col(a) === col(b) ? 'column' : bed(a) === bed(b) ? 'region' : near(a, b) ? 'touching' : null;
    const at = r => r * 5 + SOLUTION[r];
    const around = i => i !== at(1) && near(i, at(1)), cross4 = i => row(i) === 4 || col(i) === 3, bed0 = i => bed(i) === 0;
    const DEMOS = [
      { mole: at(4), lit: cross4, cross: cross4 },
      { mole: at(2), lit: bed0, cross: bed0 },
      { mole: at(1), lit: i => i === at(1) || around(i), cross: around },
    ];
    let play = all.map(() => 'empty'), step = 0, last = { i: -1, t: 0 };
    const tap = i => {
      if (step !== TRY) return;
      const now = performance.now(), second = last.i === i && now - last.t < DOUBLE_TAP;
      play[i] = second ? 'mole' : play[i] === 'empty' ? 'cross' : 'empty';
      last = second ? { i: -1, t: 0 } : { i, t: now };
      draw();
    };
    const tiles = all.map(i => {
      const t = make('button', 'tile', { type: 'button', id: 'tile-' + i });
      t.style.setProperty('--c', `var(--bed-${bed(i)})`); t.style.setProperty('--i', i);
      t.onclick = () => tap(i);
      board.append(t); return t;
    });
    function show(i, state, lit, bad) {
      const t = tiles[i], has = t.firstChild;
      t.classList.toggle('lit', lit); t.classList.toggle('cross', state === 'cross'); t.classList.toggle('bad', bad);
      if (state === 'mole' && !has) t.append(make('img', '', { src: assets + 'mole-tile.webp', alt: '' }));
      if (state !== 'mole' && has) has.remove();
      t.tabIndex = step === TRY ? 0 : -1;
      t.setAttribute('aria-label', fill(T.cell, row(i) + 1, col(i) + 1, T.states[state], T.beds[bed(i)]));
    }
    function draw() {
      const demo = DEMOS[step], won = !demo && all.every(i => (play[i] === 'mole') === (SOLUTION[row(i)] === col(i)));
      board.classList.toggle('demo', !!demo); board.classList.toggle('won', won);
      say.replaceChildren();
      if (demo) {
        all.forEach(i => show(i, demo.mole === i ? 'mole' : demo.cross(i) ? 'cross' : 'empty', demo.lit(i), false));
        say.append(T.demos[step]); return;
      }
      const moles = all.filter(i => play[i] === 'mole'), rule = i => moles.map(m => broken(i, m)).find(Boolean);
      all.forEach(i => show(i, play[i], true, play[i] === 'mole' && !!rule(i)));
      const error = moles.map(rule).find(Boolean);
      say.append(won ? T.won : error ? T[error] : fill(T.found, moles.length, 5));
      if (moles.length || play.includes('cross')) {
        const again = make('button', 'btn small plain', { type: 'button', textContent: won ? T.again : T.clear });
        again.onclick = () => { play = all.map(() => 'empty'); draw(); }; say.append(again);
      }
    }
    const steps = $$('.step'), margin = matchMedia('(max-width: 900px)').matches ? '-76% 0px -23% 0px' : '-55% 0px -44% 0px';
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      step = +e.target.dataset.step; steps.forEach(s => s.classList.toggle('off', s !== e.target)); draw();
    }), { rootMargin: margin });
    steps.forEach(s => io.observe(s)); draw();
  }

  /* Parallax: an element is at its natural place when centred on screen (hero: when the page is at the top) */
  const dig = $('#dig'), depth = $('#depth'), hero = $('[data-scene="top"]');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const docTop = el => { let y = 0; for (; el; el = el.offsetParent) y += el.offsetTop; return y; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const layers = $$('[data-y],[data-x],[data-m]').map(el => ({ el, y: +el.dataset.y || 0, x: +el.dataset.x || 0, m: +el.dataset.m || 0, hero: !!hero && hero.contains(el), c: 0, h: 0, near: false, was: '' }));
  const risers = $$('.riser').map(el => ({ el, c: 0, near: false, was: '' }));
  let vh = innerHeight, reach = 1, digTop = 0, digH = 1, pos = scrollY, aim = scrollY, px = 0, py = 0, tx = 0, ty = 0, busy = false, metresWas = -1;
  /* Only what moves on screen gets its own layer and a style write */
  function move(item, near, translate) {
    if (item.near !== near) { item.near = near; item.el.style.willChange = near ? 'translate' : ''; }
    if (near && item.was !== translate) { item.was = translate; item.el.style.translate = translate; }
  }
  function measure() {
    vh = innerHeight; reach = Math.min(1, innerWidth / 1300) ** 2;
    layers.forEach(l => { l.h = l.el.offsetHeight; l.c = docTop(l.el) + l.h / 2; });
    risers.forEach(r => { r.c = docTop(r.el.parentNode) + r.el.parentNode.offsetHeight / 2; });
    if (dig) { digTop = docTop(dig); digH = dig.offsetHeight; }
    paint();
  }
  function paint() {
    const mid = pos + vh / 2;
    if (dig) {
      const metres = Math.round(clamp((mid - digTop) / (digH - vh / 2), 0, 1) * 40);
      if (metres !== metresWas) { metresWas = metres; depth.textContent = `${metres ? '−' : ''}${metres} m`; }
    }
    if (still.matches) return;
    layers.forEach(l => {
      const d = l.hero ? pos : mid - l.c;
      const near = l.hero ? pos < vh * 1.4 : Math.abs(d) < vh * 1.1 + l.h / 2;
      move(l, near, near ? `${(d * l.x + px * l.m * reach).toFixed(1)}px ${(d * l.y + py * l.m * .5 * reach).toFixed(1)}px` : '');
    });
    risers.forEach(r => move(r, Math.abs(r.c - mid) < vh, `0 ${(clamp((r.c - mid) / vh - .08, 0, .5) * 90).toFixed(1)}%`));
    if (hero && pos < vh * 1.4) { hero.style.setProperty('--px', px.toFixed(3)); hero.style.setProperty('--py', py.toFixed(3)); }
  }
  function tick() {
    pos += (aim - pos) * .16; px += (tx - px) * .08; py += (ty - py) * .08;
    const done = Math.abs(aim - pos) < .3 && Math.abs(tx - px) + Math.abs(ty - py) < .002;
    if (done) pos = aim;
    paint(); busy = !done; if (busy) requestAnimationFrame(tick);
  }
  const wake = () => { if (!busy) { busy = true; requestAnimationFrame(tick); } };
  addEventListener('scroll', () => { aim = scrollY; wake(); }, { passive: true });
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && scrollY < vh * 1.4) { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / vh * 2 - 1; wake(); } }, { passive: true });
  /* The observer runs right after layout: reading positions there does not force another one */
  new ResizeObserver(measure).observe($('.frame'));
  addEventListener('resize', () => requestAnimationFrame(measure));
})();
