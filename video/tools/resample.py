# resample irregular slowed captures to a 30fps PNG sequence, then encode mp4
import json,sys,os,shutil,subprocess,bisect
d,out,fps=sys.argv[1],sys.argv[2],30
m=json.load(open(d+'/stamps.json'));st=m['stamps']
T=st[-1];n=int(T/1000*fps)+1;tmp=d+'_rs';shutil.rmtree(tmp,ignore_errors=True);os.makedirs(tmp)
for k in range(n):
    t=k*1000/fps;j=bisect.bisect_left(st,t)
    if j>0 and (j==len(st) or abs(st[j-1]-t)<=abs(st[j]-t)): j-=1
    os.link(f'{d}/f{j:05d}.png',f'{tmp}/r{k:05d}.png')
subprocess.run(['ffmpeg','-v','error','-y','-framerate','30','-i',f'{tmp}/r%05d.png','-c:v','libx264','-preset','slow','-crf','14','-pix_fmt','yuv420p',out],check=True)
gaps=max(b-a for a,b in zip(st,st[1:]))
print(os.path.basename(out),n,'frames, max gap',round(gaps,1),'ms')
