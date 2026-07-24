## 1. 批次 A — 正确性（P0）

- [x] 1.1 T1：将 fetch 拦截中 `clone().json()` 失败再 `text()` 改为先 `text()` 再 `JSON.parse`，成功/失败均 `addRequestToList`
- [x] 1.2 T1 验收：非 JSON 响应体可完整显示；JSON 响应仍为对象；网络错误路径不回归
- [x] 1.3 T2：XHR `open` 命中监控时用 `addEventListener` 注册 load/error/timeout/abort；移除对 `this.onload`/`this.onerror` 的覆盖赋值
- [x] 1.4 T2：保证同一 `_requestInfo` 只入列表一次（防重复）；`setRequestHeader`/`send` 捕获逻辑保留
- [x] 1.5 T2 验收：业务侧 `onload` 仍触发；timeout/abort 有状态记录；请求头/体仍可见
- [x] 1.6 T3：在 `addConsoleLog` 入口实现 type+content 短窗口（约 50ms）去重
- [x] 1.7 T3 验收：页面一次 `console.log` 在监控窗只出现一条
- [x] 1.8 T4：默认关闭 MutationObserver DOM 文本 error/warn/failed 扫描（删除或条件永不启动）
- [x] 1.9 T4 验收：普通含 “error” 文本的 DOM 插入不刷日志；window error / unhandledrejection / 资源错误 / PerformanceObserver 仍工作
- [x] 1.10 T5：`getMonitorKeywords` 读取时 `split` 后 `trim` 并 `filter(Boolean)`
- [x] 1.11 T5 验收：带空格存储关键字仍能正确匹配 URL
- [x] 1.12 批次 A 回归：菜单开关、状态球、关闭窗口仍停监控、关键字过滤、历史恢复冒烟通过后 commit

## 2. 批次 B — 性能（P1）

- [x] 2.1 T6：实现 `persistRequestHistory` debounce（500–1000ms），替换每次请求直接 `GM_setValue`
- [x] 2.2 T6：序列化时对超长字符串 body（阈值约 50KB）写 `"[已省略，长度 N]"`；内存 `requestHistory` 保留完整 body
- [x] 2.3 T6 验收：连续请求写盘合并；会话内大 body 详情完整；清空历史仍清存储
- [x] 2.4 T7：请求列表改为新项 prepend + 超限删末项；避免默认全量 `innerHTML=""` 重建路径
- [x] 2.5 T7：当前打开项高亮与状态背景色在增量路径下保持正确（必要时局部更新 helper）
- [x] 2.6 T7：控制台日志改为 append + 超显示上限删最旧节点；可用 rAF/节流合并刷新
- [x] 2.7 T7 验收：高频请求/日志时无明显整表闪烁；清空仍正确
- [x] 2.8 T8：`consoleLogs` 超 500 使用 shift 循环或环形缓冲，禁止 `splice(...500项展开)`
- [x] 2.9 T9：Base64 `findBase64` 增加 depth/字段数上限；长度门槛与 magic 前缀优先；继续排除 `encData`
- [x] 2.10 T9 验收：含 base64 文件的响应仍可预览/下载；`encData` 不生成文件按钮
- [x] 2.11 批次 B 回归 + commit

## 3. 批次 C — 可维护（P2 核心）

- [x] 3.1 T10：抽取 `createExpandableValue` 与 `renderKeyValueTable`（或等价）单一定义
- [x] 3.2 T10：LocalStorage / SessionStorage / Cookie 三处改为调用公共渲染；保留各自数据获取与空态文案
- [x] 3.3 T10 验收：三 Tab 刷新展示正常
- [x] 3.4 T11：删除 `showRequestDetails` 中未使用的 jsonContainerId / isJsonObject / jsonDataForView / requestBodyJsonData 等半成品
- [x] 3.5 T11 验收：详情展示与复制按钮正常
- [x] 3.6 T12：`getShortUrl` 从关键字起点截取（保留关键字），过长加省略；详情完整 URL 不变
- [x] 3.7 T12 验收：列表可见关键字片段
- [x] 3.8 T14：`api-monitor.user.js` `@version` → 2.7
- [x] 3.9 T14：同步 `api-monitor.meta.js` 版本为 2.7
- [x] 3.10 批次 C 回归 + commit

## 4. 批次 E 核心 — 安全（P4 T21）

- [x] 4.1 T21：实现 `escapeHtml`（或统一用 DOM `textContent` 构建详情字段）
- [x] 4.2 T21：重构 `showRequestDetails` 基本信息/头/体展示路径，禁止未转义响应内容拼 `innerHTML`
- [x] 4.3 T21 验收：含 `<script>`/`onerror` 的假响应仅文本显示且不执行；复制仍可用
- [x] 4.4 安全批次回归 + commit（task review APPROVE_WITH_NOTES：dd9c162）

## 5. 总验收与交付

- [x] 5.1 对照 proposal 非目标：确认未改「关窗停监控」、未实现 T15–T20/T13/T22/T23
- [x] 5.2 全功能冒烟：静态链路 + 代码路径审查（fetch text-then-parse、XHR listeners、console dedup、无 MutationObserver DOM 扫描、debounce persist、增量 UI、KV 共用、shortUrl 关键字、详情 textContent、版本 2.7）
- [x] 5.3 版本与 meta 一致为 2.7；tasks 全部勾选
- [x] 5.4 准备进入 verify：整理手工验收记录要点
