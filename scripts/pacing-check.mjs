import assert from 'node:assert/strict';
import { newGame, nextYear, applyEventOption, applyWarDecision, serialize, deserialize } from '../packages/core/src/game.js';
import { EVENTS, EVENT_PRESENTATION, rollEvent } from '../packages/core/src/events.js';
import { seedPopulation, recordPersonHistory, aggregate } from '../packages/core/src/person.js';

for (const event of EVENTS) {
  assert(EVENT_PRESENTATION[event.category], event.id + ' must have an explicit category');
  for (const option of event.options) {
    assert(option.hiddenEffects.morality && option.hiddenEffects.rationality);
    assert(option.tradeoffs.benefit && option.tradeoffs.cost);
  }
}
let events = 0, forced = 0;
for (let seed = 1; seed <= 100; seed++) {
  let s = newGame({ seed });
  let sinceGood = 0;
  for (let year = 0; year < 150; year++) {
    if (s.pendingEvent) {
      const e = s.pendingEvent;
      if (sinceGood === 3) { assert.equal(e.category, 'good'); forced++; }
      sinceGood = e.category === 'good' ? 0 : sinceGood + 1;
      assert(sinceGood <= 3); events++;
      const cost = Number(e.options[0].label.match(/国库\s*-\s*(\d+)/)?.[1] || 0);
      applyEventOption(s, s.treasury >= cost + 100 ? 0 : 1);
    }
    if (s.pendingWar) applyWarDecision(s, { action: 'treaty' });
    if (year % 7 === 0) s = deserialize(serialize(s));
    nextYear(s);
  }
}
assert(forced > 100);
console.log(`PASS ${events} events across 100 × 150 years; ${forced} guaranteed positive beats, including repeated save/load`);

const s = newGame({ seed: 23 });s.year = 20;s.eventsSincePositive = 3;
const restored = deserialize(serialize(s));
restored.rng.chance = () => false;
assert.equal(rollEvent(restored), null);assert.equal(restored.eventsSincePositive, 3);
restored.rng.chance = () => true;
assert.equal(rollEvent(restored).category, 'good');
restored.pendingWar = { enemyName: 'test' };
const rngBefore = restored.rng.s;
assert.equal(rollEvent(restored), null);assert.equal(restored.rng.s, rngBefore);
restored.pendingWar = null;restored.pendingEvent = EVENTS[0];
assert.equal(rollEvent(restored), null);
console.log('PASS empty years do not consume guarantee; pending wars/events cannot be overwritten');

for (const population of [300, 301, 2000]) {
  const a = newGame({ seed: 4 });a.people = seedPopulation(a.rng, { farmer: population });
  for (let year = 1; year <= 400; year++) recordPersonHistory(a.people, year, a.cfg);
  assert(a.people.every(p => p.history.length === (population <= 300 ? 12 : 0)));
  const old = JSON.parse(serialize(a));
  old.people.forEach(p => { p.history = Array.from({length:120}, (_,i) => ({year:i,klass:p.klass,satisfaction:12})); });
  old.history = Array.from({length:1000}, (_,i) => ({year:i}));
  old.storyHooks = Array.from({length:1000}, (_,i) => ({topic:'test-'+i}));
  const loaded = deserialize(JSON.stringify(old));
  assert(loaded.people.every(p => p.history.length === (population <= 300 ? 12 : 0)));
  assert.equal(loaded.history.length,240);assert.equal(loaded.history[0].year,760);
  assert.equal(loaded.storyHooks.length,30);
  if (population > 300) {
    loaded.people = loaded.people.slice(0,300);recordPersonHistory(loaded.people,1001,loaded.cfg);
    assert(loaded.people.every(p=>p.history.length===1&&p.history[0].year===1001));
  }
}
console.log('PASS 300/301/2000 history bounds, legacy-save pruning and fresh history after returning below threshold');

const long = newGame({seed:3});
for(let i=0;i<600&&!long.over;i++) {
  if(long.pendingEvent)applyEventOption(long,long.treasury>=400?0:1);
  if(long.pendingWar)applyWarDecision(long,{action:'treaty'});
  nextYear(long);
  assert(long.history.length<=240&&long.storyHooks.length<=30);
  assert(long.people.every(p=>p.history.length<=(long.people.length>300?0:12)));
}
assert(long.year>500);
console.log('PASS 600-year long session has bounded histories');

const a = newGame({seed:101}), b = deserialize(serialize(a));
b.morality = 100000;b.rationality = -100000;
for(let i=0;i<100;i++) {
  for(const state of [a,b]) {
    if(state.pendingEvent)applyEventOption(state,0);
    if(state.pendingWar)applyWarDecision(state,{action:'treaty'});
    nextYear(state);
  }
  assert.deepEqual(a.stats,b.stats);assert.equal(a.treasury,b.treasury);assert.equal(a.pendingEvent?.id,b.pendingEvent?.id);
}
console.log('PASS hidden morality/rationality still only record decisions, never affect play');
