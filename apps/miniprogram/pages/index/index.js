// pages/index/index.js
const app = getApp();

Page({
  data: {
    year: 1, pop: 0, treasury: 0, sat: 0, intel: 0, crim: 0,
    chapterName: '', logs: [], event: null, over: null, classCount: {},
  },

  onShow() { this.refresh(); },

  refresh() {
    const s = app.globalData.state;
    this.setData({
      year: s.year, pop: s.stats.total, treasury: Math.round(s.treasury),
      sat: s.stats.avgSatisfaction, intel: s.stats.avgIntelligence,
      crim: s.stats.criminals, chapterName: s.chapterName,
      classCount: s.stats.byClass, logs: s.log, event: s.pendingEvent, over: s.over,
    });
  },

  onNextYear() {
    const s = app.globalData.state;
    if (s.over) return;
    if (s.pendingEvent) {
      wx.showToast({ title: '请先决策事件', icon: 'none' });
      return;
    }
    app.api.nextYear(s);
    this.refresh();
  },

  onChooseEvent(e) {
    const idx = +e.currentTarget.dataset.idx;
    const s = app.globalData.state;
    app.api.applyEventOption(s, idx);
    this.refresh();
  },

  onSave() {
    app.api.save(app.globalData.state);
    wx.showToast({ title: '已存档' });
  },
});
