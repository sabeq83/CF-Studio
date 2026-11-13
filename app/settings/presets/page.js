'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import VisualIdentitySelector from '../../components/VisualIdentitySelector';
import BridgeSegmentsEditor from '../../components/campaign-forms/BridgeSegmentsEditor';
import { normalizeBridgePayload } from '@/lib/bridging/bridge-plan';
import { getWordsPerClipOptions, getDefaultWordsPerClip, VIDEO_MODELS } from '@/lib/words-per-clip-presets';
import { GEMINI_VOICES, MINIMAX_VOICES, MINIMAX_ENGLISH_VOICES, ELEVENLABS_ID_VOICES, ELEVENLABS_EN_VOICES, ELEVENLABS_MODELS } from '@/lib/voice-constants';
import { GOOGLE_VOICE_PERSONAS } from '@/lib/veo-native-audio';
import { FINISHING_TEMPLATE_REGISTRY, getFinishingTemplateMeta } from '@/lib/finishing-template-registry';
import FinishingTemplatePreview from '../../components/FinishingTemplatePreview';

const initialForm = {
  key: '',
  label: '',
  campaign_kinds: ['brand_editorial'],
  // Section 1: basic_strategy
  narrative_mode: 'Storytelling',
  target_language: 'id-ID',
  target_demographic: 'genz_casual',
  target_demographic_custom: '',
  promotion_style: 'Softselling',
  ai_directive: '',
  mandatory_outro_line: '',
  enable_audio_segment: false,
  sfx_setting: 'without_sfx',
  enable_vo_audit: 1,
  nextcloud_parent_folder: '/MAKNA_Assets',

  // Section 2: visual_engine
  visual_style: 'Cinematic',
  visual_mode: 'hybrid_lock',
  video_model: 'veo_31_lite',
  aspect_ratio: '9:16',
  face_visibility: 'Faceless',
  target_clips_count: 4,
  words_per_clip: '17-19 kata',
  clip_duration: 8,

  // Section 3: product_bridging
  is_bridging_active: false,
  bridging_mode: 'select_existing',
  bridge_at_clip: 3,
  bridge_duration_clips: 1,
  bridge_segments: [{ at_clip: 3, duration_clips: 1, role: 'intro' }],

  // Section 4: visual_swap
  is_vso_active: false,
  visual_identity_preset_id: 'hands_only_muslimah_sage_kitchen',
  visual_identity_inline_config: null,
  visual_overrides_json: null,
  character_concept: 'faceless',
  subject_demographic: 'syari_classic',
  wardrobe_style: 'amber_terracotta',
  wardrobe_style_custom: '',
  lighting_style: 'window_daylight',
  lighting_style_custom: '',
  visual_style_preset: '3d_claymation_cozy',

  // Section 5: workflow
  approval_mode: 'storyboard',
  audio_engine_mode: 'minimax_tts',
  google_voice_persona: 'Kore',
  enable_native_sfx: true,
  enable_native_ambience: true,
  anti_music_guardrail: true,
  enable_tts: true,
  voice_provider: 'minimax',
  voice_persona: 'Indonesian_professional_anchor_vv2',
  voice_speed: 1.0,
  voice_volume: 1.0,
  tts_model_quality: 'speech-2.8-turbo',
  elevenlabs_model: 'eleven_multilingual_v2',
  elevenlabs_stability: 0.50,
  elevenlabs_similarity_boost: 0.75,
  elevenlabs_custom_voice_id: '',
  enable_glabs: true,
  enable_ffmpeg: true,
  ffmpeg_sync_option: 'smart_sync',
  ffmpeg_video_scale: 1.00,
  ffmpeg_bgm_volume: 0.00,
  ffmpeg_sfx_volume: 0.00,
  enable_social_post: false,
  upload_markdown: true,
  upload_spreadsheet: false,
  auto_sync_contentflow: true,

  // Section 6: finishing video (FFmpeg Motion Text, Transitions & Finishing Pass)
  enable_motion_text: true,
  motion_text_style: 'floating_white_yellow',
  motion_text_position: 'bottom',
  video_transition: 'cut',
  transition_duration: 0.5,
  finishing_template: 'none',
  caption_mode: 'hybrid',
  loudness_target: -14
};

function mapPresetToForm(p) {
  const c = p.config || {};
  const bs = c.basic_strategy || {};
  const ve = c.visual_engine || {};
  const pb = c.product_bridging || {};
  const vs = c.visual_swap || {};
  const wf = c.workflow || {};

  return {
    key: p.key || '',
    label: p.label || c.label || p.key || '',
    campaign_kinds: p.campaign_kinds || c.campaign_kinds || ['brand_editorial'],
    // basic_strategy
    narrative_mode: bs.narrative_mode || 'Storytelling',
    target_language: bs.target_language || 'id-ID',
    target_demographic: bs.target_demographic || 'genz_casual',
    target_demographic_custom: bs.target_demographic_custom || '',
    promotion_style: bs.promotion_style || 'Softselling',
    ai_directive: bs.ai_directive || '',
    mandatory_outro_line: bs.mandatory_outro_line || '',
    enable_audio_segment: Boolean(bs.enable_audio_segment),
    sfx_setting: bs.sfx_setting || 'without_sfx',
    enable_vo_audit: bs.enable_vo_audit ?? 1,
    nextcloud_parent_folder: bs.nextcloud_parent_folder || '/MAKNA_Assets',

    // visual_engine
    visual_style: ve.visual_style || 'Cinematic',
    visual_mode: ve.visual_mode || 'hybrid_lock',
    video_model: ve.video_model || 'veo_31_lite',
    aspect_ratio: ve.aspect_ratio || '9:16',
    face_visibility: ve.face_visibility || 'Faceless',
    target_clips_count: Number(ve.target_clips_count ?? 4),
    words_per_clip: ve.words_per_clip || '17-19 kata',
    clip_duration: Number(ve.clip_duration ?? 8),

    // product_bridging
    is_bridging_active: Boolean(pb.is_bridging_active),
    bridging_mode: pb.bridging_mode || 'select_existing',
    bridge_at_clip: Number(pb.bridge_at_clip ?? 3),
    bridge_duration_clips: Number(pb.bridge_duration_clips ?? 1),
    bridge_segments: (() => {
      const norm = normalizeBridgePayload(pb, ve, { targetClips: Number(ve.target_clips_count ?? 12), defaultActive: true });
      return norm.segments.length > 0
        ? norm.segments
        : [{ at_clip: Number(pb.bridge_at_clip ?? 3), duration_clips: Number(pb.bridge_duration_clips ?? 1), role: 'intro' }];
    })(),

    // visual_swap
    is_vso_active: Boolean(vs.is_vso_active),
    visual_identity_preset_id: vs.visual_identity_preset_id || 'hands_only_muslimah_sage_kitchen',
    visual_identity_inline_config: vs.visual_identity_inline_config || null,
    visual_overrides_json: vs.visual_overrides_json || null,
    character_concept: vs.character_concept || 'faceless',
    subject_demographic: vs.subject_demographic || 'syari_classic',
    wardrobe_style: vs.wardrobe_style || 'amber_terracotta',
    wardrobe_style_custom: vs.wardrobe_style_custom || '',
    lighting_style: vs.lighting_style || 'window_daylight',
    lighting_style_custom: vs.lighting_style_custom || '',
    visual_style_preset: vs.visual_style_preset || '3d_claymation_cozy',

    // workflow
    approval_mode: wf.approval_mode || 'storyboard',
    audio_engine_mode: wf.audio_engine_mode || bs.audio_engine_mode || 'minimax_tts',
    google_voice_persona: wf.google_voice_persona || bs.google_voice_persona || 'Kore',
    enable_native_sfx: wf.enable_native_sfx !== undefined ? Boolean(wf.enable_native_sfx) : (bs.enable_native_sfx !== undefined ? Boolean(bs.enable_native_sfx) : true),
    enable_native_ambience: wf.enable_native_ambience !== undefined ? Boolean(wf.enable_native_ambience) : (bs.enable_native_ambience !== undefined ? Boolean(bs.enable_native_ambience) : true),
    anti_music_guardrail: wf.anti_music_guardrail !== undefined ? Boolean(wf.anti_music_guardrail) : (bs.anti_music_guardrail !== undefined ? Boolean(bs.anti_music_guardrail) : true),
    enable_tts: Boolean(wf.enable_tts),
    voice_provider: bs.voice_provider || 'minimax',
    voice_persona: bs.voice_persona || 'Indonesian_professional_anchor_vv2',
    voice_speed: Number(bs.voice_speed ?? 1.0),
    voice_volume: Number(bs.voice_volume ?? 1.0),
    tts_model_quality: bs.tts_model_quality || 'speech-2.8-turbo',
    elevenlabs_model: bs.elevenlabs_model || wf.elevenlabs_model || 'eleven_multilingual_v2',
    elevenlabs_stability: Number(bs.elevenlabs_stability ?? wf.elevenlabs_stability ?? 0.50),
    elevenlabs_similarity_boost: Number(bs.elevenlabs_similarity_boost ?? wf.elevenlabs_similarity_boost ?? 0.75),
    elevenlabs_custom_voice_id: bs.elevenlabs_custom_voice_id || wf.elevenlabs_custom_voice_id || '',
    enable_glabs: Boolean(wf.enable_glabs),
    enable_ffmpeg: Boolean(wf.enable_ffmpeg),
    ffmpeg_sync_option: wf.ffmpeg_sync_option || 'smart_sync',
    ffmpeg_video_scale: Number(wf.ffmpeg_video_scale ?? 1.00),
    ffmpeg_bgm_volume: Number(wf.ffmpeg_bgm_volume ?? 0.00),
    ffmpeg_sfx_volume: Number(wf.ffmpeg_sfx_volume ?? 0.00),
    enable_social_post: Boolean(wf.enable_social_post),
    upload_markdown: wf.upload_markdown !== undefined ? Boolean(wf.upload_markdown) : true,
    upload_spreadsheet: Boolean(wf.upload_spreadsheet),
    auto_sync_contentflow: wf.auto_sync_contentflow !== undefined ? Boolean(wf.auto_sync_contentflow) : true,
    // finishing video
    enable_motion_text: wf.enable_motion_text !== undefined ? Boolean(wf.enable_motion_text) : true,
    motion_text_style: wf.motion_text_style || 'floating_white_yellow',
    motion_text_position: wf.motion_text_position || 'bottom',
    video_transition: wf.video_transition || 'cut',
    transition_duration: Number(wf.transition_duration ?? 0.5),
    finishing_template: wf.finishing_template || 'none',
    caption_mode: wf.caption_mode || 'hybrid',
    loudness_target: Number(wf.loudness_target ?? -14)
  };
}

function mapFormToPayload(f) {
  return {
    key: f.key,
    label: f.label,
    config: {
      schema_version: '2',
      label: f.label,
      campaign_kinds: f.campaign_kinds,
      basic_strategy: {
        narrative_mode: f.narrative_mode,
        audio_engine_mode: f.audio_engine_mode || 'minimax_tts',
        google_voice_persona: f.google_voice_persona || 'Kore',
        enable_native_sfx: Boolean(f.enable_native_sfx),
        enable_native_ambience: Boolean(f.enable_native_ambience),
        anti_music_guardrail: Boolean(f.anti_music_guardrail),
        voice_provider: f.voice_provider,
        voice_persona: f.voice_persona,
        voice_speed: Number(f.voice_speed),
        voice_volume: Number(f.voice_volume),
        tts_model_quality: f.tts_model_quality,
        elevenlabs_model: f.elevenlabs_model || 'eleven_multilingual_v2',
        elevenlabs_stability: Number(f.elevenlabs_stability ?? 0.50),
        elevenlabs_similarity_boost: Number(f.elevenlabs_similarity_boost ?? 0.75),
        elevenlabs_custom_voice_id: f.elevenlabs_custom_voice_id || '',
        target_language: f.target_language,
        target_demographic: f.target_demographic,
        target_demographic_custom: f.target_demographic_custom || '',
        ai_directive: f.ai_directive || '',
        mandatory_outro_line: f.mandatory_outro_line || '',
        enable_audio_segment: Boolean(f.enable_audio_segment),
        sfx_setting: f.sfx_setting,
        enable_vo_audit: Number(f.enable_vo_audit ?? 1),
        nextcloud_parent_folder: f.nextcloud_parent_folder || '/MAKNA_Assets',
        promotion_style: f.promotion_style || 'Softselling'
      },
      visual_engine: {
        visual_style: f.visual_style,
        visual_mode: f.visual_mode,
        video_model: f.video_model,
        aspect_ratio: f.aspect_ratio,
        face_visibility: f.face_visibility,
        target_clips_count: Number(f.target_clips_count ?? 4),
        words_per_clip: f.words_per_clip,
        clip_duration: Number(f.clip_duration ?? 8)
      },
      product_bridging: {
        is_bridging_active: Boolean(f.is_bridging_active),
        bridging_mode: f.bridging_mode || 'select_existing',
        bridge_at_clip: Number(f.bridge_segments?.[0]?.at_clip ?? f.bridge_at_clip ?? 3),
        bridge_duration_clips: Number(f.bridge_segments?.[0]?.duration_clips ?? f.bridge_duration_clips ?? 1),
        bridge_segments: Array.isArray(f.bridge_segments) && f.bridge_segments.length > 0
          ? f.bridge_segments
          : [{ at_clip: Number(f.bridge_at_clip ?? 3), duration_clips: Number(f.bridge_duration_clips ?? 1), role: 'intro' }]
      },
      visual_swap: {
        is_vso_active: Boolean(f.is_vso_active),
        character_concept: f.character_concept,
        subject_demographic: f.subject_demographic,
        wardrobe_style: f.wardrobe_style,
        wardrobe_style_custom: f.wardrobe_style_custom,
        lighting_style: f.lighting_style,
        lighting_style_custom: f.lighting_style_custom,
        visual_style_preset: f.visual_style_preset,
        visual_identity_preset_id: f.is_vso_active ? f.visual_identity_preset_id : null,
        visual_identity_inline_config: f.is_vso_active && f.visual_identity_preset_id === 'inline' ? f.visual_identity_inline_config : null,
        visual_overrides_json: f.is_vso_active && f.visual_identity_preset_id === 'custom' ? f.visual_overrides_json : null
      },
      workflow: {
        approval_mode: f.approval_mode,
        audio_engine_mode: f.audio_engine_mode || 'minimax_tts',
        google_voice_persona: f.google_voice_persona || 'Kore',
        enable_native_sfx: Boolean(f.enable_native_sfx),
        enable_native_ambience: Boolean(f.enable_native_ambience),
        anti_music_guardrail: Boolean(f.anti_music_guardrail),
        enable_tts: Boolean(f.enable_tts),
        voice_provider: f.voice_provider,
        voice_persona: f.voice_persona,
        elevenlabs_model: f.elevenlabs_model || 'eleven_multilingual_v2',
        elevenlabs_stability: Number(f.elevenlabs_stability ?? 0.50),
        elevenlabs_similarity_boost: Number(f.elevenlabs_similarity_boost ?? 0.75),
        elevenlabs_custom_voice_id: f.elevenlabs_custom_voice_id || '',
        enable_glabs: Boolean(f.enable_glabs),
        enable_ffmpeg: Boolean(f.enable_ffmpeg),
        ffmpeg_sync_option: f.ffmpeg_sync_option || 'smart_sync',
        ffmpeg_video_scale: Number(f.ffmpeg_video_scale ?? 1.0),
        ffmpeg_bgm_volume: Number(f.ffmpeg_bgm_volume ?? 0.0),
        ffmpeg_sfx_volume: Number(f.ffmpeg_sfx_volume ?? 0.0),
        enable_social_post: Boolean(f.enable_social_post),
        upload_markdown: f.upload_markdown !== undefined ? Boolean(f.upload_markdown) : true,
        upload_spreadsheet: Boolean(f.upload_spreadsheet),
        auto_sync_contentflow: f.auto_sync_contentflow !== undefined ? Boolean(f.auto_sync_contentflow) : true,
        enable_motion_text: Boolean(f.enable_motion_text),
        motion_text_style: f.motion_text_style || 'floating_white_yellow',
        motion_text_position: f.motion_text_position || 'bottom',
        video_transition: f.video_transition || 'cut',
        transition_duration: Number(f.transition_duration ?? 0.5),
        finishing_template: f.finishing_template || 'none',
        caption_mode: f.caption_mode || 'hybrid',
        loudness_target: Number(f.loudness_target ?? -14)
      }
    }
  };
}

const TABS_CONFIG = [
  { id: 'all', label: 'Semua Preset' },
  { id: 'recipe_campaign', label: '🍲 Resep Kuliner' },
  { id: 'product_campaign', label: '📦 Produk E-Commerce' },
  { id: 'brand_editorial', label: '🎬 Brand Editorial' },
  { id: 'multiplier_campaign', label: '🔀 Multiplier Remix' },
  { id: 'recipe_labs', label: '🧪 Recipe Labs' }
];

export default function PresetsPage() {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [editMode, setEditMode] = useState(false); // false (list) or true (form)
  const [form, setForm] = useState(initialForm);
  const [isNew, setIsNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState(0); // 0 to 4

  // Filter States (Opsi 1: Smart Tabs & Chips)
  const [activeTab, setActiveTab] = useState('all');
  const [audioFilter, setAudioFilter] = useState('all'); // 'all', 'native_veo', 'minimax_tts'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'system', 'custom'
  const [searchQuery, setSearchQuery] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [presetsRes, authRes] = await Promise.all([
        fetch('/api/v2/operator-presets').then(r => r.json()),
        fetch('/api/auth/me').then(r => r.json())
      ]);
      if (presetsRes.success) setPresets(presetsRes.presets || []);
      if (authRes.authenticated) setUser(authRes.user);
    } catch (e) {
      setMessage('Gagal memuat data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleCreate = () => {
    setForm(initialForm);
    setIsNew(true);
    setEditMode(true);
    setActiveAccordion(0);
  };

  const handleEdit = (preset) => {
    setForm(mapPresetToForm(preset));
    setIsNew(false);
    setEditMode(true);
    setActiveAccordion(0);
  };

  const handleClone = (preset) => {
    const parsed = mapPresetToForm(preset);
    setForm({
      ...parsed,
      key: `${preset.key}_clone`,
      label: `${preset.label || preset.key} Clone`
    });
    setIsNew(true);
    setEditMode(true);
    setActiveAccordion(0);
  };

  const handleDelete = async (key) => {
    if (!window.confirm(`Hapus preset "${key}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v2/operator-presets/${key}`, { method: 'DELETE' }).then(r => r.json());
      if (res.success) {
        setMessage('Preset berhasil dihapus.');
        load();
      } else {
        setMessage(res.error);
      }
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.key || !form.label) return setMessage('Key dan Label wajib diisi.');
    if (!form.campaign_kinds.length) return setMessage('Pilih minimal satu jenis campaign.');
    setBusy(true);
    try {
      const body = mapFormToPayload(form);
      const res = await fetch(isNew ? '/api/v2/operator-presets' : `/api/v2/operator-presets/${form.key}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(r => r.json());

      if (res.success) {
        setMessage('Preset berhasil disimpan.');
        setEditMode(false);
        load();
      } else {
        setMessage(res.error);
      }
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  const getVoices = () => {
    if (form.voice_provider === 'elevenlabs') {
      const isEn = String(form.target_language || '').toLowerCase().startsWith('en');
      return isEn ? ELEVENLABS_EN_VOICES : ELEVENLABS_ID_VOICES;
    }
    if (form.voice_provider === 'gemini') return GEMINI_VOICES;
    if (form.target_language === 'en-US') return MINIMAX_ENGLISH_VOICES;
    return MINIMAX_VOICES;
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Computed Tab Counts
  const tabCounts = {
    all: presets.length,
    recipe_campaign: presets.filter(p => (p.campaign_kinds || []).includes('recipe_campaign')).length,
    product_campaign: presets.filter(p => (p.campaign_kinds || []).includes('product_campaign')).length,
    brand_editorial: presets.filter(p => (p.campaign_kinds || []).includes('brand_editorial')).length,
    multiplier_campaign: presets.filter(p => (p.campaign_kinds || []).includes('multiplier_campaign')).length,
    recipe_labs: presets.filter(p => (p.campaign_kinds || []).includes('recipe_labs')).length
  };

  // Computed Filtered Presets
  const filteredPresets = presets.filter(p => {
    // 1. Tab filter
    if (activeTab !== 'all' && !(p.campaign_kinds || []).includes(activeTab)) {
      return false;
    }

    // 2. Audio Engine filter
    const audioMode = p.config?.workflow?.audio_engine_mode || p.config?.basic_strategy?.audio_engine_mode || 'minimax_tts';
    if (audioFilter === 'native_veo' && audioMode !== 'native_veo') return false;
    if (audioFilter === 'minimax_tts' && audioMode === 'native_veo') return false;

    // 3. Type filter
    if (typeFilter === 'system' && !p.is_system) return false;
    if (typeFilter === 'custom' && p.is_system) return false;

    // 4. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchLabel = (p.label || '').toLowerCase().includes(q);
      const matchKey = (p.key || '').toLowerCase().includes(q);
      const matchKind = (p.campaign_kinds || []).some(k => k.toLowerCase().includes(q));
      if (!matchLabel && !matchKey && !matchKind) return false;
    }

    return true;
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1>🎛️ Preset Manager</h1>
            <p className="page-subtitle">Kelola preset strategi kreatif & visual terpusat untuk otomatisasi kampanye.</p>
          </div>
          {!editMode && isAdmin && (
            <button className="btn btn-primary" onClick={handleCreate}>+ Create Preset</button>
          )}
        </div>

        {message && (
          <div className="card" style={{ padding: 14, marginBottom: 20, background: 'var(--status-info-soft)', border: '1px solid var(--status-info-soft)' }}>
            {message}
          </div>
        )}

        {loading ? (
          <p>Memuat preset...</p>
        ) : !editMode ? (
          /* List View Modern (Opsi 1: Tabs + Toolbar + Rich Cards Grid) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 1. Horizontal Tab Bar (Pipeline Kind) */}
            <div style={{
              display: 'flex',
              gap: '6px',
              borderBottom: '1px solid var(--border-subtle)',
              overflowX: 'auto',
              paddingBottom: '2px'
            }}>
              {TABS_CONFIG.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '9px 16px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                      borderBottom: isActive ? '2px solid var(--action-primary)' : '2px solid transparent',
                      color: isActive ? 'var(--action-primary)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                      userSelect: 'none'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '2px 7px',
                      borderRadius: 999,
                      backgroundColor: isActive ? 'var(--status-info-soft)' : 'var(--surface-interactive)',
                      color: isActive ? 'var(--action-primary)' : 'var(--text-muted)'
                    }}>
                      {tabCounts[tab.id] || 0}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 2. Toolbar Filter & Search */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau key preset..."
                  style={{
                    width: '280px',
                    padding: '8px 14px',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Menampilkan {filteredPresets.length} dari {presets.length} preset
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Audio:</span>
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'native_veo', label: '🔊 Native Veo' },
                  { id: 'minimax_tts', label: '🎙️ Minimax' }
                ].map(item => {
                  const active = audioFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAudioFilter(item.id)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: 999,
                        border: '1px solid',
                        borderColor: active ? 'var(--status-info)' : 'var(--border-subtle)',
                        backgroundColor: active ? 'var(--status-info-soft)' : 'var(--surface-raised)',
                        color: active ? 'var(--status-info)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}

                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>Tipe:</span>
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'system', label: '🔒 System' },
                  { id: 'custom', label: '✏️ Custom' }
                ].map(item => {
                  const active = typeFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTypeFilter(item.id)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: 999,
                        border: '1px solid',
                        borderColor: active ? 'var(--status-info)' : 'var(--border-subtle)',
                        backgroundColor: active ? 'var(--status-info-soft)' : 'var(--surface-raised)',
                        color: active ? 'var(--status-info)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Rich Preset Cards Grid */}
            {filteredPresets.length === 0 ? (
              <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Tidak ada preset yang cocok dengan filter
                </div>
                <p style={{ margin: 0, fontSize: '12.5px' }}>
                  Coba sesuaikan kata kunci pencarian atau ganti pilihan tab/chip di atas.
                </p>
                {(searchQuery || activeTab !== 'all' || audioFilter !== 'all' || typeFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveTab('all');
                      setAudioFilter('all');
                      setTypeFilter('all');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '14px' }}
                  >
                    Reset Semua Filter
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '16px'
              }}>
                {filteredPresets.map(p => {
                  const config = p.config || {};
                  const audioMode = config.workflow?.audio_engine_mode || config.basic_strategy?.audio_engine_mode || 'minimax_tts';
                  const persona = config.workflow?.google_voice_persona || config.basic_strategy?.google_voice_persona || 'Kore';
                  const model = config.visual_engine?.video_model || 'veo_31_lite';
                  const style = config.visual_engine?.visual_style || 'Cinematic';
                  const ratio = config.visual_engine?.aspect_ratio || '9:16';
                  const clips = config.visual_engine?.target_clips_count || 4;

                  return (
                    <div
                      key={p.key}
                      style={{
                        backgroundColor: 'var(--surface-interactive)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        boxShadow: 'var(--shadow-card)',
                        transition: 'transform 0.15s ease, border-color 0.15s ease'
                      }}
                    >
                      <div>
                        {/* Header: Label, Key, System/Custom Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div>
                            <strong style={{ fontSize: '1.02rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {p.label}
                            </strong>
                            <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '3px' }}>
                              Key: <code>{p.key}</code> · Rev: {p.revision}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: p.is_system ? 'var(--surface-raised)' : 'var(--status-purple-soft)',
                            color: p.is_system ? 'var(--text-muted)' : 'var(--status-purple)',
                            border: `1px solid ${p.is_system ? 'var(--border-subtle)' : 'var(--status-purple)'}`,
                            whiteSpace: 'nowrap'
                          }}>
                            {p.is_system ? '🔒 System' : '✏️ Custom'}
                          </span>
                        </div>

                        {/* Badges: Campaign Kind & Audio Engine */}
                        <div style={{ display: 'flex', gap: '6px', margin: '12px 0 10px 0', flexWrap: 'wrap', alignItems: 'center' }}>
                          {(p.campaign_kinds || []).map(kind => (
                            <span
                              key={kind}
                              style={{
                                fontSize: '11px',
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-xs)',
                                backgroundColor: 'var(--status-info-soft)',
                                color: 'var(--status-info)',
                                border: '1px solid var(--status-info)'
                              }}
                            >
                              {kind === 'product_campaign' ? '📦 Produk' : kind === 'recipe_campaign' ? '🍲 Resep Kuliner' : kind === 'multiplier_campaign' ? '🔀 Multiplier' : kind === 'recipe_labs' ? '🧪 Recipe Labs' : '🎬 Brand Editorial'}
                            </span>
                          ))}

                          {audioMode === 'native_veo' ? (
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor: 'var(--status-success-soft)',
                              color: 'var(--status-success)',
                              border: '1px solid var(--status-success)'
                            }}>
                              🔊 Native Veo [{persona}]
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor: 'var(--surface-raised)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-subtle)'
                            }}>
                              🎙️ Minimax TTS
                            </span>
                          )}

                          {p.campaign_kinds_source === 'inferred' && (
                            <span style={{ fontSize: '11px', color: 'var(--status-warning)' }}>
                              ⚠ Inferred
                            </span>
                          )}
                        </div>

                        {/* Specs Row */}
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap',
                          padding: '8px 0',
                          borderTop: '1px dashed var(--border-subtle)',
                          borderBottom: '1px dashed var(--border-subtle)'
                        }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                            📐 {ratio}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                            🎥 {model}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                            ✨ {style}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                            ⏱️ {clips} clips
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                        {p.is_system ? (
                          isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => handleClone(p)}>Clone</button>
                        ) : (
                          <>
                            {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(p)}>Edit</button>}
                            <button className="btn btn-secondary btn-sm" onClick={() => handleClone(p)}>Clone</button>
                            {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.key)}>Delete</button>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Form / Editor View */
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 20 }}>
              <h2 style={{ marginTop: 0, marginBottom: 16 }}>{isNew ? 'Buat Preset Baru' : `Edit Preset: ${form.label}`}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label className="form-label">
                  Nama Preset (Label)
                  <input
                    type="text"
                    className="form-input"
                    value={form.label}
                    onChange={e => setForm({ ...form, label: e.target.value })}
                    required
                    placeholder="Contoh: Brand Editorial Custom"
                  />
                </label>
                <label className="form-label">
                  Key Preset (Unique ID)
                  <input
                    type="text"
                    className="form-input"
                    value={form.key}
                    onChange={e => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    required
                    disabled={!isNew}
                    placeholder="Contoh: brand_editorial_custom_v1"
                  />
                </label>
              </div>
              <fieldset style={{marginTop:16,border:'1px solid var(--border-color)',borderRadius:8,padding:12}}><legend>Digunakan untuk Campaign</legend><div style={{display:'flex',gap:18,flexWrap:'wrap'}}>{[['brand_editorial','Brand Editorial'],['product_campaign','Product Campaign'],['recipe_campaign','Recipe Campaign']].map(([kind,label])=><label key={kind} style={{display:'flex',gap:7,alignItems:'center'}}><input type="checkbox" checked={form.campaign_kinds.includes(kind)} onChange={event=>setForm({...form,campaign_kinds:event.target.checked?[...new Set([...form.campaign_kinds,kind])]:form.campaign_kinds.filter(value=>value!==kind)})}/>{label}</label>)}</div>{form.campaign_kinds.length===0&&<small style={{color:'var(--status-danger)'}}>Pilih minimal satu jenis campaign.</small>}</fieldset>
            </div>

            {/* Accordion Panels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Accordion 1: Creative Strategy */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 0 ? -1 : 0)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 0 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 0 ? 'var(--accent-color)' : 'var(--text-primary)' }}>1. Creative Strategy (basic_strategy)</strong>
                  <span>{activeAccordion === 0 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 0 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Narrative Mode
                        <select className="form-select" value={form.narrative_mode} onChange={e => setForm({ ...form, narrative_mode: e.target.value })}>
                          <option value="auto">Auto (AI Decision)</option>
                          <option value="Storytelling">Storytelling</option>
                          <option value="Problem-Solution">Problem-Solution</option>
                          <option value="Educational">Educational</option>
                          <option value="Promo-Hook">Promo-Hook</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Target Language (Bahasa AI)
                        <select
                          className="form-select"
                          value={form.target_language}
                          onChange={e => {
                            const newLang = e.target.value;
                            const isEn = newLang === 'en-US';
                            const isCurrentVoiceEn = (form.voice_persona || '').startsWith('English');
                            let nextVoice = form.voice_persona;
                            if (isEn && !isCurrentVoiceEn) {
                              nextVoice = 'English_causual_narrator_vv1';
                            } else if (!isEn && isCurrentVoiceEn) {
                              nextVoice = 'Indonesian_professional_anchor_vv2';
                            }
                            setForm({ ...form, target_language: newLang, voice_persona: nextVoice });
                          }}
                        >
                          <option value="id-ID">🇮🇩 Indonesian (id-ID)</option>
                          <option value="en-US">🇺🇸 English (en-US)</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Promotion Style
                        <select className="form-select" value={form.promotion_style} onChange={e => setForm({ ...form, promotion_style: e.target.value })}>
                          <option value="Softselling">Softselling</option>
                          <option value="Hardselling">Hardselling</option>
                        </select>
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Target Demographic
                        <select className="form-select" value={form.target_demographic} onChange={e => setForm({ ...form, target_demographic: e.target.value })}>
                          <option value="genz_casual">Gen Z Casual Audience</option>
                          <option value="ibu_rumah_tangga">Ibu Rumah Tangga / Keluarga Muda</option>
                          <option value="professional">Professional / B2B</option>
                          <option value="general_public">General Public</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Nextcloud Parent Folder
                        <input type="text" className="form-input" value={form.nextcloud_parent_folder} onChange={e => setForm({ ...form, nextcloud_parent_folder: e.target.value })} />
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        SFX Setting
                        <select className="form-select" value={form.sfx_setting} onChange={e => setForm({ ...form, sfx_setting: e.target.value })}>
                          <option value="without_sfx">Without SFX</option>
                          <option value="smart_sfx">Smart SFX Insertion</option>
                        </select>
                      </label>
                      <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 24 }}>
                        <input type="checkbox" checked={form.enable_audio_segment} onChange={e => setForm({ ...form, enable_audio_segment: e.target.checked })} />
                        Enable Audio Segment
                      </label>
                    </div>

                    <label className="form-label">
                      AI Directive / Guardrail
                      <textarea className="form-input" rows={3} value={form.ai_directive} onChange={e => setForm({ ...form, ai_directive: e.target.value })} placeholder="Instruksi khusus kepada Gemini..." />
                    </label>

                    <label className="form-label">
                      Mandatory Outro Line
                      <textarea className="form-input" rows={2} value={form.mandatory_outro_line} onChange={e => setForm({ ...form, mandatory_outro_line: e.target.value })} placeholder="Kalimat wajib diucapkan di akhir video..." />
                    </label>
                  </div>
                )}
              </div>

              {/* Accordion 2: Aesthetics & Visual Settings */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 1 ? -1 : 1)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 1 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 1 ? 'var(--accent-color)' : 'var(--text-primary)' }}>2. Aesthetics & Visual (visual_engine)</strong>
                  <span>{activeAccordion === 1 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 1 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Visual Style
                        <select className="form-select" value={form.visual_style} onChange={e => setForm({ ...form, visual_style: e.target.value })}>
                          <option value="Cinematic">Cinematic</option>
                          <option value="UGC">UGC</option>
                          <option value="Macrophotography">Macrophotography</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Visual Mode
                        <select className="form-select" value={form.visual_mode} onChange={e => setForm({ ...form, visual_mode: e.target.value })}>
                          <option value="pure_t2v">Pure Text-to-Video</option>
                          <option value="hybrid_lock">Hybrid Image-to-Video Lock</option>
                          <option value="i2v">Image-to-Video Only</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Video Model
                        <select
                          className="form-select"
                          value={form.video_model}
                          onChange={e => {
                            const mod = e.target.value;
                            const newDur = (mod !== 'omni_flash' && form.clip_duration === 10) ? 8 : (form.clip_duration || 8);
                            setForm({
                              ...form,
                              video_model: mod,
                              clip_duration: newDur,
                              words_per_clip: (mod !== 'omni_flash' && form.clip_duration === 10) ? getDefaultWordsPerClip(8) : form.words_per_clip
                            });
                          }}
                        >
                          {VIDEO_MODELS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="form-label">
                        Durasi per Klip
                        <select
                          className="form-select"
                          value={form.clip_duration || 8}
                          onChange={e => {
                            const dur = Number(e.target.value);
                            setForm({
                              ...form,
                              clip_duration: dur,
                              words_per_clip: getDefaultWordsPerClip(dur)
                            });
                          }}
                        >
                          <option value={4}>4s per klip</option>
                          <option value={6}>6s per klip</option>
                          <option value={8}>8s per klip (Default)</option>
                          {form.video_model === 'omni_flash' && (
                            <option value={10}>10s per klip (Khusus Omni Flash)</option>
                          )}
                        </select>
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Aspect Ratio
                        <select className="form-select" value={form.aspect_ratio} onChange={e => setForm({ ...form, aspect_ratio: e.target.value })}>
                          <option value="9:16">Portrait 9:16</option>
                          <option value="16:9">Landscape 16:9</option>
                          <option value="1:1">Square 1:1</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Face Visibility
                        <select className="form-select" value={form.face_visibility} onChange={e => setForm({ ...form, face_visibility: e.target.value })}>
                          <option value="Faceless">Faceless (Tanpa Wajah - Fokus Aksi Tangan)</option>
                          <option value="POV">POV (Sudut Pandang Kamera Utama)</option>
                          <option value="Silhouette">Silhouette (Estetik Siluet)</option>
                          <option value="cartoon_face">Cartoon Face (Kartun Ekspresif)</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Words per Clip ({form.clip_duration || 8}s)
                        <select className="form-select" value={form.words_per_clip} onChange={e => setForm({ ...form, words_per_clip: e.target.value })}>
                          {getWordsPerClipOptions(form.clip_duration || 8).map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="form-label">
                      Target Clips Count
                      <input type="number" className="form-input" min="1" max="12" value={form.target_clips_count} onChange={e => setForm({ ...form, target_clips_count: e.target.value })} />
                    </label>
                  </div>
                )}
              </div>

              {/* Accordion 3: Product Bridging Settings */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 2 ? -1 : 2)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 2 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 2 ? 'var(--accent-color)' : 'var(--text-primary)' }}>3. Product Bridging (product_bridging)</strong>
                  <span>{activeAccordion === 2 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 2 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <input type="checkbox" checked={form.is_bridging_active} onChange={e => setForm({ ...form, is_bridging_active: e.target.checked })} />
                      Aktifkan Product Bridging
                    </label>

                    {form.is_bridging_active && (
                      <div style={{ display: 'grid', gap: 14 }}>
                        <label className="form-label">
                          Bridging Mode
                          <select className="form-select" value={form.bridging_mode} onChange={e => setForm({ ...form, bridging_mode: e.target.value })}>
                            <option value="select_existing">Select Existing Product Photo</option>
                            <option value="manual_input">Manual Prompt Only</option>
                          </select>
                        </label>
                        <BridgeSegmentsEditor
                          segments={form.bridge_segments}
                          onChange={(nextSegments) => {
                            const first = nextSegments[0] || { at_clip: 3, duration_clips: 1 };
                            setForm({
                              ...form,
                              bridge_segments: nextSegments,
                              bridge_at_clip: Number(first.at_clip ?? 3),
                              bridge_duration_clips: Number(first.duration_clips ?? 1)
                            });
                          }}
                          targetClips={Number(form.target_clips_count || 7)}
                          fallbackAtClip={Number(form.bridge_at_clip ?? 3)}
                          fallbackDurationClips={Number(form.bridge_duration_clips ?? 1)}
                          singleZoneOnly={form.visual_style === 'investigative_faceless'}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Accordion 4: Visual Swap Overrides (VSO) */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 3 ? -1 : 3)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 3 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 3 ? 'var(--accent-color)' : 'var(--text-primary)' }}>4. Visual Identity</strong>
                  <span>{activeAccordion === 3 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 3 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <input type="checkbox" checked={form.is_vso_active} onChange={e => setForm({ ...form, is_vso_active: e.target.checked })} />
                      Aktifkan VSO (Mascot / Custom Character)
                    </label>

                    {form.is_vso_active && (
                      <VisualIdentitySelector
                        value={{
                          preset_id: form.visual_identity_preset_id,
                          inline_config: form.visual_identity_inline_config,
                          visual_overrides_json: form.visual_overrides_json
                        }}
                        onChange={(val) => setForm({
                          ...form,
                          visual_identity_preset_id: val.preset_id,
                          visual_identity_inline_config: val.inline_config,
                          visual_overrides_json: val.visual_overrides_json
                        })}
                        allowLegacyCustom={true}
                        campaignKind="brand_editorial"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Accordion 5: Workflow & Production Settings */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 4 ? -1 : 4)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 4 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 4 ? 'var(--accent-color)' : 'var(--text-primary)' }}>5. Workflow & Audio (workflow)</strong>
                  <span>{activeAccordion === 4 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 4 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Approval Mode
                        <select className="form-select" value={form.approval_mode} onChange={e => setForm({ ...form, approval_mode: e.target.value })}>
                          <option value="storyboard">Manual Review (Awaiting Storyboard Approval)</option>
                          <option value="start_frames">Pause at Start Frames (Review Before TTS)</option>
                          <option value="none">Full Auto (No Approval Needed)</option>
                        </select>
                      </label>
                      <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 24 }}>
                        <input type="checkbox" checked={form.enable_tts} onChange={e => setForm({ ...form, enable_tts: e.target.checked })} />
                        Enable TTS Voice-Over
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                      <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input type="checkbox" checked={form.auto_sync_contentflow} onChange={e => setForm({ ...form, auto_sync_contentflow: e.target.checked })} />
                        Auto Sync ke ContentFlow Pipeline
                      </label>
                    </div>

                    {/* Audio Generation Engine Switcher */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 16, background: 'var(--surface-raised)', display: 'grid', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                          🎙️ Audio Generation Engine
                        </label>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                          Tentukan apakah audio narasi dihasilkan via Minimax TTS eksternal atau disintesis native langsung oleh Google Veo 3.1.
                        </p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {/* Mode 1 Card */}
                        <div
                          onClick={() => setForm({ ...form, audio_engine_mode: 'minimax_tts' })}
                          style={{
                            padding: 14,
                            borderRadius: 8,
                            border: form.audio_engine_mode !== 'native_veo' ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                            background: form.audio_engine_mode !== 'native_veo' ? 'var(--surface-interactive)' : 'var(--surface)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>🎙️ Mode 1: Minimax TTS Mux</strong>
                            <input
                              type="radio"
                              name="audio_engine_mode"
                              checked={form.audio_engine_mode !== 'native_veo'}
                              onChange={() => setForm({ ...form, audio_engine_mode: 'minimax_tts' })}
                            />
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            Narasi voice-over dibuat lewat MiniMax TTS, video Veo di-render silent, lalu di-mux otomatis dengan FFmpeg.
                          </p>
                        </div>

                        {/* Mode 2 Card */}
                        <div
                          onClick={() => setForm({ ...form, audio_engine_mode: 'native_veo' })}
                          style={{
                            padding: 14,
                            borderRadius: 8,
                            border: form.audio_engine_mode === 'native_veo' ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                            background: form.audio_engine_mode === 'native_veo' ? 'var(--surface-interactive)' : 'var(--surface)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>🔊 Mode 2: Native Veo 3.1 Audio</strong>
                            <input
                              type="radio"
                              name="audio_engine_mode"
                              checked={form.audio_engine_mode === 'native_veo'}
                              onChange={() => setForm({ ...form, audio_engine_mode: 'native_veo' })}
                            />
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            Suara dialog &amp; Foley SFX digenerate langsung oleh Google Veo 3.1 diffusion. <strong>⚡ Hemat kuota TTS Minimax.</strong>
                          </p>
                        </div>
                      </div>

                      {/* Mode 2 Options */}
                      {form.audio_engine_mode === 'native_veo' && (
                        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 14, display: 'grid', gap: 14 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 14 }}>
                            <label className="form-label">
                              Google Voice Persona
                              <select
                                className="form-select"
                                value={form.google_voice_persona || 'Kore'}
                                onChange={e => setForm({ ...form, google_voice_persona: e.target.value })}
                              >
                                {GOOGLE_VOICE_PERSONAS.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.id} ({p.gender === 'female' ? 'Wanita' : 'Pria'} - {p.style})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Deskripsi Karakter Vokal Veo:
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--surface)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                                &ldquo;{GOOGLE_VOICE_PERSONAS.find(p => p.id === (form.google_voice_persona || 'Kore'))?.descriptionEn || 'Clear and natural voice'}&rdquo;
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: 'var(--surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(form.enable_native_sfx)}
                                onChange={e => setForm({ ...form, enable_native_sfx: e.target.checked })}
                              />
                              <span>🔊 Foley SFX Fisik Tersinkron</span>
                            </label>
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(form.enable_native_ambience)}
                                onChange={e => setForm({ ...form, enable_native_ambience: e.target.checked })}
                              />
                              <span>🍃 Ambience Ruangan Alami</span>
                            </label>
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(form.anti_music_guardrail)}
                                onChange={e => setForm({ ...form, anti_music_guardrail: e.target.checked })}
                              />
                              <span>🛡️ Anti-Music Overlap Guardrail</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {form.audio_engine_mode !== 'native_veo' && form.enable_tts && (
                      <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, display: 'grid', gap: 12 }}>
                        <legend style={{ padding: '0 8px', fontSize: 13, fontWeight: 600 }}>🔊 TTS Audio Engine Settings</legend>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                          <label className="form-label">
                            TTS Provider
                            <select className="form-select" value={form.voice_provider} onChange={e => {
                              const newProvider = e.target.value;
                              let newPersona = form.voice_persona;
                              if (newProvider === 'elevenlabs') {
                                const isEn = String(form.target_language || '').toLowerCase().startsWith('en');
                                newPersona = isEn ? 'UgBBYS2sOqTuMpoF3BR0' : 'zmqLb9Ysr8fUvDD7hXK8';
                              }
                              setForm({ ...form, voice_provider: newProvider, voice_persona: newPersona });
                            }}>
                              <option value="minimax">MiniMax VO Engine</option>
                              <option value="gemini">Gemini TTS Engine</option>
                              <option value="elevenlabs">ElevenLabs TTS Engine (Ultra-Realistic)</option>
                            </select>
                          </label>
                          <label className="form-label">
                            Voice Persona
                            <select className="form-select" value={form.voice_persona} onChange={e => setForm({ ...form, voice_persona: e.target.value })}>
                              {getVoices().map(v => (
                                <option key={v.id} value={v.id}>{v.name} - {v.desc}</option>
                              ))}
                            </select>
                          </label>
                          {form.voice_provider === 'elevenlabs' ? (
                            <label className="form-label">
                              ElevenLabs Model
                              <select className="form-select" value={form.elevenlabs_model || 'eleven_multilingual_v2'} onChange={e => setForm({ ...form, elevenlabs_model: e.target.value })}>
                                <option value="eleven_multilingual_v2">Multilingual v2 (Rekomendasi ID/EN)</option>
                                <option value="eleven_turbo_v2_5">Turbo v2.5 (Ultra-Fast 300ms)</option>
                                <option value="eleven_flash_v2_5">Flash v2.5 (Super Ringan)</option>
                              </select>
                            </label>
                          ) : (
                            <label className="form-label">
                              TTS Model Quality
                              <select className="form-select" value={form.tts_model_quality} onChange={e => setForm({ ...form, tts_model_quality: e.target.value })}>
                                <option value="speech-2.8-turbo">Speech 2.8 Turbo</option>
                                <option value="speech-2.8-standard">Speech 2.8 Standard</option>
                              </select>
                            </label>
                          )}
                        </div>

                        {form.voice_provider === 'elevenlabs' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                            <label className="form-label">
                              Custom Voice ID (VoiceLab)
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Opsional: Voice ID Kloningan"
                                value={form.elevenlabs_custom_voice_id || ''}
                                onChange={e => setForm({ ...form, elevenlabs_custom_voice_id: e.target.value })}
                              />
                            </label>
                            <label className="form-label">
                              Voice Stability ({form.elevenlabs_stability ?? 0.50})
                              <input
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.05"
                                value={form.elevenlabs_stability ?? 0.50}
                                onChange={e => setForm({ ...form, elevenlabs_stability: parseFloat(e.target.value) })}
                                style={{ width: '100%' }}
                              />
                            </label>
                            <label className="form-label">
                              Similarity Boost ({form.elevenlabs_similarity_boost ?? 0.75})
                              <input
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.05"
                                value={form.elevenlabs_similarity_boost ?? 0.75}
                                onChange={e => setForm({ ...form, elevenlabs_similarity_boost: parseFloat(e.target.value) })}
                                style={{ width: '100%' }}
                              />
                            </label>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <label className="form-label">
                            Voice Speed ({form.voice_speed}x)
                            <input type="range" min="0.5" max="2.0" step="0.1" value={form.voice_speed} onChange={e => setForm({ ...form, voice_speed: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                          </label>
                          <label className="form-label">
                            Voice Volume ({form.voice_volume}x)
                            <input type="range" min="0.1" max="1.0" step="0.1" value={form.voice_volume} onChange={e => setForm({ ...form, voice_volume: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                          </label>
                        </div>
                      </fieldset>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input type="checkbox" checked={form.enable_glabs} onChange={e => setForm({ ...form, enable_glabs: e.target.checked })} />
                        Enable G-Labs (Webhook Rendering)
                      </label>
                      <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input type="checkbox" checked={form.enable_ffmpeg} onChange={e => setForm({ ...form, enable_ffmpeg: e.target.checked })} />
                        Enable FFmpeg Video Muxing
                      </label>
                    </div>

                    {form.enable_ffmpeg && (
                      <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, display: 'grid', gap: 12 }}>
                        <legend style={{ padding: '0 8px', fontSize: 13, fontWeight: 600 }}>🎞️ FFmpeg Render Settings</legend>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
                          <label className="form-label">
                            Sync Option
                            <select className="form-select" value={form.ffmpeg_sync_option} onChange={e => setForm({ ...form, ffmpeg_sync_option: e.target.value })}>
                              <option value="smart_sync">Smart Sync (Auto Fit)</option>
                              <option value="pad_end">Pad End</option>
                              <option value="loop">Loop</option>
                            </select>
                          </label>
                          <label className="form-label">
                            Video Scale (Zoom: {Math.round(form.ffmpeg_video_scale * 100)}%)
                            <input type="range" min="1.0" max="2.0" step="0.05" value={form.ffmpeg_video_scale} onChange={e => setForm({ ...form, ffmpeg_video_scale: parseFloat(e.target.value) })} style={{ width: '100%', padding: 0 }} />
                          </label>
                          <label className="form-label">
                            BGM Volume ({form.ffmpeg_bgm_volume}x)
                            <input type="range" min="0.0" max="1.0" step="0.05" value={form.ffmpeg_bgm_volume} onChange={e => setForm({ ...form, ffmpeg_bgm_volume: parseFloat(e.target.value) })} style={{ width: '100%', padding: 0 }} />
                          </label>
                          <label className="form-label">
                            SFX Volume ({form.ffmpeg_sfx_volume}x)
                            <input type="range" min="0.0" max="1.0" step="0.05" value={form.ffmpeg_sfx_volume} onChange={e => setForm({ ...form, ffmpeg_sfx_volume: parseFloat(e.target.value) })} style={{ width: '100%', padding: 0 }} />
                          </label>
                        </div>
                      </fieldset>
                    )}

                  </div>
                )}
              </div>

              {/* Accordion 6: Finishing Video & Pascaproduksi FFmpeg */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 5 ? -1 : 5)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 5 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 5 ? 'var(--accent-color)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🎬</span> 6. Finishing Video &amp; Pascaproduksi FFmpeg (Subtitel &amp; Transisi)
                  </strong>
                  <span>{activeAccordion === 5 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 5 && (
                  <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Subtitel / Motion Text */}
                    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, marginBottom: 4 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>✨</span> Subtitel &amp; Motion Text Video
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        Animasi teks grafis yang disinkronkan dengan narasi audio voice-over saat render FFmpeg (⚡ 0 Biaya AI).
                      </p>
                    </div>

                    <div>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(form.enable_motion_text)}
                          onChange={e => setForm({ ...form, enable_motion_text: e.target.checked })}
                        />
                        Aktifkan Subtitel Grafis (Motion Text)
                      </label>
                      <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        Jika dinonaktifkan, video akan diekspor bersih (*clean video* tanpa overlay teks grafis).
                      </small>
                    </div>

                    <div>
                      <label className="form-label">
                        Template Style Subtitel
                        <select
                          className="form-select"
                          value={form.motion_text_style || 'floating_white_yellow'}
                          onChange={e => setForm({ ...form, motion_text_style: e.target.value })}
                          disabled={!form.enable_motion_text}
                        >
                          <option value="floating_white_yellow">🟡 Floating Putih ➔ Kuning (Viral Reels/TikTok)</option>
                          <option value="floating_black_on_white">🔲 Floating Hitam BG Putih (CapCut Pill)</option>
                          <option value="minimal_white">◻️ Minimalist Clean White Card (Super Slim)</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <label className="form-label">
                        Posisi Subtitel di Layar
                        <select
                          className="form-select"
                          value={form.motion_text_position || 'bottom'}
                          onChange={e => setForm({ ...form, motion_text_position: e.target.value })}
                          disabled={!form.enable_motion_text}
                        >
                          <option value="bottom">Bawah Layar (Standar Reels / TikTok / Shorts)</option>
                          <option value="center">Tengah Layar</option>
                          <option value="top">Atas Layar</option>
                        </select>
                      </label>
                    </div>

                    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, marginTop: 12, marginBottom: 4 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>✂️</span> Efek Sambungan Transisi Antar Klip (FFmpeg XFade)
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        Animasi pergantian antar adegan video klip (0 biaya kredit AI, diproses hardware-accelerated).
                      </p>
                    </div>

                    <div>
                      <label className="form-label">
                        Pilihan Efek Transisi Video
                        <select
                          className="form-select"
                          value={form.video_transition || 'cut'}
                          onChange={e => setForm({ ...form, video_transition: e.target.value })}
                        >
                          <option value="fade">Fade — Smooth Dissolve (Default)</option>
                          <option value="slideleft">SlideLeft — Geser Kiri Alur Resep Dinamis</option>
                          <option value="fadewhite">FadeWhite — White Flash Energik</option>
                          <option value="fadeblack">FadeBlack — Fade Gelap Bioskop</option>
                          <option value="zoomin">ZoomIn — Kamera Mendorong Masuk</option>
                          <option value="circleopen">CircleOpen — Lingkaran Iris Retro</option>
                          <option value="cut">Cut — Hard Cut Langsung</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <label className="form-label">
                        Durasi Transisi Antar Klip
                        <select
                          className="form-select"
                          value={form.transition_duration !== undefined ? String(form.transition_duration) : '0.5'}
                          onChange={e => setForm({ ...form, transition_duration: Number(e.target.value) })}
                        >
                          <option value="0.3">0.3 Detik (Cepat &amp; Punchy)</option>
                          <option value="0.5">0.5 Detik (Standar Mulus)</option>
                          <option value="0.8">0.8 Detik (Halus Sinematik)</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    marginTop: '14px',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px'
                  }}
                >
                  <div>
                    <label className="form-label">
                      Template Finishing Pass (Playwright + Camera Zoom)
                      <select
                        className="form-select"
                        value={form.finishing_template || 'none'}
                        onChange={e => setForm({ ...form, finishing_template: e.target.value })}
                      >
                        {FINISHING_TEMPLATE_REGISTRY.map(tpl => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div>
                    <label className="form-label">
                      Mode Subtitle / Caption Overlay
                      <select
                        className="form-select"
                        value={form.caption_mode || 'hybrid'}
                        onChange={e => setForm({ ...form, caption_mode: e.target.value })}
                      >
                        <option value="hybrid">Hybrid — Keyword Punch + Subtitles Ringkas</option>
                        <option value="keyword_only">Keyword Only — Hook &amp; Keyword Punch Saja</option>
                        <option value="full">Full — Subtitle Baris Lengkap (Legacy Mode)</option>
                      </select>
                    </label>
                  </div>

                  <div>
                    <label className="form-label">
                      Target Loudness Audio (LUFS)
                      <select
                        className="form-select"
                        value={form.loudness_target !== undefined ? String(form.loudness_target) : '-14'}
                        onChange={e => setForm({ ...form, loudness_target: Number(e.target.value) })}
                      >
                        <option value="-14">-14 LUFS (Standar TikTok &amp; Reels)</option>
                        <option value="-16">-16 LUFS (Calm / Shorts)</option>
                      </select>
                    </label>
                  </div>
                </div>

                {(() => {
                  const selectedTplMeta = getFinishingTemplateMeta(form.finishing_template || 'none');
                  const kinds = form.campaign_kinds || [];
                  const compatKinds = selectedTplMeta?.compatibilityCampaignKinds || [];
                  if (selectedTplMeta?.id === 'none' || compatKinds.length === 0) return null;
                  const matches = kinds.some(k => compatKinds.includes(k));
                  if (!matches) {
                    return (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'var(--status-warning-soft)',
                          border: '1px solid var(--status-warning)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          lineHeight: 1.45
                        }}
                      >
                        ⚠️ <strong>Peringatan Kompatibilitas Campaign:</strong> Template <code>{selectedTplMeta.id}</code> paling cocok untuk <code>{compatKinds.join(', ')}</code>. Elemen yang tidak tersedia pada data campaign akan disembunyikan otomatis.
                      </div>
                    );
                  }
                  const betterRecipes = FINISHING_TEMPLATE_REGISTRY.find(
                    t => t.id !== selectedTplMeta.id && t.layers?.recipe && kinds.some(k => (t.compatibilityCampaignKinds || []).includes(k))
                  );
                  if (betterRecipes && !selectedTplMeta.layers?.recipe && kinds.includes('recipe_campaign')) {
                    return (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'var(--status-info-soft)',
                          border: '1px solid var(--status-info)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          lineHeight: 1.45
                        }}
                      >
                        ℹ️ <strong>Info Template:</strong> Preset ini mencakup <code>recipe_campaign</code>. Untuk menampilkan layer bahan &amp; langkah resep, Anda juga dapat memakai <code>{betterRecipes.id}</code>.
                      </div>
                    );
                  }
                  return null;
                })()}

                <FinishingTemplatePreview
                  finishingTemplate={form.finishing_template || 'none'}
                  captionMode={form.caption_mode || 'hybrid'}
                  loudnessTarget={form.loudness_target !== undefined ? Number(form.loudness_target) : -14}
                  targetLanguage={form.target_language || 'id-ID'}
                  motionStyle={form.motion_text_style || 'floating_white_yellow'}
                  motionPosition={form.motion_text_position || 'bottom'}
                />
              </div>

            </div>

            {/* Form Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save Preset'}</button>
            </div>
          </form>
        )}
          <footer style={{ marginTop: '80px', padding: '24px 0', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            © 2026 MaknaFlow
          </footer>
        </div>
      </main>
    </div>
  );
}
