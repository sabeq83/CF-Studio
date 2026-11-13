"""Compose base clips + camera zoom + overlay frames + SFX into the final MP4."""
import json, subprocess, sys, os

R = os.path.dirname(os.path.abspath(__file__))
W2 = os.path.join(os.path.dirname(R), 'work2')
OUT = sys.argv[1]
meta = json.load(open(os.path.join(R, 'meta.json')))
clips, punches, dur = meta['clips'], meta['punches'], meta['dur']

def sh(cmd):
    print('+', ' '.join(cmd)[:200]); subprocess.run(cmd, check=True)

# --- SFX one-shots
sh(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
    "aevalsrc='0.55*sin(2*PI*(900*t-4111*t*t))*exp(-t*32)':s=44100:d=0.13", '-ac','2', os.path.join(R,'pop.wav')])
sh(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
    "aevalsrc='0.35*sin(2*PI*1500*t)*exp(-t*70)':s=44100:d=0.07", '-ac','2', os.path.join(R,'tick.wav')])
sh(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','anoisesrc=d=0.3:c=pink:a=0.5:r=44100',
    '-af','bandpass=f=1400:width_type=h:w=2200,afade=t=in:d=0.12,afade=t=out:st=0.12:d=0.18,volume=0.6','-ac','2', os.path.join(R,'whoosh.wav')])

# --- camera zoom expression Z(it)
zt = []
for i in range(len(clips)-1):
    a, b = clips[i], clips[i+1]
    zt.append(f"between(it,{a},{b}-0.0001)*0.045*(it-{a})/{b-a}")
for p in punches:
    zt.append(f"between(it-{p},0,0.12)*0.07*(1-pow(1-(it-{p})/0.12,3))")
    zt.append(f"gt(it-{p},0.12)*lt(it-{p},0.9)*0.07*exp(-(it-{p}-0.12)*3.2)")
Z = "1+" + "+".join(zt)
shake = "if(lt(it,0.35),-0.006*ih/zoom*sin(70*it),0)"

sfx = meta['sfx']
lines = []
lines.append(f"[0:v]fps=30,scale=2160:3840:flags=lanczos,zoompan=z='{Z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*0.45+{shake}':d=1:s=720x1280:fps=30,format=yuva420p[cam]")
lines.append("[1:v]format=rgba[ov]")
lines.append("[cam][ov]overlay=0:0:eof_action=pass:format=auto,format=yuv420p[vout]")
kinds = {'pop':2,'tick':3,'whoosh':4}
counts = {k: sum(1 for s in sfx if s['k']==k) for k in kinds}
for k, idx in kinds.items():
    n = counts[k]
    if n: lines.append(f"[{idx}:a]asplit={n}" + ''.join(f"[{k}{j}]" for j in range(n)))
used = {k:0 for k in kinds}; mix = []
for j, s in enumerate(sfx):
    k = s['k']; ms = max(0, int(round(s['t']*1000))); vol = {'pop':0.55,'tick':0.45,'whoosh':0.35}[k]
    lines.append(f"[{k}{used[k]}]adelay={ms}|{ms},volume={vol}[s{j}]"); used[k]+=1; mix.append(f"[s{j}]")
lines.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0,apad[sfxbus]")
lines.append("[0:a]aresample=44100,asplit=2[vo1][vo2]")
lines.append("[sfxbus][vo1]sidechaincompress=threshold=0.05:ratio=4:attack=5:release=200[sfxduck]")
lines.append(f"[vo2][sfxduck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.0:LRA=11,atrim=0:{dur}[aout]")
fg = os.path.join(R, 'filter.txt'); open(fg,'w').write(';\n'.join(lines))

sh(['ffmpeg','-hide_banner','-loglevel','error','-stats','-y',
    '-f','concat','-safe','0','-i', os.path.join(W2,'list.txt'),
    '-framerate','30','-i', os.path.join(R,'frames','f_%04d.png'),
    '-i', os.path.join(R,'pop.wav'), '-i', os.path.join(R,'tick.wav'), '-i', os.path.join(R,'whoosh.wav'),
    '-filter_complex_script', fg, '-map','[vout]','-map','[aout]',
    '-t', str(dur), '-c:v','libx264','-preset','slow','-crf','19','-profile:v','high','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','160k','-ar','44100','-movflags','+faststart', OUT])
print('OK', OUT)
