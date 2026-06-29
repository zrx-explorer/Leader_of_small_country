/**
 * 数学工具：可复现的随机数 + 常用分布
 */

export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  // 32-bit xorshift，可复现
  next() {
    let x = this.s;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0xFFFFFFFF;
  }
  uniform(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.uniform(a, b + 1)); }
  // Box-Muller 正态分布
  normal(mean = 0, std = 1) {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  chance(p) { return this.next() < p; }
}

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** 产品需求曲线 fn = -(s-a1)*(s-a2)+2，限制非负 */
export function productDemand(s, a1 = 12, a2 = 15) {
  return Math.max(0, -(s - a1) * (s - a2) + 2);
}

/** 阶级财富落差惩罚（v1 公式参数收口） */
export function wealthGapPenalty(d) {
  // 原公式 fs = 2*atan(18) + 2*atan(2d-18) 当 d=0 时 ≈ π，太陡；按 d/10 缩放
  const dd = d / 10;
  return clamp(2 * Math.atan(1.8) + 2 * Math.atan(2 * dd - 1.8), 0, 8);
}

/** 死亡概率（修复 v1 除零） */
export function deathProb(age, deathStart = 50, hardCap = 90) {
  if (age < deathStart) return 0;
  if (age >= hardCap) return 1;
  const t = (age - deathStart) / (hardCap - deathStart);
  return clamp(0.015 + t * t * 0.22, 0, 0.6);
}
