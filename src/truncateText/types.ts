import type { TruncateOptions } from '../types';

/**
 * truncateText関数のオプション
 */
export type TruncateTextOptions = TruncateOptions & {
  /**
   * 省略記号を含めた書記素（見た目の1文字）の数の上限\
   * NaN は上限なし、負の値は 0、小数は切り捨てて扱う
   */
  maxChars: number;
};
