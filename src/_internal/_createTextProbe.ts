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
   * 計測用の要素のスタイルを変える（文字の大きさを変えて測るときなど）
   * @param style スタイル
   */
  setStyle(style: Readonly<Record<string, string>>): void;

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

  /**
   * 描画した矩形が何行にまたがっているか
   *
   * 縦に重なる矩形を同じ行とみなす。高さで割って数えると、line-height が normal のときに、
   * 代わりのフォント（日本語や絵文字など）で行が高くなった分を余分に数えてしまうため。
   * 同じ行の矩形は、フォントが違って上端がずれても縦には重なる
   */
  const countLines = (rects: DOMRectList) => {
    const sorted = Array.from(rects)
      .filter((rect) => rect.height > 0)
      .sort((a, b) => a.top - b.top);
    let lines = 0;
    let lineBottom = -Infinity;
    for (const rect of sorted) {
      // 1px 未満の重なりは、小数の丸めの違いとして別の行とみなす
      if (rect.top >= lineBottom - 1) {
        lines++;
        lineBottom = rect.bottom;
      } else {
        lineBottom = Math.max(lineBottom, rect.bottom);
      }
    }
    return lines;
  };

  const measure = (
    text: string,
    range?: [start: number, end: number],
  ): TextProbeMetrics => {
    probe.textContent = text;
    const rect = probe.getBoundingClientRect();
    let right = 0;
    let lines = 0;
    let rangeLines = 0;
    const node = probe.firstChild;
    if (node) {
      // 要素の大きさだけでは行末の横のはみ出しが分からないため、描画した矩形を調べる
      const all = doc.createRange();
      all.selectNodeContents(probe);
      const rects = all.getClientRects();
      for (const part of rects) {
        right = Math.max(right, part.right - rect.left);
      }
      lines = Math.max(countLines(rects), 1);
      if (range) {
        const target = doc.createRange();
        target.setStart(node, range[0]);
        target.setEnd(node, range[1]);
        rangeLines = countLines(target.getClientRects());
      }
    }
    return {
      right,
      scrollWidth: probe.scrollWidth,
      height: rect.height,
      lines,
      rangeLines,
    };
  };

  const setStyle = (next: Readonly<Record<string, string>>) => {
    Object.assign(probe.style, next);
  };

  const remove = () => {
    probe.remove();
  };

  return { measure, setStyle, remove };
}
