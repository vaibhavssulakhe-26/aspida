// Interface strings: t(key, vars) in the current interface language, with
// English as the fallback for any missing key. Pure (no chrome.*): content
// scripts and extension pages call setLanguage() from the uiLanguage
// setting; the service worker uses translate(lang, key) directly.

import en from './en.js';
import kn from './kn.js';

export const TABLES = { en, kn };
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
];

let current = 'en';

export function normalizeLanguage(lang) {
  return typeof lang === 'string' && Object.hasOwn(TABLES, lang) ? lang : 'en';
}

export function setLanguage(lang) {
  current = normalizeLanguage(lang);
  return current;
}

export function getLanguage() {
  return current;
}

export function translate(lang, key, vars) {
  const table = TABLES[normalizeLanguage(lang)];
  let s = Object.hasOwn(table, key) ? table[key] : Object.hasOwn(en, key) ? en[key] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : m));
  return s;
}

export function t(key, vars) {
  return translate(current, key, vars);
}
