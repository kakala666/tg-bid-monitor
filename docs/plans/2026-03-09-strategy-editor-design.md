# 策略编辑器设计

## 目标

为策略引擎 V2 设计可视化流程图编辑器，让用户能直观地创建和编辑竞价策略。

## 页面入口

新增第5个导航页 `/strategy`，图标 `AccountTree`，标签"策略编辑"。

## 页面布局

三栏布局，遵循 MD3 Surface Container 层级：

```
┌──────────────────────────────────────────────────────────────┐
│  [广告策略]  [策略模板]           ← Tab 切换                   │
├──────────┬───────────────────────────────┬───────────────────┤
│ 策略列表  │       React Flow 画布         │   属性面板         │
│ (200px)  │       (flex grow)             │   (280px)         │
│          │                               │                   │
│ Surface  │   Surface Container Low       │  Surface          │
│ Container│                               │  Container        │
│          │    [自动布局]                  │                   │
└──────────┴───────────────────────────────┴───────────────────┘
```

- 左栏（200px）：策略/模板列表 + 新建按钮
- 中栏（flex）：React Flow 画布，右键菜单添加节点，拖拽连线
- 右栏（280px）：选中节点的属性编辑面板

### MD3 合规

- 三栏使用 Surface Container 层级区分（default → low → default）
- Tab 使用 MUI Tabs 组件，遵循 MD3 Primary Tab 规范
- 列表项使用 ListItemButton，选中态用 MD3 Secondary Container 色
- 属性面板使用 MD3 Filled TextField
- 按钮遵循 MD3 层级：主操作用 Filled，次操作用 Outlined/Text
- 节点颜色使用 theme palette 中的 MD3 色彩角色
- 右键菜单使用 MUI Menu，圆角 12px
- 图标使用 Material Icons Outlined 风格统一

## 节点可视化

| 节点类型 | 外观 | 颜色（theme） | 端口 |
|---|---|---|---|
| `start` | 圆角小矩形，"开始" | `text.secondary` 边框 | 1个输出 |
| `condition` | 带斜角矩形，显示表达式摘要 | `primary.main` 边框 | 1输入 + 2输出（是/否） |
| `action` | 圆角矩形，显示动作+目标价 | RAISE=`success` / LOWER=`warning` / KEEP=`text.secondary` / SKIP=`error` | 1输入，无输出 |
| `setVar` | 矩形，显示 `变量名 = 表达式` | `secondary.main` 边框 | 1输入 + 1输出 |
| `template` | 双线边框矩形，显示模板名 | `info.main` 边框 | 1输入，无输出 |

节点内文字：
- condition: 表达式摘要如 `rank > 3`
- action: `RAISE above+1`
- setVar: `gap = price - below`
- template: 模板名称

节点使用 MD3 Tonal Surface 风格：背景用对应颜色的浅色调（alpha 0.08），边框用主色，选中态加 MD3 state layer。

## 右键菜单

画布空白处右键弹出 MUI Menu：
- 添加条件节点
- 添加动作节点
- 添加变量节点
- 添加模板引用
- ── Divider ──
- 自动布局

## 属性面板

选中不同类型节点时显示不同编辑表单。面板标题区使用 MD3 Typography title-medium。

### condition 节点

默认结构化模式：
- 左值：Select 下拉（myAd.rank / myAd.price / above.price / below.price / budgetLimit / gapThreshold / rankLimit / vars.xxx / ad("XX").price）
- 运算符：Select 下拉（> / < / >= / <= / == / !=）
- 右值：TextField（数字）或 Select（变量）
- Switch "高级模式" → 切换为自由文本 TextField

### action 节点

- 动作类型：Select（RAISE / LOWER / KEEP / SKIP）
- 目标价表达式（RAISE/LOWER 时）：
  - 结构化：基准 Select（above.price / below.price / myAd.price / budgetLimit）+ 运算符 Select（+ / -）+ 数字 TextField
  - Switch "高级模式" → 自由文本

### setVar 节点

- 变量名：TextField
- 值表达式：结构化或高级模式

### template 节点

- 模板选择：Select 下拉（从 config.strategyTemplates 列出）

## 交互

### 添加节点
画布右键 → 选择节点类型 → 节点创建在右键位置

### 连线
从节点输出端口拖拽到目标节点输入端口。condition 节点有两个输出端口（标记"是"/"否"）。

### 删除
选中节点/连线后按 Delete 键，或右键菜单删除。

### 自动布局
工具栏按钮，使用 dagre 库做从上到下的有向图自动布局。新建策略时自动执行一次。

## 数据流

1. 页面加载：从 `config.adStrategies` 和 `config.strategyTemplates` 读取
2. 转换为 React Flow 格式（添加 position、style 等前端字段）
3. 编辑时修改 React Flow 本地状态
4. 保存时转换回引擎格式 `{ nodes: [{id, type, expr, ...}], edges: [{from, to, branch}] }`，写入 config
5. 新建广告策略时用 `generateDefaultStrategy()` 生成初始流程图

## 依赖

- `@xyflow/react` — React Flow v12 流程图画布
- `dagre` — 有向图自动布局

## 不做的事

- 撤销/重做
- 策略模拟运行/预览
- 表达式语法高亮
- 拖拽排序节点位置（靠自动布局）
