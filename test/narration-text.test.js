import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareNarration, chapterNarrationBody } from '../src/narration-text.js';
import { chunkText } from '../src/tts.js';

test('Roman chapter headings and monarchs', () => {
  for (const [roman, word] of [['I','one'],['II','two'],['III','three'],['IV','four'],['V','five']]) {
    assert.equal(prepareNarration(`Stave ${roman}: Title`, {heading:true}), `Stave ${word}: Title`);
  }
  assert.equal(prepareNarration('Henry VIII'), 'Henry the eighth');
});
test('preserves prose and ambiguous abbreviations', () => {
  for (const text of ['the chapter I read', 'a book mix', 'I am here.', 'St. Paul’s', '12 St.', 'Chapter IIX']) {
    assert.equal(prepareNarration(text), text);
  }
});
test('personal titles are expanded before segmentation', () => {
  assert.equal(prepareNarration('Mr. Scrooge and Mrs. Cratchit met Dr. Smith.'), 'Mister Scrooge and Missus Cratchit met Doctor Smith.');
  const text = 'A'.repeat(370) + ' Mr. Scrooge spoke.';
  assert.ok(chunkText(text).every(c => !/\bMr\.$/.test(c.text)));
  const once = prepareNarration('Stave IV. Mr. Scrooge spoke.', {heading:true});
  assert.equal(prepareNarration(once), once);
});

test('remove only exact standalone repeated headings', () => {
  assert.equal(chapterNarrationBody('Marley’s Ghost\n\nMarley was dead.', 'Stave I: Marley’s Ghost'), 'Marley was dead.');
  assert.equal(chapterNarrationBody('Marley’s Ghost appeared.\n\nHe spoke.', 'Stave I: Marley’s Ghost'), 'Marley’s Ghost appeared.\n\nHe spoke.');
});

test('sentence segmentation preserves decimal values and initials', () => {
  const text = 'It cost $3.50, not $12.75. The value was 0.005.';
  assert.equal(chunkText(text).map(c => c.text).join(' '), text);
  const prefix = 'A'.repeat(365) + '.';
  const chunks = chunkText(prefix + ' J. M. Barrie wrote it.');
  assert.ok(chunks.some(c => c.text === 'J. M. Barrie wrote it.'));
  assert.ok(chunks.every(c => !/\b[JM]\.$/.test(c.text)));
});
test('remove discretionary hyphens without removing real hyphens', () => {
  assert.equal(prepareNarration('extra\u00adordinary and well-known'), 'extraordinary and well-known');
});
test('dialogue and long paragraphs retain all words', () => {
  const text = ('“Go!” she said. “Now.” He waited... Then left. ').repeat(40).trim();
  const chunks = chunkText(text);
  assert.equal(chunks.map(c => c.text).join(' '), text);
  assert.ok(chunks.every(c => c.text.length <= 380));
  assert.equal(chunks.filter(c => c.paragraphEnd).length, 1);
});

test('trailing ellipses and nested quotes survive segmentation', () => {
  const text = 'He said, “I can’t exist.…” Then he left.';
  assert.equal(chunkText(text).map(c=>c.text).join(' ').replace(/\s/g,''), text.replace(/\s/g,''));
});
