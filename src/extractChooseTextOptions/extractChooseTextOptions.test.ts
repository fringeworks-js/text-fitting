import extractChooseTextOptions from './extractChooseTextOptions';

describe('extractChooseTextOptions', () => {
  it('オプションと、それ以外のプロパティに分ける', () => {
    const [options, rest] = extractChooseTextOptions({
      maxLines: 1,
      detectionDelay: 100,
      hideWhilePending: true,
      id: 'date',
      className: 'x',
    });
    expect(options).toEqual({
      maxLines: 1,
      detectionDelay: 100,
      hideWhilePending: true,
    });
    expect(rest).toEqual({ id: 'date', className: 'x' });
  });

  it('値が undefined のプロパティも、キーの種類で振り分ける', () => {
    const [options, rest] = extractChooseTextOptions({
      maxLines: undefined,
      title: undefined,
    });
    expect(options).toHaveProperty('maxLines', undefined);
    expect(rest).toHaveProperty('title', undefined);
    expect(rest).not.toHaveProperty('maxLines');
  });
});
