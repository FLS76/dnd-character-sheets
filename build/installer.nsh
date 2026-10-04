!include LogicLib.nsh
!include nsDialogs.nsh
!include "${NSISDIR}\Contrib\Modern UI 2\MUI2.nsh"

!ifndef BUILD_UNINSTALLER
  !include StrContains.nsh

  LangString CodexShortcutsTitle 1049 "Создание ярлыков"
  LangString CodexShortcutsTitle 1033 "Create shortcuts"
  LangString CodexShortcutsDescription 1049 "Выберите, какие ярлыки создать"
  LangString CodexShortcutsDescription 1033 "Choose which shortcuts to create"
  LangString CodexDesktopShortcut 1049 "Создать ярлык на рабочем столе"
  LangString CodexDesktopShortcut 1033 "Create a desktop shortcut"
  LangString CodexStartMenuShortcut 1049 "Создать ярлык в меню «Пуск»"
  LangString CodexStartMenuShortcut 1033 "Create a Start menu shortcut"

  LangString CodexReviewTitle 1049 "Проверьте параметры установки"
  LangString CodexReviewTitle 1033 "Review the installation"
  LangString CodexReviewGroup 1049 "Параметры установки"
  LangString CodexReviewGroup 1033 "Installation settings"
  LangString CodexReviewFolder 1049 "Папка установки:"
  LangString CodexReviewFolder 1033 "Install folder:"
  LangString CodexReviewDesktopOn 1049 "Рабочий стол: ярлык будет создан"
  LangString CodexReviewDesktopOn 1033 "Desktop: shortcut will be created"
  LangString CodexReviewDesktopOff 1049 "Рабочий стол: ярлык не создаётся"
  LangString CodexReviewDesktopOff 1033 "Desktop: shortcut will not be created"
  LangString CodexReviewStartOn 1049 "Меню «Пуск»: ярлык будет создан"
  LangString CodexReviewStartOn 1033 "Start menu: shortcut will be created"
  LangString CodexReviewStartOff 1049 "Меню «Пуск»: ярлык не создаётся"
  LangString CodexReviewStartOff 1033 "Start menu: shortcut will not be created"

  Var CustomShortcutsPage
  Var CustomReviewPage
  Var CustomDesktopShortcut
  Var CustomStartMenuShortcut
  Var CreateDesktopShortcutChecked
  Var CreateStartMenuShortcutChecked

  !macro customWelcomePage
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  !macro customPageAfterChangeDir
    ; Always show the standard directory page, including during upgrades.
    !define MUI_PAGE_CUSTOMFUNCTION_LEAVE CodexDirectoryLeave
    !insertmacro MUI_PAGE_DIRECTORY

    !insertmacro MUI_PAGE_INIT
    PageEx custom
      PageCallbacks CustomShortcutsPagePre CustomShortcutsPageLeave
      Caption " "
    PageExEnd

    !insertmacro MUI_PAGE_INIT
    PageEx custom
      PageCallbacks CustomReviewPagePre CustomReviewPageLeave
      Caption " "
    PageExEnd
  !macroend

  Function CodexDirectoryLeave
    ${If} $INSTDIR == ""
      StrCpy $INSTDIR "$LOCALAPPDATA\Programs\DND Character Sheets"
    ${EndIf}
    ${StrContains} $0 "\DND Character Sheets" $INSTDIR
    ${If} $0 == ""
      StrCpy $INSTDIR "$INSTDIR\DND Character Sheets"
    ${EndIf}
  FunctionEnd

  Function CustomShortcutsPagePre
    !insertmacro MUI_HEADER_TEXT "$(CodexShortcutsTitle)" "$(CodexShortcutsDescription)"
    nsDialogs::Create 1018
    Pop $CustomShortcutsPage

    ${If} $CustomShortcutsPage == error
      Abort
    ${EndIf}

    ; Dialog-relative coordinates starting at 0: the auto-sized dialog hugs the
    ; content and lands in the top-left corner of the MUI client area.
    ; Matches the electron-builder idiom (multiUserUi.nsh uses 0u 0u).
    ${NSD_CreateCheckbox} 10u 8u 300u 20u "$(CodexDesktopShortcut)"
    Pop $CustomDesktopShortcut
    ${NSD_CreateCheckbox} 10u 36u 300u 20u "$(CodexStartMenuShortcut)"
    Pop $CustomStartMenuShortcut

    ${If} $CreateDesktopShortcutChecked == ""
      StrCpy $CreateDesktopShortcutChecked "1"
    ${EndIf}
    ${If} $CreateStartMenuShortcutChecked == ""
      StrCpy $CreateStartMenuShortcutChecked "1"
    ${EndIf}

    ${If} $CreateDesktopShortcutChecked == "1"
      SendMessage $CustomDesktopShortcut ${BM_SETCHECK} ${BST_CHECKED} 0
    ${Else}
      SendMessage $CustomDesktopShortcut ${BM_SETCHECK} ${BST_UNCHECKED} 0
    ${EndIf}
    ${If} $CreateStartMenuShortcutChecked == "1"
      SendMessage $CustomStartMenuShortcut ${BM_SETCHECK} ${BST_CHECKED} 0
    ${Else}
      SendMessage $CustomStartMenuShortcut ${BM_SETCHECK} ${BST_UNCHECKED} 0
    ${EndIf}

    nsDialogs::SetUserData $CustomDesktopShortcut $CreateDesktopShortcutChecked
    nsDialogs::SetUserData $CustomStartMenuShortcut $CreateStartMenuShortcutChecked
    ${NSD_OnClick} $CustomDesktopShortcut CustomDesktopShortcutChanged
    ${NSD_OnClick} $CustomStartMenuShortcut CustomStartMenuShortcutChanged
    nsDialogs::Show
  FunctionEnd

  Function CustomShortcutsPageLeave
  FunctionEnd

  Function CustomDesktopShortcutChanged
    Pop $1
    nsDialogs::GetUserData $1
    Pop $1
    StrCpy $CreateDesktopShortcutChecked $1
  FunctionEnd

  Function CustomStartMenuShortcutChanged
    Pop $1
    nsDialogs::GetUserData $1
    Pop $1
    StrCpy $CreateStartMenuShortcutChecked $1
  FunctionEnd

  Function CustomReviewPagePre
    !insertmacro MUI_HEADER_TEXT "$(CodexReviewTitle)" "$(CodexReviewGroup)"
    nsDialogs::Create 1018
    Pop $CustomReviewPage

    ${If} $CustomReviewPage == error
      Abort
    ${EndIf}

    ${NSD_CreateGroupBox} 6u 4u 304u 100u "$(CodexReviewGroup)"
    Pop $0
    ${NSD_CreateLabel} 16u 20u 284u 18u "$(CodexReviewFolder)"
    Pop $0
    ${NSD_CreateLabel} 16u 38u 284u 18u "$INSTDIR"
    Pop $0

    ${If} $CreateDesktopShortcutChecked == "1"
      ${NSD_CreateLabel} 16u 60u 284u 18u "$(CodexReviewDesktopOn)"
    ${Else}
      ${NSD_CreateLabel} 16u 60u 284u 18u "$(CodexReviewDesktopOff)"
    ${EndIf}
    Pop $0

    ${If} $CreateStartMenuShortcutChecked == "1"
      ${NSD_CreateLabel} 16u 80u 284u 18u "$(CodexReviewStartOn)"
    ${Else}
      ${NSD_CreateLabel} 16u 80u 284u 18u "$(CodexReviewStartOff)"
    ${EndIf}
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function CustomReviewPageLeave
  FunctionEnd
!endif

!macro customInstall
  !insertmacro createMenuDirectory

  ${If} $CreateDesktopShortcutChecked == "1"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${Else}
    Delete "$newDesktopLink"
  ${EndIf}

  ${If} $CreateStartMenuShortcutChecked == "1"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${Else}
    Delete "$newStartMenuLink"
    StrCpy $launchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${EndIf}

  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
