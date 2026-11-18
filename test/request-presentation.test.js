import test from 'node:test';import assert from 'node:assert/strict';
import {requestEmail,requestPage} from '../src/request-presentation.js';
test('branded email preserves secure request links and escapes content for all states',()=>{
 for(const kind of ['confirmation','delivery','failure']) {
  const html=requestEmail({book:{title:'Book <script>',author:'A & B'},format:'m4b',kind,link:'https://example.org/requests/abc'});
  assert.match(html,/href="https:\/\/example.org\/requests\/abc"/);assert.match(html,/Book &lt;script&gt;/);assert.ok(!html.includes('<script>'));assert.match(html,/M4B audiobook/);assert.match(html,/role="presentation"/);
 }
});
test('request page has a responsive private layout, book details and honest status',()=>{
 const html=requestPage('The Prophet','<p>We will email you when ready.</p>',{book:{slug:'the-prophet',title:'The Prophet',author:'Kahlil Gibran'},format:'mp3',status:'working'});
 assert.match(html,/noindex,nofollow/);assert.match(html,/request-card/);assert.match(html,/Preparing your audiobook/);assert.match(html,/Kahlil Gibran · MP3/);assert.match(html,/cover.jpg/);
});
