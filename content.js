// 把设置转交给 MAIN world 的 injected.js：dataset 供其启动时同步读取，事件用于后续更新
const DEFAULTS = { seekSeconds: 5, showToast: true };

function sync() {
  chrome.storage.sync.get(DEFAULTS, (data) => {
    document.documentElement.dataset.vscSettings = JSON.stringify(data);
    document.dispatchEvent(new CustomEvent('__vsc_update__', { detail: data }));
  });
}

sync();
chrome.storage.onChanged.addListener(sync);
