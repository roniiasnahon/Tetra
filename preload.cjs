const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openUrl: (url) => ipcRenderer.send('open-external', url),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onDeepLink: (callback) => {
    const subscription = (event, url) => callback(url);
    ipcRenderer.on('deep-link', subscription);
    return () => {
      ipcRenderer.removeListener('deep-link', subscription);
    };
  }
});
