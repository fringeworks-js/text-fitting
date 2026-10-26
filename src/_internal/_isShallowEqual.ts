/**
 * 2つのオブジェクトが、プロパティの値の単位で等しいか
 *
 * @param a オブジェクト
 * @param b オブジェクト
 * @returns 等しいか
 */
export default function _isShallowEqual(a: object, b: object): boolean {
  const keysA = Object.keys(a);
  return (
    keysA.length === Object.keys(b).length &&
    keysA.every((key) =>
      Object.is(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    )
  );
}
