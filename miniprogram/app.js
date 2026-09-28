// miniprogram/app.js
const { CLOUD_ENV } = require('./config');

App({
  globalData: {
    openid: '',
    elderMode: false, // 长辈模式：放大字号
    cloudReady: false,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库版本过低，请使用 2.2.3 及以上的基础库');
      return;
    }

    if (!CLOUD_ENV || CLOUD_ENV === 'your-cloud-env-id') {
      console.warn(
        '[辨是非] 请在 miniprogram/config.js 中填写 CLOUD_ENV（云开发环境 ID），否则云函数/数据库不可用。'
      );
    }

    wx.cloud.init({
      env: CLOUD_ENV || undefined, // 留空则使用默认环境
      traceUser: true,
    });
    this.globalData.cloudReady = true;

    // 生成并持久化匿名用户标识：云函数用 uid 代替 OPENID 做限流 / 历史隔离
    let uid = wx.getStorageSync('uid');
    if (!uid) {
      uid = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      wx.setStorageSync('uid', uid);
    }
    this.globalData.uid = uid;

    // 读取长辈模式偏好
    const elder = wx.getStorageSync('elderMode');
    this.globalData.elderMode = !!elder;
  },

  // 全局设置长辈模式
  setElderMode(on) {
    this.globalData.elderMode = !!on;
    wx.setStorageSync('elderMode', !!on);
  },
});
