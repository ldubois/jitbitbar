interface JitBitBarAPI {
  jitbit: {
    getTickets: () => Promise<any>;
    refresh: () => Promise<any>;
    getComments: (ticketId: number) => Promise<any>;
    reply: (ticketId: number, body: string) => Promise<{ success: boolean; error?: string }>;
    close: (ticketId: number, reply?: string) => Promise<{ success: boolean; error?: string }>;
    dismiss: (ticketId: number) => Promise<any>;
    restore: () => Promise<any>;
    validate: (url: string, token: string) => Promise<{ valid: boolean }>;
  };

  asana: {
    createTask: (ticket: any) => Promise<{ success: boolean; url?: string; error?: string }>;
    validate: (token: string) => Promise<{ valid: boolean; name?: string | null }>;
    searchProjects: (query: string) => Promise<{ gid: string; name: string }[]>;
  };

  config: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<any>;
    getAll: () => Promise<any>;
  };

  app: {
    openExternal: (url: string) => Promise<any>;
    showPreferences: () => Promise<any>;
    quit: () => Promise<any>;
    hideMenu: () => Promise<any>;
  };

  on: {
    dataUpdated: (callback: (data: any) => void) => () => void;
    refreshStatus: (callback: (status: string) => void) => () => void;
    error: (callback: (error: string) => void) => () => void;
  };
}

interface Window {
  jitbitbar: JitBitBarAPI;
}
