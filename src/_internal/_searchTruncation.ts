import type { TextProbe } from './_createTextProbe';
import type { TruncatedParts, Truncator } from './_createTruncator';
import _isFitting, { type FittingLimits } from './_isFitting';

/**
 * 候補を長い順にすべて測る、書記素の数の上限\
 * これを超える長い文字列は、記号なしの候補の二分探索で範囲を絞ってから測る
 */
const LINEAR_SEARCH_LIMIT = 256;

/**
 * 枠に収まる最も長い省略の候補を、計測して選ぶ
 *
 * 計測用の要素の書式（font-size など）は、呼び出す側で決めておく
 *
 * @param probe 計測用の要素
 * @param limits 収める枠
 * @param text 文字列
 * @param truncator 文字列の Truncator
 * @param maxChars 省略記号を含めた書記素の数の上限（Infinity は上限なし）
 * @returns 表示する文字列と、省略したか
 */
export default function _searchTruncation(
  probe: TextProbe,
  limits: FittingLimits,
  text: string,
  truncator: Truncator,
  maxChars: number,
): { displayText: string; isTruncated: boolean } {
  /**
   * 候補が枠に収まるか。省略記号が途中で折り返していないかも確かめる
   */
  const fits = (value: string, parts?: TruncatedParts) => {
    const range: [number, number] | undefined = parts?.marker
      ? [parts.before.length, parts.before.length + parts.marker.length]
      : undefined;
    const metrics = probe.measure(value, range);
    return _isFitting(metrics, limits) && (!range || metrics.rangeLines <= 1);
  };

  /**
   * 残す書記素の数を減らしながら候補を測り、最初に収まったものを返す
   */
  const findLongest = (upper: number, withMarker: boolean) => {
    let previous: string | undefined;
    for (let kept = upper; kept >= 0; kept--) {
      const parts = truncator.cut(kept, withMarker);
      const value = parts.before + parts.marker + parts.after;
      // 単語の境界で切る場合などは、残す数が違っても同じ候補になる
      if (value === previous) {
        continue;
      }
      previous = value;
      if (fits(value, parts)) {
        return value;
      }
    }
    return undefined;
  };

  const { count, ellipsisCount } = truncator;
  if (count <= maxChars && fits(text)) {
    return { displayText: text, isTruncated: false };
  }

  // 候補は、記号を除いて残す書記素の数で作る。記号を含めた数は元の文字列より多くなってもよい
  // （幅の狭い記号なら、元の文字列が収まらなくても、記号を付けた候補は収まることがある）
  let upper = Math.min(count - 1, maxChars);
  if (upper > LINEAR_SEARCH_LIMIT) {
    // 記号付きの候補は、長さに対して「収まるか」が単調ではない（記号が折り返す位置などによる）ため、
    // 記号なしの候補で二分探索して範囲を絞り、その下から長い順に記号付きの候補を測る
    let low = 0;
    let high = upper;
    let found = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const parts = truncator.cut(middle, false);
      if (fits(parts.before + parts.after)) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    upper = found;
  }

  // 記号付きの候補を先に測り、記号だけでも収まらない場合は記号なしで切る
  const displayText =
    (ellipsisCount <= maxChars
      ? findLongest(Math.min(upper, maxChars - ellipsisCount), true)
      : undefined) ??
    findLongest(upper, false) ??
    '';
  return { displayText, isTruncated: true };
}
