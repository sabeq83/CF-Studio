# Rencana Implementasi: Perbaikan UI/UX AI Visual Identity Studio Builder (Opsi A: 1-Kolom Vertikal)

## Latar Belakang & Akar Masalah

Pengguna melaporkan bahwa saat membuat Visual Identity baru melalui AI Studio Builder, proses seolah berhenti ("stuck") setelah muncul badge **"Usulan Siap Direview"**, dan tombol **"Generate Visual Preview (G-Labs Node 2)"** tidak terlihat.

Akar masalahnya adalah **urutan tumpukan vertikal yang keliru**:
- Proposal Card menaruh Rationale, 4 Atribut, dan Textarea Prompt T2I *di atas* tombol Generate.
- Akibatnya, tombol Generate dan Kanvas Preview terdorong ke posisi Y: ~850px (*below the fold*), tidak terlihat pada layar standar.

Pengguna meminta evaluasi: *"kenapa harus 2 kolom split? apakah 1 kolom vertikal tidak bisa?"* dan menginstruksikan: *"coba buat mockup opsi A"*.

---

## Solusi Desain Opsi A: 1-Kolom Vertikal (Linear, Bersih, Hero di Atas)

**Mockup interaktif Opsi A sudah diimplementasikan dan aktif sebagai default** di:  
🔗 `http://100.95.245.55:5010/mockup_ai_visual_identity_builder.html`  
*(Dilengkapi pula tombol switcher di header modal untuk beralih antara Opsi A dan Opsi B secara instan)*.

### 1. Auto-Collapse Composer (Stage 1 → Stage 2)
- Saat usulan AI selesai dirakit, Composer 12-chips menciut menjadi **Compact Concept Bar (40px)** di bagian atas.
- Pengguna tetap dapat mengklik tombol *"✏️ Ubah Konsep Ide"* untuk kembali mengedit prompt kapan saja.

### 2. Membalik Urutan Vertikal: Hero Preview Naik ke Atas
- **Posisi 1**: Header Usulan (Nama Preset, Badge Siap Direview, preset_key)
- **Posisi 2 (Y: ~110px)**: **Control Bar Aspek Rasio + TOMBOL GENERATE BERPENDAR** (`pulseGlow` hijau cerah)
- **Posisi 3**: **Kanvas Preview G-Labs** (Langsung tampil utuh di tengah layar)
- **Posisi 4 (Di bawah kanvas)**: Strip Atribut 4-item (Visual Mode, Subject, Environment, Color Palette)
- **Posisi 5 (Di bawah kanvas)**: Textarea Production T2I Prompt (editable + tombol Salin)
- **Posisi 6 (Di bawah kanvas)**: Rationale Desain Estetika

### 3. Keunggulan Opsi A:
- **Nol Scroll**: Tombol Generate berada di Y: ~110px dari atas modal, langsung tampak di hadapan pengguna.
- **Lebar Modal Standar**: Cukup `max-width: 820px` (tidak perlu melebar sampai 1140px).
- **Alur Linear Alami**: Mata pengguna bergerak fokus dari atas (tombol render & visual) ke bawah (detail prompt jika ingin dioprek).

---

## Execution Task List
- [x] Task 1: Pembuatan Mockup Interaktif Opsi A (1-Kolom Vertikal dengan Hero di Atas) + Switcher Opsi B
- [x] Task 2: Sinkronisasi Mockup ke Server Mac Mini Staging (`http://100.95.245.55:5010/mockup_ai_visual_identity_builder.html`)
- [x] Task 3: Tambah state baru (`autoPreview`, `isComposeMode`) & import `useEffect`/`useRef` di `AiVisualIdentityBuilderModal.js`
- [x] Task 4: Implementasi Auto-Collapse Composer → Compact Concept Bar pada React Component
- [x] Task 5: Refaktor Urutan JSX Proposal Card ke 1-Kolom Vertikal (Hero Control Bar + Kanvas di Atas, Spesifikasi di Bawah)
- [x] Task 6: Implementasi Tombol Generate Berpendar (`pulseGlow`) + Tombol Cadangan di Kanvas Kosong
- [x] Task 7: Implementasi Toggle Auto-Generate Preview & CSS Keyframes Injection
- [x] Task 8: Verifikasi Build Lokal (`npm run build`) & Uji Fungsionalitas
- [ ] Task 9: Prosedur Rilis Non-Interaktif & Deploy ke Staging Mac Mini

---

## Detailed Before & After Code Snippets (Untuk Implementasi React Component)

### 1. State Baru & Auto-Collapse Flag

**File**: [`AiVisualIdentityBuilderModal.js`](file:///Users/sabeqmmursyid/_cfstudio/app/components/AiVisualIdentityBuilderModal.js#L92-L115)

#### Code Sebelum (Current/Before):
```javascript
export default function AiVisualIdentityBuilderModal({ onClose, onContinueEditing }) {
  const [userPrompt, setUserPrompt] = useState(TRENDING_PRESETS[0].prompt);
  const [activeChip, setActiveChip] = useState('stickman');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisStage, setSynthesisStage] = useState('');
  const [error, setError] = useState(null);

  // Proposal state
  const [proposal, setProposal] = useState(null);
  const [t2iPrompt, setT2iPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
```

#### Code Sesudah (Proposed/After):
```javascript
export default function AiVisualIdentityBuilderModal({ onClose, onContinueEditing }) {
  const [userPrompt, setUserPrompt] = useState(TRENDING_PRESETS[0].prompt);
  const [activeChip, setActiveChip] = useState('stickman');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisStage, setSynthesisStage] = useState('');
  const [error, setError] = useState(null);

  // Proposal state
  const [proposal, setProposal] = useState(null);
  const [t2iPrompt, setT2iPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');

  // 🚀 Opsi A: Auto-collapse composer flag & Auto-preview toggle
  const [isComposeMode, setIsComposeMode] = useState(true);
  const [autoPreview, setAutoPreview] = useState(true);
  const modalBodyRef = useRef(null);
```

---

### 2. Membalik Urutan JSX Proposal Card (Hero Preview Naik ke Atas)

**File**: [`AiVisualIdentityBuilderModal.js`](file:///Users/sabeqmmursyid/_cfstudio/app/components/AiVisualIdentityBuilderModal.js#L580-L1006)

#### Code Sebelum (Current/Before) — Urutan Lama (Tombol Generate Terkubur di Bawah):
```jsx
{/* Part 2: Interactive Proposal Card */}
{proposal && (
  <div style={{ backgroundColor: 'var(--surface-raised)', borderRadius: '12px', ... }}>
    {/* 1. Header */}
    <div style={{ padding: '16px 20px' }}>...</div>

    {/* 2. Rationale (Menghabiskan ruang vertikal) */}
    {proposal.creative_rationale && <div>...</div>}

    {/* 3. Attributes Strip */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>...</div>

    {/* 4. T2I Prompt Textarea (Menghabiskan ruang vertikal) */}
    <div style={{ padding: '18px 20px' }}>
      <textarea rows={3} ... />
    </div>

    {/* 5. G-Labs Review Section (TERKUBUR DI BAWAH Y > 800px) */}
    <div style={{ padding: '20px' }}>
      <button onClick={handleRenderGlabs}>Generate Visual Preview</button>
      <div style={{ minHeight: '280px' }}>...kanvas...</div>
    </div>
  </div>
)}
```

#### Code Sesudah (Proposed/After) — Urutan Opsi A (Hero Preview Naik ke Atas, Y: ~110px):
```jsx
{/* Part 2: Opsi A - 1-Kolom Vertikal dengan Hero Preview di Atas */}
{proposal && (
  <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md, 12px)', overflow: 'hidden', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column' }}>
    
    {/* 1. Header Usulan */}
    <div style={{ backgroundColor: 'var(--surface-interactive)', padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ backgroundColor: 'var(--status-success-soft)', color: 'var(--status-success)', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
          ✨ Usulan Siap Direview
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
          {proposal.label}
        </h3>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--text-muted)' }}>
          preset_key: {proposal.suggested_preset_key}
        </span>
      </div>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'var(--surface)', padding: '4px 10px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle)' }}>
        Schema v2 Compliant • Faceless Invariant
      </span>
    </div>

    {/* 2. 🌟 HERO SECTION: CONTROL BAR & KANVAS PREVIEW LANGSUNG DI ATAS 🌟 */}
    <div style={{ padding: '14px 18px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 8px)', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Rasio:</span>
          <div style={{ display: 'flex', gap: '5px' }}>
            {['9:16', '1:1', '16:9'].map((ratio) => (
              <button key={ratio} type="button" onClick={() => setAspectRatio(ratio)} style={{ backgroundColor: aspectRatio === ratio ? 'var(--action-primary)' : 'var(--input-bg)', color: aspectRatio === ratio ? 'var(--on-action-primary)' : 'var(--text-secondary)', border: `1px solid ${aspectRatio === ratio ? 'var(--action-primary)' : 'var(--border-subtle)'}`, fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-xs, 4px)', cursor: 'pointer' }}>
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* 🌟 TOMBOL GENERATE BERPENDAR MENYALA (POSISI Y ~110px) 🌟 */}
        <button
          type="button"
          onClick={handleRenderGlabs}
          disabled={isRenderingGlabs}
          style={{
            background: 'linear-gradient(135deg, var(--status-success), var(--action-primary))',
            color: 'var(--on-action-primary)',
            border: 'none',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm, 8px)',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: isRenderingGlabs ? 'not-allowed' : 'pointer',
            opacity: isRenderingGlabs ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(74, 222, 128, 0.45)',
            animation: isRenderingGlabs ? 'none' : 'pulseGlow 2.5s infinite'
          }}
        >
          <span>{isRenderingGlabs ? '⏳' : '🎨'}</span>
          <span>{isRenderingGlabs ? 'Rendering di G-Labs...' : 'Generate Visual Preview (G-Labs)'}</span>
        </button>
      </div>

      {/* Kanvas Viewport Box (Langsung tampil di tengah) */}
      <div style={{ border: renderedImageUrl ? '1px solid var(--border-subtle)' : '2px dashed var(--border-strong)', borderRadius: 'var(--radius-md, 12px)', backgroundColor: renderedImageUrl ? 'var(--canvas)' : 'var(--input-bg)', minHeight: '290px', maxHeight: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative' }}>
        {/* State Empty / Rendering / Rendered */}
      </div>
    </div>

    {/* 3. SPESIFIKASI & PROMPT T2I DI BAWAH KANVAS PREVIEW */}
    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 4 Kotak Atribut Horizontal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {/* Visual Mode, Subject System, Environment, Lighting */}
      </div>

      {/* Textarea Production T2I Prompt */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 8px)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* T2I Header + Copy Button + Textarea */}
      </div>

      {/* Rationale Desain Estetika */}
      {proposal.creative_rationale && (
        <div style={{ backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 8px)', padding: '10px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>💡 Alasan Desain Estetika (Rationale):</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>
            "{proposal.creative_rationale}"
          </div>
        </div>
      )}
    </div>

  </div>
)}
```

---

## File yang Dimodifikasi

| # | File | Jenis Perubahan |
|---|------|-----------------|
| 1 | `app/components/AiVisualIdentityBuilderModal.js` | Refaktor urutan JSX (1-Kolom Vertikal dengan Hero Preview di Atas), Auto-collapse Composer, Toggle Auto-preview, CSS inject |
