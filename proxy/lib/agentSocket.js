function pathnameOnly(urlStr) {
  try {
    return new URL(urlStr, 'http://x').pathname;
  } catch (e) {
    return '';
  }
}

module.exports = { pathnameOnly };
