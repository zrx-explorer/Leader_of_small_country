// 单文件界面的薄适配层；年度模拟、事件、战争与存档都使用共享核心。
const C = { ...GameCore.config.DEFAULT_CONFIG };
const cls = ['farmer','worker','merchant','official'];
const colors = { farmer:'#2f9d63',worker:'#2f80c9',merchant:'#c49321',official:'#7d4ca0' };
const names = { farmer:'农民',worker:'工人',merchant:'商人',official:'公务员' };
const RNG = GameCore.math.RNG;
Object.assign(RNG.prototype, { u: RNG.prototype.uniform, i: RNG.prototype.int, n: RNG.prototype.normal, c: RNG.prototype.chance });
const clamp = GameCore.math.clamp;
const compact = n => { n=Number(n)||0; const a=Math.abs(n);return a>=1e6?(n/1e6).toFixed(1)+'M':a>=1e4?(n/1e4).toFixed(1)+'万':a>=1e3?(n/1e3).toFixed(1)+'K':String(Math.round(n)); };
let uid=0,state,selectedId=null,chartView={start:null,end:null,hover:null};
const transition = createYearTransition();
const warBadge=document.createElement('span');warBadge.className='event-badge';warBadge.textContent='▲ 坏事件 · 战争';
document.querySelector('#warModal .box').prepend(warBadge);
const EVENTS = GameCore.events.EVENTS.map(e => [e.id,e.title,e.desc,e.options.map(o => [o.label,o.apply,o.hiddenEffects]),e.condition,e.weight]);
function person(r,k,age) { return GameCore.person.createPerson(r,k,age); }
function rec() { GameCore.person.recordPersonHistory(state.people,state.year); }
function stat() {
  state.stats=GameCore.person.aggregate(state.people);state.score=GameCore.score.governanceScore(state);
  let notice=document.getElementById('policy-health-notice');
  if(!notice){notice=document.createElement('p');notice.id='policy-health-notice';notice.className='year-delta';notice.setAttribute('role','status');document.getElementById('yearDelta').after(notice);}
  notice.textContent=GameCore.game.policyNotice(state);notice.hidden=!notice.textContent;
}
function newGame() { state=GameCore.game.newGame({seed:Date.now()});selectedId=state.people[0]?.id; }
function loadStandaloneSave(saved) {
  const o=JSON.parse(saved);
  const aliases={harvest:'good_harvest',merchant:'merchant_caravan',rebellion:'rebellion_warning',noble:'noble_invite',workshop:'workshop_dispute',refugees:'refugees_at_gate',canal:'canal_dispute',omen:'celestial_omen'};
  o.pendingEventId=aliases[o.pendingEventId]||o.pendingEventId;
  o.recentEventIds=(o.recentEventIds||[]).map(id=>aliases[id]||id);
  o.chapter=o.chapter||1;
  o.rngState=o.rngState??o.rng?.s;
  o.consecutiveBadYears=o.consecutiveBadYears??o.bad??0;
  o.consecutiveCrimeYears=o.consecutiveCrimeYears??o.crime??0;
  o.consecutiveLowSatYears=o.consecutiveLowSatYears??o.low??0;
  if(o.goalMet){o.flags=o.flags||{};o.flags.chapterGoalMet=true;}
  state=GameCore.game.deserialize(JSON.stringify(o));withCore(()=>{});
}
function withCore(work) {
  if (Array.isArray(state.pendingEvent)) state.pendingEvent=GameCore.events.EVENTS.find(e=>e.id===state.pendingEvent[0])||null;
  try { return work(); }
  finally { if(state.pendingEvent&&!Array.isArray(state.pendingEvent))state.pendingEvent=EVENTS.find(e=>e[0]===state.pendingEvent.id)||null; }
}
function stepYear() { withCore(()=>GameCore.game.nextYear(state)); }
function appendYearLog() {
  const container=document.getElementById('log'),key=state.log[0]||'year-'+state.year;
  const block=document.createElement('div');block.dataset.logKey=key;
  state.log.forEach((text,index)=>{const row=document.createElement('div');row.className=index?'line event-'+GameCore.events.eventLogCategory(text):'year';row.textContent=text;block.appendChild(row);});
  if(container.firstElementChild?.dataset.logKey===key)container.firstElementChild.replaceWith(block);else container.prepend(block);
  while(container.children.length>30)container.lastElementChild.remove();
}
function nextYear() {
  if(state.over||state.pendingEvent||state.pendingWar)return;
  return transition.run(()=>{stepYear();},{year:state.year}).then(completed=>{if(completed)render();});
}
function fastForward() {
  if(state.over||state.pendingEvent||state.pendingWar)return;
  return transition.run(()=>{for(let i=0;i<3;i++){stepYear();appendYearLog();if(state.over||state.pendingEvent||state.pendingWar||(state.year-1)%3===0)break;}},{year:state.year,fast:true}).then(completed=>{if(completed)render();});
}
function applyPreset(id) { if(!policyOpen())return;GameCore.game.applyPolicyPreset(state,id,{includeTax:taxOpen()});render(); }
function warCost(plan) { return GameCore.game.estimateWarCost(state,plan); }
function eligible() { return GameCore.war.eligibleConscripts(state.people); }
function decideWar(action,plan={}) { if(transition.busy)return;GameCore.game.applyWarDecision(state,{...plan,action});render(); }
function warPlan(){return{conscriptionRate:+warRate.value,supplyLevel:+warSupply.value,equipmentLevel:+warEquip.value};}
function updateWarEstimate(){if(!state.pendingWar)return;const c=warCost(warPlan());warEstimate.textContent='预计征兵'+c.troops+'人，每人费用'+c.perTroop+'，总投入'+c.total;}
function showWar(){const w=state.pendingWar,t=w.offeredTreaty;warTitle.textContent='⚔ '+w.enemyName+'入侵';warDesc.textContent='敌军强度'+w.enemyStrength+'，可征召'+w.eligible+'名适龄公民';warTreaty.textContent='条约：立即赔款'+t.upfront+'，持续'+t.duration+'年，每年固定'+t.annualFlat+(t.taxShare?'，另付税收'+Math.round(t.taxShare*100)+'%，税率不低于'+Math.round(t.minTaxRate*100)+'%':'，无税率条款');updateWarEstimate();warModal.classList.remove('hidden');}
function rollEvent(){return withCore(()=>{const e=GameCore.events.rollEvent(state);return e?EVENTS.find(x=>x[0]===e.id):null;});}

function renderPeople() {
  const grouped=GameCore.person.isAggregateMode(state.people,state.cfg);
  peopleGrid.classList.toggle('population-overview',grouped);
  peopleGrid.parentElement.classList.toggle('aggregate-mode',grouped);
  document.querySelector('.people-head b').textContent=grouped?'国民阶层':'国民个体';
  document.querySelector('.people-head span').textContent=grouped?`人口超过 ${state.cfg.bucketModeThreshold}，仅显示阶层汇总`:'点击头像查看近 12 年履历';
  if(grouped) {
    selectedId=null;
    peopleGrid.innerHTML=cls.map(k=>`<section class="population-group"><h4>${names[k]} <b>${state.stats.byClass[k]} 人</b></h4><p>平均满意 ${state.stats.classSat[k].toFixed(1)}</p><p>人均资产 ${compact(state.stats.classWealth[k])}</p></section>`).join('');
    personDetail.textContent='群体模式不显示个人资料，也不保存个人履历。人口回到阈值以内后恢复记录；国家曲线保留最近 240 年。满意度不含罪犯，资产折合粮食。';
    return;
  }
  if(!state.people.some(p=>p.id===selectedId))selectedId=state.people[0]?.id;
  peopleGrid.innerHTML=state.people.map(p=>`<button class="avatar ${p.id===selectedId?'active':''}" data-id="${p.id}"><span class="face" style="background:${colors[p.klass]}">${(p.name||'民').slice(0,1)}</span><span class="aname">${p.name||('无名'+p.id)}</span><span class="asat">满意 ${p.satisfaction.toFixed(1)}</span></button>`).join('');
  peopleGrid.querySelectorAll('.avatar').forEach(b=>b.onclick=()=>{selectedId=+b.dataset.id;renderPeople();});
  const p=state.people.find(x=>x.id===selectedId);
  if(!p){personDetail.textContent='选择一位国民查看履历';return;}
  const hs=(p.history||[]).slice(-12).reverse();
  personDetail.innerHTML=`<div class="dtitle">${p.name||'无名'}</div>`+[
    ['阶级',names[p.klass]],['年龄',p.age],['性别',p.gender==='female'?'女':'男'],
    ['满意度',p.satisfaction.toFixed(2)],['智力',p.intelligence.toFixed(2)],['粮食/产品',p.grain.toFixed(1)+' / '+p.product.toFixed(1)],
  ].map(([label,value])=>`<div class="drow"><span>${label}</span><b>${value}</b></div>`).join('')+
    '<div class="dtitle" style="margin-top:8px">变化记录（近12年）</div>'+hs.map(h=>`<div class="histrow"><span>${h.year}年</span><span>${names[h.klass]}</span><b>${Number(h.satisfaction).toFixed(2)}</b></div>`).join('');
}

function showEvent() {
  const event=GameCore.events.EVENTS.find(e=>e.id===state.pendingEvent[0]);
  const presentation=GameCore.events.EVENT_PRESENTATION[event.category];
  const modal=document.getElementById('eventModal'),card=modal.querySelector('.box');
  card.dataset.category=event.category;card.style.setProperty('--event-color',presentation.color);
  let badge=card.querySelector('.event-badge');
  if(!badge){badge=document.createElement('span');badge.className='event-badge';card.prepend(badge);}
  badge.textContent=presentation.symbol+' '+presentation.label;
  et.textContent=event.title;ed.textContent=event.desc;eo.innerHTML='';
  event.options.forEach((option,i)=>{
    const button=document.createElement('button');button.textContent=option.label;
    button.onclick=()=>{if(transition.busy)return;withCore(()=>GameCore.game.applyEventOption(state,i));render();};
    eo.appendChild(button);
  });
  modal.classList.remove('hidden');
}
