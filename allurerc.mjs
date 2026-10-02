import { defineConfig } from 'allure';

/** Allure 3 report configuration; CI restores `allure-history` from the published report. */
export default defineConfig({
  name: 'bookwright-ts',
  output: './allure-report',
  historyPath: './allure-history/history.jsonl',
  historyLimit: 30,
  plugins: {
    awesome: {
      options: {
        reportName: 'bookwright-ts',
        reportLanguage: 'en',
        groupBy: ['epic', 'feature', 'story'],
      },
    },
  },
});
