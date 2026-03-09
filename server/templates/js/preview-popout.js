const urlParams = new URLSearchParams(window.location.search);
const filePath = urlParams.get('file');
const theme = urlParams.get('theme') || 'dark';
const customCSS = urlParams.get('customCSS') ? atob(urlParams.get('customCSS')) : '';
const previewFrame = document.getElementById('previewFrame');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');

const channel = new BroadcastChannel('preview-sync');

// Load theme from localStorage if available, otherwise use URL params
function getTheme() {
  try {
    const saved = localStorage.getItem('previewSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      return {
        theme: settings.pageTheme || theme,
        customCSS: settings.customThemeCSS || customCSS
      };
    }
  } catch (e) {
    console.error('Error loading theme from localStorage:', e);
  }
  return { theme, customCSS };
}

function updatePreview() {
  const pathToUse = currentFilePath || filePath;
  if (!pathToUse) return;
  
  const themeInfo = getTheme();
  const ext = pathToUse.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];
  
  if (imageExts.includes(ext)) {
    previewFrame.style.display = 'none';
    imagePreview.style.display = 'flex';
    previewImage.src = `/${pathToUse}`;
  } else {
    imagePreview.style.display = 'none';
    previewFrame.style.display = 'block';
    let previewUrl = `/__preview-content__?file=${encodeURIComponent(pathToUse)}&theme=${encodeURIComponent(themeInfo.theme)}`;
    if (themeInfo.theme === 'custom' && themeInfo.customCSS) {
      previewUrl += `&customCSS=${encodeURIComponent(btoa(themeInfo.customCSS))}`;
    }
    previewUrl += `&t=${Date.now()}`;
    previewFrame.src = previewUrl;
  }
}

let currentContent = null;

let currentFilePath = filePath;

       channel.addEventListener('message', (event) => {
         if (event.data.type === 'theme-changed') {
           // Update theme when it changes in the main window
           const themeInfo = {
             theme: event.data.theme || 'dark',
             customCSS: event.data.customCSS || ''
           };
           
           try {
             const saved = localStorage.getItem('previewSettings');
             const settings = saved ? JSON.parse(saved) : {};
             settings.pageTheme = themeInfo.theme;
             if (themeInfo.customCSS) {
               settings.customThemeCSS = themeInfo.customCSS;
             }
             localStorage.setItem('previewSettings', JSON.stringify(settings));
             
             // Update theme style element
             const themeStyle = document.getElementById('theme-style');
             if (themeStyle) {
               if (themeInfo.theme === 'custom' && themeInfo.customCSS) {
                 themeStyle.textContent = themeInfo.customCSS;
               } else {
                 fetch(`/__api__/theme?name=${encodeURIComponent(themeInfo.theme)}`)
                   .then(res => res.text())
                   .then(css => {
                     if (themeStyle) themeStyle.textContent = css;
                   })
                   .catch(err => console.error('Error loading theme:', err));
               }
             }
           } catch (e) {
             console.error('Error updating theme:', e);
           }
         } else if (event.data.type === 'file-changed') {
           currentFilePath = event.data.filePath;
    
    // Update theme if provided
    if (event.data.theme) {
      try {
        const saved = localStorage.getItem('previewSettings');
        const settings = saved ? JSON.parse(saved) : {};
        settings.pageTheme = event.data.theme;
        if (event.data.customCSS) {
          settings.customThemeCSS = event.data.customCSS;
        }
        localStorage.setItem('previewSettings', JSON.stringify(settings));
        
        // Update theme style element
        const themeStyle = document.getElementById('theme-style');
        if (themeStyle) {
          if (event.data.theme === 'custom' && event.data.customCSS) {
            themeStyle.textContent = event.data.customCSS;
          } else {
            fetch(`/__api__/theme?name=${encodeURIComponent(event.data.theme)}`)
              .then(res => res.text())
              .then(css => {
                if (themeStyle) themeStyle.textContent = css;
              })
              .catch(err => console.error('Error loading theme:', err));
          }
        }
      } catch (e) {
        console.error('Error updating theme:', e);
      }
    }
    
    const themeInfo = getTheme();
    let newUrl = `/__popout__/preview?file=${encodeURIComponent(currentFilePath)}&theme=${encodeURIComponent(themeInfo.theme)}`;
    if (themeInfo.theme === 'custom' && themeInfo.customCSS) {
      newUrl += `&customCSS=${encodeURIComponent(btoa(themeInfo.customCSS))}`;
    }
    window.history.pushState({ file: currentFilePath }, '', newUrl);
    updatePreview();
  } else if (event.data.type === 'preview-update') {
    if (previewFrame.style.display !== 'none') {
      const themeInfo = getTheme();
      let previewUrl = `/__preview-content__?file=${encodeURIComponent(currentFilePath)}&theme=${encodeURIComponent(themeInfo.theme)}`;
      if (themeInfo.theme === 'custom' && themeInfo.customCSS) {
        previewUrl += `&customCSS=${encodeURIComponent(btoa(themeInfo.customCSS))}`;
      }
      previewUrl += `&t=${Date.now()}`;
      previewFrame.src = previewUrl;
    }
  } else if (event.data.type === 'preview-refresh') {
    if (previewFrame.style.display !== 'none') {
      const themeInfo = getTheme();
      let previewUrl = `/__preview-content__?file=${encodeURIComponent(currentFilePath)}&theme=${encodeURIComponent(themeInfo.theme)}`;
      if (themeInfo.theme === 'custom' && themeInfo.customCSS) {
        previewUrl += `&customCSS=${encodeURIComponent(btoa(themeInfo.customCSS))}`;
      }
      previewUrl += `&t=${Date.now()}`;
      previewFrame.src = previewUrl;
    }
  } else if (event.data.type === 'preview-content') {
    currentContent = event.data.content;
    if (previewFrame.style.display !== 'none' && currentContent) {
      const themeInfo = getTheme();
      fetch('/__preview-content__?file=' + encodeURIComponent(currentFilePath), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: currentContent
      })
      .then(() => {
        let previewUrl = `/__preview-content__?file=${encodeURIComponent(currentFilePath)}&theme=${encodeURIComponent(themeInfo.theme)}`;
        if (themeInfo.theme === 'custom' && themeInfo.customCSS) {
          previewUrl += `&customCSS=${encodeURIComponent(btoa(themeInfo.customCSS))}`;
        }
        previewUrl += `&t=${Date.now()}`;
        previewFrame.src = previewUrl;
      })
      .catch(err => {
        console.error('Error updating preview content:', err);
      });
    }
  }
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  updatePreview();
  channel.postMessage({ type: 'preview-refresh-request' });
});

document.getElementById('closePopout').addEventListener('click', () => {
  window.close();
});

window.addEventListener('beforeunload', () => {
  channel.postMessage({
    type: 'popout-closed',
    popoutType: 'preview'
  });
});

// Load theme on initial page load
async function loadThemeOnInit() {
  const themeStyle = document.getElementById('theme-style');
  if (!themeStyle) {
    console.error('theme-style element not found');
    return;
  }
  
  const themeInfo = getTheme();
  console.log('Loading theme on init:', themeInfo.theme);
  
  try {
    if (themeInfo.theme === 'custom' && themeInfo.customCSS) {
      themeStyle.textContent = themeInfo.customCSS;
      console.log('Applied custom theme CSS');
    } else {
      const response = await fetch(`/__api__/theme?name=${encodeURIComponent(themeInfo.theme)}`);
      if (response.ok) {
        const themeCss = await response.text();
        themeStyle.textContent = themeCss;
        console.log('Applied theme CSS:', themeInfo.theme, 'length:', themeCss.length);
      } else {
        console.error('Failed to load theme:', response.status, response.statusText);
      }
    }
  } catch (error) {
    console.error('Error loading theme on init:', error);
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadThemeOnInit();
    updatePreview();
  });
} else {
  loadThemeOnInit();
  updatePreview();
}
