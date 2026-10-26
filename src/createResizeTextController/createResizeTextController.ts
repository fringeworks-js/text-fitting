import _createControllerCore, {
  type ComputeSnapshot,
  type ContentBoxSize,
} from '../_internal/_createControllerCore';
import _createTextProbe from '../_internal/_createTextProbe';
import _createTextStyle from '../_internal/_createTextStyle';
import _isFitting from '../_internal/_isFitting';
import _isShallowEqual from '../_internal/_isShallowEqual';
import _readBaseTypography from '../_internal/_readBaseTypography';
import _searchFontSize, {
  _resolveFontSizeRange,
} from '../_internal/_searchFontSize';
import _toLimit from '../_internal/_toLimit';
import type { TextFittingStyle } from '../types';
import type {
  ResizeTextController,
  ResizeTextControllerOptions,
  ResizeTextSnapshot,
} from './types';

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
    const { min, max } = _resolveFontSizeRange(options, base.fontSize);
    const { fontSize, fits } = _searchFontSize(fitsAt, min, max, base.fontSize);
    return { fontSize, isOverflowing: !fits };
  } finally {
    // 計測が途中で失敗しても、計測用の要素を残さない
    probe.remove();
  }
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
