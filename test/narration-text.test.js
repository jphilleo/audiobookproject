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
