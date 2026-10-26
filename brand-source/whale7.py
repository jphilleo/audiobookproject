# One hand-drawn humpback, authored flat (facing right, snout at x=100, centre line y=0),
# then bent along an arc and posed for each leap. Absolute commands only (M L C Q Z) so every point can be bent.
import math, os, re, importlib.util
spec = importlib.util.spec_from_file_location("l2", os.path.join(os.path.dirname(os.path.abspath(__file__)), "leap2.py")); l2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(l2)
ring, dots = l2.ring, l2.dots

BODY = ("M100 1.6"
        "C99.4 -2.6 94 -5.4 86 -7.2"          # flat rostrum to the brow
        "C76 -9.6 64 -11.6 54 -11.6"          # back, highest just behind the head
        "C46 -11.6 40 -10.6 35.6 -9.6"        # toward the hump
        "C34 -10.8 32.2 -11.2 30.6 -10.2"     # small, soft dorsal hump
        "C25 -8 18 -4.4 10 -2"                # slim tail stock, top
        "C7.4 -2.4 5.2 -5 4.4 -9"             # upper fluke: rounded leading edge
        "C3.8 -12.6 2.4 -15.6 -.6 -17.4"      # out to the tip
        "C-1.2 -13.8 -3.2 -8.4 -4.2 -5.6"     # trailing edge, curving in
        "C-4.6 -3.6 -3.4 -1.2 -1.6 0"         # to the notch
        "C-3.4 1.2 -4.6 3.6 -4.2 5.6"         # lower fluke trailing edge
        "C-3.2 8.4 -1.2 13.8 -.6 17.4"        # to the tip
        "C2.4 15.6 3.8 12.6 4.4 9"            # leading edge
        "C5.2 5 7.4 2.4 10 2"                 # back to the stock
        "C18 4.4 30 10.6 44 12.6"             # belly
        "C58 14.4 72 13.6 84 10.2"            # throat
        "C92 8 98.6 5.6 100 1.6Z")            # lower jaw to the snout
FIN = ("M76 8.4C70 14 60 22.6 48.6 29.4C46.6 30.6 45.2 29.4 46.2 27.6"
       "C52.4 19 60.4 12.4 69 7.4Z")          # long pectoral fin, swept back
FIN_SMALL = ("M68.6 10.6C65 14.4 60.4 18 55.4 20.8C54.2 21.4 53.4 20.6 54 19.6"
             "C57.4 15.8 60.8 12.6 63.8 10.2Z")   # a short fin tucked against the belly
FIN_MED = ("M69.4 10.4C64.8 15 58.4 19.8 51.6 23.6C50.2 24.4 49.2 23.4 50 22.2"
           "C54.6 17.2 59.6 13 63.8 9.8Z")   # medium fin, still tucked in
FIN_BACK = ("M69.6 10.2C64.6 15.4 57 22.6 47.2 28.8C45.2 30 43.8 28.8 44.8 27"
            "C50.4 19.8 56.6 14 62.8 9.8Z")   # the same fin set further back, behind the throat
FIN_FAR = "M70 -2C64 -8 56 -14 47.4 -17.6C46 -18.2 45 -17 46 -16C52 -11.6 58 -6.2 63 -1Z"
MOUTH_SHORT = "M99 3.4C96 4.4 92 4.8 88.4 4.4"   # a short, nearly straight jaw line
MOUTH = "M99.2 3.2C94 4.6 86.6 5 80.4 3.4C79.4 3.1 78.6 2.6 78 2"     # upturned at the corner: a smile
PLEATS = ["M94.6 6.8C88 8.6 81 9.4 74.6 9.2", "M90 9.6C84.4 11 78.6 11.8 73 11.8"]
EYE = (76.2, -0.6, 1.25)

def bend(d, R, mid=50):
    """Bend the flat whale along an arc of radius R (R>0 arches its back up; None = straight)."""
    if not R:
        return d
    def pt(m):
        x, y = float(m.group(1)), float(m.group(2))
        a = (x - mid) / R; r = R - y
        return f"{mid + r*math.sin(a):.2f} {R - r*math.cos(a):.2f}"
    return re.sub(r"(-?\d*\.?\d+)\s+(-?\d*\.?\d+)", pt, d)

def bent_xy(x, y, R, mid=50):
    if not R: return x, y
    a = (x - mid) / R; r = R - y
    return mid + r*math.sin(a), R - r*math.cos(a)

def whale(u, x, y, rot, s, R=None, far=False, pleats=True, mouth=True, eye_r=None, flip=False, fin=None, npleats=2, mouth_d=None, mouth_w=1.3, fin_gap=True, eye=True):
    FIN_D = fin or FIN
    b = lambda d: bend(d, R)
    ex, ey = bent_xy(EYE[0], EYE[1], R)
    cuts = f'<circle cx="{ex:.2f}" cy="{ey:.2f}" r="{(eye_r or EYE[2]):.2f}" fill="#000"/>' if eye else ''
    stroke = lambda d, w: f'<path d="{b(d)}" fill="none" stroke="#000" stroke-width="{w}" stroke-linecap="round"/>'
    if mouth: cuts += stroke(mouth_d or MOUTH, mouth_w)
    if pleats: cuts += "".join(stroke(p, .9) for p in PLEATS[:npleats])
    # The near fin is separated from the body by a thin cut so it reads as a fin, not a lump.
    fin_gap = f'<path d="{b(FIN_D)}" fill="none" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>' if fin_gap else ''
    sx = -s if flip else s
    return (f'<mask id="{u}m" maskUnits="userSpaceOnUse" x="-60" y="-60" width="220" height="220"><rect x="-60" y="-60" width="220" height="220" fill="#fff"/>{cuts}{fin_gap}</mask>'
            f'<g transform="translate({x} {y}) rotate({rot}) scale({sx} {s}) translate(-50 0)">'
            + (f'<path d="{b(FIN_FAR)}"/>' if far else "") +
            f'<path mask="url(#{u}m)" d="{b(BODY)}"/><path d="{b(FIN_D)}"/></g>')

def book(u, cuts=""):
    return l2.book(u, cuts)

POSES = {
  # Rising out of the book like the silhouette reference: tail low left, head up right.
  "rise": dict(w=dict(x=53, y=30, rot=-36, s=.5, R=140), drops=[(19.4, 49.6, 1.5), (15.6, 45, 1.2), (24.4, 52.4, 1.15), (12.4, 51.2, 1.0)], ring=(21, 61.6, 8.4)),
  # Arcing over the book like the orca: leaves the left page, curves toward the right one.
  "arc": dict(w=dict(x=50, y=30, rot=-4, s=.64, R=52), drops=[(12.4, 49.6, 1.45), (17.6, 53.2, 1.15), (8.4, 53.8, 1.0), (21.4, 48, 1.0)], ring=(16, 61.6, 7.2)),
  # Rising more steeply, almost a breach.
  "steep": dict(w=dict(x=53, y=29, rot=-52, s=.48, R=110), drops=[(25.4, 50.6, 1.5), (20.6, 47, 1.2), (31, 53, 1.15), (17.6, 52.4, 1.0)], ring=(27, 61.6, 8.4)),
  # The arc, a little gentler and smaller.
  "arc2": dict(w=dict(x=50, y=31, rot=-8, s=.58, R=70), drops=[(15.4, 49.4, 1.45), (20.6, 53, 1.15), (11.4, 53.6, 1.0), (24.6, 48.4, 1.0)], ring=(19, 61.6, 7.6)),
}
DROPS_D = [(18.4, 49, 1.45), (23.8, 51.4, 1.15), (14.2, 51.8, 1.0), (28.6, 49.6, 1.0)]
POSES.update({
  "d1": dict(w=dict(x=50, y=30.6, rot=-8, s=.62, R=70, fin=FIN_BACK, npleats=1), drops=DROPS_D, ring=(22, 61.4, 7.6)),
  "d2": dict(w=dict(x=50, y=30.6, rot=-8, s=.62, R=70, fin=FIN_BACK, pleats=False), drops=DROPS_D, ring=(22, 61.4, 7.6)),
})
# B, simplified: no pleats, the fin behind the throat, three drops, and the ripple right under the flukes.
BW = dict(x=55.4, y=31, rot=-4, s=.58, R=50, fin=FIN_BACK, pleats=False)
DB = [(22.4, 50.4, 1.35), (27.6, 52.6, 1.05), (18.6, 52.8, .95)]
POSES.update({
  "b1": dict(w=BW, drops=DB, ring=(23.4, 61.6, 7.4)),
  "b2": dict(w=BW, drops=DB, ring=(23.4, 61.6, 7.4), ring2=(76, 61.4, 5.2)),
  "b3": dict(w=BW, drops=DB[:2], ring=(23.4, 61.6, 7.4)),
})
# B, quieter: the fin, mouth and eye stop competing with the leap.
Q = dict(x=55.4, y=31, rot=-4, s=.58, R=50, pleats=False)
QP = dict(drops=DB, ring=(23.4, 61.6, 7.4))
POSES.update({
  "q1": dict(w=dict(Q, fin=FIN_SMALL, fin_gap=False, mouth_d=MOUTH_SHORT, mouth_w=.9, eye_r=.95), **QP),
  "q2": dict(w=dict(Q, fin=FIN_SMALL, fin_gap=False, mouth=False, eye_r=.95), **QP),
  "q4": dict(w=dict(Q, fin=FIN_MED, fin_gap=False, mouth=False, eye_r=.95), **QP),
  "q3": dict(w=dict(Q, fin=FIN_SMALL, fin_gap=False, mouth=False, eye=False), **QP),
})
# Q4 with a flatter arc.
POSES.update({
  "q4a": dict(w=dict(Q, fin=FIN_MED, fin_gap=False, mouth=False, eye_r=.95, R=72, y=31.6, rot=-6), **QP),
  "q4b": dict(w=dict(Q, fin=FIN_MED, fin_gap=False, mouth=False, eye_r=.95, R=96, y=32, rot=-8), **QP),
})
def mark(k, u):
    p = POSES[k]
    cuts = ring(*p["ring"], 1.6 if "ring_b" not in p else 1.1)
    if "ring2" in p: cuts += ring(*p["ring2"], 1.4)
    if "ring_b" in p: cuts += ring(*p["ring_b"], 2.1, back=.5)
    return whale(u, **p["w"]) + dots(p["drops"]) + book(u + "b", cuts)

if __name__ == "__main__":
    import sys
    n = [0]
    def svg(k, size, fill):
        n[0] += 1
        return f'<svg viewBox="0 0 96 96" width="{size}" height="{size}" style="fill:{fill};color:{fill}">{mark(k, f"{k}{n[0]}")}</svg>'
    flat = f'<svg viewBox="-10 -24 116 60" width="580" height="300" style="fill:#1F5640">{whale("flat", 50, 0, 0, 1)}</svg>'
    cards = f'<figure style="grid-column:1/-1"><b>The whale, flat</b>{flat}</figure>' + "".join(
        f'<figure><b>{k}</b>{svg(k,300,"#1F5640")}<div class="sz">{svg(k,48,"#14201B")}{svg(k,32,"#14201B")}{svg(k,16,"#14201B")}<span class="tile">{svg(k,44,"#FBFAF6")}</span></div></figure>' for k in POSES)
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "review.html"), "w").write('<!doctype html><meta charset="utf-8"><style>body{margin:12px;font:13px -apple-system,sans-serif;background:#FBFAF6;color:#14201B;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}figure{margin:0;background:#fff;border:1px solid #E6E3DA;border-radius:12px;padding:10px;display:grid;justify-items:center;gap:8px}.sz{display:flex;gap:10px;align-items:end}.tile{width:54px;height:54px;border-radius:13px;background:#1F5640;display:grid;place-items:center}</style>' + cards)
    print("ok")
