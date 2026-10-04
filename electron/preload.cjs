const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  close: () => ipcRenderer.send('app:close'),
  print: () => ipcRenderer.send('app:print'),
  printPdf: () => ipcRenderer.invoke('app:print-pdf'),
  setLanguage: (language) => ipcRenderer.send('app:set-language', language),
})
