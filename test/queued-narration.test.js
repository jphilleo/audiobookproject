import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
test('queued entry point preserves the narration recipe exactly',async()=>{
 let queued=await fs.readFile(new URL('../scripts/narrate-queued.js',import.meta.url),'utf8');
 const original=await fs.readFile(new URL('../scripts/narrate-library.js',import.meta.url),'utf8');
 queued=queued.replace(/\/\/ Scheduler-only entry point\.[\s\S]*?const exists =/,'const exists =')
 .replace('          checkpoint();\n','').replace('    checkpoint();\n    const name','    const name')
 .replace('    checkpoint();\n    await buildAudiobook','    await buildAudiobook')
 .replace("process.exitCode = e.code === 'YIELD' ? 75 : 1; break;",'process.exitCode = 1;');
 assert.equal(queued,original);
});
