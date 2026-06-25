import { Notification, shell } from 'electron';
import { Ticket } from '../../shared/types';
import { config } from '../store/config';

const notifiedTickets = new Set<number>();

export function notifyNewTicket(ticket: Ticket): void {
  const notifConfig = config.get('notifications');
  if (!notifConfig?.enabled || !notifConfig?.newTicket) return;
  if (notifiedTickets.has(ticket.id)) return;

  const notification = new Notification({
    title: `Nouveau ticket #${ticket.id}`,
    body: `${ticket.subject}${ticket.userName ? `\nDe : ${ticket.userName}` : ''}`,
    silent: false,
  });

  notification.on('click', () => {
    if (ticket.url) shell.openExternal(ticket.url);
  });

  notification.show();
  notifiedTickets.add(ticket.id);
}

export function checkNewTickets(oldTickets: Ticket[], newTickets: Ticket[]): void {
  // Don't fire a wall of notifications on the very first load.
  if (oldTickets.length === 0) {
    newTickets.forEach((t) => notifiedTickets.add(t.id));
    return;
  }
  const oldIds = new Set(oldTickets.map((t) => t.id));
  for (const ticket of newTickets) {
    if (!oldIds.has(ticket.id)) notifyNewTicket(ticket);
  }
}

export function cleanNotificationCache(): void {
  if (notifiedTickets.size > 1000) {
    const entries = Array.from(notifiedTickets);
    entries.slice(0, entries.length - 500).forEach((id) => notifiedTickets.delete(id));
  }
}
