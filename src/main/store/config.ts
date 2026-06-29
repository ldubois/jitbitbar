import Store from 'electron-store';
import { AppConfig, AsanaLink, DEFAULT_CONFIG } from '../../shared/types/config';

const configStore = new Store<AppConfig>({
  name: 'config',
  defaults: DEFAULT_CONFIG,
});

export const config = {
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return (configStore as any).get(key);
  },

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    (configStore as any).set(key, value);
  },

  getAll(): AppConfig {
    return configStore.store;
  },

  setAll(newConfig: Partial<AppConfig>): void {
    Object.entries(newConfig).forEach(([key, value]) => {
      if (value !== undefined) {
        (configStore as any).set(key as keyof AppConfig, value);
      }
    });
  },

  reset(): void {
    (configStore as any).clear();
    Object.entries(DEFAULT_CONFIG).forEach(([key, value]) => {
      (configStore as any).set(key as keyof AppConfig, value);
    });
  },

  getRefreshInterval(): number {
    return Math.max(30000, (configStore as any).get('refreshInterval', DEFAULT_CONFIG.refreshInterval));
  },

  isJitbitConfigured(): boolean {
    return !!this.get('jitbitUrl');
  },

  linkAsana(ticketId: number, taskGid: string, url: string): void {
    const links = { ...(this.get('linkedAsana') || {}) };
    links[String(ticketId)] = { gid: taskGid, url };
    this.set('linkedAsana', links);
  },

  unlinkAsana(ticketId: number): void {
    const links = { ...(this.get('linkedAsana') || {}) };
    delete links[String(ticketId)];
    this.set('linkedAsana', links);
  },

  getLinkedAsana(ticketId: number): AsanaLink | undefined {
    return (this.get('linkedAsana') || {})[String(ticketId)];
  },
};
