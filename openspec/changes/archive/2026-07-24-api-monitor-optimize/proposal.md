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
