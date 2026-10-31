import _createControllerCore, {
  type ComputeSnapshot,
  type ContentBoxSize,
  type FreezeSnapshot,
} from '../_internal/_createControllerCore';
import _createTextProbe from '../_internal/_createTextProbe';
import _createTextStyle from '../_internal/_createTextStyle';
import _createTruncator, {
  type Truncator,
} from '../_internal/_createTruncator';
import _getHeightLimit from '../_internal/_getHeightLimit';
import _isShallowEqual from '../_internal/_isShallowEqual';
import _searchTruncation from '../_internal/_searchTruncation';
import _toLimit from '../_internal/_toLimit';
import type { TextFittingStyle } from '../types';
import type {
  TruncateTextController,
  TruncateTextControllerOptions,
  TruncateTextSnapshot,
} from './types';

/**
 * 要素の大きさ（幅・高さ）と行数に収まるように、文字列を省略する Controller を作る\
 * DOM が要る（作るだけなら DOM に触れないので、SSR でも作れる）
 *
 * - 表示する要素を attach で接続すると計測し、要素の大きさの変化とフォントの読み込みで測り直す（detectionDelay で、変化が続いている間は待てる）
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
  // 最後に計測した文字列
  let measuredText = text;

  const compute: ComputeSnapshot<Omit<TruncateTextSnapshot, 'isPending'>> = (
    element,
    size,
  ) => {
    measuredText = currentText;
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

  // 計測を止めている間は、文字列が変わっていなければ最後の結果を、変わっていれば今の文字列を省略せずに表示する
  const freeze: FreezeSnapshot<Omit<TruncateTextSnapshot, 'isPending'>> = (
    measured,
  ) => ({
    ...measured,
    displayText:
      currentText === measuredText ? measured.displayText : currentText,
    style,
  });

  const core = _createControllerCore(
    compute,
    _isEqualSnapshot,
    () => currentOptions,
    freeze,
  );

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
  const limits = {
    width: size.width,
    height: _getHeightLimit(element, size),
    maxLines: _toLimit(options.maxLines),
    style,
  };
  const probe = _createTextProbe(element, size.width, style);
  try {
    return _searchTruncation(
      probe,
      limits,
      text,
      truncator,
      _toLimit(options.maxChars),
    );
  } finally {
    // 計測が途中で失敗しても、計測用の要素を残さない
    probe.remove();
  }
}

/**
 * 2つの snapshot が等しいか
 */
function _isEqualSnapshot(
  a: Omit<TruncateTextSnapshot, 'isPending'>,
  b: Omit<TruncateTextSnapshot, 'isPending'>,
): boolean {
  return (
    a.displayText === b.displayText &&
    a.isTruncated === b.isTruncated &&
    a.style === b.style
  );
}
