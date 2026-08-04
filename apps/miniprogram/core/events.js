const {syncNextId}=require('./person.js');
function O(label,benefit,cost,hiddenEffects,apply,storyHook){return{label,tradeoffs:{benefit,cost},hiddenEffects,apply,storyHook};}
function citizens(s,klass){return s.people.filter(p=>!p.isCriminal&&(!klass||p.klass===klass));}
function sat(s,n,predicate){s.people.filter(p=>!p.isCriminal&&(!predicate||predicate(p))).forEach(p=>p.satisfaction+=n);}
function admitRefugees(s){
  const room=Math.max(0,(s.cfg&&s.cfg.populationHardCap||2000)-s.people.length),count=Math.min(room,Math.max(3,Math.min(12,Math.round(s.people.length*.08))));
  let id=s.people.reduce((m,p)=>Math.max(m,Number(p.id)||0),0);
  for(let i=0;i<count;i++){const klass=i%3===2?'worker':'farmer';s.people.push({id:++id,name:`新民${id}`,klass,age:s.rng.int(16,45),gender:s.rng.chance(.5)?'male':'female',intelligence:Math.round(s.rng.normal(42,12)),satisfaction:-12,grain:3,product:0,isCriminal:false,isInflated:false,role:null,history:[],refugeeWave:s.year});}
  s.flags.refugeeArrivalYear=s.year;s.flags.refugeeIntegrationResolved=false;syncNextId(s.people);return count;
}
function applyPlague(s,p,f){f=f==null?1:f;let infected=0,dead=0,loss=0;for(let i=s.people.length-1;i>=0;i--){const x=s.people[i];if(!s.rng.chance(p.infectionRate*f))continue;infected++;const gl=Math.min(Math.max(0,x.grain),p.grainLoss*f),pl=Math.min(Math.max(0,x.product),p.productLoss*f);x.grain-=gl;x.product-=pl;loss+=gl+pl*2;const wealth=Math.max(0,x.grain+x.product*2);if(s.rng.chance(p.fatalityRate*f/(1+wealth/80))){s.people.splice(i,1);dead++;}}s.log.push(`${p.name}感染 ${infected} 人，死亡 ${dead} 人，财产损失折合 ${loss.toFixed(1)}`);}
function plagueEvent(p){return{id:`plague_${p.id}`,title:`瘟疫：${p.name}`,desc:p.desc,weight:1,condition:s=>s.year>=5&&s.stats.total>=30,options:[
  O('封城治疗（传播、致死降至35%；国库-300）','显著降低疫情损失','国库支出300',{morality:2,rationality:3},s=>{s.treasury-=300;applyPlague(s,p,.35)}),
  O('维持开放（国库+60；疫情全额扩散）','国库增加60','承受完整疫情损失',{morality:-3,rationality:-2},s=>{s.treasury+=60;applyPlague(s,p,1)}),
]};}
const PLAGUES=[
  plagueEvent({id:'black',name:'黑死热',desc:'传播较慢但致死率极高，富裕者更有能力获得救治。',infectionRate:.30,fatalityRate:.55,grainLoss:4,productLoss:0}),
  plagueEvent({id:'flu',name:'赤风流感',desc:'传染率极高、致死率较低，并造成财产损失。',infectionRate:.80,fatalityRate:.045,grainLoss:8,productLoss:1}),
  plagueEvent({id:'pox',name:'灰斑疫',desc:'传播与致死率居中，并造成财产损失。',infectionRate:.48,fatalityRate:.20,grainLoss:6,productLoss:.5}),
];

const EVENTS=[
{id:'drought',title:'蝗灾来袭',desc:'今春蝗虫遮天蔽日，农田损失惨重。',weight:10,condition:s=>s.year>=2&&s.year%7===0,options:[
  O('开仓赈灾（每人粮食+5、满意+1；国库-200）','补粮并稳定民心','国库支出200',{morality:3,rationality:1},s=>{s.treasury-=200;citizens(s).forEach(p=>{p.grain+=5;p.satisfaction++})}),
  O('征购民粮（国库+100；农民粮食-6、满意-3）','国库增加100','农民蒙受损失',{morality:-3,rationality:-2},s=>{s.treasury+=100;citizens(s,'farmer').forEach(p=>{p.grain-=6;p.satisfaction-=3})}),
]},
{id:'merchant_caravan',title:'商队来访',desc:'远方商队请求入境贸易。',weight:8,condition:s=>s.stats.byClass.merchant>=2,options:[
  O('征收重税（国库+150；商人满意-3）','国库增加150','商路受损',{morality:-1,rationality:1},s=>{s.treasury+=150;sat(s,-3,p=>p.klass==='merchant')}),
  O('补贴通商（满意+2、商人产品+2；国库-60）','扩大供给并提高满意','国库支出60',{morality:1,rationality:2},s=>{s.treasury-=60;sat(s,2);citizens(s,'merchant').forEach(p=>p.product+=2)}),
]},
{id:'scholar',title:'学子上书',desc:'贫寒学子请求开科举取士。',weight:6,condition:s=>s.stats.avgIntelligence>55&&!s.flags.examOpen,options:[
  O('开科举（候选者智力+1；国库-120）','开启科举并培养人才','国库支出120',{morality:2,rationality:3},s=>{s.treasury-=120;s.flags.examOpen=true;citizens(s).sort((a,b)=>b.intelligence-a.intelligence).slice(0,6).forEach(p=>p.intelligence=Math.min(100,p.intelligence+1))}),
  O('维持旧制（国库+40；非官员满意-2）','国库增加40','堵塞上升通道',{morality:-1,rationality:-2},s=>{s.treasury+=40;sat(s,-2,p=>p.klass!=='official')}),
]},
{id:'good_harvest',title:'风调雨顺',desc:'今年五谷丰登。',weight:8,condition:s=>s.year>1,options:[
  O('加征余粮（国库+300；每人粮食-3）','国库增加300','居民交出余粮',{morality:-2,rationality:1},s=>{s.treasury+=300;citizens(s).forEach(p=>p.grain-=3)}),
  O('修仓藏粮于民（满意+2；国库-60）','民心提升','国库支出60',{morality:2,rationality:1},s=>{s.treasury-=60;sat(s,2)}),
]},
{id:'rebellion_warning',title:'密报：流民聚众',desc:'城外流民已聚众数十。',weight:5,condition:s=>s.stats.criminals>0,options:[
  O('扩充治安（治安+1；国库-100、满意-1）','增加治安能力','支出且引发不安',{morality:-1,rationality:2},s=>{s.treasury-=100;s.policy.officials.security++;sat(s,-1)}),
  O('赈济安抚（低满意者粮食+10、满意+3；国库-140）','缓和潜在动乱','支出且罪犯仍在',{morality:2,rationality:1},s=>{s.treasury-=140;citizens(s).filter(p=>p.satisfaction<0).forEach(p=>{p.grain+=10;p.satisfaction+=3})}),
]},
...PLAGUES,
{id:'noble_invite',title:'邻国联姻',desc:'邻国遣使提亲，欲结秦晋之好。',weight:4,condition:s=>s.year>=8&&!s.flags.allianceDecisionYear,options:[
  O('应允（国库+420、满意+1；每人产品-1）','获得聘礼与声望','民间产品作为回礼',{morality:1,rationality:1},s=>{s.treasury+=420;citizens(s).forEach(p=>{p.satisfaction++;p.product=Math.max(0,p.product-1)});s.flags.allianceDecisionYear=s.year}),
  O('婉拒（满意+1；国库-80）','维持自主','外交礼金80',{morality:-1,rationality:2},s=>{s.treasury-=80;sat(s,1);s.flags.allianceDecisionYear=s.year}),
]},
{id:'inflation',title:'通货膨胀',desc:'商人囤货居奇，物价飞涨。',weight:5,condition:s=>s.stats.byClass.merchant>0&&s.stats.classWealth.merchant>s.stats.classWealth.farmer*3&&!s.flags.merchantPunishedYear,options:[
  O('惩办囤货商（农工满意+2；国库-80、1名商人降为农民）','压低物价','财政支出且商人减少',{morality:1,rationality:2},s=>{s.treasury-=80;sat(s,2,p=>p.klass==='farmer'||p.klass==='worker');const m=citizens(s,'merchant').sort((a,b)=>b.grain-a.grain)[0];if(m){m.klass='farmer';m.role=null;m.satisfaction-=4}sat(s,-3,p=>p.klass==='merchant');s.flags.merchantPunishedYear=s.year;s.flags.merchantBacklashResolved=false}),
  O('允许高价（商人粮食+30、满意+2；农工满意-3）','商人积累资本','农工承受高价',{morality:-2,rationality:-1},s=>{citizens(s,'merchant').forEach(p=>{p.grain+=30;p.satisfaction+=2});sat(s,-3,p=>p.klass==='farmer'||p.klass==='worker')}),
]},
{id:'farmer_petition',title:'佃农叩阙',desc:'农民控诉豪强侵田、加收私租。',weight:8,condition:s=>s.year>=3&&s.stats.byClass.farmer>=8,options:[
  O('彻查退粮（农民粮食+5、满意+3；国库-150、官员满意-1）','返还田粮','支出并触怒官场',{morality:3,rationality:2},s=>{s.treasury-=150;citizens(s,'farmer').forEach(p=>{p.grain+=5;p.satisfaction+=3});sat(s,-1,p=>p.klass==='official')}),
  O('驱散请愿者（国库+100；农民粮食-2、满意-4）','国库增加100','农民积怨',{morality:-3,rationality:-1},s=>{s.treasury+=100;citizens(s,'farmer').forEach(p=>{p.grain-=2;p.satisfaction-=4})}),
]},
{id:'criminal_sentencing',title:'重犯待决',desc:'是教化挽救，还是严刑震慑？',weight:7,condition:s=>s.year>=6&&s.stats.criminals>0,options:[
  O('感化安置（1人从良；国库-80、公众满意-0.5）','保留人口并使罪犯从良','支出且公众担忧',{morality:3,rationality:1},s=>{const x=s.people.find(p=>p.isCriminal);s.treasury-=80;sat(s,-.5);if(x){x.isCriminal=false;x.isInflated=false;x.klass='farmer';x.role=null;x.satisfaction=Math.max(0,x.satisfaction);x.grain+=8;s.flags.reformedPrisoner={id:x.id,year:s.year,resolved:false}}}),
  O('严刑处决（移除1名罪犯、满意+0.5；国库-20）','立刻消除罪犯','损失人口和费用',{morality:-3,rationality:-1},s=>{s.treasury-=20;const i=s.people.findIndex(p=>p.isCriminal);if(i>=0){s.people.splice(i,1);sat(s,.5)}}),
]},
{id:'corrupt_official',title:'库银失窃',desc:'赈济款失窃，线索指向资深官员。',weight:6,condition:s=>s.year>=5&&s.stats.byClass.official>=3&&!s.flags.corruptionCaseYear,options:[
  O('公开审理（国库+120、百姓满意+1；移除1名公务员）','追回赃款并赢得民心','行政能力永久减少',{morality:2,rationality:3},s=>{s.treasury+=120;const i=s.people.findIndex(p=>p.klass==='official'&&!p.isCriminal);if(i>=0)s.people.splice(i,1);sat(s,1,p=>p.klass!=='official');sat(s,-2,p=>p.klass==='official');s.flags.corruptionCaseYear=s.year;s.flags.corruptionOutcome='purged';s.flags.corruptionAftershockResolved=false}),
  O('压下案卷（官员满意+2；国库-50、百姓满意-1）','保住现有官员','封口成本并损害民心',{morality:-2,rationality:-1},s=>{s.treasury-=50;sat(s,2,p=>p.klass==='official');sat(s,-1,p=>p.klass!=='official');s.flags.corruptionCaseYear=s.year;s.flags.corruptionOutcome='covered';s.flags.corruptionAftershockResolved=false}),
]},
{id:'workshop_dispute',title:'工坊停工',desc:'工匠与商会因工价僵持。',weight:6,condition:s=>s.year>=4&&s.stats.byClass.worker>=3&&s.stats.byClass.merchant>=1,options:[
  O('核账调解（工人与商人满意+2；国库-80）','恢复双方信心','国库支出80',{morality:2,rationality:3},s=>{s.treasury-=80;sat(s,2,p=>p.klass==='worker'||p.klass==='merchant')}),
  O('强令复工（国库+150、商人满意+2；工人满意-3）','恢复利润并增加国库','工人不满',{morality:-2,rationality:1},s=>{s.treasury+=150;sat(s,-3,p=>p.klass==='worker');sat(s,2,p=>p.klass==='merchant')}),
]},
{id:'refugees_at_gate',title:'灾民叩关',desc:'大批饥民请求入境避难。',weight:5,condition:s=>s.year>=7&&s.stats.total>=25&&!s.flags.refugeeArrivalYear,options:[
  O('开关安置（新增低满意人口；国库每人-20）','增加农民和工人人口','满意-12，今后按概率可能犯罪',{morality:3,rationality:1},s=>{const n=admitRefugees(s);s.treasury-=n*20;s.log.push(`接纳 ${n} 名灾民；初始并非罪犯`)}),
  O('遣返并没收物资（国库+60；本国满意-1）','保住承载力并增加国库','民心下降',{morality:-2,rationality:2},s=>{s.treasury+=60;sat(s,-1);s.flags.refugeeArrivalYear=-1;s.flags.refugeeIntegrationResolved=true}),
]},
{id:'canal_dispute',title:'争夺水渠',desc:'上下游因水渠发生冲突。',weight:6,condition:s=>s.year>=5&&s.stats.byClass.farmer>=10,options:[
  O('按田亩分水（农民粮食+4、满意+1；国库-100）','改善农业','维护支出100',{morality:1,rationality:3},s=>{s.treasury-=100;citizens(s,'farmer').forEach(p=>{p.grain+=4;p.satisfaction++})}),
  O('出售水权（国库+180；农民粮食-3、满意-2）','国库增加180','农民失去水利',{morality:-3,rationality:1},s=>{s.treasury+=180;citizens(s,'farmer').forEach(p=>{p.grain-=3;p.satisfaction-=2})}),
]},
{id:'celestial_omen',title:'天象示警',desc:'彗星划过，民间传言灾祸将至。',weight:4,condition:s=>s.year>=6,options:[
  O('释疑修仓（每人粮食+2；国库-100、官员满意-1）','改善储粮','支出且触怒守旧官员',{morality:1,rationality:3},s=>{s.treasury-=100;citizens(s).forEach(p=>p.grain+=2);sat(s,-1,p=>p.klass==='official')}),
  O('举行大祭（满意+2；国库-200、每人粮食-1）','安定民心','耗费财政粮食',{morality:1,rationality:-3},s=>{s.treasury-=200;citizens(s).forEach(p=>{p.satisfaction+=2;p.grain-=1})}),
]},
{id:'corruption_aftershock',title:'贪腐案余波',desc:'贪腐案留下行政缺口与不信任。',weight:14,condition:s=>Number.isFinite(s.flags.corruptionCaseYear)&&s.year>=s.flags.corruptionCaseYear+2&&!s.flags.corruptionAftershockResolved,options:[
  O('重建审计（补充1名公务员、百姓满意+1；国库-180）','修复行政能力','其他阶级失去1人且支出',{morality:2,rationality:3},s=>{s.treasury-=180;const x=citizens(s).filter(p=>p.klass!=='official').sort((a,b)=>b.intelligence-a.intelligence)[0];if(x){x.klass='official';x.role=null}sat(s,1,p=>p.klass!=='official');s.flags.corruptionAftershockResolved=true}),
  O('缩减官署（国库+80、农工满意+1；税务配额-1）','节省俸禄','削弱征税能力',{morality:1,rationality:-2},s=>{s.treasury+=80;s.policy.officials.tax=Math.max(0,s.policy.officials.tax-1);sat(s,1,p=>p.klass==='farmer'||p.klass==='worker');s.flags.corruptionAftershockResolved=true}),
]},
{id:'merchant_backlash',title:'商路萧条',desc:'惩办商人后商队绕道。',weight:14,condition:s=>Number.isFinite(s.flags.merchantPunishedYear)&&s.year>=s.flags.merchantPunishedYear+2&&!s.flags.merchantBacklashResolved,options:[
  O('扶持合作社（农工产品+2、满意+1；国库-120）','恢复基层流通','补贴且商人不满',{morality:2,rationality:2},s=>{s.treasury-=120;citizens(s).filter(p=>p.klass==='farmer'||p.klass==='worker').forEach(p=>{p.product+=2;p.satisfaction++});sat(s,-1,p=>p.klass==='merchant');s.flags.merchantBacklashResolved=true}),
  O('重发牌照（新增1名商人、国库+80；农民满意-1）','恢复商人阶层','一名农民转商且乡间不满',{morality:-1,rationality:3},s=>{const x=citizens(s,'farmer').sort((a,b)=>b.grain-a.grain)[0];if(x)x.klass='merchant';s.treasury+=80;sat(s,-1,p=>p.klass==='farmer');s.flags.merchantBacklashResolved=true}),
]},
{id:'refugee_integration',title:'新民安置',desc:'新民居住两年，贫困与隔阂仍在。',weight:14,condition:s=>s.flags.refugeeArrivalYear>0&&s.year>=s.flags.refugeeArrivalYear+2&&!s.flags.refugeeIntegrationResolved&&s.people.some(p=>p.refugeeWave===s.flags.refugeeArrivalYear),options:[
  O('授田融入（新民粮食+8、满意+6；国库每人-30、本地满意-1）','降低新民犯罪风险','高额支出且本地焦虑',{morality:3,rationality:2},s=>{const ns=s.people.filter(p=>p.refugeeWave===s.flags.refugeeArrivalYear);s.treasury-=ns.length*30;ns.forEach(p=>{p.grain+=8;p.satisfaction+=6});sat(s,-1,p=>!p.refugeeWave);s.flags.refugeeIntegrationResolved=true}),
  O('分批遣散（节省每人20、当地满意+1；移除半数新民）','缓解资源压力','失去已接纳人口',{morality:-2,rationality:1},s=>{const ns=s.people.filter(p=>p.refugeeWave===s.flags.refugeeArrivalYear),leaving=ns.filter((_,i)=>i%2===0);leaving.forEach(p=>{const i=s.people.indexOf(p);if(i>=0)s.people.splice(i,1)});s.treasury+=leaving.length*20;sat(s,1,p=>!p.refugeeWave);s.flags.refugeeIntegrationResolved=true}),
]},
{id:'reformed_prisoner_review',title:'从良者复审',desc:'获感化者完成两年生计计划。',weight:12,condition:s=>s.flags.reformedPrisoner&&!s.flags.reformedPrisoner.resolved&&s.year>=s.flags.reformedPrisoner.year+2&&s.people.some(p=>p.id===s.flags.reformedPrisoner.id),options:[
  O('继续扶助（本人粮食+8、满意+4；国库-60、公众满意-0.5）','巩固感化成果','支出且公众担忧',{morality:3,rationality:2},s=>{s.treasury-=60;const x=s.people.find(p=>p.id===s.flags.reformedPrisoner.id);if(x){x.grain+=8;x.satisfaction+=4}sat(s,-.5,p=>!x||p.id!==x.id);s.flags.reformedPrisoner.resolved=true}),
  O('停止并流放（国库+30、满意+0.5；移除该人口）','停止开支','失去已从良人口',{morality:-3,rationality:-1},s=>{const i=s.people.findIndex(p=>p.id===s.flags.reformedPrisoner.id);if(i>=0)s.people.splice(i,1);s.treasury+=30;sat(s,.5);s.flags.reformedPrisoner.resolved=true}),
]},
];

function rollEvent(state){const candidates=EVENTS.filter(e=>{try{return e.condition(state)}catch(_){return false}});if(!candidates.length||!state.rng.chance(.55))return null;const recent=Array.isArray(state.recentEventIds)?state.recentEventIds.slice(-2):[],fresh=candidates.filter(e=>recent.indexOf(e.id)<0),pool=fresh.length?fresh:candidates,total=pool.reduce((n,e)=>n+e.weight,0);let r=state.rng.uniform(0,total),selected=pool[pool.length-1];for(const e of pool){r-=e.weight;if(r<=0){selected=e;break}}state.recentEventIds=recent.concat(selected.id).slice(-2);return selected;}
module.exports={EVENTS,rollEvent};
