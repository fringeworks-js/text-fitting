import type { TextFittingStyle, TextLayoutOptions } from '../types';

/**
 * createResizeTextController関数のオプション
 */
export type ResizeTextControllerOptions = TextLayoutOptions & {
  /**
   * font-size の下限（px）\
   * 省略した場合は下限を設けない（1px まで縮める。実際にはブラウザーの最小のフォントサイズで止まる）。
   * 長い文字列では、読める大きさを保つために指定する
   */
  minFontSize?: number;

  /**
   * font-size の上限（px）\
   * 省略した場合は、要素の CSS の font-size（そのままで収まれば何もせず、はみ出すときだけ縮める）。
   * 指定すると、収まる限りこの大きさまで大きくする。minFontSize の方が大きい場合は、minFontSize に固定する
   */
  maxFontSize?: number;
};

/**
 * 要素に当てるスタイル（文字の大きさの機能）
 */
export type ResizeTextStyle = TextFittingStyle & {
  /**
   * 選んだ font-size（例: `'18.5px'`）。未計測と、止めている間は指定しない
   */
  fontSize?: string;
};

/**
 * 文字の大きさを決めた結果
 */
export type ResizeTextSnapshot = {
  /**
   * 表示する文字列（元の文字列のまま）
   */
  readonly displayText: string;

  /**
   * 選んだ font-size（px）\
   * 未計測（要素を接続していない、DOM に無い、`display: none`、幅が 0）の間と、止めている間は null
   */
  readonly fontSize: number | null;

  /**
   * 下限の大きさでも収まらないか\
   * 未計測の間と、止めている間は null
   */
  readonly isOverflowing: boolean | null;

  /**
   * 表示する要素に当てるスタイル
   */
  readonly style: Readonly<ResizeTextStyle>;
  /**
   * 検知した変化（要素の大きさの変化・フォントの読み込み）の反映を待っているか\
   * detectionDelay の間は true。その間の結果は、最後に計測したときのもの
   */
  readonly isPending: boolean;
};

/**
 * 要素の大きさに合わせて文字の大きさを変える Controller
 */
export type ResizeTextController = {
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
  getSnapshot(): ResizeTextSnapshot;

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
  update(text: string, options?: ResizeTextControllerOptions): void;

  /**
   * 今の文字列とオプションで、その場で計測し直す
   */
  refresh(): void;

  /**
   * 監視と購読をすべて解除する。破棄した後の操作は何もしない
   */
  destroy(): void;
};
