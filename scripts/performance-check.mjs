import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { newGame, nextYear, serialize } from '../packages/core/src/game.js';
import { seedPopulation, aggregate, recordPersonHistory, trimPersonHistory } from '../packages/core/src/person.js';
import { trade, consume } from '../packages/core/src/economy.js';

const strict = process.argv.includes('--assert');
const results = [];
for (const population of [300, 301, 800, 2000]) {
  const state = newGame({ seed: 20261003 });
  state.people = seedPopulation(state.rng, {
    farmer: Math.floor(population * .6), worker: Math.floor(population * .25),
    merchant: Math.floor(population * .05),
    official: population - Math.floor(population * .6) - Math.floor(population * .25) - Math.floor(population * .05),
  });
  state.stats = aggregate(state.people);
  // Isolate history retention at a fixed population (natural deaths must not hide growth).
  for (let year = 1; year <= 240; year++) recordPersonHistory(state.people, year, state.cfg);
  const entries = state.people.reduce((n, p) => n + p.history.length, 0);
  const bytes = Buffer.byteLength(serialize(state));
  const timings = [];
  for (let round = 0; round < 12; round++) {
    for (const [i, p] of state.people.entries()) {
      p.age = i % 5 === 0 ? 8 : 30; p.grain = 180 + i % 17; p.product = p.klass === 'worker' ? 18 : 0;
    }
    const start = performance.now();
    trade(state.people, state.cfg, state.rng, []); consume(state.people, state.cfg);
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  const annual = performance.now(); nextYear(state);
  results.push({ population, personHistoryEntries: entries, saveKiB: +(bytes / 1024).toFixed(1), marketConsumeMedianMs: +timings[6].toFixed(2), annualMs: +(performance.now() - annual).toFixed(2) });
  if (strict) assert(entries <= (population > state.cfg.bucketModeThreshold ? 0 : population * state.cfg.personHistoryLimit));
}
console.log(JSON.stringify(results, null, 2));

if (global.gc) {
  const state = newGame({seed:12});
  state.people = seedPopulation(state.rng, {farmer:1200,worker:500,merchant:100,official:200});
  // Recreate legacy retained objects, then measure the same state after pruning.
  for (const person of state.people) person.history = Array.from({length:120},(_,year)=>({year,klass:person.klass,satisfaction:12}));
  global.gc();const legacyHeap=process.memoryUsage().heapUsed;
  trimPersonHistory(state.people,state.cfg);
  global.gc();const boundedHeap=process.memoryUsage().heapUsed;
  console.log(JSON.stringify({heapMiB:{legacy:+(legacyHeap/1048576).toFixed(2),bounded:+(boundedHeap/1048576).toFixed(2),released:+((legacyHeap-boundedHeap)/1048576).toFixed(2)},note:'V8 retained heap in this process, not whole-browser memory'},null,2));
  assert(state.people.every(p=>p.history.length===0));
} else console.log('INFO use node --expose-gc scripts/performance-check.mjs --assert for retained-heap measurement');
