import createSplitByKeys from '@fringeworks/utils/object/createSplitByKeys';
import { _TEXT_LAYOUT_OPTION_KEYS } from '../_internal/_optionKeys';
import type { ResizeTextControllerOptions } from '../createResizeTextController';

/**
 * コンポーネントのプロパティなどから、createResizeTextController のオプションとそれ以外のプロパティを分ける
 *
 * - `[options, rest]` のタプルを返す
 * - 値が `undefined` のプロパティも、キーの種類で振り分ける（`undefined` のオプションは、指定しなかったものとして扱われる）
 *
 * @param data 分けるオブジェクト
 * @returns `[options, rest]` のタプル
 * @example
 * extractResizeTextOptions({ maxFontSize: 48, id: 'price' }); // [{ maxFontSize: 48 }, { id: 'price' }]
 */
export default createSplitByKeys<ResizeTextControllerOptions>({
  ..._TEXT_LAYOUT_OPTION_KEYS,
  minFontSize: true,
  maxFontSize: true,
});
