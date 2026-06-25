import axios, { AxiosInstance } from 'axios';

export interface AsanaProject {
  gid: string;
  name: string;
}

export interface AsanaTaskResult {
  gid: string;
  permalinkUrl: string;
}

/**
 * Minimal Asana REST client (Personal Access Token).
 * Docs: https://developers.asana.com/reference
 */
export class AsanaClient {
  private client: AxiosInstance;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: 'https://app.asana.com/api/1.0',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /** Returns the authenticated user's name, or null if the token is invalid. */
  async validate(): Promise<string | null> {
    try {
      const res = await this.client.get('/users/me', { params: { opt_fields: 'name' } });
      return res.data?.data?.name ?? 'OK';
    } catch {
      return null;
    }
  }

  /** Search the user's projects by name (typeahead) for the settings picker. */
  async searchProjects(query: string): Promise<AsanaProject[]> {
    try {
      const me = await this.client.get('/users/me', { params: { opt_fields: 'workspaces.name' } });
      const workspaces: any[] = me.data?.data?.workspaces ?? [];
      const results: AsanaProject[] = [];
      for (const ws of workspaces) {
        const res = await this.client.get(`/workspaces/${ws.gid}/typeahead`, {
          params: { resource_type: 'project', query, count: 20, opt_fields: 'name' },
        });
        for (const p of res.data?.data ?? []) {
          results.push({ gid: p.gid, name: p.name });
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  async createTask(projectGid: string, name: string, notes: string): Promise<AsanaTaskResult | null> {
    try {
      const res = await this.client.post('/tasks', {
        data: { name, notes, projects: [projectGid] },
      });
      const d = res.data?.data ?? {};
      return { gid: d.gid ?? '', permalinkUrl: d.permalink_url ?? '' };
    } catch {
      return null;
    }
  }

  async completeTask(gid: string): Promise<boolean> {
    try {
      await this.client.put(`/tasks/${gid}`, { data: { completed: true } });
      return true;
    } catch {
      return false;
    }
  }
}
