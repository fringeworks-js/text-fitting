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
import _isFitting from '../_internal/_isFitting';
import _isShallowEqual from '../_internal/_isShallowEqual';
import _toLimit from '../_internal/_toLimit';
import type { TextFittingStyle } from '../types';
import type {
  TruncateTextController,
  TruncateTextControllerOptions,
  TruncateTextSnapshot,
} from './types';

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
  const limits = { width: size.width, height: size.height, maxLines, style };
  const probe = _createTextProbe(element, size.width, style);

  /**
   * 候補が幅・高さ・行数に収まるか。省略記号が途中で折り返していないかも確かめる
   */
  const fits = (value: string, parts?: TruncatedParts) => {
    const range: [number, number] | undefined = parts?.marker
      ? [parts.before.length, parts.before.length + parts.marker.length]
      : undefined;
    const metrics = probe.measure(value, range);
    return _isFitting(metrics, limits) && (!range || metrics.rangeLines <= 1);
  };

  /**
   * 残す書記素の数を減らしながら候補を測り、最初に収まったものを返す
   */
  const findLongest = (upper: number, withMarker: boolean) => {
    let previous: string | undefined;
    for (let kept = upper; kept >= 0; kept--) {
      const parts = truncator.cut(kept, withMarker);
      const value = parts.before + parts.marker + parts.after;
      // 単語の境界で切る場合などは、残す数が違っても同じ候補になる
      if (value === previous) {
        continue;
      }
      previous = value;
      if (fits(value, parts)) {
        return value;
      }
    }
    return undefined;
  };

  try {
    const { count, ellipsisCount } = truncator;
    if (count <= maxChars && fits(text)) {
      return { displayText: text, isTruncated: false };
    }

    // 候補は、記号を除いて残す書記素の数で作る。記号を含めた数は元の文字列より多くなってもよい
    // （幅の狭い記号なら、元の文字列が収まらなくても、記号を付けた候補は収まることがある）
    let upper = Math.min(count - 1, maxChars);
    if (upper > LINEAR_SEARCH_LIMIT) {
      // 記号付きの候補は、長さに対して「収まるか」が単調ではない（記号が折り返す位置などによる）ため、
      // 記号なしの候補で二分探索して範囲を絞り、その下から長い順に記号付きの候補を測る
      let low = 0;
      let high = upper;
      let found = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const parts = truncator.cut(middle, false);
        if (fits(parts.before + parts.after)) {
          found = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      upper = found;
    }

    // 記号付きの候補を先に測り、記号だけでも収まらない場合は記号なしで切る
    const displayText =
      (ellipsisCount <= maxChars
        ? findLongest(Math.min(upper, maxChars - ellipsisCount), true)
        : undefined) ??
      findLongest(upper, false) ??
      '';
    return { displayText, isTruncated: true };
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
