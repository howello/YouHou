// ==UserScript==
// @name         API请求监控工具
// @namespace    http://howe.com
// @version      2.8.3
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
// @downloadURL  https://raw.githubusercontent.com/howello/YouHou/master/API%E8%AF%B7%E6%B1%82%E7%9B%91%E6%8E%A7%E5%B7%A5%E5%85%B7/api-monitor.user.js
// @updateURL    https://raw.githubusercontent.com/howello/YouHou/master/API%E8%AF%B7%E6%B1%82%E7%9B%91%E6%8E%A7%E5%B7%A5%E5%85%B7/api-monitor.meta.js
// ==/UserScript==

(function () {
  ("use strict");

  // API请求历史记录
  let requestHistory = [];
  // 历史记录最大保存数量
  const MAX_HISTORY_SIZE = 100;
  // 列表/控制台 DOM 显示上限（内存历史另计）
  const REQUEST_LIST_VIEW_MAX = 50;
  const CONSOLE_VIEW_MAX = 200;
  const CONSOLE_MEM_MAX = 500;
  // 历史落盘 debounce 与大 body 截断（仅磁盘；内存保留完整 body）
  const HISTORY_PERSIST_DEBOUNCE_MS = 800;
  const BODY_PERSIST_MAX_CHARS = 51200;
  // Base64 DFS 扫描上限
  const BASE64_MAX_DEPTH = 8;
  const BASE64_MAX_FIELDS = 200;
  const BASE64_MIN_LEN = 100;
  let historyPersistTimer = null;
  // 是否开始监控
  let isMonitoring = false;
  // 原始fetch和XMLHttpRequest方法
  let originalFetch = window.fetch;
  let originalXHROpen = XMLHttpRequest.prototype.open;
  let originalXHRSend = XMLHttpRequest.prototype.send;
  // 控制台日志历史
  let consoleLogs = [];
  // 控制台日志短窗口去重（type+content，约 50ms）
  let lastConsoleDedupKey = "";
  let lastConsoleDedupAt = 0;
  const CONSOLE_DEDUP_MS = 50;
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

  // ========== 浏览器端 SM4 ECB（兼容 gm-crypt 字符串密钥 + base64） ==========
  const SM4_SBOX = [
    0xd6, 0x90, 0xe9, 0xfe, 0xcc, 0xe1, 0x3d, 0xb7, 0x16, 0xb6, 0x14, 0xc2, 0x28, 0xfb, 0x2c, 0x05,
    0x2b, 0x67, 0x9a, 0x76, 0x2a, 0xbe, 0x04, 0xc3, 0xaa, 0x44, 0x13, 0x26, 0x49, 0x86, 0x06, 0x99,
    0x9c, 0x42, 0x50, 0xf4, 0x91, 0xef, 0x98, 0x7a, 0x33, 0x54, 0x0b, 0x43, 0xed, 0xcf, 0xac, 0x62,
    0xe4, 0xb3, 0x1c, 0xa9, 0xc9, 0x08, 0xe8, 0x95, 0x80, 0xdf, 0x94, 0xfa, 0x75, 0x8f, 0x3f, 0xa6,
    0x47, 0x07, 0xa7, 0xfc, 0xf3, 0x73, 0x17, 0xba, 0x83, 0x59, 0x3c, 0x19, 0xe6, 0x85, 0x4f, 0xa8,
    0x68, 0x6b, 0x81, 0xb2, 0x71, 0x64, 0xda, 0x8b, 0xf8, 0xeb, 0x0f, 0x4b, 0x70, 0x56, 0x9d, 0x35,
    0x1e, 0x24, 0x0e, 0x5e, 0x63, 0x58, 0xd1, 0xa2, 0x25, 0x22, 0x7c, 0x3b, 0x01, 0x21, 0x78, 0x87,
    0xd4, 0x00, 0x46, 0x57, 0x9f, 0xd3, 0x27, 0x52, 0x4c, 0x36, 0x02, 0xe7, 0xa0, 0xc4, 0xc8, 0x9e,
    0xea, 0xbf, 0x8a, 0xd2, 0x40, 0xc7, 0x38, 0xb5, 0xa3, 0xf7, 0xf2, 0xce, 0xf9, 0x61, 0x15, 0xa1,
    0xe0, 0xae, 0x5d, 0xa4, 0x9b, 0x34, 0x1a, 0x55, 0xad, 0x93, 0x32, 0x30, 0xf5, 0x8c, 0xb1, 0xe3,
    0x1d, 0xf6, 0xe2, 0x2e, 0x82, 0x66, 0xca, 0x60, 0xc0, 0x29, 0x23, 0xab, 0x0d, 0x53, 0x4e, 0x6f,
    0xd5, 0xdb, 0x37, 0x45, 0xde, 0xfd, 0x8e, 0x2f, 0x03, 0xff, 0x6a, 0x72, 0x6d, 0x6c, 0x5b, 0x51,
    0x8d, 0x1b, 0xaf, 0x92, 0xbb, 0xdd, 0xbc, 0x7f, 0x11, 0xd9, 0x5c, 0x41, 0x1f, 0x10, 0x5a, 0xd8,
    0x0a, 0xc1, 0x31, 0x88, 0xa5, 0xcd, 0x7b, 0xbd, 0x2d, 0x74, 0xd0, 0x12, 0xb8, 0xe5, 0xb4, 0xb0,
    0x89, 0x69, 0x97, 0x4a, 0x0c, 0x96, 0x77, 0x7e, 0x65, 0xb9, 0xf1, 0x09, 0xc5, 0x6e, 0xc6, 0x84,
    0x18, 0xf0, 0x7d, 0xec, 0x3a, 0xdc, 0x4d, 0x20, 0x79, 0xee, 0x5f, 0x3e, 0xd7, 0xcb, 0x39, 0x48,
  ];
  const SM4_FK = [0xa3b1bac6, 0x56aa3350, 0x677d9197, 0xb27022dc];
  const SM4_CK = [
    0x00070e15, 0x1c232a31, 0x383f464d, 0x545b6269, 0x70777e85, 0x8c939aa1, 0xa8afb6bd, 0xc4cbd2d9,
    0xe0e7eef5, 0xfc030a11, 0x181f262d, 0x343b4249, 0x50575e65, 0x6c737a81, 0x888f969d, 0xa4abb2b9,
    0xc0c7ced5, 0xdce3eaf1, 0xf8ff060d, 0x141b2229, 0x30373e45, 0x4c535a61, 0x686f767d, 0x848b9299,
    0xa0a7aeb5, 0xbcc3cad1, 0xd8dfe6ed, 0xf4fb0209, 0x10171e25, 0x2c333a41, 0x484f565d, 0x646b7279,
  ];

  function sm4Rotl(x, n) {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
  }
  function sm4Tau(a) {
    return (
      ((SM4_SBOX[(a >>> 24) & 0xff] << 24) |
        (SM4_SBOX[(a >>> 16) & 0xff] << 16) |
        (SM4_SBOX[(a >>> 8) & 0xff] << 8) |
        SM4_SBOX[a & 0xff]) >>>
      0
    );
  }
  function sm4L(b) {
    return (b ^ sm4Rotl(b, 2) ^ sm4Rotl(b, 10) ^ sm4Rotl(b, 18) ^ sm4Rotl(b, 24)) >>> 0;
  }
  function sm4LPrime(b) {
    return (b ^ sm4Rotl(b, 13) ^ sm4Rotl(b, 23)) >>> 0;
  }
  function sm4KeyBytesFromString(keyStr) {
    const key = new Uint8Array(16);
    const s = String(keyStr || "");
    for (let i = 0; i < 16; i++) {
      key[i] = i < s.length ? s.charCodeAt(i) & 0xff : 0;
    }
    return key;
  }
  function sm4ExpandKey(keyBytes) {
    const MK = new Array(4);
    for (let i = 0; i < 4; i++) {
      MK[i] =
        ((keyBytes[4 * i] << 24) |
          (keyBytes[4 * i + 1] << 16) |
          (keyBytes[4 * i + 2] << 8) |
          keyBytes[4 * i + 3]) >>>
        0;
    }
    const K = new Array(36);
    K[0] = (MK[0] ^ SM4_FK[0]) >>> 0;
    K[1] = (MK[1] ^ SM4_FK[1]) >>> 0;
    K[2] = (MK[2] ^ SM4_FK[2]) >>> 0;
    K[3] = (MK[3] ^ SM4_FK[3]) >>> 0;
    const rk = new Array(32);
    for (let i = 0; i < 32; i++) {
      K[i + 4] = (K[i] ^ sm4LPrime(sm4Tau(K[i + 1] ^ K[i + 2] ^ K[i + 3] ^ SM4_CK[i]))) >>> 0;
      rk[i] = K[i + 4];
    }
    return rk;
  }
  function sm4OneBlock(input, rk, encrypt) {
    const X = new Array(36);
    for (let i = 0; i < 4; i++) {
      X[i] =
        ((input[4 * i] << 24) |
          (input[4 * i + 1] << 16) |
          (input[4 * i + 2] << 8) |
          input[4 * i + 3]) >>>
        0;
    }
    for (let i = 0; i < 32; i++) {
      const rki = encrypt ? rk[i] : rk[31 - i];
      X[i + 4] = (X[i] ^ sm4L(sm4Tau(X[i + 1] ^ X[i + 2] ^ X[i + 3] ^ rki))) >>> 0;
    }
    const out = new Uint8Array(16);
    for (let i = 0; i < 4; i++) {
      const v = X[35 - i];
      out[4 * i] = (v >>> 24) & 0xff;
      out[4 * i + 1] = (v >>> 16) & 0xff;
      out[4 * i + 2] = (v >>> 8) & 0xff;
      out[4 * i + 3] = v & 0xff;
    }
    return out;
  }
  function sm4Pkcs7Pad(data) {
    const pad = 16 - (data.length % 16);
    const out = new Uint8Array(data.length + pad);
    out.set(data);
    for (let i = data.length; i < out.length; i++) out[i] = pad;
    return out;
  }
  function sm4Pkcs7Unpad(data) {
    if (!data.length || data.length % 16 !== 0) {
      throw new Error("SM4 解密数据长度非法");
    }
    const pad = data[data.length - 1];
    if (pad < 1 || pad > 16) throw new Error("SM4 PKCS7 填充非法");
    for (let i = data.length - pad; i < data.length; i++) {
      if (data[i] !== pad) throw new Error("SM4 PKCS7 填充校验失败");
    }
    return data.subarray(0, data.length - pad);
  }
  function utf8ToBytes(str) {
    return new TextEncoder().encode(String(str));
  }
  function bytesToUtf8(bytes) {
    return new TextDecoder().decode(bytes);
  }
  function bytesToBase64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function hexToBytes(hex) {
    const clean = String(hex || "").replace(/\s+/g, "");
    if (clean.length % 2 !== 0) throw new Error("十六进制长度必须为偶数");
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  }
  function bytesToHex(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) {
      s += ("0" + (bytes[i] & 0xff).toString(16)).slice(-2);
    }
    return s;
  }
  function sm4EcbCrypt(keyStr, dataBytes, encrypt) {
    const rk = sm4ExpandKey(sm4KeyBytesFromString(keyStr));
    const out = new Uint8Array(dataBytes.length);
    for (let off = 0; off < dataBytes.length; off += 16) {
      const block = dataBytes.subarray(off, off + 16);
      out.set(sm4OneBlock(block, rk, encrypt), off);
    }
    return out;
  }
  function sm4EncryptToBase64(keyStr, plainText) {
    const padded = sm4Pkcs7Pad(utf8ToBytes(plainText));
    return bytesToBase64(sm4EcbCrypt(keyStr, padded, true));
  }
  function sm4DecryptFromBase64(keyStr, cipherBase64) {
    const raw = base64ToBytes(cipherBase64);
    if (raw.length % 16 !== 0) throw new Error("SM4 密文长度非法");
    return bytesToUtf8(sm4Pkcs7Unpad(sm4EcbCrypt(keyStr, raw, false)));
  }

  // ========== HseEncAndDecUtil（浏览器移植，decryptResponseMsg） ==========
  const HseEncAndDecUtil = {
    CHNL_ID: "",
    SM4_KEY: "",
    PRV_KEY: "",
    PUB_KEY: "",
    PLAF_PUB_KEY: "",
    version: "1.0.0",
    encType: "SM4",
    signType: "SM2",
    appId: "",
    prvkey: "",
    sm4key: "",
    pubKey: "",
    plafPrvkey: "",
    plafPubKey: "",

    extractEvenPositions(str) {
      if (!str) return "";
      let result = "";
      for (let i = 1; i < str.length; i += 2) {
        result += str[i];
      }
      return result;
    },

    sm4Decrypt(chnlId, sm4key, data) {
      const chnlIdPrefix = this.extractEvenPositions(chnlId);
      if (!chnlIdPrefix || chnlIdPrefix.length < 1) {
        throw new Error("渠道 ID 派生密钥为空，请检查 CHNL_ID 配置");
      }
      // 1) 用渠道偶数位作 key，加密 sm4key → base64
      const appSecretEncData = sm4EncryptToBase64(chnlIdPrefix, sm4key);
      // 2) base64→hex 大写，取前 16 字符作最终密钥
      const decodedEncData = base64ToBytes(appSecretEncData);
      const hexString = bytesToHex(decodedEncData).toUpperCase();
      const finalKey = hexString.substring(0, 16);
      // 3) encData(hex) → base64，再用 finalKey 解密
      const encryptedBytes = hexToBytes(data);
      const encryptedBase64 = bytesToBase64(encryptedBytes);
      return sm4DecryptFromBase64(finalKey, encryptedBase64);
    },

    decryptResponseMsg(responseMsg) {
      if (!responseMsg || typeof responseMsg !== "object") {
        throw new Error("密文对象无效");
      }
      const encData = responseMsg.encData;
      const type = responseMsg.type;
      const code = responseMsg.code;
      const message = responseMsg.message;
      if (!encData || typeof encData !== "string") {
        throw new Error("缺少 encData 字段");
      }
      if (!this.CHNL_ID || !this.SM4_KEY) {
        throw new Error("请先在菜单中配置 CHNL_ID 与 SM4_KEY");
      }
      // 签名验证：当前与工具类一致，SM2 跳过；无专业库时不阻断解密
      const decryptedJson = this.sm4Decrypt(this.CHNL_ID, this.SM4_KEY, encData);
      let data;
      try {
        data = JSON.parse(decryptedJson);
      } catch (e) {
        // 明文非 JSON 时原样返回字符串
        data = decryptedJson;
      }
      return { code: code, message: message, type: type, data: data };
    },
  };

  const DECRYPT_CONFIG_STORAGE_KEY = "apiMonitorDecryptConfig";
  const DEFAULT_DECRYPT_CONFIG = {
    chnlId: "",
    sm4Key: "",
    prvKey: "",
    pubKey: "",
    plafPubKey: "",
    version: "1.0.0",
    encType: "SM4",
    signType: "SM2",
    appId: "",
  };

  function getDecryptConfig() {
    try {
      const raw = GM_getValue(DECRYPT_CONFIG_STORAGE_KEY, "");
      if (!raw) return Object.assign({}, DEFAULT_DECRYPT_CONFIG);
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Object.assign({}, DEFAULT_DECRYPT_CONFIG, parsed || {});
    } catch (e) {
      return Object.assign({}, DEFAULT_DECRYPT_CONFIG);
    }
  }

  function saveDecryptConfig(cfg) {
    const next = Object.assign({}, DEFAULT_DECRYPT_CONFIG, cfg || {});
    GM_setValue(DECRYPT_CONFIG_STORAGE_KEY, JSON.stringify(next));
    applyDecryptConfig(next);
    return next;
  }

  function applyDecryptConfig(cfg) {
    const c = cfg || getDecryptConfig();
    HseEncAndDecUtil.CHNL_ID = c.chnlId || "";
    HseEncAndDecUtil.SM4_KEY = c.sm4Key || "";
    HseEncAndDecUtil.PRV_KEY = c.prvKey || "";
    HseEncAndDecUtil.PUB_KEY = c.pubKey || "";
    HseEncAndDecUtil.PLAF_PUB_KEY = c.plafPubKey || "";
    HseEncAndDecUtil.version = c.version || "1.0.0";
    HseEncAndDecUtil.encType = c.encType || "SM4";
    HseEncAndDecUtil.signType = c.signType || "SM2";
    HseEncAndDecUtil.appId = c.appId || "";
    HseEncAndDecUtil.prvkey = c.prvKey || "";
    HseEncAndDecUtil.sm4key = c.sm4Key || "";
    HseEncAndDecUtil.pubKey = c.pubKey || "";
    HseEncAndDecUtil.plafPubKey = c.plafPubKey || "";
  }

  function openSettingsDialog() {
    const existing = document.getElementById("api-monitor-settings-overlay");
    if (existing) existing.remove();

    const cfg = getDecryptConfig();
    const keywords = getMonitorKeywords();
    const overlay = document.createElement("div");
    overlay.id = "api-monitor-settings-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;";

    const panel = document.createElement("div");
    panel.style.cssText =
      "width:min(460px,92vw);background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.25);padding:18px 20px;";

    const title = document.createElement("h3");
    title.textContent = "设置";
    title.style.cssText = "margin:0 0 14px;font-size:16px;color:#222;";
    panel.appendChild(title);

    const fieldStyle =
      "width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;font-family:ui-monospace,Consolas,monospace;outline:none;";
    const labelStyle =
      "display:block;font-size:12px;font-weight:600;color:#333;margin-bottom:5px;";
    const sectionTitleStyle =
      "margin:0 0 8px;font-size:13px;font-weight:600;color:#1565c0;padding-bottom:6px;border-bottom:1px solid #eef2f7;";
    const hintStyle = "color:#666;font-size:12px;margin:0 0 10px;line-height:1.5;";

    function bindFocus(el) {
      el.addEventListener("focus", () => {
        el.style.borderColor = "#2196F3";
        el.style.boxShadow = "0 0 0 3px rgba(33,150,243,0.15)";
      });
      el.addEventListener("blur", () => {
        el.style.borderColor = "#d0d5dd";
        el.style.boxShadow = "none";
      });
    }

    // —— 监控 URL 关键字 ——
    const kwSection = document.createElement("div");
    kwSection.style.cssText = "margin-bottom:16px;";
    const kwTitle = document.createElement("div");
    kwTitle.textContent = "监控 URL 关键字";
    kwTitle.style.cssText = sectionTitleStyle;
    kwSection.appendChild(kwTitle);
    const kwHint = document.createElement("div");
    kwHint.textContent = "多个关键字用英文逗号分隔，URL 包含任一关键字时才会被监控。";
    kwHint.style.cssText = hintStyle;
    kwSection.appendChild(kwHint);
    const kwLab = document.createElement("label");
    kwLab.textContent = "关键字";
    kwLab.style.cssText = labelStyle;
    const keywordsInput = document.createElement("input");
    keywordsInput.type = "text";
    keywordsInput.placeholder = "例如：has-pss-cw-local, hsa-pss-pw";
    keywordsInput.value = keywords.join(", ");
    keywordsInput.spellcheck = false;
    keywordsInput.autocomplete = "off";
    keywordsInput.style.cssText = fieldStyle;
    bindFocus(keywordsInput);
    kwSection.appendChild(kwLab);
    kwSection.appendChild(keywordsInput);
    panel.appendChild(kwSection);

    // —— 解密参数 ——
    const decSection = document.createElement("div");
    decSection.style.cssText = "margin-bottom:4px;";
    const decTitle = document.createElement("div");
    decTitle.textContent = "解密参数";
    decTitle.style.cssText = sectionTitleStyle;
    decSection.appendChild(decTitle);
    const decHint = document.createElement("div");
    decHint.textContent = "用于解密请求/响应体中的 encData，参数保存在本地。";
    decHint.style.cssText = hintStyle;
    decSection.appendChild(decHint);

    const fields = [
      { key: "chnlId", label: "CHNL_ID", placeholder: "渠道 ID" },
      { key: "sm4Key", label: "SM4_KEY", placeholder: "SM4 密钥" },
    ];
    const inputs = {};
    fields.forEach((f) => {
      const row = document.createElement("div");
      row.style.cssText = "margin-bottom:12px;";
      const lab = document.createElement("label");
      lab.textContent = f.label;
      lab.style.cssText = labelStyle;
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = f.placeholder || "";
      input.value = cfg[f.key] != null ? String(cfg[f.key]) : "";
      input.spellcheck = false;
      input.autocomplete = "off";
      input.style.cssText = fieldStyle;
      bindFocus(input);
      row.appendChild(lab);
      row.appendChild(input);
      decSection.appendChild(row);
      inputs[f.key] = input;
    });
    panel.appendChild(decSection);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:16px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "取消";
    cancelBtn.style.cssText =
      "padding:7px 16px;border:1px solid #d0d5dd;border-radius:6px;background:#f7f8fa;cursor:pointer;font-size:13px;";
    cancelBtn.onclick = () => overlay.remove();

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "保存";
    saveBtn.style.cssText =
      "padding:7px 16px;border:none;border-radius:6px;background:#2196F3;color:#fff;cursor:pointer;font-size:13px;";
    saveBtn.onclick = () => {
      const newKeywords = keywordsInput.value
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      if (newKeywords.length === 0) {
        alert("请至少输入一个监控 URL 关键字");
        keywordsInput.focus();
        return;
      }

      const chnlId = inputs.chnlId.value.trim();
      const sm4Key = inputs.sm4Key.value.trim();
      // 解密参数允许留空（未启用解密时）；若填了一个必须两个都填
      if ((chnlId && !sm4Key) || (!chnlId && sm4Key)) {
        alert("CHNL_ID 与 SM4_KEY 需同时填写，或同时留空");
        return;
      }

      GM_setValue("apiMonitorKeywords", newKeywords.join(","));
      monitorKeywords = newKeywords;

      const next = Object.assign({}, getDecryptConfig(), {
        chnlId: chnlId,
        sm4Key: sm4Key,
      });
      saveDecryptConfig(next);

      overlay.remove();
      alert("设置已保存");
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.documentElement.appendChild(overlay);
  }

  function parseBodyObject(body) {
    if (body == null) return null;
    if (typeof body === "object") return body;
    if (typeof body === "string") {
      try {
        return JSON.parse(body);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * 从请求/响应体提取含 encData 的解密载荷。
   * - 请求体常见：顶层 { encData, signData, ... }
   * - 响应体常见：{ code, message, type, data: { encData, signData, ... } }
   * 返回 { payload, envelope }：
   *   payload  — 传给 decryptResponseMsg 的对象（必须含 encData）
   *   envelope — 外层包装（若有），解密后用于拼回完整结构展示
   */
  function extractEncPayload(body) {
    const obj = parseBodyObject(body);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;

    // 1) 顶层 encData（请求体）
    if (typeof obj.encData === "string" && obj.encData.length > 0) {
      return { payload: obj, envelope: null };
    }

    // 2) res.data.encData（响应体）
    if (
      obj.data &&
      typeof obj.data === "object" &&
      !Array.isArray(obj.data) &&
      typeof obj.data.encData === "string" &&
      obj.data.encData.length > 0
    ) {
      return { payload: obj.data, envelope: obj };
    }

    return null;
  }

  function hasEncPayload(source) {
    return !!(source && source.payload && typeof source.payload.encData === "string");
  }

  function formatDecryptedDisplay(source, decrypted) {
    // 嵌套响应：保留外层 code/message/type，data 换成解密结果
    if (source && source.envelope) {
      const outer = source.envelope;
      return {
        code: outer.code,
        type: outer.type,
        message: outer.message,
        data: decrypted,
      };
    }
    return decrypted;
  }

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
        // 处理异常对象，即使不是Error实例
        if (arg && typeof arg === "object" && (arg.message || arg.stack || arg.name)) {
          const name = arg.name || "Object";
          const message = arg.message || "";
          const stack = arg.stack || "";
          if (stack) {
            return `${name}: ${message}\n${stack}`;
          } else if (message) {
            return `${name}: ${message}`;
          }
        }
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            try {
              const seen = new WeakSet();
              return JSON.stringify(arg, (key, value) => {
                if (typeof value === "object" && value !== null) {
                  if (seen.has(value)) {
                    return "[Circular]";
                  }
                  seen.add(value);
                }
                return value;
              }, 2);
            } catch (e2) {
              return String(arg);
            }
          }
        }
        return String(arg);
      })
      .join(" ");

    const dedupKey = type + "\0" + content;
    const now = Date.now();
    if (dedupKey === lastConsoleDedupKey && now - lastConsoleDedupAt < CONSOLE_DEDUP_MS) {
      return;
    }
    lastConsoleDedupKey = dedupKey;
    lastConsoleDedupAt = now;

    consoleLogs.push({ type, timestamp, content });

    // 限制日志数量（环形缓冲：shift 循环，禁止 splice 大展开）
    while (consoleLogs.length > CONSOLE_MEM_MAX) {
      consoleLogs.shift();
    }

    // 增量追加显示（仅在 monitorWindow 可用时更新；全量重建见 updateConsoleLogs）
    try {
      if (typeof monitorWindow !== "undefined" && monitorWindow && !monitorWindow.closed) {
        setTimeout(() => {
          appendConsoleLogEntry({ type, timestamp, content });
        }, 0);
      }
    } catch (e) {
    }
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

    // 拦截 trace 方法以捕获堆栈跟踪
    console.trace = function (...args) {
      addConsoleLog("trace", ...args);
      originalConsole.trace.apply(console, args);
    };

    // 拦截其他控制台方法
    if (originalConsole.table) {
      console.table = function (...args) {
        addConsoleLog("table", ...args);
        originalConsole.table.apply(console, args);
      };
    }

    if (originalConsole.time) {
      console.time = function (...args) {
        addConsoleLog("time", ...args);
        originalConsole.time.apply(console, args);
      };
    }

    if (originalConsole.timeEnd) {
      console.timeEnd = function (...args) {
        addConsoleLog("timeEnd", ...args);
        originalConsole.timeEnd.apply(console, args);
      };
    }

    if (originalConsole.timeLog) {
      console.timeLog = function (...args) {
        addConsoleLog("timeLog", ...args);
        originalConsole.timeLog.apply(console, args);
      };
    }

    if (originalConsole.count) {
      console.count = function (...args) {
        addConsoleLog("count", ...args);
        originalConsole.count.apply(console, args);
      };
    }

    if (originalConsole.countReset) {
      console.countReset = function (...args) {
        addConsoleLog("countReset", ...args);
        originalConsole.countReset.apply(console, args);
      };
    }

    if (originalConsole.group) {
      console.group = function (...args) {
        addConsoleLog("group", ...args);
        originalConsole.group.apply(console, args);
      };
    }

    if (originalConsole.groupCollapsed) {
      console.groupCollapsed = function (...args) {
        addConsoleLog("groupCollapsed", ...args);
        originalConsole.groupCollapsed.apply(console, args);
      };
    }

    if (originalConsole.groupEnd) {
      console.groupEnd = function (...args) {
        addConsoleLog("groupEnd", ...args);
        originalConsole.groupEnd.apply(console, args);
      };
    }

    if (originalConsole.clear) {
      console.clear = function (...args) {
        addConsoleLog("clear", ...args);
        originalConsole.clear.apply(console, args);
      };
    }

    if (originalConsole.assert) {
      console.assert = function (...args) {
        addConsoleLog("assert", ...args);
        originalConsole.assert.apply(console, args);
      };
    }

    if (originalConsole.dir) {
      console.dir = function (...args) {
        addConsoleLog("dir", ...args);
        originalConsole.dir.apply(console, args);
      };
    }

    if (originalConsole.dirxml) {
      console.dirxml = function (...args) {
        addConsoleLog("dirxml", ...args);
        originalConsole.dirxml.apply(console, args);
      };
    }

    if (originalConsole.profile) {
      console.profile = function (...args) {
        addConsoleLog("profile", ...args);
        originalConsole.profile.apply(console, args);
      };
    }

    if (originalConsole.profileEnd) {
      console.profileEnd = function (...args) {
        addConsoleLog("profileEnd", ...args);
        originalConsole.profileEnd.apply(console, args);
      };
    }

    if (originalConsole.timeStamp) {
      console.timeStamp = function (...args) {
        addConsoleLog("timeStamp", ...args);
        originalConsole.timeStamp.apply(console, args);
      };
    }
  })();

  // 注入脚本以捕获页面主上下文（Main World）的控制台日志
  // 解决沙箱隔离导致无法捕获页面脚本（如Vue、ElementUI）产生的日志的问题
  (function injectConsoleInterceptor() {
    try {
      const scriptContent = `
        (function() {
          // 防止重复注入
          if (window.__api_monitor_intercepted) return;
          window.__api_monitor_intercepted = true;
          
          const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
          };

          // 格式化参数为字符串，处理循环引用和Error对象
          function formatArgs(args) {
            return args.map(arg => {
              try {
                if (arg === null) return "null";
                if (arg === undefined) return "undefined";
                if (arg instanceof Error) {
                  return arg.name + ": " + arg.message + (arg.stack ? "\\n" + arg.stack : "");
                }
                // 处理类似Error的对象
                if (arg && typeof arg === "object" && (arg.message || arg.stack || arg.name)) {
                   const name = arg.name || "Object";
                   const message = arg.message || "";
                   const stack = arg.stack || "";
                   if (stack) return name + ": " + message + "\\n" + stack;
                   if (message) return name + ": " + message;
                }
                if (typeof arg === "object") {
                  const seen = new WeakSet();
                  return JSON.stringify(arg, (key, value) => {
                    if (typeof value === "object" && value !== null) {
                      if (seen.has(value)) return "[Circular]";
                      seen.add(value);
                    }
                    return value;
                  }, 2);
                }
                return String(arg);
              } catch (e) {
                return String(arg);
              }
            }).join(" ");
          }

          // 拦截指定的控制台方法
          function intercept(type) {
            if (!originalConsole[type]) return;
            console[type] = function(...args) {
              try {
                // 格式化日志内容
                let content = formatArgs(args);
                
                // 尝试获取堆栈信息并添加到日志中
                try {
                  const err = new Error();
                  if (err.stack) {
                    // stack format usually:
                    // Error
                    //    at console.warn (<anonymous>:...)
                    //    at <user_code>
                    const lines = err.stack.split('\\n');
                    // Skip the first line (Error) and the second line (this interceptor function)
                    // We want to show where the log actually happened
                    if (lines.length > 2) {
                       // Find the first line that is NOT from our interceptor code
                       // Since this is an injected script, identifying "our" code might be tricky 
                       // but generally simply skipping the top frames is enough.
                       // We append the stack trace starting from the caller
                       const callerStack = lines.slice(2).join('\\n');
                       if (callerStack) {
                         content += '\\n\\n[Stack Trace]\\n' + callerStack;
                       }
                    }
                  }
                } catch (stackErr) {
                  // ignore stack capture errors
                }

                // 发送自定义事件给用户脚本
                window.dispatchEvent(new CustomEvent('api-monitor-console-log', {
                  detail: { type, content }
                }));
              } catch (e) {
                // 忽略错误，防止破坏应用
              }
              // 调用原始方法
              originalConsole[type].apply(console, args);
            };
          }

          ['log', 'error', 'warn', 'info', 'debug'].forEach(intercept);
        })();
      `;

      const script = document.createElement('script');
      script.textContent = scriptContent;
      (document.head || document.documentElement).appendChild(script);
      script.remove(); // 执行后移除标签

      // 监听来自页面上下文的日志事件
      window.addEventListener('api-monitor-console-log', function(e) {
        if (e.detail) {
          addConsoleLog(e.detail.type, e.detail.content);
        }
      });

    } catch (e) {
      console.error('注入控制台拦截脚本失败:', e);
    }
  })();

  // 捕获未处理的异常
  window.addEventListener('error', function(event) {
    addConsoleLog('error', `Uncaught Error: ${event.message}\n${event.filename}:${event.lineno}:${event.colno}\nSTACK: ${event.error?.stack || 'No stack trace'}`);
  });

  // 捕获未处理的Promise拒绝
  window.addEventListener('unhandledrejection', function(event) {
    addConsoleLog('error', `Unhandled Promise Rejection: ${event.reason || 'Unknown reason'}\nSTACK: ${event.reason?.stack || 'No stack trace'}`);
  });

  // 捕获资源加载错误
  window.addEventListener('load', function() {
    // 使用 PerformanceObserver 捕获资源加载问题
    if (window.PerformanceObserver) {
      const perfObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            // 检查资源加载时间过长的情况
            if (entry.duration > 5000) { // 超过5秒的资源加载
              addConsoleLog('warn', `Slow Resource Loading: ${entry.name} took ${Math.round(entry.duration)}ms`);
            }

            // 检查资源加载错误
            if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
              addConsoleLog('error', `Resource Failed to Load: ${entry.name}`);
            }
          } else if (entry.entryType === 'navigation') {
            // 检查页面加载性能问题
            if (entry.loadEventEnd - entry.fetchStart > 10000) { // 页面加载超过10秒
              addConsoleLog('warn', `Slow Page Load: took ${Math.round(entry.loadEventEnd - entry.fetchStart)}ms`);
            }
          }
        });
      });

      try {
        perfObserver.observe({entryTypes: ['resource', 'navigation']});
      } catch(e) {
        console.warn('Could not start PerformanceObserver:', e.message);
      }
    }
  });

  // 监听资源加载错误
  window.addEventListener('error', function(event) {
    if (event.target !== window) {
      // 这是一个资源加载错误（如图片、脚本、样式表等）
      addConsoleLog('error', `Resource Load Error: ${event.target.localName || 'Unknown'} - ${event.target.src || event.target.href || 'Unknown source'}`);
    }
  }, true);  // 使用捕获阶段

  // 全局变量用于存储监控窗口
  let monitorWindow = null;

  // 提前定义并初始化监控窗口相关变量，防止在初始化前访问
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

    // 创建新窗口（更大默认尺寸，便于对照列表与详情）
    const windowFeatures =
      "width=1280,height=800,toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes";
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
          *, *::before, *::after { box-sizing: border-box; }
          html, body {
            height: 100%;
            margin: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            font-size: 13px;
            color: #1f2937;
            background-color: #f3f4f6;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .app-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            background: #fff;
            border-bottom: 1px solid #e5e7eb;
            flex-shrink: 0;
          }
          .app-header h2 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #111827;
            letter-spacing: 0.2px;
          }
          .controls {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          .tabs {
            display: flex;
            gap: 2px;
            padding: 0 10px;
            background: #fff;
            border-bottom: 1px solid #e5e7eb;
            flex-shrink: 0;
          }
          .tab {
            padding: 10px 14px;
            cursor: pointer;
            color: #6b7280;
            border-bottom: 2px solid transparent;
            user-select: none;
            font-size: 13px;
            transition: color 0.15s, border-color 0.15s, background 0.15s;
          }
          .tab:hover {
            color: #111827;
            background: #f9fafb;
          }
          .tab.active {
            color: #1565c0;
            border-bottom-color: #2196F3;
            font-weight: 600;
            background: #f0f7ff;
          }
          .main-content {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            padding: 10px;
            gap: 0;
          }
          button {
            padding: 6px 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            line-height: 1.2;
          }
          button:hover { filter: brightness(0.97); }
          .btn-clear { background-color: #ff9800; color: #fff; }
          .btn-close { background-color: #f44336; color: #fff; }
          .btn-primary { background-color: #2196F3; color: #fff; }
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
          #api-split {
            display: flex;
            flex: 1;
            min-height: 0;
            width: 100%;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          }
          #api-request-list {
            width: 42%;
            min-width: 280px;
            height: 100%;
            overflow-y: auto;
            border-right: 1px solid #e5e7eb;
            background: #fff;
          }
          .api-request-item {
            padding: 10px 12px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background-color 0.12s;
          }
          .api-request-item .time-column {
            width: 148px;
            flex-shrink: 0;
            margin-right: 10px;
            color: #6b7280;
            font-size: 12px;
            font-variant-numeric: tabular-nums;
          }
          .api-request-item:hover {
            background-color: #f3f4f6;
          }
          .api-request-item.is-selected {
            background-color: #bbdefb !important;
            font-weight: 600;
            box-shadow: inset 3px 0 0 #2196F3;
          }
          .method-badge {
            display: inline-block;
            min-width: 42px;
            text-align: center;
            padding: 1px 6px;
            margin-right: 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            color: #fff;
            background: #607d8b;
            flex-shrink: 0;
          }
          .method-badge.get { background: #2e7d32; }
          .method-badge.post { background: #1565c0; }
          .method-badge.put { background: #ef6c00; }
          .method-badge.delete { background: #c62828; }
          .method-badge.patch { background: #6a1b9a; }
          .status-text {
            color: #4b5563;
            font-size: 12px;
            margin-left: 4px;
            white-space: nowrap;
          }
          .url-text {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: ui-monospace, Consolas, monospace;
            font-size: 12px;
          }
          .duration-text {
            margin-left: 10px;
            color: #6b7280;
            font-size: 12px;
            font-variant-numeric: tabular-nums;
            flex-shrink: 0;
          }
          #api-detail-panel {
            width: 58%;
            height: 100%;
            overflow-y: auto;
            padding: 12px 14px;
            display: none;
            position: relative;
            background: #fff;
          }
          #api-detail-panel .detail-toolbar {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 8px;
          }
          #console-panel {
            flex: 1;
            min-height: 0;
            background-color: #1e1e1e;
            border: 1px solid #374151;
            border-radius: 8px;
            overflow-y: auto;
            padding: 10px 12px;
            color: #d4d4d4;
            font-family: ui-monospace, Consolas, "Courier New", monospace;
            font-size: 12px;
            display: none;
          }
          .console-log {
            margin-bottom: 4px;
            padding: 4px 6px;
            border-radius: 3px;
            white-space: pre-wrap;
            word-break: break-all;
          }
          .console-log.log { color: #d4d4d4; }
          .console-log.error { color: #f44336; background-color: rgba(244, 67, 54, 0.1); }
          .console-log.warn { color: #ff9800; background-color: rgba(255, 152, 0, 0.1); }
          .console-log.info { color: #2196f3; background-color: rgba(33, 150, 243, 0.1); }
          .console-log.debug { color: #9e9e9e; background-color: rgba(158, 158, 158, 0.1); }
          .storage-panel {
            flex: 1;
            min-height: 0;
            display: none;
            flex-direction: column;
            overflow: hidden;
          }
          .storage-panel .storage-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            flex-shrink: 0;
          }
          .storage-panel .storage-header h3 {
            margin: 0;
            font-size: 14px;
          }
          .storage-panel .storage-body {
            flex: 1;
            min-height: 0;
            background-color: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px;
            overflow-y: auto;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: #f8fafc;
            border: 1px solid #eef2f7;
            padding: 10px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.45;
            margin: 0 0 8px 0;
          }
          h3, h4 {
            margin-top: 14px;
            margin-bottom: 8px;
            color: #111827;
          }
          h3:first-child, h4:first-child { margin-top: 0; }
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
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            z-index: 1000;
            transition: opacity 0.3s;
            padding: 0;
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
          table {
            width: 100%;
            border-collapse: collapse;
          }
          table th, table td {
            text-align: left;
            padding: 8px 10px;
            border-bottom: 1px solid #eee;
            vertical-align: top;
          }
          table th {
            background: #f9fafb;
            color: #4b5563;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="app-header">
          <h2>API请求监控工具</h2>
          <div class="controls">
            <button id="clear-history-button" class="btn-clear">清空历史</button>
            <button id="close-window-button" class="btn-close">关闭窗口</button>
          </div>
        </div>
        <div class="tabs">
          <div class="tab active" id="api-tab">API请求</div>
          <div class="tab" id="console-tab">控制台日志</div>
          <div class="tab" id="localstorage-tab">LocalStorage</div>
          <div class="tab" id="sessionstorage-tab">SessionStorage</div>
          <div class="tab" id="cookie-tab">Cookie</div>
        </div>
        <div class="main-content">
          <div id="api-split">
            <div id="api-request-list"></div>
            <div id="api-detail-panel">
              <div class="detail-toolbar">
                <button id="close-detail-button" class="btn-close">关闭详情</button>
              </div>
              <button id="back-to-top-btn" title="回到顶部">↑</button>
            </div>
          </div>
          <div id="console-panel"></div>
          <div id="localstorage-panel" class="storage-panel">
            <div class="storage-header">
              <h3>LocalStorage 内容</h3>
              <button id="refresh-localstorage" class="btn-primary">刷新</button>
            </div>
            <div id="localstorage-content" class="storage-body"></div>
          </div>
          <div id="sessionstorage-panel" class="storage-panel">
            <div class="storage-header">
              <h3>SessionStorage 内容</h3>
              <button id="refresh-sessionstorage" class="btn-primary">刷新</button>
            </div>
            <div id="sessionstorage-content" class="storage-body"></div>
          </div>
          <div id="cookie-panel" class="storage-panel">
            <div class="storage-header">
              <h3>Cookie 内容</h3>
              <button id="refresh-cookie" class="btn-primary">刷新</button>
            </div>
            <div id="cookie-content" class="storage-body"></div>
          </div>
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

      // API 请求 Tab：↑/↓ 切换选中请求
      monitorWindow.document.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

        const activeEl = monitorWindow.document.activeElement;
        const tag = activeEl && activeEl.tagName ? activeEl.tagName.toUpperCase() : "";
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (activeEl && activeEl.isContentEditable)
        ) {
          return;
        }

        const apiTabEl = monitorWindow.document.getElementById("api-tab");
        if (!apiTabEl || !apiTabEl.classList.contains("active")) return;

        e.preventDefault();
        navigateRequestByArrow(e.key === "ArrowUp" ? "up" : "down");
      });
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

    // 初始化时全量填充列表与控制台（增量路径不会自动带回历史）
    updateRequestList();
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
      // 显示 flex 容器，包含 apiList 和 apiDetail
      flexContainer.style.display = "flex";
    } else if (tabName === "console") {
      consoleTab.classList.add("active");
      consolePanel.style.display = "block";
      updateConsoleLogs();
    } else if (tabName === "localstorage") {
      localStorageTab.classList.add("active");
      // storage-panel 依赖 flex 列布局填满高度
      localStoragePanel.style.display = "flex";
      updateLocalStorageDisplay();
    } else if (tabName === "sessionstorage") {
      sessionStorageTab.classList.add("active");
      sessionStoragePanel.style.display = "flex";
      updateSessionStorageDisplay();
    } else if (tabName === "cookie") {
      cookieTab.classList.add("active");
      cookiePanel.style.display = "flex";
      updateCookieDisplay();
    }
  }

  // 将switchTab函数暴露到window对象上
  window.switchTab = switchTab;

  // 创建 KV 值展示节点（对象 pretty JSON，其它 String；超过 3 行默认折叠）
  const STORAGE_VALUE_COLLAPSE_LINES = 3;

  function createExpandableValue(monitorWindow, value) {
    const isObject = value && typeof value === "object";
    const fullValueText = isObject ? JSON.stringify(value, null, 2) : String(value);
    const lines = fullValueText.split("\n");
    const needsCollapse = lines.length > STORAGE_VALUE_COLLAPSE_LINES;

    const wrapper = monitorWindow.document.createElement("div");
    const pre = monitorWindow.document.createElement("pre");
    pre.style.cssText =
      "margin:0;white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:12px;";

    if (!needsCollapse) {
      pre.textContent = fullValueText;
      wrapper.appendChild(pre);
      return wrapper;
    }

    const collapsedText =
      lines.slice(0, STORAGE_VALUE_COLLAPSE_LINES).join("\n") + "\n…";
    let expanded = false;
    pre.textContent = collapsedText;
    pre.style.cursor = "pointer";
    pre.title = "点击展开/收起";

    const toggleBtn = monitorWindow.document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.textContent = "展开全部";
    toggleBtn.style.cssText =
      "margin-top:4px;padding:2px 8px;font-size:12px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;color:#333;cursor:pointer;";

    const sync = () => {
      pre.textContent = expanded ? fullValueText : collapsedText;
      toggleBtn.textContent = expanded ? "收起" : "展开全部";
    };

    const toggle = (e) => {
      if (e) e.stopPropagation();
      expanded = !expanded;
      sync();
    };

    pre.addEventListener("click", toggle);
    toggleBtn.addEventListener("click", toggle);

    wrapper.appendChild(pre);
    wrapper.appendChild(toggleBtn);
    return wrapper;
  }

  // 公共 KV 表格渲染（LocalStorage / SessionStorage / Cookie 共用）
  function renderKeyValueTable(monitorWindow, contentElement, data, emptyText) {
    contentElement.innerHTML = "";
    if (!data || Object.keys(data).length === 0) {
      contentElement.innerHTML =
        '<div style="color: #666; text-align: center; padding: 20px;">' +
        emptyText +
        "</div>";
      return;
    }

    const table = monitorWindow.document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "13px";

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

    const tbody = monitorWindow.document.createElement("tbody");

    Object.entries(data).forEach(([key, value]) => {
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
      valueCell.appendChild(createExpandableValue(monitorWindow, value));
      valueCell.style.padding = "8px";
      valueCell.style.border = "1px solid #ddd";

      row.appendChild(keyCell);
      row.appendChild(valueCell);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    contentElement.appendChild(table);
  }

  // 更新LocalStorage显示
  function updateLocalStorageDisplay() {
    if (!monitorWindow || monitorWindow.closed) return;

    try {
      const contentElement = monitorWindow.document.getElementById(
        "localstorage-content"
      );

      const localStorageData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
          localStorageData[key] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          localStorageData[key] = localStorage.getItem(key);
        }
      }

      renderKeyValueTable(
        monitorWindow,
        contentElement,
        localStorageData,
        "LocalStorage 为空"
      );
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

      const sessionStorageData = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        try {
          sessionStorageData[key] = JSON.parse(sessionStorage.getItem(key));
        } catch (e) {
          sessionStorageData[key] = sessionStorage.getItem(key);
        }
      }

      renderKeyValueTable(
        monitorWindow,
        contentElement,
        sessionStorageData,
        "SessionStorage 为空"
      );
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

      renderKeyValueTable(monitorWindow, contentElement, cookieData, "Cookie 为空");
    } catch (error) {
      const contentElement =
        monitorWindow.document.getElementById("cookie-content");
      contentElement.innerHTML = `<div style="color: #f44336; padding: 10px;">获取 Cookie 失败: ${error.message}</div>`;
    }
  }

  // 构建单条控制台日志 DOM 节点
  function buildConsoleLogElement(log) {
    const logElement = monitorWindow.document.createElement("div");
    logElement.className = `console-log ${log.type}`;

    const timeSpan = monitorWindow.document.createElement("span");
    timeSpan.style.color = "#888";
    timeSpan.style.marginRight = "10px";
    timeSpan.textContent = log.timestamp;

    const contentSpan = monitorWindow.document.createElement("span");
    contentSpan.textContent = log.content;

    logElement.appendChild(timeSpan);
    logElement.appendChild(contentSpan);
    return logElement;
  }

  // 增量追加一条控制台日志（超 CONSOLE_VIEW_MAX 删最旧）
  function appendConsoleLogEntry(log) {
    if (typeof monitorWindow === "undefined" || !monitorWindow || monitorWindow.closed) {
      return;
    }

    const consolePanel = monitorWindow.document.getElementById("console-panel");
    if (!consolePanel) return;

    consolePanel.appendChild(buildConsoleLogElement(log));
    while (consolePanel.children.length > CONSOLE_VIEW_MAX) {
      consolePanel.removeChild(consolePanel.firstChild);
    }
    consolePanel.scrollTop = consolePanel.scrollHeight;
  }

  // 全量重建控制台日志显示（切换 Tab / 清空历史时使用）
  function updateConsoleLogs() {
    if (typeof monitorWindow === "undefined" || !monitorWindow || monitorWindow.closed) {
      return;
    }

    const consolePanel = monitorWindow.document.getElementById("console-panel");
    if (!consolePanel) return;

    consolePanel.innerHTML = "";

    const recentLogs = consoleLogs.slice(-CONSOLE_VIEW_MAX);
    recentLogs.forEach((log) => {
      consolePanel.appendChild(buildConsoleLogElement(log));
    });

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
  function initializeMenu() {
    GM_registerMenuCommand("切换API监控", function () {
      toggleMonitoring();
    });
    GM_registerMenuCommand("设置", function () {
      openSettingsDialog();
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
    monitorKeywords = saved
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);
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

          // 先 text 再 JSON.parse，避免非 JSON 体先 json() 失败
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

        // 旁路采集：addEventListener 不覆盖业务 onload/onerror；_listed 防重入
        const xhr = this;
        const finish = (status, body) => {
          if (!xhr._requestInfo || xhr._requestInfo._listed) return;
          xhr._requestInfo._listed = true;
          xhr._requestInfo.status = status;
          xhr._requestInfo.duration =
            performance.now() - xhr._requestInfo._startTime;
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
          const headers = {};
          const headerLines = (this.getAllResponseHeaders() || "").split(
            "\r\n"
          );
          for (let line of headerLines) {
            if (line.trim()) {
              const idx = line.indexOf(": ");
              if (idx > -1) {
                headers[line.slice(0, idx)] = line.slice(idx + 2);
              } else {
                const [key, value] = line.split(": ");
                headers[key] = value;
              }
            }
          }
          if (this._requestInfo) {
            this._requestInfo.responseHeaders = headers;
          }
          finish(this.status);
        });
        xhr.addEventListener("error", function () {
          finish("ERROR", "[XHR错误] [XHR网络错误]");
          addConsoleLog(
            "error",
            "XHR错误: [XHR网络错误]",
            xhr._requestInfo && xhr._requestInfo.url
          );
        });
        xhr.addEventListener("timeout", function () {
          finish("TIMEOUT", "[XHR超时]");
        });
        xhr.addEventListener("abort", function () {
          finish("ABORT", "[XHR中止]");
        });
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

  // 序列化历史用于落盘：超长 body 占位，内存 requestHistory 保持完整
  function serializeHistoryForPersist(history) {
    return history.map((item) => {
      const copy = { ...item };
      const truncate = (val) => {
        if (typeof val === "string" && val.length > BODY_PERSIST_MAX_CHARS) {
          return `[已省略，长度 ${val.length}]`;
        }
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

  // 添加请求到列表 - 只添加包含监控关键字的URL
  function addRequestToList(requestInfo) {
    if (shouldMonitorUrl(requestInfo.url)) {
      requestHistory.unshift(requestInfo);

      // 限制历史记录数量
      if (requestHistory.length > MAX_HISTORY_SIZE) {
        requestHistory = requestHistory.slice(0, MAX_HISTORY_SIZE);
      }

      // debounce 落盘（内存仍为完整 requestInfo）
      schedulePersistRequestHistory();

      // 窗口打开时增量 prepend，避免全量重建
      if (monitorWindow && !monitorWindow.closed) {
        updateRequestList({ prependRequest: requestInfo });
      }
    }
  }

  // 构建单个请求列表项 DOM（含状态色与当前打开项高亮）
  function buildRequestListItem(request) {
    const item = monitorWindow.document.createElement("div");
    item.className = "api-request-item";
    item.dataset.requestId = String(request.id);

    // 选中高亮优先；否则按状态着色
    if (currentlyOpenRequestId === request.id) {
      item.classList.add("is-selected");
    } else if (request.status === "ERROR") {
      item.style.backgroundColor = "#ffebee";
    } else if (typeof request.status === "number" && request.status >= 400) {
      item.style.backgroundColor = "#fff8e1";
    } else if (
      typeof request.status === "number" &&
      request.status >= 200 &&
      request.status < 300
    ) {
      item.style.backgroundColor = "#e8f5e9";
    }

    const contentContainer = monitorWindow.document.createElement("div");
    contentContainer.style.display = "flex";
    contentContainer.style.alignItems = "center";
    contentContainer.style.width = "100%";
    contentContainer.style.minWidth = "0";
    contentContainer.style.gap = "4px";

    const statusIcon = monitorWindow.document.createElement("span");
    if (request.status === "ERROR") {
      statusIcon.textContent = "❌";
      statusIcon.title = "错误";
    } else if (typeof request.status === "number" && request.status >= 400) {
      statusIcon.textContent = "⚠️";
      statusIcon.title = String(request.status);
    } else if (
      typeof request.status === "number" &&
      request.status >= 200 &&
      request.status < 300
    ) {
      statusIcon.textContent = "✅";
      statusIcon.title = String(request.status);
    } else {
      statusIcon.textContent = "⏱️";
      statusIcon.title = "进行中";
    }
    statusIcon.style.flexShrink = "0";
    contentContainer.appendChild(statusIcon);

    const timeColumn = monitorWindow.document.createElement("span");
    timeColumn.className = "time-column";
    timeColumn.textContent = request.timestamp;
    contentContainer.appendChild(timeColumn);

    const method = String(request.method || "GET").toUpperCase();
    const methodBadge = monitorWindow.document.createElement("span");
    methodBadge.className = "method-badge " + method.toLowerCase();
    methodBadge.textContent = method;
    contentContainer.appendChild(methodBadge);

    const urlSpan = monitorWindow.document.createElement("span");
    urlSpan.className = "url-text";
    urlSpan.textContent = getShortUrl(request.url);
    urlSpan.title = request.url;
    contentContainer.appendChild(urlSpan);

    const statusText = monitorWindow.document.createElement("span");
    statusText.className = "status-text";
    statusText.textContent = String(request.status || "PENDING");
    contentContainer.appendChild(statusText);

    const durationSpan = monitorWindow.document.createElement("span");
    durationSpan.className = "duration-text";
    durationSpan.textContent = request.duration
      ? Math.round(request.duration) + "ms"
      : "";
    contentContainer.appendChild(durationSpan);

    item.appendChild(contentContainer);

    item.addEventListener("click", () => {
      showRequestDetails(request);
    });

    return item;
  }

  // 更新请求列表 UI：默认全量；{ prependRequest } 增量 prepend
  function updateRequestList(options) {
    options = options || {};

    if (!monitorWindow || monitorWindow.closed) {
      return;
    }

    const listContainer =
      monitorWindow.document.getElementById("api-request-list");
    if (!listContainer) return;

    // 全量路径：清空重建（清空历史、关详情、切换打开项时使用）
    if (options.full !== false && !options.prependRequest) {
      listContainer.innerHTML = "";
      requestHistory.slice(0, REQUEST_LIST_VIEW_MAX).forEach((request) => {
        listContainer.appendChild(buildRequestListItem(request));
      });
      return;
    }

    // 增量路径：新项 prepend，超上限删末项
    if (options.prependRequest) {
      listContainer.insertBefore(
        buildRequestListItem(options.prependRequest),
        listContainer.firstChild
      );
      while (listContainer.children.length > REQUEST_LIST_VIEW_MAX) {
        listContainer.removeChild(listContainer.lastChild);
      }
    }
  }

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
      if (found) start = best;
    }
    let displayUrl = found ? url.substring(start) : url;
    const MAX = 120;
    if (displayUrl.length > MAX) displayUrl = displayUrl.slice(0, MAX) + "…";
    return displayUrl;
  }

  // 检测 base64 字符串并创建下载按钮
  function detectBase64AndCreateDownload(data, monitorWindow) {
    if (!data || typeof data !== "object") return null;

    const base64Fields = [];
    let fieldsVisited = 0;

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

    // 递归查找 base64 字符串（有界 DFS）
    function findBase64(obj, path = "", depth = 0) {
      if (depth > BASE64_MAX_DEPTH || fieldsVisited > BASE64_MAX_FIELDS) return;

      if (typeof obj === "string") {
        fieldsVisited++;
        // 检查路径是否包含 encData 字段
        if (path.includes(".encData") || path === "encData") {
          return;
        }

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
        // 检测纯 base64 字符串：长度门槛 → 跳过纯 hex → magic 前缀优先 → 全量 regex
        else {
          if (obj.length < BASE64_MIN_LEN) return;
          // 纯十六进制密文（如部分 encData）不是可下载文件
          if (/^[0-9A-Fa-f]+$/.test(obj)) return;

          let magicMatched = false;
          try {
            const header = obj.substring(0, 50);
            if (header.startsWith("iVBORw0KGgo")) {
              fileType = "png";
              mimeType = "image/png";
              magicMatched = true;
            } else if (header.startsWith("/9j/")) {
              fileType = "jpg";
              mimeType = "image/jpeg";
              magicMatched = true;
            } else if (header.startsWith("R0lGOD")) {
              fileType = "gif";
              mimeType = "image/gif";
              magicMatched = true;
            } else if (header.startsWith("UEs")) {
              fileType = "zip";
              mimeType = "application/zip";
              magicMatched = true;
            } else if (header.startsWith("JVBERi0")) {
              fileType = "pdf";
              mimeType = "application/pdf";
              magicMatched = true;
            }
          } catch (e) {
            console.error("检测文件类型失败:", e);
          }

          if (magicMatched) {
            base64Data = obj;
          } else {
            const base64Regex =
              /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
            if (base64Regex.test(obj)) {
              base64Data = obj;
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
          if (!obj.hasOwnProperty(key)) continue;
          fieldsVisited++;
          if (fieldsVisited > BASE64_MAX_FIELDS) return;
          const newPath = path ? `${path}.${key}` : key;
          findBase64(obj[key], newPath, depth + 1);
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

  // HTML 转义（详情等不可信字段；优先 textContent 时作兜底）
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 详情区：带标签的文本行（不可信 value 仅 textContent）
  function createDetailFieldRow(doc, label, value) {
    const div = doc.createElement("div");
    const strong = doc.createElement("strong");
    strong.textContent = label;
    div.appendChild(strong);
    div.appendChild(doc.createTextNode(" " + String(value ?? "")));
    return div;
  }

  // 详情区：标题 + 复制按钮 + 可选解密按钮 + <pre textContent>
  // options.collapsed === true 时默认折叠正文
  // options.decryptSource 为 extractEncPayload 结果时显示解密按钮
  function createDetailPreSection(doc, title, content, options) {
    options = options || {};
    const collapsedByDefault = !!options.collapsed;
    const decryptSource = options.decryptSource;
    const canDecrypt = hasEncPayload(decryptSource);
    const section = doc.createElement("div");

    const pre = doc.createElement("pre");
    pre.textContent = content == null ? "" : String(content);

    const copyBtn = doc.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.title = "复制";
    copyBtn.textContent = "📄";
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (monitorWindow && !monitorWindow.closed && monitorWindow.window.copyToClipboard) {
        monitorWindow.window.copyToClipboard(pre.textContent);
      }
    });

    let decryptBtn = null;
    if (canDecrypt) {
      decryptBtn = doc.createElement("button");
      decryptBtn.className = "copy-btn";
      decryptBtn.title = "解密 encData";
      decryptBtn.textContent = "🔓";
      decryptBtn.style.marginLeft = "4px";
      let showingDecrypted = false;
      const originalText = pre.textContent;
      decryptBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (showingDecrypted) {
          pre.textContent = originalText;
          decryptBtn.textContent = "🔓";
          decryptBtn.title = "解密 encData";
          showingDecrypted = false;
          return;
        }
        try {
          applyDecryptConfig(getDecryptConfig());
          if (!HseEncAndDecUtil.CHNL_ID || !HseEncAndDecUtil.SM4_KEY) {
            alert("请先通过油猴菜单「设置」填写 CHNL_ID 与 SM4_KEY");
            return;
          }
          const decrypted = HseEncAndDecUtil.decryptResponseMsg(
            decryptSource.payload
          );
          const displayObj = formatDecryptedDisplay(decryptSource, decrypted);
          pre.textContent = JSON.stringify(displayObj, null, 2);
          decryptBtn.textContent = "🔒";
          decryptBtn.title = "显示原文";
          showingDecrypted = true;
        } catch (err) {
          console.error("解密失败:", err);
          alert("解密失败: " + (err && err.message ? err.message : String(err)));
        }
      });
    }

    if (!collapsedByDefault) {
      const h4 = doc.createElement("h4");
      h4.style.display = "inline-block";
      h4.style.marginRight = "10px";
      h4.textContent = title;
      section.appendChild(h4);
      section.appendChild(copyBtn);
      if (decryptBtn) section.appendChild(decryptBtn);
      section.appendChild(pre);
      return section;
    }

    const header = doc.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "6px";
    header.style.marginTop = "15px";
    header.style.marginBottom = "8px";
    header.style.cursor = "pointer";
    header.title = "点击展开/收起";

    const toggle = doc.createElement("span");
    toggle.style.userSelect = "none";
    toggle.style.color = "#666";
    toggle.style.fontSize = "12px";
    toggle.style.minWidth = "12px";

    const h4 = doc.createElement("h4");
    h4.style.display = "inline-block";
    h4.style.margin = "0 10px 0 0";
    h4.textContent = title;

    let expanded = false;
    const sync = () => {
      toggle.textContent = expanded ? "▼" : "▶";
      pre.style.display = expanded ? "" : "none";
    };
    sync();

    header.addEventListener("click", () => {
      expanded = !expanded;
      sync();
    });

    header.appendChild(toggle);
    header.appendChild(h4);
    header.appendChild(copyBtn);
    if (decryptBtn) header.appendChild(decryptBtn);
    section.appendChild(header);
    section.appendChild(pre);
    return section;
  }

  // 是否为加密字段路径（encData 原样展示，不替换为 Base64 占位）
  function isEncDataPath(path) {
    if (!path) return false;
    return (
      path === "encData" ||
      path.endsWith(".encData") ||
      path.includes(".encData.") ||
      path.includes(".encData[")
    );
  }

  // 是否像文件 Base64（排除纯十六进制密文，避免误标 encData 类字段）
  function looksLikeBase64File(str) {
    if (typeof str !== "string") return false;
    if (str.startsWith("data:")) return true;
    if (str.length <= 100) return false;
    // 纯 hex 通常是加密载荷，不是可下载文件
    if (/^[0-9A-Fa-f]+$/.test(str)) return false;
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      str
    );
  }

  // 详情展示用：递归替换文件 Base64 为占位符（请求体/响应体共用）
  function replaceBase64InDisplayObject(obj, path) {
    path = path || "";
    if (typeof obj === "string") {
      if (isEncDataPath(path)) return obj;
      if (looksLikeBase64File(obj)) return "[Base64 文件]";
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item, index) =>
        replaceBase64InDisplayObject(
          item,
          path ? path + "[" + index + "]" : "[" + index + "]"
        )
      );
    }
    if (typeof obj === "object" && obj !== null) {
      const newObj = {};
      for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        if (key === "encData") {
          newObj[key] = obj[key];
          continue;
        }
        const newPath = path ? path + "." + key : key;
        newObj[key] = replaceBase64InDisplayObject(obj[key], newPath);
      }
      return newObj;
    }
    return obj;
  }

  // API 列表 ↑/↓ 导航
  function scrollRequestItemIntoView(requestId) {
    if (!monitorWindow || monitorWindow.closed) return;
    const listContainer =
      monitorWindow.document.getElementById("api-request-list");
    if (!listContainer) return;
    const item = listContainer.querySelector(
      '[data-request-id="' + String(requestId) + '"]'
    );
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" });
    }
  }

  function navigateRequestByArrow(direction) {
    if (!monitorWindow || monitorWindow.closed) return;
    const list = requestHistory.slice(0, REQUEST_LIST_VIEW_MAX);
    if (list.length === 0) return;

    let idx = list.findIndex((r) => r.id === currentlyOpenRequestId);
    if (idx === -1) {
      idx = 0;
    } else if (direction === "up") {
      idx = Math.max(0, idx - 1);
    } else {
      idx = Math.min(list.length - 1, idx + 1);
    }

    const target = list[idx];
    if (!target) return;

    // 已选中同一项时不 toggle 关闭，仅滚动定位
    if (currentlyOpenRequestId === target.id) {
      scrollRequestItemIntoView(target.id);
      return;
    }
    showRequestDetails(target);
    scrollRequestItemIntoView(target.id);
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

    const doc = monitorWindow.document;

    // 基本信息（不可信字段一律 textContent / createTextNode）
    const basicInfo = doc.createElement("div");
    const h3 = doc.createElement("h3");
    h3.style.display = "inline-block";
    h3.style.marginRight = "10px";
    h3.textContent = "请求详情";
    const basicCopyBtn = doc.createElement("button");
    basicCopyBtn.className = "copy-btn";
    basicCopyBtn.title = "复制";
    basicCopyBtn.textContent = "📄";
    basicCopyBtn.addEventListener("click", () => {
      if (monitorWindow && !monitorWindow.closed && monitorWindow.window.copyToClipboard) {
        monitorWindow.window.copyToClipboard(basicInfo.textContent);
      }
    });
    basicInfo.appendChild(h3);
    basicInfo.appendChild(basicCopyBtn);
    basicInfo.appendChild(
      createDetailFieldRow(doc, "时间:", request.timestamp)
    );
    basicInfo.appendChild(
      createDetailFieldRow(doc, "方法:", request.method)
    );
    basicInfo.appendChild(createDetailFieldRow(doc, "URL:", request.url));
    basicInfo.appendChild(
      createDetailFieldRow(doc, "状态:", request.status)
    );
    if (request.duration) {
      basicInfo.appendChild(
        createDetailFieldRow(
          doc,
          "耗时:",
          Math.round(request.duration) + "ms"
        )
      );
    }

    // 请求头（默认折叠）
    const requestHeadersData = request.headers || {};
    const requestHeadersContent = formatObject(requestHeadersData);
    const requestHeadersSection = createDetailPreSection(
      doc,
      "请求头",
      requestHeadersContent,
      { collapsed: true }
    );

    // 请求体（处理 base64 替换；encData / 纯 hex 不替换）
    let requestBodyContent = formatRequestBody(request.requestBody);
    let requestData = request.requestBody;
    if (typeof requestData === "string") {
      try {
        requestData = JSON.parse(requestData);
      } catch (e) {
        // 如果不是 JSON，就保持原样
      }
    }
    if (requestData && typeof requestData === "object") {
      const replacedData = replaceBase64InDisplayObject(requestData);
      requestBodyContent = JSON.stringify(replacedData, null, 2);
    }

    const requestBodySection = createDetailPreSection(
      doc,
      "请求体",
      requestBodyContent,
      { decryptSource: extractEncPayload(request.requestBody) }
    );

    // 响应头（默认折叠）
    const responseHeadersContent = request.responseHeaders
      ? formatObject(request.responseHeaders)
      : "N/A";
    const responseHeadersSection = createDetailPreSection(
      doc,
      "响应头",
      responseHeadersContent,
      { collapsed: true }
    );

    // 响应体（处理 base64 替换；encData / 纯 hex 不替换）
    let responseBodyContent = formatResponseBody(request.responseBody);
    let responseData = request.responseBody;
    if (typeof responseData === "string") {
      try {
        responseData = JSON.parse(responseData);
      } catch (e) {
        // 如果不是 JSON，就保持原样
      }
    }
    if (responseData && typeof responseData === "object") {
      const replacedData = replaceBase64InDisplayObject(responseData);
      responseBodyContent = JSON.stringify(replacedData, null, 2);
    }

    const responseBodySection = createDetailPreSection(
      doc,
      "响应体",
      responseBodyContent,
      { decryptSource: extractEncPayload(request.responseBody) }
    );

    // 清空详情内容，保留工具栏与回到顶部按钮
    const detailToolbar = detailPanel.querySelector(".detail-toolbar");
    const closeButton = detailPanel.querySelector("#close-detail-button");
    const backToTopBtn = detailPanel.querySelector("#back-to-top-btn");
    detailPanel.innerHTML = "";

    let toolbar = detailToolbar;
    if (!toolbar) {
      toolbar = doc.createElement("div");
      toolbar.className = "detail-toolbar";
    }
    if (closeButton && !toolbar.contains(closeButton)) {
      toolbar.appendChild(closeButton);
    } else if (!closeButton) {
      const btn = doc.createElement("button");
      btn.id = "close-detail-button";
      btn.className = "btn-close";
      btn.textContent = "关闭详情";
      btn.addEventListener("click", () => {
        currentlyOpenRequestId = null;
        detailPanel.style.display = "none";
        updateRequestList();
      });
      toolbar.appendChild(btn);
    }
    detailPanel.appendChild(toolbar);
    if (backToTopBtn) {
      detailPanel.appendChild(backToTopBtn);
    }

    // 添加到详情面板
    detailPanel.appendChild(basicInfo);
    detailPanel.appendChild(requestHeadersSection);
    detailPanel.appendChild(requestBodySection);

    // 检测并添加 base64 下载按钮
    try {
      let requestDataForB64 = request.requestBody;
      if (typeof requestDataForB64 === "string") {
        try {
          requestDataForB64 = JSON.parse(requestDataForB64);
        } catch (e) {
          // 如果不是 JSON，就保持原样
        }
      }
      const base64Downloads = detectBase64AndCreateDownload(
        requestDataForB64,
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

    // 检测并添加响应体的 base64 下载按钮
    try {
      let responseDataForB64 = request.responseBody;
      if (typeof responseDataForB64 === "string") {
        try {
          responseDataForB64 = JSON.parse(responseDataForB64);
        } catch (e) {
          // 如果不是 JSON，就保持原样
        }
      }
      const responseBase64Downloads = detectBase64AndCreateDownload(
        responseDataForB64,
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

    // 立即清除落盘历史并取消 pending debounce
    persistRequestHistoryNow("[]");

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
    // 加载解密参数到 HseEncAndDecUtil
    applyDecryptConfig(getDecryptConfig());
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
