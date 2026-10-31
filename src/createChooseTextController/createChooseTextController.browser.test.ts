import createChooseTextController from './createChooseTextController';
import type { ChooseTextController } from './types';

const CANDIDATES = ['2026年10月26日（月）', '2026/10/26', '10/26'];

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

const bind = (controller: ChooseTextController, host: HTMLElement) => {
  const render = () => {
    const { displayText, style } = controller.getSnapshot();
    host.style.whiteSpace = style.whiteSpace;
    host.textContent = displayText;
  };
  render();
  controller.subscribe(render);
  controller.attach(host);
};

const isOverflowing = (host: HTMLElement) =>
  host.scrollWidth > host.clientWidth || host.scrollHeight > host.clientHeight;

/**
 * その文字列が、要素からはみ出すか
 */
const overflowsWith = (host: HTMLElement, value: string) => {
  const saved = host.textContent;
  host.textContent = value;
  const range = document.createRange();
  range.selectNodeContents(host);
  const result =
    range.getBoundingClientRect().width > host.clientWidth + 0.5 ||
    isOverflowing(host);
  host.textContent = saved;
  return result;
};

describe('createChooseTextController', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('接続する前は、最初の候補を表示する', () => {
    const controller = createChooseTextController(CANDIDATES);
    expect(controller.getSnapshot()).toEqual({
      displayText: CANDIDATES[0],
      index: 0,
      isOverflowing: null,
      style: { whiteSpace: 'pre' },
      isPending: false,
    });
  });

  it('最初の候補が収まれば、それを選ぶ', () => {
    const host = createHost({ width: '500px' });
    const controller = createChooseTextController(CANDIDATES);
    bind(controller, host);
    expect(controller.getSnapshot()).toMatchObject({
      index: 0,
      isOverflowing: false,
    });
  });

  it('収まる候補のうち、最初のものを選ぶ', () => {
    const host = createHost({ width: '100px' });
    const controller = createChooseTextController(CANDIDATES);
    bind(controller, host);
    const { index, isOverflowing } = controller.getSnapshot();
    expect(index).toBeGreaterThan(0);
    expect(isOverflowing).toBe(false);
    expect(isOverflowing).toBe(false);
    expect(overflowsWith(host, host.textContent!)).toBe(false);
    // 前の候補は収まらない
    expect(overflowsWith(host, CANDIDATES[index - 1]!)).toBe(true);
  });

  it('どの候補も収まらなければ、最後の候補を表示して isOverflowing で知らせる', () => {
    const host = createHost({ width: '10px' });
    const controller = createChooseTextController(CANDIDATES);
    bind(controller, host);
    expect(controller.getSnapshot()).toMatchObject({
      displayText: '10/26',
      index: 2,
      isOverflowing: true,
    });
  });

  it('高さが中身に合わせて伸びる要素でも、行の高さが違う候補に戻せる', async () => {
    // line-height: normal では、日本語の候補は代わりのフォントで行が高くなる
    const host = createHost({ width: '100px', lineHeight: 'normal' });
    const controller = createChooseTextController(CANDIDATES);
    bind(controller, host);
    expect(controller.getSnapshot().index).toBeGreaterThan(0);
    host.style.width = '500px';
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    expect(controller.getSnapshot().index).toBe(0);
  });

  it('空の配列は、空文字を1つ渡したものとして扱う', () => {
    const host = createHost({ width: '100px' });
    const controller = createChooseTextController([]);
    bind(controller, host);
    expect(controller.getSnapshot()).toMatchObject({
      displayText: '',
      index: 0,
      isOverflowing: false,
    });
  });

  it('折り返して maxLines の行数に収まる候補を選ぶ', () => {
    const host = createHost({ width: '120px' });
    const long = 'The quick brown fox jumps over the lazy dog.';
    const controller = createChooseTextController([long, 'Quick fox'], {
      wrap: 'normal',
      maxLines: 1,
    });
    bind(controller, host);
    expect(controller.getSnapshot().index).toBe(1);
  });

  it('同じ内容の配列で update しても、通知しない', () => {
    const host = createHost({ width: '100px' });
    const controller = createChooseTextController(CANDIDATES);
    bind(controller, host);
    const before = controller.getSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.update([...CANDIDATES]);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toBe(before);
  });

  it('frozen の間は、最後に選んだのと同じ位置の候補を表示する', () => {
    const host = createHost({ width: '100px' });
    const controller = createChooseTextController(CANDIDATES);
    bind(controller, host);
    const { index } = controller.getSnapshot();
    expect(index).toBeGreaterThan(0);

    const next = ['A long first candidate', 'B', 'C'];
    controller.update(next, { frozen: true });
    expect(controller.getSnapshot()).toMatchObject({
      displayText: next[index],
      index,
      isPending: false,
    });

    controller.update(['X'], { frozen: true });
    expect(controller.getSnapshot()).toMatchObject({
      displayText: 'X',
      index: 0,
    });
  });

  it('disabled の間は、最初の候補を表示する', () => {
    const host = createHost({ width: '10px' });
    const controller = createChooseTextController(CANDIDATES, {
      disabled: true,
    });
    bind(controller, host);
    expect(controller.getSnapshot()).toMatchObject({
      displayText: CANDIDATES[0],
      index: 0,
      isOverflowing: null,
    });
  });
});
