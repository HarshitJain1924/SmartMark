chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-to-smartmark",
    title: "Add to SmartMark",
    contexts: ["page", "link"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  let url = info.linkUrl || info.pageUrl;
  let title = tab && tab.title ? tab.title : url;
  let favicon = tab && tab.favIconUrl ? tab.favIconUrl : '';
  // Pass title and favicon as query params
  chrome.tabs.create({
    url: chrome.runtime.getURL(`popup.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&favicon=${encodeURIComponent(favicon)}`)
  });
});
