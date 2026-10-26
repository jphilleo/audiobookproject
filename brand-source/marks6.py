# Round 10: the leap, more abstract (no mouth), clearly just out of the water, with a subtle ripple on the pages.
import sys, importlib.util
import os
S = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("m5", S + "/marks5.py"); m5 = importlib.util.module_from_spec(spec); spec.loader.exec_module(m5)
whale, drops, pages_path = m5.whale, m5.drops, m5.pages_path
m4 = m5.m4

def rippled_book(top, bottom, uid, rx=8.6, ry=1.9, cover=True, rings=1):
    """Hardcover book with a small ripple ring (or two) cut into the pages around the gutter."""
    P = pages_path(top, bottom)
    cb = bottom + 4.6
    C = (f"M6.6 {top+3}V{cb}C20 {cb-6.4} 36 {cb-6.4} 46 {cb}L48 {cb+2.2}L50 {cb}C60 {cb-6.4} 76 {cb-6.4} 89.4 {cb}V{top+3}Z")
    ring = "".join(f'<ellipse cx="48" cy="{top+5.2}" rx="{rx*k}" ry="{ry*k}" fill="none" stroke="#6a6a6a" stroke-width="1.5"></ellipse>' for k in ([1] if rings == 1 else [1, 1.7]))
    cover_svg = (f'<mask id="{uid}c"><rect width="96" height="96" fill="#fff"></rect><path d="{P}" fill="#000" stroke="#000" stroke-width="3.2" stroke-linejoin="round"></path></mask>'
                 f'<path mask="url(#{uid}c)" d="{C}"></path>') if cover else ""
    return (cover_svg + f'<mask id="{uid}p"><rect width="96" height="96" fill="#fff"></rect>{ring}</mask>'
            f'<path mask="url(#{uid}p)" d="{P}"></path>')

MARKS = {}
MARKS["a"] = ("A · No face", "The whale as pure silhouette: no mouth, no eye. Droplets fall from the tail, one small ripple on the pages where it broke the surface.",
  lambda u: whale(u, 50, 25, -14, .82, eye=False, jaw=False) + drops([(25, 41), (29.4, 47), (21.4, 48)], 1.7) + rippled_book(58, 80, u + "b"))
MARKS["b"] = ("B · One small eye", "The same, with a single small eye and nothing else. Just enough to feel alive, without a cartoon face.",
  lambda u: whale(u, 50, 25, -14, .82, eye=True, jaw=False) + drops([(25, 41), (29.4, 47), (21.4, 48)], 1.7) + rippled_book(58, 80, u + "b"))
MARKS["c"] = ("C · Steeper leap", "A steeper climb with a small eye and a trail of droplets: the moment right after it burst out of the book.",
  lambda u: whale(u, 53, 24, -26, .78, eye=True, jaw=False) + drops([(35.4, 47.6), (31, 43), (40, 42.6), (28, 49)], 1.6) + rippled_book(58, 80, u + "b"))
MARKS["d"] = ("D · Two ripples, no cover", "Small eye, pages only (no cover line), two ripple rings spreading from the gutter. The flattest version.",
  lambda u: whale(u, 50, 25, -14, .82, eye=True, jaw=False) + drops([(25, 41), (29.4, 47)], 1.7) + rippled_book(58, 82, u + "b", cover=False, rings=2))

if __name__ == "__main__":
    cards = ""
    for k, (name, note, fn) in MARKS.items():
        def svg(size, j, fill="#1F5640"):
            return f'<svg viewBox="0 0 96 96" width="{size}" height="{size}" style="fill:{fill};color:{fill}">{fn(f"{k}{j}")}</svg>'
        cards += (f'<figure><div>{svg(200,0)}</div><div class="sm">{svg(48,1,"#14201B")}{svg(32,2,"#14201B")}{svg(16,3,"#14201B")}'
                  f'<span class="tile">{svg(46,4,"#FBFAF6")}</span></div><figcaption><b>{name}</b></figcaption></figure>')
    open(sys.argv[1], "w").write('<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:13px -apple-system,sans-serif;background:#FBFAF6;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:#fff;border:1px solid #e6e3da;border-radius:12px;padding:10px;display:grid;justify-items:center;gap:8px}.sm{display:flex;gap:10px;align-items:end}.tile{width:56px;height:56px;border-radius:13px;background:#1F5640;display:grid;place-items:center}</style>' + cards)
    print("ok", len(MARKS))
