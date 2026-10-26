# @fringeworks/text-fitting

`@fringeworks/text-fitting` は、受け取った文字列を要素の大きさに合わせて表示する（省略する・文字を小さくする・収まる表現を候補から選ぶ）、誰かにとっては便利なライブラリです。

**[English README is available here](./README.md)**

## インストール

```bash
npm install @fringeworks/text-fitting
# または
pnpm add @fringeworks/text-fitting
```

## 使い方

関数・型は、ルートと関数単位のパスのどちらからでも同じ名前で import できます。関数単位のパスでは、その関数を default import することもできます。

```ts
import { truncateText } from '@fringeworks/text-fitting';
import truncateText from '@fringeworks/text-fitting/truncateText';
```

### CSS の省略との違い

1行の末尾の省略だけなら、CSS の `text-overflow: ellipsis` で足ります。このライブラリは、次のような場合に使います。

- 先頭や中央を省略したい（`…/components/Button.tsx`、`very-long-fi…-final.pdf`）
- 単語の途中で切りたくない
- 要素の高さや行数に合わせて、複数行の文章を省略したい
- 書記素（見た目の1文字）の数の上限も守りたい
- 省略したかどうかを知りたい（「続きを読む」のボタンを出すなど）
- 省略記号を `...` 以外にしたい

文字列の中身は区別しません。改行や空白を整えたい場合は、渡す前に整えてください（`trim()` や `@fringeworks/japanese-text` の `unifyLineBreaks`・`removeSpaces` など）。改行と空白は、そのまま表示します。

---

## API

| 関数                                               | 説明                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `truncateText(text, options)`                      | 書記素の数が上限以下になるように、文字列を省略する。DOM を参照しない                                               |
| `createTruncateTextController(text, options?)`     | 要素の大きさ（幅・高さ）と行数に収まるように、文字列を省略する Controller を作る。DOM が要る                       |
| `createResizeTextController(text, options?)`       | 要素の大きさ（幅・高さ）と行数に収まるように、文字の大きさを変える Controller を作る。DOM が要る                   |
| `createChooseTextController(candidates, options?)` | 要素の大きさ（幅・高さ）と行数に収まる表現を、候補から選ぶ Controller を作る。DOM が要る                           |
| `createFitTextController(text, options?)`          | 候補を選ぶ・文字の大きさを変える・省略するを組み合わせて、要素の大きさと行数に収める Controller を作る。DOM が要る |

### `truncateText`

```ts
truncateText(text: string, options: TruncateTextOptions): string
```

省略記号を含めた書記素（見た目の1文字）の数が `maxChars` 以下になるように、文字列を省略します。DOM を参照しないので、どの環境でも使えます。

- 上限以下なら、元の文字列をそのまま返します（省略記号の分を空けません）
- 絵文字や結合文字の途中では切りません
- 省略記号だけでも上限を超える場合は、記号を付けずに切ります

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

| オプション          | 型                 | 説明                                                                                                                                 |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `maxChars`          | `number`           | 省略記号を含めた書記素の数の上限。`NaN` は上限なし、負の値は `0`、小数は切り捨てて扱う                                               |
| `ellipsis?`         | `string`           | 省略記号。空文字を指定すると、記号を付けずに切る。デフォルトは `'...'`                                                               |
| `truncatePosition?` | `TruncatePosition` | 省略する位置。`'end'`（末尾）・`'start'`（先頭）・`'middle'`（中央）。デフォルトは `'end'`                                           |
| `truncateBoundary?` | `TruncateBoundary` | 切る位置の単位。`'grapheme'`（書記素）・`'word'`（単語）。`'word'` では、残す側の端に空白や改行を残さない。デフォルトは `'grapheme'` |
| `locale?`           | `string`           | 書記素・単語に分けるときに使うロケール。省略した場合や不正な値の場合は、実行環境の既定のロケールを使う                               |

中央の省略では、書記素の数で前後を半分ずつ残します（奇数のときは前を1つ多くします）。単語の境界で切る場合は、前で使い切れなかった分を後ろに回します。

### `createTruncateTextController`

```ts
createTruncateTextController(text: string, options?: TruncateTextControllerOptions): TruncateTextController
```

要素の大きさ（幅・高さ）と行数に収まる最も長い文字列を、実際に描画して測って選ぶ Controller を作ります。

- 表示する要素を `attach` で接続すると計測し、要素の大きさの変化とフォントの読み込みで測り直します
- 表示する文字列と、要素に当てるスタイルを snapshot で返します。Controller は要素の本文やスタイルを書き換えないので、snapshot の `displayText` と `style` を同じ要素に当ててください。`style` を当てないと、計測した書式と表示の書式がずれて、結果が正しくなりません
- 作るだけなら DOM に触れないので、SSR でも作れます。計測には DOM が要ります

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

| オプション          | 型                 | 説明                                                                                                                                                |
| ------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrap?`             | `TextWrap`         | 折り返し。`'none'`（折り返さない）・`'normal'`（通常の位置で折り返す）・`'anywhere'`（区切りの無い長い単語も途中で折り返す）。デフォルトは `'none'` |
| `maxLines?`         | `number`           | 行数の上限。`NaN` は上限なし、負の値は `0`、小数は切り捨てて扱う                                                                                    |
| `maxChars?`         | `number`           | 省略記号を含めた書記素の数の上限。要素の大きさに加えて、この上限も守る                                                                              |
| `disabled?`         | `boolean`          | 動作を止める。止めている間は計測せず、元の文字列をそのまま表示する。デフォルトは `false`                                                            |
| `ellipsis?`         | `string`           | `truncateText` と同じ                                                                                                                               |
| `truncatePosition?` | `TruncatePosition` | `truncateText` と同じ                                                                                                                               |
| `truncateBoundary?` | `TruncateBoundary` | `truncateText` と同じ                                                                                                                               |
| `locale?`           | `string`           | `truncateText` と同じ                                                                                                                               |

`wrap: 'none'` では、改行で区切った行ごとに、要素の幅に収めます。

#### `TruncateTextController`

| メソッド                 | 説明                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `attach(element)`        | 表示する要素を接続し、その場で計測する。`null` を渡すと接続を解除する                  |
| `getSnapshot()`          | 最後の結果を返す。結果が変わらない間は、同じオブジェクトを返す                         |
| `subscribe(listener)`    | 結果の変化を購読し、解除する関数を返す                                                 |
| `update(text, options?)` | 文字列とオプションを変え、その場で計測する。文字列とオプションの値が同じなら何もしない |
| `refresh()`              | 今の文字列とオプションで、その場で計測し直す                                           |
| `destroy()`              | 監視と購読をすべて解除する。破棄した後の操作は何もしない                               |

`TruncateTextSnapshot` のプロパティ:

| プロパティ    | 型                 | 説明                                                                                                                  |
| ------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `displayText` | `string`           | 表示する文字列                                                                                                        |
| `isTruncated` | `boolean \| null`  | 省略したか。未計測（要素を接続していない、DOM に無い、`display: none`、幅が 0）の間は `null` で、元の文字列を表示する |
| `style`       | `TextFittingStyle` | 表示する要素に当てるスタイル（`whiteSpace` と、`wrap: 'anywhere'` のときの `overflowWrap`）                           |

#### 要素の大きさについて

- 要素の幅は、レイアウトで決まっている必要があります（ブロック要素、flex や grid の子要素など）。中身に合わせて幅が変わるインライン要素では、省略されません
- 要素の高さは、CSS（`height`・`max-height`）かレイアウト（flex・grid など）で決まっている場合だけ制約にします。高さが中身に合わせて伸びる要素では、幅と `maxLines` だけで判定します。そのため、折り返すとき（`wrap` が `'normal'` か `'anywhere'`）に高さが中身に合わせて伸びる要素で `maxLines` も無い場合は、省略しません（要素が伸びて全文を表示します）
- 高さが決まっているかは、要素の font-size と line-height を一時的に変えて確かめます（すぐに元に戻すので、画面には表示されません）
- `disabled` で止めている間は、要素の高さを CSS で決めていると、全文がはみ出すことがあります。全文を表示するときは、高さの指定も外してください

```ts
// 「続きを読む」で全文を展開する
controller.update(text, { wrap: 'normal', maxLines: 3, disabled: expanded });
// ボタンは expanded || isTruncated のときに出す
```

### `createResizeTextController`

```ts
createResizeTextController(text: string, options?: ResizeTextControllerOptions): ResizeTextController
```

要素の大きさ（幅・高さ）と行数に収まるように、文字の大きさ（font-size）を変える Controller を作ります。`minFontSize`〜`maxFontSize` の範囲で、収まる最大の大きさを、実際に描画して測って選びます。

- `maxFontSize` を省略した場合の上限は、要素の CSS の font-size です。そのままで収まれば何もせず、はみ出すときだけ縮めます
- `maxFontSize` を指定すると、収まる限りその大きさまで大きくします（ダッシュボードの数値を枠いっぱいに表示する、など）
- 下限でも収まらない場合は下限の大きさにし、`isOverflowing` で知らせます。はみ出しは CSS に任せます
- 使い方は `createTruncateTextController` と同じです。snapshot の `style` には、選んだ `fontSize` が入ります

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

| オプション     | 型         | 説明                                                                                                                                                                                      |
| -------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minFontSize?` | `number`   | font-size の下限（px）。省略した場合は下限を設けない（実際にはブラウザーの最小のフォントサイズで止まる）。長い文字列では、読める大きさを保つために指定する。`0` 以下と `NaN` は省略と同じ |
| `maxFontSize?` | `number`   | font-size の上限（px）。省略した場合は要素の CSS の font-size。`Infinity` を指定すると、収まる限りどこまでも大きくする。`0` 以下と `NaN` は省略と同じ                                     |
| `wrap?`        | `TextWrap` | `createTruncateTextController` と同じ                                                                                                                                                     |
| `maxLines?`    | `number`   | `createTruncateTextController` と同じ                                                                                                                                                     |
| `disabled?`    | `boolean`  | 動作を止める。止めている間は計測せず、font-size を指定しない（CSS の大きさのまま）。デフォルトは `false`                                                                                  |

`minFontSize` が上限（`maxFontSize`、省略した場合は CSS の font-size）より大きい場合は、`minFontSize` の大きさに固定します。下限は読める大きさを保つためのものなので、上限より優先します。

#### `ResizeTextController`

メソッドは `TruncateTextController` と同じです（`attach`・`getSnapshot`・`subscribe`・`update`・`refresh`・`destroy`）。

`ResizeTextSnapshot` のプロパティ:

| プロパティ      | 型                | 説明                                                                            |
| --------------- | ----------------- | ------------------------------------------------------------------------------- |
| `displayText`   | `string`          | 表示する文字列（元の文字列のまま）                                              |
| `fontSize`      | `number \| null`  | 選んだ font-size（px）。未計測の間と、止めている間は `null`                     |
| `isOverflowing` | `boolean \| null` | 下限の大きさでも収まらないか。未計測の間と、止めている間は `null`               |
| `style`         | `ResizeTextStyle` | 表示する要素に当てるスタイル（`whiteSpace`、`overflowWrap`、選んだ `fontSize`） |

#### 文字の大きさを変えるときの注意

- 要素の CSS の font-size は、クラスなどの CSS で指定してください。Controller の `style` を当てると、要素のインラインの `font-size` は上書きされます
- 要素の高さは、`createTruncateTextController` と同じく、CSS かレイアウトで決まっている場合だけ制約にします。高さが中身に合わせて伸びる要素では、幅と行数だけで大きさを決めます（そのため、縮めた後に幅が広がれば、また大きくなります）
- CSS の font-size と、高さが決まっているかを読み取るときに、要素の font-size と line-height を一時的に変えて、すぐに元に戻します（画面には表示されません）
- `line-height` は、単位なし・`em`・`%` なら文字の大きさに比例し、`px` なら固定のまま測ります。`letter-spacing` などを `em` で指定している場合は、文字の大きさに比例しないものとして測ります
- 利用者がブラウザーの設定で最小のフォントサイズを指定している場合、それより小さくはなりません。その場合は収まらないと判定し、`isOverflowing` で知らせます（利用者の読みやすさのための設定を尊重するため、`transform` で縮めることはしません）

### `createChooseTextController`

```ts
createChooseTextController(candidates: readonly string[], options?: ChooseTextControllerOptions): ChooseTextController
```

要素の大きさ（幅・高さ）と行数に収まる表現を、候補から選ぶ Controller を作ります。候補を前から順に測り、最初に収まったものを表示します。

- 候補は望ましい順に並べます。候補の中身は区別しないので、書式化した数値や日付などを、呼び出す側で作って渡します
- どの候補も収まらない場合は最後の候補を表示し、`isOverflowing` で知らせます
- 空の配列は、空文字を1つ渡したものとして扱います
- オプションは `wrap`・`maxLines`・`disabled` です（`createTruncateTextController` と同じ）

```ts
const controller = createChooseTextController([
  '2026年10月26日（月）',
  '2026/10/26',
  '10/26',
]);
```

#### `ChooseTextController`

メソッドは `TruncateTextController` と同じです。`update` は、文字列の代わりに候補の配列を受け取ります。

`ChooseTextSnapshot` のプロパティ:

| プロパティ      | 型                 | 説明                                                                       |
| --------------- | ------------------ | -------------------------------------------------------------------------- |
| `displayText`   | `string`           | 表示する文字列（選んだ候補）                                               |
| `index`         | `number`           | 選んだ候補の番号。未計測の間と、止めている間は `0`（最初の候補を表示する） |
| `isOverflowing` | `boolean \| null`  | どの候補も収まらないか。未計測の間と、止めている間は `null`                |
| `style`         | `TextFittingStyle` | 表示する要素に当てるスタイル                                               |

### `createFitTextController`

```ts
createFitTextController(text: string | readonly string[], options?: FitTextControllerOptions): FitTextController
```

候補を選ぶ・文字の大きさを変える・省略するを組み合わせて、要素の大きさ（幅・高さ）と行数に文字列を収める Controller を作ります。各機能は、指定したときだけ有効になります。

| 機能         | 有効にする方法                                                         |
| ------------ | ---------------------------------------------------------------------- |
| 候補を選ぶ   | 第1引数に候補の配列を渡す。文字列を1つ渡せば、候補の切り替えは起きない |
| 文字の大きさ | `minFontSize` か `maxFontSize` を指定する                              |
| 省略する     | `truncate: true` を指定する                                            |

試す順序は `resizeFirst` で選びます。省略は常に最後の手段で、最後の候補を下限の大きさで省略します。

| `resizeFirst`   | 順序                                                                   | 向いている場面                                     |
| --------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| `false`（既定） | 各候補を上限の大きさで試す → 最後の候補を縮める → 最後の候補を省略する | 文字の大きさを揃えたい（ダッシュボードの数値など） |
| `true`          | 各候補を縮めながら順に試す → 最後の候補を省略する                      | 正確な表現をできるだけ残したい                     |

例えば `['1,234,567', '1.2M']` を `maxFontSize: 48` で収める場合、`false` では `1,234,567`（48px）→ `1.2M`（48px）→ `1.2M`（縮小）の順に、`true` では `1,234,567`（48px）→ `1,234,567`（縮小）→ `1.2M`（縮小）の順に試します。`maxFontSize` が `Infinity` の場合は、どちらでも `true` と同じ動作になります。

どの手段でも収まらない場合は、最後の候補を下限の大きさで表示し、`isOverflowing` で知らせます。

```ts
const controller = createFitTextController(['1,234,567', '1.2M'], {
  minFontSize: 12,
  maxFontSize: 48,
  truncate: true,
});
```

| オプション          | 型                 | 説明                                                                                                                                      |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `minFontSize?`      | `number`           | `createResizeTextController` と同じ。指定すると文字の大きさを変える                                                                       |
| `maxFontSize?`      | `number`           | `createResizeTextController` と同じ。指定すると文字の大きさを変える                                                                       |
| `truncate?`         | `boolean`          | 最後の手段として省略する。デフォルトは `false`                                                                                            |
| `resizeFirst?`      | `boolean`          | 候補を切り替える前に、文字を縮める。デフォルトは `false`                                                                                  |
| `maxChars?`         | `number`           | 省略記号を含めた書記素の数の上限。`truncate` が `true` のときだけ使い、これを超える候補は選ばず、最後の候補はこの数に収まるように省略する |
| `ellipsis?`         | `string`           | `truncateText` と同じ                                                                                                                     |
| `truncatePosition?` | `TruncatePosition` | `truncateText` と同じ                                                                                                                     |
| `truncateBoundary?` | `TruncateBoundary` | `truncateText` と同じ                                                                                                                     |
| `locale?`           | `string`           | `truncateText` と同じ                                                                                                                     |
| `wrap?`             | `TextWrap`         | `createTruncateTextController` と同じ                                                                                                     |
| `maxLines?`         | `number`           | `createTruncateTextController` と同じ                                                                                                     |
| `disabled?`         | `boolean`          | 動作を止める。止めている間は計測せず、最初の候補を表示する。デフォルトは `false`                                                          |

#### `FitTextController`

メソッドは `TruncateTextController` と同じです。`update` は、文字列か候補の配列を受け取ります。

`FitTextSnapshot` のプロパティ:

| プロパティ      | 型                | 説明                                                                                  |
| --------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `displayText`   | `string`          | 表示する文字列                                                                        |
| `index`         | `number`          | 選んだ候補の番号。未計測の間と、止めている間は `0`                                    |
| `fontSize`      | `number \| null`  | 選んだ font-size（px）。文字の大きさを変えない場合、未計測の間、止めている間は `null` |
| `isTruncated`   | `boolean \| null` | 省略したか。未計測の間と、止めている間は `null`                                       |
| `isOverflowing` | `boolean \| null` | どの手段でも収まらないか。未計測の間と、止めている間は `null`                         |
| `style`         | `ResizeTextStyle` | 表示する要素に当てるスタイル（文字の大きさを変える場合は、選んだ `fontSize` を含む）  |

文字の大きさを変える場合の注意は、`createResizeTextController` と同じです。

### `Intl.Segmenter` について

書記素と単語は `Intl.Segmenter` で分けます。`Intl.Segmenter` が無い環境（Firefox 125 未満）では、簡易な規則で分けます。

- 書記素はコードポイントの単位で分けるため、合成した絵文字（家族の絵文字・国旗など）の途中で切れることがあります
- 単語は、空白で区切り、漢字・ひらがな・カタカナは1文字ずつ区切ります。日本語は単語の途中で切れることがあります

古い Firefox でも正確に分けたい場合は、`@formatjs/intl-segmenter/polyfill` などの polyfill を読み込んでください。実行時に `Intl.Segmenter` があるかを確かめて使うので、自動的にそちらが使われます。

### アイコンフォントや数値の省略

合字で描くアイコンフォント（Material Icons の `home` など）を省略するとアイコンが壊れ、数値を省略すると（`1,23…`）誤解を招きます。これらには省略を使わないでください。

### 型

| 型                              | 説明                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `TruncateTextOptions`           | `truncateText` のオプション                                          |
| `TruncateTextControllerOptions` | `createTruncateTextController` のオプション                          |
| `TruncateTextController`        | `createTruncateTextController` が返す Controller                     |
| `TruncateTextSnapshot`          | `TruncateTextController` の結果                                      |
| `ChooseTextControllerOptions`   | `createChooseTextController` のオプション                            |
| `ChooseTextController`          | `createChooseTextController` が返す Controller                       |
| `ChooseTextSnapshot`            | `ChooseTextController` の結果                                        |
| `FitTextControllerOptions`      | `createFitTextController` のオプション                               |
| `FitTextController`             | `createFitTextController` が返す Controller                          |
| `FitTextSnapshot`               | `FitTextController` の結果                                           |
| `ResizeTextControllerOptions`   | `createResizeTextController` のオプション                            |
| `ResizeTextController`          | `createResizeTextController` が返す Controller                       |
| `ResizeTextSnapshot`            | `ResizeTextController` の結果                                        |
| `ResizeTextStyle`               | `ResizeTextController` が返す、表示する要素に当てるスタイル          |
| `TruncateOptions`               | 省略の機能で共通のオプション                                         |
| `TextLayoutOptions`             | 要素に収める機能で共通のオプション（`wrap`・`maxLines`・`disabled`） |
| `TruncatePosition`              | 省略する位置（`'end' \| 'start' \| 'middle'`）                       |
| `TruncateBoundary`              | 切る位置の単位（`'grapheme' \| 'word'`）                             |
| `TextWrap`                      | 折り返し（`'none' \| 'normal' \| 'anywhere'`）                       |
| `TextFittingStyle`              | 表示する要素に当てるスタイル                                         |
