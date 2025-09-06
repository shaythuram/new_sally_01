const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  getUserMedia: (constraints) => ipcRenderer.invoke('get-user-media', constraints)
});
