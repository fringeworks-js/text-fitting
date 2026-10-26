import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';

/**
 * ブラウザーで実行するテスト（実際のレイアウトで文字列を測る）
 */
const BROWSER_TEST = 'src/**/*.browser.test.ts';

/**
 * ブラウザーのテストの設定
 */
const browserProject = (
  name: string,
  browsers: ('chromium' | 'firefox' | 'webkit')[],
) => ({
  extends: true as const,
  test: {
    name,
    include: [BROWSER_TEST],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: browsers.map((browser) => ({ browser })),
    },
  },
});

export default defineConfig({
  test: {
    globals: true,
    coverage: { enabled: true },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: [...configDefaults.exclude, BROWSER_TEST],
        },
      },
      // 普段は Chromium だけで実行する
      browserProject('browser', ['chromium']),
      // 文字の描画や改行の位置はエンジンごとに違うため、公開の前などに3つのエンジンで確かめる（pnpm test:browsers）
      browserProject('all-browsers', ['chromium', 'firefox', 'webkit']),
    ],
  },
});
