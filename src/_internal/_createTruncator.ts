import type { TruncateOptions } from '../types';
import _findWordBoundaries from './_findWordBoundaries';
import _splitGraphemes from './_splitGraphemes';

/**
 * 1つの文字列を、上限の書記素の数を変えながら何度も省略するためのもの
 */
export type Truncator = {
  /**
   * 元の文字列の書記素の数
   */
  readonly count: number;

  /**
   * 省略記号の書記素の数
   */
  readonly ellipsisCount: number;

  /**
   * 省略記号を含めて、書記素の数が上限以下になるように省略する\
   * 上限以下なら元の文字列をそのまま返す
   * @param maxChars 書記素の数の上限。NaN は上限なし、負の値は 0、小数は切り捨てて扱う
   */
  truncate(maxChars: number): string;

  /**
   * truncate と同じ規則で省略し、省略記号の前・記号・記号の後に分けて返す\
   * 上限以下で省略しない場合は undefined を返す
   * @param maxChars 書記素の数の上限。NaN は上限なし、負の値は 0、小数は切り捨てて扱う
   */
  split(maxChars: number): TruncatedParts | undefined;
};

/**
 * 省略した文字列を、省略記号の前・記号・記号の後に分けたもの
 */
export type TruncatedParts = {
  /**
   * 省略記号の前に残す文字列
   */
  before: string;

  /**
   * 省略記号。記号を付けずに切った場合は空文字
   */
  marker: string;

  /**
   * 省略記号の後に残す文字列
   */
  after: string;
};

/**
 * 空白・改行を含む書記素
 */
const WHITESPACE = /\s/u;

/**
 * 文字列を分割した結果を保持し、上限を変えながら省略できるようにする
 *
 * DOM の計測で候補を何度も作るため、分割は最初の1回だけ行う
 *
 * @param text 文字列
 * @param options オプション
 * @returns Truncator
 */
export default function _createTruncator(
  text: string,
  options: TruncateOptions = {},
): Truncator {
  const {
    ellipsis = '...',
    truncatePosition = 'end',
    truncateBoundary = 'grapheme',
    locale,
  } = options;
  const graphemes = _splitGraphemes(text, locale);
  const count = graphemes.length;
  const ellipsisCount = _splitGraphemes(ellipsis, locale).length;

  // offsets[i]: i 番目の書記素の前の位置（UTF-16）。offsets[count] は文字列の長さ
  const offsets = [0];
  for (const grapheme of graphemes) {
    offsets.push(offsets[offsets.length - 1]! + grapheme.length);
  }

  // 前に残せる書記素の数（昇順）と、後ろを残し始められる書記素の位置（昇順）
  const heads: number[] = [];
  const tails: number[] = [];
  if (truncateBoundary === 'word') {
    const boundaries = _findWordBoundaries(text, locale);
    for (let i = 0; i <= count; i++) {
      if (!boundaries.has(offsets[i]!)) {
        continue;
      }
      // 前の端に空白や改行を残さない
      if (i === 0 || !WHITESPACE.test(graphemes[i - 1]!)) {
        heads.push(i);
      }
      // 後ろの端に空白や改行を残さない
      if (i === count || !WHITESPACE.test(graphemes[i]!)) {
        tails.push(i);
      }
    }
  } else {
    for (let i = 0; i <= count; i++) {
      heads.push(i);
      tails.push(i);
    }
  }

  /**
   * 前に残す書記素の数を、上限以下で最大にする
   */
  const findHead = (limit: number) => {
    let result = 0;
    for (const head of heads) {
      if (head > limit) {
        break;
      }
      result = head;
    }
    return result;
  };

  /**
   * 後ろを残し始める位置を、残す数が上限以下になる範囲で最も前にする
   */
  const findTail = (limit: number) => {
    for (const tail of tails) {
      if (count - tail <= limit) {
        return tail;
      }
    }
    return count;
  };

  const split = (maxChars: number): TruncatedParts | undefined => {
    if (Number.isNaN(maxChars)) {
      return undefined;
    }
    const limit = Math.max(Math.floor(maxChars), 0);
    if (count <= limit) {
      return undefined;
    }
    // 記号だけでも上限を超える場合は、記号を付けずに切る
    const marker = ellipsisCount <= limit ? ellipsis : '';
    const budget = limit - (marker ? ellipsisCount : 0);

    switch (truncatePosition) {
      case 'start': {
        return {
          before: '',
          marker,
          after: text.slice(offsets[findTail(budget)]),
        };
      }
      case 'middle': {
        // 前を半分（奇数のときは1つ多く）にし、前で使い切れなかった分を後ろに回す
        const head = findHead(Math.ceil(budget / 2));
        const tail = findTail(budget - head);
        return {
          before: text.slice(0, offsets[head]),
          marker,
          after: text.slice(offsets[tail]),
        };
      }
      default: {
        return {
          before: text.slice(0, offsets[findHead(budget)]),
          marker,
          after: '',
        };
      }
    }
  };

  const truncate = (maxChars: number) => {
    const parts = split(maxChars);
    return parts ? parts.before + parts.marker + parts.after : text;
  };

  return { count, ellipsisCount, truncate, split };
}
