window.PreviewInspectorManager = (function() {
  let inspectorPanel = null;
  let componentsTree = null;
  let selectedElement = null;
  let currentFrame = null;
  let isInspecting = false;
  let isFocusMode = false;
  let hoveredElement = null;

  function buildComponentTree(element, parentNode, depth = 0, parentId = null) {
    if (!element || element.nodeType !== 1) return null; // Only process element nodes
    
    const item = document.createElement('div');
    item.className = 'inspector-component-item';
    item.style.paddingLeft = `${15 + depth * 15}px`;
    item.dataset.elementPath = getElementPath(element);
    item.dataset.depth = depth;
    
    const hasChildren = element.children.length > 0;
    const itemId = element.tagName + depth + Math.random().toString(36).substr(2, 9);
    item.dataset.itemId = itemId; // Store itemId for expansion
    
    if (parentId) {
      item.dataset.parentId = parentId;
    }
    
    const caret = document.createElement('span');
    caret.className = 'inspector-component-caret';
    if (hasChildren) {
      caret.textContent = '▶';
      caret.style.cursor = 'pointer';
      caret.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = caret.classList.toggle('expanded');
        caret.textContent = expanded ? '▼' : '▶';
        const children = parentNode.querySelectorAll(`[data-parent-id="${itemId}"]`);
        children.forEach(child => {
          child.style.display = expanded ? 'block' : 'none';
        });
      });
    } else {
      caret.textContent = ' ';
    }
    
    const name = document.createElement('span');
    name.className = 'inspector-component-name';
    name.textContent = element.tagName.toLowerCase();
    
    const classSpan = document.createElement('span');
    classSpan.className = 'inspector-component-class';
    if (element.className && typeof element.className === 'string' && element.className.trim()) {
      classSpan.textContent = '.' + element.className.split(' ').join('.');
    }
    
    item.appendChild(caret);
    item.appendChild(name);
    if (classSpan.textContent) {
      item.appendChild(classSpan);
    }
    
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      selectElement(element);
    });
    
    parentNode.appendChild(item);
    
    if (hasChildren) {
      Array.from(element.children).forEach(child => {
        const childItem = buildComponentTree(child, parentNode, depth + 1, itemId);
        if (childItem) {
          childItem.style.display = 'none'; // Start collapsed
        }
      });
    }
    
    return item;
  }

  function getElementPath(element) {
    const path = [];
    let current = element;
    while (current && current !== current.ownerDocument.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += '#' + current.id;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += '.' + classes[0];
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  function expandToElement(element) {
    if (!element || !componentsTree) return;
    
    const path = getElementPath(element);
    const item = componentsTree.querySelector(`[data-element-path="${path}"]`);
    
    if (!item) return;
    
    // Collect all parent items by traversing up the DOM
    const parents = [];
    let current = item;
    while (current && current !== componentsTree) {
      current = current.parentElement;
      if (current && current.classList.contains('inspector-component-item')) {
        parents.unshift(current);
      }
    }
    
    // Expand all parents from root to leaf
    parents.forEach(parentItem => {
      const caret = parentItem.querySelector('.inspector-component-caret');
      if (caret && caret.textContent === '▶') {
        // Expand this parent
        caret.classList.add('expanded');
        caret.textContent = '▼';
        
        // Use the parent's itemId to find and show all its children
        const parentItemId = parentItem.dataset.itemId;
        if (parentItemId) {
          const children = componentsTree.querySelectorAll(`[data-parent-id="${parentItemId}"]`);
          children.forEach(child => {
            child.style.display = 'block';
          });
        }
      }
    });
  }

  function selectElement(element) {
    if (!element || !currentFrame) return;
    
    // Remove previous selection
    if (selectedElement) {
      try {
        selectedElement.style.outline = '';
      } catch (e) {
        // Cross-origin
      }
    }
    
    // Update selected item in tree
    const items = componentsTree.querySelectorAll('.inspector-component-item');
    items.forEach(item => item.classList.remove('selected'));
    
    const item = componentsTree.querySelector(`[data-element-path="${getElementPath(element)}"]`);
    if (item) {
      // Expand tree to show this element
      expandToElement(element);
      
      item.classList.add('selected');
      // Wait a bit for expansion to complete, then scroll
      setTimeout(() => {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
    
    selectedElement = element;
    
    // Highlight element in frame
    try {
      element.style.outline = '2px solid #4a9eff';
      element.style.outlineOffset = '2px';
    } catch (e) {
      // Cross-origin restrictions
    }
    
    updatePropertyPanel(element);
  }

  function parseValue(value) {
    if (!value || value === 'auto' || value === 'normal' || value === 'none') return '';
    const match = value.match(/^([\d.]+)(px|%|em|rem)?$/);
    return match ? match[1] : '';
  }

  function parseUnit(value) {
    if (!value || value === 'auto' || value === 'normal' || value === 'none') return 'px';
    const match = value.match(/^[\d.]+(px|%|em|rem)$/);
    return match ? match[1] : 'px';
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return '#' + r + g + b;
    }
    if (rgb.startsWith('#')) return rgb;
    return '#000000';
  }

  function updatePropertyPanel(element) {
    if (!element) return;
    
    try {
      const computed = currentFrame.contentWindow.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      // Update position
      const posX = document.getElementById('inspectorPosX');
      const posY = document.getElementById('inspectorPosY');
      const posZ = document.getElementById('inspectorPosZ');
      const angle = document.getElementById('inspectorAngle');
      
      if (posX) posX.value = Math.round(rect.left);
      if (posY) posY.value = Math.round(rect.top);
      if (posZ) posZ.value = parseInt(computed.zIndex) || 0;
      
      // Extract transform angle if present
      const transform = computed.transform;
      if (transform && transform !== 'none') {
        const matrix = new DOMMatrix(transform);
        const angleRad = Math.atan2(matrix.b, matrix.a);
        const angleDeg = (angleRad * 180) / Math.PI;
        if (angle) angle.value = Math.round(angleDeg);
      } else if (angle) {
        angle.value = 0;
      }
      
      // Update dimensions
      const width = document.getElementById('inspectorWidth');
      const height = document.getElementById('inspectorHeight');
      const widthUnit = document.getElementById('inspectorWidthUnit');
      const heightUnit = document.getElementById('inspectorHeightUnit');
      
      if (width) {
        const widthVal = parseValue(computed.width);
        width.value = widthVal || Math.round(rect.width);
      }
      if (widthUnit) {
        const unit = parseUnit(computed.width);
        widthUnit.value = unit;
      }
      if (height) {
        const heightVal = parseValue(computed.height);
        height.value = heightVal || Math.round(rect.height);
      }
      if (heightUnit) {
        const unit = parseUnit(computed.height);
        heightUnit.value = unit;
      }
      
      // Update padding
      const paddingH = document.getElementById('inspectorPaddingH');
      const paddingV = document.getElementById('inspectorPaddingV');
      if (paddingH) paddingH.value = parseValue(computed.paddingLeft) || parseValue(computed.paddingRight) || 0;
      if (paddingV) paddingV.value = parseValue(computed.paddingTop) || parseValue(computed.paddingBottom) || 0;
      
      // Update margin
      const marginH = document.getElementById('inspectorMarginH');
      const marginV = document.getElementById('inspectorMarginV');
      if (marginH) marginH.value = parseValue(computed.marginLeft) || parseValue(computed.marginRight) || 0;
      if (marginV) marginV.value = parseValue(computed.marginTop) || parseValue(computed.marginBottom) || 0;
      
      // Update border box
      const borderBox = document.getElementById('inspectorBorderBox');
      if (borderBox) borderBox.checked = computed.boxSizing === 'border-box';
      
      // Update clip content
      const clipContent = document.getElementById('inspectorClipContent');
      if (clipContent) clipContent.checked = computed.overflow === 'hidden' || computed.overflow === 'clip';
      
      // Update opacity
      const opacity = document.getElementById('inspectorOpacity');
      if (opacity) opacity.value = Math.round(parseFloat(computed.opacity) * 100);
      
      // Update corner radius
      const cornerRadius = document.getElementById('inspectorCornerRadius');
      if (cornerRadius) cornerRadius.value = parseValue(computed.borderRadius) || 0;
      
      // Update text properties
      const fontFamily = document.getElementById('inspectorFontFamily');
      const fontWeight = document.getElementById('inspectorFontWeight');
      const fontSize = document.getElementById('inspectorFontSize');
      if (fontFamily) fontFamily.value = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      if (fontWeight) fontWeight.value = computed.fontWeight;
      if (fontSize) fontSize.value = parseValue(computed.fontSize) || 16;
      
      // Update color
      const colorHex = document.getElementById('inspectorColorHex');
      const colorPicker = document.getElementById('inspectorColorPicker');
      const colorOpacity = document.getElementById('inspectorColorOpacity');
      const color = rgbToHex(computed.color);
      if (colorHex) colorHex.value = color;
      if (colorPicker) colorPicker.value = color;
      if (colorOpacity) {
        const colorMatch = computed.color.match(/rgba?\([\d\s,]+,\s*([\d.]+)\)/);
        if (colorMatch) colorOpacity.value = Math.round(parseFloat(colorMatch[1]) * 100);
        else colorOpacity.value = 100;
      }
      
      // Update line height and letter spacing
      const lineHeight = document.getElementById('inspectorLineHeight');
      const letterSpacing = document.getElementById('inspectorLetterSpacing');
      if (lineHeight) lineHeight.value = computed.lineHeight === 'normal' ? 'normal' : computed.lineHeight;
      if (letterSpacing) letterSpacing.value = computed.letterSpacing === 'normal' ? 'normal' : parseValue(computed.letterSpacing) || 'normal';
      
      // Update alignment
      const alignment = computed.textAlign || computed.justifyContent || 'left';
      const alignmentButtons = document.querySelectorAll('.inspector-alignment-btn');
      alignmentButtons.forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.querySelector(`[data-align="${alignment}"]`);
      if (activeBtn) activeBtn.classList.add('active');
      
      // Update background
      const bgHex = document.getElementById('inspectorBackgroundHex');
      const bgPicker = document.getElementById('inspectorBackgroundColor');
      const bgOpacity = document.getElementById('inspectorBackgroundOpacity');
      const bgColor = rgbToHex(computed.backgroundColor);
      if (bgHex) bgHex.value = bgColor;
      if (bgPicker) bgPicker.value = bgColor;
      if (bgOpacity) {
        const bgMatch = computed.backgroundColor.match(/rgba?\([\d\s,]+,\s*([\d.]+)\)/);
        if (bgMatch) bgOpacity.value = Math.round(parseFloat(bgMatch[1]) * 100);
        else bgOpacity.value = 100;
      }
      
      // Update border
      const borderWidth = document.getElementById('inspectorBorderWidth');
      const borderStyle = document.getElementById('inspectorBorderStyle');
      const borderHex = document.getElementById('inspectorBorderHex');
      const borderPicker = document.getElementById('inspectorBorderColor');
      if (borderWidth) borderWidth.value = parseValue(computed.borderWidth) || 0;
      if (borderStyle) borderStyle.value = computed.borderStyle || 'none';
      const borderColor = rgbToHex(computed.borderColor);
      if (borderHex) borderHex.value = borderColor;
      if (borderPicker) borderPicker.value = borderColor;
      
      // Update shadow
      const shadow = computed.boxShadow;
      if (shadow && shadow !== 'none') {
        const shadowMatch = shadow.match(/([\d.-]+)px\s+([\d.-]+)px\s+([\d.-]+)px\s+([\d.-]+)?px?\s*(rgba?\([^)]+\)|#[0-9a-fA-F]+)?/);
        if (shadowMatch) {
          const shadowX = document.getElementById('inspectorShadowX');
          const shadowY = document.getElementById('inspectorShadowY');
          const shadowBlur = document.getElementById('inspectorShadowBlur');
          const shadowSpread = document.getElementById('inspectorShadowSpread');
          const shadowColor = document.getElementById('inspectorShadowColor');
          const shadowOpacity = document.getElementById('inspectorShadowOpacity');
          if (shadowX) shadowX.value = Math.round(parseFloat(shadowMatch[1]));
          if (shadowY) shadowY.value = Math.round(parseFloat(shadowMatch[2]));
          if (shadowBlur) shadowBlur.value = Math.round(parseFloat(shadowMatch[3]));
          if (shadowSpread) shadowSpread.value = shadowMatch[4] ? Math.round(parseFloat(shadowMatch[4])) : 0;
          if (shadowMatch[5]) {
            const sColor = rgbToHex(shadowMatch[5]);
            if (shadowColor) shadowColor.value = sColor;
            if (shadowOpacity) {
              const sMatch = shadowMatch[5].match(/rgba?\([\d\s,]+,\s*([\d.]+)\)/);
              if (sMatch) shadowOpacity.value = Math.round(parseFloat(sMatch[1]) * 100);
            }
          }
        }
      }
      
      // Update flow buttons
      const display = computed.display;
      const flexDirection = computed.flexDirection;
      const flowButtons = document.querySelectorAll('.inspector-flow-btn');
      flowButtons.forEach(btn => btn.classList.remove('active'));
      
      if (display === 'flex') {
        if (flexDirection === 'column') {
          const colBtn = document.querySelector('[data-flow="column"]');
          if (colBtn) colBtn.classList.add('active');
        } else {
          const rowBtn = document.querySelector('[data-flow="row"]');
          if (rowBtn) rowBtn.classList.add('active');
        }
      } else if (display === 'grid') {
        const gridBtn = document.querySelector('[data-flow="grid"]');
        if (gridBtn) gridBtn.classList.add('active');
      } else {
        const blockBtn = document.querySelector('[data-flow="block"]');
        if (blockBtn) blockBtn.classList.add('active');
      }
      
      // Update CSS tabs with computed styles
      console.log('[Inspector] Calling updateCSSTab from updatePropertyPanel');
      updateCSSTab(element, computed);
      
    } catch (e) {
      console.error('Cannot access element properties:', e);
    }
  }

  function updateCSSTab(element, computed) {
    console.log('[Inspector] updateCSSTab called', { element, computed, hasComputed: !!computed });
    
    try {
      // Update computed styles in the format: property name on one line, value on next line
      const cssTextarea = document.getElementById('inspectorCSSTextarea');
      console.log('[Inspector] CSS textarea element:', cssTextarea);
      
      if (!cssTextarea) {
        console.error('[Inspector] CSS textarea not found!');
        return;
      }
      
      if (!computed) {
        console.error('[Inspector] No computed styles object provided');
        cssTextarea.value = '/* No computed styles object */';
        return;
      }
      
      console.log('[Inspector] Computed styles length:', computed.length);
      const styles = [];
      
      // Get all CSS properties from the computed style object
      // CSSStyleDeclaration has a length property and indexed properties
      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        let value;
        
        // Try getPropertyValue first, fallback to direct access
        try {
          value = computed.getPropertyValue(prop);
          if (!value || value === '') {
            value = computed[prop];
          }
        } catch (e) {
          console.warn('[Inspector] Error getting property value for', prop, e);
          value = computed[prop];
        }
        
        // Include all properties with their values
        if (prop && value !== undefined && value !== null && value !== '') {
          styles.push(prop);
          styles.push(value);
        }
      }
      
      console.log('[Inspector] Total styles collected:', styles.length);
      // Format: property name on one line, value on next line (alternating)
      let cssContent = '';
      for (let i = 0; i < styles.length; i += 2) {
        if (i + 1 < styles.length) {
          cssContent += styles[i] + '\n' + styles[i + 1] + '\n';
        }
      }
      cssContent = cssContent || '/* No computed styles available */';
      cssTextarea.value = cssContent;
      console.log('[Inspector] CSS textarea value set, length:', cssTextarea.value.length);
      
      // Check if CSS tab is active
      const cssTabContent = document.getElementById('inspectorCSS');
      const isCSSTabActive = cssTabContent && cssTabContent.classList.contains('active');
      console.log('[Inspector] CSS tab content element:', cssTabContent, 'is active:', isCSSTabActive);
      console.log('[Inspector] CSS textarea visible:', cssTextarea.offsetParent !== null, 'display:', window.getComputedStyle(cssTextarea).display);
      console.log('[Inspector] CSS tab content visible:', cssTabContent?.offsetParent !== null, 'display:', cssTabContent ? window.getComputedStyle(cssTabContent).display : 'N/A');
      
      // If CSS tab is not active but we're setting values, ensure they persist
      if (!isCSSTabActive) {
        console.log('[Inspector] CSS tab not active, but values are set and will show when tab is clicked');
      }
      
      console.log('[Inspector] First 200 chars of CSS:', cssContent.substring(0, 200));
      
      // Update inline styles
      const cssInline = document.getElementById('inspectorCSSInline');
      console.log('[Inspector] CSS inline textarea element:', cssInline);
      
      if (cssInline && element) {
        try {
          cssInline.value = element.style.cssText || '/* No inline styles */';
          console.log('[Inspector] Inline styles set, length:', cssInline.value.length);
        } catch (e) {
          console.error('[Inspector] Error setting inline styles:', e);
          cssInline.value = '/* Cannot access inline styles */';
        }
      }
    } catch (e) {
      console.error('[Inspector] Cannot update CSS tab:', e);
      console.error('[Inspector] Error stack:', e.stack);
      const cssTextarea = document.getElementById('inspectorCSSTextarea');
      if (cssTextarea) {
        cssTextarea.value = `/* Error loading CSS: ${e.message} */`;
      }
    }
  }

  function attachPropertyListeners() {
    // Position inputs
    const posX = document.getElementById('inspectorPosX');
    const posY = document.getElementById('inspectorPosY');
    const posZ = document.getElementById('inspectorPosZ');
    const angle = document.getElementById('inspectorAngle');
    
    [posX, posY, posZ, angle].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          if (selectedElement) {
            try {
              if (input === posX) {
                selectedElement.style.left = input.value + 'px';
                selectedElement.style.position = 'absolute';
              } else if (input === posY) {
                selectedElement.style.top = input.value + 'px';
                selectedElement.style.position = 'absolute';
              } else if (input === posZ) {
                selectedElement.style.zIndex = input.value;
              } else if (input === angle) {
                const transform = `rotate(${input.value}deg)`;
                selectedElement.style.transform = transform;
              }
            } catch (e) {
              console.error('Cannot modify element:', e);
            }
          }
        });
      }
    });
    
    // Dimension inputs
    const width = document.getElementById('inspectorWidth');
    const height = document.getElementById('inspectorHeight');
    
    [width, height].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          if (selectedElement) {
            try {
              if (input === width) {
                selectedElement.style.width = input.value ? input.value + 'px' : 'auto';
              } else if (input === height) {
                selectedElement.style.height = input.value ? input.value + 'px' : 'auto';
              }
            } catch (e) {
              console.error('Cannot modify element:', e);
            }
          }
        });
      }
    });
    
    // Flow buttons
    const flowButtons = document.querySelectorAll('.inspector-flow-btn');
    flowButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (selectedElement) {
          try {
            const flow = btn.dataset.flow;
            flowButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (flow === 'row') {
              selectedElement.style.display = 'flex';
              selectedElement.style.flexDirection = 'row';
            } else if (flow === 'column') {
              selectedElement.style.display = 'flex';
              selectedElement.style.flexDirection = 'column';
            } else if (flow === 'grid') {
              selectedElement.style.display = 'grid';
            } else if (flow === 'block') {
              selectedElement.style.display = 'block';
            }
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    });
    
    // Padding inputs
    const paddingH = document.getElementById('inspectorPaddingH');
    const paddingV = document.getElementById('inspectorPaddingV');
    [paddingH, paddingV].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          if (selectedElement) {
            try {
              if (input === paddingH) {
                selectedElement.style.paddingLeft = input.value + 'px';
                selectedElement.style.paddingRight = input.value + 'px';
              } else {
                selectedElement.style.paddingTop = input.value + 'px';
                selectedElement.style.paddingBottom = input.value + 'px';
              }
            } catch (e) {
              console.error('Cannot modify element:', e);
            }
          }
        });
      }
    });
    
    // Margin inputs
    const marginH = document.getElementById('inspectorMarginH');
    const marginV = document.getElementById('inspectorMarginV');
    [marginH, marginV].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          if (selectedElement) {
            try {
              if (input === marginH) {
                selectedElement.style.marginLeft = input.value + 'px';
                selectedElement.style.marginRight = input.value + 'px';
              } else {
                selectedElement.style.marginTop = input.value + 'px';
                selectedElement.style.marginBottom = input.value + 'px';
              }
            } catch (e) {
              console.error('Cannot modify element:', e);
            }
          }
        });
      }
    });
    
    // Border box checkbox
    const borderBox = document.getElementById('inspectorBorderBox');
    if (borderBox) {
      borderBox.addEventListener('change', () => {
        if (selectedElement) {
          try {
            selectedElement.style.boxSizing = borderBox.checked ? 'border-box' : 'content-box';
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    }
    
    // Clip content checkbox
    const clipContent = document.getElementById('inspectorClipContent');
    if (clipContent) {
      clipContent.addEventListener('change', () => {
        if (selectedElement) {
          try {
            selectedElement.style.overflow = clipContent.checked ? 'hidden' : 'visible';
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    }
    
    // Opacity
    const opacity = document.getElementById('inspectorOpacity');
    if (opacity) {
      opacity.addEventListener('input', () => {
        if (selectedElement) {
          try {
            selectedElement.style.opacity = (opacity.value / 100).toString();
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    }
    
    // Corner radius
    const cornerRadius = document.getElementById('inspectorCornerRadius');
    if (cornerRadius) {
      cornerRadius.addEventListener('input', () => {
        if (selectedElement) {
          try {
            selectedElement.style.borderRadius = cornerRadius.value + 'px';
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    }
    
    // Text properties
    const fontFamily = document.getElementById('inspectorFontFamily');
    const fontWeight = document.getElementById('inspectorFontWeight');
    const fontSize = document.getElementById('inspectorFontSize');
    
    if (fontFamily) {
      fontFamily.addEventListener('change', () => {
        if (selectedElement) {
          try {
            selectedElement.style.fontFamily = fontFamily.value;
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    }
    
    if (fontWeight) {
      fontWeight.addEventListener('change', () => {
        if (selectedElement) {
          try {
            selectedElement.style.fontWeight = fontWeight.value;
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    }
    
    if (fontSize) {
      fontSize.addEventListener('input', () => {
        if (selectedElement) {
          try {
            selectedElement.style.fontSize = fontSize.value + 'px';
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    }
    
    // Color
    const colorHex = document.getElementById('inspectorColorHex');
    const colorPicker = document.getElementById('inspectorColorPicker');
    const colorOpacity = document.getElementById('inspectorColorOpacity');
    
    function updateColor() {
      if (selectedElement) {
        try {
          const hex = colorHex ? colorHex.value : '#000000';
          const opacity = colorOpacity ? (colorOpacity.value / 100) : 1;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          selectedElement.style.color = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } catch (e) {
          console.error('Cannot modify element:', e);
        }
      }
    }
    
    if (colorHex) colorHex.addEventListener('input', updateColor);
    if (colorPicker) {
      colorPicker.addEventListener('input', () => {
        if (colorHex) colorHex.value = colorPicker.value;
        updateColor();
      });
    }
    if (colorOpacity) colorOpacity.addEventListener('input', updateColor);
    
    // Line height and letter spacing
    const lineHeight = document.getElementById('inspectorLineHeight');
    const letterSpacing = document.getElementById('inspectorLetterSpacing');
    
    if (lineHeight) {
      lineHeight.addEventListener('input', () => {
        if (selectedElement) {
          try {
            selectedElement.style.lineHeight = lineHeight.value === 'normal' ? 'normal' : lineHeight.value;
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    }
    
    if (letterSpacing) {
      letterSpacing.addEventListener('input', () => {
        if (selectedElement) {
          try {
            selectedElement.style.letterSpacing = letterSpacing.value === 'normal' ? 'normal' : letterSpacing.value + 'px';
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    }
    
    // Alignment buttons
    const alignmentButtons = document.querySelectorAll('.inspector-alignment-btn');
    alignmentButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (selectedElement) {
          try {
            alignmentButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const align = btn.dataset.align;
            if (['left', 'center', 'right', 'justify'].includes(align)) {
              selectedElement.style.textAlign = align;
            } else {
              selectedElement.style.justifyContent = align;
            }
          } catch (e) {
            console.error('Cannot modify element:', e);
          }
        }
      });
    });
    
    // Background
    const bgHex = document.getElementById('inspectorBackgroundHex');
    const bgPicker = document.getElementById('inspectorBackgroundColor');
    const bgOpacity = document.getElementById('inspectorBackgroundOpacity');
    
    function updateBackground() {
      if (selectedElement) {
        try {
          const hex = bgHex ? bgHex.value : '#000000';
          const opacity = bgOpacity ? (bgOpacity.value / 100) : 1;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          selectedElement.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } catch (e) {
          console.error('Cannot modify element:', e);
        }
      }
    }
    
    if (bgHex) bgHex.addEventListener('input', updateBackground);
    if (bgPicker) {
      bgPicker.addEventListener('input', () => {
        if (bgHex) bgHex.value = bgPicker.value;
        updateBackground();
      });
    }
    if (bgOpacity) bgOpacity.addEventListener('input', updateBackground);
    
    // Border
    const borderWidth = document.getElementById('inspectorBorderWidth');
    const borderStyle = document.getElementById('inspectorBorderStyle');
    const borderHex = document.getElementById('inspectorBorderHex');
    const borderPicker = document.getElementById('inspectorBorderColor');
    
    function updateBorder() {
      if (selectedElement) {
        try {
          const width = borderWidth ? borderWidth.value + 'px' : '0px';
          const style = borderStyle ? borderStyle.value : 'solid';
          const hex = borderHex ? borderHex.value : '#000000';
          selectedElement.style.border = `${width} ${style} ${hex}`;
        } catch (e) {
          console.error('Cannot modify element:', e);
        }
      }
    }
    
    if (borderWidth) borderWidth.addEventListener('input', updateBorder);
    if (borderStyle) borderStyle.addEventListener('change', updateBorder);
    if (borderHex) borderHex.addEventListener('input', updateBorder);
    if (borderPicker) {
      borderPicker.addEventListener('input', () => {
        if (borderHex) borderHex.value = borderPicker.value;
        updateBorder();
      });
    }
    
    // Shadow
    const shadowX = document.getElementById('inspectorShadowX');
    const shadowY = document.getElementById('inspectorShadowY');
    const shadowBlur = document.getElementById('inspectorShadowBlur');
    const shadowSpread = document.getElementById('inspectorShadowSpread');
    const shadowColor = document.getElementById('inspectorShadowColor');
    const shadowOpacity = document.getElementById('inspectorShadowOpacity');
    
    function updateShadow() {
      if (selectedElement) {
        try {
          const x = shadowX ? shadowX.value : 0;
          const y = shadowY ? shadowY.value : 0;
          const blur = shadowBlur ? shadowBlur.value : 0;
          const spread = shadowSpread ? shadowSpread.value : 0;
          const hex = shadowColor ? shadowColor.value : '#000000';
          const opacity = shadowOpacity ? (shadowOpacity.value / 100) : 1;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          selectedElement.style.boxShadow = `${x}px ${y}px ${blur}px ${spread}px rgba(${r}, ${g}, ${b}, ${opacity})`;
        } catch (e) {
          console.error('Cannot modify element:', e);
        }
      }
    }
    
    [shadowX, shadowY, shadowBlur, shadowSpread, shadowOpacity].forEach(input => {
      if (input) input.addEventListener('input', updateShadow);
    });
    if (shadowColor) {
      shadowColor.addEventListener('input', () => {
        updateShadow();
      });
    }
    
    // Width/Height unit selectors
    const widthUnit = document.getElementById('inspectorWidthUnit');
    const heightUnit = document.getElementById('inspectorHeightUnit');
    
    [widthUnit, heightUnit].forEach(select => {
      if (select) {
        select.addEventListener('change', () => {
          if (selectedElement) {
            try {
              const width = document.getElementById('inspectorWidth');
              const height = document.getElementById('inspectorHeight');
              if (select === widthUnit && width && width.value) {
                selectedElement.style.width = width.value + select.value;
              }
              if (select === heightUnit && height && height.value) {
                selectedElement.style.height = height.value + select.value;
              }
            } catch (e) {
              console.error('Cannot modify element:', e);
            }
          }
        });
      }
    });
    
    // CSS textarea (inline styles)
    const cssInline = document.getElementById('inspectorCSSInline');
    if (cssInline) {
      cssInline.addEventListener('blur', () => {
        if (selectedElement) {
          try {
            selectedElement.style.cssText = cssInline.value;
            // Refresh computed styles
            if (currentFrame) {
              const computed = currentFrame.contentWindow.getComputedStyle(selectedElement);
              updateCSSTab(selectedElement, computed);
            }
          } catch (e) {
            console.error('Cannot apply CSS:', e);
          }
        }
      });
    }
    
    // CSS refresh button
    const cssRefresh = document.getElementById('inspectorCSSRefresh');
    if (cssRefresh) {
      cssRefresh.addEventListener('click', () => {
        if (selectedElement && currentFrame) {
          try {
            const computed = currentFrame.contentWindow.getComputedStyle(selectedElement);
            updateCSSTab(selectedElement, computed);
          } catch (e) {
            console.error('Cannot refresh CSS:', e);
          }
        }
      });
    }
  }

  function refreshTree() {
    if (!componentsTree || !currentFrame) return;
    
    componentsTree.innerHTML = '';
    
    try {
      const body = currentFrame.contentDocument.body;
      if (body) {
        buildComponentTree(body, componentsTree, 0);
      }
    } catch (e) {
      console.error('Cannot access frame content:', e);
      componentsTree.innerHTML = '<div style="padding: 15px; color: var(--text-secondary);">Cannot inspect this page (cross-origin restrictions)</div>';
    }
  }

  function setFrame(frame) {
    // Remove old event listeners
    if (currentFrame && currentFrame.contentDocument) {
      try {
        const oldDoc = currentFrame.contentDocument;
        oldDoc.removeEventListener('mouseover', handleFrameMouseOver);
        oldDoc.removeEventListener('mouseout', handleFrameMouseOut);
        oldDoc.removeEventListener('click', handleFrameClick, true);
      } catch (e) {
        // Cross-origin restrictions
      }
    }
    
    currentFrame = frame;
    selectedElement = null;
    hoveredElement = null;
    
    if (frame) {
      frame.addEventListener('load', () => {
        setTimeout(() => {
          refreshTree();
          setupFrameEventListeners();
        }, 100);
      });
      
      // Initial refresh
      setTimeout(() => {
        refreshTree();
        setupFrameEventListeners();
      }, 100);
    }
  }

  function setupFrameEventListeners() {
    if (!currentFrame || !currentFrame.contentDocument) return;
    
    try {
      const doc = currentFrame.contentDocument;
      
      // Remove existing listeners first
      doc.removeEventListener('mouseover', handleFrameMouseOver);
      doc.removeEventListener('mouseout', handleFrameMouseOut);
      doc.removeEventListener('click', handleFrameClick, true);
      
      if (isFocusMode) {
        doc.addEventListener('mouseover', handleFrameMouseOver);
        doc.addEventListener('mouseout', handleFrameMouseOut);
        doc.addEventListener('click', handleFrameClick, true);
      }
    } catch (e) {
      // Cross-origin restrictions
      console.warn('Cannot setup frame event listeners:', e);
    }
  }

  function handleFrameMouseOver(e) {
    if (!isFocusMode) return;
    if (!currentFrame) return;
    
    try {
      const element = e.target;
      if (element && element !== hoveredElement && element !== selectedElement) {
        // Remove previous highlight
        if (hoveredElement && hoveredElement !== selectedElement) {
          hoveredElement.style.outline = '';
        }
        
        // Add highlight
        element.style.outline = '2px solid #4a9eff';
        element.style.outlineOffset = '2px';
        hoveredElement = element;
      }
    } catch (e) {
      // Cross-origin restrictions
    }
  }

  function handleFrameMouseOut(e) {
    if (!isFocusMode) return;
    
    try {
      if (hoveredElement && hoveredElement !== selectedElement) {
        hoveredElement.style.outline = '';
      }
      hoveredElement = null;
    } catch (e) {
      // Cross-origin restrictions
    }
  }

  function handleFrameClick(e) {
    if (!isFocusMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const element = e.target;
      if (element) {
        selectElement(element);
        // Disable focus mode after selection
        setFocusMode(false);
        const focusBtn = document.getElementById('browserFocusBtn');
        if (focusBtn) {
          focusBtn.classList.remove('active');
        }
      }
    } catch (e) {
      console.error('Cannot select element:', e);
    }
  }

  function setFocusMode(enabled) {
    isFocusMode = enabled;
    setupFrameEventListeners();
    
    if (!enabled && hoveredElement && hoveredElement !== selectedElement) {
      try {
        hoveredElement.style.outline = '';
      } catch (e) {
        // Cross-origin
      }
      hoveredElement = null;
    }
  }

  function initialize(inspectorElement) {
    inspectorPanel = inspectorElement;
    if (!inspectorPanel) return;
    
    componentsTree = document.getElementById('inspectorComponentsTree');
    
    // Toggle button
    const toggleBtn = document.getElementById('toggleInspectorBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        inspectorPanel.classList.toggle('collapsed');
        toggleBtn.textContent = inspectorPanel.classList.contains('collapsed') ? '▶' : '◀';
      });
    }
    
    // Tab switching
    const tabs = inspectorPanel.querySelectorAll('.inspector-tab');
    const tabContents = inspectorPanel.querySelectorAll('.inspector-tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => {
          content.classList.remove('active');
          // Reset any inline display styles
          content.style.display = '';
        });
        
        tab.classList.add('active');
        // Handle CSS tab specially since HTML uses "CSS" not "Css"
        const contentId = tabName === 'css' ? 'inspectorCSS' : `inspector${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
        const content = document.getElementById(contentId);
        console.log('[Inspector] Tab switch - looking for content ID:', contentId, 'found:', content);
        
        if (content) {
          content.classList.add('active');
          console.log('[Inspector] Content element classes after activation:', content.className);
          
          // Always refresh CSS tab when switching to it
          if (tabName === 'css') {
            console.log('[Inspector] Switching to CSS tab');
            if (selectedElement && currentFrame) {
              console.log('[Inspector] Refreshing CSS styles for selected element');
              try {
                const computed = currentFrame.contentWindow.getComputedStyle(selectedElement);
                console.log('[Inspector] Got computed styles on tab switch, length:', computed?.length);
                updateCSSTab(selectedElement, computed);
              } catch (e) {
                console.error('[Inspector] Cannot refresh CSS on tab switch:', e);
                const cssTextarea = document.getElementById('inspectorCSSTextarea');
                if (cssTextarea) {
                  cssTextarea.value = `/* Error loading CSS: ${e.message} */`;
                }
              }
            } else {
              console.log('[Inspector] No element selected');
              const cssTextarea = document.getElementById('inspectorCSSTextarea');
              if (cssTextarea) {
                // Only set placeholder if textarea is empty
                if (!cssTextarea.value || cssTextarea.value.trim() === '' || cssTextarea.value.includes('Select an element')) {
                  cssTextarea.value = '/* Select an element to view computed styles */';
                }
              }
            }
          }
        } else {
          console.error('[Inspector] Content element not found for ID:', contentId);
        }
      });
    });
    
    attachPropertyListeners();
  }

  return {
    initialize,
    setFrame,
    refreshTree,
    selectElement,
    setFocusMode,
    getFocusMode: () => isFocusMode
  };
})();
