// src/services/events.ts
// Append an entry to report_events for every state change.
// This table powers both the audit log and the citizen follow page.

export interface AppendEventInput {
  db: D1Database;
  reportId: string;
  actor: string;      // user email or 'system'
  field: string;      // e.g. 'status', 'priority', 'type'
  oldValue: string | null;
  newValue: string | null;
}

/** Write one event row. Throws on DB error. */
export async function appendEvent(input: AppendEventInput): Promise<void> {
  await input.db
    .prepare(
      `INSERT INTO report_events (report_id, actor, field, old_value, new_value)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(
      input.reportId,
      input.actor,
      input.field,
      input.oldValue,
      input.newValue,
    )
    .run();
}

/** Convenience: record a full status transition. */
export async function recordStatusChange(
  db: D1Database,
  reportId: string,
  actor: string,
  oldStatus: string,
  newStatus: string,
): Promise<void> {
  await appendEvent({ db, reportId, actor, field: 'status', oldValue: oldStatus, newValue: newStatus });
}
