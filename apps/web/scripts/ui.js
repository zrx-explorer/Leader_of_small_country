/**
 * UI 绑定：DOM ↔ 游戏状态
 */
import { drawClassPie, drawHistory } from './charts.js';

export class UI {
  constructor(controller) {
    this.ctrl = controller;
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

    // 按钮
    document.getElementById('btn-next').onclick     = () => this.ctrl.nextYear();
    document.getElementById('btn-save').onclick     = () => this.ctrl.save();
    document.getElementById('btn-load').onclick     = () => this.ctrl.load();
    document.getElementById('btn-restart').onclick  = () => this.ctrl.restart();
    document.getElementById('end-restart').onclick  = () => {
      this.hideEnd();
      this.ctrl.restart();
    };
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
    document.getElementById('hud-treasury').textContent = state.treasury.toFixed(0);
    document.getElementById('hud-sat').textContent = state.stats.avgSatisfaction;
    document.getElementById('hud-int').textContent = state.stats.avgIntelligence;
    document.getElementById('hud-crim').textContent = state.stats.criminals;

    // 章节进度
    document.getElementById('chapter-tip').textContent =
      `章节 ${state.chapter} · ${state.chapterName}`;

    // 图表
    drawClassPie(document.getElementById('chart-class'), state.stats.byClass);
    drawHistory(document.getElementById('chart-history'), state.history);

    // 日志
    this.renderLog(state);

    // 事件
    if (state.pendingEvent) this.showEvent(state.pendingEvent);
    else this.hideEvent();

    // 结算
    if (state.over) this.showEnd(state);
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
