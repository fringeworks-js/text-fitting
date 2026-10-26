import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';

/**
 * ブラウザーで実行するテスト（実際のレイアウトで文字列を測る）
 */
const BROWSER_TEST = 'src/**/*.browser.test.ts';

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
      {
        extends: true,
        test: {
          name: 'browser',
          include: [BROWSER_TEST],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
