// popup.js

document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
});

const slider = document.getElementById("slider");
const seekVal = document.getElementById("seekVal");
const decBtn = document.getElementById("decBtn");
const incBtn = document.getElementById("incBtn");
const toastToggle = document.getElementById("toastToggle");
const saveInd = document.getElementById("saveInd");
const presetBtns = document.querySelectorAll(".preset-btn");

let saveTimer = null;

// 更新 UI
function updateUI(seconds) {
  seekVal.value = seconds;
  slider.value = seconds;
  // 更新滑块渐变色
  const pct = ((seconds - 1) / 59) * 100;
  slider.style.setProperty("--pct", pct + "%");
  // 更新预设按钮高亮
  presetBtns.forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.val) === seconds);
  });
}

// 保存并显示反馈
function saveSettings(seconds, showToastVal) {
  chrome.storage.sync.set({ seekSeconds: seconds, showToast: showToastVal });
  // 显示"已保存"
  clearTimeout(saveTimer);
  saveInd.classList.add("saved");
  saveInd.querySelector("span").textContent = chrome.i18n.getMessage('saved');
  saveTimer = setTimeout(() => {
    saveInd.classList.remove("saved");
    saveInd.querySelector("span").textContent = chrome.i18n.getMessage('autoSave');
  }, 1500);
}

// 读取当前设置
chrome.storage.sync.get({ seekSeconds: 5, showToast: true }, (data) => {
  updateUI(data.seekSeconds);
  toastToggle.checked = data.showToast;
});

// 滑块变化
slider.addEventListener("input", () => {
  const val = parseInt(slider.value);
  updateUI(val);
  saveSettings(val, toastToggle.checked);
});

// − + 按钮
decBtn.addEventListener("click", () => {
  const cur = parseInt(slider.value);
  const next = Math.max(1, cur - 1);
  updateUI(next);
  saveSettings(next, toastToggle.checked);
});

incBtn.addEventListener("click", () => {
  const cur = parseInt(slider.value);
  const next = Math.min(60, cur + 1);
  updateUI(next);
  saveSettings(next, toastToggle.checked);
});

// 预设按钮
presetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const val = parseInt(btn.dataset.val);
    updateUI(val);
    saveSettings(val, toastToggle.checked);
  });
});

// 直接输入数字
seekVal.addEventListener('change', () => {
  let val = parseInt(seekVal.value);
  if (isNaN(val)) val = 5;
  val = Math.max(1, Math.min(60, val));
  updateUI(val);
  saveSettings(val, toastToggle.checked);
});

// Toast 开关
toastToggle.addEventListener("change", () => {
  saveSettings(parseInt(slider.value), toastToggle.checked);
});
