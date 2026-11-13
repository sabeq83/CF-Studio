"""Build a caption-free base video + timing JSON from a ContentFlow bundle folder.
usage: build_base.py <bundle_dir> <out_mp4> <out_json> <before_src_or_-> <out_before_mp4>
"""
import sys, os, re, json, subprocess, glob, tempfile

bundle, out_mp4, out_json, before_src, out_before = sys.argv[1:6]

def probe(p):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).decode().strip())

files = [f for f in glob.glob(os.path.join(bundle,'**','*'), recursive=True) if os.path.isfile(f)]
num = lambda f: int(re.findall(r'(\d+)\.(?:mp3|mp4)$', os.path.basename(f))[0])
vids = sorted([f for f in files if re.search(r'(video_clip_\d+|scene_c\d+)\.mp4$', f)], key=num)
auds = sorted([f for f in files if re.search(r'(audio_clip_\d+|vo_c\d+)\.mp3$', f)], key=num)
assert len(vids) == len(auds) and vids, (len(vids), len(auds))

# VO text
nask = [f for f in files if f.endswith('naskah.md')]
texts = []
if nask:
    s = open(sorted(nask, key=len)[-1], encoding='utf-8').read()
    texts = re.findall(r'\*\*Voiceover Narration:\*\* "([^"]*)"', s)
    if not texts and 'Voiceover Script' in s:
        part = s.split('Voiceover Script', 1)[1]
        texts = [l[2:].strip() for l in part.splitlines() if l.startswith('> ')]
clean = lambda t: re.sub(r'\s{2,}', ' ', re.sub(r'\((?:sighs?|breath|laughs?|chuckles?)\)|<#[^#]*#>', ' ', t)).strip()
texts = [clean(t) for t in texts][:len(vids)]
assert len(texts) == len(vids), (len(texts), len(vids))

tmp = tempfile.mkdtemp()
segs, durs = [], []
for i, (v, a) in enumerate(zip(vids, auds)):
    ad, vd = probe(a), probe(v)
    d = round(ad + 0.25, 3)
    vf = f"setpts={d/vd:.5f}*PTS," if vd < d else ""
    o = os.path.join(tmp, f's{i}.mov')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',v,'-i',a,'-filter_complex',
        f'[0:v]{vf}fps=30,scale=720:1280,format=yuv420p[v];[1:a]aresample=44100,aformat=channel_layouts=stereo,apad[a]',
        '-map','[v]','-map','[a]','-t',str(d),'-c:v','libx264','-crf','16','-preset','fast','-c:a','pcm_s16le',o], check=True)
    durs.append(d)
    log = subprocess.run(['ffmpeg','-hide_banner','-i',a,'-af','silencedetect=noise=-38dB:d=0.12','-f','null','-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    # speech intervals = complement of silences
    sil = list(zip(st, en + [ad]*(len(st)-len(en))))
    speech, cur = [], 0.0
    for s0, e0 in sil:
        if s0 - cur > 0.05: speech.append([cur, s0])
        cur = e0
    if ad - cur > 0.05: speech.append([cur, ad])
    # one segment per clip; words are spread over speaking time only (pauses skipped)
    segs.append({'c': i, 'sp': [[round(s0,3), round(e0,3)] for s0, e0 in speech], 'text': texts[i],
                 'audio': os.path.basename(a), 'video': os.path.basename(v)})

lst = os.path.join(tmp, 'list.txt')
open(lst,'w').write(''.join(f"file 's{i}.mov'\n" for i in range(len(vids))))
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',lst,
    '-af','loudnorm=I=-14:TP=-1.0:LRA=11','-c:v','libx264','-crf','26','-preset','slow','-movflags','+faststart',
    '-c:a','aac','-b:a','128k','-ar','44100',out_mp4], check=True)
if before_src != '-':
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',before_src,'-vf','scale=540:-2',
        '-c:v','libx264','-crf','30','-preset','slow','-movflags','+faststart','-c:a','aac','-b:a','96k',out_before], check=True)
json.dump({'durs': durs, 'dur': round(sum(durs),3), 'segs': segs}, open(out_json,'w'), ensure_ascii=False, indent=1)
print('OK', out_mp4, round(sum(durs),2), 's', len(vids), 'clips')
