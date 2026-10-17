/* Yaozi: emerge → gather → shimmer → explode and fall. Vanilla JS / Canvas 2D. */
(() => {
  'use strict';

  const COLORS = ['#ff496f', '#ff7797', '#ffc4d2', '#ffdda0', '#fff0cf'];
  const HOLD_START = 3.3;
  const BURST = 5.1;
  const DURATION = 8;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const random = (lo, hi) => lo + Math.random() * (hi - lo);
  let active = null;

  function play({ onComplete = () => {}, content = null } = {}) {
    if (active) active.cancel();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previousFocus = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;
    const previousInert = content?.inert;
    const english = document.documentElement.lang.startsWith('en');
    const layer = document.createElement('div');
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', english ? 'Yaozi intro animation' : 'Yaozi 开屏动画');
    layer.dataset.yaoziIntro = '';
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;overflow:hidden;opacity:1;';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = english ? 'Skip' : '跳过';
    skip.setAttribute('aria-label', english ? 'Skip intro animation' : '跳过开屏动画');
    skip.style.cssText = 'all:initial;box-sizing:border-box;position:absolute;right:max(20px,env(safe-area-inset-right));top:max(20px,env(safe-area-inset-top));border:1px solid #ffffff30;border-radius:24px;padding:8px 17px;color:#e4c8c2;background:#0008;font:13px sans-serif;cursor:pointer;';
    skip.addEventListener('focus', () => { skip.style.outline = '2px solid #ffdda0'; });
    skip.addEventListener('blur', () => { skip.style.outline = ''; });
    layer.append(canvas, skip);
    document.body.append(layer);
    document.documentElement.style.overflow = 'hidden';
    if (content) content.inert = true;
    skip.focus({ preventScroll: true });

    const ctx = canvas.getContext('2d', { alpha: false });
    let width, height, scale, textWidth, textHeight, particles = [], sprites = [];
    let frame = 0, time = 0, last = null, finished = false;
    const pointer = { x: 0, y: 0 };
    const camera = { x: 0, y: 0 };

    function finish(notify = true) {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', visibility);
      layer.remove();
      document.documentElement.style.overflow = previousOverflow;
      if (content) content.inert = previousInert;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      active = null;
      if (notify) onComplete();
    }

    const controller = { cancel: () => finish(false), skip: () => finish() };
    active = controller;
    skip.addEventListener('click', () => finish());
    function keydown(event) {
      if (event.key === 'Escape') finish();
      // The intro has exactly one interactive element.
      if (event.key === 'Tab') { event.preventDefault(); skip.focus(); }
    }
    function visibility() {
      cancelAnimationFrame(frame);
      last = null;
      if (!document.hidden && !finished) frame = requestAnimationFrame(tick);
    }
    layer.addEventListener('pointermove', event => {
      pointer.x = (event.clientX / width - 0.5) * 2;
      pointer.y = (event.clientY / height - 0.5) * 2;
    });
    layer.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });

    function makeSprites() {
      sprites = COLORS.map(color => {
        const sprite = document.createElement('canvas');
        sprite.width = sprite.height = 48;
        const s = sprite.getContext('2d');
        const glow = s.createRadialGradient(24, 24, 0, 24, 24, 24);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.08, '#fff4e6');
        glow.addColorStop(0.22, color + 'eb');
        glow.addColorStop(0.48, color + '45');
        glow.addColorStop(1, color + '00');
        s.fillStyle = glow;
        s.fillRect(0, 0, 48, 48);
        return sprite;
      });
    }

    function makeParticles() {
      // Rasterize locally installed type once; each bright mask pixel becomes a target.
      const mask = document.createElement('canvas');
      mask.width = 1000; mask.height = 360;
      const m = mask.getContext('2d', { willReadFrequently: true });
      m.font = 'bold 280px "Trebuchet MS", Arial, sans-serif';
      m.textAlign = 'center'; m.textBaseline = 'alphabetic';
      m.fillStyle = '#fff'; m.fillText('Yaozi', 500, 282);
      const pixels = m.getImageData(0, 0, 1000, 360).data;
      let points = [], minX = 1000, maxX = 0, minY = 360, maxY = 0;
      for (let y = 0; y < 360; y += 4) {
        for (let x = 0; x < 1000; x += 4) {
          if (pixels[(y * 1000 + x) * 4 + 3] < 140) continue;
          points.push([x, y]);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
      // Random sampling avoids a visible pixel grid and caps per-frame rendering cost.
      for (let i = points.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [points[i], points[j]] = [points[j], points[i]];
      }
      points = points.slice(0, width < 600 ? 1700 : 2800);
      textWidth = maxX - minX; textHeight = maxY - minY;
      scale = Math.min(width * 0.79 / textWidth, height * 0.32 / textHeight, 1.45);
      const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
      particles = points.map(([x, y]) => {
        const angle = random(0, Math.PI * 2), depth = random(-1, 1);
        const speed = random(120, 330) * scale;
        return {
          x: random(-width * 0.46, width * 0.46),
          y: random(-height * 0.4, height * 0.4),
          z: random(-70, 70),
          vx: random(-5, 5) * scale,
          vy: random(-7, -2) * scale,
          vz: random(-3, 3) * scale,
          burstX: Math.cos(angle) * speed * Math.sqrt(1 - depth * depth),
          burstY: Math.sin(angle) * speed * Math.sqrt(1 - depth * depth) - 65 * scale,
          burstZ: depth * speed * 0.75,
          released: false,
          tx: (x - midX + random(-1.6, 1.6)) * scale,
          ty: (y - midY + random(-1.6, 1.6)) * scale,
          tz: random(-8, 8) * scale,
          appear: random(0.06, 1.05), gather: random(1.35, 1.7),
          release: BURST + random(0, 0.12),
          life: random(7.1, 7.55), size: random(4.5, 9),
          color: Math.floor(random(0, COLORS.length)), phase: random(0, Math.PI * 2),
          twinkle: random(15, 29)
        };
      });
      if (reduced) {
        for (const p of particles) { p.x = p.tx; p.y = p.ty; p.z = p.tz; }
      }
    }

    function resize() {
      const oldScale = scale;
      width = window.innerWidth; height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
      if (!particles.length) makeParticles();
      else {
        // Preserve phase and positions through orientation / viewport changes.
        scale = Math.min(width * 0.79 / textWidth, height * 0.32 / textHeight, 1.45);
        const ratio = scale / oldScale;
        for (const p of particles) {
          for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'tx', 'ty', 'tz', 'burstX', 'burstY', 'burstZ']) p[key] *= ratio;
        }
      }
    }

    function step(dt) {
      camera.x += (pointer.x - camera.x) * Math.min(1, dt * 3);
      camera.y += (pointer.y - camera.y) * Math.min(1, dt * 3);
      for (const p of particles) {
        if (time > p.life) continue;
        if (time < p.gather) {
          // Quiet drift while individual sparks brighten out of the black canvas.
          p.vx += Math.sin(time * 1.2 + p.phase) * scale * dt;
        } else if (time < p.release) {
          const holding = time > HOLD_START;
          const k = holding ? 46 : 30;
          const damping = Math.exp(-(holding ? 11 : 7) * dt);
          const shimmer = holding ? Math.sin(time * 3 + p.phase) * 0.35 * scale : 0;
          p.vx = (p.vx + (p.tx - p.x) * k * dt) * damping;
          p.vy = (p.vy + (p.ty + shimmer - p.y) * k * dt) * damping;
          p.vz = (p.vz + (p.tz - p.z) * k * dt) * damping;
        } else {
          if (!p.released) {
            // Explode each point from its position in the completed word, once.
            p.vx = p.burstX; p.vy = p.burstY; p.vz = p.burstZ;
            p.released = true;
          }
          const damping = Math.exp(-0.6 * dt);
          p.vx = (p.vx + Math.sin(p.phase) * 7 * scale * dt) * damping;
          p.vy = (p.vy + 310 * scale * dt) * damping;
          p.vz *= damping;
        }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      }
    }

    function render(dt) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      // Frame-rate independent persistence produces silk-like spark trails.
      ctx.fillStyle = reduced ? '#000' : `rgba(0,0,0,${1 - Math.exp(-dt * 11)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      const originX = width / 2, originY = height * 0.47;
      const yaw = reduced ? 0 : camera.x * 0.04 + Math.sin(time * 0.65) * 0.012;
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      for (const p of particles) {
        const emerge = clamp((time - p.appear) / 0.8);
        const fade = reduced ? 0.85 : emerge * emerge * (3 - 2 * emerge) * clamp((p.life - time) / 1.45);
        if (fade <= 0) continue;
        const z = p.z * cos - p.x * sin;
        const perspective = 1000 / Math.max(600, 1000 + z);
        const x = originX + (p.x * cos + p.z * sin) * perspective;
        const y = originY + (p.y + camera.y * z * 0.035) * perspective;
        const twinkle = reduced ? 0.8 : 0.66 + Math.sin(time * p.twinkle + p.phase) * 0.24;
        const size = p.size * Math.max(0.65, Math.sqrt(scale)) * perspective;
        const burstLight = reduced ? 1 : 1 + 0.5 * Math.exp(-Math.max(0, time - p.release) * 10) * Number(p.released);
        ctx.globalAlpha = Math.min(1, fade * twinkle * burstLight);
        ctx.drawImage(sprites[p.color], x - size / 2, y - size / 2, size, size);
        // A few fine star glints belong to the letter particles themselves.
        if (!reduced && time > HOLD_START && time < p.release && Math.sin(time * 8 + p.phase) > 0.996) {
          ctx.strokeStyle = COLORS[p.color]; ctx.globalAlpha = fade * 0.65;
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
          ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      layer.style.opacity = reduced ? '1' : String(clamp((DURATION - time) / 0.45));
    }

    function tick(now) {
      if (finished) return;
      const elapsed = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      // Small substeps keep the spring stable on slower displays.
      let remaining = elapsed;
      while (remaining > 0) {
        const dt = Math.min(remaining, 1 / 120);
        time += dt;
        if (!reduced) step(dt);
        remaining -= dt;
      }
      render(Math.max(elapsed, 1 / 120));
      if (time >= (reduced ? 1 : DURATION)) { finish(); return; }
      frame = requestAnimationFrame(tick);
    }

    if (!ctx) { finish(); return controller; }
    try {
      makeSprites(); resize();
      window.addEventListener('resize', resize);
      window.addEventListener('keydown', keydown);
      document.addEventListener('visibilitychange', visibility);
      frame = requestAnimationFrame(tick);
    } catch (error) {
      finish();
      console.error('Yaozi intro:', error);
    }
    return controller;
  }

  // Do not replay the opening when the visitor returns to the homepage from
  // another page of this site, or arrives through browser back / forward.
  function returningFromPage() {
    try {
      if (performance.getEntriesByType?.('navigation')[0]?.type === 'back_forward') return true;
      if (!document.referrer) return false;
      const source = new URL(document.referrer);
      if (source.origin !== location.origin) return false;
      const normalize = path => path.replace(/\/index\.html$/, '/');
      return normalize(source.pathname) !== normalize(location.pathname);
    } catch { return false; }
  }

  window.YaoziIntro = Object.freeze({ play });
  if (document.currentScript?.hasAttribute('data-auto') && !returningFromPage()) {
    play({ content: document.querySelector('.page') });
  }
})();
