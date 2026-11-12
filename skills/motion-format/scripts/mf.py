#!/usr/bin/env python3
"""Motion Format · alat kerja proyek video (satu file, tanpa Node, tanpa pip).

Butuh: Python 3.8+, Google Chrome (atau Edge/Chromium/Brave), dan ffmpeg (untuk lembar cek & MP4).

  python3 mf.py baru <proyek> [--rasio 9:16|16:9|1:1] [--dasar 2d|3d|<id-gaya>] [--judul "..."]
  python3 mf.py rakit <proyek>                    scene.html + mesin -> index.html
  python3 mf.py potret <proyek> [--t 0.3,1.5,4] [--n 9] [--q v=noir]   foto beberapa detik + lembar.jpg + cek error
  python3 mf.py kata <proyek>                     waktu tiap kata VO -> kata.js (untuk subtitle)
  python3 mf.py render <proyek> [--sampai 8] [--fps 30] [--tanpa-audio] [--out nama.mp4]
  python3 mf.py cadangan <proyek> ["catatan"]     simpan versi sekarang ke .riwayat/
  python3 mf.py riwayat <proyek>                  daftar versi tersimpan
  python3 mf.py pulihkan <proyek> [nomor]         kembalikan versi (default: versi sebelum terakhir)

Env opsional: CHROME=/path/chrome, FFMPEG=/path/ffmpeg, MF_PORT=9333.
"""
import argparse, base64, datetime, json, os, pathlib, platform, re, shutil, socket, struct, subprocess, sys, tempfile, time, urllib.request

SKILL = pathlib.Path(__file__).resolve().parent.parent
MESIN = SKILL / 'assets' / 'mesin'
GAYA = SKILL / 'assets' / 'gaya'
RASIO = {'9:16': (1080, 1920), '16:9': (1920, 1080), '1:1': (1080, 1080), '4:5': (1080, 1350)}
PORT = int(os.environ.get('MF_PORT', '9333'))


# ---------------------------------------------------------------- alat bantu
def cari_chrome():
    env = os.environ.get('CHROME')
    if env and os.path.exists(env):
        return env
    s = platform.system()
    cands = []
    if s == 'Darwin':
        cands = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                 '/Applications/Chromium.app/Contents/MacOS/Chromium',
                 '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                 '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser']
    elif s == 'Windows':
        for base in [os.environ.get('PROGRAMFILES', r'C:\Program Files'), os.environ.get('PROGRAMFILES(X86)', r'C:\Program Files (x86)'),
                     os.environ.get('LOCALAPPDATA', '')]:
            cands += [os.path.join(base, r'Google\Chrome\Application\chrome.exe'),
                      os.path.join(base, r'Microsoft\Edge\Application\msedge.exe')]
    for c in cands:
        if c and os.path.exists(c):
            return c
    for n in ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'msedge']:
        p = shutil.which(n)
        if p:
            return p
    sys.exit('Chrome tidak ditemukan. Pasang Google Chrome, atau set env CHROME=/path/ke/chrome.')


def cari_ffmpeg(wajib=True):
    env = os.environ.get('FFMPEG')
    if env and os.path.exists(env):
        return env
    for p in [shutil.which('ffmpeg'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']:
        if p and os.path.exists(p):
            return p
    if wajib:
        sys.exit('ffmpeg tidak ditemukan. Mac: "brew install ffmpeg" · Windows: "winget install Gyan.FFmpeg" · lalu ulangi.')
    return None


def proyek_dari(arg):
    p = pathlib.Path(arg).expanduser().resolve()
    if not p.is_dir():
        sys.exit(f'Folder proyek tidak ada: {p}')
    return p


# ---------------------------------------------------------------- websocket CDP minimal
class WS:
    def __init__(self, url):
        host, rest = url[len('ws://'):].split('/', 1)
        h, p = host.split(':')
        self.s = socket.create_connection((h, int(p)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET /{rest} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                        f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.s.recv(4096)
        self.buf = buf.split(b'\r\n\r\n', 1)[1]
        self.id = 0

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.s.recv(1 << 20)
            if not chunk:
                raise ConnectionError('koneksi ke Chrome terputus')
            self.buf += chunk
        d, self.buf = self.buf[:n], self.buf[n:]
        return d

    def send(self, text):
        data = text.encode()
        hdr = bytearray([0x81])
        n = len(data)
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126); hdr += struct.pack('>H', n)
        else:
            hdr.append(0x80 | 127); hdr += struct.pack('>Q', n)
        mask = os.urandom(4)
        self.s.sendall(bytes(hdr) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self):
        msg = b''
        while True:
            b1, b2 = self._read(2)
            n = b2 & 0x7f
            if n == 126:
                n = struct.unpack('>H', self._read(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._read(8))[0]
            payload = self._read(n)
            if (b1 & 0x0f) in (0x0, 0x1, 0x2):
                msg += payload
                if b1 & 0x80:
                    return msg.decode()

    def call(self, method, **params):
        self.id += 1
        mid = self.id
        self.send(json.dumps({'id': mid, 'method': method, 'params': params}))
        while True:
            m = json.loads(self.recv())
            if m.get('id') == mid:
                if 'error' in m:
                    raise RuntimeError(m['error'])
                return m.get('result', {})


class Halaman:
    """Satu sesi Chrome headless yang membuka index.html proyek."""

    def __init__(self, html, kueri=''):
        self.prof = tempfile.mkdtemp(prefix='mf-chrome-')
        self.proc = subprocess.Popen([cari_chrome(), '--headless=new', f'--remote-debugging-port={PORT}', f'--user-data-dir={self.prof}',
                                      '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files',
                                      '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--enable-webgl',
                                      '--ignore-gpu-blocklist', '--use-angle=default', 'about:blank'],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            page = None
            for _ in range(150):
                try:
                    tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json'))
                    page = next(t for t in tabs if t.get('type') == 'page')
                    break
                except Exception:
                    time.sleep(.2)
            if not page:
                raise SystemExit(f'Chrome tidak merespons di port {PORT}. Tutup proses Chrome headless lain, atau set MF_PORT=9444.')
            self.ws = WS(page['webSocketDebuggerUrl'])
            self.ws.call('Page.enable')
            self.ws.call('Runtime.enable')
            self.ws.call('Emulation.setDeviceMetricsOverride', width=1080, height=1920, deviceScaleFactor=1, mobile=False)
            self.ws.call('Page.navigate', url=pathlib.Path(html).resolve().as_uri() + '?clean=1' + ('&' + kueri if kueri else ''))
            for n_ in range(900):
                if n_ > 40 and n_ % 10 == 0 and self.js('(window.__errs||[]).length'):
                    break                                   # ada error JS: jangan menunggu 90 dtk
                if self.js('!!((window.MF||window.OPENER) && (window.MF||window.OPENER).ready && (!(window.MF||window.OPENER).clipsReady || (window.MF||window.OPENER).clipsReady()))'):
                    break
                time.sleep(.1)
            else:
                errs = self.js('JSON.stringify(window.__errs||[])') or '[]'
                raise SystemExit('Halaman tidak pernah siap (window.MF.ready). Error di halaman: ' + errs)
            self.js('window.__O = window.MF || window.OPENER; document.fonts.ready.then(()=>1)')
            self.info = json.loads(self.js('JSON.stringify({d:__O.DURATION,w:__O.W||1920,h:__O.H||1080,a:window.AUDIO_PLAN||null})'))
            self.W, self.H = int(self.info['w']), int(self.info['h'])
            self.ws.call('Emulation.setDeviceMetricsOverride', width=self.W, height=self.H, deviceScaleFactor=1, mobile=False)
            time.sleep(.5)
        except BaseException:
            self.tutup()
            raise

    def js(self, expr):
        r = self.ws.call('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True)
        if r.get('exceptionDetails'):
            raise RuntimeError('error di halaman: ' + json.dumps(r['exceptionDetails'])[:500])
        return r.get('result', {}).get('value')

    def ke(self, t):
        self.js('(async()=>{const O=window.__O;await (O.seekFrame?O.seekFrame(%.5f):O.seek(%.5f));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return 1})()' % (t, t))

    def foto(self, kualitas=92):
        shot = self.ws.call('Page.captureScreenshot', format='jpeg', quality=kualitas,
                            clip={'x': 0, 'y': 0, 'width': self.W, 'height': self.H, 'scale': 1})
        return base64.b64decode(shot['data'])

    def errors(self):
        return json.loads(self.js('JSON.stringify(window.__errs||[])') or '[]')

    def tutup(self):
        try:
            self.proc.terminate()
            self.proc.wait(timeout=5)
        except Exception:
            pass
        shutil.rmtree(self.prof, ignore_errors=True)


# ---------------------------------------------------------------- baru & rakit
def cmd_baru(a):
    p = pathlib.Path(a.proyek).expanduser().resolve()
    if (p / 'scene.html').exists():
        sys.exit(f'{p}/scene.html sudah ada. Pakai folder lain, atau hapus dulu bila memang mau mulai ulang.')
    dasar = a.dasar
    src = GAYA / dasar / 'scene.html' if (GAYA / dasar / 'scene.html').exists() else MESIN / f'contoh-{dasar}.html'
    if not src.exists():
        ada = sorted([d.name for d in GAYA.iterdir() if (d / 'scene.html').exists()]) if GAYA.exists() else []
        sys.exit(f'Dasar "{dasar}" tidak ada. Pilihan: 2d, 3d, {", ".join(ada)}')
    (p / 'assets' / 'audio').mkdir(parents=True, exist_ok=True)
    (p / 'assets' / 'gambar').mkdir(parents=True, exist_ok=True)
    s = src.read_text(encoding='utf-8')
    s = re.sub(r'<!--@RASIO [^>]*-->', f'<!--@RASIO {a.rasio}-->', s) if '<!--@RASIO' in s else f'<!--@RASIO {a.rasio}-->\n' + s
    if a.judul:
        s = re.sub(r'<!--@TITLE .*?-->', f'<!--@TITLE {a.judul}-->', s)
    (p / 'scene.html').write_text(s, encoding='utf-8')
    if src.parent != MESIN:                      # file pendamping gaya (mis. data peta) ikut disalin
        for f in src.parent.iterdir():
            if f.is_file() and f.name != 'scene.html' and not f.name.startswith('.'):
                shutil.copy2(f, p / f.name)
    if not (p / 'naskah.md').exists():
        (p / 'naskah.md').write_text('# Naskah\n\n| # | Adegan (yang terlihat) | Kalimat VO | Durasi |\n|---|---|---|---|\n| 1 |  |  |  |\n',
                                     encoding='utf-8')
    rakit(p)
    print(f'proyek dibuat: {p}\n  scene.html dari {src.relative_to(SKILL)} · rasio {a.rasio}\n  buka index.html di browser untuk melihat.')


def rakit(p):
    if not (p / 'scene.html').exists():
        if (p / 'index.html').exists():
            return p / 'index.html'          # proyek tanpa scene.html (mis. Paket Template): pakai index.html apa adanya
        sys.exit(f'Tidak ada scene.html atau index.html di {p}')
    src = (p / 'scene.html').read_text(encoding='utf-8')
    for tanda in ['<!--@HEAD-->', '<!--@BODY-->', '<!--@SCRIPT-->']:
        if tanda not in src:
            sys.exit(f'scene.html tidak punya penanda {tanda}.')
    m = re.search(r'<!--@TITLE (.*?)-->', src)
    judul = m.group(1) if m else p.name
    m = re.search(r'<!--@RASIO\s*([0-9]+:[0-9]+)\s*-->', src)
    rasio = m.group(1) if m else '9:16'
    if rasio not in RASIO:
        sys.exit(f'Rasio {rasio} tidak dikenal. Pilihan: {", ".join(RASIO)}')
    w, h = RASIO[rasio]
    # potong di kemunculan PERTAMA tiap penanda, berurutan (penanda yang tertulis di dalam komentar kemudian tidak memotong)
    i_h = src.index('<!--@HEAD-->'); i_b = src.index('<!--@BODY-->', i_h); i_s = src.index('<!--@SCRIPT-->', i_b)
    head = src[i_h + len('<!--@HEAD-->'):i_b].strip()
    body = src[i_b + len('<!--@BODY-->'):i_s].strip()
    script = src[i_s + len('<!--@SCRIPT-->'):].strip()
    core = (MESIN / 'core.html').read_text(encoding='utf-8')
    out = (core.replace('{{TITLE}}', judul).replace('{{RASIO}}', rasio).replace('{{W}}', str(w)).replace('{{H}}', str(h))
           .replace('{{HEAD}}', head).replace('{{BODY}}', body).replace('{{SCRIPT}}', script))
    (p / 'index.html').write_text(out, encoding='utf-8')
    return p / 'index.html'


def cmd_rakit(a):
    p = proyek_dari(a.proyek)
    print('dirakit ->', rakit(p))


# ---------------------------------------------------------------- potret & lembar cek
def cmd_potret(a):
    p = proyek_dari(a.proyek)
    html = rakit(p)
    hal = Halaman(html, a.q)
    try:
        dur = float(hal.info['d'])
        if a.t:
            ts = [float(x) for x in a.t.split(',') if x.strip()]
        else:
            n = max(2, a.n)
            ts = sorted(set([0.3, 1.5] + [round(dur * (i + .5) / n, 2) for i in range(n)]))
        ts = [min(max(0, t), dur - .01) for t in ts]
        out = p / '.potret'
        shutil.rmtree(out, ignore_errors=True)
        out.mkdir()
        files = []
        for i, t in enumerate(ts):
            hal.ke(t)
            f = out / f'{i:02d}.jpg'   # urutan = daftar "detik" yang dicetak di bawah
            f.write_bytes(hal.foto())
            files.append(f)
        errs = hal.errors()
    finally:
        hal.tutup()
    ff = cari_ffmpeg(wajib=False)
    lembar = p / 'lembar.jpg'
    if ff:
        kol = 4 if hal.H > hal.W else 3
        bar = -(-len(files) // kol)
        lw = 270 if hal.H > hal.W else 480
        lembar.unlink(missing_ok=True)
        subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', '1', '-i', str(out / '%02d.jpg'),
                        '-vf', f'scale={lw}:-2,tile={kol}x{bar}:padding=6:color=0x222222', '-frames:v', '1', str(lembar)], check=False)
    print(f'durasi {dur:.2f} dtk · {hal.W}×{hal.H} · {len(files)} potret di {out}')
    print('detik:', ', '.join(f'{t:g}' for t in ts))
    if lembar.exists():
        print('lembar cek ->', lembar)
    print('error halaman:', 'tidak ada' if not errs else '\n  ' + '\n  '.join(errs))
    if errs:
        sys.exit(1)


# ---------------------------------------------------------------- waktu kata (subtitle)
def durasi_audio(ff, path):
    r = subprocess.run([ff, '-i', str(path), '-f', 'null', '-'], capture_output=True, text=True)
    m = re.findall(r'time=(\d+):(\d+):([\d.]+)', r.stderr)
    if not m:
        return 0.0
    h, mi, s = m[-1]
    return int(h) * 3600 + int(mi) * 60 + float(s)


def bagian_bicara(ff, path, total):
    """Rentang [mulai, akhir] berisi suara (membuang hening di awal/akhir) + daftar jeda di tengah."""
    r = subprocess.run([ff, '-i', str(path), '-af', 'silencedetect=n=-38dB:d=0.18', '-f', 'null', '-'], capture_output=True, text=True)
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    hening = list(zip(st, en + [total] * (len(st) - len(en))))
    mulai, akhir = 0.0, total
    tengah = []
    for a, b in hening:
        if a <= 0.05:
            mulai = b
        elif b >= total - 0.05:
            akhir = a
        else:
            tengah.append((a, b))
    return mulai, akhir, tengah


def bobot(w):
    inti = re.sub(r'[^\wÀ-ÿ]', '', w)
    suku = max(1, len(re.findall(r'[aiueoAIUEO]+', inti)))
    if re.search(r'\d', inti):
        suku = max(suku, len(inti) * 1.6)
    return suku + (0.6 if re.search(r'[.,!?;:…]$', w) else 0)


def cmd_kata(a):
    p = proyek_dari(a.proyek)
    ff = cari_ffmpeg()
    html = rakit(p)
    hal = Halaman(html)
    try:
        plan = hal.info.get('a') or {}
    finally:
        hal.tutup()
    vo = plan.get('vo') or []
    if not vo:
        sys.exit('AUDIO_PLAN.vo kosong. Isi SCENE.audio.vo dengan {src, at, teks} dulu.')
    semua = []
    for v in vo:
        teks = (v.get('teks') or '').strip()
        if not teks:
            print(f'  ! {v["src"]} tidak punya "teks", dilewati (subtitle butuh teks VO).')
            continue
        f = p / v['src']
        tot = durasi_audio(ff, f)
        mulai, akhir, jeda = bagian_bicara(ff, f, tot)
        kata = teks.split()
        at = float(v.get('at', 0))
        # segmen bicara (dipisah jeda di tengah klip)
        segmen, cur = [], mulai
        for a0, b0 in jeda:
            segmen.append((cur, a0)); cur = b0
        segmen.append((cur, akhir))
        bt = [bobot(w) for w in kata]
        tot_b = sum(bt)
        # tiap jeda dipasangkan ke batas kata terdekat (utamakan setelah tanda baca)
        kum = [sum(bt[:i + 1]) / tot_b for i in range(len(kata))]
        bicara = sum(b - a for a, b in segmen)
        batas, pakai, f = [], -1, 0.0
        for a0, b0 in segmen[:-1]:
            f += (b0 - a0) / bicara
            calon = [i for i in range(pakai + 1, len(kata) - 1)]
            if not calon:
                break
            skor = lambda i: abs(kum[i] - f) - (0.08 if re.search(r'[.,!?;:…]$', kata[i]) else 0)
            i = min(calon, key=skor)
            batas.append(i); pakai = i
        grup, mulai_i = [], 0
        for i in batas:
            grup.append(list(range(mulai_i, i + 1))); mulai_i = i + 1
        grup.append(list(range(mulai_i, len(kata))))
        if len(grup) < len(segmen):        # kata lebih sedikit dari segmen: gabung segmen sisa ke yang terakhir
            segmen = segmen[:len(grup) - 1] + [(segmen[len(grup) - 1][0], segmen[-1][1])]
        for g, (a0, b0) in zip(grup, segmen):
            jb = sum(bt[i] for i in g) or 1
            acc = 0.0
            for i in g:
                t0 = a0 + acc / jb * (b0 - a0)
                acc += bt[i]
                t1 = a0 + acc / jb * (b0 - a0)
                semua.append({'w': kata[i], 't0': round(at + t0, 3), 't1': round(at + t1 - 0.001, 3)})
    (p / 'kata.js').write_text('/* dibuat mf.py kata: perkiraan waktu kata VO (±0,15 dtk). Boleh dikoreksi manual. */\nwindow.KATA=' +
                               json.dumps(semua, ensure_ascii=False) + ';\n', encoding='utf-8')
    print(f'{len(semua)} kata -> {p / "kata.js"}  (perkiraan dari durasi & jeda suara; cek dengan potret di detik kata kunci)')


# ---------------------------------------------------------------- render MP4
def campur_audio(p, plan, dur, out_m4a, ff):
    inputs, filters, labels = [], [], []

    def add(src, at, vol, extra='', loop=False):
        path = p / src
        if not path.exists():
            print(f'   ! audio tidak ada, dilewati: {src}')
            return
        k = len(labels)
        if loop:
            inputs.extend(['-stream_loop', '-1'])
        inputs.extend(['-i', str(path)])
        ms = int(round(max(0.0, float(at)) * 1000))
        filters.append(f'[{k}:a]aresample=44100,aformat=channel_layouts=stereo{extra},volume={vol},adelay={ms}|{ms}[a{k}]')
        labels.append(f'[a{k}]')

    for v in plan.get('vo') or []:
        if float(v.get('at', 0)) < dur:
            add(v['src'], v.get('at', 0), v.get('vol', 1))
    for s in plan.get('sfx') or []:
        if float(s.get('at', 0)) < dur:
            add(s['src'], s.get('at', 0), s.get('vol', .5))
    n_vo = len(labels)
    mus = plan.get('music')
    duck = bool(mus and mus.get('duck', True) and n_vo)
    if mus:
        add(mus['src'], mus.get('at', 0), mus.get('vol', .15), f',atrim=0:{dur:.2f},afade=t=out:st={max(0, dur - 2):.2f}:d=1.8', loop=True)
        if duck and len(labels) == n_vo:   # berkas musik tidak ada
            duck = False
    for lp in plan.get('loops') or []:
        a0, b0 = float(lp.get('a', lp.get('from', 0))), min(float(lp.get('b', lp.get('to', dur))), dur)
        if b0 > a0:
            add(lp['src'], a0, lp.get('vol', .12), f',atrim=0:{b0 - a0:.2f},asetpts=N/SR/TB,afade=t=in:d=0.5,'
                                                   f'afade=t=out:st={max(0, b0 - a0 - .7):.2f}:d=0.7', loop=True)
    if not labels:
        return False
    if duck:   # musik mengecil otomatis saat ada suara (VO + efek) — sidechain
        lain = labels[:n_vo] + labels[n_vo + 1:]
        musik = labels[n_vo]
        fc = ';'.join(filters) + ';' + ''.join(lain) + f'amix=inputs={len(lain)}:normalize=0:dropout_transition=0,asplit=2[suara][kunci];' + \
            f'{musik}[kunci]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[musikd];' + \
            f'[suara][musikd]amix=inputs=2:normalize=0:dropout_transition=0,apad=whole_dur={dur:.2f},atrim=0:{dur:.2f}[mix]'
    else:
        fc = ';'.join(filters) + ';' + ''.join(labels) + \
            f'amix=inputs={len(labels)}:normalize=0:dropout_transition=0,apad=whole_dur={dur:.2f},atrim=0:{dur:.2f}[mix]'
    raw = str(out_m4a) + '.wav'
    subprocess.run([ff, '-y', '-loglevel', 'error', *inputs, '-filter_complex', fc, '-map', '[mix]', '-c:a', 'pcm_s16le', raw], check=True)
    subprocess.run([ff, '-y', '-loglevel', 'error', '-i', raw, '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-ar', '44100',
                    '-c:a', 'aac', '-b:a', '192k', str(out_m4a)], check=True)
    os.remove(raw)
    return True


def cmd_render(a):
    p = proyek_dari(a.proyek)
    ff = cari_ffmpeg()
    html = rakit(p)
    nama = a.out or (p.name + ('-cek' if a.sampai else '') + '.mp4')
    out = pathlib.Path(nama) if os.path.isabs(nama) else p / nama
    sunyi, mix = p / '.video-sunyi.mp4', p / '.mix.m4a'
    hal = Halaman(html, a.q)
    try:
        dur = float(hal.info['d'])
        if a.sampai:
            dur = min(dur, a.sampai)
        n = int(round(dur * a.fps))
        print(f'[1/3] render {n} frame · {hal.W}×{hal.H} · {a.fps} fps · {dur:.1f} detik')
        enc = subprocess.Popen([ff, '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(a.fps), '-c:v', 'mjpeg', '-i', '-',
                                '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                                str(sunyi)], stdin=subprocess.PIPE)
        t0 = time.time()
        for i in range(n):
            hal.ke(i / a.fps)
            enc.stdin.write(hal.foto(95))
            if i and i % (a.fps * 5) == 0:
                el = time.time() - t0
                print(f'   {i}/{n} frame · sisa ± {el / i * (n - i):.0f} detik', flush=True)
        enc.stdin.close()
        enc.wait()
        errs = hal.errors()
        plan = hal.info.get('a')
    finally:
        hal.tutup()
    if errs:
        print('   ! error halaman selama render:', '; '.join(errs[:5]))
    print('[2/3] campur audio')
    ada = bool(plan) and not a.tanpa_audio and campur_audio(p, plan, dur, mix, ff)
    if not ada:
        print('   (tanpa audio)')
    print('[3/3] gabung')
    if ada:
        subprocess.run([ff, '-y', '-loglevel', 'error', '-i', str(sunyi), '-i', str(mix), '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                        '-c:a', 'copy', '-shortest', '-movflags', '+faststart', str(out)], check=True)
        mix.unlink()
        sunyi.unlink()
    else:
        shutil.move(str(sunyi), str(out))
    print('selesai ->', out)


# ---------------------------------------------------------------- cadangan / riwayat / pulihkan
SIMPAN = ['scene.html', 'naskah.md', 'kata.js', 'gaya.md']


def _versi(p):
    r = p / '.riwayat'
    return sorted([d for d in r.iterdir() if d.is_dir()]) if r.exists() else []


def cmd_cadangan(a):
    p = proyek_dari(a.proyek)
    vs = _versi(p)
    nomor = (int(vs[-1].name.split('_')[0]) + 1) if vs else 1
    d = p / '.riwayat' / f'{nomor:03d}_{datetime.datetime.now():%Y%m%d-%H%M%S}'
    d.mkdir(parents=True)
    for f in SIMPAN:
        if (p / f).exists():
            shutil.copy2(p / f, d / f)
    if (p / 'assets' / 'audio').exists():   # audio kecil ikut disimpan (ganti suara = bisa dibatalkan)
        shutil.copytree(p / 'assets' / 'audio', d / 'audio')
    (d / 'catatan.txt').write_text(a.catatan or '', encoding='utf-8')
    print(f'versi {nomor} disimpan · {a.catatan or "(tanpa catatan)"}')


def cmd_riwayat(a):
    p = proyek_dari(a.proyek)
    vs = _versi(p)
    if not vs:
        print('belum ada versi tersimpan.')
    for d in vs:
        no, wkt = d.name.split('_', 1)
        cat = (d / 'catatan.txt').read_text(encoding='utf-8') if (d / 'catatan.txt').exists() else ''
        print(f'{int(no):>3}  {wkt}  {cat}')


def cmd_pulihkan(a):
    p = proyek_dari(a.proyek)
    vs = _versi(p)
    if not vs:
        sys.exit('belum ada versi tersimpan.')
    if a.nomor:
        pilih = next((d for d in vs if int(d.name.split('_')[0]) == a.nomor), None)
        if not pilih:
            sys.exit(f'versi {a.nomor} tidak ada.')
    else:
        pilih = vs[-2] if len(vs) >= 2 else vs[-1]
    cmd_cadangan(argparse.Namespace(proyek=str(p), catatan=f'otomatis sebelum pulihkan ke versi {int(pilih.name.split("_")[0])}'))
    for f in SIMPAN:
        if (pilih / f).exists():
            shutil.copy2(pilih / f, p / f)
    if (pilih / 'audio').exists():
        shutil.rmtree(p / 'assets' / 'audio', ignore_errors=True)
        shutil.copytree(pilih / 'audio', p / 'assets' / 'audio')
    rakit(p)
    print(f'dipulihkan ke versi {int(pilih.name.split("_")[0])}.')


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description='Motion Format · alat kerja proyek video')
    sp = ap.add_subparsers(dest='cmd', required=True)
    b = sp.add_parser('baru'); b.add_argument('proyek'); b.add_argument('--rasio', default='9:16', choices=list(RASIO))
    b.add_argument('--dasar', default='2d'); b.add_argument('--judul', default=''); b.set_defaults(f=cmd_baru)
    r = sp.add_parser('rakit'); r.add_argument('proyek'); r.set_defaults(f=cmd_rakit)
    po = sp.add_parser('potret'); po.add_argument('proyek'); po.add_argument('--t', default=''); po.add_argument('--n', type=int, default=9)
    po.add_argument('--q', default='', help='tambahan alamat, mis. v=noir')
    po.set_defaults(f=cmd_potret)
    k = sp.add_parser('kata'); k.add_argument('proyek'); k.set_defaults(f=cmd_kata)
    re_ = sp.add_parser('render'); re_.add_argument('proyek'); re_.add_argument('--fps', type=int, default=30)
    re_.add_argument('--sampai', type=float, default=0); re_.add_argument('--out', default=''); re_.add_argument('--tanpa-audio', action='store_true'); re_.add_argument('--q', default='')
    re_.set_defaults(f=cmd_render)
    c = sp.add_parser('cadangan'); c.add_argument('proyek'); c.add_argument('catatan', nargs='?', default=''); c.set_defaults(f=cmd_cadangan)
    rw = sp.add_parser('riwayat'); rw.add_argument('proyek'); rw.set_defaults(f=cmd_riwayat)
    pu = sp.add_parser('pulihkan'); pu.add_argument('proyek'); pu.add_argument('nomor', nargs='?', type=int, default=0); pu.set_defaults(f=cmd_pulihkan)
    a = ap.parse_args()
    a.f(a)


if __name__ == '__main__':
    main()
