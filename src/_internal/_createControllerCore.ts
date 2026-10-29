import type { TextFittingStyle } from '../types';
import _getContentBoxSize from './_getContentBoxSize';

/**
 * 要素の内容の領域の大きさ
 */
export type ContentBoxSize = { width: number; height: number };

/**
 * 計測して snapshot（`isPending` を除く）を作る関数
 *
 * 計測できない場合（未接続、DOM に無い、`display: none`、幅が 0）は、size が undefined で呼ばれる
 */
export type ComputeSnapshot<S> = (
  element: HTMLElement | undefined,
  size: ContentBoxSize | undefined,
) => S;

/**
 * 検知した変化の反映に関わるオプション（Controller の今のオプションから読む）
 */
export type DetectionOptions = {
  detectionDelay?: number;
  hideWhilePending?: boolean;
  disabled?: boolean;
};

/**
 * Controller に共通の snapshot の部分
 */
export type PendingSnapshot = {
  readonly isPending: boolean;
};

/**
 * Controller に共通の仕組み（要素の接続、測り直し、購読）
 */
export type ControllerCore<S> = {
  attach(element: HTMLElement | null): void;
  getSnapshot(): S;
  subscribe(listener: () => void): () => void;
  refresh(): void;
  destroy(): void;
};

/**
 * 大きさの変化とみなす差（px）。描画の結果で起きたわずかな変化では測り直さない
 */
const SIZE_TOLERANCE = 0.5;

/**
 * 計測した直後に、自分の結果（文字列や font-size）を描画したことによる大きさの変化とみなすフレーム数。
 * この間に検知した変化は、detectionDelay を待たずに次のフレームで計測する（待つと、表示した直後にまた隠れてしまうため）
 */
const SELF_CHANGE_FRAMES = 3;

/**
 * detectionDelay を、待つ時間（ミリ秒）にする。NaN・負の値・数値でないものは 0
 */
const _toDelay = (value: number | undefined): number =>
  typeof value === 'number' && value > 0 ? value : 0;

/**
 * Controller に共通の仕組みを作る
 *
 * - attach・refresh では、その場で計測する（更新のたびに元の文字列が一瞬表示されないように）
 * - 要素の大きさの変化（ResizeObserver）とフォントの読み込み（`document.fonts` の `loadingdone`）を検知したら、
 *   detectionDelay が 0 なら次のフレームにまとめて計測する。前回の計測から大きさが変わっていない通知では測り直さない
 * - detectionDelay が正の値なら、最後に検知してからその時間だけ待って計測する。待っている間は `isPending` が true になり、
 *   hideWhilePending が true なら style に `visibility: hidden` を加える。待っている間に attach・refresh で計測した場合は、待つのをやめる
 * - 計測した直後の数フレームに検知した変化は、自分の結果を描画したことによるものとみなし、待たずに次のフレームで計測する
 * - 止めている（disabled）間は待たない
 * - snapshot が変わらなければ通知しない
 * - 破棄した後の操作は何もしない
 *
 * @param compute 計測して snapshot（`isPending` を除く）を作る関数
 * @param isEqual 2つの snapshot（`isPending` を除く）が等しいかを判定する関数
 * @param getOptions Controller の今のオプションを返す関数
 * @returns Controller に共通の仕組み
 */
export default function _createControllerCore<
  S extends { readonly style: Readonly<TextFittingStyle> },
>(
  compute: ComputeSnapshot<S>,
  isEqual: (a: S, b: S) => boolean,
  getOptions: () => DetectionOptions,
): ControllerCore<S & PendingSnapshot> {
  let base = compute(undefined, undefined);
  let pending = false;
  let hidden = false;
  // 隠すスタイルは、元のスタイルが変わらない間は同じオブジェクトを使う（snapshot の比較と、React の再描画を抑えるため）
  let hiddenStyleFor: Readonly<TextFittingStyle> | undefined;
  let hiddenStyle: Readonly<TextFittingStyle> | undefined;
  let snapshot: S & PendingSnapshot = { ...base, isPending: false };
  let element: HTMLElement | undefined;
  let lastSize: ContentBoxSize | undefined;
  let observer: ResizeObserver | undefined;
  let removeFontListener: (() => void) | undefined;
  let frame: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // 計測した直後の、自分の結果による変化とみなすフレームを数える
  let selfChangeFrame: number | undefined;
  let selfChangeFramesLeft = 0;
  let destroyed = false;
  const listeners = new Set<() => void>();

  const getHiddenStyle = (style: Readonly<TextFittingStyle>) => {
    if (hiddenStyleFor !== style || !hiddenStyle) {
      hiddenStyleFor = style;
      hiddenStyle = { ...style, visibility: 'hidden' };
    }
    return hiddenStyle;
  };

  const publish = (nextBase: S, nextPending: boolean) => {
    const nextHidden = nextPending && !!getOptions().hideWhilePending;
    if (
      isEqual(base, nextBase) &&
      pending === nextPending &&
      hidden === nextHidden
    ) {
      return;
    }
    base = nextBase;
    pending = nextPending;
    hidden = nextHidden;
    snapshot = {
      ...nextBase,
      style: nextHidden ? getHiddenStyle(nextBase.style) : nextBase.style,
      isPending: nextPending,
    };
    for (const listener of [...listeners]) {
      listener();
    }
  };

  /**
   * 計測できる状態なら、内容の領域の大きさを返す
   */
  const getMeasurableSize = (): ContentBoxSize | undefined => {
    if (!element?.isConnected) {
      return undefined;
    }
    const size = _getContentBoxSize(element);
    return size.width > 0 ? size : undefined;
  };

  const cancelFrame = () => {
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
  };

  const cancelTimer = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const cancelSelfChangeFrames = () => {
    if (selfChangeFrame !== undefined) {
      cancelAnimationFrame(selfChangeFrame);
      selfChangeFrame = undefined;
    }
    selfChangeFramesLeft = 0;
  };

  /**
   * 計測した直後のフレームを数え始める
   */
  const startSelfChangeFrames = () => {
    cancelSelfChangeFrames();
    selfChangeFramesLeft = SELF_CHANGE_FRAMES;
    const tick = () => {
      selfChangeFramesLeft--;
      selfChangeFrame =
        selfChangeFramesLeft > 0 ? requestAnimationFrame(tick) : undefined;
    };
    selfChangeFrame = requestAnimationFrame(tick);
  };

  const run = () => {
    cancelFrame();
    cancelTimer();
    if (destroyed) {
      return;
    }
    lastSize = getMeasurableSize();
    publish(compute(lastSize && element, lastSize), false);
    startSelfChangeFrames();
  };

  const schedule = () => {
    if (destroyed || frame !== undefined) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = undefined;
      run();
    });
  };

  /**
   * 変化を検知したときの処理。detectionDelay に合わせて、次のフレームか、待ってから計測する
   */
  const detect = () => {
    if (destroyed) {
      return;
    }
    const options = getOptions();
    const delay = options.disabled ? 0 : _toDelay(options.detectionDelay);
    if (delay === 0 || selfChangeFramesLeft > 0) {
      schedule();
      return;
    }
    cancelFrame();
    cancelTimer();
    timer = setTimeout(() => {
      timer = undefined;
      run();
    }, delay);
    publish(base, true);
  };

  const disconnect = () => {
    cancelFrame();
    cancelTimer();
    cancelSelfChangeFrames();
    observer?.disconnect();
    observer = undefined;
    removeFontListener?.();
    removeFontListener = undefined;
  };

  const attach = (next: HTMLElement | null) => {
    if (destroyed || element === (next ?? undefined)) {
      return;
    }
    disconnect();
    element = next ?? undefined;
    if (element) {
      const target = element;
      observer = new ResizeObserver(() => {
        const size = getMeasurableSize();
        if (
          !size ||
          !lastSize ||
          Math.abs(size.width - lastSize.width) > SIZE_TOLERANCE ||
          Math.abs(size.height - lastSize.height) > SIZE_TOLERANCE
        ) {
          detect();
        }
      });
      observer.observe(target);
      const fonts = target.ownerDocument.fonts;
      if (fonts && typeof fonts.addEventListener === 'function') {
        fonts.addEventListener('loadingdone', detect);
        removeFontListener = () => {
          fonts.removeEventListener('loadingdone', detect);
        };
      }
    }
    run();
  };

  const subscribe = (listener: () => void) => {
    if (destroyed) {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const destroy = () => {
    if (destroyed) {
      return;
    }
    disconnect();
    destroyed = true;
    element = undefined;
    listeners.clear();
  };

  return {
    attach,
    getSnapshot: () => snapshot,
    subscribe,
    refresh: run,
    destroy,
  };
}
