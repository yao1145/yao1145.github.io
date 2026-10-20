'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pingshui = require('./app.js');
const { createEngine, countRhymeCharacters } = pingshui;
const BOM = String.fromCharCode(0xFEFF);

let checks = 0;
let failures = 0;

function check(name, condition, detail) {
  checks += 1;
  if (!condition) {
    failures += 1;
    const suffix = detail === undefined ? '' : ` (${detail})`;
    console.error(`FAIL ${name}${suffix}`);
  }
}

function equal(name, actual, expected) {
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function loadData() {
  let source = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
  if (source.startsWith(BOM)) source = source.slice(1);
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: 'data.js', timeout: 10000 });
  return sandbox.window.PINGSHUI_DATA;
}

const data = loadData();
check('data.js exposes window.PINGSHUI_DATA', !!data);
check('data has characters', !!data && !!data.characters && Object.keys(data.characters).length > 0);
check('data has rhymes', !!data && !!data.rhymes && Object.keys(data.rhymes).length > 0);
equal('data source is retained', data && data.source, 'https://github.com/yao1145/ping_shui_yun');
equal('data commit is retained', data && data.commit, 'ebed44fe32387279ea13551f7c1f49a8810cadd8');

const engine = createEngine(data);
equal('the numeral 十 is ten', pingshui.cnToNum('十'), 10);
check('10 includes 十贿上', engine.query('10', 'rhyme').rhymeMatches.some(entry => entry.name === '十贿' && entry.tone === '上'));
check('十贿上 can be queried directly', engine.query('十贿上', 'rhyme').rhymeMatches.some(entry => entry.name === '十贿' && entry.tone === '上'));
const groupKeys = new Set();
for (let number = 1; number <= 30; number++) {
  for (const entry of engine.query(String(number), 'rhyme').rhymeMatches) groupKeys.add(entry.key);
}
equal('all 106 source rhyme groups can be reached', groupKeys.size, 106);

// Auto lookup for a single character returns both its readings and a group
// whose name is the same character.
const east = engine.query('东', 'auto');
equal('东 auto kind', east.kind, 'both');
check('东 has character readings', east.charMatches.length === 1 && east.charMatches[0].entries.length > 0);
check('东 character match is 东', east.charMatches[0] && east.charMatches[0].char === '东');
check('东 has the 一东 group',
  east.rhymeMatches.some(entry => entry.name === '一东' && entry.tone === '平'));
check('一东 keeps its original text',
  east.rhymeMatches.some(entry => entry.name === '一东' && entry.text.length > 0));

// Explicit modes and forced prefixes remove ambiguity.
const eastChar = engine.query('东', 'char');
equal('东 char kind', eastChar.kind, 'char');
equal('东 char has no rhyme matches', eastChar.rhymeMatches.length, 0);
const eastRhyme = engine.query('东', 'rhyme');
equal('东 rhyme kind', eastRhyme.kind, 'rhyme');
equal('东 rhyme has no character matches', eastRhyme.charMatches.length, 0);
const forcedChar = engine.query('字 东', 'rhyme');
equal('字 东 forces a character lookup', forcedChar.kind, 'char');
equal('forced character reports char mode', forcedChar.mode, 'char');
const forcedRhyme = engine.query('韵 东', 'char');
equal('韵 东 forces a rhyme lookup', forcedRhyme.kind, 'rhyme');
equal('forced rhyme reports rhyme mode', forcedRhyme.mode, 'rhyme');
const forcedDepartment = engine.query('部 十五合');
check('部 十五合 finds the 十五合 group',
  forcedDepartment.rhymeMatches.some(entry => entry.name === '十五合' && entry.tone === '入'));

// Accepted group forms.
const oneEast = engine.query('一东');
check('一东 finds 一东', oneEast.rhymeMatches.some(entry => entry.name === '一东'));
check('一东 does not return unrelated names',
  oneEast.rhymeMatches.every(entry => entry.name === '一东'));
const numberOne = engine.query('1');
check('1 lists groups numbered 一', numberOne.rhymeMatches.some(entry => entry.name === '一东'));
check('1 only lists groups numbered 一',
  numberOne.rhymeMatches.every(entry => /^一/.test(entry.name)));
const fifteenHe = engine.query('15合');
check('15合 finds 十五合',
  fifteenHe.rhymeMatches.some(entry => entry.name === '十五合' && entry.tone === '入'));
const fifteenHeTone = engine.query('十五合入');
equal('十五合入 returns one group', fifteenHeTone.rhymeMatches.length, 1);
equal('十五合入 name', fifteenHeTone.rhymeMatches[0] && fifteenHeTone.rhymeMatches[0].name, '十五合');
equal('十五合入 tone', fifteenHeTone.rhymeMatches[0] && fifteenHeTone.rhymeMatches[0].tone, '入');
const upperPrefix = engine.query('上平一东');
equal('上平一东 returns one group', upperPrefix.rhymeMatches.length, 1);
equal('上平一东 name', upperPrefix.rhymeMatches[0] && upperPrefix.rhymeMatches[0].name, '一东');

// The original OCR alias is applied to the rhyme index.
const alias = engine.query('二十一个');
check('二十一个 resolves to 二十一箇',
  alias.rhymeMatches.some(entry => entry.name === '二十一箇'));

// Character rhyme names are normalized without rewriting the source data.
let bomCharacter = null;
Object.keys(data.characters).some(character => {
  const entries = data.characters[character];
  if (Array.isArray(entries) && entries.some(entry => Array.isArray(entry) && String(entry[1]).includes(BOM))) {
    bomCharacter = character;
    return true;
  }
  return false;
});
check('a character entry with BOM exists in the source', !!bomCharacter);
if (bomCharacter) {
  const normalized = engine.query(bomCharacter, 'char');
  check('character rhyme names have no BOM',
    normalized.charMatches[0].entries.every(entry => !entry.rhyme.includes(BOM)));
  const originalEntry = data.characters[bomCharacter].find(entry => String(entry[1]).includes(BOM));
  check('source character data is not mutated',
    !!originalEntry && String(originalEntry[1]).includes(BOM));
}

// Custom data checks normalization, annotation counting, and immutability
// without depending on one particular source record.
const custom = {
  characters: { '测': [['平', BOM + '1东', '备注']] },
  rhymes: { '一东平': '甲[注，释]乙' }
};
const customEngine = createEngine(custom);
const customChar = customEngine.query('测', 'char');
equal('numeric character rhyme is normalized', customChar.charMatches[0].entries[0].rhyme, '一东');
equal('character note is preserved', customChar.charMatches[0].entries[0].note, '备注');
equal('custom source is not mutated', custom.characters['测'][0][1], BOM + '1东');
const customRhyme = customEngine.query('一东', 'rhyme');
equal('custom rhyme text is preserved', customRhyme.rhymeMatches[0].text, '甲[注，释]乙');
equal('custom rhyme char count excludes notes', customRhyme.rhymeMatches[0].charCount, 2);
equal('custom rhyme raw length includes notes', customRhyme.rhymeMatches[0].rawLength, 7);
equal('custom rhyme notes flag', customRhyme.rhymeMatches[0].hasNotes, true);
const counted = countRhymeCharacters('甲[注，释]乙');
equal('countRhymeCharacters char count', counted.charCount, 2);
equal('countRhymeCharacters raw length', counted.rawLength, 7);

// Empty, malformed, and oversized inputs must not throw.
equal('empty input kind', engine.query('', 'auto').kind, 'empty');
equal('whitespace input kind', engine.query('   \t  ', 'auto').kind, 'empty');
let huge = null;
try {
  huge = engine.query('9'.repeat(500), 'auto');
  check('huge digits return no match', huge.kind === 'none');
  check('huge digit input is preserved', huge.input.length === 500);
} catch (error) {
  check('huge digits do not throw', false, error && error.message);
}
let hugeChinese = null;
try {
  hugeChinese = engine.query('一百东', 'auto');
  check('unsupported Chinese numerals return no match', hugeChinese.kind === 'none');
} catch (error) {
  check('unsupported Chinese numerals do not throw', false, error && error.message);
}
equal('unknown mode falls back to auto', engine.query('东', 'unknown-mode').kind, 'both');
equal('missing data still queries', createEngine().query('东').kind, 'none');

if (failures) {
  console.error(`\n${failures} of ${checks} checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`All ${checks} checks passed.`);
}
