# Questions

以下是我在评审 `packages/jsonpc` 过程中发现的问题，需要你来确认或决策。

---

## 一、package.json 问题

### Q1: homepage 指向错误

`homepage` 指向了 `packages/lines`，应该是 `packages/jsonpc`。

```
"homepage": "https://github.com/baendlorel/tsumugi-lib/tree/main/packages/lines#readme"
```

需要改成 jsonpc 的路径吗？

要改

### Q2: bin 名称与包名不符

`bin` 中的命令名是 `"lines"`，但包名是 `json-property-comment`。

```json
"bin": {
  "lines": "./dist/index.mjs"
}
```

要不要改成像 `"jsonpc"` 这样的名字？

不需要，因为暂时不会用命令行来转换文件，可以删除

### Q3: 未使用的依赖

`dependencies` 里有 `glob` 和 `minimatch`，但源码中没有使用它们（只用到了 `reflect-deep`）。是历史遗留还是后续计划要用？可以删掉吗？

可以

### Q4: 关键词不准确

关键词 `cli` 和 `lines` 看起来是从其他包复制过来的，与本包无关。要修正吗？

要

### Q5: 缺少 build 脚本

`exports` 指向 `dist`，但 `scripts` 里没有 `build` 或 `prepublish` 脚本。需要加上吗？

没关系，这会使用全局脚本

---

## 二、README.md 为空

### Q6: README 写什么？

目前 README 只有 1 字节（空文件）。要不要我帮你写一个 quick start 示例？内容包括：简介、安装、基本用法（解析带注释的 JSON、读取/写入注释、序列化回文本）。

可以写一下背景、用法，用英文写

---

## 三、代码设计问题

### Q7: 注释只支持紧邻属性名上方，与 rules.md 不完全一致

`draft/rules.md` 第 4.4 条说注释可以出现在：

- 数组成员是原始类型 → 代表 `arr[i]` 的注释
- 数组成员是对象，在对象里面写注释 → 代表属性路径的注释
- 顶层是数组时，属性路径第一项为 `null`

但目前的实现中，`convertCommentsToProperties` 只把注释关联到**下一行的属性名**，并不处理嵌套位置（比如在 `{` 后面写注释应该关联到哪个属性？）。目前的实际行为是：

```json
{
  "arr": [
    {
      // 这个注释想给谁？——目前会报错或行为未定义
      "x": 1
    }
  ]
}
```

请问你希望支持到哪种程度？是严格按照 rules.md 来，还是先只支持"属性正上方"这一种位置，其他位置报错？

因为数组的情况实在是太复杂了，所以暂时只是支持属性值正上方的写法。你可以对rules.md文件的对应规则里做一下注释，注释为暂不实现

### Q8: `interpretName` 对非属性行的错误信息不友好

当注释不在属性名上方时（比如在 `{` 或 `[` 上方），会抛出：

```
Comments not above property names are not supported yet
```

要不要改成更明确的错误信息，比如"此处不允许写注释"？

可以，但提示语要用英文写

### Q9: `normalizeLines` 丢失空行和缩进

当前实现会 `trim()` 并过滤空行：

```ts
return text
  .split(/(\r\n|\r|\n)/)
  .map((t) => t.trim())
  .filter((v) => v.length > 0);
```

这导致 `stringify` 输出的格式和原始 JSON 一定不同（无法保留原始空行和缩进）。这是有意为之（统一输出格式），还是应该尽量保留原始格式？

没关系，你可以把这个写入readme的注意事项中。本项目只关注json的结构、数值，不会追求保留原本格式，否则解析将无法进行。

### Q10: `stripTopBottom` 用 `NaN` 做 sentinel value

当没有顶/底部注释时，返回 `NaN`：

```ts
return { top: NaN, bottom: NaN };
```

调用方用 `isNaN` 判断。要不要改成返回 `null` 或 `-1`，语义更清晰？

isNaN可以做到类型统一，实际上我感觉是更合适的，你可以改为Number.isNaN，这样更确保

### Q11: `visit` 函数不递归进入带注释的属性

关键 BUG：当属性的 key 有注释（被重命名为 UUID）时，`visit` 会 `continue` 跳过，导致该属性的子属性不会被收集。

```ts
if (origin) {
  map.set(JSON.stringify(path.concat(origin)), { origin, current: key });
  continue;  // ← 这里跳过了递归，子属性丢失
}
```

例如 `get("obj.nested")` 在这种情况下会找不到。需要修复吗？修复方案：即使属性有 origin，也要继续递归检查其 value 是否为对象/数组。

你说得很对，需要递归收集，这种情况下，传递的路径设计可能会复杂，你可以先做别的，我们再探讨。

---

## 四、测试覆盖问题

### Q12: 测试严重不足

- `tests/index.test.ts` 只有占位断言 `expect(5).toEqual(5)`
- 没有测试 `setComments` / `getComments` / `set` / `get` / `stringify` / `toJSON`
- 没有测试数组嵌套、多层嵌套、转义属性名、空对象等边界情况

需要我帮你补充测试吗？覆盖哪些场景优先级最高？

我所有的函数基本都导出了，因此你要对所有函数进行测试。我尽量是函数式的。

---

## 五、规则设计问题

### Q13: 顶层数组时属性路径以 `null` 开头

`draft/rules.md` 第 4.4.3 条：

> 顶层是数组的时候，数组里面的属性路径的第一项为 `null` 以表示区分

也就是说调用 `get("null.0.x")` 来访问？这个设计有点违反直觉，用户可能不理解为什么路径以 `null` 开头。有没有考虑过其他方案，比如空字符串 `""` 作为顶层标识，或者直接走 `"0.x"` 从索引 0 开始？

如果是顶层数组，则暂不支持比较好。因为数组的注释非常复杂。

---

## 六、tsconfig.json 问题

### Q14: rootDir 配置过宽

```json
"rootDir": "..",
"noEmit": true
```

`rootDir` 设置为 `..`（monorepo 根目录），同时 `noEmit: true`。这是为了配合 `paths` 中的 `@shared/*` 引用吗？目前这个包似乎没有使用 `@shared/*` 的导入。要不要收紧作用域？

这个没关系，因为所有的子包都如此配置，为的是共享shared的代码。
