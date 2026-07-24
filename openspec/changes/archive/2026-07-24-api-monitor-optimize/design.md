## Context

目标文件为单文件 Tampermonkey 用户脚本 `API请求监控工具/api-monitor.user.js`（约 2700 行，v2.6）。脚本在 `document-start` 运行，拦截 fetch/XHR 与 console，通过 `window.open` 弹出监控窗展示 API/日志/Storage/Cookie，并用 `GM_setValue`/`GM_getValue` 持久化监控开关、关键字与请求历史。

本 change 只做「内部质量优化」：修正错误实现、降低卡顿与误报、抽出重复 UI、堵住监控窗 XSS。**不改变**对外功能清单；**明确保留**关闭监控窗即停止监控。

深度技术 Design Doc 将在 design 阶段细化；本文为 open 阶段高层框架。

## Goals / Non-Goals

**Goals:**

- 修复 fetch/XHR 采集正确性，且不破坏业务站点既有 XHR 回调
- 消除主世界/沙箱日志双记与 DOM Mutation 误报
- 降低高频请求/日志下的 UI 与持久化卡顿
- 减少重复代码与死代码，统一关键字与短 URL 行为
- 详情渲染对不可信响应内容安全展示
- 版本发布到 2.7（含 meta）

**Non-Goals:**

- 关闭窗口 ≠ 停止监控（用户明确排除）
- 体验增强：列表过滤、导出、状态球位置持久化、弹窗降级等（T15–T20）
- 落盘脱敏（T22）、说明文档同步（T23）、大段分区注释（T13）
- 拆多文件、改默认关键字集合、引入构建工具

## Decisions

### D1. 单文件内联改动，按任务串行提交

- **选择**：继续单文件；tasks 按 T1… 极细拆分，每任务验收后单独 commit
- **备选**：拆多文件 / 按批次多 change — 用户已选「单 change 细粒度 tasks」，同文件并行会冲突

### D2. Fetch body：先 text 再 parse

- **选择**：`clone()` → `text()` → try `JSON.parse` → 失败则保留 text
- **备选**：先 `json()` 失败再 `text()`（现状，body 已消费不可用）

### D3. XHR：addEventListener 旁路采集

- **选择**：在 `open` 时若命中监控关键字，挂 `_requestInfo`，用 `addEventListener('load'|'error'|'timeout'|'abort')` 写回并 `addRequestToList`；保留 `setRequestHeader` 包装与 `send` 记 body
- **备选**：继续赋值 `onload`（会与业务竞态覆盖）
- **注意**：不移除用户后续设置的 handler；监听器只读，不 `stopImmediatePropagation`

### D4. 日志去重：短窗口内容指纹

- **选择**：`addConsoleLog` 入口对 `(type + content)` 做 50ms 窗口去重
- **备选**：注入成功后关闭沙箱 console 拦截 — 可能丢沙箱侧日志，风险更高

### D5. MutationObserver：默认关闭

- **选择**：移除或默认不启动 DOM 文本 error/warn 扫描；保留 window error / unhandledrejection / 资源错误 / PerformanceObserver
- **备选**：仅匹配 ElementUI 错误 class — 本轮不做站点特化，优先关扫描

### D6. 历史落盘：debounce + 超长 body 占位

- **选择**：写入 debounce 500–1000ms；序列化时对 >50KB 字符串 body 写 `"[已省略，长度 N]"`；内存 `requestHistory` 保留完整供当次详情
- **备选**：只 debounce 不截断 — 大 base64 仍可能撑爆 GM 存储

### D7. UI：增量更新优先于虚拟列表

- **选择**：新请求 prepend 一行；新日志 append；超限删最旧节点；高亮/状态色局部更新；必要时 rAF 合并
- **备选**：虚拟列表 — 实现成本高，50/200 条规模不必要

### D8. 安全：动态内容 textContent + escapeHtml

- **选择**：详情 URL/body/headers 等不可信字段禁止未转义 `innerHTML` 拼接；静态骨架可保留模板
- **备选**：DOMPurify — 无构建依赖时内联过重，本轮用转义足够

### D9. 版本

- `@version` 与 `api-monitor.meta.js` 统一 **2.7**

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| XHR 双触发 load（业务 + 我们）导致重复入列表 | 同一 `_requestInfo` 只 `addRequestToList` 一次，用 flag |
| 增量 UI 漏更新高亮 | 抽取 `setRequestItemHighlight`；清空/关详情时全量一次 `updateRequestList` 可接受 |
| 落盘截断导致刷新后 body 不全 | 占位文案明确；会话内详情仍完整；文档/注释说明 |
| 去重误杀 50ms 内合法重复 log | 窗口短；仅 type+content 完全一致 |
| 改动面大回归 | 按 T 任务串行；每任务手工验收清单（见 tasks） |

## Migration Plan

1. 实现并自测通过后发布 2.7 用户脚本（OSS download/update URL 按既有流程）
2. 用户油猴自动更新；无需数据迁移
3. 已有 `apiRequestHistory` 仍可解析；若旧数据无截断字段则原样展示
4. 回滚：回退到 2.6 脚本文件即可

## Open Questions

- （无阻塞）Base64 递归上限具体数值：建议 depth≤8、字段≤200，design 阶段可微调
- （无阻塞）debounce 默认 800ms，可在实现时定常量
