import type {
  TextFittingStyle,
  TextLayoutOptions,
  TruncateOptions,
} from '../types';

/**
 * createTruncateTextController関数のオプション
 */
export type TruncateTextControllerOptions = TruncateOptions &
  TextLayoutOptions & {
    /**
     * 省略記号を含めた書記素（見た目の1文字）の数の上限\
     * 要素の大きさに加えて、この上限も守る。NaN は上限なし、負の値は 0、小数は切り捨てて扱う
     */
    maxChars?: number;
  };

/**
 * 省略した結果
 */
export type TruncateTextSnapshot = {
  /**
   * 表示する文字列
   */
  readonly displayText: string;

  /**
   * 省略したか\
   * 未計測（要素を接続していない、DOM に無い、`display: none`、幅が 0）の間は null
   */
  readonly isTruncated: boolean | null;

  /**
   * 表示する要素に当てるスタイル
   */
  readonly style: Readonly<TextFittingStyle>;
  /**
   * 検知した変化（要素の大きさの変化・フォントの読み込み）の反映を待っているか\
   * detectionDelay の間は true。その間の結果は、最後に計測したときのもの
   */
  readonly isPending: boolean;
};

/**
 * 要素の大きさに合わせて文字列を省略する Controller
 */
export type TruncateTextController = {
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
  getSnapshot(): TruncateTextSnapshot;

  /**
   * 結果の変化を購読する
   * @param listener 結果が変わったときに呼ぶ関数
   * @returns 購読を解除する関数
   */
  subscribe(listener: () => void): () => void;

  /**
   * 文字列とオプションを変え、その場で計測する
   * @param text 文字列
   * @param options オプション
   */
  update(text: string, options?: TruncateTextControllerOptions): void;

  /**
   * 今の文字列とオプションで、その場で計測し直す
   */
  refresh(): void;

  /**
   * 監視と購読をすべて解除する。破棄した後の操作は何もしない
   */
  destroy(): void;
};
