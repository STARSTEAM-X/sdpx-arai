import babelParser from '@babel/eslint-parser'
export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          parserOpts: { plugins: ['typescript', 'jsx'] },
        },
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-constant-condition': 'error',
      'no-debugger': 'error',
      'no-unreachable': 'error',
    },
  },
]