import axios, { AxiosInstance, AxiosError } from 'axios';
import { Ticket, TicketComment, TicketMode } from '../../shared/types';

/**
 * Thin REST client for the Jitbit Helpdesk API.
 * Docs: https://www.jitbit.com/helpdesk/helpdesk-api/
 *
 * `baseUrl` is the helpdesk root, e.g. https://company.jitbit.com/helpdesk
 * The REST endpoints live under `${baseUrl}/api`.
 */
export class JitbitClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = JitbitClient.normaliseBaseUrl(baseUrl);

    this.client = axios.create({
      baseURL: `${this.baseUrl}/api`,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return this.client.request(error.config!);
        }
        throw error;
      }
    );
  }

  /** Strip trailing slash and a trailing `/api`, prefix https:// if missing. */
  static normaliseBaseUrl(url: string): string {
    let s = (url || '').trim();
    if (!s) return s;
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    s = s.replace(/\/+$/, '');
    s = s.replace(/\/api$/i, '');
    return s;
  }

  /** Public web URL of a ticket (for "open in Jitbit" and Asana links). */
  ticketUrl(id: number): string {
    return `${this.baseUrl}/Ticket/${id}`;
  }

  /** Returns true if the token is accepted by the helpdesk. */
  async validate(): Promise<boolean> {
    try {
      // Lightweight authenticated call.
      await this.client.get('/Tickets', { params: { count: 1, mode: 'all' } });
      return true;
    } catch {
      return false;
    }
  }

  async getTickets(mode: TicketMode = 'handledbyme', count = 50): Promise<Ticket[]> {
    const response = await this.client.get('/Tickets', { params: { mode, count } });
    const raw = Array.isArray(response.data) ? response.data : [];
    return raw.map((t) => this.normaliseTicket(t));
  }

  async getComments(ticketId: number): Promise<TicketComment[]> {
    try {
      const response = await this.client.get('/comments', { params: { id: ticketId } });
      const raw = Array.isArray(response.data) ? response.data : [];
      return raw.map((c) => ({
        id: c.CommentID ?? c.id ?? 0,
        body: c.Body ?? c.body ?? '',
        userName: c.UserName ?? c.userName,
        date: c.CommentDate ?? c.Date ?? c.date,
        forTechsOnly: c.ForTechsOnly ?? c.forTechsOnly ?? false,
      }));
    } catch {
      return [];
    }
  }

  /** Add a reply to a ticket. `forTechsOnly` keeps it an internal note. */
  async reply(ticketId: number, body: string, forTechsOnly = false): Promise<boolean> {
    try {
      await this.client.post(
        '/comment',
        new URLSearchParams({
          id: String(ticketId),
          body,
          forTechsOnly: forTechsOnly ? 'true' : 'false',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Close a ticket. `suppressNotification` skips the email to the customer. */
  async close(ticketId: number, suppressNotification = false): Promise<boolean> {
    try {
      await this.client.post(
        '/Close',
        new URLSearchParams({
          id: String(ticketId),
          suppressNotification: suppressNotification ? 'true' : 'false',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Map the raw Jitbit ticket object to our normalised shape. */
  private normaliseTicket(t: any): Ticket {
    const id = Number(t.TicketID ?? t.IssueID ?? t.Id ?? t.id ?? 0);
    const statusId = t.StatusID ?? t.StatusId;
    const status = (t.Status ?? '').toString();
    return {
      id,
      subject: t.Subject ?? t.subject ?? '(sans sujet)',
      status,
      statusId: statusId != null ? Number(statusId) : undefined,
      priority: t.Priority != null ? Number(t.Priority) : undefined,
      priorityName: t.PriorityString ?? t.PriorityName,
      categoryName: t.CategoryName ?? t.Category,
      userName: t.UserName ?? t.SubmittedByUserName ?? t.UpdatedByUser,
      assignedToUser: t.AssignedToUserName ?? t.TechFirstName,
      updatedAt: JitbitClient.toIso(t.LastUpdated ?? t.UpdatedAt ?? t.LastUpdate),
      createdAt: JitbitClient.toIso(t.IssueDate ?? t.CreatedAt),
      url: this.ticketUrl(id),
      isClosed: typeof t.IsClosed === 'boolean' ? t.IsClosed : status.toLowerCase() === 'closed',
      preview: typeof t.Body === 'string' ? JitbitClient.stripHtml(t.Body).slice(0, 140) : undefined,
    };
  }

  /** Jitbit may serialise dates as ISO or as `/Date(ms)/`. */
  static toIso(raw: unknown): string | undefined {
    if (!raw || typeof raw !== 'string') return undefined;
    const m = raw.match(/\/Date\((-?\d+)\)\//);
    if (m) return new Date(Number(m[1])).toISOString();
    const d = new Date(raw);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  static stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
  }
}
