// miniprogram/pages/history/history.js
const { readLocal, remove } = require('../../services/history');
const { verdictMeta, timeAgo } = require('../../utils/format');

const SHORT = { false: '假', true: '真', unverified: '说不准' };

function adapt(list) {
  return (list || []).map((it) => {
    const level = it.verdictLevel || (it.verdict && it.verdict.verdict) || 'unverified';
    return {
      ...it,
      level,
      meta: verdictMeta(level),
      short: SHORT[level] || '说不准',
      time: timeAgo(it.createdAt),
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

  refresh() {
    const raw = readLocal();
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
          remove([id]).then((raw) => this.setData({ list: filterFake(adapt(raw), this.data.onlyFake) }));
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
          remove(ids).then(() => this.setData({ list: [] }));
        }
      },
    });
  },
});
