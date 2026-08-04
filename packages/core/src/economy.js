/**
 * 经济模拟模块：生产、交易、消费
 */
import { CLASS } from './config.js';
import { productDemand, clamp } from './math.js';

/** 第一产业：农民生产粮食 */
export function farmersProduce(people, cfg, rng) {
  for (const p of people) {
    if (p.klass !== CLASS.FARMER || p.isCriminal) continue;
    const t = clamp(p.intelligence, 10, 100);
    const yearly = cfg.yearlyFarmMultiplier ?? 1;
    const rawOutput = (cfg.farmerProdMean / 10
      + cfg.farmerProdJitter * (t - 50) / 100
      + rng.uniform(-1, 1)) * yearly;
    // 策划基线：一名农民至少供养 13 人；高于下限的原产量保持不变。
    p.grain += Math.max(cfg.grainNeed * 13, rawOutput);
  }
}

/** 第二产业：工人生产产品 */
export function workersProduce(people, cfg, rng) {
  for (const p of people) {
    if (p.klass !== CLASS.WORKER || p.isCriminal) continue;
    const t = clamp(p.intelligence, 10, 100);
    const yearly = cfg.yearlyWorkerMultiplier ?? 1;
    const rawOutput = (cfg.workerProdMean / 5
      + cfg.workerProdJitter * (t - 50) / 100
      + rng.uniform(-0.5, 0.5)) * yearly;
    const output = Math.max(cfg.productNeedBase * 13, rawOutput);
    p.product += output;
    // 生产成本（消耗粮食）
    p.grain -= cfg.productionCost * output / 5;
  }
}

/** 交易：商人撮合工人 -> 农民 / 公务员 的产品流通 */
export function trade(people, cfg, rng, log) {
  const workers = people.filter(p => p.klass === CLASS.WORKER && !p.isCriminal);
  const merchants = people.filter(p => p.klass === CLASS.MERCHANT && !p.isCriminal);
  const buyers = people.filter(p => !p.isCriminal && (p.klass === CLASS.FARMER || p.klass === CLASS.OFFICIAL));

  if (!merchants.length || !workers.length || !buyers.length) return;

  // 原策划案：工人集合定价不低于 3；商人先从工人处进货，再卖给官员和农民。
  const wholesalePrice = 3 * (cfg.yearlyPriceMultiplier ?? 1);
  const remainingDemand = new Map();
  for (const buyer of buyers) {
    const demand = productDemand(buyer.satisfaction, cfg.productDemandLow, cfg.productDemandHigh);
    remainingDemand.set(buyer.id, Math.max(cfg.productNeedBase, Math.min(demand, cfg.productReserveNeed)));
  }

  let totalBought = 0, totalSold = 0, totalProfit = 0;
  for (let merchantIndex = 0; merchantIndex < merchants.length; merchantIndex++) {
    const merchant = merchants[merchantIndex];
    merchant.product = Math.max(0, merchant.product || 0);
    const demandLeft = buyers.reduce((sum, buyer) => sum + (remainingDemand.get(buyer.id) || 0), 0);
    let toBuy = Math.max(0, Math.min(
      demandLeft - merchant.product,
      Math.max(0, merchant.grain) / wholesalePrice,
    ));

    // 尽量吃下全部可获利货源，但给工人留下自己的年度基本消费。
    for (const worker of workers.slice().sort((a, b) => b.product - a.product)) {
      const available = Math.max(0, worker.product - cfg.productNeedBase);
      const take = Math.min(available, toBuy);
      if (take <= 0) continue;
      const payment = take * wholesalePrice;
      worker.product -= take;
      worker.grain += payment;
      merchant.grain -= payment;
      merchant.product += take;
      totalBought += take;
      toBuy -= take;
      if (toBuy <= 0) break;
    }

    // 逐利排序：农村按含运输成本的 15%—25% 起价议价；官员固定加价 10%。
    const quotedBuyers = buyers.map(buyer => {
      const demand = remainingDemand.get(buyer.id) || 0;
      const startMarkup = Math.max(1.15, 1.25 - merchantIndex * 0.10);
      const askingPrice = buyer.klass === CLASS.OFFICIAL
        ? wholesalePrice * 1.10
        : (wholesalePrice + 1) * startMarkup;
      return { buyer, demand, askingPrice };
    }).filter(x => x.demand > 0)
      .sort((a, b) => b.askingPrice - a.askingPrice || b.buyer.grain - a.buyer.grain);

    for (const quote of quotedBuyers) {
      if (merchant.product <= 0) break;
      const { buyer } = quote;
      let price = quote.askingPrice;
      if (buyer.klass === CLASS.FARMER) {
        const base = wholesalePrice + 1;
        while (price > base * 1.01 && buyer.grain < price) price -= base * 0.05;
        if (buyer.grain < price) price = base;
      }
      const quantity = Math.min(quote.demand, merchant.product, Math.max(0, buyer.grain) / price);
      if (quantity <= 0) continue;
      const revenue = quantity * price;
      merchant.product -= quantity;
      merchant.grain += revenue;
      buyer.grain -= revenue;
      buyer.product += quantity;
      remainingDemand.set(buyer.id, quote.demand - quantity);
      totalSold += quantity;
      totalProfit += quantity * (price - wholesalePrice);
    }
  }
  if (log) log.push(`商贸成交 ${totalSold.toFixed(1)} 件（进货 ${totalBought.toFixed(1)}，商人毛利 ${totalProfit.toFixed(1)}）`);
}

/** 消费：所有人消耗粮食和产品 */
export function consume(people, cfg) {
  for (const p of people) {
    p.grain -= cfg.grainNeed;
    p.product = Math.max(0, p.product - cfg.productNeedBase);
  }
}
