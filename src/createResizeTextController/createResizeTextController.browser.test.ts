import createResizeTextController from './createResizeTextController';
import type { ResizeTextController } from './types';

const LONG_TEXT =
  'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';

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

/**
 * 表示する要素を作る
 */
const createHost = (
  css: Partial<CSSStyleDeclaration>,
  parent?: HTMLElement,
) => {
  const host = document.createElement('div');
  host.className = 'host';
  Object.assign(host.style, css);
  (parent ?? document.body).appendChild(host);
  return host;
};

/**
 * snapshot を要素に描画し、変わるたびに描画し直す
 */
const bind = (controller: ResizeTextController, host: HTMLElement) => {
  const render = () => {
    const { displayText, style } = controller.getSnapshot();
    host.style.whiteSpace = style.whiteSpace;
    host.style.overflowWrap = style.overflowWrap ?? '';
    host.style.fontSize = style.fontSize ?? '';
    host.textContent = displayText;
  };
  render();
  controller.subscribe(render);
  controller.attach(host);
};

/**
 * 要素の幅か高さに対して、中身がはみ出すか（小数の大きさで比べる）
 *
 * 高さは、同じ書式・幅で高さを決めない要素に描いたときの高さ（行の高さの合計）で比べる。
 * 文字の矩形の高さはフォントの字形の高さで、line-height より大きいことがあるため使わない
 */
const overflowsAt = (host: HTMLElement, fontSize: number) => {
  const saved = host.style.fontSize;
  host.style.fontSize = `${fontSize}px`;
  const computed = getComputedStyle(host);
  const box = {
    width: host.clientWidth,
    height:
      host.getBoundingClientRect().height -
      (host.offsetHeight - host.clientHeight),
  };
  const natural = document.createElement('div');
  Object.assign(natural.style, {
    position: 'absolute',
    visibility: 'hidden',
    width: `${box.width}px`,
    font: computed.font,
    lineHeight: computed.lineHeight,
    whiteSpace: computed.whiteSpace,
    overflowWrap: computed.overflowWrap,
  });
  natural.textContent = host.textContent;
  document.body.appendChild(natural);
  const range = document.createRange();
  range.selectNodeContents(natural);
  // 折り返すときは行末の空白が枠の外にぶら下がるため、矩形の幅は折り返さないときだけ比べる
  const checksWidth = computed.whiteSpace === 'pre';
  const result =
    (checksWidth &&
      range.getBoundingClientRect().right -
        natural.getBoundingClientRect().left >
        box.width + 0.5) ||
    natural.getBoundingClientRect().height > box.height + 0.5 ||
    host.scrollWidth > host.clientWidth;
  natural.remove();
  host.style.fontSize = saved;
  return result;
};

const nextFrames = async () => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};

describe('createResizeTextController', () => {
  afterEach(() => {
    for (const element of [...document.body.children]) {
      element.remove();
    }
  });

  describe('未計測', () => {
    it('接続する前は、font-size を指定しない', () => {
      const controller = createResizeTextController('Hello');
      expect(controller.getSnapshot()).toEqual({
        displayText: 'Hello',
        fontSize: null,
        isOverflowing: null,
        style: { whiteSpace: 'pre' },
      });
    });
  });

  describe('既定（収まるなら何もしない）', () => {
    it('収まる文字列は CSS の font-size のまま', () => {
      const host = createHost({ width: '300px' });
      const controller = createResizeTextController('Hello');
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        fontSize: BASE_FONT_SIZE,
        isOverflowing: false,
      });
    });

    it('はみ出す文字列は、収まる最大の大きさまで縮める', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(LONG_TEXT);
      bind(controller, host);
      const { fontSize, isOverflowing } = controller.getSnapshot();
      expect(isOverflowing).toBe(false);
      expect(fontSize).toBeLessThan(BASE_FONT_SIZE);
      expect(overflowsAt(host, fontSize!)).toBe(false);
      expect(overflowsAt(host, fontSize! + 0.3)).toBe(true);
    });

    it('高さが中身に合わせて伸びる要素では、縮めた後に幅が広がれば大きくする', async () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(LONG_TEXT);
      bind(controller, host);
      const narrow = controller.getSnapshot().fontSize!;
      host.style.width = '2000px';
      await nextFrames();
      expect(controller.getSnapshot().fontSize).toBe(BASE_FONT_SIZE);
      expect(controller.getSnapshot().fontSize).toBeGreaterThan(narrow);
    });

    it('line-height が px の場合も、縮めた後に幅が広がれば大きくする', async () => {
      const host = createHost({ width: '150px', lineHeight: '20px' });
      const controller = createResizeTextController(LONG_TEXT);
      bind(controller, host);
      expect(controller.getSnapshot().fontSize).toBeLessThan(BASE_FONT_SIZE);
      host.style.width = '2000px';
      await nextFrames();
      expect(controller.getSnapshot().fontSize).toBe(BASE_FONT_SIZE);
      expect(host.style.lineHeight).toBe('20px');
    });

    it('CSS の font-size を読むために変えた要素のスタイルを元に戻す', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(LONG_TEXT);
      bind(controller, host);
      expect(host.style.fontSize).toBe(controller.getSnapshot().style.fontSize);
      controller.refresh();
      expect(host.style.fontSize).toBe(controller.getSnapshot().style.fontSize);
    });

    it('測り直しても結果は変わらない（当てた font-size を CSS の font-size と取り違えない）', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(LONG_TEXT);
      bind(controller, host);
      const before = controller.getSnapshot();
      controller.refresh();
      controller.refresh();
      expect(controller.getSnapshot()).toBe(before);
    });
  });

  describe('maxFontSize（枠いっぱいに合わせる）', () => {
    it('収まる限り大きくする（高さが決まった枠）', () => {
      const host = createHost({ width: '400px', height: '60px' });
      const controller = createResizeTextController('1,234', {
        maxFontSize: 200,
      });
      bind(controller, host);
      const { fontSize } = controller.getSnapshot();
      expect(fontSize).toBeGreaterThan(BASE_FONT_SIZE);
      expect(fontSize).toBeLessThan(200);
      expect(overflowsAt(host, fontSize!)).toBe(false);
      expect(overflowsAt(host, fontSize! + 0.3)).toBe(true);
    });

    it('上限で収まれば上限の大きさにする', () => {
      const host = createHost({ width: '400px', height: '100px' });
      const controller = createResizeTextController('1', { maxFontSize: 24 });
      bind(controller, host);
      expect(controller.getSnapshot().fontSize).toBe(24);
    });

    it('Infinity なら、収まる限りどこまでも大きくする', () => {
      const host = createHost({ width: '400px', height: '300px' });
      const controller = createResizeTextController('12', {
        maxFontSize: Infinity,
      });
      bind(controller, host);
      const { fontSize } = controller.getSnapshot();
      expect(fontSize).toBeGreaterThan(100);
      expect(overflowsAt(host, fontSize!)).toBe(false);
      expect(overflowsAt(host, fontSize! + 0.3)).toBe(true);
    });

    it('grid で決まった高さに収める', () => {
      const grid = createHost({
        display: 'grid',
        gridTemplateRows: '50px',
        width: '400px',
      });
      const host = createHost({ minHeight: '0' }, grid);
      const controller = createResizeTextController('1,234', {
        maxFontSize: 200,
      });
      bind(controller, host);
      const { fontSize } = controller.getSnapshot();
      expect(overflowsAt(host, fontSize!)).toBe(false);
      expect(overflowsAt(host, fontSize! + 0.3)).toBe(true);
    });
  });

  describe('minFontSize', () => {
    it('下限でも収まらなければ、下限の大きさにして isOverflowing で知らせる', () => {
      const host = createHost({ width: '100px' });
      const controller = createResizeTextController(LONG_TEXT, {
        minFontSize: 10,
      });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        fontSize: 10,
        isOverflowing: true,
      });
    });

    it('下限が CSS の font-size より大きければ、下限に固定する', () => {
      const host = createHost({ width: '500px' });
      const controller = createResizeTextController('Hello', {
        minFontSize: 20,
      });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        fontSize: 20,
        isOverflowing: false,
      });
    });

    it('下限が上限より大きければ、下限に固定する', () => {
      const host = createHost({ width: '500px' });
      const controller = createResizeTextController('Hello', {
        minFontSize: 30,
        maxFontSize: 20,
      });
      bind(controller, host);
      expect(controller.getSnapshot().fontSize).toBe(30);
    });

    it('0 以下と NaN は指定しなかったものとして扱う', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(LONG_TEXT, {
        minFontSize: NaN,
        maxFontSize: -1,
      });
      bind(controller, host);
      const { fontSize } = controller.getSnapshot();
      expect(fontSize).toBeGreaterThan(1);
      expect(fontSize).toBeLessThan(BASE_FONT_SIZE);
    });
  });

  describe('複数行', () => {
    it('改行で区切った行は、どの行も幅に収める', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(`Hi\n${LONG_TEXT}`);
      bind(controller, host);
      expect(overflowsAt(host, controller.getSnapshot().fontSize!)).toBe(false);
    });

    it.each(['1.25', '20px', 'normal'])(
      '折り返して、高さが決まった枠に収める（line-height: %s）',
      (lineHeight) => {
        const host = createHost({
          width: '150px',
          height: '60px',
          lineHeight,
        });
        const controller = createResizeTextController(LONG_TEXT, {
          wrap: 'normal',
        });
        bind(controller, host);
        const { fontSize } = controller.getSnapshot();
        expect(fontSize).toBeLessThan(BASE_FONT_SIZE);
        expect(overflowsAt(host, fontSize!)).toBe(false);
        expect(overflowsAt(host, fontSize! + 0.3)).toBe(true);
      },
    );

    it('maxLines の行数に収める', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(LONG_TEXT, {
        wrap: 'normal',
        maxLines: 2,
      });
      bind(controller, host);
      const { fontSize } = controller.getSnapshot();
      expect(fontSize).toBeLessThan(BASE_FONT_SIZE);
      // 2行（line-height: 1.25）の高さに収まっている
      expect(host.getBoundingClientRect().height).toBeLessThanOrEqual(
        fontSize! * 1.25 * 2 + 0.5,
      );
    });

    it('折り返して高さの制約が無ければ、上限の大きさにする', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(LONG_TEXT, {
        wrap: 'normal',
      });
      bind(controller, host);
      expect(controller.getSnapshot().fontSize).toBe(BASE_FONT_SIZE);
    });
  });

  describe('disabled', () => {
    it('計測せず、font-size を指定しない', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(LONG_TEXT, {
        disabled: true,
      });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        fontSize: null,
        isOverflowing: null,
      });
      expect(host.style.fontSize).toBe('');
      controller.update(LONG_TEXT, { disabled: false });
      expect(controller.getSnapshot().fontSize).toBeLessThan(BASE_FONT_SIZE);
    });
  });

  describe('測り直し', () => {
    it('文字列を変えると、その場で測り直す', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController('Hi');
      bind(controller, host);
      expect(controller.getSnapshot().fontSize).toBe(BASE_FONT_SIZE);
      controller.update(LONG_TEXT);
      expect(controller.getSnapshot().fontSize).toBeLessThan(BASE_FONT_SIZE);
    });

    it('計測用の要素を残さない', () => {
      const host = createHost({ width: '150px' });
      const controller = createResizeTextController(LONG_TEXT);
      bind(controller, host);
      expect(document.body.children).toHaveLength(1);
    });
  });
});
