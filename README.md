# TG Bid Monitor - Telegram 广告竞价监控

实时监控 Telegram 广告排名，根据策略自动调整出价。

## 功能

- 实时排名监控与 WebSocket 推送
- 可视化策略编辑器（流程图拖拽）
- AI 策略生成/分析（支持 OpenAI 兼容 API）
- 自动竞价执行（加价/降价/保持/跳过）
- 分时段轮询间隔与预算控制
- 数据统计与趋势分析
- Telegram 群组通知

## 快速开始

### 1. 环境要求

- Node.js 18+
- Telegram 账号
- Telegram API 凭证（从 [my.telegram.org](https://my.telegram.org/apps) 获取）

### 2. 安装

```bash
git clone https://github.com/kakala666/tg-bid-monitor.git -b V2
cd tg-bid-monitor
npm install
```

### 3. 配置

**环境变量** — 复制 `.env.example` 为 `.env` 并填写：

```bash
cp .env.example .env
```

```env
API_ID=你的api_id          # 从 my.telegram.org 获取
API_HASH=你的api_hash      # 从 my.telegram.org 获取
PHONE=+86xxxxxxxxxx        # 手机号（带国际区号）
WEB_PORT=3000              # Web 控制台端口
```

**广告配置** — 复制 `config.example.json` 为 `config.json` 并修改：

```bash
cp config.example.json config.json
```

```jsonc
{
  "botUsername": "广告Bot用户名",    // 不带 @
  "checkInterval": 10,              // 默认轮询间隔（秒）
  "autoBidEnabled": false,          // 自动竞价开关
  "adConfigs": {
    "AD0001": {                     // 广告ID
      "note": "备注",
      "priceGapThreshold": 5,       // 价差阈值（U）
      "rankLimit": 5,               // 目标最高排名
      "timeSlots": [{
        "start": "00:00",
        "end": "24:00",
        "budgetLimit": 200          // 预算上限（U）
      }]
    }
  }
}
```

### 4. 启动

```bash
npm start
```

`npm start` 会自动构建 V2 前端再启动后端服务（首次构建需要约 10 秒）。首次启动会提示输入 Telegram 验证码（发送到你的 Telegram），登录成功后 session 会保存到 `session.txt`，之后启动无需再次验证。

### 5. 使用

浏览器打开 `http://localhost:3000`（自动跳转到 V2）

1. 点击 **首次导航** — 让程序导航到 Bot 的广告排名页
2. 点击 **手动刷新** — 获取当前排名数据
3. 在 **设置** 页配置广告和竞价参数
4. 在 **策略** 页编辑竞价策略流程图
5. 点击 **启动监控** — 开始自动轮询和竞价

## 页面说明

| 页面 | 功能 |
|------|------|
| 仪表盘 | 实时排名、监控状态、操作日志 |
| 数据分析 | 广告数据趋势图表 |
| 策略编辑 | 可视化流程图策略编辑、AI 生成/分析 |
| 配置管理 | 广告配置、轮询时段、AI API 设置 |
| 调试 | 发送命令、点击按钮、查看原始数据 |

## 开发模式

前端开发时可使用 Vite 热更新：

```bash
npm run dev:v2
```

Vite 开发服务器运行在 `http://localhost:5173/v2/`，API 和 WebSocket 自动代理到后端 3000 端口。

## 项目结构

```
├── src/
│   ├── index.js              # 入口：Telegram 登录 + 启动 Web 服务
│   ├── telegram.js           # Telegram 客户端交互
│   ├── logger.js             # 日志系统
│   ├── stats.js              # 统计计算
│   ├── strategy-v2/          # V2 策略引擎
│   │   ├── index.js          # 策略计算入口
│   │   ├── executor.js       # 流程图执行器
│   │   ├── expr.js           # 表达式解析
│   │   └── safety.js         # 安全检查
│   └── web/
│       ├── server.js         # Express + WebSocket 服务
│       └── v2/               # React 前端源码
│           ├── src/
│           │   ├── pages/    # 页面组件
│           │   ├── components/
│           │   ├── stores/   # Zustand 状态管理
│           │   └── hooks/    # WebSocket 等 hooks
│           └── vite.config.js
├── config.json               # 运行时配置（gitignore）
├── .env                      # 环境变量（gitignore）
└── session.txt               # Telegram 登录会话（gitignore）
```
