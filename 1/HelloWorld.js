// ==UserScript==
// @name         HelloWorld
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match       *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=qq.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Your code here...
  console.log("Hello World撒大啊")
  window.setInterval(function (){
    $('[data-tuiguang]').parents('[data-click]').remove();
    $('.result:contains(广告)').remove()
  })
})();
