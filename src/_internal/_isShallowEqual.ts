/**
 * 2つのオブジェクトが、プロパティの値の単位で等しいか
 *
 * 値が undefined のプロパティは、無いものとして比べる（`{ a: undefined }` と `{}` は等しい）。
 * 省略できるオプションの undefined は、指定しなかったものとして扱うため
 *
 * @param a オブジェクト
 * @param b オブジェクト
 * @returns 等しいか
 */
export default function _isShallowEqual(a: object, b: object): boolean {
  return _hasSameValues(a, b) && _hasSameValues(b, a);
}

/**
 * from のプロパティの値が、すべて to の同じキーの値と等しいか（to に無いキーは undefined と比べる）
 */
function _hasSameValues(from: object, to: object): boolean {
  const recordFrom = from as Record<string, unknown>;
  const recordTo = to as Record<string, unknown>;
  return Object.keys(recordFrom).every((key) =>
    Object.is(recordFrom[key], recordTo[key]),
  );
}
