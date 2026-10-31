import type { SplitKeyRecord } from '@fringeworks/utils/object/createSplitByKeys';
import type { TextLayoutOptions, TruncateOptions } from '../types';

/**
 * 要素に収める機能で共通のオプションのキー
 */
export const _TEXT_LAYOUT_OPTION_KEYS: SplitKeyRecord<TextLayoutOptions> = {
  wrap: true,
  maxLines: true,
  disabled: true,
  frozen: true,
  detectionDelay: true,
  hideWhilePending: true,
};

/**
 * 省略の機能で共通のオプションのキー
 */
export const _TRUNCATE_OPTION_KEYS: SplitKeyRecord<TruncateOptions> = {
  ellipsis: true,
  truncatePosition: true,
  truncateBoundary: true,
  locale: true,
};
