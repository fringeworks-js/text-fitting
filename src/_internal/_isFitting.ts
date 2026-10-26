import type { TextFittingStyle } from '../types';
import type { TextProbeMetrics } from './_createTextProbe';

/**
 * 収まるかの判定で許す誤差（px）。小数の丸めの違いで収まらないと判定しないようにする
 */
const TOLERANCE = 0.5;

/**
 * 収める枠
 */
export type FittingLimits = {
  /**
   * 幅（px）
   */
  width: number;

  /**
   * 高さ（px）。制約が無い場合は Infinity
   */
  height: number;

  /**
   * 行数の上限。制約が無い場合は Infinity
   */
  maxLines: number;

  /**
   * 表示する要素に当てるスタイル
   */
  style: Readonly<TextFittingStyle>;
};

/**
 * 計測した結果が枠に収まるか
 *
 * 折り返すとき（pre-wrap）は、行末の空白が枠の外にぶら下がって描画される。
 * 描画した矩形の右端で判定すると、ぶら下がった空白まで「はみ出し」とみなしてしまうため、
 * 矩形の右端は折り返さないときだけ使う（折り返すときの横のはみ出しは、区切りの無い長い単語だけで、scrollWidth で分かる）
 *
 * @param metrics 計測した結果
 * @param limits 収める枠
 * @returns 収まるか
 */
export default function _isFitting(
  metrics: TextProbeMetrics,
  limits: FittingLimits,
): boolean {
  const checksRight = limits.style.whiteSpace === 'pre';
  return (
    (!checksRight || metrics.right <= limits.width + TOLERANCE) &&
    metrics.scrollWidth <= limits.width + TOLERANCE &&
    metrics.height <= limits.height + TOLERANCE &&
    metrics.lines <= limits.maxLines
  );
}
