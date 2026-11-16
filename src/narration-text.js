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
  let spoken = String(text).replace(/\b(Chapter|Stave|Book|Part|Volume|Act|Scene|Section|Canto|Letter|Appendix)\s+([MDCLXVI]+)\b/gi, (match, label, token) => {
    const number = romanNumber(token.toUpperCase());
    return number ? label + " " + cardinal(number) : match;
  });
  spoken = spoken.replace(/\b(Henry|Edward|George|William|Louis|Charles|Elizabeth|Richard|James|Philip|Frederick|Napoleon|Pope [A-Z][a-z]+)\s+([MDCLXVI]+)\b/g, (match, name, token) => {
    const number = romanNumber(token);
    return ordinals[number] ? name + " the " + ordinals[number] : match;
  });
  if (heading) spoken = spoken.replace(/^([MDCLXVI]+)(?=\s*[:.—–-]|\s*$)/, (token) => {
    const number = romanNumber(token);
    return number ? cardinal(number) : token;
  });
  return spoken;
}
