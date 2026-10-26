import _getSegmenter from './_getSegmenter';

/**
 * `Intl.Segmenter` が無い環境で、単語を区切る正規表現
 *
 * - 英字・数字などが続く部分は1つの単語にする
 * - 空白を使わずに書く文字（漢字・ひらがな・カタカナ）は1文字ずつ区切る
 * - 空白の並びは1つにまとめ、それ以外の記号などは1文字ずつ区切る
 */
const FALLBACK_WORD =
  /(?:(?![\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}])[\p{L}\p{M}\p{N}])+|\s+|[^]/gu;

/**
 * 単語の境界の位置（UTF-16 の位置）を返す
 *
 * `Intl.Segmenter` に対応していない環境（Firefox 125 未満）では、簡易な規則で区切る。
 * 日本語などは単語の途中で区切られることがある
 *
 * @param text 文字列
 * @param locale ロケール
 * @returns 単語の境界の位置。先頭（0）と末尾（文字列の長さ）を含む
 */
export default function _findWordBoundaries(
  text: string,
  locale?: string,
): Set<number> {
  const boundaries = new Set<number>([0, text.length]);
  const segmenter = _getSegmenter('word', locale);
  if (segmenter) {
    for (const { index, segment } of segmenter.segment(text)) {
      boundaries.add(index + segment.length);
    }
  } else {
    for (const match of text.matchAll(FALLBACK_WORD)) {
      boundaries.add((match.index ?? 0) + match[0].length);
    }
  }
  return boundaries;
}
