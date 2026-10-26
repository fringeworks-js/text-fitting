import _splitGraphemes from '../_internal/_splitGraphemes';
import { truncateText } from '../truncateText';
import createTruncateTextController from './createTruncateTextController';
import type {
  TruncateTextController,
  TruncateTextControllerOptions,
} from './types';

const LONG_TEXT =
  'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';

/**
 * 表示する要素を作る
 */
const createHost = (css: Partial<CSSStyleDeclaration>) => {
  const host = document.createElement('div');
  Object.assign(host.style, {
    fontSize: '16px',
    fontFamily: 'sans-serif',
    lineHeight: '20px',
    ...css,
  });
  document.body.appendChild(host);
  return host;
};

/**
 * snapshot を要素に描画し、変わるたびに描画し直す
 */
const bind = (controller: TruncateTextController, host: HTMLElement) => {
  const render = () => {
    const { displayText, style } = controller.getSnapshot();
    host.style.whiteSpace = style.whiteSpace;
    host.style.overflowWrap = style.overflowWrap ?? '';
    host.textContent = displayText;
  };
  render();
  controller.subscribe(render);
  controller.attach(host);
};

/**
 * 要素の中身がはみ出していないか
 */
const isOverflowing = (host: HTMLElement) =>
  host.scrollWidth > host.clientWidth || host.scrollHeight > host.clientHeight;

/**
 * 要素に文字列を入れたときに、はみ出すか（スタイルは今のまま）
 */
const overflowsWith = (host: HTMLElement, value: string) => {
  const saved = host.textContent;
  host.textContent = value;
  const result = isOverflowing(host);
  host.textContent = saved;
  return result;
};

const countGraphemes = (value: string) => _splitGraphemes(value).length;

/**
 * 次のフレームまで待つ（ResizeObserver の通知と、まとめた計測を待つ）
 */
const nextFrames = async () => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};

describe('createTruncateTextController', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('未計測', () => {
    it('接続する前は、元の文字列と null を返す', () => {
      const controller = createTruncateTextController(LONG_TEXT);
      expect(controller.getSnapshot()).toEqual({
        displayText: LONG_TEXT,
        isTruncated: null,
        style: { whiteSpace: 'pre' },
      });
    });

    it('display: none の要素では計測しない', () => {
      const host = createHost({ width: '100px', display: 'none' });
      const controller = createTruncateTextController(LONG_TEXT);
      controller.attach(host);
      expect(controller.getSnapshot().displayText).toBe(LONG_TEXT);
      expect(controller.getSnapshot().isTruncated).toBeNull();
    });

    it('DOM に無い要素では計測しない', () => {
      const host = document.createElement('div');
      const controller = createTruncateTextController(LONG_TEXT);
      controller.attach(host);
      expect(controller.getSnapshot().isTruncated).toBeNull();
    });
  });

  describe('1行（折り返さない）', () => {
    it('収まる文字列はそのまま', () => {
      const host = createHost({ width: '500px' });
      const controller = createTruncateTextController('Hello');
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: 'Hello',
        isTruncated: false,
      });
    });

    it('幅に収まる最も長い文字列にする', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(LONG_TEXT);
      bind(controller, host);
      const { displayText, isTruncated } = controller.getSnapshot();
      expect(isTruncated).toBe(true);
      expect(displayText.endsWith('...')).toBe(true);
      expect(isOverflowing(host)).toBe(false);
      // あと1文字増やすと収まらない
      const longer = truncateText(LONG_TEXT, {
        maxChars: countGraphemes(displayText) + 1,
      });
      expect(overflowsWith(host, longer)).toBe(true);
    });

    it('改行で区切った行は、どの行も幅に収める', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(`Hi\n${LONG_TEXT}`);
      bind(controller, host);
      const { displayText } = controller.getSnapshot();
      expect(displayText.startsWith('Hi\n')).toBe(true);
      expect(isOverflowing(host)).toBe(false);
    });

    it('記号が収まらない幅では、記号なしで切る', () => {
      const host = createHost({ width: '12px' });
      const controller = createTruncateTextController('abcdef', {
        ellipsis: '..........',
      });
      bind(controller, host);
      const { displayText } = controller.getSnapshot();
      expect(displayText).not.toContain('.');
      expect(isOverflowing(host)).toBe(false);
    });

    it('何も収まらない幅では空文字にする', () => {
      const host = createHost({ width: '1px' });
      const controller = createTruncateTextController('WWW');
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: '',
        isTruncated: true,
      });
    });
  });

  describe('省略の位置', () => {
    it.each<[TruncateTextControllerOptions, (value: string) => boolean]>([
      [{ truncatePosition: 'start' }, (value) => value.startsWith('...')],
      [
        { truncatePosition: 'middle' },
        (value) => value.includes('...') && !value.endsWith('...'),
      ],
    ])('%o', (options, check) => {
      const host = createHost({ width: '200px' });
      const controller = createTruncateTextController(LONG_TEXT, options);
      bind(controller, host);
      const { displayText } = controller.getSnapshot();
      expect(check(displayText)).toBe(true);
      expect(isOverflowing(host)).toBe(false);
      expect(LONG_TEXT.endsWith(displayText.split('...')[1]!)).toBe(true);
    });
  });

  describe('複数行（折り返す）', () => {
    it('maxLines の行数に収める（高さは中身に合わせて伸びる）', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(LONG_TEXT, {
        wrap: 'normal',
        maxLines: 2,
      });
      bind(controller, host);
      const { displayText, isTruncated } = controller.getSnapshot();
      expect(isTruncated).toBe(true);
      expect(displayText.endsWith('...')).toBe(true);
      expect(host.getBoundingClientRect().height).toBeLessThanOrEqual(40.5);
    });

    it('line-height: normal の日本語でも maxLines の行数まで使う', () => {
      const text =
        '吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。';
      const host = createHost({ width: '240px', lineHeight: 'normal' });
      const controller = createTruncateTextController(text, {
        wrap: 'normal',
        maxLines: 2,
        ellipsis: '…',
      });
      bind(controller, host);
      const { displayText } = controller.getSnapshot();
      const twoLines = host.getBoundingClientRect().height;
      host.textContent = '吾';
      const oneLine = host.getBoundingClientRect().height;
      // 2行目まで使っている
      expect(twoLines).toBeGreaterThan(oneLine * 1.5);
      // あと1文字増やすと3行になる
      host.textContent = truncateText(text, {
        maxChars: countGraphemes(displayText) + 1,
        ellipsis: '…',
      });
      expect(host.getBoundingClientRect().height).toBeGreaterThan(twoLines + 1);
    });

    it('空の行も1行に数える', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController('a\n\n\nb', {
        maxLines: 2,
      });
      bind(controller, host);
      expect(controller.getSnapshot().displayText).toBe('a\n...');
    });

    it('CSS で決めた高さに収める', () => {
      const host = createHost({ width: '150px', height: '60px' });
      const controller = createTruncateTextController(LONG_TEXT, {
        wrap: 'normal',
      });
      bind(controller, host);
      expect(controller.getSnapshot().isTruncated).toBe(true);
      expect(isOverflowing(host)).toBe(false);
      const longer = truncateText(LONG_TEXT, {
        maxChars: countGraphemes(controller.getSnapshot().displayText) + 1,
      });
      expect(overflowsWith(host, longer)).toBe(true);
    });

    it('flex で決まった高さに収める', () => {
      const container = createHost({
        width: '150px',
        height: '40px',
        display: 'flex',
        flexDirection: 'column',
      });
      const host = document.createElement('div');
      host.style.flex = '1';
      host.style.minHeight = '0';
      container.appendChild(host);
      const controller = createTruncateTextController(LONG_TEXT, {
        wrap: 'normal',
      });
      bind(controller, host);
      expect(controller.getSnapshot().isTruncated).toBe(true);
      expect(isOverflowing(host)).toBe(false);
    });

    it('行末の空白がぶら下がっても、はみ出しとみなさない', () => {
      // 1行の幅に収まらない位置に空白が来るように、短い単語を並べる
      const text = 'ab cd ef gh ij kl mn op qr st uv wx yz';
      const host = createHost({ width: '60px', height: '200px' });
      const controller = createTruncateTextController(text, { wrap: 'normal' });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: text,
        isTruncated: false,
      });
    });

    it('wrap: normal では、区切りの無い長い単語の横のはみ出しを省略する', () => {
      const host = createHost({ width: '100px', height: '60px' });
      const controller = createTruncateTextController('a'.repeat(40), {
        wrap: 'normal',
      });
      bind(controller, host);
      expect(controller.getSnapshot().isTruncated).toBe(true);
      expect(isOverflowing(host)).toBe(false);
    });

    it('wrap: anywhere では区切りの無い長い単語も折り返す', () => {
      const host = createHost({ width: '100px', height: '40px' });
      const text = 'a'.repeat(40);
      const controller = createTruncateTextController(text, {
        wrap: 'anywhere',
      });
      bind(controller, host);
      expect(controller.getSnapshot().style.overflowWrap).toBe('anywhere');
      // 1行に収まる数より多く表示できている（2行目まで使えている）
      const oneLine = createTruncateTextController(text);
      const other = createHost({ width: '100px' });
      bind(oneLine, other);
      expect(controller.getSnapshot().displayText.length).toBeGreaterThan(
        oneLine.getSnapshot().displayText.length,
      );
      expect(isOverflowing(host)).toBe(false);
    });
  });

  describe('長い文字列（二分探索で範囲を絞る）', () => {
    it.each<TruncateTextControllerOptions>([
      { wrap: 'normal' },
      { wrap: 'normal', truncatePosition: 'middle' },
      { wrap: 'normal', truncateBoundary: 'word' },
    ])('%o', (options) => {
      const text = LONG_TEXT.repeat(20);
      const host = createHost({ width: '200px', height: '100px' });
      const controller = createTruncateTextController(text, options);
      bind(controller, host);
      const { displayText, isTruncated } = controller.getSnapshot();
      expect(isTruncated).toBe(true);
      expect(displayText).toContain('...');
      expect(isOverflowing(host)).toBe(false);
      if (!options.truncateBoundary && !options.truncatePosition) {
        const longer = truncateText(text, {
          maxChars: countGraphemes(displayText) + 1,
        });
        expect(overflowsWith(host, longer)).toBe(true);
      }
    });
  });

  describe('単語の境界', () => {
    it('単語の途中では切らない', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(LONG_TEXT, {
        truncateBoundary: 'word',
      });
      bind(controller, host);
      const { displayText } = controller.getSnapshot();
      const kept = displayText.slice(0, -'...'.length);
      expect(LONG_TEXT.startsWith(kept)).toBe(true);
      expect(LONG_TEXT[kept.length]).toMatch(/[\s.,]/);
      expect(kept).not.toMatch(/\s$/);
      expect(isOverflowing(host)).toBe(false);
    });
  });

  describe('高さが中身に合わせて伸びる要素', () => {
    it('折り返して maxLines も無い場合は、全文を表示する', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(LONG_TEXT, {
        wrap: 'normal',
      });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: LONG_TEXT,
        isTruncated: false,
      });
    });
  });

  describe('maxChars', () => {
    it('要素に収まっても、書記素の数の上限を守る', () => {
      const host = createHost({ width: '500px' });
      const controller = createTruncateTextController(LONG_TEXT, {
        maxChars: 10,
      });
      bind(controller, host);
      expect(controller.getSnapshot().displayText).toBe(
        truncateText(LONG_TEXT, { maxChars: 10 }),
      );
    });
  });

  describe('disabled', () => {
    it('計測せず、元の文字列と false を返す', () => {
      const host = createHost({ width: '100px' });
      const controller = createTruncateTextController(LONG_TEXT, {
        disabled: true,
      });
      bind(controller, host);
      expect(controller.getSnapshot()).toMatchObject({
        displayText: LONG_TEXT,
        isTruncated: false,
      });
    });

    it('update で切り替えられる', () => {
      const host = createHost({ width: '100px' });
      const controller = createTruncateTextController(LONG_TEXT);
      bind(controller, host);
      expect(controller.getSnapshot().isTruncated).toBe(true);
      controller.update(LONG_TEXT, { disabled: true });
      expect(controller.getSnapshot().displayText).toBe(LONG_TEXT);
      controller.update(LONG_TEXT, { disabled: false });
      expect(controller.getSnapshot().isTruncated).toBe(true);
    });
  });

  describe('更新と通知', () => {
    it('update はその場で計測する', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController('Hello');
      bind(controller, host);
      controller.update(LONG_TEXT);
      expect(controller.getSnapshot().isTruncated).toBe(true);
    });

    it('結果が変わらなければ通知せず、同じ snapshot を返す', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(LONG_TEXT);
      bind(controller, host);
      const listener = vi.fn();
      controller.subscribe(listener);
      const before = controller.getSnapshot();
      controller.update(LONG_TEXT, {});
      controller.refresh();
      expect(listener).not.toHaveBeenCalled();
      expect(controller.getSnapshot()).toBe(before);
    });

    it('要素の幅が変わると測り直す', async () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(LONG_TEXT);
      bind(controller, host);
      const narrow = controller.getSnapshot().displayText;
      host.style.width = '300px';
      await nextFrames();
      const wide = controller.getSnapshot().displayText;
      expect(wide.length).toBeGreaterThan(narrow.length);
      expect(isOverflowing(host)).toBe(false);
    });

    it('計測用の要素を残さない', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(LONG_TEXT);
      bind(controller, host);
      expect(document.body.children).toHaveLength(1);
    });
  });

  describe('destroy', () => {
    it('破棄した後の操作は何もしない', () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(LONG_TEXT);
      bind(controller, host);
      const before = controller.getSnapshot();
      controller.destroy();
      controller.update('Hello');
      controller.refresh();
      controller.attach(host);
      expect(controller.getSnapshot()).toBe(before);
      expect(typeof controller.subscribe(() => {})).toBe('function');
      controller.destroy();
    });

    it('破棄した後は、大きさが変わっても測り直さない', async () => {
      const host = createHost({ width: '150px' });
      const controller = createTruncateTextController(LONG_TEXT);
      bind(controller, host);
      const before = controller.getSnapshot();
      controller.destroy();
      host.style.width = '300px';
      await nextFrames();
      expect(controller.getSnapshot()).toBe(before);
    });
  });
});
