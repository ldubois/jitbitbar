/**
 * Normalised Jitbit ticket, as exposed to the renderer.
 * Built from the raw `/api/Tickets` payload (field names vary across
 * Jitbit versions, so the client normalises them).
 */
export interface Ticket {
  id: number;
  subject: string;
  status: string;
  statusId?: number;
  priority?: number;
  priorityName?: string;
  categoryName?: string;
  /** The person who opened the ticket. */
  userName?: string;
  /** Technician currently assigned. */
  assignedToUser?: string;
  /** ISO date of the last update. */
  updatedAt?: string;
  /** ISO date the ticket was opened. */
  createdAt?: string;
  /** Public web URL of the ticket (for "open in Jitbit" / Asana link). */
  url: string;
  isClosed?: boolean;
  /** First lines of the ticket body, when available. */
  preview?: string;
  /** Permalink of the linked Asana task, if this ticket was pushed to Asana. */
  asanaUrl?: string;
}

/** A single message/comment on a ticket, from `/api/comments`. */
export interface TicketComment {
  id: number;
  body: string;
  userName?: string;
  date?: string;
  forTechsOnly?: boolean;
  isSystem?: boolean;
}

/** One entry in the rendered conversation thread (original message + replies). */
export interface ThreadMessage {
  author: string;
  date?: string;
  body: string;
  kind: 'original' | 'comment';
  forTechsOnly?: boolean;
}

export type TrayStatus = 'green' | 'orange' | 'red' | 'gray';

/** Severity bucket used for the coloured dot, mirroring BugSnagBar. */
export type TicketSeverity = 'error' | 'warning' | 'info';
