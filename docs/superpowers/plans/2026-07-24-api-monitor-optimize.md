---
archived-with: 2026-07-24-api-monitor-optimize
status: final
---
# API 请求监控工具优化 Implementation Plan

---
change: api-monitor-optimize
design-doc: docs/superpowers/specs/2026-07-24-api-monitor-optimize-design.md
base-ref: d999e4c6179b063378dcf8c6c4d8d1262bdb37bf
---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [x]`) syntax for tracking.  
> **Workflow 编排：** 每个 Task 拆为 `impl` + `verify` 两步调度；同文件 **impl 必须串行**；每批结束后 regression-commit。详见 Design Doc §7。

**Goal:** 在不削弱现有功能、不改变「关窗停监控」的前提下，对 `API请求监控工具/api-monitor.user.js` 完成正确性/性能/可维护核心项与详情 XSS 加固，发布 2.7。

**Architecture:** 单文件手术式按 T\* 串行补丁；常量与行为以 Design Doc 为准；OpenSpec delta specs 为验收权威。

**Tech Stack:** Tampermonkey 用户脚本（纯浏览器 JS，无构建、无单元测试框架）→ 验证以静态 diff 审查 + 手工冒烟清单为主。

## Global Constraints

- 现有功能全部保留；**禁止**改变关闭监控窗 / beforeunload → 停止监控
- **禁止**实现 T13/T15–T20/T22/T23（本 change 非目标）
- **禁止**拆多文件、改默认关键字集合语义、引入构建/DOMPurify/测试框架
- 常量：DEDUP 50ms、persist debounce 800ms、body 51200 chars、Base64 depth8/fields200/minLen100、console mem500/view200、list view50、version 2.7
- 主改文件：`API请求监控工具/api-monitor.user.js`；T14 另改 `API请求监控工具/api-monitor.meta.js`
- 每完成一批（A/B/C/E）勾选对应 `openspec/changes/api-monitor-optimize/tasks.md` 并 git commit
- Language: zh-CN

## File Map

| 文件 | 职责 |
|------|------|
| `API请求监控工具/api-monitor.user.js` | 全部运行时逻辑 |
| `API请求监控工具/api-monitor.meta.js` | 油猴更新用版本头 |
| `openspec/changes/api-monitor-optimize/tasks.md` | 勾选进度 |
| `docs/superpowers/specs/2026-07-24-api-monitor-optimize-design.md` | 技术设计权威 |

## Workflow 调度索引

| Step ID | 对应 Task | 类型 |
|---------|-----------|------|
| A-T1-i / A-T1-v | Task 1 | impl/verify |
| A-T2-i / A-T2-v | Task 2 | impl/verify |
| A-T3-i / A-T3-v | Task 3 | impl/verify |
| A-T4-i / A-T4-v | Task 4 | impl/verify |
| A-T5-i / A-T5-v | Task 5 | impl/verify |
| A-reg | Task 6 | regression+commit |
| B-T6-i / B-T6-v | Task 7 | impl/verify |
| B-T7-i / B-T7-v | Task 8 | impl/verify |
| B-T8-i / B-T8-v | Task 9 | impl/verify |
| B-T9-i / B-T9-v | Task 10 | impl/verify |
| B-reg | Task 11 | regression+commit |
| C-T10-i / C-T10-v | Task 12 | impl/verify |
| C-T11-i / C-T11-v | Task 13 | impl/verify |
| C-T12-i / C-T12-v | Task 14 | impl/verify |
| C-T14-i / C-T14-v | Task 15 | impl/verify |
| C-reg | Task 16 | regression+commit |
| E-T21-i / E-T21-v | Task 17 | impl/verify |
| E-reg | Task 18 | regression+commit |
| F-smoke | Task 19 | final smoke |

---

### Task 1: T1 Fetch 响应体先 text 再 parse

**Files:**
- Modify: `API请求监控工具/api-monitor.user.js`（约 1738–1770，`startMonitoring` 内 fetch then）

**Interfaces:**
- Consumes: 现有 `originalFetch`、`addRequestToList`、`requestInfo`
- Produces: 可靠的 `requestInfo.responseBody`

- [x] **Step 1: 定位并替换 fetch 响应体读取**

将 `clonedResponse.json().then(...).catch(() => clonedResponse.text()...)` 替换为：

```js
clonedResponse
  .text()
  .then((text) => {
    try {
      requestInfo.responseBody = JSON.parse(text);
    } catch {
      requestInfo.responseBody = text;
    }
    addRequestToList(requestInfo);
  })
  .catch(() => {
    requestInfo.responseBody = "[无法解析响应体]";
    addRequestToList(requestInfo);
  });
```

保留 status/duration/responseHeaders 与外层 catch 错误路径不变。

- [x] **Step 2: 静态自检**

确认：无二次 `json()`；`addRequestToList` 仅在 text 路径与 catch 各合理触发；未改 `shouldMonitorUrl`。

- [x] **Step 3: Verify（A-T1-v）**

对照 `specs/api-monitor-correctness`：JSON / 非 JSON / 网络错误三场景；grep 确认无 `clonedResponse.json`。

- [x] **Step 4: 勾选 tasks 1.1–1.2**（可暂存至 A-reg 统一勾）

---

### Task 2: T2 XHR addEventListener + 防重入

**Files:**
- Modify: `API请求监控工具/api-monitor.user.js`（约 1794–1889）

**Interfaces:**
- Consumes: `shouldMonitorUrl`、`addRequestToList`、`addConsoleLog`、`originalXHROpen`/`originalXHRSend`
- Produces: 旁路采集且不覆盖业务 onload

- [x] **Step 1: 重写 open 拦截中的完成采集**

在 `isMonitoring && shouldMonitorUrl(url)` 分支：

1. 保留 `_requestInfo` 初始化（含 `_startTime`）。
2. 保留 `setRequestHeader` 包装。
3. **删除** `this.onload = ...` 与 `this.onerror = ...` 赋值块。
4. 增加：

```js
const xhr = this;
const finish = (status, body) => {
  if (!xhr._requestInfo || xhr._requestInfo._listed) return;
  xhr._requestInfo._listed = true;
  xhr._requestInfo.status = status;
  xhr._requestInfo.duration = performance.now() - xhr._requestInfo._startTime;
  // 解析 responseHeaders（可从现 onload 逻辑迁移 getAllResponseHeaders）
  // 解析 body：load 时用 responseText JSON.parse 尝试；error 路径用 body 参数
  if (body !== undefined) {
    xhr._requestInfo.responseBody = body;
  } else {
    try {
      xhr._requestInfo.responseBody = JSON.parse(xhr.responseText);
    } catch {
      xhr._requestInfo.responseBody = xhr.responseText || "";
    }
  }
  addRequestToList(xhr._requestInfo);
};

xhr.addEventListener("load", function () {
  // 解析 headers 后 finish(this.status)
  const headers = {};
  const headerLines = (this.getAllResponseHeaders() || "").split("\r\n");
  for (let line of headerLines) {
    if (line.trim()) {
      const idx = line.indexOf(": ");
      if (idx > -1) headers[line.slice(0, idx)] = line.slice(idx + 2);
      else {
        const [key, value] = line.split(": ");
        headers[key] = value;
      }
    }
  }
  this._requestInfo.responseHeaders = headers;
  finish(this.status);
});
xhr.addEventListener("error", function () {
  finish("ERROR", "[XHR错误] [XHR网络错误]");
  addConsoleLog("error", "XHR错误: [XHR网络错误]", xhr._requestInfo.url);
});
xhr.addEventListener("timeout", function () {
  finish("TIMEOUT", "[XHR超时]");
});
xhr.addEventListener("abort", function () {
  finish("ABORT", "[XHR中止]");
});
```

5. `send` 逻辑保持：`if (isMonitoring && this._requestInfo) this._requestInfo.requestBody = body`。

- [x] **Step 2: Verify（A-T2-v）**

grep 确认无 `this.onload =` / `this.onerror =`（在 open 拦截内）；存在 addEventListener 四种事件；`_listed` 存在。

- [x] **Step 3: 勾选 tasks 1.3–1.5**

---

### Task 3: T3 控制台日志短窗口去重

**Files:**
- Modify: `API请求监控工具/api-monitor.user.js`（`addConsoleLog` 约 50–115）

- [x] **Step 1: 在文件顶部状态区增加**

```js
let lastConsoleDedupKey = "";
let lastConsoleDedupAt = 0;
const CONSOLE_DEDUP_MS = 50;
```

- [x] **Step 2: 在 `consoleLogs.push` 之前**

在 content 计算完成后：

```js
const dedupKey = type + "\0" + content;
const now = Date.now();
if (dedupKey === lastConsoleDedupKey && now - lastConsoleDedupAt < CONSOLE_DEDUP_MS) {
  return;
}
lastConsoleDedupKey = dedupKey;
lastConsoleDedupAt = now;
```

注意：仍应允许原始 console 输出（去重只影响监控数组）。若拦截器先 `addConsoleLog` 再 `originalConsole.*`，return 只跳过记录。

- [x] **Step 3: Verify（A-T3-v）**

确认 50ms 常量与 dedup 在 push 前；主世界事件仍走 `addConsoleLog`。

- [x] **Step 4: 勾选 tasks 1.6–1.7**

---

### Task 4: T4 关闭 MutationObserver DOM 扫描

**Files:**
- Modify: `API请求监控工具/api-monitor.user.js`（约 434–475）

- [x] **Step 1: 删除或注释整块 `MutationObserver` 监听 DOM error/warn/failed 的逻辑**（含 DOMContentLoaded 延迟 observe）

保留紧邻的 window error / unhandledrejection / 资源错误 / PerformanceObserver 块。

- [x] **Step 2: Verify（A-T4-v）**

grep `Potential Warning/Alert in DOM` 应不存在或不可达；`unhandledrejection` 仍在。

- [x] **Step 3: 勾选 tasks 1.8–1.9**

---

### Task 5: T5 关键字 trim

**Files:**
- Modify: `getMonitorKeywords`（约 1688–1699）

- [x] **Step 1: 替换读取分支**

```js
monitorKeywords = saved
  .split(",")
  .map((keyword) => keyword.trim())
  .filter((keyword) => keyword.length > 0);
return monitorKeywords;
```

默认关键字写入路径保持；若 `!saved` 仍写默认。

- [x] **Step 2: Verify（A-T5-v）**

对照 correctness 关键字场景。

- [x] **Step 3: 勾选 tasks 1.10–1.11**

---

### Task 6: A-regression-commit

- [x] **Step 1: 冒烟清单 A**

静态回归（无浏览器环境）：T1–T5 提交链完整；`clonedResponse.json` 已去除；XHR 使用 addEventListener + `_listed`；CONSOLE_DEDUP_MS=50；无 MutationObserver DOM 扫描；keywords trim；关窗 beforeunload 仍调用 toggleMonitoring（未改）。

- [x] **Step 2: 勾选 tasks 1.12**

- [x] **Step 3: Commit**

批次 A 源码已按 T1–T5 分别提交（0a4e611…f814e26）；本步提交 tasks/plan 勾选与流程产物。

---

### Task 7: T6 历史 debounce + 大 body 截断

**Files:**
- Modify: `addRequestToList`、`clearHistory`、新增 helper（约 1909–1927、2668–2695）

- [x] **Step 1: 增加常量与 timer**

```js
const HISTORY_PERSIST_DEBOUNCE_MS = 800;
const BODY_PERSIST_MAX_CHARS = 51200;
let historyPersistTimer = null;
```

- [x] **Step 2: 实现**

```js
function serializeHistoryForPersist(history) {
  return history.map((item) => {
    const copy = { ...item };
    const truncate = (val) => {
      if (typeof val === "string" && val.length > BODY_PERSIST_MAX_CHARS) {
        return `[已省略，长度 ${val.length}]`;
      }
      // 若 body 为对象，JSON.stringify 后判断长度再决定是否整体占位
      if (val && typeof val === "object") {
        try {
          const s = JSON.stringify(val);
          if (s.length > BODY_PERSIST_MAX_CHARS) {
            return `[已省略，长度 ${s.length}]`;
          }
        } catch (e) {}
      }
      return val;
    };
    copy.requestBody = truncate(copy.requestBody);
    copy.responseBody = truncate(copy.responseBody);
    return copy;
  });
}

function schedulePersistRequestHistory() {
  if (historyPersistTimer) clearTimeout(historyPersistTimer);
  historyPersistTimer = setTimeout(() => {
    historyPersistTimer = null;
    try {
      GM_setValue(
        "apiRequestHistory",
        JSON.stringify(serializeHistoryForPersist(requestHistory))
      );
    } catch (e) {
      console.error("保存请求历史失败:", e);
    }
  }, HISTORY_PERSIST_DEBOUNCE_MS);
}

function persistRequestHistoryNow(valueJson) {
  if (historyPersistTimer) {
    clearTimeout(historyPersistTimer);
    historyPersistTimer = null;
  }
  try {
    GM_setValue("apiRequestHistory", valueJson);
  } catch (e) {
    console.error("保存请求历史失败:", e);
  }
}
```

- [x] **Step 3: `addRequestToList` 内** 将直接 `GM_setValue` 改为 `schedulePersistRequestHistory()`；内存仍存完整 `requestInfo`。

- [x] **Step 4: `clearHistory`** 使用 `persistRequestHistoryNow("[]")`。

- [x] **Step 5: Verify（B-T6-v）** 对照 performance spec 节流/截断/会话完整。

- [x] **Step 6: 勾选 tasks 2.1–2.3**

---

### Task 8: T7 列表与控制台增量更新

**Files:**
- Modify: `updateRequestList`、`updateConsoleLogs`、`addRequestToList`、`addConsoleLog`（约 1930–2028、1551–1584、1909+、50+）

- [x] **Step 1: 抽取 `buildRequestListItem(request)`** 返回单个 item 节点（从现 forEach 体抽出）。

- [x] **Step 2: 增加模式**

```js
function updateRequestList(options) {
  options = options || {};
  if (!monitorWindow || monitorWindow.closed) return;
  const listContainer = monitorWindow.document.getElementById("api-request-list");
  if (!listContainer) return;

  if (options.full !== false && !options.prependRequest) {
    // 全量路径：清空重建（清空历史、切换高亮兜底时使用）
    listContainer.innerHTML = "";
    requestHistory.slice(0, REQUEST_LIST_VIEW_MAX || 50).forEach((request) => {
      listContainer.appendChild(buildRequestListItem(request));
    });
    return;
  }

  if (options.prependRequest) {
    listContainer.insertBefore(
      buildRequestListItem(options.prependRequest),
      listContainer.firstChild
    );
    while (listContainer.children.length > 50) {
      listContainer.removeChild(listContainer.lastChild);
    }
    // 可选：刷新高亮样式仅遍历修正 currentlyOpenRequestId
  }
}
```

在 `addRequestToList` 成功后调用 `updateRequestList({ prependRequest: requestInfo })` 代替默认全量。

关详情 / clearHistory / 切换打开项时调用 `updateRequestList({ full: true })` 或现有 `updateRequestList()`。

- [x] **Step 3: 控制台增量**

增加 `appendConsoleLogEntry(log)`；`addConsoleLog` 末尾在窗口有效时调用 append 而非每次 `updateConsoleLogs` 全量。

`updateConsoleLogs` 保留为全量重建（切换 Tab 时调用）。

- [x] **Step 4: Verify（B-T7-v）** 对照 performance 增量场景；确认清空仍正确。

- [x] **Step 5: 勾选 tasks 2.4–2.7**

---

### Task 9: T8 consoleLogs 缓冲

**Files:**
- Modify: `addConsoleLog` 截断逻辑（约 99–104）

- [x] **Step 1: 替换为**

```js
const CONSOLE_MEM_MAX = 500;
while (consoleLogs.length > CONSOLE_MEM_MAX) {
  consoleLogs.shift();
}
```

删除 `splice(0, consoleLogs.length, ...newLogs)`。

- [x] **Step 2: Verify（B-T8-v）** grep 无 `...newLogs` 大展开。

- [x] **Step 3: 勾选 tasks 2.8**

---

### Task 10: T9 Base64 有界扫描

**Files:**
- Modify: `detectBase64AndCreateDownload` 内 `findBase64`（约 2097–2167）

- [x] **Step 1: 签名扩展**

```js
const BASE64_MAX_DEPTH = 8;
const BASE64_MAX_FIELDS = 200;
const BASE64_MIN_LEN = 100;
let fieldsVisited = 0;

function findBase64(obj, path = "", depth = 0) {
  if (depth > BASE64_MAX_DEPTH || fieldsVisited > BASE64_MAX_FIELDS) return;
  if (typeof obj === "string") {
    fieldsVisited++;
    // encData 排除保持
    // 长度 < BASE64_MIN_LEN 且非 data: 则 return
    // 先 magic 前缀再 regex
    ...
  } else if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      fieldsVisited++;
      if (fieldsVisited > BASE64_MAX_FIELDS) return;
      findBase64(obj[key], path ? path + "." + key : key, depth + 1);
    }
  }
}
```

每次 `detectBase64AndCreateDownload` 入口重置 `fieldsVisited = 0`。

- [x] **Step 2: Verify（B-T9-v）** encData 排除 + 上限存在。

- [x] **Step 3: 勾选 tasks 2.9–2.10**

---

### Task 11: B-regression-commit

- [x] 冒烟：连续请求、大 body 会话详情、Base64 按钮、清空历史  
- [x] 勾选 2.11  
- [x] Commit：`perf(api-monitor): batch B performance (T6-T9)`

---

### Task 12: T10 公共 KV 表格

**Files:**
- Modify: `updateLocalStorageDisplay` / `updateSessionStorageDisplay` / `updateCookieDisplay`（约 1216–1548）

- [x] **Step 1: 在三函数之上定义一次**

```js
function createExpandableValue(monitorWindow, value) {
  const isObject = value && typeof value === "object";
  const fullValueText = isObject ? JSON.stringify(value, null, 2) : String(value);
  const pre = monitorWindow.document.createElement("pre");
  pre.textContent = fullValueText;
  pre.style.cssText =
    "margin:0;white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:12px;";
  return pre;
}

function renderKeyValueTable(monitorWindow, contentElement, data, emptyText) {
  contentElement.innerHTML = "";
  if (!data || Object.keys(data).length === 0) {
    contentElement.innerHTML =
      '<div style="color: #666; text-align: center; padding: 20px;">' +
      emptyText +
      "</div>";
    return;
  }
  // 从现有 LocalStorage 表格逻辑搬迁 thead/tbody 构建
  ...
}
```

- [x] **Step 2: 三处改为采集 data 后 `renderKeyValueTable(...)`**，删除三份内嵌 `createExpandableValue`。

- [x] **Step 3: Verify（C-T10-v）** 三 Tab 调用公共函数。

- [x] **Step 4: 勾选 3.1–3.3**

---

### Task 13: T11 删除死代码

**Files:**
- Modify: `showRequestDetails`（约 2324–2607）

- [x] **Step 1: 删除未使用变量**  
  如仅赋值未读的 `jsonContainerId`、`jsonContentId`、`isJsonObject`、`jsonDataForView`、`requestBodyJsonData`、`requestBodyContainerId`、`requestHeadersContainerId` 等（以实际未引用为准）。保留 base64 替换展示逻辑与 `<pre>` 输出（T21 将再改为安全构建）。

- [x] **Step 2: Verify（C-T11-v）** 详情仍显示；无 eslint 式未用变量残留（人工）。

- [x] **Step 3: 勾选 3.4–3.5**

---

### Task 14: T12 getShortUrl

**Files:**
- Modify: `getShortUrl`（约 2030–2055）

- [x] **Step 1: 改为从关键字起点截取**

```js
function getShortUrl(url) {
  if (typeof url !== "string") return "";
  let start = 0;
  let found = false;
  if (monitorKeywords.length > 0) {
    let best = url.length;
    for (const keyword of monitorKeywords) {
      const index = url.indexOf(keyword);
      if (index !== -1 && index < best) {
        best = index;
        found = true;
      }
    }
    if (found) start = best; // 保留关键字
  }
  let displayUrl = found ? url.substring(start) : url;
  const MAX = 120;
  if (displayUrl.length > MAX) displayUrl = displayUrl.slice(0, MAX) + "…";
  return displayUrl;
}
```

- [x] **Step 2: Verify（C-T12-v）** 列表含关键字。

- [x] **Step 3: 勾选 3.6–3.7**

---

### Task 15: T14 版本 2.7

**Files:**
- Modify: `API请求监控工具/api-monitor.user.js` 头 `@version`
- Modify: `API请求监控工具/api-monitor.meta.js` `@version`

- [x] **Step 1:** 两处改为 `2.7`  
- [x] **Step 2: Verify** grep `@version` 均为 2.7  
- [x] **Step 3: 勾选 3.8–3.9**

---

### Task 16: C-regression-commit

- [x] 三 Tab、详情复制、列表 shortUrl、版本  
- [x] 勾选 3.10  
- [x] Commit：`refactor(api-monitor): batch C maintainability (T10-T12,T14)`

---

### Task 17: T21 详情防 XSS

**Files:**
- Modify: `showRequestDetails` 及必要 helper

- [x] **Step 1: 增加**

```js
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [x] **Step 2: 重构 basicInfo / headers / body 区块**

优先 DOM API：

```js
const basicInfo = monitorWindow.document.createElement("div");
const h3 = monitorWindow.document.createElement("h3");
h3.textContent = "请求详情";
// ...
const urlDiv = monitorWindow.document.createElement("div");
const strong = monitorWindow.document.createElement("strong");
strong.textContent = "URL:";
urlDiv.appendChild(strong);
urlDiv.appendChild(monitorWindow.document.createTextNode(" " + request.url));
```

若保留少量 `innerHTML`，**所有动态值必须 `escapeHtml`**。`<pre>` 内容用 `textContent` 设置格式化后的字符串，不用 `innerHTML` 插 body。

复制按钮：可用 `textContent` 取 pre 文本，或 data 属性存原文；保持 `copyToClipboard` 可用。

- [x] **Step 3: Verify（E-T21-v）** 对照 security spec；确认响应体路径无未转义 innerHTML。

- [x] **Step 4: 勾选 4.1–4.3**

---

### Task 18: E-regression-commit

- [x] 恶意 payload 文本展示；复制仍可用  
- [x] 勾选 4.4  
- [x] Commit：`security(api-monitor): batch E detail XSS hardening (T21)`

---

### Task 19: Final smoke + 交付

- [x] **Step 1:** 执行 Design Doc §8 Final 手工冒烟全表  
- [x] **Step 2:** 确认未实现非目标（T15–T20/T13/T22/T23）；关窗仍停监控  
- [x] **Step 3:** 勾选 tasks 5.1–5.4  
- [x] **Step 4:** Commit（若有勾选-only 变更）  
- [x] **Step 5:** 记录构建证据（userscript 无 npm build 时）：

```bash
comet state record-check api-monitor-optimize build --command "manual-smoke-api-monitor-2.7" --exit-code 0
```

（仅在手工验收通过后执行；Comet 不执行该命令字符串。）

---

## Spec Coverage Checklist

| Spec 能力 | 覆盖 Task |
|-----------|-----------|
| correctness fetch/XHR/dedup/DOM/keywords | 1–5 |
| performance persist/UI/buffer/base64 | 7–10 |
| maintainability KV/dead/shortUrl/version | 12–15 |
| security XSS | 17 |
| 非目标守护 | 19 |

## Self-Review

- 无 TBD 步骤；常量与 Design Doc 一致  
- 同文件串行约束已写清  
- T7 与 T21 顺序正确（先增量 UI 再安全详情）  
- 关窗停监控未列入修改任务  
