import _createControllerCore, {
  type ComputeSnapshot,
  type ContentBoxSize,
} from '../_internal/_createControllerCore';
import _createTextProbe from '../_internal/_createTextProbe';
import _createTextStyle from '../_internal/_createTextStyle';
import _createTruncator, {
  type TruncatedParts,
  type Truncator,
} from '../_internal/_createTruncator';
import _toLimit from '../_internal/_toLimit';
import type { TextFittingStyle } from '../types';
import type {
  TruncateTextController,
  TruncateTextControllerOptions,
  TruncateTextSnapshot,
} from './types';

/**
 * 収まるかの判定で許す誤差（px）。小数の丸めの違いで収まらないと判定しないようにする
 */
const TOLERANCE = 0.5;

/**
 * 候補を長い順にすべて測る、書記素の数の上限\
 * これを超える長い文字列は、記号なしの候補の二分探索で範囲を絞ってから測る
 */
const LINEAR_SEARCH_LIMIT = 256;

/**
 * 要素の大きさ（幅・高さ）と行数に収まるように、文字列を省略する Controller を作る\
 * DOM が要る（作るだけなら DOM に触れないので、SSR でも作れる）
 *
 * - 表示する要素を attach で接続すると計測し、要素の大きさの変化とフォントの読み込みで測り直す
 * - 表示する文字列と、要素に当てるスタイルを snapshot で返す。要素の本文やスタイルは書き換えない
 * - 要素の高さは、CSS かレイアウトで決まっている必要がある（中身に合わせて伸びる要素では、maxLines を指定する）
 *
 * @param text 文字列
 * @param options オプション
 * @returns Controller
 */
export default function createTruncateTextController(
  text: string,
  options: TruncateTextControllerOptions = {},
): TruncateTextController {
  let currentText = text;
  let currentOptions = options;
  let truncator = _createTruncator(text, options);
  let style = _createTextStyle(options.wrap);

  const compute: ComputeSnapshot<TruncateTextSnapshot> = (element, size) => {
    if (currentOptions.disabled) {
      return { displayText: currentText, isTruncated: false, style };
    }
    if (!element || !size) {
      return { displayText: currentText, isTruncated: null, style };
    }
    return {
      ..._selectText(
        element,
        size,
        style,
        currentText,
        currentOptions,
        truncator,
      ),
      style,
    };
  };

  const core = _createControllerCore(compute, _isEqualSnapshot);

  const update = (
    nextText: string,
    nextOptions: TruncateTextControllerOptions = {},
  ) => {
    if (
      nextText === currentText &&
      _isShallowEqual(nextOptions, currentOptions)
    ) {
      return;
    }
    currentText = nextText;
    currentOptions = nextOptions;
    truncator = _createTruncator(nextText, nextOptions);
    style = _createTextStyle(nextOptions.wrap);
    core.refresh();
  };

  return {
    attach: core.attach,
    getSnapshot: core.getSnapshot,
    subscribe: core.subscribe,
    update,
    refresh: core.refresh,
    destroy: core.destroy,
  };
}

/**
 * 要素に収まる最も長い候補を、計測して選ぶ
 */
function _selectText(
  element: HTMLElement,
  size: ContentBoxSize,
  style: Readonly<TextFittingStyle>,
  text: string,
  options: TruncateTextControllerOptions,
  truncator: Truncator,
): Pick<TruncateTextSnapshot, 'displayText' | 'isTruncated'> {
  const maxChars = _toLimit(options.maxChars);
  const maxLines = _toLimit(options.maxLines);
  // 折り返すとき（pre-wrap）は、行末の空白が枠の外にぶら下がって描画される。
  // 描画した矩形の右端で判定すると、ぶら下がった空白まで「はみ出し」とみなしてしまうため、
  // 矩形の右端は折り返さないときだけ使う（折り返すときの横のはみ出しは、区切りの無い長い単語だけで、scrollWidth で分かる）
  const checksRight = style.whiteSpace === 'pre';
  const probe = _createTextProbe(element, size.width, style);

  /**
   * 候補が幅・高さ・行数に収まるか。省略記号が途中で折り返していないかも確かめる
   */
  const fits = (value: string, parts?: TruncatedParts) => {
    const range: [number, number] | undefined = parts?.marker
      ? [parts.before.length, parts.before.length + parts.marker.length]
      : undefined;
    const metrics = probe.measure(value, range);
    return (
      (!checksRight || metrics.right <= size.width + TOLERANCE) &&
      metrics.scrollWidth <= size.width + TOLERANCE &&
      metrics.height <= size.height + TOLERANCE &&
      metrics.lines <= maxLines &&
      (!range || metrics.rangeLines <= 1)
    );
  };

  /**
   * 書記素の数の上限を指定して候補を作り、収まるかを確かめる
   */
  const tryCandidate = (source: Truncator, limit: number) => {
    const parts = source.split(limit);
    const value = parts ? parts.before + parts.marker + parts.after : text;
    return { value, fits: fits(value, parts) };
  };

  try {
    if (truncator.count <= maxChars && fits(text)) {
      return { displayText: text, isTruncated: false };
    }

    let upper = Math.min(truncator.count - 1, maxChars);
    if (upper > LINEAR_SEARCH_LIMIT) {
      // 記号付きの候補は、長さに対して「収まるか」が単調ではない（記号が折り返す位置などによる）ため、
      // 記号なしの候補で二分探索して範囲を絞り、その下から長い順に記号付きの候補を測る
      const clip = _createTruncator(text, { ...options, ellipsis: '' });
      let low = 0;
      let high = upper;
      let found = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (tryCandidate(clip, middle).fits) {
          found = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      upper = Math.min(upper, found + truncator.ellipsisCount);
    }

    let previous: string | undefined;
    for (let limit = upper; limit >= 0; limit--) {
      const parts = truncator.split(limit);
      const value = parts ? parts.before + parts.marker + parts.after : text;
      // 単語の境界で切る場合などは、上限が違っても同じ候補になる
      if (value === previous) {
        continue;
      }
      previous = value;
      if (fits(value, parts)) {
        return { displayText: value, isTruncated: true };
      }
    }
    return { displayText: '', isTruncated: true };
  } finally {
    // 計測が途中で失敗しても、計測用の要素を残さない
    probe.remove();
  }
}

/**
 * 2つの snapshot が等しいか
 */
function _isEqualSnapshot(
  a: TruncateTextSnapshot,
  b: TruncateTextSnapshot,
): boolean {
  return (
    a.displayText === b.displayText &&
    a.isTruncated === b.isTruncated &&
    a.style === b.style
  );
}

/**
 * 2つのオプションが、プロパティの値の単位で等しいか
 */
function _isShallowEqual(
  a: TruncateTextControllerOptions,
  b: TruncateTextControllerOptions,
): boolean {
  const keys = Object.keys(a) as (keyof TruncateTextControllerOptions)[];
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.is(a[key], b[key]))
  );
}
