(function() {
    'use strict';

    const XG = window.XPathGenerator;

    let selectedElement = null;
    let infoBox = null;
    let xpathMode = 'precise';
    let matchedElements = [];
    let hoveredElement = null;
    let showPositionedXPath = false;
    let scriptActive = false;
    let manualHighlightElements = [];
    let codeInputEl = null;
    let codeCountEl = null;
    let hiddenModals = [];
    let datasetPanelEl = null;
    let datasetPanelVisible = false;
    let datasets = [
        ['', '', '', ''],
        ['', '', '', ''],
        ['', '', '', '']
    ];

    function getXPath(element) {
        return XG.getXPathByMode(element, xpathMode);
    }

    function getPositionedXPath(element) {
        return XG.getPositionedXPath(element, matchedElements, xpathMode);
    }

    function loadDatasets() {
        try {
            const raw = localStorage.getItem('xpathDatasets');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length === 3 && parsed.every(set => Array.isArray(set) && set.length === 4)) {
                    datasets = parsed;
                }
            }
        } catch (e) {}
    }

    function saveDatasets() {
        try {
            localStorage.setItem('xpathDatasets', JSON.stringify(datasets));
        } catch (e) {}
    }

/* __CONTENT_PART2__ */

    function createDatasetPanel() {
        if (datasetPanelEl) return datasetPanelEl;
        loadDatasets();

        const panel = document.createElement('div');
        panel.className = 'dataset-panel-container';
        panel.style.marginTop = '10px';
        panel.style.padding = '8px';
        panel.style.borderRadius = '6px';
        panel.style.background = 'rgba(255,255,255,0.08)';
        panel.style.color = '#fff';
        panel.style.fontSize = '13px';

        const title = document.createElement('div');
        title.textContent = '自动输入数据（按Y开关；按1/2/3应用）';
        title.style.marginBottom = '6px';
        title.style.fontWeight = 'bold';
        panel.appendChild(title);

        const schemesContainer = document.createElement('div');
        schemesContainer.style.display = 'flex';
        schemesContainer.style.flexDirection = 'column';
        schemesContainer.style.gap = '8px';

        for (let s = 0; s < 3; s++) {
            const schemeWrap = document.createElement('div');
            schemeWrap.style.border = '1px solid rgba(255,255,255,0.2)';
            schemeWrap.style.borderRadius = '4px';
            schemeWrap.style.padding = '6px';

            const header = document.createElement('div');
            header.textContent = `方案${s + 1}（按${s + 1}）`;
            header.style.marginBottom = '4px';
            header.style.color = '#eee';
            schemeWrap.appendChild(header);

            for (let i = 0; i < 4; i++) {
                const ta = document.createElement('textarea');
                ta.placeholder = `第${i + 1}个textarea的内容`;
                ta.value = datasets[s][i] || '';
                ta.style.width = '100%';
                ta.style.height = '48px';
                ta.style.resize = 'vertical';
                ta.style.padding = '6px 8px';
                ta.style.borderRadius = '4px';
                ta.style.border = '1px solid #888';
                ta.style.background = 'rgba(255,255,255,0.95)';
                ta.style.color = '#000';
                ta.style.marginTop = '4px';
                ta.addEventListener('input', () => {
                    datasets[s][i] = ta.value;
                    saveDatasets();
                });
                schemeWrap.appendChild(ta);
            }

            schemesContainer.appendChild(schemeWrap);
        }

        panel.appendChild(schemesContainer);
        datasetPanelEl = panel;
        return panel;
    }

/* __CONTENT_PART3__ */

    function toggleDatasetPanel() {
        if (!infoBox) createInfoBox();
        if (!datasetPanelEl) createDatasetPanel();

        if (datasetPanelVisible) {
            if (datasetPanelEl && datasetPanelEl.parentElement) {
                datasetPanelEl.parentElement.removeChild(datasetPanelEl);
            }
            datasetPanelVisible = false;
        } else {
            const modeSelector = infoBox.querySelector('.mode-selector-container');
            if (modeSelector && modeSelector.parentElement) {
                modeSelector.parentElement.insertBefore(datasetPanelEl, modeSelector);
            } else {
                infoBox.appendChild(datasetPanelEl);
            }
            datasetPanelVisible = true;
        }
    }

    function applyDataset(index) {
        if (index < 0 || index > 2) return;
        const values = datasets[index] || ['', '', '', ''];

        let textareas = [];
        try {
            const xp = document.evaluate('//textarea', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < Math.min(4, xp.snapshotLength); i++) {
                const node = xp.snapshotItem(i);
                if (node && node.nodeType === 1) textareas.push(node);
            }
        } catch (e) {}

        if (textareas.length === 0) {
            showNotification('未找到任何textarea');
            return;
        }

        const setValue = (el, val) => {
            try {
                const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
                if (descriptor && descriptor.set) {
                    descriptor.set.call(el, val);
                } else {
                    el.value = val;
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
                el.value = val;
            }
        };

        for (let i = 0; i < textareas.length; i++) {
            setValue(textareas[i], values[i] || '');
        }
        showNotification(`已应用方案${index + 1}`);
    }

/* __CONTENT_PART4__ */

    function createCodeInput() {
        const container = document.createElement('div');
        container.className = 'xpath-code-input-container';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '6px';
        container.style.marginBottom = '10px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '输入XPath或CSS选择器，自动高亮';
        input.style.flex = '1';
        input.style.padding = '6px 8px';
        input.style.border = '1px solid #888';
        input.style.borderRadius = '4px';
        input.style.background = 'rgba(255,255,255,0.95)';
        input.style.color = '#000';
        codeInputEl = input;

        function triggerHighlight() {
            const code = input.value.trim();
            if (!code) { clearManualHighlights(); return; }
            highlightByCode(code);
        }

        input.addEventListener('input', triggerHighlight);
        input.addEventListener('change', triggerHighlight);
        input.addEventListener('paste', () => { setTimeout(triggerHighlight, 0); });
        input.addEventListener('keydown', (e) => { e.stopPropagation(); });

        container.appendChild(input);
        return container;
    }

    function createInfoBox() {
        infoBox = document.createElement('div');
        infoBox.style.position = 'fixed';
        infoBox.style.bottom = '10px';
        infoBox.style.right = '10px';
        infoBox.style.backgroundColor = 'rgba(0,0,0,0.7)';
        infoBox.style.color = 'white';
        infoBox.style.padding = '10px';
        infoBox.style.borderRadius = '5px';
        infoBox.style.zIndex = '999999';
        infoBox.style.maxWidth = '400px';
        infoBox.style.maxHeight = '300px';
        infoBox.style.overflow = 'auto';
        infoBox.style.fontFamily = 'Arial, sans-serif';
        infoBox.style.fontSize = '14px';
        document.body.appendChild(infoBox);

        const codeInput = createCodeInput();
        infoBox.appendChild(codeInput);

/* __CONTENT_PART5__ */

        const modeSelector = document.createElement('div');
        modeSelector.className = 'mode-selector-container';
        modeSelector.style.marginTop = '10px';
        modeSelector.style.display = 'flex';
        modeSelector.style.justifyContent = 'space-between';

        const modes = [
            { id: 'precise', name: '1' },
            { id: 'contains', name: '2' },
            { id: 'position', name: '3' }
        ];

        modes.forEach(mode => {
            const button = document.createElement('button');
            button.textContent = mode.name;
            button.style.padding = '5px';
            button.style.margin = '0 2px';
            button.style.backgroundColor = mode.id === xpathMode ? '#4CAF50' : '#555';
            button.style.border = 'none';
            button.style.borderRadius = '3px';
            button.style.color = 'white';
            button.style.cursor = 'pointer';

            button.addEventListener('click', () => {
                xpathMode = mode.id;
                modeSelector.querySelectorAll('button').forEach(btn => {
                    btn.style.backgroundColor = '#555';
                });
                button.style.backgroundColor = '#4CAF50';
                if (selectedElement) {
                    showElementInfo(selectedElement);
                }
            });

            modeSelector.appendChild(button);
        });

        infoBox.appendChild(modeSelector);
    }

/* __CONTENT_PART6__ */

    function showElementInfo(element) {
        if (!infoBox) createInfoBox();

        const xpath = showPositionedXPath ? getPositionedXPath(element) : getXPath(element);
        const tagName = element.tagName.toLowerCase();
        const id = element.id ? ` id="${element.id}"` : '';
        const className = element.className ? ` class="${element.className}"` : '';

        matchedElements = [];
        let matchCount = 0;
        try {
            const matchedNodes = document.evaluate(showPositionedXPath ? getXPath(element) : xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            matchCount = matchedNodes.snapshotLength;
            for (let i = 0; i < matchCount; i++) {
                matchedElements.push(matchedNodes.snapshotItem(i));
            }
        } catch(e) {
            console.error("XPath评估错误:", e);
        }

        const modeNumber = xpathMode === 'contains' ? '2' : xpathMode === 'position' ? '3' : '1';
        const cssSelector = XG.getStableCssSelector(element);
        const modeInfo = document.createElement('div');
        modeInfo.innerHTML = `
            <div><strong>XPath已复制 (${modeNumber}):</strong> ${xpath}</div>
            <div><strong>CSS:</strong> <span class="css-selector-text">${cssSelector}</span></div>
            <div><strong>元素:</strong> &lt;${tagName}${id}${className}&gt;</div>
            <div><strong>匹配数量:</strong> ${matchCount} 个元素</div>
            <div><strong>位置索引:</strong> ${showPositionedXPath ? '已启用 (按Q切换)' : '已禁用 (按Q启用)'}</div>
        `;

        const copyCssBtn = document.createElement('button');
        copyCssBtn.textContent = '复制 CSS (C)';
        copyCssBtn.style.padding = '4px 8px';
        copyCssBtn.style.marginTop = '4px';
        copyCssBtn.style.backgroundColor = '#2196F3';
        copyCssBtn.style.border = 'none';
        copyCssBtn.style.borderRadius = '3px';
        copyCssBtn.style.color = 'white';
        copyCssBtn.style.cursor = 'pointer';
        copyCssBtn.style.fontSize = '12px';
        copyCssBtn.addEventListener('click', () => {
            copyToClipboard(cssSelector);
            showNotification('CSS选择器已复制!');
        });
        modeInfo.appendChild(copyCssBtn);

/* __CONTENT_PART7__ */

        const navButtons = document.createElement('div');
        navButtons.style.marginTop = '10px';
        navButtons.style.display = 'flex';
        navButtons.style.justifyContent = 'space-between';

        const parentButton = document.createElement('button');
        parentButton.textContent = '↑ 父元素';
        parentButton.style.padding = '5px';
        parentButton.style.margin = '0 2px';
        parentButton.style.backgroundColor = '#555';
        parentButton.style.border = 'none';
        parentButton.style.borderRadius = '3px';
        parentButton.style.color = 'white';
        parentButton.style.cursor = 'pointer';
        parentButton.addEventListener('click', () => {
            if (element.parentElement) selectElement(element.parentElement);
        });

        const siblingButton = document.createElement('button');
        siblingButton.textContent = '→ 下个兄弟';
        siblingButton.style.padding = '5px';
        siblingButton.style.margin = '0 2px';
        siblingButton.style.backgroundColor = '#555';
        siblingButton.style.border = 'none';
        siblingButton.style.borderRadius = '3px';
        siblingButton.style.color = 'white';
        siblingButton.style.cursor = 'pointer';
        siblingButton.addEventListener('click', () => {
            const siblings = Array.from(element.parentElement.children);
            const currentIndex = siblings.indexOf(element);
            if (currentIndex < siblings.length - 1) selectElement(siblings[currentIndex + 1]);
        });

        navButtons.appendChild(parentButton);
        navButtons.appendChild(siblingButton);

        const codeInputContainer = infoBox.querySelector('.xpath-code-input-container');
        const datasetPanel = infoBox.querySelector('.dataset-panel-container');
        const modeSelector = infoBox.querySelector('.mode-selector-container');
        infoBox.innerHTML = '';
        if (codeInputContainer) {
            infoBox.appendChild(codeInputContainer);
            codeInputEl = codeInputContainer.querySelector('input');
        }
        infoBox.appendChild(modeInfo);
        infoBox.appendChild(navButtons);
        if (datasetPanel) infoBox.appendChild(datasetPanel);
        if (modeSelector) infoBox.appendChild(modeSelector);

        return xpath;
    }

/* __CONTENT_PART8__ */

    function selectElement(element) {
        matchedElements.forEach(el => {
            if (el && el.style) { el.style.outline = ''; el.style.cursor = ''; }
        });

        const xpath = showPositionedXPath ? getPositionedXPath(element) : getXPath(element);
        showElementInfo(element);

        matchedElements.forEach(el => {
            if (el && el.style) {
                el.style.outline = '6px solid #4CAF50';
                el.style.cursor = 'copy';
            }
        });

        selectedElement = element;
        copyToClipboard(xpath);
    }

    function copyToClipboard(text) {
        try {
            navigator.clipboard.writeText(text).then(() => {
                showNotification('已复制到剪贴板!');
            }).catch(() => {
                fallbackCopy(text);
            });
        } catch (err) {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {}
        document.body.removeChild(textArea);
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = '#4CAF50';
        notification.style.color = 'white';
        notification.style.padding = '10px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '999999';
        document.body.appendChild(notification);
        setTimeout(() => { document.body.removeChild(notification); }, 1500);
    }

/* __CONTENT_PART9__ */

    function clearManualHighlights() {
        manualHighlightElements.forEach(el => {
            if (el && el.style && el.style.outline.includes('purple')) {
                el.style.outline = '';
            }
        });
        manualHighlightElements = [];
        if (codeCountEl) codeCountEl.textContent = '0';
    }

    function highlightByCode(code) {
        clearManualHighlights();
        let results = [];
        try {
            const xp = document.evaluate(code, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < xp.snapshotLength; i++) {
                const node = xp.snapshotItem(i);
                if (node && node.nodeType === 1) results.push(node);
            }
        } catch (e) {}
        if (results.length === 0) {
            try {
                results = Array.from(document.querySelectorAll(code));
            } catch (e) {}
        }
        if (results.length === 0) return;
        results.forEach(el => {
            if (el && el.style) el.style.outline = '6px solid purple';
        });
        manualHighlightElements = results;
        if (codeCountEl) codeCountEl.textContent = String(results.length);
        if (selectedElement) showElementInfo(selectedElement);
    }

    function handleMouseOver(e) {
        if (infoBox && infoBox.contains(e.target)) return;
        if (!matchedElements.includes(e.target) && e.target !== selectedElement && !manualHighlightElements.includes(e.target)) {
            if (hoveredElement && hoveredElement.style) {
                hoveredElement.style.outline = '';
                hoveredElement.style.cursor = '';
            }
            e.target.style.outline = '6px solid red';
            e.target.style.cursor = 'copy';
            hoveredElement = e.target;
        }
    }

    function handleMouseOut(e) {
        if (infoBox && infoBox.contains(e.target)) return;
        if (!matchedElements.includes(e.target) && e.target !== selectedElement && !manualHighlightElements.includes(e.target)) {
            if (e.target.style) {
                e.target.style.outline = '';
                e.target.style.cursor = '';
            }
            if (hoveredElement === e.target) hoveredElement = null;
        }
    }

    function handleClick(e) {
        if (infoBox && infoBox.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        if (hoveredElement && hoveredElement.style) {
            hoveredElement.style.outline = '';
            hoveredElement.style.cursor = '';
            hoveredElement = null;
        }
        selectElement(e.target);
    }

/* __CONTENT_PART10__ */

    function startSelecting() {
        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mouseout', handleMouseOut);
        document.addEventListener('click', handleClick, true);

        if (!infoBox) createInfoBox();
        const codeInputContainer = infoBox.querySelector('.xpath-code-input-container') || createCodeInput();
        const datasetPanel = datasetPanelEl && datasetPanelEl.parentElement ? datasetPanelEl : (datasetPanelVisible ? createDatasetPanel() : null);
        const modeSelector = infoBox.querySelector('.mode-selector-container');
        infoBox.innerHTML = '<div>选择模式已激活 - 点击任意元素复制其XPath</div>';
        infoBox.insertBefore(codeInputContainer, infoBox.firstChild);
        codeInputEl = codeInputContainer.querySelector('input');
        if (datasetPanel && datasetPanelVisible) infoBox.appendChild(datasetPanel);
        if (modeSelector) infoBox.appendChild(modeSelector);

        if (codeInputEl && codeInputEl.value && codeInputEl.value.trim()) {
            highlightByCode(codeInputEl.value.trim());
        }
    }

    function stopSelecting() {
        document.removeEventListener('mouseover', handleMouseOver);
        document.removeEventListener('mouseout', handleMouseOut);
        document.removeEventListener('click', handleClick, true);

        if (selectedElement) {
            selectedElement.style.outline = '';
            selectedElement.style.cursor = '';
            selectedElement = null;
        }

        if (infoBox) {
            const codeInputContainer = infoBox.querySelector('.xpath-code-input-container') || createCodeInput();
            const datasetPanel = datasetPanelEl && datasetPanelEl.parentElement ? datasetPanelEl : (datasetPanelVisible ? createDatasetPanel() : null);
            const modeSelector = infoBox.querySelector('.mode-selector-container');
            infoBox.innerHTML = '选择模式已停止。按E键重新激活。';
            infoBox.insertBefore(codeInputContainer, infoBox.firstChild);
            codeInputEl = codeInputContainer.querySelector('input');
            if (datasetPanel && datasetPanelVisible) infoBox.appendChild(datasetPanel);
            if (modeSelector) infoBox.appendChild(modeSelector);
        }
    }

/* __CONTENT_PART11__ */

    function toggleMode() {
        const modes = ['precise', 'contains', 'position'];
        const currentIndex = modes.indexOf(xpathMode);
        xpathMode = modes[(currentIndex + 1) % modes.length];

        matchedElements.forEach(el => {
            if (el && el.style) { el.style.outline = ''; el.style.cursor = ''; }
        });
        if (selectedElement && selectedElement.style) {
            selectedElement.style.outline = '';
            selectedElement.style.cursor = '';
        }
        selectedElement = null;
        matchedElements = [];
        showPositionedXPath = false;

        if (infoBox) {
            const buttons = infoBox.querySelectorAll('.mode-selector-container button');
            buttons.forEach((btn, index) => {
                btn.style.backgroundColor = index === (currentIndex + 1) % modes.length ? '#4CAF50' : '#555';
            });
        }

        if (infoBox) {
            const codeInputContainer = infoBox.querySelector('.xpath-code-input-container') || createCodeInput();
            const modeSelector = document.createElement('div');
            modeSelector.className = 'mode-selector-container';
            modeSelector.style.marginTop = '10px';
            modeSelector.style.display = 'flex';
            modeSelector.style.justifyContent = 'space-between';
            const modesDef = [
                { id: 'precise', name: '1' },
                { id: 'contains', name: '2' },
                { id: 'position', name: '3' }
            ];
            modesDef.forEach(mode => {
                const button = document.createElement('button');
                button.textContent = mode.name;
                button.style.padding = '5px';
                button.style.margin = '0 2px';
                button.style.backgroundColor = mode.id === xpathMode ? '#4CAF50' : '#555';
                button.style.border = 'none';
                button.style.borderRadius = '3px';
                button.style.color = 'white';
                button.style.cursor = 'pointer';
                button.addEventListener('click', () => {
                    xpathMode = mode.id;
                    modeSelector.querySelectorAll('button').forEach(btn => {
                        btn.style.backgroundColor = '#555';
                    });
                    button.style.backgroundColor = '#4CAF50';
                    if (selectedElement) showElementInfo(selectedElement);
                });
                modeSelector.appendChild(button);
            });

            infoBox.innerHTML = '<div>模式已切换，请重新选择元素</div>';
            infoBox.insertBefore(codeInputContainer, infoBox.firstChild);
            codeInputEl = codeInputContainer.querySelector('input');
            infoBox.appendChild(modeSelector);
        }
    }

/* __CONTENT_PART12__ */

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "startXPathSelector") {
            startSelecting();
            sendResponse({status: "started"});
        } else if (request.action === "stopXPathSelector") {
            stopSelecting();
            sendResponse({status: "stopped"});
        } else if (request.action === "toggleMode") {
            toggleMode();
            sendResponse({status: "toggled", mode: xpathMode});
        } else if (request.action === 'getMode') {
            sendResponse({mode: xpathMode});
        }
        return true;
    });

    document.addEventListener('keydown', function(e) {
        if (e.key.toLowerCase() === 'e') {
            if (selectedElement) { stopSelecting(); } else { startSelecting(); }
        } else if (e.key.toLowerCase() === 'r') {
            toggleMode();
        } else if (e.key.toLowerCase() === '-') {
            if (!infoBox) createInfoBox();
            const inputTarget = codeInputEl || (infoBox && infoBox.querySelector('.xpath-code-input-container input'));
            if (inputTarget) { inputTarget.focus(); inputTarget.select(); }
            e.preventDefault();
        } else if (e.key.toLowerCase() === 'y') {
            toggleDatasetPanel();
            e.preventDefault();
        } else if ((e.key === '1' || e.key === '2' || e.key === '3') && datasetPanelVisible) {
            const ae = document.activeElement;
            const isEditing = ae && datasetPanelEl && datasetPanelEl.contains(ae) && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT');
            if (!isEditing) {
                applyDataset(parseInt(e.key, 10) - 1);
                e.preventDefault();
            }
        } else if (e.key.toLowerCase() === 'h') {
            toggleModalVisibility();
            e.preventDefault();
        } else if (selectedElement) {
            if (e.key === 'w') {
                if (selectedElement.parentElement) selectElement(selectedElement.parentElement);
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                const siblings = Array.from(selectedElement.parentElement.children);
                const idx = siblings.indexOf(selectedElement);
                if (idx < siblings.length - 1) selectElement(siblings[idx + 1]);
                e.preventDefault();
            } else if (e.key === 'q') {
                showPositionedXPath = !showPositionedXPath;
                showElementInfo(selectedElement);
                const newXPath = showPositionedXPath ? getPositionedXPath(selectedElement) : getXPath(selectedElement);
                copyToClipboard(newXPath);
                e.preventDefault();
            } else if (e.key === 'c') {
                copyToClipboard(XG.getStableCssSelector(selectedElement));
                showNotification('CSS选择器已复制!');
                e.preventDefault();
            }
        }
    });

/* __CONTENT_PART13__ */

    function toggleModalVisibility() {
        if (hiddenModals.length > 0) {
            hiddenModals.forEach(modal => {
                if (modal && modal.style) {
                    modal.style.display = modal.originalDisplay || '';
                    modal.style.zIndex = modal.originalZIndex || '';
                    modal.style.visibility = modal.originalVisibility || '';
                }
            });
            hiddenModals = [];
            showNotification('弹窗已恢复显示');
        } else {
            const selectors = [
                '[class*="modal"]', '[class*="popup"]', '[class*="dialog"]',
                '[class*="overlay"]', '[class*="mask"]',
                '[id*="modal"]', '[id*="popup"]', '[id*="dialog"]',
                '[id*="overlay"]', '[id*="mask"]'
            ];

            selectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        if (el && el.style && !hiddenModals.includes(el)) {
                            el.originalDisplay = el.style.display;
                            el.originalZIndex = el.style.zIndex;
                            el.originalVisibility = el.style.visibility;
                            el.style.display = 'none';
                            hiddenModals.push(el);
                        }
                    });
                } catch (e) {}
            });

            document.querySelectorAll('*').forEach(el => {
                if (el && el.style && el.style.zIndex) {
                    const zIndex = parseInt(el.style.zIndex);
                    if (zIndex > 1000 && !hiddenModals.includes(el)) {
                        el.originalDisplay = el.style.display;
                        el.originalZIndex = el.style.zIndex;
                        el.originalVisibility = el.style.visibility;
                        el.style.display = 'none';
                        hiddenModals.push(el);
                    }
                }
            });

            if (hiddenModals.length > 0) {
                showNotification(`已隐藏 ${hiddenModals.length} 个弹窗/遮罩，按H键恢复`);
            } else {
                showNotification('未找到弹窗或遮罩元素');
            }
        }
    }

    console.log('XPath增强器已加载。按E键开启/关闭。');
})();
