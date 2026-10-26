# Round 7: the diving tail (more bookish) and more sparks. 96-unit grid.
import sys, importlib.util
import os
S = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("m2", S + "/marks2.py"); m2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(m2)
f, spark = m2.f, m2.spark

def pages_path(top, bottom, x0=10, x1=86, gap=2.2, sag=6):
    L = f"M{x0} {bottom}C{x0+12} {bottom-sag} {48-gap-10} {bottom-sag} {48-gap} {bottom}V{top}C{48-gap-10} {top-sag} {x0+12} {top-sag} {x0} {top}Z"
    R = f"M{x1} {bottom}C{x1-12} {bottom-sag} {48+gap+10} {bottom-sag} {48+gap} {bottom}V{top}C{48+gap+10} {top-sag} {x1-12} {top-sag} {x1} {top}Z"
    return L + R

def hardbook(top, bottom, uid, extra_cuts="", x0=10, x1=86):
    """Open hardcover book: pages on top of a cover that shows below and at the sides, plus page-edge lines."""
    P = pages_path(top, bottom, x0, x1)
    cb = bottom + 4.6
    cover = (f"M{x0-3.4} {top+3}V{cb}C{x0+10} {cb-6.4} {48-12} {cb-6.4} 46 {cb}"
             f"L48 {cb+2.2}L50 {cb}C{48+12} {cb-6.4} {x1-10} {cb-6.4} {x1+3.4} {cb}V{top+3}Z")
    y = bottom - 4.4
    lines = (f'<path d="M{x0+2} {y}C{x0+13} {y-5.2} {48-13} {y-5.2} {48-3.6} {y-.6}"></path>'
             f'<path d="M{x1-2} {y}C{x1-13} {y-5.2} {48+13} {y-5.2} {48+3.6} {y-.6}"></path>')
    return (f'<mask id="{uid}c"><rect width="96" height="96" fill="#fff"></rect><path d="{P}" fill="#000" stroke="#000" stroke-width="3.2" stroke-linejoin="round"></path></mask>'
            f'<path mask="url(#{uid}c)" d="{cover}"></path>'
            f'<mask id="{uid}p"><rect width="96" height="96" fill="#fff"></rect><g fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round">{lines}{extra_cuts}</g></mask>'
            f'<path mask="url(#{uid}p)" d="{P}"></path>')

# Whale tail: thick stock, broad notched fluke. Origin: fluke notch near (48, 18); stock bottom at y=base.
def tail(base, rot=-8, scale=1.0, cx=48):
    return (f'<g transform="translate({cx} {base}) rotate({rot}) scale({scale}) translate(-48 -60)">'
            '<path d="M48 31.2C43.6 25.4 35.6 22.6 25 23.4c-8.4.6-14.4-1.4-18.6-6.2 3.2 11.4 13.6 18.6 28.2 20.4 3.8.4 6.4 1.6 7.6 3.8.6 6.4-.4 12.6-3 18.6h17.6c-2.6-6-3.6-12.2-3-18.6 1.2-2.2 3.8-3.4 7.6-3.8 14.6-1.8 25-9 28.2-20.4-4.2 4.8-10.2 6.8-18.6 6.2-10.6-.8-18.6 2-23 7.8z"></path></g>')

def ripples(cx, cy, rs):
    """Full ripple rings seen in perspective (flattened ellipses), cut into the pages."""
    return "".join(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{r}" ry="{f(r*.3)}"></ellipse>' for r in rs)

MARKS = {}
MARKS["t1"] = ("Into the open book", "A clear hardcover book, open; the tail dives straight into the gutter and ripples spread across the pages.",
  lambda u: tail(56, -6, .78) + hardbook(50, 74, u, ripples(48, 56.5, [12, 21])))
MARKS["t2"] = ("Diving off the page", "The book tilted toward you with its pages as a calm sea; the tail goes under at an angle, with two ripples and drips.",
  lambda u: tail(55, -14, .74, 50) + hardbook(50, 74, u, ripples(50, 56, [11, 19, 27]))
            + '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".5"><path d="M17 20v6M20.4 25v4M76 12.6v6M72.8 17.6v4"></path></g>')
MARKS["t4"] = ("Ripples on the page", "A larger, upright tail slipping into a smaller book, with three ripple rings spreading across the pages. The book is the ocean.",
  lambda u: tail(54, 0, .9) + hardbook(54, 76, u, ripples(48, 61, [9, 17, 25])))

MARKS["s1"] = ("The spark (refined)", "The spark rising out of a proper hardcover: one bright star, two small ones.",
  lambda u: spark(48, 25, 17) + spark(72, 12, 5.4) + spark(24.6, 33, 4.2) + hardbook(50, 74, u))
MARKS["s2"] = ("The book inside the spark", "A big four-point star with an open book cut out of its heart. An emblem: the book is the source of the light.",
  lambda u: f'<mask id="{u}m"><rect width="96" height="96" fill="#fff"></rect><path d="{pages_path(41, 58, 29, 67, 1.4, 4)}" fill="#000"></path></mask>'
            f'<g mask="url(#{u}m)">{spark(48, 48, 45, .24)}</g>')
MARKS["s3"] = ("Spark in the gutter", "The spark sits right in the book's spine, half risen, its bottom point still between the pages. It's coming out of the book, not floating above it.",
  lambda u: f'<mask id="{u}m"><rect width="96" height="96" fill="#fff"></rect><path d="{pages_path(46, 72)}" fill="#000" stroke="#000" stroke-width="5"></path></mask>'
            f'<g mask="url(#{u}m)">{spark(48, 34, 26, .11)}</g>' + spark(73, 15, 4.6) + hardbook(46, 72, u + "b"))
MARKS["s4"] = ("Sparks rising", "Three sparks rising straight up out of the gutter, small to large, like the moment a story starts.",
  lambda u: spark(48, 43, 5) + spark(48, 29.6, 7.4) + spark(48, 12, 10) + hardbook(52, 76, u))
MARKS["s5"] = ("Pages that sparkle", "No separate star: the open book's top corners each throw a small spark, and one large spark lifts from the middle. Lighter, more decorative.",
  lambda u: spark(48, 26, 13) + spark(14, 30, 5) + spark(82, 30, 5) + hardbook(46, 70, u))

if __name__ == "__main__":
    cards = ""
    for k, (name, note, fn) in MARKS.items():
        def svg(size, j, fill="#1F5640"):
            return f'<svg viewBox="0 0 96 96" width="{size}" height="{size}" style="fill:{fill};color:{fill}">{fn(f"{k}{j}")}</svg>'
        cards += (f'<figure><div>{svg(180,0)}</div><div class="sm">{svg(48,1,"#14201B")}{svg(32,2,"#14201B")}{svg(16,3,"#14201B")}'
                  f'<span class="tile">{svg(46,4,"#FBFAF6")}</span></div><figcaption><b>{name}</b></figcaption></figure>')
    open(sys.argv[1], "w").write('<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:13px -apple-system,sans-serif;background:#FBFAF6;display:grid;grid-template-columns:repeat(5,1fr);gap:12px}figure{margin:0;background:#fff;border:1px solid #e6e3da;border-radius:12px;padding:10px;display:grid;justify-items:center;gap:8px}.sm{display:flex;gap:10px;align-items:end}.tile{width:56px;height:56px;border-radius:13px;background:#1F5640;display:grid;place-items:center}</style>' + cards)
    print("ok", len(MARKS))
