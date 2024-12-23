// ==UserScript==
// @name              跳板机登录
// @namespace         http://howe.com
// @version           4.1
// @author            howe
// @description       本脚本是用于堡垒机的自动登录、跳板机的自动登录、网厅信息注入及其他功能。需要事先配置方可使用。
// @include           *://24.*
// @include           *://ybj.shanxi.gov.cn/ybfw/*
// @include           *://*huaweicitycloud.com/*
// @require           https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @require           https://cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2/11.14.5/sweetalert2.min.js
// @require           https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js
// @require           https://cdnjs.cloudflare.com/ajax/libs/keymaster/1.6.1/keymaster.min.js
// @require           https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js
// @resource          swalStyle https://cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2/11.14.5/sweetalert2.css
// @run-at            document-body
// @grant             GM_openInTab
// @grant             GM_setValue
// @grant             GM_getValue
// @grant             GM_registerMenuCommand
// @grant             GM_getResourceText
// @icon              https://www.huawei.com/favicon.ico
// @license           GPL-3.0-only
// ==/UserScript==

$(function () {
  'use strict';

  const customClass = {
    container: 'panai-container',
    popup: 'panai-popup'
  };

  let toast = Swal.mixin({
    toast: true,
    position: 'top',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: false,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  let util = {
    keyInput(id, data) {
      var dom = document.querySelector(`#${id}`)
      if (dom) {
        var evt = new InputEvent('input', {
          inputType: 'insertText',
          data: 'st',
          dataTransfer: null,
          isComposing: false
        });
        dom.value = data;
        dom.dispatchEvent(evt);
      } else {
        util.keyInput(id, data)
      }
    },

    decrypt(s, isToken) {
      util.clog(`解密入参：${s}`)
      let key = "i1dS4PJXv612krF0"
      if (isToken) {
        key = "SiIiqxyoDXuxbnGv"
      }
      if (!s) {
        return ""
      }
      var e = CryptoJS.enc.Utf8.parse(key);
      var a = CryptoJS.AES.decrypt(s, e, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });
      var decrypt = CryptoJS.enc.Utf8.stringify(a).toString()
      util.clog(`解密出参：${decrypt}`)
      return decrypt.toString();
    },

    formatTime(time) {
      var date = new Date(time);
      let Y = date.getFullYear() + '-';
      let M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-';
      let D = (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + ' ';
      let h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':';
      let m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + ':';
      let s = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();
      util.clog(Y + M + D + h + m + s);
      return Y + M + D + h + m + s
    },

    clog(c) {
      console.group('[跳板机登录插件日志]');
      console.log(c)
      console.groupEnd();
    },

    getValue(name) {
      return GM_getValue(name);
    },

    setValue(name, value) {
      GM_setValue(name, value);
      toast.fire({
        toast: true,
        position: 'top',
        showCancelButton: false,
        showConfirmButton: false,
        title: "设置项保存成功",
        icon: 'success',
        timer: 1000,
        customClass
      })
    },

    sleep(time) {
      return new Promise((resolve) => setTimeout(resolve, time));
    },

    addStyle(id, tag, css) {
      tag = tag || 'style';
      let doc = document, styleDom = doc.getElementById(id);
      if (styleDom) return;
      let style = doc.createElement(tag);
      style.rel = 'stylesheet';
      style.id = id;
      tag === 'style' ? style.innerHTML = css : style.href = css;
      document.head.appendChild(style);
    },

    isHidden(el) {
      try {
        return el.offsetParent === null;
      } catch (e) {
        return false;
      }
    },

  };
  let addAdditionalContent = {
    addEmpInfo() {
      var autoInject = util.getValue('setting_auto_inject_information')
      if (!autoInject) {
        toast.fire({
          toast: true,
          position: 'top',
          showCancelButton: false,
          showConfirmButton: false,
          title: "单位信息注入功能没有开启，如需开启请点击设置开启",
          icon: 'error',
          timer: 2000,
          customClass
        })
        return
      }
      const href = window.location.href
      let injectInformationList = JSON.parse(util.getValue("inject_information_list"))
      let has = false
      for (let item of injectInformationList) {
        if (href.includes(item.keywords)) {
          has = true
          let empInsuInfo = this.getEmpInsuInfo()
          if (empInsuInfo) {
            Swal.fire({
              title: '当前单位信息',
              html: empInsuInfo,
              showCloseButton: true,
              showCancelButton: false,
              showConfirmButton: false,
              confirmButtonText: '关闭',
              width: '800px',
              customClass
            }).then((res) => {
            });
          } else {
            toast.fire({
              toast: true,
              position: 'top',
              showCancelButton: false,
              showConfirmButton: false,
              title: "未获取到单位信息",
              icon: 'error',
              timer: 2000,
              customClass
            })
          }
        }
      }
      if (!has) {
        toast.fire({
          toast: true,
          position: 'top',
          showCancelButton: false,
          showConfirmButton: false,
          title: "该地址没有单位信息，如需添加请点击设置添加",
          icon: 'error',
          timer: 2000,
          customClass
        })
      }
    },
    getEmpInsuInfo() {
      let str = "<table border='1' id='addEmpInfo'>"
      str += "<tr>" +
          "    <th>名</th>" +
          "    <th>值</th>" +
          "  </tr>"
      let insuStr = window.localStorage.getItem("InsuEmpInfo")
      if (insuStr) {
        const insuEmpInfo = JSON.parse(insuStr)
        for (let item in insuEmpInfo) {
          var name = dic.getEmpInsuDic().get(item)
          if (!name) {
            continue
          }
          str += `<tr><td>${item}(${name ? name : ''})</td><td>`
          switch (item) {
            case 'empNo':
              str += `${util.decrypt(insuEmpInfo[item], false)}`
              break
            case 'aprvEstaDate':
            case 'empInsuDate':
              str += `${util.formatTime(insuEmpInfo[item])}`
              break
            default:
              str += `${insuEmpInfo[item]}`
              break
          }
          str += "</td></tr>"
        }
      }
      let isInsured = window.localStorage.getItem("isInsured")
      if (isInsured == null) {
        isInsured = "无数据"
      }
      str += `<tr><td>是否参保</td><td style="table-layout:fixed; word-break:break-all">${isInsured}</td></tr>`
      let isUploadCommitment = window.localStorage.getItem("isUploadCommitment")
      if (isUploadCommitment == null) {
        isUploadCommitment = "无数据"
      }
      str += `<tr><td>是否传过承诺书</td><td style="table-layout:fixed; word-break:break-all">${isUploadCommitment}</td></tr>`
      str += `<tr><td>accessToken(前)</td><td style="table-layout:fixed; word-break:break-all">${$.cookie("service-mall-accesstoken")}</td></tr>`
      str += `<tr><td>accessToken(后)</td><td>${util.decrypt($.cookie("service-mall-accesstoken"), true)}</td></tr>`
      str += "</table>"
      return str
    },
  };

  let dic = {
    getEmpInsuDic() {
      const insuMap = new Map()
      insuMap.set('poolareaNo', '统筹区')
      insuMap.set('clctWay', '征收方式')
      insuMap.set('empAddr', '单位地址')
      insuMap.set('uscc', 'USCC')
      insuMap.set('empInsuStas', '单位参保状态2-正常，3暂停，4-终止')
      insuMap.set('empName', '单位名称')
      insuMap.set('empNo', '单位编号')
      insuMap.set('empInsuDate', '单位参保时间')
      insuMap.set('empMgtType', '单位_管理_类型')
      insuMap.set('maxAcctprd', '最大做账期')
      insuMap.set('insutype', '险种类型')
      insuMap.set('insuAdmdvs', '医保区划')
      return insuMap
    }
  };

  let login = {
    inputDialogPass(username, password) {
      let howeUser = "howeUser"
      let howePass = "howePass"
      let cmd = 'div.yab-input-layout:contains("资源账户")'
      var text = $(cmd).text().trim()
      if (text) {
        let user = $(`${cmd} input`)
        user.attr("id", howeUser)
        util.keyInput(howeUser, username)
        util.clog("输入账号成功")

        var pass = $('div.yab-input-layout:contains("密码") input')
        pass.attr("type", "text")
        pass.attr("id", howePass)
        util.keyInput(howePass, password)
        util.clog(`输入密码成功${password}`)

        util.clog('点击登录')
        $('.footer [type="button"]:contains("确定")').click()
        util.clog("登录成功")
      } else {
        util.clog("密码没找到，递归")
        setTimeout(function () {
          login.inputDialogPass(username, password)
        }, 200)
      }
    },
    maximizeWindow() {
      var autoMaxEnabled = util.getValue('setting_auto_maximize')
      if (!autoMaxEnabled) {
        return
      }
      const href = window.location.href
      let maximizeWindowsList = JSON.parse(util.getValue("maximize_windows_list"))
      for (let item of maximizeWindowsList) {
        if (href.includes(item.addr)) {
          var full = $('.toolBox:last>.rightButton:first> button')
          var auto = $('.yab-drop-down-cell:contains("自适应")')
          if (auto.text()) {
            full.on("click", function () {
              auto.click()
              setTimeout(function () {
                $('.el-message-box button:last').click()
              }, 200)
            })
            full.click()
          }
        }
      }
    },
    loginWindows() {
      const href = window.location.href
      var loginWindowsEnabled = util.getValue('setting_auto_login_windows')
      let windowsList = JSON.parse(util.getValue("windows_list"))
      for (let item of windowsList) {
        if (loginWindowsEnabled && href.includes(item.addr)) {
          Swal.fire({
            type: 'question',
            icon: 'question',
            text: "是否自动登录" + item.ip + "？",
            showCloseButton: true,
            showCancelButton: true,
            showConfirmButton: true,
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            customClass
          }).then((res) => {
            if (res.value) {
              login.doLoginWindows(item.username, item.password, item.ip)
            }
          });
        }
      }
    },
    doLoginWindows(username, password, ip) {
      util.clog("开始登录")
      let cmd = `tr.el-table__row`
      var t = $(cmd).text()
      if (t) {
        var length = $(cmd).length
        for (let i = 0; i < length; i++) {
          let text = $(cmd + `:eq(${i}) .is-left:eq(1)`).text()
          util.clog(`循环第${i}个，地址为${text}`)
          if (text.includes(ip)) {
            util.clog("找到了，点击打开弹窗")
            $(cmd + `:eq(${i}) .is-left:eq(5) > div > div > div`).click()
            util.clog("打开弹窗了")
            break
          }
        }
        login.inputDialogPass(username, password)
      } else {
        util.clog("地址没找到，递归")
        toast.fire({
          toast: true,
          position: 'top',
          showCancelButton: false,
          showConfirmButton: false,
          title: "地址没找到，请手动登录一次",
          icon: 'success',
          timer: 2000,
          customClass
        })
      }
    },
    loginBaoLei() {
      const href = window.location.href
      var loginBaoLeiEnabled = util.getValue('setting_auto_login_bao_lei')
      let baoLeiList = JSON.parse(util.getValue("bao_lei_list"))
      for (let item of baoLeiList) {
        if (loginBaoLeiEnabled && href.includes(item.addr)) {
          Swal.fire({
            type: 'question',
            icon: 'question',
            text: "是否自动登录" + item.username + "？",
            showCloseButton: true,
            showCancelButton: true,
            showConfirmButton: true,
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            customClass
          }).then((res) => {
            if (res.value) {
              login.doLoginBaoLei(item.username, item.password)
            }
          });
        }
      }
    },
    doLoginBaoLei(username, password) {
      var loginBtn = $('[huawei="true"]:first button :contains("登录")')
      if (loginBtn.text()) {
        util.clog("开始登录堡垒机")
        $('input[name="username"]').val(username)
        util.clog("输入堡垒机账号成功")
        $('input[name="pwd"]').val(password)
        util.clog("输入堡垒机密码成功")
        $(`.loginByUsername-cell .el-checkbox__input.is-checked input.el-checkbox__original :contains("记住登录名")`).click()
        util.clog("点击记住登录名成功")
        loginBtn.click()
        util.clog("堡垒机登录成功")
      } else {
        toast.fire({
          toast: true,
          position: 'top',
          showCancelButton: false,
          showConfirmButton: false,
          title: "请等待页面加载完成再点击",
          icon: 'success',
          timer: 2000,
          customClass
        })
        login.loginBaoLei()
      }
    },
    loginConsole() {
      const href = window.location.href
      var loginConsoleEnabled = util.getValue('setting_auto_login_console')
      let consoleList = JSON.parse(util.getValue("console_list"))
      for (let item of consoleList) {
        if (loginConsoleEnabled && href.includes(item.addr)) {
          var child0 = item.child[0]
          let child1 = item.child[1]
          Swal.fire({
            type: 'question',
            icon: 'question',
            text: "请选择一个需要登录的环境",
            showCloseButton: true,
            showCancelButton: true,
            showConfirmButton: true,
            confirmButtonText: child0.desc + '环境',
            cancelButtonText: child1.desc + '环境',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            customClass
          }).then((res) => {
            if (res.value) {
              login.doLoginConsole(child0.username, child0.email, child0.password)
            } else if (res.dismiss.includes("cancel")) {
              login.doLoginConsole(child1.username, child1.email, child1.password)
            }
          });
        }
      }
    },
    doLoginConsole(username, email, password) {
      //1. 判断当前是子账户还是主账户
      let title = $(`.loginTypeNoSelected:first`).text().trim()
      util.clog("title===" + title)
      if (!title) {
        setTimeout(function () {
          login.loginConsole(username, email, password)
        }, 300)
        return
      }

      if (title.includes("帐户登录")) {
        // toast.fire({
        //   toast: true,
        //   position: 'top',
        //   showCancelButton: false,
        //   showConfirmButton: false,
        //   title: "请手动切换到子用户登录",
        //   icon: 'success',
        //   timer: 2000,
        //   customClass
        // })
        $(`#subUserLogin`).click()
        // setTimeout(function () {
        //   login.loginConsole(username, email, password)
        // }, 2000)
        // return
      }
      //2. 输入三个值

      let usernameId = "usernameId"
      let emailId = "emailId"
      let passwordId = "passwordId"
      let usernameCmd = `input.tiny-input-text:first`
      let emailCmd = `input.tiny-input-text:eq(1)`
      let passwordCmd = `input.tiny-input-text:last`

      $(usernameCmd).attr("id", usernameId)
      $(emailCmd).attr("id", emailId)
      $(passwordCmd).attr("id", passwordId)

      util.keyInput(usernameId, username)
      util.clog("输入账号成功")
      util.keyInput(emailId, email)
      util.clog("输入email成功")
      util.keyInput(passwordId, password)
      util.clog("输入密码成功")
      $(`#checkArea`).click()
      util.clog("点击记住登录名成功")

      //3. 点击登录
      let loginBtnCmd = `#loginBtn`
      $(loginBtnCmd).click()
    }

  };

  let main = {
    // 初始化配置数据
    initValue() {
      let value = [{
        name: 'bao_lei_list',
        value: '[{"addr":"https://127.0.0.1/#/login","username":"username","password":"password" }]'
      }, {
        name: 'windows_list',
        value: '[{"addr":"https://127.0.0.1/#/desktop","ip":"127.0.0.1:8080","username":"username","password":"password"}]'
      }, {
        name: 'maximize_windows_list',
        value: '[{"addr":"127.0.0.1/connect"}]'
      }, {
        name: 'inject_information_list',
        value: '[{"keywords":"/hallUnit"}]'
      }, {
        name: 'console_list',
        value: '[{"addr":"xxx.com","child":[{"desc":"生产","username":"SXYB","email":"yy06","password":"12345"},{"desc":"测试","username":"SXYB","email":"yy06","password":"12345"}]},{"addr":"xxx.com","child":[{"desc":"生产","username":"SXYB","email":"yy06","password":"12345"},{"desc":"测试","username":"SXYB","email":"yy06","password":"12345"}]}]'
      }, {
        name: 'setting_auto_login_bao_lei',
        value: false
      }, {
        name: 'setting_auto_login_windows',
        value: false
      }, {
        name: 'setting_auto_login_console',
        value: false
      }, {
        name: 'setting_auto_maximize',
        value: false
      }, {
        name: 'setting_auto_inject_information',
        value: true
      }];

      value.forEach((v) => {
        if (util.getValue(v.name) === undefined) {
          util.setValue(v.name, v.value);
        }
      });
    },

    // 监听选择事件
    addPageListener() {
      document.addEventListener("mouseup", this.smartIdentify.bind(this), true);
      document.addEventListener("keydown", this.pressKey.bind(this), true);
    },

    addHotKey() {
      key('f11', function () {
        login.maximizeWindow()
        return false
      });
    },

    //切换使能
    toggleEnableFunc(key) {
      let res = Swal.fire({
        showCancelButton: true,
        title: '确定要切换功能状态？',
        icon: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        customClass
      }).then(res => {
        if (res.value) {
          let value = !util.getValue(key)
          util.setValue(key, value)
          let title = "该功能已切换为："
          if (value) {
            title += "开启状态"
          } else {
            title += "关闭状态"
          }
          toast.fire({
            toast: true,
            position: 'top',
            showCancelButton: false,
            showConfirmButton: false,
            title: title,
            icon: 'success',
            timer: 1000,
            customClass
          })

          setTimeout(function () {
            history.go(0);
          }, 1000)
        }
      });
    },

    //显示设置
    showSettingBox() {
      let html = `<div style="font-size: 1em;">
                    <div style="height: 100px">
                        <div style="width: 40%;float: left;">
                              <label class="panai-setting-label" style="border-bottom: 1px solid">堡垒机自动登录<input type="checkbox" id="A-Bao-Lei" ${util.getValue('setting_auto_login_bao_lei') ? 'checked' : ''} class="panai-setting-checkbox"></label>
                              <label class="panai-setting-label" style="border-bottom: 1px solid">跳板机自动登录<input type="checkbox" id="A-Windows" ${util.getValue('setting_auto_login_windows') ? 'checked' : ''}
                              class="panai-setting-checkbox"></label>
                        </div >
                        <div style="width: 20%;"></div>
                        <div style="width: 40%;float: right;">
                              <label class="panai-setting-label" style="border-bottom: 1px solid">F11自动最大化<input type="checkbox" id="A-Max" ${util.getValue('setting_auto_maximize') ? 'checked' : ''}
                              class="panai-setting-checkbox"></label>
                              <label class="panai-setting-label" style="border-bottom: 1px solid">网厅自动注入信息<input type="checkbox" id="A-Inject" ${util.getValue('setting_auto_inject_information') ? 'checked' : ''}
                              class="panai-setting-checkbox"></label>
                        </div>
                    </div>
                    <div style="height: 100px">
                        <div style="width: 40%;float: left;">
                              <label class="panai-setting-label" style="border-bottom: 1px solid">Console自动登录<input type="checkbox" id="A-Console" ${util.getValue('setting_auto_login_console') ? 'checked' : ''} class="panai-setting-checkbox"></label>
                        </div >
                        <div style="width: 20%;"></div>
                        <div style="width: 40%;float: right;">
                        </div>
                    </div>
                    <label><span>下面的设置项，请拷贝出去修改再粘贴回来。Json在线格式化：<a href="https://www.bejson.com/">https://www.bejson.com/</a></span></label>
                    
                    <label class="panai-setting-label" id="A-BaoLei-List-Wrapper" ><span>堡垒机列表</span>
                    <textarea id="A-BaoLei-List" cols="80" rows="5">${util.getValue('bao_lei_list')}</textarea>
                    </label>
                    <label class="panai-setting-label" id="A-Windows-List-Wrapper" ><span>跳板机列表</span>
                    <textarea id="A-Windows-List" cols="80" rows="5">${util.getValue('windows_list')}</textarea>
                    </label>
                    <label class="panai-setting-label" id="A-Console-List-Wrapper" ><span>Console列表</span>
                    <textarea id="A-Console-List" cols="80" rows="5">${util.getValue('console_list')}</textarea>
                    </label>
                    <label class="panai-setting-label" id="A-Max-List-Wrapper" ><span>F11最大化列表</span>
                    <textarea id="A-Max-List" cols="80" rows="5">${util.getValue('maximize_windows_list')}</textarea>
                    </label>
                    <label class="panai-setting-label" id="A-Inject-List-Wrapper" ><span>网厅注入信息列表</span>
                    <textarea id="A-Inject-List" cols="80" rows="5">${util.getValue('inject_information_list')}</textarea>
                    </label>
                  </div>`;
      Swal.fire({
        title: '设置',
        html,
        showCloseButton: true,
        confirmButtonText: '保存',
        width: '60%',
        customClass
      }).then((res) => {
        res.isConfirmed && history.go(0);
      });

      document.getElementById('A-Bao-Lei').addEventListener('change', (e) => {
        util.setValue('setting_auto_login_bao_lei', e.target.checked);
      });
      document.getElementById('A-Windows').addEventListener('change', (e) => {
        util.setValue('setting_auto_login_windows', e.target.checked);
      });
      document.getElementById('A-Console').addEventListener('change', (e) => {
        util.setValue('setting_auto_login_console', e.target.checked);
      });
      document.getElementById('A-Max').addEventListener('change', (e) => {
        util.setValue('setting_auto_maximize', e.target.checked);
      });
      document.getElementById('A-Inject').addEventListener('change', (e) => {
        util.setValue('setting_auto_inject_information', e.target.checked);
      });
      document.getElementById('A-BaoLei-List').addEventListener('change', (e) => {
        util.setValue('bao_lei_list', e.target.value);
        document.getElementById('A-BaoLei-List').innerText = e.target.value;
      });
      document.getElementById('A-Windows-List').addEventListener('change', (e) => {
        util.setValue('windows_list', e.target.value);
        document.getElementById('A-Windows-List').innerText = e.target.value;
      });
      document.getElementById('A-Console-List').addEventListener('change', (e) => {
        util.setValue('console_list', e.target.value);
        document.getElementById('A-Console-List').innerText = e.target.value;
      });
      document.getElementById('A-Max-List').addEventListener('change', (e) => {
        util.setValue('maximize_windows_list', e.target.value);
        document.getElementById('A-Max-List').innerText = e.target.value;
      });
      document.getElementById('A-Inject-List').addEventListener('change', (e) => {
        util.setValue('inject_information_list', e.target.value);
        document.getElementById('A-Inject-List').innerText = e.target.value;
      });
    },

    registerMenuCommand() {
      GM_registerMenuCommand('👀 堡垒机自动登录：【' + util.getValue('setting_auto_login_bao_lei') + '】', () => {
        this.toggleEnableFunc('setting_auto_login_bao_lei');
      });
      GM_registerMenuCommand('👀 跳板机自动登录：【' + util.getValue('setting_auto_login_windows') + '】', () => {
        this.toggleEnableFunc('setting_auto_login_windows');
      });
      GM_registerMenuCommand('👀 Console自动登录：【' + util.getValue('setting_auto_login_console') + '】', () => {
        this.toggleEnableFunc('setting_auto_login_console');
      });
      GM_registerMenuCommand('👀 F11自动最大化：【' + util.getValue('setting_auto_maximize') + '】', () => {
        this.toggleEnableFunc('setting_auto_maximize');
      });
      GM_registerMenuCommand('👀 网厅自动注入信息：【' + util.getValue('setting_auto_inject_information') + '】', () => {
        this.toggleEnableFunc('setting_auto_inject_information');
      });
      GM_registerMenuCommand('⚙️ 设置', () => {
        this.showSettingBox();
      });
      GM_registerMenuCommand('⚙️ 显示当前单位信息', () => {
        addAdditionalContent.addEmpInfo()
      });
    },

    addPluginStyle() {
      let style = `
                .panai-container { z-index: 99999!important }
                .panai-popup { font-size: 14px !important }
                .panai-setting-label { display: flex;align-items: center;justify-content: space-between;padding-top: 20px; }
                .panai-setting-checkbox { width: 16px;height: 16px; padding-block-start:20px;}
            `;

      if (document.head) {
        util.addStyle('swal-pub-style', 'style', GM_getResourceText('swalStyle'));
        util.addStyle('panai-style', 'style', style);
      }

      const headObserver = new MutationObserver(() => {
        util.addStyle('swal-pub-style', 'style', GM_getResourceText('swalStyle'));
        util.addStyle('panai-style', 'style', style);
      });
      headObserver.observe(document.head, {childList: true, subtree: true});
    },

    execCommand() {
      login.loginBaoLei()
      login.loginWindows()
      login.loginConsole()
    },

    init() {
      util.clog("开始")
      this.initValue();
      this.addPluginStyle();
      this.addHotKey();
      // this.addPageListener();
      this.registerMenuCommand();
      this.execCommand();
    },
  }

  main.init();
})
