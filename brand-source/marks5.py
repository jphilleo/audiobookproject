# Round 9: whales and fish leaping out of the book. 96-unit grid.
import sys, importlib.util
import os
S = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("m4", S + "/marks4.py"); m4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(m4)
book, pages_path, spark, f = m4.book, m4.pages_path, m4.spark, m4.f

# Sperm whale in profile, facing right, nose at x≈92, tail flukes at x≈4. Body centred on y=48.
WHALE = ("M91 43.6c0-3.4-2-5.6-5.4-5.8L64 36.4c-10-.6-19.4 1.6-28 6.2l-9.6 5.2c-3.4 1.8-7 2.6-10.8 2.4"
         "L9.4 43.4C8.2 42 6.4 42 5.4 43.4c-.8 1-.8 2.4 0 3.4l4.6 5.4-4.6 5.4c-.8 1-.8 2.4 0 3.4 1 1.4 2.8 1.4 4-.2l6.2-6.6"
         "c4.6-.4 9.4.6 13.6 2.6 6.6 3.2 13.8 4.8 21.2 4.6l26-.8c2-.1 3.8-1 5-2.4l3.6-4.4c2.2-2.6 3.6-5.8 3.6-9.2z")
def whale(uid, x, y, rot, s=1.0, eye=True, jaw=True, sy=1.38):
    cuts = ""
    if jaw:
        cuts += '<path d="M87.4 53.6c-6.6 1.2-13.4 1.6-20.2 1.2" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round"></path>'
    if eye:
        cuts += '<circle cx="73.4" cy="46.6" r="1.7" fill="#000"></circle>'
    return (f'<mask id="{uid}w" maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200"><rect x="-50" y="-50" width="200" height="200" fill="#fff"></rect>{cuts}</mask>'
            f'<g transform="translate({x} {y}) rotate({rot}) scale({s} {s*sy}) translate(-48 -48)"><path mask="url(#{uid}w)" d="{WHALE}"></path></g>')

def gap_mask(uid, top, bottom, inner):
    """Wrap `inner` so a thin gap is cut where it crosses the book's page tops (it emerges from the pages)."""
    P = pages_path(top, bottom)
    return (f'<mask id="{uid}g"><rect width="96" height="96" fill="#fff"></rect><path d="{P}" fill="#000" stroke="#000" stroke-width="3"></path></mask>'
            f'<g mask="url(#{uid}g)">{inner}</g>')

FISH = "M0 0c6-6.4 15.6-8.4 24.4-5.2 3.6 1.4 6.6 3.2 9.2 5.2-2.6 2-5.6 3.8-9.2 5.2C15.6 8.4 6 6.4 0 0zM-1.4 0l-6.8-6.6c-.6 4.4-.6 8.8 0 13.2z"
def fish(uid, x, y, rot, s=1.0):
    return (f'<mask id="{uid}f" maskUnits="userSpaceOnUse" x="-60" y="-60" width="200" height="200"><rect x="-60" y="-60" width="200" height="200" fill="#fff"></rect><circle cx="27" cy="-1" r="1.5" fill="#000"></circle><path d="M17 -4.6c1.4 3 1.4 6.2 0 9.2" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"></path></mask>'
            f'<g transform="translate({x} {y}) rotate({rot}) scale({s})"><path mask="url(#{uid}f)" d="{FISH}"></path></g>')

def drops(pts, r=1.7):
    return "".join(f'<circle cx="{x}" cy="{y}" r="{r}"></circle>' for x, y in pts)

MARKS = {}
SPLASH = ""
MARKS["leap"] = ("The leap", "A whole sperm whale, Moby Dick's kind, airborne just above the book it leapt out of: big square head, flukes and all, with a splash at the gutter.",
  lambda u: whale(u, 49, 30, -12, .86) + SPLASH + drops([(36, 52), (31, 47), (60, 52), (65, 47.4), (48, 50.4)], 1.8) + book(58, 82, u + "b", cover=False))
MARKS["leap_cover"] = ("The leap, on the hardcover", "The same leap above the spark's hardcover book, so the whale and the spark could live together as a family.",
  lambda u: whale(u, 49, 30, -12, .86) + SPLASH + drops([(36, 52), (31, 47), (60, 52), (65, 47.4), (48, 50.4)], 1.8) + book(58, 80, u + "b"))
MARKS["fish"] = ("The fish jump", "A fish arcing out of one page and over the gutter, like a fish leaping out of a lake. Lighter and more playful than the whale.",
  lambda u: fish(u, 30, 34, -28, 1.25) + '<path d="M22 49c4-12 14-20 28-22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 5" opacity=".6"></path>'
            + drops([(20, 46), (16, 42)]) + book(54, 78, u + "b", cover=False))
MARKS["white"] = ("The white whale", "Moby Dick: the whale in white, cut out of a solid disc of sea that rises from the book. An emblem with a story behind it.",
  lambda u: f'<mask id="{u}m"><rect width="96" height="96" fill="#fff"></rect><g fill="#000">{whale(u + "i", 48, 37, -10, .74, eye=False, jaw=False)}</g><path d="{pages_path(60, 84)}" fill="#000" stroke="#000" stroke-width="5"></path></mask>'
            f'<circle mask="url(#{u}m)" cx="48" cy="40" r="35"></circle>' + book(60, 84, u + "b", cover=False))

if __name__ == "__main__":
    cards = ""
    for k, (name, note, fn) in MARKS.items():
        def svg(size, j, fill="#1F5640"):
            return f'<svg viewBox="0 0 96 96" width="{size}" height="{size}" style="fill:{fill};color:{fill}">{fn(f"{k}{j}")}</svg>'
        cards += (f'<figure><div>{svg(200,0)}</div><div class="sm">{svg(48,1,"#14201B")}{svg(32,2,"#14201B")}{svg(16,3,"#14201B")}'
                  f'<span class="tile">{svg(46,4,"#FBFAF6")}</span></div><figcaption><b>{name}</b></figcaption></figure>')
    open(sys.argv[1], "w").write('<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:13px -apple-system,sans-serif;background:#FBFAF6;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:#fff;border:1px solid #e6e3da;border-radius:12px;padding:10px;display:grid;justify-items:center;gap:8px}.sm{display:flex;gap:10px;align-items:end}.tile{width:56px;height:56px;border-radius:13px;background:#1F5640;display:grid;place-items:center}</style>' + cards)
    print("ok", len(MARKS))
