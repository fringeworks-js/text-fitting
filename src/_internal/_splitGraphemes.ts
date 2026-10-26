import _getSegmenter from './_getSegmenter';

/**
 * 文字列を書記素（見た目の1文字）の単位に分割する
 *
 * `Intl.Segmenter` に対応していない環境（Firefox 125 未満）ではコードポイントの単位で分割する。
 * 対応ブラウザーが揃った時点で、この切り替えを削除できるようにしている
 *
 * @param text 文字列
 * @param locale ロケール
 * @returns 書記素の配列
 */
export default function _splitGraphemes(
  text: string,
  locale?: string,
): string[] {
  const segmenter = _getSegmenter('grapheme', locale);
  if (!segmenter) {
    return Array.from(text);
  }
  return Array.from(segmenter.segment(text), ({ segment }) => segment);
}
