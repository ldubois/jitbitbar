export const IPC_CHANNELS = {
  // Jitbit data
  JITBIT_GET_TICKETS: 'jitbit:getTickets',
  JITBIT_REFRESH: 'jitbit:refresh',
  JITBIT_GET_COMMENTS: 'jitbit:getComments',
  JITBIT_REPLY: 'jitbit:reply',
  JITBIT_CLOSE: 'jitbit:close',
  JITBIT_DISMISS: 'jitbit:dismiss',
  JITBIT_RESTORE: 'jitbit:restore',
  JITBIT_VALIDATE: 'jitbit:validate',

  // Asana
  ASANA_CREATE_TASK: 'asana:createTask',
  ASANA_VALIDATE: 'asana:validate',
  ASANA_SEARCH_PROJECTS: 'asana:searchProjects',

  // Configuration
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:getAll',

  // Application
  APP_OPEN_EXTERNAL: 'app:openExternal',
  APP_SHOW_PREFERENCES: 'app:showPreferences',
  APP_QUIT: 'app:quit',
  APP_HIDE_MENU: 'app:hideMenu',

  // Events (main -> renderer)
  DATA_UPDATED: 'data:updated',
  REFRESH_STATUS: 'refresh:status',
  ERROR_OCCURRED: 'error:occurred',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
