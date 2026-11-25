import * as SQLite from 'expo-sqlite';

export type DiagnosticAttempt = {
  attemptId: string;
  timestamp: string;
  algorithmVersion: string;
  character: string | null;
  [key: string]: unknown;
};

type DiagnosticRow = {
  payload: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync('hc2-diagnostics.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS diagnostic_attempts (
          attempt_id TEXT PRIMARY KEY NOT NULL,
          character TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          algorithm_version TEXT NOT NULL,
          payload TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          batch_id TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_diagnostic_character_created
          ON diagnostic_attempts(character, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_diagnostic_sync_status
          ON diagnostic_attempts(sync_status, created_at ASC);
      `);
      return db;
    })().catch(error => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function initializeDiagnosticStore(): Promise<void> {
  await getDatabase();
}

/**
 * Stores one immutable snapshot of a checked attempt.
 * The newest 60 attempts are retained independently for each character.
 */
export async function saveDiagnosticAttempt(attempt: DiagnosticAttempt): Promise<void> {
  if (!attempt.attemptId || !attempt.character) {
    throw new Error('Diagnostic attempt is missing its ID or character.');
  }

  const db = await getDatabase();
  const createdAt = Date.parse(attempt.timestamp) || Date.now();
  const payload = JSON.stringify(attempt);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO diagnostic_attempts
        (attempt_id, character, timestamp, created_at, algorithm_version, payload, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')
       ON CONFLICT(attempt_id) DO NOTHING`,
      attempt.attemptId,
      attempt.character,
      attempt.timestamp,
      createdAt,
      attempt.algorithmVersion || 'unknown',
      payload
    );

    await db.runAsync(
      `DELETE FROM diagnostic_attempts
       WHERE character = ?
         AND attempt_id IN (
           SELECT attempt_id FROM diagnostic_attempts
           WHERE character = ?
           ORDER BY created_at DESC, rowid DESC
           LIMIT -1 OFFSET 60
         )`,
      attempt.character,
      attempt.character
    );
  });
}

export async function getAllDiagnosticAttempts(): Promise<DiagnosticAttempt[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DiagnosticRow>(
    'SELECT payload FROM diagnostic_attempts ORDER BY created_at ASC, rowid ASC'
  );
  return rows.map(row => JSON.parse(row.payload) as DiagnosticAttempt);
}

export async function getPendingDiagnosticAttempts(limit = 100): Promise<DiagnosticAttempt[]> {
  const db = await getDatabase();
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const rows = await db.getAllAsync<DiagnosticRow>(
    `SELECT payload FROM diagnostic_attempts
     WHERE sync_status = 'pending'
     ORDER BY created_at ASC, rowid ASC
     LIMIT ?`,
    safeLimit
  );
  return rows.map(row => JSON.parse(row.payload) as DiagnosticAttempt);
}

export async function getDiagnosticQueueStats(): Promise<{ total: number; pending: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number; pending: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) AS pending
     FROM diagnostic_attempts`
  );
  return { total: row?.total ?? 0, pending: row?.pending ?? 0 };
}

export async function markDiagnosticAttemptsSent(attemptIds: string[], batchId: string): Promise<void> {
  if (!attemptIds.length) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const attemptId of attemptIds) {
      await db.runAsync(
        "UPDATE diagnostic_attempts SET sync_status = 'sent', batch_id = ? WHERE attempt_id = ?",
        batchId,
        attemptId
      );
    }
  });
}
