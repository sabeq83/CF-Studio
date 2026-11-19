"""Penghubung bot TeleRadar -> API operator Radar Produk CF Studio (Tahap 7.4).

Dipasang di ~/.claude/skills/teleradar/scripts/ (di luar repo; salinan referensi ada di repo
scripts/teleradar-skill/). Hanya memakai library standar Python 3.9. Token dibaca dari
~/.claude/skills/teleradar/.radar_env (RADAR_BOT_TOKEN) dan TIDAK pernah dicetak/ditulis ke log.

Perintah baca (/top /naik /stabil /turun /cari /produk /status) boleh fallback ke Google Sheet bila
Radar tidak terjangkau. Perintah tulis (/kirim /url) TIDAK pernah fallback ke Sheet agar tidak ada dua
sumber persetujuan sekaligus.
"""
import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from teleradar_lib import rb, rp

ENV_FILE = Path(__file__).resolve().parent.parent / ".radar_env"
COMMANDS = {"/top", "/naik", "/stabil", "/turun", "/cari", "/produk", "/status", "/kirim", "kirim", "/url", "url"}
WRITE_COMMANDS = {"/kirim", "kirim", "/url", "url"}
TREN = {"up": "Naik", "stable": "Stabil", "down": "Menurun"}
URL_OK = {"official", "listing", "user"}


class RadarUnavailable(Exception):
    """Radar tidak terjangkau (jaringan/5xx)."""


class RadarError(Exception):
    """Radar menolak permintaan (4xx) dengan pesan yang aman ditampilkan."""


def _cfg():
    cfg = {}
    if ENV_FILE.exists():
        for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip("\"'")
    api = cfg.get("RADAR_API_URL") or "http://127.0.0.1:5020/api/operator/v2/product-research/batches"
    base = re.sub(r"/batches/?$", "", api.rstrip("/"))
    return {"base": base, "token": cfg.get("RADAR_BOT_TOKEN", ""), "on": cfg.get("RADAR_BOT_ENABLED", "1") != "0"}


def enabled():
    c = _cfg()
    return bool(c["on"] and c["token"])


def _call(method, path, body=None, timeout=25):
    c = _cfg()
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": f"Bearer {c['token']}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(c["base"] + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            payload = json.load(e)
        except Exception:
            payload = {}
        if e.code >= 500:
            raise RadarUnavailable(f"HTTP {e.code}") from None
        raise RadarError(payload.get("error") or f"Permintaan ditolak (HTTP {e.code})") from None
    except Exception as e:  # jaringan / timeout — tanpa URL/token di pesan
        raise RadarUnavailable(type(e).__name__) from None


def _tgl(iso):
    if not iso:
        return "tanggal ?"
    try:
        from datetime import datetime, timedelta
        d = datetime.fromisoformat(str(iso).replace("Z", "+00:00")) + timedelta(hours=7)
        return d.strftime("%d %b %Y")
    except Exception:
        return str(iso)[:10]


def _baris(i):
    url = "🔗" if i.get("url_status") in URL_OK else "❔"
    nama = html.escape((i.get("name") or "")[:55])
    tren = TREN.get(i.get("trend"), "-")
    cek = " ✅" if i.get("process_status") in ("in_catalog", "queued", "processing") else ""
    skor = (i.get("score") or {}).get("total")
    return (f"<b>{html.escape(str(i.get('number')))}</b>. {nama} — {rb(i.get('sold_per_week'))} · {tren} · "
            f"komisi {rp(i.get('commission_rp'))} · skor {skor if skor is not None else '-'} {url}{cek}")


def _daftar(judul, data, kosong="Tidak ada."):
    items = data.get("items") or []
    batch = data.get("batch") or {}
    sub = f"\n<i>Angka dari pengamatan {_tgl(batch.get('observed_at'))} (bukan real-time)</i>" if batch else ""
    if not items:
        return f"<b>{judul}</b>{sub}\n{kosong}"
    return (f"<b>{judul}</b> ({len(items)}){sub}\n" + "\n".join(_baris(i) for i in items)
            + "\n\n🔗 URL siap · ❔ butuh URL · ✅ sudah dikirim · skor = bantu urutan saja")


def _kartu(d):
    c = d["candidate"]
    sc = c.get("score") or {}
    w = c.get("weekly") or {}
    bag = [f"<b>#{html.escape(str(c['number']))} · {TREN.get(c.get('trend'), '-')}</b>",
           f"<b>{html.escape(c.get('name') or '')}</b>",
           f"{html.escape(c.get('category') or '-')} · rank {c.get('rank') or '-'}",
           f"Terjual {rb(c.get('sold_per_week'))}/minggu · Komisi {rp(c.get('commission_rp'))} · Harga {rp(c.get('price'))}"
           f" <i>(per {_tgl(c.get('observed_at'))})</i>"]
    if w.get("sold_delta") is not None:
        pct = f" ({w['sold_pct']:+d}%)" if w.get("sold_pct") is not None else ""
        bag.append(f"Vs {_tgl(w.get('previous_observed_at'))}: {w['sold_delta']:+d}{pct}")
    bag.append(f"\n<b>Skor peluang {sc.get('total', '-')}/{sc.get('max', 100)} · {html.escape(str(sc.get('tier_label', '')))}</b>")
    for b in d.get("score_breakdown") or []:
        bag.append(f"• {html.escape(b['label'])}: {b['score']}/{b['max']} — {html.escape(b.get('detail') or '')}")
    url = c.get("effective_url") or ""
    link = f'<a href="{html.escape(url)}">buka</a>' if url.startswith("http") else "-"
    bag.append(f"\nURL: {link} ({c.get('url_status')})")
    bag.append(f"Status: {c.get('process_status')}" + (f" · {c['cf_product_id']}" if c.get("cf_product_id") else ""))
    return "\n".join(bag)


def _nomor(arg):
    return sorted({x for x in re.findall(r"\d+", arg)}, key=int)


def handle(chat_id, cmd, arg, low, resolve_link=None):
    """Kembalikan teks balasan HTML, atau None bila bukan perintah Radar."""
    tg = str(chat_id)
    if cmd == "/top":
        return _daftar("Rekomendasi skor tertinggi", _call("GET", "/candidates?mode=top&limit=10"))
    if cmd in ("/naik", "/stabil", "/turun"):
        tren = {"/naik": "up", "/stabil": "stable", "/turun": "down"}[cmd]
        judul = {"up": "Tren naik", "stable": "Tren stabil", "down": "Tren menurun"}[tren]
        return _daftar(judul, _call("GET", f"/candidates?mode=list&trend={tren}&limit=30"))
    if cmd == "/cari":
        if not arg.strip():
            return "Format: <code>/cari tumbler</code>"
        q = urllib.parse.quote(arg.strip())
        return _daftar(f"Cari “{html.escape(arg.strip())}”", _call("GET", f"/candidates?mode=list&search={q}&limit=30"))
    if cmd == "/produk":
        nos = _nomor(arg)
        if not nos:
            return "Format: <code>/produk 12</code>"
        return _kartu(_call("GET", f"/candidates/{urllib.parse.quote(nos[0])}"))
    if cmd == "/status":
        d = _call("GET", "/status")
        s = d.get("summary") or {}
        b = d.get("batch") or {}
        if not b:
            return "Belum ada batch riset di Radar."
        return "\n".join([
            f"<b>Status batch {html.escape(str(b.get('external_batch_id')))}</b> <i>(pengamatan {_tgl(b.get('observed_at'))})</i>",
            f"Total kandidat: {s.get('total', 0)}",
            f"Tren: ↑{s.get('trend_up', 0)} · →{s.get('trend_stable', 0)} · ↓{s.get('trend_down', 0)}",
            f"🔗 URL siap: {(s.get('url_official', 0) or 0) + (s.get('url_listing', 0) or 0) + (s.get('url_user', 0) or 0)}"
            f" · ❔ butuh URL: {(s.get('url_nearest', 0) or 0) + (s.get('url_not_found', 0) or 0) + (s.get('url_not_researched', 0) or 0)}",
            f"⏳ Antre/diproses: {(s.get('process_queued', 0) or 0) + (s.get('process_processing', 0) or 0)}"
            f" · ✅ Di katalog: {s.get('process_in_catalog', 0)} · ⚠️ Perlu review: {s.get('process_needs_review', 0)}"
            f" · ❌ Gagal: {s.get('process_failed', 0)}",
            f"Belum dikirim: {s.get('process_not_sent', 0)}"])
    if cmd in ("/url", "url"):
        m = re.match(r"^(\d+)\s+(\S+)", arg)
        if not m:
            return "Format: <code>/url 4 https://www.tokopedia.com/toko/nama-produk</code>"
        no, u = m.group(1), m.group(2)
        if resolve_link:
            u = resolve_link(u)
        try:
            c = _call("POST", f"/candidates/{no}/url", {"url": u, "telegram_user_id": tg})["candidate"]
        except RadarUnavailable:
            raise
        except RadarError as e:
            return f"⚠️ {html.escape(str(e))}"
        return f"✅ URL no. {no} disimpan di Radar ({c.get('url_status')}).\nKirim ke katalog dengan <code>/kirim {no}</code>."
    if cmd in ("/kirim", "kirim"):
        if "semua naik" in low:
            nos = [str(i["number"]) for i in _call("GET", "/candidates?mode=list&trend=up&limit=50").get("items", [])]
        else:
            nos = _nomor(arg)
        if not nos:
            return "Tulis nomornya, mis. <code>/kirim 1, 6, 17</code>"
        if len(nos) > 50:
            return "⚠️ Maksimal 50 produk sekali kirim."
        try:
            d = _call("POST", "/promote", {"candidate_refs": nos, "mode": "execute", "telegram_user_id": tg}, timeout=60)
        except RadarUnavailable:
            raise
        except RadarError as e:
            return f"⚠️ {html.escape(str(e))}"
        rs = d.get("results") or []
        nm = lambda r: html.escape((r.get("name") or "")[:40])
        out = []
        q = [r for r in rs if r["status"] == "queued"]
        l = [r for r in rs if r["status"] == "linked"]
        t = [r for r in rs if r["status"] == "skipped_blocked"]
        x = [r for r in rs if r["status"] in ("conflict", "failed")]
        if q:
            out.append("✅ Masuk antrean CF Studio (diproses 1-per-1):\n" + "\n".join(f"• {nm(r)}" for r in q))
        if l:
            out.append("🔗 Dihubungkan ke produk yang sudah ada:\n" + "\n".join(f"• {nm(r)}" for r in l))
        if t:
            out.append("⏸ Tertahan (tidak terkirim):\n" + "\n".join(f"• {nm(r)} — {html.escape(r.get('reason') or '')}" for r in t))
        if x:
            out.append("⚠️ Gagal/bentrok:\n" + "\n".join(f"• {nm(r)} — {html.escape(r.get('error') or '')}" for r in x))
        return "\n\n".join(out) or "Tidak ada yang diproses."
    return None
