// app.js
const { newGame, nextYear, applyEventOption, serialize, deserialize } = require('./core/game.js');

App({
  globalData: {
    state: null,
    SAVE_KEY: 'xiaoguo_save_v1',
  },
  onLaunch() {
    // 尝试读档
    const saved = wx.getStorageSync(this.globalData.SAVE_KEY);
    if (saved) {
      try { this.globalData.state = deserialize(saved); }
      catch (e) { this.globalData.state = newGame({ chapter: 1, seed: Date.now() }); }
    } else {
      this.globalData.state = newGame({ chapter: 1, seed: Date.now() });
    }
  },
  // 业务方法暴露
  api: {
    nextYear: (state) => nextYear(state),
    applyEventOption: (state, idx) => applyEventOption(state, idx),
    save(state) {
      wx.setStorageSync(getApp().globalData.SAVE_KEY, serialize(state));
    },
  },
});
