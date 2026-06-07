(function () {
  // 防止重复加载
  if (window.__vscLoaded) return;
  window.__vscLoaded = true;

  // 从 DOM attribute 同步读取初始设置（无需等待 storage 回调）
  var cfg = JSON.parse(document.documentElement.dataset.vscSettings || '{}');
  var sec = cfg.seekSeconds || 5;
  var showT = cfg.showToast !== false;

  // 监听 content.js 推送的设置变更，实时更新
  document.addEventListener('__vsc_update__', function (e) {
    sec = e.detail.seekSeconds;
    showT = e.detail.showToast;
  });

  // 优先选正在播放且已就绪的 video，其次已就绪的，最后兜底取第一个
  function getVideo() {
    var vids = Array.from(document.querySelectorAll('video'));
    return vids.find(function (v) { return !v.paused && v.readyState >= 2; })
      || vids.find(function (v) { return v.readyState >= 2; })
      || vids[0] || null;
  }

  // 判断焦点是否在输入框内，是则方向键不触发跳转
  function isFocusedOnInput() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName.toLowerCase();
    return ['input', 'textarea', 'select'].includes(tag) || el.isContentEditable;
  }

  // 提示文字：第一次调用时创建元素，后续复用
  var toastEl = null, toastUnit = null, toastTimer = null;
  function showToast(delta, video) {
    if (!showT) return;

    if (!toastEl) {
      toastEl = document.createElement('div');
      Object.assign(toastEl.style, {
        position:      'fixed',
        transform:     'translate(-50%, -50%)',
        color:         '#fff',
        fontSize:      '26px',
        fontFamily:    'Arial, sans-serif',
        fontWeight:    '500',
        lineHeight:    '1',
        zIndex:        '2147483647',
        pointerEvents: 'none',
        opacity:       '0',
        transition:    'opacity 0.25s',
        textShadow:    '0 1px 3px rgba(0,0,0,0.3)',
        whiteSpace:    'nowrap',
        webkitFontSmoothing: 'subpixel-antialiased',
      });

      var valEl = document.createElement('span');
      toastUnit = document.createElement('span');
      toastUnit.style.display = 'inline-block';
      toastEl.appendChild(valEl);
      toastEl.appendChild(toastUnit);
      document.body.appendChild(toastEl);
    }

    if (video) {
      var rect = video.getBoundingClientRect();
      toastEl.style.left = (delta > 0
        ? rect.left + rect.width * 0.90
        : rect.left + rect.width * 0.10) + 'px';
      toastEl.style.top  = (rect.top + rect.height * 0.5) + 'px';
    }

    toastEl.firstChild.textContent = (delta > 0 ? '+ ' : '- ') + Math.abs(delta);
    toastUnit.textContent = 's';

    // 每次按键重启动画，s 向右弹开
    toastUnit.getAnimations().forEach(function (a) { a.cancel(); });
    toastUnit.animate(
      [{ marginLeft: '8px' }, { marginLeft: '14px' }],
      { duration: 600, easing: 'ease-out', fill: 'forwards' }
    );

    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, 900);
  }

  // 执行跳转：计算目标时间，写入 currentTime，显示提示
  function seek(delta) {
    var v = getVideo();
    if (!v) return;
    var target = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta));
    v.currentTime = target;
    // 部分播放器会把 currentTime 夹回原位，下一帧渲染前再强制纠正一次
    requestAnimationFrame(function () {
      if (Math.abs(v.currentTime - target) > Math.abs(delta) * 0.5) v.currentTime = target;
    });
    showToast(delta, v);
  }

  // 监听 keydown（capture 阶段）：拦截方向键，阻止页面原生处理
  window.addEventListener('keydown', function (e) {
    if (isFocusedOnInput()) return;
    if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
    if (!getVideo()) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    seek(e.code === 'ArrowRight' ? sec : -sec);
  }, true);

  // 监听 keyup：同样拦截方向键，防止页面在抬起时触发自己的逻辑
  window.addEventListener('keyup', function (e) {
    if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
    if (!getVideo()) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, true);
})();
