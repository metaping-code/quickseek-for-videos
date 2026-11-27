const $ = (id) => document.getElementById(id);
const msg = (k) => chrome.i18n.getMessage(k);
const slider = $('slider');
const seekVal = $('seekVal');
const toast = $('toast');
const presetBtns = document.querySelectorAll('.preset-btn');
let s, host, toastTimer;

// 快捷键示意键盘：发光的键 = 插件接管的键，点击整组（按键 + 引线 + 文字）开关该功能
const rect = (x, y, w, h, r, cls = 'k') =>
  `<rect class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="${r}"/>`;
const text = (x, y, t, cls, anchor = 'middle') =>
  `<text class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${t}</text>`;

function buildKeyboard() {
  const W = 268, KH = 16, G = 2, TOP = 31;
  const n = (count, u = 1) => Array(count).fill(['', u]);
  const rows = [
    [['`', 1], ...[...'1234567890'].map((c) => [c, 1]), ['-', 1], ['=', 1], ['', 1.5]],
    [['', 1.5], ...n(13)],
    [['', 1.75], ...n(11), ['', 1.75]],
    [['', 2.25], ...n(10), ['', 2.25]],
    [...n(4), ['space', 5.5], ...n(2), ['L', 1], ['UD', 1], ['R', 1]],
  ];
  const base = [], hot = { digits: '', space: '', arrows: '' }, box = {};
  let y = TOP;
  for (const r of rows) {
    const unit = (W - (r.length - 1) * G) / r.reduce((a, [, u]) => a + u, 0);
    let x = 0;
    for (const [lab, u] of r) {
      const w = u * unit;
      const f = /\d/.test(lab) ? 'digits' : lab === 'space' ? 'space' : lab === 'L' || lab === 'R' ? 'arrows' : null;
      if (lab === 'UD') base.push(rect(x, y, w, KH / 2 - 0.5, 2.5), rect(x, y + KH / 2, w, KH / 2 - 0.5, 2.5));
      else if (!f) base.push(rect(x, y, w, KH, 3.5));
      else {
        const t = { L: '←', R: '→', space: '' }[lab] ?? lab;
        hot[f] += rect(x, y, w, KH, 3.5, 'k hot') + (t ? text(x + w / 2, y + KH / 2 + 0.5, t, 'kt') : '');
        box[f] ||= { x0: x, y };
        box[f].x1 = x + w;
      }
      x += w + G;
    }
    y += KH + G;
  }
  const bottom = y - G;
  const { digits: d, space: sp, arrows: a } = box;
  const dm = (d.x0 + d.x1) / 2, sm = (sp.x0 + sp.x1) / 2, am = (a.x0 + a.x1) / 2, yb = d.y - 3;
  const extra = {
    digits: `<path class="ln" d="M${d.x0 + 2} ${yb}v-4H${d.x1 - 2}v4M${dm} ${yb - 4}v-5"/>` + text(dm, yb - 14, '', 'lt'),
    space: `<path class="ln" d="M${sm} ${bottom + 3}v9"/>` + text(sm, bottom + 24, '', 'lt'),
    arrows: `<path class="ln" d="M${a.x0 + 2} ${bottom + 3}v4H${a.x1 - 2}v-4M${am} ${bottom + 7}v5"/>` +
      text(a.x1, bottom + 24, '', 'lt', 'end') + text(a.x1, bottom + 36, msg('keyArrowsSub'), 'ls', 'end'),
  };
  const H = bottom + 42;
  $('siteFeatures').innerHTML =
    `<svg class="kb" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    '<defs><linearGradient id="hot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e80ff"/><stop offset="1" stop-color="#6a5af0"/></linearGradient></defs>' +
    base.join('') +
    FEATURES.map((f) => `<g class="feat" data-f="${f}" role="switch" tabindex="0">${hot[f]}${extra[f]}</g>`).join('') +
    '</svg>';
  document.querySelectorAll('.feat').forEach((g) => {
    const toggle = () => setSite(g.dataset.f, g.classList.contains('off'), true);
    g.addEventListener('click', toggle);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = msg(el.dataset.i18n); });
document.querySelectorAll('[data-sec]').forEach((el) => { el.textContent = el.dataset.sec + msg('secShort'); });
$('version').textContent = 'v' + chrome.runtime.getManifest().version;

function render() {
  seekVal.value = slider.value = s.seekSeconds;
  slider.disabled = s.frameMode;
  slider.style.setProperty('--pct', ((s.seekSeconds - 1) / 59) * 100 + '%');
  $('seekDisplay').classList.toggle('frame', s.frameMode);
  const active = s.frameMode ? 'frame' : String(s.seekSeconds);
  presetBtns.forEach((b) => b.classList.toggle('active', b.dataset.val === active));
  if (!host) return;
  const site = s.sites[host] || {};
  const enabled = site.enabled !== false;
  $('siteEnabled').checked = enabled;
  $('siteState').textContent = msg(enabled ? 'siteEnable' : 'siteDisable');
  $('siteFeatures').classList.toggle('off', !enabled);
  document.querySelectorAll('.feat').forEach((g) => {
    const f = g.dataset.f, on = site[f] !== false, name = f[0].toUpperCase() + f.slice(1);
    g.classList.toggle('off', !on);
    g.setAttribute('aria-checked', on);
    g.querySelector('.lt').textContent = msg('key' + name + (on ? '' : 'Off'));
  });
}

function save() {
  chrome.storage.sync.set(s);
  render();
  // 放在两张卡片之间的空隙（.cards gap 为 10px）
  toast.style.top = $('seekCard').getBoundingClientRect().top - 5 + 'px';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1200);
}

function setSeconds(n, persist = true) {
  s.frameMode = false;
  s.seekSeconds = Math.max(1, Math.min(60, isNaN(n) ? 5 : n));
  persist ? save() : render();
}

// 网站设置只保存关闭的项，全部恢复开启时删除该网站记录
function setSite(key, value, dflt) {
  const site = (s.sites[host] ||= {});
  if (value === dflt) delete site[key];
  else site[key] = value;
  if (!Object.keys(site).length) delete s.sites[host];
  save();
}

buildKeyboard();
$('siteEnabled').addEventListener('change', (e) => setSite('enabled', e.target.checked, true));

// 拖动时只更新界面，松手再保存：storage.sync 每分钟最多写 120 次，逐格保存会超限导致设置丢失
slider.addEventListener('input', () => setSeconds(+slider.value, false));
slider.addEventListener('change', () => setSeconds(+slider.value));
seekVal.addEventListener('change', () => setSeconds(parseInt(seekVal.value)));
// 逐帧模式下点 − / + 先退回秒数模式，保持原秒数
$('decBtn').addEventListener('click', () => setSeconds(s.seekSeconds - !s.frameMode));
$('incBtn').addEventListener('click', () => setSeconds(s.seekSeconds + !s.frameMode));
presetBtns.forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.val !== 'frame') return setSeconds(+b.dataset.val);
  s.frameMode = true;
  save();
}));

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const url = tab && tab.url ? new URL(tab.url) : null;
  host = url && /^https?:$/.test(url.protocol) ? siteKey(url.hostname) : null;
  $('siteBox').hidden = !host;
  $('siteNA').hidden = !!host;
  if (host) {
    $('siteHost').textContent = host;
    // 网站图标：有 favicon 用 favicon，没有就显示域名首字母
    if (tab.favIconUrl) $('siteIcon').appendChild(Object.assign(new Image(), { src: tab.favIconUrl, alt: '' }));
    else $('siteIcon').textContent = host[0].toUpperCase();
  }
  chrome.storage.sync.get(DEFAULTS, (d) => { s = d; render(); });
});
