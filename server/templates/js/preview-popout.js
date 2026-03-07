const urlParams = new URLSearchParams(window.location.search);
const filePath = urlParams.get('file');
const previewFrame = document.getElementById('previewFrame');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');

const channel = new BroadcastChannel('preview-sync');

function updatePreview() {
  if (!filePath) return;
  
  const ext = filePath.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];
  
  if (imageExts.includes(ext)) {
    previewFrame.style.display = 'none';
    imagePreview.style.display = 'flex';
    previewImage.src = `/${filePath}`;
  } else {
    imagePreview.style.display = 'none';
    previewFrame.style.display = 'block';
    previewFrame.src = `/__preview-content__?file=${encodeURIComponent(filePath)}&t=${Date.now()}`;
  }
}

let currentContent = null;

channel.addEventListener('message', (event) => {
  if (event.data.type === 'preview-update') {
    if (previewFrame.style.display !== 'none') {
      previewFrame.src = `/__preview-content__?file=${encodeURIComponent(filePath)}&t=${Date.now()}`;
    }
  } else if (event.data.type === 'preview-refresh') {
    if (previewFrame.style.display !== 'none') {
      previewFrame.src = `/__preview-content__?file=${encodeURIComponent(filePath)}&t=${Date.now()}`;
    }
  } else if (event.data.type === 'preview-content') {
    currentContent = event.data.content;
    if (previewFrame.style.display !== 'none' && currentContent) {
      fetch('/__preview-content__?file=' + encodeURIComponent(filePath), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: currentContent
      })
      .then(() => {
        previewFrame.src = `/__preview-content__?file=${encodeURIComponent(filePath)}&t=${Date.now()}`;
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
