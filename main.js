const { app, BrowserWindow, desktopCapturer, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the Vue.js app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile('dist/index.html');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for desktop capture
ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window', 'audio']
    });
    return sources;
  } catch (error) {
    console.error('Error getting desktop sources:', error);
    throw error;
  }
});

// IPC handler for saving files
ipcMain.handle('save-file', async (event, { data, filename, type }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: [
        { name: 'Video Files', extensions: ['webm', 'mp4'] },
        { name: 'Audio Files', extensions: ['wav', 'mp3', 'webm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      const buffer = Buffer.from(data);
      fs.writeFileSync(result.filePath, buffer);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
});

// IPC handler for getting user media permissions
ipcMain.handle('get-user-media', async (event, constraints) => {
  try {
    // This will be handled in the renderer process
    return { success: true };
  } catch (error) {
    console.error('Error getting user media:', error);
    throw error;
  }
});
