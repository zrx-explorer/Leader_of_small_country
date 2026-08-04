/**
 * Web 主入口：组合 core 引擎 + UI
 */
import {
  newGame, nextYear as advance, applyEventOption,
  applyWarDecision, applyPolicyPreset, estimateWarCost, treatyTaxFloor, serialize, deserialize,
} from '../../../packages/core/src/game.js';
import { UI } from './ui.js';

const SAVE_KEY = 'xiaoguo.save.v1';

class Controller {
  constructor() {
    this.state = newGame({ chapter: 1, seed: Date.now() });
    this.ui = new UI(this);
    this.ui.render(this.state);
    if (!localStorage.getItem('xiaoguo.tutorial.shown')) {
      this.ui.startTutorial([
        '欢迎来到《小国执政官》。先点击中央的“⏯ 下一年”，看看国家如何变化。',
        '想轻松游玩时，可在左侧直接选择“休养生息、均衡治理或富国强兵”。',
        '熟悉系统后再展开“高级调控”，逐项调整税率、公务员与军费。',
        '“⏩ 推进至决策”会自动略过平静年份，遇到事件、战争或政策窗口就停下。',
      ]);
      localStorage.setItem('xiaoguo.tutorial.shown', '1');
    }
  }

  // === 玩家交互 ===
  canAdjustPolicy() {
    return !this.state.over && !this.state.pendingEvent && !this.state.pendingWar && (this.state.year - 1) % 3 === 0;
  }
  welfareCount() {
    return this.state.people.filter(p => !p.isCriminal && p.role === 'welfare').length;
  }
  taxInterval() {
    const count = this.welfareCount();
    return count > 10 ? 1 : Math.max(1, 11 - count);
  }
  canAdjustTax() {
    const s = this.state;
    if (s.over || s.pendingEvent || s.pendingWar) return false;
    if (s.people.length <= 100) return this.canAdjustPolicy();
    if (this.welfareCount() === 0) return false;
    if (s.lastTaxChangeYear == null || s.lastTaxChangeYear === s.year) return true;
    return s.year - s.lastTaxChangeYear >= this.taxInterval();
  }
  setTax(klass, v) {
    if (!this.canAdjustTax()) return;
    v = Math.max(v, treatyTaxFloor(this.state));
    if (this.state.policy.tax[klass] === v) return;
    this.state.policy.tax[klass] = v;
    this.state.lastTaxChangeYear = this.state.year;
  }
  setOfficial(role, v) {
    if (role === 'security') {
      if (this.state.over || this.state.pendingEvent || this.state.pendingWar || this.state.year < 5) return;
    } else {
      if (!this.canAdjustPolicy()) return;
      if (role === 'welfare' && this.state.year < 11) return;
      if (role === 'military' && this.state.year < 21) return;
    }
    this.state.policy.officials[role] = v;
  }
  setMilitaryRatio(v) {
    if (!this.canAdjustPolicy()) return;
    this.state.policy.militaryRatio = v;
  }
  setOfficialWage(v) {
    if (!this.canAdjustPolicy()) return;
    this.state.policy.officialWage = Math.max(0, v);
  }

  usePolicyPreset(presetId) {
    if (!this.canAdjustPolicy()) return;
    applyPolicyPreset(this.state, presetId, { includeTax: this.canAdjustTax() });
    this.ui.render(this.state);
  }

  nextYear() {
    if (this.state.over) return;
    if (this.state.pendingEvent || this.state.pendingWar) {
      // 事件未决策则提示
      return;
    }
    advance(this.state);
    this.ui.render(this.state);
  }

  chooseEvent(idx) {
    applyEventOption(this.state, idx);
    this.ui.render(this.state);
  }

  chooseWar(decision) {
    applyWarDecision(this.state, decision);
    this.ui.render(this.state);
  }

  advanceToDecision() {
    if (this.state.over || this.state.pendingEvent || this.state.pendingWar) return;
    for (let i = 0; i < 3; i++) {
      advance(this.state);
      this.ui.render(this.state);
      if (this.state.over || this.state.pendingEvent || this.state.pendingWar) break;
      if ((this.state.year - 1) % 3 === 0) break;
    }
  }

  estimateWar(plan) { return estimateWarCost(this.state, plan); }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, serialize(this.state));
      alert('已存档（槽位 1）');
    } catch (e) {
      alert('存档失败：' + e.message);
    }
  }

  load() {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) { alert('暂无存档'); return; }
    try {
      this.state = deserialize(s);
      document.getElementById('log-list').innerHTML = '';
      this.ui.render(this.state);
    } catch (e) {
      alert('读档失败：' + e.message);
    }
  }

  restart() {
    this.state = newGame({ chapter: 1, seed: Date.now() });
    document.getElementById('log-list').innerHTML = '';
    this.ui.render(this.state);
  }
}

window.__game = new Controller();
