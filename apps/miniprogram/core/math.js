class RNG {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() {
    let x = this.s;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0xFFFFFFFF;
  }
  uniform(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.uniform(a, b + 1)); }
  normal(mean = 0, std = 1) {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  chance(p) { return this.next() < p; }
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
function productDemand(s, a1=12, a2=15) { return Math.max(0, -(s-a1)*(s-a2)+2); }
function wealthGapPenalty(d) {
  const dd = d/10;
  return clamp(2*Math.atan(1.8) + 2*Math.atan(2*dd-1.8), 0, 8);
}
function deathProb(age, deathStart=50, hardCap=90) {
  if (age < deathStart) return 0;
  if (age >= hardCap) return 1;
  return clamp(1 - 1/Math.max(age-deathStart+1,1), 0, 1);
}
module.exports = { RNG, clamp, productDemand, wealthGapPenalty, deathProb };
