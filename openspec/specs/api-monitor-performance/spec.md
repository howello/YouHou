# api-monitor-performance Specification

## Purpose
TBD - created by archiving change api-monitor-optimize. Update Purpose after archive.
## Requirements
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

