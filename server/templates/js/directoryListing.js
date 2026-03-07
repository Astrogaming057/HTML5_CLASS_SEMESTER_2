// Editable file extensions
const EDITABLE_EXTENSIONS = ['json', 'css', 'js', 'md', 'html', 'htm', 'txt', 'xml', 'yaml', 'yml', 'ts', 'jsx', 'tsx', 'vue', 'sass', 'scss', 'less', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'sh', 'bat', 'ps1'];

function addRow(name, url, isdir, size, size_string, date_modified, date_modified_string) {
  if (name == "." || name == "..")
    return;

  var root = document.location.pathname;
  // Normalize root path - remove trailing slashes and double slashes
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
    
    // Add ctrl+click handler for editable files
    const ext = name.split('.').pop().toLowerCase();
    if (EDITABLE_EXTENSIONS.includes(ext)) {
      link.addEventListener('click', function(e) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          openEditor(root + url.replace(/\/$/, ''));
        }
      });
      link.style.cursor = 'pointer';
      link.title = 'Ctrl+Click to edit';
    }
  }
  link.innerText = name;
  link.href = root + url;

  // Add right-click context menu
  row.addEventListener('contextmenu', function(e) {
    e.preventDefault();
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
  // Normalize path - remove trailing slashes and double slashes
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

    // Column 0 is text.
    if (a > b)
      return newOrder;
    if (a < b)
      return oldOrder;
    return 0;
  });

  // Appending an existing child again just moves it.
  for (i = 0; i < list.length; i++) {
    tbody.appendChild(list[i]);
  }
}

// Add event handlers to column headers.
function addHandlers(element, column) {
  element.onclick = (e) => sortTable(column);
  element.onkeydown = (e) => {
    if (e.key == 'Enter' || e.key == ' ') {
      sortTable(column);
      e.preventDefault();
    }
  };
}

// Context menu functionality
let contextMenu = null;

function showContextMenu(e, name, isdir, path) {
  // Remove existing context menu
  if (contextMenu) {
    contextMenu.remove();
  }

  // Create context menu
  contextMenu = document.createElement('div');
  contextMenu.id = 'contextMenu';
  contextMenu.style.cssText = 'position: fixed; background: #ffffff; border: 1px solid #d0d0d0; box-shadow: 2px 2px 10px rgba(0,0,0,0.3); z-index: 10000; padding: 4px 0; min-width: 180px; border-radius: 4px;';
  
  const currentDir = document.location.pathname.replace(/\/+$/, '').replace(/\/+/g, '/') || '/';
  
  // Check if file is editable
  const isEditable = !isdir && isEditableFile(name);
  
  if (!isdir) {
    // Open in Editor option for all files
    const openEditorItem = createMenuItem('📝 Open in Editor', () => {
      openEditor(path);
      contextMenu.remove();
      contextMenu = null;
    });
    contextMenu.appendChild(openEditorItem);
    
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
}

window.addEventListener('DOMContentLoaded', onLoad);
