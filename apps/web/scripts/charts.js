/**
 * 简易 Canvas 图表（无第三方依赖）
 */

const COLORS = { farmer:'#2ecc71', worker:'#3498db', merchant:'#d4a017', official:'#8e44ad' };
const LABEL  = { farmer:'农民', worker:'工人', merchant:'商人', official:'公务员' };

export function formatCompactNumber(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(abs >= 10000000 ? 0 : 1)}M`;
  if (abs >= 10000) return `${(n / 10000).toFixed(abs >= 100000 ? 0 : 1)}万`;
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

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
export function drawHistory(canvas, history, view = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  if (history.length < 2) {
    ctx.save();
    ctx.strokeStyle = '#e8e1d3';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 24, W - 56, H - 48);
    ctx.fillStyle = '#b7b0a3';
    ctx.font = '600 18px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('推进几年后显示人口、满意度、国库曲线', W / 2, H / 2);
    ctx.restore();
    return;
  }
  const firstYear = history[0].year;
  const lastYear = history[history.length - 1].year;
  const startYear = view.startYear ?? firstYear;
  const endYear = view.endYear ?? lastYear;
  const visible = history.filter(p => p.year >= startYear && p.year <= endYear);
  const points = visible.length >= 2 ? visible : history.slice(-2);
  const pad = {l:38,r:16,t:32,b:34};
  const w = W-pad.l-pad.r, h = H-pad.t-pad.b;
  ctx.strokeStyle='#ddd'; ctx.lineWidth=1;
  ctx.strokeRect(pad.l, pad.t, w, h);

  // X 轴：年份
  const minY = points[0].year, maxY = points[points.length-1].year;
  const xMap = y => pad.l + (y-minY)/(maxY-minY||1) * w;

  function drawLine(getter, color) {
    const vals = points.map(getter);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const range = hi-lo || 1;
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=2;
    points.forEach((p,i)=>{
      const x = xMap(p.year);
      const y = pad.t + h - ((vals[i]-lo)/range) * h;
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    });
    ctx.stroke();
  }

  drawLine(p=>p.population, '#3498db');
  drawLine(p=>p.avgSatisfaction, '#2ecc71');
  drawLine(p=>p.treasury, '#d4a017');

  ctx.fillStyle='#8a8174'; ctx.font='10px sans-serif'; ctx.textAlign='center';
  const tickCount = Math.min(6, Math.max(2, maxY - minY + 1));
  for (let i = 0; i < tickCount; i++) {
    const year = Math.round(minY + (maxY - minY) * i / (tickCount - 1 || 1));
    const x = xMap(year);
    ctx.fillText(`${year}年`, x, H - 13);
    ctx.strokeStyle = '#eee';
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + h);
    ctx.stroke();
  }
  ctx.textAlign='left';

  const latest = points[points.length - 1];
  const items = [
    { label: `人口 ${latest.population}`, color: '#3498db' },
    { label: `满意度 ${latest.avgSatisfaction}`, color: '#2ecc71' },
    { label: `国库 ${formatCompactNumber(latest.treasury)}`, color: '#d4a017' },
  ];
  let x = pad.l, y = 16;
  ctx.font='11px sans-serif';
  for (const item of items) {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 18, y);
    ctx.stroke();
    ctx.fillStyle = '#54667a';
    ctx.fillText(item.label, x + 23, y + 4);
    x += 118;
  }

  if (view.hoverYear != null) {
    const hover = points.reduce((best, p) =>
      Math.abs(p.year - view.hoverYear) < Math.abs(best.year - view.hoverYear) ? p : best,
      points[0]);
    const hx = xMap(hover.year);
    ctx.strokeStyle = '#2c3e50';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(hx, pad.t);
    ctx.lineTo(hx, pad.t + h);
    ctx.stroke();
    ctx.setLineDash([]);
    const lines = [
      `第 ${hover.year} 年`,
      `人口 ${hover.population}`,
      `满意度 ${hover.avgSatisfaction}`,
      `国库 ${formatCompactNumber(hover.treasury)} (${hover.treasury})`,
    ];
    const boxW = 142, boxH = 70;
    const bx = Math.min(W - boxW - 8, Math.max(8, hx + 10));
    const by = pad.t + 8;
    ctx.fillStyle = 'rgba(253,250,242,.96)';
    ctx.strokeStyle = '#d8cfb6';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);
    ctx.fillStyle = '#2c3e50';
    ctx.font = '11px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, bx + 8, by + 16 + i * 14));
  }

  ctx.fillStyle='#666'; ctx.font='10px sans-serif';
  ctx.fillText(`第 ${minY}-${maxY} 年`, pad.l, H-6);
}

export function yearAtCanvasX(canvas, history, view, clientX) {
  if (history.length < 2) return null;
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const pad = {l:38,r:16};
  const firstYear = history[0].year;
  const lastYear = history[history.length - 1].year;
  const minY = view.startYear ?? firstYear;
  const maxY = view.endYear ?? lastYear;
  const t = Math.max(0, Math.min(1, (x - pad.l) / (canvas.width - pad.l - pad.r)));
  return Math.round(minY + (maxY - minY) * t);
}
