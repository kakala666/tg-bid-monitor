/**
 * 生成等价于旧 calcBidForAd 逻辑的默认流程图
 *
 * 逻辑流程:
 * 1. 排名优于上限 → KEEP（简化处理）
 * 2. 排名刚好在上限 → 检查与下一名差距，大于阈值则降价
 * 3. 第一名(或无上方广告) → 检查与下一名差距，大于阈值则降价
 * 4. 其他 → 尝试跳到上方广告上面（贪心）
 *    4a. 预算不够跳 → 检查与下方差距，大于阈值则降价
 */
export function generateDefaultStrategy() {
  return {
    nodes: [
      { id: 'start', type: 'start' },

      // 分支1: 排名上限检查
      { id: 'hasRankLimit', type: 'condition', expr: 'rankLimit != null' },
      { id: 'aboveLimit', type: 'condition', expr: 'myAd.rank < rankLimit' },
      { id: 'keepAboveLimit', type: 'action', action: 'KEEP' },

      // 排名刚好在上限
      { id: 'atLimit', type: 'condition', expr: 'myAd.rank == rankLimit' },
      { id: 'atLimitHasBelow', type: 'condition', expr: 'below != null' },
      { id: 'atLimitGapCalc', type: 'setVar', varName: 'gap', expr: 'myAd.price - below.price' },
      { id: 'atLimitGapCheck', type: 'condition', expr: 'vars.gap > gapThreshold' },
      { id: 'atLimitLower', type: 'action', action: 'LOWER', targetExpr: 'below.price + 1' },
      { id: 'atLimitKeep', type: 'action', action: 'KEEP' },

      // 分支2: 第一名检查
      { id: 'isFirst', type: 'condition', expr: 'above == null || myAd.rank == 1' },
      { id: 'firstHasBelow', type: 'condition', expr: 'below != null' },
      { id: 'firstGapCalc', type: 'setVar', varName: 'gap', expr: 'myAd.price - below.price' },
      { id: 'firstGapCheck', type: 'condition', expr: 'vars.gap > gapThreshold' },
      { id: 'firstLower', type: 'action', action: 'LOWER', targetExpr: 'below.price + 1' },
      { id: 'firstKeep', type: 'action', action: 'KEEP' },

      // 分支3: 尝试向上跳跃
      { id: 'canJump', type: 'condition', expr: 'above.price + 1 <= budgetLimit' },
      { id: 'doJump', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },

      // 跳不了 → 检查能否降价
      { id: 'noJumpHasBelow', type: 'condition', expr: 'below != null' },
      { id: 'noJumpGapCalc', type: 'setVar', varName: 'gap', expr: 'myAd.price - below.price' },
      { id: 'noJumpGapCheck', type: 'condition', expr: 'vars.gap > gapThreshold' },
      { id: 'noJumpLower', type: 'action', action: 'LOWER', targetExpr: 'below.price + 1' },
      { id: 'noJumpKeep', type: 'action', action: 'KEEP' },
    ],
    edges: [
      { from: 'start', to: 'hasRankLimit' },

      { from: 'hasRankLimit', to: 'aboveLimit', branch: 'yes' },
      { from: 'aboveLimit', to: 'keepAboveLimit', branch: 'yes' },
      { from: 'aboveLimit', to: 'atLimit', branch: 'no' },
      { from: 'atLimit', to: 'atLimitHasBelow', branch: 'yes' },
      { from: 'atLimit', to: 'isFirst', branch: 'no' },
      { from: 'atLimitHasBelow', to: 'atLimitGapCalc', branch: 'yes' },
      { from: 'atLimitHasBelow', to: 'atLimitKeep', branch: 'no' },
      { from: 'atLimitGapCalc', to: 'atLimitGapCheck' },
      { from: 'atLimitGapCheck', to: 'atLimitLower', branch: 'yes' },
      { from: 'atLimitGapCheck', to: 'atLimitKeep', branch: 'no' },

      { from: 'hasRankLimit', to: 'isFirst', branch: 'no' },

      { from: 'isFirst', to: 'firstHasBelow', branch: 'yes' },
      { from: 'firstHasBelow', to: 'firstGapCalc', branch: 'yes' },
      { from: 'firstHasBelow', to: 'firstKeep', branch: 'no' },
      { from: 'firstGapCalc', to: 'firstGapCheck' },
      { from: 'firstGapCheck', to: 'firstLower', branch: 'yes' },
      { from: 'firstGapCheck', to: 'firstKeep', branch: 'no' },

      { from: 'isFirst', to: 'canJump', branch: 'no' },
      { from: 'canJump', to: 'doJump', branch: 'yes' },
      { from: 'canJump', to: 'noJumpHasBelow', branch: 'no' },
      { from: 'noJumpHasBelow', to: 'noJumpGapCalc', branch: 'yes' },
      { from: 'noJumpHasBelow', to: 'noJumpKeep', branch: 'no' },
      { from: 'noJumpGapCalc', to: 'noJumpGapCheck' },
      { from: 'noJumpGapCheck', to: 'noJumpLower', branch: 'yes' },
      { from: 'noJumpGapCheck', to: 'noJumpKeep', branch: 'no' },
    ],
  };
}
