
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
      stroke.every(p =>
        p.length === 2 && p.every(Number.isFinite)
      )
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

      if (validShape(data)) {
        memory.set(hanzi, data);
        return data;
      }
    }
  } catch {
    // An unavailable cache does not prevent a network request.
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(hanzi)}.json`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      throw new Error('Не удалось загрузить образец. Проверьте интернет и повторите.');
    }

    const data: unknown = await response.json();

    if (!validShape(data)) {
      throw new Error('Образец недоступен. Повторите загрузку.');
    }

    memory.set(hanzi, data);

    await AsyncStorage.setItem(key, JSON.stringify(data))
      .catch(() => undefined);

    return data;
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name !== 'AbortError'
        ? error.message
        : 'Загрузка заняла слишком много времени. Повторите.'
    );
  } finally {
    clearTimeout(timer);
  }
}

// Coordinates shared by the hint and input,
// independent of the physical screen size.
export function medianPoints(median: number[][]): Point[] {
  return median.map(([x, y]) => ({
    x: 100 + x * 0.8,
    y: 100 + (900 - y) * 0.8
  }));
}

export function pointPath(points: Point[]): string {
  return points
    .map((p, i) =>
      `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
    )
    .join(' ');
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function length(points: Point[]): number {
  return points.slice(1).reduce(
    (sum, p, i) => sum + distance(points[i], p),
    0
  );
}

function resample(points: Point[], count = 32): Point[] {
  const total = length(points);

  if (total < 1) {
    return Array.from({ length: count }, () => points[0]);
  }

  const result: Point[] = [points[0]];
  let index = 1;
  let before = 0;

  for (let i = 1; i < count; i++) {
    const target = total * i / (count - 1);

    while (
      index < points.length - 1 &&
      before + distance(points[index - 1], points[index]) < target
    ) {
      before += distance(points[index - 1], points[index]);
      index++;
    }

    const start = points[index - 1];
    const end = points[index];

    const ratio = Math.min(
      1,
      Math.max(
        0,
        (target - before) /
        Math.max(0.001, distance(start, end))
      )
    );

    result.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio
    });
  }

  return result;
}

// Calculate the actual reference character size.
// All deviations are measured relative to this size.
function getReferenceScale(strokes: Point[][]): number {
  const points = strokes.flat();

  if (!points.length) return 1024;

  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));

  return Math.max(
    1,
    Math.hypot(maxX - minX, maxY - minY)
  );
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
      message: `Нужно черт: ${shape.medians.length}. У вас: ${strokes.length}.`
    };
  }

  const referenceStrokes = shape.medians.map(medianPoints);
  const referenceScale = getReferenceScale(referenceStrokes);

  let worst = 0;
  let worstIndex = 0;
  let sequenceError = '';

  // Sequence detection thresholds are also proportional
  // to the actual reference character size.
  const sequenceMargin = referenceScale * 0.015;
  const minimumSequenceError = referenceScale * 0.01;

  strokes.forEach((stroke, index) => {
    const reference = referenceStrokes[index];

    const actual = resample(stroke);
    const expected = resample(reference);

    // Compare the entire stroke, point by point.
    const meanError =
      actual.reduce(
        (sum, p, i) => sum + distance(p, expected[i]),
        0
      ) / actual.length;

    // Check the direction of the stroke.
    const ax = actual[31].x - actual[0].x;
    const ay = actual[31].y - actual[0].y;

    const ex = expected[31].x - expected[0].x;
    const ey = expected[31].y - expected[0].y;

    if (
      ax * ex + ay * ey < 0 &&
      Math.hypot(ax, ay) > referenceScale * 0.005 &&
      Math.hypot(ex, ey) > referenceScale * 0.005 &&
      !sequenceError
    ) {
      sequenceError = `Черта ${index + 1}: проверьте направление.`;
    }

    // Check whether the user accidentally wrote another
    // reference stroke in the wrong position in the sequence.
    if (!sequenceError) {
      referenceStrokes.forEach((median, otherIndex) => {
        if (otherIndex === index) return;

        const alternative = resample(median);

        const otherError =
          actual.reduce(
            (sum, p, i) => sum + distance(p, alternative[i]),
            0
          ) / actual.length;

        if (
          otherError + sequenceMargin < meanError &&
          meanError > minimumSequenceError
        ) {
          sequenceError =
            `Черта ${index + 1}: проверьте порядок черт.`;
        }
      });
    }

    // Endpoint accuracy.
    const endpointError = Math.max(
      distance(actual[0], expected[0]),
      distance(actual[31], expected[31])
    );

    // Stroke length accuracy.
    const lengthError = Math.abs(
      length(stroke) - length(reference)
    );

    // The strictest component determines the final score.
    // The result is now normalized to the actual character size.
    const error = Math.min(
      100,
      Math.max(
        meanError,
        endpointError,
        lengthError * 0.5
      ) / referenceScale * 100
    );

    if (error > worst) {
      worst = error;
      worstIndex = index;
    }
  });

  const correct = worst < tolerance && !sequenceError;

  return {
    correct,
    deviation: worst,
    message:
      sequenceError ||
      (
        correct
          ? `Верно · отклонение ${worst.toFixed(1)}%`
          : `Черта ${worstIndex + 1} · отклонение ${worst.toFixed(1)}%. Повторите.`
      )
  };
}
