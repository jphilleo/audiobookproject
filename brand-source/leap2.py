# Leap, round 2: a cleaner sperm-whale silhouette and an open ripple, for the final logo.
import importlib.util, os, math
spec = importlib.util.spec_from_file_location("lf", os.path.join(os.path.dirname(os.path.abspath(__file__)), "leapfinal.py")); lf = importlib.util.module_from_spec(spec); spec.loader.exec_module(lf)
pages_path = lf.pages_path
# Facing right, centred near (48, 48). Long box head with a rounded snout, a smooth taper to a slim stock, broad flukes.
WHALES = {
  "w1": "M86 36C91.6 36 94.6 40 94.6 45.4 94.6 51.4 90.8 55.4 85 56L58 59C44 60.4 33 57.6 24.4 52.4L17 50.6C13.4 53.6 8.6 56.6 2.6 57.4 5 53.4 7.6 50.4 10.4 48 7.6 45.6 5 42.6 2.6 38.6 8.6 39.4 13.4 42.4 17 45.4L24.4 43.6C34 37.6 45 35 58 35Z",
  "w2": "M84 35.4C90.6 35.4 94.6 39.4 94.6 45 94.6 51 90.8 55 85 55.6L60 58.2C45 59.6 34.6 57 26 52L18.4 50.6C14.6 54.2 9.4 57.4 3 58.2 5.6 53.8 8.4 50.6 11.6 48 8.4 45.4 5.6 42.2 3 37.8 9.4 38.6 14.6 41.8 18.4 45.4L26 43.6C34 37.4 44 34.6 56 34.8Z",
  "orig": lf.m6.m5.WHALE,
}
def whale(uid, path, x, y, rot, s, sy=1.0, eye=(80.4, 45.2), er=1.7):
    cut = f'<circle cx="{eye[0]}" cy="{eye[1]}" r="{er}" fill="#000"/>' if eye else ""
    return (f'<mask id="{uid}w" maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200"><rect x="-50" y="-50" width="200" height="200" fill="#fff"/>{cut}</mask>'
            f'<g transform="translate({x} {y}) rotate({rot}) scale({s} {s*sy}) translate(-48 -48)"><path mask="url(#{uid}w)" d="{path}"/></g>')
def arc(cx, cy, rx, ry):  # the near half of a ripple ring
    return f'<path d="M{cx-rx} {cy}A{rx} {ry} 0 0 0 {cx+rx} {cy}" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>'
def book(uid, cuts="", top=58, bottom=80):
    P = pages_path(top, bottom); cb = bottom + 4.6
    C = f"M6.6 {top+3}V{cb}C20 {cb-6.4} 36 {cb-6.4} 46 {cb}L48 {cb+2.2}L50 {cb}C60 {cb-6.4} 76 {cb-6.4} 89.4 {cb}V{top+3}Z"
    return (f'<mask id="{uid}c"><rect width="96" height="96" fill="#fff"/><path d="{P}" fill="#000" stroke="#000" stroke-width="3.2" stroke-linejoin="round"/></mask>'
            f'<path mask="url(#{uid}c)" d="{C}"/>'
            f'<mask id="{uid}p"><rect width="96" height="96" fill="#fff"/>{cuts}</mask><path mask="url(#{uid}p)" d="{P}"/>')
dots = lambda pts: "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in pts)
DROPS = [(24.6, 44, 1.6), (21, 49.4, 1.5), (28.4, 50.4, 1.6), (18.6, 54, 1.15), (31.6, 54.6, 1.2), (35.6, 50.2, 1.05)]
RING_OLD = '<ellipse cx="26" cy="61.6" rx="7.4" ry="1.25" fill="none" stroke="#000" stroke-width="1.5"/>'
RING_ARCS = arc(26, 61.2, 6.2, 1.9) + arc(26, 61.2, 11, 3.3)
RING_ONE = arc(26, 61.4, 8, 2.4)
def ring(cx, cy, rx, ry, w=1.2, back=1.0):
    """A ripple ring in perspective; back < 1 leaves gaps at the sides of its far half, so it reads as water, not a hole."""
    front = f'<path d="M{cx-rx} {cy}A{rx} {ry} 0 0 0 {cx+rx} {cy}" fill="none" stroke="#000" stroke-width="{w}" stroke-linecap="round"/>'
    t = math.acos(back) if back < 1 else 0
    x0, y0, x1, y1 = cx - rx*math.cos(t), cy - ry*math.sin(math.pi/2 - t) if False else cy - ry*math.sin(math.acos(-math.cos(t)) ) , cx + rx*math.cos(t), 0
    pts = lambda a: (round(cx + rx*math.cos(a), 2), round(cy - ry*math.sin(a), 2))
    (ax, ay), (bx, by) = pts(math.pi - t), pts(t)
    back_arc = f'<path d="M{ax} {ay}A{rx} {ry} 0 0 1 {bx} {by}" fill="none" stroke="#000" stroke-width="{w}" stroke-linecap="round"/>'
    return front + back_arc
W1 = lambda u, x=53, y=28, r=-14, s=.8, sy=1.24: whale(u, WHALES["w1"], x, y, r, s, sy)
D1 = [(21.4, 45.6, 1.6), (17.6, 51, 1.4), (25.4, 51.6, 1.5), (21.2, 55.6, 1.1), (29.6, 55.8, 1.15), (14.2, 47.4, 1.0)]
# Round 4: the original whale's body and flukes, with the nose redrawn (no spike at the snout, no slanted chin).
BODY = ("C54 35.8 44.6 38 36 42.6L26.4 47.8C23 49.6 19.4 50.4 15.6 50.2L9.4 43.4C8.2 42 6.4 42 5.4 43.4C4.6 44.4 4.6 45.8 5.4 46.8L10 52.2 5.4 57.6"
        "C4.6 58.6 4.6 60 5.4 61 6.4 62.4 8.2 62.4 9.4 60.8L15.6 54.2C20.2 53.8 25 54.8 29.2 56.8 35.8 60 43 61.6 50.4 61.4")
WHALES.update({
  # Box head: a flat brow, a blunt rounded front, and a slim lower jaw tucked in under it (Moby-Dick's sperm whale).
  "box": "M92 44.6C92 40 89 37.2 84.4 37L64 36.4" + BODY + "L71.6 60.8C75.4 60.7 78.2 59.4 80 57.2L83.4 56.6C88.6 55.8 92 52.4 92 47.6Z",
  # Blunt round nose: the same head without the jaw step.
  "blunt": "M92.4 45.4C92.4 40.4 89 37.2 84 37L64 36.4" + BODY + "L74 60.8C85 60.4 92.4 54.6 92.4 45.4Z",
  # Box head, slightly taller brow so the head reads bigger than the body.
  "boxbig": "M92.4 43.4C92.4 38 88.6 34.8 83.4 34.8L66 34.8C56.8 34.8 46 37.6 36 42.6L26.4 47.8C23 49.6 19.4 50.4 15.6 50.2L9.4 43.4C8.2 42 6.4 42 5.4 43.4C4.6 44.4 4.6 45.8 5.4 46.8L10 52.2 5.4 57.6C4.6 58.6 4.6 60 5.4 61 6.4 62.4 8.2 62.4 9.4 60.8L15.6 54.2C20.2 53.8 25 54.8 29.2 56.8 35.8 60 43 61.6 50.4 61.4L71.6 60.8C75.4 60.7 78.2 59.4 80 57.2L83.4 56.6C88.8 55.8 92.4 52 92.4 47Z",
})
D0 = [(17.6, 47.4, 1.5), (23.6, 48.4, 1.6), (20.6, 51.8, 1.2), (12.4, 45.2, 1.1), (28.4, 51.6, 1.1), (33.2, 47.6, 1.25)]
WO = lambda u, k, eye=(74.6, 45.8), y=22: whale(u, WHALES[k], 50, y, -14, .82, 1.38, eye, 1.9)
R = ring(22, 61.4, 9, 1.7)
MARKS = {
  "f1": ("1 · Box head, jaw tucked under", lambda u: WO(u, "box") + dots(D0) + book(u + "b", R)),
  "f2": ("2 · Blunt round nose", lambda u: WO(u, "blunt") + dots(D0) + book(u + "b", R)),
}
if __name__ == "__main__":
    n = [0]
    def svg(k, size, fill):
        n[0] += 1
        return f'<svg viewBox="0 0 96 96" width="{size}" height="{size}" style="fill:{fill};color:{fill}">{MARKS[k][1](f"{k}{n[0]}")}</svg>'
    cards = "".join(f'<figure><b>{name}</b>{svg(k,240,"#1F5640")}<div class="sz">{svg(k,48,"#14201B")}{svg(k,32,"#14201B")}{svg(k,16,"#14201B")}<span class="tile">{svg(k,44,"#FBFAF6")}</span></div></figure>' for k, (name, _) in MARKS.items())
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "review.html"), "w").write('<!doctype html><meta charset="utf-8"><style>body{margin:12px;font:13px -apple-system,sans-serif;background:#FBFAF6;color:#14201B;display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0;background:#fff;border:1px solid #E6E3DA;border-radius:12px;padding:10px;display:grid;justify-items:center;gap:8px}.sz{display:flex;gap:14px;align-items:end}.tile{width:54px;height:54px;border-radius:13px;background:#1F5640;display:grid;place-items:center}</style>' + cards)
    print("ok")
