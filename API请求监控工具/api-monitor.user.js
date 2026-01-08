// ==UserScript==
// @name         API请求监控工具
// @namespace    http://howe.com
// @version      2.5
// @author       howe
// @description  监控网页API请求并在新窗口中显示详细信息
// @include      *://24.*
// @include      *://ybj.shanxi.gov.cn/ybfw/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-start
// @noframes
// @icon         https://ybj.shanxi.gov.cn/ybfw/hallEnter/favicon.ico
// @license      GPL-3.0-only
// @downloadURL  https://howe-file.oss-cn-hangzhou.aliyuncs.com/API%E8%AF%B7%E6%B1%82%E7%9B%91%E6%8E%A7%E5%B7%A5%E5%85%B7/api-monitor.user.js
// @updateURL    https://howe-file.oss-cn-hangzhou.aliyuncs.com/API%E8%AF%B7%E6%B1%82%E7%9B%91%E6%8E%A7%E5%B7%A5%E5%85%B7/api-monitor.meta.js
// ==/UserScript==

(function () {
  ("use strict");

  // API请求历史记录
  let requestHistory = [];
  // 历史记录最大保存数量
  const MAX_HISTORY_SIZE = 100;
  // 是否开始监控
  let isMonitoring = false;
  // 原始fetch和XMLHttpRequest方法
  let originalFetch = window.fetch;
  let originalXHROpen = XMLHttpRequest.prototype.open;
  let originalXHRSend = XMLHttpRequest.prototype.send;
  // 控制台日志历史
  let consoleLogs = [];
  // 原始console方法
  let originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };
  // 监控URL关键字列表
  let monitorKeywords = [];

  // 移除不再需要的全局copyToClipboard函数，已移至monitorWindow对象中

  // 添加控制台日志（需要在拦截器之前定义）
  function addConsoleLog(type, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    const content = args
      .map((arg) => {
        if (arg === null) return "null";
        if (arg === undefined) return "undefined";
        // 处理 Error 对象，包括堆栈信息
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}${
            arg.stack ? "\n" + arg.stack : ""
          }`;
        }
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    consoleLogs.push({ type, timestamp, content });

    // 限制日志数量
    if (consoleLogs.length > 500) {
      // 使用splice修改现有数组而不是重新赋值
      const newLogs = consoleLogs.slice(-500);
      consoleLogs.splice(0, consoleLogs.length, ...newLogs);
    }

    // 更新显示
    updateConsoleLogs();
  }

  // 立即拦截控制台方法，确保从页面加载开始就能捕获所有日志
  (function interceptConsoleMethods() {
    console.log = function (...args) {
      addConsoleLog("log", ...args);
      originalConsole.log.apply(console, args);
    };

    console.error = function (...args) {
      addConsoleLog("error", ...args);
      originalConsole.error.apply(console, args);
    };

    console.warn = function (...args) {
      addConsoleLog("warn", ...args);
      originalConsole.warn.apply(console, args);
    };

    console.info = function (...args) {
      addConsoleLog("info", ...args);
      originalConsole.info.apply(console, args);
    };

    console.debug = function (...args) {
      addConsoleLog("debug", ...args);
      originalConsole.debug.apply(console, args);
    };
  })();

  // 全局变量用于存储监控窗口
  let monitorWindow = null;
  // 用于存储当前打开的请求ID
  let currentlyOpenRequestId = null;
  // 用于存储监控状态提示图标
  let statusIcon = null;

  // 更新状态图标视觉效果
  function updateStatusIconVisuals() {
    if (!statusIcon) return;

    if (isMonitoring) {
      statusIcon.style.backgroundColor = "#35dd29c1";
      statusIcon.style.animation = "breathe 2s infinite ease-in-out";
      statusIcon.title = "API监控已启用 - 点击查看监控页面";
    } else {
      statusIcon.style.backgroundColor = "#f44336";
      statusIcon.style.animation = "none";
      statusIcon.title = "API监控未启用 - 点击启用";
    }
  }

  // 创建状态提示图标
  function createStatusIcon() {
    // 如果图标已存在，直接更新状态
    if (statusIcon) {
      updateStatusIconVisuals();
      return;
    }

    // 创建图标元素
    statusIcon = document.createElement("div");
    statusIcon.id = "api-monitor-status-icon";
    statusIcon.style.position = "fixed";
    statusIcon.style.top = "100px";
    statusIcon.style.right = "20px";
    statusIcon.style.width = "40px";
    statusIcon.style.height = "40px";
    statusIcon.style.borderRadius = "50%";
    statusIcon.style.color = "white";
    statusIcon.style.display = "flex";
    statusIcon.style.justifyContent = "center";
    statusIcon.style.alignItems = "center";
    statusIcon.style.cursor = "move";
    statusIcon.style.zIndex = "999999";
    statusIcon.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
    statusIcon.style.fontSize = "16px";
    statusIcon.style.transition =
      "background-color 0.3s ease, transform 0.3s ease";

    // 创建动画样式
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes breathe {
        0% {
          transform: scale(1);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        50% {
          transform: scale(1.1);
          box-shadow: 0 6px 12px rgba(0,0,0,0.3);
        }
        100% {
          transform: scale(1);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
      }
      
      /* 拖动时暂停动画 */
      #api-monitor-status-icon[data-dragging="true"] {
        animation-play-state: paused;
      }
    `;
    document.head.appendChild(styleSheet);

    // 保存动画样式引用
    statusIcon._animationStyleSheet = styleSheet;
    statusIcon.innerHTML = "📡";

    // 添加点击事件
    statusIcon.addEventListener("click", function () {
      if (!isMonitoring) {
        toggleMonitoring();
      } else {
        if (monitorWindow && !monitorWindow.closed) {
          // 如果窗口已存在且未关闭，聚焦到窗口
          monitorWindow.focus();
        } else {
          // 否则创建新的监控窗口
          createMonitorWindow();
        }
      }
    });

    // 实现拖动功能
    let isDragging = false;
    let offsetX, offsetY;

    statusIcon.addEventListener("mousedown", function (e) {
      isDragging = true;
      const rect = statusIcon.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      statusIcon.style.cursor = "grabbing";
      // 暂停呼吸动画
      statusIcon.setAttribute("data-dragging", "true");
    });

    document.addEventListener("mousemove", function (e) {
      if (isDragging) {
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        statusIcon.style.left = x + "px";
        statusIcon.style.top = y + "px";
        statusIcon.style.transform = "none"; // 移除居中变换
      }
    });

    document.addEventListener("mouseup", function () {
      if (isDragging) {
        isDragging = false;
        statusIcon.style.cursor = "move";
        // 恢复呼吸动画
        statusIcon.removeAttribute("data-dragging");
      }
    });

    // 阻止默认行为，确保拖动不会触发文本选择等
    statusIcon.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });

    // 将图标添加到页面
    document.body.appendChild(statusIcon);

    // 设置初始状态
    updateStatusIconVisuals();
  }

  // 在新窗口中创建监控UI
  function createMonitorWindow() {
    // 如果窗口已存在，先关闭
    if (monitorWindow && !monitorWindow.closed) {
      monitorWindow.close();
    }

    // 创建新窗口
    const windowFeatures =
      "width=800,height=600,toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes";
    monitorWindow = window.open("about:blank", "apiMonitorWindow", windowFeatures);
    
    if (!monitorWindow) {
      alert("无法打开新窗口，请检查浏览器弹窗设置");
      return;
    }

    // 设置新窗口内容
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>API请求监控工具</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            margin: 0;
            padding: 10px;
            background-color: #f5f5f5;
          }
          .copy-btn {
            padding: 2px 8px;
            font-size: 12px;
            background-color: transparent;
            color: #666;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            width: 30px;
            height: 25px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .copy-btn:hover {
            background-color: #f5f5f5;
            color: #333;
            border-color: #bbb;
          }
          .tabs {
            display: flex;
            margin-bottom: 10px;
            background-color: #e0e0e0;
            border-radius: 4px 4px 0 0;
            padding: 0 10px;
          }
          .tab {
            padding: 8px 16px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
          }
          .tab.active {
            border-bottom: 2px solid #2196F3;
            background-color: white;
          }
          .controls {
            margin-bottom: 10px;
            text-align: right;
            background-color: white;
            padding: 10px;
            border-radius: 0 0 4px 4px;
          }
          button {
            padding: 4px 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 5px;
          }
          #api-request-list {
            background-color: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            max-height: 100vh;
            overflow-y: auto;
            margin-bottom: 10px;
          }
          .api-request-item {
            padding: 8px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .api-request-item .time-column {
            width: 150px;
            margin-right: 10px;
            color: #666;
          }
          .api-request-item:hover {
            background-color: #f0f0f0;
          }
          #api-detail-panel {
            background-color: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            max-height: 100vh;
            overflow-y: auto;
            padding: 10px;
            display: none;
          }
          #console-panel {
            background-color: #1e1e1e;
            border: 1px solid #ccc;
            border-radius: 4px;
            max-height: 100vh;
            overflow-y: auto;
            padding: 10px;
            color: #d4d4d4;
            font-family: 'Courier New', monospace;
            display: none;
          }
          .console-log {
            margin-bottom: 4px;
            padding: 4px;
            border-radius: 2px;
          }
          .console-log.log { color: #d4d4d4; }
          .console-log.error { color: #f44336; background-color: rgba(244, 67, 54, 0.1); }
          .console-log.warn { color: #ff9800; background-color: rgba(255, 152, 0, 0.1); }
          .console-log.info { color: #2196f3; background-color: rgba(33, 150, 243, 0.1); }
          .console-log.debug { color: #9e9e9e; background-color: rgba(158, 158, 158, 0.1); }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: #f8f8f8;
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
          }
          h3, h4 {
            margin-top: 15px;
            margin-bottom: 8px;
          }
          #back-to-top-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: #2196F3;
            color: white;
            border: none;
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            z-index: 1000;
            transition: opacity 0.3s;
          }
          #back-to-top-btn:hover {
            background-color: #1976D2;
          }
          .base64-download-btn {
            padding: 4px 12px;
            font-size: 12px;
            background-color: #4CAF50;
            color: white;
            border: 1px solid #45a049;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px 5px 5px 0;
            display: inline-block;
          }
          .base64-download-btn:hover {
            background-color: #45a049;
          }
          .file-preview-modal {
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
          }
          .file-preview-content {
            position: relative;
            margin: auto;
            padding: 0;
            width: 90%;
            max-width: 1200px;
            height: 90%;
            margin-top: 2%;
          }
          .file-preview-close {
            position: absolute;
            top: 15px;
            right: 35px;
            color: #f1f1f1;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            z-index: 10001;
          }
          .file-preview-close:hover,
          .file-preview-close:focus {
            color: #bbb;
          }
          .file-preview-iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
          }
          .file-preview-img {
            max-width: 100%;
            max-height: 100%;
            display: block;
            margin: auto;
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2>API请求监控工具</h2>
          <div class="controls">
            <button id="clear-history-button" style="background-color: #ff9800; color: white;">清空历史</button>
            <button id="close-window-button" style="background-color: #f44336; color: white;">关闭窗口</button>
          </div>
        </div>
        <div class="tabs">
          <div class="tab active" id="api-tab">API请求</div>
          <div class="tab" id="console-tab">控制台日志</div>
          <div class="tab" id="localstorage-tab">LocalStorage</div>
          <div class="tab" id="sessionstorage-tab">SessionStorage</div>
          <div class="tab" id="cookie-tab">Cookie</div>
        </div>
        <div style="display: flex; height: calc(100vh - 140px); width: 100%;">
          <div id="api-request-list" style="width: 50%; height: 100%; flex: 1; border-right: 1px solid #ccc; overflow-y: auto;"></div>
          <div id="api-detail-panel" style="width: 50%; height: 100%; flex: 1; overflow-y: auto; display: none; position: relative;">
            <button id="close-detail-button" style="background-color: #f44336; color: white;">关闭详情</button>
            <button id="back-to-top-btn" title="回到顶部">↑</button>
          </div>
        </div>
        <div id="console-panel" style="height: calc(100vh - 150px); overflow-y: auto;"></div>
        <div id="localstorage-panel" style="display: none; height: calc(100vh - 130px); overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <h3>LocalStorage 内容</h3>
            <button id="refresh-localstorage" style="background-color: #2196F3; color: white;">刷新</button>
          </div>
          <div id="localstorage-content" style="background-color: white; border: 1px solid #ccc; border-radius: 4px; padding: 10px; height: calc(100% - 100px); overflow-y: auto;"></div>
        </div>
        <div id="sessionstorage-panel" style="display: none; height: calc(100vh - 130px); overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <h3>SessionStorage 内容</h3>
            <button id="refresh-sessionstorage" style="background-color: #2196F3; color: white;">刷新</button>
          </div>
          <div id="sessionstorage-content" style="background-color: white; border: 1px solid #ccc; border-radius: 4px; padding: 10px; height: calc(100% - 100px); overflow-y: auto;"></div>
        </div>
        <div id="cookie-panel" style="display: none; height: calc(100vh - 130px); overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <h3>Cookie 内容</h3>
            <button id="refresh-cookie" style="background-color: #2196F3; color: white;">刷新</button>
          </div>
          <div id="cookie-content" style="background-color: white; border: 1px solid #ccc; border-radius: 4px; padding: 10px; height: calc(100% - 100px); overflow-y: auto;"></div>
        </div>
      </body>
      </html>
    `;

    // 立即写入内容到新窗口
    try {
      monitorWindow.document.open();
      monitorWindow.document.write(html);
      monitorWindow.document.close();
    } catch (e) {
      console.error('写入页面内容失败:', e);
      // 如果 write 失败，尝试备用方案
      setTimeout(() => {
        try {
          const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
          const headMatch = html.match(/<head[^>]*>([\s\S]*)<\/head>/i);
          if (headMatch && monitorWindow.document.head) {
            monitorWindow.document.head.innerHTML = headMatch[1];
          }
          if (bodyMatch && monitorWindow.document.body) {
            monitorWindow.document.body.innerHTML = bodyMatch[1];
          }
        } catch (e2) {
          console.error('备用方案也失败:', e2);
        }
      }, 100);
    }
    
    // 动态加载 JsonTree CSS 和 JS，避免阻塞页面渲染
    setTimeout(() => {
      try {
        // 加载 CSS
        const link = monitorWindow.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/gh/williamtroup/JsonTree.js@4.7.1/dist/jsontree.js.min.css';
        link.onerror = () => console.error('JsonTree CSS 加载失败');
        monitorWindow.document.head.appendChild(link);
        
        // 加载 JS
        const script = monitorWindow.document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/gh/williamtroup/JsonTree.js@4.7.1/dist/jsontree.min.js';
        script.onerror = () => console.error('JsonTree JS 加载失败');
        script.onload = () => {
          console.log('JsonTree 加载完成');
        };
        monitorWindow.document.body.appendChild(script);
      } catch (e) {
        console.error('加载 JsonTree 资源失败:', e);
      }
    }, 100);

    // 等待 DOM 完全加载后再添加事件监听器
    const initEventListeners = () => {
      // 添加事件监听器
      const apiTab = monitorWindow.document.getElementById("api-tab");
      const consoleTab = monitorWindow.document.getElementById("console-tab");
      const localstorageTab =
        monitorWindow.document.getElementById("localstorage-tab");
      const sessionstorageTab =
        monitorWindow.document.getElementById("sessionstorage-tab");
      const cookieTab = monitorWindow.document.getElementById("cookie-tab");
      const refreshLocalstorage = monitorWindow.document.getElementById(
        "refresh-localstorage"
      );
      const refreshSessionstorage = monitorWindow.document.getElementById(
        "refresh-sessionstorage"
      );
      const refreshCookie =
        monitorWindow.document.getElementById("refresh-cookie");
      const clearHistoryBtn = monitorWindow.document.getElementById(
        "clear-history-button"
      );
      const closeWindowBtn = monitorWindow.document.getElementById(
        "close-window-button"
      );

      if (apiTab)
        apiTab.addEventListener("click", function () {
          switchTab("api");
        });
      if (consoleTab)
        consoleTab.addEventListener("click", function () {
          switchTab("console");
        });
      if (localstorageTab)
        localstorageTab.addEventListener("click", function () {
          switchTab("localstorage");
        });
      if (sessionstorageTab)
        sessionstorageTab.addEventListener("click", function () {
          switchTab("sessionstorage");
        });
      if (cookieTab)
        cookieTab.addEventListener("click", function () {
          switchTab("cookie");
        });
      if (refreshLocalstorage)
        refreshLocalstorage.addEventListener(
          "click",
          updateLocalStorageDisplay
        );
      if (refreshSessionstorage)
        refreshSessionstorage.addEventListener(
          "click",
          updateSessionStorageDisplay
        );
      if (refreshCookie)
        refreshCookie.addEventListener("click", updateCookieDisplay);
      if (clearHistoryBtn)
        clearHistoryBtn.addEventListener("click", clearHistory);
      if (closeWindowBtn) {
        closeWindowBtn.addEventListener("click", () => {
          monitorWindow.close();
          monitorWindow = null;
          // 停止监控
          if (isMonitoring) {
            toggleMonitoring();
          }
        });
      }

      // 关闭详情按钮
      const closeDetailBtn = monitorWindow.document.getElementById(
        "close-detail-button"
      );
      if (closeDetailBtn) {
        closeDetailBtn.addEventListener("click", () => {
          currentlyOpenRequestId = null;
          // 更新请求列表以移除高亮
          updateRequestList();
          const detailPanel =
            monitorWindow.document.getElementById("api-detail-panel");
          if (detailPanel) {
            detailPanel.style.display = "none";
          }
        });
      }

      // 回到顶部按钮
      const backToTopBtn =
        monitorWindow.document.getElementById("back-to-top-btn");
      const detailPanel =
        monitorWindow.document.getElementById("api-detail-panel");
      if (backToTopBtn && detailPanel) {
        backToTopBtn.addEventListener("click", () => {
          detailPanel.scrollTo({ top: 0, behavior: "smooth" });
        });

        // 监听详情面板滚动事件，显示/隐藏回到顶部按钮
        detailPanel.addEventListener("scroll", () => {
          if (detailPanel.scrollTop > 300) {
            backToTopBtn.style.display = "flex";
          } else {
            backToTopBtn.style.display = "none";
          }
        });
      }
    };

    // 如果文档已经加载完成，立即执行；否则等待 DOMContentLoaded
    if (
      monitorWindow.document.readyState === "complete" ||
      monitorWindow.document.readyState === "interactive"
    ) {
      // 使用 setTimeout 确保 DOM 已完全解析
      setTimeout(initEventListeners, 0);
    } else {
      monitorWindow.document.addEventListener(
        "DOMContentLoaded",
        initEventListeners
      );
    }

    // 添加自定义消息提示函数到monitorWindow的window对象中
    monitorWindow.window.showMessage = function (
      message,
      type = "success",
      duration = 2000
    ) {
      const doc = monitorWindow.document;

      // 创建消息元素
      const messageEl = doc.createElement("div");
      messageEl.className = "api-message";
      messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-100%);
            padding: 12px 16px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            color: #fff;
            font-size: 14px;
            z-index: 9999;
            transition: all 0.3s ease;
            opacity: 0;
            white-space: nowrap;
        `;

      // 设置不同类型的样式
      if (type === "success") {
        messageEl.style.backgroundColor = "#67c23a";
      } else if (type === "error") {
        messageEl.style.backgroundColor = "#f56c6c";
      } else if (type === "warning") {
        messageEl.style.backgroundColor = "#e6a23c";
      } else if (type === "info") {
        messageEl.style.backgroundColor = "#909399";
      }

      messageEl.textContent = message;
      doc.body.appendChild(messageEl);

      // 显示动画
      setTimeout(() => {
        messageEl.style.transform = "translateX(-50%) translateY(0)";
        messageEl.style.opacity = "1";
      }, 10);

      // 自动消失
      setTimeout(() => {
        messageEl.style.transform = "translateX(-50%) translateY(-100%)";
        messageEl.style.opacity = "0";
        setTimeout(() => {
          if (messageEl.parentNode === doc.body) {
            doc.body.removeChild(messageEl);
          }
        }, 300);
      }, duration);
    };

    // 添加复制到剪贴板函数到monitorWindow的window对象中
    monitorWindow.window.copyToClipboard = function (text) {
      // 确保使用monitorWindow的document
      const doc = monitorWindow.document;

      // 先尝试使用execCommand方式（更可靠，不受焦点限制）
      const textarea = doc.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      textarea.style.top = "-999999px";
      doc.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        const successful = doc.execCommand("copy");
        if (successful) {
          // 使用自定义消息提示
          monitorWindow.window.showMessage("复制成功", "success");
        } else {
          throw new Error("execCommand返回失败");
        }
      } catch (err) {
        console.error("复制失败:", err);
        monitorWindow.window.showMessage("复制失败: " + err.message, "error");
      } finally {
        // 确保在操作完成后移除textarea
        setTimeout(() => {
          doc.body.removeChild(textarea);
        }, 100);
      }
    };

    // 监听窗口关闭事件
    monitorWindow.addEventListener("beforeunload", () => {
      monitorWindow = null;
      currentlyOpenRequestId = null;
      // 停止监控
      if (isMonitoring) {
        toggleMonitoring();
      }
    });

    // 初始化时更新控制台日志
    updateConsoleLogs();
  }

  // 切换标签页 - 暴露到window对象上以便监控窗口访问
  function switchTab(tabName) {
    if (!monitorWindow || monitorWindow.closed) return;

    const apiTab = monitorWindow.document.getElementById("api-tab");
    const consoleTab = monitorWindow.document.getElementById("console-tab");
    const localStorageTab =
      monitorWindow.document.getElementById("localstorage-tab");
    const sessionStorageTab =
      monitorWindow.document.getElementById("sessionstorage-tab");
    const cookieTab = monitorWindow.document.getElementById("cookie-tab");

    const apiList = monitorWindow.document.getElementById("api-request-list");
    const apiDetail = monitorWindow.document.getElementById("api-detail-panel");
    const consolePanel = monitorWindow.document.getElementById("console-panel");
    const localStoragePanel =
      monitorWindow.document.getElementById("localstorage-panel");
    const sessionStoragePanel = monitorWindow.document.getElementById(
      "sessionstorage-panel"
    );
    const cookiePanel = monitorWindow.document.getElementById("cookie-panel");
    const flexContainer = apiList.parentElement;

    // 重置所有标签和面板
    apiTab.classList.remove("active");
    consoleTab.classList.remove("active");
    localStorageTab.classList.remove("active");
    sessionStorageTab.classList.remove("active");
    cookieTab.classList.remove("active");

    // 隐藏所有面板
    flexContainer.style.display = "none";
    consolePanel.style.display = "none";
    localStoragePanel.style.display = "none";
    sessionStoragePanel.style.display = "none";
    cookiePanel.style.display = "none";

    // 根据标签名显示对应内容
    if (tabName === "api") {
      apiTab.classList.add("active");
      // 显示flex容器，包含apiList和apiDetail
      flexContainer.style.display = "flex";
    } else if (tabName === "console") {
      consoleTab.classList.add("active");
      consolePanel.style.display = "block";
      updateConsoleLogs();
    } else if (tabName === "localstorage") {
      localStorageTab.classList.add("active");
      localStoragePanel.style.display = "block";
      updateLocalStorageDisplay();
    } else if (tabName === "sessionstorage") {
      sessionStorageTab.classList.add("active");
      sessionStoragePanel.style.display = "block";
      updateSessionStorageDisplay();
    } else if (tabName === "cookie") {
      cookieTab.classList.add("active");
      cookiePanel.style.display = "block";
      updateCookieDisplay();
    }
  }

  // 将switchTab函数暴露到window对象上
  window.switchTab = switchTab;

  // 更新LocalStorage显示
  function updateLocalStorageDisplay() {
    if (!monitorWindow || monitorWindow.closed) return;

    try {
      const contentElement = monitorWindow.document.getElementById(
        "localstorage-content"
      );
      contentElement.innerHTML = "";

      const localStorageData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
          localStorageData[key] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          localStorageData[key] = localStorage.getItem(key);
        }
      }

      if (Object.keys(localStorageData).length === 0) {
        contentElement.innerHTML =
          '<div style="color: #666; text-align: center; padding: 20px;">LocalStorage 为空</div>';
        return;
      }

      // 创建表格展示数据
      const table = monitorWindow.document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.fontSize = "13px";

      // 添加表头
      const thead = monitorWindow.document.createElement("thead");
      const headerRow = monitorWindow.document.createElement("tr");
      headerRow.style.backgroundColor = "#f5f5f5";

      const keyHeader = monitorWindow.document.createElement("th");
      keyHeader.textContent = "键";
      keyHeader.style.padding = "8px";
      keyHeader.style.border = "1px solid #ddd";
      keyHeader.style.fontWeight = "bold";

      const valueHeader = monitorWindow.document.createElement("th");
      valueHeader.textContent = "值";
      valueHeader.style.padding = "8px";
      valueHeader.style.border = "1px solid #ddd";
      valueHeader.style.fontWeight = "bold";
      valueHeader.style.width = "70%";

      headerRow.appendChild(keyHeader);
      headerRow.appendChild(valueHeader);
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // 添加数据行
      const tbody = monitorWindow.document.createElement("tbody");

      // 创建展开/收缩切换函数
      function createExpandableValue(monitorWindow, value) {
        // 判断是否为对象
        const isObject = value && typeof value === "object";

        // 获取完整值文本
        const fullValueText = isObject
          ? JSON.stringify(value, null, 2)
          : String(value);

        // 如果是对象，使用 JsonTree 显示
        if (isObject) {
          const jsonContainerId = `json-localstorage-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const jsonContainer = monitorWindow.document.createElement("div");
          jsonContainer.id = jsonContainerId;
          jsonContainer.style.backgroundColor = "#f8f8f8";
          jsonContainer.style.padding = "8px";
          jsonContainer.style.borderRadius = "4px";
          jsonContainer.style.border = "1px solid #e0e0e0";

          // 初始化 JsonTree
          const initJsonTreeForLocalStorage = () => {
            try {
              const JsonTreeClass = monitorWindow.JsonTree || (monitorWindow.window && monitorWindow.window.JsonTree);
              if (JsonTreeClass) {
                new JsonTreeClass(jsonContainer, {
                  data: value,
                  title: {
                    enableFullScreenToggling: false,
                    showFullScreenButton: false,
                  },
                  footer: {},
                  controlPanel: {
                    showMovingButtons: false,
                    showEditButton: false,
                    showImportButton: false,
                  },
                  sideMenu: {
                    enabled: false,
                  },
                });
              } else {
                // 如果 JsonTree 还没加载，等待加载完成
                const checkAndInit = setInterval(() => {
                  const JsonTreeClass = monitorWindow.JsonTree || (monitorWindow.window && monitorWindow.window.JsonTree);
                  if (JsonTreeClass) {
                    new JsonTreeClass(jsonContainer, {
                      data: value,
                      title: {
                        enableFullScreenToggling: false,
                        showFullScreenButton: false,
                      },
                      footer: {},
                      controlPanel: {
                        showMovingButtons: false,
                        showEditButton: false,
                        showImportButton: false,
                      },
                      sideMenu: {
                        enabled: false,
                      },
                    });
                    clearInterval(checkAndInit);
                  }
                }, 100);
                // 10秒后停止检查，回退到普通显示
                setTimeout(() => {
                  clearInterval(checkAndInit);
                  const preElement = monitorWindow.document.createElement("pre");
                  preElement.textContent = fullValueText;
                  preElement.style.margin = "0";
                  preElement.style.whiteSpace = "pre-wrap";
                  preElement.style.wordBreak = "break-all";
                  preElement.style.fontFamily = "monospace";
                  preElement.style.fontSize = "12px";
                  jsonContainer.innerHTML = "";
                  jsonContainer.appendChild(preElement);
                }, 10000);
              }
            } catch (e) {
              console.error("JsonTree 初始化失败:", e);
              // 如果 JsonTree 失败，回退到普通显示
              const preElement = monitorWindow.document.createElement("pre");
              preElement.textContent = fullValueText;
              preElement.style.margin = "0";
              preElement.style.whiteSpace = "pre-wrap";
              preElement.style.wordBreak = "break-all";
              preElement.style.fontFamily = "monospace";
              preElement.style.fontSize = "12px";
              jsonContainer.innerHTML = "";
              jsonContainer.appendChild(preElement);
            }
          };

          // 延迟初始化，确保 JsonTree 已加载
          setTimeout(initJsonTreeForLocalStorage, 200);

          return jsonContainer;
        }

        // 如果内容较短（少于50个字符），直接显示，不提供展开/收缩功能
        if (fullValueText.length <= 50) {
          const simpleElement = monitorWindow.document.createElement("span");
          simpleElement.textContent = fullValueText;
          simpleElement.style.fontFamily = "monospace";
          simpleElement.style.fontSize = "12px";
          return simpleElement;
        }

        const valueContainer = monitorWindow.document.createElement("div");

        // 设置容器样式，使整个区域可点击
        valueContainer.style.cursor = "pointer";
        valueContainer.style.userSelect = "text"; // 允许文本选择
        valueContainer.onmouseenter = function () {
          this.style.backgroundColor = "#f0f0f0";
          this.style.borderRadius = "3px";
        };
        valueContainer.onmouseleave = function () {
          this.style.backgroundColor = "";
        };

        // 创建展开/收缩图标
        const toggleIcon = monitorWindow.document.createElement("span");
        toggleIcon.textContent = "▶";
        toggleIcon.style.marginRight = "5px";
        toggleIcon.style.display = "inline-block";
        toggleIcon.style.transition = "transform 0.2s, color 0.2s";
        toggleIcon.style.color = "#666";

        // 创建简短预览（最多显示80个字符）
        const previewText =
          fullValueText.length > 80
            ? fullValueText.substring(0, 80) + "..."
            : fullValueText;

        // 创建预览元素
        const previewElement = monitorWindow.document.createElement("span");
        previewElement.textContent = previewText;
        previewElement.style.fontFamily = "monospace";
        previewElement.style.fontSize = "12px";

        // 创建完整内容元素
        const fullContentElement = monitorWindow.document.createElement("pre");
        fullContentElement.textContent = fullValueText;
        fullContentElement.style.margin = "8px 0 0 15px"; // 缩进效果
        fullContentElement.style.whiteSpace = "pre-wrap";
        fullContentElement.style.wordBreak = "break-all";
        fullContentElement.style.fontFamily = "monospace";
        fullContentElement.style.fontSize = "12px";
        fullContentElement.style.display = "none"; // 默认隐藏
        fullContentElement.style.padding = "8px";
        fullContentElement.style.backgroundColor = "#f9f9f9";
        fullContentElement.style.borderRadius = "4px";
        fullContentElement.style.border = "1px solid #e0e0e0";
        fullContentElement.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";

        // 组合元素
        valueContainer.appendChild(toggleIcon);
        valueContainer.appendChild(previewElement);
        valueContainer.appendChild(fullContentElement);

        // 切换函数
        function toggleExpand() {
          const isExpanded = fullContentElement.style.display === "block";
          if (isExpanded) {
            fullContentElement.style.display = "none";
            toggleIcon.textContent = "▶";
            toggleIcon.style.transform = "rotate(0deg)";
            toggleIcon.style.color = "#666";
          } else {
            fullContentElement.style.display = "block";
            toggleIcon.textContent = "▼";
            toggleIcon.style.transform = "rotate(180deg)";
            toggleIcon.style.color = "#2196F3";

            // 自动滚动到显示的完整内容（如果需要）
            setTimeout(() => {
              const rect = fullContentElement.getBoundingClientRect();
              if (rect.bottom > window.innerHeight) {
                fullContentElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            }, 100);
          }
        }

        // 为整个容器添加点击事件，但允许文本选择
        let lastClickTime = 0;
        valueContainer.addEventListener("click", function (e) {
          // 检查是否是文本选择操作
          const selection = monitorWindow.getSelection();
          const selectedText = selection.toString();
          if (selectedText) {
            return; // 如果有选中文本，不执行展开/收缩
          }

          // 双击也可以展开/收缩
          const currentTime = Date.now();
          const isDoubleClick = currentTime - lastClickTime < 300;
          lastClickTime = currentTime;

          toggleExpand();
        });

        // 允许直接点击图标切换
        toggleIcon.addEventListener("click", function (e) {
          e.stopPropagation(); // 阻止冒泡，避免触发两次
          toggleExpand();
        });

        return valueContainer;
      }

      Object.entries(localStorageData).forEach(([key, value]) => {
        const row = monitorWindow.document.createElement("tr");
        row.style.borderBottom = "1px solid #eee";
        row.addEventListener("mouseenter", () => {
          row.style.backgroundColor = "#f9f9f9";
        });
        row.addEventListener("mouseleave", () => {
          row.style.backgroundColor = "";
        });

        const keyCell = monitorWindow.document.createElement("td");
        keyCell.textContent = key;
        keyCell.style.padding = "8px";
        keyCell.style.border = "1px solid #ddd";
        keyCell.style.fontFamily = "monospace";
        keyCell.style.verticalAlign = "top";

        const valueCell = monitorWindow.document.createElement("td");
        // 使用可展开/收缩的组件
        const expandableValue = createExpandableValue(monitorWindow, value);
        valueCell.appendChild(expandableValue);
        valueCell.style.padding = "8px";
        valueCell.style.border = "1px solid #ddd";

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      contentElement.appendChild(table);
    } catch (error) {
      const contentElement = monitorWindow.document.getElementById(
        "localstorage-content"
      );
      contentElement.innerHTML = `<div style="color: #f44336; padding: 10px;">获取 LocalStorage 失败: ${error.message}</div>`;
    }
  }

  // 更新SessionStorage显示
  function updateSessionStorageDisplay() {
    if (!monitorWindow || monitorWindow.closed) return;

    try {
      const contentElement = monitorWindow.document.getElementById(
        "sessionstorage-content"
      );
      contentElement.innerHTML = "";

      const sessionStorageData = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        try {
          sessionStorageData[key] = JSON.parse(sessionStorage.getItem(key));
        } catch (e) {
          sessionStorageData[key] = sessionStorage.getItem(key);
        }
      }

      if (Object.keys(sessionStorageData).length === 0) {
        contentElement.innerHTML =
          '<div style="color: #666; text-align: center; padding: 20px;">SessionStorage 为空</div>';
        return;
      }

      // 创建表格展示数据
      const table = monitorWindow.document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.fontSize = "13px";

      // 添加表头
      const thead = monitorWindow.document.createElement("thead");
      const headerRow = monitorWindow.document.createElement("tr");
      headerRow.style.backgroundColor = "#f5f5f5";

      const keyHeader = monitorWindow.document.createElement("th");
      keyHeader.textContent = "键";
      keyHeader.style.padding = "8px";
      keyHeader.style.border = "1px solid #ddd";
      keyHeader.style.fontWeight = "bold";

      const valueHeader = monitorWindow.document.createElement("th");
      valueHeader.textContent = "值";
      valueHeader.style.padding = "8px";
      valueHeader.style.border = "1px solid #ddd";
      valueHeader.style.fontWeight = "bold";
      valueHeader.style.width = "70%";

      headerRow.appendChild(keyHeader);
      headerRow.appendChild(valueHeader);
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // 添加数据行
      const tbody = monitorWindow.document.createElement("tbody");

      // 创建展开/收缩切换函数
      function createExpandableValue(monitorWindow, value) {
        // 判断是否为对象
        const isObject = value && typeof value === "object";

        // 获取完整值文本
        const fullValueText = isObject
          ? JSON.stringify(value, null, 2)
          : String(value);

        // 如果是对象，使用 JsonTree 显示
        if (isObject) {
          const jsonContainerId = `json-sessionstorage-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const jsonContainer = monitorWindow.document.createElement("div");
          jsonContainer.id = jsonContainerId;
          jsonContainer.style.backgroundColor = "#f8f8f8";
          jsonContainer.style.padding = "8px";
          jsonContainer.style.borderRadius = "4px";
          jsonContainer.style.border = "1px solid #e0e0e0";

          // 初始化 JsonTree
          const initJsonTreeForSessionStorage = () => {
            try {
              const JsonTreeClass = monitorWindow.JsonTree || (monitorWindow.window && monitorWindow.window.JsonTree);
              if (JsonTreeClass) {
                new JsonTreeClass(jsonContainer, {
                  data: value,
                  title: {
                    enableFullScreenToggling: false,
                    showFullScreenButton: false,
                  },
                  footer: {},
                  controlPanel: {
                    showMovingButtons: false,
                    showEditButton: false,
                    showImportButton: false,
                  },
                  sideMenu: {
                    enabled: false,
                  },
                });
              } else {
                // 如果 JsonTree 还没加载，等待加载完成
                const checkAndInit = setInterval(() => {
                  const JsonTreeClass = monitorWindow.JsonTree || (monitorWindow.window && monitorWindow.window.JsonTree);
                  if (JsonTreeClass) {
                    new JsonTreeClass(jsonContainer, {
                      data: value,
                      title: {
                        enableFullScreenToggling: false,
                        showFullScreenButton: false,
                      },
                      footer: {},
                      controlPanel: {
                        showMovingButtons: false,
                        showEditButton: false,
                        showImportButton: false,
                      },
                      sideMenu: {
                        enabled: false,
                      },
                    });
                    clearInterval(checkAndInit);
                  }
                }, 100);
                // 10秒后停止检查，回退到普通显示
                setTimeout(() => {
                  clearInterval(checkAndInit);
                  const preElement = monitorWindow.document.createElement("pre");
                  preElement.textContent = fullValueText;
                  preElement.style.margin = "0";
                  preElement.style.whiteSpace = "pre-wrap";
                  preElement.style.wordBreak = "break-all";
                  preElement.style.fontFamily = "monospace";
                  preElement.style.fontSize = "12px";
                  jsonContainer.innerHTML = "";
                  jsonContainer.appendChild(preElement);
                }, 10000);
              }
            } catch (e) {
              console.error("JsonTree 初始化失败:", e);
              // 如果 JsonTree 失败，回退到普通显示
              const preElement = monitorWindow.document.createElement("pre");
              preElement.textContent = fullValueText;
              preElement.style.margin = "0";
              preElement.style.whiteSpace = "pre-wrap";
              preElement.style.wordBreak = "break-all";
              preElement.style.fontFamily = "monospace";
              preElement.style.fontSize = "12px";
              jsonContainer.innerHTML = "";
              jsonContainer.appendChild(preElement);
            }
          };

          // 延迟初始化，确保 JsonTree 已加载
          setTimeout(initJsonTreeForSessionStorage, 200);

          return jsonContainer;
        }

        // 如果内容较短（少于50个字符），直接显示，不提供展开/收缩功能
        if (fullValueText.length <= 50) {
          const simpleElement = monitorWindow.document.createElement("span");
          simpleElement.textContent = fullValueText;
          simpleElement.style.fontFamily = "monospace";
          simpleElement.style.fontSize = "12px";
          return simpleElement;
        }

        const valueContainer = monitorWindow.document.createElement("div");

        // 设置容器样式，使整个区域可点击
        valueContainer.style.cursor = "pointer";
        valueContainer.style.userSelect = "text"; // 允许文本选择
        valueContainer.onmouseenter = function () {
          this.style.backgroundColor = "#f0f0f0";
          this.style.borderRadius = "3px";
        };
        valueContainer.onmouseleave = function () {
          this.style.backgroundColor = "";
        };

        // 创建展开/收缩图标
        const toggleIcon = monitorWindow.document.createElement("span");
        toggleIcon.textContent = "▶";
        toggleIcon.style.marginRight = "5px";
        toggleIcon.style.display = "inline-block";
        toggleIcon.style.transition = "transform 0.2s, color 0.2s";
        toggleIcon.style.color = "#666";

        // 创建简短预览（最多显示80个字符）
        const previewText =
          fullValueText.length > 80
            ? fullValueText.substring(0, 80) + "..."
            : fullValueText;

        // 创建预览元素
        const previewElement = monitorWindow.document.createElement("span");
        previewElement.textContent = previewText;
        previewElement.style.fontFamily = "monospace";
        previewElement.style.fontSize = "12px";

        // 创建完整内容元素
        const fullContentElement = monitorWindow.document.createElement("pre");
        fullContentElement.textContent = fullValueText;
        fullContentElement.style.margin = "8px 0 0 15px"; // 缩进效果
        fullContentElement.style.whiteSpace = "pre-wrap";
        fullContentElement.style.wordBreak = "break-all";
        fullContentElement.style.fontFamily = "monospace";
        fullContentElement.style.fontSize = "12px";
        fullContentElement.style.display = "none"; // 默认隐藏
        fullContentElement.style.padding = "8px";
        fullContentElement.style.backgroundColor = "#f9f9f9";
        fullContentElement.style.borderRadius = "4px";
        fullContentElement.style.border = "1px solid #e0e0e0";
        fullContentElement.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";

        // 组合元素
        valueContainer.appendChild(toggleIcon);
        valueContainer.appendChild(previewElement);
        valueContainer.appendChild(fullContentElement);

        // 切换函数
        function toggleExpand() {
          const isExpanded = fullContentElement.style.display === "block";
          if (isExpanded) {
            fullContentElement.style.display = "none";
            toggleIcon.textContent = "▶";
            toggleIcon.style.transform = "rotate(0deg)";
            toggleIcon.style.color = "#666";
          } else {
            fullContentElement.style.display = "block";
            toggleIcon.textContent = "▼";
            toggleIcon.style.transform = "rotate(180deg)";
            toggleIcon.style.color = "#2196F3";

            // 自动滚动到显示的完整内容（如果需要）
            setTimeout(() => {
              const rect = fullContentElement.getBoundingClientRect();
              if (rect.bottom > window.innerHeight) {
                fullContentElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            }, 100);
          }
        }

        // 为整个容器添加点击事件，但允许文本选择
        let lastClickTime = 0;
        valueContainer.addEventListener("click", function (e) {
          // 检查是否是文本选择操作
          const selection = monitorWindow.getSelection();
          const selectedText = selection.toString();
          if (selectedText) {
            return; // 如果有选中文本，不执行展开/收缩
          }

          // 双击也可以展开/收缩
          const currentTime = Date.now();
          const isDoubleClick = currentTime - lastClickTime < 300;
          lastClickTime = currentTime;

          toggleExpand();
        });

        // 允许直接点击图标切换
        toggleIcon.addEventListener("click", function (e) {
          e.stopPropagation(); // 阻止冒泡，避免触发两次
          toggleExpand();
        });

        return valueContainer;
      }

      Object.entries(sessionStorageData).forEach(([key, value]) => {
        const row = monitorWindow.document.createElement("tr");
        row.style.borderBottom = "1px solid #eee";
        row.addEventListener("mouseenter", () => {
          row.style.backgroundColor = "#f9f9f9";
        });
        row.addEventListener("mouseleave", () => {
          row.style.backgroundColor = "";
        });

        const keyCell = monitorWindow.document.createElement("td");
        keyCell.textContent = key;
        keyCell.style.padding = "8px";
        keyCell.style.border = "1px solid #ddd";
        keyCell.style.fontFamily = "monospace";
        keyCell.style.verticalAlign = "top";

        const valueCell = monitorWindow.document.createElement("td");
        // 使用可展开/收缩的组件
        const expandableValue = createExpandableValue(monitorWindow, value);
        valueCell.appendChild(expandableValue);
        valueCell.style.padding = "8px";
        valueCell.style.border = "1px solid #ddd";

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      contentElement.appendChild(table);
    } catch (error) {
      const contentElement = monitorWindow.document.getElementById(
        "sessionstorage-content"
      );
      contentElement.innerHTML = `<div style="color: #f44336; padding: 10px;">获取 SessionStorage 失败: ${error.message}</div>`;
    }
  }

  // 更新Cookie显示
  function updateCookieDisplay() {
    if (!monitorWindow || monitorWindow.closed) return;

    try {
      const contentElement =
        monitorWindow.document.getElementById("cookie-content");
      contentElement.innerHTML = "";

      const cookies = document.cookie.split(";");
      const cookieData = {};

      cookies.forEach((cookie) => {
        const parts = cookie.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join("=").trim();
          try {
            // 尝试解码并解析JSON
            const decodedValue = decodeURIComponent(value);
            try {
              cookieData[key] = JSON.parse(decodedValue);
            } catch (e) {
              cookieData[key] = decodedValue;
            }
          } catch (e) {
            cookieData[key] = value;
          }
        }
      });

      if (Object.keys(cookieData).length === 0) {
        contentElement.innerHTML =
          '<div style="color: #666; text-align: center; padding: 20px;">Cookie 为空</div>';
        return;
      }

      // 创建表格展示数据
      const table = monitorWindow.document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.fontSize = "13px";

      // 添加表头
      const thead = monitorWindow.document.createElement("thead");
      const headerRow = monitorWindow.document.createElement("tr");
      headerRow.style.backgroundColor = "#f5f5f5";

      const keyHeader = monitorWindow.document.createElement("th");
      keyHeader.textContent = "键";
      keyHeader.style.padding = "8px";
      keyHeader.style.border = "1px solid #ddd";
      keyHeader.style.fontWeight = "bold";

      const valueHeader = monitorWindow.document.createElement("th");
      valueHeader.textContent = "值";
      valueHeader.style.padding = "8px";
      valueHeader.style.border = "1px solid #ddd";
      valueHeader.style.fontWeight = "bold";
      valueHeader.style.width = "70%";

      headerRow.appendChild(keyHeader);
      headerRow.appendChild(valueHeader);
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // 添加数据行
      const tbody = monitorWindow.document.createElement("tbody");

      // 创建展开/收缩切换函数
      function createExpandableValue(monitorWindow, value) {
        // 判断是否为对象
        const isObject = value && typeof value === "object";

        // 获取完整值文本
        const fullValueText = isObject
          ? JSON.stringify(value, null, 2)
          : String(value);

        // 如果是对象，使用 JsonTree 显示
        if (isObject) {
          const jsonContainerId = `json-cookie-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const jsonContainer = monitorWindow.document.createElement("div");
          jsonContainer.id = jsonContainerId;
          jsonContainer.style.backgroundColor = "#f8f8f8";
          jsonContainer.style.padding = "8px";
          jsonContainer.style.borderRadius = "4px";
          jsonContainer.style.border = "1px solid #e0e0e0";

          // 初始化 JsonTree
          const initJsonTreeForCookie = () => {
            try {
              const JsonTreeClass = monitorWindow.JsonTree || (monitorWindow.window && monitorWindow.window.JsonTree);
              if (JsonTreeClass) {
                new JsonTreeClass(jsonContainer, {
                  data: value,
                  title: {
                    enableFullScreenToggling: false,
                    showFullScreenButton: false,
                  },
                  footer: {},
                  controlPanel: {
                    showMovingButtons: false,
                    showEditButton: false,
                    showImportButton: false,
                  },
                  sideMenu: {
                    enabled: false,
                  },
                });
              } else {
                // 如果 JsonTree 还没加载，等待加载完成
                const checkAndInit = setInterval(() => {
                  const JsonTreeClass = monitorWindow.JsonTree || (monitorWindow.window && monitorWindow.window.JsonTree);
                  if (JsonTreeClass) {
                    new JsonTreeClass(jsonContainer, {
                      data: value,
                      title: {
                        enableFullScreenToggling: false,
                        showFullScreenButton: false,
                      },
                      footer: {},
                      controlPanel: {
                        showMovingButtons: false,
                        showEditButton: false,
                        showImportButton: false,
                      },
                      sideMenu: {
                        enabled: false,
                      },
                    });
                    clearInterval(checkAndInit);
                  }
                }, 100);
                // 10秒后停止检查，回退到普通显示
                setTimeout(() => {
                  clearInterval(checkAndInit);
                  const preElement = monitorWindow.document.createElement("pre");
                  preElement.textContent = fullValueText;
                  preElement.style.margin = "0";
                  preElement.style.whiteSpace = "pre-wrap";
                  preElement.style.wordBreak = "break-all";
                  preElement.style.fontFamily = "monospace";
                  preElement.style.fontSize = "12px";
                  jsonContainer.innerHTML = "";
                  jsonContainer.appendChild(preElement);
                }, 10000);
              }
            } catch (e) {
              console.error("JsonTree 初始化失败:", e);
              // 如果 JsonTree 失败，回退到普通显示
              const preElement = monitorWindow.document.createElement("pre");
              preElement.textContent = fullValueText;
              preElement.style.margin = "0";
              preElement.style.whiteSpace = "pre-wrap";
              preElement.style.wordBreak = "break-all";
              preElement.style.fontFamily = "monospace";
              preElement.style.fontSize = "12px";
              jsonContainer.innerHTML = "";
              jsonContainer.appendChild(preElement);
            }
          };

          // 延迟初始化，确保 JsonTree 已加载
          setTimeout(initJsonTreeForCookie, 200);

          return jsonContainer;
        }

        // 如果内容较短（少于50个字符），直接显示，不提供展开/收缩功能
        if (fullValueText.length <= 50) {
          const simpleElement = monitorWindow.document.createElement("span");
          simpleElement.textContent = fullValueText;
          simpleElement.style.fontFamily = "monospace";
          simpleElement.style.fontSize = "12px";
          return simpleElement;
        }

        const valueContainer = monitorWindow.document.createElement("div");

        // 设置容器样式，使整个区域可点击
        valueContainer.style.cursor = "pointer";
        valueContainer.style.userSelect = "text"; // 允许文本选择
        valueContainer.onmouseenter = function () {
          this.style.backgroundColor = "#f0f0f0";
          this.style.borderRadius = "3px";
        };
        valueContainer.onmouseleave = function () {
          this.style.backgroundColor = "";
        };

        // 创建展开/收缩图标
        const toggleIcon = monitorWindow.document.createElement("span");
        toggleIcon.textContent = "▶";
        toggleIcon.style.marginRight = "5px";
        toggleIcon.style.display = "inline-block";
        toggleIcon.style.transition = "transform 0.2s, color 0.2s";
        toggleIcon.style.color = "#666";

        // 创建简短预览（最多显示80个字符）
        const previewText =
          fullValueText.length > 80
            ? fullValueText.substring(0, 80) + "..."
            : fullValueText;

        // 创建预览元素
        const previewElement = monitorWindow.document.createElement("span");
        previewElement.textContent = previewText;
        previewElement.style.fontFamily = "monospace";
        previewElement.style.fontSize = "12px";

        // 创建完整内容元素
        const fullContentElement = monitorWindow.document.createElement("pre");
        fullContentElement.textContent = fullValueText;
        fullContentElement.style.margin = "8px 0 0 15px"; // 缩进效果
        fullContentElement.style.whiteSpace = "pre-wrap";
        fullContentElement.style.wordBreak = "break-all";
        fullContentElement.style.fontFamily = "monospace";
        fullContentElement.style.fontSize = "12px";
        fullContentElement.style.display = "none"; // 默认隐藏
        fullContentElement.style.padding = "8px";
        fullContentElement.style.backgroundColor = "#f9f9f9";
        fullContentElement.style.borderRadius = "4px";
        fullContentElement.style.border = "1px solid #e0e0e0";
        fullContentElement.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";

        // 组合元素
        valueContainer.appendChild(toggleIcon);
        valueContainer.appendChild(previewElement);
        valueContainer.appendChild(fullContentElement);

        // 切换函数
        function toggleExpand() {
          const isExpanded = fullContentElement.style.display === "block";
          if (isExpanded) {
            fullContentElement.style.display = "none";
            toggleIcon.textContent = "▶";
            toggleIcon.style.transform = "rotate(0deg)";
            toggleIcon.style.color = "#666";
          } else {
            fullContentElement.style.display = "block";
            toggleIcon.textContent = "▼";
            toggleIcon.style.transform = "rotate(180deg)";
            toggleIcon.style.color = "#2196F3";

            // 自动滚动到显示的完整内容（如果需要）
            setTimeout(() => {
              const rect = fullContentElement.getBoundingClientRect();
              if (rect.bottom > window.innerHeight) {
                fullContentElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            }, 100);
          }
        }

        // 为整个容器添加点击事件，但允许文本选择
        let lastClickTime = 0;
        valueContainer.addEventListener("click", function (e) {
          // 检查是否是文本选择操作
          const selection = monitorWindow.getSelection();
          const selectedText = selection.toString();
          if (selectedText) {
            return; // 如果有选中文本，不执行展开/收缩
          }

          // 双击也可以展开/收缩
          const currentTime = Date.now();
          const isDoubleClick = currentTime - lastClickTime < 300;
          lastClickTime = currentTime;

          toggleExpand();
        });

        // 允许直接点击图标切换
        toggleIcon.addEventListener("click", function (e) {
          e.stopPropagation(); // 阻止冒泡，避免触发两次
          toggleExpand();
        });

        return valueContainer;
      }

      Object.entries(cookieData).forEach(([key, value]) => {
        const row = monitorWindow.document.createElement("tr");
        row.style.borderBottom = "1px solid #eee";
        row.addEventListener("mouseenter", () => {
          row.style.backgroundColor = "#f9f9f9";
        });
        row.addEventListener("mouseleave", () => {
          row.style.backgroundColor = "";
        });

        const keyCell = monitorWindow.document.createElement("td");
        keyCell.textContent = key;
        keyCell.style.padding = "8px";
        keyCell.style.border = "1px solid #ddd";
        keyCell.style.fontFamily = "monospace";
        keyCell.style.verticalAlign = "top";

        const valueCell = monitorWindow.document.createElement("td");
        // 使用可展开/收缩的组件
        const expandableValue = createExpandableValue(monitorWindow, value);
        valueCell.appendChild(expandableValue);
        valueCell.style.padding = "8px";
        valueCell.style.border = "1px solid #ddd";

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      contentElement.appendChild(table);
    } catch (error) {
      const contentElement =
        monitorWindow.document.getElementById("cookie-content");
      contentElement.innerHTML = `<div style="color: #f44336; padding: 10px;">获取 Cookie 失败: ${error.message}</div>`;
    }
  }

  // 更新控制台日志显示
  function updateConsoleLogs() {
    if (!monitorWindow || monitorWindow.closed) return;

    const consolePanel = monitorWindow.document.getElementById("console-panel");
    if (!consolePanel) return;

    consolePanel.innerHTML = "";

    // 限制显示最近200条日志
    const recentLogs = consoleLogs.slice(-200);

    recentLogs.forEach((log) => {
      const logElement = monitorWindow.document.createElement("div");
      logElement.className = `console-log ${log.type}`;

      // 格式化时间
      const timeSpan = monitorWindow.document.createElement("span");
      timeSpan.style.color = "#888";
      timeSpan.style.marginRight = "10px";
      timeSpan.textContent = log.timestamp;

      // 格式化日志内容
      const contentSpan = monitorWindow.document.createElement("span");
      contentSpan.textContent = log.content;

      logElement.appendChild(timeSpan);
      logElement.appendChild(contentSpan);
      consolePanel.appendChild(logElement);
    });

    // 自动滚动到底部
    consolePanel.scrollTop = consolePanel.scrollHeight;
  }

  // 获取当前域名的唯一标识
  function getDomainKey() {
    try {
      const url = new URL(window.location.href);
      // 返回域名作为键，去除www前缀（如果有）
      return url.hostname.replace(/^www\./, "");
    } catch (e) {
      console.error("获取域名失败:", e);
      return "default-domain";
    }
  }

  // 从存储恢复监控状态 - 根据当前域名
  function restoreMonitoringState() {
    const domainKey = getDomainKey();
    const savedState = GM_getValue(`apiMonitorEnabled_${domainKey}`, false);
    isMonitoring = savedState;
    console.log(`已恢复${domainKey}的监控状态:`, isMonitoring);
  }

  // 初始化用户脚本菜单
  // 配置监控关键字
  function configureMonitorKeywords() {
    const keywords = getMonitorKeywords();
    const currentKeywords = keywords.join(", ");
    const input = prompt(
      `请输入要监控的URL关键字（多个关键字用逗号分隔）：\n\n当前监控的关键字：${currentKeywords}\n\n例如：has-pss-cw-local, hsa-pss-pw`,
      currentKeywords
    );

    if (input !== null) {
      // 清理输入，移除多余空格并分割为数组
      const newKeywords = input
        .split(",")
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0);

      if (newKeywords.length > 0) {
        GM_setValue("apiMonitorKeywords", newKeywords.join(","));
        monitorKeywords = newKeywords;
        alert(`已更新监控关键字：${newKeywords.join(", ")}`);
      } else {
        alert("请至少输入一个有效的监控关键字");
      }
    }
  }

  function initializeMenu() {
    // 注册菜单项
    GM_registerMenuCommand("切换API监控", function () {
      toggleMonitoring();
    });

    // 注册配置监控关键字的菜单项
    GM_registerMenuCommand("配置监控URL关键字", function () {
      configureMonitorKeywords();
    });
  }

  // 切换监控状态 - 根据当前域名保存状态
  function toggleMonitoring() {
    const domainKey = getDomainKey();

    if (!isMonitoring) {
      // 开始监控
      isMonitoring = true;
      GM_setValue(`apiMonitorEnabled_${domainKey}`, true);
      console.log(`开始监控${domainKey}的API请求`);
      // 创建监控窗口，但尝试在后台打开
      createMonitorWindow();
      if (monitorWindow) {
        try {
          monitorWindow.blur();
          window.focus();
        } catch (e) {
          console.log("无法在后台打开窗口");
        }
      }
      startMonitoring();
      // 更新状态提示图标
      updateStatusIconVisuals();
    } else {
      // 停止监控
      isMonitoring = false;
      GM_setValue(`apiMonitorEnabled_${domainKey}`, false);
      console.log(`停止监控${domainKey}的API请求`);
      // 关闭监控窗口
      if (monitorWindow && !monitorWindow.closed) {
        monitorWindow.close();
        monitorWindow = null;
      }
      stopMonitoring();
      // 更新状态提示图标
      updateStatusIconVisuals();
    }
  }

  // 获取保存的监控关键字列表
  function getMonitorKeywords() {
    const saved = GM_getValue("apiMonitorKeywords", "");
    // 如果没有保存的关键字，使用默认值
    if (!saved) {
      const defaultKeywords = ["has-pss-cw-local", "hsa-pss-pw"];
      GM_setValue("apiMonitorKeywords", defaultKeywords.join(","));
      monitorKeywords = defaultKeywords;
      return defaultKeywords;
    }
    monitorKeywords = saved.split(",");
    return monitorKeywords;
  }

  // 检查URL是否包含任一监控关键字
  function shouldMonitorUrl(url) {
    if (typeof url !== "string") return false;
    // 如果监控关键字列表为空，获取保存的列表
    if (monitorKeywords.length === 0) {
      getMonitorKeywords();
    }
    // 检查URL是否包含任一监控关键字
    return monitorKeywords.some((keyword) => url.includes(keyword));
  }

  // 开始监控
  function startMonitoring() {
    console.log("开始监控API请求");

    // 拦截fetch请求
    window.fetch = function (url, options) {
      if (!isMonitoring) return originalFetch.apply(this, arguments);

      const shouldMonitor = shouldMonitorUrl(url);
      if (!shouldMonitor) return originalFetch.apply(this, arguments);

      const requestInfo = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        url: url,
        method: options?.method || "GET",
        timestamp: new Date().toLocaleString(),
        headers: options?.headers || {},
        requestBody: options?.body || null,
        responseBody: null,
        status: null,
        responseHeaders: null,
        duration: null,
      };

      const startTime = performance.now();

      return originalFetch
        .apply(this, arguments)
        .then((response) => {
          requestInfo.status = response.status;
          requestInfo.duration = performance.now() - startTime;

          // 克隆响应以便读取body
          const clonedResponse = response.clone();

          // 尝试解析响应体
          clonedResponse
            .json()
            .then((json) => {
              requestInfo.responseBody = json;
              addRequestToList(requestInfo);
            })
            .catch(() => {
              // 如果不是JSON，尝试作为文本读取
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
            });

          // 获取响应头
          const headers = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          requestInfo.responseHeaders = headers;

          return response;
        })
        .catch((error) => {
          requestInfo.status = "ERROR";
          // 提供更详细的错误信息
          const errorMessage = error?.message || "[未知Fetch错误]";
          requestInfo.responseBody = `[Fetch错误] ${errorMessage}`;
          requestInfo.duration = performance.now() - startTime;
          addRequestToList(requestInfo);
          // 同时将错误信息添加到控制台
          addConsoleLog("error", `Fetch错误: ${errorMessage}`, requestInfo.url);
          throw error;
        });
    };

    // 拦截XMLHttpRequest请求
    XMLHttpRequest.prototype.open = function (method, url) {
      if (isMonitoring && shouldMonitorUrl(url)) {
        this._requestInfo = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          url: url,
          method: method,
          timestamp: new Date().toLocaleString(),
          headers: {},
          requestBody: null,
          responseBody: null,
          status: null,
          responseHeaders: null,
          duration: null,
          _startTime: performance.now(),
        };

        // 拦截setRequestHeader
        const originalSetRequestHeader = this.setRequestHeader;
        this.setRequestHeader = function (header, value) {
          this._requestInfo.headers[header] = value;
          return originalSetRequestHeader.call(this, header, value);
        };

        // 监听load事件
        const originalOnload = this.onload;
        this.onload = function () {
          if (this._requestInfo) {
            this._requestInfo.status = this.status;
            this._requestInfo.duration =
              performance.now() - this._requestInfo._startTime;

            // 获取响应头
            const headers = {};
            const headerLines = this.getAllResponseHeaders().split("\r\n");
            for (let line of headerLines) {
              if (line.trim()) {
                const [key, value] = line.split(": ");
                headers[key] = value;
              }
            }
            this._requestInfo.responseHeaders = headers;

            // 尝试解析响应体
            try {
              this._requestInfo.responseBody = JSON.parse(this.responseText);
            } catch {
              try {
                this._requestInfo.responseBody = this.responseText;
              } catch {
                this._requestInfo.responseBody = "";
              }
            }

            addRequestToList(this._requestInfo);
          }

          if (originalOnload) {
            return originalOnload.apply(this, arguments);
          }
        };

        // 监听error事件
        const originalOnerror = this.onerror;
        this.onerror = function (event) {
          if (this._requestInfo) {
            this._requestInfo.status = "ERROR";
            // 捕获更详细的错误信息
            const errorMessage = event?.message || "[XHR网络错误]";
            this._requestInfo.responseBody = `[XHR错误] ${errorMessage}`;
            this._requestInfo.duration =
              performance.now() - this._requestInfo._startTime;
            addRequestToList(this._requestInfo);
            // 同时将错误信息添加到控制台
            addConsoleLog(
              "error",
              `XHR错误: ${errorMessage}`,
              this._requestInfo.url
            );
          }

          if (originalOnerror) {
            return originalOnerror.apply(this, arguments);
          }
        };
      }

      return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      if (isMonitoring && this._requestInfo) {
        this._requestInfo.requestBody = body;
      }
      return originalXHRSend.apply(this, arguments);
    };

    // 注意：控制台方法已经在脚本初始化时被拦截，这里不需要重复拦截
    // 确保控制台日志能够继续被捕获
    console.log(`监控已为${getDomainKey()}启动，控制台日志将继续被捕获`);
  }

  // 停止监控
  function stopMonitoring() {
    // 恢复原始方法
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;

    // 注意：不再恢复原始console方法，以确保始终捕获控制台日志
    // 但仍然记录停止监控的日志
    console.log(`监控已为${getDomainKey()}停止，但控制台日志仍将被捕获`);
  }

  // 添加请求到列表 - 只添加包含监控关键字的URL
  function addRequestToList(requestInfo) {
    if (shouldMonitorUrl(requestInfo.url)) {
      requestHistory.unshift(requestInfo);

      // 限制历史记录数量
      if (requestHistory.length > MAX_HISTORY_SIZE) {
        requestHistory = requestHistory.slice(0, MAX_HISTORY_SIZE);
      }

      // 保存历史记录到GM_setValue
      try {
        GM_setValue("apiRequestHistory", JSON.stringify(requestHistory));
      } catch (e) {
        console.error("保存请求历史失败:", e);
      }

      updateRequestList();
    }
  }

  // 更新请求列表UI
  function updateRequestList() {
    // 检查监控窗口是否存在且未关闭
    if (!monitorWindow || monitorWindow.closed) {
      return;
    }

    const listContainer =
      monitorWindow.document.getElementById("api-request-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    // 限制显示最近50个请求
    const recentRequests = requestHistory.slice(0, 50);

    recentRequests.forEach((request) => {
      const item = monitorWindow.document.createElement("div");
      item.className = "api-request-item";

      // 如果是当前打开的请求，添加高亮样式
      if (currentlyOpenRequestId === request.id) {
        item.style.fontWeight = "bold";
        item.style.backgroundColor = "#bbdefb";
      } else {
        // 根据状态设置颜色和图标
        if (request.status === "ERROR") {
          item.style.backgroundColor = "#ffebee";
        } else if (
          typeof request.status === "number" &&
          request.status >= 400
        ) {
          item.style.backgroundColor = "#fff8e1";
        } else if (
          typeof request.status === "number" &&
          request.status >= 200 &&
          request.status < 300
        ) {
          item.style.backgroundColor = "#e8f5e9";
        }
      }

      // 创建容器div来容纳所有元素
      const contentContainer = monitorWindow.document.createElement("div");
      contentContainer.style.display = "flex";
      contentContainer.style.alignItems = "center";

      // 添加状态图标
      const statusIcon = monitorWindow.document.createElement("span");
      if (request.status === "ERROR") {
        statusIcon.textContent = "❌";
        statusIcon.style.color = "#d32f2f";
      } else if (typeof request.status === "number" && request.status >= 400) {
        statusIcon.textContent = "⚠️";
        statusIcon.style.color = "#ff8f00";
      } else if (
        typeof request.status === "number" &&
        request.status >= 200 &&
        request.status < 300
      ) {
        statusIcon.textContent = "✅";
        statusIcon.style.color = "#388e3c";
      } else {
        statusIcon.textContent = "⏱️";
        statusIcon.style.color = "#757575";
      }
      statusIcon.style.marginRight = "5px";
      contentContainer.appendChild(statusIcon);

      // 请求时间列
      const timeColumn = monitorWindow.document.createElement("span");
      timeColumn.className = "time-column";
      timeColumn.textContent = request.timestamp;
      contentContainer.appendChild(timeColumn);

      const infoSpan = monitorWindow.document.createElement("span");
      infoSpan.textContent = `${request.method} ${getShortUrl(request.url)} (${
        request.status || "PENDING"
      })`;
      infoSpan.style.flex = "1";
      contentContainer.appendChild(infoSpan);

      const timeSpan = monitorWindow.document.createElement("span");
      timeSpan.textContent = `${
        request.duration ? Math.round(request.duration) + "ms" : ""
      }`;
      timeSpan.style.marginLeft = "10px";
      timeSpan.style.color = "#666";
      contentContainer.appendChild(timeSpan);

      // 将内容容器添加到item中
      item.appendChild(contentContainer);

      item.addEventListener("click", () => {
        showRequestDetails(request);
      });

      listContainer.appendChild(item);
    });
  }

  function getShortUrl(url) {
    // 显示完整URL，但限制长度
    // 首先检查是否存在监控关键字
    let keywordFound = false;
    let keywordStartIndex = url.length;

    // 查找第一个出现的监控关键字
    if (monitorKeywords.length > 0) {
      for (const keyword of monitorKeywords) {
        const index = url.indexOf(keyword);
        if (index !== -1 && index < keywordStartIndex) {
          keywordStartIndex = index + keyword.length;
          keywordFound = true;
        }
      }
    }

    // 如果找到了监控关键字，从关键字开始显示，这样可以突出显示相关部分
    // 但不再只显示关键字后面的部分，而是从关键字开始显示更多内容
    let displayUrl = url;
    if (keywordFound && keywordStartIndex > 0) {
      // 显示从关键字开始的部分，但限制长度
      displayUrl = url.substring(keywordStartIndex);
    }
    return displayUrl;
  }

  // 检测 base64 字符串并创建下载按钮
  function detectBase64AndCreateDownload(data, monitorWindow) {
    if (!data || typeof data !== "object") return null;

    const base64Fields = [];

    // 解析 Data URL 格式
    function parseDataUrl(dataUrl) {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return {
          mimeType: match[1],
          base64Data: match[2],
        };
      }
      return null;
    }

    // 根据 MIME 类型获取文件扩展名
    function getFileExtension(mimeType) {
      const mimeMap = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "application/pdf": "pdf",
        "application/zip": "zip",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
          "xlsx",
        "application/vnd.ms-excel": "xls",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          "docx",
        "application/msword": "doc",
        "text/plain": "txt",
        "application/json": "json",
      };
      return mimeMap[mimeType] || "bin";
    }

    // 递归查找 base64 字符串
    function findBase64(obj, path = "") {
      if (typeof obj === "string") {
        let base64Data = null;
        let mimeType = "application/octet-stream";
        let fileType = "bin";

        // 检测 Data URL 格式
        if (obj.startsWith("data:")) {
          const parsed = parseDataUrl(obj);
          if (parsed) {
            base64Data = parsed.base64Data;
            mimeType = parsed.mimeType;
            fileType = getFileExtension(mimeType);
          }
        }
        // 检测纯 base64 字符串
        else {
          const base64Regex =
            /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
          if (obj.length > 100 && base64Regex.test(obj)) {
            base64Data = obj;

            // 检测文件类型（通过 base64 头部）
            try {
              const header = obj.substring(0, 50);
              if (header.startsWith("iVBORw0KGgo")) {
                fileType = "png";
                mimeType = "image/png";
              } else if (header.startsWith("/9j/")) {
                fileType = "jpg";
                mimeType = "image/jpeg";
              } else if (header.startsWith("R0lGOD")) {
                fileType = "gif";
                mimeType = "image/gif";
              } else if (header.startsWith("UEs")) {
                fileType = "zip";
                mimeType = "application/zip";
              } else if (header.startsWith("JVBERi0")) {
                fileType = "pdf";
                mimeType = "application/pdf";
              }
            } catch (e) {
              console.error("检测文件类型失败:", e);
            }
          }
        }

        if (base64Data) {
          base64Fields.push({
            path: path || "root",
            data: base64Data,
            fileType: fileType,
            mimeType: mimeType,
            size: Math.round(base64Data.length * 0.75), // base64 解码后的大致大小
          });
        }
      } else if (typeof obj === "object" && obj !== null) {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const newPath = path ? `${path}.${key}` : key;
            findBase64(obj[key], newPath);
          }
        }
      }
    }

    findBase64(data);

    if (base64Fields.length === 0) return null;

    // 创建下载按钮容器
    const container = monitorWindow.document.createElement("div");
    container.style.marginTop = "10px";
    container.style.padding = "10px";
    container.style.backgroundColor = "#f0f8ff";
    container.style.borderRadius = "4px";
    container.style.border = "1px solid #b0d4ff";

    const title = monitorWindow.document.createElement("div");
    title.innerHTML = `<strong>检测到 ${base64Fields.length} 个 Base64 文件:</strong>`;
    title.style.marginBottom = "8px";
    container.appendChild(title);

    base64Fields.forEach((field, index) => {
      const btn = monitorWindow.document.createElement("button");
      btn.className = "base64-download-btn";

      // 判断是否可预览
      const isPreviewable = [
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
        "pdf",
      ].includes(field.fileType.toLowerCase());
      const buttonText = isPreviewable
        ? `打开 ${field.path} (${field.fileType.toUpperCase()}, ~${(
            field.size / 1024
          ).toFixed(1)}KB)`
        : `下载 ${field.path} (${field.fileType.toUpperCase()}, ~${(
            field.size / 1024
          ).toFixed(1)}KB)`;

      btn.textContent = buttonText;
      btn.onclick = function () {
        try {
          // 解码 base64
          const binaryString = atob(field.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // 创建 Blob
          const blob = new Blob([bytes], { type: field.mimeType });
          const url = URL.createObjectURL(blob);

          if (isPreviewable) {
            // 在弹窗中预览
            showFilePreviewModal(url, field.fileType, monitorWindow);
            monitorWindow.window.showMessage(`文件预览已打开`, "success");
            // 延迟释放 URL，给浏览器足够时间加载
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          } else {
            // 下载文件
            const a = monitorWindow.document.createElement("a");
            a.href = url;
            a.download = `${field.path.replace(/\./g, "_")}_${Date.now()}.${
              field.fileType
            }`;
            a.click();

            // 释放 URL
            setTimeout(() => URL.revokeObjectURL(url), 100);

            monitorWindow.window.showMessage(
              `文件下载成功: ${a.download}`,
              "success"
            );
          }
        } catch (e) {
          console.error("操作失败:", e);
          monitorWindow.window.showMessage(`操作失败: ${e.message}`, "error");
        }
      };
      container.appendChild(btn);
    });

    return container;
  }

  // 显示文件预览模态框
  function showFilePreviewModal(url, fileType, monitorWindow) {
    // 创建模态框
    let modal = monitorWindow.document.getElementById("file-preview-modal");
    if (!modal) {
      modal = monitorWindow.document.createElement("div");
      modal.id = "file-preview-modal";
      modal.className = "file-preview-modal";

      const content = monitorWindow.document.createElement("div");
      content.className = "file-preview-content";

      const closeBtn = monitorWindow.document.createElement("span");
      closeBtn.className = "file-preview-close";
      closeBtn.innerHTML = "&times;";
      closeBtn.onclick = function () {
        modal.style.display = "none";
        // 清空内容
        const container = modal.querySelector(".file-preview-container");
        if (container) {
          container.innerHTML = "";
        }
      };

      const container = monitorWindow.document.createElement("div");
      container.className = "file-preview-container";
      container.style.width = "100%";
      container.style.height = "100%";

      content.appendChild(closeBtn);
      content.appendChild(container);
      modal.appendChild(content);
      monitorWindow.document.body.appendChild(modal);

      // 点击模态框外部关闭
      modal.onclick = function (event) {
        if (event.target === modal) {
          modal.style.display = "none";
          const container = modal.querySelector(".file-preview-container");
          if (container) {
            container.innerHTML = "";
          }
        }
      };
    }

    // 清空之前的内容
    const container = modal.querySelector(".file-preview-container");
    container.innerHTML = "";

    // 根据文件类型创建预览元素
    if (fileType === "pdf") {
      const iframe = monitorWindow.document.createElement("iframe");
      iframe.className = "file-preview-iframe";
      iframe.src = url;
      container.appendChild(iframe);
    } else {
      // 图片
      const img = monitorWindow.document.createElement("img");
      img.className = "file-preview-img";
      img.src = url;
      container.appendChild(img);
    }

    // 显示模态框
    modal.style.display = "block";
  }

  // 显示请求详情
  function showRequestDetails(request) {
    // 检查监控窗口是否存在且未关闭
    if (!monitorWindow || monitorWindow.closed) {
      return;
    }

    const detailPanel =
      monitorWindow.document.getElementById("api-detail-panel");
    if (!detailPanel) return;

    // 显示详情面板
    detailPanel.style.display = "block";

    // 如果点击的是当前已打开的请求，则隐藏详情面板
    if (currentlyOpenRequestId === request.id) {
      currentlyOpenRequestId = null;
      detailPanel.style.display = "none";
      // 更新请求列表以移除高亮
      updateRequestList();
      return;
    }

    // 更新当前打开的请求ID
    currentlyOpenRequestId = request.id;
    // 更新请求列表以显示高亮
    updateRequestList();

    // 基本信息
    const basicInfo = monitorWindow.document.createElement("div");
    basicInfo.innerHTML = `
            <h3 style="display: inline-block; margin-right: 10px;">请求详情</h3><button class="copy-btn" title="复制" onclick="copyToClipboard(this.parentElement.textContent)">📄</button>
            <div><strong>时间:</strong> ${request.timestamp}</div>
            <div><strong>方法:</strong> ${request.method}</div>
            <div><strong>URL:</strong> ${request.url}</div>
            <div><strong>状态:</strong> ${request.status}</div>
            ${
              request.duration
                ? `<div><strong>耗时:</strong> ${Math.round(
                    request.duration
                  )}ms</div>`
                : ""
            }
        `;

    // 请求头
    const requestHeadersSection = monitorWindow.document.createElement("div");
    const requestHeadersData = request.headers || {};
    const requestHeadersContent = formatObject(requestHeadersData);
    const isRequestHeadersObject =
      requestHeadersData && typeof requestHeadersData === "object";
    const requestHeadersContainerId = `json-request-headers-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const requestHeadersContentId = `json-content-request-headers-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    if (isRequestHeadersObject) {
      requestHeadersSection.innerHTML = `
            <h4 style="display: inline-block; margin-right: 10px;">请求头</h4><button class="copy-btn" title="复制" onclick="copyToClipboard(document.getElementById('${requestHeadersContentId}').textContent)">📄</button>
            <div id="${requestHeadersContainerId}"></div>
            <pre id="${requestHeadersContentId}" style="display: none;">${requestHeadersContent}</pre>
        `;
    } else {
      requestHeadersSection.innerHTML = `
            <h4 style="display: inline-block; margin-right: 10px;">请求头</h4><button class="copy-btn" title="复制" onclick="copyToClipboard(this.nextElementSibling.textContent)">📄</button>
            <pre>${requestHeadersContent}</pre>
        `;
    }

    // 请求体（处理 base64 替换）
    const requestBodySection = monitorWindow.document.createElement("div");
    let requestBodyContent = formatRequestBody(request.requestBody);

    // 尝试替换 base64 为文件占位符
    let requestData = request.requestBody;
    if (typeof requestData === "string") {
      try {
        requestData = JSON.parse(requestData);
      } catch (e) {
        // 如果不是 JSON，就保持原样
      }
    }

    // 存储 base64 字段信息用于创建下载按钮
    const base64FieldsInfo = [];

    // 递归替换 base64 字符串
    function replaceBase64InRequestObject(obj) {
      if (typeof obj === "string") {
        // 检测 Data URL 或长 base64
        if (
          obj.startsWith("data:") ||
          (obj.length > 100 &&
            /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(
              obj
            ))
        ) {
          return "[Base64 文件]";
        }
        return obj;
      } else if (Array.isArray(obj)) {
        return obj.map((item) => replaceBase64InRequestObject(item));
      } else if (typeof obj === "object" && obj !== null) {
        const newObj = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            newObj[key] = replaceBase64InRequestObject(obj[key]);
          }
        }
        return newObj;
      }
      return obj;
    }

    // 判断是否为 JSON 对象，如果是则使用 JSONView 显示
    let isRequestBodyJsonObject = false;
    let requestBodyJsonData = null;
    if (requestData && typeof requestData === "object") {
      isRequestBodyJsonObject = true;
      const replacedData = replaceBase64InRequestObject(requestData);
      requestBodyJsonData = replacedData;
      requestBodyContent = JSON.stringify(replacedData, null, 2);
    }

    const requestBodyContainerId = `json-request-body-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const requestBodyContentId = `json-content-request-body-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    if (isRequestBodyJsonObject) {
      requestBodySection.innerHTML = `
            <h4 style="display: inline-block; margin-right: 10px;">请求体</h4><button class="copy-btn" title="复制" onclick="copyToClipboard(document.getElementById('${requestBodyContentId}').textContent)">📄</button>
            <div id="${requestBodyContainerId}"></div>
            <pre id="${requestBodyContentId}" style="display: none;">${requestBodyContent}</pre>
        `;
    } else {
      requestBodySection.innerHTML = `
            <h4 style="display: inline-block; margin-right: 10px;">请求体</h4><button class="copy-btn" title="复制" onclick="copyToClipboard(this.nextElementSibling.textContent)">📄</button>
            <pre>${requestBodyContent}</pre>
        `;
    }

    // 响应头
    const responseHeadersSection = monitorWindow.document.createElement("div");
    const responseHeadersData = request.responseHeaders || {};
    const responseHeadersContent = request.responseHeaders
      ? formatObject(request.responseHeaders)
      : "N/A";
    const isResponseHeadersObject =
      request.responseHeaders && typeof request.responseHeaders === "object";
    const responseHeadersContainerId = `json-response-headers-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const responseHeadersContentId = `json-content-response-headers-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    if (isResponseHeadersObject) {
      responseHeadersSection.innerHTML = `
            <h4 style="display: inline-block; margin-right: 10px;">响应头</h4><button class="copy-btn" title="复制" onclick="copyToClipboard(document.getElementById('${responseHeadersContentId}').textContent)">📄</button>
            <div id="${responseHeadersContainerId}"></div>
            <pre id="${responseHeadersContentId}" style="display: none;">${responseHeadersContent}</pre>
        `;
    } else {
      responseHeadersSection.innerHTML = `
            <h4 style="display: inline-block; margin-right: 10px;">响应头</h4><button class="copy-btn" title="复制" onclick="copyToClipboard(this.nextElementSibling.textContent)">📄</button>
            <pre>${responseHeadersContent}</pre>
        `;
    }

    // 响应体（处理 base64 替换）
    const responseBodySection = monitorWindow.document.createElement("div");
    let responseBodyContent = formatResponseBody(request.responseBody);

    // 尝试替换响应体中的 base64 为文件占位符
    let responseData = request.responseBody;
    if (typeof responseData === "string") {
      try {
        responseData = JSON.parse(responseData);
      } catch (e) {
        // 如果不是 JSON，就保持原样
      }
    }

    // 递归替换 base64 字符串（复用请求体的函数）
    function replaceBase64InObject(obj) {
      if (typeof obj === "string") {
        // 检测 Data URL 或长 base64
        if (
          obj.startsWith("data:") ||
          (obj.length > 100 &&
            /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(
              obj
            ))
        ) {
          return "[Base64 文件]";
        }
        return obj;
      } else if (Array.isArray(obj)) {
        return obj.map((item) => replaceBase64InObject(item));
      } else if (typeof obj === "object" && obj !== null) {
        const newObj = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            newObj[key] = replaceBase64InObject(obj[key]);
          }
        }
        return newObj;
      }
      return obj;
    }

    // 判断是否为 JSON 对象，如果是则使用 JSONView 显示
    let isJsonObject = false;
    let jsonDataForView = null;
    if (responseData && typeof responseData === "object") {
      isJsonObject = true;
      const replacedData = replaceBase64InObject(responseData);
      jsonDataForView = replacedData;
      responseBodyContent = JSON.stringify(replacedData, null, 2);
    }

    const jsonContainerId = `json-response-body-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const jsonContentId = `json-content-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    if (isJsonObject) {
      responseBodySection.innerHTML = `
            <h4 style="display: inline-block; margin-right: 10px;">响应体</h4><button class="copy-btn" title="复制" onclick="copyToClipboard(document.getElementById('${jsonContentId}').textContent)">📄</button>
            <div id="${jsonContainerId}"></div>
            <pre id="${jsonContentId}" style="display: none;">${responseBodyContent}</pre>
        `;
    } else {
      responseBodySection.innerHTML = `
            <h4 style="display: inline-block; margin-right: 10px;">响应体</h4><button class="copy-btn" title="复制" onclick="copyToClipboard(this.nextElementSibling.textContent)">📄</button>
            <pre>${responseBodyContent}</pre>
        `;
    }

    // 清空详情面板并添加新内容
    // 保留关闭按钮和回到顶部按钮
    const closeButton = detailPanel.querySelector("#close-detail-button");
    const backToTopBtn = detailPanel.querySelector("#back-to-top-btn");
    detailPanel.innerHTML = "";
    detailPanel.appendChild(closeButton);
    if (backToTopBtn) {
      detailPanel.appendChild(backToTopBtn);
    }

    // 添加到详情面板
    detailPanel.appendChild(basicInfo);
    detailPanel.appendChild(requestHeadersSection);
    detailPanel.appendChild(requestBodySection);

    // 检测并添加 base64 下载按钮
    try {
      let requestData = request.requestBody;
      if (typeof requestData === "string") {
        try {
          requestData = JSON.parse(requestData);
        } catch (e) {
          // 如果不是 JSON，就保持原样
        }
      }
      const base64Downloads = detectBase64AndCreateDownload(
        requestData,
        monitorWindow
      );
      if (base64Downloads) {
        detailPanel.appendChild(base64Downloads);
      }
    } catch (e) {
      console.error("检测 base64 失败:", e);
    }

    detailPanel.appendChild(responseHeadersSection);
    detailPanel.appendChild(responseBodySection);

    // 辅助函数：初始化 JsonTree
    const initJsonTree = (containerId, jsonData, fallbackContent) => {
      try {
        const jsonContainer =
          monitorWindow.document.getElementById(containerId);
        if (jsonContainer) {
          // 为容器添加背景样式
          jsonContainer.style.backgroundColor = "#f8f8f8";
          jsonContainer.style.padding = "8px";
          jsonContainer.style.borderRadius = "4px";
          jsonContainer.style.border = "1px solid #e0e0e0";

          // 初始化 JsonTree - 在 monitorWindow 的上下文中执行
          const initTree = () => {
            try {
              // 在 monitorWindow 的全局作用域中访问 JsonTree
              const JsonTreeClass = monitorWindow.JsonTree || (monitorWindow.window && monitorWindow.window.JsonTree);
              if (JsonTreeClass) {
                new JsonTreeClass(jsonContainer, {
                  data: jsonData,
                  title: {
                    enableFullScreenToggling: false,
                    showFullScreenButton: false,
                  },
                  footer: {},
                  controlPanel: {
                    showMovingButtons: false,
                    showEditButton: false,
                    showImportButton: false,
                  },
                  sideMenu: {
                    enabled: false,
                  },
                });
              } else {
                // 如果 JsonTree 还没加载，等待加载完成
                const checkAndInit = setInterval(() => {
                  const JsonTreeClass = monitorWindow.JsonTree || (monitorWindow.window && monitorWindow.window.JsonTree);
                  if (JsonTreeClass) {
                    const container =
                      monitorWindow.document.getElementById(containerId);
                    if (container) {
                      new JsonTreeClass(container, {
                        data: jsonData,
                        title: {
                          enableFullScreenToggling: false,
                          showFullScreenButton: false,
                        },
                        footer: {},
                        controlPanel: {
                          showMovingButtons: false,
                          showEditButton: false,
                          showImportButton: false,
                        },
                        sideMenu: {
                          enabled: false,
                        },
                      });
                      clearInterval(checkAndInit);
                    }
                  }
                }, 100);
                // 10秒后停止检查，回退到普通显示
                setTimeout(() => {
                  clearInterval(checkAndInit);
                  // 如果 JsonTree 仍未加载，回退到普通显示
                  const container = monitorWindow.document.getElementById(containerId);
                  if (container && fallbackContent) {
                    container.innerHTML = `<pre>${fallbackContent}</pre>`;
                  }
                }, 10000);
              }
            } catch (e) {
              console.error("JsonTree 初始化错误:", e);
              // 出错时回退到普通显示
              if (fallbackContent) {
                jsonContainer.innerHTML = `<pre>${fallbackContent}</pre>`;
              }
            }
          };

          // 延迟初始化，确保 JsonTree 已加载
          setTimeout(initTree, 200);
        }
      } catch (e) {
        console.error("JsonTree 初始化失败:", e);
        // 如果 JsonTree 失败，回退到普通显示
        const jsonContainer =
          monitorWindow.document.getElementById(containerId);
        if (jsonContainer && fallbackContent) {
          jsonContainer.innerHTML = `<pre>${fallbackContent}</pre>`;
        }
      }
    };

    // 初始化请求头的 JsonTree
    if (isRequestHeadersObject && requestHeadersData) {
      initJsonTree(
        requestHeadersContainerId,
        requestHeadersData,
        requestHeadersContent
      );
    }

    // 初始化请求体的 JsonTree
    if (isRequestBodyJsonObject && requestBodyJsonData) {
      initJsonTree(
        requestBodyContainerId,
        requestBodyJsonData,
        requestBodyContent
      );
    }

    // 初始化响应头的 JsonTree
    if (isResponseHeadersObject && responseHeadersData) {
      initJsonTree(
        responseHeadersContainerId,
        responseHeadersData,
        responseHeadersContent
      );
    }

    // 初始化响应体的 JsonTree
    if (isJsonObject && jsonDataForView) {
      initJsonTree(jsonContainerId, jsonDataForView, responseBodyContent);
    }

    // 检测并添加响应体的 base64 下载按钮
    try {
      let responseData = request.responseBody;
      if (typeof responseData === "string") {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          // 如果不是 JSON，就保持原样
        }
      }
      const responseBase64Downloads = detectBase64AndCreateDownload(
        responseData,
        monitorWindow
      );
      if (responseBase64Downloads) {
        detailPanel.appendChild(responseBase64Downloads);
      }
    } catch (e) {
      console.error("检测响应体 base64 失败:", e);
    }

    // 滚动到顶部
    detailPanel.scrollTop = 0;
  }

  // 格式化对象为字符串
  function formatObject(obj) {
    if (!obj) return "{}";
    if (typeof obj === "string") return obj;
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  // 格式化请求体
  function formatRequestBody(body) {
    if (!body) return "N/A";

    // 如果是FormData对象
    if (body instanceof FormData) {
      let result = "";
      for (let [key, value] of body.entries()) {
        result += `${key}: ${value}\n`;
      }
      return result || "FormData (empty)";
    }

    // 如果是字符串，尝试解析为JSON
    if (typeof body === "string") {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }

    // 其他情况
    return formatObject(body);
  }

  // 格式化响应体
  function formatResponseBody(body) {
    if (!body) return "N/A";

    if (typeof body === "string") {
      try {
        // 尝试解析为JSON
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }

    try {
      const jsonStr = JSON.stringify(body, null, 2);
      return jsonStr;
    } catch {
      return String(body);
    }
  }

  // 清空历史记录
  function clearHistory() {
    requestHistory = [];
    consoleLogs = []; // 清空控制台日志

    // 清除保存的历史记录
    try {
      GM_setValue("apiRequestHistory", "[]");
    } catch (e) {
      console.error("清除请求历史失败:", e);
    }

    updateRequestList();
    updateConsoleLogs(); // 更新控制台日志显示

    // 如果详情面板显示，则隐藏它
    if (monitorWindow && !monitorWindow.closed) {
      const detailPanel =
        monitorWindow.document.getElementById("api-detail-panel");
      if (detailPanel) {
        detailPanel.style.display = "none";
      }
    }

    // 重置当前打开的请求ID
    currentlyOpenRequestId = null;
    // 更新请求列表以移除高亮
    updateRequestList();
  }

  // 确保在DOM加载完成后初始化
  function initializeScript() {
    // 获取监控关键字列表
    getMonitorKeywords();

    // 从GM_getValue加载保存的请求历史记录
    try {
      const savedHistory = GM_getValue("apiRequestHistory", "[]");
      if (savedHistory) {
        requestHistory = JSON.parse(savedHistory);
        console.log(`已恢复 ${requestHistory.length} 条API请求历史记录`);
      }
    } catch (e) {
      console.error("加载请求历史失败:", e);
      requestHistory = [];
    }

    // 添加调试日志
    console.log(
      `API监控工具已加载 - 监控关键字: ${monitorKeywords.join(", ")}`
    );

    // 恢复保存的监控状态
    restoreMonitoringState();
    // 初始化菜单
    initializeMenu();

    // 始终创建状态图标
    createStatusIcon();

    // 如果之前保存的状态是开启的，恢复监控
    if (isMonitoring) {
      console.log("根据保存的状态恢复监控");
      createMonitorWindow();
      // startMonitoring函数已经包含了console方法的拦截，无需重复添加
      startMonitoring();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeScript);
  } else {
    initializeScript();
  }
})();
