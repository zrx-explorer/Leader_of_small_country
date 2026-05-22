/**
 * 简易 Canvas 图表（无第三方依赖）
 */

const COLORS = { farmer:'#2ecc71', worker:'#3498db', merchant:'#d4a017', official:'#8e44ad' };
const LABEL  = { farmer:'农民', worker:'工人', merchant:'商人', official:'公务员' };

/** 阶级人口饼图 */
export function drawClassPie(canvas, byClass) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const total = Object.values(byClass).reduce((a,b)=>a+b,0);
  if (total === 0) {
    ctx.fillStyle = '#999'; ctx.font='14px sans-serif';
    ctx.fillText('暂无人口', W/2-30, H/2);
    return;
  }
  const cx=W/2, cy=H/2-10, r=Math.min(W,H)/2-30;
  let start = -Math.PI/2;
  for (const [k, v] of Object.entries(byClass)) {
    if (!v) continue;
    const ang = (v/total)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,start+ang);
    ctx.closePath();
    ctx.fillStyle = COLORS[k]; ctx.fill();
    start += ang;
  }
  // 图例
  let lx=10, ly=H-50;
  ctx.font='11px sans-serif';
  for (const [k,v] of Object.entries(byClass)) {
    ctx.fillStyle=COLORS[k];
    ctx.fillRect(lx,ly,10,10);
    ctx.fillStyle='#333';
    ctx.fillText(`${LABEL[k]} ${v}`, lx+14, ly+9);
    lx += 70;
    if (lx > W-60) { lx=10; ly+=14; }
  }
}

/** 历史曲线（人口/满意度/国库） */
export function drawHistory(canvas, history) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  if (history.length < 2) {
    ctx.fillStyle='#999'; ctx.font='12px sans-serif';
    ctx.fillText('开始游戏后绘制历史曲线…', 10, H/2);
    return;
  }
  const pad = {l:30,r:10,t:10,b:24};
  const w = W-pad.l-pad.r, h = H-pad.t-pad.b;
  ctx.strokeStyle='#ddd'; ctx.lineWidth=1;
  ctx.strokeRect(pad.l, pad.t, w, h);

  // X 轴：年份
  const minY = history[0].year, maxY = history[history.length-1].year;
  const xMap = y => pad.l + (y-minY)/(maxY-minY||1) * w;

  function drawLine(getter, color, normalize) {
    const vals = history.map(getter);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const range = hi-lo || 1;
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=2;
    history.forEach((p,i)=>{
      const x = xMap(p.year);
      const y = pad.t + h - ((vals[i]-lo)/range) * h;
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    });
    ctx.stroke();
  }

  drawLine(p=>p.population, '#3498db');
  drawLine(p=>p.avgSatisfaction, '#2ecc71');
  drawLine(p=>p.treasury, '#d4a017');

  ctx.fillStyle='#666'; ctx.font='10px sans-serif';
  ctx.fillText(`第 ${minY}-${maxY} 年`, pad.l, H-6);
}
