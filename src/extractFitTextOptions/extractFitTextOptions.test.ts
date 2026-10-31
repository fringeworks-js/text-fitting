import extractFitTextOptions from './extractFitTextOptions';

describe('extractFitTextOptions', () => {
  it('オプションと、それ以外のプロパティに分ける', () => {
    const [options, rest] = extractFitTextOptions({
      minFontSize: 12,
      truncate: true,
      resizeFirst: true,
      locale: 'ja',
      id: 'name',
      className: 'x',
    });
    expect(options).toEqual({
      minFontSize: 12,
      truncate: true,
      resizeFirst: true,
      locale: 'ja',
    });
    expect(rest).toEqual({ id: 'name', className: 'x' });
  });

  it('値が undefined のプロパティも、キーの種類で振り分ける', () => {
    const [options, rest] = extractFitTextOptions({
      maxLines: undefined,
      title: undefined,
    });
    expect(options).toHaveProperty('maxLines', undefined);
    expect(rest).toHaveProperty('title', undefined);
    expect(rest).not.toHaveProperty('maxLines');
  });
});
