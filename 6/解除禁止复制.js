// ==UserScript==
// @name         解除禁止复制
// @namespace    http://howe.com/
// @version      0.1
// @description  解除禁止复制
// @author       howe
// @match        https://chuangshi.qq.com/*
// @match        https://wenku.baidu.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  console.log("解除复制限制")
  // Your code here...
  window.setTimeout(function () {
    document.oncontextmenu = function () {
      return true
    }
    document.onselectstart = function (){
      return true
    }
    document.oncopy = function () {
      return true
    }
    document.oncut = function () {
      return true
    }
    document.onpaste = function () {
      return true
    }
  },3000)
})();
