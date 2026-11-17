// Expand Roman numerals only where the surrounding words establish their meaning.
// Display titles and source text remain unchanged.
function romanNumber(token) {
  if (!/^(?=[MDCLXVI]+$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(token)) return null;
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  return [...token].reduce((sum, letter, i) => sum + (values[letter] < (values[token[i + 1]] || 0) ? -values[letter] : values[letter]), 0);
}
const small = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function cardinal(n) {
  if (n < 20) return small[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + small[n % 10] : "");
  return String(n);
}
const ordinals = ["","first","second","third","fourth","fifth","sixth","seventh","eighth","ninth","tenth","eleventh","twelfth","thirteenth","fourteenth","fifteenth","sixteenth","seventeenth","eighteenth","nineteenth","twentieth"];

export function prepareNarration(text, { heading = false } = {}) {
  let spoken = String(text).replace(/\r\n?/g, "\n").replace(/\u00ad/g, "").replace(/\b(Chapter|Stave|Book|Part|Volume|Act|Scene|Section|Canto|Letter|Appendix)\s+([MDCLXVI]+)\b/gi, (match, label, token) => {
    // Lowercase prose such as “mix” is not a Roman numeral. In body text,
    // a lone I can be the pronoun (“the chapter I read”).
    if (token !== token.toUpperCase() || (!heading && token === "I")) return match;
    const number = romanNumber(token);
    return number ? label + " " + cardinal(number) : match;
  });
  spoken = spoken.replace(/\b(Henry|Edward|George|William|Louis|Charles|Elizabeth|Richard|James|Philip|Frederick|Napoleon|Pope [A-Z][a-z]+)\s+([MDCLXVI]+)\b/g, (match, name, token) => {
    if (token === "I" && !heading && !name.startsWith("Pope ")) return match;
    const number = romanNumber(token);
    return ordinals[number] ? name + " the " + ordinals[number] : match;
  });
  if (heading) spoken = spoken.replace(/^([MDCLXVI]+)(?=\s*[:.—–-]|\s*$)/, (token) => {
    const number = romanNumber(token);
    return number ? cardinal(number) : token;
  });
  // Expand only unambiguous personal titles before a capitalized name.
  // This also prevents sentence splitting between the title and the name.
  const titles = { Mr: "Mister", Mrs: "Missus", Dr: "Doctor" };
  spoken = spoken.replace(/\b(Mr|Mrs|Dr)\.(?=\s+[A-Z])/g, (_, title) => titles[title]);
  return spoken;
}

// Some EPUBs retain the subtitle as the first standalone paragraph.
// Remove only an exact title/subtitle match when we announce that title separately.
export function chapterNarrationBody(text, title) {
  text = String(text).replace(/\r\n?/g, "\n");
  const paragraphs = text.split(/\n{2,}/);
  const first = paragraphs[0].trim();
  const subtitle = String(title).split(/:\s*/).slice(1).join(": ");
  if (paragraphs.length > 1 && (first === String(title).trim() || (subtitle && first === subtitle))) {
    return paragraphs.slice(1).join("\n\n");
  }
  return String(text);
}

// Quote delimiters belong in the displayed text, but isolated quoted utterances
// can distort Kokoro's pronunciation (e.g. “It is.”). Keep their words/punctuation.
export function prepareSpeechInput(text, { voice } = {}) {
  let spoken = prepareNarration(text).trim().replace(/^“([^“”]+)”$/u, '$1').replace(/^"([^"\n]+)"$/u, '$1');
  spoken = spoken.replace(/\breechoed\b/g, 're-echoed');
  if (/^Ding, dong!$/i.test(spoken)) spoken = spoken.replace(/, /, '-');
  if (/^(?:Ha[ ,!]+)+Ha!$/i.test(spoken)) spoken = spoken.replace(/, /g, '-');
  // Emma can add an apparent final /t/ to this isolated affirmation.
  // Two independent ASR models recover the affirmative with no terminal period.
  if (voice === 'bf_emma' && spoken === 'I can.') spoken = 'I can';
  return spoken;
}
