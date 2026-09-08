import globals from 'globals';
import standard from '@jobscale/eslint-plugin-standard';

export default [{
  ignores: ['**/coverage/**', '**/assets/**', '**/*.min.js'],
}, {
  ...standard.configs.standard,
  name: 'standard base rule',
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
      GM_setValue: 'readonly',
      GM_getValue: 'readonly',
      GM_deleteValue: 'readonly',
      GM_listValues: 'readonly',
      GM_addValueChangeListener: 'readonly',
      GM_xmlhttpRequest: 'readonly',
    },
  },
  rules: {
    ...standard.configs.standard.rules,
  },
}];
