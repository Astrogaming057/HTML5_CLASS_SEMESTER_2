; Assisted NSIS installer hooks for Astro Code (electron-builder).
; Install: shell integration, Open with, optional pins.
; Uninstall: remove all shell / Open with registry keys; optional AppData purge (GUI or --delete-app-data).

!include "LogicLib.nsh"

Var /GLOBAL AstroUninstallPurge

!macro customInit
  StrCpy $INSTDIR "$PROGRAMFILES\astro_code"
  ; Satisfies NSIS var analysis on the installer pass (uninstall uses customUnInit to set this).
  StrCpy $AstroUninstallPurge "0"
!macroend

!ifndef BUILD_UNINSTALLER
!include "nsDialogs.nsh"

Var OptShellReg
Var OptPinStart
Var OptPinTaskbar
Var hwndOptShell
Var hwndOptPinStart
Var hwndOptPinBar

Function AstroIntegrationPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 36u "Choose how Astro Code should appear in Windows (you can change these later by reinstalling)."
  Pop $0
  ${NSD_CreateCheckbox} 0 40u 100% 12u "Add &Open in Astro Code"
  Pop $hwndOptShell
  ${NSD_Check} $hwndOptShell
  ${NSD_CreateCheckbox} 0 56u 100% 12u "&Pin Astro Code to Start"
  Pop $hwndOptPinStart
  ${NSD_CreateCheckbox} 0 72u 100% 12u "&Pin Astro Code to the taskbar"
  Pop $hwndOptPinBar
  nsDialogs::Show
FunctionEnd

Function AstroIntegrationPageLeave
  ${NSD_GetState} $hwndOptShell $OptShellReg
  ${NSD_GetState} $hwndOptPinStart $OptPinStart
  ${NSD_GetState} $hwndOptPinBar $OptPinTaskbar
FunctionEnd

!macro customPageAfterChangeDir
  Page custom AstroIntegrationPageCreate AstroIntegrationPageLeave
!macroend

!macro customInstall
  ${if} $OptShellReg == ""
    StrCpy $OptShellReg "1"
  ${endif}
  ${if} $OptPinStart == ""
    StrCpy $OptPinStart "0"
  ${endif}
  ${if} $OptPinTaskbar == ""
    StrCpy $OptPinTaskbar "0"
  ${endif}

  ${if} $OptShellReg == "1"
    IfFileExists "$INSTDIR\uninstallerIcon.ico" astroIco_useIco astroIco_useExe
    astroIco_useIco:
      StrCpy $R3 "$INSTDIR\uninstallerIcon.ico"
      Goto astroIco_done
    astroIco_useExe:
      StrCpy $R3 "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
    astroIco_done:
    WriteRegStr SHELL_CONTEXT "Software\Classes\*\shell\AstroCode.open" "" "Open in Astro Code"
    WriteRegStr SHELL_CONTEXT "Software\Classes\*\shell\AstroCode.open" "Icon" "$R3"
    WriteRegStr SHELL_CONTEXT "Software\Classes\*\shell\AstroCode.open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\AstroCode.open" "" "Open in Astro Code"
    WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\AstroCode.open" "Icon" "$R3"
    WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\AstroCode.open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\AstroCode.open" "" "Open in Astro Code"
    WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\AstroCode.open" "Icon" "$R3"
    WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\AstroCode.open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%V"'
    WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "FriendlyAppName" "${PRODUCT_NAME}"
    WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "DefaultIcon" "$R3"
    WriteRegStr SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  ${endif}

  ${ifNot} ${isUpdated}
    StrCpy $R8 "0"
    ${if} $OptPinStart == "1"
      StrCpy $R8 "1"
    ${endif}
    ${if} $OptPinTaskbar == "1"
      StrCpy $R8 "1"
    ${endif}
    ${if} $R8 == "1"
      SetOutPath $PLUGINSDIR
      File "${BUILD_RESOURCES_DIR}\pin-shell.ps1"
      StrCpy $R6 ""
      ${if} $OptPinStart == "1"
        StrCpy $R6 "$R6 -PinStart"
      ${endif}
      ${if} $OptPinTaskbar == "1"
        StrCpy $R6 "$R6 -PinTaskbar"
      ${endif}
      ExecWait '"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\pin-shell.ps1" $R6'
    ${endif}
  ${endif}
!macroend

!endif ; !BUILD_UNINSTALLER

; Uninstall: MessageBox in customUnInit (reliable in installer + standalone uninstaller stubs).
; Silent uninstall: append --delete-app-data to remove AppData; otherwise only app files are removed.

!macro customUnInit
  StrCpy $AstroUninstallPurge "0"
  ${GetParameters} $R0
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${ifNot} ${Errors}
    StrCpy $AstroUninstallPurge "1"
  ${endif}
  ${IfNot} ${Silent}
    ${If} $AstroUninstallPurge == "1"
      Goto astro_uninit_done
    ${EndIf}
    MessageBox MB_YESNO|MB_ICONQUESTION "Remove all Astro Code settings and data under AppData for this user?$\r$\n$\r$\n• Yes — delete settings, caches, and related files (cannot be undone).$\r$\n• No — uninstall the program only and keep your settings." IDYES astro_um_yes IDNO astro_um_no
    astro_um_yes:
      StrCpy $AstroUninstallPurge "1"
      Goto astro_uninit_done
    astro_um_no:
      StrCpy $AstroUninstallPurge "0"
    astro_uninit_done:
  ${EndIf}
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "Software\Classes\*\shell\AstroCode.open"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\shell\AstroCode.open"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\Background\shell\AstroCode.open"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
  DeleteRegKey SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXECUTABLE_FILENAME}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'

  StrCpy $R9 "0"
  ${if} $AstroUninstallPurge == "1"
    StrCpy $R9 "1"
  ${endif}
  ${GetParameters} $R0
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${ifNot} ${Errors}
    StrCpy $R9 "1"
  ${endif}
  ${if} $R9 == "1"
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}
    RMDir /r "$LOCALAPPDATA\Astro Code"
    RMDir /r "$APPDATA\${APP_FILENAME}"
    !ifdef APP_PACKAGE_NAME
      RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
    !endif
    RMDir /r "$APPDATA\com.astrocode.editor"
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}
  ${endif}
!macroend
