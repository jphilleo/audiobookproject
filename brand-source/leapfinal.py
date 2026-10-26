# Final review of the leaping whale: the brand-mock version, with the ripple moved under the tail where it left the water.
import sys, importlib.util
import os
S = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("m6", S + "/marks6.py"); m6 = importlib.util.module_from_spec(spec); spec.loader.exec_module(m6)
whale, drops, pages_path = m6.whale, m6.drops, m6.pages_path
def leap_book(uid, ring=None, top=58, bottom=80):
    """The Spark A hardcover, optionally with one ripple ring (cx, cy, rx, ry) cut into the pages."""
    P = pages_path(top, bottom)
    cb = bottom + 4.6
    C = (f"M6.6 {top+3}V{cb}C20 {cb-6.4} 36 {cb-6.4} 46 {cb}L48 {cb+2.2}L50 {cb}C60 {cb-6.4} 76 {cb-6.4} 89.4 {cb}V{top+3}Z")
    out = (f'<mask id="{uid}c"><rect width="96" height="96" fill="#fff"></rect><path d="{P}" fill="#000" stroke="#000" stroke-width="3.2" stroke-linejoin="round"></path></mask>'
           f'<path mask="url(#{uid}c)" d="{C}"></path>')
    if ring:
        cx, cy, rx, ry = ring
        out += (f'<mask id="{uid}p"><rect width="96" height="96" fill="#fff"></rect><ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="#000" stroke-width="1.5"></ellipse></mask>'
                f'<path mask="url(#{uid}p)" d="{P}"></path>')
    else:
        out += f'<path d="{P}"></path>'
    return out
W = lambda u: whale(u, 50, 25, -14, .82, eye=True, jaw=False)
def drops_r(pts):
    return "".join(f'<circle cx="{x}" cy="{y}" r="{r}"></circle>' for x, y, r in pts)
def drops_r(pts):
    return "".join(f'<circle cx="{x}" cy="{y}" r="{r}"></circle>' for x, y, r in pts)
DROPS1 = [(24.6, 42, 1.7), (21.4, 48, 1.6), (27.6, 48.6, 1.7), (18.8, 53.4, 1.2), (31.4, 53.6, 1.25), (36.4, 49.4, 1.1)]
DROPS2 = [(24.6, 42, 1.7), (21.4, 48, 1.6), (27.6, 48.6, 1.7), (17.4, 52.6, 1.2), (33, 52.8, 1.2), (14.6, 46.4, 1.0), (79, 40.4, 1.2)]
MARKS = {
  "a": ("A (before)", lambda u: W(u) + drops([(24.6, 42), (27.6, 48.6)], 1.7) + leap_book(u + "b", (27, 61.4, 6.4, 1.5))),
  "a1": ("1 · More drops, falling back in", lambda u: W(u) + drops_r(DROPS1) + leap_book(u + "b", (27, 61.4, 6.4, 1.5))),
  "a2": ("2 · More drops, flatter ripple", lambda u: W(u) + drops_r(DROPS1) + leap_book(u + "b", (26, 61.6, 7.4, 1.25))),
  "a3": ("3 · Wider spray, flatter ripple", lambda u: W(u) + drops_r(DROPS2) + leap_book(u + "b", (26, 61.6, 7.4, 1.25))),
}
