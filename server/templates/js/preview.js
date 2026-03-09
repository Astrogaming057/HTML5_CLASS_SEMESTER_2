const urlParams = new URLSearchParams(window.location.search);
let filePath = urlParams.get('file');
const forceLoad = urlParams.get('force') === 'true' || urlParams.get('noRestore') === 'true';
let currentDir = '';

let editor = null;
const originalContent = { current: '' };
const isDirty = { current: false };
let previewFrame = null;
let fileTree = null;
const ws = { current: null };

const syncChannel = new BroadcastChannel('preview-sync');

const getLanguage = PreviewUtils.getLanguage;

require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function() {
  let logMessageListenerSetup = false;
  
  const editorContainer = document.getElementById('editor');
  const saveBtn = document.getElementById('saveBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const closeBtn = document.getElementById('closeBtn');
  const resetSettingsBtn = document.getElementById('resetSettingsBtn');
  const backToFilesBtn = document.getElementById('backToFilesBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsCloseBtn = document.getElementById('settingsCloseBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const resetSettingsBtn2 = document.getElementById('resetSettingsBtn2');
  const status = document.getElementById('status');
  const fileName = document.getElementById('fileName');
  previewFrame = document.getElementById('previewFrame');
  fileTree = document.getElementById('fileTree');
  const imagePreview = document.getElementById('imagePreview');
  const previewImage = document.getElementById('previewImage');
  const previewTitle = document.getElementById('previewTitle');
  const backToPreviewBtn = document.getElementById('backToPreviewBtn');
  const toggleExplorer = document.getElementById('toggleExplorer');
  const fileExplorerPanel = document.getElementById('fileExplorerPanel');
  const backBtn = document.getElementById('backBtn');
  const editorPanel = document.getElementById('editorPanel');
  const previewPanel = document.getElementById('previewPanel');
  const togglePreview = document.getElementById('togglePreview');
  const contextMenu = document.getElementById('contextMenu');
  const resizerEditor = document.getElementById('resizerEditor');
  const editorTabsContainer = document.getElementById('editorTabsContainer');
  const pinPreviewBtn = document.getElementById('pinPreviewBtn');
  const previewPinned = { current: false };
  const previewPinnedPath = { current: null };
  
  const filePathRef = { current: filePath };
  const currentDirRef = { currentDir: '' };
  const isRestoringStateRef = { current: true };
  const terminalAtBottomRef = { current: false };
  const saveToEditorTimeout = { current: null };
  
  const initResult = PreviewInitialization.initializeState(filePath, forceLoad, currentDirRef);
  if (initResult.error) {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = 'Error: ' + initResult.error;
      status.className = 'status error';
    }
    return;
  }
  
  currentDir = currentDirRef.currentDir;
  fileName.textContent = filePath.split('/').pop();
  const language = getLanguage(filePath);
  
  PreviewSettings.loadPreviewSettings();
  const previewSettings = PreviewSettings.getSettings();
  
  const receivedLogIds = new Set();
  const generateLogId = PreviewUtils.generateLogId;
  
  const customPrompt = PreviewUtils.customPrompt;
  const customConfirm = PreviewUtils.customConfirm;
  
  PreviewInitialization.initializeVisibility(resizerEditor, previewPanel);
  
  function loadFileTree(dir) {
    PreviewFileExplorer.loadFileTree(
      dir, fileTree, currentDirRef, updateBackButton, saveState,
      (files, dir) => renderFileTree(files, dir),
      (dir) => fetchDirectoryListing(dir)
    );
    currentDir = currentDirRef.currentDir;
  }
  
  function fetchDirectoryListing(dir) {
    PreviewFileExplorer.fetchDirectoryListing(dir, fileTree, (files, dir) => renderFileTree(files, dir));
  }
  
  function renderFileTree(files, dir) {
    PreviewFileExplorer.renderFileTree(
      files, dir, fileTree, () => filePathRef.current,
      loadFileTree, switchToFile, showContextMenu, renameFile,
      moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone
    );
  }
  
  function showParentFolderDropZone(currentDir) {
    PreviewFileExplorer.showParentFolderDropZone(currentDir, fileTree, moveFileToFolder);
  }
  
  function hideParentFolderDropZone() {
    PreviewFileExplorer.hideParentFolderDropZone(fileTree);
  }
  
  function moveFileToFolder(filePath, targetFolderPath) {
    PreviewFileExplorer.moveFileToFolder(filePath, targetFolderPath, loadFileTree, switchToFile, status, isDirty);
  }
  
  function setupWebSocket() {
    const wsRef = { ws: null };
    wsRef.ws = PreviewWebSocket.setupWebSocket(
      wsRef, syncChannel, receivedLogIds, generateLogId, addPreviewLog,
      showServerUpdateNotification,
      (data) => handleFileSystemEvent(data),
      previewSettings, () => filePathRef.current, previewFrame, loadFileTree,
      () => previewPinned.current,
      () => PreviewServer.restartServer(editor, filePathRef.current, isDirty, saveFile, ws.current)
    );
    ws.current = wsRef.ws;
  }
  
  function handleFileSystemEvent(data) {
    PreviewWebSocket.handleFileSystemEvent(data, () => currentDirRef.currentDir, loadFileTree);
  }
  
  function setupDragAndDrop() {
    PreviewFileExplorer.setupDragAndDrop(fileTree, () => currentDirRef.currentDir, handleFileDrop);
  }
  
  function handleFileDrop(files, targetDir) {
    PreviewFileExplorer.handleFileDrop(files, targetDir, uploadFile);
  }
  
  function uploadFile(file, targetDir) {
    PreviewFileExplorer.uploadFile(file, targetDir, status, isDirty, loadFileTree, () => currentDirRef.currentDir);
  }
  
  function setupContextMenu() {
    PreviewFileExplorer.setupContextMenu(
      contextMenu, fileTree, createNewFile, createNewFolder, renameFile, deleteFile,
      (e, path, isDirectory, name, onlyCreate) => showContextMenu(e, path, isDirectory, name, onlyCreate)
    );
  }
  
  function showContextMenu(e, path, isDirectory, name, onlyCreate = false) {
    PreviewFileExplorer.showContextMenu(e, path, isDirectory, name, contextMenu, onlyCreate);
  }
  
  async function createNewFile() {
    await PreviewFileExplorer.createNewFile(customPrompt, () => currentDirRef.currentDir, loadFileTree, switchToFile);
  }
  
  async function createNewFolder() {
    await PreviewFileExplorer.createNewFolder(customPrompt, () => currentDirRef.currentDir, loadFileTree);
  }
  
  function updateEditorPath(newPath, oldPath) {
    // Update editor path without reloading content
    filePathRef.current = newPath;
    fileName.textContent = newPath.split('/').pop();
    
    // Update the editor cache path if there's unsaved content
    const editor = window.__previewEditor;
    if (editor && isDirty.current) {
      const currentContent = editor.getValue();
      // Save current content to new path in cache
      fetch('/__api__/files/editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath, content: currentContent })
      }).catch(err => console.error('Error updating editor cache:', err));
      
      // Delete old cache if it exists
      if (oldPath && oldPath !== newPath) {
        fetch('/__api__/files/editor', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: oldPath })
        }).catch(err => console.error('Error deleting old cache:', err));
      }
    }
  }
  
  function updatePreviewPath(newPath) {
    // Update preview if it's showing the renamed file
    const isPreviewPoppedOut = PreviewPopouts.isPreviewPoppedOut();
    if (isPreviewPoppedOut) {
      PreviewPopouts.updatePreviewPopout(newPath, () => previewSettings);
    }
    
    // Update preview frame if showing current file
    if (previewFrame) {
      let previewUrl = '/__preview-content__?file=' + encodeURIComponent(newPath) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
      if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
        previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
      }
      previewUrl += '&t=' + Date.now();
      previewFrame.src = previewUrl;
    }
  }
  
  function updateUIForRename(newPath) {
    // Update URL without reloading
    const newUrl = '/__preview__?file=' + encodeURIComponent(newPath);
    window.history.replaceState({ file: newPath }, '', newUrl);
    
    // Update active file tree item (don't reload file tree here - let WebSocket handle it)
    const newDir = newPath.split('/').slice(0, -1).join('/') || '';
    if (newDir === currentDirRef.currentDir) {
      // Only update the active item if we're in the same directory
      // The file tree will be refreshed by WebSocket events
      updateActiveFileTreeItem(newPath);
    }
    
    // Update tab manager active tab
    PreviewTabManager.updateActiveTab(newPath);
    
    // Update sync channel
    syncChannel.postMessage({
      type: 'file-changed',
      filePath: newPath
    });
    
    // Save state
    saveState();
  }
  
  async function renameFile(path, oldName, isDirectory) {
    await PreviewFileExplorer.renameFile(
      path, oldName, isDirectory, customPrompt, 
      () => currentDirRef.currentDir, loadFileTree, 
      () => filePathRef.current, switchToFile,
      (oldPath, newPath) => PreviewTabManager.renameTab(oldPath, newPath),
      updateEditorPath,
      updatePreviewPath,
      updateUIForRename
    );
  }
  
  async function deleteFile(path, isDirectory) {
    await PreviewFileExplorer.deleteFile(path, isDirectory, customConfirm, () => currentDirRef.currentDir, loadFileTree, () => filePathRef.current, (filePath) => {
      // Close the tab if the file is open
      if (PreviewTabManager.getOpenTabs().includes(filePath)) {
        PreviewTabManager.closeTab(filePath);
      }
    });
  }
  
  function setupFileExplorer() {
    PreviewFileExplorer.setupFileExplorer(() => currentDirRef.currentDir, loadFileTree);
  }
  
  function addPreviewLog(message, type = 'log') {
    PreviewTerminal.addPreviewLog(message, type, receivedLogIds, generateLogId, syncChannel, ws.current);
  }
  
  function setupPreviewLogInterception() {
    PreviewTerminal.setupPreviewLogInterception(receivedLogIds, generateLogId, addPreviewLog, syncChannel, ws.current);
  }
  
  function handleTerminalCommand(tab, command) {
    PreviewTerminal.handleTerminalCommand(tab, command, syncChannel, previewFrame);
  }
  
  function setupTerminal() {
    PreviewTerminal.setupTerminal(saveState, syncChannel, previewFrame, addPreviewLog, setupPreviewLogInterception, ws);
  }
  
  function openEditorPopout() {
    PreviewPopouts.openEditorPopout(() => filePathRef.current, () => previewSettings);
  }
  
  function openPreviewPopout() {
    PreviewPopouts.openPreviewPopout(() => filePathRef.current, previewPanel, updatePreviewVisibility, () => previewSettings);
  }
  
  function openTerminalPopout() {
    const terminalPanelEl = document.getElementById('terminalPanel');
    PreviewPopouts.openTerminalPopout(terminalPanelEl, updateTerminalVisibility, () => previewSettings);
  }
  
  function setupWebSocket() {
    const wsRef = { ws: null };
    wsRef.ws = PreviewWebSocket.setupWebSocket(
      wsRef, syncChannel, receivedLogIds, generateLogId, addPreviewLog,
      showServerUpdateNotification,
      (data) => handleFileSystemEvent(data),
      previewSettings, () => filePathRef.current, previewFrame, loadFileTree,
      () => previewPinned.current,
      () => PreviewServer.restartServer(editor, filePathRef.current, isDirty, saveFile, ws.current)
    );
    ws.current = wsRef.ws;
  }
  
  function handleFileSystemEvent(data) {
    PreviewWebSocket.handleFileSystemEvent(data, () => currentDirRef.currentDir, loadFileTree);
  }
  
  function showServerUpdateNotification() {
    PreviewServer.showServerUpdateNotification(() => {
      PreviewServer.restartServer(editor, filePathRef.current, isDirty, saveFile, ws.current);
    });
  }
  
  function goBackFolder() {
    const newDir = PreviewUI.goBackFolder(currentDirRef.currentDir, loadFileTree, updateBackButton);
    if (newDir !== currentDirRef.currentDir) {
      currentDirRef.currentDir = newDir;
      currentDir = newDir;
    }
  }
  
  function updateBackButton() {
    PreviewUI.updateBackButton(backBtn, currentDirRef.currentDir);
  }
  
  function toggleFileExplorer() {
    PreviewUI.toggleFileExplorer(fileExplorerPanel, toggleExplorer, updateExplorerVisibility, updateBackButton, saveState);
  }
  
  function updateExplorerVisibility() {
    PreviewUI.updateExplorerVisibility(fileExplorerPanel);
  }
  
  function refreshPreview() {
    PreviewManager.refreshPreview(
      previewFrame, () => filePathRef.current, previewSettings,
      () => interceptPreviewLinks()
    );
  }
  
  function togglePreviewPanel() {
    PreviewUI.togglePreviewPanel(previewPanel, togglePreview, updatePreviewVisibility, saveState, refreshPreview);
  }
  
  function updatePreviewVisibility() {
    PreviewUI.updatePreviewVisibility(previewPanel, editorPanel, resizerEditor);
  }
  
  function updateTerminalVisibility() {
    PreviewTerminalUI.updateTerminalVisibility(terminalPanel, toggleTerminal, resizerTerminal, terminalReopenBar);
  }
  
  function updateTerminalPositionButtons() {
    PreviewTerminalUI.updateTerminalPositionButtons(moveTerminalToBottom, moveTerminalToExplorer, terminalAtBottomRef.current);
  }
  
  function moveTerminalToBottomPosition() {
    PreviewTerminalUI.moveTerminalToBottomPosition(
      terminalPanel, container, fileExplorerPanel, terminalAtBottomRef,
      updateTerminalPositionButtons, saveState
    );
  }
  
  function moveTerminalToExplorerPosition() {
    PreviewTerminalUI.moveTerminalToExplorerPosition(
      terminalPanel, container, fileExplorerPanel, terminalReopenBar, terminalAtBottomRef,
      updateTerminalPositionButtons, saveState
    );
  }
  
  function updateActiveFileTreeItem(path) {
    PreviewEditorManager.updateActiveFileTreeItem(path, fileTree);
  }
  
  async function switchToFile(newPath) {
    await PreviewTabManager.openTab(newPath);
  }

  async function switchToFileInternal(newPath, skipCache = false) {
    if (skipCache) {
      const openTabs = PreviewTabManager.getOpenTabs();
      if (openTabs.includes(newPath)) {
        fileName.textContent = newPath.split('/').pop();
        const newDir = newPath.split('/').slice(0, -1).join('/') || '';
        if (newDir !== currentDirRef.currentDir) {
          loadFileTree(newDir);
        } else {
          updateActiveFileTreeItem(newPath);
        }
        filePathRef.current = newPath;
        filePath = newPath;
        PreviewTabManager.updateActiveTab(newPath);
        
        syncChannel.postMessage({
          type: 'file-changed',
          filePath: newPath
        });
        
        const isPreviewPoppedOut = PreviewPopouts.isPreviewPoppedOut();
        if (isPreviewPoppedOut) {
          PreviewPopouts.enforcePreviewCollapsed(previewPanel);
          PreviewPopouts.updatePreviewPopout(newPath, () => previewSettings);
        }
        if (PreviewPopouts.getEditorPopout() && !PreviewPopouts.getEditorPopout().closed) {
          PreviewPopouts.updateEditorPopout(newPath, () => previewSettings);
        }
        
        saveState();
        return;
      }
    }
    
    const updatedPath = await PreviewEditorManager.switchToFile(
      newPath, () => filePathRef.current, isDirty, customConfirm, fileName, () => currentDirRef.currentDir,
      loadFileTree, updateActiveFileTreeItem, (path) => loadFile(path, skipCache), saveState, skipCache
    );
    if (updatedPath) {
      filePathRef.current = updatedPath;
      filePath = updatedPath;
      
      PreviewTabManager.updateActiveTab(updatedPath);
      
      const isPreviewPoppedOut = PreviewPopouts.isPreviewPoppedOut();
      
      if (isPreviewPoppedOut) {
        PreviewPopouts.enforcePreviewCollapsed(previewPanel);
      }
      
      syncChannel.postMessage({
        type: 'file-changed',
        filePath: updatedPath
      });
      
      if (isPreviewPoppedOut) {
        PreviewPopouts.updatePreviewPopout(updatedPath, () => previewSettings);
      }
      if (PreviewPopouts.getEditorPopout() && !PreviewPopouts.getEditorPopout().closed) {
        PreviewPopouts.updateEditorPopout(updatedPath, () => previewSettings);
      }
    }
  }
  
  function updateStatus() {
    PreviewEditorManager.updateStatus(isDirty.current, status);
  }
  
  async function loadFile(path, skipCache = false) {
    filePathRef.current = path;
    filePath = path;
    
    const result = await PreviewEditorManager.loadFile(
      path, status, editor, previewFrame, previewSettings, fileTree,
      getLanguage,
      skipCache ? null : ((cached, live, filePath) => customCacheDialog(cached, live, filePath)),
      showImagePreview, showHtmlPreview, interceptPreviewLinks,
      setupPreviewLogInterception, updateStatus, originalContent, isDirty, isApplyingExternalChange, skipCache,
      () => previewPinned.current
    );
    if (result) {
      if (result.originalContent !== undefined) {
        originalContent.current = result.originalContent;
        PreviewTabManager.setTabContent(path, editor.getValue(), result.originalContent);
      }
      if (result.isDirty !== undefined) {
        isDirty.current = result.isDirty;
        PreviewTabManager.updateTabDirtyState(path, result.isDirty, result.originalContent);
      }
    }
    
    const isPreviewPoppedOut = PreviewPopouts.isPreviewPoppedOut();
    
    if (isPreviewPoppedOut) {
      PreviewPopouts.enforcePreviewCollapsed(previewPanel);
      updatePreviewVisibility();
    }
  }
  
  async function customCacheDialog(cachedContent, liveContent, filePath) {
    const actualFilePath = typeof filePath === 'function' ? filePath() : filePath;
    return PreviewEditorManager.customCacheDialog(
      cachedContent, liveContent, actualFilePath, getLanguage, previewSettings,
      (content, getFilePath, previewFrame, isLive) => updateCachePreview(content, getFilePath, previewFrame, isLive)
    );
  }
  
  async function updateCachePreview(content, getFilePath, previewFrame, isLive = false) {
    await PreviewEditorManager.updateCachePreview(content, getFilePath, previewFrame, isLive, previewSettings);
  }
  
  function updatePreview(content) {
    if (previewPinned.current && previewPinnedPath.current) {
      PreviewManager.updatePreview(
        null, previewFrame, () => previewPinnedPath.current, previewSettings, syncChannel,
        () => interceptPreviewLinks(), (content) => updatePreviewFallback(content)
      );
      return;
    }
    PreviewManager.updatePreview(
      content, previewFrame, () => filePathRef.current, previewSettings, syncChannel,
      () => interceptPreviewLinks(), (content) => updatePreviewFallback(content)
    );
  }
  
  function showImagePreview(imagePath) {
    PreviewManager.showImagePreview(
      imagePath, previewFrame, imagePreview, previewImage, previewTitle, backToPreviewBtn
    );
  }
  
  function showHtmlPreview() {
    PreviewManager.showHtmlPreview(imagePreview, previewFrame, previewTitle, backToPreviewBtn);
  }
  
  function interceptPreviewLinks() {
    PreviewManager.interceptPreviewLinks(
      previewFrame, () => filePathRef.current,
      (imagePath) => showImagePreview(imagePath),
      (targetPath) => switchToFile(targetPath)
    );
  }
  
  async function updatePreviewFallback(content) {
    await PreviewManager.updatePreviewFallback(content, () => filePathRef.current, previewFrame, previewSettings);
  }
  
  function saveFile() {
    PreviewEditorManager.saveFile(
      editor, filePathRef.current, status, ws.current, originalContent, isDirty, updateStatus, saveToEditorTimeout
    ).then(result => {
      if (result) {
        if (result.originalContent !== undefined) {
          originalContent.current = result.originalContent;
        }
        if (result.isDirty !== undefined) {
          isDirty.current = result.isDirty;
        }
        const currentPath = filePathRef.current;
        if (currentPath) {
          PreviewTabManager.updateTabDirtyState(currentPath, result.isDirty || false, result.originalContent || originalContent.current);
          PreviewTabManager.setTabContent(currentPath, editor.getValue(), result.originalContent || originalContent.current);
        }
      }
    });
  }
  
  function saveState() {
    PreviewState.saveState(isRestoringStateRef.current, filePathRef.current, currentDirRef.currentDir, fileExplorerPanel, previewPanel, editorPanel, terminalAtBottomRef.current);
  }
  
  function restoreState() {
    const terminalPanel = document.getElementById('terminalPanel');
    const result = PreviewState.restoreState(
      forceLoad, filePathRef.current, currentDirRef.currentDir, previewSettings,
      fileExplorerPanel, toggleExplorer, previewPanel, togglePreview,
      editorPanel, terminalPanel, fileName, loadFileTree, loadFile,
      updateExplorerVisibility, updatePreviewVisibility, updateTerminalVisibility,
      moveTerminalToBottomPosition, moveTerminalToExplorerPosition
    );
    if (result) {
      if (result.filePath !== filePathRef.current) {
        filePathRef.current = result.filePath;
        filePath = result.filePath;
      }
      if (result.currentDir !== currentDirRef.currentDir) {
        currentDirRef.currentDir = result.currentDir;
        currentDir = result.currentDir;
      }
    }
  }
  
  function resetSettings() {
    const terminalPanel = document.getElementById('terminalPanel');
    PreviewState.resetSettings(
      fileExplorerPanel, toggleExplorer, previewPanel, togglePreview,
      editorPanel, terminalPanel, updateExplorerVisibility,
      updatePreviewVisibility, updateTerminalVisibility, status
    );
  }
  
  function setupResizers() {
    const container = document.querySelector('.preview-container');
    const resizerExplorer = document.getElementById('resizerExplorer');
    const resizerEditor = document.getElementById('resizerEditor');
    const resizerTerminal = document.getElementById('resizerTerminal');
    const terminalPanel = document.getElementById('terminalPanel');
    
    PreviewResizers.setupResizers(
      container, resizerExplorer, resizerEditor, resizerTerminal, terminalPanel,
      fileExplorerPanel, previewPanel, editorPanel, terminalAtBottomRef, saveState
    );
  }
  
  function handleWindowResize() {
    PreviewResizers.handleWindowResize(() => adjustPanelsOnResize());
  }
  
  function adjustPanelsOnResize() {
    PreviewResizers.adjustPanelsOnResize(fileExplorerPanel, previewPanel, editorPanel);
  }
  
  const toggleTerminal = document.getElementById('toggleTerminal');
  const terminalPanel = document.getElementById('terminalPanel');
  const resizerTerminal = document.getElementById('resizerTerminal');
  const terminalReopenBar = document.getElementById('terminalReopenBar');
  const reopenTerminalBtn = document.getElementById('reopenTerminalBtn');
  const moveTerminalToBottom = document.getElementById('moveTerminalToBottom');
  const moveTerminalToExplorer = document.getElementById('moveTerminalToExplorer');
  const container = document.querySelector('.preview-container');
  
  setupFileExplorer();
  
  PreviewInitialization.restoreOrLoadFile(
    forceLoad, filePath, loadFile, updateExplorerVisibility, updatePreviewVisibility,
    updateTerminalVisibility, restoreState, terminalPanel, isRestoringStateRef
  );
  
  setupContextMenu();
  setupDragAndDrop();
  setupTerminal();
  setupWebSocket();
  
  PreviewSyncChannel.setupSyncChannel(
    syncChannel, () => filePathRef.current, editor, originalContent, isDirty,
    updateStatus, previewFrame, handleTerminalCommand, editorPanel, previewPanel,
    updatePreviewVisibility, updateTerminalVisibility, () => previewPinned.current
  );
  
  const popoutEditorBtn = document.getElementById('popoutEditor');
  if (popoutEditorBtn) {
    popoutEditorBtn.disabled = true;
    popoutEditorBtn.style.opacity = '0.5';
    popoutEditorBtn.style.cursor = 'not-allowed';
    popoutEditorBtn.title = 'Editor popout disabled';
  }
  
  PreviewEvents.setupPanelToggleHandlers(toggleExplorer, togglePreview, toggleFileExplorer, togglePreviewPanel);
  
  function openFileSearch() {
    PreviewFileSearch.open((filePath) => {
      PreviewEditorManager.switchToFile(filePath, () => filePathRef.current, isDirty, customConfirm, fileName, () => currentDirRef.currentDir, loadFileTree, updateActiveFileTreeItem, loadFile, saveState, false);
    });
  }
  
  function openGlobalSearch() {
    PreviewGlobalSearch.open((filePath) => {
      PreviewEditorManager.switchToFile(filePath, () => filePathRef.current, isDirty, customConfirm, fileName, () => currentDirRef.currentDir, loadFileTree, updateActiveFileTreeItem, loadFile, saveState, false);
    }, editor);
  }
  
  function openHelpMenu() {
    PreviewHelpMenu.open();
  }
  
  function toggleTerminalPanel() {
    if (terminalPanel) {
      terminalPanel.classList.toggle('collapsed');
      updateTerminalVisibility();
      saveState();
    }
  }
  
  function closeCurrentTab() {
    PreviewTabManager.closeCurrentTab();
  }
  
  function switchToNextTab() {
    PreviewTabManager.switchToNextTab();
  }
  
  function switchToPrevTab() {
    PreviewTabManager.switchToPrevTab();
  }
  
  function createNewFile() {
    PreviewFileExplorer.createNewFile(customPrompt, () => currentDirRef.currentDir, loadFileTree, (path) => {
      PreviewEditorManager.switchToFile(path, () => filePathRef.current, isDirty, customConfirm, fileName, () => currentDirRef.currentDir, loadFileTree, updateActiveFileTreeItem, loadFile, saveState, false);
    });
  }
  
  function createNewFolder() {
    PreviewFileExplorer.createNewFolder(customPrompt, () => currentDirRef.currentDir, loadFileTree);
  }
  
  function openGitPanel() {
    PreviewGitPanel.toggle();
  }
  
  function openSettings() {
    PreviewSettings.openSettings();
  }
  
  PreviewEvents.setupKeyboardShortcuts(
    toggleFileExplorer, 
    togglePreviewPanel, 
    openFileSearch, 
    openGlobalSearch, 
    openHelpMenu,
    toggleTerminalPanel,
    closeCurrentTab,
    switchToNextTab,
    switchToPrevTab,
    createNewFile,
    createNewFolder,
    openGitPanel,
    openSettings
  );
  
  function toggleFileExplorer() {
    PreviewUI.toggleFileExplorer(fileExplorerPanel, toggleExplorer, updateExplorerVisibility, updateBackButton, saveState);
  }
  
  function updateExplorerVisibility() {
    PreviewUI.updateExplorerVisibility(fileExplorerPanel);
  }
  
  function togglePreviewPanel() {
    PreviewUI.togglePreviewPanel(previewPanel, togglePreview, updatePreviewVisibility, saveState, refreshPreview);
  }
  
  function updatePreviewVisibility() {
    PreviewUI.updatePreviewVisibility(previewPanel, editorPanel, resizerEditor);
  }
  
  if (resizerEditor && previewPanel) {
    if (previewPanel.classList.contains('collapsed')) {
      resizerEditor.style.display = 'none';
    }
  }
  
  function updateTerminalVisibility() {
    PreviewTerminalUI.updateTerminalVisibility(terminalPanel, toggleTerminal, resizerTerminal, terminalReopenBar);
  }
  
  function updateTerminalPositionButtons() {
    PreviewTerminalUI.updateTerminalPositionButtons(moveTerminalToBottom, moveTerminalToExplorer, terminalAtBottomRef.current);
  }
  
  function moveTerminalToBottomPosition() {
    PreviewTerminalUI.moveTerminalToBottomPosition(
      terminalPanel, container, fileExplorerPanel, terminalAtBottomRef,
      updateTerminalPositionButtons, saveState
    );
  }
  
  function moveTerminalToExplorerPosition() {
    PreviewTerminalUI.moveTerminalToExplorerPosition(
      terminalPanel, container, fileExplorerPanel, terminalReopenBar, terminalAtBottomRef,
      updateTerminalPositionButtons, saveState
    );
  }
  
  PreviewTerminalUI.setupTerminalEventHandlers(
    toggleTerminal, terminalPanel, updateTerminalVisibility, saveState,
    moveTerminalToBottom, moveTerminalToExplorer, moveTerminalToBottomPosition,
    moveTerminalToExplorerPosition, reopenTerminalBtn
  );
  
  updateTerminalPositionButtons();
  
  const reopenExplorerBtn = document.getElementById('reopenExplorerBtn');
  const reopenPreviewBtn = document.getElementById('reopenPreviewBtn');
  
  PreviewEvents.setupReopenHandlers(
    reopenExplorerBtn, fileExplorerPanel, updateExplorerVisibility, saveState,
    reopenPreviewBtn, previewPanel, updatePreviewVisibility, togglePreview, refreshPreview
  );
  
  PreviewEvents.setupBackButton(backBtn, goBackFolder);
  
  updateBackButton();
  
  editor = PreviewEditorSetup.createEditor(editorContainer, language, previewSettings);
  PreviewSettings.applyPreviewSettings(editor);
  
  PreviewTabManager.initialize(
    editorTabsContainer,
    switchToFileInternal,
    () => filePathRef.current,
    () => isDirty.current,
    customConfirm,
    updateActiveFileTreeItem,
    loadFileTree,
    () => currentDirRef.currentDir,
    () => editor ? editor.getValue() : '',
    (content, originalContent, filePath) => {
      if (editor) {
        isApplyingExternalChange.current = true;
        if (filePath) {
          filePathRef.current = filePath;
          filePath = filePath;
          fileName.textContent = filePath.split('/').pop();
          const newDir = filePath.split('/').slice(0, -1).join('/') || '';
          if (newDir !== currentDirRef.currentDir) {
            loadFileTree(newDir);
          } else {
            updateActiveFileTreeItem(filePath);
          }
        } else {
          // Clear file path and name when no file is open
          filePathRef.current = '';
          fileName.textContent = '';
        }
        editor.setValue(content);
        if (originalContent !== undefined) {
          originalContent.current = originalContent;
        }
        isDirty.current = content !== originalContent;
        updateStatus();
        updatePreview(content);
        isApplyingExternalChange.current = false;
      }
    }
  );
  
  window.__previewEditor = editor;
  window.__previewFilePath = () => filePathRef.current;
  window.__previewUpdatePreview = updatePreview;
  window.__previewSaveFile = saveFile;
  window.__previewSyncChannel = syncChannel;
  window.__previewIsDirty = isDirty;
  window.__previewCustomConfirm = customConfirm;
  
  const isApplyingExternalChange = { current: false };
  window.__previewIsApplyingExternalChange = isApplyingExternalChange;
  
  function openSymbolNavigator() {
    PreviewSymbolNavigator.open(editor);
  }

  PreviewEditorSetup.setupEditorNavigation(editor, openSymbolNavigator);
  
  PreviewEditorSetup.setupEditorListeners(
    editor, () => filePathRef.current, syncChannel, originalContent, isDirty,
    updateStatus, updatePreview, saveToEditorTimeout, isApplyingExternalChange,
    () => {
      const currentPath = filePathRef.current;
      if (currentPath) {
        PreviewTabManager.updateTabDirtyState(currentPath, isDirty.current, originalContent.current);
      }
    }
  );
  
  PreviewEvents.setupPopstate(
    filePathRef, fileName, currentDirRef, loadFileTree, updateActiveFileTreeItem, loadFile, saveState
  );
  
  if (filePath) {
    PreviewTabManager.openTabWithoutConfirm(filePath);
  }
  
  loadFile(filePath);
  
  const helpBtn = document.getElementById('helpBtn');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      PreviewHelpMenu.open();
    });
  }
  
  PreviewEvents.setupButtonHandlers(
    saveBtn, refreshBtn, closeBtn, backToFilesBtn, updatePreview, filePath, customConfirm,
    isDirty, openPreviewPopout, openTerminalPopout, togglePreviewPanel
  );
  
  if (pinPreviewBtn) {
    pinPreviewBtn.addEventListener('click', () => {
      previewPinned.current = !previewPinned.current;
      if (previewPinned.current) {
        previewPinnedPath.current = filePathRef.current;
        pinPreviewBtn.style.opacity = '1';
        pinPreviewBtn.style.color = 'var(--border-active)';
        pinPreviewBtn.title = 'Unpin Preview';
      } else {
        previewPinnedPath.current = null;
        pinPreviewBtn.style.opacity = '0.7';
        pinPreviewBtn.style.color = '';
        pinPreviewBtn.title = 'Pin Preview to Current Page';
        updatePreview(editor ? editor.getValue() : '');
      }
    });
  }

  const gitPanelBtn = document.getElementById('gitPanelBtn');
  if (gitPanelBtn) {
    gitPanelBtn.addEventListener('click', () => {
      PreviewGitPanel.toggle();
    });
  }
  
  PreviewSettingsUI.setupSettingsEventHandlers(
    settingsBtn, settingsPanel, settingsCloseBtn, saveSettingsBtn, resetSettingsBtn2,
    resetSettingsBtn, status, editor, customConfirm, resetSettings
  );
  
  PreviewEvents.setupBeforeUnload(isDirty, ws, saveState);
  
  if (previewPanel) {
    PreviewPopouts.setupPreviewPanelObserver(previewPanel);
  }
  
  // Setup resizers
  setupResizers();
  
  function handleWindowResize() {
    PreviewResizers.handleWindowResize(() => adjustPanelsOnResize());
  }
  
  function adjustPanelsOnResize() {
    PreviewResizers.adjustPanelsOnResize(fileExplorerPanel, previewPanel, editorPanel);
  }
  
  window.addEventListener('resize', handleWindowResize);
  
  setInterval(() => {
    adjustPanelsOnResize();
  }, 5000);
  
  async function updateCachePreview(content, getFilePath, previewFrame, isLive = false) {
    await PreviewEditorManager.updateCachePreview(content, getFilePath, previewFrame, isLive, previewSettings);
  }
  
  function updatePreview(content) {
    if (previewPinned.current && previewPinnedPath.current) {
      const pinnedPath = previewPinnedPath.current;
      let previewUrl = '/__preview-content__?file=' + encodeURIComponent(pinnedPath) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
      if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
        previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
      }
      previewUrl += '&t=' + Date.now();
      previewFrame.src = previewUrl;
      previewFrame.onload = () => {
        interceptPreviewLinks();
      };
      return;
    }
    PreviewManager.updatePreview(
      content, previewFrame, () => filePathRef.current, previewSettings, syncChannel,
      () => interceptPreviewLinks(), (content) => updatePreviewFallback(content)
    );
  }
  
  function showImagePreview(imagePath) {
    PreviewManager.showImagePreview(
      imagePath, previewFrame, imagePreview, previewImage, previewTitle, backToPreviewBtn
    );
  }
  
  function showHtmlPreview() {
    PreviewManager.showHtmlPreview(imagePreview, previewFrame, previewTitle, backToPreviewBtn);
  }
  
  if (backToPreviewBtn) {
    backToPreviewBtn.addEventListener('click', () => {
      showHtmlPreview();
    });
  }
  
  function interceptPreviewLinks() {
    PreviewManager.interceptPreviewLinks(
      previewFrame, () => filePathRef.current,
      (imagePath) => showImagePreview(imagePath),
      (targetPath) => switchToFile(targetPath)
    );
  }
  
  async function updatePreviewFallback(content) {
    await PreviewManager.updatePreviewFallback(content, () => filePathRef.current, previewFrame, previewSettings);
  }
  
  function saveFile() {
    PreviewEditorManager.saveFile(
      editor, filePathRef.current, status, ws.current, originalContent, isDirty, updateStatus, saveToEditorTimeout
    ).then(result => {
      if (result) {
        if (result.originalContent !== undefined) {
          originalContent.current = result.originalContent;
        }
        if (result.isDirty !== undefined) {
          isDirty.current = result.isDirty;
        }
        const currentPath = filePathRef.current;
        if (currentPath) {
          PreviewTabManager.updateTabDirtyState(currentPath, result.isDirty || false, result.originalContent || originalContent.current);
          PreviewTabManager.setTabContent(currentPath, editor.getValue(), result.originalContent || originalContent.current);
        }
      }
    });
  }
  
  setTimeout(() => {
    PreviewServer.restoreTempEditorState(filePathRef.current, editor, updateStatus);
  }, 1000);
});
