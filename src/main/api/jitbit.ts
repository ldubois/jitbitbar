import axios, { AxiosInstance, AxiosError } from 'axios';
import { Ticket, TicketComment, TicketMode, ThreadMessage } from '../../shared/types';

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
        body: JitbitClient.stripHtml(c.Body ?? c.body ?? ''),
        userName: JitbitClient.fullName(c.FirstName, c.LastName) ?? c.UserName ?? c.userName,
        date: c.CommentDate ?? c.Date ?? c.date,
        forTechsOnly: c.ForTechsOnly ?? c.forTechsOnly ?? false,
        isSystem: c.IsSystem ?? false,
      }));
    } catch {
      return [];
    }
  }

  /** Fetch the ticket's original message (Body) and meta. */
  async getTicketBody(ticketId: number): Promise<{ subject: string; body: string; date?: string; requester?: string } | null> {
    try {
      const r = await this.client.get('/ticket', { params: { id: ticketId } });
      const t = r.data ?? {};
      const requester =
        t.SubmitterUserInfo?.Username ??
        JitbitClient.fullName(t.SubmitterUserInfo?.FirstName, t.SubmitterUserInfo?.LastName) ??
        JitbitClient.fullName(t.FirstName, t.LastName) ??
        t.UserName;
      return {
        subject: t.Subject ?? '',
        body: JitbitClient.stripHtml(t.Body ?? ''),
        date: JitbitClient.toIso(t.IssueDate),
        requester,
      };
    } catch {
      return null;
    }
  }

  /** Combined conversation thread: original message first, then comments. */
  async getThread(ticketId: number): Promise<ThreadMessage[]> {
    const [ticket, comments] = await Promise.all([this.getTicketBody(ticketId), this.getComments(ticketId)]);
    const messages: ThreadMessage[] = [];
    if (ticket && ticket.body) {
      messages.push({ author: ticket.requester || 'Demandeur', date: ticket.date, body: ticket.body, kind: 'original' });
    }
    for (const c of comments) {
      if (c.isSystem) continue; // skip system log lines
      // Avoid duplicating the original message if Jitbit returns it as first comment.
      if (ticket && messages.length === 1 && c.body && c.body === ticket.body) continue;
      messages.push({
        author: c.userName || '?',
        date: c.date,
        body: c.body,
        kind: 'comment',
        forTechsOnly: c.forTechsOnly,
      });
    }
    return messages;
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
      categoryName: t.Category ?? t.CategoryName,
      userName: JitbitClient.fullName(t.FirstName, t.LastName) ?? t.UserName ?? t.SubmittedByUserName,
      assignedToUser: t.Technician ?? JitbitClient.fullName(t.TechFirstName, t.TechLastName) ?? t.AssignedToUserName,
      updatedAt: JitbitClient.toIso(t.LastUpdated ?? t.UpdatedAt ?? t.LastUpdate),
      createdAt: JitbitClient.toIso(t.IssueDate ?? t.CreatedAt),
      url: this.ticketUrl(id),
      isClosed:
        typeof t.IsClosed === 'boolean'
          ? t.IsClosed
          : !!t.ResolvedDate || /clos|ferm|résol|resol|closed/i.test(status),
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

  /** Join first/last name, returning undefined when both are empty. */
  static fullName(first?: unknown, last?: unknown): string | undefined {
    const parts = [first, last].filter((p) => typeof p === 'string' && p.trim()).map((p) => (p as string).trim());
    return parts.length ? parts.join(' ') : undefined;
  }

  static stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
