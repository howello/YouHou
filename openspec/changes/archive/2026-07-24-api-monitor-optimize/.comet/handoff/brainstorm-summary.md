# Brainstorm Summary

- Change: api-monitor-optimize
- Date: 2026-07-24
- Status: confirmed

## 确认的技术方案

- 实现路径：方案 A — 手术式按 T* 串行补丁，不抽大层、不拆文件
- Workflow 粒度：每个 T 双阶段（implement agent + verify agent），批次末 regression，最后 final-smoke
- 阶段顺序：A(T1–T5) → B(T6–T9) → C(T10/T11/T12/T14) → E(T21) → Final
- 常量锁定：DEDUP 50ms、persist debounce 800ms、body 50KB、Base64 depth8/fields200/minLen100、console mem500/view200、list view50、version 2.7
- 关键实现：fetch 先 text 再 parse；XHR addEventListener + 防重入；日志去重；关闭 MutationObserver DOM 扫描；keywords trim；历史 debounce+截断；列表/日志增量 DOM；环形缓冲；Base64 有界；KV 公共渲染；删死代码；shortUrl 保留关键字；详情 XSS 防护

## 关键取舍与风险

- 选手术式而非 helper 预抽：匹配细粒度 T* 与「少重构」
- 超长 body 刷新后可能为占位：会话内完整，换性能与存储
- XHR 双触发：用 `_listed` 防重复入表
- 无自动化测试：静态 verify + 手工冒烟清单
- 关窗停监控保持不变（用户排除项）

## 测试策略

- T*-verify：对照 specs 场景静态审查 diff
- 批次 regression：该批 checklist + commit
- Final：全功能冒烟 + 恶意响应 XSS + 非目标未实现确认

## Spec Patch

无
