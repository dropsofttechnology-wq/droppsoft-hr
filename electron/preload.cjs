const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('droppsoftDesktop', {
  getApiPort: () => ipcRenderer.invoke('get-api-port'),
  getApiBaseUrl: () => ipcRenderer.invoke('get-api-base-url'),
  printTranscriptToPdf: (html) => ipcRenderer.invoke('print-transcript-to-pdf', html),
  isDesktop: true
})
