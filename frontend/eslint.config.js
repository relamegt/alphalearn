import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    // We can't use 'extends' in flat config directly like this usually in 8.57 without compat util?
    // Wait, js.configs.recommended is an object.
    // reactHooks.configs.recommended is legacy format? 
    // reactRefresh.configs.vite is legacy/flat?
    // If they are legacy configs, we need @eslint/eslintrc FlatCompat.
    // However, js.configs.recommended IS flat config compatible object in 8.57.
    // reactHooks DOES NOT export flat config in 4.6.0 (which is likely installed).
    // So we might need to manually configure plugins.

    // Let's try to mimic array structure properly.
    // Instead of nested 'extends', we flatten the array.
    ...[js.configs.recommended],
    // reactHooks might need plugins: { 'react-hooks': reactHooks } and rules.
    // But let's assume the user provided config was somewhat correct in intent.
    // The original code passed `js.configs.recommended` etc inside `extends` array which is NOT standard flat config (it's confusing with legacy).
    // In flat config, you spread configs in the main array.

    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
]
