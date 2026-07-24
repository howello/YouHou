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
