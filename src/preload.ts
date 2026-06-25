import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  JITBIT_GET_TICKETS: 'jitbit:getTickets',
  JITBIT_REFRESH: 'jitbit:refresh',
  JITBIT_GET_COMMENTS: 'jitbit:getComments',
  JITBIT_REPLY: 'jitbit:reply',
  JITBIT_CLOSE: 'jitbit:close',
  JITBIT_DISMISS: 'jitbit:dismiss',
  JITBIT_RESTORE: 'jitbit:restore',
  JITBIT_VALIDATE: 'jitbit:validate',
  ASANA_CREATE_TASK: 'asana:createTask',
  ASANA_VALIDATE: 'asana:validate',
  ASANA_SEARCH_PROJECTS: 'asana:searchProjects',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:getAll',
  APP_OPEN_EXTERNAL: 'app:openExternal',
  APP_SHOW_PREFERENCES: 'app:showPreferences',
  APP_QUIT: 'app:quit',
  APP_HIDE_MENU: 'app:hideMenu',
  DATA_UPDATED: 'data:updated',
  REFRESH_STATUS: 'refresh:status',
  ERROR_OCCURRED: 'error:occurred',
};

const api = {
  jitbit: {
    getTickets: () => ipcRenderer.invoke(IPC_CHANNELS.JITBIT_GET_TICKETS),
    refresh: () => ipcRenderer.invoke(IPC_CHANNELS.JITBIT_REFRESH),
    getComments: (ticketId: number) => ipcRenderer.invoke(IPC_CHANNELS.JITBIT_GET_COMMENTS, ticketId),
    reply: (ticketId: number, body: string) => ipcRenderer.invoke(IPC_CHANNELS.JITBIT_REPLY, ticketId, body),
    close: (ticketId: number, reply?: string) => ipcRenderer.invoke(IPC_CHANNELS.JITBIT_CLOSE, ticketId, reply),
    dismiss: (ticketId: number) => ipcRenderer.invoke(IPC_CHANNELS.JITBIT_DISMISS, ticketId),
    restore: () => ipcRenderer.invoke(IPC_CHANNELS.JITBIT_RESTORE),
    validate: (url: string, token: string) => ipcRenderer.invoke(IPC_CHANNELS.JITBIT_VALIDATE, url, token),
  },

  asana: {
    createTask: (ticket: any) => ipcRenderer.invoke(IPC_CHANNELS.ASANA_CREATE_TASK, ticket),
    validate: (token: string) => ipcRenderer.invoke(IPC_CHANNELS.ASANA_VALIDATE, token),
    searchProjects: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.ASANA_SEARCH_PROJECTS, query),
  },

  config: {
    get: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, key),
    set: (key: string, value: any) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, key, value),
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_ALL),
  },

  app: {
    openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_EXTERNAL, url),
    showPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.APP_SHOW_PREFERENCES),
    quit: () => ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT),
    hideMenu: () => ipcRenderer.invoke(IPC_CHANNELS.APP_HIDE_MENU),
  },

  on: {
    dataUpdated: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.DATA_UPDATED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.DATA_UPDATED, handler);
    },
    refreshStatus: (callback: (status: string) => void) => {
      const handler = (_: any, status: string) => callback(status);
      ipcRenderer.on(IPC_CHANNELS.REFRESH_STATUS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.REFRESH_STATUS, handler);
    },
    error: (callback: (error: string) => void) => {
      const handler = (_: any, error: string) => callback(error);
      ipcRenderer.on(IPC_CHANNELS.ERROR_OCCURRED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.ERROR_OCCURRED, handler);
    },
  },
};

contextBridge.exposeInMainWorld('jitbitbar', api);
