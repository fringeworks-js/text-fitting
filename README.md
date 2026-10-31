# @fringeworks/text-fitting

`@fringeworks/text-fitting` is a library some will find handy, for fitting text into an element by truncating it, resizing it, or choosing among candidates.

**[日本語のREADMEはこちら](./README.ja.md)**

## Installation

```bash
npm install @fringeworks/text-fitting
# or
pnpm add @fringeworks/text-fitting
```

## Usage

Functions and types can be imported by the same name from either the root or the per-function path. From a per-function path, the function can also be imported as the default export.

```ts
import { truncateText } from '@fringeworks/text-fitting';
import truncateText from '@fringeworks/text-fitting/truncateText';
```

### Compared with CSS truncation

If you only need to truncate the end of a single line, CSS `text-overflow: ellipsis` is enough. Use this library when you want to:

- Truncate the start or the middle (`…/components/Button.tsx`, `very-long-fi…-final.pdf`)
- Avoid cutting in the middle of a word
- Truncate multi-line text to fit the element's height or a number of lines
- Also enforce a maximum number of graphemes (user-perceived characters)
- Know whether the text was truncated (for example, to show a "Read more" button)
- Use an ellipsis other than `...`

The library does not interpret the content of the string. If you want to normalize line breaks or whitespace, do so before passing the string (for example with `trim()`, or `unifyLineBreaks` / `removeSpaces` from `@fringeworks/japanese-text`). Line breaks and whitespace are displayed as is.

---

## API

| Function                                           | Description                                                                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `truncateText(text, options)`                      | Truncates a string so that its number of graphemes stays within a limit. Does not use the DOM                                                 |
| `createTruncateTextController(text, options?)`     | Creates a controller that truncates a string to fit an element's size (width and height) and lines. Requires the DOM                          |
| `createResizeTextController(text, options?)`       | Creates a controller that changes the font size to fit an element's size (width and height) and lines. Requires the DOM                       |
| `createChooseTextController(candidates, options?)` | Creates a controller that chooses, from candidates, the expression that fits an element's size (width and height) and lines. Requires the DOM |
| `createFitTextController(text, options?)`          | Creates a controller that fits text into an element's size and lines by combining choosing, resizing, and truncating. Requires the DOM        |
| `extract*Options(data)`                            | Separates each controller's options from the other properties (e.g. component props)                                                          |

### `truncateText`

```ts
truncateText(text: string, options: TruncateTextOptions): string
```

Truncates a string so that the number of graphemes (user-perceived characters), including the ellipsis, is at most `maxChars`. It does not use the DOM, so it works in any environment.

- If the string is within the limit, it is returned as is (no room is reserved for the ellipsis)
- Emoji and combining characters are never split
- If the ellipsis alone exceeds the limit, the string is cut without an ellipsis

```ts
truncateText('Hello wonderful world', { maxChars: 12 });
// 'Hello won...'
truncateText('Hello wonderful world', {
  maxChars: 12,
  truncateBoundary: 'word',
});
// 'Hello...'
truncateText('very-long-file-name.pdf', {
  maxChars: 13,
  truncatePosition: 'middle',
  ellipsis: '…',
});
// 'very-l…me.pdf'
```

| Option              | Type               | Description                                                                                                                                  |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxChars`          | `number`           | Maximum number of graphemes, including the ellipsis. `NaN` means no limit, negative values are treated as `0`, and fractions are truncated   |
| `ellipsis?`         | `string`           | The ellipsis. An empty string cuts the text without an ellipsis. Defaults to `'...'`                                                         |
| `truncatePosition?` | `TruncatePosition` | Where to truncate: `'end'`, `'start'`, or `'middle'`. Defaults to `'end'`                                                                    |
| `truncateBoundary?` | `TruncateBoundary` | The unit to cut at: `'grapheme'` or `'word'`. With `'word'`, no whitespace or line break is left at the kept edges. Defaults to `'grapheme'` |
| `locale?`           | `string`           | Locale used to split graphemes and words. If omitted or invalid, the runtime's default locale is used                                        |

When truncating the middle, half of the graphemes are kept on each side (the start gets one more when the count is odd). When cutting at word boundaries, any budget the start could not use is given to the end.

### `createTruncateTextController`

```ts
createTruncateTextController(text: string, options?: TruncateTextControllerOptions): TruncateTextController
```

Creates a controller that selects the longest string that fits the element's size (width and height) and number of lines, by actually rendering and measuring candidates.

- When an element is connected with `attach`, the controller measures it, and measures again when the element's size changes or fonts finish loading. It does not measure again automatically when only the text formatting (`font-size`, `letter-spacing`, and so on) changes while the element's size stays the same, so call `refresh` in that case
- The controller returns the text to display and the style to apply as a snapshot. It never rewrites the element's content or style, so apply the snapshot's `displayText` and `style` to the same element. Without the `style`, the measured formatting and the displayed formatting differ, and the result will be wrong
- Creating a controller does not touch the DOM, so it can be created during SSR. Measuring requires the DOM

```ts
const element = document.querySelector<HTMLElement>('.title')!;
const controller = createTruncateTextController(text, {
  wrap: 'normal',
  maxLines: 2,
});
const render = () => {
  const { displayText, style } = controller.getSnapshot();
  Object.assign(element.style, style);
  element.textContent = displayText;
};
controller.subscribe(render);
render();
controller.attach(element);
```

| Option              | Type               | Description                                                                                                                                                                                                                                             |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrap?`             | `TextWrap`         | Wrapping: `'none'` (no wrapping), `'normal'` (wrap at normal break points), or `'anywhere'` (also break long words without break points). Defaults to `'none'`                                                                                          |
| `maxLines?`         | `number`           | Maximum number of lines. `NaN` means no limit, negative values are treated as `0`, and fractions are truncated                                                                                                                                          |
| `maxChars?`         | `number`           | Maximum number of graphemes, including the ellipsis. Enforced in addition to the element's size                                                                                                                                                         |
| `disabled?`         | `boolean`          | Stops the controller. While stopped, it does not measure and displays the original string. Defaults to `false`                                                                                                                                          |
| `frozen?`           | `boolean`          | Freezes measurement. While frozen, the controller keeps the last measured result and displays the current string. Setting it back to `false` measures on the spot. Defaults to `false` (see "Freezing measurement" below)                               |
| `detectionDelay?`   | `number`           | The time (ms) from detecting a change in the element's size or font loading until it is reflected in a measurement. Further detections restart the wait. `0` measures in the next frame. Defaults to `0` (see "Measuring while changes continue" below) |
| `hideWhilePending?` | `boolean`          | Hides the text by adding `visibility: hidden` to `style` while waiting to reflect a detected change. Defaults to `false`                                                                                                                                |
| `ellipsis?`         | `string`           | Same as `truncateText`                                                                                                                                                                                                                                  |
| `truncatePosition?` | `TruncatePosition` | Same as `truncateText`                                                                                                                                                                                                                                  |
| `truncateBoundary?` | `TruncateBoundary` | Same as `truncateText`                                                                                                                                                                                                                                  |
| `locale?`           | `string`           | Same as `truncateText`                                                                                                                                                                                                                                  |

With `wrap: 'none'`, each line separated by a line break is fit to the element's width.

#### `TruncateTextController`

| Method                   | Description                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `attach(element)`        | Connects the element to display and measures immediately. Pass `null` to disconnect              |
| `getSnapshot()`          | Returns the latest result. The same object is returned while the result does not change          |
| `subscribe(listener)`    | Subscribes to changes in the result and returns a function that unsubscribes                     |
| `update(text, options?)` | Changes the string and options and measures immediately. Does nothing if the values are the same |
| `refresh()`              | Measures again immediately with the current string and options                                   |
| `destroy()`              | Removes all observers and subscriptions. Any operation after destruction does nothing            |

Properties of `TruncateTextSnapshot`:

| Property      | Type               | Description                                                                                                                                                                     |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayText` | `string`           | The text to display                                                                                                                                                             |
| `isTruncated` | `boolean \| null`  | Whether the text was truncated. While not yet measured (no element attached, not in the DOM, `display: none`, or zero width), it is `null` and the original string is displayed |
| `isPending`   | `boolean`          | Whether the controller is waiting to reflect a detected change (`true` during `detectionDelay`). The result in the meantime is the one measured last                            |
| `style`       | `TextFittingStyle` | The style to apply to the element (`whiteSpace`, `overflowWrap` when `wrap` is `'anywhere'`, and `visibility` while waiting with `hideWhilePending`)                            |

#### About the element's size

- The element's width must be determined by layout (a block element, a flex or grid item, and so on). Inline elements, whose width follows their content, are never truncated
- The element's height is used as a constraint only when it is determined by CSS (`height` / `max-height`) or layout (flex, grid, and so on). For an element whose height grows with its content, only the width and `maxLines` are checked. So when wrapping (`wrap` is `'normal'` or `'anywhere'`) in an element whose height grows with its content and without `maxLines`, the text is not truncated (the element grows to show the full text)
- To determine whether the height is fixed, the controller temporarily changes the element's font size and line height (it restores them immediately, so this is never painted)
- While stopped with `disabled`, the full text may overflow if the element's height is set with CSS. Remove the height restriction as well when displaying the full text

```ts
// Expand the full text with a "Read more" button
controller.update(text, { wrap: 'normal', maxLines: 3, disabled: expanded });
// Show the button when expanded || isTruncated
```

### `createResizeTextController`

```ts
createResizeTextController(text: string, options?: ResizeTextControllerOptions): ResizeTextController
```

Creates a controller that changes the font size so that the text fits the element's size (width and height) and number of lines. It selects the largest size within `minFontSize` to `maxFontSize` that fits, by actually rendering and measuring.

- If `maxFontSize` is omitted, the upper limit is the element's CSS font size. If the text already fits, nothing changes; it only shrinks when the text overflows
- If `maxFontSize` is specified, the text is enlarged up to that size as long as it fits (for example, to fill a dashboard tile with a number)
- If the text does not fit even at the lower limit, the lower limit is used and `isOverflowing` reports it. The overflow is left to CSS
- Usage is the same as `createTruncateTextController`. The snapshot's `style` contains the selected `fontSize`

```ts
const controller = createResizeTextController('1,234,567', {
  maxFontSize: 64,
});
const render = () => {
  const { displayText, style } = controller.getSnapshot();
  Object.assign(element.style, style);
  element.textContent = displayText;
};
controller.subscribe(render);
render();
controller.attach(element);
```

| Option              | Type       | Description                                                                                                                                                                                                                                             |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minFontSize?`      | `number`   | Lower limit of the font size (px). If omitted, there is no lower limit (in practice, the browser's minimum font size applies). Specify it for long text to keep it readable. `0` or less and `NaN` are treated as omitted                               |
| `maxFontSize?`      | `number`   | Upper limit of the font size (px). If omitted, the element's CSS font size. `Infinity` enlarges the text as much as it fits. `0` or less and `NaN` are treated as omitted                                                                               |
| `wrap?`             | `TextWrap` | Same as `createTruncateTextController`                                                                                                                                                                                                                  |
| `maxLines?`         | `number`   | Same as `createTruncateTextController`                                                                                                                                                                                                                  |
| `disabled?`         | `boolean`  | Stops the controller. While stopped, it does not measure and does not set a font size (the CSS size is used). Defaults to `false`                                                                                                                       |
| `frozen?`           | `boolean`  | Freezes measurement. While frozen, the controller keeps the last measured result and displays the current string. Setting it back to `false` measures on the spot. Defaults to `false` (see "Freezing measurement" below)                               |
| `detectionDelay?`   | `number`   | The time (ms) from detecting a change in the element's size or font loading until it is reflected in a measurement. Further detections restart the wait. `0` measures in the next frame. Defaults to `0` (see "Measuring while changes continue" below) |
| `hideWhilePending?` | `boolean`  | Hides the text by adding `visibility: hidden` to `style` while waiting to reflect a detected change. Defaults to `false`                                                                                                                                |

If `minFontSize` is larger than the upper limit (`maxFontSize`, or the CSS font size if omitted), the font size is fixed at `minFontSize`. The lower limit exists to keep the text readable, so it takes precedence over the upper limit.

#### `ResizeTextController`

The methods are the same as `TruncateTextController` (`attach`, `getSnapshot`, `subscribe`, `update`, `refresh`, `destroy`).

Properties of `ResizeTextSnapshot`:

| Property        | Type              | Description                                                                                                                                          |
| --------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayText`   | `string`          | The text to display (the original string as is)                                                                                                      |
| `fontSize`      | `number \| null`  | The selected font size (px). `null` while not yet measured and while stopped                                                                         |
| `isOverflowing` | `boolean \| null` | Whether the text does not fit even at the lower limit. `null` while not yet measured and while stopped                                               |
| `isPending`     | `boolean`         | Whether the controller is waiting to reflect a detected change (`true` during `detectionDelay`). The result in the meantime is the one measured last |
| `style`         | `ResizeTextStyle` | The style to apply to the element (`whiteSpace`, `overflowWrap`, and the selected `fontSize`)                                                        |

#### Notes on changing the font size

- Specify the element's CSS font size with CSS such as a class. Applying the controller's `style` overrides the element's inline `font-size`
- As with `createTruncateTextController`, the element's height is used as a constraint only when it is determined by CSS or layout. For an element whose height grows with its content, the size is determined by the width and lines only (so after shrinking, it grows again when the width gets wider)
- To read the CSS font size and whether the height is fixed, the controller temporarily changes the element's font size and line height and restores them immediately (it is never painted)
- A unitless, `em`, or `%` `line-height` is measured as scaling with the font size, and a `px` value as fixed. `letter-spacing` and similar properties specified in `em` are measured as not scaling
- If the user has set a minimum font size in the browser settings, the text never gets smaller than that. In that case it is judged not to fit and reported with `isOverflowing` (the controller does not shrink it with `transform`, to respect the user's readability setting)

### `createChooseTextController`

```ts
createChooseTextController(candidates: readonly string[], options?: ChooseTextControllerOptions): ChooseTextController
```

Creates a controller that chooses, from candidates, the expression that fits the element's size (width and height) and number of lines. It measures the candidates in order and displays the first one that fits.

- Order the candidates from most to least preferred. The content of the candidates is not interpreted, so format numbers, dates, and so on yourself and pass the results
- If no candidate fits, the last one is displayed and `isOverflowing` reports it
- An empty array is treated as an array with one empty string
- The options are `wrap`, `maxLines`, `disabled`, `frozen`, `detectionDelay`, and `hideWhilePending` (same as `createTruncateTextController`)

```ts
const controller = createChooseTextController([
  'Monday, October 26, 2026',
  '2026/10/26',
  '10/26',
]);
```

#### `ChooseTextController`

The methods are the same as `TruncateTextController`. `update` takes an array of candidates instead of a string.

Properties of `ChooseTextSnapshot`:

| Property        | Type               | Description                                                                                                                                          |
| --------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayText`   | `string`           | The text to display (the chosen candidate)                                                                                                           |
| `index`         | `number`           | The index of the chosen candidate. `0` while not yet measured and while stopped (the first one is displayed)                                         |
| `isOverflowing` | `boolean \| null`  | Whether no candidate fits. `null` while not yet measured and while stopped                                                                           |
| `isPending`     | `boolean`          | Whether the controller is waiting to reflect a detected change (`true` during `detectionDelay`). The result in the meantime is the one measured last |
| `style`         | `TextFittingStyle` | The style to apply to the element                                                                                                                    |

### `createFitTextController`

```ts
createFitTextController(text: string | readonly string[], options?: FitTextControllerOptions): FitTextController
```

Creates a controller that fits a string into the element's size (width and height) and number of lines by combining choosing among candidates, resizing, and truncating. Each feature is enabled only when specified.

| Feature                   | How to enable                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| Choosing among candidates | Pass an array of candidates as the first argument. With a single string, no switching happens |
| Resizing                  | Specify `minFontSize` or `maxFontSize`                                                        |
| Truncating                | Specify `truncate: true`                                                                      |

`resizeFirst` selects the order. Truncation is always the last resort: the last candidate is truncated at the lower size limit.

| `resizeFirst`     | Order                                                                                          | Suited for                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `false` (default) | Try each candidate at the upper size → shrink the last candidate → truncate the last candidate | Keeping font sizes consistent (dashboard numbers, and so on) |
| `true`            | Try each candidate while shrinking → truncate the last candidate                               | Keeping the precise expression as long as possible           |

For example, when fitting `['1,234,567', '1.2M']` with `maxFontSize: 48`, `false` tries `1,234,567` (48px) → `1.2M` (48px) → `1.2M` (shrunk), and `true` tries `1,234,567` (48px) → `1,234,567` (shrunk) → `1.2M` (shrunk). If `maxFontSize` is `Infinity`, both behave like `true`.

If nothing fits, the last candidate is displayed at the lower size limit and `isOverflowing` reports it.

```ts
const controller = createFitTextController(['1,234,567', '1.2M'], {
  minFontSize: 12,
  maxFontSize: 48,
  truncate: true,
});
```

| Option              | Type               | Description                                                                                                                                                                                                                                             |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minFontSize?`      | `number`           | Same as `createResizeTextController`. Specifying it enables resizing                                                                                                                                                                                    |
| `maxFontSize?`      | `number`           | Same as `createResizeTextController`. Specifying it enables resizing                                                                                                                                                                                    |
| `truncate?`         | `boolean`          | Truncates as the last resort. Defaults to `false`                                                                                                                                                                                                       |
| `resizeFirst?`      | `boolean`          | Shrinks the text before switching candidates. Defaults to `false`                                                                                                                                                                                       |
| `maxChars?`         | `number`           | Maximum number of graphemes, including the ellipsis. Used only when `truncate` is `true`: candidates exceeding it are not chosen, and the last one is truncated to fit it                                                                               |
| `ellipsis?`         | `string`           | Same as `truncateText`                                                                                                                                                                                                                                  |
| `truncatePosition?` | `TruncatePosition` | Same as `truncateText`                                                                                                                                                                                                                                  |
| `truncateBoundary?` | `TruncateBoundary` | Same as `truncateText`                                                                                                                                                                                                                                  |
| `locale?`           | `string`           | Same as `truncateText`                                                                                                                                                                                                                                  |
| `wrap?`             | `TextWrap`         | Same as `createTruncateTextController`                                                                                                                                                                                                                  |
| `maxLines?`         | `number`           | Same as `createTruncateTextController`                                                                                                                                                                                                                  |
| `disabled?`         | `boolean`          | Stops the controller. While stopped, it does not measure and displays the first candidate. Defaults to `false`                                                                                                                                          |
| `frozen?`           | `boolean`          | Freezes measurement. While frozen, the controller keeps the last measured result and displays the current string. Setting it back to `false` measures on the spot. Defaults to `false` (see "Freezing measurement" below)                               |
| `detectionDelay?`   | `number`           | The time (ms) from detecting a change in the element's size or font loading until it is reflected in a measurement. Further detections restart the wait. `0` measures in the next frame. Defaults to `0` (see "Measuring while changes continue" below) |
| `hideWhilePending?` | `boolean`          | Hides the text by adding `visibility: hidden` to `style` while waiting to reflect a detected change. Defaults to `false`                                                                                                                                |

#### `FitTextController`

The methods are the same as `TruncateTextController`. `update` takes a string or an array of candidates.

Properties of `FitTextSnapshot`:

| Property        | Type              | Description                                                                                                                                          |
| --------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayText`   | `string`          | The text to display                                                                                                                                  |
| `index`         | `number`          | The index of the chosen candidate. `0` while not yet measured and while stopped                                                                      |
| `fontSize`      | `number \| null`  | The selected font size (px). `null` when not resizing, while not yet measured, and while stopped                                                     |
| `isTruncated`   | `boolean \| null` | Whether the text was truncated. `null` while not yet measured and while stopped                                                                      |
| `isOverflowing` | `boolean \| null` | Whether nothing fits. `null` while not yet measured and while stopped                                                                                |
| `isPending`     | `boolean`         | Whether the controller is waiting to reflect a detected change (`true` during `detectionDelay`). The result in the meantime is the one measured last |
| `style`         | `ResizeTextStyle` | The style to apply to the element (includes the selected `fontSize` when resizing)                                                                   |

The notes on resizing are the same as `createResizeTextController`.

### `extract*Options`

| Function                           | Description                                                                |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `extractTruncateTextOptions(data)` | Separates `createTruncateTextController` options from the other properties |
| `extractResizeTextOptions(data)`   | Separates `createResizeTextController` options from the other properties   |
| `extractChooseTextOptions(data)`   | Separates `createChooseTextController` options from the other properties   |
| `extractFitTextOptions(data)`      | Separates `createFitTextController` options from the other properties      |

```ts
extractTruncateTextOptions<D extends object>(
  data: D,
): [TruncateTextControllerOptions, Omit<D, keyof TruncateTextControllerOptions>]
```

Separates the controller options from the other properties (e.g. component props) and returns them as an `[options, rest]` tuple. Use it to build a component that receives properties and passes them to a controller, for example in a framework other than React. The other `extract*Options` functions have the same shape.

- Properties whose value is `undefined` are also sorted by their key. Controllers treat options whose value is `undefined` as not specified (they behave the same as a missing key, and passing them to `update` does not trigger a new measurement)

```ts
import { extractTruncateTextOptions } from '@fringeworks/text-fitting';

const [options, rest] = extractTruncateTextOptions({
  maxLines: 2,
  id: 'title',
});
// options: { maxLines: 2 }, rest: { id: 'title' }
controller.update(text, options);
```

### Measuring while changes continue (`detectionDelay`, `hideWhilePending`)

By default, the controller measures in the next frame after detecting a change in the element's size or font loading. While the window width is being dragged, for example, it measures every frame, and the result changes every frame. Use the following options when you render many elements or do not want to show intermediate results (shared by all four controllers).

- With `detectionDelay` in milliseconds, the controller waits that long after the last detection before measuring. Detections in the meantime restart the wait, so it does not measure while the size keeps changing
- While waiting, the snapshot's `isPending` is `true`, and the result stays as it was last measured
- With `hideWhilePending: true`, `visibility: hidden` is added to `style` while waiting, which hides the text. The element's size does not change. To fade the text in, specify a `transition` (for example, on `opacity`) in your own styles
- Measurements by `attach`, `update`, and `refresh` do not wait. Calling them while waiting measures on the spot and stops waiting
- Changes detected in the few frames right after a measurement are treated as caused by rendering the controller's own result (the text or font size), and are measured in the next frame without waiting (so that the text is not hidden again right after it is shown)

```ts
const controller = createTruncateTextController(text, {
  detectionDelay: 150,
  hideWhilePending: true,
});
```

### Freezing measurement (`frozen`)

During an animation that keeps changing the string (such as counting up a number), the controller measures every time the string changes. While you know the animation is running, specify `frozen: true` to stop measuring (shared by all four controllers).

- While frozen, the controller does not measure, even when the string, the options, or the element's size change. Calling `refresh` does not measure either
- The current string is displayed, and the last measured result (the font size and the position of the chosen candidate) is kept. Features that truncate display a changed string without truncating it (overflow is left to CSS). Freezing alone does not change the display if the string has not changed
- If the candidates decrease and the last chosen position no longer exists, the last candidate is displayed
- `isTruncated` and `isOverflowing` are from the last measurement, and may not match the displayed string
- Setting it back to `false` measures on the spot. Changes to the string, the options, and the element's size made while frozen are reflected at this point
- `attach` measures even while frozen (since there is no result for that element yet)
- Freezing while waiting for `detectionDelay` stops the wait. While frozen, `isPending` is `false`, and `hideWhilePending` does not hide the text
- If `disabled` is `true`, `frozen` is ignored

```ts
const controller = createResizeTextController(format(0), { maxFontSize: 48 });

// Freeze during the animation, and unfreeze when it ends
controller.update(format(value), { maxFontSize: 48, frozen: true });
controller.update(format(value), { maxFontSize: 48 });
```

### About `Intl.Segmenter`

Graphemes and words are split with `Intl.Segmenter`. In environments without `Intl.Segmenter` (Firefox before 125), simple rules are used instead.

- Graphemes are split by code point, so composed emoji (family emoji, flags, and so on) may be cut in the middle
- Words are split at whitespace, and kanji, hiragana, and katakana are split one character at a time. Japanese may be cut in the middle of a word

To split accurately even on older Firefox, load a polyfill such as `@formatjs/intl-segmenter/polyfill`. The library checks for `Intl.Segmenter` at runtime, so the polyfill is used automatically.

### Truncating icon fonts and numbers

Truncating icon fonts drawn with ligatures (such as `home` in Material Icons) breaks the icon, and truncating numbers (`1,23…`) is misleading. Do not truncate them.

### Types

| Type                            | Description                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `TruncateTextOptions`           | Options of `truncateText`                                                                                               |
| `TruncateTextControllerOptions` | Options of `createTruncateTextController`                                                                               |
| `TruncateTextController`        | The controller returned by `createTruncateTextController`                                                               |
| `TruncateTextSnapshot`          | The result of `TruncateTextController`                                                                                  |
| `ChooseTextControllerOptions`   | Options of `createChooseTextController`                                                                                 |
| `ChooseTextController`          | The controller returned by `createChooseTextController`                                                                 |
| `ChooseTextSnapshot`            | The result of `ChooseTextController`                                                                                    |
| `FitTextControllerOptions`      | Options of `createFitTextController`                                                                                    |
| `FitTextController`             | The controller returned by `createFitTextController`                                                                    |
| `FitTextSnapshot`               | The result of `FitTextController`                                                                                       |
| `ResizeTextControllerOptions`   | Options of `createResizeTextController`                                                                                 |
| `ResizeTextController`          | The controller returned by `createResizeTextController`                                                                 |
| `ResizeTextSnapshot`            | The result of `ResizeTextController`                                                                                    |
| `ResizeTextStyle`               | The style returned by `ResizeTextController` to apply to the element                                                    |
| `TruncateOptions`               | Options shared by the truncation features                                                                               |
| `TextLayoutOptions`             | Options shared by the fitting features (`wrap`, `maxLines`, `disabled`, `frozen`, `detectionDelay`, `hideWhilePending`) |
| `TruncatePosition`              | Where to truncate (`'end' \| 'start' \| 'middle'`)                                                                      |
| `TruncateBoundary`              | The unit to cut at (`'grapheme' \| 'word'`)                                                                             |
| `TextWrap`                      | Wrapping (`'none' \| 'normal' \| 'anywhere'`)                                                                           |
| `TextFittingStyle`              | The style to apply to the element                                                                                       |
