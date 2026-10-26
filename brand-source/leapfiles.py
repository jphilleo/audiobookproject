# Writes the leaping-whale logo files into the site (final: Q4, from whale7.py).
import importlib.util, os, re
spec = importlib.util.spec_from_file_location("w7", os.path.join(os.path.dirname(os.path.abspath(__file__)), "whale7.py")); w7 = importlib.util.module_from_spec(spec); spec.loader.exec_module(w7)
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # audiobook-project/
def body(uid):
    return w7.mark("q4", uid)
mark = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Audiobook Project">\n'
        '  <!-- A humpback leaping out of an open book; drops fall back into the ripple it left on the page. Drawn on a 96 grid. -->\n'
        '  <g fill="currentColor">' + body("apm") + '</g>\n</svg>\n')
icon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Audiobook Project">\n'
        '  <!-- App icon / favicon: the mark in paper on a Library green tile. -->\n'
        '  <rect width="96" height="96" rx="21" fill="#1F5640"/>\n'
        '  <g fill="#FBFAF6" transform="translate(9 4) scale(.81)">' + body("api") + '</g>\n</svg>\n')
open(SITE + "/public/brand/mark.svg", "w").write(mark)
open(SITE + "/public/brand/icon.svg", "w").write(icon)
h = open(SITE + "/views/_header.html").read()
# Keep the header's own viewBox (it's framed a little differently by hand) and only swap the drawing.
vb = re.search(r'<svg class="logo" viewBox="([^"]*)"', h)
vb = vb.group(1) if vb else "0 0 96 96"
h = re.sub(r'<svg class="logo".*?</svg>', lambda m: f'<svg class="logo" viewBox="{vb}" aria-hidden="true">' + body("aph") + '</svg>', h, flags=re.S)
open(SITE + "/views/_header.html", "w").write(h)
print("ok")
