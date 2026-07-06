 // 弹出窗口的交互逻辑
document.addEventListener('DOMContentLoaded', function() {
    const startSelectorButton = document.getElementById('startSelector');
    const toggleModeButton = document.getElementById('toggleMode');
    const modeValueEl = document.getElementById('modeValue');

    const modeLabels = {
      'precise': '1 (精确)',
      'contains': '2 (模糊)',
      'position': '3 (位置)'
    };

    function updateModeDisplay(mode) {
      if (modeValueEl && modeLabels[mode]) {
        modeValueEl.textContent = modeLabels[mode];
      }
    }

    startSelectorButton.addEventListener('click', function() {
      chrome.runtime.sendMessage({action: "startSelector"}, function(response) {
        if (response && response.status === "started") {
          window.close();
        }
      });
    });

    toggleModeButton.addEventListener('click', function() {
      chrome.runtime.sendMessage({action: "toggleMode"}, function(response) {
        if (response && response.mode) {
          updateModeDisplay(response.mode);
        }
      });
    });

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "getMode"}, function(response) {
          if (response && response.mode) {
            updateModeDisplay(response.mode);
          }
        });
      }
    });
  });