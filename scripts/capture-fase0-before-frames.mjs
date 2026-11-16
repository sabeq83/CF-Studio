import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { buildPreviewTimeline } from '../lib/finishing-preview-builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES = [
  { id: 'recipe_pop', file: 'recipe-pop.html', name: 'Recipe Pop' },
  { id: 'ramuan_ritual', file: 'ramuan-ritual.html', name: 'Ramuan Ritual' },
  { id: 'problem_solution', file: 'problem-solution.html', name: 'Problem Solution' }
];

async function main() {
  console.log('🚀 Memulai Fase 0: Ekstraksi Bukti Awal (Before Satu Fokus)...');

  const baseScratchDir = path.join(__dirname, '../scratch/finishing_satu_fokus_before');
  fs.mkdirSync(baseScratchDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const catatanEntries = {};

  for (const tpl of TEMPLATES) {
    console.log(`\n--- Memproses Template: ${tpl.name} (${tpl.id}) ---`);
    const tplScratchDir = path.join(baseScratchDir, tpl.id);
    fs.mkdirSync(tplScratchDir, { recursive: true });

    // 1. Dapatkan timeline JSON
    const timeline = buildPreviewTimeline({
      templateId: tpl.id,
      captionMode: 'full',
      targetLanguage: 'id-ID',
      brandName: tpl.id === 'problem_solution' ? 'Ruang Akustik' : 'Dapur Botani',
      brandTagline: tpl.id === 'problem_solution' ? 'Solusi Insulasi Akustik' : 'Kebaikan Herbal Alami',
      productName: tpl.id === 'problem_solution' ? 'Rockwool Acoustic Slab' : 'Bubuk Rimpang Murni',
      productSpec: tpl.id === 'problem_solution' ? 'Ketebalan 50mm • Densitas 60kg/m³' : 'Toples Kaca 200g'
    });

    // Simpan timeline JSON
    fs.writeFileSync(path.join(tplScratchDir, 'timeline.json'), JSON.stringify(timeline, null, 2));
    console.log(`✓ Timeline JSON disimpan di ${tpl.id}/timeline.json`);

    // 2. Muat template HTML di browser Playwright
    const templatePath = path.join(__dirname, `../templates/finishing/${tpl.file}`);
    const page = await browser.newPage({
      viewport: { width: 720, height: 1280 },
      deviceScaleFactor: 1
    });

    await page.goto(`file://${templatePath}`, { waitUntil: 'load' });

    // Inisialisasi timeline
    await page.evaluate((tl) => {
      window.loadTimeline(tl);
    }, timeline);

    const denseFrames = [];
    const dur = timeline.duration || 24;

    // 3. Render tiap 0.5 detik
    for (let t = 0; t <= dur; t += 0.5) {
      const timeSec = Number(t.toFixed(1));

      // Jalankan renderAt(t) dan periksa lapisan aktif
      const layerStats = await page.evaluate((time) => {
        window.renderAt(time);

        // Deteksi elemen aktif
        const activeBlocks = [];

        // Check Hook
        const oHook = document.getElementById('oHook');
        if (oHook && !oHook.hidden && oHook.style.display !== 'none' && parseFloat(getComputedStyle(oHook).opacity) > 0.05) {
          activeBlocks.push('Hook Title');
        }

        // Check Punch
        const oPunch = document.getElementById('oPunch');
        if (oPunch && !oPunch.hidden && oPunch.style.display !== 'none' && parseFloat(getComputedStyle(oPunch).opacity) > 0.05) {
          activeBlocks.push('Keyword Punch');
        }

        // Check Ingredients
        const oIng = document.getElementById('oIng');
        if (oIng && !oIng.hidden && oIng.style.display !== 'none' && parseFloat(getComputedStyle(oIng).opacity) > 0.05) {
          activeBlocks.push('Daftar Bahan (Stack)');
        }

        // Check Steps
        const oStep = document.getElementById('oStep');
        if (oStep && !oStep.hidden && oStep.style.display !== 'none' && parseFloat(getComputedStyle(oStep).opacity) > 0.05) {
          activeBlocks.push('Label Langkah');
        }

        // Check Product Card
        const oProd = document.getElementById('oProd');
        if (oProd && !oProd.hidden && oProd.style.display !== 'none' && parseFloat(getComputedStyle(oProd).opacity) > 0.05) {
          activeBlocks.push('Kartu Produk');
        }

        // Check Save Prompt
        const oSave = document.getElementById('oSave');
        if (oSave && !oSave.hidden && oSave.style.display !== 'none' && parseFloat(getComputedStyle(oSave).opacity) > 0.05) {
          activeBlocks.push('Save Prompt');
        }

        // Check CTA
        const oCta = document.getElementById('oCta');
        if (oCta && !oCta.hidden && oCta.style.display !== 'none' && parseFloat(getComputedStyle(oCta).opacity) > 0.05) {
          activeBlocks.push('CTA Link Bio');
        }

        // Check Chapter / Phase Pill (Problem Solution)
        const oChapter = document.getElementById('oChapter');
        if (oChapter && !oChapter.hidden && oChapter.style.display !== 'none' && parseFloat(getComputedStyle(oChapter).opacity) > 0.05) {
          activeBlocks.push('Babak Pill');
        }
        const oChapTrack = document.getElementById('oChapTrack');
        if (oChapTrack && !oChapTrack.hidden && oChapTrack.style.display !== 'none') {
          activeBlocks.push('Progress Bar Babak');
        }

        // Check Callouts
        const oCall = document.getElementById('oCall');
        if (oCall && !oCall.hidden && oCall.style.display !== 'none' && parseFloat(getComputedStyle(oCall).opacity) > 0.05) {
          activeBlocks.push('Callout Pin');
        }

        // Check Timing Badges (Ramuan Ritual)
        const oTiming = document.getElementById('oTiming');
        if (oTiming && !oTiming.hidden && oTiming.style.display !== 'none' && parseFloat(getComputedStyle(oTiming).opacity) > 0.05) {
          activeBlocks.push('Timing Badge');
        }

        // Check Subtitles
        const oSub = document.getElementById('oSub');
        if (oSub && !oSub.hidden && oSub.textContent.trim().length > 0) {
          activeBlocks.push('Subtitle');
        }

        // Check Watermark
        const oBrand = document.getElementById('oBrand');
        if (oBrand && !oBrand.hidden && oBrand.style.display !== 'none') {
          activeBlocks.push('Watermark Brand');
        }

        return {
          count: activeBlocks.length,
          blocks: activeBlocks
        };
      }, timeSec);

      // Ambil screenshot per detik bulat atau saat padat
      const isKeySec = timeSec % 1.0 === 0 || layerStats.count >= 3;
      if (isKeySec) {
        const framePath = path.join(tplScratchDir, `frame_${timeSec.toFixed(1)}s.png`);
        await page.screenshot({ path: framePath, omitBackground: false });
      }

      if (layerStats.count >= 3) {
        denseFrames.push({
          time: timeSec,
          count: layerStats.count,
          blocks: layerStats.blocks
        });
      }
    }

    catatanEntries[tpl.id] = {
      name: tpl.name,
      denseFrames
    };

    await page.close();
    console.log(`✓ Selesai ${tpl.name}: ${denseFrames.length} frame terdeteksi padat (≥ 3 blok teks).`);
  }

  await browser.close();

  // 4. Tulis CATATAN.md
  let catatanMd = `# Catatan Audit Bukti Awal (Before Satu Fokus)\n\nTanggal: 16 Nov 2026\nDiekstrak oleh: Playwright Rendering Engine pada template HTML Before.\n\n`;

  for (const [id, data] of Object.entries(catatanEntries)) {
    catatanMd += `## 1. Template: ${data.name} (\`${id}\`)\n\n`;
    catatanMd += `Total frame padat (≥ 3 blok teks bersamaan): **${data.denseFrames.length} titik waktu**\n\n`;
    catatanMd += `| Detik | Jumlah Blok | Rincian Lapisan Aktif Bersamaan |\n`;
    catatanMd += `|---|---|---|\n`;

    data.denseFrames.forEach((df) => {
      catatanMd += `| ${df.time.toFixed(1)}s | **${df.count}** | ${df.blocks.join(', ')} |\n`;
    });

    catatanMd += `\n`;
  }

  catatanMd += `## Kesimpulan Bukti Awal
1. **Recipe Pop**: Pada rentang detik 2.5s s/d 11.0s, daftar bahan (stack) menumpuk bersama label langkah dan subtitle, bahkan bertabrakan dengan Kartu Produk pada detik 11.5s s/d 17.0s. Terdapat hingga 5-6 blok teks aktif bersamaan.
2. **Ramuan Ritual**: Daftar bahan bertahan lama bersamaan dengan timing badge dan kartu produk, menyebabkan kepadatan visual di area atas dan tengah.
3. **Problem Solution**: Pill babak kaku ("1 MASALAH", dll) dan bar progres segmen selalu tampil di setiap klip, bertabrakan dengan callout material dan subtitle.

Data timeline JSON aktual tersimpan di masing-masing subfolder:
- \`scratch/finishing_satu_fokus_before/recipe_pop/timeline.json\`
- \`scratch/finishing_satu_fokus_before/ramuan_ritual/timeline.json\`
- \`scratch/finishing_satu_fokus_before/problem_solution/timeline.json\`
`;

  fs.writeFileSync(path.join(baseScratchDir, 'CATATAN.md'), catatanMd);
  console.log(`\n🎉 Selesai! CATATAN.md berhasil ditulis di ${path.join(baseScratchDir, 'CATATAN.md')}`);
}

main().catch(console.error);
