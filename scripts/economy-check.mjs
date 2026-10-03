import assert from 'node:assert/strict';
import { newGame } from '../packages/core/src/game.js';
import { seedPopulation } from '../packages/core/src/person.js';
import { trade, consume } from '../packages/core/src/economy.js';

// Frozen pre-optimization rules: stable sorting, fractional trades and same-class support.
function referenceTrade(people, cfg) {
  const workers=people.filter(p=>p.klass==='worker'&&!p.isCriminal&&p.age>=16);
  const merchants=people.filter(p=>p.klass==='merchant'&&!p.isCriminal&&p.age>=16);
  if(!workers.length)return;
  const wholesale=3*(cfg.yearlyPriceMultiplier??1);let cursor=0;
  for(const buyer of people.filter(p=>!p.isCriminal&&p.klass!=='worker')) {
    const need=buyer.age<16?1:buyer.klass==='merchant'?1:3;
    let demand=Math.max(0,need+cfg.productReserveNeed-buyer.product);
    const price=buyer.klass==='farmer'?(wholesale+1)*1.2:wholesale*1.1;
    while(demand>.001) {
      const worker=workers.filter(p=>p.product>cfg.productReserveNeed).sort((a,b)=>a.grain-b.grain)[0];
      if(!worker)break;
      const merchant=merchants.length?merchants[cursor++%merchants.length]:null;
      const unitPrice=merchant&&merchant!==buyer?price:wholesale;
      const quantity=Math.min(1,demand,worker.product-cfg.productReserveNeed,Math.max(0,buyer.grain-cfg.grainReserveNeed)/unitPrice);
      if(quantity<=.001)break;
      const payment=quantity*wholesale;
      buyer.grain-=quantity*unitPrice;buyer.product+=quantity;worker.product-=quantity;worker.grain+=payment;
      worker.yearIncome=(worker.yearIncome||0)+payment;
      if(merchant&&merchant!==buyer){const margin=quantity*(unitPrice-wholesale);merchant.grain+=margin;merchant.yearIncome=(merchant.yearIncome||0)+margin;}
      demand-=quantity;
    }
  }
}
function referenceConsume(people,cfg) {
  for(const child of people.filter(p=>p.age<16&&!p.isCriminal)) {
    let left=Math.max(0,cfg.grainReserveNeed+cfg.grainNeed/2-child.grain);
    const adults=people.filter(p=>!p.isCriminal&&p.age>=16&&p.grain>cfg.grainReserveNeed+cfg.grainNeed)
      .sort((a,b)=>(b.klass===child.klass)-(a.klass===child.klass)||b.grain-a.grain);
    for(const adult of adults){const transfer=Math.min(left,adult.grain-cfg.grainReserveNeed-cfg.grainNeed);adult.grain-=transfer;child.grain+=transfer;left-=transfer;if(left<=0)break;}
  }
  for(const p of people){p.grain-=p.age<16?cfg.grainNeed/2:cfg.grainNeed;const need=p.age<16||p.klass==='worker'||p.klass==='merchant'?cfg.productNeedBase:3*cfg.productNeedBase;p.product=Math.max(0,p.product-need);}
}
for(let seed=1;seed<=120;seed++) {
  const s=newGame({seed});
  s.people=seedPopulation(s.rng,{farmer:seed*2,worker:seed,merchant:seed%4,official:seed%20});
  for(const [i,p] of s.people.entries()) {
    p.age=i%4===0?8:30;p.grain=seed%3===0?42:s.rng.uniform(-10,150);
    p.product=s.rng.uniform(0,20);p.isCriminal=i%13===0;
  }
  const reference=structuredClone(s.people);
  const grain=s.people.reduce((n,p)=>n+p.grain,0),product=s.people.reduce((n,p)=>n+p.product,0);
  referenceTrade(reference,s.cfg);trade(s.people,s.cfg,s.rng,[]);
  assert.deepEqual(s.people,reference,`trade seed ${seed}`);
  assert(Math.abs(grain-s.people.reduce((n,p)=>n+p.grain,0))<1e-6);
  assert(Math.abs(product-s.people.reduce((n,p)=>n+p.product,0))<1e-6);
  referenceConsume(reference,s.cfg);consume(s.people,s.cfg);
  assert.deepEqual(s.people,reference,`consume seed ${seed}`);
}
console.log('PASS 120 varied economies exactly match pre-optimization trade/support; grain and products conserved in trade');
