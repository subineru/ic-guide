/* Terms.  `chapter` = where the term is defined (first used as a new word); `level` = whether the definition sits in a
   core step ('core') or only in an optional extension ('ext').  The content checker uses this to enforce
   "define before use" in path order, and "core steps never rely on extension-only terms". */
export const GLOSSARY = [
  { id: 'voltage', zh: '電壓', en: 'Voltage', chapter: 'basics', level: 'core' },
  { id: 'current', zh: '電流', en: 'Current', chapter: 'basics', level: 'core' },
  { id: 'resistance', zh: '電阻', en: 'Resistance', chapter: 'basics', level: 'core' },
  { id: 'semiconductor', zh: '半導體', en: 'Semiconductor', chapter: 'basics', level: 'core' },
  { id: 'logic01', zh: '邏輯 0 與 1', en: 'Logic 0 and 1', chapter: 'gates', level: 'core' },
  { id: 'inverter', zh: '反相器', en: 'Inverter', chapter: 'gates', level: 'core' },
  { id: 'nand', zh: 'NAND 閘', en: 'NAND gate', chapter: 'gates', level: 'core' },
];
