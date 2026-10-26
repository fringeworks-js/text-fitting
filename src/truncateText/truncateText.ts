import _createTruncator from '../_internal/_createTruncator';
import type { TruncateTextOptions } from './types';

/**
 * 省略記号を含めた書記素（見た目の1文字）の数が上限以下になるように、文字列を省略する\
 * DOM を参照しないので、どの環境でも使える
 *
 * - 上限以下なら、元の文字列をそのまま返す（省略記号の分を空けない）
 * - 絵文字や結合文字の途中では切らない
 * - 記号だけでも上限を超える場合は、記号を付けずに切る
 *
 * @param text 文字列
 * @param options オプション
 * @returns 省略した文字列
 */
export default function truncateText(
  text: string,
  options: TruncateTextOptions,
): string {
  return _createTruncator(text, options).truncate(options.maxChars);
}
