const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const isDev = process.argv.includes('--dev') || process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL
const devUrl = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
let currentLanguage = 'ru'

function buildApplicationMenu(language) {
  const labels = language === 'en'
    ? {
        file: 'File',
        edit: 'Edit',
        view: 'View',
        window: 'Window',
        exit: 'Exit',
        undo: 'Undo',
        redo: 'Redo',
        cut: 'Cut',
        copy: 'Copy',
        paste: 'Paste',
        selectAll: 'Select all',
        reload: 'Reload',
        forceReload: 'Force reload',
        resetZoom: 'Actual size',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        fullscreen: 'Toggle full screen',
        devtools: 'Developer tools',
        minimize: 'Minimize',
        maximize: 'Maximize',
        close: 'Close',
      }
    : {
        file: 'Файл',
        edit: 'Правка',
        view: 'Вид',
        window: 'Окно',
        exit: 'Выход',
        undo: 'Отменить',
        redo: 'Повторить',
        cut: 'Вырезать',
        copy: 'Копировать',
        paste: 'Вставить',
        selectAll: 'Выделить всё',
        reload: 'Обновить',
        forceReload: 'Принудительно обновить',
        resetZoom: 'Реальный размер',
        zoomIn: 'Увеличить',
        zoomOut: 'Уменьшить',
        fullscreen: 'Полноэкранный режим',
        devtools: 'Инструменты разработчика',
        minimize: 'Свернуть',
        maximize: 'Развернуть',
        close: 'Закрыть',
      }

  return Menu.buildFromTemplate([
    {
      label: labels.file,
      submenu: [
        { label: labels.exit, click: () => app.quit() },
      ],
    },
    {
      label: labels.edit,
      submenu: [
        { label: labels.undo, role: 'undo' },
        { label: labels.redo, role: 'redo' },
        { type: 'separator' },
        { label: labels.cut, role: 'cut' },
        { label: labels.copy, role: 'copy' },
        { label: labels.paste, role: 'paste' },
        { label: labels.selectAll, role: 'selectAll' },
      ],
    },
    {
      label: labels.view,
      submenu: [
        { label: labels.reload, role: 'reload' },
        { label: labels.forceReload, role: 'forceReload' },
        { type: 'separator' },
        { label: labels.resetZoom, role: 'resetZoom' },
        { label: labels.zoomIn, role: 'zoomIn' },
        { label: labels.zoomOut, role: 'zoomOut' },
        { type: 'separator' },
        { label: labels.fullscreen, role: 'togglefullscreen' },
        { label: labels.devtools, role: 'toggleDevTools' },
      ],
    },
    {
      label: labels.window,
      submenu: [
        { label: labels.minimize, role: 'minimize' },
        { label: labels.maximize, role: 'toggleMaximize' },
        { label: labels.close, role: 'close' },
      ],
    },
  ])
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#171a22',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  window.setMenuBarVisibility(true)

  if (isDev) {
    window.loadURL(devUrl)
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

ipcMain.on('app:close', () => app.quit())
ipcMain.on('app:set-language', (_event, language) => {
  if (language !== 'ru' && language !== 'en') return
  currentLanguage = language
  Menu.setApplicationMenu(buildApplicationMenu(language))
})
ipcMain.on('app:print', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.webContents.print({ silent: false })
})

ipcMain.handle('app:print-pdf', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return false
  const result = await dialog.showSaveDialog(window, {
    title: currentLanguage === 'ru' ? 'Сохранить лист персонажа' : 'Save character sheet',
    defaultPath: 'character-sheet.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (result.canceled || !result.filePath) return false
  const pdf = await window.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { top: 0.25, bottom: 0.25, left: 0.25, right: 0.25 },
  })
  fs.writeFileSync(result.filePath, pdf)
  return true
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildApplicationMenu(currentLanguage))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
