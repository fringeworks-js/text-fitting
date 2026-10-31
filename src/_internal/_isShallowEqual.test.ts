import _isShallowEqual from './_isShallowEqual';

describe('_isShallowEqual', () => {
  it('プロパティの値がすべて等しければ true', () => {
    expect(_isShallowEqual({ a: 1, b: 'x' }, { b: 'x', a: 1 })).toBe(true);
  });

  it('値が違うプロパティがあれば false', () => {
    expect(_isShallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('片方にしか無いプロパティがあれば false', () => {
    expect(_isShallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(_isShallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('値が undefined のプロパティは、無いものとして比べる', () => {
    expect(_isShallowEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(_isShallowEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
  });

  it('値は Object.is で比べる', () => {
    expect(_isShallowEqual({ a: NaN }, { a: NaN })).toBe(true);
    expect(_isShallowEqual({ a: {} }, { a: {} })).toBe(false);
  });

  it('配列は、要素の数と各要素で比べる', () => {
    expect(_isShallowEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(_isShallowEqual(['a'], ['a', 'b'])).toBe(false);
  });
});
