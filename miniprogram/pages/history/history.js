// miniprogram/pages/history/history.js
const { syncCloud, remove } = require('../../services/history');
const { verdictMeta, timeAgo } = require('../../utils/format');

const SHORT = { false: '假', true: '真', unverified: '说不准' };

// 兼容本地快照与云端同步两种结构：
//  - 本地快照：verdict 为全量对象 / verdictLevel 字段 / preview
//  - 云端：verdict 为字符串(verdict 档位) / oneLine / preview
function adapt(list) {
  return (list || []).map((it) => {
    let level;
    if (it.verdictLevel) level = it.verdictLevel;
    else if (it.verdict && typeof it.verdict === 'object') level = it.verdict.verdict;
    else if (typeof it.verdict === 'string') level = it.verdict;
    else level = 'unverified';

    const oneLine = it.oneLine || (it.verdict && it.verdict.oneLine) || '分析中…';
    const preview = it.preview || (it.verdict && it.verdict.claim) || '';
    return {
      ...it,
      level,
      meta: verdictMeta(level),
      short: SHORT[level] || '说不准',
      time: timeAgo(it.createdAt),
      oneLine,
      preview,
    };
  });
}

function filterFake(list, onlyFake) {
  if (!onlyFake) return list;
  return list.filter((it) => it.level === 'false');
}

Page({
  data: {
    elder: false,
    onlyFake: false,
    list: [],
  },

  onShow() {
    const app = getApp();
    this.setData({ elder: !!(app && app.globalData.elderMode) });
    this.refresh();
  },

  async refresh() {
    const raw = await syncCloud();
    const list = filterFake(adapt(raw), this.data.onlyFake);
    this.setData({ list });
  },

  toggleFake() {
    this.setData({ onlyFake: !this.data.onlyFake }, () => this.refresh());
  },

  onTap(e) {
    const id = e.currentTarget.dataset.id;
    const it = this.data.list.find((x) => x.verdictId === id);
    if (!it) return;
    let q = `verdictId=${id}`;
    if (it.local) q += '&local=1';
    else if (it.cached) q += '&cached=1';
    if (it.jobId) q += `&jobId=${it.jobId}`;
    wx.navigateTo({ url: `/pages/result/result?${q}` });
  },

  onLong(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这条记录',
      content: '确定删除吗？删了就看不到了。',
      confirmColor: '#D93025',
      success: (r) => {
        if (r.confirm) {
          remove([id]).then(() => this.refresh());
        }
      },
    });
  },

  onClear() {
    if (!this.data.list.length) return;
    wx.showModal({
      title: '清空历史',
      content: '确定清空全部本地历史？此操作不可恢复。',
      confirmColor: '#D93025',
      success: (r) => {
        if (r.confirm) {
          const ids = this.data.list.map((x) => x.verdictId);
          remove(ids).then(() => this.refresh());
        }
      },
    });
  },
});
