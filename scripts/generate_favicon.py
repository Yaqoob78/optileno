from PIL import Image, ImageDraw
import math

out_path = r"e:/ANNIHILATOR/PROJECTS/optileno/frontend/public/favicon.ico"

sizes = [16,32,48,64,128,256]

# Colors
start = (79,70,229)   # #4f46e5
end = (245,158,11)    # #f59e0b
accent = (14,165,233) # #0ea5e9

for size in sizes:
    im = Image.new('RGBA', (size, size), (0,0,0,0))
    px = im.load()
    cx = cy = size / 2.0
    maxd = math.hypot(cx, cy)
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            t = min(max(d / maxd, 0.0), 1.0)
            # blend start->accent->end by remapping t
            if t < 0.5:
                tt = t / 0.5
                r = int(start[0] * (1-tt) + accent[0] * tt)
                g = int(start[1] * (1-tt) + accent[1] * tt)
                b = int(start[2] * (1-tt) + accent[2] * tt)
            else:
                tt = (t-0.5) / 0.5
                r = int(accent[0] * (1-tt) + end[0] * tt)
                g = int(accent[1] * (1-tt) + end[1] * tt)
                b = int(accent[2] * (1-tt) + end[2] * tt)
            px[x,y] = (r,g,b,255)
    draw = ImageDraw.Draw(im)
    # draw an inner transparent circle to create ring effect
    ring_outer = size * 0.82
    ring_inner = size * 0.58
    bbox_outer = [ (size - ring_outer)/2, (size - ring_outer)/2, (size + ring_outer)/2, (size + ring_outer)/2 ]
    bbox_inner = [ (size - ring_inner)/2, (size - ring_inner)/2, (size + ring_inner)/2, (size + ring_inner)/2 ]
    # create mask by clearing inner circle to transparent (to make a ring)
    mask = Image.new('L', (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.ellipse(bbox_outer, fill=255)
    mdraw.ellipse(bbox_inner, fill=0)
    # apply mask to make ring
    ring = Image.new('RGBA', (size, size), (0,0,0,0))
    ring.paste(im, (0,0), mask)

    # compose final image: start with transparent, paste full gradient bg, then paste ring on top
    final = Image.new('RGBA', (size, size), (0,0,0,0))
    final.paste(im, (0,0))
    final.alpha_composite(ring)

    # draw simple white nodes scaled
    scale = size / 512.0
    nodes = [ (256,170,15), (190,236,13), (322,236,13), (172,310,11), (340,310,11), (256,350,15) ]
    for nx, ny, nr in nodes:
        x = int((nx/512.0) * size)
        y = int((ny/512.0) * size)
        r = max(1, int(nr * scale))
        draw.ellipse([x-r, y-r, x+r, y+r], fill=(255,255,255,255))

    # save each size as temporary PNG to be compiled into ICO later
    final.save(rf"e:/ANNIHILATOR/PROJECTS/optileno/frontend/public/favicon-{size}.png", format='PNG')

# compile into single ICO
imgs = [Image.open(rf"e:/ANNIHILATOR/PROJECTS/optileno/frontend/public/favicon-{s}.png") for s in sizes]
imgs[0].save(out_path, format='ICO', sizes=[(s,s) for s in sizes])
print('favicon.ico generated at', out_path)
