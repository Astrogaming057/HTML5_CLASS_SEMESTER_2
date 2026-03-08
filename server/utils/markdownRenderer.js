const { marked } = require('marked');
const fs = require('fs').promises;
const path = require('path');

let markdownStyles = null;

async function loadMarkdownStyles() {
  if (!markdownStyles) {
    const stylesPath = path.join(__dirname, '..', 'templates', 'css', 'markdown.css');
    markdownStyles = await fs.readFile(stylesPath, 'utf-8');
  }
  return markdownStyles;
}

function renderMarkdown(content) {
  try {
    const markdownHtml = marked.parse(content);
    return markdownHtml;
  } catch (error) {
    throw new Error(`Failed to parse markdown: ${error.message}`);
  }
}

async function renderMarkdownWithStyles(content) {
  const markdownHtml = renderMarkdown(content);
  const styles = await loadMarkdownStyles();
  return `<div class="markdown-body">${markdownHtml}</div><style>${styles}</style>`;
}

module.exports = {
  renderMarkdown,
  renderMarkdownWithStyles
};
