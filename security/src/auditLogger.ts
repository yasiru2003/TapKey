import { randomUUID } from 'node:crypto';
import type {
  AuditLogEntry,
  AuditQueryFilter,
  AuditLoggerInterface,
} from './types.js';

/**
 * Audit Logger module for recording and querying LoginAttempt events across Factor 1 and Factor 2.
 */
export class AuditLogger implements AuditLoggerInterface {
  private logs: AuditLogEntry[] = [];
  private listeners: ((entry: AuditLogEntry) => void)[] = [];

  /**
   * Logs an authentication or security attempt to the unified audit log.
   * Works for both Factor 1 (WebAuthn) and Factor 2 (Spacebar tactile secret).
   */
  public async logAttempt(entry: AuditLogEntry): Promise<void> {
    const record: AuditLogEntry = {
      id: entry.id || randomUUID(),
      userId: entry.userId,
      username: entry.username,
      factor: entry.factor,
      ceremony: entry.ceremony || 'AUTHENTICATION',
      outcome: entry.outcome,
      reason: entry.reason,
      signCount: entry.signCount,
      ipAddress: entry.ipAddress || '127.0.0.1',
      userAgent: entry.userAgent || 'unknown',
      timestamp: entry.timestamp || new Date(),
    };

    this.logs.push(record);

    // Notify registered event listeners
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch (err) {
        // Listener errors should not break logging pipeline
      }
    }
  }

  /**
   * Queries recorded audit logs matching specified filter criteria.
   */
  public async getLogs(filter?: AuditQueryFilter): Promise<AuditLogEntry[]> {
    let result = [...this.logs];

    if (!filter) {
      return result;
    }

    if (filter.userId) {
      result = result.filter((log) => log.userId === filter.userId);
    }

    if (filter.username) {
      result = result.filter((log) => log.username === filter.username);
    }

    if (filter.factor) {
      result = result.filter((log) => log.factor === filter.factor);
    }

    if (filter.outcome) {
      result = result.filter((log) => log.outcome === filter.outcome);
    }

    if (filter.ipAddress) {
      result = result.filter((log) => log.ipAddress === filter.ipAddress);
    }

    if (filter.startDate) {
      const startTime = filter.startDate.getTime();
      result = result.filter((log) => (log.timestamp ? log.timestamp.getTime() >= startTime : false));
    }

    if (filter.endDate) {
      const endTime = filter.endDate.getTime();
      result = result.filter((log) => (log.timestamp ? log.timestamp.getTime() <= endTime : false));
    }

    // Sort descending by timestamp (newest first)
    result.sort((a, b) => {
      const timeA = a.timestamp ? a.timestamp.getTime() : 0;
      const timeB = b.timestamp ? b.timestamp.getTime() : 0;
      return timeB - timeA;
    });

    if (filter.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Returns the count of failed attempts for an account or IP since a given timestamp.
   */
  public async getFailedAttemptsCount(filter: {
    userId?: string;
    username?: string;
    ipAddress?: string;
    since?: Date;
  }): Promise<number> {
    const logs = await this.getLogs({
      userId: filter.userId,
      username: filter.username,
      ipAddress: filter.ipAddress,
      outcome: 'FAILURE',
      startDate: filter.since,
    });

    return logs.length;
  }

  /**
   * Subscribes a listener callback to real-time audit log entry events.
   */
  public onLog(listener: (entry: AuditLogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Clears all in-memory audit logs.
   */
  public async clearLogs(): Promise<void> {
    this.logs = [];
  }
}

/** Default singleton instance for application-wide logging */
export const defaultAuditLogger = new AuditLogger();
