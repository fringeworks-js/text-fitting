import _getContentBoxSize from './_getContentBoxSize';

/**
 * 要素の CSS で決まる文字の書式
 */
export type BaseTypography = {
  /**
   * CSS で指定された font-size（px）。Controller が当てた font-size は除く
   */
  fontSize: number;

  /**
   * 計測用の要素に当てる line-height\
   * 'normal'、font-size に比例する場合は倍率（単位なし）、固定の場合は px
   */
  lineHeight: string;

  /**
   * 要素の高さが CSS かレイアウトで決まっているか（中身に合わせて伸びないか）
   */
  hasFixedHeight: boolean;
};

/**
 * 高さが変わったとみなす差（px）
 */
const TOLERANCE = 0.5;

/**
 * 要素の CSS で決まる文字の書式を読み取る
 *
 * 要素の font-size を一時的に変えて読み取り、元に戻す（同期的に戻すので、画面には表示されない）。
 *
 * - CSS の font-size は、Controller が当てた font-size（`applied`）を一時的に外して読む
 * - line-height は、font-size を2倍にしたときに2倍になれば比例する（単位なし・em・%）とみなす。
 *   getComputedStyle は単位なしの line-height も px で返すため、そのまま写すと文字の大きさに比例しない
 * - font-size を 1px（line-height を 0）にしても要素の高さが変わらなければ、高さは CSS かレイアウトで決まっているとみなす
 *
 * DOM が要る
 *
 * @param element 要素
 * @param applied Controller が要素に当てた font-size（`style` に返した値）
 * @returns 文字の書式
 */
export default function _readBaseTypography(
  element: HTMLElement,
  applied: string | undefined,
): BaseTypography {
  const view = element.ownerDocument.defaultView!;
  const { style } = element;
  const saved = style.getPropertyValue('font-size');
  const savedLineHeight = style.getPropertyValue('line-height');
  const priority = style.getPropertyPriority('font-size');
  const lineHeightPriority = style.getPropertyPriority('line-height');
  const setProperty = (name: string, value: string, important: string) => {
    if (value) {
      style.setProperty(name, value, important);
    } else {
      style.removeProperty(name);
    }
  };
  const setFontSize = (value: string) => {
    setProperty('font-size', value, priority);
  };

  try {
    if (applied !== undefined && saved === applied) {
      setFontSize('');
    }
    const computed = view.getComputedStyle(element);
    const fontSize = Number.parseFloat(computed.fontSize) || 16;
    const baseLineHeight = computed.lineHeight;
    const baseHeight = _getContentBoxSize(element).height;

    setFontSize(`${fontSize * 2}px`);
    const doubledLineHeight = view.getComputedStyle(element).lineHeight;

    // line-height を px で固定していると、font-size を小さくしても行の高さが変わらないため、line-height も 0 にする
    setFontSize('1px');
    setProperty('line-height', '0px', lineHeightPriority);
    const tinyHeight = _getContentBoxSize(element).height;
    setProperty('line-height', savedLineHeight, lineHeightPriority);

    let lineHeight = baseLineHeight;
    if (baseLineHeight !== 'normal') {
      const base = Number.parseFloat(baseLineHeight);
      const doubled = Number.parseFloat(doubledLineHeight);
      lineHeight =
        Math.abs(doubled - base * 2) <= TOLERANCE
          ? String(base / fontSize)
          : `${base}px`;
    }

    return {
      fontSize,
      lineHeight,
      hasFixedHeight: Math.abs(baseHeight - tinyHeight) <= TOLERANCE,
    };
  } finally {
    setFontSize(saved);
  }
}
