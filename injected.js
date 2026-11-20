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

  var MIN_SIZE = 120; // 小于这个尺寸的视频（缩略图预览、小图标动画）不接管

  // 视频在当前视口内可见的面积；不可见返回 0
  function visibleArea(v) {
    var r = v.getBoundingClientRect();
    if (r.width < MIN_SIZE || r.height < MIN_SIZE) return 0;
    var w = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
    var h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    if (w <= 0 || h <= 0) return 0;
    var cs = getComputedStyle(v);
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return 0;
    return w * h;
  }

  // 选出要控制的视频：
  // 1. 画中画中的视频优先（它可能不在页面可视区域内）
  // 2. 只考虑可见且足够大的视频，排除静音循环的背景视频
  // 3. 正在播放的优先，其次可见面积最大的
  // 没有符合条件的视频时返回 null，方向键交还给网页
  function getVideo() {
    var pip = document.pictureInPictureElement;
    if (pip && pip.tagName === 'VIDEO') return pip;

    var best = null, bestPlaying = false, bestArea = 0;
    document.querySelectorAll('video').forEach(function (v) {
      if (v.muted && v.loop) return; // 背景装饰视频的典型特征
      var area = visibleArea(v);
      if (!area) return;
      var playing = !v.paused && v.readyState >= 2;
      if (!best || (playing && !bestPlaying) || (playing === bestPlaying && area > bestArea)) {
        best = v; bestPlaying = playing; bestArea = area;
      }
    });
    return best;
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

    // 单页应用切换页面时可能把提示元素从 DOM 中移除，此时重新挂载
    if (toastEl && !toastEl.isConnected) {
      (document.body || document.documentElement).appendChild(toastEl);
    }

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
      (document.body || document.documentElement).appendChild(toastEl);
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
  function seek(v, delta) {
    var target = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta));
    v.currentTime = target;
    // 部分播放器会把 currentTime 夹回原位，下一帧渲染前再强制纠正一次
    requestAnimationFrame(function () {
      if (Math.abs(v.currentTime - target) > Math.abs(delta) * 0.5) v.currentTime = target;
    });
    showToast(delta, v);
  }

  // 记录哪些按键的 keydown 被本插件处理了，对应的 keyup 才拦截
  var handledKeys = {};

  function block(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  // 监听 keydown（capture 阶段）：拦截方向键，阻止页面原生处理
  window.addEventListener('keydown', function (e) {
    if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
    // 带 Cmd / Ctrl / Alt 的组合键属于浏览器或系统快捷键（如 Cmd+← 返回上一页），不处理
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isFocusedOnInput()) return;
    var v = getVideo();
    if (!v) return;
    handledKeys[e.code] = true;
    block(e);
    seek(v, e.code === 'ArrowRight' ? sec : -sec);
  }, true);

  // 监听 keyup：只拦截被本插件处理过的按键，防止页面在抬起时触发自己的逻辑；
  // 其余情况（输入框内、组合键、无视频）原样放行
  window.addEventListener('keyup', function (e) {
    if (!handledKeys[e.code]) return;
    delete handledKeys[e.code];
    block(e);
  }, true);
})();
