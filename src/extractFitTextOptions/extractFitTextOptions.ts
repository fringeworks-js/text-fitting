import createSplitByKeys from '@fringeworks/utils/object/createSplitByKeys';
import {
  _TEXT_LAYOUT_OPTION_KEYS,
  _TRUNCATE_OPTION_KEYS,
} from '../_internal/_optionKeys';
import type { FitTextControllerOptions } from '../createFitTextController';

/**
 * コンポーネントのプロパティなどから、createFitTextController のオプションとそれ以外のプロパティを分ける
 *
 * - `[options, rest]` のタプルを返す
 * - 値が `undefined` のプロパティも、キーの種類で振り分ける（`undefined` のオプションは、指定しなかったものとして扱われる）
 *
 * @param data 分けるオブジェクト
 * @returns `[options, rest]` のタプル
 * @example
 * extractFitTextOptions({ minFontSize: 12, truncate: true, id: 'name' }); // [{ minFontSize: 12, truncate: true }, { id: 'name' }]
 */
export default createSplitByKeys<FitTextControllerOptions>({
  ..._TEXT_LAYOUT_OPTION_KEYS,
  ..._TRUNCATE_OPTION_KEYS,
  minFontSize: true,
  maxFontSize: true,
  truncate: true,
  maxChars: true,
  resizeFirst: true,
});
