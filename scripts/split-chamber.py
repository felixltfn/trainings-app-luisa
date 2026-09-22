# Split the island into N pieces that follow the image's own edges (SLIC + region merging)
import sys, json, random
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

N = int(sys.argv[1]) if len(sys.argv) > 1 else 84
SIZE = 1024
img = Image.open('isle_cut.png').convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS)
rgba = np.asarray(img).astype(np.float64)
alpha = rgba[..., 3]
mask = alpha > 40

def to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

lab = to_lab(rgba[..., :3])
H, W = mask.shape
K = 900
S = int(np.sqrt(mask.sum() / K))
ys, xs = np.mgrid[S // 2:H:S, S // 2:W:S]
seeds = [(y, x) for y, x in zip(ys.ravel(), xs.ravel()) if mask[y, x]]
C = np.array([[lab[y, x, 0], lab[y, x, 1], lab[y, x, 2], y, x] for y, x in seeds], dtype=np.float64)
m = 12.0
labels = -np.ones((H, W), int)
for it in range(8):
    dist = np.full((H, W), np.inf)
    for k, (L, A, B, cy, cx) in enumerate(C):
        y0, y1 = int(max(cy - 2 * S, 0)), int(min(cy + 2 * S, H))
        x0, x1 = int(max(cx - 2 * S, 0)), int(min(cx + 2 * S, W))
        yy, xx = np.mgrid[y0:y1, x0:x1]
        dc = ((lab[y0:y1, x0:x1] - [L, A, B]) ** 2).sum(-1)
        ds = (yy - cy) ** 2 + (xx - cx) ** 2
        d = dc + (m / S) ** 2 * ds
        win = dist[y0:y1, x0:x1]
        better = (d < win) & mask[y0:y1, x0:x1]
        win[better] = d[better]
        labels[y0:y1, x0:x1][better] = k
    for k in range(len(C)):
        sel = labels == k
        if sel.any():
            yy, xx = np.nonzero(sel)
            C[k] = [*lab[sel].mean(0), yy.mean(), xx.mean()]

# Connected pieces only; tiny fragments join a neighbour
lab_cc = np.zeros((H, W), int)
nid = 0
for k in np.unique(labels[labels >= 0]):
    cc, n = ndi.label(labels == k)
    for j in range(1, n + 1):
        nid += 1
        lab_cc[cc == j] = nid
labels = lab_cc

def stats(labels):
    ids = np.unique(labels[labels > 0])
    return ids

# Region merging: always take the smallest region, join it to its most similar neighbour
area = {i: int((labels == i).sum()) for i in np.unique(labels[labels > 0])}
mean = {i: lab[labels == i].mean(0) for i in area}
def neighbours(i):
    reg = labels == i
    ring = ndi.binary_dilation(reg, iterations=1) & ~reg
    return set(np.unique(labels[ring])) - {0}
target_min = mask.sum() / N * 0.35
while len(area) > N:
    i = min(area, key=area.get)
    nb = neighbours(i)
    if not nb:
        labels[labels == i] = 0; del area[i]; del mean[i]; continue
    # colour similarity, but prefer not to grow already large pieces
    j = min(nb, key=lambda j: np.linalg.norm(mean[i] - mean[j]) * (1 + area[j] / (mask.sum() / N)))
    labels[labels == i] = j
    mean[j] = (mean[j] * area[j] + mean[i] * area[i]) / (area[j] + area[i])
    area[j] += area.pop(i); del mean[i]

# Reveal order: random, seeded, but spread out (next piece far from the last few)
ids = list(area)
cent = {i: np.array(ndi.center_of_mass(labels == i)) for i in ids}
rng = random.Random(7)
order = [rng.choice(ids)]
rest = [i for i in ids if i != order[0]]
while rest:
    recent = order[-6:]
    rng.shuffle(rest)
    cand = rest[:12]
    best = max(cand, key=lambda i: min(np.linalg.norm(cent[i] - cent[r]) for r in recent))
    order.append(best); rest.remove(best)
out = np.zeros((H, W), np.uint8)
for n, i in enumerate(order, 1):
    out[labels == i] = n
Image.fromarray(out, 'L').save('chamber_pieces.png', optimize=True)
print('pieces', len(order), 'area range', min(area.values()), max(area.values()))
