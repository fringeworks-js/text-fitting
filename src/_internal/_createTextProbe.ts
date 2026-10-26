/**
 * 計測用の要素に写す、文字の大きさや折り返しに関わるスタイル
 */
const TEXT_PROPERTIES = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variant',
  'font-kerning',
  'font-feature-settings',
  'font-variation-settings',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'text-indent',
  'text-rendering',
  'tab-size',
  'word-break',
  'line-break',
  'hyphens',
  'overflow-wrap',
  'white-space',
  'direction',
];

/**
 * 文字列を測った結果
 */
export type TextProbeMetrics = {
  /**
   * 描画した文字列の右端（計測用の要素の左端からの距離）
   */
  right: number;

  /**
   * 計測用の要素の scrollWidth
   */
  scrollWidth: number;

  /**
   * 高さ
   */
  height: number;

  /**
   * 行数
   */
  lines: number;

  /**
   * range で指定した部分が何行にまたがっているか。range を指定しない場合は 0
   */
  rangeLines: number;
};

/**
 * 要素の文字の書式を写した計測用の要素
 */
export type TextProbe = {
  /**
   * 文字列を入れて測る
   * @param text 文字列
   * @param range 何行にまたがるかを調べる部分（UTF-16 の位置）
   */
  measure(text: string, range?: [start: number, end: number]): TextProbeMetrics;

  /**
   * 計測用の要素を DOM から取り除く
   */
  remove(): void;
};

/**
 * 要素の文字の書式だけを写した、非表示の計測用の要素を作る
 *
 * 文字列を入れ替えながら何度も測れるよう、要素を使い回す。
 * 使い終わったら必ず remove を呼ぶ。DOM が要る
 *
 * @param host 書式を写す要素
 * @param width 計測用の要素の幅（px）
 * @param style 写した書式に上書きするスタイル
 * @returns 計測用の要素
 */
export default function _createTextProbe(
  host: HTMLElement,
  width: number,
  style: Readonly<Record<string, string | undefined>> = {},
): TextProbe {
  const doc = host.ownerDocument;
  const computed = doc.defaultView!.getComputedStyle(host);
  const probe = doc.createElement('div');
  for (const property of TEXT_PROPERTIES) {
    probe.style.setProperty(property, computed.getPropertyValue(property));
  }
  Object.assign(probe.style, style, {
    position: 'fixed',
    left: '-10000px',
    top: '0px',
    visibility: 'hidden',
    pointerEvents: 'none',
    boxSizing: 'content-box',
    padding: '0px',
    border: '0px',
    margin: '0px',
    width: `${width}px`,
    height: 'auto',
    minHeight: '0px',
    maxHeight: 'none',
  });
  // 言語によって改行の規則（禁則など）が変わるため、言語も写す
  const lang = host.closest('[lang]')?.getAttribute('lang');
  if (lang) {
    probe.setAttribute('lang', lang);
  }
  probe.setAttribute('aria-hidden', 'true');
  (doc.body ?? doc.documentElement).appendChild(probe);

  // 1行の高さは、計算した line-height ではなく実際に描画して測る（normal の場合も測れるように）
  probe.textContent = 'M';
  const lineHeight = probe.getBoundingClientRect().height || 1;

  /**
   * range の矩形が何行にまたがっているか
   */
  const countRangeLines = (rects: DOMRectList) => {
    const tops = new Set<number>();
    for (const rect of rects) {
      if (rect.width > 0) {
        tops.add(Math.round(rect.top));
      }
    }
    return tops.size;
  };

  const measure = (
    text: string,
    range?: [start: number, end: number],
  ): TextProbeMetrics => {
    probe.textContent = text;
    const rect = probe.getBoundingClientRect();
    let right = 0;
    let rangeLines = 0;
    const node = probe.firstChild;
    if (node) {
      // 要素の大きさだけでは行末の横のはみ出しが分からないため、描画した矩形を調べる
      const all = doc.createRange();
      all.selectNodeContents(probe);
      for (const part of all.getClientRects()) {
        right = Math.max(right, part.right - rect.left);
      }
      if (range) {
        const target = doc.createRange();
        target.setStart(node, range[0]);
        target.setEnd(node, range[1]);
        rangeLines = countRangeLines(target.getClientRects());
      }
    }
    return {
      right,
      scrollWidth: probe.scrollWidth,
      height: rect.height,
      lines: text ? Math.max(Math.round(rect.height / lineHeight), 1) : 0,
      rangeLines,
    };
  };

  const remove = () => {
    probe.remove();
  };

  return { measure, remove };
}
