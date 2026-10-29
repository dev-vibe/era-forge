# snap_pos.py [--game <id>]: for each (scene, name, x, y) report whether the spot is standable and the nearest standable point (painting px)
import json,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import gamepaths; gamepaths.use_game()   # job fw-F5a: `--game <id>` reads that game's assets/game
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
POS=json.load(open(sys.argv[1]))
cache={}
def mask(sid):
    if sid in cache: return cache[sid]
    s=json.load(open(f'assets/game/{sid}.scene.json')); iw,ih=s['iw'],s['ih']
    k=(s['tiles'][0]*32/iw) if s.get('tiles') else 640/iw; hk=s.get('heroK',1)
    m=Image.new('L',(iw,ih),0); d=ImageDraw.Draw(m)
    for p in s['walk']: d.polygon([tuple(q) for q in p],fill=255)
    for p in s.get('nowalk',[]): d.polygon([tuple(q) for q in p],fill=0)
    for r in s.get('block',[]): d.rectangle(r,fill=0)
    a=np.array(m)>0
    # standable = 6 logical px of room in every direction (feet + a little), converted to painting px
    rad=int(round(6*hk/k)); ok=ndimage.binary_erosion(a,structure=np.ones((3,3)),iterations=rad)
    cache[sid]=(ok,k,hk); return cache[sid]
out={}
for sid,items in POS.items():
    ok,k,hk=mask(sid); ys,xs=np.nonzero(ok)
    for name,(x,y) in items.items():
        good=0<=x<ok.shape[1] and 0<=y<ok.shape[0] and ok[int(y),int(x)]
        if good: out.setdefault(sid,{})[name]=[x,y]; print(f'{sid:22s} {name:12s} ok    [{x},{y}]'); continue
        i=np.argmin((xs-x)**2+(ys-y)**2); nx,ny=int(xs[i]),int(ys[i]); dist=((nx-x)**2+(ny-y)**2)**.5
        out.setdefault(sid,{})[name]=[nx,ny]; print(f'{sid:22s} {name:12s} MOVED [{x},{y}] -> [{nx},{ny}] ({dist:.0f} px)')
json.dump(out,open(sys.argv[2],'w'))
