import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

class ElectronApp {
  constructor() {
    this.mainWindow = null
    this.initializeApp()
  }

  initializeApp() {
    // Handle app ready
    app.whenReady().then(() => {
      this.createMainWindow()
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow()
        }
      })
    })

    // Handle app window closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    // Handle IPC messages
    this.setupIpcHandlers()
  }

  createMainWindow() {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 400,
      height: 700,
      minWidth: 350,
      minHeight: 500,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      titleBarStyle: 'default',
      show: false,
      icon: path.join(__dirname, 'public/icon.png')
    })

    // Load the app
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173')
      // Open DevTools in development
      this.mainWindow.webContents.openDevTools()
    } else {
      this.mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show()
      
      // Focus on the window
      if (isDev) {
        this.mainWindow.focus()
      }
    })

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })
  }

  setupIpcHandlers() {
    // Handle requests from renderer process
    ipcMain.handle('app-version', () => {
      return app.getVersion()
    })

    ipcMain.handle('app-name', () => {
      return app.getName()
    })

    // Handle window controls
    ipcMain.handle('window-minimize', () => {
      if (this.mainWindow) {
        this.mainWindow.minimize()
      }
    })

    ipcMain.handle('window-maximize', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMaximized()) {
          this.mainWindow.unmaximize()
        } else {
          this.mainWindow.maximize()
        }
      }
    })

    ipcMain.handle('window-close', () => {
      if (this.mainWindow) {
        this.mainWindow.close()
      }
    })

    // Handle window focus
    ipcMain.handle('window-focus', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore()
        }
        this.mainWindow.focus()
        this.mainWindow.show()
      }
    })

    // Handle notification permission request
    ipcMain.handle('request-notification-permission', async () => {
      try {
        // On Windows and Linux, notifications are allowed by default
        return { success: true, permission: 'granted' }
      } catch (error) {
        console.error('Error requesting notification permission:', error)
        return { success: false, error: error.message }
      }
    })

    // Handle showing notifications
    ipcMain.handle('show-notification', (event, options) => {
      try {
        if (!Notification.isSupported()) {
          console.warn('Notifications are not supported on this system')
          return { success: false, error: 'Notifications not supported' }
        }

        const notification = new Notification({
          title: options.title,
          body: options.body,
          icon: options.icon ? path.join(__dirname, 'public', options.icon.replace('/', '')) : undefined,
          silent: options.silent || false,
          urgency: options.urgent ? 'critical' : 'normal',
          timeoutType: options.timeoutType || 'default',
          closeButtonText: options.closeButtonText || 'Close'
        })

        // Handle notification click
        notification.on('click', () => {
          console.log('Notification clicked')
          // Focus the main window
          if (this.mainWindow) {
            if (this.mainWindow.isMinimized()) {
              this.mainWindow.restore()
            }
            this.mainWindow.focus()
            this.mainWindow.show()
          }
          
          // Send click event to renderer
          if (this.mainWindow && this.mainWindow.webContents) {
            this.mainWindow.webContents.send('notification-clicked', options)
          }
        })

        // Handle notification close
        notification.on('close', () => {
          console.log('Notification closed')
        })

        // Handle notification actions (if supported)
        notification.on('action', (event, index) => {
          console.log('Notification action clicked:', index)
          if (this.mainWindow && this.mainWindow.webContents) {
            this.mainWindow.webContents.send('notification-action', {
              action: options.actions ? options.actions[index] : null,
              options
            })
          }
        })

        notification.show()
        console.log('Notification shown:', options.title)
        
        return { success: true }
      } catch (error) {
        console.error('Error showing notification:', error)
        return { success: false, error: error.message }
      }
    })
  }
}

// Initialize the app
new ElectronApp()

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    console.log('Blocked new window to: ', navigationUrl)
  })
})
