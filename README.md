# @fringeworks/text-fitting

`@fringeworks/text-fitting` is a library some will find handy, for fitting text into an element by truncating it, resizing it, or choosing among candidates.

**[日本語のREADMEはこちら](./README.ja.md)**

The current version provides truncation.

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

| Function                                       | Description                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `truncateText(text, options)`                  | Truncates a string so that its number of graphemes stays within a limit. Does not use the DOM                        |
| `createTruncateTextController(text, options?)` | Creates a controller that truncates a string to fit an element's size (width and height) and lines. Requires the DOM |

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

- When an element is connected with `attach`, the controller measures it, and measures again when the element's size changes or fonts finish loading
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

| Option              | Type               | Description                                                                                                                                                    |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrap?`             | `TextWrap`         | Wrapping: `'none'` (no wrapping), `'normal'` (wrap at normal break points), or `'anywhere'` (also break long words without break points). Defaults to `'none'` |
| `maxLines?`         | `number`           | Maximum number of lines. `NaN` means no limit, negative values are treated as `0`, and fractions are truncated                                                 |
| `maxChars?`         | `number`           | Maximum number of graphemes, including the ellipsis. Enforced in addition to the element's size                                                                |
| `disabled?`         | `boolean`          | Stops the controller. While stopped, it does not measure and displays the original string. Defaults to `false`                                                 |
| `ellipsis?`         | `string`           | Same as `truncateText`                                                                                                                                         |
| `truncatePosition?` | `TruncatePosition` | Same as `truncateText`                                                                                                                                         |
| `truncateBoundary?` | `TruncateBoundary` | Same as `truncateText`                                                                                                                                         |
| `locale?`           | `string`           | Same as `truncateText`                                                                                                                                         |

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
| `style`       | `TextFittingStyle` | The style to apply to the element (`whiteSpace`, and `overflowWrap` when `wrap` is `'anywhere'`)                                                                                |

#### About the element's size

- The element's width must be determined by layout (a block element, a flex or grid item, and so on). Inline elements, whose width follows their content, are never truncated
- When wrapping (`wrap` is `'normal'` or `'anywhere'`), determine the element's height with CSS (`height` / `max-height`) or layout (flex, grid, and so on), or specify `maxLines`. If the element's height grows with its content and there is no `maxLines`, the full text is displayed at first, but if the text gets longer or the width gets narrower afterwards, it keeps being truncated to fit the initial height
- While stopped with `disabled`, the full text may overflow if the element's height is set with CSS. Remove the height restriction as well when displaying the full text

```ts
// Expand the full text with a "Read more" button
controller.update(text, { wrap: 'normal', maxLines: 3, disabled: expanded });
// Show the button when expanded || isTruncated
```

### About `Intl.Segmenter`

Graphemes and words are split with `Intl.Segmenter`. In environments without `Intl.Segmenter` (Firefox before 125), simple rules are used instead.

- Graphemes are split by code point, so composed emoji (family emoji, flags, and so on) may be cut in the middle
- Words are split at whitespace, and kanji, hiragana, and katakana are split one character at a time. Japanese may be cut in the middle of a word

To split accurately even on older Firefox, load a polyfill such as `@formatjs/intl-segmenter/polyfill`. The library checks for `Intl.Segmenter` at runtime, so the polyfill is used automatically.

### Truncating icon fonts and numbers

Truncating icon fonts drawn with ligatures (such as `home` in Material Icons) breaks the icon, and truncating numbers (`1,23…`) is misleading. Do not truncate them.

### Types

| Type                            | Description                                                             |
| ------------------------------- | ----------------------------------------------------------------------- |
| `TruncateTextOptions`           | Options of `truncateText`                                               |
| `TruncateTextControllerOptions` | Options of `createTruncateTextController`                               |
| `TruncateTextController`        | The controller returned by `createTruncateTextController`               |
| `TruncateTextSnapshot`          | The result of `TruncateTextController`                                  |
| `TruncateOptions`               | Options shared by the truncation features                               |
| `TextLayoutOptions`             | Options shared by the fitting features (`wrap`, `maxLines`, `disabled`) |
| `TruncatePosition`              | Where to truncate (`'end' \| 'start' \| 'middle'`)                      |
| `TruncateBoundary`              | The unit to cut at (`'grapheme' \| 'word'`)                             |
| `TextWrap`                      | Wrapping (`'none' \| 'normal' \| 'anywhere'`)                           |
| `TextFittingStyle`              | The style to apply to the element                                       |
