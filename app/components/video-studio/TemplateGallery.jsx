'use client';

const TEMPLATES = [
  {
    id: 'none',
    title: 'Tanpa Finishing',
    subtitle: 'Muxing Murni / ASS Basic',
    badge: 'Cepat (Tanpa Playwright)',
    desc: 'Hanya mux video & audio tanpa overlay animasi kartu.'
  },
  {
    id: 'recipe_pop',
    title: 'Pop Resep & Masak',
    subtitle: 'Chips Bahan + Step Cards',
    badge: 'Kuliner & Tutorial',
    desc: 'Chip bahan di awal, kartu langkah dinamis, punchline & Save Prompt.'
  },
  {
    id: 'problem_solution',
    title: 'Problem - Solution',
    subtitle: 'Struktur Bab Masalah & Solusi',
    badge: 'Produk & Problem Solver',
    desc: 'Hook kontras, bab masalah, bab solusi, callout keunggulan produk.'
  },
  {
    id: 'tips_listicle',
    title: 'Tips / Listicle',
    subtitle: 'Badge Bab & Counter Tip',
    badge: 'Edukasi & Tips Cepat',
    desc: 'Penomoran tip otomatis (Tip 1, Tip 2), highlight visual & punch.'
  },
  {
    id: 'ramuan_ritual',
    title: 'Ramuan & Ritual',
    subtitle: 'Langkah Herbal & Catatan',
    badge: 'Strict Herbal / Natural',
    desc: 'Sajian estetik natural untuk jamu, seduhan, dan perawatan tradisional.'
  },
  {
    id: 'calm_wellness',
    title: 'Calm & Wellness',
    subtitle: 'Editorial Serif & Product Card',
    badge: 'Editorial & Relaksasi',
    desc: 'Tipografi serif elegan, Product Card faktual, tone tenang & bersih.'
  },
  {
    id: 'angka_banding',
    title: 'Angka & Perbandingan',
    subtitle: 'Sebelum vs Sesudah / Versus',
    badge: 'Komparasi & Efisiensi',
    desc: 'Badge perbandingan sebelum-sesudah atau metrik angka penting.'
  },
  {
    id: 'mitos_fakta',
    title: 'Mitos vs Fakta',
    subtitle: 'Klaim & Sanggahan Edukatif',
    badge: 'Edukasi & Debunking',
    desc: 'Pemberitahuan mitos vs fakta dengan koreksi terarah dan kartu kesimpulan.'
  }
];

export default function TemplateGallery({
  selectedTemplate,
  onSelectTemplate,
  recommendedTemplate
}) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '12px'
      }}>
        {TEMPLATES.map((tmpl) => {
          const isSelected = selectedTemplate === tmpl.id;
          const isRecommended = recommendedTemplate === tmpl.id;

          return (
            <div
              key={tmpl.id}
              onClick={() => onSelectTemplate(tmpl.id)}
              style={{
                background: isSelected ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                border: isSelected
                  ? '2px solid var(--action-primary)'
                  : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: isSelected ? '0 0 0 1px var(--action-primary)' : 'none'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    background: isSelected ? 'var(--action-primary)' : 'var(--surface-subtle)',
                    color: isSelected ? 'var(--on-action-primary)' : 'var(--text-secondary)'
                  }}>
                    {tmpl.badge}
                  </span>

                  {isSelected && (
                    <span style={{
                      color: 'var(--action-primary)',
                      fontSize: '1rem',
                      fontWeight: 800,
                      lineHeight: 1
                    }}>
                      ✓
                    </span>
                  )}
                </div>

                <h4 style={{
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: '0 0 4px 0'
                }}>
                  {tmpl.title}
                </h4>

                <div style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px'
                }}>
                  {tmpl.subtitle}
                </div>

                <p style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  margin: 0,
                  lineHeight: 1.35
                }}>
                  {tmpl.desc}
                </p>
              </div>

              {isRecommended && (
                <div style={{
                  marginTop: '10px',
                  paddingTop: '6px',
                  borderTop: '1px dashed var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--status-info)'
                }}>
                  <span>★</span>
                  <span>Rekomendasi Campaign</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
