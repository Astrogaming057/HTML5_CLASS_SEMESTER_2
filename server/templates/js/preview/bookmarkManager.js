window.PreviewBookmarkManager = (function() {
  const STORAGE_KEY = 'browser_bookmarks';
  let bookmarks = [];
  let bookmarksContainer = null;
  let bookmarksMenu = null;
  let bookmarkDialog = null;
  let navigateCallback = null;

  function loadBookmarks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        bookmarks = JSON.parse(stored);
      } else {
        bookmarks = [];
      }
    } catch (e) {
      console.error('Error loading bookmarks:', e);
      bookmarks = [];
    }
  }

  function saveBookmarks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Error saving bookmarks:', e);
    }
  }

  function createBookmarkElement(bookmark) {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.dataset.bookmarkId = bookmark.id;
    item.title = bookmark.url;
    
    const title = document.createElement('span');
    title.className = 'bookmark-item-title';
    title.textContent = bookmark.title || bookmark.url;
    
    const remove = document.createElement('button');
    remove.className = 'bookmark-item-remove';
    remove.textContent = '×';
    remove.title = 'Remove bookmark';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBookmark(bookmark.id);
    });
    
    item.appendChild(title);
    item.appendChild(remove);
    
    item.addEventListener('click', (e) => {
      if (e.target !== remove) {
        navigateToBookmark(bookmark.url);
      }
    });
    
    return item;
  }

  function createMenuBookmarkElement(bookmark) {
    const item = document.createElement('div');
    item.className = 'bookmark-menu-item';
    item.dataset.bookmarkId = bookmark.id;
    
    const info = document.createElement('div');
    info.className = 'bookmark-menu-item-info';
    
    const title = document.createElement('div');
    title.className = 'bookmark-menu-item-title';
    title.textContent = bookmark.title || bookmark.url;
    
    const url = document.createElement('div');
    url.className = 'bookmark-menu-item-url';
    url.textContent = bookmark.url;
    
    info.appendChild(title);
    info.appendChild(url);
    
    const actions = document.createElement('div');
    actions.className = 'bookmark-menu-item-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'bookmark-menu-item-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit bookmark';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEditDialog(bookmark);
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'bookmark-menu-item-btn';
    removeBtn.textContent = '🗑️';
    removeBtn.title = 'Delete bookmark';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBookmark(bookmark.id);
    });
    
    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);
    
    item.appendChild(info);
    item.appendChild(actions);
    
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('bookmark-menu-item-btn')) {
        navigateToBookmark(bookmark.url);
        hideMenu();
      }
    });
    
    return item;
  }

  function renderBookmarks() {
    if (!bookmarksContainer) return;
    
    bookmarksContainer.innerHTML = '';
    
    bookmarks.forEach(bookmark => {
      const element = createBookmarkElement(bookmark);
      bookmarksContainer.appendChild(element);
    });
  }

  function renderMenu() {
    if (!bookmarksMenu) return;
    
    const menuContent = bookmarksMenu.querySelector('.bookmarks-menu-content');
    if (!menuContent) return;
    
    menuContent.innerHTML = '';
    
    if (bookmarks.length === 0) {
      const empty = document.createElement('div');
      empty.style.padding = '20px';
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--text-secondary)';
      empty.textContent = 'No bookmarks yet';
      menuContent.appendChild(empty);
    } else {
      bookmarks.forEach(bookmark => {
        const element = createMenuBookmarkElement(bookmark);
        menuContent.appendChild(element);
      });
    }
  }

  function addBookmark(url, title) {
    if (!url || url.trim() === '') return;
    
    // Check if bookmark already exists
    const existing = bookmarks.find(b => b.url === url);
    if (existing) {
      // Update existing bookmark
      existing.title = title || url;
      saveBookmarks();
      renderBookmarks();
      renderMenu();
      return existing.id;
    }
    
    const bookmark = {
      id: Date.now().toString(),
      url: url.trim(),
      title: title || url.trim(),
      dateAdded: new Date().toISOString()
    };
    
    bookmarks.push(bookmark);
    saveBookmarks();
    renderBookmarks();
    renderMenu();
    
    return bookmark.id;
  }

  function removeBookmark(id) {
    bookmarks = bookmarks.filter(b => b.id !== id);
    saveBookmarks();
    renderBookmarks();
    renderMenu();
  }

  function updateBookmark(id, url, title) {
    const bookmark = bookmarks.find(b => b.id === id);
    if (bookmark) {
      bookmark.url = url.trim();
      bookmark.title = title || url.trim();
      saveBookmarks();
      renderBookmarks();
      renderMenu();
    }
  }

  function navigateToBookmark(url) {
    if (navigateCallback) {
      navigateCallback(url);
    }
  }

  function showMenu() {
    if (!bookmarksMenu) return;
    renderMenu();
    bookmarksMenu.classList.add('active');
  }

  function hideMenu() {
    if (!bookmarksMenu) return;
    bookmarksMenu.classList.remove('active');
  }

  function showAddDialog(currentUrl = '', currentTitle = '') {
    if (!bookmarkDialog) return;
    
    const titleInput = bookmarkDialog.querySelector('#bookmarkDialogTitle');
    const urlInput = bookmarkDialog.querySelector('#bookmarkDialogUrl');
    const header = bookmarkDialog.querySelector('.bookmark-dialog-header');
    
    if (titleInput) titleInput.value = currentTitle;
    if (urlInput) urlInput.value = currentUrl;
    if (header) header.textContent = 'Add Bookmark';
    
    bookmarkDialog.dataset.bookmarkId = '';
    bookmarkDialog.classList.add('active');
    
    if (urlInput) urlInput.focus();
  }

  function showEditDialog(bookmark) {
    if (!bookmarkDialog || !bookmark) return;
    
    const titleInput = bookmarkDialog.querySelector('#bookmarkDialogTitle');
    const urlInput = bookmarkDialog.querySelector('#bookmarkDialogUrl');
    const header = bookmarkDialog.querySelector('.bookmark-dialog-header');
    
    if (titleInput) titleInput.value = bookmark.title || '';
    if (urlInput) urlInput.value = bookmark.url || '';
    if (header) header.textContent = 'Edit Bookmark';
    
    bookmarkDialog.dataset.bookmarkId = bookmark.id;
    bookmarkDialog.classList.add('active');
    
    if (titleInput) titleInput.focus();
  }

  function hideDialog() {
    if (!bookmarkDialog) return;
    bookmarkDialog.classList.remove('active');
  }

  function initialize(container, menu, dialog, navigateFn) {
    bookmarksContainer = container;
    bookmarksMenu = menu;
    bookmarkDialog = dialog;
    navigateCallback = navigateFn;
    
    loadBookmarks();
    renderBookmarks();
    
    // Setup menu button
    const menuBtn = document.getElementById('bookmarksMenuBtn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (bookmarksMenu.classList.contains('active')) {
          hideMenu();
        } else {
          showMenu();
        }
      });
    }
    
    // Setup menu close button
    const menuCloseBtn = bookmarksMenu?.querySelector('.bookmarks-menu-close');
    if (menuCloseBtn) {
      menuCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideMenu();
      });
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (bookmarksMenu && !bookmarksMenu.contains(e.target) && !menuBtn?.contains(e.target)) {
        hideMenu();
      }
    });
    
    // Setup dialog
    if (bookmarkDialog) {
      const cancelBtn = bookmarkDialog.querySelector('.bookmark-dialog-btn-secondary');
      const saveBtn = bookmarkDialog.querySelector('.bookmark-dialog-btn-primary');
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', hideDialog);
      }
      
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const titleInput = bookmarkDialog.querySelector('#bookmarkDialogTitle');
          const urlInput = bookmarkDialog.querySelector('#bookmarkDialogUrl');
          const bookmarkId = bookmarkDialog.dataset.bookmarkId;
          
          if (urlInput && urlInput.value.trim()) {
            if (bookmarkId) {
              updateBookmark(bookmarkId, urlInput.value.trim(), titleInput?.value.trim() || '');
            } else {
              addBookmark(urlInput.value.trim(), titleInput?.value.trim() || '');
            }
            hideDialog();
          }
        });
      }
      
      // Close dialog on background click
      bookmarkDialog.addEventListener('click', (e) => {
        if (e.target === bookmarkDialog) {
          hideDialog();
        }
      });
    }
  }

  function bookmarkCurrentPage(url, title) {
    return addBookmark(url, title);
  }

  return {
    initialize,
    addBookmark,
    removeBookmark,
    updateBookmark,
    bookmarkCurrentPage,
    showAddDialog,
    showMenu,
    hideMenu,
    getBookmarks: () => [...bookmarks]
  };
})();
