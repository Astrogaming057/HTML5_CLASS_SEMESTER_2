window.PreviewManager = (function() {
  let previewUpdateTimeout = null;

  return {
    updatePreview(content, previewFrame, getFilePath, previewSettings, syncChannel, interceptPreviewLinks, updatePreviewFallback) {
      if (!previewFrame) return;
      
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      
      syncChannel.postMessage({
        type: 'preview-update'
      });
      
      if (content) {
        syncChannel.postMessage({
          type: 'preview-content',
          content: content
        });
      }
      
      clearTimeout(previewUpdateTimeout);
      previewUpdateTimeout = setTimeout(() => {
        fetch('/__preview-content__?file=' + encodeURIComponent(filePath), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: content
        })
        .then(() => {
          let previewUrl = '/__preview-content__?file=' + encodeURIComponent(filePath) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
          if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
            previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
          }
          previewUrl += '&t=' + Date.now();
          previewFrame.src = previewUrl;
          
          previewFrame.onload = () => {
            interceptPreviewLinks();
          };
        })
        .catch(err => {
          console.error('Error updating preview:', err);
          updatePreviewFallback(content);
        });
      }, 300);
    },

    showImagePreview(imagePath, previewFrame, imagePreview, previewImage, previewTitle, backToPreviewBtn) {
      previewFrame.style.display = 'none';
      imagePreview.style.display = 'flex';
      
      const imageUrl = '/' + imagePath.replace(/^\/+/, '');
      previewImage.src = imageUrl;
      previewImage.onerror = () => {
        previewImage.alt = 'Error loading image';
      };
      
      previewTitle.textContent = 'Image: ' + imagePath.split('/').pop();
      backToPreviewBtn.style.display = 'block';
    },

    showHtmlPreview(imagePreview, previewFrame, previewTitle, backToPreviewBtn) {
      const previewPopout = PreviewPopouts.getPreviewPopout();
      const isPreviewPoppedOut = previewPopout && !previewPopout.closed;
      
      if (isPreviewPoppedOut) {
        return;
      }
      
      imagePreview.style.display = 'none';
      previewFrame.style.display = 'block';
      
      previewTitle.textContent = 'Preview';
      backToPreviewBtn.style.display = 'none';
    },

    refreshPreview(previewFrame, getFilePath, previewSettings, interceptPreviewLinks) {
      if (!previewFrame) return;
      
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      if (!filePath) return;
      
      // Check if it's an image file
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'];
      const isImage = imageExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
      
      if (isImage) {
        // For images, just ensure the preview frame is hidden and image preview is shown
        return;
      }
      
      let previewUrl = '/__preview-content__?file=' + encodeURIComponent(filePath) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
      if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
        previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
      }
      previewUrl += '&t=' + Date.now();
      
      previewFrame.src = previewUrl;
      
      previewFrame.onload = () => {
        if (interceptPreviewLinks) {
          interceptPreviewLinks();
        }
      };
    },

    interceptPreviewLinks(previewFrame, getFilePath, showImagePreview, switchToFile) {
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      
      try {
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        if (!iframeDoc) return;
        
        iframeDoc.addEventListener('click', (e) => {
          const img = e.target.closest('img[src]');
          if (img) {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
              e.preventDefault();
              e.stopPropagation();
              
              let imagePath = src;
              if (!src.startsWith('/')) {
                const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
                const basePath = fileDir ? fileDir + '/' : '';
                imagePath = basePath + src;
              }
              imagePath = imagePath.replace(/\/+/g, '/').replace(/^\/+/, '');
              
              const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'];
              const isImage = imageExtensions.some(ext => imagePath.toLowerCase().endsWith(ext));
              
              if (isImage) {
                showImagePreview(imagePath);
              }
            }
          }
        }, true);
        
        iframeDoc.addEventListener('click', (e) => {
          const link = e.target.closest('a[href]');
          if (!link) return;
          
          const href = link.getAttribute('href');
          if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
          }
          
          if (href.startsWith('http://') || href.startsWith('https://') || link.getAttribute('target') === '_blank') {
            return;
          }
          
          e.preventDefault();
          e.stopPropagation();
          
          let targetPath = href;
          if (!href.startsWith('/')) {
            const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
            const basePath = fileDir ? fileDir + '/' : '';
            targetPath = basePath + href;
          }
          
          targetPath = targetPath.replace(/\/+/g, '/').replace(/^\/+/, '');
          
          const editableExtensions = ['.html', '.htm', '.css', '.js', '.json', '.md', '.txt', '.xml', '.yaml', '.yml'];
          const isEditable = editableExtensions.some(ext => targetPath.toLowerCase().endsWith(ext));
          
          if (isEditable) {
            switchToFile(targetPath);
          } else {
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'];
            const isImage = imageExtensions.some(ext => targetPath.toLowerCase().endsWith(ext));
            
            if (isImage) {
              showImagePreview(targetPath);
            } else {
              const previewUrl = '/__preview-content__?file=' + encodeURIComponent(targetPath) + '&t=' + Date.now();
              previewFrame.src = previewUrl;
            }
          }
        }, true);
      } catch (err) {
        console.error('Error intercepting links:', err);
      }
    },

    async updatePreviewFallback(content, getFilePath, previewFrame, previewSettings) {
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
      const basePath = fileDir ? '/' + fileDir + '/' : '/';
      const baseUrl = window.location.origin + basePath;
      
      let themeStyles = '';
      try {
        const response = await fetch(`/__api__/theme?name=${encodeURIComponent(previewSettings.pageTheme)}`);
        if (response.ok) {
          const themeCss = await response.text();
          themeStyles = `<style id="theme-style">${themeCss}</style>`;
        }
      } catch (error) {
        console.error('Error loading theme for preview fallback:', error);
      }
      
      let modifiedContent = content;
      modifiedContent = modifiedContent.replace(/<base[^>]*>/gi, '');
      
      if (modifiedContent.match(/<head[^>]*>/i)) {
        modifiedContent = modifiedContent.replace(/<head[^>]*>/i, (match) => {
          return match + `\n<base href="${baseUrl}">${themeStyles}`;
        });
      } else if (modifiedContent.match(/<html[^>]*>/i)) {
        modifiedContent = modifiedContent.replace(/<html[^>]*>/i, (match) => {
          return match + `\n<head><base href="${baseUrl}">${themeStyles}</head>`;
        });
      } else if (modifiedContent.trim().length > 0) {
        modifiedContent = `<!DOCTYPE html><html><head><base href="${baseUrl}">${themeStyles}</head><body>${modifiedContent}</body></html>`;
      }
      
      previewFrame.srcdoc = modifiedContent;
    }
  };
})();
