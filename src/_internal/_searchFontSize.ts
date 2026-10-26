/**
 * 下限を指定しないときの font-size の下限（px）
 */
const DEFAULT_MIN_FONT_SIZE = 1;

/**
 * 上限が Infinity のときに、大きくしていく font-size の上限（px）
 */
const MAX_SEARCH_FONT_SIZE = 10000;

/**
 * font-size を探すときの細かさ（px）
 */
const PRECISION = 0.1;

/**
 * font-size の範囲のオプション
 */
export type FontSizeRangeOptions = {
  minFontSize?: number;
  maxFontSize?: number;
};

/**
 * font-size のオプションを数値にする。NaN・0 以下は指定しなかったものとして扱う
 */
const toFontSize = (value: number | undefined) =>
  value !== undefined && value > 0 ? value : undefined;

/**
 * font-size の下限と上限を決める
 *
 * 下限を省略した場合は 1px、上限を省略した場合は CSS の font-size。
 * 下限が上限以上の場合は、下限に固定する（下限を優先する）
 *
 * @param options オプション
 * @param baseFontSize CSS の font-size（px）
 * @returns 下限と上限（上限は Infinity のことがある）
 */
export function _resolveFontSizeRange(
  options: FontSizeRangeOptions,
  baseFontSize: number,
): { min: number; max: number } {
  const min = toFontSize(options.minFontSize) ?? DEFAULT_MIN_FONT_SIZE;
  const max = toFontSize(options.maxFontSize) ?? baseFontSize;
  return { min, max: Math.max(min, max) };
}

/**
 * font-size を小数第2位で切り捨てる（収まる側に倒す）
 */
const round = (value: number) => Math.floor(value * 100) / 100;

/**
 * 下限〜上限の範囲で、収まる最大の font-size を探す
 *
 * 上限で収まれば上限、下限でも収まらなければ下限（fits: false）を返す。
 * それ以外は二分探索で探す。上限が Infinity のときは、収まらなくなるまで2倍にしていき範囲を決める
 *
 * @param fitsAt その font-size で収まるかを測る関数
 * @param min 下限（px）
 * @param max 上限（px）。Infinity も可
 * @param baseFontSize 上限が Infinity のときに、大きくしていく起点の font-size（px）
 * @returns 選んだ font-size と、収まったか
 */
export default function _searchFontSize(
  fitsAt: (fontSize: number) => boolean,
  min: number,
  max: number,
  baseFontSize: number,
): { fontSize: number; fits: boolean } {
  if (min >= max) {
    return { fontSize: min, fits: fitsAt(min) };
  }

  let low = min;
  let high = max;
  if (!Number.isFinite(high)) {
    let current = Math.max(baseFontSize, min);
    if (fitsAt(current)) {
      while (current < MAX_SEARCH_FONT_SIZE && fitsAt(current * 2)) {
        current *= 2;
      }
      low = current;
      high = Math.min(current * 2, MAX_SEARCH_FONT_SIZE);
    } else {
      high = current;
    }
  }

  if (fitsAt(high)) {
    return { fontSize: round(high), fits: true };
  }
  if (low === min && !fitsAt(min)) {
    return { fontSize: min, fits: false };
  }

  // low は収まり、high は収まらない
  while (high - low > PRECISION) {
    const middle = (low + high) / 2;
    if (fitsAt(middle)) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return { fontSize: round(low), fits: true };
}
