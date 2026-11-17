import {planNarration,closeTts} from '../src/tts.js';
try{const text='1234567890 '.repeat(30).trim();const segments=await planNarration(text,'af_heart');if(segments.some(s=>s.tokens>510)||segments.map(s=>s.text).join(' ')!==text)throw new Error('Unsafe plan');console.log(JSON.stringify({segments:segments.length,tokens:segments.map(s=>s.tokens),preserved:true}));}finally{await closeTts();}
