const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store').default;
const { handleDownloadRequest, detectPlatformFromUrl, setMainWindow, setPluginsDir, setCookiesDir } = require('./backend/downloadManager');
const { convertFile, setPluginsDir: setConvPluginsDir } = require('./backend/converterManager');
const { autoUpdater } = require('electron-updater');

const store = new Store();
let mainWindow;
let updaterWindow;
let tray;
let shouldQuit = false;
let pluginsDir;
let cookiesDir;

function createUpdaterWindow() {
  updaterWindow = new BrowserWindow({
    width: 320,
    height: 400,
    frame: false,
    transparent: true,
    backgroundColor: '#0f0f10',
    icon: path.join(__dirname, 'assets/filekit.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Filekit Updater'
  });

  updaterWindow.loadFile(path.join(__dirname, 'src', 'updater.html'));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 750,
    backgroundColor: '#0f0f10',
    icon: path.join(__dirname, 'assets/filekit.png'),
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Filekit'
  });

  setMainWindow(mainWindow);

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('close', (e) => {
    const keepInTray = store.get('keepInTray', true);
    if (!shouldQuit && keepInTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/filekit.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mostrar', click: () => mainWindow.show() },
    { label: 'Sair', click: () => { shouldQuit = true; app.quit(); } }
  ]);
  tray.setToolTip('Filekit');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  pluginsDir = path.join(app.getPath('userData'), 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }
  setPluginsDir(pluginsDir);
  setConvPluginsDir(pluginsDir);

  cookiesDir = path.join(app.getPath('userData'), 'cookies');
  if (!fs.existsSync(cookiesDir)) {
    fs.mkdirSync(cookiesDir, { recursive: true });
  }
  setCookiesDir(cookiesDir);

  // iniciar com o sistema
  const startOnBoot = store.get('startOnBoot', false);
  app.setLoginItemSettings({
    openAtLogin: startOnBoot
  });

  createUpdaterWindow();

  // ! ATENÇÃO: DESCOMENTAR APENAS PARA DESENVOLVIMENTO LOCAL (! TESTE): 
  // Comente "createUpdaterWindow();" e descomente "createWindow();" p/
  // você usar o aplicativo sem problemas, com o updater descomentado o
  // app não inicia no pc local. [Doe: https://livepix.gg/jhordan] 

  //createWindow();

  // Checar atualizações
  if (updaterWindow) {
    updaterWindow.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify().catch(err => {
            console.error("Erro ao checar atualizações:", err);
        });
    });
  }

  // Status
  autoUpdater.on('update-available', (info) => {
    if (updaterWindow) updaterWindow.webContents.send('updater-status', { state: 'available', info });
  });

  autoUpdater.on('download-progress', (progress) => {
    if (updaterWindow) updaterWindow.webContents.send('updater-status', { state: 'downloading', progress });
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (updaterWindow) updaterWindow.webContents.send('updater-status', { state: 'downloaded', info });
  });

  autoUpdater.on('update-not-available', () => {
    if (updaterWindow && !updaterWindow.isDestroyed()) {
        updaterWindow.close();
    }

    createWindow();
  });

  // Caso der erro
  autoUpdater.on('error', (err) => {
    console.error("Update error: ", err);
    if (updaterWindow && !updaterWindow.isDestroyed()) {
        updaterWindow.webContents.send('updater-status', { state: 'error', error: err.message });
        setTimeout(() => {
          if (!updaterWindow.isDestroyed()) updaterWindow.close();
          if (!mainWindow) {
            createWindow();
            createTray();
          }
        }, 2000);
    } else {
        if (!mainWindow) {
          createWindow();
          createTray();
        }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  shouldQuit = true;
});

// IPCs
// Selecionar pasta do arquivo ao ser baixado
ipcMain.handle('choose-folder', async (event, defaultPath) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolher pasta de destino',
    defaultPath: defaultPath || app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('detect-platform', (event, url) => {
  return detectPlatformFromUrl(url);
});

// ATUALIZAÇÃO: Começar download
ipcMain.handle('start-download', async (event, payload) => {
  try {
    const result = await handleDownloadRequest(payload);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Abrir Pasta PLUGINS
ipcMain.handle('open-plugins-folder', () => {
  if (pluginsDir) {
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }
    
    shell.openPath(pluginsDir);
    return { ok: true, path: pluginsDir };
  }
  return { ok: false, error: 'Plugins dir not set' };
});

// Abrir Pasta COOKIES
ipcMain.handle('open-cookies-folder', () => {
  if (cookiesDir) {
    if (!fs.existsSync(cookiesDir)) {
      fs.mkdirSync(cookiesDir, { recursive: true });
    }
    
    shell.openPath(cookiesDir);
    return { ok: true, path: cookiesDir };
  }
  return { ok: false, error: 'Cookies dir not set' };
});

ipcMain.handle('get-settings', () => {
  return {
    startOnBoot: store.get('startOnBoot', false),
    keepInTray: store.get('keepInTray', true),
    version: app.getVersion()
  };
});

// ATUALIZAÇÃO: Atualizar app - novo
ipcMain.handle('install-update-now', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('set-settings', (event, settings) => {
  if (typeof settings.startOnBoot === 'boolean') {
    store.set('startOnBoot', settings.startOnBoot);
    app.setLoginItemSettings({ openAtLogin: settings.startOnBoot });
  }
  if (typeof settings.keepInTray === 'boolean') {
    store.set('keepInTray', settings.keepInTray);
  }
  return { ok: true };
});

ipcMain.handle('check-plugins', async () => {
  const pluginsDir = path.join(app.getPath('userData'), 'plugins');
  return {
    yt: fs.existsSync(path.join(pluginsDir, 'yt-dlp.exe')),
    ff: fs.existsSync(path.join(pluginsDir, 'ffmpeg.exe')),
    spotdl: fs.existsSync(path.join(pluginsDir, 'spotdl.exe')),
    spud: fs.existsSync(path.join(pluginsDir, 'spud.exe'))
  };
});

ipcMain.handle('open-web-popup', (event, url) => {
  const parent = BrowserWindow.fromWebContents(event.sender);
  const bounds = parent ? parent.getBounds() : { width: 1050, height: 650 };

  const popup = new BrowserWindow({
    width: Math.floor(bounds.width * 0.95),
    height: Math.floor(bounds.height * 0.95),
    parent: parent || undefined,
    modal: false,
    backgroundColor: '#0f0f10',
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true
    },
    title: 'Filekit - Web'
  });

  popup.loadURL(url);
  // popup.webContents.on('will-navigate', ...)
  return { ok: true };
});

// Salvar Histórico (15 itens por vez)
ipcMain.handle('add-download-log', (event, entry) => {
  const logPath = path.join(app.getPath('userData'), 'downloads.json');
  let logs = [];
  if (fs.existsSync(logPath)) {
    try {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    } catch (e) {
      logs = [];
    }
  }
  logs.unshift({
    ...entry,
    date: entry.date || new Date().toISOString(),
  });
  if (logs.length > 200) logs = logs.slice(0, 200);
  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  return { ok: true };
});

ipcMain.handle('get-download-logs', () => {
  const logPath = path.join(app.getPath('userData'), 'downloads.json');
  if (!fs.existsSync(logPath)) return [];
  try {
    const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    return logs;
  } catch (e) {
    return [];
  }
});

// Abrir local do arquivo
ipcMain.handle('open-file-location', (event, filePath) => {
  if (!filePath) return { ok: false, error: 'Sem caminho.' };
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return { ok: true };
  }
  return { ok: false, error: 'Arquivo não existe mais.' };
});

// NOVO: Escolher arquivo
ipcMain.handle('pick-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Escolher arquivo',
    properties: ['openFile']
  });
  if (canceled || !filePaths || !filePaths.length) return null;
  return filePaths[0];
});

// NOVO: Converter arquivos
ipcMain.handle('convert-file', async (event, payload) => {
  try {
    const res = await convertFile(event, payload);
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});