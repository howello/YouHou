# api-monitor-maintainability Specification

## Purpose
TBD - created by archiving change api-monitor-optimize. Update Purpose after archive.
## Requirements
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

