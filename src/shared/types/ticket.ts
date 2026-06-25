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
}

/** A single message/comment on a ticket, from `/api/comments`. */
export interface TicketComment {
  id: number;
  body: string;
  userName?: string;
  date?: string;
  forTechsOnly?: boolean;
}

export type TrayStatus = 'green' | 'orange' | 'red' | 'gray';

/** Severity bucket used for the coloured dot, mirroring BugSnagBar. */
export type TicketSeverity = 'error' | 'warning' | 'info';
