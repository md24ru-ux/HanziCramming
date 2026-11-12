import { memo, useMemo, useRef } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { CharacterShape, medianPoints, Point, pointPath } from '@/services/strokes';
import { theme } from '@/constants/theme';

interface WritingBoardProps {
  size: number;
  shape: CharacterShape | null;
  strokes: Point[][];
  liveStroke: Point[];
  hint: boolean;
  loading: boolean;
  error: string;
  checking: boolean;
  awaitingRetry: boolean;
  flash: 'success' | 'error' | null;
  onBegin: (point: Point) => void;
  onMove: (point: Point) => void;
  onEnd: () => void;
  onCancel: () => void;
  onHint: () => void;
  onClear: () => void;
  onRetry: () => void;
  onResize: (factor: number) => void;
}

export const WritingBoard = memo(function WritingBoard({
  size,
  shape,
  strokes,
  liveStroke,
  hint,
  loading,
  error,
  checking,
  awaitingRetry,
  flash,
  onBegin,
  onMove,
  onEnd,
  onHint,
  onClear,
  onRetry,
  onResize,
  onCancel,
}: WritingBoardProps) {
  const pinchDistance = useRef(0);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const responder = useMemo(() => {
    const point = (x: number, y: number): Point => ({
      x: Math.min(
        1024,
        Math.max(0, (x / Math.max(1, sizeRef.current)) * 1024),
      ),
      y: Math.min(
        1024,
        Math.max(0, (y / Math.max(1, sizeRef.current)) * 1024),
      ),
    });

    const distanceBetween = (touches: readonly any[]) =>
      touches.length < 2
        ? 0
        : Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          );

    return PanResponder.create({
      onStartShouldSetPanResponder: () =>
        Boolean(shape && !loading && !checking && !awaitingRetry && !error),

      onMoveShouldSetPanResponder: () =>
        Boolean(shape && !loading && !checking && !awaitingRetry && !error),

      onPanResponderGrant: event => {
        const touches = event.nativeEvent.touches;

        if (touches.length >= 2) {
          pinchDistance.current = distanceBetween(touches);
          return;
        }

        onBegin(
          point(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          ),
        );
      },

      onPanResponderMove: event => {
        const touches = event.nativeEvent.touches;

        if (touches.length >= 2) {
          const nextDistance = distanceBetween(touches);

          if (pinchDistance.current === 0) {
            onCancel();
          }

          if (pinchDistance.current > 0 && nextDistance > 0) {
            onResize(nextDistance / pinchDistance.current);
          }

          pinchDistance.current = nextDistance;
          return;
        }

        pinchDistance.current = 0;

        if (touches.length <= 1) {
          onMove(
            point(
              event.nativeEvent.locationX,
              event.nativeEvent.locationY,
            ),
          );
        }
      },

      onPanResponderRelease: () => {
        pinchDistance.current = 0;
        onEnd();
      },

      onPanResponderTerminate: () => {
        pinchDistance.current = 0;
        onEnd();
      },

      onPanResponderTerminationRequest: () => false,
    });
  }, [
    shape,
    loading,
    checking,
    awaitingRetry,
    error,
    onBegin,
    onMove,
    onEnd,
    onResize,
    onCancel,
  ]);

  return (
    <View
      style={[styles.board, { width: size, height: size }]}
      accessibilityLabel="Поле для написания иероглифа"
    >
      {flash ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor:
                flash === 'success'
                  ? theme.colors.success
                  : theme.colors.danger,
              opacity: 0.32,
            },
          ]}
        />
      ) : null}

      <View
        collapsable={false}
        style={styles.canvas}
        {...responder.panHandlers}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 1024 1024"
          pointerEvents="none"
        >
          <Line
            x1={512}
            y1={0}
            x2={512}
            y2={1024}
            stroke={theme.colors.grid}
            strokeWidth={3}
            strokeDasharray="12 12"
          />

          <Line
            x1={0}
            y1={512}
            x2={1024}
            y2={512}
            stroke={theme.colors.grid}
            strokeWidth={3}
            strokeDasharray="12 12"
          />

          <Line
            x1={0}
            y1={0}
            x2={1024}
            y2={1024}
            stroke={theme.colors.grid}
            strokeWidth={2}
            strokeDasharray="9 13"
          />

          <Line
            x1={1024}
            y1={0}
            x2={0}
            y2={1024}
            stroke={theme.colors.grid}
            strokeWidth={2}
            strokeDasharray="9 13"
          />

          {flash && shape ? (
            <G
              transform="matrix(0.8 0 0 -0.8 100 820)"
              opacity={0.48}
            >
              {shape.strokes.map((path, index) => (
                <Path
                  key={`comparison-${index}`}
                  d={path}
                  fill={theme.strokeColors[index % 9]}
                />
              ))}
            </G>
          ) : null}

          {flash === 'error' && shape ? (
            <G>
              {shape.medians.map((median, index) => {
                const p = medianPoints(median)[0];

                return (
                  <G key={`comparison-number-${index}`}>
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={21}
                      fill={theme.strokeColors[index % 9]}
                    />

                    <SvgText
                      x={p.x}
                      y={p.y + 8}
                      textAnchor="middle"
                      fontSize={23}
                      fontWeight="700"
                      fill={[1, 2, 3, 4].includes(index % 9)
                        ? theme.colors.ink
                        : theme.colors.white}
                    >
                      {index + 1}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          ) : null}

          {hint && shape && !flash ? (
            <G>
              <G transform="matrix(0.8 0 0 -0.8 100 820)">
                {shape.strokes.slice(0, 9).map((path, index) => (
                  <Path
                    key={`hint-${index}`}
                    d={path}
                    fill={theme.strokeColors[index]}
                  />
                ))}
              </G>

              {shape.medians.slice(9).map((median, index) => (
                <Path
                  key={`dashed-${index}`}
                  d={pointPath(medianPoints(median))}
                  stroke={theme.strokeColors[index % 9]}
                  strokeWidth={20}
                  strokeDasharray="24 18"
                  strokeLinecap="round"
                  fill="none"
                />
              ))}

              {shape.medians.map((median, index) => {
                const p = medianPoints(median)[0];

                return (
                  <G key={`number-${index}`}>
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={21}
                      fill={theme.strokeColors[index % 9]}
                    />

                    <SvgText
                      x={p.x}
                      y={p.y + 8}
                      textAnchor="middle"
                      fontSize={23}
                      fontWeight="700"
                      fill={[1, 2, 3, 4].includes(index % 9)
                        ? theme.colors.ink
                        : theme.colors.white}
                    >
                      {index + 1}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          ) : null}

          {strokes.map((points, index) => (
            <G key={`user-stroke-${index}`}>
              <Path
                d={pointPath(points)}
                stroke={theme.colors.strokeInk}
                strokeWidth={13}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />

              {flash === 'error' && points.length > 0 ? (() => {
                const x = Math.min(990, Math.max(34, points[0].x + 24));
                const y = Math.min(990, Math.max(34, points[0].y - 18));

                return (
                  <G key={`user-stroke-number-${index}`}>
                    <Circle
                      cx={x}
                      cy={y}
                      r={21}
                      fill={theme.colors.board}
                      stroke="#000000"
                      strokeWidth={2}
                    />

                    <SvgText
                      x={x}
                      y={y + 7}
                      textAnchor="middle"
                      fontSize={23}
                      fontWeight="400"
                      fill="#000000"
                    >
                      {index + 1}
                    </SvgText>
                  </G>
                );
              })() : null}
            </G>
          ))}

          {liveStroke.length ? (
            <G>
              <Path
                d={pointPath(liveStroke)}
                stroke={theme.colors.strokeInk}
                strokeWidth={13}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </G>
          ) : null}
        </Svg>
      </View>

      {!loading &&
      !error &&
      !hint &&
      !flash &&
      !strokes.length &&
      !liveStroke.length &&
      !checking ? (
        <View style={styles.empty} pointerEvents="none">
          <Ionicons
            name="pencil-outline"
            size={24}
            color={theme.colors.subtle}
          />

          <Text style={styles.emptyText}>Пишите стилусом или пальцем</Text>

          <Text style={styles.gestureText}>
            Щипок двумя пальцами — изменить размер
          </Text>
        </View>
      ) : null}

      <Pressable
        disabled={!shape || checking || awaitingRetry}
        accessibilityRole="button"
        accessibilityState={{
          selected: hint,
          disabled: !shape || checking || awaitingRetry,
        }}
        accessibilityLabel={
          hint
            ? 'Скрыть подсказку'
            : 'Показать цветную подсказку порядка черт'
        }
        onPress={onHint}
        style={({ pressed }) => [
          styles.hintButton,
          hint ? styles.activeHint : null,
          pressed ? styles.pressed : null,
          !shape || checking || awaitingRetry
            ? styles.disabled
            : null,
        ]}
      >
        <Ionicons
          name="help"
          color={theme.colors.subtle}
          size={22}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Очистить поле"
        disabled={
          checking ||
          awaitingRetry ||
          (!strokes.length && !liveStroke.length)
        }
        onPress={onClear}
        style={({ pressed }) => [
          styles.clearButton,
          pressed ? styles.pressed : null,
          !strokes.length ? styles.disabled : null,
        ]}
      >
        <Ionicons
          name="trash-outline"
          color={theme.colors.subtle}
          size={20}
        />
      </Pressable>

      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={theme.colors.primary} />

          <Text style={styles.overlayText}>
            Загружаем образец…
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.overlay}>
          <Ionicons
            name="cloud-offline-outline"
            color={theme.colors.dangerText}
            size={28}
          />

          <Text style={styles.errorText}>{error}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [
              styles.retry,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.retryText}>
              Повторить загрузку
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  board: {
    backgroundColor: theme.colors.board,
    borderColor: theme.colors.grid,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },

  canvas: {
    ...StyleSheet.absoluteFillObject,
  },

  empty: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  emptyText: {
    fontSize: theme.font.body,
    color: theme.colors.subtle,
  },

  gestureText: {
    fontSize: theme.font.tiny,
    color: theme.colors.subtle,
    opacity: 0.8,
  },

  hintButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },

  activeHint: {
    backgroundColor: theme.colors.surface,
  },

  clearButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.board,
  },

  overlayText: {
    color: theme.colors.subtle,
    fontSize: theme.font.small,
  },

  errorText: {
    color: theme.colors.dangerText,
    textAlign: 'center',
    fontSize: theme.font.small,
    lineHeight: 19,
  },

  retry: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },

  retryText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: theme.font.small,
  },

  pressed: {
    opacity: 0.65,
  },

  disabled: {
    opacity: 0.45,
  },
});