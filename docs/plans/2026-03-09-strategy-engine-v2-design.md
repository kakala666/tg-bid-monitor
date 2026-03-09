# 策略引擎 V2 设计

## 目标

将硬编码的竞价决策树重构为基于**有向图（流程图）**的可配置策略引擎，让用户能自定义竞价逻辑。

## 核心概念

引擎基于有向图执行。每个广告关联一个流程图，流程图由**节点**和**连线**组成，从入口节点开始，沿连线依次执行，直到命中动作节点产出结果。

## 节点类型

| 类型 | 说明 |
|---|---|
| `start` | 入口节点，每个流程图有且只有一个，无输入连线 |
| `condition` | 条件判断，计算表达式，根据 true/false 走不同分支 |
| `action` | 终止节点，产出竞价动作（RAISE/LOWER/KEEP/SKIP）+ 目标价表达式 |
| `setVar` | 设置变量，将表达式结果存入自定义变量，然后继续沿连线执行 |
| `template` | 子流程引用，嵌入一个策略模板，执行完后沿模板的出口继续 |

## 表达式系统

支持简单数学和比较运算的安全表达式，**不**支持函数调用和任意 JS 执行。

### 可用变量（执行上下文）

```
myAd.rank, myAd.price, myAd.adId
above.rank, above.price, above.adId    // 上方最近非自家广告，无则 null
below.rank, below.price, below.adId    // 下方最近非自家广告
budgetLimit                            // 当前时段预算上限
gapThreshold                           // 价差阈值
rankLimit                              // 排名上限
rankings.length                        // 排名总数
ad("AD2480").rank, ad("AD2480").price   // 按广告ID访问特定竞争对手
vars.xxx                               // 用户自定义变量
```

### 支持的运算符

`+  -  *  /  %  >  <  >=  <=  ==  !=  &&  ||  !`

### 表达式示例

- 条件：`myAd.rank > rankLimit && above.price - myAd.price < 5`
- 目标价：`above.price + 1`
- 设置变量：`myAd.price - below.price`

## 策略模板（可复用子流程）

用户可以创建命名的策略模板，模板本身也是一个完整的流程图。在广告的主流程中通过 `template` 节点引用。模板可以被多个广告复用，减少重复配置。

```
广告AD2480的流程图:
  start → condition(排名检查)
    → yes → [模板: 激进策略]  → 输出
    → no  → [模板: 保守策略]  → 输出
```

## 数据结构

```json
{
  "strategyTemplates": {
    "aggressive": {
      "name": "激进策略",
      "nodes": [
        { "id": "s", "type": "start" },
        { "id": "c1", "type": "condition", "expr": "above != null" },
        { "id": "a1", "type": "action", "action": "RAISE", "targetExpr": "above.price + 1" },
        { "id": "a2", "type": "action", "action": "KEEP" }
      ],
      "edges": [
        { "from": "s", "to": "c1" },
        { "from": "c1", "to": "a1", "branch": "yes" },
        { "from": "c1", "to": "a2", "branch": "no" }
      ]
    }
  },
  "adStrategies": {
    "AD2480": {
      "nodes": [
        { "id": "s", "type": "start" },
        { "id": "c1", "type": "condition", "expr": "myAd.rank < rankLimit" },
        { "id": "t1", "type": "template", "templateId": "aggressive" },
        { "id": "sv1", "type": "setVar", "varName": "gap", "expr": "myAd.price - below.price" },
        { "id": "c2", "type": "condition", "expr": "vars.gap > gapThreshold" },
        { "id": "a1", "type": "action", "action": "LOWER", "targetExpr": "below.price + 1" },
        { "id": "a2", "type": "action", "action": "KEEP" }
      ],
      "edges": [
        { "from": "s", "to": "c1" },
        { "from": "c1", "to": "t1", "branch": "no" },
        { "from": "c1", "to": "sv1", "branch": "yes" },
        { "from": "sv1", "to": "c2" },
        { "from": "c2", "to": "a1", "branch": "yes" },
        { "from": "c2", "to": "a2", "branch": "no" }
      ]
    }
  }
}
```

## 引擎执行流程

```
1. 从 start 节点出发
2. 沿唯一出边到下一个节点
3. 根据节点类型：
   - condition: 计算表达式 → true走yes边, false走no边
   - setVar: 计算表达式 → 存入vars → 沿出边继续
   - template: 进入子流程执行 → 子流程返回action → 作为本节点结果
   - action: 返回 { action, targetPrice }
4. 重复直到命中 action 或超过步数上限(100步)
```

## 安全防护

| 规则 | 行为 |
|---|---|
| 目标价 > budgetLimit | 强制覆盖为 budgetLimit |
| 目标价 < 50U | 强制覆盖为 50U |
| 执行超过 100 步 | 终止，返回 KEEP |
| 表达式解析失败 | 终止，返回 KEEP，记录错误日志 |
| 模板循环引用 | 构建时检测，拒绝保存 |

## 与现有系统的兼容

- `calcAllBids(rankings, config)` 接口签名不变，内部改为流程图引擎
- 输出格式不变：`{ suggestions: [{adId, action, currentPrice, targetPrice, reason, ...}] }`
- `reason` 字段改为记录流程图执行路径，如 `"start → c1(yes) → sv1 → c2(no) → KEEP"`
- 未配置流程图的广告仍返回 SKIP
- `server.js` 调用方无需修改

## 不做的事

- 前端流程图编辑器（后续单独设计）
- 跨轮次状态/历史记忆（本轮不做）
- 表达式中的函数调用
