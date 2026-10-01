/** 短暂的年度流转过渡；快进整批只等待一次，可主动跳过动画。 */
export function createYearTransition() {
  const style = document.createElement('style');
  style.textContent = `.year-transition{position:fixed;inset:0;z-index:100;background:#172b3dcc;display:grid;place-items:center;padding:20px}.year-transition[hidden]{display:none}.year-transition-card{width:min(440px,100%);padding:26px;background:#fffaf0;color:#263645;border-radius:16px;box-shadow:0 20px 80px #0005;text-align:center}.year-transition-scene{width:100%;height:130px;border-radius:10px;background:linear-gradient(#c9dce4,#f0e0b8);overflow:hidden}.year-transition h2{margin:16px 0 8px}.year-transition progress{width:100%;height:18px;accent-color:#b84032}.year-transition p{font-size:14px}.year-transition button{margin-top:8px;background:transparent;border:1px solid #c5bca8;border-radius:6px;padding:8px 16px;color:#263645;cursor:pointer}.year-transition-sun{animation:year-sun 1.6s ease-in-out infinite alternate;transform-origin:center}@keyframes year-sun{to{transform:translateX(28px)}}@media(prefers-reduced-motion:reduce){.year-transition-sun{animation:none}}`;
  document.head.appendChild(style);
  const overlay = document.createElement('div');
  overlay.className = 'year-transition';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '年度流转');
  overlay.innerHTML = `<div class="year-transition-card"><svg class="year-transition-scene" viewBox="0 0 400 130" aria-hidden="true"><circle class="year-transition-sun" cx="285" cy="34" r="18" fill="#dfb443"/><path d="M0 100L70 38 150 100 225 55 330 110 400 65V130H0" fill="#819d8d"/><path d="M0 115Q100 88 200 114T400 109V130H0" fill="#536f61"/><path d="M128 110V72H171V110M121 73L149 53 178 73" fill="#b84032"/><path d="M144 110V89H156V110" fill="#f7e7c9"/></svg><h2>四时流转 · 年度结算</h2><p class="year-transition-phase" role="status" aria-live="polite"></p><progress max="100" value="0" aria-label="年度过渡进度"></progress><p>稍候片刻，新的年度即将展开</p><button type="button">跳过动画</button></div>`;
  document.body.appendChild(overlay);
  const progress = overlay.querySelector('progress');
  const phase = overlay.querySelector('.year-transition-phase');
  const skip = overlay.querySelector('button');
  let busy = false;
  return {
    get busy() { return busy; },
    async run(work, { year, fast = false } = {}) {
      if (busy) return false;
      busy = true;
      const focused = document.activeElement;
      const roots = [...document.body.children].filter(el => el !== overlay && !['SCRIPT','STYLE'].includes(el.tagName));
      const previousInert = roots.map(el => el.inert);
      for (const root of roots) root.inert = true;
      document.body.setAttribute('aria-busy', 'true');
      overlay.hidden = false;
      progress.value = 0;
      phase.textContent = `第 ${year} 年 · ${fast ? '推进至下一次决策' : '田野与作坊'}`;
      skip.focus();
      let timer;
      try {
        await new Promise(resolve => {
          const started = performance.now();
          const duration = fast ? 2000 : 1600;
          const finish = () => { clearInterval(timer); progress.value = 100; resolve(); };
          skip.onclick = finish;
          timer = setInterval(() => {
            const value = Math.min(100, (performance.now() - started) / duration * 100);
            progress.value = value;
            phase.textContent = value < 35 ? '春耕秋收 · 生产与商贸' : value < 70 ? '朝堂议事 · 财政与民生' : '岁末回顾 · 人口与年度变化';
            if (value >= 100) finish();
          }, 80);
        });
        await work();
        return true;
      } finally {
        clearInterval(timer);
        skip.onclick = null;
        busy = false;
        overlay.hidden = true;
        roots.forEach((el,i) => { el.inert = previousInert[i]; });
        document.body.removeAttribute('aria-busy');
        if (focused?.isConnected && !document.querySelector('.modal:not(.hidden)')) focused.focus();
      }
    },
  };
}
