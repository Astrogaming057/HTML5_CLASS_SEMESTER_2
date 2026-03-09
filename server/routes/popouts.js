const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const router = express.Router();

let editorPopoutHtml = null;
let editorPopoutCss = null;
let editorPopoutJs = null;
let previewPopoutHtml = null;
let previewPopoutCss = null;
let previewPopoutJs = null;
let terminalPopoutHtml = null;
let terminalPopoutCss = null;
let terminalPopoutJs = null;

async function loadPopoutTemplates() {
  const templatesDir = path.join(__dirname, '..', 'templates');
  
  if (!editorPopoutHtml) {
    editorPopoutHtml = await fs.readFile(
      path.join(templatesDir, 'html', 'editor-popout.html'),
      'utf-8'
    );
    editorPopoutCss = await fs.readFile(
      path.join(templatesDir, 'css', 'editor-popout.css'),
      'utf-8'
    );
    editorPopoutJs = await fs.readFile(
      path.join(templatesDir, 'js', 'editor-popout.js'),
      'utf-8'
    );
  }
  
  if (!previewPopoutHtml) {
    previewPopoutHtml = await fs.readFile(
      path.join(templatesDir, 'html', 'preview-popout.html'),
      'utf-8'
    );
    previewPopoutCss = await fs.readFile(
      path.join(templatesDir, 'css', 'preview-popout.css'),
      'utf-8'
    );
    previewPopoutJs = await fs.readFile(
      path.join(templatesDir, 'js', 'preview-popout.js'),
      'utf-8'
    );
  }
  
  if (!terminalPopoutHtml) {
    terminalPopoutHtml = await fs.readFile(
      path.join(templatesDir, 'html', 'terminal-popout.html'),
      'utf-8'
    );
    terminalPopoutCss = await fs.readFile(
      path.join(templatesDir, 'css', 'terminal-popout.css'),
      'utf-8'
    );
    terminalPopoutJs = await fs.readFile(
      path.join(templatesDir, 'js', 'terminal-popout.js'),
      'utf-8'
    );
  }
}

router.get('/editor', async (req, res) => {
  try {
    await loadPopoutTemplates();
    const filePath = req.query.file;
    const originalUrl = req.query.original;
    const theme = req.query.theme || 'dark';
    const customCSS = req.query.customCSS ? Buffer.from(req.query.customCSS, 'base64').toString('utf-8') : '';
    
    let themeStyle = '';
    try {
      if (theme === 'custom' && customCSS) {
        if (customCSS.trim() === '') {
          const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
          const themeContent = await fs.readFile(themePath, 'utf-8');
          themeStyle = `<style id="theme-style">${themeContent}</style>`;
        } else {
          themeStyle = `<style id="theme-style">${customCSS}</style>`;
        }
      } else {
        const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', `${theme}.css`);
        const themeContent = await fs.readFile(themePath, 'utf-8');
        themeStyle = `<style id="theme-style">${themeContent}</style>`;
      }
    } catch (err) {
      logger.warn('Error loading theme for editor popout, using dark theme', { theme, error: err.message });
      try {
        const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
        const themeContent = await fs.readFile(themePath, 'utf-8');
        themeStyle = `<style id="theme-style">${themeContent}</style>`;
      } catch (fallbackError) {
        logger.error('Error loading fallback theme for editor popout', fallbackError);
        themeStyle = '<style id="theme-style"></style>';
      }
    }
    
    const html = editorPopoutHtml
      .replace('{{CSS_CONTENT}}', `<style>${editorPopoutCss}</style>${themeStyle}`)
      .replace('{{JS_CONTENT}}', `<script>${editorPopoutJs}</script>`);
    res.send(html);
  } catch (error) {
    logger.error('Error serving editor popout', error);
    res.status(500).send('Error: ' + error.message);
  }
});

router.get('/preview', async (req, res) => {
  try {
    await loadPopoutTemplates();
    const theme = req.query.theme || 'dark';
    const customCSS = req.query.customCSS ? Buffer.from(req.query.customCSS, 'base64').toString('utf-8') : '';
    
    let themeStyle = '';
    try {
      if (theme === 'custom' && customCSS) {
        if (customCSS.trim() === '') {
          const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
          const themeContent = await fs.readFile(themePath, 'utf-8');
          themeStyle = `<style id="theme-style">${themeContent}</style>`;
        } else {
          themeStyle = `<style id="theme-style">${customCSS}</style>`;
        }
      } else {
        const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', `${theme}.css`);
        const themeContent = await fs.readFile(themePath, 'utf-8');
        themeStyle = `<style id="theme-style">${themeContent}</style>`;
      }
    } catch (err) {
      logger.warn('Error loading theme for preview popout, using dark theme', { theme, error: err.message });
      try {
        const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
        const themeContent = await fs.readFile(themePath, 'utf-8');
        themeStyle = `<style id="theme-style">${themeContent}</style>`;
      } catch (fallbackError) {
        logger.error('Error loading fallback theme for preview popout', fallbackError);
        themeStyle = '<style id="theme-style"></style>';
      }
    }
    
    // Replace the empty theme-style element with the actual theme
    let html = previewPopoutHtml
      .replace('{{CSS_CONTENT}}', `<style>${previewPopoutCss}</style>`)
      .replace('{{JS_CONTENT}}', `<script>${previewPopoutJs}</script>`)
      .replace('<style id="theme-style"></style>', themeStyle);
    
    res.send(html);
  } catch (error) {
    logger.error('Error serving preview popout', error);
    res.status(500).send('Error: ' + error.message);
  }
});

router.get('/terminal', async (req, res) => {
  try {
    await loadPopoutTemplates();
    const theme = req.query.theme || 'dark';
    const customCSS = req.query.customCSS ? Buffer.from(req.query.customCSS, 'base64').toString('utf-8') : '';
    
    let themeStyle = '';
    try {
      if (theme === 'custom' && customCSS) {
        if (customCSS.trim() === '') {
          const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
          const themeContent = await fs.readFile(themePath, 'utf-8');
          themeStyle = `<style id="theme-style">${themeContent}</style>`;
        } else {
          themeStyle = `<style id="theme-style">${customCSS}</style>`;
        }
      } else {
        const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', `${theme}.css`);
        const themeContent = await fs.readFile(themePath, 'utf-8');
        themeStyle = `<style id="theme-style">${themeContent}</style>`;
      }
    } catch (err) {
      logger.warn('Error loading theme for terminal popout, using dark theme', { theme, error: err.message });
      try {
        const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
        const themeContent = await fs.readFile(themePath, 'utf-8');
        themeStyle = `<style id="theme-style">${themeContent}</style>`;
      } catch (fallbackError) {
        logger.error('Error loading fallback theme for terminal popout', fallbackError);
        themeStyle = '<style id="theme-style"></style>';
      }
    }
    
    let html = terminalPopoutHtml
      .replace('{{CSS_CONTENT}}', `<style>${terminalPopoutCss}</style>`)
      .replace('{{JS_CONTENT}}', `<script>${terminalPopoutJs}</script>`)
      .replace('<style id="theme-style"></style>', themeStyle);
    
    res.send(html);
  } catch (error) {
    logger.error('Error serving terminal popout', error);
    res.status(500).send('Error: ' + error.message);
  }
});

module.exports = router;
