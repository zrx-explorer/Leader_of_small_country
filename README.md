# 小国执政官 · Mini Archon

> 一款回合制经济社会模拟游戏 —— 你扮演一国执政官，在十年至百年的尺度上分配人口、调整税率、应对天灾人祸，让民众安居乐业，让国家走向稳定与昌盛。

[![Pages](https://img.shields.io/badge/Play-GitHub%20Pages-brightgreen)](#-在线游玩) [![License](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE) [![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20WeChat%20MiniProgram-orange)](#-跨平台)

---

## ✨ 游戏特色

- 🀄 **极简水墨风**：朱砂 + 米白 + 圆点纸纹，无需任何美术资源即可启动
- 🧠 **完整社会模拟**：6 阶级人口流动 / 价格弹性 / 阶级满意度 / 治安动乱 / 出生死亡
- 🎴 **8 张随机事件卡**：旱涝、瘟疫、起义、商队、外敌、流星雨、清官来访……
- 📈 **实时可视化**：自绘 Canvas 阶级饼图 + 历年人口/国库/治安曲线
- 🚀 **零构建依赖**：纯原生 ES Module，`git clone` 即跑，可直接部署到 GitHub Pages
- 📱 **跨平台**：核心逻辑包独立（`packages/core`），同时支持网页版与微信小程序

## 🎮 在线游玩

| 平台 | 地址 | 启动方式 |
|---|---|---|
| GitHub Pages | `https://<你的用户名>.github.io/<仓库名>/` | 推送到 main 分支自动部署 |
| 本地浏览器 | `http://localhost:8000/apps/web/` | `python -m http.server 8000` 后访问 |
| 微信小程序 | 开发者工具导入 `apps/miniprogram/` | 真机预览或上传审核 |

详情见 [📘 部署指南](./docs/部署指南.md)。

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/<你的用户名>/<仓库名>.git
cd <仓库名>

# 2. 启动本地服务（Web 端）
python -m http.server 8000
# 浏览器打开 http://localhost:8000/apps/web/

# 3. 真机预览（小程序端）
# 微信开发者工具 → 导入项目 → 选择 apps/miniprogram/ 目录
```

## 📂 项目结构

```
小国执政官/
├── README.md                    # 本文件
├── LICENSE                      # MIT 协议
├── index.html                   # 根入口（重定向到 apps/web/）
├── .github/workflows/pages.yml  # GitHub Pages 自动部署
│
├── docs/                        # 📚 文档中心
│   ├── 策划案_v2.md             # 改进版完整策划案
│   ├── 游戏说明.md              # 玩家视角玩法说明
│   ├── 部署指南.md              # 网页 / 小程序部署流程
│   └── CHANGELOG.md             # 版本变更日志
│
├── packages/core/               # 🧠 平台无关核心模拟引擎（ES Module）
│   └── src/
│       ├── config.js            # 全局配置 / 阶级 / 章节
│       ├── math.js              # RNG / 概率 / 数学工具
│       ├── person.js            # 人口模型
│       ├── economy.js           # 农工商业、产销
│       ├── society.js           # 满意度 / 治安 / 出生死亡 / 阶级流动
│       ├── government.js        # 任职 / 税收 / 工资 / 教育 / 军事
│       ├── events.js            # 8 张随机事件卡
│       └── game.js              # 主控状态机（newGame / nextYear）
│
├── apps/
│   ├── web/                     # 🌐 网页版（GitHub Pages）
│   │   ├── index.html
│   │   ├── styles/main.css
│   │   └── scripts/{charts,ui,main}.js
│   │
│   └── miniprogram/             # 📱 微信小程序版
│       ├── app.{js,json,wxss}
│       ├── project.config.json
│       ├── core/                # CommonJS 镜像（小程序兼容）
│       └── pages/{index,policy,about}/
│
└── 原始策划案/                   # 📎 用户提供的原始 docx / pdf
```

## 🎯 核心玩法

> 一年三阶段：**任命 → 结算 → 决策**

1. **任命**：分配五类公务员（教师 / 工人 / 商人 / 士兵 / 官员）配额
2. **结算**：自动计算粮食产出 / 税收 / 工资 / 教育 / 军事 / 满意度 / 治安 / 出生死亡
3. **决策**：调整 3 档税率 + 军费比例，应对随机事件，进入下一年

📖 **完整玩法**见 [游戏说明.md](./docs/游戏说明.md)

## 🏆 胜负条件

| 章节 | 目标年限 | 胜利条件 | 失败条件 |
|---|---|---|---|
| 第一章 · 立国 | 30 年 | 人口 ≥ 200 且国库 ≥ 5000 | 连续 3 年治安 < 10 或人口归零 |
| 第二章 · 守成 | 50 年 | 知识阶级 ≥ 30% 且无饥荒 | 满意度 < 20 持续 5 年 |
| 第三章 · 中兴 | 80 年 | 三大阶级满意度均 ≥ 60 | 国库连续负债 5 年 |

## 🛠️ 技术栈

- **核心**：原生 JavaScript（ES2020 Module / CommonJS 双版本）
- **可视化**：HTML5 Canvas（自绘饼图 + 折线图）
- **样式**：CSS Variables + Flex/Grid 中式水墨配色
- **构建**：**零依赖**，无需 webpack / vite / npm install
- **CI/CD**：GitHub Actions（auto deploy to Pages）

## 📜 文档导航

| 文档 | 受众 | 内容 |
|---|---|---|
| [策划案_v2.md](./docs/策划案_v2.md) | 策划 / 开发者 | 14 章完整设计：Game Loop、阶级、数值公式、事件、UI/UX、商业化 |
| [游戏说明.md](./docs/游戏说明.md) | 玩家 | 操作指引、新手心法、可视化解读 |
| [部署指南.md](./docs/部署指南.md) | 运维 / 推广 | GitHub Pages、微信小程序、Vercel 等多种发布方式 |
| [CHANGELOG.md](./docs/CHANGELOG.md) | 全员 | 版本变更日志 |

## 🤝 贡献

欢迎提 Issue / PR：

- 🐛 数值平衡反馈：请附上 seed 与年份截图
- 🎴 新事件卡设计：在 `packages/core/src/events.js` 新增配置
- 🎨 美术资源替换：纯文字图标 → SVG / 像素图，保留水墨配色
- 🌐 i18n 多语言：`config.js` 中文文案抽离为 `locales/`

## 📄 License

[MIT](./LICENSE) © 2026 小国执政官项目组

---

> "民为邦本，本固邦宁。" —— 《尚书·五子之歌》
