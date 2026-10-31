import createSplitByKeys from '@fringeworks/utils/object/createSplitByKeys';
import {
  _TEXT_LAYOUT_OPTION_KEYS,
  _TRUNCATE_OPTION_KEYS,
} from '../_internal/_optionKeys';
import type { TruncateTextControllerOptions } from '../createTruncateTextController';

/**
 * コンポーネントのプロパティなどから、createTruncateTextController のオプションとそれ以外のプロパティを分ける
 *
 * - `[options, rest]` のタプルを返す
 * - 値が `undefined` のプロパティも、キーの種類で振り分ける（`undefined` のオプションは、指定しなかったものとして扱われる）
 *
 * @param data 分けるオブジェクト
 * @returns `[options, rest]` のタプル
 * @example
 * extractTruncateTextOptions({ maxLines: 2, id: 'title' }); // [{ maxLines: 2 }, { id: 'title' }]
 */
export default createSplitByKeys<TruncateTextControllerOptions>({
  ..._TEXT_LAYOUT_OPTION_KEYS,
  ..._TRUNCATE_OPTION_KEYS,
  maxChars: true,
});
