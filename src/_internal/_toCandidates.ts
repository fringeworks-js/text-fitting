/**
 * 文字列か候補の配列を、候補の配列にする
 *
 * 空の配列は、空文字を1つ渡したものとして扱う
 *
 * @param text 文字列か、候補の配列
 * @returns 候補の配列（1つ以上）
 */
export default function _toCandidates(
  text: string | readonly string[],
): readonly string[] {
  if (typeof text === 'string') {
    return [text];
  }
  return text.length > 0 ? text : [''];
}
