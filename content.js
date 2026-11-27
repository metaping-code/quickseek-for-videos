// 把当前网站生效的设置转交给 MAIN world 的 injected.js：dataset 供其启动时同步读取，事件用于后续更新

// iframe 内按最外层网页的域名应用网站设置
function topHost() {
  const o = location.ancestorOrigins;
  try { return new URL(o[o.length - 1]).hostname; } catch { return location.hostname; }
}
const host = siteKey(topHost());

function sync() {
  chrome.storage.sync.get(DEFAULTS, (d) => {
    const site = d.sites[host] || {};
    const cfg = {
      seekSeconds: d.seekSeconds,
      frameMode: d.frameMode,
      frameUnit: chrome.i18n.getMessage('frameUnit'),
    };
    for (const f of FEATURES) cfg[f] = site.enabled !== false && site[f] !== false;
    document.documentElement.dataset.vscSettings = JSON.stringify(cfg);
    document.dispatchEvent(new CustomEvent('__vsc_update__', { detail: cfg }));
  });
}

sync();
chrome.storage.onChanged.addListener(sync);
