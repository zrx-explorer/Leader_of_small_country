/**
 * 经济模拟模块：生产、交易、消费
 */
import { CLASS } from './config.js';
import { clamp } from './math.js';

/** 第一产业：农民生产粮食 */
export function farmersProduce(people, cfg, rng) {
  for (const p of people) {
    if (p.klass !== CLASS.FARMER || p.isCriminal || p.age < 16) continue;
    const t = clamp(p.intelligence, 10, 100);
    const yearly = cfg.yearlyFarmMultiplier ?? 1;
    const rawOutput = (cfg.farmerProdMean / 10
      + cfg.farmerProdJitter * (t - 50) / 100
      + rng.uniform(-1, 1)) * yearly;
    // 策划基线：一名农民至少供养 13 人；高于下限的原产量保持不变。
    const output = Math.max(cfg.grainNeed * 13, rawOutput);
    p.grain += output;
    p.yearIncome = output;
  }
}

/** 第二产业：工人生产产品 */
export function workersProduce(people, cfg, rng) {
  for (const p of people) {
    if (p.klass !== CLASS.WORKER || p.isCriminal || p.age < 16) continue;
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
  return settleMarket(people, cfg, log);
}

// 逐笔成交同时结算，商人不再因先付进货款而陷入流动性死锁。
// 最小堆保持「优先向最缺粮工人采购」，同粮食时沿用人口顺序。
// 每笔只修复堆顶 O(log n)，避免反复分配数组并排序所有工人。
class SellerQueue {
  constructor(workers, reserve) {
    this.reserve = reserve;
    this.items = workers.map((person, order) => ({ person, order })).filter(x => x.person.product > reserve);
    for (let i = Math.floor(this.items.length / 2) - 1; i >= 0; i--) this.sift(i);
  }
  before(a, b) { return a.person.grain < b.person.grain || (a.person.grain === b.person.grain && a.order < b.order); }
  sift(i) {
    const h = this.items;
    while (i * 2 + 1 < h.length) {
      let child = i * 2 + 1;
      if (child + 1 < h.length && this.before(h[child + 1], h[child])) child++;
      if (!this.before(h[child], h[i])) break;
      [h[i], h[child]] = [h[child], h[i]];
      i = child;
    }
  }
  get first() { return this.items[0]?.person; }
  update() {
    if (this.first.product <= this.reserve) {
      const last = this.items.pop();
      if (this.items.length) this.items[0] = last;
    }
    this.sift(0);
  }
}

function settleMarket(people, cfg, log) {
  const workers = people.filter(p => p.klass === CLASS.WORKER && !p.isCriminal && p.age >= 16);
  const merchants = people.filter(p => p.klass === CLASS.MERCHANT && !p.isCriminal && p.age >= 16);
  if (!workers.length) return;
  const sellers = new SellerQueue(workers, cfg.productReserveNeed);
  const wholesale = 3 * (cfg.yearlyPriceMultiplier ?? 1);
  let sold = 0, profit = 0, cursor = 0;
  for (const buyer of people.filter(p => !p.isCriminal && p.klass !== CLASS.WORKER)) {
    const need = buyer.age < 16 ? 1 : buyer.klass === CLASS.MERCHANT ? 1 : 3;
    let demand = Math.max(0, need + cfg.productReserveNeed - buyer.product);
    const price = buyer.klass === CLASS.FARMER ? (wholesale + 1) * 1.2 : wholesale * 1.1;
    while (demand > 0.001) {
      const worker = sellers.first;
      if (!worker) break;
      const merchant = merchants.length ? merchants[cursor++ % merchants.length] : null;
      const unitPrice = merchant && merchant !== buyer ? price : wholesale;
      const quantity = Math.min(1, demand, worker.product - cfg.productReserveNeed, Math.max(0, buyer.grain - cfg.grainReserveNeed) / unitPrice);
      if (quantity <= 0.001) break;
      const payment = quantity * wholesale;
      buyer.grain -= quantity * unitPrice;
      buyer.product += quantity;
      worker.product -= quantity;
      worker.grain += payment;
      worker.yearIncome = (worker.yearIncome || 0) + payment;
      if (merchant && merchant !== buyer) {
        const margin = quantity * (unitPrice - wholesale);
        merchant.grain += margin;
        merchant.yearIncome = (merchant.yearIncome || 0) + margin;
        profit += margin;
      }
      sold += quantity;
      demand -= quantity;
      sellers.update();
    }
  }
  if (log) log.push(`商贸成交 ${sold.toFixed(1)} 件（商人毛利 ${profit.toFixed(1)}${merchants.length ? '' : '，集市直接交易'}）`);
}

/** 家庭赡养先转移真实存粮，不凭空产生资源；未成年人按半份口粮。 */
export function consume(people, cfg) {
  const reserve = cfg.grainReserveNeed + cfg.grainNeed;
  const adults = people.filter(p => !p.isCriminal && p.age >= 16 && p.grain > reserve);
  for (const child of people.filter(p => p.age < 16 && !p.isCriminal)) {
    const needed = Math.max(0, cfg.grainReserveNeed + cfg.grainNeed / 2 - child.grain);
    let left = needed;
    while (left > 0) {
      // 只寻找本次捐粮人；保持同阶级优先、余粮最多优先及稳定同值顺序。
      let adult = null;
      for (const candidate of adults) {
        if (candidate.grain <= reserve) continue;
        if (!adult || ((candidate.klass === child.klass) && adult.klass !== child.klass)
          || ((candidate.klass === child.klass) === (adult.klass === child.klass) && candidate.grain > adult.grain)) adult = candidate;
      }
      if (!adult) break;
      const transfer = Math.min(left, adult.grain - reserve);
      adult.grain -= transfer; child.grain += transfer; left -= transfer;
      if (left <= 0) break;
    }
  }
  for (const p of people) {
    p.grain -= p.age < 16 ? cfg.grainNeed / 2 : cfg.grainNeed;
    const need = p.age < 16 || p.klass === CLASS.WORKER || p.klass === CLASS.MERCHANT ? cfg.productNeedBase : 3 * cfg.productNeedBase;
    p.product = Math.max(0, p.product - need);
  }
}
