import { app, BrowserWindow } from 'electron';
import { trayManager } from './main/tray';
import { pollingService } from './main/services/polling';
import { setupIpcHandlers } from './main/ipc/handlers';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    trayManager.showPreferencesWindow();
  });

  if (process.platform === 'darwin') {
    app.dock?.hide();
  }

  app.whenReady().then(() => {
    setupIpcHandlers();
    trayManager.initialize();

    pollingService.start((data) => {
      trayManager.updateFromData(data);
    });

    app.on('refresh-data' as any, () => {
      pollingService.refresh();
    });
  });

  app.on('window-all-closed', () => {
    // Do nothing to keep the app open
  });

  app.on('before-quit', () => {
    pollingService.stop();
    trayManager.destroy();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      trayManager.showPreferencesWindow();
    }
  });
}
