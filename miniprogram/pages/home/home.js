// miniprogram/pages/home/home.js
const { submit } = require('../../services/analyze');
const { pushLocal } = require('../../services/history');
const { detectType, typeLabel } = require('../../utils/format');

Page({
  data: {
    text: '',
    type: '',
    typeLabel: '',
    submitting: false,
    elder: false,
  },

  onInput(e) {
    const text = e.detail.value;
    const type = detectType(text);
    this.setData({ text, type, typeLabel: type === 'text' ? '' : typeLabel(type) });
  },

  onPaste() {
    wx.getClipboardData({
      success: (res) => {
        const text = res.data || '';
        const type = detectType(text);
        this.setData({ text, type, typeLabel: type === 'text' ? '' : typeLabel(type) });
      },
    });
  },

  onClear() {
    this.setData({ text: '', type: '', typeLabel: '' });
  },

  onShow() {
    const app = getApp();
    if (app && app.globalData.elderMode !== this.data.elder) {
      this.setData({ elder: !!app.globalData.elderMode });
    }
  },

  onPick(e) {
    const text = e.currentTarget.dataset.t;
    const type = detectType(text);
    this.setData({ text, type, typeLabel: type === 'text' ? '' : typeLabel(type) });
  },

  async onSubmit() {
    if (!this.data.text.trim()) return;
    this.setData({ submitting: true });
    try {
      const res = await submit(this.data.text);

      // 准备好完整 verdict：本地模式 / 云缓存命中均已携带，无需二次拉取
      let verdict = null;
      if (res.local || res.cached) {
        verdict = res.verdict || null;
      }

      const verdictId = res.verdictId || `job_${res.jobId}`;
      const snapshot = {
        verdictId,
        jobId: res.jobId || '',
        local: !!res.local,
        cached: !!res.cached,
        degraded: !!res.degraded,
        verdict: verdict || null, // 本地/缓存时存全量，云未命中时为 null
        oneLine: verdict ? verdict.oneLine : '分析中…',
        verdictLevel: verdict ? verdict.verdict : 'unverified',
        createdAt: Date.now(),
        preview: this.data.text.slice(0, 40),
      };
      pushLocal(snapshot);

      const q =
        `verdictId=${verdictId}` +
        (res.cached ? '&cached=1' : '') +
        (res.local ? '&local=1' : '') +
        (res.jobId ? `&jobId=${res.jobId}` : '');
      wx.navigateTo({
        url: `/pages/result/result?${q}`,
        success: (r) => {
          if (verdict && r.eventChannel) r.eventChannel.emit('verdict', verdict);
        },
      });
      this.setData({ text: '', type: '', typeLabel: '', submitting: false });
    } catch (err) {
      this.setData({ submitting: false });
      wx.showToast({ title: (err && err.msg) || '提交失败，请重试', icon: 'none' });
    }
  },
});
