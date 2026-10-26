import type { TextFittingStyle, TextWrap } from '../types';

/**
 * 折り返しごとのスタイル（結果が変わらない間は同じオブジェクトを返すため、使い回す）
 */
const STYLES: Record<TextWrap, Readonly<TextFittingStyle>> = {
  none: { whiteSpace: 'pre' },
  normal: { whiteSpace: 'pre-wrap' },
  anywhere: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
};

/**
 * 折り返しに合わせて、表示する要素に当てるスタイルを返す
 *
 * 改行と空白はそのまま表示する
 *
 * @param wrap 折り返し。不正な値は 'none' として扱う
 * @returns スタイル
 */
export default function _createTextStyle(
  wrap: TextWrap | undefined,
): Readonly<TextFittingStyle> {
  return (wrap && STYLES[wrap]) || STYLES.none;
}
