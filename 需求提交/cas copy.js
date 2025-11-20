// ==UserScript==
// @name         BOS批量需求功能
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  在需求管理和待办任务之间添加批量需求按钮
// @author       You
// @include        *://172.18.18.135*
// @grant        none
// ==/UserScript==

(function () {
  ("use strict");

  // 等待页面加载完成
  // 侧边栏一出现就插按钮，不用等整张页面 load 完
  const tryInsert = setInterval(() => {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      clearInterval(tryInsert);
      addBatchDemandButton();
    }
  }, 50);

  // 添加批量需求按钮函数
  function addBatchDemandButton() {
    // 查找侧边栏
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) {
      console.log("未找到侧边栏元素");
      return;
    }

    // 查找需求管理菜单项
    const demandItem = sidebar.querySelector("li.layui-nav-item");
    if (!demandItem) {
      console.log("未找到需求管理菜单项");
      return;
    }

    // 创建新的菜单项
    const batchDemandItem = document.createElement("li");
    batchDemandItem.className = "layui-nav-item";

    // 创建链接
    const batchDemandLink = document.createElement("a");
    batchDemandLink.href = "javascript:";
    batchDemandLink.dataset.id = "batch_demand_btn";
    batchDemandLink.dataset.title =
      '<span class="iconfont icon-zhaoxuqiu"></span>&nbsp;批量需求';
    batchDemandLink.dataset.type = "custom";
    batchDemandLink.innerHTML =
      '<span class="iconfont icon-zhaoxuqiu"></span>&nbsp;批量需求';

    // 添加点击事件
    batchDemandLink.addEventListener("click", function () {
      showModal();
    });

    // 将链接添加到菜单项
    batchDemandItem.appendChild(batchDemandLink);

    // 插入到需求管理和待办任务之间
    demandItem.parentNode.insertBefore(batchDemandItem, demandItem.nextSibling);

    console.log("批量需求按钮添加成功");
  }

  // 显示弹窗函数
  function showModal() {
    // 检查是否已经存在弹窗
    let modal = document.getElementById("batchDemandModal");
    if (!modal) {
      // 创建弹窗背景
      modal = document.createElement("div");
      modal.id = "batchDemandModal";
      modal.style.position = "fixed";
      modal.style.top = "0";
      modal.style.left = "0";
      modal.style.width = "100%";
      modal.style.height = "100%";
      modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      modal.style.zIndex = "9999";
      modal.style.display = "flex";
      modal.style.justifyContent = "center";
      modal.style.alignItems = "center";

      // 创建弹窗内容
      const modalContent = document.createElement("div");
      modalContent.style.backgroundColor = "#fff";
      modalContent.style.width = "90%";
      modalContent.style.maxWidth = "1200px";
      modalContent.style.height = "80%";
      modalContent.style.maxHeight = "800px";
      modalContent.style.borderRadius = "8px";
      modalContent.style.padding = "20px";
      modalContent.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
      modalContent.style.display = "flex";
      modalContent.style.flexDirection = "column";

      // 创建弹窗头部
      const modalHeader = document.createElement("div");
      modalHeader.style.display = "flex";
      modalHeader.style.justifyContent = "space-between";
      modalHeader.style.alignItems = "center";
      modalHeader.style.marginBottom = "16px";

      const modalTitle = document.createElement("h3");
      modalTitle.textContent = "批量需求";
      modalTitle.style.margin = "0";

      // 创建关闭按钮
      const closeButton = document.createElement("button");
      closeButton.textContent = "×";
      closeButton.style.border = "none";
      closeButton.style.backgroundColor = "transparent";
      closeButton.style.fontSize = "24px";
      closeButton.style.cursor = "pointer";
      closeButton.style.color = "#666";
      closeButton.style.width = "32px";
      closeButton.style.height = "32px";
      closeButton.style.display = "flex";
      closeButton.style.justifyContent = "center";
      closeButton.style.alignItems = "center";
      closeButton.style.borderRadius = "4px";
      closeButton.style.transition = "all 0.3s";

      closeButton.addEventListener("mouseenter", function () {
        this.style.backgroundColor = "#f0f0f0";
        this.style.color = "#333";
      });

      closeButton.addEventListener("mouseleave", function () {
        this.style.backgroundColor = "transparent";
        this.style.color = "#666";
      });

      // 添加关闭事件
      closeButton.addEventListener("click", function () {
        closeModal();
      });

      // 将标题和关闭按钮添加到头部
      modalHeader.appendChild(modalTitle);
      modalHeader.appendChild(closeButton);

      // 创建弹窗主体
      const modalBody = document.createElement("div");
      modalBody.style.flex = "1";
      modalBody.style.overflow = "auto";

      // 创建操作按钮区域
      const actionButtons = document.createElement("div");
      actionButtons.style.marginBottom = "15px";
      actionButtons.style.display = "flex";
      actionButtons.style.gap = "10px";

      const addRowBtn = document.createElement("button");
      addRowBtn.textContent = "添加行";
      addRowBtn.className = "layui-btn layui-btn-normal";
      addRowBtn.addEventListener("click", addTableRow);

      // 批量AI按钮
      const batchAIBtn = document.createElement("button");
      batchAIBtn.textContent = "批量AI";
      batchAIBtn.className = "layui-btn layui-btn-warm";
      batchAIBtn.addEventListener("click", batchProcessWithAI);

      const removeRowBtn = document.createElement("button");
      removeRowBtn.textContent = "删除选中";
      removeRowBtn.className = "layui-btn layui-btn-danger";
      removeRowBtn.addEventListener("click", removeSelectedRows);

      const applyBtn = document.createElement("button");
      applyBtn.textContent = "应用批量设置";
      applyBtn.className = "layui-btn layui-btn-primary";
      applyBtn.addEventListener("click", applyBatchSettings);

      // 全选按钮
      const selectAllBtn = document.createElement("button");
      selectAllBtn.textContent = "全选";
      selectAllBtn.className = "layui-btn layui-btn-primary";
      selectAllBtn.addEventListener("click", selectAllRows);

      actionButtons.appendChild(addRowBtn);
      actionButtons.appendChild(selectAllBtn);
      actionButtons.appendChild(batchAIBtn);
      actionButtons.appendChild(removeRowBtn);
      actionButtons.appendChild(applyBtn);

      // 创建表格容器
      const tableContainer = document.createElement("div");
      tableContainer.style.overflowX = "auto";

      // 创建表格
      const table = document.createElement("table");
      table.id = "batchDemandTable";
      table.border = "1";
      table.cellPadding = "5";
      table.cellSpacing = "0";
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.fontSize = "14px";
      table.style.lineHeight = "1.5";
      table.style.tableLayout = "fixed";

      // 创建表头
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headerRow.style.backgroundColor = "#f5f5f5";

      // 表头列
      const headers = [
        { text: "选择", width: "40px" },
        { text: "需求类型", width: "60px" },
        { text: "周", width: "60px" },
        { text: "需求名称", width: "200px" },
        { text: "使用环境", width: "150px" },
        { text: "复现过程", width: "200px" },
        { text: "需求背景", width: "200px" },
        { text: "需求目标", width: "200px" },
      ];

      headers.forEach((header) => {
        const th = document.createElement("th");
        th.textContent = header.text;
        th.style.width = header.width;
        th.style.padding = "12px 8px";
        th.style.textAlign = "center";
        th.style.border = "1px solid #ddd";
        th.style.backgroundColor = "#f8f9fa";
        th.style.fontWeight = "600";
        th.style.color = "#333";
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);

      // 创建表格体
      const tbody = document.createElement("tbody");
      table.appendChild(tbody);

      tableContainer.appendChild(table);

      // 添加到弹窗主体
      modalBody.appendChild(actionButtons);
      modalBody.appendChild(tableContainer);

      // 添加一行默认数据
      addTableRow();

      // 将头部和主体添加到弹窗内容
      modalContent.appendChild(modalHeader);
      modalContent.appendChild(modalBody);

      // 将弹窗内容添加到弹窗背景
      modal.appendChild(modalContent);

      // 阻止点击弹窗内容区域时关闭弹窗
      modalContent.addEventListener("click", function (e) {
        e.stopPropagation();
      });

      // 阻止点击弹窗背景关闭弹窗
      modal.addEventListener("click", function (e) {
        // 不执行任何操作，确保点击背景不会关闭弹窗
      });

      // 阻止ESC键关闭弹窗
      const handleEsc = function (e) {
        if (e.key === "Escape" && modal.style.display === "flex") {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      document.addEventListener("keydown", handleEsc);

      // 在关闭弹窗时移除事件监听器
      modal.dataset.escHandler = "true";

      // 添加到页面
      document.body.appendChild(modal);
    } else {
      // 显示已存在的弹窗
      modal.style.display = "flex";
    }
  }

  // 关闭弹窗函数
  function closeModal() {
    const modal = document.getElementById("batchDemandModal");
    if (modal) {
      modal.style.display = "none";
      // 移除ESC键事件监听器，避免内存泄漏
      if (modal.dataset.escHandler) {
        document.removeEventListener("keydown", function (e) {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
          }
        });
      }
    }
  }

  // 添加表格行函数 - 现在打开多行输入弹窗
  function addTableRow() {
    showInputModal();
  }

  // 创建多行输入弹窗函数
  function showInputModal() {
    // 检查是否已经存在弹窗
    let inputModal = document.getElementById("inputDemandModal");
    if (!inputModal) {
      // 创建弹窗背景
      inputModal = document.createElement("div");
      inputModal.id = "inputDemandModal";
      inputModal.style.position = "fixed";
      inputModal.style.top = "0";
      inputModal.style.left = "0";
      inputModal.style.width = "100%";
      inputModal.style.height = "100%";
      inputModal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      inputModal.style.zIndex = "10000";
      inputModal.style.display = "flex";
      inputModal.style.justifyContent = "center";
      inputModal.style.alignItems = "center";

      // 创建弹窗内容
      const modalContent = document.createElement("div");
      modalContent.style.backgroundColor = "#fff";
      modalContent.style.width = "600px";
      modalContent.style.borderRadius = "8px";
      modalContent.style.padding = "20px";
      modalContent.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
      modalContent.style.display = "flex";
      modalContent.style.flexDirection = "column";

      // 创建弹窗头部
      const modalHeader = document.createElement("div");
      modalHeader.style.display = "flex";
      modalHeader.style.justifyContent = "space-between";
      modalHeader.style.alignItems = "center";
      modalHeader.style.marginBottom = "16px";

      const modalTitle = document.createElement("h3");
      modalTitle.textContent = "批量添加需求";
      modalTitle.style.margin = "0";

      // 创建关闭按钮
      const closeButton = document.createElement("button");
      closeButton.textContent = "×";
      closeButton.style.border = "none";
      closeButton.style.backgroundColor = "transparent";
      closeButton.style.fontSize = "24px";
      closeButton.style.cursor = "pointer";
      closeButton.style.color = "#666";
      closeButton.style.width = "32px";
      closeButton.style.height = "32px";
      closeButton.style.display = "flex";
      closeButton.style.justifyContent = "center";
      closeButton.style.alignItems = "center";
      closeButton.style.borderRadius = "4px";
      closeButton.style.transition = "all 0.3s";

      closeButton.addEventListener("mouseenter", function () {
        this.style.backgroundColor = "#f0f0f0";
        this.style.color = "#333";
      });

      closeButton.addEventListener("mouseleave", function () {
        this.style.backgroundColor = "transparent";
        this.style.color = "#666";
      });

      // 添加关闭事件
      closeButton.addEventListener("click", function () {
        closeInputModal();
      });

      // 将标题和关闭按钮添加到头部
      modalHeader.appendChild(modalTitle);
      modalHeader.appendChild(closeButton);

      // 创建提示文本
      const hintText = document.createElement("div");
      hintText.textContent = "需求一行一个";
      hintText.style.marginBottom = "10px";
      hintText.style.color = "#666";
      hintText.style.fontSize = "14px";

      // 创建多行输入框
      const textarea = document.createElement("textarea");
      textarea.id = "demandTextarea";
      textarea.style.width = "100%";
      textarea.style.height = "200px";
      textarea.style.padding = "10px";
      textarea.style.border = "1px solid #ddd";
      textarea.style.borderRadius = "4px";
      textarea.style.fontSize = "14px";
      textarea.style.marginBottom = "16px";
      textarea.style.resize = "vertical";

      // 创建按钮容器
      const buttonContainer = document.createElement("div");
      buttonContainer.style.display = "flex";
      buttonContainer.style.justifyContent = "flex-end";
      buttonContainer.style.gap = "10px";

      // 创建取消按钮
      const cancelButton = document.createElement("button");
      cancelButton.textContent = "取消";
      cancelButton.className = "layui-btn layui-btn-primary";
      cancelButton.addEventListener("click", function () {
        closeInputModal();
      });

      // 创建确定按钮
      const confirmButton = document.createElement("button");
      confirmButton.textContent = "确定";
      confirmButton.className = "layui-btn layui-btn-normal";
      confirmButton.addEventListener("click", function () {
        processInputText();
      });

      // 添加按钮到容器
      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(confirmButton);

      // 添加所有元素到弹窗内容
      modalContent.appendChild(modalHeader);
      modalContent.appendChild(hintText);
      modalContent.appendChild(textarea);
      modalContent.appendChild(buttonContainer);

      // 将弹窗内容添加到弹窗背景
      inputModal.appendChild(modalContent);

      // 阻止点击弹窗内容区域时关闭弹窗
      modalContent.addEventListener("click", function (e) {
        e.stopPropagation();
      });

      // 点击背景关闭弹窗
      inputModal.addEventListener("click", function () {
        closeInputModal();
      });

      // 阻止ESC键关闭弹窗
      const handleEsc = function (e) {
        if (e.key === "Escape" && inputModal.style.display === "flex") {
          e.preventDefault();
          e.stopPropagation();
          closeInputModal();
        }
      };
      document.addEventListener("keydown", handleEsc);
      inputModal.dataset.escHandler = "true";

      // 添加到页面
      document.body.appendChild(inputModal);
    } else {
      // 显示已存在的弹窗
      inputModal.style.display = "flex";
    }

    // 聚焦到输入框
    setTimeout(() => {
      const textarea = document.getElementById("demandTextarea");
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  }

  // 关闭输入弹窗函数
  function closeInputModal() {
    const inputModal = document.getElementById("inputDemandModal");
    if (inputModal) {
      inputModal.style.display = "none";
      // 清空输入框
      const textarea = document.getElementById("demandTextarea");
      if (textarea) {
        textarea.value = "";
      }
      // 移除ESC键事件监听器
      if (inputModal.dataset.escHandler) {
        document.removeEventListener("keydown", function (e) {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeInputModal();
          }
        });
      }
    }
  }

  // 删除选中行函数
  function removeSelectedRows() {
    const table = document.getElementById("batchDemandTable");
    if (!table) return;

    const checkboxes = table.querySelectorAll(".row-select:checked");
    if (checkboxes.length === 0) {
      showMessage("请先选择要删除的行","warning");
      return;
    }

    checkboxes.forEach((checkbox) => {
      const row = checkbox.closest("tr");
      if (row) {
        row.remove();
      }
    });
  }

  // 处理输入文本函数
  function processInputText() {
    const textarea = document.getElementById("demandTextarea");
    if (!textarea) return;

    const inputText = textarea.value.trim();
    if (!inputText) {
      showMessage("请输入需求内容","warning");
      return;
    }

    // 按行分割文本
    const lines = inputText.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) {
      showMessage("请输入有效的需求内容","warning");
      return;
    }

    // 处理每行文本并添加到表格
    const processedLines = [];
    lines.forEach((line) => {
      // 去除前面的1、1.这种前缀
      let processedLine = line.trim();
      // 匹配并去除数字前缀，如：1、1.、(1)、1) 等格式
      processedLine = processedLine.replace(/^\s*\(?\d+\)?[、.]?\s*/, "");

      // 去除（10%）(20%) 30% 这种百分比
      // 匹配括号内的百分比和单独的百分比
      processedLine = processedLine.replace(/\s*\(\s*\d+%\s*\)\s*/g, "");
      processedLine = processedLine.replace(/\s*\d+%\s*/g, "");

      if (processedLine.trim()) {
        processedLines.push(processedLine.trim());
      }
    });

    if (processedLines.length === 0) {
      showMessage("没有有效的需求内容","warning");
      return;
    }

    // 添加处理后的需求到表格
    addProcessedDemandsToTable(processedLines);

    // 关闭输入弹窗
    closeInputModal();
  }

  // 将处理后的需求添加到表格函数
  function addProcessedDemandsToTable(demands) {
    const table = document.getElementById("batchDemandTable");
    if (!table) return;

    const tbody = table.querySelector("tbody");

    demands.forEach((demandName) => {
      const row = tbody.insertRow();
      row.className = "data-row";
      row.style.height = "45px"; // 增加行高

      // 创建复选框单元格
      const checkboxCell = row.insertCell();
      checkboxCell.style.textAlign = "center";
      checkboxCell.style.border = "1px solid #ddd";
      checkboxCell.style.display = "flex";
      checkboxCell.style.justifyContent = "center";
      checkboxCell.style.alignItems = "center";
      checkboxCell.style.gap = "5px";
      checkboxCell.style.padding = "8px";
      checkboxCell.style.verticalAlign = "middle";

      // 复选框
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "row-select";
      checkboxCell.appendChild(checkbox);

      // AI按钮
      const aiButton = document.createElement("button");
      aiButton.textContent = "Ai";
      aiButton.className = "layui-btn layui-btn-xs";
      aiButton.style.padding = "0 5px";
      aiButton.style.marginLeft = "5px";

      // 添加点击事件处理 - 直接调用批量方法
      aiButton.addEventListener("click", function () {
        // 获取当前行的需求名称
        const demandName =
          row.cells[3]?.querySelector('input[name="demandName"]')?.value || "";
        if (!demandName) {
          showMessage("请先输入需求名称","warning");
          return;
        }

        // 设置按钮加载状态
        this.disabled = true;
        this.textContent = "填充中...";

        // 直接调用批量处理方法
        const demandRows = [
          {
            row: row,
            demandName: demandName,
            button: this,
          },
        ];

        // 调用批量处理函数
        batchProcessAllDemands(demandRows)
          .then((results) => {
            const result = results[0]; // 获取单个结果
            if (result && result.success) {
              showMessage(`需求 "${demandName}" AI处理成功`, "success");
            } else {
              const errorMsg = result?.error || "处理失败";
              showMessage(
                `需求 "${demandName}" AI处理失败: ${errorMsg}`,
                "error"
              );
            }
          })
          .catch((error) => {
            console.error("调用AI API失败:", error);
            showMessage(`获取AI数据失败: ${error.message}`, "error");
          })
          .finally(() => {
            // 恢复按钮状态
            this.disabled = false;
            this.textContent = "Ai";
          });
      });

      checkboxCell.appendChild(aiButton);

      // 需求类型 - 下拉框
      const demandTypeCell = row.insertCell();
      const demandTypeSelect = document.createElement("select");
      demandTypeSelect.name = "demandType";
      demandTypeSelect.innerHTML = `
        <option value="">请选择</option>
        <option value="BUG" selected>错误修正</option>
        <option value="NEW">新项开发</option>
      `;
      demandTypeCell.appendChild(demandTypeSelect);
      demandTypeCell.style.border = "1px solid #ddd";
      demandTypeCell.style.padding = "8px";
      demandTypeCell.style.verticalAlign = "middle";

      // 周 - 下拉框
      const weekCell = row.insertCell();
      const weekSelect = document.createElement("select");
      weekSelect.name = "weekFlag";
      weekSelect.innerHTML = `
        <option value="">请选择</option>
        <option value="0" selected>本周</option>
        <option value="-1">上周</option>
        <option value="-2">前周</option>
      `;
      weekCell.appendChild(weekSelect);
      weekCell.style.border = "1px solid #ddd";
      weekCell.style.padding = "8px";
      weekCell.style.verticalAlign = "middle";

      // 需求名称 - 输入框，填充处理后的需求名称
      const demandNameCell = row.insertCell();
      const demandNameInput = document.createElement("input");
      demandNameInput.type = "text";
      demandNameInput.name = "demandName";
      demandNameInput.value = demandName;
      demandNameInput.style.width = "100%";
      demandNameCell.appendChild(demandNameInput);
      demandNameCell.style.border = "1px solid #ddd";
      demandNameCell.style.padding = "8px";
      demandNameCell.style.verticalAlign = "middle";

      // 使用环境 - 输入框
      const environmentCell = row.insertCell();
      const environmentInput = document.createElement("input");
      environmentInput.type = "text";
      environmentInput.name = "environment";
      environmentInput.placeholder = "使用环境";
      environmentInput.style.width = "100%";
      environmentInput.style.padding = "6px";
      environmentInput.style.border = "1px solid #ddd";
      environmentInput.style.borderRadius = "3px";
      environmentInput.style.boxSizing = "border-box";
      environmentCell.appendChild(environmentInput);
      environmentCell.style.border = "1px solid #ddd";
      environmentCell.style.padding = "8px";
      environmentCell.style.verticalAlign = "middle";

      // 复现过程 - 输入框
      const reproductionCell = row.insertCell();
      const reproductionInput = document.createElement("input");
      reproductionInput.type = "text";
      reproductionInput.name = "reproduction";
      reproductionInput.placeholder = "复现过程";
      reproductionInput.style.width = "100%";
      reproductionInput.style.padding = "6px";
      reproductionInput.style.border = "1px solid #ddd";
      reproductionInput.style.borderRadius = "3px";
      reproductionInput.style.boxSizing = "border-box";
      reproductionCell.appendChild(reproductionInput);
      reproductionCell.style.border = "1px solid #ddd";
      reproductionCell.style.padding = "8px";
      reproductionCell.style.verticalAlign = "middle";

      // 需求背景 - 输入框
      const backgroundCell = row.insertCell();
      const backgroundInput = document.createElement("input");
      backgroundInput.type = "text";
      backgroundInput.name = "background";
      backgroundInput.placeholder = "需求背景";
      backgroundInput.style.width = "100%";
      backgroundInput.style.padding = "6px";
      backgroundInput.style.border = "1px solid #ddd";
      backgroundInput.style.borderRadius = "3px";
      backgroundInput.style.boxSizing = "border-box";
      backgroundCell.appendChild(backgroundInput);
      backgroundCell.style.border = "1px solid #ddd";
      backgroundCell.style.padding = "8px";
      backgroundCell.style.verticalAlign = "middle";

      // 需求目标 - 输入框
      const targetCell = row.insertCell();
      const targetInput = document.createElement("input");
      targetInput.type = "text";
      targetInput.name = "target";
      targetInput.placeholder = "需求目标";
      targetInput.style.width = "100%";
      targetInput.style.padding = "6px";
      targetInput.style.border = "1px solid #ddd";
      targetInput.style.borderRadius = "3px";
      targetInput.style.boxSizing = "border-box";
      targetCell.appendChild(targetInput);
      targetCell.style.border = "1px solid #ddd";
      targetCell.style.padding = "8px";
      targetCell.style.verticalAlign = "middle";
    });

    // 提示用户添加成功
    showMessage(`成功添加${demands.length}条需求`, "success");
  }

  /**
   * 将AI返回的数据填充到表格中
   * @param {HTMLTableRowElement} row - 表格行元素
   * @param {Object} aiData - AI返回的数据对象
   */
  function fillTableWithAIData(row, aiData) {
    // 获取各列的输入框元素
    const environmentInput =
      row.cells[4]?.querySelector('input[name="environment"]') || null;
    const reproduceInput =
      row.cells[5]?.querySelector('input[name="reproduction"]') || null;
    const backgroundInput =
      row.cells[6]?.querySelector('input[name="background"]') || null;
    const targetInput =
      row.cells[7]?.querySelector('input[name="target"]') || null;

    // 填充数据
    if (environmentInput && aiData["使用环境"]) {
      environmentInput.value = aiData["使用环境"];
    }
    if (reproduceInput && aiData["复现过程"]) {
      reproduceInput.value = aiData["复现过程"];
    }
    if (backgroundInput && aiData["需求背景"]) {
      backgroundInput.value = aiData["需求背景"];
    }
    if (targetInput && aiData["需求目标"]) {
      targetInput.value = aiData["需求目标"];
    }

    // 显示填充成功提示
    showMessage("AI填充成功！");
  }

  /**
   * 显示消息提示
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型：success, error, warning, info
   * @param {number} duration - 显示时长（毫秒）
   */
  function showMessage(message, type = "success", duration = 2000) {
    // 创建消息元素
    const messageEl = document.createElement("div");
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
    document.body.appendChild(messageEl);

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
        if (messageEl.parentNode === document.body) {
          document.body.removeChild(messageEl);
        }
      }, 300);
    }, duration);
  }

  // 批量AI处理函数
  function batchProcessWithAI() {
    const table = document.getElementById("batchDemandTable");
    if (!table) return;

    const checkboxes = table.querySelectorAll(".row-select:checked");
    if (checkboxes.length === 0) {
      showMessage("请先选择需要AI处理的行","warning");
      return;
    }

    // 收集选中的需求名称和对应的行
    const demandRows = [];
    checkboxes.forEach((checkbox) => {
      const row = checkbox.closest("tr");
      if (row) {
        const demandName =
          row.cells[3]?.querySelector('input[name="demandName"]')?.value || "";
        if (demandName) {
          demandRows.push({
            row,
            demandName,
            button: row.cells[0]?.querySelector("button"),
          });
        }
      }
    });

    if (demandRows.length === 0) {
      showMessage("请确保选中的行都填写了需求名称","warning");
      return;
    }

    // 显示处理中提示
    showMessage(`开始批量AI处理，共${demandRows.length}条数据`, "info");

    // 设置所有按钮为处理中状态
    demandRows.forEach(({ button }) => {
      if (button) {
        button.disabled = true;
        button.textContent = "处理中...";
      }
    });

    // 创建进度提示元素
    const progressContainer = document.createElement("div");
    progressContainer.className = "layui-layer-loading layui-layer-loading1";
    progressContainer.style =
      "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;";
    progressContainer.innerHTML =
      '<span style="font-size: 16px; color: #333;">正在处理，请稍候...</span>';
    document.body.appendChild(progressContainer);

    // 一次性批量处理所有需求
    batchProcessAllDemands(demandRows)
      .then((results) => {
        // 统计结果
        const successCount = results.filter((r) => r.success).length;
        const failedCount = results.filter((r) => !r.success).length;
        const unmatchedCount = results.filter(
          (r) => r.error === "未在响应中找到匹配数据"
        ).length;

        // 收集失败的需求信息
        const failedDemands = results
          .filter((r) => !r.success)
          .map((r) => `\n- ${r.demandName}: ${r.error || "未知错误"}`)
          .join("");

        // 构建详细的结果信息
        let resultMessage = `批量处理完成！\n成功: ${successCount}条\n失败: ${failedCount}条`;
        if (unmatchedCount > 0) {
          resultMessage += `\n未匹配: ${unmatchedCount}条`;
        }
        if (failedCount > 0 && failedCount <= 10) {
          // 限制显示的失败信息数量
          resultMessage += "\n\n失败详情:" + failedDemands;
        }

        // 显示处理结果
        showMessage(resultMessage, successCount > 0 ? "success" : "error");

        // 如果有失败项，同时在控制台记录详细信息
        if (failedCount > 0) {
          console.warn(
            "批量处理失败详情:",
            results.filter((r) => !r.success)
          );
        }
      })
      .catch((error) => {
        // 详细记录错误信息
        console.error("批量处理失败:", error);
        console.error("错误堆栈:", error.stack);

        // 显示友好的错误提示
        showMessage(
          `批量处理过程中发生错误: ${error.message}\n请检查网络连接或稍后重试`,
          "error"
        );
      })
      .finally(() => {
        // 移除进度提示
        if (progressContainer && progressContainer.parentNode) {
          progressContainer.parentNode.removeChild(progressContainer);
        }

        // 恢复所有按钮状态
        demandRows.forEach(({ button }) => {
          if (button) {
            button.disabled = false;
            button.textContent = "Ai";
          }
        });
      });
  }

  // 批量处理所有需求的函数
  function batchProcessAllDemands(demandRows) {
    return new Promise((resolve, reject) => {
      const apiUrl = "https://qianfan.gz.baidubce.com/v2/chat/completions";
      const headers = {
        "Content-Type": "application/json",
        Authorization:
          "Bearer bce-v3/ALTAK-6JZZNpLpDdWfr0yELplRb/565b1bdabaad58b3d088965a4a6d17f8afb165ba",
      };

      // 准备所有需求名称的列表
      const demandNames = demandRows.map((item) => item.demandName);

      // 构建批量请求的提示词
      const promptContent = `请根据以下需求名称列表[${demandNames.map(
        (name, index) => `${index + 1}. ${name}`
      )}]，为每个需求按格式生成纯JSON内容（不要添加任何其他文本，每项15字内,所有需求放到一个json里面）：
[{"需求名称": "xxx", "使用环境": "公共服务单位网厅/公共服务个人网厅二选一", "复现过程": "xxx", "需求背景": "xxx", "需求目标": "xxx"}]`;

      const requestBody = {
        model: "ernie-lite-8k",
        messages: [
          {
            role: "user",
            content: promptContent,
          },
        ],
        stream: false,
      };

      fetch(apiUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          try {
            const content = data.choices?.[0]?.message?.content || "";
            if (!content) {
              throw new Error("未获取到AI返回的数据");
            }

            // 解析批量响应数据
            return processBatchAIData(content, demandRows);
          } catch (parseError) {
            reject(new Error(`解析AI返回数据失败: ${parseError.message}`));
          }
        })
        .then((results) => {
          resolve(results);
        })
        .catch((error) => {
          reject(new Error(`获取AI数据失败: ${error.message}`));
        });
    });
  }

  // 处理批量AI响应数据的函数
  function processBatchAIData(content, demandRows) {
    const results = [];
    try {
      // 尝试提取JSON代码块（如果有）
      let jsonContent = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonContent = jsonMatch[1];
      }
      debugger;
      // 移除可能的格式问题
      jsonContent = jsonContent.replace(/\n/g, "").trim();

      // 解析整个JSON对象
      const data = JSON.parse(jsonContent);

      // 处理新的格式：需求数据嵌套在"需求列表"数组中
      let batchData = [];
      if (data["需求列表"] && Array.isArray(data["需求列表"])) {
        batchData = data["需求列表"];
      } else if (Array.isArray(data)) {
        // 兼容旧格式：直接是数组
        batchData = data;
      }

      // 按勾选顺序直接填充：AI 返回的数组与 demandRows 一一对应
      // 先把 demandRows 按行号升序排一下，确保顺序就是界面勾选顺序
      demandRows.sort((a, b) => a.row.rowIndex - b.row.rowIndex);
      batchData.forEach((aiData, idx) => {
        const targetRow = demandRows[idx];
        if (!targetRow) return; // 行数不一致时忽略多余数据

        try {
          // 验证所需字段
          const requiredFields = ["使用环境", "复现过程", "需求背景", "需求目标"];
          // 补缺失默认值
          if (!aiData["需求背景"]) aiData["需求背景"] = "根据用户需求添加";

          const hasAllFields = requiredFields.every((f) => aiData[f]);
          if (hasAllFields) {
            fillTableWithAIData(targetRow.row, aiData);
            results.push({ demandName: targetRow.demandName, success: true });
          } else {
            results.push({
              demandName: targetRow.demandName,
              success: false,
              error: "返回数据字段不完整",
            });
          }
        } catch (error) {
          results.push({
            demandName: targetRow.demandName,
            success: false,
            error: error.message,
          });
        }
      });

      // 备用处理：如果需求列表未找到或为空，尝试解析为旧格式
      if (batchData.length === 0 && !data["需求列表"]) {
        // 尝试按行分割并解析每个JSON对象
        const lines = content.split("\n");
        const jsonLines = lines.filter(
          (line) =>
            (line.trim().startsWith("{") && line.trim().endsWith("}")) ||
            line.trim().includes("{")
        );

        jsonLines.forEach((line) => {
          try {
            // 提取JSON部分
            const jsonMatch = line.match(/\{(.*?)\}/);
            if (jsonMatch && jsonMatch[1]) {
              const aiData = JSON.parse("{" + jsonMatch[1] + "}");
              const demandName = aiData["需求名称"] || aiData["需求编号"];

              if (demandName) {
                const matchingRow = demandRows.find(
                  (rowData) =>
                    rowData.demandName
                      .toLowerCase()
                      .includes(demandName.toLowerCase()) ||
                    demandName
                      .toLowerCase()
                      .includes(rowData.demandName.toLowerCase())
                );

                if (matchingRow) {
                  const requiredFields = [
                    "使用环境",
                    "复现过程",
                    "需求背景",
                    "需求目标",
                  ];

                  // 提供缺失字段的默认值
                  if (!aiData["需求背景"]) {
                    aiData["需求背景"] = "根据用户需求添加";
                  }

                  const hasAllFields = requiredFields.every(
                    (field) => field in aiData && aiData[field]
                  );

                  if (hasAllFields) {
                    fillTableWithAIData(matchingRow.row, aiData);
                    results.push({ demandName, success: true });
                  } else {
                    results.push({
                      demandName,
                      success: false,
                      error: "返回数据字段不完整",
                    });
                  }
                }
              }
            }
          } catch (error) {
            // 忽略解析错误，继续处理下一行
          }
        });
      }

      return results;
    } catch (error) {
      return results;
    }
  }

  // 全选/取消全选函数
  function selectAllRows() {
    const table = document.getElementById("batchDemandTable");
    if (!table) return;
    
    const checkboxes = table.querySelectorAll(".row-select");
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    // 如果已经全部选中，则取消全选；否则全选
    checkboxes.forEach(checkbox => {
      checkbox.checked = !allChecked;
    });
    
    // 更新按钮文字
    const selectAllBtn = event.target;
    selectAllBtn.textContent = allChecked ? "全选" : "取消全选";
  }

  // 应用批量设置函数
  function applyBatchSettings() {
    const table = document.getElementById("batchDemandTable");
    if (!table) return;

    const rows = table.querySelectorAll(".data-row");
    if (rows.length === 0) {
      showMessage("没有数据可以应用","warning");
      return;
    }

    // 收集表格数据
    const demandDataList = [];

    rows.forEach((row) => {
      const cells = row.cells;

      // 确保行有足够的单元格
      if (cells.length >= 8) {
        const demandData = {
          demandType:
            cells[1]?.querySelector('select[name="demandType"]')?.value || "",
          weekFlag:
            cells[2]?.querySelector('select[name="weekFlag"]')?.value || "",
          demandName:
            cells[3]?.querySelector('input[name="demandName"]')?.value || "",
          environment:
            cells[4]?.querySelector('input[name="environment"]')?.value || "",
          reproduction:
            cells[5]?.querySelector('input[name="reproduction"]')?.value || "",
          background:
            cells[6]?.querySelector('input[name="background"]')?.value || "",
          target: cells[7]?.querySelector('input[name="target"]')?.value || "",
        };

        // 检查必填字段是否填写
        if (demandData.demandName) {
          demandDataList.push(demandData);
        }
      }
    });

    if (demandDataList.length === 0) {
      showMessage("请确保每一行都填写了需求名称","warning");
      return;
    }

    // 提示用户批量数据已准备完成
    showMessage(`已收集${demandDataList.length}条需求数据`, "info");

    // 关闭当前弹窗
    closeModal();
  }
})();
