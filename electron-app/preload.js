const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  getAppName: () => ipcRenderer.invoke('app-name'),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  focusWindow: () => ipcRenderer.invoke('window-focus'),
  
  // Notification system
  requestNotificationPermission: () => ipcRenderer.invoke('request-notification-permission'),
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  
  // Listen for notification events
  onNotificationClicked: (callback) => {
    ipcRenderer.on('notification-clicked', (event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('notification-clicked')
  },
  
  onNotificationAction: (callback) => {
    ipcRenderer.on('notification-action', (event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('notification-action')
  },
  
  // Platform info
  platform: process.platform,
})

// Prevent the renderer process from accessing Node.js
contextBridge.exposeInMainWorld('versions', {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron,
})
