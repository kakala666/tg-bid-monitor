# Web V2 设计方案 — React + MUI (MD3)

## 技术栈

| 层面 | 选型 |
|------|------|
| 框架 | React 18 |
| UI 库 | MUI v6 (默认主题 + 自定义 MD3 色板) |
| 图表 | MUI X Charts |
| 状态管理 | Zustand |
| 实时通信 | WebSocket (复用现有协议) |
| 构建 | Vite |
| 路由 | React Router v6 |

## 页面划分

| 页面 | 路由 | 内容 |
|------|------|------|
| 仪表盘 | `/` | 监控状态、实时排名表、竞价建议、操作日志 |
| 统计趋势 | `/analytics` | 图表可视化、历史趋势 |
| 配置管理 | `/settings` | Bot配置、广告独立配置、时段管理 |
| 调试工具 | `/debug` | 发送命令、点击按钮、查看原始消息 |

## 目录结构

```
src/web/v2/
├── index.html
├── vite.config.js
├── package.json
├── src/
│   ├── main.jsx
│   ├── App.jsx              ← 路由 + Navigation Rail
│   ├── theme.js             ← MUI 主题 (MD3 色板 + dark mode)
│   ├── stores/
│   │   └── useStore.js      ← Zustand store
│   ├── hooks/
│   │   └── useWebSocket.js  ← WebSocket 连接管理
│   ├── pages/
│   │   ├── Dashboard.jsx    ← 仪表盘 (三栏)
│   │   ├── Analytics.jsx    ← 统计趋势
│   │   ├── Settings.jsx     ← 配置管理
│   │   └── Debug.jsx        ← 调试工具
│   └── components/
│       ├── NavigationRail.jsx
│       ├── StatusChip.jsx
│       ├── RankingTable.jsx
│       ├── SuggestionCard.jsx
│       ├── LogPanel.jsx
│       ├── ControlPanel.jsx
│       ├── AdConfigForm.jsx
│       ├── BidChart.jsx
│       ├── RankChart.jsx
│       ├── ViewsChart.jsx
│       └── BalanceChart.jsx
```

## 布局设计

### 全局：Navigation Rail (左侧 72px)

4 个导航项：仪表盘、统计趋势、配置管理、调试工具。

### 仪表盘 — 三栏布局 (桌面优先)

```
┌──┬────────┬───────────┬──────────┐
│  │ 控制    │ 实时排名表  │ 竞价建议  │
│  │ 面板    │           │          │
│N │        │           │          │
│a │ 监控状态 │           │          │
│v │ 连接状态 │           ├──────────┤
│  │        │           │ 操作日志  │
│  │ 按钮组  │           │          │
└──┴────────┴───────────┴──────────┘
     ~220px    ~flex 1      ~360px
```

### 统计趋势 — 2x2 图表网格

```
┌──┬──────────────────────────────┐
│  │ [时间范围选择] [广告筛选 Chip] │
│  ├──────────────┬───────────────┤
│  │ 竞价价格走势   │ 排名变化       │
│  │ (折线图)      │ (折线图Y反转)  │
│  ├──────────────┬───────────────┤
│  │ 展示量增量     │ 余额消耗       │
│  │ (柱状图)      │ (面积图)       │
└──┴──────────────┴───────────────┘
```

### 配置管理 — 单栏表单

Bot 基础配置 + 广告独立配置（每个广告一个可展开的 Card）。

### 调试工具 — 单栏

输入栏 + 操作按钮 + 原始消息展示 + 按钮结构 JSON。

## MD3 主题

```js
colorSchemes: {
  dark: {
    palette: {
      primary:   { main: '#A0C4FF' },
      secondary: { main: '#F39C12' },
      error:     { main: '#E74C3C' },
      success:   { main: '#2ECC71' },
      warning:   { main: '#F39C12' },
      background: {
        default: '#1A1A2E',
        paper:   '#16213E',
      },
    },
  },
}
```

## Zustand Store

```js
{
  connected: false,
  monitoring: false,
  rankings: [],
  rankingsText: '',
  suggestions: [],
  logs: [],
  config: {},
  myAdsDetail: [],
}
```

## API 复用 (不改后端)

| 前端操作 | 现有 API |
|---------|---------|
| 首次导航 | POST /api/navigate |
| 刷新排名 | POST /api/refresh |
| 启停监控 | POST /api/monitor/start\|stop |
| 改价 | POST /api/bid |
| 读写配置 | GET/POST /api/config |
| 广告详情 | POST /api/myads |
| 统计数据 | GET /api/stats?granularity=&adId= |
| 实时推送 | WebSocket |
| 调试 | POST /api/click / POST /api/send / GET /api/dump |

## 部署

Vite 构建输出到 `src/web/public-v2/`，Express 加静态路由切换，不影响 V1。
