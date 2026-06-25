import { Tray, Menu, nativeImage, BrowserWindow, screen, app, Notification } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { PollingData, TrayStatus } from './services/polling';

const ICONS_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets/icons')
  : path.join(app.getAppPath(), 'assets/icons');

const RENDERER_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'renderer')
  : path.join(app.getAppPath(), 'src/renderer');

const windowStore = new Store<{ menuWindowSize: { width: number; height: number } }>({
  name: 'window-state',
  defaults: {
    menuWindowSize: { width: 500, height: 650 },
  },
});

class TrayManager {
  private tray: Tray | null = null;
  private menuWindow: BrowserWindow | null = null;
  private preferencesWindow: BrowserWindow | null = null;
  private currentStatus: TrayStatus = 'gray';
  private badgeCount = 0;

  private getIconPath(status: TrayStatus): string {
    return path.join(ICONS_PATH, `tray-${status}.png`);
  }

  private createTrayIcon(status: TrayStatus): Electron.NativeImage {
    try {
      const iconPath = this.getIconPath(status);
      const icon2xPath = path.join(ICONS_PATH, `tray-${status}@2x.png`);

      const icon = nativeImage.createFromPath(iconPath);

      if (icon.isEmpty()) {
        return this.createFallbackIcon(status);
      }

      try {
        const icon2x = nativeImage.createFromPath(icon2xPath);
        if (!icon2x.isEmpty()) {
          icon.addRepresentation({
            scaleFactor: 2,
            width: 32,
            height: 32,
            buffer: icon2x.toPNG(),
          });
        }
      } catch (e) {
        // @2x not found, using 1x only
      }

      return icon;
    } catch (error) {
      return this.createFallbackIcon(status);
    }
  }

  private createFallbackIcon(status: TrayStatus = 'gray'): Electron.NativeImage {
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);

    const colors: Record<TrayStatus, [number, number, number]> = {
      green: [16, 185, 129],
      orange: [245, 158, 11],
      red: [239, 68, 68],
      gray: [128, 128, 128],
    };
    const [r, g, b] = colors[status];

    const center = size / 2;
    const radius = 6;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
        if (dist <= radius) {
          canvas[offset] = r;
          canvas[offset + 1] = g;
          canvas[offset + 2] = b;
          canvas[offset + 3] = 255;
        } else if (dist <= radius + 1) {
          const alpha = Math.max(0, (radius + 1 - dist)) * 255;
          canvas[offset] = r;
          canvas[offset + 1] = g;
          canvas[offset + 2] = b;
          canvas[offset + 3] = Math.round(alpha);
        }
      }
    }

    return nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  initialize(): void {
    const icon = this.createFallbackIcon('gray');
    this.tray = new Tray(icon);
    this.tray.setToolTip('JitBitBar');

    this.tray.on('click', (event, bounds) => {
      this.toggleMenuWindow(bounds);
    });

    this.tray.on('right-click', () => {
      this.showContextMenu();
    });

    if (Notification.isSupported()) {
      new Notification({
        title: 'JitBitBar',
        body: 'Application started',
      }).show();
    }
  }

  private toggleMenuWindow(bounds: Electron.Rectangle): void {
    if (this.menuWindow && !this.menuWindow.isDestroyed()) {
      if (this.menuWindow.isVisible()) {
        this.menuWindow.hide();
        return;
      }
      this.menuWindow.show();
      this.positionWindow(this.menuWindow, bounds);
      return;
    }
    this.createMenuWindow(bounds);
  }

  private createMenuWindow(bounds: Electron.Rectangle): void {
    const savedSize = windowStore.get('menuWindowSize', { width: 500, height: 650 });

    this.menuWindow = new BrowserWindow({
      width: savedSize.width,
      height: savedSize.height,
      minWidth: 400,
      minHeight: 400,
      maxWidth: 800,
      maxHeight: 900,
      show: false,
      frame: false,
      resizable: true,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      hasShadow: true,
      backgroundColor: '#0a0a0b',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.menuWindow.on('resize', () => {
      if (this.menuWindow && !this.menuWindow.isDestroyed()) {
        const [width, height] = this.menuWindow.getSize();
        windowStore.set('menuWindowSize', { width, height });
      }
    });

    const indexPath = path.join(RENDERER_PATH, 'index.html');
    this.menuWindow.loadFile(indexPath);

    this.positionWindow(this.menuWindow, bounds);
    this.menuWindow.show();

    this.menuWindow.on('blur', () => {
      if (this.menuWindow && !this.menuWindow.isDestroyed()) {
        this.menuWindow.hide();
      }
    });

    this.menuWindow.on('closed', () => {
      this.menuWindow = null;
    });
  }

  private positionWindow(window: BrowserWindow, trayBounds: Electron.Rectangle): void {
    const windowBounds = window.getBounds();
    const display = screen.getDisplayMatching(trayBounds);

    let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
    const y = Math.round(trayBounds.y + trayBounds.height);

    if (x < display.bounds.x) {
      x = display.bounds.x;
    }
    if (x + windowBounds.width > display.bounds.x + display.bounds.width) {
      x = display.bounds.x + display.bounds.width - windowBounds.width;
    }

    window.setPosition(x, y);
  }

  private showContextMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Refresh',
        click: () => app.emit('refresh-data'),
      },
      { type: 'separator' },
      {
        label: 'Preferences...',
        click: () => this.showPreferencesWindow(),
      },
      { type: 'separator' },
      {
        label: 'Quit JitBitBar',
        click: () => app.quit(),
      },
    ]);
    this.tray?.popUpContextMenu(contextMenu);
  }

  showPreferencesWindow(): void {
    if (this.preferencesWindow && !this.preferencesWindow.isDestroyed()) {
      this.preferencesWindow.show();
      this.preferencesWindow.focus();
      return;
    }

    this.preferencesWindow = new BrowserWindow({
      width: 700,
      height: 500,
      minWidth: 600,
      minHeight: 400,
      show: false,
      title: 'JitBitBar - Preferences',
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#0a0a0b',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const prefsPath = path.join(RENDERER_PATH, 'preferences.html');
    this.preferencesWindow.loadFile(prefsPath);

    this.preferencesWindow.once('ready-to-show', () => {
      const trayBounds = this.tray?.getBounds();
      if (trayBounds) {
        const display = screen.getDisplayMatching(trayBounds);
        const windowBounds = this.preferencesWindow!.getBounds();
        const x = Math.round(display.bounds.x + (display.bounds.width - windowBounds.width) / 2);
        const y = Math.round(display.bounds.y + (display.bounds.height - windowBounds.height) / 2);
        this.preferencesWindow!.setPosition(x, y);
      }
      this.preferencesWindow?.show();
    });

    this.preferencesWindow.on('closed', () => {
      this.preferencesWindow = null;
    });
  }

  updateIcon(status: TrayStatus): void {
    if (!this.tray || this.currentStatus === status) return;
    this.currentStatus = status;
    const icon = this.createFallbackIcon(status);
    this.tray.setImage(icon);
  }

  updateBadge(count: number): void {
    if (!this.tray || this.badgeCount === count) return;
    this.badgeCount = count;
    const tooltip = count > 0 ? `JitBitBar - ${count} ticket(s)` : 'JitBitBar';
    this.tray.setToolTip(tooltip);
  }

  updateFromData(data: PollingData): void {
    this.updateIcon(data.status);
    this.updateBadge(data.tickets.length);
  }

  hideMenuWindow(): void {
    if (this.menuWindow && !this.menuWindow.isDestroyed()) {
      this.menuWindow.hide();
    }
  }

  destroy(): void {
    if (this.menuWindow && !this.menuWindow.isDestroyed()) {
      this.menuWindow.close();
    }
    if (this.preferencesWindow && !this.preferencesWindow.isDestroyed()) {
      this.preferencesWindow.close();
    }
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

export const trayManager = new TrayManager();
