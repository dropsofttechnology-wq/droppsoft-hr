const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('connectApi', {
  saveRemoteApi: (url) => ipcRenderer.invoke('save-remote-api-json', url),
  testRemoteApi: (url) => ipcRenderer.invoke('test-remote-api', url),
  getConfigPath: () => ipcRenderer.invoke('get-remote-api-config-path')
})
