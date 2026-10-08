# Recadre une capture d'exercice : enlève les bandes grises latérales
# (flèches de navigation) et le blanc inutile sous le contenu.
import sys
from PIL import Image, ImageChops

BLANC = (255, 255, 255)
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGB')
    w, h = im.size
    px = im.load()
    y = h // 4
    g = next(x for x in range(w) if px[x, y] == BLANC)
    d = next(x for x in range(w - 1, 0, -1) if px[x, y] == BLANC)
    im = im.crop((g + 4, 0, d - 4, h))
    bas = ImageChops.difference(im, Image.new('RGB', im.size, BLANC)).getbbox()[3]
    im.crop((0, 0, im.size[0], min(im.size[1], bas + 40))).save(f)
