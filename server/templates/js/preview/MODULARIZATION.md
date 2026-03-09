# Preview.js Modularization

## Completed Modules

The following modules have been created and extracted from `preview.js`:

1. **utils.js** - Utility functions
   - `getLanguage(filePath)` - Detect language from file extension
   - `customPrompt(title, defaultValue)` - Custom prompt dialog
   - `customConfirm(message)` - Custom confirm dialog
   - `generateLogId(message, logType, timestamp)` - Generate unique log IDs

2. **settings.js** - Settings management
   - `loadPreviewSettings()` - Load settings from localStorage
   - `savePreviewSettings()` - Save settings to localStorage
   - `loadTheme(themeName)` - Load and apply theme
   - `applyPreviewSettings(editor)` - Apply settings to editor and UI
   - `openSettings()` - Open settings panel
   - `closeSettings()` - Close settings panel
   - `handleThemePreview()` - Preview theme changes
   - `resetToDefaults()` - Reset settings to defaults

3. **popouts.js** - Popout window management
   - `openEditorPopout(filePath)` - Open editor in popout window
   - `openPreviewPopout(filePath, previewPanel, updatePreviewVisibility)` - Open preview in popout
   - `openTerminalPopout(terminalPanel, updateTerminalVisibility)` - Open terminal in popout
   - `handlePopoutClosed(popoutType, ...)` - Handle popout window close events

4. **ui.js** - UI toggle and visibility functions
   - `toggleFileExplorer(...)` - Toggle file explorer panel
   - `updateExplorerVisibility(fileExplorerPanel)` - Update explorer visibility
   - `togglePreviewPanel(...)` - Toggle preview panel
   - `updatePreviewVisibility(...)` - Update preview visibility
   - `updateTerminalVisibility(...)` - Update terminal visibility
   - `updateTerminalPositionButtons(...)` - Update terminal position buttons
   - `moveTerminalToBottomPosition(...)` - Move terminal to bottom
   - `moveTerminalToExplorerPosition(...)` - Move terminal to explorer
   - `updateBackButton(backBtn, currentDir)` - Update back button state
   - `goBackFolder(...)` - Navigate to parent folder

## Additional Modules Extracted

The following additional modules have been extracted for further modularization:

1. **syncChannel.js** - BroadcastChannel message handling
   - `setupSyncChannel(...)` - Setup sync channel event listeners for editor content, cursor, preview refresh, terminal output, and popout management

2. **editorSetup.js** - Monaco Editor initialization and configuration
   - `createEditor(...)` - Create Monaco Editor instance with configuration
   - `setupEditorListeners(...)` - Setup editor change listeners and keyboard shortcuts

3. **terminalUI.js** - Terminal UI management
   - `updateTerminalVisibility(...)` - Update terminal panel visibility
   - `updateTerminalPositionButtons(...)` - Update terminal position button states
   - `moveTerminalToBottomPosition(...)` - Move terminal to bottom position
   - `moveTerminalToExplorerPosition(...)` - Move terminal to explorer position
   - `setupTerminalEventHandlers(...)` - Setup terminal event handlers

4. **settingsUI.js** - Settings UI event handlers
   - `setupSettingsEventHandlers(...)` - Setup all settings-related event handlers (save, reset, theme loading, etc.)

5. **events.js** - General event handling
   - `setupKeyboardShortcuts(...)` - Setup keyboard shortcuts (Ctrl+B, Ctrl+P)
   - `setupButtonHandlers(...)` - Setup button click handlers (save, refresh, close, popouts)
   - `setupPanelToggleHandlers(...)` - Setup panel toggle handlers
   - `setupReopenHandlers(...)` - Setup reopen panel handlers
   - `setupBackButton(...)` - Setup back button handler
   - `setupBeforeUnload(...)` - Setup beforeunload handlers
   - `setupPopstate(...)` - Setup browser history navigation handlers

6. **initialization.js** - Initialization logic
   - `initializeState(...)` - Initialize application state from URL params and localStorage
   - `initializeVisibility(...)` - Initialize panel visibility
   - `restoreOrLoadFile(...)` - Restore state or load file directly

## Usage

To use the modules, they should be loaded before the main `preview.js` file. The route handler (`server/routes/preview.js`) should be updated to include the module files in the correct order:

1. `preview/utils.js`
2. `preview/settings.js`
3. `preview/popouts.js`
4. `preview/ui.js`
5. (remaining modules as they are created)
6. `preview.js` (main file)

## Refactoring Status

- ✅ Utility functions extracted
- ✅ Settings management extracted
- ✅ Popout management extracted
- ✅ UI toggle functions extracted
- ✅ State management extracted
- ✅ Editor operations extracted
- ✅ Preview management extracted
- ✅ Terminal handling extracted
- ✅ File explorer extracted
- ✅ WebSocket handling extracted
- ✅ Resizers extracted
- ✅ Server restart extracted
- ✅ SyncChannel handlers extracted
- ✅ Editor setup extracted
- ✅ Terminal UI extracted
- ✅ Settings UI extracted
- ✅ Event handlers extracted
- ✅ Initialization logic extracted

## Next Steps

1. Extract remaining modules one by one
2. Update main `preview.js` to use module functions
3. Update route handler to load module files
4. Test each module extraction
5. Remove extracted code from main file
