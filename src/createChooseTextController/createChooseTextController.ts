import _createControllerCore, {
  type ComputeSnapshot,
  type FreezeSnapshot,
} from '../_internal/_createControllerCore';
import _createTextProbe from '../_internal/_createTextProbe';
import _createTextStyle from '../_internal/_createTextStyle';
import _getHeightLimit from '../_internal/_getHeightLimit';
import _isFitting from '../_internal/_isFitting';
import _isShallowEqual from '../_internal/_isShallowEqual';
import _toCandidates from '../_internal/_toCandidates';
import _toLimit from '../_internal/_toLimit';
import type {
  ChooseTextController,
  ChooseTextControllerOptions,
  ChooseTextSnapshot,
} from './types';

/**
 * 要素の大きさ（幅・高さ）と行数に収まる表現を、候補から選ぶ Controller を作る\
 * DOM が要る（作るだけなら DOM に触れないので、SSR でも作れる）
 *
 * - 候補を前から順に測り、最初に収まったものを表示する（候補は望ましい順に並べる）
 * - どの候補も収まらない場合は最後の候補を表示し、isOverflowing で知らせる（はみ出しは CSS に任せる）
 * - 候補の中身は区別しない。書式化した数値や日付など、利用者が作った文字列を渡す
 * - 空の配列は、空文字を1つ渡したものとして扱う
 *
 * @param candidates 候補（望ましい順）
 * @param options オプション
 * @returns Controller
 */
export default function createChooseTextController(
  candidates: readonly string[],
  options: ChooseTextControllerOptions = {},
): ChooseTextController {
  let currentCandidates = _toCandidates(candidates);
  let currentOptions = options;
  let style = _createTextStyle(options.wrap);

  const compute: ComputeSnapshot<Omit<ChooseTextSnapshot, 'isPending'>> = (
    element,
    size,
  ) => {
    if (currentOptions.disabled || !element || !size) {
      return {
        displayText: currentCandidates[0]!,
        index: 0,
        isOverflowing: null,
        style,
      };
    }
    const limits = {
      width: size.width,
      height: _getHeightLimit(element, size),
      maxLines: _toLimit(currentOptions.maxLines),
      style,
    };
    const probe = _createTextProbe(element, size.width, style);
    try {
      const index = currentCandidates.findIndex((candidate) =>
        _isFitting(probe.measure(candidate), limits),
      );
      const last = currentCandidates.length - 1;
      return {
        displayText: currentCandidates[index < 0 ? last : index]!,
        index: index < 0 ? last : index,
        isOverflowing: index < 0,
        style,
      };
    } finally {
      // 計測が途中で失敗しても、計測用の要素を残さない
      probe.remove();
    }
  };

  // 計測を止めている間は、最後に選んだのと同じ位置の候補を表示する（候補が減った場合は最後の候補）
  const freeze: FreezeSnapshot<Omit<ChooseTextSnapshot, 'isPending'>> = (
    measured,
  ) => {
    const index = Math.min(measured.index, currentCandidates.length - 1);
    return {
      ...measured,
      displayText: currentCandidates[index]!,
      index,
      style,
    };
  };

  const core = _createControllerCore(
    compute,
    _isEqualSnapshot,
    () => currentOptions,
    freeze,
  );

  const update = (
    nextCandidates: readonly string[],
    nextOptions: ChooseTextControllerOptions = {},
  ) => {
    const normalized = _toCandidates(nextCandidates);
    if (
      _isShallowEqual(normalized, currentCandidates) &&
      _isShallowEqual(nextOptions, currentOptions)
    ) {
      return;
    }
    currentCandidates = normalized;
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
 * 2つの snapshot が等しいか
 */
function _isEqualSnapshot(
  a: Omit<ChooseTextSnapshot, 'isPending'>,
  b: Omit<ChooseTextSnapshot, 'isPending'>,
): boolean {
  return (
    a.displayText === b.displayText &&
    a.index === b.index &&
    a.isOverflowing === b.isOverflowing &&
    a.style === b.style
  );
}
