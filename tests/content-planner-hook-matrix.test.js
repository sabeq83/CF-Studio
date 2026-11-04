import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanHookText } from '../lib/content-planner-contract.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';

test('cleanHookText: strips investigation prefixes, emoji tags, and surrounding quotes', () => {
  const dirtyHook1 = '🔍 [DATA INVESTIGASI]: Kertas hasil lab kolesterol terbentang di atas meja kayu, dilingkari tinta merah pada angka yang melewati batas normal.';
  assert.equal(
    cleanHookText(dirtyHook1),
    'Kertas hasil lab kolesterol terbentang di atas meja kayu, dilingkari tinta merah pada angka yang melewati batas normal.'
  );

  const dirtyHook2 = '[HOOK]: "Satu angka merah di hasil lab ini tanda bahaya tersembunyi!"';
  assert.equal(
    cleanHookText(dirtyHook2),
    'Satu angka merah di hasil lab ini tanda bahaya tersembunyi!'
  );

  const dirtyHook3 = '“🔍 [DATA INVESTIGASI] [SCENE 1]: Kenapa angka lab kolesterol ini tiba-tiba melonjak drastis?”';
  assert.equal(
    cleanHookText(dirtyHook3),
    'Kenapa angka lab kolesterol ini tiba-tiba melonjak drastis?'
  );

  const dirtyHook4 = 'KLIP 1: Dokumen investigasi ini membongkar kenapa plak pembuluh darah mengeras diam-diam!';
  assert.equal(
    cleanHookText(dirtyHook4),
    'Dokumen investigasi ini membongkar kenapa plak pembuluh darah mengeras diam-diam!'
  );

  const cleanHook = 'Satu angka merah di hasil lab ini tanda bahaya tersembunyi!';
  assert.equal(cleanHookText(cleanHook), cleanHook);
});

test('Hook word count verification: 8 to 11 words standard scroll-stopper contract', () => {
  const sampleHooks = [
    'Kenapa angka lab kolesterol ini tiba-tiba melonjak drastis?',
    'Satu angka merah di hasil lab ini tanda bahaya tersembunyi!',
    'Banyak yang mengira tubuhnya aman sebelum melihat berkas lab ini!',
    'Dokumen investigasi ini membongkar kenapa plak pembuluh darah mengeras diam-diam!',
    'Jangan abaikan hasil cek lab malam ini sebelum terlambat!',
    'Saat saluran sempit ini terhambat, seluruh aliran ikut terhenti perlahan!',
    'Mesin sekuat ini bisa mendadak mogok hanya karena kerak tersembunyi!'
  ];

  for (const hook of sampleHooks) {
    const wordCount = hook.trim().split(/\s+/).length;
    assert.ok(
      wordCount >= 8 && wordCount <= 11,
      `Hook "${hook}" should have between 8 and 11 words (actual: ${wordCount})`
    );
  }
});

test('buildVisualIdentityPromptSection: includes environment and setting mandate', () => {
  const snapshot = {
    brand_visual_identity_id: 'bvi_test_01',
    preset_id: 'deductive_pinboard_matrix',
    visual_language: {
      primary_style: 'editorial_noir_investigation'
    },
    structured: {
      rendering: { textures: ['aged_parchment', 'cork_grain'] },
      environment: {
        preset_key: 'deductive_pinboard_matrix',
        custom_description: 'Dimly lit detective war-room with massive corkboard matrix covered in red strings, anatomical charts, and pinned lab reports',
        material_palette: ['dense natural corkboard', 'taut red woolen string', 'printed medical study clippings', 'metallic pushpins'],
        props: ['magnifying glass', 'evidence pins', 'manila case folders']
      },
      wardrobe: {
        custom_description: 'Charcoal wool investigator suit with rolled sleeves'
      },
      lighting: {
        custom_description: 'Hard 3800K side raking light'
      }
    }
  };

  const section = buildVisualIdentityPromptSection(snapshot, 6);
  assert.ok(section.includes('🏡 ENVIRONMENT & SETTING MANDATE'));
  assert.ok(section.includes('dense natural corkboard'));
  assert.ok(section.includes('taut red woolen string'));
  assert.ok(section.includes('DILARANG KERAS menyimpang dari latar setting visual identity'));
});

test('buildOrganicPillarPrompt: dynamically injects corkboard pinboard into investigative prompt', () => {
  const campaignData = {
    campaign_name: 'Garlibee Pinboard Test',
    content_pillar: 'Kolesterol & Sirkulasi',
    visual_style: 'investigative_faceless',
    visual_mode: 'hybrid_lock',
    visual_identity_preset_id: 'deductive_pinboard_matrix',
    custom_hook: '🔍 [DATA INVESTIGASI]: Satu angka merah di hasil lab ini tanda bahaya tersembunyi!',
    visual_action_guideline: 'Kamera macro menyorot corkboard pinboard dengan benang merah menghubungkan laporan lab',
    target_clips_count: 6,
    bridge_at_clip: 4
  };

  const vsoData = {
    environment_prompt: 'dense natural corkboard matrix with taut red string connections',
    lighting_prompt: 'Hard 3800K side raking light casting deep lateral shadows across cork grain'
  };

  const prompt = buildOrganicPillarPrompt([], campaignData, null, null, vsoData);

  // 1. Should use corkboard pinboard matrix, NOT scarred dark oak desk in clip 1
  assert.ok(
    prompt.includes('dense natural corkboard matrix'),
    'Prompt should include corkboard matrix environment'
  );
  assert.ok(
    !prompt.includes('moody scarred dark oak investigative archive desk'),
    'Prompt must NOT include hardcoded scarred dark oak desk when pinboard is active'
  );

  // 2. Hook should be sanitized from tag prefix in prompt injection
  assert.ok(
    prompt.includes('"Satu angka merah di hasil lab ini tanda bahaya tersembunyi!"'),
    'Voiceover hook in prompt must be cleaned from 🔍 [DATA INVESTIGASI]: tag'
  );
  assert.ok(
    !prompt.includes('[DATA INVESTIGASI]: Satu angka merah'),
    'Prompt must not include [DATA INVESTIGASI]: inside the voiceover quote'
  );

  setTimeout(() => process.exit(0), 100);
});
