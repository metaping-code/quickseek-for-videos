const $ = (id) => document.getElementById(id);
const slider = $('slider');
const seekVal = $('seekVal');
const toastToggle = $('toastToggle');
const saveInd = $('saveInd');
const saveText = saveInd.querySelector('span');
const presetBtns = document.querySelectorAll('.preset-btn');
const msg = (k) => chrome.i18n.getMessage(k);
let saveTimer;

document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = msg(el.dataset.i18n); });
$('version').textContent = 'v' + chrome.runtime.getManifest().version;

function render(s) {
  seekVal.value = slider.value = s;
  slider.style.setProperty('--pct', ((s - 1) / 59) * 100 + '%');
  presetBtns.forEach((b) => b.classList.toggle('active', +b.dataset.val === s));
}

function save() {
  chrome.storage.sync.set({ seekSeconds: +slider.value, showToast: toastToggle.checked });
  clearTimeout(saveTimer);
  saveInd.classList.add('saved');
  saveText.textContent = msg('saved');
  saveTimer = setTimeout(() => {
    saveInd.classList.remove('saved');
    saveText.textContent = msg('autoSave');
  }, 1500);
}

function setSeconds(s) {
  render(Math.max(1, Math.min(60, isNaN(s) ? 5 : s)));
  save();
}

chrome.storage.sync.get({ seekSeconds: 5, showToast: true }, (d) => {
  render(d.seekSeconds);
  toastToggle.checked = d.showToast;
});

slider.addEventListener('input', () => setSeconds(+slider.value));
seekVal.addEventListener('change', () => setSeconds(parseInt(seekVal.value)));
$('decBtn').addEventListener('click', () => setSeconds(+slider.value - 1));
$('incBtn').addEventListener('click', () => setSeconds(+slider.value + 1));
presetBtns.forEach((b) => b.addEventListener('click', () => setSeconds(+b.dataset.val)));
toastToggle.addEventListener('change', save);
