// ==UserScript==
// @name         Wenku Doc Downloader
// @namespace    http://tampermonkey.net/
// @version      1.5.25
// @description  下载文档，导出纯图片PDF。有限地支持 (1)豆丁网 (2)道客巴巴 (3)360doc个人图书馆 (4)得力文库 (5)MBA智库 (6)<暂时移除> (7)原创力文档 (8)读根网 (9)国标网 (10)食典通 (11)安全文库网。在文档页面左侧中间有按钮区和小猴子图标，说明脚本生效了。【反馈请提供网址】。不支持手机端。你能预览多少页，就可以导出多少页的PDF。
// @author       2690874578@qq.com
// @match        *://*.docin.com/p-*
// @match        *://www.deliwenku.com/p-*
// @match        *://www.doc88.com/p-*
// @match        *://www.360doc.com/content/*
// @match        *://wenku.baidu.com/view/*
// @match        *://wenku.baidu.com/tfview/*
// @match        *://doc.mbalib.com/view/*
// @match        *://www.dugen.com/p-*
// @match        *://max.book118.com/html/*
// @match        *://view-cache.book118.com/pptView.html?*
// @match        *://*.book118.com/?readpage=*
// @match        *://c.gb688.cn/bzgk/gb/showGb?*
// @match        *://www.safewk.com/p-*
// @require      https://cdn.staticfile.org/FileSaver.js/2.0.5/FileSaver.min.js
// @require      https://cdn.staticfile.org/jszip/3.7.1/jszip.min.js
// @require      https://cdn.staticfile.org/jspdf/2.5.1/jspdf.umd.min.js
// @require      https://cdn.staticfile.org/html2canvas/1.4.1/html2canvas.min.js
// @icon         https://s2.loli.net/2022/01/12/wc9je8RX7HELbYQ.png
// @icon64       https://s2.loli.net/2022/01/12/tmFeSKDf8UkNMjC.png
// @grant        none
// @license      GPL-3.0-only
// @create       2021-11-22
// @note         1. 修复了导出PDF失败的bug
// ==/UserScript==


(function () {
  'use strict';

  /**
   * 多元素选择器
   * @param {string | HTMLElement} selector 选择器或元素
   * @returns {NodeListOf<HTMLElement>} elements 元素列表
   */
  let _wk$ = function (selector) {
    if (selector instanceof Node) {
      return [selector];
    }
    let that = this;
    if (!(that instanceof HTMLElement)) {
      that = document;
    }
    return that.querySelectorAll(selector);
  };

  globalThis.wk$ = _wk$;


  let utils = {
    /**
     * 使用过时的execCommand复制文字
     * @param {string} text
     */
    _oldCopy: function (text) {
      let input = document.createElement("input");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    },

    /**
     * 复制text到剪贴板
     * @param {string} text
     * @returns
     */
    copy: function (text) {
      // 输出到控制台和剪贴板
      console.log(text);

      if (!navigator.clipboard) {
        this._oldCopy(text);
        return;
      }
      navigator.clipboard.writeText(text)
          .catch(err => {
            this._oldCopy(text);
          });
    },

    /**
     * 装饰器, 用于打印函数执行耗时
     * @param {Function} func 需要计时的函数
     * @returns 装饰的func => func的返回值
     */
    recTime: async function (func) {
      async function inner() {
        let begin = Date.now();
        let res = await func();
        let cost = ((Date.now() - begin) / 1000).toFixed(1);
        console.log(`Function <${func.name}> costed ${cost} seconds.`);
        return res;
      }

      return inner;
    },

    /**
     * 创建并下载文件
     * @param {String} file_name 文件名
     * @param {String | Blob} content 文本或blob
     */
    createAndDownloadFile: function (file_name, content) {
      let aTag = document.createElement('a');
      let blob;
      if (typeof content != Blob) {
        blob = new Blob([content]);
      }
      aTag.download = file_name;
      aTag.href = URL.createObjectURL(blob);
      aTag.click();
      URL.revokeObjectURL(blob);
    },

    /**
     * 创建并下载URL资源
     * @param {String} file_name
     * @param {String} src
     */
    downloadUrlFile: function (file_name, src) {
      let aTag = document.createElement('a');
      aTag.download = file_name;
      aTag.href = src;
      aTag.click();
    },

    /**
     * canvas转为PNG格式的blob
     * @param {HTMLCanvasElement} canvas
     * @returns {Promise<Blob>} blob
     */
    canvasToBlob: async function (canvas) {
      return new Promise(res => canvas.toBlob(res));
    },

    /**
     * 添加外部js到当前页面
     * @param {String} url
     */
    addScript2HTML: function (url) {
      let script = document.createElement("script");
      script.src = url;
      document.head.appendChild(script);
    },

    /**
     * 显示/隐藏按钮区.
     * @param {Function} func
     */
    toggleBtnsSec: function () {
      let sec = wk$(".wk-box")[0];
      if (sec.style.display === "none") {
        sec.style.display = "block";
        return;
      }
      sec.style.display = "none";
    },

    /**
     * 睡眠 delay 毫秒
     * @param {Number} delay
     */
    sleep: function (delay) {
      let start = (new Date()).getTime();
      while ((new Date()).getTime() - start < delay) {
        continue;
      }
    },

    /**
     * 异步地睡眠 delay 毫秒，返回promise用于后续任务
     * @param {Number} delay
     * @returns {Promise} nextTask
     */
    sleepAsync: function (delay) {
      return new Promise((resolve) => setTimeout(resolve, delay));
    },

    /**
     * 允许打印页面
     */
    allowPrint: function () {
      let style = document.createElement("style");
      style.innerHTML = `
            @media print {
                body{
                    display:block;
                }
            }
        `;
      document.head.appendChild(style);
    },

    /**
     * 取得get参数key对应的value
     * @param {String} key
     * @returns {String} value
     */
    getUrlParam: function (key) {
      let params = (new URL(window.location)).searchParams;
      return params.get(key);
    },

    /**
     * 在指定节点后面插入节点
     * @param {HTMLElement} new_element
     * @param {HTMLElement} target_element
     */
    insertAfter: function (new_element, target_element) {
      let parent = target_element.parentNode;
      if (parent.lastChild === target_element) {
        parent.appendChild(new_element);
      } else {
        parent.insertBefore(new_element, target_element.nextElementSibling);
      }
    },

    /**
     * 求main_set去除cut_set后的set
     * @param {Set} main_set
     * @param {Set} cut_set
     * @returns 差集
     */
    difference: function (main_set, cut_set) {
      let _diff = new Set(main_set);
      for (let elem of cut_set) {
        _diff.delete(elem);
      }
      return _diff;
    },

    /**
     * 抛出set中的第一个元素
     * @param {Set} set
     * @returns 一个元素
     */
    setPop: function (set) {
      for (let item of set) {
        set.delete(item);
        return item;
      }
    },

    /**
     * 绑定事件到指定按钮，返回按钮引用
     * @param {Function} event click事件
     * @param {Array} args 事件的参数列表
     * @param {String} aim_btn 按钮的变量名
     * @param {String} new_text 按钮的新文本，为null则不替换
     * @returns 按钮元素的引用
     */
    setBtnEvent: function (event, args = [], aim_btn = "btn_3", new_text = null) {
      let btn = document.querySelector(`.${aim_btn.replace("_", "-")}`);
      // 如果需要，替换按钮内文本
      if (new_text) {
        btn.textContent = new_text;
      }
      // 绑定事件，添加到页面上
      btn.onclick = () => {
        this.enhanceBtnClickReaction(aim_btn);
        if (args.length) {
          event(...args);
        } else {
          event();
        }
      };
      return btn;
    },

    /**
     * 强制隐藏元素
     * @param {String} selector
     */
    forceHide: function (selector) {
      let style_cls = "force-hide";
      document.querySelectorAll(selector).forEach((elem) => {
        elem.className += ` ${style_cls}`;
      });
      // 判断css样式是否已经存在
      let style;
      style = document.querySelector(`style.${style_cls}`);
      // 如果已经存在，则无须重复创建
      if (style) {
        return;
      }
      // 否则创建
      style = document.createElement("style");
      style.innerHTML = `style.${style_cls} {
            visibility: hidden !important;
        }`;
      document.head.appendChild(style);
    },

    /**
     * 当元素可见时，操作目标元素（异步）。最多为不可见元素等待5秒。
     * @param {string} s 单个元素选择器
     * @param {Function} callback (elem) => {...} 元素操作函数
     */
    manipulateElem: async function (s, callback) {
      let isVisiable = () => {
        let res = getComputedStyle($(s)[0]).display !== "none";
        // console.log(`${s} visibility: ${res}`);
        return res;
      };

      let max = 5 * 5; // 最多等待5秒
      let i = 0;

      // 如果不可见就等待0.2秒/轮
      while (!isVisiable() && i <= max) {
        i++;
        await utils.sleepAsync(200);
      }

      callback($(s)[0]);
    },

    /**
     * 隐藏按钮，打印页面，显示按钮
     */
    hideBtnThenPrint: function () {
      // 隐藏按钮，然后打印页面
      let btns = document.querySelectorAll(".btns_section, .hide_btn_wk");
      btns.forEach((elem) => {
        elem.style.display = "none";
      });
      window.print();

      // 打印结束，显示按钮
      btns.forEach((elem) => {
        elem.style.display = "block";
      });
    },

    /**
     * 返回times个倍数连接的str
     * @param {String} str
     * @param {Number} times
     * @returns multiplied_str
     */
    multiplyStr: function (str, times) {
      let str_list = [];
      for (let i = 0; i < times; i++) {
        str_list.push(str);
      }
      return str_list.join("");
    },

    /**
     * 增强按钮（默认为蓝色按钮：展开文档）的点击效果
     * @param {String} custom_btn 按钮变量名
     */
    enhanceBtnClickReaction: function (custom_btn = null) {
      let aim_btn;
      // 如果不使用自定义按钮元素，则默认为使用蓝色展开文档按钮
      if (!custom_btn || custom_btn === "btn_1") {
        aim_btn = document.querySelector(".btn-1");
      } else {
        aim_btn = document.querySelector(`.${custom_btn.replace("_", "-")}`);
      }

      let old_color = aim_btn.style.color; // 保存旧的颜色
      let old_text = aim_btn.textContent; // 保存旧的文字内容
      // 变黑缩小
      aim_btn.style.color = "black";
      aim_btn.style.fontWeight = "normal";
      aim_btn.textContent = `->${old_text}<-`;
      // 复原加粗
      let changeColorBack = function () {
        aim_btn.style.color = old_color;
        aim_btn.style.fontWeight = "bold";
        aim_btn.textContent = old_text;
      };
      setTimeout(changeColorBack, 1250);
    },

    /**
     * 切换按钮显示/隐藏状态
     * @param {String} aim_btn 按钮变量名
     * @returns 按钮元素的引用
     */
    toggleBtnStatus: function (aim_btn) {
      let btn = document.querySelector(`.${aim_btn.replace("_", "-")}`);
      let display = getComputedStyle(btn).display;
      // return;
      if (display === "none") {
        btn.style.display = "block";
      } else {
        btn.style.display = "none";
      }
      return btn;
    },

    /**
     * 根据canvas元素数量返回quality值
     * @param {Number} canvas_amount
     * @returns quality: Number
     */
    getQualityByCanvasAmount: function (canvas_amount) {
      // 如果有全局参数，优先用全局的
      if (window.img_quality !== undefined) {
        console.log(`image quality: ${window.img_quality * 100}%`);
        return window.img_quality;
      }
      // 否则用默认的
      let quality;
      if (canvas_amount <= 25) {
        quality = 1.0;
      } else if (25 < canvas_amount <= 50) {
        quality = 0.9;
      } else {
        quality = 0.8;
      }
      console.log(`image quality: ${quality * 100}%`);
      return quality;
    },

    /**
     * 挂载func到全局
     * @param {Function} func
     */
    globalFunc: function (func) {
      globalThis[func.name] = func;
    },

    /**
     * 用input框跳转到对应页码
     * @param {Element} cur_page 当前页码
     * @param {string | Number} aim_page 目标页码
     * @param {string} event_type 键盘事件类型："keyup" | "keypress" | "keydown"
     */
    jump2pageNo: function (cur_page, aim_page, event_type) {
      // 设置跳转页码为目标页码
      cur_page.value = (aim_page).toString();
      // 模拟回车事件来跳转
      let keyboard_event_enter = new KeyboardEvent(event_type, {
        bubbles: true,
        cancelable: true,
        keyCode: 13
      });
      cur_page.dispatchEvent(keyboard_event_enter);
    },

    /**
     * 在新标签页打开链接
     * @param {String} href
     */
    openInNewTab: function (href) {
      let link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.click();
    },

    /**
     * 滚动到页面底部
     */
    scrollToBottom: function () {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
      });
    },

    /**
     * 用try移除元素
     * @param {Element} element 要移除的元素
     */
    tryToRemoveElement: function (element) {
      try {
        element.remove();
      } catch (e) {
      }
    },

    /**
     * 用try移除若干元素
     * @param {Element[]} elements 要移除的元素列表
     */
    tryToRemoveElements: function (elements) {
      elements.forEach((elem) => {
        this.tryToRemoveElement(elem);
      });
    },

    /**
     * 用try移除 [元素列表1, 元素列表2, ...] 中的元素
     * @param {Array} elem_list_box 要移除的元素列表构成的列表
     */
    tryToRemoveSameElem: function (elem_list_box) {
      for (let elem_list of elem_list_box) {
        if (!elem_list) {
          continue;
        }
        for (let elem of elem_list) {
          try {
            elem.remove();
          } catch (e) {
            console.log();
          }
        }
      }
    },

    /**
     * 使文档在页面上居中
     * @param {String} selector 文档容器的css选择器
     * @param {String} default_offset 文档部分向右偏移的百分比（0-59）
     * @returns 偏移值是否合法
     */
    centerDoc: function (selector, default_offset) {
      let doc_main = document.querySelector(selector);
      let offset = window.prompt("请输入偏移百分位:", default_offset);
      // 如果输入的数字不在 0-59 内，提醒用户重新设置
      if (offset.length === 1 && offset.search(/[0-9]/) !== -1) {
        doc_main.style.marginLeft = offset + "%";
        return true;
      } else if (offset.length === 2 && offset.search(/[1-5][0-9]/) !== -1) {
        doc_main.style.marginLeft = offset + "%";
        return true
      } else {
        alert("请输入一个正整数，范围在0至59之间，用来使文档居中\n（不同文档偏移量不同，所以需要手动调整）");
        return false;
      }
    },

    /**
     * 调整按钮内文本
     * @param {String} aim_btn 按钮变量名
     * @param {String} new_text 新的文本，null则保留旧文本
     * @param {Boolean} recommend_btn 是否增加"（推荐）"到按钮文本
     * @param {Boolean} use_hint 是否提示"文档已经完全展开，可以导出"
     */
    modifyBtnText: function (aim_btn = "btn_2", new_text = null, recommend_btn = false, use_hint = true) {
      // 提示文档已经展开
      if (use_hint) {
        let hint = "文档已经完全展开，可以导出";
        alert(hint);
      }
      let btn = document.querySelector(`.${aim_btn.replace("_", "-")}`);
      // 要替换的文本
      if (new_text) {
        btn.textContent = new_text;
      }
      // 推荐按钮
      if (recommend_btn) {
        btn.textContent += "(推荐)";
      }
    },

    html2Canvases: async function (elem_list) {
      // 如果是空元素列表，返回null并终止函数
      if (elem_list.length === 0) {
        console.log("html2canvases was called, but no element is avaiable.");
        return null;
      }
      let tasks = []; //  存放异步任务
      let contents = []; //  存放canvas元素
      for (let elem of elem_list) {
        let task = html2canvas(elem).then((canvas) => {
          contents.push(canvas);
        });
        tasks.push(task);
      }
      // 等待全部page转化完成
      await Promise.all(tasks);
      return contents;
    },

    /**
     * 将html元素转为canvas再合并到pdf中，最后下载pdf
     * @param {Array} elem_list html元素列表
     * @param {String} title 文档标题
     */
    html2PDF: async function (elem_list, title = "文档") {
      // 如果是空元素列表，终止函数
      let _contents = this.html2Canvases(elem_list);
      if (_contents === null) {
        return;
      }
      _contents.then((contents) => {
        // 控制台检查结果
        console.log("生成的canvas元素如下：");
        console.log(contents);

        // 拿到canvas宽、高
        let model = elem_list[0];
        let width, height;
        width = model.offsetWidth;
        height = model.offsetHeight;
        // 打包为pdf
        this.saveCanvasesToPDF(contents, title, width, height);
      });
    },

    /**
     * 下载全部图片链接，适用性：爱问共享资料、得力文库
     * @param {string} selector 图形元素的父级元素
     */
    savePicUrls: function (selector) {
      let pages = document.querySelectorAll(selector);
      let pic_urls = [];

      for (let elem of pages) {
        let pic_obj = elem.children[0];
        let url = pic_obj.src;
        pic_urls.push(url);
      }
      let content = pic_urls.join("\n");
      // 启动下载
      this.createAndDownloadFile("urls.csv", content);
    },

    /**
     * 存储所有canvas图形为png到一个压缩包
     * @param {Array} node_list canvas元素列表
     * @param {String} title 文档标题
     */
    saveCanvasesToZip: function (node_list, title) {
      // canvas元素转为png图像
      // 所有png合并为一个zip压缩包
      let zip = new JSZip();
      let n = node_list.length;

      for (let i = 0; i < n; i++) {
        let canvas = node_list[i];
        let data_base64 = canvas.toDataURL();
        let blob = atob(data_base64.split(",")[1]);
        zip.file(`page-${i + 1}.png`, blob, {binary: true});
      }

      // 导出zip
      // promise.then(onCompleted, onRejected);
      zip.generateAsync({type: "blob"}).then(function (content) {
        // see filesaver.js
        console.log(content);
        saveAs(content, `${title}.zip`);
      });
    },

    /**
     * 将canvas转为jpeg，然后导出PDF
     * @param {Iterable<HTMLCanvasElement>} canavs_box canvas元素列表
     * @param {string} title 文档标题
     */
    saveCanvasesToPDF: function (canavs_box, title, width = 0, height = 0) {
      // 如果没有手动指定canvas的长宽，则自动检测
      if (!width && !height) {
        // 先获取第一个canvas用于判断竖向还是横向，以及得到页面长宽
        let first_canvas = canavs_box[0];

        if (first_canvas.width && parseInt(first_canvas.width) && parseInt(first_canvas.height)) {
          [width, height] = [first_canvas.width, first_canvas.height];
        } else {
          let [width_str, height_str] = [first_canvas.style.width.replace(/(px)|(rem)|(em)/, ""), first_canvas.style.height.replace(/(px)|(rem)|(em)/, "")];
          [width, height] = [parseInt(width_str), parseInt(height_str)];
        }
      }

      console.log(`canvas数据：宽: ${width}px，高: ${height}px`);
      // 如果文档第一页的宽比长更大，则landscape，否则portrait
      let orientation = width > height ? 'l' : 'p';
      // jsPDF的第三个参数为format，当自定义时，参数为数字数组。
      let pdf = new jspdf.jsPDF(orientation, 'px', [height, width]);

      // 保存每一页文档到每一页pdf
      let canvas_list = Array.from(canavs_box);
      let last_canvas = canvas_list.pop();
      canvas_list.forEach(canvas => {
        pdf.addImage(canvas, 'png', 0, 0, width, height);
        pdf.addPage();
      });
      // 添加尾页
      pdf.addImage(last_canvas, 'png', 0, 0, width, height);
      // 导出文件
      pdf.save(`${title}.pdf`);
    },

    /**
     * Image元素列表合并到一个PDF中
     * @param {NodeList} imgs Image元素列表
     * @param {String} title 文档名
     */
    imgs2pdf: function (imgs, title) {
      // 取得宽高
      let model = imgs[0];
      let width = model.offsetWidth;
      let height = model.offsetHeight;

      // 创建pdf
      let orientation = width > height ? 'l' : 'p';
      let pdf = new jspdf.jsPDF(orientation, 'px', [height, width]);

      // 添加图像到pdf
      imgs.forEach((img, index) => {
        pdf.addImage(img, 'PNG', 0, 0, width, height);
        // 如果当前不是文档最后一页，则需要添加下一个空白页
        if (index !== imgs.length - 1) {
          pdf.addPage();
        }
      });

      // 导出文件
      pdf.save(`${title}.pdf`);
    },


    /**
     * imageBitMap转canvas
     * @param {ImageBitmap} bmp
     * @returns {HTMLCanvasElement} canvas
     */
    bmpToCanvas: function (bmp) {
      let canvas = document.createElement("canvas");
      canvas.height = bmp.height;
      canvas.width = bmp.width;

      let ctx = canvas.getContext("bitmaprenderer");
      ctx.transferFromImageBitmap(bmp);
      return canvas;
    },

    /**
     * 下载可以简单直接请求的图片，合并到PDF并导出
     * @param {Iterable<string>} urls 图片链接列表
     * @param {string} title 文档名称
     */
    imgUrlsToPDF: async function (urls, title) {
      // 发起请求
      let tasks = new Set();
      Array.from(urls).forEach((url, i) => {
        tasks.add(
            (async () => {
              let resp = await fetch(url);
              return [i, await resp.blob()];
            })()
        );
      });

      // 接收响应
      let blob_items = await Promise.all(tasks);

      // 格式转换：img blob -> bmp
      let tasks2 = new Set();
      blob_items.map(
          (item, i) => {
            let blob = item[1];
            let bmp = createImageBitmap(blob);
            tasks2.add(
                (async () => [i, await bmp])()
            );
          }
      );

      // 等待格式转换完成
      let bmp_items = await Promise.all(tasks2);

      // 转为canvas
      let canvas_box = bmp_items.sort(
          (prev, next) => prev[0] - next[0]
      ).map(item => {
        let bmp = item[1];
        return this.bmpToCanvas(bmp);
      });

      // 导出PDF
      this.saveCanvasesToPDF(canvas_box, title);
    },

    /**
     * 取得elem的class为class_name的父级元素
     * @param {String} class_name
     * @param {Element} elem 起点元素
     * @param {object} JSobj 全局对象，需要有<iterator_count>计数器。默认为window.baiduJS。
     * @param {Boolean} miss 是否忽略递归计数器。默认false。如果启用请确保不会无限递归。
     * @returns {null | Element} parent_element
     */
    getParentByClassName: function (class_name, elem, JSobj, miss = false) {
      let parent = elem.parentElement;
      let iterator_count = JSobj.iterator_count;
      let now_name;

      try {
        now_name = parent.className;
      } catch (e) {
        JSobj.iterator_count = 0;
        // 没有父级元素了
        return "no parent node";
      }

      // 如果不忽略递归次数计数器
      if (!miss) {
        if (iterator_count > 9) {
          // 超过最大迭代次数，认为不存在，返回null
          JSobj.iterator_count = 0;
          return "over max iterator counts limit";
        } else {
          JSobj.iterator_count += 1;
        }
      }
      // 如果类名匹配，返回该节点
      if (now_name.split(" ").includes(class_name)) {
        iterator_count = 0;
        return parent;
      }
      return this.getParentByClassName(class_name, parent, JSobj);
    },

    /**
     * 将func绑定到window.onscroll，并设置触发频率
     * @param {Function} func scroll的监听函数
     * @param {Object} JSobj 全局对象，至少要有srcoll_count
     * @param {Number} useful_range 有效的触发范围，默认是10。即0-10次时触发函数。
     * @param {Number} wait_range 等待的范围，默认是110。即useful_range-110次不触发函数。
     * @param {String} hint 触发函数后的日志内容，默认为空字符串。
     * @param {Window} inner_window 特定的window对象，主要用于 iframe 情况。JSobj中必须有scrollFunc，在调用后会重新写入scrollFunc。
     */
    scrollFunc: function (func, JSobj, useful_range = 10, wait_range = 110, hint = "", inner_window = null) {
      if (JSobj.scroll_count === undefined) {
        alert(`${JSobj}的 scroll_count 属性不存在！检查单词拼写！`);
        return;
      }

      let new_func = (func, JSobj, useful_range, wait_range, hint) => {
        JSobj.scroll_count += 1;
        if (JSobj.scroll_count < useful_range) {
          func();
          console.log(hint);
        } else if (JSobj.scroll_count > wait_range) {
          JSobj.scroll_count = 0;
        }
      };
      // 如果没有指定的window对象，则使用默认的window
      if (!inner_window) {
        window.onscroll = () => {
          new_func(func, JSobj, useful_range, wait_range, hint);
        };
        return;
      }
      // 特定的window对象，一般用于iframe，追加scroll监听器
      let scrollFunc = () => {
        new_func(func, JSobj, useful_range, wait_range, hint);
      };
      JSobj.scrollFunc = scrollFunc;
      inner_window.addEventListener("scroll", scrollFunc, false);
    },

    /**
     * 创建5个按钮：展开文档、导出图片、导出PDF、未设定4、未设定5；默认均为隐藏
     */
    createBtns: function () {
      // 创建大容器
      let box = document.createElement("div");
      box.className = "wk-box";
      document.body.appendChild(box);

      // 创建按钮组
      let section = document.createElement("section");
      section.className = "btns_section";
      section.innerHTML = `
            <p class="logo_tit">Wenku Doc Downloader</p>
            <button class="btn-1">展开文档 😈</button>
            <button class="btn-2">未设定2</button>
            <button class="btn-3">未设定3</button>
            <button class="btn-4">未设定4</button>
            <button class="btn-5">未设定5</button>
        `;
      box.appendChild(section);

      // 添加隐藏/展示按钮
      // 隐藏【🙈】，展开【🐵】
      let hide_btn = document.createElement("p");
      hide_btn.className = "hide_btn_wk";
      hide_btn.textContent = "🐵";
      hide_btn.onclick = () => {
        // 显示 -> 隐藏
        if (getComputedStyle(section).display === "block") {
          section.style.display = "none";
          hide_btn.style.left = "20px";
          hide_btn.textContent = "🙈";
          // 隐藏 -> 显示
        } else {
          section.style.display = "block";
          hide_btn.style.left = "155px";
          hide_btn.textContent = "🐵";
        }
      };
      box.appendChild(hide_btn);

      // 设定样式
      let style = document.createElement("style");
      style.innerHTML = `
            .hide_btn_wk {
                position: fixed;
                left: 155px;
                top: 36%;
                user-select: none;
                font-size: large;
                z-index: 5001;
            }
            .btns_section{
                position: fixed;
                width: 154px;                
                left: 10px;
                top: 32%;
                background: #E7F1FF;
                border: 2px solid #1676FF;                
                padding: 0px 0px 10px 0px;
                font-weight: 600;
                border-radius: 2px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
                'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji',
                'Segoe UI Emoji', 'Segoe UI Symbol';
                z-index: 5000;
            }
            .logo_tit{
                width: 100%;
                background: #1676FF;
                text-align: center;
                font-size:12px ;
                color: #E7F1FF;
                line-height: 40px;
                height: 40px;
                margin: 0 0 16px 0;
            }

            .btn-1{
                display: block;
                width: 128px;
                height: 28px;
                background: linear-gradient(180deg, #00E7F7 0%, #FEB800 0.01%, #FF8700 100%);
                border-radius: 4px;
                color: #fff;
                font-size: 12px;
                border: none;
                outline: none;
                margin: 8px auto;
                font-weight: bold;
                cursor: pointer;
                opacity: .9;
            }
            .btn-2{
                display: none;
                width: 128px;
                height: 28px;
                background: #07C160;
                border-radius: 4px;
                color: #fff;
                font-size: 12px;
                border: none;
                outline: none;
                margin: 8px auto;
                font-weight: bold;
                cursor: pointer;
                opacity: .9;
            }
            .btn-3{
                display: none;
                width: 128px;
                height: 28px;
                background:#FA5151;
                border-radius: 4px;
                color: #fff;
                font-size: 12px;
                border: none;
                outline: none;
                margin: 8px auto;
                font-weight: bold;
                cursor: pointer;
                opacity: .9;
            }
            .btn-4{
                display: none;
                width: 128px;
                height: 28px;
                background: #1676FF;
                border-radius: 4px;
                color: #fff;
                font-size: 12px;
                border: none;
                outline: none;
                margin: 8px auto;
                font-weight: bold;
                cursor: pointer;
                opacity: .9;
            }
            .btn-5{
                display: none;
                width: 128px;
                height: 28px;
                background: #ff6600;
                border-radius: 4px;
                color: #fff;
                font-size: 12px;
                border: none;
                outline: none;
                margin: 8px auto;
                font-weight: bold;
                cursor: pointer;
                opacity: .9;
            }
            .btn-1:hover,.btn-2:hover,.btn-3:hover,.btn-4,.btn-5:hover{ opacity: .8;}
            .btn-1:active,.btn-2:active,.btn-3:active,.btn-4,.btn-5:active{ opacity: 1;}`;
      document.head.appendChild(style);

      // 根据配置选择：是否默认显示
      if (!globalThis._wk_on) {
        hide_btn.click();
      }
    }
  };

  /**
   * 清理百度文库页面的无关元素
   */
  function clearPage_Baidu() {
    let selectors = [
      "#hd, .aside, .reader-tools-bar-wrap, .sb-con, .bg-opacity",
      ".doc-tag-wrap, .doc-bottom-wrap, .ft, #ft, .crubms-wrap, .banner-ad",
      "#activity-tg, .top-ads-banner-wrap, .reader_ab_test, .tag-tips, .doc-value",
      ".owner-desc-wrap, a[title='全屏显示'], #next_doc_box, .fix-searchbar-wrap",
      ".hx-warp, .lazy-load, .no-full-screen, [class*=vip-pay-pop], .bottom-edge, .info",
      ".hx-recom-wrapper, .reader-topbar, #page-footer, .copyright-wrap",
      ".bg-theme-wap"
    ];
    let elem_list = document.querySelectorAll(selectors.join(", "));
    for (let elem of elem_list) {
      utils.tryToRemoveElement(elem);
    }
    let nut_selector = ".fix-searchbar-wrap, #hd, .try-end-fold-page";
    utils.forceHide(nut_selector);

    // 页边距调整
    // 顶部距离改为0
    let rc = document.querySelector("#reader-container");
    rc.style.paddingTop = "0";
    let cw = document.querySelector(".content-wrapper");
    cw.style.paddingTop = "0";
    // 底部距离改为0
    let foot = document.querySelector(".try-end-fold-page");
    foot.style.paddingBottom = "0";
    foot.style.height = "0";
  }


  /**
   * 调整页间距为 width px
   */
  function adjustPageGap() {
    let old_gap = window.baiduJS.page_gap;
    let hints = [
      `旧的页间距为 ${old_gap} px`,
      "请输入新的页间距(0-500的整数)：\n"
    ];
    let new_gap = prompt(hints.join("\n"));
    new_gap = parseInt(new_gap);

    // 创建空白段落节点充当间隔
    let div = document.createElement("div");
    // 取得实心填充物
    let block = document.querySelector("[id*=pageNo] canvas").cloneNode(true);
    block.style.height = `${new_gap}px`;
    // 创建间隔
    div.style.background = "rgb(255, 255, 255)";  // 页间距设置为白色
    div.appendChild(block);
    div.className = "page-gap";

    // 调整页间距
    document.querySelectorAll("[id*=pageNo]").forEach((elem) => {
      let next_elem = elem.nextElementSibling;

      if (next_elem === null) {
        return; // 最后一个节点后面无需间隔
      }

      let cls = next_elem.className;
      if (cls === "page-gap") {
        next_elem.style.height = `${new_gap}px`;
      } else {
        utils.insertAfter(div.cloneNode(true), elem);
      }
    });
    window.baiduJS.page_gap = new_gap;
    console.log(`页间距已经调整为：${new_gap} px`);
  }


  /**
   * 判断是否所有可预览页面都冻结了
   * @returns {Boolean}
   */
  function areAllFrozen() {
    let frozen = 0;
    document.querySelectorAll("[id*=pageNo] canvas").forEach((canvas) => {
      if (canvas.getAttribute("width") !== "0") {
        frozen += 1;
      }
    });
    if (frozen < window.free_page) {
      return false;
    }
    return true;
  }


  /**
   * 移除canvas上的id，切断bdimg.com/.../view/readerxxx.js对数据渲染的控制。适用于百度文库的文档
   */
  function freezeDocView() {
    document.querySelectorAll("[id*=pageNo] canvas").forEach((canvas) => {
      if (canvas.getAttribute("width") !== "0") {
        canvas.id = "";
      }
    });

    if (areAllFrozen()) {
      // 已经冻结完全部文档页元素，移除滚动事件的绑定函数
      console.log("wk: 文档页: 全部冻结完毕");
      window.baiduJS.finished = true;
      window.onscroll = () => {
      };
    }
  }


  /**
   * 优化阅读体验的零碎任务
   */
  function better() {
    /**
     * 内部主函数，便于捕获异常
     * 代码改自 https://greasyfork.org/zh-CN/scripts/438420
     */
    let _better = function () {
      let pageData = window.pageData;
      // 改为本地 VIP
      pageData.vipInfo.global_svip_status = 1;
      pageData.vipInfo.global_vip_status = 1;
      pageData.vipInfo.isVip = 1;
      pageData.vipInfo.isWenkuVip = 1;

      // 手机版优化
      if (pageData.appUniv) {
        // 取消百度文库对谷歌、搜狗浏览器 referrer 的屏蔽
        pageData.appUniv.blackBrowser = [];
        // 隐藏 APP 下载按钮
        pageData.viewBiz.docInfo.needHideDownload = true;
      }

      // 强制改变背景为中灰色
      document.querySelector("#app")
          .style.backgroundColor = "rgb(95, 99, 104)";
    };

    try {
      console.log("wk: 优化");
      _better();
    } catch (error) {
      console.log("wk: baiduWenku: better: main:");
      console.error(error);
    }
  }


  /**
   * 展开文档
   */
  function readAllOld() {
    better();
    let btn = document.querySelector(".read-all");
    if (!btn) {
      // 显示按钮
      utils.toggleBtnStatus("btn_1");
      utils.toggleBtnStatus("btn_2");
      utils.toggleBtnStatus("btn_3");
      // utils.toggleBtnStatus("btn_4");
    } else {
      btn.click();
    }
  }


  function getTips() {
    let hints = [
      `一共 ${window.all_page} 页, 免费预览 ${window.free_page} 页,`,
      "请优先尝试【导出图片链接】，如果不行再【打印页面到PDF】。",
      "!!由于百度改版，图片链接可能是假的，如若发生请尝试其他办法!!",
      "",
      "如果<免费预览页数>等于<总页数>,",
      "但点击展开文档, 却跳转到vip付费,",
      "请尝试:",
      "1. 清除全部cookies，刷新页面并登录账号",
      "2. 复制以下链接，并在【新标签页】中打开，然后尝试展开文档。",
      "如果还不行就没办法了。",
      "",
      "如果出现空白页，请浏览对应页面使其加载，然后再打印页面。",
      "页数超过20页时，打印预览明显缓慢，请耐心等待，真的只是很慢。",
      "",
      "页面间距通过按钮调整。",
      "页面宽度通过打印时缩放比调整。",
      "推荐缩放比: 114%",
      "",
      "打印时设置:",
      "更多设置 -> 缩放 -> 自定义",
      "选项 -> ☑ 背景图形",
    ];
    let url_no_params = window.location.href.replace(/[?].*/, "");
    prompt(hints.join("\n"), url_no_params);
    alert(
        [
          "只能导出可以【免费预览】的页面。",
          "脚本的能力是有限的，烦请谅解。",
          "",
          "百度文库会记住你打开文档的操作路径，如：",
          "百度搜索 -> 文档，或 文库搜索 -> 百度文档，",
          "百度会让通过特定路径打开免费文档的人必须付费，",
          "所以解决办法是复制刚才弹窗中的链接，",
          "新建标签页，粘贴链接，然后回车打开，这样的操作是零路径。",
          "",
          "此外，发现此脚本与【🔥🔥🔥文本选中复制🔥🔥🔥】冲突,",
          "应该是此脚本删去文档页id所导致的,",
          "暂无解决方案, 如需复制文字请禁用此脚本。"
        ].join("\n")
    );
  }


  /**
   * 清理页面，然后打印页面
   */
  function clearThenPrint() {
    // 清理页面
    clearPage_Baidu();
    // 调整文档内容的定位
    let content = document.querySelector(".left-wrapper");
    content.style.marginLeft = "0";
    // 打印页面
    utils.hideBtnThenPrint();
  }


  /**
   * 取得pageData接口中的urls并下载
   * @returns {Boolean} 是否成功下载(是否存在图片元素)
   */
  function downloadPicUrls() {
    let warn = () => {
      let hints = [
        "当前文档非ppt或pdf, 无法使用该功能。",
        "请在展开文档后使用【打印页面到PDF】"
      ];
      alert(hints.join("\n"));
    };

    let html_urls = window.pageData.readerInfo.htmlUrls;
    if (!html_urls) {
      warn();
      return false;
    }

    // pdf
    if (html_urls.png && html_urls.png.length > 0) {
      let urls = [];
      let pngs = html_urls.png;
      pngs.forEach((png) => {
        urls.push(png.pageLoadUrl);
      });
      utils.createAndDownloadFile("urls.csv", urls.join("\n"));
      return true;
    }
    // 非图形
    if (html_urls.length === undefined) {
      warn();
      return false;
    }
    // ppt
    utils.createAndDownloadFile("urls.csv", html_urls.join("\n"));
    return true;
  }


  /**
   * 百度文档下载策略
   */
  function baiduWenkuOld() {
    // 允许打印页面
    utils.allowPrint();
    better();

    // 绑定监听器给滚动。在滚动时冻结文档页面
    let log = "wk: 文档页: 冻结";
    utils.scrollFunc(freezeDocView, window.baiduJS, 50, 70, log);

    // 创建按钮
    utils.createBtns();
    // 按钮1: 展开预览
    utils.setBtnEvent(readAllOld, [], "btn_1");
    // 按钮2: 清理页面元素，打印页面
    utils.setBtnEvent(clearThenPrint, [], "btn_2", "打印页面到PDF");
    // 按钮3: 调整页间距（页宽由打印时的缩放比例控制）
    utils.setBtnEvent(adjustPageGap, [], "btn_3", "调整页间距");
    // 按钮4: 导出图片链接（如果文档是ppt或pdf）
    utils.setBtnEvent(downloadPicUrls, [], "btn_4", "导出图片链接");
    utils.toggleBtnStatus("btn_4");
    // 按钮5: 提示说明
    utils.setBtnEvent(getTips, [], "btn_5", "有问题点我");
    utils.toggleBtnStatus("btn_5");
  }


  /**
   * 居中百度文库文档
   */
  function centerDoc() {
    // 居中文档
    $(".content-wrapper")[0].style = `
        display: flex;
        flex-direction: row;
        justify-content: space-around;
    `.replace(/\s/g, "");

    $(".left-wrapper")[0].style = "margin: 0;";

    let academic = $(".doc-info-wrapper")[0];
    if (academic) {
      academic.style = "display: none;";
    }
  }


  function readAll$1() {
    let vip_read = $(".page-text")[0];
    if (!vip_read) {
      return;
    }

    let read_all = $(".read-all")[0];
    // read_all.style = "color: red; font-weight: bold;";
    read_all.textContent += "*";
    read_all.parentElement.onclick = () => {
      location.href = location.origin + location.pathname;
    };
  }


  function baiduWenku() {
    // 取得页码，创建全局对象
    window.free_page = window.pageData.readerInfo.freePage;
    window.all_page = window.pageData.readerInfo.page;
    window.baiduJS = {
      finished: false, // 文档页是否全部冻结
      free_page: window.free_page, // 免费页数
      all_page: window.all_page, // 全部页数
      scroll_count: 0, // 滚动事件触发次数
      page_gap: 0, // 页间距
      oldTech: baiduWenkuOld  // 旧版主函数入口
    };

    // 便捷选择器
    window.$ = (s) => {
      return document.querySelectorAll(s);
    };

    // 允许打印页面
    utils.allowPrint();
    better();

    // 居中文档
    centerDoc();

    // 增加预览功能
    setTimeout(readAll$1, 500);
  }

  /**
   * 多元素选择器
   * @param {string} s
   * @returns {NodeListOf<Element>} elements
   */
  let $$1 = (s) => {
    return document.querySelectorAll(s);
  };


  // 全局对象
  globalThis.doc88JS = {
    last_copy_time: 0  // 上一次 ctrl + c 的时间戳（毫秒）
  };


  /**
   * 展开道客巴巴的文档
   */
  function readAllDoc88() {
    // 获取“继续阅读”按钮
    let continue_btn = document.querySelector("#continueButton");
    // 如果存在“继续阅读”按钮
    if (continue_btn) {
      // 跳转到文末（等同于展开全文）
      let cur_page = document.querySelector("#pageNumInput");
      // 取得最大页码
      let page_max = cur_page.parentElement.textContent.replace(" / ", "");
      // 跳转到尾页
      utils.jump2pageNo(cur_page, page_max, "keypress");
      // 返回顶部
      setTimeout(utils.jump2pageNo(cur_page, "1", "keypress"), 1000);
    }
    // 文档展开后，显示按钮2、3
    else {
      // 隐藏按钮
      utils.toggleBtnStatus("btn_1");
      // 显示按钮
      utils.toggleBtnStatus("btn_2");
      utils.toggleBtnStatus("btn_3");
      utils.toggleBtnStatus("btn_4");
    }
  }


  /**
   * 隐藏搜索框
   */
  async function hideSearchBox() {
    let s = "#min-search-result";
    let hide = (elem) => {
      elem.style.display = "none";
    };
    utils.manipulateElem(s, hide);
  }


  /**
   * 移除vip复制弹窗
   */
  async function removeCopyPopup() {
    let s = "#ym-window";
    let remove = (elem) => {
      let popup = elem.parentElement;
      utils.tryToRemoveElement(popup);
    };
    utils.manipulateElem(s, remove);
  }


  /**
   * 隐藏选择文字的弹窗
   */
  async function hideSelectPopup() {
    let s = "#left-menu";
    let hide = (elem) => {
      elem.style.zIndex = -1;
    };
    utils.manipulateElem(s, hide);
  }


  /**
   * 只会执行一次的初始化任务
   */
  async function lazyService() {
    // 只允许执行一次
    let counter = Symbol.for("counter");
    if (globalThis[counter]) {
      return;
    }
    globalThis[counter] = true;

    // 初始化
    console.log("正在执行初始化任务");
    // 1. 隐藏选中文字的提示框
    hideSelectPopup();
    // 2. 隐藏搜索框
    hideSearchBox();
    // 3. 移除vip复制弹窗
    removeCopyPopup();
  }


  /**
   * 使用过时的execCommand复制文字
   * @param {string} text
   */
  function textToClipBoardOldTech(text) {
    let input = document.createElement("input");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }


  /**
   * 复制选中的文字
   * @returns
   */
  function copySelected() {
    // 执行一次初始化任务
    lazyService();

    // 尚未选中文字
    if (getComputedStyle($$1("#left-menu")[0]).display === "none") {
      console.log("尚未选中文字");
      return;
    }

    // 选中文字
    // 搜索文字，弹出搜索框
    let search = $$1("#lmenu_search")[0];
    search.click();
    // 取得input内容
    let input = $$1(".min-text input")[0];
    let text = input.value;
    // 输出到控制台和剪贴板
    console.log(text);
    if (!navigator.clipboard) {
      textToClipBoardOldTech(text);
      return;
    }
    navigator.clipboard.writeText(text).catch(textToClipBoardOldTech);
    // 清空input
    input.value = "";
  }


  /**
   * 捕获 ctrl + c 并关闭弹窗
   * @param {KeyboardEvent} keydown
   * @returns
   */
  function catchCtrlC(keydown) {
    // 判断是否为 ctrl + c
    if (!(keydown.code === "KeyC" && keydown.ctrlKey === true)) {
      return;
    }

    // 判断触发间隔
    let now = Date.now();

    // 距离上次小于1秒
    if (now - doc88JS.last_copy_time < 1000 * 1) {
      doc88JS.last_copy_time = now;
      return;
    }

    // 大于1秒
    // 刷新最近一次触发时间
    doc88JS.last_copy_time = now;
    // 复制文字
    copySelected();
  }


  /**
   * 道客巴巴文档下载策略
   */
  async function doc88() {
    // 创建脚本启动按钮1、2
    utils.createBtns();

    // 绑定主函数
    let prepare = function () {
      // 获取canvas元素列表
      let node_list = document.querySelectorAll(".inner_page");
      // 获取文档标题
      let title;
      if (document.querySelector(".doctopic h1")) {
        title = document.querySelector(".doctopic h1").title;
      } else {
        title = "文档";
      }
      return [node_list, title];
    };

    // btn_1: 展开文档
    utils.setBtnEvent(() => {
      readAllDoc88();
    }, [], "btn_1");

    // btn_2: 导出zip
    utils.setBtnEvent(() => {
      if (confirm("确定每页内容都加载完成了吗？")) {
        utils.saveCanvasesToZip(...prepare());
      }
    }, [], "btn_2", "导出图片到zip");

    // btn_3: 导出PDF
    utils.setBtnEvent(() => {
      if (confirm("确定每页内容都加载完成了吗？")) {
        utils.saveCanvasesToPDF(...prepare());
      }
    }, [], "btn_3", "导出图片到PDF");

    // btn_4: 复制选中文字
    utils.setBtnEvent(() => {
      copySelected();
      utils.modifyBtnText("btn_4", "复制成功！", false, false);
    }, [], "btn_4", "复制选中文字");
    // 为 ctrl + c 添加响应
    document.addEventListener("keydown", catchCtrlC);
  }

  // 绑定主函数
  function getCanvasList() {
    // 获取全部canvas元素，用于传递canvas元素列表给 btn_2 和 btn_3
    let parent_node_list = document.querySelectorAll(".hkswf-content");
    let node_list = [];
    for (let node of parent_node_list) {
      node_list.push(node.children[0]);
    }
    return node_list;
  }


  function prepare() {
    // 获取canvas元素列表
    let node_list = getCanvasList();
    // 获取文档标题
    let title;
    if (document.querySelector("h1 [title=doc]")) {
      title = document.querySelector("h1 [title=doc]").nextElementSibling.textContent;
    } else if (document.querySelector(".doc_title")) {
      title = document.querySelector(".doc_title").textContent;
    } else {
      title = "文档";
    }
    return [node_list, title];
  }


  // 判断是否有canvas元素
  function detectCanvas() {
    let haveCanvas = getCanvasList().length === 0 ? false : true;

    // 隐藏按钮
    utils.toggleBtnStatus("btn_1");
    // 显示按钮
    utils.toggleBtnStatus("btn_2");

    // 如果没有canvas元素，则认为文档页面由外链图片构成
    if (!haveCanvas) {
      // btn_2: 导出图片链接
      utils.setBtnEvent(() => {
        if (confirm("确定每页内容都加载完成了吗？")) {
          utils.savePicUrls("[id*=img_]");
        }
      }, [], "btn_2", "导出全部图片链接");
    } else {
      // 显示按钮3
      utils.toggleBtnStatus("btn_3");
      // btn_2: 导出zip
      utils.setBtnEvent(() => {
        if (confirm("确定每页内容都加载完成了吗？")) {
          utils.saveCanvasesToZip(...prepare());
        }
      }, [], "btn_2", "导出图片到zip");
      // btn_3: 导出PDF
      utils.setBtnEvent(() => {
        if (confirm("确定每页内容都加载完成了吗？")) {
          utils.saveCanvasesToPDF(...prepare());
        }
      }, [], "btn_3", "导出图片到PDF");
    }
  }


  /**
   * 豆丁文档下载策略
   */
  function docin() {
    // 创建脚本启动按钮
    utils.createBtns();

    // 隐藏底部工具栏
    document.querySelector("#j_select").click(); // 选择指针
    let tool_bar = document.querySelector(".reader_tools_bar_wrap.tools_bar_small.clear");
    tool_bar.style.display = "none";

    // btn_1: 判断文档类型
    utils.setBtnEvent(() => {
      utils.forceHide(".jz_watermark");
      detectCanvas();
    }, [], "btn_1", "判断文档类型");
  }

  /**
   * 爱问共享资料文档下载策略
   */
  function ishare() {
    // 创建按钮区
    utils.createBtns();

    // btn_1: 识别文档类型 -> 导出PDF
    utils.setBtnEvent(readAlliShare, [], "btn_1");
    // btn_2: 不支持爱问办公
    utils.setBtnEvent(() => null, [], "btn_2", "不支持爱问办公");
    utils.toggleBtnStatus("btn_4");
  }

  /**
   * 清理并打印得力文库的文档页
   */
  function printPageDeliwenku() {
    // 移除页面上的无关元素
    let selector = ".hr-wrap, #readshop, .nav_uis, .bookdesc, #boxright, .QQ_S1, .QQ_S, #outer_page_more, .works-manage-box.shenshu, .works-intro, .mt10.related-pic-box, .mt10.works-comment, .foot_nav, .siteInner";
    let elem_list = document.querySelectorAll(selector);
    for (let elem of elem_list) {
      utils.tryToRemoveElement(elem);
    }
    // 修改页间距
    let outer_pages = document.getElementsByClassName("outer_page");
    for (let page of outer_pages) {
      page.style.marginBottom = "20px";
    }
    // 使文档居中
    alert("建议使用:\n偏移量: 3\n缩放: 112\n请上下滚动页面，确保每页内容都加载完成以避免空白页\n如果预览时有空白页或文末有绿色按钮，请取消打印重试");
    if (!utils.centerDoc("#boxleft", "3")) {
      return; // 如果输入非法，终止函数调用
    }
    // 打印文档
    utils.hideBtnThenPrint();
  }


  /**
   * 点击“继续阅读”，适用性：得力文库
   */
  function readAllDeliwenku() {
    // 点击“同意并开始预览全文”
    let start_btn = document.getElementsByClassName("pre_button")[0];
    let display = start_btn.parentElement.parentElement.style.display;
    // 如果该按钮显示着，则点击，然后滚动至页面底部，最后终止函数
    if (!display) {
      start_btn.children[0].click();
      setTimeout(() => {
        scroll(0, document.body.scrollHeight);
      }, 200);
      return;
    }
    // 增强按钮点击效果
    utils.enhanceBtnClickReaction();

    let read_all_btn = document.getElementsByClassName("fc2e")[0];
    let display2 = read_all_btn.parentElement.parentElement.style.display;
    // 继续阅读
    if (display2 !== "none") {
      // 获取input元素
      let cur_page = document.querySelector("#pageNumInput");
      let page_old = cur_page.value;
      let page_max = cur_page.parentElement.nextElementSibling.textContent.replace(" / ", "");
      // 跳转到尾页
      utils.jump2pageNo(cur_page, page_max, "keydown");
      // 跳转回来
      utils.jump2pageNo(cur_page, page_old, "keydown");

      // 切换按钮准备导出
    } else {
      // 推荐导出图片链接
      utils.modifyBtnText("btn_2", null, true);
      // 隐藏按钮
      utils.toggleBtnStatus("btn_1");
      // 显示按钮
      utils.toggleBtnStatus("btn_2");
      utils.toggleBtnStatus("btn_3");
      // btn_3 橙色按钮
      utils.setBtnEvent(printPageDeliwenku, [], "btn_3", "打印页面到PDF");
    }
  }


  /**
   * 得力文库文档下载策略
   */
  function deliwenku() {
    // 创建脚本启动按钮1、2
    utils.createBtns();

    // btn_1: 展开文档
    utils.setBtnEvent(readAllDeliwenku, [], "btn_1");
    // btn_2: 导出图片链接
    utils.setBtnEvent(() => {
      if (confirm("确定每页内容都加载完成了吗？")) {
        utils.savePicUrls('.inner_page div');
      }
    }, [], "btn_2", "导出图片链接");

    // 尝试关闭页面弹窗
    try {
      document.querySelector("div[title=点击关闭]").click();
    } catch (e) {
      console.log(0);
    }
    // 解除打印限制
    utils.allowPrint();
  }

  function readAll360Doc() {
    // 展开文档
    document.querySelector(".article_showall a").click();
    // 隐藏按钮
    utils.toggleBtnStatus("btn_1");
    // 显示按钮
    utils.toggleBtnStatus("btn_2");
    utils.toggleBtnStatus("btn_3");
  }


  function saveText_360Doc() {
    // 捕获图片链接
    let images = document.querySelectorAll("#artContent img");
    let content = [];

    for (let i = 0; i < images.length; i++) {
      let src = images[i].src;
      content.push(`图${i + 1}，链接：${src}`);
    }
    // 捕获文本
    let text = document.querySelector("#artContent").textContent;
    content.push(text);

    // 保存纯文本文档
    let title = document.querySelector("#titiletext").textContent;
    utils.createAndDownloadFile(`${title}.txt`, content.join("\n"));
  }


  function printPage360Doc() {
    // # 清理并打印360doc的文档页
    // ## 移除页面上无关的元素
    let selector = ".fontsize_bgcolor_controler, .atfixednav, .header, .a_right, .article_data, .prev_next, .str_border, .youlike, .new_plbox, .str_border, .ul-similar, #goTop2, #divtort, #divresaveunder, .bottom_controler, .floatqrcode";
    let elem_list = document.querySelectorAll(selector);
    let under_doc_1, under_doc_2;
    try {
      under_doc_1 = document.querySelector("#bgchange p.clearboth").nextElementSibling;
      under_doc_2 = document.querySelector("#bgchange").nextElementSibling.nextElementSibling;
    } catch (e) {
      console.log();
    }
    // 执行移除
    for (let elem of elem_list) {
      utils.tryToRemoveElement(elem);
    }
    utils.tryToRemoveElement(under_doc_1);
    utils.tryToRemoveElement(under_doc_2);
    // 执行隐藏
    document.querySelector("a[title]").style.display = "none";

    // 使文档居中
    alert("建议使用:\n偏移量: 20\n缩放: 默认\n");
    if (!utils.centerDoc(".a_left", "20")) {
      return; // 如果输入非法，终止函数调用
    }
    // 隐藏按钮，然后打印页面
    utils.hideBtnThenPrint();
  }


  /**
   * 360doc个人图书馆下载策略
   */
  function doc360() {
    // 创建按钮区
    utils.createBtns();
    // btn_1: 展开文档
    utils.setBtnEvent(readAll360Doc, [], "btn_1");
    // btn_2: 导出纯文本
    utils.setBtnEvent(saveText_360Doc, [], "btn_2", "导出纯文本");
    // btn_3: 打印页面到PDF
    utils.setBtnEvent(() => {
      if (confirm("确定每页内容都加载完成了吗？")) {
        printPage360Doc();
      }
    }, [], "btn_3", "打印页面到PDF");
  }

  /**
   * 查找出所有未被捕获的页码，并返回列表
   * @returns 未捕获页码列表
   */
  function getMissedPages() {
    let all = []; // 全部页码
    for (let i = 0; i < window.mbaJS.max_page; i++) {
      all[i] = i + 1;
    }
    let missed = []; // 未捕获页码
    let possessed = Array.from(window.mbaJS.canvases_map.keys()); // 已捕获页面

    // 排除并录入未捕获页码
    for (let num of all) {
      if (!possessed.includes(`page${num}`)) {
        missed.push(num);
      }
    }
    return missed;
  }


  /**
   * 根据键中的id数字对map排序
   * @param {Map} elems_map
   * @returns sorted_map
   */
  function sortMapByID(elems_map) {
    // id形式：page2
    let elems_arr = Array.from(elems_map);
    elems_arr.sort((item1, item2) => {
      // 从key中取出id
      let id1 = parseInt(item1[0].replace("page", ""));
      let id2 = parseInt(item2[0].replace("page", ""));
      // 升序排序
      return id1 - id2;
    });
    // 返回排序好的map
    return new Map(elems_arr);
  }


  /**
   * 存储动态加载的canvas元素、textContent
   */
  function storeElements_MBA() {
    let canvases_map = window.mbaJS.canvases_map;
    let texts_map = window.mbaJS.texts_map;
    let quality = window.mbaJS.quality;

    document.querySelectorAll(".page[data-loaded=true]").forEach(
        (elem) => {
          let capture = (elem) => {
            // (1) 存储页面为canvas图形
            let canvas, data_base64;
            // 导出canvas数据防止丢失
            try {
              // 存储canvas
              canvas = elem.querySelector("canvas[id*=page]");
              if (window.mbaJS.only_text) {
                data_base64 = null;
              } else {
                data_base64 = canvas.toDataURL("image/jpeg", quality);
              }
            } catch (e) {
              // utils.sleep(500);
              return;
            }
            // 增量录入map
            let id = canvas.id; // id的形式：page2
            if (!canvases_map.has(id)) {
              canvases_map.set(id, data_base64);
            }
            // 确定canvas长宽
            if (!window.mbaJS.only_text && !window.mbaJS.width) {
              window.mbaJS.width = parseInt(canvas.width);
              window.mbaJS.height = parseInt(canvas.height);
            }

            // (2) 存储text
            let text = elem.textContent;
            if (!texts_map.has(id)) {
              texts_map.set(id, text);
            }
          };
          setTimeout(capture, 500, elem);
        });
    if (canvases_map.size === window.mbaJS.max_page) {
      // 根据id排序
      window.mbaJS.canvases_map = sortMapByID(window.mbaJS.canvases_map);
      window.mbaJS.texts_map = sortMapByID(window.mbaJS.texts_map);
      window.mbaJS.finished = true;
      window.onscroll = null;
    }
  }


  /**
   * 将canvas转为jpeg，然后导出PDF
   * @param {Array} base64_list canvas元素列表
   * @param {String} title 文档标题
   */
  function saveCanvasesToPDF_MBA(base64_list, title) {
    let width = window.mbaJS.width;
    let height = window.mbaJS.height;

    console.log(`canvas数据：宽: ${width}px，高: ${height}px`);
    // 如果文档第一页的宽比长更大，则landscape，否则portrait
    let orientation = width > height ? 'l' : 'p';
    let pdf = new jspdf.jsPDF(orientation, 'px', [height, width]);

    // 保存每一页文档到每一页pdf
    let i = 0;
    for (let base64 of base64_list) {
      i += 1;
      pdf.addImage(base64, 'JPEG', 0, 0, width, height);
      // 如果当前不是文档最后一页，则需要添加下一个空白页
      if (i < window.mbaJS.max_page) {
        pdf.addPage();
      }
    }
    // 导出文件
    pdf.save(`${title}.pdf`);
  }

  /**
   * 判断文档页是否收集完毕，当不行时给出提示
   * @returns boolean
   */
  function ready2use() {
    removeAds(); // 顺便清理广告
    // 如果是首次点击按钮，给出提示
    if (window.mbaJS.first_hint) {
      let hint = [
        "如果浏览速度过快，比如：",
        "当前页面还没完全加载好就滚动页面去看下一页",
        "那就极有可能导致导出的PDF有空白页或文本有缺漏",
        "由防范技术的干扰，该功能目前很不好用，见谅"
      ].join("\n");
      alert(hint);
      window.mbaJS.first_hint = false;
    }
    // 如果文档页没有收集完，给出提示
    if (!window.mbaJS.finished) {
      let hint = [
        "仍有内容未加载完，无法使用该功能",
        "建议从头到尾慢速地再浏览一遍",
        "以下是没有加载完成页面的页码：",
        getMissedPages().join(",")
      ];
      alert(hint.join("\n"));
      return false;
    }
    return true;
  }


  /**
   * 用捕获好的canvas转jpg，生成PDF
   * @returns
   */
  function canvas2PDF_mba() {
    if (!ready2use()) {
      return;
    }
    let canvases = window.mbaJS.canvases_map.values();
    // 导出PDF
    let title = document.title.split("-")[0].trim();
    saveCanvasesToPDF_MBA(canvases, title);
  }


  /**
   * 拼合捕获好的文本，保存到txt文件
   * @returns
   */
  function saveText_mba() {
    if (!ready2use()) {
      return;
    }
    let content = Array.from(window.mbaJS.texts_map.values());
    let title = document.title.split("-")[0].trim();
    utils.createAndDownloadFile(`${title}.txt`, content.join("\n"));
  }


  /**
   * 移除广告
   */
  function removeAds() {
    document.querySelectorAll(".doc-ad").forEach((ad_elem) => {
      utils.tryToRemoveElement(ad_elem);
    });
  }


  function mbalib_() {
    // 移除广告和左侧工具栏
    removeAds();
    let tool_bar = document.querySelector(".tool-bar");
    utils.tryToRemoveElement(tool_bar);

    // 创建按钮
    utils.createBtns();
    // 隐藏按钮
    utils.toggleBtnStatus("btn_1");
    // 显示按钮
    utils.toggleBtnStatus("btn_2");
    utils.toggleBtnStatus("btn_3");
    utils.toggleBtnStatus("btn_4");

    // 取得页数
    let max_page = parseInt(document.querySelector("#numPages").textContent.replace("/ ", ""));
    let quality = utils.getQualityByCanvasAmount(max_page);

    // 为导出内容提供全局变量，便于动态收集文档页元素的存取
    window.mbaJS = {
      max_page: max_page,
      texts_map: new Map(), // id: text
      canvases_map: new Map(), // id: canvas_data_base64
      quality: quality, // canvas转jpg的质量
      width: null, // canvas宽度（px）
      height: null,
      finished: false, // 是否收集完了全部文档页元素
      first_hint: true,
      scroll_count: 0, // 用于统计累计触发scroll的次数,
      only_text: false // 是否仅捕获文本
    };
    // 跟随浏览，动态收集页面元素
    window.onscroll = () => {
      storeElements_MBA();
    };
    // 跟随浏览，动态收集页面元素
    utils.scrollFunc(storeElements_MBA, window.mbaJS, 20, 50, "mba元素: 收集");
    // 绑定事件
    utils.setBtnEvent(saveText_mba, [], "btn_2", "导出纯文本(不稳定)");
    utils.setBtnEvent(canvas2PDF_mba, [], "btn_3", "导出PDF(不稳定)");

    // 根据页数决定按钮功能：<40页，导出文本+导出pdf，>40页：导出文本
    let btn_text, aim_btn, hint;
    if (max_page > 40) {
      btn_text = "失效说明";
      aim_btn = "btn_3";
      hint = [
        "页数超过40，脚本无效",
        "只能使用导出文本功能",
        "而此脚本会使页面内容加载明显变慢，建议禁用"
      ];
      utils.setBtnEvent(
          () => {
            utils.toggleBtnsSec();
            window.onscroll = null;
          },
          [],
          "btn_4",
          "临时禁用脚本"
      );
    } else {
      btn_text = "空白页说明";
      aim_btn = "btn_4";
      hint = [
        "导致空白页的原因如下",
        "加载该页的时间超过2秒 / 明显等待",
        "而此脚本会使页面内容加载明显变慢，如果影响严重请禁用"
      ];
    }

    utils.setBtnEvent(() => {
      alert(hint.join("\n"));
    }, [], aim_btn, btn_text);
  }


  function mbalib() {
    setTimeout(mbalib_, 2000);
  }

  /**
   * 判断是否进入预览模式
   * @returns Boolean
   */
  function isInPreview() {
    let p_elem = document.querySelector("#preview_tips");
    if (p_elem.style.display === "none") {
      return true;
    }
    return false;
  }


  /**
   * 判断是否展开了全文
   * @returns Boolean
   */
  function isNoMorePage() {
    let read_more = document.querySelector("#ntip2");
    if (read_more.style.display === "none") {
      return true;
    }
    return false;
  }


  /**
   * 确保进入预览模式
   */
  function ensureInPreview() {
    if (!isInPreview()) {
      // 如果没有进入预览，则先进入
      document.querySelector(".pre_button a").click();
      utils.sleep(500);
    }
  }


  /**
   * 展开全文预览，当展开完成后再次调用时，返回true
   * @returns
   */
  function unfoldAll() {
    ensureInPreview();
    if (isNoMorePage()) {
      // 如果全文展开了，则切换按钮，然后退出
      utils.toggleBtnStatus("btn_1");
      utils.toggleBtnStatus("btn_2");
      return true;
    }
    // 跳转到最后一页，以展开全文
    let cur_page = document.querySelector("#pageNumInput");
    utils.jump2pageNo(cur_page, "999", "keydown");
  }


  /**
   * 取得最大页码（最大20）
   * @returns {Number} 页码int
   */
  function getPageCounts$2() {
    let counts_str = document.querySelector(".counts").textContent;
    let counts = counts_str.match(/[0-9]{1,3}/)[0];
    if (counts > 20) {
      counts = 20; // 最多免费预览20页，所以设置最大页码20
    }
    return parseInt(counts);
  }


  /**
   * 取得全部文档页面的链接，返回urls；如果有页面未加载，则返回null
   * @returns Array | null
   */
  function getImgUrls() {
    let pages = document.querySelectorAll("[id*=pageflash_]");
    // 尚未浏览完全部页面，返回null
    if (pages.length < window.dugenJS.page_counts) {
      return null;
    }
    // 浏览完全部页面，返回urls
    let urls = [];
    pages.forEach((page) => {
      let url = page.querySelector("img").src;
      urls.push(url);
    });
    return urls;
  }


  /**
   * 返回当前未加载页面的页码
   * @returns not_loaded
   */
  function getNotloadedPages() {
    // 已经取得的页码
    let pages = document.querySelectorAll("[id*=pageflash_]");
    let loaded = new Set();
    pages.forEach((page) => {
      let id = page.id.split("_")[1];
      id = parseInt(id);
      loaded.add(id);
    });
    // 未取得的页码
    let not_loaded = [];
    for (let i = 1; i <= window.dugenJS.page_counts; i++) {
      if (!loaded.has(i)) {
        not_loaded.push(i);
      }
    }
    return not_loaded;
  }


  function WantImgUrls() {
    let res = getImgUrls();
    // 页面尚未加载完
    if (res === null) {
      let hints = [
        "尚未加载完全部页面",
        "以下页面需要浏览并加载：",
        getNotloadedPages().join(",")
      ];
      alert(hints.join("\n"));
      return;
    }
    // 页面全部加载完
    utils.createAndDownloadFile("urls.csv", res.join("\n"));
  }


  /**
   * dugen文档下载策略
   */
  function dugen() {
    ensureInPreview();
    // 全局对象
    window.dugenJS = {
      page_counts: getPageCounts$2() // 最大页码(int)
    };

    // 创建按钮区
    utils.createBtns();

    // 绑定监听器
    // 按钮1：展开文档
    utils.setBtnEvent(unfoldAll, [], "btn_1");
    // 按钮2：导出图片链接
    utils.setBtnEvent(WantImgUrls, [], "btn_2", "导出图片链接");
  }

  /**
   * 取得文档类型
   * @returns {String} 文档类型str
   */
  function getDocType() {
    let type_elem = document.querySelector(".title .icon.icon-format");
    // ["icon", "icon-format", "icon-format-doc"]
    let cls_str = type_elem.classList[2];
    // "icon-format-doc"
    let type = cls_str.split("-")[2];
    return type;
  }


  /**
   * 判断文档类型是否为type_list其中之一
   * @returns 是否为type
   */
  function isTypeof(type_list) {
    let type = getDocType();
    if (type_list.includes(type)) {
      return true;
    }
    return false;
  }


  /**
   * 判断文档类型是否为PPT
   * @returns 是否为PPT
   */
  function isPPT() {
    return isTypeof(["ppt", "pptx"]);
  }


  /**
   * 判断文档类型是否为Excel
   * @returns 是否为Excel
   */
  function isEXCEL() {
    return isTypeof(["xls", "xlsm", "xlsx"]);
  }


  /**
   * 取得最大页码
   * @returns {Number} 最大页码
   */
  function getPageCounts$1() {
    let page_counts_str = document.querySelector(".intro-list").textContent;
    let page_counts = parseInt(page_counts_str.match(/(?<=约 )[0-9]{1,3}(?=页)/)[0]);
    return page_counts;
  }


  /**
   * 取得未加载页面的页码
   * @param {Set} loaded 已加载的页码集合
   * @returns {Array} not_loaded 未加载页码列表
   */
  function getNotLoaded(loaded) {
    let not_loaded = [];
    let page_counts = window.book118JS.page_counts;
    for (let i = 1; i <= page_counts; i++) {
      if (!loaded.has(i)) {
        not_loaded.push(i);
      }
    }
    return not_loaded;
  }


  /**
   * 取得全部文档页的url
   * @returns [<是否全部加载>, <未加载页码列表>|<urls列表>]
   */
  function getUrls() {
    let loaded = new Set(); // 存储已加载页面的页码
    let urls = []; // 存储已加载页面的图形src
    // 收集已加载页面的url
    document.querySelectorAll("div[data-id]").forEach((div) => {
      let src = div.querySelector("img").src;
      if (src) {
        // "1": "https://view-cache.book118.com/..."
        loaded.add(parseInt(div.getAttribute("data-id")));
        urls.push(src);
      }
    });
    // 如果所有页面加载完毕
    if (loaded.size === window.book118JS.page_counts) {
      return [true, urls];
    }
    // 否则收集未加载页面的url
    return [false, getNotLoaded(loaded)];
  }


  /**
   * 展开全文
   */
  function readAll() {
    window.preview.jump(999);
  }


  /**
   * btn_2: 导出图片链接
   */
  function wantUrls() {
    let [flag, res] = getUrls();
    // 页面都加载完毕，下载urls
    if (flag) {
      utils.createAndDownloadFile("urls.csv", res.join("\n"));
      return;
    }
    // 没有加载完，提示出未加载好的页码
    let hints = [
      "仍有页面没有加载",
      "请浏览并加载如下页面：",
      res.join(",")
    ];
    alert(hints.join("\n"));
  }


  /**
   * 打开PPT预览页面
   */
  function openPPTpage() {
    window.preview.getSrc();
    let openPPT = () => {
      let ppt_src = document.querySelector("iframe.preview-iframe").src;
      utils.openInNewTab(ppt_src);
      window.preview.close();
    };
    setTimeout(openPPT, 1000);
  }


  /**
   * 原创力文档(非PPT或Excel)下载策略
   */
  function book118_CommonDoc() {
    // 创建全局对象
    window.book118JS = {
      doc_type: getDocType(),
      page_counts: getPageCounts$1()
    };

    // 处理非PPT文档
    // 创建按钮组
    utils.createBtns();
    // 绑定监听器到按钮
    // 按钮1：展开文档
    utils.setBtnEvent(() => {
      readAll();
      utils.toggleBtnStatus("btn_1");
      utils.toggleBtnStatus("btn_2");
    }, [], "btn_1");
    // 按钮2：导出图片链接
    utils.setBtnEvent(wantUrls, [], "btn_2", "导出图片链接");
  }


  /**
   * 取得PPT文档最大页码
   * @returns PPT文档最大页码int
   */
  function getPageCountsPPT() {
    let counts_str = document.querySelector("#PageCount").textContent;
    let counts = parseInt(counts_str);
    // console.log(`get page counts: ${counts}`);
    return counts;
  }


  /**
   * 取得当前的页码
   * @returns {Number} this_page
   */
  function getThisPage() {
    let this_page = document.querySelector("#PageIndex").textContent;
    this_page = parseInt(this_page);
    return this_page;
  }


  /**
   * 点击下一动画直到变成下一页，再切回上一页
   * @param {Number} next_page 下一页的页码
   */
  async function __nextFrameUntillNextPage(next_page) {
    // 如果已经抵达下一页，则返回上一页
    let this_page = getThisPage();

    // 最后一页直接退出
    if (next_page > getPageCountsPPT()) {
      return;
    }
    // 不是最后一页，但完成了任务
    else if (this_page === next_page) {
      document.querySelector(".btmLeft").click();
      await utils.sleepAsync(500);
      return;
    }
    // 否则递归的点击下一动画
    document.querySelector(".btmRight").click();
    await utils.sleepAsync(500);
    await __nextFrameUntillNextPage(next_page);
  }


  /**
   * 确保当前页面是最后一帧动画
   */
  async function ensurePageLoaded() {
    // 取得当前页码和下一页页码
    let this_page = getThisPage();
    let next_page = this_page + 1;
    // 开始点击下一页按钮，直到变成下一页，再点击上一页按钮来返回
    await __nextFrameUntillNextPage(next_page);
  }


  /**
   * （异步）转换当前视图为canvas，添加到book118JS.canvases中。在递归终止时显示btn_2。
   */
  async function docView2Canvas() {
    await ensurePageLoaded();
    // 取得页码
    let cur_page = getThisPage();
    // 取得视图元素，计数从0开始
    let doc_view = document.querySelector(`#view${cur_page - 1}`);
    // 转化为canvas
    let canvas_promise = html2canvas(doc_view);
    console.log(canvas_promise); // 打印信息以检查状况

    await canvas_promise.then((canvas) => {
      // 保存canvas到全局对象
      window.book118JS.canvases.push(canvas);
      // 打印日志
      console.log(`wk: ${cur_page} complete`);
    });

    // 如果到最后一页
    let page_counts = getPageCountsPPT();
    // console.log(`docView2Canvas: cur_page: ${cur_page}, page_counts: ${page_counts}`);
    if (cur_page === page_counts) {
      // 终止递归，并且显示导出PDF按钮
      utils.toggleBtnStatus("btn_2");
      return;
    }
    // 否则下一次递归（继续捕获下一页）
    document.querySelector(".pgRight").click();
    await utils.sleepAsync(500);
    await docView2Canvas();
  }


  /**
   * 将捕获的canvases合并并导出为pdf
   * @returns
   */
  function canvases2pdf() {
    // 已经捕获的页面数量
    let stored_amount = window.book118JS.canvases.length;
    // 总页面数量
    let page_counts = window.book118JS.page_counts;
    // 校验数量
    let diff = page_counts - stored_amount;
    if (diff > 0) {
      alert(`缺失了 ${diff} 页，可以过一会再点击该按钮试试。`);
      if (!confirm("是否仍要导出PDF？")) {
        // 不坚持导出PDF的情况
        return;
      }
    }
    // 导出PDF
    let canvases = window.book118JS.canvases;
    // 取得宽高
    let model = canvases[0];
    let width = model.width;
    let height = model.height;
    // 取得标题然后导出pdf
    utils.saveCanvasesToPDF(canvases, "原创力PPT文档", width, height);
  }


  /**
   * 原创力文档(PPT)下载策略
   */
  function book118_PPT() {
    // 创建全局对象
    window.book118JS = {
      page_counts: getPageCountsPPT(),
      canvases: [] // 存储每页文档转化的canvas
    };

    // 创建按钮区
    utils.createBtns();
    // 绑定监听器到按钮1
    utils.setBtnEvent(() => {
      let hints = [
        "正在为文档“截图”，请耐心等待过程完成，不要操作",
        "“截图”会有额外一层黑边，原因未知，暂无法处理，烦请谅解"
      ];
      alert(hints.join("\n"));
      // 隐藏按钮1
      utils.toggleBtnStatus("btn_1");
      // 开始捕获页面（异步）
      docView2Canvas(window.book118JS.page_counts);
    }, [], "btn_1", "捕获页面");
    // 为按钮2绑定监听器
    utils.setBtnEvent(canvases2pdf, [], "btn_2", "导出PDF");
  }


  /**
   * 取得当前页面的excel，返回csv string
   * @returns {String} csv
   */
  function excel2CSV() {
    let table = [];
    let rows = document.querySelectorAll("tr[id]");

    // 遍历行
    for (let row of rows) {
      let csv_row = [];
      // 遍历列（单元格）
      for (let cell of row.querySelectorAll("td[class*=fi], td.tdrl")) {
        // 判断单元格是否存储图片
        let img = cell.querySelector("img");
        if (img) {
          // 如果是图片，保存图片链接
          csv_row.push(img.src);
        } else {
          // 否则保存单元格文本
          csv_row.push(cell.textContent);
        }
      }
      table.push(csv_row.join(","));
    }

    let csv = table.join("\n");
    csv = csv.replace(/\n{2,}/g, "\n");
    return csv;
  }


  /**
   * 下载当前表格内容，保存为csv（utf-8编码）
   */
  function wantEXCEL() {
    let file_name = "原创力表格_UTF-8.csv";
    utils.createAndDownloadFile(file_name, excel2CSV());
  }


  /**
   * 在Excel预览页面给出操作提示
   */
  function help() {
    let hints = [
      "【导出表格到CSV】只能导出当前sheet，",
      "如果有多张sheet请在每个sheet上用按钮分别导出CSV。",
      "CSV是一种简单的表格格式，可以被Excel打开，",
      "并转为 xls 或 xlsx 格式存储，",
      "但CSV本身不能存储图片，所以用图片链接代替，请自行下载图片",
      "",
      "本功能导出的CSV文件无法直接用Excel打开，因为中文会乱码。",
      "有两个办法：",
      "1. 打开Excel，选择【数据】，选择【从文本/CSV】，",
      "  选择文件，【文件原始格式】选择【65001: Unicode(UTF-8)】，选择【加载】。",
      "2. 用【记事本】打开CSV文件，【文件】->【另存为】->",
      "  【编码】选择【ANSI】->【保存】。现在可以用Excel直接打开它了。"
    ];
    alert(hints.join("\n"));
  }


  /**
   * 原创力文档(EXCEL)下载策略
   */
  function book118_EXCEL() {
    // 创建按钮区
    utils.createBtns();
    // 绑定监听器到按钮
    utils.setBtnEvent(wantEXCEL, [], "btn_1", "导出表格到CSV");
    utils.setBtnEvent(help, [], "btn_2", "使用说明");
    // 显示按钮
    utils.toggleBtnStatus("btn_2");
  }


  /**
   * 打开Excel预览页面
   */
  function openEXCELpage() {
    openPPTpage();
  }


  /**
   * 原创力文档下载策略
   */
  function book118() {
    let host = window.location.hostname;
    if (host === 'max.book118.com') {
      if (isEXCEL()) {
        utils.createBtns();
        utils.setBtnEvent(openEXCELpage, [], "btn_1", "导出EXCEL");
      } else if (isPPT()) {
        utils.createBtns();
        utils.setBtnEvent(openPPTpage, [], "btn_1", "导出PPT");
      } else {
        book118_CommonDoc();
      }
    } else if (host === "view-cache.book118.com") {
      book118_PPT();
    } else if (host.match(/view[0-9]{1,3}.book118.com/)) {
      book118_EXCEL();
    } else {
      console.log(`wk: Unknown host: ${host}`);
    }
  }

  // test url: https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=E86BBCE32DA8E67F3DA04ED98F2465DB


  /**
   * 绘制0x0的bmp, 作为请求失败时返回的page
   * @returns {Promise<ImageBitmap>} blank_page
   */
  async function blankBMP() {
    let canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = [0, 0];
    return createImageBitmap(canvas);
  }


  /**
   * resp导出bmp
   * @param {string} page_url
   * @param {Promise<Response> | ImageBitmap} pms_or_bmp
   * @returns {Promise<ImageBitmap>} page
   */
  async function respToPage(page_url, pms_or_bmp) {
    let center = globalThis.gb688JS;
    // 此时是bmp
    if (pms_or_bmp instanceof ImageBitmap) {
      return pms_or_bmp;
    }

    // 第一次下载, 且无人处理
    if (!center.pages_status.get(page_url)) {
      // 处理中, 设为占用
      center.pages_status.set(page_url, 1);

      // 处理
      let resp;
      try {
        resp = await pms_or_bmp;
      } catch (err) {
        console.log("下载页面失败");
        console.error(err);
        return blankBMP();
      }

      let page_blob = await resp.blob();
      let page = await createImageBitmap(page_blob);
      center.pages.set(page_url, page);

      // 处理结束, 设为释放
      center.pages_status.set(page_url, 0);
      return page;
    }

    // 有人正在下载且出于处理中
    while (center.pages_status.get(page_url)) {
      await utils.sleepAsync(500);
    }
    return center.pages.get(page_url);
  }


  /**
   * 获得PNG页面
   * @param {string} page_url
   * @returns {Promise<ImageBitmap>} bmp
   */
  async function getPage(page_url) {
    // 如果下载过, 直接返回缓存
    let pages = globalThis.gb688JS.pages;
    if (pages.has(page_url)) {
      return respToPage(page_url, pages.get(page_url));
    }

    // 如果从未下载过, 就下载
    let resp = fetch(page_url, {
      "headers": {
        "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "proxy-connection": "keep-alive"
      },
      "referrer": location.href,
      "referrerPolicy": "strict-origin-when-cross-origin",
      "body": null,
      "method": "GET",
      "mode": "cors",
      "credentials": "include"
    });
    pages.set(page_url, resp);
    return respToPage(page_url, resp);
  }


  /**
   * 返回文档页div的裁切和粘贴位置信息: [[cut_x, cut_y, paste_x%, paset_y%],...]
   * @param {HTMLDivElement} page_div 文档页元素
   * @returns {Array<Array<number>>} positions
   */
  function getPostions(page_div) {
    let positions = [];

    Array.from(page_div.children).forEach(span => {
      // 'pdfImg-3-8' -> {left: 30%; top: 80%;}
      let paste_pos = span.className.split("-").slice(1).map(
          v => parseInt(v) / 10
      );
      // '-600px 0px' -> [600, 0]
      let cut_pos = span.style.backgroundPosition.split(" ").map(
          v => Math.abs(parseInt(v))
      );
      positions.push([...cut_pos, ...paste_pos]);
    });
    return positions;
  }


  /**
   * 取得文档页的图像url
   * @param {HTMLDivElement} page_div
   * @returns {string} url
   */
  function getPageURL(page_div) {
    // 拿到目标图像url
    let path = location.pathname.split("/").slice(0, -1).join("/");
    let prefix = location.origin + path + "/";
    let url = page_div.getAttribute("bg");
    if (!url) {
      // 'url("viewGbImg?fileName=VS72l67k0jw5g3j0vErP8DTsnWvk5QsqnNLLxaEtX%2FM%3D")'
      url = page_div.children[0].style.backgroundImage.split('"')[1];
    }
    return prefix + url;
  }


  /**
   * 下载目标图像并拆解重绘, 返回canvas
   * @param {number} i 第 i 页 (从0开始)
   * @param {HTMLDivElement} page_div
   * @returns {Promise<Array>} [页码, Canvas]
   */
  async function getAndDrawPage(i, page_div) {
    // 拿到目标图像
    let url = getPageURL(page_div);
    let page = await getPage(url);

    // 绘制空白A4纸背景
    let [page_w, page_h] = [1190, 1680];
    let bg = document.createElement("canvas");
    bg.width = page_w;  // 注意canvas作为取景框的大小
    bg.height = page_h;  // 如果不设置等于一个很小的取景框

    let bg_ctx = bg.getContext("2d");
    bg_ctx.fillStyle = "white";
    bg_ctx.fillRect(0, 0, page_w, page_h);

    // 逐个区块剪切取出并粘贴
    // wk$("#viewer .page").forEach(page_div => {
    getPostions(page_div).forEach(pos => {
      bg_ctx.drawImage(
          page,  // image source
          pos[0],  // source x
          pos[1],  // source y
          120,  // source width
          169,  // source height
          pos[2] * page_w,  // destination x = left: x%
          pos[3] * page_h,  // destination y = top: y%
          120,  // destination width
          169  // destination height
      );
    });
    // });
    return [i, bg];
  }


  /**
   * 页面批量请求、裁剪重绘, 合成PDF并下载
   */
  async function turnPagesToPDF() {
    // 渲染每页
    let tasks = [];
    wk$("#viewer .page").forEach((page_div, i) => {
      tasks.push(
          getAndDrawPage(i, page_div)
      );
    });

    // 等待每页渲染完成后，排序
    let results = await Promise.all(tasks);
    results.sort((prev, next) => prev[0] - next[0]);

    // 合并为PDF并导出
    utils.saveCanvasesToPDF(
        results.map(item => item[1]),
        // '在线预览|GB 14023-2022'
        document.title.split("|")[1]
    );
  }


  /**
   * 提示预估下载耗时，然后下载
   */
  function hintThenDownload$1() {
    // '/93'
    let page_num = parseInt(wk$("#numPages")[0].textContent.slice(1));
    let estimate = Math.ceil(page_num / 3);
    alert(`页数: ${page_num}，预计花费: ${estimate}秒；如遇网络异常可能更久\n请勿反复点击按钮；如果无法导出请 QQ 群反馈`);
    turnPagesToPDF();
  }


  /**
   * gb688文档下载策略
   */
  async function gb688() {
    // 创建全局对象
    globalThis.gb688JS = {
      pages: new Map(),  // {url: bmp}
      pages_status: new Map()  // {url: 0或1} 0释放, 1占用
    };

    // 创建按钮区
    utils.createBtns();
    // 绑定监听器
    // 按钮1：导出PDF
    turnPagesToPDF = await utils.recTime(turnPagesToPDF);
    utils.setBtnEvent(hintThenDownload$1, [], "btn_1", "导出PDF");
  }

  function getPageCounts() {
    // " / 39"
    let counts_str = wk$(".counts")[0].textContent.split("/")[1];
    let counts = parseInt(counts_str);
    return counts > 20 ? 20 : counts;
  }


  /**
   * 返回图片基础路径
   * @returns {string} base_url
   */
  function getImgBaseURL() {
    return wk$("#dp")[0].value;
  }


  function* genImgURLs() {
    let counts = getPageCounts();
    let base_url = getImgBaseURL();
    for (let i = 1; i <= counts; i++) {
      yield base_url + `${i}.gif`;
    }
  }


  /**
   * 下载图片，转为canvas，合并为PDF并下载
   */
  function fetchThenExportPDF() {
    let url_vendor = genImgURLs();
    // db2092-2014-河北特种设备使用安全管理规范_安全文库网safewk.com
    let title = document.title.split("_")[0];
    return utils.imgUrlsToPDF(url_vendor, title);
  }


  /**
   * 提示预估下载耗时，然后下载
   */
  async function hintThenDownload() {
    let hint = [
      "只能导出可预览的页面(最多20页)",
      "请勿短时间反复点击按钮，导出用时大约不到 10 秒",
      "点完后很久没动静请至 QQ 群反馈"
    ];
    alert(hint.join("\n"));
    await fetchThenExportPDF();
  }


  /**
   * safewk文档下载策略
   */
  async function safewk() {
    // 创建按钮区
    utils.createBtns();
    // 绑定监听器
    // 按钮1：导出PDF
    hintThenDownload = await utils.recTime(hintThenDownload);
    utils.setBtnEvent(hintThenDownload, [], "btn_1", "导出PDF");
  }

  /**
   * 主函数：识别网站，执行对应文档下载策略
   */
  function main() {
    // 显示当前位置
    let host = window.location.host;
    console.log(`当前host: ${host}`);
    // 挂载工具包到全局
    window.user_utils = utils;
    console.log("wk: user_utils已经挂载到全局");

    // 附加任务
    // utils.globalFunc(HD); // 全局设置高清图片的函数

    // 主任务
    if (host.includes("docin.com")) {
      docin();
    } else if (host === "swf.ishare.down.sina.com.cn") {
      ishareData();
    } else if (host.includes("ishare.iask")) {
      ishare();
    } else if (host === "www.deliwenku.com") {
      deliwenku();
    } else if (host === "www.doc88.com") {
      doc88();
    } else if (host === "www.360doc.com") {
      doc360();
    } else if (host === "wenku.baidu.com") {
      baiduWenku();
    } else if (host === "doc.mbalib.com") {
      mbalib();
    } else if (host === "www.dugen.com") {
      dugen();
    } else if (host === "c.gb688.cn") {
      gb688();
    } else if (host === "www.safewk.com") {
      safewk();
    } else if (host.includes("book118.com")) {
      book118();
    } else {
      console.log("匹配到了无效网页");
    }
  }

  let options = {
    fast_mode: false,
    activation_test: false,
    show_buttons: true
  };

  globalThis._wk_on = options.show_buttons;

  if (options.cli_mode) {
    (() => {
      loadExternalScripts();
      setTimeout(main, 2000);
      return;
    })();
  }

  if (options.activation_test) {
    alert(`Wenku Doc Downloader 已经生效！\n当前网址：\n${window.location.host}`);
  }

  if (options.fast_mode) {
    main();
  } else {
    window.onload = main;
  }

})();
