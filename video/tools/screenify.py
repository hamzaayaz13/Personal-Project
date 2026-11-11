# make a phone-screen PNG: rounded corners (alpha), dynamic island, status bar
import sys
from PIL import Image, ImageDraw, ImageFont
src,dst=sys.argv[1],sys.argv[2]
im=Image.open(src).convert('RGBA').resize((860,1864))
W,H=im.size; r=110
d=ImageDraw.Draw(im)
# status bar: time + battery, drawn over the top (screens leave ~56px free)
try: f=ImageFont.truetype('/tmp/claude-0/-home-user-Personal-Project/5e1b993e-c3dd-5e20-97fe-a9d8c649aaff/scratchpad/v5/media/fonts/figtree-700.ttf',34)
except: f=None
dark = sum(im.getpixel((60,40))[:3])<300
col=(255,255,255,255) if dark else (20,20,20,255)
d.text((92,30),'9:41',font=f,fill=col)
d.rounded_rectangle((W-140,38,W-86,62),radius=8,outline=col,width=3); d.rectangle((W-134,44,W-98,56),fill=col); d.rectangle((W-84,46,W-80,54),fill=col)
for i,h in enumerate([10,15,20,25]): d.rectangle((W-232+i*11,62-h,W-224+i*11,62),fill=col)
d.rounded_rectangle((W//2-125,22,W//2+125,94),radius=36,fill=(0,0,0,255))
mask=Image.new('L',(W,H),0); ImageDraw.Draw(mask).rounded_rectangle((0,0,W-1,H-1),radius=r,fill=255)
im.putalpha(mask); im.save(dst)
