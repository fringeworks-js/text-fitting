import _createControllerCore, {
  type ComputeSnapshot,
  type ContentBoxSize,
  type FreezeSnapshot,
} from '../_internal/_createControllerCore';
import _createTextProbe from '../_internal/_createTextProbe';
import _createTextStyle from '../_internal/_createTextStyle';
import _createTruncator from '../_internal/_createTruncator';
import _isFitting from '../_internal/_isFitting';
import _isShallowEqual from '../_internal/_isShallowEqual';
import _readBaseTypography from '../_internal/_readBaseTypography';
import _searchFontSize, {
  _resolveFontSizeRange,
} from '../_internal/_searchFontSize';
import _searchTruncation from '../_internal/_searchTruncation';
import _splitGraphemes from '../_internal/_splitGraphemes';
import _toCandidates from '../_internal/_toCandidates';
import _toLimit from '../_internal/_toLimit';
import type { TextFittingStyle } from '../types';
import type {
  FitTextController,
  FitTextControllerOptions,
  FitTextSnapshot,
} from './types';

/**
 * 計測して決めた結果（スタイルを除く）
 */
type FitResult = Omit<FitTextSnapshot, 'style' | 'isPending'>;

/**
 * 候補を選ぶ・文字の大きさを変える・省略するを組み合わせて、要素の大きさ（幅・高さ）と行数に文字列を収める Controller を作る\
 * DOM が要る（作るだけなら DOM に触れないので、SSR でも作れる）
 *
 * 各機能は、指定したときだけ有効になる。
 *
 * - 候補を選ぶ: 第1引数に候補の配列を渡す（望ましい順）。文字列を1つ渡せば、候補の切り替えは起きない
 * - 文字の大きさ: minFontSize か maxFontSize を指定する
 * - 省略する: truncate: true を指定する。最後の手段として、最後の候補を下限の大きさで省略する
 *
 * 試す順序は、resizeFirst で選ぶ。
 *
 * - false（既定）: 各候補を上限の大きさで試す → 最後の候補を縮める → 最後の候補を省略する
 * - true: 各候補を縮めながら順に試す → 最後の候補を省略する
 *
 * どの手段でも収まらない場合は、最後の候補を下限の大きさで表示し、isOverflowing で知らせる（はみ出しは CSS に任せる）
 *
 * @param text 文字列か、候補の配列（望ましい順）
 * @param options オプション
 * @returns Controller
 */
export default function createFitTextController(
  text: string | readonly string[],
  options: FitTextControllerOptions = {},
): FitTextController {
  let candidates = _toCandidates(text);
  let currentOptions = options;
  let style = _createTextStyle(options.wrap);
  // 要素に当てた font-size（CSS の font-size を読むときに外すため）
  let applied: string | undefined;
  // 最後に計測した候補（候補が変わるたびに新しい配列にする）
  let measuredCandidates = candidates;

  const compute: ComputeSnapshot<Omit<FitTextSnapshot, 'isPending'>> = (
    element,
    size,
  ) => {
    measuredCandidates = candidates;
    if (currentOptions.disabled || !element || !size) {
      applied = undefined;
      return {
        displayText: candidates[0]!,
        index: 0,
        fontSize: null,
        isTruncated: null,
        isOverflowing: null,
        style,
      };
    }
    const result = _fit(
      element,
      size,
      style,
      candidates,
      currentOptions,
      applied,
    );
    applied = result.fontSize === null ? undefined : `${result.fontSize}px`;
    return {
      ...result,
      style: applied === undefined ? style : { ...style, fontSize: applied },
    };
  };

  // 計測を止めている間は、候補が変わっていなければ最後の結果を、変わっていれば最後に選んだのと同じ位置の候補
  // （候補が減った場合は最後の候補）を省略せずに表示する。font-size は最後に計測したもの
  const freeze: FreezeSnapshot<Omit<FitTextSnapshot, 'isPending'>> = (
    measured,
  ) => {
    const index = Math.min(measured.index, candidates.length - 1);
    return {
      ...measured,
      displayText:
        candidates === measuredCandidates
          ? measured.displayText
          : candidates[index]!,
      index,
      style:
        measured.fontSize === null
          ? style
          : { ...style, fontSize: `${measured.fontSize}px` },
    };
  };

  const core = _createControllerCore(
    compute,
    _isEqualSnapshot,
    () => currentOptions,
    freeze,
  );

  const update = (
    nextText: string | readonly string[],
    nextOptions: FitTextControllerOptions = {},
  ) => {
    const normalized = _toCandidates(nextText);
    const isSameCandidates = _isShallowEqual(normalized, candidates);
    if (isSameCandidates && _isShallowEqual(nextOptions, currentOptions)) {
      return;
    }
    // 候補が同じなら配列を入れ替えない（計測を止めている間に、候補が変わったかを配列で判定するため）
    if (!isSameCandidates) {
      candidates = normalized;
    }
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
 * 文字の大きさを変えるか（minFontSize か maxFontSize に有効な値を指定したか）
 */
function _resizes(options: FitTextControllerOptions): boolean {
  return [options.minFontSize, options.maxFontSize].some(
    (value) => value !== undefined && value > 0,
  );
}

/**
 * 決めた順序で手段を試し、要素に収まる表示を選ぶ
 */
function _fit(
  element: HTMLElement,
  size: ContentBoxSize,
  style: Readonly<TextFittingStyle>,
  candidates: readonly string[],
  options: FitTextControllerOptions,
  applied: string | undefined,
): FitResult {
  const resizes = _resizes(options);
  const typography = _readBaseTypography(element, applied);
  const base = resizes ? typography : undefined;
  const limits = {
    width: size.width,
    // 中身に合わせて伸びる要素の高さを制約にすると、縮めた後に大きくできなくなったり、
    // 行の高さが違う候補を選べなくなったりするため使わない
    height: typography.hasFixedHeight ? size.height : Infinity,
    maxLines: _toLimit(options.maxLines),
    style,
  };
  const probe = _createTextProbe(
    element,
    size.width,
    base ? { ...style, lineHeight: base.lineHeight } : style,
  );
  const maxChars = options.truncate ? _toLimit(options.maxChars) : Infinity;
  const last = candidates.length - 1;

  /**
   * 候補が、指定した大きさ（省略した場合は今の大きさ）で収まるか
   */
  const fitsAt = (candidate: string, fontSize?: number) => {
    if (
      maxChars !== Infinity &&
      _splitGraphemes(candidate, options.locale).length > maxChars
    ) {
      return false;
    }
    if (fontSize !== undefined) {
      probe.setStyle({ fontSize: `${fontSize}px` });
    }
    return _isFitting(probe.measure(candidate), limits);
  };

  const fitted = (index: number, fontSize: number | null): FitResult => ({
    displayText: candidates[index]!,
    index,
    fontSize,
    isTruncated: false,
    isOverflowing: false,
  });

  try {
    const range = base
      ? _resolveFontSizeRange(options, base.fontSize)
      : undefined;

    if (!base || !range) {
      // 文字の大きさを変えない: 今の大きさで候補を順に試す
      const index = candidates.findIndex((candidate) => fitsAt(candidate));
      if (index >= 0) {
        return fitted(index, null);
      }
    } else if (!options.resizeFirst && Number.isFinite(range.max)) {
      // 候補を先に切り替える: 各候補を上限の大きさで試し、どれも収まらなければ最後の候補を縮める
      const index = candidates.findIndex((candidate) =>
        fitsAt(candidate, range.max),
      );
      if (index >= 0) {
        return fitted(index, range.max);
      }
      const searched = _searchFontSize(
        (fontSize) => fitsAt(candidates[last]!, fontSize),
        range.min,
        range.max,
        base.fontSize,
      );
      if (searched.fits) {
        return fitted(last, searched.fontSize);
      }
    } else {
      // 先に縮める: 各候補を縮めながら順に試す
      for (let index = 0; index <= last; index++) {
        const searched = _searchFontSize(
          (fontSize) => fitsAt(candidates[index]!, fontSize),
          range.min,
          range.max,
          base.fontSize,
        );
        if (searched.fits) {
          return fitted(index, searched.fontSize);
        }
      }
    }

    // どの候補も収まらない: 最後の候補を、下限の大きさで省略する（truncate のとき）
    const fontSize = range ? range.min : null;
    if (fontSize !== null) {
      probe.setStyle({ fontSize: `${fontSize}px` });
    }
    if (options.truncate) {
      const { displayText, isTruncated } = _searchTruncation(
        probe,
        limits,
        candidates[last]!,
        _createTruncator(candidates[last]!, options),
        maxChars,
      );
      return {
        displayText,
        index: last,
        fontSize,
        isTruncated,
        isOverflowing: false,
      };
    }
    return {
      displayText: candidates[last]!,
      index: last,
      fontSize,
      isTruncated: false,
      isOverflowing: true,
    };
  } finally {
    // 計測が途中で失敗しても、計測用の要素を残さない
    probe.remove();
  }
}

/**
 * 2つの snapshot が等しいか
 */
function _isEqualSnapshot(
  a: Omit<FitTextSnapshot, 'isPending'>,
  b: Omit<FitTextSnapshot, 'isPending'>,
): boolean {
  return (
    a.displayText === b.displayText &&
    a.index === b.index &&
    a.fontSize === b.fontSize &&
    a.isTruncated === b.isTruncated &&
    a.isOverflowing === b.isOverflowing &&
    _isShallowEqual(a.style, b.style)
  );
}
