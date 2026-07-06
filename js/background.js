// 后台脚本，转发 popup 与 content script 之间的消息

// 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startSelector") {
      // 向当前活动标签页发送消息
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "startXPathSelector"}, function(response) {
            sendResponse({status: "started"});
          });
        }
      });
      return true;
    } else if (request.action === "toggleMode") {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "toggleMode"}, function(response) {
            sendResponse(response);
          });
        }
      });
      return true;
    }
  });