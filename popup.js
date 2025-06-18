document.addEventListener("DOMContentLoaded", async () => {
  const pageTitleEl = document.getElementById("pageTitle");
  const tagsInput = document.getElementById("tags");
  const noteInput = document.getElementById("note");
  const saveBtn = document.getElementById("saveBtn");
  const bookmarkList = document.getElementById("bookmarkList");
  const searchInput = document.getElementById("search");

  let currentTab;

  // Get active tab
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    currentTab = tab;
    pageTitleEl.textContent = tab.title;
  });

  // --- Folder Structure ---
  // Each bookmark can have a 'folder' property (string)
  // Add folder input to the form
  let folderInput = document.getElementById('folderInput');
  if (!folderInput) {
    folderInput = document.createElement('input');
    folderInput.type = 'text';
    folderInput.id = 'folderInput';
    folderInput.placeholder = 'Folder (optional)';
    folderInput.style = 'margin:6px 0; width:100%; padding:10px; border-radius:7px; border:1.5px solid #232a36; background:#232a36; color:#e3e6eb; font-size:15px;';
    const formSection = document.getElementById('form-section');
    formSection.insertBefore(folderInput, document.getElementById('tags'));
  }

  // Save Bookmark
  saveBtn.addEventListener("click", () => {
    const tags = tagsInput.value.split(",").map(t => t.trim()).filter(Boolean);
    const note = noteInput.value.trim();
    const folder = folderInput.value.trim();
    const editingUrl = saveBtn.getAttribute('data-editing-url');
    const editingTime = saveBtn.getAttribute('data-editing-time');

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      const bookmark = {
        url: tab.url,
        title: tab.title,
        tags,
        note,
        folder,
        time: new Date().toISOString(),
        pinned: false,
        favicon: tab.favIconUrl || ''
      };
      // Duplicate detection
      chrome.storage.sync.get({ bookmarks: [] }, (data) => {
        const exists = data.bookmarks.some(bm => bm.url === bookmark.url);
        if (exists && (editingUrl === null || editingUrl === undefined)) {
          alert('This bookmark already exists!');
          return;
        }
        let updated;
        if (editingUrl && editingTime) {
          updated = data.bookmarks.map((bm) =>
            bm.url === editingUrl && bm.time === editingTime ? { ...bm, tags, note, folder } : bm
          );
          saveBtn.removeAttribute('data-editing-url');
          saveBtn.removeAttribute('data-editing-time');
        } else {
          updated = [...data.bookmarks, bookmark];
        }
        chrome.storage.sync.set({ bookmarks: updated }, () => {
          renderBookmarks(updated);
          tagsInput.value = "";
          noteInput.value = "";
          folderInput.value = "";
        });
      });
    });
  });

  // Export bookmarks
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    chrome.storage.sync.get({ bookmarks: [] }, (data) => {
      const blob = new Blob([JSON.stringify(data.bookmarks, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smartmark-bookmarks.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Import bookmarks
  document.getElementById('importInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const imported = JSON.parse(evt.target.result);
        if (Array.isArray(imported)) {
          chrome.storage.sync.get({ bookmarks: [] }, (data) => {
            const merged = [...data.bookmarks, ...imported];
            chrome.storage.sync.set({ bookmarks: merged }, () => {
              renderBookmarks(merged);
            });
          });
        }
      } catch {}
    };
    reader.readAsText(file);
  });

  // Folder/Color filter bar
  function renderFolderFilters(bookmarks) {
    // Only tag folders now (no color filter)
    const tagSet = new Set(bookmarks.flatMap(b => b.tags));
    let folderBar = document.getElementById('folderBar');
    if (!folderBar) {
      folderBar = document.createElement('div');
      folderBar.id = 'folderBar';
      folderBar.style.display = 'flex';
      folderBar.style.flexWrap = 'wrap';
      folderBar.style.gap = '8px';
      folderBar.style.margin = '8px 0 0 0';
      searchInput.parentNode.insertBefore(folderBar, searchInput.nextSibling);
    }
    folderBar.innerHTML = '';
    // Tag folders only
    Array.from(tagSet).sort().forEach(tag => {
      const btn = document.createElement('button');
      btn.textContent = `#${tag}`;
      btn.className = 'folder-filter-btn';
      btn.onclick = () => {
        searchInput.value = tag;
        searchInput.dispatchEvent(new Event('input'));
      };
      folderBar.appendChild(btn);
    });
  }

  // Tag filtering UI
  function renderTagFilters(bookmarks) {
    const tagSet = new Set(bookmarks.flatMap(b => b.tags));
    let tagBar = document.getElementById('tagBar');
    if (!tagBar) {
      tagBar = document.createElement('div');
      tagBar.id = 'tagBar';
      tagBar.style.display = 'flex';
      tagBar.style.flexWrap = 'wrap';
      tagBar.style.gap = '6px';
      tagBar.style.margin = '8px 0 0 0';
      searchInput.parentNode.insertBefore(tagBar, searchInput.nextSibling);
    }
    tagBar.innerHTML = '';
    Array.from(tagSet).sort().forEach(tag => {
      const btn = document.createElement('button');
      btn.textContent = `#${tag}`;
      btn.className = 'tag-filter-btn';
      btn.onclick = () => {
        searchInput.value = tag;
        searchInput.dispatchEvent(new Event('input'));
      };
      tagBar.appendChild(btn);
    });
  }

  // Store sort value globally
  let currentSort = 'date';

  // Sorting UI
  function renderSortOptions() {
    let sortBar = document.getElementById('sortBar');
    if (!sortBar) {
      sortBar = document.createElement('div');
      sortBar.id = 'sortBar';
      sortBar.style.display = 'flex';
      sortBar.style.gap = '8px';
      sortBar.style.margin = '8px 0 0 0';
      searchInput.parentNode.insertBefore(sortBar, searchInput.nextSibling.nextSibling);
    }
    sortBar.innerHTML = `
      <label style="color:#b0b8c1;font-size:13px;">Sort:</label>
      <select id="sortSelect" style="background:#232a36;color:#e3e6eb;border-radius:5px;padding:2px 8px;">
        <option value="pinned">Pinned</option>
        <option value="date">Date</option>
        <option value="title">Title</option>
      </select>
    `;
    const sortSelect = document.getElementById('sortSelect');
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', (e) => {
      currentSort = sortSelect.value;
      chrome.storage.sync.get({ bookmarks: [] }, (data) => {
        renderBookmarks(data.bookmarks);
      });
    });
  }

  // Store all bookmarks globally for color filter reset
  let allBookmarks = [];

  // --- Folder Filter Bar ---
  function renderFolderBar(bookmarks) {
    const folderSet = new Set(bookmarks.map(b => b.folder).filter(Boolean));
    let folderBar = document.getElementById('folderBar');
    if (!folderBar) {
      folderBar = document.createElement('div');
      folderBar.id = 'folderBar';
      folderBar.className = 'folder-grid';
      searchInput.parentNode.insertBefore(folderBar, searchInput.nextSibling);
    }
    folderBar.innerHTML = '';
    Array.from(folderSet).sort().forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'folder-grid-item';
      folderDiv.title = folder;
      folderDiv.tabIndex = 0;
      folderDiv.onclick = () => {
        renderBookmarks(bookmarks.filter(b => b.folder === folder));
      };
      folderDiv.innerHTML = `
        <img src="icons/folder-48.png" alt="${folder}" class="folder-icon" />
        <div class="folder-name">${folder}</div>
      `;
      folderBar.appendChild(folderDiv);
    });
    if (folderSet.size > 0) {
      const showAllDiv = document.createElement('div');
      showAllDiv.className = 'folder-grid-item';
      showAllDiv.title = 'Show All';
      showAllDiv.tabIndex = 0;
      showAllDiv.onclick = () => {
        chrome.storage.sync.get({ bookmarks: [] }, (data) => {
          renderBookmarks(data.bookmarks);
        });
      };
      showAllDiv.innerHTML = `
        <img src="icons/folder-48.png" alt="Show All" class="folder-icon" style="opacity:0.5;" />
        <div class="folder-name">Show All</div>
      `;
      folderBar.appendChild(showAllDiv);
    }
  }

  // Render bookmarks
  function renderBookmarks(bookmarks) {
    renderFolderBar(bookmarks);
    renderTagFilters(bookmarks);
    renderSortOptions();
    bookmarkList.innerHTML = "";
    let sort = currentSort;
    let sorted = [...bookmarks];
    if (sort === 'pinned') {
      sorted = sorted.filter(b => b.pinned === true);
      if (sorted.length === 0) {
        // If no pinned bookmarks left, switch to 'date' filter
        currentSort = 'date';
        renderSortOptions();
        sorted = [...bookmarks];
        sorted.sort((a, b) => new Date(b.time) - new Date(a.time));
      }
    }
    if (sort === 'date') sorted.sort((a, b) => new Date(b.time) - new Date(a.time)); // Newest first
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    sorted.forEach((b, idx) => {
      const li = document.createElement("li");
      li.className = "bookmark-item";
      li.innerHTML = `
        <div class="bookmark-actions">
          <button class="pin-btn${b.pinned ? ' pinned' : ''}" title="${b.pinned ? 'Unpin' : 'Pin'}" data-idx="${idx}">${b.pinned ? '★' : '☆'}</button>
          <button class="edit-btn" title="Edit" data-idx="${idx}">&#9998;</button>
          <button class="delete-btn" title="Delete" data-idx="${idx}">&times;</button>
          <button class="copy-btn" title="Copy Link" data-idx="${idx}">⧉</button>
          <div class="color-palette" data-idx="${idx}">
            <button class="color-swatch" style="background:#4f8cff" data-color="#4f8cff"></button>
            <button class="color-swatch" style="background:#ff4d4f" data-color="#ff4d4f"></button>
            <button class="color-swatch" style="background:#ffb347" data-color="#ffb347"></button>
            <button class="color-swatch" style="background:#00c49a" data-color="#00c49a"></button>
            <button class="color-swatch" style="background:#b36bff" data-color="#b36bff"></button>
          </div>
        </div>
        <strong>${b.title}</strong>
        <small>${b.url}</small><br/>
        <em>${b.tags.join(", ")}</em><br/>
        <p>${b.note}</p>
        <div class="bookmark-meta">
          <span class="bookmark-date">${new Date(b.time).toLocaleString()}</span>
          ${b.favicon ? `<img src="${b.favicon}" class="bookmark-favicon" alt="favicon"/>` : ''}
        </div>
      `;
      li.querySelector(".delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.storage.sync.get({ bookmarks: [] }, (data) => {
          const updated = data.bookmarks.filter((bm) => !(bm.url === b.url && bm.time === b.time));
          chrome.storage.sync.set({ bookmarks: updated }, () => {
            renderBookmarks(updated);
          });
        });
      });
      li.querySelector(".edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        tagsInput.value = b.tags.join(", ");
        noteInput.value = b.note;
        folderInput.value = b.folder;
        // Store a unique identifier for editing
        saveBtn.setAttribute('data-editing-url', b.url);
        saveBtn.setAttribute('data-editing-time', b.time);
      });
      li.querySelector(".pin-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.storage.sync.get({ bookmarks: [] }, (data) => {
          // Find the correct bookmark by url and time
          const updated = data.bookmarks.map((bm) =>
            bm.url === b.url && bm.time === b.time ? { ...bm, pinned: !bm.pinned } : bm
          );
          chrome.storage.sync.set({ bookmarks: updated }, () => {
            if (currentSort === 'pinned' && !updated.some(bm => bm.pinned)) {
              currentSort = 'date';
              renderSortOptions();
              setTimeout(() => {
                chrome.storage.sync.get({ bookmarks: [] }, (fresh) => {
                  renderBookmarks(fresh.bookmarks);
                });
              }, 0);
              return;
            }
            renderBookmarks(updated);
          });
        });
      });
      li.querySelector(".copy-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(b.url);
      });
      li.querySelectorAll('.color-swatch').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const color = btn.getAttribute('data-color');
          chrome.storage.sync.get({ bookmarks: [] }, (data) => {
            const updated = data.bookmarks.map((bm, i) => i === idx ? { ...bm, color } : bm);
            chrome.storage.sync.set({ bookmarks: updated }, () => {
              renderBookmarks(updated);
            });
          });
        });
      });
      if (b.color) li.style.borderLeft = `6px solid ${b.color}`;
      else li.style.borderLeft = `4px solid #4f8cff`;
      li.onclick = (e) => {
        if (["delete-btn", "edit-btn", "pin-btn"].some(cls => e.target.classList.contains(cls))) return;
        chrome.tabs.create({ url: b.url });
      };
      bookmarkList.appendChild(li);
    });
  }

  // Load bookmarks
  chrome.storage.sync.get({ bookmarks: [] }, (data) => {
    renderBookmarks(data.bookmarks);
  });

  // Search
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    chrome.storage.sync.get({ bookmarks: [] }, (data) => {
      let filtered = data.bookmarks.filter(b =>
        b.title.toLowerCase().includes(query) ||
        b.url.toLowerCase().includes(query) ||
        b.tags.some(tag => tag.toLowerCase().includes(query))
      );
      // Group by tag if query matches a tag
      if (query && filtered.length > 0) {
        const tagGroups = {};
        filtered.forEach(b => {
          b.tags.forEach(tag => {
            if (tag.toLowerCase().includes(query)) {
              if (!tagGroups[tag]) tagGroups[tag] = [];
              tagGroups[tag].push(b);
            }
          });
        });
        bookmarkList.innerHTML = '';
        Object.entries(tagGroups).forEach(([tag, bookmarks]) => {
          const groupHeader = document.createElement('li');
          groupHeader.innerHTML = `<div style="font-weight:bold;color:#4f8cff;margin:8px 0 4px 0;">#${tag}</div>`;
          bookmarkList.appendChild(groupHeader);
          renderBookmarks(bookmarks);
        });
      } else {
        renderBookmarks(filtered);
      }
    });
  });

  // Tag suggestions/autocomplete
  tagsInput.addEventListener('input', () => {
    const val = tagsInput.value.toLowerCase();
    if (!val) return;
    chrome.storage.sync.get({ bookmarks: [] }, (data) => {
      const allTags = Array.from(new Set(data.bookmarks.flatMap(b => b.tags)));
      const suggestions = allTags.filter(tag => tag.toLowerCase().startsWith(val) && !val.split(',').map(t=>t.trim()).includes(tag));
      let datalist = document.getElementById('tag-suggestions');
      if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'tag-suggestions';
        tagsInput.setAttribute('list', 'tag-suggestions');
        document.body.appendChild(datalist);
      }
      datalist.innerHTML = suggestions.map(tag => `<option value="${tag}">`).join('');
    });
  });
});
