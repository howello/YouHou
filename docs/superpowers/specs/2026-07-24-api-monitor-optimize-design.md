---
comet_change: api-monitor-optimize
role: technical-design
canonical_spec: openspec
archived-with: 2026-07-24-api-monitor-optimize
status: final
---

# API 请求监控工具优化 — 技术设计

## 1. 背景与范围

单文件 Tampermonkey 脚本 `API请求监控工具/api-monitor.user.js`（v2.6）在保持**全部现有功能**、且**不改变「关闭监控窗即停止监控」**的前提下，完成正确性、性能、可维护核心项与详情 XSS 加固，发布 **2.7**。

**范围内任务：** T1–T5、T6–T9、T10、T11、T12、T14、T21。  
**范围外：** T13、T15–T20、T22、T23、拆多文件、改默认关键字集合。

OpenSpec 能力规格为权威需求源：

- `openspec/changes/api-monitor-optimize/specs/api-monitor-correctness/spec.md`
- `openspec/changes/api-monitor-optimize/specs/api-monitor-performance/spec.md`
- `openspec/changes/api-monitor-optimize/specs/api-monitor-maintainability/spec.md`
- `openspec/changes/api-monitor-optimize/specs/api-monitor-security/spec.md`

## 2. 架构边界

```
页面 Main World              油猴沙箱                     监控窗 about:blank
 console.* ──CustomEvent──▶ addConsoleLog ──增量──▶ 控制台 Tab
 fetch/XHR ◀── monkeypatch ─ startMonitoring ──▶ 请求列表/详情
 storage/cookie ───────────▶ 三 Tab 只读展示
 GM_*  ◀── 开关/关键字/历史（debounce 落盘）
```

本轮只改沙箱实现；不改 `@include`、菜单文案语义、关窗联动、默认关键字集合。

## 3. 实现路径

**方案 A（已确认）：手术式按 T\* 串行补丁。**

- 每个 T 只改相关函数/调用点，最小 diff。
- 禁止提前做大范围 helper 抽取（T13 不做）。
- 单文件禁止并行写；Workflow 中 implement 必须串行。

## 4. 锁定常量

| 常量 | 值 |
|------|-----|
| `CONSOLE_DEDUP_MS` | 50 |
| `HISTORY_PERSIST_DEBOUNCE_MS` | 800 |
| `BODY_PERSIST_MAX_CHARS` | 51200 |
| `BASE64_MAX_DEPTH` | 8 |
| `BASE64_MAX_FIELDS` | 200 |
| `BASE64_MIN_LEN` | 100 |
| `CONSOLE_MEM_MAX` | 500 |
| `CONSOLE_VIEW_MAX` | 200 |
| `REQUEST_LIST_VIEW_MAX` | 50 |
| `VERSION` | 2.7 |

## 5. 任务级实现设计

### 5.1 T1 Fetch body

- `clonedResponse.text()` 后 `JSON.parse`；失败则用 text。
- 成功/失败路径均 `addRequestToList`；网络 catch 路径不回归。

### 5.2 T2 XHR

- 命中关键字时挂 `_requestInfo`。
- `addEventListener('load'|'error'|'timeout'|'abort')` 采集。
- **禁止**赋值覆盖 `onload`/`onerror`。
- `_requestInfo._listed` 保证只入表一次。
- 保留 `setRequestHeader` 包装与 `send` 记 body。

### 5.3 T3 日志去重

- 在 `addConsoleLog` 入口：`lastKey = type + '\0' + content`，若与上次相同且间隔 &lt; 50ms 则丢弃。

### 5.4 T4 MutationObserver

- 删除或永不启动 DOM 文本 error/warn/failed 扫描。
- 保留 window error、unhandledrejection、资源错误捕获、PerformanceObserver。

### 5.5 T5 关键字

```js
monitorKeywords = saved.split(',').map(k => k.trim()).filter(Boolean);
```

### 5.6 T6 历史持久化

- `schedulePersistRequestHistory()` debounce 800ms。
- 序列化时对字符串 body `length > BODY_PERSIST_MAX_CHARS` 替换为 `` `[已省略，长度 ${n}]` ``。
- 内存 `requestHistory` 不截断 body。
- `clearHistory` 立即写空数组并 cancel pending timer。

### 5.7 T7 增量 UI

- 请求：新项 `prepend`；超过 `REQUEST_LIST_VIEW_MAX` 移除末节点。
- 日志：`append`；超过 `CONSOLE_VIEW_MAX` 移除最旧子节点；可 rAF 合并。
- 高亮/状态色：增量路径下更新 class/style；清空或关详情允许一次全量 `updateRequestList`。
- 保留状态色与当前打开项加粗高亮语义。

### 5.8 T8 环形缓冲

- `while (consoleLogs.length > CONSOLE_MEM_MAX) consoleLogs.shift();`
- 禁止 `splice(0, len, ...500项)`。

### 5.9 T9 Base64

- DFS 带 depth/fields 计数；先长度与 magic 前缀再 regex。
- 继续排除 path `encData` / `.encData`。

### 5.10 T10 KV 表格

- 单一定义 `createExpandableValue`、`renderKeyValueTable(monitorWindow, container, data, emptyText)`。
- 三 Tab 只保留数据获取差异。

### 5.11 T11 死代码

- 删除 `showRequestDetails` 中未使用的 JSONView 半成品变量与无效 id。

### 5.12 T12 shortUrl

- 找到最早关键字下标 `index`，`display = url.substring(index)`（保留关键字）。
- 可选限长（如 120）加 `…`。
- 详情完整 URL 不变。

### 5.13 T14 版本

- `api-monitor.user.js` 与 `api-monitor.meta.js` 均为 2.7。

### 5.14 T21 XSS

- 提供 `escapeHtml`；详情不可信字段用 `textContent` 或转义后插入。
- 禁止未转义响应/URL 拼 `innerHTML`。
- 复制按钮与 toast 语义保留。

## 6. 数据流与错误处理

**请求：** 过滤 → 记录 → body → 内存列表 → debounce 落盘 → 增量列表 UI。  
**日志：** 多源 → 去重 → 缓冲 → 增量控制台 UI。  
**详情：** 点击 → 安全 DOM → 有界 Base64 控件。

| 错误 | 处理 |
|------|------|
| fetch reject | ERROR 记录 + console + rethrow |
| XHR error/timeout/abort | 对应 status，单次入表 |
| GM_setValue 失败 | console.error，不阻断 |
| 监控窗 closed | UI 更新 early return |
| Base64 解码失败 | 监控窗 showMessage error |

## 7. Workflow 细粒度执行图（Build 编排）

用户要求使用 Claude **Workflow** 执行，且尽可能细分。采用 **T\* 双阶段**：

```
Phase A Correctness
  T1-impl → T1-verify → T2-impl → T2-verify → T3-impl → T3-verify
  → T4-impl → T4-verify → T5-impl → T5-verify → A-regression-commit

Phase B Performance
  T6-impl → T6-verify → T7-impl → T7-verify → T8-impl → T8-verify
  → T9-impl → T9-verify → B-regression-commit

Phase C Maintainability
  T10-impl → T10-verify → T11-impl → T11-verify → T12-impl → T12-verify
  → T14-impl → T14-verify → C-regression-commit

Phase E Security
  T21-impl → T21-verify → E-regression-commit

Phase Final
  final-smoke（tasks 5.x + 全量场景 + 非目标未实现确认）
```

约 **14 implement + 14 verify + 4 batch-reg + 1 final ≈ 33** 步。

### Agent 契约

| 角色 | 输入 | 输出 | 禁止 |
|------|------|------|------|
| `T*-impl` | 对应 task + 本节设计 + 当前源文件 | 最小 diff + 摘要 | 体验 D、关窗行为、范围外重构 |
| `T*-verify` | 对应 spec 场景 + diff | PASS/FAIL + 证据 | 擅自扩修 |
| `*-regression` | 批次 checklist | tasks 勾选建议 + commit message | 跳过 FAIL |

**串行约束：** 所有 `*-impl` 顺序执行（同文件）。`*-verify` 不得与下一 `*-impl` 并发写文件；可在 impl 完成后立即跑。

Build 阶段应先用 `writing-plans` 把上图落成 `docs/superpowers/plans/...`，再在确认 isolation/build_mode 后用 **Workflow script** 按 phase 驱动 agent。

## 8. 测试策略

1. **静态：** 每个 T 的 verify 对照 delta spec 场景审 diff。  
2. **批次：** A/B/C/E regression 清单（见 `tasks.md` 1.12/2.11/3.10/4.4）。  
3. **Final 手工冒烟：**
   - fetch JSON / 非 JSON / 网络错误  
   - XHR + 业务 onload；timeout/abort（可模拟）  
   - console 单条无双记  
   - DOM 含 “error” 不刷屏；真实 throw 仍记录  
   - 关键字带空格仍匹配  
   - 连续请求不卡；会话内大 body 完整  
   - 三 Storage Tab；Base64 预览/下载；encData 无按钮  
   - 恶意 HTML 响应不执行  
   - 关窗仍停监控；菜单/状态球/历史恢复  
   - 版本 2.7 双文件一致  
   - 确认未实现 T15–T20/T13/T22/T23  

## 9. 风险

| 风险 | 缓解 |
|------|------|
| XHR 重复入表 | `_listed` |
| 增量 UI 状态漂移 | 关键路径全量刷新兜底 |
| 去重误杀 | 50ms 窗口 |
| 落盘截断误解 | 明确占位文案 |
| Agent 越权 | prompt 硬约束 + verify 门禁 |

## 10. 迁移与回滚

- 油猴更新到 2.7；无需数据迁移。  
- 旧 `apiRequestHistory` 可继续解析。  
- 回滚：恢复 2.6 脚本文件。

## 11. Spec Patch

无。需求场景已在 open 阶段 delta spec 覆盖；常量与 Workflow 编排仅存于本 Design Doc 与后续 plan。
