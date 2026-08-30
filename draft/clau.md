# JSONPC 库产物大小分析报告

## 问题概述
- **源码总大小**: ~23KB (TypeScript)
- **构建产物大小**: ~10.8KB (minified)
- **依赖包**: reflect-deep (~4.2KB)

## 详细分析

### 1. 依赖打包影响 ⚠️ 主要因素
```typescript
// tsdown.config.ts 中配置
deps: {
  alwaysBundle: ['reflect-deep'],  // 强制打包整个reflect-deep库
}
```
- `reflect-deep` 包本身大小约 4.2KB
- 提供深度属性操作：`get`, `set`, `has`, `deleteProperty`, `reach` 等
- 使用 Reflect API 实现强大的对象操作，但增加了代码体积

### 2. Walker 类的复杂性 📊
```typescript
// walker.class.ts - ~4.7KB 源码
export class Walker {
  // 15+ 个处理器属性
  onComma, onColon, onQuote, onBrace, onBracket, 
  onEscape, onStringContent, onOther, afterChar...
  
  // 复杂的状态机逻辑
  run(): this {
    let escaped = false;
    // 多层嵌套的条件判断
  }
}
```
- 状态机类，包含 15+ 个处理器函数
- 即使 minified，条件分支和函数调用仍然占用空间
- 用于字符串解析和JSON遍历的核心逻辑

### 3. 核心业务逻辑复杂度 🔄
```typescript
// index.ts - JSONPC 构造函数
constructor(text: string, reviver?: Function) {
  // 1. 多次文本处理
  const lines0 = text.split(/(\r\n|\r|\n)/)
    .map((t) => t.trim())
    .filter((v) => v.length > 0);
  
  // 2. 注释过滤和聚合
  const withoutComments = lines0.filter(_notComment);
  
  // 3. 尾部逗号处理
  const rawJson = stripTrailingCommas(withoutComments.join(''));
  
  // 4. JSON解析（两次）
  this.data = JSON.parse(rawJson, reviver);
  
  // 5. 注解处理逻辑
  const { lines, unames } = mark(aggregate(lines0));
  this.data = JSON.parse(lines.join(''));
  this.comments = visit(this.data, unames);
}
```

### 4. serialize 函数的递归复杂性 📝
```typescript
// initializers.ts - serialize函数
export function serialize(
  commentMap: any, obj: any, pad: number, 
  replacer: Function | null, depth: number = 0,
  path: string[] = [], lines: string[] = []
): string[] {
  // 处理多种情况：
  // - 原始值、数组、对象
  // - replacer函数调用
  // - 注释插入逻辑
  // - 递归调用
}
```
- 递归函数，处理多种数据类型
- 包含缩进计算和注释插入逻辑
- 条件分支众多，minified后仍有体积

### 5. 数组操作函数 🔄
```typescript
// array.ts - 复杂的索引操作
export const shift = (arr, args, commentsMap, path) => {
  const lastIndex = arr.length - 1;
  for (let i = 0; i < lastIndex; i++) {
    _move(commentsMap, [...path, i + 1], [...path, i]);
  }
  _delete(commentsMap, [...path, lastIndex]);
  return arr.shift();
};

// splice 操作最复杂，涉及插入/删除/移动三个阶段
export const splice = (arr, args, commentsMap, path) => {
  // 1. 删除范围注释
  // 2. 移动后续元素注释
  // 3. 清理新插入位置注释
}
```

## 体积分配估算 📊

| 组件 | 源码大小 | 估算产物大小 | 占比 |
|------|----------|---------------|------|
| reflect-deep | 4.2KB | ~3.5KB | 32% |
| Walker 类 | 4.7KB | ~2.5KB | 23% |
| JSONPC 核心逻辑 | 5.8KB | ~2.0KB | 18% |
| serialize + helpers | 5.9KB | ~1.5KB | 14% |
| 数组操作 | 3.1KB | ~1.0KB | 9% |
| 其他工具函数 | ~3KB | ~0.4KB | 4% |

## 优化建议 🎯

### 1. 减少依赖体积
```typescript
// 考虑用简单的内联实现替换部分 reflect-deep 功能
deps: {
  // 只打包真正需要的部分
  alwaysBundle: []  // 让外部依赖处理
}
```

### 2. 简化 Walker 类
- 考虑用简单的循环替代部分状态机
- 合并相似的处理器函数

### 3. 优化解析逻辑
```typescript
// 避免多次 JSON.parse
constructor(text: string, reviver?: Function) {
  // 合并解析步骤
  const parsed = this.parseOnce(text, reviver);
  this.data = parsed.data;
  this.comments = parsed.comments;
}
```

### 4. Tree-shaking 优化
```typescript
// 导出更模块化的接口
export { parse, stringify } from './core/index.js';
export { JSONPC } from './class.js';
// 让用户按需引入
```

## 结论 💡

对于这个功能复杂度的库来说，10KB 是合理的大小：
- ✅ 支持注释解析和序列化
- ✅ 深度属性操作 (reflect-deep)
- ✅ 复杂数组操作保持注释同步
- ✅ 自定义 Walker 状态机

**相比手动实现这些功能，10KB 的体积是值得的权衡。**

## 性能 vs 体积权衡 🔄

| 选项 | 体积 | 功能 | 复杂度 |
|------|------|------|--------|
| 当前方案 | 10KB | 完整 | 中等 |
| 简化版本 | ~6KB | 基础 | 低 |
| 完全内联 | ~8KB | 完整 | 高 |

推荐保持当前方案，除非有极端体积要求。