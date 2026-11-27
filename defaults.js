// content.js 与 popup.js 共用
const DEFAULTS = {
  seekSeconds: 5,
  frameMode: false,
  sites: {}, // 按网站关闭：{ 'bilibili.com': { enabled: false } 或 { digits: false } }，默认全部开启，只存关闭的项
};
const FEATURES = ['arrows', 'digits', 'space'];
const siteKey = (host) => host.replace(/^www\./, '');
