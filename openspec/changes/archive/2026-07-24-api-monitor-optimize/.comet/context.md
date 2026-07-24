# Comet Design Handoff

- Change: api-monitor-optimize
- Phase: design
- Mode: compact
- Context hash: 3647e4c4169692bbeec2c353ce70f513d67ba4982b09e1ce3ceb52024e440627

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/api-monitor-optimize/proposal.md

- Source: openspec/changes/api-monitor-optimize/proposal.md
- Lines: 1-52
- SHA256: cbf1938e40929aab4a6135b6b92a50ac86f538c53f9d20f55a91e0daa23dc0bc

```md
## Why

`API请求监控工具/api-monitor.user.js`（v2.6）已具备 fetch/XHR 监控、控制台捕获、存储查看与 Base64 预览等完整能力，但存在正确性缺陷（fetch 响应体二次读取失败、XHR 覆盖业务回调、日志双记、DOM 误报）、性能瓶颈（全量落盘与全量重绘）以及可维护/安全问题（重复 KV 表格、死代码、详情 `innerHTML` XSS 风险）。在**不削弱现有功能**、且**保持「关闭监控窗即停监控」**的前提下，按已确认优化计划做一批高收益、低风险的内部优化。

## What Changes

- **正确性（P0）**
  - T1：fetch 响应体改为先 `text()` 再 `JSON.parse`，避免 clone body 二次消费失败
  - T2：XHR 改用 `addEventListener` 采集 load/error/timeout/abort，不再覆盖业务 `onload`/`onerror`
  - T3：主世界/沙箱控制台日志短窗口去重
  - T4：默认关闭（或收紧）MutationObserver DOM 文本扫描，消除 error/warn/failed 误报
  - T5：监控关键字读取时统一 `trim` + 过滤空串
- **性能（P1）**
  - T6：请求历史 `GM_setValue` 写入 debounce；超长 body 落盘截断、内存会话内仍完整
  - T7：请求列表 / 控制台日志改为增量 DOM 更新（非每次全量 `innerHTML` 重建）
  - T8：`consoleLogs` 环形缓冲，避免 500 项展开 splice
  - T9：Base64 检测加长度/前缀门槛与递归上限，继续排除 `encData`
- **可维护（P2 核心）**
  - T10：抽取 LocalStorage/SessionStorage/Cookie 公共 KV 表格渲染
  - T11：删除 `showRequestDetails` 中未使用的 JSONView 半成品变量
  - T12：`getShortUrl` 从关键字起点截断（保留关键字）并限长
  - T14：`@version` 升至 2.7，同步 `api-monitor.meta.js`
- **安全（P4 核心）**
  - T21：详情与动态内容改用 `textContent` / HTML 转义，防止响应体 XSS 监控窗

**不包含（本 change 非目标）**

- 不改变「关闭监控窗 / beforeunload → 停止监控」行为
- 不做体验增强 D（T15–T20：过滤、导出、状态球位置持久化、弹窗降级等）
- 不做 T13 大分区重构注释、T22 落盘脱敏、T23 说明文档同步（可后续独立 change）
- 不拆多文件；不改变默认监控关键字集合语义

## Capabilities

### New Capabilities

- `api-monitor-correctness`：请求拦截与日志捕获的正确性（fetch/XHR、日志去重、DOM 扫描、关键字规范化）
- `api-monitor-performance`：历史持久化与 UI 更新的性能策略（节流、增量渲染、缓冲、Base64 扫描边界）
- `api-monitor-maintainability`：展示层复用、死代码清理、列表 URL 展示与版本发布
- `api-monitor-security`：监控窗口动态内容的 XSS 防护

### Modified Capabilities

- （无既有 `openspec/specs/` 主规格；本仓库首次为该脚本建立 delta/capability specs）

## Impact

- **代码**：`API请求监控工具/api-monitor.user.js`（主改动）、`API请求监控工具/api-monitor.meta.js`（版本号）
- **行为**：对外功能面保持；内部实现更稳、更快；MutationObserver 误报默认消失；列表短 URL 更易读
- **持久化**：历史落盘可能对超长 body 存占位，**当次会话内存仍可看完整 body**；刷新后超长 body 可能为占位
- **依赖/系统**：仍为 Tampermonkey 用户脚本，无新 npm/后端依赖
- **风险**：XHR 监听方式变更需确认业务站点回调不被破坏；增量 UI 需保持高亮/状态色/清空行为一致

```

## openspec/changes/api-monitor-optimize/design.md

- Source: openspec/changes/api-monitor-optimize/design.md
- Lines: 1-94
- SHA256: 81fce95f9d51679021348beefd1e1e4d4de5640a5ee662aa89b812cf12162b41

[TRUNCATED]

```md
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

```

Full source: openspec/changes/api-monitor-optimize/design.md

## openspec/changes/api-monitor-optimize/tasks.md

- Source: openspec/changes/api-monitor-optimize/tasks.md
- Lines: 1-55
- SHA256: 58cc2c5fe83942c962a37cfc92cce751a41dd441d89cfeae27f9a32a7dd34de6

```md
## 1. 批次 A — 正确性（P0）

- [ ] 1.1 T1：将 fetch 拦截中 `clone().json()` 失败再 `text()` 改为先 `text()` 再 `JSON.parse`，成功/失败均 `addRequestToList`
- [ ] 1.2 T1 验收：非 JSON 响应体可完整显示；JSON 响应仍为对象；网络错误路径不回归
- [ ] 1.3 T2：XHR `open` 命中监控时用 `addEventListener` 注册 load/error/timeout/abort；移除对 `this.onload`/`this.onerror` 的覆盖赋值
- [ ] 1.4 T2：保证同一 `_requestInfo` 只入列表一次（防重复）；`setRequestHeader`/`send` 捕获逻辑保留
- [ ] 1.5 T2 验收：业务侧 `onload` 仍触发；timeout/abort 有状态记录；请求头/体仍可见
- [ ] 1.6 T3：在 `addConsoleLog` 入口实现 type+content 短窗口（约 50ms）去重
- [ ] 1.7 T3 验收：页面一次 `console.log` 在监控窗只出现一条
- [ ] 1.8 T4：默认关闭 MutationObserver DOM 文本 error/warn/failed 扫描（删除或条件永不启动）
- [ ] 1.9 T4 验收：普通含 “error” 文本的 DOM 插入不刷日志；window error / unhandledrejection / 资源错误 / PerformanceObserver 仍工作
- [ ] 1.10 T5：`getMonitorKeywords` 读取时 `split` 后 `trim` 并 `filter(Boolean)`
- [ ] 1.11 T5 验收：带空格存储关键字仍能正确匹配 URL
- [ ] 1.12 批次 A 回归：菜单开关、状态球、关闭窗口仍停监控、关键字过滤、历史恢复冒烟通过后 commit

## 2. 批次 B — 性能（P1）

- [ ] 2.1 T6：实现 `persistRequestHistory` debounce（500–1000ms），替换每次请求直接 `GM_setValue`
- [ ] 2.2 T6：序列化时对超长字符串 body（阈值约 50KB）写 `"[已省略，长度 N]"`；内存 `requestHistory` 保留完整 body
- [ ] 2.3 T6 验收：连续请求写盘合并；会话内大 body 详情完整；清空历史仍清存储
- [ ] 2.4 T7：请求列表改为新项 prepend + 超限删末项；避免默认全量 `innerHTML=""` 重建路径
- [ ] 2.5 T7：当前打开项高亮与状态背景色在增量路径下保持正确（必要时局部更新 helper）
- [ ] 2.6 T7：控制台日志改为 append + 超显示上限删最旧节点；可用 rAF/节流合并刷新
- [ ] 2.7 T7 验收：高频请求/日志时无明显整表闪烁；清空仍正确
- [ ] 2.8 T8：`consoleLogs` 超 500 使用 shift 循环或环形缓冲，禁止 `splice(...500项展开)`
- [ ] 2.9 T9：Base64 `findBase64` 增加 depth/字段数上限；长度门槛与 magic 前缀优先；继续排除 `encData`
- [ ] 2.10 T9 验收：含 base64 文件的响应仍可预览/下载；`encData` 不生成文件按钮
- [ ] 2.11 批次 B 回归 + commit

## 3. 批次 C — 可维护（P2 核心）

- [ ] 3.1 T10：抽取 `createExpandableValue` 与 `renderKeyValueTable`（或等价）单一定义
- [ ] 3.2 T10：LocalStorage / SessionStorage / Cookie 三处改为调用公共渲染；保留各自数据获取与空态文案
- [ ] 3.3 T10 验收：三 Tab 刷新展示正常
- [ ] 3.4 T11：删除 `showRequestDetails` 中未使用的 jsonContainerId / isJsonObject / jsonDataForView / requestBodyJsonData 等半成品
- [ ] 3.5 T11 验收：详情展示与复制按钮正常
- [ ] 3.6 T12：`getShortUrl` 从关键字起点截取（保留关键字），过长加省略；详情完整 URL 不变
- [ ] 3.7 T12 验收：列表可见关键字片段
- [ ] 3.8 T14：`api-monitor.user.js` `@version` → 2.7
- [ ] 3.9 T14：同步 `api-monitor.meta.js` 版本为 2.7
- [ ] 3.10 批次 C 回归 + commit

## 4. 批次 E 核心 — 安全（P4 T21）

- [ ] 4.1 T21：实现 `escapeHtml`（或统一用 DOM `textContent` 构建详情字段）
- [ ] 4.2 T21：重构 `showRequestDetails` 基本信息/头/体展示路径，禁止未转义响应内容拼 `innerHTML`
- [ ] 4.3 T21 验收：含 `<script>`/`onerror` 的假响应仅文本显示且不执行；复制仍可用
- [ ] 4.4 安全批次回归 + commit

## 5. 总验收与交付

- [ ] 5.1 对照 proposal 非目标：确认未改「关窗停监控」、未实现 T15–T20/T13/T22/T23
- [ ] 5.2 全功能冒烟：fetch+XHR 列表与详情、控制台、三 Storage Tab、Base64、状态球、菜单、关键字配置、历史恢复
- [ ] 5.3 版本与 meta 一致为 2.7；tasks 全部勾选
- [ ] 5.4 准备进入 verify：整理手工验收记录要点

```

## openspec/changes/api-monitor-optimize/specs/api-monitor-correctness/spec.md

- Source: openspec/changes/api-monitor-optimize/specs/api-monitor-correctness/spec.md
- Lines: 1-56
- SHA256: 95b4cb90111ec4ebc694d210277d4762af41f3755e3d6660ff1e1e87b11931a7

```md
## ADDED Requirements

### Requirement: Fetch 响应体可靠解析
系统 MUST 在拦截被监控的 fetch 请求时，通过克隆响应后先读取文本再尝试 JSON 解析，完整得到响应体；不得因先调用 `json()` 失败导致后续无法读取 body。

#### Scenario: JSON 响应
- **WHEN** 被监控 fetch 返回合法 JSON 体
- **THEN** 请求记录的 `responseBody` 为解析后的对象/数组，并可在详情中展示

#### Scenario: 非 JSON 响应
- **WHEN** 被监控 fetch 返回 HTML 或纯文本体
- **THEN** 请求记录的 `responseBody` 为完整文本字符串，不得为无法解析占位或空

#### Scenario: 网络错误
- **WHEN** 被监控 fetch 拒绝（网络错误等）
- **THEN** 仍写入状态为 ERROR 的请求记录，并保留既有控制台错误记录行为

### Requirement: XHR 旁路采集且不覆盖业务回调
系统 MUST 使用事件监听采集被监控 XHR 的完成/失败/超时/中止结果，不得通过赋值覆盖页面已设置或将设置的 `onload`/`onerror` 导致业务回调丢失。

#### Scenario: 业务 onload 仍执行
- **WHEN** 页面脚本对 XHR 设置了 `onload`，且 URL 命中监控关键字
- **THEN** 业务 `onload` 仍被调用，且监控列表中出现该请求记录

#### Scenario: timeout 与 abort
- **WHEN** 被监控 XHR 触发 timeout 或 abort
- **THEN** 监控列表中出现对应状态记录（非仅 PENDING）

#### Scenario: 请求头与请求体
- **WHEN** 被监控 XHR 调用 `setRequestHeader` 与 `send(body)`
- **THEN** 请求记录包含捕获到的请求头与请求体

### Requirement: 控制台日志短窗口去重
系统 MUST 对相同类型与相同内容的控制台日志在短时间窗口内去重，避免主世界注入与沙箱拦截导致双记。

#### Scenario: 主世界单次 log 只显示一条
- **WHEN** 页面主世界执行一次 `console.log("x")` 且注入拦截已生效
- **THEN** 监控窗口控制台 Tab 中该条内容在去重窗口内仅出现一次

### Requirement: 默认不进行 DOM 文本错误扫描
系统 MUST 默认不通过 MutationObserver 扫描 DOM 文本中的 error/warn/failed 关键词并写入控制台日志；window 错误、未处理 Promise 拒绝、资源加载错误与性能观察行为 MUST 保留。

#### Scenario: 普通 DOM 更新不刷屏
- **WHEN** 页面插入包含英文 "error" 字样的普通文本节点
- **THEN** 监控窗口控制台 Tab 不因此新增「Potential Warning/Alert in DOM」类日志

#### Scenario: 真实脚本错误仍捕获
- **WHEN** 页面抛出未捕获异常
- **THEN** 控制台 Tab 仍记录 error 类型日志

### Requirement: 监控关键字读取规范化
系统 MUST 在从存储加载监控关键字时对每一项 trim 并丢弃空串；匹配逻辑仍为 URL 包含任一关键字。

#### Scenario: 带空格关键字
- **WHEN** 存储中关键字为 `" has-pss-cw-local , hsa-pss-pw "`
- **THEN** 加载后关键字列表为无首尾空格的两项，且 URL 包含 `has-pss-cw-local` 时仍被监控

```

## openspec/changes/api-monitor-optimize/specs/api-monitor-maintainability/spec.md

- Source: openspec/changes/api-monitor-optimize/specs/api-monitor-maintainability/spec.md
- Lines: 1-29
- SHA256: ee13d072b8e67bc7c2276090546671d64f3761384c45b13cba4628864143211d

```md
## ADDED Requirements

### Requirement: 存储类 Tab 共用 KV 表格渲染
系统 MUST 通过共享渲染逻辑展示 LocalStorage、SessionStorage、Cookie 的键值表，行为与现网一致（JSON 尝试解析、表格布局、刷新按钮、空态文案语义保留）。

#### Scenario: 三 Tab 均可刷新展示
- **WHEN** 用户分别打开 LocalStorage、SessionStorage、Cookie 并点击刷新
- **THEN** 各自内容以键值表形式展示且无功能回退

### Requirement: 清理详情渲染死代码
系统 MUST 移除 `showRequestDetails` 中未使用的 JSON 容器 id / JSONView 半成品变量与无效赋值，且详情仍以可读 pre 文本展示请求/响应信息并支持复制。

#### Scenario: 详情展示与复制
- **WHEN** 用户点击列表中一项打开详情
- **THEN** 可见基本信息、请求头/体、响应头/体，复制按钮仍可用

### Requirement: 列表短 URL 保留关键字起点
系统 MUST 在列表展示短 URL 时从第一个匹配监控关键字的起点截取（保留关键字本身），并可对过长结果限长加省略；详情中的完整 URL MUST 不受影响。

#### Scenario: 列表可见关键字
- **WHEN** URL 包含监控关键字
- **THEN** 列表展示字符串包含该关键字（而非仅关键字之后的片段）

### Requirement: 版本发布 2.7
系统 MUST 将用户脚本 `@version` 更新为 2.7，并同步 `api-monitor.meta.js` 中的版本信息。

#### Scenario: 版本一致
- **WHEN** 检查 `api-monitor.user.js` 与 `api-monitor.meta.js` 的版本字段
- **THEN** 均为 2.7

```

## openspec/changes/api-monitor-optimize/specs/api-monitor-performance/spec.md

- Source: openspec/changes/api-monitor-optimize/specs/api-monitor-performance/spec.md
- Lines: 1-44
- SHA256: 4019c5f51e79adfa2e5bdc856467a10a0f6506b041c8784ebdc18b07f33bdf4b

```md
## ADDED Requirements

### Requirement: 请求历史持久化节流
系统 MUST 对请求历史写入 `GM_setValue` 进行 debounce（建议 500–1000ms），避免每条请求同步全量序列化写盘。

#### Scenario: 短时间多请求
- **WHEN** 1 秒内连续记录多条被监控 API
- **THEN** 持久化写入次数明显少于请求条数（合并为少数几次），且内存中列表顺序与内容正确

### Requirement: 超长 body 落盘截断、会话内存完整
系统 MUST 在序列化落盘时对超长字符串 body（阈值建议 50KB）写入明确占位文案；当次会话内存中的请求记录 MUST 仍保留完整 body 供详情查看。

#### Scenario: 当次会话查看大 body
- **WHEN** 响应体字符串超过阈值且仍在当前页面会话
- **THEN** 打开该请求详情仍可看到完整 body（或等价完整内容）

#### Scenario: 刷新后超长 body
- **WHEN** 含超长 body 的历史已落盘并刷新页面后恢复历史
- **THEN** 该条 body 可为占位文案，且占位须标明已省略及长度信息

### Requirement: 请求列表增量更新
系统 MUST 在新增请求时增量更新列表 DOM（prepend 新项、超限移除旧项），不得每次清空重建全部列表节点作为唯一路径；状态色与当前打开项高亮 MUST 保持与现网一致语义。

#### Scenario: 新请求进入列表
- **WHEN** 新被监控请求完成并加入历史
- **THEN** 列表顶部出现新项，且无需整表销毁重建即可看到

### Requirement: 控制台日志增量更新与环形缓冲
系统 MUST 对新控制台日志采用增量 append 展示（显示窗口上限保持约 200），内存日志上限约 500 时使用高效截断（环形缓冲或等价，避免大批量展开赋值）。

#### Scenario: 高频日志
- **WHEN** 短时间产生大量 console 输出
- **THEN** 控制台面板持续追加最新日志且保持可滚动，不出现明显整表闪烁卡死

### Requirement: Base64 扫描有界
系统 MUST 在检测 base64 文件时对递归深度与字段数量设置上限，并对候选字符串先做长度/前缀判断再做完整正则；路径为 `encData` 的字段 MUST 继续排除替换/下载扫描策略（与现网一致）。

#### Scenario: 深大对象不卡死
- **WHEN** 响应为深层嵌套且含多个长字符串
- **THEN** base64 检测在有界扫描后结束，UI 保持可响应

#### Scenario: encData 不作为文件下载目标
- **WHEN** 响应对象含 `encData` 长 base64 字符串
- **THEN** 不因该字段生成 base64 文件下载/预览按钮（或保持现网排除行为）

```

## openspec/changes/api-monitor-optimize/specs/api-monitor-security/spec.md

- Source: openspec/changes/api-monitor-optimize/specs/api-monitor-security/spec.md
- Lines: 1-19
- SHA256: 98e0f7b6eea987be7e75e503ec86bfaa9b3652dbf8dbc2eedf0dbb50500662bc

```md
## ADDED Requirements

### Requirement: 详情动态内容防 XSS
系统 MUST 在监控窗口请求详情中展示不可信数据（URL、状态、请求/响应头与体等）时使用 `textContent` 或等效 HTML 转义，不得将未转义的响应内容直接拼入 `innerHTML` 导致脚本执行。

#### Scenario: 恶意响应体不执行
- **WHEN** 被监控请求的响应体包含 HTML/脚本片段（如 `<img onerror=...>` 或 `</pre><script>`）
- **THEN** 详情面板以文本形式展示该内容，监控窗口文档中不执行其中的脚本

#### Scenario: 恶意 URL 不执行
- **WHEN** 请求 URL 或头字段包含 HTML 特殊字符
- **THEN** 详情中安全展示为文本，不破坏面板 DOM 结构

### Requirement: 保留复制与既有布局语义
系统 MUST 在加固 XSS 后保留复制按钮与分区标题等既有交互语义（成功/失败提示可继续使用监控窗消息机制）。

#### Scenario: 复制仍可用
- **WHEN** 用户点击详情中的复制按钮
- **THEN** 剪贴板获得对应文本内容（或等价成功/失败提示）

```
