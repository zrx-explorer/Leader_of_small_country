import { newGame, nextYear, applyEventOption, applyWarDecision } from '../packages/core/src/game.js';

const runs = [];
for (let seed = 1; seed <= 40; seed++) {
  const s = newGame({ seed });
  let starvation = 0;
  while (s.year <= 120 && !s.over) {
    if (process.argv.includes('--peaceful')) { s.pendingEvent=null; s.pendingWar=null; }
    if (s.pendingEvent) {
      const cost = Number(s.pendingEvent.options[0].label.match(/国库\s*-\s*(\d+)/)?.[1] || 0);
      applyEventOption(s, s.treasury >= cost + 100 ? 0 : 1);
    }
    if (s.pendingWar) applyWarDecision(s, { action: process.argv.includes('--fight') ? 'fight' : 'treaty', conscriptionRate:.2,supplyLevel:2,equipmentLevel:2 });
    nextYear(s);
    for (const line of s.log) starvation += Number(line.match(/饥饿 (\d+)/)?.[1] || 0);
  }
  runs.push({ seed, year: s.year, population: s.stats.total, treasury: Math.round(s.treasury), satisfaction: s.stats.avgSatisfaction, score: s.score?.total, starvation, over: s.over });
}
console.log(JSON.stringify({ survived: runs.filter(r => !r.over).length, total: runs.length, examples: runs.slice(0, 8), failures: runs.filter(r => r.over) }, null, 2));
if (process.argv.includes('--assert') && runs.some(r => r.over)) process.exitCode = 1;
