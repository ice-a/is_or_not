// miniprogram/pages/mine/mine.js
const app = getApp();

Page({
  data: {
    elder: false,
    tipVisible: false,
  },

  onShow() {
    this.setData({ elder: !!(app && app.globalData.elderMode) });
  },

  // 长辈模式开关：写回 app 全局 + 本地存储，其他页 onShow 同步
  toggleElder(e) {
    const on = !!e.detail.value;
    app.setElderMode(on);
    this.setData({ elder: on });
    wx.showToast({ title: on ? '已开启长辈模式' : '已关闭长辈模式', icon: 'none' });
  },

  // ☕ 打赏入口
  onTip() {
    this.setData({ tipVisible: true });
  },
  onTipClose() {
    this.setData({ tipVisible: false });
  },
  onTipSuccess(e) {
    const amount = (e && e.detail && e.detail.amount) || 0;
    console.log('[tip] success amount=', amount);
  },

  onAbout() {
    wx.showModal({
      title: '关于辨是非',
      content: '辨是非是一款帮长辈识别谣言、骗局的小工具。把收到的话粘贴进来，马上告诉你真的假的、为什么、该怎么办。',
      showCancel: false,
    });
  },

  onDisclaimer() {
    wx.showModal({
      title: '免责声明',
      content:
        '本工具结论由人工智能生成，仅供参考，不构成法律、医疗或投资建议。涉及钱、验证码、链接，请以官方通报为准，拿不准就打 96110 问一问。',
      showCancel: false,
    });
  },
});
