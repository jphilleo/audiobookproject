# Mark library for round 6 (96-unit grid). Each mark is a function of a unique id -> SVG inner markup.
# Writes a local preview page; the canvas boards are built from the same definitions.
import json, math, sys

def f(n): return f"{n:.2f}".rstrip("0").rstrip(".")

# --- shared parts -----------------------------------------------------------
def book(top=40, bottom=66, cut=True, uid="b", x0=8, x1=88, gap=2):
    """Open book with gently curved pages; two page-edge lines cut near the bottom."""
    L = f"M{x0} {bottom}C{x0+12} {bottom-6} {48-gap-10} {bottom-6} {48-gap} {bottom}V{top}C{48-gap-10} {top-6} {x0+12} {top-6} {x0} {top}Z"
    R = f"M{x1} {bottom}C{x1-12} {bottom-6} {48+gap+10} {bottom-6} {48+gap} {bottom}V{top}C{48+gap+10} {top-6} {x1-12} {top-6} {x1} {top}Z"
    if not cut:
        return f'<path d="{L}{R}"/>'
    y = bottom - 4.2
    lines = (f'<path d="M{x0+2} {y}C{x0+13} {y-5.2} {48-gap-11} {y-5.2} {48-gap-1.5} {y-.6}" />'
             f'<path d="M{x1-2} {y}C{x1-13} {y-5.2} {48+gap+11} {y-5.2} {48+gap+1.5} {y-.6}" />')
    return (f'<mask id="{uid}"><rect width="96" height="96" fill="#fff"/><g fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round">{lines}</g></mask>'
            f'<path mask="url(#{uid})" d="{L}{R}"/>')

def wave_book(top=58, bottom=84, uid="wb"):
    """Open book whose page tops are waves (the sea)."""
    def edge(x0, x1):
        n, pts = 4, ""
        w = (x1 - x0) / n
        for i in range(n):
            a = x0 + i * w
            pts += f"C{f(a+w*.25)} {top-3.2} {f(a+w*.75)} {top+3.2} {f(a+w)} {top}"
        return pts
    L = f"M8 {bottom}C20 {bottom-6} 36 {bottom-6} 46 {bottom}V{top}" + edge(46, 8)[0:0]
    # build left page as wave from x=8 to x=46 along the top
    left = f"M8 {bottom}C20 {bottom-6} 36 {bottom-6} 46 {bottom}V{top}"
    xs = [46, 36.5, 27, 17.5, 8]
    for i in range(4):
        a, b = xs[i], xs[i+1]
        left += f"C{f(a-(a-b)*.25)} {top-3.4 if i%2==0 else top+3.4} {f(a-(a-b)*.75)} {top-3.4 if i%2==0 else top+3.4} {f(b)} {top}"
    left += "Z"
    right = f"M88 {bottom}C76 {bottom-6} 60 {bottom-6} 50 {bottom}V{top}"
    xs = [50, 59.5, 69, 78.5, 88]
    for i in range(4):
        a, b = xs[i], xs[i+1]
        right += f"C{f(a+(b-a)*.25)} {top-3.4 if i%2==0 else top+3.4} {f(a+(b-a)*.75)} {top-3.4 if i%2==0 else top+3.4} {f(b)} {top}"
    right += "Z"
    return f'<path d="{left}{right}"/>'

def spark(x, y, r, thin=.13):
    k = r * thin
    return (f'<path d="M{f(x)} {f(y-r)}C{f(x+k)} {f(y-k*1.2)} {f(x+k*1.2)} {f(y-k)} {f(x+r)} {f(y)}'
            f'C{f(x+k*1.2)} {f(y+k)} {f(x+k)} {f(y+k*1.2)} {f(x)} {f(y+r)}'
            f'C{f(x-k)} {f(y+k*1.2)} {f(x-k*1.2)} {f(y+k)} {f(x-r)} {f(y)}'
            f'C{f(x-k*1.2)} {f(y-k)} {f(x-k)} {f(y-k*1.2)} {f(x)} {f(y-r)}z"/>')

def wedge(cx, cy, s, a1, a2, r):
    p = lambda a: (cx + s*math.cos(math.radians(a))*r, cy - math.sin(math.radians(a))*r)
    (x1, y1), (x2, y2) = p(a1), p(a2)
    return f"M{f(cx)} {f(cy)}L{f(x1)} {f(y1)}A{r} {r} 0 0 {1 if s<0 else 0} {f(x2)} {f(y2)}Z"

PAGE_BIRD = ("".join(wedge(48+s*4, 52, s, a, b, r) for s in (-1, 1) for a, b, r in [(0,19,41),(23,42,39),(46,65,33)])
             + "M48 33.5c4.6 0 7 4.6 6.4 11.6-.5 6-2.4 13.2-6.4 21.4-4-8.2-5.9-15.4-6.4-21.4-.6-7 1.8-11.6 6.4-11.6zM48 26.6a5.4 5.4 0 1 1 0 10.8a5.4 5.4 0 1 1 0-10.8zM52.8 30.4l6.4 2.2-6.4 2zM48 62.5 43.2 76.5 48 72.6l4.8 3.9z")

SWALLOW = ("M86 26.4l-7.2-1.2c-4.8-3.2-11.2-2.8-16 .4L40 40.4l-18.4.4 10 4.4-12.4 7.2 23.6-3.6c11.2 1.2 23.2-3.6 30-11.2 4-4.4 7.6-8.4 13.2-11.2z"
           "M63.6 29.2C58.8 18 50.4 9.2 36 4c6.4 9.2 9.2 18 9.6 31.2z")

# --- the marks --------------------------------------------------------------
MARKS = {}

# WHALE
MARKS["whale_tail"] = ("The tail, diving", "A whale's tail slipping into pages whose edges are waves: a thick tail stock, broad notched flukes, water streaming off the tips.",
  lambda u: '<g transform="rotate(-8 48 56)"><path d="M48 31.2C43.6 25.4 35.6 22.6 25 23.4c-8.4.6-14.4-1.4-18.6-6.2 3.2 11.4 13.6 18.6 28.2 20.4 3.8.4 6.4 1.6 7.6 3.8.6 6.4-.4 12.6-3 18.6h17.6c-2.6-6-3.6-12.2-3-18.6 1.2-2.2 3.8-3.4 7.6-3.8 14.6-1.8 25-9 28.2-20.4-4.2 4.8-10.2 6.8-18.6 6.2-10.6-.8-18.6 2-23 7.8z"/></g>'
            '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".55"><path d="M9.4 21.6v7M12.6 26.4v4.6M84 13.8v7M80.8 19v4.4"/></g>'
            + wave_book(58, 84))
MARKS["whale_breach"] = ("The breach", "A humpback surfacing through the open book with a spout: long, sleek, unmistakably a whale. The pages are the sea it rises from.",
  lambda u: f'<mask id="{u}m"><rect width="96" height="96" fill="#fff"/><circle cx="70.6" cy="37.4" r="1.6" fill="#000"/><path d="M85.6 43.2c-4.6 1.4-9.6 1.8-14.8 1.2" fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round"/><g fill="none" stroke="#000" stroke-width="1.3" stroke-linecap="round"><path d="M64 47.6c4.8.6 9.6.4 14-.8M60 50.4c5.4.8 10.6.6 15.6-.6"/></g></mask>'
            f'<path mask="url(#{u}m)" d="M14 60C17 44 32 32 52 30.4c14.6-1.2 27.4 2.6 33.4 10.2 2 2.6 1.4 5.6-1.6 7.2-8 4.4-19.6 6.6-34 7L18 62z"/>'
            '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M71 27.4c-.4-5.4-3-9.6-7.4-12.2M71 27.4c.8-5.2 3.8-9 8.6-11"/></g>'
            '<circle cx="62" cy="11.2" r="1.9"/><circle cx="81.4" cy="12" r="1.9"/><circle cx="71.4" cy="8.4" r="1.6"/>'
            + book(58, 84, uid=u+"b"))
MARKS["whale_book"] = ("The book is the whale", "An open book whose silhouette is a whale: the curve of the pages is its back, the far corner rises into a tail, and a spout breaks from the near end.",
  lambda u: f'<mask id="{u}m"><rect width="96" height="96" fill="#fff"/><path d="M47 44v26" stroke="#000" stroke-width="2.4"/><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round"><path d="M14 64.4C24 59 36 59 44.8 63.8M51.2 63.8C58 60 66 59 74 61"/></g><circle cx="16.4" cy="50.2" r="1.7" fill="#000"/></mask>'
            f'<path mask="url(#{u}m)" d="M6 70c2-14 12-24 26-27 6-1.3 11.4-.6 15 1.6 4.4-2.6 11-3.2 17-1.6 6.4 1.6 11.6 5.4 14.4 10.2 2.8-6.6 7.4-11.6 13.6-13.6-2.4 4.2-3 8.4-1.8 12.4-4.6 1.4-8 4-10.2 7.8L78 70c-6-3.2-13.4-4.2-21-2.6-3.6.8-6.8 2-9.6 3.6-6.4-3.8-15.6-5-25-3C17 69 10.4 69.8 6 70z"/>'
            '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M22 38c-.4-5.6-3-10-7.4-12.6M22 38c.8-5.4 3.8-9.4 8.6-11.6"/></g>'
            '<circle cx="13" cy="22" r="1.9"/><circle cx="32.4" cy="22.8" r="1.9"/>')

# MAGIC
MARKS["magic_spark"] = ("The spark", "One bright four-point star rising out of the gutter, with two small ones. Magic without the moon: works at any hour.",
  lambda u: spark(48, 24, 17) + spark(72, 12, 5.4) + spark(25, 32, 4.2) + book(48, 74, uid=u+"b"))
MARKS["magic_star"] = ("The shooting star", "A star leaping out of the gutter on a tapered trail, mid-arc. The story jumping off the page.",
  lambda u: '<path d="M47.4 52C45.4 35.4 54 21.6 69.4 14.8 59.2 23.8 53.6 35.6 51.2 52z" opacity=".5"/>' + spark(71, 15, 11) + book(50, 76, uid=u+"b"))
MARKS["magic_light"] = ("Light from the pages", "Rays of light pouring up out of the open book, like an illuminated manuscript. Warm and a little sacred, never a Wi-Fi icon.",
  lambda u: "".join(f'<path d="{wedge(48, 50, 1, a-4, a+4, 40)}" opacity="{o}"/>' for a, o in [(90,1),(64,.75),(116,.75),(40,.5),(140,.5)]).replace("A40 40 0 0 0", "A40 40 0 0 1") + book(48, 74, uid=u+"b"))
MARKS["magic_trail"] = ("A trail of stars", "Three stars spilling out of the gutter in a rising curve, growing as they go. The magic is escaping the book.",
  lambda u: spark(46, 42, 4.6) + spark(56, 28, 7.4) + spark(72, 13, 10.6) + book(50, 76, uid=u+"b"))

# BOOK COMES TO LIFE
MARKS["life_pagebird"] = ("The page bird", "The current favorite: a bird whose wings are two fans of book pages.",
  lambda u: f'<path d="{PAGE_BIRD}"/>')
MARKS["life_hardcover"] = ("The book in flight", "A hardcover that has become a bird: its covers bow into wings, the page block shows beneath, and it has a small head and forked tail.",
  lambda u: f'<mask id="{u}m"><rect width="96" height="96" fill="#fff"/><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round"><path d="M44 58 14.6 47.4M44 62.6 15.6 52.6M52 58l29.4-10.6M52 62.6l28.4-10"/></g></mask>'
            '<path d="M46 40C34 30.6 20.4 24.2 6.4 22.2 9.6 33 12 43.6 13 54.6L46 66.4zM50 40c12-9.4 25.6-15.8 39.6-17.8-3.2 10.8-5.6 21.4-6.6 32.4L50 66.4z" opacity=".32"/>'
            f'<path mask="url(#{u}m)" d="M46 36C34 26.6 20.4 20.2 6.4 18.2 9.6 29 12 39.6 13 50.6L46 62.4zM50 36c12-9.4 25.6-15.8 39.6-17.8-3.2 10.8-5.6 21.4-6.6 32.4L50 62.4z"/>'
            '<path d="M48 22.6a5.8 5.8 0 0 1 5.8 5.8c0 1.6-.6 3-1.6 4L48 66l-4.2-33.6a5.8 5.8 0 0 1 4.2-9.8z"/><path d="M53.4 26.6l6.8 2.2-6.8 2z"/>'
            '<path d="M48 63.6 42.4 79.4 48 75.4l5.6 4z"/>')
MARKS["life_turning"] = ("Pages becoming birds", "Pages lift out of the book and change as they rise: a page, a folded page, then a swallow flying off. The whole story in one mark.",
  lambda u: '<path d="M30.4 50.4 37.4 40l9.6 6.6-7 10.4z" opacity=".38"/>'
            '<path d="M47.6 37.2 55 24.8l6.2 12.6-6.6-4.4z" opacity=".68"/>'
            f'<g transform="translate(55.6 2.4) scale(.42)"><path d="{SWALLOW}"/></g>'
            + book(60, 84, uid=u+"b"))
MARKS["life_flock"] = ("The flock", "Birds rising out of the gutter and wheeling away, getting smaller as they go. A story leaving the page and going out into the world.",
  lambda u: '<path d="M36 46.4c4.4-6.4 9.8-9.6 16.2-9.2-2.8 1.6-4.6 3.8-5.6 6.4 4.6-3.2 10-4.2 16-3.2-6 1.8-11 4.6-15.4 8.8-3.2-2.8-6.8-3.8-11.2-2.8z"/>'
            '<path d="M55.4 27.2c3-4.4 6.8-6.6 11.2-6.4-1.9 1.1-3.2 2.6-3.9 4.4 3.2-2.2 6.9-2.9 11-2.2-4.1 1.2-7.6 3.2-10.6 6.1-2.2-1.9-4.7-2.6-7.7-1.9z" opacity=".78"/>'
            '<path d="M70 12.8c2-2.9 4.5-4.4 7.4-4.2-1.2.7-2.1 1.7-2.6 2.9 2.1-1.4 4.6-1.9 7.3-1.4-2.7.8-5 2.1-7 4-1.5-1.3-3.2-1.7-5.1-1.3z" opacity=".56"/>'
            + book(56, 82, uid=u+"b"))

if __name__ == "__main__":
    out = sys.argv[1]
    cards = ""
    for i, (k, (name, note, fn)) in enumerate(MARKS.items()):
        def svg(size, j, fill="#1F5640"):
            return f'<svg viewBox="0 0 96 96" width="{size}" height="{size}" style="fill:{fill};color:{fill}">{fn(f"{k}{j}")}</svg>'
        cards += (f'<figure><div class="big">{svg(180,0)}</div><div class="sm">{svg(48,1,"#14201B")}{svg(32,2,"#14201B")}{svg(16,3,"#14201B")}'
                  f'<span class="tile">{svg(46,4,"#FBFAF6")}</span></div><figcaption><b>{name}</b></figcaption></figure>')
    open(out, "w").write('<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:13px -apple-system,sans-serif;background:#FBFAF6;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}figure{margin:0;background:#fff;border:1px solid #e6e3da;border-radius:12px;padding:12px;display:grid;justify-items:center;gap:8px}.sm{display:flex;gap:12px;align-items:end}.tile{width:60px;height:60px;border-radius:14px;background:#1F5640;display:grid;place-items:center}</style>' + cards)
    print("ok", len(MARKS))
