import { createTruncateTextController } from '../createTruncateTextController';
import createFitTextController from './createFitTextController';
import type { FitTextController } from './types';

const LONG_TEXT =
  'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';

const NUMBERS = ['1,234,567', '1.2M'];

/**
 * 要素の CSS の font-size（クラスで指定する。Controller が当てるインラインの font-size と区別するため）
 */
const BASE_FONT_SIZE = 16;

let sheet: HTMLStyleElement;

beforeAll(() => {
  sheet = document.createElement('style');
  sheet.textContent = `.host { font-size: ${BASE_FONT_SIZE}px; font-family: sans-serif; line-height: 1.25; }`;
  document.head.appendChild(sheet);
});

afterAll(() => {
  sheet.remove();
});

const createHost = (css: Partial<CSSStyleDeclaration>) => {
  const host = document.createElement('div');
  host.className = 'host';
  Object.assign(host.style, css);
  document.body.appendChild(host);
  return host;
};

/**
 * Controller に共通の形（ほかの Controller の結果と比べるため、FitTextController に限らない）
 */
type AnyController = Pick<FitTextController, 'subscribe' | 'attach'> & {
  getSnapshot(): {
    displayText: string;
    style: { whiteSpace: string; fontSize?: string };
  };
};

const bind = (controller: AnyController, host: HTMLElement) => {
  const render = () => {
    const { displayText, style } = controller.getSnapshot();
    host.style.whiteSpace = style.whiteSpace;
    host.style.fontSize = style.fontSize ?? '';
    host.textContent = displayText;
  };
  render();
  controller.subscribe(render);
  controller.attach(host);
};

const isOverflowing = (host: HTMLElement) =>
  host.scrollWidth > host.clientWidth || host.scrollHeight > host.clientHeight;

describe('createFitTextController', () => {
  afterEach(() => {
    for (const element of [...document.body.children]) {
      element.remove();
    }
  });

  it('接続する前は、最初の候補を表示する', () => {
    const controller = createFitTextController(NUMBERS, { maxFontSize: 48 });
    expect(controller.getSnapshot()).toEqual({
      displayText: NUMBERS[0],
      index: 0,
      fontSize: null,
      isTruncated: null,
      isOverflowing: null,
      style: { whiteSpace: 'pre' },
      isPending: false,
    });
  });

  describe('指定した機能だけが動く', () => {
    it('候補だけ: 文字の大きさは変えず、収まる候補を選ぶ', () => {
      const host = createHost({ width: '50px' });
      const controller = createFitTextController(NUMBERS);
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        index: 1,
        fontSize: null,
        isTruncated: false,
      });
      expect(controller.getSnapshot().style.fontSize).toBeUndefined();
    });

    it('省略だけ: createTruncateTextController と同じ結果になる', () => {
      const host = createHost({ width: '150px' });
      const controller = createFitTextController(LONG_TEXT, { truncate: true });
      bind(controller, host);
      const other = createHost({ width: '150px' });
      const truncate = createTruncateTextController(LONG_TEXT);
      bind(truncate, other);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: truncate.getSnapshot().displayText,
        isTruncated: true,
        fontSize: null,
      });
    });

    it('何も指定しなければ、収まらなくても何もしない', () => {
      const host = createHost({ width: '50px' });
      const controller = createFitTextController(LONG_TEXT);
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: LONG_TEXT,
        isTruncated: false,
        isOverflowing: true,
      });
    });
  });

  describe('resizeFirst', () => {
    // 1,234,567 は 48px では幅に収まらず、1.2M は 48px で収まる枠
    const box = { width: '160px', height: '70px' };

    it('false（既定）: 候補を先に切り替え、上限の大きさを保つ', () => {
      const host = createHost(box);
      const controller = createFitTextController(NUMBERS, { maxFontSize: 48 });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: '1.2M',
        index: 1,
        fontSize: 48,
        isOverflowing: false,
      });
      expect(isOverflowing(host)).toBe(false);
    });

    it('true: 先に縮め、正確な表現を残す', () => {
      const host = createHost(box);
      const controller = createFitTextController(NUMBERS, {
        maxFontSize: 48,
        resizeFirst: true,
      });
      bind(controller, host);
      const { index, fontSize } = controller.getSnapshot();
      expect(index).toBe(0);
      expect(fontSize).toBeLessThan(48);
      expect(fontSize).toBeGreaterThan(BASE_FONT_SIZE);
      expect(isOverflowing(host)).toBe(false);
    });

    it('false でも、どの候補も上限で収まらなければ最後の候補を縮める', () => {
      const host = createHost({ width: '60px', height: '70px' });
      const controller = createFitTextController(NUMBERS, { maxFontSize: 48 });
      bind(controller, host);
      const { index, fontSize } = controller.getSnapshot();
      expect(index).toBe(1);
      expect(fontSize).toBeLessThan(48);
      expect(isOverflowing(host)).toBe(false);
    });

    it('maxFontSize が Infinity なら、true と同じ動作になる', () => {
      const host = createHost(box);
      const controller = createFitTextController(NUMBERS, {
        maxFontSize: Infinity,
      });
      bind(controller, host);
      expect(controller.getSnapshot().index).toBe(0);
      expect(isOverflowing(host)).toBe(false);
    });
  });

  describe('最後の手段', () => {
    it('truncate: どの候補も下限で収まらなければ、最後の候補を下限の大きさで省略する', () => {
      const host = createHost({ width: '30px' });
      const controller = createFitTextController(NUMBERS, {
        minFontSize: 14,
        truncate: true,
      });
      bind(controller, host);
      const { displayText, index, fontSize, isTruncated, isOverflowing } =
        controller.getSnapshot();
      expect(index).toBe(1);
      expect(fontSize).toBe(14);
      expect(isTruncated).toBe(true);
      expect(isOverflowing).toBe(false);
      expect(displayText.length).toBeLessThan('1.2M'.length + 3);
    });

    it('truncate が無ければ、最後の候補を下限の大きさで表示し、isOverflowing で知らせる', () => {
      const host = createHost({ width: '30px' });
      const controller = createFitTextController(NUMBERS, { minFontSize: 14 });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: '1.2M',
        index: 1,
        fontSize: 14,
        isTruncated: false,
        isOverflowing: true,
      });
    });

    it('truncate のとき、maxChars を超える候補は選ばない', () => {
      const host = createHost({ width: '500px' });
      const controller = createFitTextController(['abcdefgh', 'abc'], {
        truncate: true,
        maxChars: 5,
      });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: 'abc',
        index: 1,
        isTruncated: false,
      });
    });

    it('truncate のとき、最後の候補も maxChars に収まるように省略する', () => {
      const host = createHost({ width: '500px' });
      const controller = createFitTextController(['abcdefgh', 'abcdefg'], {
        truncate: true,
        maxChars: 5,
      });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: 'ab...',
        index: 1,
        isTruncated: true,
      });
    });
  });

  it('disabled の間は、最初の候補を表示する', () => {
    const host = createHost({ width: '30px' });
    const controller = createFitTextController(NUMBERS, {
      maxFontSize: 48,
      truncate: true,
      disabled: true,
    });
    bind(controller, host);
    expect(controller.getSnapshot()).toMatchObject({
      displayText: NUMBERS[0],
      index: 0,
      fontSize: null,
      isTruncated: null,
      isOverflowing: null,
    });
  });

  it('測り直しても結果は変わらない', () => {
    const host = createHost({ width: '160px', height: '70px' });
    const controller = createFitTextController(NUMBERS, {
      maxFontSize: 48,
      resizeFirst: true,
    });
    bind(controller, host);
    const before = controller.getSnapshot();
    controller.refresh();
    controller.update([...NUMBERS], { maxFontSize: 48, resizeFirst: true });
    expect(controller.getSnapshot()).toBe(before);
  });

  it('計測用の要素を残さない', () => {
    const host = createHost({ width: '30px' });
    const controller = createFitTextController(NUMBERS, {
      minFontSize: 14,
      truncate: true,
    });
    bind(controller, host);
    expect(document.body.children).toHaveLength(1);
  });
});
