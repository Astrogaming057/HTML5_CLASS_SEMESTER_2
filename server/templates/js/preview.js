const urlParams = new URLSearchParams(window.location.search);
let filePath = urlParams.get('file');
const forceLoad = urlParams.get('force') === 'true' || urlParams.get('noRestore') === 'true';
let currentDir = '';

// Detect if running in Electron (app mode) or browser
let clientMode = 'browser';
if (window.electronAPI && window.electronAPI.isElectron) {
  clientMode = 'app';
}
// Store mode globally
window.__CLIENT_MODE = clientMode;

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
  const refreshBtn = document.getElementById('refreshBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsCloseBtn = document.getElementById('settingsCloseBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const resetSettingsBtn2 = document.getElementById('resetSettingsBtn2');
  const status = document.getElementById('status');

  function goToFileDiscovery() {
    const filePathGetter = window.__previewFilePath;
    const fp = typeof filePathGetter === 'function' ? filePathGetter() : filePathGetter;
    if (fp && typeof fp === 'string') {
      const dirPath = fp.split('/').slice(0, -1).join('/') || '';
      const targetPath = dirPath ? '/' + dirPath + '/' : '/';
      try {
        window.location.href = new URL(targetPath, window.location.origin).href;
      } catch (e) {
        window.location.href = targetPath;
      }
    } else {
      window.location.href = '/';
    }
  }

  /** Same as Mode menu → Change Working Directory (Electron); browser falls back to file discovery URL. */
  function changeWorkingDirectory() {
    if (window.electronAPI && typeof window.electronAPI.selectWorkingDirectory === 'function') {
      window.electronAPI.selectWorkingDirectory().then(function (result) {
        if (result && result.success) {
          if (status) {
            status.textContent = 'Working directory changed. Restart required.';
            status.className = 'status';
          }
          setTimeout(function () {
            if (confirm('Working directory changed. Restart now?')) {
              if (window.electronAPI && typeof window.electronAPI.restartApp === 'function') {
                window.electronAPI.restartApp();
              }
            }
          }, 100);
        }
      });
    } else {
      goToFileDiscovery();
    }
  }

  if (window.PreviewElectronTitleBar && typeof window.PreviewElectronTitleBar.init === 'function') {
    window.PreviewElectronTitleBar.init();
  }
  const fileName = document.getElementById('fileName');
  const modeIndicator = document.getElementById('modeIndicator');
  previewFrame = document.getElementById('previewFrame');
  if (window.PreviewRemoteExplorer && typeof window.PreviewRemoteExplorer.init === 'function') {
    window.PreviewRemoteExplorer.init();
  }
  if (window.PreviewRemoteExplorer && previewFrame && typeof window.PreviewRemoteExplorer.attachPreviewFrame === 'function') {
    window.PreviewRemoteExplorer.attachPreviewFrame(previewFrame);
  }
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
  /** When true, preview panel was collapsed for hex / binary; restoreOpen = user had it expanded. */
  const previewForcedHiddenRef = { active: false, restoreOpen: false };
  /** True while openHexEditorForPath is switching file + opening hex (skip auto-restore in loadFile). */
  let openHexEditorPending = false;

  const filePathRef = { current: filePath };
  const currentDirRef = { currentDir: '' };
  const isRestoringStateRef = { current: true };
  const terminalAtBottomRef = { current: false };
  const saveToEditorTimeout = { current: null };
  
  // Mode indicator hover menu
  let modeMenu = null;
  let modeMenuTimeout = null;
  
  function createModeMenu() {
    if (modeMenu) return modeMenu;
    
    modeMenu = document.createElement('div');
    modeMenu.className = 'mode-menu';
    modeMenu.id = 'modeMenu';
    document.body.appendChild(modeMenu);
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeModeMenu(e) {
      if (modeMenu && !modeMenu.contains(e.target) && modeIndicator && !modeIndicator.contains(e.target)) {
        hideModeMenu();
      }
    });

    modeMenu.addEventListener('mouseenter', function () {
      if (modeMenuTimeout) clearTimeout(modeMenuTimeout);
    });
    modeMenu.addEventListener('mouseleave', function () {
      hideModeMenu();
    });

    return modeMenu;
  }
  
  function getGPUInfo() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        return {
          vendor: 'Unknown',
          renderer: 'WebGL not available',
          hardwareAcceleration: false
        };
      }
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown';
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown';
      
      // Check if hardware acceleration is enabled
      const hardwareAcceleration = gl.getParameter(gl.VERSION).includes('WebGL') && 
                                    renderer !== 'Unknown' && 
                                    !renderer.toLowerCase().includes('software');
      
      return {
        vendor: vendor || 'Unknown',
        renderer: renderer || 'Unknown',
        hardwareAcceleration: hardwareAcceleration
      };
    } catch (e) {
      return {
        vendor: 'Unknown',
        renderer: 'Error detecting GPU',
        hardwareAcceleration: false
      };
    }
  }
  
  async function getHardwareAccelerationStatus() {
    if (window.electronAPI && window.electronAPI.getHardwareAcceleration) {
      try {
        return await window.electronAPI.getHardwareAcceleration();
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function buildModeMenuContent(clientMode, serverMode) {
    if (!modeMenu) createModeMenu();
    
    const clientModeText = clientMode === 'app' ? 'App (Electron)' : 'Browser';
    const serverModeText = serverMode === 'app' ? 'App' : 'Browser';
    const isApp = clientMode === 'app';
    const isServerApp = serverMode === 'app';
    
    // Get GPU information
    const gpuInfo = getGPUInfo();

    let connectionLabel =
      typeof window !== 'undefined' && window.location && window.location.host
        ? window.location.host
        : 'localhost';
    const remoteSess = window.PreviewRemoteSession;
    if (
      remoteSess &&
      typeof remoteSess.isRemoteActive === 'function' &&
      remoteSess.isRemoteActive()
    ) {
      const lbl = remoteSess.getTargetDeviceLabel && remoteSess.getTargetDeviceLabel();
      const tid = remoteSess.getTargetDeviceId && remoteSess.getTargetDeviceId();
      if (lbl) connectionLabel = lbl;
      else if (tid)
        connectionLabel =
          'Device ' + String(tid).slice(0, 10) + (String(tid).length > 10 ? '…' : '');
      else connectionLabel = 'Remote device';
    }
    const connectionLabelHtml = String(connectionLabel)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    modeMenu.innerHTML = `
      <div class="mode-menu-header">
        <div class="mode-menu-title">Mode Information</div>
        <div class="mode-menu-subtitle">Client: ${clientModeText} | Server: ${serverModeText}</div>
      </div>
      
      <div class="mode-menu-section">
        <div class="mode-menu-section-title">Status</div>
        <div class="mode-menu-status">
          <div class="mode-menu-status-dot"></div>
          <span>Running in ${clientModeText} mode</span>
        </div>
        <div class="mode-menu-item local-hosted" style="margin-top: 8px;">
          <span class="mode-menu-item-icon" style="color: #4caf50;">🔒</span>
          <div class="mode-menu-item-content">
            <div class="mode-menu-item-label">[Locally hosted]</div>
            <div class="mode-menu-item-desc">All data stays on your machine</div>
          </div>
        </div>
        <div class="mode-menu-item end-to-end-encrypted" style="margin-top: 6px;">
          <span class="mode-menu-item-icon" style="color: #4caf50;">🔐</span>
          <div class="mode-menu-item-content">
            <div class="mode-menu-item-label">End-to-end encrypted</div>
            <div class="mode-menu-item-desc">Your files are secure and private</div>
          </div>
        </div>
      </div>
      
      <div class="mode-menu-divider"></div>
      
      <div class="mode-menu-section">
        <div class="mode-menu-section-title">Quick Actions</div>
        ${isApp ? `
          <div class="mode-menu-item" data-action="restart-app">
            <span class="mode-menu-item-icon">🔄</span>
            <div class="mode-menu-item-content">
              <div class="mode-menu-item-label">Restart App</div>
              <div class="mode-menu-item-desc">Restart the Electron application</div>
            </div>
          </div>
          <div class="mode-menu-item" data-action="hardware-accel">
            <span class="mode-menu-item-icon">⚡</span>
            <div class="mode-menu-item-content">
              <div class="mode-menu-item-label">Hardware Acceleration</div>
              <div class="mode-menu-item-desc">Toggle GPU acceleration</div>
            </div>
          </div>
          <div class="mode-menu-item" data-action="working-dir">
            <span class="mode-menu-item-icon">📁</span>
            <div class="mode-menu-item-content">
              <div class="mode-menu-item-label">Change Working Directory</div>
              <div class="mode-menu-item-desc">Select a different project folder</div>
            </div>
          </div>
        ` : `
          <div class="mode-menu-item" data-action="open-in-app">
            <span class="mode-menu-item-icon">📱</span>
            <div class="mode-menu-item-content">
              <div class="mode-menu-item-label">Open in App</div>
              <div class="mode-menu-item-desc">Launch in Electron application</div>
            </div>
          </div>
          <div class="mode-menu-item" data-action="bookmark">
            <span class="mode-menu-item-icon">⭐</span>
            <div class="mode-menu-item-content">
              <div class="mode-menu-item-label">Bookmark Page</div>
              <div class="mode-menu-item-desc">Save this page to bookmarks</div>
            </div>
          </div>
        `}
        <div class="mode-menu-item" data-action="settings">
          <span class="mode-menu-item-icon">⚙️</span>
          <div class="mode-menu-item-content">
            <div class="mode-menu-item-label">Settings</div>
            <div class="mode-menu-item-desc">Open settings panel</div>
          </div>
        </div>
        <div class="mode-menu-item" data-action="help">
          <span class="mode-menu-item-icon">❓</span>
          <div class="mode-menu-item-content">
            <div class="mode-menu-item-label">Help & Documentation</div>
            <div class="mode-menu-item-desc">View help menu</div>
          </div>
        </div>
      </div>
      
      <div class="mode-menu-divider"></div>
      
      <div class="mode-menu-section">
        <div class="mode-menu-section-title">Connection</div>
        <div class="mode-menu-connection-info">
          <canvas id="pingGraph" width="240" height="80" class="ping-graph-canvas"></canvas>
          <div class="mode-menu-connection-stats">
            <div class="mode-menu-connection-server">
              <strong id="connectionEndpoint">${connectionLabelHtml}</strong>
            </div>
            <div class="mode-menu-connection-detail-item">
              <span class="mode-menu-connection-label">Average ping:</span>
              <span class="mode-menu-connection-value" id="avgPing">-</span>
            </div>
            <div class="mode-menu-connection-detail-item">
              <span class="mode-menu-connection-label">Last ping:</span>
              <span class="mode-menu-connection-value" id="lastPing">-</span>
            </div>
            <div class="mode-menu-connection-detail-item">
              <span class="mode-menu-connection-label">Outbound packet loss rate:</span>
              <span class="mode-menu-connection-value" id="packetLoss">0.0%</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="mode-menu-divider"></div>
      
      <div class="mode-menu-section">
        <div class="mode-menu-section-title">GPU</div>
        <div class="mode-menu-gpu-info">
          <div class="mode-menu-gpu-renderer">
            <strong>${gpuInfo.renderer}</strong>
          </div>
          <div class="mode-menu-gpu-details">
            <div class="mode-menu-gpu-detail-item">
              <span class="mode-menu-gpu-label">Vendor:</span>
              <span class="mode-menu-gpu-value">${gpuInfo.vendor}</span>
            </div>
            <div class="mode-menu-gpu-detail-item">
              <span class="mode-menu-gpu-label">Hardware acceleration:</span>
              <span class="mode-menu-gpu-value ${gpuInfo.hardwareAcceleration ? 'gpu-enabled' : 'gpu-disabled'}">
                ${gpuInfo.hardwareAcceleration ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            ${isApp ? `
              <div class="mode-menu-gpu-detail-item" id="gpuAccelStatus">
                <span class="mode-menu-gpu-label">App setting:</span>
                <span class="mode-menu-gpu-value" id="gpuAccelValue">Loading...</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <div class="mode-menu-divider"></div>
      
      <div class="mode-menu-section">
        <div class="mode-menu-section-title">Information</div>
        <div class="mode-menu-item">
          <span class="mode-menu-item-icon">💻</span>
          <div class="mode-menu-item-content">
            <div class="mode-menu-item-label">Platform</div>
            <div class="mode-menu-item-desc">${navigator.platform}</div>
          </div>
        </div>
        <div class="mode-menu-item">
          <span class="mode-menu-item-icon">🌐</span>
          <div class="mode-menu-item-content">
            <div class="mode-menu-item-label">User Agent</div>
            <div class="mode-menu-item-desc">${navigator.userAgent.substring(0, 40)}...</div>
          </div>
        </div>
        ${isApp ? `
          <div class="mode-menu-item">
            <span class="mode-menu-item-icon">📦</span>
            <div class="mode-menu-item-content">
              <div class="mode-menu-item-label">App Version</div>
              <div class="mode-menu-item-desc">Astro Code 1.0.0</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    // Add event listeners to menu items
    modeMenu.querySelectorAll('[data-action]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        handleModeMenuAction(item.dataset.action);
        hideModeMenu();
      });
    });
  }
  
  function handleModeMenuAction(action) {
    switch(action) {
      case 'restart-app':
        if (window.electronAPI && window.electronAPI.restartApp) {
          window.electronAPI.restartApp();
        }
        break;
      case 'hardware-accel':
        if (window.electronAPI && window.electronAPI.getHardwareAcceleration) {
          window.electronAPI.getHardwareAcceleration().then(enabled => {
            if (window.electronAPI.setHardwareAcceleration) {
              window.electronAPI.setHardwareAcceleration(!enabled).then(() => {
                status.textContent = `Hardware acceleration ${!enabled ? 'enabled' : 'disabled'}. Restart required.`;
                status.className = 'status';
                setTimeout(() => {
                  if (confirm('Hardware acceleration setting changed. Restart now?')) {
                    window.electronAPI.restartApp();
                  }
                }, 100);
              });
            }
          });
        }
        break;
      case 'working-dir':
        changeWorkingDirectory();
        break;
      case 'open-in-app':
        // Try to open in app mode
        const currentUrl = window.location.href;
        if (currentUrl.includes('localhost')) {
          // Extract the file path and open in app
          const urlParams = new URLSearchParams(window.location.search);
          const file = urlParams.get('file');
          if (file) {
            window.open(`${window.location.origin}/__preview__?file=${encodeURIComponent(file)}`, '_blank');
          }
        }
        break;
      case 'bookmark':
        if (window.PreviewBookmarkManager) {
          const urlInput = document.getElementById('browserUrlInput');
          if (urlInput && urlInput.value) {
            window.PreviewBookmarkManager.showAddDialog(urlInput.value);
          }
        }
        break;
      case 'settings':
        const settingsBtnEl = document.getElementById('settingsBtn');
        if (settingsBtnEl) settingsBtnEl.click();
        break;
      case 'help':
        if (window.PreviewHelpMenu && typeof window.PreviewHelpMenu.open === 'function') {
          PreviewHelpMenu.open();
        }
        break;
    }
  }
  
  function updatePingGraph() {
    if (window.PreviewPingMonitor && typeof PreviewPingMonitor.updateGraph === 'function') {
      PreviewPingMonitor.updateGraph();
    }
  }
  
  function showModeMenu() {
    if (!modeMenu) createModeMenu();
    const clientMode = window.__CLIENT_MODE || (window.electronAPI && window.electronAPI.isElectron ? 'app' : 'browser');
    
    // Start ping monitoring if not already started
    if (window.PreviewPingMonitor) {
      window.PreviewPingMonitor.start();
    }
    
    // Fetch server mode
    fetch('/__api__/mode')
      .then(res => res.json())
      .then(data => {
        buildModeMenuContent(clientMode, data.mode || 'browser');
        modeMenu.classList.add('show');
        requestAnimationFrame(function () {
          positionModeMenu();
        });
        
        // Draw initial ping graph
        setTimeout(() => {
          if (window.PreviewPingMonitor) {
            window.PreviewPingMonitor.updateGraph();
            // Update graph every second while menu is open
            const graphUpdateInterval = setInterval(() => {
              if (!modeMenu || !modeMenu.classList.contains('show')) {
                clearInterval(graphUpdateInterval);
                return;
              }
              if (window.PreviewPingMonitor) {
                window.PreviewPingMonitor.updateGraph();
              }
            }, 1000);
          }
        }, 100);
        
        // Load hardware acceleration status if in app mode
        if (clientMode === 'app' && window.electronAPI && window.electronAPI.getHardwareAcceleration) {
          window.electronAPI.getHardwareAcceleration().then(enabled => {
            const gpuAccelValue = document.getElementById('gpuAccelValue');
            if (gpuAccelValue) {
              gpuAccelValue.textContent = enabled ? 'Enabled' : 'Disabled';
              gpuAccelValue.className = `mode-menu-gpu-value ${enabled ? 'gpu-enabled' : 'gpu-disabled'}`;
            }
          }).catch(() => {
            const gpuAccelValue = document.getElementById('gpuAccelValue');
            if (gpuAccelValue) {
              gpuAccelValue.textContent = 'Unknown';
            }
          });
        }
      })
      .catch(err => {
        buildModeMenuContent(clientMode, 'browser');
        modeMenu.classList.add('show');
        requestAnimationFrame(function () {
          positionModeMenu();
        });
        setTimeout(() => {
          if (window.PreviewPingMonitor) {
            window.PreviewPingMonitor.updateGraph();
          }
        }, 100);
      });
  }
  
  function hideModeMenu() {
    if (modeMenu) {
      modeMenu.classList.remove('show');
    }
    if (modeMenuTimeout) {
      clearTimeout(modeMenuTimeout);
      modeMenuTimeout = null;
    }
  }
  
  function positionModeMenu() {
    if (!modeMenu || !modeIndicator) return;

    modeMenu.style.position = 'fixed';

    const rect = modeIndicator.getBoundingClientRect();
    const menuRect = modeMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = rect.left;
    let top = rect.bottom + 8;
    
    // Adjust if menu would go off screen
    if (left + menuRect.width > viewportWidth) {
      left = viewportWidth - menuRect.width - 16;
    }
    if (top + menuRect.height > viewportHeight) {
      top = rect.top - menuRect.height - 8;
    }
    
    modeMenu.style.left = left + 'px';
    modeMenu.style.top = top + 'px';
  }
  
  // Update mode indicator
  function updateModeIndicator() {
    if (!modeIndicator) return;
    
    const clientMode = window.__CLIENT_MODE || (window.electronAPI && window.electronAPI.isElectron ? 'app' : 'browser');
    
    // Fetch server mode for tooltip (also feeds backend-crash dialog via PreviewPingMonitor)
    fetch('/__api__/mode')
      .then((res) => {
        if (!res.ok) {
          if (window.PreviewPingMonitor && typeof PreviewPingMonitor.notifyModeCheckResult === 'function') {
            const st = res.status;
            PreviewPingMonitor.notifyModeCheckResult(false, {
              message: 'HTTP ' + st + ' ' + (res.statusText || ''),
              stack: '',
              status: st
            });
          }
          throw new Error('MODE_HTTP_' + res.status);
        }
        return res.json();
      })
      .then((data) => {
        if (window.PreviewPingMonitor && typeof PreviewPingMonitor.notifyModeCheckResult === 'function') {
          PreviewPingMonitor.notifyModeCheckResult(true);
        }
        modeIndicator.textContent = clientMode === 'app' ? 'APP' : 'BROWSER';
        modeIndicator.className = `mode-indicator ${clientMode}`;
        modeIndicator.title = `Click to view mode information`;
      })
      .catch((err) => {
        const alreadyNotified = err && typeof err.message === 'string' && err.message.indexOf('MODE_HTTP_') === 0;
        if (!alreadyNotified && window.PreviewPingMonitor && typeof PreviewPingMonitor.notifyModeCheckResult === 'function') {
          PreviewPingMonitor.notifyModeCheckResult(false, {
            message: err && err.message ? err.message : String(err),
            stack: err && err.stack ? err.stack : ''
          });
        }
        modeIndicator.textContent = clientMode === 'app' ? 'APP' : 'BROWSER';
        modeIndicator.className = `mode-indicator ${clientMode}`;
        modeIndicator.title = `Click to view mode information`;
      });
    
    // Add hover/click event listeners
    if (modeIndicator) {
      modeIndicator.addEventListener('mouseenter', () => {
        if (modeMenuTimeout) clearTimeout(modeMenuTimeout);
        modeMenuTimeout = setTimeout(() => {
          showModeMenu();
        }, 300);
      });
      
      modeIndicator.addEventListener('mouseleave', () => {
        if (modeMenuTimeout) {
          clearTimeout(modeMenuTimeout);
          modeMenuTimeout = null;
        }
        // Delay hiding to allow moving to menu
        setTimeout(() => {
          if (modeMenu && !modeMenu.matches(':hover') && !modeIndicator.matches(':hover')) {
            hideModeMenu();
          }
        }, 200);
      });
      
      modeIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modeMenu && modeMenu.classList.contains('show')) {
          hideModeMenu();
        } else {
          showModeMenu();
        }
      });
    }
  }
  
  updateModeIndicator();
  
  // Start ping monitoring on page load
  if (window.PreviewPingMonitor) {
    window.PreviewPingMonitor.start();
  }
  
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
  if (
    window.PreviewRemoteTunnelStatus &&
    typeof window.PreviewRemoteTunnelStatus.refresh === 'function'
  ) {
    window.PreviewRemoteTunnelStatus.refresh();
  }
  const previewSettings = PreviewSettings.getSettings();
  
  const receivedLogIds = new Set();
  const generateLogId = PreviewUtils.generateLogId;
  
  const customPrompt = PreviewUtils.customPrompt;
  const customConfirm = PreviewUtils.customConfirm;
  
  PreviewInitialization.initializeVisibility(resizerEditor, previewPanel);
  
  function loadFileTree(dir, expandHint, opts) {
    PreviewFileExplorer.loadFileTree(
      dir, fileTree, currentDirRef, updateBackButton, saveState,
      renderFileTree,
      (d) => fetchDirectoryListing(d),
      expandHint !== undefined && expandHint !== null ? expandHint : filePathRef.current,
      opts
    );
    currentDir = currentDirRef.currentDir;
  }
  
  function fetchDirectoryListing(dir) {
    PreviewFileExplorer.fetchDirectoryListing(dir, fileTree, (files, dir) => renderFileTree(files, dir));
  }
  
  function renderFileTree(files, dir) {
    if (PreviewSettings.getSettings().explorerTreeView) {
      PreviewFileExplorer.renderFileTreeTree(
        files, dir, fileTree, () => filePathRef.current,
        loadFileTree, switchToFile, showContextMenu, renameFile,
        moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone
      );
    } else {
      PreviewFileExplorer.renderFileTree(
        files, dir, fileTree, () => filePathRef.current,
        loadFileTree, switchToFile, showContextMenu, renameFile,
        moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone
      );
    }
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
    PreviewFileExplorer.handleFileSystemEvent(data, () => currentDirRef.currentDir, loadFileTree);
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
  
  function hideBinaryFilePrompt() {
    const el = document.getElementById('binaryEditPrompt');
    if (!el) return;
    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
  }

  function showBinaryFilePrompt(filePath) {
    const el = document.getElementById('binaryEditPrompt');
    if (!el) return;
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    const openBtn = document.getElementById('binaryEditPromptOpenHex');
    const dismissBtn = document.getElementById('binaryEditPromptDismiss');
    if (openBtn) {
      openBtn.onclick = () => {
        openHexEditorForPath(filePath);
      };
    }
    if (dismissBtn) {
      dismissBtn.onclick = () => {
        hideBinaryFilePrompt();
      };
    }
  }

  async function openHexEditorForPath(hexPath) {
    if (!window.PreviewHexEditor || typeof PreviewHexEditor.open !== 'function') {
      return;
    }
    const editorEl = document.getElementById('editor');
    const mount = document.getElementById('hexEditorMount');
    if (!editorEl || !mount) return;

    hideBinaryFilePrompt();
    openHexEditorPending = true;
    beginPreviewForcedHidden();
    try {
      if (hexPath !== filePathRef.current) {
        await switchToFileInternal(hexPath);
        if (filePathRef.current !== hexPath) {
          endPreviewForcedHidden();
          return;
        }
      }

      const ok = await PreviewHexEditor.open(hexPath, {
        monacoHost: editorEl,
        mount: mount,
        onDirty: (d) => {
          isDirty.current = d;
          updateStatus();
          const p = filePathRef.current;
          if (p) {
            PreviewTabManager.updateTabDirtyState(p, d, originalContent.current);
          }
        },
        reloadTextEditor: () => loadFile(filePathRef.current, true)
      });
      if (ok) {
        status.textContent = 'Hex editor';
        status.className = 'status';
      } else {
        endPreviewForcedHidden();
        const p = filePathRef.current;
        if (p && PreviewEditorManager.isBinaryNoPreviewPath(p)) {
          showBinaryFilePrompt(p);
        }
      }
    } finally {
      openHexEditorPending = false;
    }
  }

  function setupContextMenu() {
    PreviewFileExplorer.setupContextMenu(
      contextMenu, fileTree, createNewFile, createNewFolder, renameFile, deleteFile,
      (e, path, isDirectory, name, onlyCreate) => showContextMenu(e, path, isDirectory, name, onlyCreate),
      openHexEditorForPath
    );
  }
  
  function showContextMenu(e, path, isDirectory, name, onlyCreate = false) {
    PreviewFileExplorer.showContextMenu(
      e, path, isDirectory, name, contextMenu, onlyCreate,
      () => currentDirRef.currentDir
    );
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
    const newDir = PreviewFileExplorer.parentDirFromFilePath(newPath);
    if (PreviewFileExplorer.explorerDirsMatch(newDir, currentDirRef.currentDir)) {
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

  function setupCompiler() {
    if (window.PreviewCompiler && typeof window.PreviewCompiler.init === 'function') {
      window.PreviewCompiler.init();
    }
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
    PreviewFileExplorer.handleFileSystemEvent(data, () => currentDirRef.currentDir, loadFileTree);
  }
  
  function showServerUpdateNotification() {
    PreviewServer.showServerUpdateNotification(() => {
      PreviewServer.restartServer(editor, filePathRef.current, isDirty, saveFile, ws.current);
    });
  }
  
  function goBackFolder() {
    if (PreviewSettings.getSettings().explorerTreeView) {
      return;
    }
    const newDir = PreviewUI.goBackFolder(currentDirRef.currentDir, loadFileTree, updateBackButton);
    if (newDir !== currentDirRef.currentDir) {
      currentDirRef.currentDir = newDir;
      currentDir = newDir;
    }
  }
  
  function updateBackButton() {
    PreviewUI.updateBackButton(backBtn, currentDirRef.currentDir, PreviewSettings.getSettings().explorerTreeView);
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

  function beginPreviewForcedHidden() {
    if (!previewPanel) return;
    if (PreviewPopouts.isPreviewPoppedOut()) return;
    if (!previewForcedHiddenRef.active) {
      previewForcedHiddenRef.restoreOpen = !previewPanel.classList.contains('collapsed');
      previewForcedHiddenRef.active = true;
    }
    if (!previewPanel.classList.contains('collapsed')) {
      previewPanel.classList.add('collapsed');
      if (togglePreview) togglePreview.textContent = '▶';
      updatePreviewVisibility();
      saveState();
    }
  }

  function endPreviewForcedHidden() {
    if (!previewForcedHiddenRef.active) return;
    previewForcedHiddenRef.active = false;
    if (!previewPanel) return;
    if (PreviewPopouts.isPreviewPoppedOut()) return;
    if (previewForcedHiddenRef.restoreOpen) {
      previewPanel.classList.remove('collapsed');
      if (togglePreview) togglePreview.textContent = '◀';
      updatePreviewVisibility();
      refreshPreview();
      saveState();
    }
    previewForcedHiddenRef.restoreOpen = false;
  }

  window.__previewBeginForcedPanel = beginPreviewForcedHidden;
  window.__previewEndForcedPanel = endPreviewForcedHidden;
  
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
    if (window.PreviewHexEditor && PreviewHexEditor.isActive()) {
      const hexPath = PreviewHexEditor.getPath();
      if (newPath !== hexPath) {
        if (PreviewHexEditor.isDirty()) {
          const ok = await customConfirm('The hex editor has unsaved changes. Switch files anyway?', true);
          if (!ok) return;
        }
        PreviewHexEditor.close();
        isDirty.current = false;
      }
    }

    const editorMonacoHexStack = document.getElementById('editorMonacoHexStack');
    const gitDiffViewEl = document.getElementById('gitDiffView');
    const browserViewEl = document.getElementById('browserView');

    if (
      window.PreviewCommitDiffViewer &&
      typeof PreviewCommitDiffViewer.isGitDiffTab === 'function' &&
      PreviewCommitDiffViewer.isGitDiffTab(newPath)
    ) {
      if (editorMonacoHexStack) editorMonacoHexStack.style.display = 'none';
      if (browserViewEl) browserViewEl.style.display = 'none';
      if (gitDiffViewEl) {
        gitDiffViewEl.style.display = 'flex';
        gitDiffViewEl.hidden = false;
      }
      if (typeof PreviewCommitDiffViewer.activateTab === 'function') {
        PreviewCommitDiffViewer.activateTab(newPath);
      }
      fileName.textContent =
        typeof PreviewCommitDiffViewer.getTabTitle === 'function'
          ? PreviewCommitDiffViewer.getTabTitle(newPath)
          : 'Git diff';
      filePathRef.current = newPath;
      filePath = newPath;
      PreviewTabManager.updateActiveTab(newPath);
      saveState();
      return;
    }

    if (gitDiffViewEl) {
      gitDiffViewEl.style.display = 'none';
      gitDiffViewEl.hidden = true;
    }

    // Check if this is a browser tab
    if (PreviewBrowserManager && PreviewBrowserManager.isBrowserTab(newPath)) {
      if (editorMonacoHexStack) editorMonacoHexStack.style.display = 'none';
      PreviewBrowserManager.showBrowserView();
      fileName.textContent = 'Browser';
      filePathRef.current = newPath;
      filePath = newPath;
      PreviewTabManager.updateActiveTab(newPath);
      saveState();
      return;
    } else {
      // Hide browser view if switching to a regular file
      if (PreviewBrowserManager) {
        PreviewBrowserManager.hideBrowserView();
      }
    }
    
    if (skipCache) {
      const openTabs = PreviewTabManager.getOpenTabs();
      if (openTabs.includes(newPath)) {
        fileName.textContent = newPath.split('/').pop();
        const newDir = PreviewFileExplorer.parentDirFromFilePath(newPath);
        if (!PreviewSettings.getSettings().explorerTreeView && !PreviewFileExplorer.explorerDirsMatch(newDir, currentDirRef.currentDir)) {
          loadFileTree(newDir, undefined, { silent: true });
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
    if (window.PreviewHexEditor && PreviewHexEditor.isActive()) {
      const hexPath = PreviewHexEditor.getPath();
      if (hexPath === path) {
        return;
      }
      if (PreviewHexEditor.isDirty()) {
        const ok = await customConfirm('The hex editor has unsaved changes. Discard and open this file as text?', true);
        if (!ok) return;
      }
      PreviewHexEditor.close();
    }

    filePathRef.current = path;
    filePath = path;
    
    const result = await PreviewEditorManager.loadFile(
      path, status, editor, previewFrame, previewSettings, fileTree,
      getLanguage,
      skipCache ? null : ((cached, live, filePath) => customCacheDialog(cached, live, filePath)),
      showImagePreview, showHtmlPreview, interceptPreviewLinks,
      setupPreviewLogInterception, updateStatus, originalContent, isDirty, isApplyingExternalChange, skipCache,
      () => previewPinned.current,
      { showBinaryPrompt: showBinaryFilePrompt, hideBinaryPrompt: hideBinaryFilePrompt }
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

    if (
      !openHexEditorPending &&
      !PreviewEditorManager.isBinaryNoPreviewPath(path) &&
      (!window.PreviewHexEditor || !PreviewHexEditor.isActive())
    ) {
      endPreviewForcedHidden();
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
    if (window.PreviewHexEditor && PreviewHexEditor.isActive()) {
      PreviewHexEditor.save(() => filePathRef.current, status).then((result) => {
        if (result && result.success) {
          const currentPath = filePathRef.current;
          if (currentPath) {
            PreviewTabManager.updateTabDirtyState(currentPath, false, originalContent.current);
          }
        }
      });
      return;
    }
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
  setupCompiler();
  setupWebSocket();
  if (window.PreviewClientSessions && typeof window.PreviewClientSessions.init === 'function') {
    window.PreviewClientSessions.init();
  }
  if (window.PreviewRemoteViewers && typeof window.PreviewRemoteViewers.init === 'function') {
    void window.PreviewRemoteViewers.init();
  }
  
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

  function openReplaceInFiles() {
    if (!window.PreviewReplaceInFiles || typeof window.PreviewReplaceInFiles.open !== 'function') {
      return;
    }
    window.PreviewReplaceInFiles.open(
      function (filePath) {
        PreviewEditorManager.switchToFile(
          filePath,
          () => filePathRef.current,
          isDirty,
          customConfirm,
          fileName,
          () => currentDirRef.currentDir,
          loadFileTree,
          updateActiveFileTreeItem,
          loadFile,
          saveState,
          false
        );
      },
      editor,
      function (modifiedPaths) {
        if (typeof window.__previewReloadFileExplorer === 'function') {
          window.__previewReloadFileExplorer();
        }
        const cur = filePathRef.current;
        if (!cur || cur.indexOf('browser://') === 0 || cur.indexOf('gitdiff://') === 0) {
          return;
        }
        const norm = function (p) {
          return String(p || '')
            .replace(/^\/+/, '')
            .replace(/\\/g, '/');
        };
        const curN = norm(cur);
        for (let i = 0; i < modifiedPaths.length; i++) {
          if (norm(modifiedPaths[i]) === curN) {
            loadFile(cur, true);
            break;
          }
        }
      }
    );
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
  
  function createNewFile(targetDirOverride) {
    PreviewFileExplorer.createNewFile(
      customPrompt,
      () => currentDirRef.currentDir,
      loadFileTree,
      (path) => {
        PreviewEditorManager.switchToFile(
          path, () => filePathRef.current, isDirty, customConfirm, fileName, () => currentDirRef.currentDir,
          loadFileTree, updateActiveFileTreeItem, loadFile, saveState, false
        );
      },
      targetDirOverride
    );
  }
  
  function createNewFolder(targetDirOverride) {
    PreviewFileExplorer.createNewFolder(
      customPrompt,
      () => currentDirRef.currentDir,
      loadFileTree,
      targetDirOverride
    );
  }
  
  function openGitPanel() {
    PreviewGitPanel.toggle();
  }
  
  function openSettings() {
    PreviewSettings.openSettings();
  }

  function refreshPreviewFromMenu() {
    const ed = window.__previewEditor;
    if (ed) {
      const u = window.__previewUpdatePreview;
      if (typeof u === 'function') {
        u(ed.getValue());
      }
    }
    const syncChannel = window.__previewSyncChannel;
    if (syncChannel) {
      syncChannel.postMessage({ type: 'preview-refresh' });
    }
  }

  async function closeWindowFromMenu() {
    const isDirtyRef = window.__previewIsDirty;
    const customConfirmFn = window.__previewCustomConfirm;
    if (isDirtyRef && isDirtyRef.current && typeof customConfirmFn === 'function') {
      const confirmed = await customConfirmFn('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) {
        return;
      }
    }
    window.close();
  }
  
  PreviewEvents.setupKeyboardShortcuts(
    toggleFileExplorer, 
    togglePreviewPanel, 
    openFileSearch, 
    openGlobalSearch,
    openReplaceInFiles,
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

  if (window.PreviewFileMenu && typeof window.PreviewFileMenu.init === 'function') {
    window.PreviewFileMenu.init({
      newFile: function () {
        createNewFile();
      },
      newFolder: function () {
        createNewFolder();
      },
      openQuickOpen: openFileSearch,
      openFolder: changeWorkingDirectory,
      globalSearch: openGlobalSearch,
      toggleExplorer: toggleFileExplorer,
      togglePreview: togglePreviewPanel,
      toggleTerminal: toggleTerminalPanel,
      save: saveFile,
      refreshPreview: refreshPreviewFromMenu,
      gitPanel: openGitPanel,
      settings: openSettings,
      help: openHelpMenu,
      closeTab: closeCurrentTab,
      closeWindow: closeWindowFromMenu
    });
  }
  
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
  if (window.PreviewStatusBar && typeof window.PreviewStatusBar.init === 'function') {
    window.PreviewStatusBar.init(editor);
  }
  if (window.PreviewGitStatusBar && typeof PreviewGitStatusBar.init === 'function') {
    PreviewGitStatusBar.init();
  }
  if (window.PreviewProblemsPanel && typeof window.PreviewProblemsPanel.init === 'function') {
    window.PreviewProblemsPanel.init(editor);
  }
  if (window.PreviewDiscordPresence && typeof window.PreviewDiscordPresence.init === 'function') {
    window.PreviewDiscordPresence.init({
      editor: editor,
      getFilePath: function () {
        return filePathRef.current;
      },
      getCurrentDir: function () {
        return currentDirRef.currentDir;
      },
      getLanguage: getLanguage
    });
  }
  
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
          fileName.textContent = filePath.split('/').pop();
          const newDir = PreviewFileExplorer.parentDirFromFilePath(filePath);
          if (!PreviewSettings.getSettings().explorerTreeView && !PreviewFileExplorer.explorerDirsMatch(newDir, currentDirRef.currentDir)) {
            loadFileTree(newDir, undefined, { silent: true });
          } else {
            updateActiveFileTreeItem(filePath);
          }
          // Tab switches used to only editor.setValue(), leaving the wrong Monaco model/URI
          // (content from file B while model still pointed at file A). That broke cross-file
          // navigation after switching tabs. Align model URI with the active tab path.
          if (!filePath.startsWith('browser://') && !filePath.startsWith('gitdiff://')) {
            const normalizedPath = String(filePath)
              .replace(/\\/g, '/')
              .replace(/^\/+/, '')
              .replace(/\/+/g, '/');
            const detectedLanguage = getLanguage(filePath);
            let targetModel = monaco.editor.getModels().find((m) => {
              const modelPath = m.uri.path
                .replace(/\\/g, '/')
                .replace(/^\/+/, '')
                .replace(/\/+/g, '/');
              return modelPath === normalizedPath;
            });
            if (!targetModel) {
              const uri = monaco.Uri.parse('file:///' + normalizedPath);
              targetModel = monaco.editor.createModel(content, detectedLanguage, uri);
            } else {
              targetModel.setValue(content);
              monaco.editor.setModelLanguage(targetModel, detectedLanguage);
            }
            editor.setModel(targetModel);
            PreviewEditorManager.applyEditorReadOnlyForPath(editor, filePath);
          } else {
            editor.setValue(content);
            PreviewEditorManager.applyEditorReadOnlyForPath(editor, filePath);
          }
        } else {
          // Clear file path and name when no file is open
          filePathRef.current = '';
          fileName.textContent = '';
          editor.setValue(content);
          editor.updateOptions({ readOnly: false });
        }
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
  
  // Initialize Browser Manager
  const browserContainer = document.getElementById('browserContainer');
  const browserView = document.getElementById('browserView');
  const browserTabsContainer = document.getElementById('browserTabsContainer');
  const browserUrlInput = document.getElementById('browserUrlInput');
  const browserBackBtn = document.getElementById('browserBackBtn');
  const browserForwardBtn = document.getElementById('browserForwardBtn');
  const browserRefreshBtn = document.getElementById('browserRefreshBtn');
  const newBrowserTabBtn = document.getElementById('newBrowserTabBtn');
  
  if (browserContainer && browserView && browserTabsContainer && editorContainer) {
    PreviewBrowserManager.initialize(
      browserContainer,
      browserTabsContainer,
      browserUrlInput,
      browserBackBtn,
      browserForwardBtn,
      browserRefreshBtn,
      browserView,
      editorContainer
    );
  }
  
  // Initialize Inspector Manager
  const browserInspector = document.getElementById('browserInspector');
  if (browserInspector && window.PreviewInspectorManager) {
    window.PreviewInspectorManager.initialize(browserInspector);
  }
  
  if (newBrowserTabBtn) {
    newBrowserTabBtn.addEventListener('click', () => {
      if (typeof PreviewBrowserManager !== 'undefined' && PreviewBrowserManager.openBrowserEditorTab) {
        PreviewBrowserManager.openBrowserEditorTab();
      } else {
        console.error('PreviewBrowserManager is not available');
      }
    });
  }
  
  const openBrowserInEditorBtn = document.getElementById('openBrowserInEditorBtn');
  if (openBrowserInEditorBtn) {
    openBrowserInEditorBtn.addEventListener('click', () => {
      if (typeof PreviewBrowserManager !== 'undefined' && PreviewBrowserManager.openBrowserEditorTab) {
        PreviewBrowserManager.openBrowserEditorTab();
      } else {
        console.error('PreviewBrowserManager is not available');
      }
    });
  }
  
  window.__previewEditor = editor;

  function runMonacoAction(actionId) {
    if (!editor) return;
    editor.focus();
    const a = editor.getAction(actionId);
    if (a && a.isSupported()) {
      a.run();
    } else {
      editor.trigger('menu', actionId, null);
    }
  }

  /**
   * Edit menu runs after dropdown closes; defer so focus returns to the editor.
   * Uses actions registered in PreviewEditorSetup (preview.menu.undo / preview.menu.redo).
   */
  function runEditorUndo() {
    if (!editor) return;
    requestAnimationFrame(function () {
      setTimeout(function () {
        editor.focus();
        const a = editor.getAction('preview.menu.undo');
        if (a) {
          a.run();
        }
      }, 0);
    });
  }

  function runEditorRedo() {
    if (!editor) return;
    requestAnimationFrame(function () {
      setTimeout(function () {
        editor.focus();
        const a = editor.getAction('preview.menu.redo');
        if (a) {
          a.run();
        }
      }, 0);
    });
  }

  function tryEmmetExpandAbbreviation() {
    if (!editor) return;
    editor.focus();
    const tryIds = [
      'editor.emmet.action.expandAbbreviation',
      'editor.action.emmetExpandAbbreviation'
    ];
    for (let i = 0; i < tryIds.length; i++) {
      const act = editor.getAction(tryIds[i]);
      if (act && act.isSupported()) {
        act.run();
        return;
      }
    }
  }

  if (window.PreviewFileMenu && typeof window.PreviewFileMenu.initEdit === 'function') {
    window.PreviewFileMenu.initEdit({
      undo: runEditorUndo,
      redo: runEditorRedo,
      cut: function () {
        runMonacoAction('editor.action.clipboardCutAction');
      },
      copy: function () {
        runMonacoAction('editor.action.clipboardCopyAction');
      },
      paste: function () {
        runMonacoAction('editor.action.clipboardPasteAction');
      },
      find: function () {
        runMonacoAction('actions.find');
      },
      replace: function () {
        runMonacoAction('editor.action.startFindReplaceAction');
      },
      findInFiles: openGlobalSearch,
      replaceInFiles: openReplaceInFiles,
      toggleLineComment: function () {
        runMonacoAction('editor.action.commentLine');
      },
      toggleBlockComment: function () {
        runMonacoAction('editor.action.blockComment');
      },
      emmetExpand: tryEmmetExpandAbbreviation
    });
  }

  window.__previewFilePath = () => filePathRef.current;
  window.__previewSwitchToFile = switchToFile;
  window.__previewSetExplorerDir = (p) => {
    if (!PreviewSettings.getSettings().explorerTreeView) return;
    currentDirRef.currentDir = p || '/';
    currentDir = currentDirRef.currentDir;
    saveState();
  };
  window.__previewReloadFileExplorer = () => {
    loadFileTree(currentDirRef.currentDir, filePathRef.current);
    updateBackButton();
  };
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

  function focusTerminalClientInput() {
    if (terminalPanel && terminalPanel.classList.contains('collapsed')) {
      terminalPanel.classList.remove('collapsed');
      updateTerminalVisibility();
      saveState();
    }
    const clientTab = document.querySelector('.terminal-tab[data-tab="client"]');
    if (clientTab) {
      clientTab.click();
    }
    requestAnimationFrame(function () {
      setTimeout(function () {
        const inp = document.getElementById('terminalClientInput');
        if (inp) {
          inp.focus();
        }
      }, 0);
    });
  }

  function openProblemsTerminalTab() {
    if (terminalPanel && terminalPanel.classList.contains('collapsed')) {
      terminalPanel.classList.remove('collapsed');
      updateTerminalVisibility();
      saveState();
    }
    const tab = document.querySelector('.terminal-tab[data-tab="problems"]');
    if (tab) {
      tab.click();
    }
  }

  function openCompilerTerminalTab() {
    if (terminalPanel && terminalPanel.classList.contains('collapsed')) {
      terminalPanel.classList.remove('collapsed');
      updateTerminalVisibility();
      saveState();
    }
    const tab = document.querySelector('.terminal-tab[data-tab="compiler"]');
    if (tab) {
      tab.click();
    }
  }

  function runCompileFromMenu() {
    openCompilerTerminalTab();
    requestAnimationFrame(function () {
      setTimeout(function () {
        if (window.PreviewCompiler && typeof window.PreviewCompiler.run === 'function') {
          window.PreviewCompiler.run();
        }
      }, 0);
    });
  }

  function toggleEditorMinimap() {
    if (!editor || !monaco || !monaco.editor || typeof monaco.editor.EditorOption === 'undefined') {
      return;
    }
    editor.focus();
    try {
      const minimapOpt = editor.getOption(monaco.editor.EditorOption.minimap);
      const enabled = minimapOpt && minimapOpt.enabled;
      editor.updateOptions({ minimap: { enabled: !enabled } });
    } catch (_e) {
      const raw = editor.getRawOptions && editor.getRawOptions();
      if (raw && raw.minimap) {
        editor.updateOptions({ minimap: { enabled: !raw.minimap.enabled } });
      }
    }
  }

  function runMarkerNavigation(next) {
    if (!editor) {
      return;
    }
    editor.focus();
    const ids = next
      ? ['editor.action.marker.nextInFiles', 'editor.action.marker.next']
      : ['editor.action.marker.prevInFiles', 'editor.action.marker.prev'];
    for (let i = 0; i < ids.length; i++) {
      const a = editor.getAction(ids[i]);
      if (a && a.isSupported()) {
        a.run();
        return;
      }
    }
  }

  function runDeferredMenuEditor(fn) {
    if (!editor) {
      return;
    }
    requestAnimationFrame(function () {
      setTimeout(function () {
        fn();
      }, 0);
    });
  }

  if (window.PreviewFileMenu && typeof window.PreviewFileMenu.registerMenu === 'function') {
    window.PreviewFileMenu.registerMenu('previewSelectionMenuWrap', 'previewSelectionMenuBtn', 'previewSelectionMenu', {
      selSelectAll: function () {
        runMonacoAction('editor.action.selectAll');
      },
      selExpand: function () {
        runMonacoAction('editor.action.smartSelect.expand');
      },
      selShrink: function () {
        runMonacoAction('editor.action.smartSelect.shrink');
      },
      selCopyLineUp: function () {
        runMonacoAction('editor.action.copyLinesUpAction');
      },
      selCopyLineDown: function () {
        runMonacoAction('editor.action.copyLinesDownAction');
      },
      selMoveLineUp: function () {
        runMonacoAction('editor.action.moveLinesUpAction');
      },
      selMoveLineDown: function () {
        runMonacoAction('editor.action.moveLinesDownAction');
      },
      selDuplicate: function () {
        runMonacoAction('editor.action.duplicateSelection');
      },
      selCursorAbove: function () {
        runMonacoAction('editor.action.insertCursorAbove');
      },
      selCursorBelow: function () {
        runMonacoAction('editor.action.insertCursorBelow');
      },
      selCursorsLineEnds: function () {
        runMonacoAction('editor.action.insertCursorAtEndOfEachLineSelected');
      },
      selAddNext: function () {
        runMonacoAction('editor.action.addSelectionToNextFindMatch');
      },
      selAddPrev: function () {
        runMonacoAction('editor.action.addSelectionToPreviousFindMatch');
      },
      selAllOccurrences: function () {
        if (!editor) {
          return;
        }
        editor.focus();
        const ids = ['editor.action.selectHighlights', 'editor.action.changeAll'];
        for (let i = 0; i < ids.length; i++) {
          const a = editor.getAction(ids[i]);
          if (a && a.isSupported()) {
            a.run();
            return;
          }
        }
      }
    });

    window.PreviewFileMenu.registerMenu('previewViewMenuWrap', 'previewViewMenuBtn', 'previewViewMenu', {
      viewExplorer: function () {
        toggleFileExplorer();
      },
      viewPreview: function () {
        togglePreviewPanel();
      },
      viewTerminal: function () {
        toggleTerminalPanel();
      },
      viewMinimap: function () {
        toggleEditorMinimap();
      },
      viewProblems: function () {
        openProblemsTerminalTab();
      }
    });

    window.PreviewFileMenu.registerMenu('previewGoMenuWrap', 'previewGoMenuBtn', 'previewGoMenu', {
      goBack: function () {
        runMonacoAction('editor.action.navigateBack');
      },
      goForward: function () {
        runMonacoAction('editor.action.navigateForward');
      },
      goFile: function () {
        openFileSearch();
      },
      goSymbol: function () {
        if (window.PreviewEditorNavigation && typeof window.PreviewEditorNavigation.openSymbolNavigator === 'function') {
          runDeferredMenuEditor(function () {
            window.PreviewEditorNavigation.openSymbolNavigator(editor);
          });
        } else {
          openSymbolNavigator();
        }
      },
      goDefinition: function () {
        if (window.PreviewEditorNavigation && typeof window.PreviewEditorNavigation.jumpToDefinition === 'function') {
          runDeferredMenuEditor(function () {
            window.PreviewEditorNavigation.jumpToDefinition(editor, function () {
              return filePathRef.current;
            }, switchToFile);
          });
        }
      },
      goReferences: function () {
        if (window.PreviewEditorNavigation && typeof window.PreviewEditorNavigation.findReferences === 'function') {
          runDeferredMenuEditor(function () {
            window.PreviewEditorNavigation.findReferences(editor, function () {
              return filePathRef.current;
            });
          });
        }
      },
      goLine: function () {
        runMonacoAction('editor.action.gotoLine');
      },
      goNextProblem: function () {
        runMarkerNavigation(true);
      },
      goPrevProblem: function () {
        runMarkerNavigation(false);
      }
    });

    window.PreviewFileMenu.registerMenu('previewRunMenuWrap', 'previewRunMenuBtn', 'previewRunMenu', {
      runOpenCompiler: function () {
        openCompilerTerminalTab();
      },
      runCompile: function () {
        runCompileFromMenu();
      },
      runFocusTerminal: function () {
        focusTerminalClientInput();
      }
    });

    window.PreviewFileMenu.registerMenu('previewTerminalMenuWrap', 'previewTerminalMenuBtn', 'previewTerminalMenu', {
      termToggle: function () {
        toggleTerminalPanel();
      },
      termFocus: function () {
        focusTerminalClientInput();
      }
    });
  }

  if (window.PreviewCrossModuleNavigation) {
    if (typeof window.PreviewCrossModuleNavigation.initCompletionProviders === 'function') {
      window.PreviewCrossModuleNavigation.initCompletionProviders();
    }
    if (typeof window.PreviewCrossModuleNavigation.initDefinitionHoverProviders === 'function') {
      window.PreviewCrossModuleNavigation.initDefinitionHoverProviders(() => filePathRef.current);
    }
  }
  
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
  
  PreviewEvents.setupButtonHandlers(
    refreshBtn, openPreviewPopout, openTerminalPopout, togglePreviewPanel
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
  const statusGitBranch = document.getElementById('statusGitBranch');
  if (statusGitBranch && window.PreviewGitPanel && typeof PreviewGitPanel.showRepoTab === 'function') {
    statusGitBranch.addEventListener('click', () => {
      PreviewGitPanel.showRepoTab();
    });
  }
  
  PreviewSettingsUI.setupSettingsEventHandlers(
    settingsBtn, settingsPanel, settingsCloseBtn, saveSettingsBtn, resetSettingsBtn2,
    null,
    status,
    editor,
    customConfirm,
    resetSettings
  );
  
  PreviewEvents.setupBeforeUnload(isDirty, ws, saveState);

  if (window.PreviewElectronClose && typeof PreviewElectronClose.setup === 'function') {
    PreviewElectronClose.setup(isDirty, ws, saveState, customConfirm, {
      getEditorValue: () => (editor ? editor.getValue() : ''),
      getFilePath: () => filePathRef.current
    });
  }
  
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
  
  setTimeout(() => {
    PreviewServer.restoreTempEditorState(filePathRef.current, editor, updateStatus);
  }, 1000);
});
