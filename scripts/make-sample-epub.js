// Builds a tiny EPUB3 test fixture from public-domain text (Pride and Prejudice, 1813).
import JSZip from "jszip";
import fs from "node:fs/promises";

const chapters = [
  ["Chapter 1", [
    "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
    "However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.",
    "“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?”",
    "Mr. Bennet replied that he had not.",
    "“But it is,” returned she; “for Mrs. Long has just been here, and she told me all about it.”",
    "Mr. Bennet made no answer.",
    "“Do you not want to know who has taken it?” cried his wife impatiently.",
    "“You want to tell me, and I have no objection to hearing it.”",
    "This was invitation enough.",
  ]],
  ["Chapter 2", [
    "Mr. Bennet was among the earliest of those who waited on Mr. Bingley. He had always intended to visit him, though to the last always assuring his wife that he should not go; and till the evening after the visit was paid she had no knowledge of it.",
    "It was then disclosed in the following manner. Observing his second daughter employed in trimming a hat, he suddenly addressed her with:",
    "“I hope Mr. Bingley will like it, Lizzy.”",
  ]],
];
const license = ["The Full Project Gutenberg License", ["Please read this before you distribute or use this work. This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever. You may copy it, give it away or re-use it under the terms of the Project Gutenberg License included with this eBook or online at www.gutenberg.org."]];

const xhtml = (title, paras) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title></head>
<body><section epub:type="chapter"><h2>${title}</h2>${paras.map((p) => `<p>${p}</p>`).join("\n")}</section></body></html>`;

const all = [...chapters, license];
const zip = new JSZip();
zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
all.forEach(([t, p], i) => zip.file(`OEBPS/text/ch${i + 1}.xhtml`, xhtml(t, p)));
zip.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol>${all.map(([t], i) => `<li><a href="text/ch${i + 1}.xhtml">${t}</a></li>`).join("")}</ol></nav></body></html>`);
zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">sample-pp</dc:identifier><dc:title>Pride and Prejudice (Sample)</dc:title><dc:creator>Jane Austen</dc:creator><dc:language>en</dc:language></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${all.map((_, i) => `<item id="ch${i + 1}" href="text/ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest>
<spine>${all.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join("")}</spine></package>`);

await fs.mkdir("samples", { recursive: true });
await fs.writeFile("samples/pride-and-prejudice-sample.epub", await zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" }));
console.log("Wrote samples/pride-and-prejudice-sample.epub");
