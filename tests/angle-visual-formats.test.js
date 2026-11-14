import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANGLE_VISUAL_FORMATS,
  ANGLE_VISUAL_FORMAT_LIST,
  ALLOWED_3D_ANGLE_KEYS,
  resolveAngleFormat,
  resolveAngleBeatsForClips
} from '../lib/angle-visual-formats.js';

const ALL_30_KB_ANGLE_NAMES = [
  'The Secret Club',
  'The Status Signal',
  'The Rebel Choice',
  'The Intellectual Flex',
  'The Taste Maker',
  'The Minimalist',
  'The Caregiver',
  'The Alpha',
  'The Artist',
  'The Heritage',
  'The Life Hack',
  'The Math Whiz',
  'The Scientific Proof',
  'The Stress Test',
  'The Comparison (David vs Goliath)',
  'The One-Feature Obsession',
  'The Origin Story',
  'The Blind Test',
  "The Problem You Didn't Know",
  'The Bundle Logic',
  'The Revenge',
  'The Pure Relief',
  'The Safe Haven',
  'The Guilty Pleasure',
  'The Fear of Missing Out (FOMO)',
  'The Magic Moment',
  'The Second Chance',
  'The Belonging',
  'The Sensory ASMR',
  'The Absurdity'
];

test('All 30 KB Strategic Angles exist cleanly and resolve deterministically', () => {
  assert.equal(ANGLE_VISUAL_FORMAT_LIST.length, 30);
  const resolvedKeys = new Set();
  for (const angleName of ALL_30_KB_ANGLE_NAMES) {
    const fmt = resolveAngleFormat(angleName);
    assert.ok(fmt && fmt.key, `Failed to resolve angle: ${angleName}`);
    assert.ok(fmt.beats.length >= 6, `Angle ${fmt.key} must have at least 6 beats`);
    assert.ok(fmt.signatureVisualCues.length > 5);
    resolvedKeys.add(fmt.key);
  }
  assert.equal(resolvedKeys.size, 30, 'All 30 KB angles must map to 30 distinct keys');
});

test('Different angles produce distinct beat labels and cues (The Minimalist vs The Scientific Proof)', () => {
  const minimalist = resolveAngleBeatsForClips('The Minimalist', 6);
  const scientific = resolveAngleBeatsForClips('The Scientific Proof', 6);
  const minimalLabels = minimalist.clips.map(c => c.beatLabel);
  const sciLabels = scientific.clips.map(c => c.beatLabel);
  assert.notDeepEqual(minimalLabels, sciLabels);
  assert.equal(minimalist.hasAny3d, false);
  assert.equal(scientific.hasAny3d, true);
  assert.equal(scientific.used3dCount, 1);
});

test('3D Bio-Cellular is strictly capped at max 1 clip on education angles and 0 on non-education angles', () => {
  for (const fmt of ANGLE_VISUAL_FORMAT_LIST) {
    for (const totalClips of [4, 6, 8]) {
      const plan = resolveAngleBeatsForClips(fmt.key, totalClips, {
        primaryStyle: 'cinematic_realistic',
        supportingStyles: ['culinary_cinematic', 'commercial_product_cinematic', 'symbolic_surrealism', '3d_bio_cellular']
      });
      const count3d = plan.clips.filter(c => c.visualMode === '3d_bio_cellular').length;
      if (ALLOWED_3D_ANGLE_KEYS.has(fmt.key)) {
        assert.ok(count3d <= 1, `${fmt.key} exceeded max 1 clip 3D (${count3d})`);
      } else {
        assert.equal(count3d, 0, `${fmt.key} unexpectedly allocated ${count3d} 3D clips`);
      }
    }
  }
});

test('Alias resolution handles parentheses, apostrophe omissions, and shorthand names', () => {
  assert.equal(resolveAngleFormat('The FOMO').key, ANGLE_VISUAL_FORMATS.fear_of_missing_out.key);
  assert.equal(resolveAngleFormat('David vs Goliath').key, ANGLE_VISUAL_FORMATS.comparison_david_vs_goliath.key);
  assert.equal(resolveAngleFormat('Problem You Didnt Know').key, ANGLE_VISUAL_FORMATS.problem_you_didnt_know.key);
});

