# 产物体积分析（约 10 KB）

## 现状

| 文件 | 体积 | 说明 |
|------|------|------|
| `dist/index.mjs` | 10.8 KB (3.6 KB gzip) | ESM 产物 |
| `dist/index.cjs` | 11.0 KB (3.6 KB gzip) | CJS 产物 |
| 源码 `.ts` | 794 行 (~19 KB) | 6 个模块 |

## 核心原因

### 1. `reflect-deep` 被整体内联 —— 最大膨胀源

`tsdown.config.ts` 中配置了 `alwaysBundle: ['reflect-deep']`，导致这个依赖被整个打包进产物。

`reflect-deep` 自身约 4.1 KB（未压缩），提供了 `has`、`get`、`set`、`reach`、`defineProperty`、`deleteProperty`、`ownKeys`、`groupedKeys` 等 8 个完整 API，每个都实现了递归深路径遍历。

**在产物 `index.mjs` 中可以看到**，开头的 `Array.isArray; const e=Array.from; ...` 到 `})(b||={});` 这一大段（约 300 行）全部是 reflect-deep 的代码。

### 2. 类实例化 + 命令行解析状态机体积不菲

- **`Walker` 类**（158 行）：一个全功能逐字符解析器，支持 `inString`、`onComma`、`onColon`、`onQuote`、`onBrace`、`onBracket`、`onEscape`、`onStringContent`、`onOther`、`afterChar` 等 10 种回调 + `stop()` 机制。为了支持注释文本中找属性名和去除尾部逗号这两个场景，实例化了两次，代码被保留。
- **`interpret-name.ts`**（53 行）+ **`trailing-comma.ts`**（57 行）：各自构造了一个 `Walker` 实例并注册部分回调，用于提取注释中的属性名和清洗尾部逗号。

### 3. `JSONPC` 类的 `set` / `get` / `updateArray` / `stringify` / `toObject` 方法较多

`index.ts`（181 行）中的主类包含了：

- `set(e, t)` 支持 `{value}` 或 `{comments}` 两种 payload
- `get(e)` 返回 `{value, comments}` 结构
- `updateArray(e, t, n)` 封装了 `push`/`pop`/`shift`/`unshift`/`splice`/`reverse` 共 6 种数组操作，每种都要同步维护 data 和 comments 两条路径
- `stringify(e, t)` 包含 `top` / `body` / `bottom` 三段式拼接
- 加上 `toObject()`、`destroy()` 等辅助方法

### 4. `minify: true` 反而让代码更难辨别

tsdown 使用 esbuild 做 minify，变量名被缩短为单字母（`e`, `t`, `n`, `r`, `i`, `a`, `o`, `s`, `c` 等），2 行被压成 1 行。**实际逻辑量并没有减少，只是可读性降低了**。

### 5. 来源闭包不存在——源码就是全部

源码总计 794 行，除去类型声明和空行，有效逻辑约 650 行。产物 10.8 KB 基本是 1:1 映射的结果，**没有引入意料之外的第三方代码**（除了 reflect-deep 是主动配置内联的）。

## 体积分解估算

| 来源 | 估算体积 | 占比 |
|------|----------|------|
| `reflect-deep` 内联代码 | ~3.5 KB | 33% |
| `Walker` 类 + 两次实例化 | ~2.5 KB | 23% |
| `JSONPC` 主类（set/get/updateArray/stringify） | ~2.5 KB | 23% |
| 注释提取/属性名解析 | ~1.0 KB | 9% |
| 数组操作（6 种方法） | ~0.8 KB | 7% |
| esbuild 运行时垫片/模块包装 | ~0.5 KB | 5% |

> 注：minify 后变量名共享，精确划分有难度，上述为合理估计。

## 结论

> **10 KB 不是意外，是 650 行有效逻辑 + 4 KB 内联依赖的正常结果。**

核心原因就一个：**`alwaysBundle: ['reflect-deep']` 把 ~4 KB 的依赖塞进了每个产物格式**。如果去掉这个配置：
- 运行时需要 `npm install reflect-deep`，用户安装体积变大但 **产物缩小约 35%**（~7 KB）
- 当前配置选择了"自包含、零安装依赖"的路线，产物大小是这种取舍的必然结果

## 可选的改进方向

| 方案 | 效果 | 代价 |
|------|------|------|
| 移除 `alwaysBundle`，改为 external | 产物 ~7 KB，减 35% | 用户需安装 reflect-deep |
| 移除 `reflect-deep` 自己实现深路径操作 | 产物 ~7 KB，零依赖 | 开发成本：~50 行手写代码 |
| 保留现状 | 10.8 KB，零运行时依赖 | 无 |
| 分析用户实际使用的 API，Tree Shake 未用部分 | 效果有限（几乎全用到） | 配置复杂 |
