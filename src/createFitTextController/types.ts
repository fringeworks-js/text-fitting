import type { ResizeTextStyle } from '../createResizeTextController';
import type { TextLayoutOptions, TruncateOptions } from '../types';

/**
 * createFitTextController関数のオプション
 *
 * 3つの機能（候補を選ぶ・文字の大きさ・省略する）のオプションを並べたものに、組み合わせに固有のもの（truncate・resizeFirst）を足す。
 * 各機能は、指定したときだけ有効になる
 */
export type FitTextControllerOptions = TextLayoutOptions &
  TruncateOptions & {
    /**
     * font-size の下限（px）\
     * minFontSize か maxFontSize を指定すると、文字の大きさを変える。省略した場合の下限は 1px
     */
    minFontSize?: number;

    /**
     * font-size の上限（px）\
     * minFontSize か maxFontSize を指定すると、文字の大きさを変える。省略した場合の上限は、要素の CSS の font-size
     */
    maxFontSize?: number;

    /**
     * 最後の手段として省略する\
     * 最後の候補を、下限の大きさで省略する
     * @default false
     */
    truncate?: boolean;

    /**
     * 省略記号を含めた書記素の数の上限\
     * truncate が true のときだけ使う。これを超える候補は選ばず、最後の候補はこの数に収まるように省略する
     */
    maxChars?: number;

    /**
     * 候補を切り替える前に、文字を縮める\
     * false: 各候補を上限の大きさで試し、どれも収まらなければ最後の候補を縮める（文字の大きさが揃う）\
     * true: 各候補を縮めながら順に試す（正確な表現をできるだけ残す）。
     * maxFontSize が Infinity の場合は、どちらでも true と同じ動作になる
     * @default false
     */
    resizeFirst?: boolean;
  };

/**
 * 組み合わせて収めた結果
 */
export type FitTextSnapshot = {
  /**
   * 表示する文字列
   */
  readonly displayText: string;

  /**
   * 選んだ候補の番号\
   * 未計測の間と、止めている間は 0（最初の候補を表示する）
   */
  readonly index: number;

  /**
   * 選んだ font-size（px）\
   * 文字の大きさを変えない場合（minFontSize・maxFontSize を指定しない場合）、未計測の間、止めている間は null
   */
  readonly fontSize: number | null;

  /**
   * 省略したか\
   * 未計測の間と、止めている間は null
   */
  readonly isTruncated: boolean | null;

  /**
   * どの手段でも収まらないか（最後の候補を、下限の大きさで表示する）\
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
 * 要素の大きさに合わせて、候補を選ぶ・文字の大きさを変える・省略するを組み合わせて文字列を収める Controller
 */
export type FitTextController = {
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
  getSnapshot(): FitTextSnapshot;

  /**
   * 結果の変化を購読する
   * @param listener 結果が変わったときに呼ぶ関数
   * @returns 購読を解除する関数
   */
  subscribe(listener: () => void): () => void;

  /**
   * 文字列（または候補）とオプションを変え、その場で計測する
   * @param text 文字列か、候補の配列（望ましい順）
   * @param options オプション
   */
  update(
    text: string | readonly string[],
    options?: FitTextControllerOptions,
  ): void;

  /**
   * 今の文字列とオプションで、その場で計測し直す
   */
  refresh(): void;

  /**
   * 監視と購読をすべて解除する。破棄した後の操作は何もしない
   */
  destroy(): void;
};
