(() => {
  // 商店版与本地加载版同时启用时只运行一份
  if (window.__vscLoaded) return;
  window.__vscLoaded = true;

  // 设置由 content.js 写入 dataset 并通过事件推送（MAIN world 无法访问 chrome.storage）
  let cfg = JSON.parse(document.documentElement.dataset.vscSettings || 'null')
    || { seekSeconds: 5, arrows: true };
  document.addEventListener('__vsc_update__', (e) => { cfg = e.detail; });

  function visibleArea(v) {
    const r = v.getBoundingClientRect();
    if (r.width < 120 || r.height < 120) return 0;
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (w <= 0 || h <= 0 || !v.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return 0;
    return w * h;
  }

  // 画中画优先；否则在可见视频中选正在播放的，其次面积最大的；静音循环视为背景视频
  function getVideo() {
    const pip = document.pictureInPictureElement;
    if (pip instanceof HTMLVideoElement) return pip;
    let best = null, bestPlaying = false, bestArea = 0;
    for (const v of document.querySelectorAll('video')) {
      if (v.muted && v.loop) continue;
      const area = visibleArea(v);
      if (!area) continue;
      const playing = !v.paused && v.readyState >= 2;
      if (playing > bestPlaying || (playing === bestPlaying && area > bestArea)) {
        best = v; bestPlaying = playing; bestArea = area;
      }
    }
    return best;
  }

  function isFocusedOnInput() {
    const el = document.activeElement;
    return !!el && (el.matches('input, textarea, select') || el.isContentEditable);
  }

  // 播放时测量每个视频的真实帧间隔，供逐帧使用；取最小值以排除掉帧和跳转造成的大间隔
  const tracked = new WeakSet(), frameDur = new WeakMap();
  document.addEventListener('play', (e) => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || tracked.has(v)) return;
    tracked.add(v);
    v.addEventListener('emptied', () => frameDur.delete(v));
    let last;
    v.requestVideoFrameCallback(function measure(now, m) {
      if (last && m.presentedFrames > last.presentedFrames) {
        const d = (m.mediaTime - last.mediaTime) / (m.presentedFrames - last.presentedFrames);
        if (d > 0.004 && d < (frameDur.get(v) || 0.1)) frameDur.set(v, d);
      }
      last = m;
      v.requestVideoFrameCallback(measure);
    });
  }, true);

  function fmt(t, total) {
    t = Math.max(0, Math.floor(t));
    const s = String(t % 60).padStart(2, '0');
    if (total < 3600) return Math.floor(t / 60) + ':' + s;
    return Math.floor(t / 3600) + ':' + String(Math.floor(t / 60) % 60).padStart(2, '0') + ':' + s;
  }

  let toastEl, toastVal, toastUnit, toastTime, toastTimer;
  function showToast(v, pos, text, unit, time) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      Object.assign(toastEl.style, {
        position: 'fixed',
        transform: 'translate(-50%, -50%)',
        color: '#fff',
        fontFamily: 'Arial, sans-serif',
        fontWeight: '500',
        lineHeight: '1',
        textAlign: 'center',
        zIndex: '2147483647',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.25s',
        textShadow: '0 1px 3px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        webkitFontSmoothing: 'subpixel-antialiased',
      });
      const row = toastEl.appendChild(document.createElement('div'));
      row.style.fontSize = '26px';
      toastVal = row.appendChild(document.createElement('span'));
      toastUnit = row.appendChild(document.createElement('span'));
      toastUnit.style.display = 'inline-block';
      toastTime = toastEl.appendChild(document.createElement('div'));
      Object.assign(toastTime.style, { fontSize: '14px', marginTop: '8px', opacity: '0.85' });
    }
    // 单页应用可能把它移出 DOM
    if (!toastEl.isConnected) (document.body || document.documentElement).appendChild(toastEl);

    const r = v.getBoundingClientRect();
    toastEl.style.left = r.left + r.width * { left: 0.1, center: 0.5, right: 0.9 }[pos] + 'px';
    toastEl.style.top = r.top + r.height / 2 + 'px';
    toastVal.textContent = text;
    toastUnit.textContent = unit;
    const showTime = isFinite(v.duration);
    toastTime.style.display = showTime ? '' : 'none';
    if (showTime) toastTime.textContent = fmt(time, v.duration) + ' / ' + fmt(v.duration, v.duration);

    toastUnit.getAnimations().forEach((a) => a.cancel());
    if (unit) toastUnit.animate([{ marginLeft: '8px' }, { marginLeft: '14px' }], { duration: 600, easing: 'ease-out', fill: 'forwards' });

    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 900);
  }

  function seekTo(v, target) {
    target = Math.max(0, Math.min(v.duration || Infinity, target));
    const delta = target - v.currentTime;
    v.currentTime = target;
    // 部分播放器会把 currentTime 夹回原位，下一帧再纠正一次
    requestAnimationFrame(() => {
      if (Math.abs(v.currentTime - target) > Math.max(Math.abs(delta) / 2, 0.5)) v.currentTime = target;
    });
    return target;
  }

  let lastTime = 0;
  function arrow(v, dir, repeat) {
    const now = performance.now();
    if (repeat && !cfg.frameMode && now - lastTime < 160) return; // 按住时每秒最多跳约 6 次，避免画面来不及加载
    lastTime = now;
    const step = cfg.frameMode ? frameDur.get(v) || 1 / 30 : cfg.seekSeconds;
    const target = seekTo(v, v.currentTime + dir * step);
    showToast(v, dir > 0 ? 'right' : 'left', (dir > 0 ? '+ ' : '- ') + (cfg.frameMode ? 1 : cfg.seekSeconds), cfg.frameMode ? cfg.frameUnit : 's', target);
  }

  function block(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  // 只拦截自己处理过的 keydown 对应的 keyup
  const handled = new Set();
  const DIR = { ArrowLeft: -1, ArrowRight: 1 };

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isFocusedOnInput()) return;
    const dir = DIR[e.code];
    const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    const kind = dir && cfg.arrows ? 'arrow'
      : digit && cfg.digits && !e.shiftKey ? 'digit'
      : e.code === 'Space' && cfg.space && !e.shiftKey ? 'space'
      : null;
    if (!kind) return;
    const v = getVideo();
    if (!v || (kind === 'digit' && !isFinite(v.duration))) return;
    handled.add(e.code);
    block(e);
    if (kind === 'arrow') return arrow(v, dir, e.repeat);
    if (e.repeat) return;
    if (kind === 'digit') {
      const n = +digit[1];
      showToast(v, 'center', String(n * 10), '%', seekTo(v, (v.duration * n) / 10));
    } else {
      if (v.paused) v.play().catch(() => {});
      else v.pause();
      showToast(v, 'center', v.paused ? '❚❚' : '▶', '', v.currentTime);
    }
  }, true);

  addEventListener('keyup', (e) => {
    if (handled.delete(e.code)) block(e);
  }, true);
})();
