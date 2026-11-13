import json,re,sys
R=json.load(open(sys.argv[1]))
VAGUE=['efektif','maksimal','optimal','tepat','sempurna','berkualitas','pilihan','terbaik','alami','kebugaran','nyaman','praktis','secukupnya','sebentar','beberapa']
MARK=['padahal','masalahnya','nah','di titik inilah','di sinilah','hasilnya','makanya']
CLAIM=['lemak','racun','detoks','ginjal','paru','gula darah','kolesterol','kanker','metabolisme','imun','jantung','obat']
NUM=r'\d|\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|puluh|ratus|setengah|separuh|semalaman|sendok|siung|gelas|gram|ml|menit|jam|derajat|persen|meter|cm|mm|roll)\b'
SPEC=r'\b(pertama|kedua|ketiga|celah|pintu|jendela|ventilasi|kusen|door sweep|lapisan|ketebalan|luas|ukur|suhu ruang|sinar matahari|catat|jadwal|radius|kain tebal|kriteria|kesalahan)\b'
EXP={'siasat_mul_kulit':['pati jagung','madu','minyak zaitun'],'botani_mul_adas':['adas','karam','jintan','semalam','setengah']}
def score(k,vo):
    if not vo: return None
    mid=vo[1:-1] or vo
    anc=sum(1 for c in mid if re.search(NUM,c.lower()) or re.search(SPEC,c.lower()))
    t=' '.join(vo).lower()
    vague=0
    for s in re.split(r'[.!?]',t):
        if any(re.search(r'\b'+v+r'\b',s) for v in VAGUE) and not (re.search(NUM,s) or re.search(SPEC,s)): vague+=sum(len(re.findall(r'\b'+v+r'\b',s)) for v in VAGUE)
    mk=sum(t.count(m) for m in MARK)
    cl=[c for c in CLAIM if c in t]
    ing=None
    if k in EXP: ing=f"{sum(1 for e in EXP[k] if e in t)}/{len(EXP[k])}"
    return dict(anchor=f"{anc}/{len(mid)}", vague=vague, marker=mk, claim=','.join(cl) or '-', ing=ing or '', wmax=max(len(c.split()) for c in vo))
print(f"{'kasus':20} {'versi':5} {'klip isi berpegangan':>20} {'samar':>6} {'transisi':>8} {'klaim':>22} {'bahan':>6} {'kata/klip maks':>14}")
for k,r in R.items():
    for name,vo in [('prod',r['meta'].get('prod_vo')),('lama',r.get('old')),('baru',r.get('new'))]:
        s=score(k,vo)
        if s: print(f"{k:20} {name:5} {s['anchor']:>20} {s['vague']:>6} {s['marker']:>8} {s['claim']:>22} {s['ing']:>6} {s['wmax']:>14}")
