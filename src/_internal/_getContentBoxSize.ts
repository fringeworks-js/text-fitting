/**
 * 要素の内容の領域の大きさ（padding・border・スクロールバーを除く）を返す
 *
 * `clientWidth` などは整数に丸められるため、`getBoundingClientRect` の小数の値から差し引く。
 * DOM が要る
 *
 * @param element 要素
 * @returns 内容の領域の幅と高さ（px）
 */
export default function _getContentBoxSize(element: HTMLElement): {
  width: number;
  height: number;
} {
  const style = element.ownerDocument.defaultView!.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const px = (value: string) => Number.parseFloat(value) || 0;
  // offset* と client* の差は、border とスクロールバーの幅
  return {
    width:
      rect.width -
      (element.offsetWidth - element.clientWidth) -
      px(style.paddingLeft) -
      px(style.paddingRight),
    height:
      rect.height -
      (element.offsetHeight - element.clientHeight) -
      px(style.paddingTop) -
      px(style.paddingBottom),
  };
}
