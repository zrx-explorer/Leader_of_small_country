import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as engine from '../packages/core/src/game.js';
const require=createRequire(import.meta.url);
const mini=require('../apps/miniprogram/core/game.js');
const html=fs.readFileSync(new URL('../play.html',import.meta.url),'utf8');
const bundle=html.match(/<!-- BEGIN GENERATED CORE -->\s*<script>([\s\S]*?)<\/script>/)[1];
const context=vm.createContext({});
vm.runInContext(bundle,context);
const standalone=vm.runInContext('GameCore.game',context);
for(let seed=1;seed<=12;seed++){
  const games=[engine,mini,standalone];
  const states=games.map(g=>g.newGame({seed}));
  for(let year=0;year<120;year++){
    games.forEach((g,i)=>{
      const s=states[i];
      if(s.pendingEvent){
        const cost=Number(s.pendingEvent.options[0].label.match(/国库\s*-\s*(\d+)/)?.[1]||0);
        g.applyEventOption(s,s.treasury>=cost+100?0:1);
      }
      if(s.pendingWar)g.applyWarDecision(s,{action:'treaty'});
      g.nextYear(s);
      assert.equal(s.over,null,`seed ${seed} year ${year+1}`);
      assert(s.people.every(p=>[p.grain,p.product,p.intelligence,p.satisfaction].every(Number.isFinite)));
    });
    for(const s of states.slice(1)){
      assert.equal(JSON.stringify(s.stats),JSON.stringify(states[0].stats));
      assert.equal(s.treasury,states[0].treasury);
      assert.equal(s.morality,states[0].morality);
      assert.equal(s.rationality,states[0].rationality);
      assert.equal(s.score.total,states[0].score.total);
    }
  }
}
console.log('PASS ES modules / CommonJS / standalone: 12 seeds × 120 years identical and alive');

const saveState=engine.newGame({seed:87});
saveState.over='lose:测试';saveState.consecutiveBadYears=3;
const restored=engine.deserialize(engine.serialize(saveState));
assert.equal(restored.over,saveState.over);assert.equal(restored.consecutiveBadYears,3);
console.log('PASS save/load preserves terminal state and failure counters');
const oldSave=JSON.parse(engine.serialize(engine.newGame({seed:99})));
delete oldSave.rngState;
const compatible=engine.deserialize(JSON.stringify(oldSave));
engine.nextYear(compatible);
assert.equal(compatible.year,2,'Old save without RNG state must still advance');
console.log('PASS old saves without RNG state do not enter a zero-state loop');

const poor=engine.newGame({seed:3});
poor.policy.tax={farmer:0,worker:0,merchant:0};poor.policy.officialWage=100;poor.treasury=0;
poor.people.forEach(p=>{p.grain=0;p.product=0;p.satisfaction=-30;});
for(let i=0;i<30&&!poor.over;i++){
  poor.pendingEvent=null;poor.pendingWar=null;engine.nextYear(poor);
}
assert(poor.over || poor.score.total<35,'Destructive policy should not earn a healthy score');
console.log('PASS harmful policies remain costly; low scores are not an automatic defeat');

// 小程序页面采用最小运行环境，验证锁定、跳过动画和离开页面取消。
const app={globalData:{state:mini.newGame({seed:98})},api:mini};
let page;const pageContext=vm.createContext({getApp:()=>app,Page:definition=>{page=definition;},wx:{showToast(){}},setInterval,clearInterval,Date});
vm.runInContext(fs.readFileSync(new URL('../apps/miniprogram/pages/index/index.js',import.meta.url),'utf8'),pageContext);
page.setData=values=>Object.assign(page.data,values);
page.onNextYear();page.onNextYear();
assert.equal(app.globalData.state.year,1);assert.equal(app.globalData.busy,true);
page.onSkipTransition();assert.equal(app.globalData.state.year,2);assert.equal(app.globalData.busy,false);
app.globalData.state.pendingEvent=null;app.globalData.state.pendingWar=null;
page.onNextYear();page.onHide();
assert.equal(app.globalData.state.year,2);assert.equal(app.globalData.busy,false);
assert.equal(page.finishTransition,null);
console.log('PASS miniprogram duplicate taps, animation skip and navigation cancellation');
