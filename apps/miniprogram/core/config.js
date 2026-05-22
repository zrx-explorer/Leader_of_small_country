// 小程序版本（CommonJS）—— 与 packages/core/src/config.js 等价
const CLASS = Object.freeze({ FARMER:'farmer', WORKER:'worker', MERCHANT:'merchant', OFFICIAL:'official' });
const OFFICIAL_ROLE = Object.freeze({ TAX:'tax', SECURITY:'security', WELFARE:'welfare', MILITARY:'military', TEACHER:'teacher', GOVERNOR:'governor' });

const DEFAULT_CONFIG = Object.freeze({
  grainNeed:10, grainReserveNeed:20, productNeedBase:2, productReserveNeed:4,
  productDemandLow:12, productDemandHigh:15, rebelThreshold:-10, inflatedThreshold:15,
  farmerProdMean:130, farmerProdJitter:30, workerProdMean:20, workerProdJitter:1, productionCost:2,
  taxFarmer:0.05, taxWorker:0.075, taxMerchant:0.10,
  govWage:60, militaryRatio:0.20,
  teacherPerStudents:10, intelligenceGainPerYear:0.25, intelligenceCap:5, satisfactionFromEdu:0.5,
  birthAgeMin:18, birthAgeMax:30, deathStartAge:50, deathHardCap:90,
  bucketModeThreshold:200,
});

const CHAPTERS = [
  { id:1, name:'立国', goalYears:5,   minSatisfaction:5,   init:{ farmer:10, worker:5, merchant:2, official:5 } },
  { id:2, name:'兴邦', goalYears:20,  minTreasury:5000, minPopulation:200, init:{ farmer:30, worker:15, merchant:5, official:10 } },
  { id:3, name:'治世', goalYears:50,  minIntelligence:70,  init:{ farmer:60, worker:40, merchant:10, official:20 } },
  { id:4, name:'盛世', goalYears:100, allClassMinSat:10,   init:{ farmer:150, worker:120, merchant:30, official:40 } },
];

module.exports = { CLASS, OFFICIAL_ROLE, DEFAULT_CONFIG, CHAPTERS };
