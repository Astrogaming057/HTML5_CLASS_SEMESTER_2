const EDITABLE_EXTENSIONS = ['json', 'css', 'js', 'md', 'html', 'htm', 'txt', 'xml', 'yaml', 'yml', 'ts', 'jsx', 'tsx', 'vue', 'sass', 'scss', 'less', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'sh', 'bat', 'ps1'];

let settings = {
  clickBehavior: 'open',
  previewMode: 'editor',
  autoRefresh: true,
  showHidden: false,
  sizeFormat: 'human'
};

function loadSettings() {
  const saved = localStorage.getItem('fileExplorerSettings');
  if (saved) {
    try {
      settings = { ...settings, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }
  applySettings();
}

function saveSettingsToStorage() {
  localStorage.setItem('fileExplorerSettings', JSON.stringify(settings));
}

function applySettings() {
  if (document.getElementById('clickBehavior')) {
    document.getElementById('clickBehavior').value = settings.clickBehavior;
  }
  if (document.getElementById('previewMode')) {
    document.getElementById('previewMode').value = settings.previewMode || 'editor';
  }
  if (document.getElementById('autoRefresh')) {
    document.getElementById('autoRefresh').checked = settings.autoRefresh;
  }
  if (document.getElementById('showHidden')) {
    document.getElementById('showHidden').checked = settings.showHidden;
  }
  if (document.getElementById('sizeFormat')) {
    document.getElementById('sizeFormat').value = settings.sizeFormat;
  }
}

let ws = null;
let wsStatusIndicator = null;

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = protocol + '//' + window.location.host;
  ws = new WebSocket(wsUrl);
  
  if (!wsStatusIndicator) {
    wsStatusIndicator = document.createElement('div');
    wsStatusIndicator.className = 'ws-status';
    wsStatusIndicator.textContent = 'Connecting...';
    document.body.appendChild(wsStatusIndicator);
  }
  
  ws.onopen = () => {
    wsStatusIndicator.textContent = 'Connected';
    wsStatusIndicator.className = 'ws-status connected';
  };
  
  ws.onclose = () => {
    wsStatusIndicator.textContent = 'Disconnected';
    wsStatusIndicator.className = 'ws-status disconnected';
    setTimeout(setupWebSocket, 2000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    wsStatusIndicator.textContent = 'Error';
    wsStatusIndicator.className = 'ws-status disconnected';
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (!settings.autoRefresh) return;
      
      const currentPath = window.location.pathname.replace(/\/+$/, '').replace(/\/+/g, '/') || '/';
      const changedPath = data.path.replace(/\\/g, '/');
      const normalizedCurrentPath = currentPath.replace(/^\/+/, '');
      
      const affectsCurrentDir = 
        changedPath.startsWith(normalizedCurrentPath) || 
        normalizedCurrentPath === '' ||
        currentPath === '/';
      
      if (affectsCurrentDir) {
        if (data.type === 'fileChanged') {
          console.log('File changed, reloading...', changedPath);
          location.reload();
        } else if (data.type === 'fileAdded' || data.type === 'fileDeleted') {
          console.log('File added/deleted, reloading...', changedPath);
          location.reload();
        } else if (data.type === 'directoryAdded' || data.type === 'directoryDeleted') {
          console.log('Directory added/deleted, reloading...', changedPath);
          location.reload();
        }
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  };
}

function addRow(name, url, isdir, size, size_string, date_modified, date_modified_string) {
  if (name == "." || name == "..")
    return;

  var root = document.location.pathname;
  root = root.replace(/\/+$/, '').replace(/\/+/g, '/') || '/';
  if (root !== '/' && !root.endsWith('/'))
    root += "/";

  var tbody = document.getElementById("tbody");
  var row = document.createElement("tr");
  var file_cell = document.createElement("td");
  var link = document.createElement("a");

  link.className = isdir ? "icon dir" : "icon file";

  if (isdir) {
    name = name + "/";
    url = url + "/";
    size = 0;
    size_string = "";
  } else {
    link.draggable = "true";
    link.addEventListener("dragstart", onDragStart, false);
    
    const ext = name.split('.').pop().toLowerCase();
    const isEditable = EDITABLE_EXTENSIONS.includes(ext);
    
    if (isEditable) {
      const isHTML = ext === 'html' || ext === 'htm';
      
      link.addEventListener('click', function(e) {
        if (settings.clickBehavior === 'editor') {
          if (e.ctrlKey || e.metaKey) {
            return;
          } else {
            e.preventDefault();
            if (isHTML && settings.previewMode === 'preview') {
              openPreview(root + url.replace(/\/$/, ''));
            } else {
              openEditor(root + url.replace(/\/$/, ''));
            }
          }
        } else {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (isHTML && settings.previewMode === 'preview') {
              openPreview(root + url.replace(/\/$/, ''));
            } else {
              openEditor(root + url.replace(/\/$/, ''));
            }
          }
        }
      });
      link.style.cursor = 'pointer';
      if (settings.clickBehavior === 'editor') {
        if (isHTML && settings.previewMode === 'preview') {
          link.title = 'Click to preview (Ctrl+Click to open file)';
        } else {
          link.title = 'Click to edit (Ctrl+Click to open file)';
        }
      } else {
        if (isHTML && settings.previewMode === 'preview') {
          link.title = 'Click to open (Ctrl+Click to preview)';
        } else {
          link.title = 'Click to open (Ctrl+Click to edit)';
        }
      }
    }
  }
  link.innerText = name;
  link.href = root + url;

  row.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent document-level handler from firing
    showContextMenu(e, name, isdir, root + url);
  });

  file_cell.dataset.value = name;
  file_cell.appendChild(link);

  row.appendChild(file_cell);
  row.appendChild(createCell(size, size_string));
  row.appendChild(createCell(date_modified, date_modified_string));

  tbody.appendChild(row);
}

function openEditor(filePath) {
  window.open('/__editor__?file=' + encodeURIComponent(filePath), '_blank');
}

function openPreview(filePath) {
  window.open('/__preview__?file=' + encodeURIComponent(filePath) + '&force=true', '_blank');
}

function onDragStart(e) {
  var el = e.srcElement;
  var name = el.innerText.replace(":", "");
  var download_url_data = "application/octet-stream:" + name + ":" + el.href;
  e.dataTransfer.setData("DownloadURL", download_url_data);
  e.dataTransfer.effectAllowed = "copy";
}

function createCell(value, text) {
  var cell = document.createElement("td");
  cell.setAttribute("class", "detailsColumn");
  cell.dataset.value = value;
  cell.innerText = text;
  return cell;
}

function start(location) {
  var header = document.getElementById("header");
  header.innerText = header.innerText.replace("LOCATION", location);

  document.getElementById("title").innerText = header.innerText;
}

function onHasParentDirectory() {
  var box = document.getElementById("parentDirLinkBox");
  box.style.display = "block";

  var root = document.location.pathname;
  root = root.replace(/\/+$/, '').replace(/\/+/g, '/') || '/';
  if (root !== '/' && !root.endsWith("/"))
    root += "/";

  var link = document.getElementById("parentDirLink");
  link.href = root + "..";
}

function sortTable(column) {
  var theader = document.getElementById("theader");
  var oldOrder = theader.cells[column].dataset.order || '1';
  oldOrder = parseInt(oldOrder, 10)
  var newOrder = 0 - oldOrder;
  theader.cells[column].dataset.order = newOrder;

  var tbody = document.getElementById("tbody");
  var rows = tbody.rows;
  var list = [], i;
  for (i = 0; i < rows.length; i++) {
    list.push(rows[i]);
  }

  list.sort(function(row1, row2) {
    var a = row1.cells[column].dataset.value;
    var b = row2.cells[column].dataset.value;
    if (column) {
      a = parseInt(a, 10);
      b = parseInt(b, 10);
      return a > b ? newOrder : a < b ? oldOrder : 0;
    }

    if (a > b)
      return newOrder;
    if (a < b)
      return oldOrder;
    return 0;
  });

  for (i = 0; i < list.length; i++) {
    tbody.appendChild(list[i]);
  }
}

function addHandlers(element, column) {
  element.onclick = (e) => sortTable(column);
  element.onkeydown = (e) => {
    if (e.key == 'Enter' || e.key == ' ') {
      sortTable(column);
      e.preventDefault();
    }
  };
}

let contextMenu = null;

function showContextMenu(e, name, isdir, path) {
  if (contextMenu) {
    contextMenu.remove();
  }
  
  contextMenu = document.createElement('div');
  contextMenu.id = 'contextMenu';
  contextMenu.style.cssText = 'position: fixed; background: #ffffff; border: 1px solid #d0d0d0; box-shadow: 2px 2px 10px rgba(0,0,0,0.3); z-index: 10000; padding: 4px 0; min-width: 180px; border-radius: 4px;';
  
  const currentDir = document.location.pathname.replace(/\/+$/, '').replace(/\/+/g, '/') || '/';
  
  if (!name) {
    const newFileItem = createMenuItem('📄 New File', () => {
      const fileName = prompt('Enter file name:');
      if (fileName) {
        createFile(currentDir, fileName);
      }
      contextMenu.remove();
      contextMenu = null;
    });
    contextMenu.appendChild(newFileItem);
    
    const newFolderItem = createMenuItem('📁 New Folder', () => {
      const folderName = prompt('Enter folder name:');
      if (folderName) {
        createFolder(currentDir, folderName);
      }
      contextMenu.remove();
      contextMenu = null;
    });
    contextMenu.appendChild(newFolderItem);
    
    document.body.appendChild(contextMenu);
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    
    // Close menu on click outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        if (contextMenu) {
          contextMenu.remove();
          contextMenu = null;
        }
        document.removeEventListener('click', closeMenu);
      });
    }, 0);
    return;
  }
  
  const isEditable = !isdir && isEditableFile(name);
  
  if (!isdir) {
    // Check if file is HTML
    const ext = name.split('.').pop().toLowerCase();
    const isHTML = ext === 'html' || ext === 'htm';
    
    // Open in Editor option for all files
    const openEditorItem = createMenuItem('📝 Open in Editor', () => {
      openEditor(path);
      contextMenu.remove();
      contextMenu = null;
    });
    contextMenu.appendChild(openEditorItem);
    
    // Open in Preview option for HTML files
    if (isHTML) {
      const openPreviewItem = createMenuItem('👁️ Open in Preview', () => {
        openPreview(path);
        contextMenu.remove();
        contextMenu = null;
      });
      contextMenu.appendChild(openPreviewItem);
    }
    
    // Add separator
    contextMenu.appendChild(createSeparator());
  }
  
  const newFileItem = createMenuItem('📄 New File', () => {
    const fileName = prompt('Enter file name:');
    if (fileName) {
      createFile(currentDir, fileName);
    }
    contextMenu.remove();
    contextMenu = null;
  });
  contextMenu.appendChild(newFileItem);
  
  const newFolderItem = createMenuItem('📁 New Folder', () => {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
      createFolder(currentDir, folderName);
    }
    contextMenu.remove();
    contextMenu = null;
  });
  contextMenu.appendChild(newFolderItem);
  
  if (!isdir) {
    // Add separator before delete
    contextMenu.appendChild(createSeparator());
    
    const deleteItem = createMenuItem('🗑️ Delete', () => {
      if (confirm('Are you sure you want to delete ' + name + '?')) {
        deleteFile(path);
      }
      contextMenu.remove();
      contextMenu = null;
    });
    deleteItem.style.color = '#d32f2f';
    contextMenu.appendChild(deleteItem);
  }
  
  document.body.appendChild(contextMenu);
  contextMenu.style.left = e.pageX + 'px';
  contextMenu.style.top = e.pageY + 'px';
  
  setTimeout(() => {
    document.addEventListener('click', function closeMenu() {
      if (contextMenu) {
        contextMenu.remove();
        contextMenu = null;
      }
      document.removeEventListener('click', closeMenu);
    });
  }, 0);
}

function isEditableFile(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return EDITABLE_EXTENSIONS.includes(ext);
}

function createSeparator() {
  const separator = document.createElement('div');
  separator.style.cssText = 'height: 1px; background: #e0e0e0; margin: 4px 0;';
  return separator;
}

function createMenuItem(text, onClick) {
  const item = document.createElement('div');
  item.textContent = text;
  item.style.cssText = 'padding: 8px 15px; cursor: pointer; color: #212121; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;';
  item.onmouseover = () => {
    item.style.background = '#e3f2fd';
    item.style.color = '#1976d2';
  };
  item.onmouseout = () => {
    item.style.background = '#ffffff';
    item.style.color = '#212121';
  };
  item.onclick = onClick;
  return item;
}

function createFile(dir, fileName) {
  fetch('/__api__/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dir, name: fileName, type: 'file' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      location.reload();
    } else {
      alert('Error: ' + data.error);
    }
  })
  .catch(err => {
    alert('Error creating file: ' + err.message);
  });
}

function createFolder(dir, folderName) {
  fetch('/__api__/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dir, name: folderName, type: 'folder' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      location.reload();
    } else {
      alert('Error: ' + data.error);
    }
  })
  .catch(err => {
    alert('Error creating folder: ' + err.message);
  });
}

function deleteFile(filePath) {
  fetch('/__api__/files', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      location.reload();
    } else {
      alert('Error: ' + data.error);
    }
  })
  .catch(err => {
    alert('Error deleting file: ' + err.message);
  });
}

function onLoad() {
  addHandlers(document.getElementById('nameColumnHeader'), 0);
  addHandlers(document.getElementById('sizeColumnHeader'), 1);
  addHandlers(document.getElementById('dateColumnHeader'), 2);
  
  // Load settings
  loadSettings();
  
  // Setup WebSocket
  setupWebSocket();
  
  // Setup settings button
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      document.getElementById('settingsPanel').style.display = 'flex';
      applySettings();
    });
  }
  
  // Add right-click to entire page for creating files/folders
  document.addEventListener('contextmenu', function(e) {
    // Don't show menu if clicking on existing context menu items or settings
    if (e.target.closest('#contextMenu') || e.target.closest('#settingsPanel') || e.target.closest('.settings-btn')) {
      return;
    }
    
    // If clicking on a table row, let the row's handler take over
    if (e.target.closest('tr') && e.target.closest('tbody')) {
      return; // Let the row's contextmenu handler deal with it
    }
    
    // For everything else (empty space, header, etc.), show create menu
    e.preventDefault();
    const currentDir = document.location.pathname.replace(/\/+$/, '').replace(/\/+/g, '/') || '/';
    showContextMenu(e, '', false, currentDir);
  });
}

// Settings functions
window.closeSettings = function() {
  document.getElementById('settingsPanel').style.display = 'none';
};

window.saveSettings = function() {
  settings.clickBehavior = document.getElementById('clickBehavior').value;
  settings.previewMode = document.getElementById('previewMode').value;
  settings.autoRefresh = document.getElementById('autoRefresh').checked;
  settings.showHidden = document.getElementById('showHidden').checked;
  settings.sizeFormat = document.getElementById('sizeFormat').value;
  
  saveSettingsToStorage();
  closeSettings();
  
  // Reload to apply click behavior changes
  location.reload();
};

window.resetSettings = function() {
  settings = {
    clickBehavior: 'open',
    previewMode: 'editor',
    autoRefresh: true,
    showHidden: false,
    sizeFormat: 'human'
  };
  applySettings();
  saveSettingsToStorage();
};

window.addEventListener('DOMContentLoaded', onLoad);
