import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'allure-results',
      'allure-report',
      'test-results',
      'playwright-report',
      'coverage',
      'allure-history',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message:
            'Arbitrary sleeps are forbidden. Use web-first assertions or a named polling boundary.',
        },
      ],
    },
  },
  { files: ['eslint.config.js', 'allurerc.mjs'], ...tseslint.configs.disableTypeChecked },
  prettier,
);
