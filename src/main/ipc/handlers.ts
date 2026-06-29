import { ipcMain, shell, app } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import { config } from '../store/config';
import { keychain } from '../store/keychain';
import { pollingService, buildJitbitClient } from '../services/polling';
import { trayManager } from '../tray';
import { JitbitClient } from '../api/jitbit';
import { AsanaClient } from '../api/asana';
import { AppConfig, Ticket } from '../../shared/types';

function buildAsanaClient(): AsanaClient | null {
  const token = keychain.getToken('asana');
  return token ? new AsanaClient(token) : null;
}

export function setupIpcHandlers(): void {
  // ===== Jitbit data =====

  ipcMain.handle(IPC_CHANNELS.JITBIT_GET_TICKETS, () => pollingService.getData().tickets);

  ipcMain.handle(IPC_CHANNELS.JITBIT_REFRESH, async () => pollingService.refresh());

  ipcMain.handle(IPC_CHANNELS.JITBIT_GET_COMMENTS, async (_, ticketId: number) => {
    const client = buildJitbitClient();
    if (!client) return [];
    // Full conversation: original message + replies (system lines filtered out).
    return client.getThread(Number(ticketId));
  });

  ipcMain.handle(IPC_CHANNELS.JITBIT_REPLY, async (_, ticketId: number, body: string) => {
    const client = buildJitbitClient();
    if (!client) return { success: false, error: 'Jitbit non configuré' };
    const ok = await client.reply(Number(ticketId), body);
    return ok ? { success: true } : { success: false, error: "Échec de l'envoi" };
  });

  ipcMain.handle(
    IPC_CHANNELS.JITBIT_CLOSE,
    async (_, ticketId: number, reply?: string) => {
      const client = buildJitbitClient();
      if (!client) return { success: false, error: 'Jitbit non configuré' };
      const id = Number(ticketId);

      if (reply && reply.trim()) {
        const replied = await client.reply(id, reply.trim());
        if (!replied) return { success: false, error: "Échec de l'envoi de la réponse" };
      }

      const closed = await client.close(id);
      if (!closed) return { success: false, error: 'Échec de la clôture' };

      // Complete the linked Asana task, if any.
      const link = config.getLinkedAsana(id);
      if (link) {
        const asana = buildAsanaClient();
        if (asana) await asana.completeTask(link.gid);
        config.unlinkAsana(id);
      }

      await pollingService.refresh();
      return { success: true };
    }
  );

  ipcMain.handle(IPC_CHANNELS.JITBIT_DISMISS, (_, ticketId: number) => {
    const dismissed = config.get('dismissedTickets') || [];
    const id = Number(ticketId);
    if (!dismissed.includes(id)) {
      config.set('dismissedTickets', [...dismissed, id]);
    }
    pollingService.recalculateStatus();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.JITBIT_RESTORE, () => {
    config.set('dismissedTickets', []);
    pollingService.recalculateStatus();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.JITBIT_VALIDATE, async (_, url: string, token: string) => {
    try {
      const client = new JitbitClient(url, token);
      const valid = await client.validate();
      return { valid };
    } catch {
      return { valid: false };
    }
  });

  // ===== Asana =====

  ipcMain.handle(IPC_CHANNELS.ASANA_CREATE_TASK, async (_, ticket: Ticket) => {
    const asana = buildAsanaClient();
    if (!asana) return { success: false, error: 'Asana non configuré' };
    const projectGid = config.get('asanaProjectId');
    if (!projectGid) return { success: false, error: 'Aucun projet Asana sélectionné' };

    const link = ticket.url || `Ticket #${ticket.id}`;
    const notes = [
      `Demande Jitbit #${ticket.id}`,
      ticket.userName ? `Demandeur : ${ticket.userName}` : '',
      ticket.categoryName ? `Catégorie : ${ticket.categoryName}` : '',
      '',
      link,
    ]
      .filter(Boolean)
      .join('\n');

    // Don't create a duplicate if this ticket is already linked.
    const existing = config.getLinkedAsana(ticket.id);
    if (existing) return { success: true, url: existing.url, alreadyLinked: true };

    const result = await asana.createTask(projectGid, `[Jitbit #${ticket.id}] ${ticket.subject}`, notes);
    if (!result) return { success: false, error: 'Échec de la création de la tâche' };

    config.linkAsana(ticket.id, result.gid, result.permalinkUrl);
    return { success: true, url: result.permalinkUrl };
  });

  ipcMain.handle(IPC_CHANNELS.ASANA_VALIDATE, async (_, token: string) => {
    const client = new AsanaClient(token);
    const name = await client.validate();
    return { valid: !!name, name };
  });

  ipcMain.handle(IPC_CHANNELS.ASANA_SEARCH_PROJECTS, async (_, query: string) => {
    const asana = buildAsanaClient();
    if (!asana) return [];
    return asana.searchProjects(query);
  });

  // ===== Configuration =====

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_, key: keyof AppConfig) => config.get(key));

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_, key: keyof AppConfig, value: unknown) => {
    // Tokens never go through the plain config store; route them to keychain.
    if (key === ('jitbitToken' as any)) {
      keychain.saveToken('jitbit', String(value));
      pollingService.restart();
      return { success: true };
    }
    if (key === ('asanaToken' as any)) {
      keychain.saveToken('asana', String(value));
      return { success: true };
    }

    config.set(key, value as AppConfig[keyof AppConfig]);
    if (key === 'refreshInterval' || key === 'ticketMode' || key === 'jitbitUrl') {
      pollingService.restart();
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_ALL, () => {
    // Expose whether tokens are present, but never the token values.
    return {
      ...config.getAll(),
      hasJitbitToken: keychain.hasToken('jitbit'),
      hasAsanaToken: keychain.hasToken('asana'),
    };
  });

  // ===== Application =====

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, (_, url: string) => shell.openExternal(url));
  ipcMain.handle(IPC_CHANNELS.APP_SHOW_PREFERENCES, () => trayManager.showPreferencesWindow());
  ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => app.quit());
  ipcMain.handle(IPC_CHANNELS.APP_HIDE_MENU, () => trayManager.hideMenuWindow());
}
