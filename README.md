# HanziCramming

Отдельное Android-приложение для личной тренировки написания китайских иероглифов. Проект развивается независимо от HanziPractice.

## Реализовано в текущей версии исходного кода
- Добавление одного иероглифа в личный словарь.
- Автозаполнение пиньиня и перевода для знаков из встроенного словаря.
- Ручной ввод пиньиня и перевода для незнакомых знаков.
- Проверка наличия эталона написания через hanzi-writer-data.
- Локальный список ожидания, если эталон пока не найден или нет доступа к интернету.
- Повторная проверка ожидающих иероглифов при появлении сети и периодически во время работы приложения.
- Локальное сохранение личного словаря, эталонов и прогресса.
- Учёт серии успешных полных написаний; освоение после 10 успешных попыток подряд без подсказки.
- Произношение через системный Android TTS.
- Сохранённые поле письма, цветная подсказка, проверка направления и порядка черт, а также режимы точности L/M/H.

## Технологии
Expo SDK 53, React Native, TypeScript, AsyncStorage, NetInfo, Hanzi Writer stroke data.

## Локальный запуск
```bash
npm install
npx expo start
```

Перед первой сборкой Android нужно установить зависимости и проверить проект в Expo Go. APK ещё не собирался и не проходил проверку на устройстве.


## HanziCramming2 (geometry-only handwriting evaluator)

Development branch: `feature/cramming2`.

This branch has a separate Expo app identity (`HanziCramming2`, Android package `com.md24ru.hanzicramming2`) and uses the same writing board/reference data flow as HanziCramming. Stroke evaluation has been replaced with a geometry-only matcher:

- stroke count must match;
- the complete user character is normalized by translation and uniform scale only (no rotation or separate X/Y stretching);
- strokes are globally matched one-to-one using minimum total geometric error;
- each matched stroke is compared in both directions, so stroke direction is ignored;
- order and direction are not correctness conditions;
- stroke shape, endpoints, and length are scored, with the worst matched stroke determining the verdict.

The existing drawing board, reference source, personal dictionary, and review flow remain unchanged in this branch. This is a development build; device/browser testing and a new EAS project association are still required before producing a test APK.
