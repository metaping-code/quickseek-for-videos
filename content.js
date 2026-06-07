(function () {
  const DEFAULTS = { seekSeconds: 5, showToast: true };

  // 把设置写入 DOM attribute，让 injected.js 可以同步读取（无需等待 storage 回调）
  document.documentElement.dataset.vscSettings = JSON.stringify(DEFAULTS);

  // 从 storage 读取真实设置后推送给 injected.js，后续变更同步相同
  function syncSettings(data) {
    document.documentElement.dataset.vscSettings = JSON.stringify(data);
    document.dispatchEvent(new CustomEvent('__vsc_update__', { detail: data }));
  }

  chrome.storage.sync.get(DEFAULTS, syncSettings);
  chrome.storage.onChanged.addListener(function () {
    chrome.storage.sync.get(DEFAULTS, syncSettings);
  });
})();
