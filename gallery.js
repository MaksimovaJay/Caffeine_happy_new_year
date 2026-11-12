/*
  Галереи и полноэкранный просмотр — так же, как на основном сайте.
  Фото для каждого раздела берутся из photos.js по data-key у <div class="gallery">.
*/
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const isDesktop = matchMedia('(hover: hover) and (pointer: fine)');
  const isVideo = (src) => /\.(mp4|webm|mov)$/i.test(src);

  /* ---------- Видео: грузим и играем только когда видно ---------- */

  const videoIO = new IntersectionObserver((entries) => {
    entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.5 });

  function makeVideo(src, inViewer) {
    const v = el('video');
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'none';
    if (inViewer) {
      v.controls = true;
      v.src = src;
    } else {
      v.dataset.src = src;
      videoIO.observe(v);
    }
    return v;
  }

  /* ---------- Галерея ---------- */

  function buildGallery(wrap, items, label) {
    const stage = el('div', 'gallery__stage');
    const track = el('div', 'gallery__track');

    items.forEach((src, i) => {
      const slide = el('figure', 'slide');
      if (isVideo(src)) {
        slide.classList.add('slide--video');
        slide.append(makeVideo(src, false));
      } else {
        const img = el('img');
        img.src = src;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = `${label} - фото ${i + 1}`;
        slide.append(img);
      }
      slide.addEventListener('click', () => openViewer(items, i));
      track.append(slide);
    });

    const prev = el('button', 'gallery__arrow gallery__arrow--prev');
    const next = el('button', 'gallery__arrow gallery__arrow--next');
    prev.setAttribute('aria-label', 'Предыдущее фото');
    next.setAttribute('aria-label', 'Следующее фото');

    const slides = [...track.children];
    const step = () => (slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth);
    const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;

    // Полоса прокрутки
    const bar = el('div', 'gallery__bar');
    const thumb = el('div', 'gallery__thumb');
    bar.append(thumb);
    const maxScroll = () => track.scrollWidth - track.clientWidth;

    const update = () => {
      const start = track.scrollLeft < 4;
      const end = atEnd();
      prev.hidden = start;
      next.hidden = end;
      wrap.classList.toggle('is-start', start);
      wrap.classList.toggle('is-end', end);

      const ratio = track.clientWidth / track.scrollWidth;
      bar.hidden = ratio >= 0.999;
      const pos = maxScroll() ? track.scrollLeft / maxScroll() : 0;
      thumb.style.width = ratio * 100 + '%';
      thumb.style.left = pos * (1 - ratio) * 100 + '%';
    };

    // Тянуть за полосу (мышью или пальцем)
    thumb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      thumb.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startScroll = track.scrollLeft;
      const k = maxScroll() / (bar.clientWidth - thumb.offsetWidth);
      track.style.scrollSnapType = 'none';
      wrap.classList.add('is-dragging');
      const move = (ev) => { track.scrollLeft = startScroll + (ev.clientX - startX) * k; };
      const up = () => {
        thumb.removeEventListener('pointermove', move);
        thumb.removeEventListener('pointerup', up);
        thumb.removeEventListener('pointercancel', up);
        track.style.scrollSnapType = '';
        wrap.classList.remove('is-dragging');
      };
      thumb.addEventListener('pointermove', move);
      thumb.addEventListener('pointerup', up);
      thumb.addEventListener('pointercancel', up);
    });
    // Нажатие по полосе - прыжок в это место
    bar.addEventListener('pointerdown', (e) => {
      if (e.target === thumb) return;
      const r = bar.getBoundingClientRect();
      const tw = thumb.offsetWidth;
      const pos = Math.min(1, Math.max(0, (e.clientX - r.left - tw / 2) / (r.width - tw)));
      track.scrollTo({ left: pos * maxScroll(), behavior: 'smooth' });
    });

    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    window.addEventListener('resize', update);
    requestAnimationFrame(update);

    stage.append(track, prev, next);
    wrap.append(stage, bar);
  }

  /* ---------- Полноэкранный просмотр ---------- */

  const viewer = $('#viewer');
  const vTrack = $('#viewer-track');
  const vCounter = $('#viewer-counter');
  const vPrev = $('#viewer-prev');
  const vNext = $('#viewer-next');

  function openViewer(items, start) {
    vTrack.innerHTML = '';
    items.forEach((src) => {
      const f = el('figure', 'viewer__slide');
      if (isVideo(src)) {
        f.append(makeVideo(src, true));
      } else {
        const img = el('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        // на компьютере нажатие по фото - закрыть просмотр (на телефоне - свайп)
        img.addEventListener('click', () => { if (isDesktop.matches) closeViewer(); });
        f.append(img);
      }
      vTrack.append(f);
    });
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    vTrack.scrollLeft = start * vTrack.clientWidth;
    updateViewer();
  }

  function closeViewer() {
    vTrack.innerHTML = '';
    vTrack.style.transform = '';
    viewer.style.backgroundColor = '';
    viewer.hidden = true;
    document.body.style.overflow = '';
  }

  // Свайп вверх или вниз на телефоне - закрыть просмотр
  let touch = null;
  vTrack.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, dy: 0 };
    vTrack.style.transition = 'none';
  }, { passive: true });
  vTrack.addEventListener('touchmove', (e) => {
    if (!touch) return;
    touch.dx = e.touches[0].clientX - touch.x;
    touch.dy = e.touches[0].clientY - touch.y;
    if (Math.abs(touch.dy) > Math.abs(touch.dx)) {
      vTrack.style.transform = `translateY(${touch.dy}px)`;
      viewer.style.backgroundColor = `rgba(11, 10, 16, ${Math.max(0.3, 1 - Math.abs(touch.dy) / 400)})`;
    }
  }, { passive: true });
  vTrack.addEventListener('touchend', () => {
    if (!touch) return;
    const { dx, dy } = touch;
    touch = null;
    if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx)) {
      closeViewer();
      return;
    }
    vTrack.style.transition = 'transform 0.2s';
    vTrack.style.transform = '';
    viewer.style.backgroundColor = '';
  });

  function updateViewer() {
    const slides = vTrack.children;
    const n = slides.length;
    const i = Math.round(vTrack.scrollLeft / vTrack.clientWidth);
    vCounter.textContent = n > 1 ? `${i + 1} / ${n}` : '';
    vPrev.hidden = i <= 0;
    vNext.hidden = i >= n - 1;
    // видео играет только на текущем слайде
    [...slides].forEach((s, k) => {
      const v = s.querySelector('video');
      if (v) k === i ? v.play().catch(() => {}) : v.pause();
    });
  }

  const viewerGo = (dir) => {
    vTrack.scrollBy({ left: dir * vTrack.clientWidth, behavior: 'smooth' });
  };
  vPrev.addEventListener('click', () => viewerGo(-1));
  vNext.addEventListener('click', () => viewerGo(1));

  vTrack.addEventListener('scroll', () => requestAnimationFrame(updateViewer), { passive: true });
  $('#viewer-close').addEventListener('click', closeViewer);
  vTrack.addEventListener('click', (e) => { if (e.target === vTrack || e.target.classList.contains('viewer__slide')) closeViewer(); });
  document.addEventListener('keydown', (e) => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowRight') viewerGo(1);
    if (e.key === 'ArrowLeft') viewerGo(-1);
  });

  /* ---------- Сборка ---------- */

  document.querySelectorAll('.gallery[data-key]').forEach((wrap) => {
    const items = (window.PHOTOS || {})[wrap.dataset.key] || [];
    if (items.length) buildGallery(wrap, items, wrap.dataset.label || '');
  });
})();
