// pages/index/index.js
const app = getApp();

Page({
  data: {
    year: 1, pop: 0, treasury: 0, sat: 0, intel: 0, crim: 0,
    chapterName: '', logs: [], event: null, war: null, over: null, classCount: {},
    conscription:20, supply:2, equipment:2, warEstimate:'', treatyText:'',
    yearSummary:'推进一年后显示年度变化',
  },

  onShow() { this.refresh(); },

  refresh() {
    const s = app.globalData.state;
    this.setData({
      year: s.year, pop: s.stats.total, treasury: Math.round(s.treasury),
      sat: s.stats.avgSatisfaction, intel: s.stats.avgIntelligence,
      crim: s.stats.criminals, chapterName: s.chapterName,
      classCount: s.stats.byClass, logs: s.log, event: s.pendingEvent, war:s.pendingWar, over: s.over,
      yearSummary: this.yearSummary(s.lastYearChanges),
      warEstimate: s.pendingWar ? this.warEstimate(s) : '',
      treatyText: s.pendingWar ? this.treatyText(s.pendingWar.offeredTreaty) : '',
    });
  },

  onNextYear() {
    const s = app.globalData.state;
    if (s.over) return;
    if (s.pendingEvent || s.pendingWar) {
      wx.showToast({ title: '请先完成当前决策', icon: 'none' });
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
  warPlan() {
    return {conscriptionRate:this.data.conscription/100,supplyLevel:this.data.supply,equipmentLevel:this.data.equipment};
  },
  warEstimate(s) {
    const e=app.api.estimateWarCost(s,this.warPlan());
    return `预计征兵${e.troops}人，每人费用${e.perTroop}，总投入${e.total}`;
  },
  treatyText(t) {
    return `立即赔款${t.upfront}，持续${t.duration}年，每年固定${t.annualFlat}`+(t.taxShare?`，另付税收${Math.round(t.taxShare*100)}%，税率不低于${Math.round(t.minTaxRate*100)}%`:'，无税率条款');
  },
  onWarSetting(e) {
    this.setData({[e.currentTarget.dataset.key]:+e.detail.value},()=>this.refresh());
  },
  onChooseWar(e) {
    const action=e.currentTarget.dataset.action;
    app.api.applyWarDecision(app.globalData.state,action==='fight'?Object.assign({action},this.warPlan()):{action});
    this.refresh();
  },

  onAdvanceToDecision() {
    const s=app.globalData.state;
    if(s.over||s.pendingEvent||s.pendingWar)return;
    for(let i=0;i<3;i++){
      app.api.nextYear(s);
      if(s.over||s.pendingEvent||s.pendingWar||(s.year-1)%3===0)break;
    }
    this.refresh();
  },

  yearSummary(changes) {
    if(!changes)return '推进一年后显示年度变化';
    const signed=(value,digits)=>{const n=Number(value)||0;const text=digits?n.toFixed(digits):String(Math.round(n));return n>0?'+'+text:text;};
    return `第${changes.year}年变化：人口${signed(changes.population)}　国库${signed(changes.treasury)}　满意${signed(changes.avgSatisfaction,2)}　罪犯${signed(changes.criminals)}`;
  },

  onSave() {
    app.api.save(app.globalData.state);
    wx.showToast({ title: '已存档' });
  },
});
