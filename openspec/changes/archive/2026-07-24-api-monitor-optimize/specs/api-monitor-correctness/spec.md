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
