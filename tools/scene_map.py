# scene_map.py [--game <id>] <id> [out_w] [grid] [crop x0 y0 x1 y1]: the painting with walkable ground (green), things (orange), doors (cyan), exits (yellow) and a labelled grid in painting px
import json,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import gamepaths; gamepaths.use_game()   # job fw-F5a: `--game <id>` maps that game's scene (assets/game, shots/ of its folder)
from PIL import Image, ImageDraw, ImageFont
sid=sys.argv[1]; OW=int(sys.argv[2]) if len(sys.argv)>2 else 1000; GR=int(sys.argv[3]) if len(sys.argv)>3 else 200
s=json.load(open(f'assets/game/{sid}.scene.json')); im=Image.open(f"assets/game/{s['img']}.webp").convert('RGBA')
k=im.width/s['iw']; ov=Image.new('RGBA',im.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
for p in s['walk']: d.polygon([(x*k,y*k) for x,y in p],fill=(0,255,80,60))
for p in s.get('nowalk',[]): d.polygon([(x*k,y*k) for x,y in p],fill=(255,0,0,60))
for r in s.get('block',[]): d.rectangle([c*k for c in r],fill=(255,0,0,60))
for t in s.get('things',[]): d.rectangle([c*k for c in t['r']],outline=(255,140,0,255),width=2)
for t in s.get('doors',[]): d.rectangle([c*k for c in t['r']],outline=(0,220,255,255),width=3)
for t in s.get('exits',[]): d.rectangle([c*k for c in t['r']],outline=(255,255,0,255),width=3)
im=Image.alpha_composite(im,ov)
if len(sys.argv)>7:
  x0,y0,x1,y1=map(int,sys.argv[4:8]); im=im.crop((int(x0*k),int(y0*k),int(x1*k),int(y1*k))); ox,oy=x0,y0
else: ox,oy=0,0
sc=OW/im.width; im=im.resize((OW,int(im.height*sc))); d=ImageDraw.Draw(im); f=ImageFont.load_default()
ps=sc*k
for gx in range((ox//GR)*GR,ox+int(im.width/ps)+GR,GR):
  X=(gx-ox)*ps
  if 0<=X<OW: d.line([(X,0),(X,im.height)],fill=(255,255,255,90)); d.text((X+2,2),str(gx),fill=(255,255,255),font=f)
for gy in range((oy//GR)*GR,oy+int(im.height/ps)+GR,GR):
  Y=(gy-oy)*ps
  if 0<=Y<im.height: d.line([(0,Y),(OW,Y)],fill=(255,255,255,90)); d.text((2,Y+2),str(gy),fill=(255,255,255),font=f)
im.convert('RGB').save(f'shots/map_{sid}.png'); print('shots/map_'+sid+'.png', s['iw'], s['ih'], 'start', s['start'])
