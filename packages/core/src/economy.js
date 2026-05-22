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
    const out = cfg.farmerProdMean / 10
      + cfg.farmerProdJitter * (t - 50) / 100
      + rng.uniform(-1, 1);
    p.grain += Math.max(0, out);
  }
}

/** 第二产业：工人生产产品 */
export function workersProduce(people, cfg, rng) {
  for (const p of people) {
    if (p.klass !== CLASS.WORKER || p.isCriminal) continue;
    const t = clamp(p.intelligence, 10, 100);
    const out = cfg.workerProdMean / 5
      + cfg.workerProdJitter * (t - 50) / 100
      + rng.uniform(-0.5, 0.5);
    p.product += Math.max(0, out);
    // 生产成本（消耗粮食）
    p.grain -= cfg.productionCost * Math.max(0, out) / 5;
  }
}

/** 交易：商人撮合工人 -> 农民 / 公务员 的产品流通 */
export function trade(people, cfg, rng, log) {
  const workers = people.filter(p => p.klass === CLASS.WORKER && !p.isCriminal);
  const merchants = people.filter(p => p.klass === CLASS.MERCHANT && !p.isCriminal);
  const buyers = people.filter(p => p.klass === CLASS.FARMER || p.klass === CLASS.OFFICIAL);

  if (!merchants.length || !workers.length || !buyers.length) return;

  // 商人从工人处批发：定价 = max(3, 平均粮食意愿)
  const supplyPerMerchant = workers.reduce((s, w) => s + w.product, 0) * 0.7 / merchants.length;
  const wholesalePrice = 3;

  for (const m of merchants) {
    let bought = 0;
    for (const w of workers) {
      const take = Math.min(w.product * 0.5, supplyPerMerchant - bought);
      if (take <= 0) continue;
      w.product -= take;
      const pay = take * wholesalePrice;
      w.grain += pay;
      m.grain -= pay;
      m.product = (m.product || 0) + take;
      bought += take;
      if (bought >= supplyPerMerchant) break;
    }
  }

  // 商人卖给买家
  for (const buyer of buyers) {
    const need = productDemand(buyer.satisfaction, cfg.productDemandLow, cfg.productDemandHigh);
    if (need <= 0) continue;
    const want = Math.max(cfg.productNeedBase, Math.min(need, cfg.productReserveNeed));
    const m = merchants[rng.int(0, merchants.length - 1)];
    if (m.product <= 0) continue;
    const markup = (buyer.klass === CLASS.OFFICIAL) ? 1.1 : 1.2;
    const price = wholesalePrice * markup;
    const canBuy = Math.min(want, m.product, buyer.grain / price);
    if (canBuy > 0) {
      m.product -= canBuy;
      m.grain += canBuy * price;
      buyer.grain -= canBuy * price;
      buyer.product += canBuy;
    }
  }
  if (log) log.push(`商人撮合产品 ${merchants.length} 名商人参与交易`);
}

/** 消费：所有人消耗粮食和产品 */
export function consume(people, cfg) {
  for (const p of people) {
    p.grain -= cfg.grainNeed;
    p.product = Math.max(0, p.product - cfg.productNeedBase);
  }
}
