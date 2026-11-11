import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderExplainerVideo } from '../lib/remotion-engine.js';

console.log('🧪 Starting Remotion Explainer Video Render Test...');

const outputFilename = `test_garlibee_remotion_${Date.now()}.mp4`;
const outputPath = path.join(process.cwd(), 'public', 'rendered', outputFilename);

const startTime = Date.now();

try {
  const result = await renderExplainerVideo({
    compositionId: 'GarliBeeExplainer',
    inputProps: {
      audioUrl: null,
      themeColor: '#F59E0B',
      hookTitle: 'Makan enak?',
      hookHighlight: 'Boleh banget.',
      hookSubtitle: 'Makan enak itu hak semua orang.',
      brandName: 'GarliBee',
      packSize: 'Kemasan 300 Gram',
      ctaText: 'Cek Keranjang Kuning',
      disclaimer: 'Pangan olahan, bukan obat.'
    },
    outputPath,
    onProgress: (percent) => {
      process.stdout.write(`\r   ⏳ Render Progress: ${percent}%`);
    }
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✅ Render finished in ${durationSec}s!`);

  // Assertions
  assert.ok(fs.existsSync(outputPath), `Output file must exist at ${outputPath}`);
  const stats = fs.statSync(outputPath);
  assert.ok(stats.size > 50000, `Output file must be larger than 50KB (actual: ${stats.size} bytes)`);

  console.log(`📊 Video File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📁 File Path: ${outputPath}`);
  console.log('🎉 REMOTION EXPLAINER VIDEO TEST PASSED SUCCESSFULLY!\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Render test failed:', err);
  process.exit(1);
}

