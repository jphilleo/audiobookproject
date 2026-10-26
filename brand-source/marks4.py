# Round 8: simpler "spark refined" variations and flat whales with head + tail. 96-unit grid.
import sys, importlib.util
import os
S = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("m3", S + "/marks3.py"); m3 = importlib.util.module_from_spec(spec); spec.loader.exec_module(m3)
f, spark, pages_path = m3.f, m3.m2.spark, m3.pages_path

def book(top, bottom, uid, cover=True, edge_line=False, x0=10, x1=86, cover_gap=3.2, cover_drop=4.6):
    """Open book. cover: hardcover showing below the pages. edge_line: one page-edge line per page."""
    P = pages_path(top, bottom, x0, x1)
    out = ""
    if cover:
        cb = bottom + cover_drop
        C = (f"M{x0-3.4} {top+3}V{cb}C{x0+10} {cb-6.4} 36 {cb-6.4} 46 {cb}"
             f"L48 {cb+2.2}L50 {cb}C60 {cb-6.4} {x1-10} {cb-6.4} {x1+3.4} {cb}V{top+3}Z")
        out += (f'<mask id="{uid}c"><rect width="96" height="96" fill="#fff"></rect><path d="{P}" fill="#000" stroke="#000" stroke-width="{cover_gap}" stroke-linejoin="round"></path></mask>'
                f'<path mask="url(#{uid}c)" d="{C}"></path>')
    if edge_line:
        y = bottom - 4.4
        line = (f'<path d="M{x0+2} {y}C{x0+13} {y-5.2} 35 {y-5.2} 44.4 {y-.6}"></path>'
                f'<path d="M{x1-2} {y}C{x1-13} {y-5.2} 61 {y-5.2} 51.6 {y-.6}"></path>')
        out += (f'<mask id="{uid}p"><rect width="96" height="96" fill="#fff"></rect><g fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round">{line}</g></mask>'
                f'<path mask="url(#{uid}p)" d="{P}"></path>')
    else:
        out += f'<path d="{P}"></path>'
    return out

MARKS = {}
# --- Spark refined: same idea, simplified -----------------------------------
MARKS["r1"] = ("A · Cover, no page lines", "The spark refined with the page lines removed: just pages on a cover. One less line, same warmth.",
  lambda u: spark(48, 25, 17) + spark(72, 12, 5.4) + spark(24.6, 33, 4.2) + book(50, 74, u))
MARKS["r2"] = ("B · Pages only", "No cover, no lines: the open book as one clean shape. The simplest, and the strongest at 16px.",
  lambda u: spark(48, 27, 18) + spark(72, 13, 5.6) + spark(24.6, 35, 4.4) + book(52, 78, u, cover=False))
MARKS["r3"] = ("C · One small spark", "The cover version with a single companion spark instead of two. Calmer and more balanced.",
  lambda u: spark(48, 25, 17.5) + spark(71, 13, 5.8) + book(50, 74, u))
MARKS["r4"] = ("D · Bigger spark, lower book", "The spark grows and the book sits lower and wider, so the light is the hero and the book is its source.",
  lambda u: spark(48, 30, 23) + spark(76, 12, 5.4) + spark(20, 20, 4.2) + book(60, 80, u, x0=8, x1=88))
MARKS["r5"] = ("E · Thick cover, bold", "A heavier cover and a wider gap, drawn for small sizes: it survives as a favicon on a busy browser tab.",
  lambda u: spark(48, 24, 17) + spark(72, 11, 5.6) + spark(24.6, 32, 4.4) + book(50, 72, u, cover_gap=4.4, cover_drop=6.4))

# --- Whale: flat, head and tail ----------------------------------------------
TAIL = ("M48 31.2C43.6 25.4 35.6 22.6 25 23.4c-8.4.6-14.4-1.4-18.6-6.2 3.2 11.4 13.6 18.6 28.2 20.4 3.8.4 6.4 1.6 7.6 3.8.6 6.4-.4 12.6-3 18.6h17.6"
        "c-2.6-6-3.6-12.2-3-18.6 1.2-2.2 3.8-3.4 7.6-3.8 14.6-1.8 25-9 28.2-20.4-4.2 4.8-10.2 6.8-18.6 6.2-10.6-.8-18.6 2-23 7.8z")
def tail(x, y, s=.62, r=12):
    return f'<path transform="translate({x} {y}) rotate({r}) scale({s}) translate(-48 -60)" d="{TAIL}"></path>'
# Sperm-whale head (Moby-Dick's whale): big blunt square head surfacing out of the left page.
HEAD = "M43 57V46c0-7.2-4.6-11.6-11.6-11.6H13.8C8.4 34.4 5 37.6 5 42.6c0 4 2.4 6.6 6.8 7.6l9.4 2c4.4 1 7.4 2.6 9 4.8z"
def head(uid, dy=0, eye=True):
    cuts = (f'<circle cx="31.4" cy="{43.4+dy}" r="1.8" fill="#000"></circle>' if eye else "") + \
           f'<path d="M9.6 {47.4+dy}l12.4 2.6" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round"></path>'
    return (f'<mask id="{uid}h"><rect width="96" height="96" fill="#fff"></rect>{cuts}</mask>'
            f'<path mask="url(#{uid}h)" transform="translate(0 {dy})" d="{HEAD}"></path>')

# Whale's back surfacing through the left page (low, wide dome), separated from the page by a thin gap,
# and a spout drawn as a fountain of water with droplets.
def dome(top):
    return f"M9 {top+1.6}C11 {top-11} 20 {top-16} 30 {top-16}s17.6 4.6 17.6 11.4V{top+1.6}z"
def spout(x, y):
    return (f'<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M{x} {y}v-8.4M{x} {y}c-.6-3.4-2.4-6-5.4-7.6M{x} {y}c.6-3.4 2.4-6 5.4-7.6"></path></g>'
            f'<circle cx="{x-7.6}" cy="{y-9.4}" r="1.5"></circle><circle cx="{x+7.6}" cy="{y-9.4}" r="1.5"></circle><circle cx="{x}" cy="{y-12}" r="1.5"></circle>')
def dome_whale(u, cover=False, eye=False, top=54):
    P = pages_path(top, 78 if not cover else 76)
    cuts = f'<path d="{P}" fill="none" stroke="#000" stroke-width="2.6"></path>' + (f'<circle cx="17.6" cy="{top-4}" r="1.7" fill="#000"></circle>' if eye else "")
    return (f'<mask id="{u}d"><rect width="96" height="96" fill="#fff"></rect>{cuts}</mask>'
            f'<path mask="url(#{u}d)" d="{dome(top)}"></path>'
            + spout(29, top - 18)
            + tail(70, top + 3, .6, 10) + book(top, 78 if not cover else 76, u, cover=cover))

# Flat diving tail: the proven tail going into a plain open book. Few lines, no perspective.
def flat_tail(u, tail_y, tail_s, rot, book_top, book_bot, cover=False, ring=False):
    ring_cut = ""
    if ring:
        ring_cut = f'<mask id="{u}r"><rect width="96" height="96" fill="#fff"></rect><ellipse cx="48" cy="{book_top+5}" rx="14" ry="4" fill="none" stroke="#000" stroke-width="1.8"></ellipse></mask>'
        P = pages_path(book_top, book_bot)
        return (tail(48, tail_y, tail_s, rot) + ring_cut + f'<path mask="url(#{u}r)" d="{P}"></path>')
    return tail(48, tail_y, tail_s, rot) + book(book_top, book_bot, u, cover=cover)

MARKS["w1"] = ("1 · Flat, just the tail", "The tail diving into a plain open book. Two shapes, no lines: the simplest whale.",
  lambda u: flat_tail(u, 56, .8, -6, 50, 76))
MARKS["w2"] = ("2 · Flat, one ripple", "The same with a single ripple ring cut into the pages, so you can tell it's going under.",
  lambda u: flat_tail(u, 56, .8, -6, 50, 76, ring=True))
MARKS["w3"] = ("3 · Flat, on the hardcover", "The tail into the spark's hardcover book (cover, no page lines), so the whale and spark are drawn the same way.",
  lambda u: flat_tail(u, 56, .8, -6, 50, 74, cover=True))

if __name__ == "__main__":
    cards = ""
    for k, (name, note, fn) in MARKS.items():
        def svg(size, j, fill="#1F5640"):
            return f'<svg viewBox="0 0 96 96" width="{size}" height="{size}" style="fill:{fill};color:{fill}">{fn(f"{k}{j}")}</svg>'
        cards += (f'<figure><div>{svg(180,0)}</div><div class="sm">{svg(48,1,"#14201B")}{svg(32,2,"#14201B")}{svg(16,3,"#14201B")}'
                  f'<span class="tile">{svg(46,4,"#FBFAF6")}</span></div><figcaption><b>{name}</b></figcaption></figure>')
    open(sys.argv[1], "w").write('<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:13px -apple-system,sans-serif;background:#FBFAF6;display:grid;grid-template-columns:repeat(5,1fr);gap:12px}figure{margin:0;background:#fff;border:1px solid #e6e3da;border-radius:12px;padding:10px;display:grid;justify-items:center;gap:8px}.sm{display:flex;gap:10px;align-items:end}.tile{width:56px;height:56px;border-radius:13px;background:#1F5640;display:grid;place-items:center}</style>' + cards)
    print("ok", len(MARKS))
