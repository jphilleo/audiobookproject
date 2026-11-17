import test from 'node:test';import assert from 'node:assert/strict';
process.env.LIBRARY_AUDIO_URL='https://audio.example.test';
const {audioUrl}=await import('../src/library-pages.js');
test('preview releases preserve old URLs and isolate refreshed audio',()=>{
 const b={slug:'alice',preview:true,audioStorage:'r2'};
 assert.equal(audioUrl(b,'001.m4a'),'https://audio.example.test/previews/alice.m4a');
 assert.equal(audioUrl({...b,previewRelease:'refresh-20261117'},'001.m4a'),'https://audio.example.test/previews/refresh-20261117/alice.m4a');
 assert.equal(audioUrl({...b,previewRelease:'../bad'},'001.m4a'),'https://audio.example.test/previews/alice.m4a');
 assert.equal(audioUrl({...b,ready:true},'release/001.m4a'),'https://audio.example.test/alice/release/001.m4a');
 assert.equal(audioUrl({...b,audioStorage:'origin',previewRelease:'refresh-20261117'},'001.m4a'),'/library-audio/alice/001.m4a');
});
