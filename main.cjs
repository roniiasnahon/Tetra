const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron');
const path = require('path');

// Disable standard application menu
Menu.setApplicationMenu(null);

let mainWindow = null;

// Register deep link protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('cosmiwise', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('cosmiwise');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Cosmiwise",
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Load the app - load the local server or custom URL depending on environment
  const startUrl = process.env.ELECTRON_DEV_URL || 'http://localhost:3000';
  mainWindow.loadURL(startUrl);

  // Remove the default menu bar
  mainWindow.setMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock to prevent multiple instances and handle external links correctly
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus window if another instance was booted
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    
    // Parse protocol URL in Windows/Linux
    const url = commandLine.find((arg) => arg.startsWith('cosmiwise://'));
    if (url) {
      handleDeepLink(url);
    }
  });

  app.whenReady().then(() => {
    createWindow();
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

// Protocol handler for macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

function handleDeepLink(urlStr) {
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', urlStr);
  }
}

// IPC listener to open URLs in external browser securely
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

// Window controls IPC
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});
