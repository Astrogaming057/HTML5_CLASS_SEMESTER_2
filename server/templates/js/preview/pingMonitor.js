window.PreviewPingMonitor = (function() {
  let pingHistory = [];
  let pingInterval = null;
  const MAX_PING_HISTORY = 60; // Store last 60 pings (3 minutes at 3s intervals)
  const PING_INTERVAL = 3000; // Ping every 3 seconds
  
  async function measurePing() {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch('/__api__/mode', {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const ping = Math.round(endTime - startTime);
      
      if (response.ok) {
        pingHistory.push({
          time: Date.now(),
          ping: ping,
          success: true
        });
      } else {
        pingHistory.push({
          time: Date.now(),
          ping: null,
          success: false
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      pingHistory.push({
        time: Date.now(),
        ping: null,
        success: false
      });
    }
    
    // Keep only last MAX_PING_HISTORY entries
    if (pingHistory.length > MAX_PING_HISTORY) {
      pingHistory = pingHistory.slice(-MAX_PING_HISTORY);
    }
  }
  
  function getPingStats() {
    const successfulPings = pingHistory.filter(p => p.success && p.ping !== null);
    const failedPings = pingHistory.filter(p => !p.success || p.ping === null);
    
    if (successfulPings.length === 0) {
      return {
        average: null,
        last: null,
        packetLoss: pingHistory.length > 0 ? (failedPings.length / pingHistory.length * 100).toFixed(1) : '0.0',
        serverEndpoint: 'localhost:3000'
      };
    }
    
    const pings = successfulPings.map(p => p.ping);
    const average = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
    const last = successfulPings[successfulPings.length - 1].ping;
    const packetLoss = pingHistory.length > 0 ? (failedPings.length / pingHistory.length * 100).toFixed(1) : '0.0';
    
    return {
      average,
      last,
      packetLoss,
      serverEndpoint: 'localhost:3000'
    };
  }
  
  function drawPingGraph(canvas, ctx) {
    const history = pingHistory; // Use local variable
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    
    // Clear canvas
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines (ping values)
    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      // Y-axis labels
      ctx.fillStyle = '#aaa';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      const value = 20 - (i * 5);
      ctx.fillText(value.toString(), 5, y + 3);
    }
    
    // Draw ping line
    if (history.length > 1) {
      const successfulPings = history.filter(p => p.success && p.ping !== null);
      
      if (successfulPings.length > 0) {
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const maxPing = Math.max(20, ...successfulPings.map(p => p.ping));
        const minPing = Math.min(0, ...successfulPings.map(p => p.ping));
        const pingRange = maxPing - minPing || 20;
        
        successfulPings.forEach((pingData, index) => {
          const x = padding + (graphWidth / (successfulPings.length - 1)) * index;
          const normalizedPing = Math.min(pingData.ping, 20);
          const y = padding + graphHeight - ((normalizedPing / 20) * graphHeight);
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = '#4a9eff';
        successfulPings.forEach((pingData, index) => {
          const x = padding + (graphWidth / (successfulPings.length - 1)) * index;
          const normalizedPing = Math.min(pingData.ping, 20);
          const y = padding + graphHeight - ((normalizedPing / 20) * graphHeight);
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    
    // X-axis time labels (simplified - show start and end)
    if (history.length > 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      
      const firstTime = new Date(history[0].time);
      const lastTime = new Date(history[history.length - 1].time);
      
      const formatTime = (date) => {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      };
      
      ctx.fillText(formatTime(firstTime), padding, height - 5);
      ctx.fillText(formatTime(lastTime), width - padding, height - 5);
    }
  }
  
  function updatePingGraph() {
    const canvas = document.getElementById('pingGraph');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    drawPingGraph(canvas, ctx);
    
    // Update stats
    const stats = getPingStats();
    const avgPingEl = document.getElementById('avgPing');
    const lastPingEl = document.getElementById('lastPing');
    const packetLossEl = document.getElementById('packetLoss');
    
    if (avgPingEl) avgPingEl.textContent = stats.average !== null ? `${stats.average} ms` : '-';
    if (lastPingEl) lastPingEl.textContent = stats.last !== null ? `${stats.last} ms` : '-';
    if (packetLossEl) packetLossEl.textContent = `${stats.packetLoss}%`;
  }
  
  const module = {
    start() {
      if (pingInterval) return;
      
      // Initial ping
      measurePing();
      
      // Start interval
      pingInterval = setInterval(measurePing, PING_INTERVAL);
    },
    
    stop() {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    },
    
    getStats() {
      return getPingStats();
    },
    
    updateGraph() {
      updatePingGraph();
    },
    
    getHistory() {
      return [...pingHistory];
    }
  };
  
  return module;
})();
