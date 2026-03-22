/**
 * VS Code–style File / Edit menus in the preview title bar (dropdowns with shortcuts).
 */
window.PreviewFileMenu = (function () {
  function shortcutLabel(spec) {
    if (!spec) return '';
    const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform || '');
    if (spec === 'Redo') {
      return isMac ? '⌘+Shift+Z' : 'Ctrl+Y';
    }
    if (spec === 'Tab') {
      return 'Tab';
    }
    if (spec.indexOf('Shift+Alt+') === 0) {
      const rest = spec.replace(/^Shift\+Alt\+/, '');
      return isMac ? '⇧⌥+' + rest : 'Shift+Alt+' + rest;
    }
    if (spec.indexOf('Ctrl+Alt+') === 0) {
      const rest = spec.replace(/^Ctrl\+Alt\+/, '');
      return isMac ? '⌃⌥+' + rest : 'Ctrl+Alt+' + rest;
    }
    if (spec.indexOf('Alt+') === 0) {
      const rest = spec.replace(/^Alt\+/, '');
      return isMac ? '⌥+' + rest : 'Alt+' + rest;
    }
    const mod = isMac ? '⌘' : 'Ctrl';
    if (spec.indexOf('Shift+') === 0) {
      return mod + '+' + spec;
    }
    return mod + '+' + spec;
  }

  function clearMenuPosition(menu) {
    menu.style.left = '';
    menu.style.right = '';
    menu.style.top = '';
    menu.style.bottom = '';
    menu.style.maxHeight = '';
    menu.style.maxWidth = '';
  }

  /**
   * Keep dropdowns inside the viewport (right/bottom overflow, flip upward when needed).
   */
  function positionMenuDropdown(wrap, menu) {
    const margin = 8;
    const gap = 4;
    clearMenuPosition(menu);

    const wrapRect = wrap.getBoundingClientRect();
    menu.style.left = '0';
    menu.style.top = 'calc(100% + ' + gap + 'px)';
    menu.style.bottom = 'auto';

    const maxViewportW = Math.max(160, window.innerWidth - 2 * margin);
    if (menu.offsetWidth > maxViewportW) {
      menu.style.maxWidth = maxViewportW + 'px';
    }

    let mw = menu.offsetWidth;
    let shiftLeft = 0;
    if (wrapRect.left + mw > window.innerWidth - margin) {
      shiftLeft = window.innerWidth - margin - mw - wrapRect.left;
    }
    if (wrapRect.left + shiftLeft < margin) {
      shiftLeft = margin - wrapRect.left;
    }
    menu.style.left = shiftLeft + 'px';
    mw = menu.offsetWidth;

    const spaceBelow = window.innerHeight - wrapRect.bottom - gap - margin;
    const spaceAbove = wrapRect.top - margin - gap;
    let naturalH = menu.offsetHeight;

    let openUp = false;
    if (naturalH <= spaceBelow) {
      openUp = false;
    } else if (naturalH <= spaceAbove) {
      openUp = true;
    } else {
      openUp = spaceAbove > spaceBelow;
    }

    const avail = openUp ? spaceAbove - gap : spaceBelow - gap;
    if (naturalH > avail && avail > 0) {
      menu.style.maxHeight = Math.max(100, avail) + 'px';
      naturalH = menu.offsetHeight;
    }

    if (openUp) {
      menu.style.top = 'auto';
      menu.style.bottom = 'calc(100% + ' + gap + 'px)';
    } else {
      menu.style.top = 'calc(100% + ' + gap + 'px)';
      menu.style.bottom = 'auto';
    }
  }

  function setupDropdown(wrapId, btnId, menuId, handlers) {
    if (!handlers || typeof handlers !== 'object') {
      return;
    }

    const wrap = document.getElementById(wrapId);
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    if (!wrap || !btn || !menu) {
      return;
    }

    menu.querySelectorAll('[data-shortcut]').forEach(function (el) {
      const spec = el.getAttribute('data-shortcut');
      const kbd = el.querySelector('.preview-file-menu-kbd');
      if (kbd && spec) {
        kbd.textContent = shortcutLabel(spec);
      }
    });

    let open = false;
    let onReposition = null;

    function closeMenu() {
      if (onReposition) {
        window.removeEventListener('resize', onReposition);
        if (window.visualViewport && typeof window.visualViewport.removeEventListener === 'function') {
          window.visualViewport.removeEventListener('resize', onReposition);
          window.visualViewport.removeEventListener('scroll', onReposition);
        }
        onReposition = null;
      }
      clearMenuPosition(menu);
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      open = false;
    }

    function openMenu() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      open = true;
      requestAnimationFrame(function () {
        if (!open) {
          return;
        }
        positionMenuDropdown(wrap, menu);
        onReposition = function () {
          if (!open) {
            return;
          }
          positionMenuDropdown(wrap, menu);
        };
        window.addEventListener('resize', onReposition);
        if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
          window.visualViewport.addEventListener('resize', onReposition);
          window.visualViewport.addEventListener('scroll', onReposition);
        }
      });
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (open) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    menu.addEventListener('click', function (e) {
      const item = e.target.closest('[data-action]');
      if (!item || item.disabled || item.getAttribute('aria-disabled') === 'true') {
        return;
      }
      const action = item.getAttribute('data-action');
      const fn = handlers[action];
      if (typeof fn === 'function') {
        try {
          const r = fn();
          if (r && typeof r.then === 'function') {
            r.then(function () {}).catch(function () {});
          }
        } catch (_err) {
          /* ignore */
        }
        closeMenu();
      }
    });

    document.addEventListener(
      'click',
      function (e) {
        if (!open) return;
        if (!wrap.contains(e.target)) {
          closeMenu();
        }
      },
      true
    );

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        closeMenu();
        btn.focus();
      }
    });
  }

  function init(handlers) {
    setupDropdown('previewFileMenuWrap', 'previewFileMenuBtn', 'previewFileMenu', handlers);
  }

  function initEdit(handlers) {
    setupDropdown('previewEditMenuWrap', 'previewEditMenuBtn', 'previewEditMenu', handlers);
  }

  /** Register any title-bar menu (Selection, View, Go, Run, Terminal, …). */
  function registerMenu(wrapId, btnId, menuId, handlers) {
    setupDropdown(wrapId, btnId, menuId, handlers);
  }

  return { init: init, initEdit: initEdit, registerMenu: registerMenu };
})();
