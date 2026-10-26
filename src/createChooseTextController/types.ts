import type { TextFittingStyle, TextLayoutOptions } from '../types';

/**
 * createChooseTextController関数のオプション
 */
export type ChooseTextControllerOptions = TextLayoutOptions;

/**
 * 候補から選んだ結果
 */
export type ChooseTextSnapshot = {
  /**
   * 表示する文字列（選んだ候補）
   */
  readonly displayText: string;

  /**
   * 選んだ候補の番号\
   * 未計測の間と、止めている間は 0（最初の候補を表示する）
   */
  readonly index: number;

  /**
   * どの候補も収まらないか（最後の候補を表示する）\
   * 未計測（要素を接続していない、DOM に無い、`display: none`、幅が 0）の間と、止めている間は null
   */
  readonly isOverflowing: boolean | null;

  /**
   * 表示する要素に当てるスタイル
   */
  readonly style: Readonly<TextFittingStyle>;
};

/**
 * 要素の大きさに合わせて、収まる表現を候補から選ぶ Controller
 */
export type ChooseTextController = {
  /**
   * 表示する要素を接続する\
   * null を渡すと接続を解除する。接続すると、その場で計測する
   * @param element 表示する要素
   */
  attach(element: HTMLElement | null): void;

  /**
   * 最後の結果を返す\
   * 結果が変わらない間は、同じオブジェクトを返す
   */
  getSnapshot(): ChooseTextSnapshot;

  /**
   * 結果の変化を購読する
   * @param listener 結果が変わったときに呼ぶ関数
   * @returns 購読を解除する関数
   */
  subscribe(listener: () => void): () => void;

  /**
   * 候補とオプションを変え、その場で計測する
   * @param candidates 候補（望ましい順）
   * @param options オプション
   */
  update(
    candidates: readonly string[],
    options?: ChooseTextControllerOptions,
  ): void;

  /**
   * 今の候補とオプションで、その場で計測し直す
   */
  refresh(): void;

  /**
   * 監視と購読をすべて解除する。破棄した後の操作は何もしない
   */
  destroy(): void;
};
