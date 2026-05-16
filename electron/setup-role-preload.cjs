const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('setupRoleApi', {
  finish: (payload) => ipcRenderer.invoke('setup-role-finish', payload),
  getDataDir: () => ipcRenderer.invoke('setup-role-get-datadir')
})
