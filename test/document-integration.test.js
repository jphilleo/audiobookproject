import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {parseEpub} from '../src/epub.js';
import {parsePdf} from '../src/pdf.js';
function pdfFixture(){
 const lines = (opening, y) => `BT /F1 12 Tf 50 ${y} Td (${opening}) Tj ` + Array.from({length:7},()=> '0 -14 Td (The traveler walked through the village and listened to every story.) Tj ').join('') + 'ET';
 const stream=lines('First sentence.',700)+'\n'+lines('Second opening.',500);
 const objects=[
 '<< /Type /Catalog /Pages 2 0 R /Outlines 6 0 R >>',
 '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
 `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
 '<< /Type /Outlines /First 7 0 R /Last 8 0 R /Count 2 >>',
 '<< /Title (Chapter One) /Parent 6 0 R /Next 8 0 R /Dest [3 0 R /XYZ 0 700 null] >>',
 '<< /Title (Chapter Two) /Parent 6 0 R /Prev 7 0 R /Dest [3 0 R /XYZ 0 500 null] >>'];
 let s='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 const xref=Buffer.byteLength(s);s+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))s+=`${String(offset).padStart(10,'0')} 00000 n \n`;
 s+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(s);
}
test('actual PDF preserves two same-page chapters and their first sentences',async()=>{
 const book=await parsePdf(pdfFixture(),'fixture.pdf');
 assert.equal(book.sections.length,2);
 assert.match(book.sections[0].text,/^First sentence\./);
 assert.match(book.sections[1].text,/^Second opening\./);
 assert.ok(book.sections.every(s=>s.selected));
});
test('actual EPUB preserves text through ZIP, XML, HTML and selection',async()=>{
 const zip=new JSZip();
 zip.file('META-INF/container.xml','<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>');
 zip.file('book.opf','<package><metadata><title>Fixture</title><creator>Author</creator><language>en</language></metadata><manifest><item id="c" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="e" href="end.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/><itemref idref="e"/></spine></package>');
 zip.file('chapter.xhtml','<html><body><h1>Chapter One</h1><div>US troops arrived.<p>civil</p>Afterward they left.</div><figure><blockquote><p>Come home.</p></blockquote></figure><p>10<sup>2</sup> units.</p><p>'+ 'They listened to the story. '.repeat(35)+'</p><p>THE KING IS DEAD AT LAST</p></body></html>');
 zip.file('end.xhtml','<html><body><h1>Epilogue</h1><p>They went home.</p></body></html>');
 const book=await parseEpub(await zip.generateAsync({type:'nodebuffer'}));
 const body=book.sections.map(s=>s.text).join('\n');
 for(const phrase of ['US troops arrived.','civil','Afterward they left.','Come home.','10 squared units.','THE KING IS DEAD AT LAST','They went home.'])assert.ok(body.includes(phrase),phrase);
 assert.equal(book.sections.at(-1).selected,true);
});
