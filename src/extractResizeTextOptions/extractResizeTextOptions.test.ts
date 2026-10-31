import extractResizeTextOptions from './extractResizeTextOptions';

describe('extractResizeTextOptions', () => {
  it('オプションと、それ以外のプロパティに分ける', () => {
    const [options, rest] = extractResizeTextOptions({
      minFontSize: 10,
      maxFontSize: 48,
      frozen: true,
      id: 'price',
      className: 'x',
    });
    expect(options).toEqual({ minFontSize: 10, maxFontSize: 48, frozen: true });
    expect(rest).toEqual({ id: 'price', className: 'x' });
  });

  it('値が undefined のプロパティも、キーの種類で振り分ける', () => {
    const [options, rest] = extractResizeTextOptions({
      maxLines: undefined,
      title: undefined,
    });
    expect(options).toHaveProperty('maxLines', undefined);
    expect(rest).toHaveProperty('title', undefined);
    expect(rest).not.toHaveProperty('maxLines');
  });
});
