// miniprogram/services/history.js
const { callFunction } = require('../utils/cloud');
const { FORCE_LOCAL } = require('../config');

const LOCAL_KEY = 'localHistory';

// 读取本地历史（离线可用）
function readLocal() {
  return wx.getStorageSync(LOCAL_KEY) || [];
}

function writeLocal(list) {
  wx.setStorageSync(LOCAL_KEY, list.slice(0, 50)); // 本地最多 50 条
}

// 插入一条到本地（submit 成功后立即落本地，保证离线可见）
function pushLocal(item) {
  const list = readLocal();
  list.unshift(item);
  writeLocal(list);
  return list;
}

// 云端拉取并与本地合并（去重按 verdictId）
async function syncCloud() {
  if (FORCE_LOCAL) return readLocal(); // 开发演示期（无云）不调用云端，直接用本地
  try {
    const res = await callFunction('history', { action: 'list', page: 0, size: 30 });
    const cloud = res.items || [];
    const local = readLocal();
    const seen = new Set(cloud.map((i) => i.verdictId));
    const merged = cloud.concat(local.filter((i) => i.verdictId && !seen.has(i.verdictId)));
    writeLocal(merged);
    return merged;
  } catch (e) {
    // 云端失败不影响本地展示
    return readLocal();
  }
}

async function remove(ids) {
  if (!FORCE_LOCAL) {
    try {
      await callFunction('history', { action: 'del', ids });
    } catch (e) { /* 忽略云端失败 */ }
  }
  let list = readLocal().filter((i) => !ids.includes(i.verdictId));
  writeLocal(list);
  return list;
}

module.exports = { readLocal, pushLocal, syncCloud, remove };
