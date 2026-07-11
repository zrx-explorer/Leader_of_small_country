/**
 * UI 绑定：DOM ↔ 游戏状态
 */
import {
  drawClassPie, drawHistory, formatCompactNumber, yearAtCanvasX,
} from './charts.js';

const CLASS_LABEL = { farmer: '农民', worker: '工人', merchant: '商人', official: '公务员' };
const CLASS_COLOR = { farmer: '#2ecc71', worker: '#3498db', merchant: '#d4a017', official: '#8e44ad' };

export class UI {
  constructor(controller) {
    this.ctrl = controller;
    this.selectedPersonId = null;
    this.historyView = { startYear: null, endYear: null, hoverYear: null };
    this.bind();
  }

  bind() {
    // 滑块
    this._range('tax-farmer',   (v)=>this.ctrl.setTax('farmer', v/100), v=>v+'%');
    this._range('tax-worker',   (v)=>this.ctrl.setTax('worker', v/100), v=>v+'%');
    this._range('tax-merchant', (v)=>this.ctrl.setTax('merchant', v/100), v=>v+'%');
    this._range('off-tax',      (v)=>this.ctrl.setOfficial('tax', v));
    this._range('off-security', (v)=>this.ctrl.setOfficial('security', v));
    this._range('off-welfare',  (v)=>this.ctrl.setOfficial('welfare', v));
    this._range('off-military', (v)=>this.ctrl.setOfficial('military', v));
    this._range('off-teacher',  (v)=>this.ctrl.setOfficial('teacher', v));
    this._range('mil-ratio',    (v)=>this.ctrl.setMilitaryRatio(v/100), v=>v+'%');

    document.querySelectorAll('.role-help-btn').forEach(help => {
      help.onclick = e => {
        e.preventDefault();
        document.getElementById(help.dataset.help)?.classList.toggle('hidden');
      };
    });

    // 按钮
    document.getElementById('btn-next').onclick     = () => this.ctrl.nextYear();
    document.getElementById('btn-save').onclick     = () => this.ctrl.save();
    document.getElementById('btn-load').onclick     = () => this.ctrl.load();
    document.getElementById('btn-restart').onclick  = () => this.ctrl.restart();
    document.getElementById('end-restart').onclick  = () => {
      this.hideEnd();
      this.ctrl.restart();
    };
    for (const id of ['war-conscription', 'war-supply', 'war-equipment']) {
      document.getElementById(id).onchange = () => this.renderWarEstimate();
    }
    document.getElementById('war-fight').onclick = () => this.ctrl.chooseWar({ action:'fight', ...this.warPlan() });
    document.getElementById('war-sign').onclick = () => this.ctrl.chooseWar({ action:'treaty' });
    document.getElementById('war-surrender').onclick = () => this.ctrl.chooseWar({ action:'surrender' });

    const historyCanvas = document.getElementById('chart-history');
    historyCanvas.addEventListener('mousemove', e => {
      const state = this.ctrl.state;
      const year = yearAtCanvasX(historyCanvas, state.history, this.historyView, e.clientX);
      this.historyView.hoverYear = year;
      this.renderCharts(state);
    });
    historyCanvas.addEventListener('mouseleave', () => {
      this.historyView.hoverYear = null;
      this.renderCharts(this.ctrl.state);
    });
    historyCanvas.addEventListener('wheel', e => {
      if (!e.altKey) return;
      e.preventDefault();
      this.zoomHistory(e.deltaY > 0 ? 1 : -1);
      this.renderCharts(this.ctrl.state);
    }, { passive: false });
  }

  _range(id, onChange, fmt = v => v) {
    const el = document.getElementById(id);
    const out = document.getElementById('out-' + id);
    const update = () => {
      out.textContent = fmt(el.value);
      onChange(+el.value);
    };
    el.addEventListener('input', update);
  }

  /** 全量刷新 UI */
  render(state) {
    document.getElementById('hud-year').textContent = state.year;
    document.getElementById('hud-pop').textContent = state.stats.total;
    document.getElementById('hud-treasury').textContent = formatCompactNumber(state.treasury);
    document.getElementById('hud-treasury').title = state.treasury.toFixed(0);
    document.getElementById('hud-sat').textContent = state.stats.avgSatisfaction;
    document.getElementById('hud-int').textContent = state.stats.avgIntelligence;
    document.getElementById('hud-crim').textContent = state.stats.criminals;

    // 章节进度
    document.getElementById('chapter-tip').textContent =
      `章节 ${state.chapter} · ${state.chapterName} · ${policyWindowText(state.year)}${state.treaty ? ` · 赔款条约至第 ${state.treaty.endYear} 年` : ''}`;
    this.syncPolicyControls(state);
    this.updatePolicyLock(state);

    // 图表 / 个体
    this.renderCharts(state);
    this.renderPeople(state);

    // 日志
    this.renderLog(state);

    // 事件
    if (state.pendingEvent) this.showEvent(state.pendingEvent);
    else this.hideEvent();
    if (state.pendingWar) this.showWar(state.pendingWar);
    else this.hideWar();

    // 结算
    if (state.over) this.showEnd(state);
  }

  renderCharts(state) {
    drawClassPie(document.getElementById('chart-class'), state.stats.byClass);
    this.normalizeHistoryView(state);
    drawHistory(document.getElementById('chart-history'), state.history, this.historyView);
  }

  normalizeHistoryView(state) {
    if (state.history.length < 2) return;
    const first = state.history[0].year;
    const last = state.history[state.history.length - 1].year;
    if (this.historyView.startYear == null || this.historyView.endYear == null) {
      this.historyView.startYear = first;
      this.historyView.endYear = last;
      return;
    }
    if (this.historyView.endYear === last - 1) this.historyView.endYear = last;
    this.historyView.startYear = Math.max(first, Math.min(this.historyView.startYear, last - 1));
    this.historyView.endYear = Math.min(last, Math.max(this.historyView.endYear, this.historyView.startYear + 1));
  }

  zoomHistory(direction) {
    const history = this.ctrl.state.history;
    if (history.length < 4) return;
    this.normalizeHistoryView(this.ctrl.state);
    const first = history[0].year;
    const last = history[history.length - 1].year;
    const start = this.historyView.startYear ?? first;
    const end = this.historyView.endYear ?? last;
    const span = end - start + 1;
    const nextSpan = direction < 0
      ? Math.max(4, Math.floor(span * 0.75))
      : Math.min(last - first + 1, Math.ceil(span * 1.35));
    const center = this.historyView.hoverYear ?? Math.round((start + end) / 2);
    let nextStart = Math.round(center - nextSpan / 2);
    let nextEnd = nextStart + nextSpan - 1;
    if (nextStart < first) { nextStart = first; nextEnd = first + nextSpan - 1; }
    if (nextEnd > last) { nextEnd = last; nextStart = last - nextSpan + 1; }
    this.historyView.startYear = nextStart;
    this.historyView.endYear = nextEnd;
  }

  renderPeople(state) {
    const grid = document.getElementById('people-grid');
    const detail = document.getElementById('person-detail');
    if (!grid || !detail) return;
    if (!state.people.some(p => p.id === this.selectedPersonId)) {
      this.selectedPersonId = state.people[0]?.id ?? null;
    }
    const renderLimit = state.cfg.bucketModeThreshold || 300;
    const visiblePeople = state.people.slice(0, renderLimit);
    grid.innerHTML = visiblePeople.map(p => {
      const active = p.id === this.selectedPersonId ? ' active' : '';
      const initial = (p.name || `民${p.id}`).slice(0, 1);
      return `<button class="person-avatar${active}" data-id="${p.id}" title="${p.name || ''}">
        <span class="avatar-face" style="background:${CLASS_COLOR[p.klass] || '#888'}">${initial}</span>
        <span class="avatar-name">${p.name || `无名${p.id}`}</span>
        <span class="avatar-sat">满意 ${p.satisfaction.toFixed(1)}</span>
      </button>`;
    }).join('') + (state.people.length > renderLimit
      ? `<div class="people-truncated">为保持流畅，仅显示前 ${renderLimit} / ${state.people.length} 人</div>`
      : '');
    grid.querySelectorAll('.person-avatar').forEach(btn => {
      btn.onclick = () => {
        this.selectedPersonId = Number(btn.dataset.id);
        this.renderPeople(this.ctrl.state);
      };
    });
    const person = state.people.find(p => p.id === this.selectedPersonId);
    if (!person) {
      detail.innerHTML = '<div class="detail-empty">选择一位国民查看履历</div>';
      return;
    }
    const history = Array.isArray(person.history) ? person.history.slice(-12).reverse() : [];
    detail.innerHTML = `
      <div class="detail-title">${person.name || `无名${person.id}`}</div>
      <div class="detail-row"><span>阶级</span><b>${CLASS_LABEL[person.klass] || person.klass}</b></div>
      <div class="detail-row"><span>年龄</span><b>${person.age}</b></div>
      <div class="detail-row"><span>性别</span><b>${person.gender === 'female' ? '女' : '男'}</b></div>
      <div class="detail-row"><span>满意度</span><b>${person.satisfaction.toFixed(2)}</b></div>
      <div class="detail-row"><span>智力</span><b>${person.intelligence.toFixed(2)}</b></div>
      <div class="detail-row"><span>粮食 / 产品</span><b>${person.grain.toFixed(1)} / ${person.product.toFixed(1)}</b></div>
      <div class="history-list">
        <div class="detail-title">变化记录</div>
        ${history.map(h => `<div class="history-item">
          <span>${h.year}年</span><span>${CLASS_LABEL[h.klass] || h.klass}</span><b>${Number(h.satisfaction).toFixed(2)}</b>
        </div>`).join('') || '<div class="detail-empty">暂无历史</div>'}
      </div>`;
  }

  syncPolicyControls(state) {
    const values = {
      'tax-farmer': Math.round(state.policy.tax.farmer * 100),
      'tax-worker': Math.round(state.policy.tax.worker * 100),
      'tax-merchant': Math.round(state.policy.tax.merchant * 100),
      'off-tax': state.policy.officials.tax,
      'off-security': state.policy.officials.security,
      'off-welfare': state.policy.officials.welfare,
      'off-military': state.policy.officials.military,
      'off-teacher': state.policy.officials.teacher,
      'mil-ratio': Math.round(state.policy.militaryRatio * 100),
    };
    const formatters = {
      'tax-farmer': v => `${v}%`,
      'tax-worker': v => `${v}%`,
      'tax-merchant': v => `${v}%`,
      'mil-ratio': v => `${v}%`,
    };
    for (const [id, value] of Object.entries(values)) {
      const el = document.getElementById(id);
      const out = document.getElementById(`out-${id}`);
      if (!el || !out) continue;
      el.value = value;
      if (id.startsWith('tax-')) el.min = Math.round((state.treaty?.minTaxRate || 0) * 100);
      out.textContent = (formatters[id] || (v => v))(value);
    }
  }

  updatePolicyLock(state) {
    const locked = !canAdjustPolicy(state);
    const tip = document.getElementById('policy-window-tip');
    if (tip) {
      tip.textContent = locked
        ? `政策已锁定，${yearsUntilPolicyWindow(state.year)} 年后可再次调控`
        : '政策窗口开放：本年可调整公务员与军费；税率以税率栏状态为准';
      tip.classList.toggle('locked', locked);
    }
    document.querySelectorAll('.panel-policy input[type="range"]').forEach(el => {
      if (el.id.startsWith('tax-')) el.disabled = !this.ctrl.canAdjustTax();
      else if (el.id === 'off-security') el.disabled = Boolean(state.over || state.pendingEvent || state.pendingWar || state.year < 5);
      else if (el.id === 'off-welfare') el.disabled = locked || state.year < 11;
      else if (el.id === 'off-military') el.disabled = locked || state.year < 21;
      else el.disabled = locked;
    });
    const security = document.getElementById('off-security');
    if (security && state.year < 5) security.title = '治安官人数从第 5 年起可以修改';
    const welfare = document.getElementById('off-welfare');
    if (welfare && state.year < 11) welfare.title = '民生官员经营满 10 年后解锁（第 11 年）';
    const military = document.getElementById('off-military');
    if (military && state.year < 21) military.title = '军事官员经营满 20 年后解锁（第 21 年）';
    const taxTip = document.getElementById('tax-adjust-tip');
    if (taxTip) taxTip.textContent = taxAdjustmentText(state, this.ctrl);
  }

  renderLog(state) {
    const list = document.getElementById('log-list');
    // 仅追加最新年份
    const div = document.createElement('div');
    div.innerHTML = state.log
      .map((l, i) => i === 0
        ? `<div class="log-year">${l}</div>`
        : `<div class="log-line">${l}</div>`)
      .join('');
    list.prepend(div);
    // 限制条目数
    while (list.children.length > 30) list.removeChild(list.lastChild);
  }

  showEvent(ev) {
    document.getElementById('event-title').textContent = '📜 ' + ev.title;
    document.getElementById('event-desc').textContent = ev.desc;
    const opts = document.getElementById('event-options');
    opts.innerHTML = '';
    ev.options.forEach((o, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = o.label;
      btn.onclick = () => {
        this.ctrl.chooseEvent(i);
        this.hideEvent();
      };
      opts.appendChild(btn);
    });
    document.getElementById('event-modal').classList.remove('hidden');
  }

  hideEvent() {
    document.getElementById('event-modal').classList.add('hidden');
  }

  warPlan() {
    return {
      conscriptionRate: +document.getElementById('war-conscription').value,
      supplyLevel: +document.getElementById('war-supply').value,
      equipmentLevel: +document.getElementById('war-equipment').value,
    };
  }

  renderWarEstimate() {
    if (!this.ctrl.state.pendingWar) return;
    const estimate = this.ctrl.estimateWar(this.warPlan());
    document.getElementById('war-estimate').textContent =
      `预计征兵 ${estimate.troops} 人；每人费用 ${estimate.perTroop}；本次投入 ${estimate.total}`;
  }

  showWar(war) {
    document.getElementById('war-title').textContent = `⚔ ${war.enemyName}入侵`;
    document.getElementById('war-desc').textContent =
      `敌军强度约 ${war.enemyStrength}，我国可征召 ${war.eligible} 名适龄公民。投入越高胜率越高，但军费和阵亡风险也会扩大。`;
    const t = war.offeredTreaty;
    document.getElementById('war-treaty').textContent =
      `条约方案：立即赔款 ${t.upfront}，持续 ${t.duration} 年，每年固定赔款 ${t.annualFlat}` +
      (t.taxShare ? `，另上缴税收 ${(t.taxShare*100).toFixed(0)}%，税率不得低于 ${(t.minTaxRate*100).toFixed(0)}%` : '，无税率条款');
    this.renderWarEstimate();
    document.getElementById('war-modal').classList.remove('hidden');
  }

  hideWar() { document.getElementById('war-modal').classList.add('hidden'); }

  showEnd(state) {
    const t = document.getElementById('end-title');
    const d = document.getElementById('end-desc');
    if (state.over === 'win') {
      t.textContent = '🎉 千古一帝';
      d.textContent = `章节「${state.chapterName}」目标达成！第 ${state.year} 年。`;
    } else {
      t.textContent = '☠ 游戏结束';
      d.textContent = '原因：' + state.over.replace('lose:', '');
    }
    document.getElementById('end-modal').classList.remove('hidden');
  }
  hideEnd() {
    document.getElementById('end-modal').classList.add('hidden');
  }

  /** 引导：3 步 */
  startTutorial(steps) {
    const box = document.getElementById('tutorial');
    const txt = document.getElementById('tutorial-text');
    let idx = 0;
    const show = () => {
      if (idx >= steps.length) { box.classList.add('hidden'); return; }
      txt.textContent = steps[idx++];
      box.classList.remove('hidden');
    };
    document.getElementById('tutorial-next').onclick = show;
    show();
  }
}

function canAdjustPolicy(state) {
  return !state.over && !state.pendingEvent && !state.pendingWar && (state.year - 1) % 3 === 0;
}

function yearsUntilPolicyWindow(year) {
  return 3 - ((year - 1) % 3);
}

function policyWindowText(year) {
  return (year - 1) % 3 === 0
    ? '政策窗口开放'
    : `政策锁定中，${yearsUntilPolicyWindow(year)} 年后开放`;
}

function taxAdjustmentText(state, ctrl) {
  if (state.treaty?.minTaxRate) return `条约期内税率不得低于 ${(state.treaty.minTaxRate*100).toFixed(0)}%`;
  if (state.people.length <= 100) return '人口不超过 100：税率随常规政策窗口调整';
  const welfare = ctrl.welfareCount();
  if (!welfare) return '人口已超过 100：没有民生官员，税率锁定';
  const interval = ctrl.taxInterval();
  if (ctrl.canAdjustTax()) return `${welfare} 名民生官员：本年可调税（间隔 ${interval} 年）`;
  const remaining = Math.max(0, interval - (state.year - state.lastTaxChangeYear));
  return `${welfare} 名民生官员：${remaining} 年后可再次调税`;
}
