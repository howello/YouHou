// ==UserScript==
// @name         Auto Refresh
// @namespace    自动刷新
// @version      0.1
// @description  自动刷新网页
// @author       lu
// @match        *://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Your code here...
  console.log("自动刷新")
  window.setInterval(function (){
    location.reload()
  },2000)
})();
