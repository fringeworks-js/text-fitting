import createSplitByKeys from '@fringeworks/utils/object/createSplitByKeys';
import { _TEXT_LAYOUT_OPTION_KEYS } from '../_internal/_optionKeys';
import type { ChooseTextControllerOptions } from '../createChooseTextController';

/**
 * コンポーネントのプロパティなどから、createChooseTextController のオプションとそれ以外のプロパティを分ける
 *
 * - `[options, rest]` のタプルを返す
 * - 値が `undefined` のプロパティも、キーの種類で振り分ける（`undefined` のオプションは、指定しなかったものとして扱われる）
 *
 * @param data 分けるオブジェクト
 * @returns `[options, rest]` のタプル
 * @example
 * extractChooseTextOptions({ maxLines: 1, id: 'date' }); // [{ maxLines: 1 }, { id: 'date' }]
 */
export default createSplitByKeys<ChooseTextControllerOptions>(
  _TEXT_LAYOUT_OPTION_KEYS,
);
