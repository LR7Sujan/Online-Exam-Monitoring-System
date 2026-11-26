import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="className"] > Literal[value=/\\b(border-white|ring-white|border-foreground|outline-white|border-\\[#fff|border-\\[white)\\b/]',
          message: 'Hardcoded white borders/rings are forbidden. Use standard tokens like border-border, border-border-strong, or ring-brand.',
        },
        {
          selector: 'JSXAttribute[name.name="className"] > JSXExpressionContainer TemplateLiteral > TemplateElement[value.raw=/\\b(border-white|ring-white|border-foreground|outline-white|border-\\[#fff|border-\\[white)\\b/]',
          message: 'Hardcoded white borders/rings are forbidden. Use standard tokens like border-border, border-border-strong, or ring-brand.',
        },
      ],
    },
  }
);

