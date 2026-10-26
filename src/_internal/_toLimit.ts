/**
 * 上限のオプションを、比べられる数値にする
 *
 * undefined と NaN は上限なし（Infinity）、負の値は 0、小数は切り捨てる
 *
 * @param value 上限
 * @returns 上限
 */
export default function _toLimit(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return Infinity;
  }
  return Math.max(Math.floor(value), 0);
}
