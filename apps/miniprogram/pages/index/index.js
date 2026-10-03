// pages/index/index.js
const app = getApp();

Page({
  data: {
    year: 1, pop: 0, treasury: 0, sat: 0, intel: 0, crim: 0, score:0,
    busy:false, progress:0, phase:'',
    chapterName: '', logs: [], event: null, war: null, over: null, classCount: {},
    conscription:20, supply:2, equipment:2, warEstimate:'', treatyText:'',
    yearSummary:'推进一年后显示年度变化', policyNotice:'',
    populationNotice:'', eventLabel:'', eventColor:'#666666', logEntries:[],
  },

  onShow() { this.refresh(); },
  onHide() { this.cancelTransition(); },
  onUnload() { this.cancelTransition(); },
  cancelTransition() {
    clearInterval(this.transitionTimer);
    this.finishTransition = null;
    app.globalData.busy = false;
    this.setData({busy:false});
  },
  runTransition(fast) {
    const s=app.globalData.state;
    if(app.globalData.busy||s.over||s.pendingEvent||s.pendingWar)return;
    app.globalData.busy=true;
    this.setData({busy:true,progress:0,phase:'春耕秋收 · 生产与商贸'});
    const start=Date.now(),duration=fast?2000:1600;
    this.finishTransition=()=>{
      clearInterval(this.transitionTimer);
      this.finishTransition=null;
      try {
        for(let i=0;i<(fast?3:1);i++) {
          app.api.nextYear(s);
          if(s.over||s.pendingEvent||s.pendingWar||(s.year-1)%3===0)break;
        }
        this.refresh();
      } catch(error) {
        wx.showToast({title:'年度结算失败，请重试',icon:'none'});
      } finally { app.globalData.busy=false;this.setData({busy:false,progress:100}); }
    };
    this.transitionTimer=setInterval(()=>{
      const progress=Math.min(100,Math.round((Date.now()-start)/duration*100));
      this.setData({progress,phase:progress<35?'春耕秋收 · 生产与商贸':progress<70?'朝堂议事 · 财政与民生':'岁末回顾 · 人口与年度变化'});
      if(progress>=100&&this.finishTransition)this.finishTransition();
    },80);
  },
  onSkipTransition() { if(this.finishTransition)this.finishTransition(); },

  refresh() {
    const s = app.globalData.state;
    this.setData({
      year: s.year, pop: s.stats.total, treasury: Math.round(s.treasury),
      sat: s.stats.avgSatisfaction, intel: s.stats.avgIntelligence,
      crim: s.stats.criminals, chapterName: s.chapterName,
      score: s.score.total,
      classCount: s.stats.byClass, logs: s.log,
      event: s.pendingEvent ? { title:s.pendingEvent.title, desc:s.pendingEvent.desc, category:s.pendingEvent.category,
        options:s.pendingEvent.options.map(o=>({label:o.label})) } : null,
      war:s.pendingWar, over: s.over,
      populationNotice: s.people.length > s.cfg.bucketModeThreshold ? `人口超过 ${s.cfg.bucketModeThreshold}，仅显示阶层汇总，不记录个人履历` : '轻量概览 · 个人履历最多保留12年',
      eventLabel: s.pendingEvent ? app.api.EVENT_PRESENTATION[s.pendingEvent.category].symbol+' '+app.api.EVENT_PRESENTATION[s.pendingEvent.category].label : '',
      eventColor: s.pendingEvent ? app.api.EVENT_PRESENTATION[s.pendingEvent.category].color : '#666666',
      logEntries:s.log.map(text=>({text,color:app.api.EVENT_PRESENTATION[app.api.eventLogCategory(text)]?.color||'#54667a'})),
      yearSummary: this.yearSummary(s.lastYearChanges),
      policyNotice: app.api.policyNotice(s),
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
    this.runTransition(false);
  },

  onChooseEvent(e) {
    if(app.globalData.busy)return;
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
    if(app.globalData.busy)return;
    const action=e.currentTarget.dataset.action;
    app.api.applyWarDecision(app.globalData.state,action==='fight'?Object.assign({action},this.warPlan()):{action});
    this.refresh();
  },

  onAdvanceToDecision() {
    this.runTransition(true);
  },

  yearSummary(changes) {
    if(!changes)return '推进一年后显示年度变化';
    const signed=(value,digits)=>{const n=Number(value)||0;const text=digits?n.toFixed(digits):String(Math.round(n));return n>0?'+'+text:text;};
    return `第${changes.year}年变化：人口${signed(changes.population)}　国库${signed(changes.treasury)}　满意${signed(changes.avgSatisfaction,2)}　罪犯${signed(changes.criminals)}`;
  },

  onSave() {
    if(app.globalData.busy)return;
    app.api.save(app.globalData.state);
    wx.showToast({ title: '已存档' });
  },
});
