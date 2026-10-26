import _getContentBoxSize from './_getContentBoxSize';

/**
 * 要素の内容の領域の大きさ
 */
export type ContentBoxSize = { width: number; height: number };

/**
 * 計測して snapshot を作る関数
 *
 * 計測できない場合（未接続、DOM に無い、`display: none`、幅が 0）は、size が undefined で呼ばれる
 */
export type ComputeSnapshot<S> = (
  element: HTMLElement | undefined,
  size: ContentBoxSize | undefined,
) => S;

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
 * Controller に共通の仕組みを作る
 *
 * - attach・refresh では、その場で計測する（更新のたびに元の文字列が一瞬表示されないように）
 * - 要素の大きさの変化（ResizeObserver）とフォントの読み込み（`document.fonts` の `loadingdone`）では、
 *   次のフレームにまとめて計測する。前回の計測から大きさが変わっていない通知では測り直さない
 * - snapshot が変わらなければ通知しない
 * - 破棄した後の操作は何もしない
 *
 * @param compute 計測して snapshot を作る関数
 * @param isEqual 2つの snapshot が等しいかを判定する関数
 * @returns Controller に共通の仕組み
 */
export default function _createControllerCore<S>(
  compute: ComputeSnapshot<S>,
  isEqual: (a: S, b: S) => boolean,
): ControllerCore<S> {
  let snapshot = compute(undefined, undefined);
  let element: HTMLElement | undefined;
  let lastSize: ContentBoxSize | undefined;
  let observer: ResizeObserver | undefined;
  let removeFontListener: (() => void) | undefined;
  let frame: number | undefined;
  let destroyed = false;
  const listeners = new Set<() => void>();

  const publish = (next: S) => {
    if (isEqual(snapshot, next)) {
      return;
    }
    snapshot = next;
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

  const run = () => {
    cancelFrame();
    if (destroyed) {
      return;
    }
    lastSize = getMeasurableSize();
    publish(compute(lastSize && element, lastSize));
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

  const disconnect = () => {
    cancelFrame();
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
          schedule();
        }
      });
      observer.observe(target);
      const fonts = target.ownerDocument.fonts;
      if (fonts && typeof fonts.addEventListener === 'function') {
        fonts.addEventListener('loadingdone', schedule);
        removeFontListener = () => {
          fonts.removeEventListener('loadingdone', schedule);
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
