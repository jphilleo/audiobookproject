import fs from 'node:fs/promises';import path from 'node:path';
import {buildAudiobook} from '../../src/audio.js';
const root=path.resolve(process.argv[2]);await fs.mkdir(root,{recursive:true});
try{await buildAudiobook({title:'Cover check',author:'Audit',coverPath:process.argv[4],chapters:[{title:'One',file:process.argv[3],durationMs:13125}],outPath:path.join(root,'cover.m4b')});console.log('succeeded');}catch(e){await fs.writeFile(path.join(root,'error.json'),JSON.stringify({id:38,error:e.message},null,2));console.log(e.message);}
