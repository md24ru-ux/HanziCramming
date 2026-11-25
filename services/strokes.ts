import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Point {
  x: number;
  y: number;
}

export interface CharacterShape {
  strokes: string[];
  medians: number[][][];
}

export interface Verdict {
  correct: boolean;
  deviation: number;
  message: string;
  diagnostics: {
    failureReason?: 'stroke-count' | 'invalid-stroke';
    userStrokeCount: number;
    referenceStrokeCount: number;
    userBounds?: ReturnType<typeof bounds>;
    referenceBounds?: ReturnType<typeof bounds>;
    normalizedUserStrokes?: Point[][];
    pairwiseScores?: PairScore[][];
    assignment?: number[];
    strokeComparisons?: Array<{
      userStrokeIndex: number;
      referenceStrokeIndex: number;
      meanDeviation: number;
      endpointDeviation: number;
      lengthDifference: number;
      score: number;
      reversed: boolean;
    }>;
    worstUserStrokeIndex?: number;
      worstReferenceStrokeIndex?: number;
  };
}

const memory = new Map<string, CharacterShape>();

function validShape(value: unknown): value is CharacterShape {
  const shape = value as CharacterShape;
  return (
    Array.isArray(shape?.strokes) &&
    shape.strokes.length > 0 &&
    shape.strokes.every(s => typeof s === 'string') &&
    Array.isArray(shape.medians) &&
    shape.medians.length === shape.strokes.length &&
    shape.medians.every(stroke =>
      Array.isArray(stroke) &&
      stroke.length >= 2 &&
      stroke.every(p => p.length === 2 && p.every(Number.isFinite))
    )
  );
}

export async function loadShape(hanzi: string): Promise<CharacterShape> {
  const existing = memory.get(hanzi);
  if (existing) return existing;
  const key = `shtrikh:shape:v1:${hanzi}`;
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const data = JSON.parse(stored);
      if (validShape(data)) { memory.set(hanzi, data); return data; }
    }
  } catch { /* Continue with a network lookup if the local cache cannot be read. */ }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(
      `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(hanzi)}.json`,
      { signal: controller.signal }
    );
    if (response.status === 404) throw new Error('REFERENCE_NOT_FOUND');
    if (!response.ok) throw new Error('NETWORK_UNAVAILABLE');
    const data: unknown = await response.json();
    if (!validShape(data)) throw new Error('REFERENCE_NOT_FOUND');
    memory.set(hanzi, data);
    await AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => undefined);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message === 'REFERENCE_NOT_FOUND') throw error;
    throw new Error('Интернет не доступен. Не удалось проверить наличие эталона');
  } finally {
    clearTimeout(timer);
  }
}

// Shared reference coordinate mapping for the hint and drawing field.
export function medianPoints(median: number[][]): Point[] {
  return median.map(([x, y]) => ({
    x: 100 + x * 0.8,
    y: 100 + (900 - y) * 0.8
  }));
}

export function pointPath(points: Point[]): string {
  return points
    .map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(points: Point[]): number {
  return points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
}

function resample(points: Point[], count = 32): Point[] {
  if (!points.length) return Array.from({ length: count }, () => ({ x: 0, y: 0 }));
  const total = pathLength(points);
  if (total < 1e-8) return Array.from({ length: count }, () => ({ ...points[0] }));

  const result: Point[] = [points[0]];
  let index = 1;
  let accumulated = 0;
  for (let i = 1; i < count; i++) {
    const target = total * i / (count - 1);
    while (
      index < points.length - 1 &&
      accumulated + distance(points[index - 1], points[index]) < target
    ) {
      accumulated += distance(points[index - 1], points[index]);
      index++;
    }
    const start = points[index - 1];
    const end = points[index];
    const segment = distance(start, end);
    const ratio = Math.min(1, Math.max(0, (target - accumulated) / Math.max(1e-8, segment)));
    result.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio
    });
  }
  return result;
}

function bounds(strokes: Point[][]) {
  const all = strokes.flat();
  if (!all.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0, cx: 0, cy: 0, diagonal: 1 };
  const minX = Math.min(...all.map(p => p.x));
  const maxX = Math.max(...all.map(p => p.x));
  const minY = Math.min(...all.map(p => p.y));
  const maxY = Math.max(...all.map(p => p.y));
  return {
    minX, maxX, minY, maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    diagonal: Math.max(1e-8, Math.hypot(maxX - minX, maxY - minY))
  };
}

// Normalize the complete user character: translation and uniform scale only.
// No rotation and no separate X/Y stretching.
function normalizeWholeCharacter(actual: Point[][], reference: Point[][]): Point[][] {
  const a = bounds(actual);
  const r = bounds(reference);
  const scale = r.diagonal / a.diagonal;
  return actual.map(stroke => stroke.map(p => ({
    x: r.cx + (p.x - a.cx) * scale,
    y: r.cy + (p.y - a.cy) * scale
  })));
}

interface PairScore {
  score: number;
  mean: number;
  endpoint: number;
  length: number;
  reversed: boolean;
}

// Evaluate a stroke in either direction, then keep its better orientation.
// Orientation is only a geometric comparison aid, never a correctness rule.
function scorePair(actualStroke: Point[], referenceStroke: Point[], scale: number): PairScore {
  const actual = resample(actualStroke);
  const reference = resample(referenceStroke);
  const reverse = [...reference].reverse();

  const metrics = (expected: Point[]) => {
    const mean = actual.reduce((sum, p, i) => sum + distance(p, expected[i]), 0) / actual.length;
    const endpoint = Math.max(distance(actual[0], expected[0]), distance(actual[actual.length - 1], expected[expected.length - 1]));
    const lengthError = Math.abs(pathLength(actualStroke) - pathLength(referenceStroke));
    return { mean, endpoint, length: lengthError, score: Math.max(mean, endpoint, lengthError * 0.5) / scale * 100 };
  };

  const forward = metrics(reference);
  const backward = metrics(reverse);
  return forward.score <= backward.score
    ? { ...forward, reversed: false }
    : { ...backward, reversed: true };
}

// Hungarian algorithm: square cost matrix, returns the assigned reference column
// for each user-stroke row. Finds the minimum total geometric error globally.
function minimumCostAssignment(cost: number[][]): number[] {
  const n = cost.length;
  if (!n) return [];
  const u = Array(n + 1).fill(0);
  const v = Array(n + 1).fill(0);
  const p = Array(n + 1).fill(0);
  const way = Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(n + 1).fill(Infinity);
    const used = Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignment = Array(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j] > 0) assignment[p[j] - 1] = j - 1;
  return assignment;
}

export function evaluateWriting(
  strokes: Point[][],
  shape: CharacterShape,
  tolerance = 10
): Verdict {
  if (strokes.length !== shape.medians.length) {
    return {
      correct: false,
      deviation: 100,
      message: `Нужно черт: ${shape.medians.length}. У вас: ${strokes.length}.`,
      diagnostics: {
        failureReason: 'stroke-count',
        userStrokeCount: strokes.length,
        referenceStrokeCount: shape.medians.length
      }
    };
  }
  if (strokes.some(stroke => stroke.length < 2)) {
    return {
      correct: false,
      deviation: 100,
      message: 'Каждая черта должна содержать траекторию.',
      diagnostics: {
        failureReason: 'invalid-stroke',
        userStrokeCount: strokes.length,
        referenceStrokeCount: shape.medians.length
      }
    };
  }

  const referenceStrokes = shape.medians.map(medianPoints);
  const userBounds = bounds(strokes);
  const referenceBounds = bounds(referenceStrokes);
  const referenceScale = referenceBounds.diagonal;
  const normalizedUser = normalizeWholeCharacter(strokes, referenceStrokes);
  const pairScores = normalizedUser.map(userStroke =>
    referenceStrokes.map(referenceStroke => scorePair(userStroke, referenceStroke, referenceScale))
  );
  const assignment = minimumCostAssignment(pairScores.map(row => row.map(item => item.score)));

  let worst = 0;
  let worstUserIndex = 0;
  for (let userIndex = 0; userIndex < assignment.length; userIndex++) {
    const referenceIndex = assignment[userIndex];
    const score = pairScores[userIndex][referenceIndex].score;
    if (score > worst) { worst = score; worstUserIndex = userIndex; }
  }

  const correct = worst < tolerance;
  const strokeComparisons = assignment.map((referenceIndex, userIndex) => {
    const pair = pairScores[userIndex][referenceIndex];
    return {
      userStrokeIndex: userIndex,
      referenceStrokeIndex: referenceIndex,
      meanDeviation: pair.mean,
      endpointDeviation: pair.endpoint,
      lengthDifference: pair.length,
      score: pair.score,
      reversed: pair.reversed
    };
  });
  return {
    correct,
    deviation: worst,
    message: correct
      ? `Верно · отклонение ${worst.toFixed(1)}%`
      : `Черта ${worstUserIndex + 1} · отклонение ${worst.toFixed(1)}%. Повторите.`,
    diagnostics: {
      userStrokeCount: strokes.length,
      referenceStrokeCount: shape.medians.length,
      userBounds,
      referenceBounds,
      normalizedUserStrokes: normalizedUser,
      pairwiseScores,
      assignment,
      strokeComparisons,
      worstUserStrokeIndex: worstUserIndex,
      worstReferenceStrokeIndex: assignment[worstUserIndex]
    }
  };
}
