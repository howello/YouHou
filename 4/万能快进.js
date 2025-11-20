// ==UserScript==
// @name         万能快进
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        *://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Your code here...
  console.log('视频快进')
  var interval = window.setInterval(function () {
    var video = document.getElementsByTagName("video")[0]
    if (video) {
      video.playbackRate = 15
      window.clearInterval(interval)
    }
  }, 1000)

})();
