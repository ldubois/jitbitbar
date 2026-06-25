export interface NotificationConfig {
  enabled: boolean;
  newTicket: boolean;
}

/** Which tickets to show, maps to the Jitbit `/api/Tickets?mode=` parameter. */
export type TicketMode = 'handledbyme' | 'unanswered' | 'unclosed' | 'all';

export interface AppConfig {
  /** Base helpdesk URL, e.g. https://company.jitbit.com/helpdesk */
  jitbitUrl: string;
  /** Asana project gid where new tasks are created. */
  asanaProjectId: string;
  /** Cached human-readable Asana project name (display only). */
  asanaProjectName: string;

  refreshInterval: number;
  ticketMode: TicketMode;
  launchAtStartup: boolean;
  notifications: NotificationConfig;
  theme: 'system' | 'light' | 'dark';
  /** Ticket IDs hidden from the popover (local only). */
  dismissedTickets: number[];
  /** ticketId -> Asana task gid, so closing also completes the task. */
  linkedAsana: Record<string, string>;
}

export const DEFAULT_CONFIG: AppConfig = {
  jitbitUrl: '',
  asanaProjectId: '',
  asanaProjectName: '',
  refreshInterval: 120000,
  ticketMode: 'handledbyme',
  launchAtStartup: false,
  notifications: {
    enabled: true,
    newTicket: true,
  },
  theme: 'system',
  dismissedTickets: [],
  linkedAsana: {},
};
