import _createControllerCore, {
  type ComputeSnapshot,
  type ContentBoxSize,
} from '../_internal/_createControllerCore';
import _createTextProbe from '../_internal/_createTextProbe';
import _createTextStyle from '../_internal/_createTextStyle';
import _isFitting from '../_internal/_isFitting';
import _isShallowEqual from '../_internal/_isShallowEqual';
import _readBaseTypography from '../_internal/_readBaseTypography';
import _toLimit from '../_internal/_toLimit';
import type { TextFittingStyle } from '../types';
import type {
  ResizeTextController,
  ResizeTextControllerOptions,
  ResizeTextSnapshot,
} from './types';

/**
 * 下限を指定しないときの font-size の下限（px）
 */
const DEFAULT_MIN_FONT_SIZE = 1;

/**
 * 上限が Infinity のときに、大きくしていく font-size の上限（px）
 */
const MAX_SEARCH_FONT_SIZE = 10000;

/**
 * font-size を探すときの細かさ（px）
 */
const PRECISION = 0.1;

/**
 * 要素の大きさ（幅・高さ）と行数に収まるように、文字の大きさ（font-size）を変える Controller を作る\
 * DOM が要る（作るだけなら DOM に触れないので、SSR でも作れる）
 *
 * - minFontSize〜maxFontSize の範囲で、収まる最大の font-size を選ぶ。maxFontSize を省略した場合の上限は、
 *   要素の CSS の font-size（そのままで収まれば何もせず、はみ出すときだけ縮める）
 * - 下限でも収まらない場合は下限の大きさにし、isOverflowing で知らせる（はみ出しは CSS に任せる）
 * - 要素の高さは、CSS かレイアウトで決まっている場合だけ制約にする（中身に合わせて伸びる要素では、幅と行数だけで決める）
 * - 表示する要素を attach で接続すると計測し、要素の大きさの変化とフォントの読み込みで測り直す。
 *   要素に当てるスタイルを snapshot で返し、要素のスタイルは書き換えない（CSS の font-size を読むときに一時的に変え、すぐに戻す）
 *
 * @param text 文字列
 * @param options オプション
 * @returns Controller
 */
export default function createResizeTextController(
  text: string,
  options: ResizeTextControllerOptions = {},
): ResizeTextController {
  let currentText = text;
  let currentOptions = options;
  let style = _createTextStyle(options.wrap);
  // 要素に当てた font-size（CSS の font-size を読むときに外すため）
  let applied: string | undefined;

  const compute: ComputeSnapshot<ResizeTextSnapshot> = (element, size) => {
    if (currentOptions.disabled || !element || !size) {
      applied = undefined;
      return {
        displayText: currentText,
        fontSize: null,
        isOverflowing: null,
        style,
      };
    }
    const { fontSize, isOverflowing } = _selectFontSize(
      element,
      size,
      style,
      currentText,
      currentOptions,
      applied,
    );
    applied = `${fontSize}px`;
    return {
      displayText: currentText,
      fontSize,
      isOverflowing,
      style: { ...style, fontSize: applied },
    };
  };

  const core = _createControllerCore(compute, _isEqualSnapshot);

  const update = (
    nextText: string,
    nextOptions: ResizeTextControllerOptions = {},
  ) => {
    if (
      nextText === currentText &&
      _isShallowEqual(nextOptions, currentOptions)
    ) {
      return;
    }
    currentText = nextText;
    currentOptions = nextOptions;
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
 * font-size のオプションを数値にする。NaN・0 以下は指定しなかったものとして扱う
 */
function _toFontSize(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 ? value : undefined;
}

/**
 * 要素に収まる最大の font-size を、計測して選ぶ
 */
function _selectFontSize(
  element: HTMLElement,
  size: ContentBoxSize,
  style: Readonly<TextFittingStyle>,
  text: string,
  options: ResizeTextControllerOptions,
  applied: string | undefined,
): Pick<ResizeTextSnapshot, 'isOverflowing'> & { fontSize: number } {
  const base = _readBaseTypography(element, applied);
  const limits = {
    width: size.width,
    // 中身に合わせて伸びる要素の高さを制約にすると、縮めた後に大きくできなくなるため使わない
    height: base.hasFixedHeight ? size.height : Infinity,
    maxLines: _toLimit(options.maxLines),
    style,
  };
  const probe = _createTextProbe(element, size.width, {
    ...style,
    lineHeight: base.lineHeight,
  });

  const fitsAt = (fontSize: number) => {
    probe.setStyle({ fontSize: `${fontSize}px` });
    return _isFitting(probe.measure(text), limits);
  };

  try {
    const min = _toFontSize(options.minFontSize) ?? DEFAULT_MIN_FONT_SIZE;
    let max = _toFontSize(options.maxFontSize) ?? base.fontSize;

    // 下限が上限以上なら、下限に固定する（下限を優先する）
    if (min >= max) {
      return { fontSize: min, isOverflowing: !fitsAt(min) };
    }

    // 上限が Infinity のときは、収まらなくなるまで2倍にしていき、探す範囲を決める
    let low = min;
    if (!Number.isFinite(max)) {
      let current = Math.max(base.fontSize, min);
      if (fitsAt(current)) {
        while (current < MAX_SEARCH_FONT_SIZE && fitsAt(current * 2)) {
          current *= 2;
        }
        low = current;
        max = Math.min(current * 2, MAX_SEARCH_FONT_SIZE);
      } else {
        max = current;
      }
    }

    if (fitsAt(max)) {
      return { fontSize: _round(max), isOverflowing: false };
    }
    if (low === min && !fitsAt(min)) {
      return { fontSize: min, isOverflowing: true };
    }

    // low は収まり、high は収まらない
    let high = max;
    while (high - low > PRECISION) {
      const middle = (low + high) / 2;
      if (fitsAt(middle)) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return { fontSize: _round(low), isOverflowing: false };
  } finally {
    // 計測が途中で失敗しても、計測用の要素を残さない
    probe.remove();
  }
}

/**
 * font-size を小数第2位で切り捨てる（収まる側に倒す）
 */
function _round(value: number): number {
  return Math.floor(value * 100) / 100;
}

/**
 * 2つの snapshot が等しいか
 */
function _isEqualSnapshot(
  a: ResizeTextSnapshot,
  b: ResizeTextSnapshot,
): boolean {
  return (
    a.displayText === b.displayText &&
    a.fontSize === b.fontSize &&
    a.isOverflowing === b.isOverflowing &&
    _isShallowEqual(a.style, b.style)
  );
}
