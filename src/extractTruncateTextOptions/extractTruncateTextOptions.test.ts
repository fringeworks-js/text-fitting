import extractTruncateTextOptions from './extractTruncateTextOptions';

describe('extractTruncateTextOptions', () => {
  it('オプションと、それ以外のプロパティに分ける', () => {
    const [options, rest] = extractTruncateTextOptions({
      wrap: 'normal' as const,
      maxLines: 2,
      maxChars: 10,
      ellipsis: '…',
      id: 'title',
      className: 'x',
    });
    expect(options).toEqual({
      wrap: 'normal',
      maxLines: 2,
      maxChars: 10,
      ellipsis: '…',
    });
    expect(rest).toEqual({ id: 'title', className: 'x' });
  });

  it('値が undefined のプロパティも、キーの種類で振り分ける', () => {
    const [options, rest] = extractTruncateTextOptions({
      maxLines: undefined,
      title: undefined,
    });
    expect(options).toHaveProperty('maxLines', undefined);
    expect(rest).toHaveProperty('title', undefined);
    expect(rest).not.toHaveProperty('maxLines');
  });
});
