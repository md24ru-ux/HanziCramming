import * as Crypto from 'expo-crypto';
import { getSharedSupabaseClient } from '@/template/core/client';
import {
  DiagnosticAttempt,
  getPendingDiagnosticAttempts,
  markDiagnosticAttemptsSent,
} from '@/services/diagnosticStore';

export const CURRENT_DIAGNOSTIC_ALGORITHM = 'geometry-v1';

type FlushOptions = {
  manual?: boolean;
  force?: boolean;
  minimumAttempts?: number;
};

export type DiagnosticFlushResult = {
  sent: number;
  batches: number;
  remaining: number;
  error: string | null;
};

let flushInProgress = false;

function hasBackendConfiguration(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );
}

async function uploadBatch(attempts: DiagnosticAttempt[]): Promise<string> {
  if (!attempts.length) throw new Error('Пустой пакет диагностики.');

  const versions = new Set(attempts.map(item => item.algorithmVersion || 'unknown'));
  if (versions.size !== 1) {
    throw new Error('Нельзя отправлять попытки разных версий алгоритма одним пакетом.');
  }

  const ids = attempts.map(item => item.attemptId).sort();
  const batchId = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    ids.join('|')
  );

  const { data, error } = await getSharedSupabaseClient().functions.invoke(
    'diagnostic-reports',
    {
      body: {
        batchId,
        algorithmVersion: attempts[0].algorithmVersion || 'unknown',
        exportedAt: new Date().toISOString(),
        attempts,
      },
    }
  );

  if (error) throw new Error(error.message || 'Промежуточный сервис не принял отчёт.');
  if (!data?.success) throw new Error(data?.error || 'Не удалось подтвердить сохранение отчёта в GitHub.');
  return batchId;
}

/**
 * Uploads pending records in deterministic, idempotent batches.
 * A batch is acknowledged locally only after the intermediary confirms
 * that the corresponding immutable JSON report exists in GitHub.
 */
export async function flushPendingDiagnostics(
  options: FlushOptions = {}
): Promise<DiagnosticFlushResult> {
  if (flushInProgress) {
    return { sent: 0, batches: 0, remaining: 0, error: 'Отправка диагностики уже выполняется.' };
  }

  if (!hasBackendConfiguration()) {
    let remaining = 0;
    try {
      remaining = (await getPendingDiagnosticAttempts(500)).length;
    } catch {
      // The configuration error is more useful than a secondary read error.
    }
    return {
      sent: 0,
      batches: 0,
      remaining,
      error: 'Не настроено подключение к промежуточному сервису диагностики.',
    };
  }

  flushInProgress = true;
  let sent = 0;
  let batches = 0;
  let lastError: string | null = null;

  try {
    // Marking each confirmed batch as sent removes it from the next query.
    // The loop therefore drains the entire queue for manual sends.
    while (true) {
      const pending = await getPendingDiagnosticAttempts(500);
      if (!pending.length) break;

      const groups = new Map<string, DiagnosticAttempt[]>();
      for (const item of pending) {
        const version = item.algorithmVersion || 'unknown';
        const group = groups.get(version) ?? [];
        group.push(item);
        groups.set(version, group);
      }

      let madeProgress = false;
      const hasEligibleOverflow = Array.from(groups.entries()).some(([version, records]) => {
        const eligible =
          options.manual === true ||
          options.force === true ||
          version !== CURRENT_DIAGNOSTIC_ALGORITHM ||
          records.length >= (options.minimumAttempts ?? 5);
        return eligible && records.length > 100;
      });
      for (const [version, records] of groups) {
        const isOldVersion = version !== CURRENT_DIAGNOSTIC_ALGORITHM;
        const eligible =
          options.manual === true ||
          options.force === true ||
          isOldVersion ||
          records.length >= (options.minimumAttempts ?? 5);

        if (!eligible) continue;

        // Keep batches small and homogeneous. The deterministic batch ID
        // makes retries safe if the app closes after GitHub accepts the file.
        const batch = records.slice(0, 100);
        try {
          const batchId = await uploadBatch(batch);
          await markDiagnosticAttemptsSent(batch.map(item => item.attemptId), batchId);
          sent += batch.length;
          batches += 1;
          madeProgress = true;
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Ошибка отправки отчёта.';
          break;
        }
      }

      if (lastError || !madeProgress || (!options.manual && !options.force && !hasEligibleOverflow)) break;
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Не удалось прочитать очередь диагностики.';
  } finally {
    flushInProgress = false;
  }

  let remaining = 0;
  try {
    remaining = (await getPendingDiagnosticAttempts(500)).length;
  } catch {
    // Preserve the upload result; the caller will still show the send error.
  }

  return { sent, batches, remaining, error: lastError };
}

/** Called after each saved attempt; the 20-record threshold overrides session end. */
export async function checkDiagnosticUploadThreshold(): Promise<void> {
  const pending = await getPendingDiagnosticAttempts(500);
  const currentCount = pending.filter(
    item => (item.algorithmVersion || 'unknown') === CURRENT_DIAGNOSTIC_ALGORITHM
  ).length;

  if (currentCount >= 20) {
    await flushPendingDiagnostics({ force: true });
  }
}

/** A session-end send is eligible only when at least five records are queued. */
export async function finishDiagnosticSession(): Promise<void> {
  await flushPendingDiagnostics({ minimumAttempts: 5 });
}

/** Retry eligible queued reports when connectivity returns. */
export async function retryEligibleDiagnosticUploads(): Promise<void> {
  await flushPendingDiagnostics({ minimumAttempts: 5 });
}

/** Manual send deliberately drains every pending algorithm-version group. */
export async function sendAllDiagnosticsNow(): Promise<DiagnosticFlushResult> {
  return flushPendingDiagnostics({ manual: true, force: true });
}
