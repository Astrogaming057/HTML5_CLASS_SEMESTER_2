(function() {
  const navBar = document.createElement('div');
  navBar.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #f0f0f0; padding: 10px; border-bottom: 1px solid #ccc; z-index: 10000; display: flex; gap: 10px; align-items: center;';
  
  const backBtn = document.createElement('button');
  backBtn.textContent = '← Back to Directory';
  backBtn.style.cssText = 'padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
  backBtn.onclick = () => {
    const currentPath = window.location.pathname;
    const dirPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    window.location.href = dirPath;
  };
  
  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '🔄 Refresh';
  refreshBtn.style.cssText = 'padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
  refreshBtn.onclick = () => {
    window.location.reload();
  };
  
  const statusDiv = document.createElement('div');
  statusDiv.id = 'server-status';
  statusDiv.style.cssText = 'margin-left: auto; padding: 4px 8px; font-size: 12px; color: #666;';
  statusDiv.textContent = 'Connected';
  
  navBar.appendChild(backBtn);
  navBar.appendChild(refreshBtn);
  navBar.appendChild(statusDiv);
  
  document.body.style.paddingTop = '50px';
  document.body.insertBefore(navBar, document.body.firstChild);
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = protocol + '//' + window.location.host;
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    statusDiv.textContent = 'Connected';
    statusDiv.style.color = '#4CAF50';
  };
  
  ws.onclose = () => {
    statusDiv.textContent = 'Disconnected';
    statusDiv.style.color = '#f44336';
  };
  
  ws.onerror = () => {
    statusDiv.textContent = 'Error';
    statusDiv.style.color = '#f44336';
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'fileChanged') {
      const currentPath = window.location.pathname.replace(/^\/+/, '').replace(/\\/g, '/');
      const changedPath = data.path.replace(/\\/g, '/');
      
      const normalizePath = (p) => {
        p = p.replace(/^\/+/, '').replace(/\/+$/, '');
        return p.toLowerCase();
      };
      
      const currentNormalized = normalizePath(currentPath);
      const changedNormalized = normalizePath(changedPath);
      
      const getDir = (p) => {
        const lastSlash = p.lastIndexOf('/');
        return lastSlash >= 0 ? p.substring(0, lastSlash) : '';
      };
      
      const currentDir = getDir(currentNormalized);
      const changedDir = getDir(changedNormalized);
      
      const isCurrentFile = currentNormalized === changedNormalized;
      const isSameDirectory = currentDir && currentDir === changedDir;
      
      if (isCurrentFile || isSameDirectory) {
        statusDiv.textContent = 'File changed, refreshing...';
        statusDiv.style.color = '#FF9800';
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    }
  };
  
  window.addEventListener('beforeunload', () => {
    ws.close();
  });
})();
