// miniprogram/pages/result/result.js
const { getVerdict, submitFeedback } = require('../../services/analyze');
const { pollJob } = require('../../utils/watch');
const { STAGE_TEXT } = require('../../utils/format');

const CHECKLIST = [
  '① 这条是谁发给你的？',
  '② 它让你去干啥？',
  '③ 要你转账、交钱吗？',
  '④ 要你点链接、下载 App 吗？',
  '⑤ 是不是在催你、吓唬你？',
];

Page({
  data: {
    elder: false,
    verdictId: '',
    jobId: '',
    local: false,
    cached: false,

    tipVisible: false,

    loading: true,
    showVerdict: false,
    showChecklist: false,
    degraded: false,
    degradedMsg: '',

    stage: 0,
    stageText: '',
    verdict: null,
    checklist: CHECKLIST,
  },

  onLoad(query) {
    const app = getApp();
    const local = query.local === '1';
    const cached = query.cached === '1';
    this.setData({
      elder: !!(app && app.globalData.elderMode),
      verdictId: query.verdictId || '',
      jobId: query.jobId || '',
      local,
      cached,
    });

    // 有 jobId（云模式未命中）：watch 任务进度
    if (query.jobId) {
      this.startWatch(query.jobId);
      return;
    }

    // 有 verdictId（本地 / 缓存命中 / 分享直达）：拉结论
    if (query.verdictId) {
      getVerdict(query.verdictId)
        .then((res) => {
          if (res.verdict) {
            this.renderVerdict(res.verdict, { degraded: local });
          } else {
            this.showChecklist('没能找到这条记录，可能是演示内容或已过期');
          }
        })
        .catch(() => this.showChecklist('读取失败了，请稍后再试'));
      return;
    }

    // 啥都没有
    this.showChecklist();
  },

  onShow() {
    const app = getApp();
    if (app && app.globalData.elderMode !== this.data.elder) {
      this.setData({ elder: !!app.globalData.elderMode });
    }
  },

  // 云模式：轮询 getVerdict({jobId}) 进度，拿到结论后渲染
  startWatch(jobId) {
    this.setData({ loading: true, stage: 0, stageText: STAGE_TEXT[0] });
    const self = this;

    const poller = pollJob(jobId, {
      onTick: (progress) => {
        self.setData({
          stage: progress.stage || 0,
          stageText: STAGE_TEXT[progress.stage] || STAGE_TEXT[0],
        });
      },
      onDone: (res) => {
        self.closeWatcher();
        if (res.verdict) {
          // 用真实 verdictId 覆盖临时 jobId，保证分享 / 历史一致
          self.setData({ verdictId: res.verdictId || self.data.verdictId });
          self.renderVerdict(res.verdict, { degraded: !!res.degraded });
        } else if (res.timeout) {
          self.showChecklist('分析有点慢，请稍后再来看看');
        } else {
          self.showChecklist('读取失败了，请稍后再试');
        }
      },
    });
    this.watcher = poller;
  },

  finishByVerdictId(verdictId, degraded) {
    if (!verdictId) return this.showChecklist();
    getVerdict(verdictId)
      .then((res) => {
        if (res.verdict) this.renderVerdict(res.verdict, { degraded: !!degraded });
        else this.showChecklist();
      })
      .catch(() => this.showChecklist());
  },

  renderVerdict(verdict, { degraded }) {
    this.setData({
      loading: false,
      showChecklist: false,
      showVerdict: true,
      verdict,
      degraded: degraded !== undefined ? degraded : this.data.local,
    });
  },

  showChecklist(msg) {
    this.setData({
      loading: false,
      showVerdict: false,
      showChecklist: true,
      degradedMsg: msg || '',
    });
  },

  closeWatcher() {
    if (this.watcher && this.watcher.close) {
      try {
        this.watcher.close();
      } catch (e) {
        /* noop */
      }
    }
  },

  onUnload() {
    this.closeWatcher();
  },

  // 🔊 读给我听：本地无 TTS，复制结论文字方便念给长辈听（P1 接云 TTS）
  onReadAloud() {
    const v = this.data.verdict;
    if (!v) return;
    const text = [v.oneLine, ...(v.reasons || []), ...(v.actions || [])].join('。');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制，方便读给家人听', icon: 'none' }),
    });
  },

  // 👎 说错了：纠错反馈
  onFeedback() {
    wx.showActionSheet({
      itemList: ['结论不对', '理由不对', '其他问题'],
      success: async (res) => {
        const types = ['wrong', 'inaccurate', 'other'];
        const type = types[res.tapIndex];
        try {
          await submitFeedback(this.data.verdictId, type, '');
          wx.showToast({ title: '已收到，谢谢您', icon: 'none' });
        } catch (e) {
          wx.showToast({ title: '反馈没发出去，稍后再试', icon: 'none' });
        }
      },
    });
  },

  backHome() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/home/home' }),
    });
  },

  // ☕ 打赏入口
  onTip() {
    this.setData({ tipVisible: true });
  },
  onTipClose() {
    this.setData({ tipVisible: false });
  },
  onTipSuccess(e) {
    // 成功回调：可在此做统计或提示，当前组件内已弹感谢窗
    const amount = (e && e.detail && e.detail.amount) || 0;
    console.log('[tip] success amount=', amount);
  },

  // 📤 发给家人：分享卡片
  onShareAppMessage() {
    const v = this.data.verdict;
    let title = '辨是非 · 帮你识别谣言骗局';
    if (v) {
      if (v.verdict === 'false') title = '我帮您查了，这条是假的';
      else if (v.verdict === 'true') title = '我帮您查了，这条基本可信';
      else title = '我帮您查了，这条还没查清';
    }
    return {
      title,
      path: `/pages/result/result?verdictId=${this.data.verdictId}${this.data.local ? '&local=1' : ''}`,
    };
  },
});
