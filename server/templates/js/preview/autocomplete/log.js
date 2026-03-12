// Autocomplete suggestions for Log terminal (Preview context)
window.LogAutocomplete = [
  // Global objects
  'window', 'document', 'console', 'navigator', 'screen', 'history', 'location',
  'localStorage', 'sessionStorage', 'JSON', 'Math', 'Date', 'Array', 'Object',
  'String', 'Number', 'Boolean', 'RegExp', 'Error', 'Promise', 'Map', 'Set',
  'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect', 'Intl',
  
  // Window properties
  'window.location', 'window.history', 'window.navigator', 'window.screen',
  'window.innerWidth', 'window.innerHeight', 'window.outerWidth', 'window.outerHeight',
  'window.localStorage', 'window.sessionStorage', 'window.console',
  'window.document', 'window.parent', 'window.top', 'window.self',
  'window.frames', 'window.length', 'window.name', 'window.status',
  'window.closed', 'window.opener', 'window.devicePixelRatio',
  
  // Window methods
  'window.alert', 'window.confirm', 'window.prompt', 'window.open', 'window.close',
  'window.focus', 'window.blur', 'window.print', 'window.scrollTo', 'window.scrollBy',
  'window.scroll', 'window.scrollX', 'window.scrollY', 'window.pageXOffset', 'window.pageYOffset',
  'window.requestAnimationFrame', 'window.cancelAnimationFrame',
  'window.setTimeout', 'window.setInterval', 'window.clearTimeout', 'window.clearInterval',
  'window.atob', 'window.btoa', 'window.encodeURI', 'window.encodeURIComponent',
  'window.decodeURI', 'window.decodeURIComponent',
  
  // Document properties
  'document.body', 'document.head', 'document.title', 'document.URL', 'document.domain',
  'document.referrer', 'document.cookie', 'document.readyState', 'document.doctype',
  'document.documentElement', 'document.defaultView', 'document.activeElement',
  'document.characterSet', 'document.contentType', 'document.designMode',
  
  // Document methods
  'document.getElementById', 'document.getElementsByClassName', 'document.getElementsByTagName',
  'document.getElementsByName', 'document.querySelector', 'document.querySelectorAll',
  'document.createElement', 'document.createTextNode', 'document.createDocumentFragment',
  'document.createComment', 'document.createAttribute', 'document.createEvent',
  'document.createEventObject', 'document.createRange', 'document.createTreeWalker',
  'document.adoptNode', 'document.importNode', 'document.write', 'document.writeln',
  'document.open', 'document.close', 'document.hasFocus', 'document.execCommand',
  
  // Console methods
  'console.log', 'console.info', 'console.warn', 'console.error', 'console.debug',
  'console.trace', 'console.table', 'console.group', 'console.groupEnd', 'console.groupCollapsed',
  'console.time', 'console.timeEnd', 'console.count', 'console.assert', 'console.clear',
  'console.dir', 'console.dirxml', 'console.profile', 'console.profileEnd',
  
  // Storage methods
  'localStorage.getItem', 'localStorage.setItem', 'localStorage.removeItem', 'localStorage.clear',
  'localStorage.key', 'sessionStorage.getItem', 'sessionStorage.setItem',
  'sessionStorage.removeItem', 'sessionStorage.clear', 'sessionStorage.key',
  
  // Element methods
  'element.addEventListener', 'element.removeEventListener', 'element.dispatchEvent',
  'element.getAttribute', 'element.setAttribute', 'element.removeAttribute',
  'element.hasAttribute', 'element.getAttributeNode', 'element.setAttributeNode',
  'element.removeAttributeNode', 'element.getElementsByTagName',
  'element.getElementsByClassName', 'element.querySelector', 'element.querySelectorAll',
  'element.closest', 'element.matches', 'element.contains',
  'element.appendChild', 'element.removeChild', 'element.replaceChild',
  'element.insertBefore', 'element.cloneNode', 'element.normalize',
  'element.getBoundingClientRect', 'element.getClientRects', 'element.scrollIntoView',
  'element.scrollIntoViewIfNeeded', 'element.scroll', 'element.scrollTo', 'element.scrollBy',
  'element.focus', 'element.blur', 'element.click', 'element.select',
  
  // Style manipulation
  'element.style', 'element.className', 'element.classList', 'element.classList.add',
  'element.classList.remove', 'element.classList.toggle', 'element.classList.contains',
  'element.classList.replace', 'element.offsetWidth', 'element.offsetHeight',
  'element.offsetTop', 'element.offsetLeft', 'element.clientWidth', 'element.clientHeight',
  'element.scrollWidth', 'element.scrollHeight', 'element.scrollTop', 'element.scrollLeft',
  
  // Event handling
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'Event', 'CustomEvent',
  'MouseEvent', 'KeyboardEvent', 'TouchEvent', 'FocusEvent', 'InputEvent',
  'event.preventDefault', 'event.stopPropagation', 'event.stopImmediatePropagation',
  'event.target', 'event.currentTarget', 'event.type', 'event.timeStamp',
  
  // JSON methods
  'JSON.parse', 'JSON.stringify',
  
  // Math methods
  'Math.abs', 'Math.ceil', 'Math.floor', 'Math.round', 'Math.max', 'Math.min',
  'Math.random', 'Math.sqrt', 'Math.pow', 'Math.sin', 'Math.cos', 'Math.tan',
  'Math.PI', 'Math.E',
  
  // Array methods
  'Array.from', 'Array.isArray', 'Array.of', 'array.push', 'array.pop',
  'array.shift', 'array.unshift', 'array.slice', 'array.splice', 'array.concat',
  'array.join', 'array.reverse', 'array.sort', 'array.indexOf', 'array.lastIndexOf',
  'array.includes', 'array.find', 'array.findIndex', 'array.filter', 'array.map',
  'array.forEach', 'array.some', 'array.every', 'array.reduce', 'array.reduceRight',
  
  // String methods
  'String.fromCharCode', 'String.fromCodePoint', 'string.charAt', 'string.charCodeAt',
  'string.concat', 'string.includes', 'string.indexOf', 'string.lastIndexOf',
  'string.match', 'string.replace', 'string.search', 'string.slice', 'string.split',
  'string.startsWith', 'string.endsWith', 'string.substring', 'string.toLowerCase',
  'string.toUpperCase', 'string.trim', 'string.trimStart', 'string.trimEnd',
  
  // Date methods
  'Date.now', 'Date.parse', 'new Date', 'date.getTime', 'date.getFullYear',
  'date.getMonth', 'date.getDate', 'date.getDay', 'date.getHours', 'date.getMinutes',
  'date.getSeconds', 'date.getMilliseconds', 'date.toISOString', 'date.toString',
  
  // Fetch API
  'fetch', 'Request', 'Response', 'Headers', 'URL', 'URLSearchParams',
  
  // Performance
  'performance.now', 'performance.mark', 'performance.measure', 'performance.getEntries',
  
  // Other useful
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'eval'
];
