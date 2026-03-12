// Autocomplete suggestions for Client terminal (JavaScript context)
window.ClientAutocomplete = [
  // Mode commands
  'mode', 'app-mode', 'browser-mode',
  
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
  
  // JSON methods
  'JSON.parse', 'JSON.stringify', 'JSON.stringify',
  
  // Math methods
  'Math.abs', 'Math.acos', 'Math.acosh', 'Math.asin', 'Math.asinh', 'Math.atan',
  'Math.atan2', 'Math.atanh', 'Math.cbrt', 'Math.ceil', 'Math.clz32', 'Math.cos',
  'Math.cosh', 'Math.exp', 'Math.expm1', 'Math.floor', 'Math.fround', 'Math.hypot',
  'Math.imul', 'Math.log', 'Math.log10', 'Math.log1p', 'Math.log2', 'Math.max',
  'Math.min', 'Math.pow', 'Math.random', 'Math.round', 'Math.sign', 'Math.sin',
  'Math.sinh', 'Math.sqrt', 'Math.tan', 'Math.tanh', 'Math.trunc',
  'Math.E', 'Math.LN2', 'Math.LN10', 'Math.LOG2E', 'Math.LOG10E', 'Math.PI',
  'Math.SQRT1_2', 'Math.SQRT2',
  
  // Array methods
  'Array.from', 'Array.isArray', 'Array.of', 'Array.prototype.concat',
  'Array.prototype.copyWithin', 'Array.prototype.entries', 'Array.prototype.every',
  'Array.prototype.fill', 'Array.prototype.filter', 'Array.prototype.find',
  'Array.prototype.findIndex', 'Array.prototype.flat', 'Array.prototype.flatMap',
  'Array.prototype.forEach', 'Array.prototype.includes', 'Array.prototype.indexOf',
  'Array.prototype.join', 'Array.prototype.keys', 'Array.prototype.lastIndexOf',
  'Array.prototype.map', 'Array.prototype.pop', 'Array.prototype.push',
  'Array.prototype.reduce', 'Array.prototype.reduceRight', 'Array.prototype.reverse',
  'Array.prototype.shift', 'Array.prototype.slice', 'Array.prototype.some',
  'Array.prototype.sort', 'Array.prototype.splice', 'Array.prototype.toLocaleString',
  'Array.prototype.toString', 'Array.prototype.unshift', 'Array.prototype.values',
  
  // String methods
  'String.fromCharCode', 'String.fromCodePoint', 'String.raw',
  'String.prototype.charAt', 'String.prototype.charCodeAt', 'String.prototype.codePointAt',
  'String.prototype.concat', 'String.prototype.endsWith', 'String.prototype.includes',
  'String.prototype.indexOf', 'String.prototype.lastIndexOf', 'String.prototype.localeCompare',
  'String.prototype.match', 'String.prototype.matchAll', 'String.prototype.normalize',
  'String.prototype.padEnd', 'String.prototype.padStart', 'String.prototype.repeat',
  'String.prototype.replace', 'String.prototype.replaceAll', 'String.prototype.search',
  'String.prototype.slice', 'String.prototype.split', 'String.prototype.startsWith',
  'String.prototype.substring', 'String.prototype.toLocaleLowerCase', 'String.prototype.toLocaleUpperCase',
  'String.prototype.toLowerCase', 'String.prototype.toUpperCase', 'String.prototype.trim',
  'String.prototype.trimEnd', 'String.prototype.trimStart', 'String.prototype.valueOf',
  
  // Object methods
  'Object.assign', 'Object.create', 'Object.defineProperty', 'Object.defineProperties',
  'Object.entries', 'Object.freeze', 'Object.fromEntries', 'Object.getOwnPropertyDescriptor',
  'Object.getOwnPropertyDescriptors', 'Object.getOwnPropertyNames', 'Object.getOwnPropertySymbols',
  'Object.getPrototypeOf', 'Object.hasOwn', 'Object.is', 'Object.isExtensible',
  'Object.isFrozen', 'Object.isSealed', 'Object.keys', 'Object.preventExtensions',
  'Object.seal', 'Object.setPrototypeOf', 'Object.values',
  
  // Date methods
  'Date.now', 'Date.parse', 'Date.UTC', 'Date.prototype.getDate', 'Date.prototype.getDay',
  'Date.prototype.getFullYear', 'Date.prototype.getHours', 'Date.prototype.getMilliseconds',
  'Date.prototype.getMinutes', 'Date.prototype.getMonth', 'Date.prototype.getSeconds',
  'Date.prototype.getTime', 'Date.prototype.getTimezoneOffset', 'Date.prototype.getUTCDate',
  'Date.prototype.getUTCDay', 'Date.prototype.getUTCFullYear', 'Date.prototype.getUTCHours',
  'Date.prototype.getUTCMilliseconds', 'Date.prototype.getUTCMinutes', 'Date.prototype.getUTCMonth',
  'Date.prototype.getUTCSeconds', 'Date.prototype.setDate', 'Date.prototype.setFullYear',
  'Date.prototype.setHours', 'Date.prototype.setMilliseconds', 'Date.prototype.setMinutes',
  'Date.prototype.setMonth', 'Date.prototype.setSeconds', 'Date.prototype.setTime',
  'Date.prototype.setUTCDate', 'Date.prototype.setUTCFullYear', 'Date.prototype.setUTCHours',
  'Date.prototype.setUTCMilliseconds', 'Date.prototype.setUTCMinutes', 'Date.prototype.setUTCMonth',
  'Date.prototype.setUTCSeconds', 'Date.prototype.toDateString', 'Date.prototype.toISOString',
  'Date.prototype.toJSON', 'Date.prototype.toLocaleDateString', 'Date.prototype.toLocaleString',
  'Date.prototype.toLocaleTimeString', 'Date.prototype.toString', 'Date.prototype.toTimeString',
  'Date.prototype.toUTCString', 'Date.prototype.valueOf',
  
  // Number methods
  'Number.isFinite', 'Number.isInteger', 'Number.isNaN', 'Number.isSafeInteger',
  'Number.parseFloat', 'Number.parseInt', 'Number.prototype.toExponential',
  'Number.prototype.toFixed', 'Number.prototype.toLocaleString', 'Number.prototype.toPrecision',
  'Number.prototype.toString', 'Number.prototype.valueOf',
  
  // RegExp methods
  'RegExp.prototype.exec', 'RegExp.prototype.test', 'RegExp.prototype.toString',
  
  // Promise methods
  'Promise.all', 'Promise.allSettled', 'Promise.any', 'Promise.race', 'Promise.reject',
  'Promise.resolve', 'Promise.prototype.catch', 'Promise.prototype.finally',
  'Promise.prototype.then',
  
  // Fetch API
  'fetch', 'Request', 'Response', 'Headers', 'URL', 'URLSearchParams',
  
  // DOM Events
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'Event', 'CustomEvent',
  
  // Performance
  'performance.now', 'performance.mark', 'performance.measure', 'performance.getEntries',
  'performance.getEntriesByName', 'performance.getEntriesByType', 'performance.clearMarks',
  'performance.clearMeasures', 'performance.clearResourceTimings',
  
  // Other useful globals
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'eval', 'escape', 'unescape'
];
