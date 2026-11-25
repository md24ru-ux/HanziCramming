const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DiagnosticRecord = {
  attemptId: string;
  algorithmVersion: string;
  character: string | null;
  timestamp: string;
  [key: string]: unknown;
};

type RequestBody = {
  batchId: string;
  algorithmVersion: string;
  exportedAt: string;
  attempts: DiagnosticRecord[];
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
  }

  const token = Deno.env.get('GITHUB_TOKEN');
  const repository = Deno.env.get('GITHUB_REPOSITORY');
  const branch = Deno.env.get('GITHUB_BRANCH') || 'main';
  const reportsPath = (Deno.env.get('GITHUB_REPORTS_PATH') || 'diagnostic-reports').replace(/^\/+|\/+$/g, '');

  if (!token || !repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    return jsonResponse({
      success: false,
      error: 'GitHub intermediary service is not configured.',
    }, 503);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON request.' }, 400);
  }

  if (
    !body ||
    !/^[a-f0-9]{64}$/i.test(body.batchId || '') ||
    typeof body.algorithmVersion !== 'string' ||
    !Array.isArray(body.attempts) ||
    body.attempts.length < 1 ||
    body.attempts.length > 100
  ) {
    return jsonResponse({ success: false, error: 'Invalid diagnostic batch.' }, 400);
  }

  const validRecords = body.attempts.every(record =>
    record &&
    typeof record.attemptId === 'string' &&
    record.attemptId.length > 0 &&
    record.algorithmVersion === body.algorithmVersion &&
    typeof record.timestamp === 'string' &&
    typeof record.character === 'string'
  );
  if (!validRecords) {
    return jsonResponse({
      success: false,
      error: 'The batch contains invalid records or mixed algorithm versions.',
    }, 400);
  }

  const report = {
    schemaVersion: '1',
    application: 'HanziCramming2',
    batchId: body.batchId,
    algorithmVersion: body.algorithmVersion,
    exportedAt: body.exportedAt || new Date().toISOString(),
    recordCount: body.attempts.length,
    entries: body.attempts,
  };

  const filename = `batch_${body.batchId.slice(0, 16)}.json`;
  const path = [reportsPath, filename].filter(Boolean).join('/');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const apiUrl = `https://api.github.com/repos/${repository}/contents/${encodedPath}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  try {
    // Idempotency: if the app retries after a lost response, the same batch
    // resolves to the same immutable path and is not written twice.
    const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (existing.ok) {
      const current = await existing.json();
      const currentContent = current.content
        ? atob(String(current.content).replace(/\s/g, ''))
        : '';
      if (currentContent) {
        const decoded = new TextDecoder().decode(
          Uint8Array.from(currentContent, char => char.charCodeAt(0))
        );
        const parsed = JSON.parse(decoded);
        if (parsed.batchId === body.batchId) {
          return jsonResponse({ success: true, alreadyStored: true, path });
        }
      }
      return jsonResponse({ success: false, error: 'Batch filename collision.' }, 409);
    }
    if (existing.status !== 404) {
      const detail = await existing.text();
      return jsonResponse({ success: false, error: `GitHub read failed: ${detail.slice(0, 300)}` }, 502);
    }

    const content = JSON.stringify(report, null, 2);
    const write = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Add HC2 diagnostic batch ${body.batchId.slice(0, 16)}`,
        branch,
        content: encodeBase64(content),
      }),
    });

    if (write.ok) {
      return jsonResponse({ success: true, alreadyStored: false, path });
    }

    // A concurrent retry may have created the same deterministic file.
    if (write.status === 422) {
      const retry = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
      if (retry.ok) {
        const current = await retry.json();
        const raw = atob(String(current.content || '').replace(/\s/g, ''));
        const decoded = new TextDecoder().decode(
          Uint8Array.from(raw, char => char.charCodeAt(0))
        );
        if (JSON.parse(decoded).batchId === body.batchId) {
          return jsonResponse({ success: true, alreadyStored: true, path });
        }
      }
    }

    const detail = await write.text();
    return jsonResponse({ success: false, error: `GitHub write failed: ${detail.slice(0, 300)}` }, 502);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected intermediary error.',
    }, 502);
  }
});
