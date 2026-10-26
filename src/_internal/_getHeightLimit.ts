import type { ContentBoxSize } from './_createControllerCore';
import _readBaseTypography from './_readBaseTypography';

/**
 * 収める高さを返す
 *
 * 要素の高さが CSS かレイアウトで決まっている場合だけ、その高さを制約にする。
 * 中身に合わせて伸びる要素の高さは、表示している文字列で決まった高さにすぎないため、制約にすると
 * 文字列や幅が変わっても、最初の高さに収め続けてしまう（行の高さが違う代わりのフォントの候補を選べない、など）。
 * 高さが決まっているかは、要素の font-size を一時的に変えて確かめる（すぐに戻すので、画面には表示されない）
 *
 * @param element 要素
 * @param size 要素の内容の領域の大きさ
 * @returns 収める高さ（px）。制約が無い場合は Infinity
 */
export default function _getHeightLimit(
  element: HTMLElement,
  size: ContentBoxSize,
): number {
  return _readBaseTypography(element, undefined).hasFixedHeight
    ? size.height
    : Infinity;
}
