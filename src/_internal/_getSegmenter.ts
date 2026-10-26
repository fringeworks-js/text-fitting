/**
 * 作成済みの Intl.Segmenter（キーは分割の単位とロケール）
 */
const cache = new Map<string, Intl.Segmenter>();

/**
 * 分割の単位とロケールに合った Intl.Segmenter を返す
 *
 * `Intl.Segmenter` に対応していない環境（Firefox 125 未満）では undefined を返す。
 * 呼び出すたびに対応しているかを確かめるため、利用者が polyfill を後から読み込んでも使われる。
 * 不正なロケールの場合は、実行環境の既定のロケールで作る
 *
 * @param granularity 分割の単位
 * @param locale ロケール
 * @returns Intl.Segmenter。対応していない環境では undefined
 */
export default function _getSegmenter(
  granularity: 'grapheme' | 'word',
  locale: string | undefined,
): Intl.Segmenter | undefined {
  if (typeof Intl.Segmenter !== 'function') {
    return undefined;
  }
  const key = `${granularity}:${locale ?? ''}`;
  let segmenter = cache.get(key);
  if (!segmenter) {
    try {
      segmenter = new Intl.Segmenter(locale, { granularity });
    } catch {
      // 不正なロケールは例外にせず、既定のロケールで分割する
      segmenter = new Intl.Segmenter(undefined, { granularity });
    }
    cache.set(key, segmenter);
  }
  return segmenter;
}
