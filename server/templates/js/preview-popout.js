const urlParams = new URLSearchParams(window.location.search);
const filePath = urlParams.get('file');
const previewFrame = document.getElementById('previewFrame');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');

const channel = new BroadcastChannel('preview-sync');

function updatePreview() {
  const pathToUse = currentFilePath || filePath;
  if (!pathToUse) return;
  
  const ext = pathToUse.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];
  
  if (imageExts.includes(ext)) {
    previewFrame.style.display = 'none';
    imagePreview.style.display = 'flex';
    previewImage.src = `/${pathToUse}`;
  } else {
    imagePreview.style.display = 'none';
    previewFrame.style.display = 'block';
    previewFrame.src = `/__preview-content__?file=${encodeURIComponent(pathToUse)}&t=${Date.now()}`;
  }
}

let currentContent = null;

let currentFilePath = filePath;

channel.addEventListener('message', (event) => {
  if (event.data.type === 'file-changed') {
    currentFilePath = event.data.filePath;
    const newUrl = `/__popout__/preview?file=${encodeURIComponent(currentFilePath)}`;
    window.history.pushState({ file: currentFilePath }, '', newUrl);
    updatePreview();
  } else if (event.data.type === 'preview-update') {
    if (previewFrame.style.display !== 'none') {
      previewFrame.src = `/__preview-content__?file=${encodeURIComponent(currentFilePath)}&t=${Date.now()}`;
    }
  } else if (event.data.type === 'preview-refresh') {
    if (previewFrame.style.display !== 'none') {
      previewFrame.src = `/__preview-content__?file=${encodeURIComponent(currentFilePath)}&t=${Date.now()}`;
    }
  } else if (event.data.type === 'preview-content') {
    currentContent = event.data.content;
    if (previewFrame.style.display !== 'none' && currentContent) {
      fetch('/__preview-content__?file=' + encodeURIComponent(currentFilePath), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: currentContent
      })
      .then(() => {
        previewFrame.src = `/__preview-content__?file=${encodeURIComponent(currentFilePath)}&t=${Date.now()}`;
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

updatePreview();
