import { BrowserWindow } from 'electron';
import { Ticket, TrayStatus } from '../../shared/types';
import { config } from '../store/config';
import { keychain } from '../store/keychain';
import { JitbitClient } from '../api/jitbit';
import { checkNewTickets, cleanNotificationCache } from './notifications';

export type { TrayStatus };

export interface PollingData {
  tickets: Ticket[];
  lastUpdated: Date;
  status: TrayStatus;
  error?: string;
}

const IPC_CHANNELS = {
  DATA_UPDATED: 'data:updated',
};

/** Build a Jitbit client from the stored config + keychain token, or null. */
export function buildJitbitClient(): JitbitClient | null {
  const url = config.get('jitbitUrl');
  const token = keychain.getToken('jitbit');
  if (!url || !token) return null;
  return new JitbitClient(url, token);
}

class PollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private lastData: PollingData = {
    tickets: [],
    lastUpdated: new Date(),
    status: 'gray',
  };
  private onDataUpdate: ((data: PollingData) => void) | null = null;
  private isRefreshing = false;

  start(callback?: (data: PollingData) => void): void {
    if (callback) this.onDataUpdate = callback;
    this.stop();
    this.refresh();
    this.intervalId = setInterval(() => this.refresh(), config.getRefreshInterval());
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  restart(): void {
    this.start(this.onDataUpdate || undefined);
  }

  async refresh(): Promise<PollingData> {
    if (this.isRefreshing) return this.lastData;
    this.isRefreshing = true;

    try {
      const client = buildJitbitClient();
      if (!client) {
        this.lastData = { tickets: [], lastUpdated: new Date(), status: 'gray' };
        this.emitUpdate();
        return this.lastData;
      }

      const mode = config.get('ticketMode') || 'handledbyme';
      const tickets = await client.getTickets(mode, 50);
      const open = tickets.filter((t) => !t.isClosed);

      checkNewTickets(this.lastData.tickets, open);

      this.lastData = {
        tickets: open,
        lastUpdated: new Date(),
        status: this.calculateStatus(open),
      };

      cleanNotificationCache();
      this.emitUpdate();
      return this.lastData;
    } catch (error) {
      this.lastData = {
        ...this.lastData,
        lastUpdated: new Date(),
        status: 'gray',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.emitUpdate();
      return this.lastData;
    } finally {
      this.isRefreshing = false;
    }
  }

  private visibleTickets(tickets: Ticket[]): Ticket[] {
    const dismissed = config.get('dismissedTickets') || [];
    return tickets.filter((t) => !dismissed.includes(t.id));
  }

  private calculateStatus(tickets: Ticket[]): TrayStatus {
    const visible = this.visibleTickets(tickets);
    if (visible.length === 0) return 'gray';
    // "New" / unanswered tickets demand attention -> red.
    const needsAttention = visible.some((t) => severityOf(t) === 'error');
    if (needsAttention) return 'red';
    const inProgress = visible.some((t) => severityOf(t) === 'warning');
    if (inProgress) return 'orange';
    return 'green';
  }

  private emitUpdate(): void {
    const visible = this.visibleTickets(this.lastData.tickets);
    const dataForRenderer = { ...this.lastData, tickets: visible };

    if (this.onDataUpdate) this.onDataUpdate(dataForRenderer);

    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.DATA_UPDATED, dataForRenderer);
      }
    });
  }

  getData(): PollingData {
    return this.lastData;
  }

  recalculateStatus(): void {
    this.lastData = { ...this.lastData, status: this.calculateStatus(this.lastData.tickets) };
    this.emitUpdate();
  }
}

/** Severity bucket for a ticket, driving the coloured dot + tray colour. */
export function severityOf(t: Ticket): 'error' | 'warning' | 'info' {
  const status = (t.status || '').toLowerCase();
  // New / unanswered -> needs action.
  if (t.statusId === 1 || status.includes('new') || status.includes('nouveau')) return 'error';
  if (status.includes('progress') || status.includes('cours') || status.includes('hold') || status.includes('attente')) {
    return 'warning';
  }
  if ((t.priority ?? 0) >= 2) return 'error';
  if ((t.priority ?? 0) === 1) return 'warning';
  return 'info';
}

export const pollingService = new PollingService();
