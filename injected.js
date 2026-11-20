(() => {
  // 商店版与本地加载版同时启用时只运行一份
  if (window.__vscLoaded) return;
  window.__vscLoaded = true;

  // 设置由 content.js 写入 dataset 并通过事件推送（MAIN world 无法访问 chrome.storage）
  const cfg = JSON.parse(document.documentElement.dataset.vscSettings || '{}');
  let sec = cfg.seekSeconds || 5;
  let showT = cfg.showToast !== false;
  document.addEventListener('__vsc_update__', (e) => {
    sec = e.detail.seekSeconds;
    showT = e.detail.showToast;
  });

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

  let toastEl, toastVal, toastUnit, toastTimer;
  function showToast(delta, video) {
    if (!showT) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      Object.assign(toastEl.style, {
        position: 'fixed',
        transform: 'translate(-50%, -50%)',
        color: '#fff',
        fontSize: '26px',
        fontFamily: 'Arial, sans-serif',
        fontWeight: '500',
        lineHeight: '1',
        zIndex: '2147483647',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.25s',
        textShadow: '0 1px 3px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        webkitFontSmoothing: 'subpixel-antialiased',
      });
      toastVal = toastEl.appendChild(document.createElement('span'));
      toastUnit = toastEl.appendChild(document.createElement('span'));
      toastUnit.style.display = 'inline-block';
      toastUnit.textContent = 's';
    }
    // 单页应用可能把它移出 DOM
    if (!toastEl.isConnected) (document.body || document.documentElement).appendChild(toastEl);

    const r = video.getBoundingClientRect();
    toastEl.style.left = r.left + r.width * (delta > 0 ? 0.9 : 0.1) + 'px';
    toastEl.style.top = r.top + r.height / 2 + 'px';
    toastVal.textContent = (delta > 0 ? '+ ' : '- ') + Math.abs(delta);

    toastUnit.getAnimations().forEach((a) => a.cancel());
    toastUnit.animate([{ marginLeft: '8px' }, { marginLeft: '14px' }], { duration: 600, easing: 'ease-out', fill: 'forwards' });

    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 900);
  }

  function seek(v, delta) {
    const target = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta));
    v.currentTime = target;
    // 部分播放器会把 currentTime 夹回原位，下一帧再纠正一次
    requestAnimationFrame(() => {
      if (Math.abs(v.currentTime - target) > Math.abs(delta) / 2) v.currentTime = target;
    });
    showToast(delta, v);
  }

  function block(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  // 只拦截自己处理过的 keydown 对应的 keyup
  const handled = new Set();
  const DIR = { ArrowLeft: -1, ArrowRight: 1 };

  addEventListener('keydown', (e) => {
    if (!DIR[e.code] || e.metaKey || e.ctrlKey || e.altKey || isFocusedOnInput()) return;
    const v = getVideo();
    if (!v) return;
    handled.add(e.code);
    block(e);
    seek(v, DIR[e.code] * sec);
  }, true);

  addEventListener('keyup', (e) => {
    if (handled.delete(e.code)) block(e);
  }, true);
})();
