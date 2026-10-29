/**
 * 省略する位置
 *
 * - 'end': 末尾を省略する（`長い文字列の…`）
 * - 'start': 先頭を省略する（`…/components/Button.tsx`）
 * - 'middle': 中央を省略し、前後を残す（`very-long-fi…-final.pdf`）
 */
export type TruncatePosition = 'end' | 'start' | 'middle';

/**
 * 切る位置の単位
 *
 * - 'grapheme': 書記素（見た目の1文字）の境界で切る
 * - 'word': 単語の境界で切る。残す側の端に空白や改行を残さない
 */
export type TruncateBoundary = 'grapheme' | 'word';

/**
 * 折り返し
 *
 * - 'none': 折り返さない。改行で区切った行ごとに、要素の幅に収める
 * - 'normal': 単語の区切りなど、通常の位置で折り返す
 * - 'anywhere': 区切りが無い長い単語や URL も、途中で折り返す
 */
export type TextWrap = 'none' | 'normal' | 'anywhere';

/**
 * 要素に収める機能で共通のオプション
 */
export type TextLayoutOptions = {
  /**
   * 折り返し\
   * 折り返すときは、要素の高さを CSS かレイアウトで決めるか、maxLines を指定する
   * @default 'none'
   */
  wrap?: TextWrap;

  /**
   * 行数の上限\
   * NaN は上限なし、負の値は 0、小数は切り捨てて扱う
   */
  maxLines?: number;

  /**
   * 動作を止める\
   * 止めている間は計測せず、元の文字列をそのまま表示する
   * @default false
   */
  disabled?: boolean;

  /**
   * 要素の大きさの変化とフォントの読み込みを検知してから、計測に反映するまでの時間（ミリ秒）\
   * この間に続けて検知した場合は、最後の検知から数え直す（大きさを変え続けている間は計測しない）。
   * 0 の場合は次のフレームで計測する。NaN・負の値は 0 として扱う。
   * attach・update・refresh による計測は待たない
   * @default 0
   */
  detectionDelay?: number;

  /**
   * 検知した変化の反映を待っている間（snapshot の isPending が true の間）、style に `visibility: hidden` を加えて隠す\
   * 要素の大きさは変わらない。detectionDelay が 0 の場合は待たないので、隠さない
   * @default false
   */
  hideWhilePending?: boolean;
};

/**
 * 要素に当てるスタイル\
 * 計測した書式と表示の書式を揃えるため、表示する要素に必ず当てる
 */
export type TextFittingStyle = {
  /**
   * 改行と空白をそのまま表示する
   */
  whiteSpace: 'pre' | 'pre-wrap';

  /**
   * wrap が 'anywhere' のときだけ指定する
   */
  overflowWrap?: 'anywhere';

  /**
   * hideWhilePending が true で、検知した変化の反映を待っている間だけ指定する
   */
  visibility?: 'hidden';
};

/**
 * 省略の機能で共通のオプション
 */
export type TruncateOptions = {
  /**
   * 省略したところに付ける記号\
   * 空文字を指定すると、記号を付けずに切る。記号だけでも上限を超える場合も、記号を付けずに切る
   * @default '...'
   */
  ellipsis?: string;

  /**
   * 省略する位置
   * @default 'end'
   */
  truncatePosition?: TruncatePosition;

  /**
   * 切る位置の単位
   * @default 'grapheme'
   */
  truncateBoundary?: TruncateBoundary;

  /**
   * 書記素・単語に分けるときに使うロケール\
   * 省略した場合や不正な値の場合は、実行環境の既定のロケールを使う
   */
  locale?: string;
};
