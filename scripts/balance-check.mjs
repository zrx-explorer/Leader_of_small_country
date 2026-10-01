import { newGame, nextYear, applyEventOption, applyWarDecision } from '../packages/core/src/game.js';

const args = process.argv.slice(2);
const numericOption = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} requires a positive integer`);
  return value;
};
const count = numericOption('--seeds', 40);
const years = numericOption('--years', 120);
// 非相邻种子覆盖真实 Date.now() 开局，而不只验证小整数种子。
function mixedSeed(index) {
  let value = (index + 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) || 1;
}
const runs = [];
for (let index = 1; index <= count; index++) {
  const seed = args.includes('--mixed') ? mixedSeed(index) : index;
  const s = newGame({ seed });
  let starvation = 0;
  while (s.year <= years && !s.over) {
    if (process.argv.includes('--peaceful')) { s.pendingEvent=null; s.pendingWar=null; }
    if (s.pendingEvent) {
      const cost = Number(s.pendingEvent.options[0].label.match(/国库\s*-\s*(\d+)/)?.[1] || 0);
      applyEventOption(s, s.treasury >= cost + 100 ? 0 : 1);
    }
    if (s.pendingWar) applyWarDecision(s, { action: process.argv.includes('--fight') ? 'fight' : 'treaty', conscriptionRate:.2,supplyLevel:2,equipmentLevel:2 });
    nextYear(s);
    if (![s.treasury, s.stats.avgSatisfaction, s.score.total].every(Number.isFinite)) throw new Error(`Non-finite state: seed ${seed}, year ${s.year}`);
    for (const line of s.log) starvation += Number(line.match(/饥饿 (\d+)/)?.[1] || 0);
  }
  runs.push({ seed, year: s.year, population: s.stats.total, treasury: Math.round(s.treasury), satisfaction: s.stats.avgSatisfaction, score: s.score?.total, starvation, over: s.over });
}
console.log(JSON.stringify({ years, survived: runs.filter(r => !r.over).length, total: runs.length,
  scoreRange: [Math.min(...runs.map(r => r.score)), Math.max(...runs.map(r => r.score))],
  examples: runs.slice(0, 3), failures: runs.filter(r => r.over) }, null, 2));
if (process.argv.includes('--assert') && runs.some(r => r.over)) process.exitCode = 1;
