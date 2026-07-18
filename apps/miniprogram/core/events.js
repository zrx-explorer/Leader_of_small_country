function applyPlague(state, plague, treatmentFactor) {
  treatmentFactor = treatmentFactor == null ? 1 : treatmentFactor;
  let infected=0, dead=0, propertyLoss=0;
  for (let i=state.people.length-1; i>=0; i--) {
    const p=state.people[i];
    if (!state.rng.chance(plague.infectionRate*treatmentFactor)) continue;
    infected++;
    const grainLoss=Math.min(Math.max(0,p.grain), plague.grainLoss*treatmentFactor);
    const productLoss=Math.min(Math.max(0,p.product), plague.productLoss*treatmentFactor);
    p.grain-=grainLoss; p.product-=productLoss; propertyLoss+=grainLoss+productLoss*2;
    const wealth=Math.max(0,p.grain+p.product*2);
    const wealthProtection=1/(1+wealth/80);
    if (state.rng.chance(plague.fatalityRate*treatmentFactor*wealthProtection)) {
      state.people.splice(i,1); dead++;
    }
  }
  state.log.push(`${plague.name}感染 ${infected} 人，死亡 ${dead} 人，定量财产损失折合 ${propertyLoss.toFixed(1)}`);
}

function plagueEvent(plague) {
  return { id:`plague_${plague.id}`, title:`瘟疫：${plague.name}`, desc:plague.desc, weight:1,
    condition:s=>s.year>=5&&s.stats.total>=30,
    options:[
      { label:'封城治疗（国库 -300，传播与致死降低）', hiddenEffects:{morality:2,rationality:3}, apply:s=>{ s.treasury-=300; applyPlague(s,plague,0.35); } },
      { label:'不闻不问（按个人资产抵御死亡）', hiddenEffects:{morality:-3,rationality:-2}, apply:s=>applyPlague(s,plague,1) },
    ] };
}

const PLAGUES = [
  plagueEvent({ id:'black', name:'黑死热', desc:'传播较慢但致死率极高，富裕者更有能力获得救治。', infectionRate:0.30, fatalityRate:0.55, grainLoss:4, productLoss:0 }),
  plagueEvent({ id:'flu', name:'赤风流感', desc:'传染率极高、致死率较低，患病者会固定损失粮食与产品。', infectionRate:0.80, fatalityRate:0.045, grainLoss:8, productLoss:1 }),
  plagueEvent({ id:'pox', name:'灰斑疫', desc:'传播与致死率居中，并会造成一定财产损失。', infectionRate:0.48, fatalityRate:0.20, grainLoss:6, productLoss:0.5 }),
];

const EVENTS = [
  { id:'drought', title:'蝗灾来袭', desc:'今春蝗虫遮天蔽日，农田损失惨重。', weight:10,
    condition: s => s.year >= 2 && s.year % 7 === 0,
    options: [
      { label:'开仓赈灾（国库 -200）', hiddenEffects:{morality:3,rationality:1}, storyHook:{ speaker:'民生官', mood:'relieved', topic:'disaster_relief' }, apply: s => { s.treasury -= 200; s.people.filter(p => !p.isCriminal).forEach(p => p.grain += 5); s.log.push('开仓赈灾，民心稍安'); } },
      { label:'听天由命（满意度全员 -3）', hiddenEffects:{morality:-3,rationality:-2}, storyHook:{ speaker:'流民', mood:'angry', topic:'disaster_neglect' }, apply: s => { s.people.forEach(p => p.satisfaction -= 3); s.log.push('未予赈济，民怨四起'); } },
    ] },
  { id:'merchant_caravan', title:'商队来访', desc:'远方商队请求入境贸易。', weight:8,
    condition: s => s.stats.byClass.merchant >= 2,
    options: [
      { label:'征收高税（国库 +150 / 满意度 -1）', hiddenEffects:{morality:-1,rationality:1}, storyHook:{ speaker:'商队首领', mood:'guarded', topic:'trade_tax' }, apply: s => { s.treasury += 150; s.people.forEach(p => p.satisfaction -= 1); } },
      { label:'低税迎客（国库 +30 / 满意度 +2）', hiddenEffects:{morality:1,rationality:2}, storyHook:{ speaker:'商队首领', mood:'friendly', topic:'trade_open' }, apply: s => { s.treasury += 30;  s.people.forEach(p => p.satisfaction += 2); } },
    ] },
  { id:'scholar', title:'学子上书', desc:'一位贫寒学子上书，请求开科举取士。', weight:6,
    condition: s => s.stats.avgIntelligence > 55,
    options: [
      { label:'开科举（智力均值缓慢提升）', hiddenEffects:{morality:2,rationality:3}, storyHook:{ speaker:'贫寒学子', mood:'hopeful', topic:'exam_open' }, apply: s => { s.flags.examOpen = true; s.log.push('科举已开，国之大幸'); } },
      { label:'不予理会（满意度 -2）', hiddenEffects:{morality:-1,rationality:-2}, storyHook:{ speaker:'贫寒学子', mood:'disappointed', topic:'exam_rejected' }, apply: s => { s.people.forEach(p => p.satisfaction -= 2); } },
    ] },
  { id:'good_harvest', title:'风调雨顺', desc:'今年五谷丰登。', weight:8,
    condition: s => s.year > 1,
    options: [
      { label:'加征余粮入库（国库 +300）', hiddenEffects:{morality:-2,rationality:1}, apply: s => { s.treasury += 300; s.people.forEach(p => p.grain -= 3); } },
      { label:'藏粮于民（满意度 +2）', hiddenEffects:{morality:2,rationality:1}, apply: s => { s.people.forEach(p => p.satisfaction += 2); } },
    ] },
  { id:'rebellion_warning', title:'密报：流民聚众', desc:'探子来报，城外流民已聚众数十。', weight:5,
    condition: s => s.stats.criminals > 0,
    options: [
      { label:'增派治安官（国库 -100）', hiddenEffects:{morality:-1,rationality:2}, apply: s => { s.treasury -= 100; s.policy.officials.security += 1; } },
      { label:'安抚为先（粮食赈济）', hiddenEffects:{morality:2,rationality:1}, apply: s => { s.people.filter(p => !p.isCriminal && p.satisfaction < 0).forEach(p => { p.grain += 10; p.satisfaction += 2; }); } },
    ] },
  ...PLAGUES,
  { id:'noble_invite', title:'邻国联姻', desc:'邻国遣使提亲，欲结秦晋之好。', weight:4,
    condition: s => s.year >= 8,
    options: [
      { label:'应允（国库 +500，满意度 +1）', hiddenEffects:{morality:1,rationality:1}, apply: s => { s.treasury += 500; s.people.forEach(p => p.satisfaction += 1); } },
      { label:'婉拒（满意度 -1）', hiddenEffects:{morality:-1,rationality:1}, apply: s => { s.people.forEach(p => p.satisfaction -= 1); } },
    ] },
  { id:'inflation', title:'通货膨胀', desc:'商人囤货居奇，物价飞涨。', weight:5,
    condition: s => s.stats.classWealth.merchant > s.stats.classWealth.farmer * 3,
    options: [
      { label:'强制平抑物价（商人满意度 -3）', hiddenEffects:{morality:1,rationality:2}, apply: s => { s.people.filter(p => p.klass === 'merchant').forEach(p => p.satisfaction -= 3); } },
      { label:'听之任之（农工满意度 -2）', hiddenEffects:{morality:-2,rationality:-1}, apply: s => { s.people.filter(p => p.klass === 'farmer' || p.klass === 'worker').forEach(p => p.satisfaction -= 2); } },
    ] },
  { id:'farmer_petition', title:'佃农叩阙', desc:'数十名农民跪在宫门外，控诉地方豪强侵占田地、加收私租。', weight:8,
    condition:s=>s.year>=3&&s.stats.byClass.farmer>=8,
    options:[
      { label:'派员彻查并退还田粮（国库 -150）', hiddenEffects:{morality:3,rationality:2}, storyHook:{speaker:'上访农民',mood:'hopeful',topic:'farmer_petition_investigate'}, apply:s=>{ s.treasury-=150; s.people.filter(p=>p.klass==='farmer'&&!p.isCriminal).forEach(p=>{p.grain+=5;p.satisfaction+=3;}); s.people.filter(p=>p.klass==='official'&&!p.isCriminal).forEach(p=>p.satisfaction-=1); s.log.push('官府清查乡里，受侵田粮陆续发还'); } },
      { label:'以扰乱秩序为由驱散（国库 +100）', hiddenEffects:{morality:-3,rationality:-1}, storyHook:{speaker:'上访农民',mood:'angry',topic:'farmer_petition_suppressed'}, apply:s=>{ s.treasury+=100; s.people.filter(p=>p.klass==='farmer'&&!p.isCriminal).forEach(p=>{p.grain-=2;p.satisfaction-=4;}); s.log.push('请愿者被逐出城门，乡间怨气更盛'); } },
    ] },
  { id:'criminal_sentencing', title:'重犯待决', desc:'一名落网罪犯被押至堂前。群臣争论应以教化挽救，还是用严刑震慑众人。', weight:7,
    condition:s=>s.year>=6&&s.stats.criminals>0,
    options:[
      { label:'设法感化并安排生计（国库 -80）', hiddenEffects:{morality:3,rationality:1}, storyHook:{speaker:'待决罪犯',mood:'remorseful',topic:'criminal_reformed'}, apply:s=>{ const criminal=s.people.find(p=>p.isCriminal); s.treasury-=80; if(criminal){criminal.isCriminal=false;criminal.isInflated=false;criminal.klass='farmer';criminal.role=null;criminal.satisfaction=Math.max(0,criminal.satisfaction);criminal.grain+=8;s.log.push(`${criminal.name||'罪犯'}获准从良，官府为其安排了生计`);} } },
      { label:'严刑处决以儆效尤（移除 1 名罪犯）', hiddenEffects:{morality:-3,rationality:-1}, storyHook:{speaker:'刑狱官',mood:'stern',topic:'criminal_executed'}, apply:s=>{ const index=s.people.findIndex(p=>p.isCriminal); if(index>=0){const criminal=s.people.splice(index,1)[0];s.people.filter(p=>!p.isCriminal).forEach(p=>p.satisfaction+=0.5);s.log.push(`${criminal.name||'重犯'}被处决，刑场戒备森严`);} } },
    ] },
  { id:'corrupt_official', title:'库银失窃', desc:'审计发现一批赈济款不翼而飞，线索指向数名资深官员。', weight:6,
    condition:s=>s.year>=5&&s.stats.byClass.official>=3,
    options:[
      { label:'公开审理并追缴赃款（国库 +120）', hiddenEffects:{morality:2,rationality:3}, storyHook:{speaker:'审计官',mood:'focused',topic:'corruption_exposed'}, apply:s=>{ s.treasury+=120;s.people.filter(p=>p.klass==='official'&&!p.isCriminal).forEach(p=>p.satisfaction-=2);s.people.filter(p=>p.klass!=='official'&&!p.isCriminal).forEach(p=>p.satisfaction+=1); } },
      { label:'压下案卷以维持官场稳定（国库 -50）', hiddenEffects:{morality:-2,rationality:-1}, storyHook:{speaker:'审计官',mood:'disappointed',topic:'corruption_hidden'}, apply:s=>{ s.treasury-=50;s.people.filter(p=>p.klass==='official'&&!p.isCriminal).forEach(p=>p.satisfaction+=2); } },
    ] },
  { id:'workshop_dispute', title:'工坊停工', desc:'工匠指控商人压低工价，商会则声称成本高涨，双方僵持不下。', weight:6,
    condition:s=>s.year>=4&&s.stats.byClass.worker>=3&&s.stats.byClass.merchant>=1,
    options:[
      { label:'召集双方核账调解（国库 -80）', hiddenEffects:{morality:2,rationality:3}, storyHook:{speaker:'工匠代表',mood:'hopeful',topic:'workshop_mediated'}, apply:s=>{ s.treasury-=80;s.people.filter(p=>(p.klass==='worker'||p.klass==='merchant')&&!p.isCriminal).forEach(p=>p.satisfaction+=2); } },
      { label:'支持商会强令复工（国库 +150）', hiddenEffects:{morality:-2,rationality:1}, storyHook:{speaker:'工匠代表',mood:'angry',topic:'workshop_forced'}, apply:s=>{ s.treasury+=150;s.people.filter(p=>p.klass==='worker'&&!p.isCriminal).forEach(p=>p.satisfaction-=3);s.people.filter(p=>p.klass==='merchant'&&!p.isCriminal).forEach(p=>p.satisfaction+=2); } },
    ] },
  { id:'refugees_at_gate', title:'灾民叩关', desc:'邻境受灾，大批饥民聚集在关外，请求入境避难。', weight:5,
    condition:s=>s.year>=7&&s.stats.total>=25,
    options:[
      { label:'开关安置并发放口粮（国库 -120）', hiddenEffects:{morality:3,rationality:1}, storyHook:{speaker:'灾民代表',mood:'grateful',topic:'refugees_sheltered'}, apply:s=>{ s.treasury-=120;s.people.filter(p=>!p.isCriminal).forEach(p=>p.satisfaction+=1);s.log.push('灾民被分批安置，城中粮仓承担了额外压力'); } },
      { label:'封闭关门以保全本国储备', hiddenEffects:{morality:-2,rationality:2}, storyHook:{speaker:'守关官',mood:'guarded',topic:'refugees_refused'}, apply:s=>s.log.push('关门紧闭，储备得以保全，关外哭声彻夜未歇') },
    ] },
  { id:'canal_dispute', title:'争夺水渠', desc:'上游庄园截断灌溉水渠，下游村庄与其械斗一触即发。', weight:6,
    condition:s=>s.year>=5&&s.stats.byClass.farmer>=10,
    options:[
      { label:'勘测水量并按田亩定额分水（国库 -100）', hiddenEffects:{morality:1,rationality:3}, storyHook:{speaker:'水利官',mood:'focused',topic:'canal_measured'}, apply:s=>{ s.treasury-=100;s.people.filter(p=>p.klass==='farmer'&&!p.isCriminal).forEach(p=>{p.grain+=4;p.satisfaction+=1;}); } },
      { label:'将水权卖给上游庄园（国库 +180）', hiddenEffects:{morality:-3,rationality:1}, storyHook:{speaker:'下游乡老',mood:'angry',topic:'canal_sold'}, apply:s=>{ s.treasury+=180;s.people.filter(p=>p.klass==='farmer'&&!p.isCriminal).forEach(p=>{p.grain-=3;p.satisfaction-=2;}); } },
    ] },
  { id:'celestial_omen', title:'天象示警', desc:'夜空彗星划过，民间传言灾祸将至，朝堂争论该如何安定人心。', weight:4,
    condition:s=>s.year>=6,
    options:[
      { label:'命司天官释疑并整修粮仓（国库 -100）', hiddenEffects:{morality:1,rationality:3}, storyHook:{speaker:'司天官',mood:'focused',topic:'omen_explained'}, apply:s=>{ s.treasury-=100;s.people.filter(p=>!p.isCriminal).forEach(p=>p.grain+=2); } },
      { label:'举行大祭祈求上天息怒（国库 -200，满意度 +2）', hiddenEffects:{morality:1,rationality:-3}, storyHook:{speaker:'祭官',mood:'solemn',topic:'omen_sacrifice'}, apply:s=>{ s.treasury-=200;s.people.filter(p=>!p.isCriminal).forEach(p=>p.satisfaction+=2); } },
    ] },
];

function rollEvent(state) {
  const candidates = EVENTS.filter(e => { try { return e.condition(state); } catch (_) { return false; } });
  if (!candidates.length) return null;
  if (!state.rng.chance(0.55)) return null;
  const total = candidates.reduce((s, e) => s + e.weight, 0);
  let r = state.rng.uniform(0, total);
  for (const e of candidates) { r -= e.weight; if (r <= 0) return e; }
  return candidates[candidates.length - 1];
}

module.exports = { EVENTS, rollEvent };
