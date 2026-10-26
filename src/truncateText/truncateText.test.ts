import _splitGraphemes from '../_internal/_splitGraphemes';
import truncateText from './truncateText';
import type { TruncateTextOptions } from './types';

type Case = [
  title: string,
  text: string,
  options: TruncateTextOptions,
  expected: string,
];

/**
 * 分割の方法（Intl.Segmenter・簡易な分割）に関わらず同じ結果になるケース
 */
const COMMON_CASES: Case[] = [
  // 上限と省略記号
  ['空文字', '', { maxChars: 3 }, ''],
  [
    '空白を整えない',
    '  Hello   world  ',
    { maxChars: 20 },
    '  Hello   world  ',
  ],
  ['記号なしで切る', 'abcdefghijk', { maxChars: 8, ellipsis: '' }, 'abcdefgh'],
  ['記号も上限に含める', 'abcdefghijk', { maxChars: 8 }, 'abcde...'],
  ['上限ちょうどなら記号を付けない', 'abcdefgh', { maxChars: 8 }, 'abcdefgh'],
  ['全文が収まれば記号の分を空けない', 'ab', { maxChars: 2 }, 'ab'],
  ['上限が 0', 'abc', { maxChars: 0 }, ''],
  ['空文字で上限が 0', '', { maxChars: 0 }, ''],
  ['記号だけが収まる', 'abcdef', { maxChars: 3 }, '...'],
  ['記号すら収まらなければ記号なしで切る', 'abcdef', { maxChars: 2 }, 'ab'],
  ['記号を変える', 'abcdef', { maxChars: 4, ellipsis: '…' }, 'abc…'],
  ['改行も1文字に数える', 'A\nBC', { maxChars: 2, ellipsis: '' }, 'A\n'],
  [
    '書記素の境界では空白を取り除かない',
    'A BCD',
    { maxChars: 3, ellipsis: '…' },
    'A …',
  ],
  [
    '日本語を文字の単位で切る',
    'あいうえお',
    { maxChars: 4, ellipsis: '…' },
    'あいう…',
  ],
  ['元の記号を特別扱いしない', '....', { maxChars: 3 }, '...'],
  ['元の記号と重ねる', 'abc...WXYZ', { maxChars: 9 }, 'abc......'],
  ['大文字・小文字や全角・半角を変えない', 'ＡBｶﾞ', { maxChars: 10 }, 'ＡBｶﾞ'],
  ['書記素の境界', 'Hello wonderful world', { maxChars: 12 }, 'Hello won...'],

  // 単語の境界
  [
    '単語の末尾まで戻る',
    'Hello wonderful world',
    { maxChars: 12, truncateBoundary: 'word' },
    'Hello...',
  ],
  [
    '単語の境界で記号なし',
    'Hello wonderful world',
    { maxChars: 12, truncateBoundary: 'word', ellipsis: '' },
    'Hello',
  ],
  [
    '最初の単語が収まらなければ記号だけ',
    'Supercalifragilistic',
    { maxChars: 6, truncateBoundary: 'word' },
    '...',
  ],
  [
    '最初の単語が収まらず記号なしなら空文字',
    'Supercalifragilistic',
    { maxChars: 6, truncateBoundary: 'word', ellipsis: '' },
    '',
  ],
  [
    '記号なしに切り替えても単語の境界を守る',
    'Hello world',
    { maxChars: 2, truncateBoundary: 'word' },
    '',
  ],
  [
    '全文が収まれば末尾の空白を残す',
    'Hello ',
    { maxChars: 6, truncateBoundary: 'word' },
    'Hello ',
  ],
  [
    '区切りの空白は省略する側に入れる',
    'Hello   wonderful',
    { maxChars: 11, truncateBoundary: 'word' },
    'Hello...',
  ],
  [
    '句読点の後でも切れる',
    'Hello, wonderful world',
    { maxChars: 12, truncateBoundary: 'word' },
    'Hello,...',
  ],
  [
    '改行の直後では切らない',
    'Hello\nwonderful',
    { maxChars: 9, truncateBoundary: 'word' },
    'Hello...',
  ],
  [
    '句読点だけの文字列',
    '!!!',
    { maxChars: 2, truncateBoundary: 'word', ellipsis: '' },
    '!!',
  ],
  [
    '空白だけの文字列は単語の途中で切らない',
    '     ',
    { maxChars: 3, truncateBoundary: 'word' },
    '...',
  ],

  // 先頭の省略
  [
    '先頭を省略する',
    'abcdefghij',
    { maxChars: 6, truncatePosition: 'start' },
    '...hij',
  ],
  [
    '先頭を記号なしで切る',
    'abcdefghij',
    { maxChars: 4, truncatePosition: 'start', ellipsis: '' },
    'ghij',
  ],
  [
    '先頭の省略で記号だけが収まる',
    'abcdef',
    { maxChars: 3, truncatePosition: 'start' },
    '...',
  ],
  [
    '先頭を単語の境界で省略する',
    'src/components/Button',
    { maxChars: 12, truncatePosition: 'start', truncateBoundary: 'word' },
    '.../Button',
  ],
  [
    '先頭の省略で後ろの端に空白を残さない',
    'Hello wonderful world',
    { maxChars: 9, truncatePosition: 'start', truncateBoundary: 'word' },
    '...world',
  ],

  // 中央の省略
  [
    '中央を省略する',
    'abcdefghij',
    { maxChars: 7, truncatePosition: 'middle' },
    'ab...ij',
  ],
  [
    '中央の省略で奇数のときは前を1つ多くする',
    'abcdefghij',
    { maxChars: 8, truncatePosition: 'middle' },
    'abc...ij',
  ],
  [
    '中央を記号なしで切る',
    'abcdefghij',
    { maxChars: 5, truncatePosition: 'middle', ellipsis: '' },
    'abcij',
  ],
  [
    '拡張子を残す',
    'very-long-file-name.pdf',
    { maxChars: 13, truncatePosition: 'middle', ellipsis: '…' },
    'very-l…me.pdf',
  ],
  [
    '中央を単語の境界で省略する',
    'Hello wonderful world',
    { maxChars: 13, truncatePosition: 'middle', truncateBoundary: 'word' },
    'Hello...world',
  ],
  [
    '前で使い切れなかった分を後ろに回す',
    'Supercalifragilistic is long',
    { maxChars: 10, truncatePosition: 'middle', truncateBoundary: 'word' },
    '...is long',
  ],

  // 上限の補正
  ['上限が NaN なら省略しない', 'abcdef', { maxChars: NaN }, 'abcdef'],
  [
    '上限が Infinity なら省略しない',
    'abcdef',
    { maxChars: Infinity },
    'abcdef',
  ],
  ['上限が負なら 0 として扱う', 'abcdef', { maxChars: -1 }, ''],
  ['上限の小数は切り捨てる', 'abcdefgh', { maxChars: 6.9 }, 'abc...'],
];

describe('truncateText', () => {
  describe('Intl.Segmenter で分割する', () => {
    it.each(COMMON_CASES)('%s', (_title, text, options, expected) => {
      expect(truncateText(text, options)).toBe(expected);
    });

    it.each<Case>([
      [
        '家族の絵文字を分割しない',
        'A👨‍👩‍👧‍👦B',
        { maxChars: 2, ellipsis: '' },
        'A👨‍👩‍👧‍👦',
      ],
      [
        '結合文字を分割せず、NFC にも変えない',
        'éx',
        { maxChars: 1, ellipsis: '' },
        'é',
      ],
      ['国旗の絵文字を分割しない', '🇯🇵A', { maxChars: 1, ellipsis: '' }, '🇯🇵'],
      [
        '肌の色の絵文字を分割しない',
        '👍🏽A',
        { maxChars: 1, ellipsis: '' },
        '👍🏽',
      ],
      [
        '記号も書記素で数える',
        'abcdef',
        { maxChars: 3, ellipsis: '👨‍👩‍👧‍👦' },
        'ab👨‍👩‍👧‍👦',
      ],
      [
        '中央の省略でも絵文字を分割しない',
        '👨‍👩‍👧‍👦abcdef🇯🇵',
        { maxChars: 5, truncatePosition: 'middle' },
        '👨‍👩‍👧‍👦...🇯🇵',
      ],
    ])('%s', (_title, text, options, expected) => {
      expect(truncateText(text, options)).toBe(expected);
    });

    it('不正なロケールは既定のロケールで分割する', () => {
      expect(
        truncateText('Hello wonderful world', {
          maxChars: 12,
          truncateBoundary: 'word',
          locale: 'invalid_locale!',
        }),
      ).toBe('Hello...');
    });
  });

  describe('Intl.Segmenter が無い環境では簡易な分割を使う', () => {
    const original = Intl.Segmenter;

    beforeAll(() => {
      // Firefox 125 未満を再現する
      (Intl as { Segmenter?: unknown }).Segmenter = undefined;
    });

    afterAll(() => {
      (Intl as { Segmenter?: unknown }).Segmenter = original;
    });

    it('Intl.Segmenter が無い状態になっている', () => {
      expect(Intl.Segmenter).toBeUndefined();
      expect(_splitGraphemes('🇯🇵')).toHaveLength(2);
    });

    it.each(COMMON_CASES)('%s', (_title, text, options, expected) => {
      expect(truncateText(text, options)).toBe(expected);
    });

    it.each<Case>([
      [
        '日本語は1文字ずつ区切る',
        '今日は晴れです',
        { maxChars: 6, truncateBoundary: 'word' },
        '今日は...',
      ],
      [
        '英字の並びは途中で区切らない',
        'Hello世界ですね',
        { maxChars: 7, truncateBoundary: 'word' },
        '...',
      ],
      [
        '英字の並びと漢字の間では区切る',
        'Hello世界ですね',
        { maxChars: 9, truncateBoundary: 'word' },
        'Hello世...',
      ],
      [
        '数字の並びは途中で区切らない',
        '12345 678',
        { maxChars: 8, truncateBoundary: 'word' },
        '12345...',
      ],
      [
        '全角空白も空白として扱う',
        'こんにちは　世界',
        { maxChars: 7, truncateBoundary: 'word', ellipsis: '…' },
        'こんにちは…',
      ],
      [
        '合成した絵文字はコードポイントで分割する',
        '🇯🇵A',
        { maxChars: 1, ellipsis: '' },
        '\u{1F1EF}',
      ],
    ])('%s', (_title, text, options, expected) => {
      expect(truncateText(text, options)).toBe(expected);
    });
  });
});
