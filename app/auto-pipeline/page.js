'use client';

import Sidebar from '../components/Sidebar';
import ScheduleCalendarView from '../components/ScheduleCalendarView';
import ScheduleTableView from '../components/ScheduleTableView';
import ThreadsSeriesForm from './ThreadsSeriesForm';
import AutoPipelineQueueDrawer from '../components/AutoPipelineQueueDrawer';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GRID_LAYOUT_COORDINATES } from '@/lib/core/GridCoordinates';

const LAYOUT_PRESET_METADATA = {
  3: [
    { id: '3_split_left', name: 'Editorial Tri-Split Left', desc: 'Kolom kiri penuh (hero) & 2 blok proses kanan' },
    { id: '3_split_right', name: 'Tri-Split Right Mirror', desc: '2 blok persiapan kiri & kolom kanan penuh (hero)' },
    { id: '3_stacked_horizontal', name: 'Landscape Cascade', desc: '3 strip horizontal bertingkat alur waktu' }
  ],
  4: [
    { id: '4_editorial_split', name: 'Editorial Split (Default)', desc: 'Kolom kiri lebar, 2 proses kanan, banner saji bawah' },
    { id: '4_modern_masonry', name: 'Modern Masonry', desc: 'Banner atas megah diikuti susunan kolom asimetris estetik' },
    { id: '4_landscape_cascade', name: 'Vertical Story Cascade 4', desc: '4 strip bertumpuk naratif proses sekuensial' }
  ],
  5: [
    { id: '5_pentagon_grid', name: 'Pentagon Asymmetric', desc: 'Susunan dinamis 5 modul foto dengan banner bawah' },
    { id: '5_step_cascade', name: 'Story Step-by-Step 5', desc: '5 strip bertingkat dramatis step-by-step' },
    { id: '5_magazine_editorial', name: 'Magazine Editorial', desc: 'Hero banner kolom kiri & 4 grid proses di kanan' }
  ],
  6: [
    { id: '6_magazine_spread', name: 'Magazine Hexa-Grid', desc: 'Tata letak majalah kuliner komprehensif 6 slot' },
    { id: '6_vertical_masonry', name: 'Pinterest Masonry Style', desc: 'Gaya visual masonry pinterest dinamis 6 slot' },
    { id: '6_asymmetric_mosaic', name: 'Modern Asymmetric Mosaic', desc: 'Mosaik asimetris modern untuk resep kaya bumbu' }
  ]
};

const CEP_OPTIONS = [
  {
    id: 'auto',
    value: 'auto',
    label: 'Auto (Rekomendasi AI)',
    icon: '⚡',
    desc: 'Rotasi dinamis alami anti-bosan sesuai riwayat konten produk.',
    shortDesc: 'Rotasi dinamis alami anti-bosan sesuai riwayat konten produk.',
    arcHookTitle: 'Babak 1: Hook Pembuka Adaptif',
    arcHookDesc: 'AI memilih hook kontras atau pertanyaan retoris paling segar.'
  },
  {
    id: 'Problem-Solution Based',
    value: 'Problem-Solution Based',
    label: 'Problem-Solution Based',
    icon: '🎯',
    desc: 'Angkat rasa sakit & keluhan harian (stamina drop, mudah masuk angin).',
    shortDesc: 'Angkat rasa sakit & keluhan harian (stamina drop, mudah masuk angin).',
    arcHookTitle: 'Babak 1: Hook Gejala Masalah & Pain Point',
    arcHookDesc: 'Menyorot rasa frustrasi tubuh lemas & daya tahan turun saat kerja padat.'
  },
  {
    id: 'Routine Based',
    value: 'Routine Based',
    label: 'Routine Based',
    icon: '⏰',
    desc: 'Integrasikan ke ritual pagi/malam (1 sendok rutin sebelum sarapan).',
    shortDesc: 'Integrasikan ke ritual pagi/malam (1 sendok rutin sebelum sarapan).',
    arcHookTitle: 'Babak 1: Hook Momen Rutinitas Keseharian',
    arcHookDesc: 'Trigger rutinitas pagi sebelum berangkat kantor: ritual sehat praktis.'
  },
  {
    id: 'Emotional Based',
    value: 'Emotional Based',
    label: 'Emotional Based',
    icon: '❤️',
    desc: 'Kepedulian keluarga, rasa cemas orang tua jatuh sakit, atau kasih sayang.',
    shortDesc: 'Kepedulian keluarga, rasa cemas orang tua jatuh sakit, atau kasih sayang.',
    arcHookTitle: 'Babak 1: Hook Empati & Sentuhan Emosional',
    arcHookDesc: 'Momen kekhawatiran saat orang tersayang mulai sering jatuh sakit.'
  },
  {
    id: 'Aspirational Based',
    value: 'Aspirational Based',
    label: 'Aspirational Based',
    icon: '✨',
    desc: 'Gaya hidup sehat alami, upgrade diri, vitalitas tanpa obat kimia.',
    shortDesc: 'Gaya hidup sehat alami, upgrade diri, vitalitas tanpa obat kimia.',
    arcHookTitle: 'Babak 1: Hook Kontras Gaya Hidup Ideal',
    arcHookDesc: 'Visual kontras: hidup lesu vs energi prima bugar sepanjang hari.'
  },
  {
    id: 'Commitment Based',
    value: 'Commitment Based',
    label: 'Commitment Based',
    icon: '💪',
    desc: 'Tantangan konsistensi (bukti perubahan tubuh setelah 14 hari rutin).',
    shortDesc: 'Tantangan konsistensi (bukti perubahan tubuh setelah 14 hari rutin).',
    arcHookTitle: 'Babak 1: Hook Tantangan Konsistensi Diri',
    arcHookDesc: 'Pertanyaan pembuktian: "Apa yang terjadi pada tubuh setelah 14 hari konsumsi rutin?"'
  },
  {
    id: 'Opportunistic Based',
    value: 'Opportunistic Based',
    label: 'Opportunistic Based',
    icon: '🌦️',
    desc: 'Trigger situasi: cuaca pancaroba, musim hujan, lembur, perjalanan.',
    shortDesc: 'Trigger situasi: cuaca pancaroba, musim hujan, lembur, perjalanan.',
    arcHookTitle: 'Babak 1: Hook Pemicu Situasi & Momen Khusus',
    arcHookDesc: 'Kondisi pancaroba & rekan kantor mulai batuk pilek: alarm benteng tubuh.'
  }
];

const SLOT_DEFAULT_ROLES = [
  'Bahan Mentah',
  'Persiapan & Bumbu',
  'Proses Memasak',
  'Sajian Akhir',
  'Detail Garnish',
  'Plating Piring'
];

const SLOT_GRADIENTS = [
  "linear-gradient(135deg, var(--surface-interactive) 0%, var(--surface-interactive) 100%)",
  "linear-gradient(135deg, var(--surface-interactive) 0%, var(--surface-interactive) 100%)",
  "linear-gradient(135deg, var(--surface-interactive) 0%, var(--surface-interactive) 100%)",
  "linear-gradient(135deg, var(--surface-interactive) 0%, var(--surface-interactive) 100%)",
  "linear-gradient(135deg, var(--surface-interactive) 0%, var(--surface-interactive) 100%)",
  "linear-gradient(135deg, var(--surface-interactive) 0%, var(--surface-interactive) 100%)"
];

const INTERNATIONAL_RECIPE_TAXONOMY = {
  en_US: {
    label: '🇺🇸 Global English (International / US & UK Standard)',
    placeholderKeyword: 'e.g., Crispy Honey Garlic Air Fryer Chicken Bites',
    categories: [
      { group: 'Core Meal Courses', options: [
        'Main Courses & Entrees',
        'Breakfast & Brunch Favorites',
        'Appetizers, Starters & Small Bites',
        'Soups, Stews & Slow-Cooked Bowls',
        'Salads & Fresh Grain Bowls'
      ]},
      { group: 'Modern Lifestyle & Performance', options: [
        'Quick & Easy Weeknight Dinners (Under 20 Mins)',
        'Air Fryer & Convection Essentials',
        'High-Protein Meal Prep & Fitness',
        'Low-Carb, Keto & Diabetic-Friendly',
        '100% Plant-Based & Gourmet Vegan'
      ]},
      { group: 'Bakery & Beverages', options: [
        'Desserts, Pastries & Artisanal Bakery',
        'Specialty Drinks, Smoothies & Coffee'
      ]}
    ]
  },
  id_ID: {
    label: '🇮🇩 Bahasa Indonesia (Pasar Domestik & UMKM)',
    placeholderKeyword: 'Contoh: Ayam Bakar Madu Pedas Manis Gurih',
    categories: [
      { group: 'Waktu Makan Utama', options: [
        'Menu Hidangan Utama & Lauk Pauk (Main Course)',
        'Menu Sarapan Praktis & Cepat (Breakfast)',
        'Camilan, Gorengan Gurih & Finger Food',
        'Sup Hangat, Sayur Kuah & Soto Nusantara',
        'Masakan Tradisional Nusantara & Aneka Sambal'
      ]},
      { group: 'Gaya Hidup & Kepraktisan Masak', options: [
        'Menu Praktis 15-20 Menit (One-Pan / Tumisan)',
        'Kreasi Masakan Air Fryer Sehat',
        'Menu Tinggi Protein & Meal Prep Fitnes',
        'Menu Rendah Kalori, Diet Sehat & Sayuran'
      ]},
      { group: 'Kue & Minuman', options: [
        'Kue, Dessert Manis & Roti Rumahan',
        'Minuman Segar, Es Nusantara & Kopi Kekinian'
      ]}
    ]
  },
  bilingual: {
    label: '🌐 Bilingual (Global English Hook + Indonesian Body)',
    placeholderKeyword: 'e.g., Crispy Garlic Butter Wings / Sayap Ayam Mentega Krispi',
    categories: [
      { group: 'Courses / Waktu Makan', options: [
        'Main Courses & Entrees (Hidangan Utama)',
        'Breakfast & Morning Favorites (Sarapan Sehat)',
        'Appetizers & Finger Foods (Camilan & Snack)'
      ]},
      { group: 'Modern Cooking Trends', options: [
        'Quick & Easy Weeknight Dinners (Menu Praktis Cepat)',
        'Air Fryer & Convection Essentials (Masakan Air Fryer)',
        'High-Protein Fitness Meal Prep (Menu Tinggi Protein)'
      ]},
      { group: 'Bakery & Drinks', options: [
        'Desserts & Artisanal Bakery (Kue & Hidangan Manis)',
        'Specialty Beverages & Coffee (Minuman & Kopi)'
      ]}
    ]
  }
};

export default function AutoPipelinePage() {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [operatorPresets, setOperatorPresets] = useState([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState('');
  const [activePresetConfig, setActivePresetConfig] = useState(null);
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetHint, setPresetHint] = useState('');
  const [topic, setTopic] = useState('air fryer chicken thighs');
  const [category, setCategory] = useState('makanan_utama');
  const [isCategoryManuallySelected, setIsCategoryManuallySelected] = useState(false);
  const [recipeCount, setRecipeCount] = useState(1);
  const [executionMode, setExecutionMode] = useState('full_autopilot');

  // --- ANTRIAN EKSEKUSI PIPELINE (FIFO QUEUE) ---
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [queueSummary, setQueueSummary] = useState({ queued: 0, processing: 0, completed: 0, failed: 0 });

  useEffect(() => {
    const checkQueue = async () => {
      try {
        const res = await fetch('/api/v2/recipes/autonomous-pipeline/queue');
        const data = await res.json();
        if (data.success && data.summary) {
          setQueueSummary(data.summary);
        }
      } catch (_) {}
    };
    checkQueue();
    const interval = setInterval(checkQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  // --- MULTI-CAMPAIGN STATE UNTUK TAB 1 (1-KLIK INSTAN) ---
  const [instantCampaignType, setInstantCampaignType] = useState('recipe_campaign'); // 'recipe_campaign' | 'product_campaign' | 'editorial_campaign' | 'multiplier_campaign' | 'recipe_labs'
  const [instantProductId, setInstantProductId] = useState('');
  const [instantPillar, setInstantPillar] = useState('');
  const [instantEditorialMode, setInstantEditorialMode] = useState('pillar'); // 'pillar' | 'keyword'
  const [instantEditorialKeyword, setInstantEditorialKeyword] = useState('');
  const [instantProductSearch, setInstantProductSearch] = useState('');
  const [instantPillarSearch, setInstantPillarSearch] = useState('');

  // Multiplier Campaign State (Tab 1)
  const [blueprints, setBlueprints] = useState([]);
  const [loadingBlueprints, setLoadingBlueprints] = useState(false);
  const [instantBlueprintId, setInstantBlueprintId] = useState('');
  const [multiplierAngles, setMultiplierAngles] = useState([]);
  const [selectedAngleIndex, setSelectedAngleIndex] = useState(0);
  const [loadingAngles, setLoadingAngles] = useState(false);
  const [blueprintSearchQuery, setBlueprintSearchQuery] = useState('');

  // Recipe Labs (Text & Photo Composite Grid) State (Tab 1)
  const [instantTargetLanguage, setInstantTargetLanguage] = useState('en_US');
  const [instantRecipeClassification, setInstantRecipeClassification] = useState('Quick & Easy Weeknight Dinners (Under 20 Mins)');
  const [recipeLabsTopic, setRecipeLabsTopic] = useState('Crispy Honey Garlic Air Fryer Chicken Bites');
  const [recipeLabsCategory, setRecipeLabsCategory] = useState('Quick & Easy Weeknight Dinners (Under 20 Mins)');
  const [instantRecipeAspectRatio, setInstantRecipeAspectRatio] = useState('3:4');
  const [recipeLabsVisualStyle, setRecipeLabsVisualStyle] = useState('Modern Minimalist Nordic Studio');
  const [imagesPerRecipe, setImagesPerRecipe] = useState(4);
  const [selectedLayoutId, setSelectedLayoutId] = useState('4_editorial_split');
  const [gridGapSize, setGridGapSize] = useState(12);
  const [gridBorderRadius, setGridBorderRadius] = useState(16);
  const [gridOuterPadding, setGridOuterPadding] = useState(16);
  const [gridBgColor, setGridBgColor] = useState('#0d0d12');
  const [postToFacebook, setPostToFacebook] = useState(true);

  // CEP (Category Entry Point) & Promotion Context State
  const [selectedCep, setSelectedCep] = useState('auto');
  const [schedSelectedCep, setSchedSelectedCep] = useState('auto');
  const [instantPromotionContext, setInstantPromotionContext] = useState('');
  const [schedPromotionContext, setSchedPromotionContext] = useState('');

  // --- SCHEDULER & REPLIZ PUBLISHING STATE ---
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline' | 'schedules'
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [runningScheduleIds, setRunningScheduleIds] = useState({});
  const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all' | 'active' | 'paused' | 'archived'
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('all'); // 'all' | 'product_campaign' | 'editorial_campaign' | 'recipe_campaign' | 'multiplier_campaign' | 'recipe_labs'
  const [scheduleBrandFilter, setScheduleBrandFilter] = useState('all'); // 'all' | brand.id
  const [replizAccounts, setReplizAccounts] = useState([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Form state modal (Multi-Campaign & Dedicated Row Generation)
  const [schedCampaignType, setSchedCampaignType] = useState('recipe_campaign'); // 'recipe_campaign' | 'product_campaign' | 'editorial_campaign' | 'multiplier_campaign' | 'recipe_labs'
  const [schedName, setSchedName] = useState('');
  const [schedBrandId, setSchedBrandId] = useState('');
  const [schedPresetKey, setSchedPresetKey] = useState('');
  const [schedGenTime, setSchedGenTime] = useState('05:00');
  const [schedPubTime, setSchedPubTime] = useState('09:00');
  const [schedTopic, setSchedTopic] = useState('');
  const [schedCategory, setSchedCategory] = useState('makanan_utama');
  const [isSchedCategoryManual, setIsSchedCategoryManual] = useState(false);
  const [schedRecipeMode, setSchedRecipeMode] = useState('umbrella'); // 'umbrella' | 'menu_list'
  const [schedRecipeMenuList, setSchedRecipeMenuList] = useState('');
  const [schedDays, setSchedDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [schedReplizAccountIds, setSchedReplizAccountIds] = useState([]);
  const [schedAutoPublish, setSchedAutoPublish] = useState(true);
  const [schedPostAffiliateLink, setSchedPostAffiliateLink] = useState(true);
  const [instantPostAffiliateLink, setInstantPostAffiliateLink] = useState(true);
  const [instantGenerateRecipe, setInstantGenerateRecipe] = useState(true);
  const [schedGenerateRecipe, setSchedGenerateRecipe] = useState(true);
  const [modalBrandPresets, setModalBrandPresets] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Sched Modal State Khusus Multiplier & Recipe Labs
  const [schedBlueprintId, setSchedBlueprintId] = useState('');
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState([]);
  const [schedBlueprintSearchQuery, setSchedBlueprintSearchQuery] = useState('');
  const [schedImagesPerRecipe, setSchedImagesPerRecipe] = useState(4);
  const [schedLayoutId, setSchedLayoutId] = useState('4_editorial_split');
  const [schedRecipeAspectRatio, setSchedRecipeAspectRatio] = useState('3:4');
  const [schedVisualStyle, setSchedVisualStyle] = useState('Modern Minimalist Nordic Studio');
  const [schedPostToFacebook, setSchedPostToFacebook] = useState(true);
  const [schedTargetLanguage, setSchedTargetLanguage] = useState('en_US');
  const [schedRecipeClassification, setSchedRecipeClassification] = useState('Quick & Easy Weeknight Dinners (Under 20 Mins)');
  const [currentUser, setCurrentUser] = useState(null);
  const [isTenantLocked, setIsTenantLocked] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          const locked = data.user.role !== 'superadmin' &&
            Array.isArray(data.user.tenantDisabledMenus) &&
            data.user.tenantDisabledMenus.includes('auto_pipeline');
          setIsTenantLocked(locked);
        }
      })
      .catch(() => {});
  }, []);

  // State Khusus Threads Series Engine (1-Klik & Scheduler)
  const [threadsObjective, setThreadsObjective] = useState('personal_product');
  const [threadsPersonalProductName, setThreadsPersonalProductName] = useState('Kamar Deluxe Paviliun Sasya House');
  const [threadsPersonalProductCta, setThreadsPersonalProductCta] = useState('DM @sasyahouse sekarang untuk info ketersediaan kamar & promo survei!');
  const [threadsAffiliateProductTitle, setThreadsAffiliateProductTitle] = useState('Kasur Busa Orthopedic Anti Sakit Punggung');
  const [threadsAffiliateProductLink, setThreadsAffiliateProductLink] = useState('https://shope.ee/contoh_affiliate');
  const [threadsPureOrganicTopic, setThreadsPureOrganicTopic] = useState('5 Kebiasaan malam hari sebelum tidur yang bikin kualitas istirahat naik 2x lipat');
  const [threadsVisualMode, setThreadsVisualMode] = useState('glabs');
  const [threadsSelectedAccountId, setThreadsSelectedAccountId] = useState('');
  const [threadsSeriesPosts, setThreadsSeriesPosts] = useState([]);

  // Product Catalog Selection State (Product Campaign)
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [schedProductPromoMode, setSchedProductPromoMode] = useState('single'); // 'single' | 'multi_angle'
  const [schedProductAngleList, setSchedProductAngleList] = useState('');

  // Editorial Pillars Selection State (Editorial Campaign)
  const [pillarSearchQuery, setPillarSearchQuery] = useState('');
  const [selectedPillars, setSelectedPillars] = useState([]);
  const [schedEditorialMode, setSchedEditorialMode] = useState('pillar'); // 'pillar' | 'keyword'
  const [schedEditorialKeywordsText, setSchedEditorialKeywordsText] = useState('');
  const [schedStaggerDays, setSchedStaggerDays] = useState(true);
  const [schedMode, setSchedMode] = useState('recurring'); // 'recurring' | 'specific_date'
  const [schedTargetDate, setSchedTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [schedStaggerCalendar, setSchedStaggerCalendar] = useState(true);
  const [scheduleModeFilter, setScheduleModeFilter] = useState('all'); // 'all' | 'recurring' | 'specific_date'
  const [scheduleViewMode, setScheduleViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cfstudio_schedule_view_mode') || 'list';
    }
    return 'list';
  });

  // Repliz Multi-Platform Search & Filter State
  const [replizSearchQuery, setReplizSearchQuery] = useState('');
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState('all');
  const [isSyncingRepliz, setIsSyncingRepliz] = useState(false);

  // Computed preset parameters for Inspector Card
  const targetClipsCount = Number(
    activePresetConfig?.visual_engine?.target_clips_count ||
    activePresetConfig?.target_clips_count ||
    6
  );
  const clipDuration = Number(
    activePresetConfig?.visual_engine?.clip_duration ||
    activePresetConfig?.clip_duration ||
    4
  );
  const rawVideoModel = activePresetConfig?.visual_engine?.video_model || activePresetConfig?.video_model || 'omni_flash';
  const videoModelName = rawVideoModel === 'veo_31_lite' ? 'Google Veo (8s)' : 'Veo Omni Flash (4s)';
  const bs = activePresetConfig?.basic_strategy || {};
  const wf = activePresetConfig?.workflow || {};
  const audioEngineMode = wf.audio_engine_mode || bs.audio_engine_mode || 'minimax_tts';
  const isNativeVeo = audioEngineMode === 'native_veo';
  const googleVoicePersona = wf.google_voice_persona || bs.google_voice_persona || 'Kore';
  const rawVoicePersona = bs.voice_persona || activePresetConfig?.voice_persona || 'English_causual_narrator_vv1';
  const voicePersonaName = rawVoicePersona.replace(/_/g, ' ');
  const targetLanguage = bs.target_language || activePresetConfig?.target_language || 'en-US';
  const wordsPerClip = activePresetConfig?.visual_engine?.words_per_clip || (clipDuration >= 8 ? '17-19 kata' : '8-9 kata');
  const isMotionTextOn = wf.enable_motion_text !== undefined ? Boolean(wf.enable_motion_text) : (activePresetConfig?.enable_motion_text !== undefined ? Boolean(activePresetConfig.enable_motion_text) : true);
  const motionStyleKey = wf.motion_text_style || activePresetConfig?.motion_text_style || 'floating_white_yellow';
  const motionStyleDesc = !isMotionTextOn
    ? 'Nonaktif'
    : (motionStyleKey === 'floating_white_yellow'
        ? 'Floating Putih ➔ Kuning'
        : (motionStyleKey === 'minimal_white' ? 'Minimal Putih' : 'CapCut Style'));

  const transitionKey = wf.video_transition || activePresetConfig?.video_transition || 'fade';
  const transitionDur = wf.transition_duration !== undefined ? Number(wf.transition_duration) : (activePresetConfig?.transition_duration !== undefined ? Number(activePresetConfig.transition_duration) : 0.5);
  const transitionDesc = `${String(transitionKey).toUpperCase()} (${transitionDur}s)`;

  function generateAdaptiveStoryArc(type, count = 6, dur = 4, presetConfig = {}, cepValue = 'auto') {
    const c = Math.max(3, Number(count) || 6);
    const d = Math.max(3, Number(dur) || 4);
    const totalSeconds = c * d;

    // Rekomendasi pacing kata
    let pacingLabel = '11-14 kata/klip';
    let pacingTag = 'Pacing Standar';
    if (d <= 4) {
      pacingLabel = '8-10 kata/klip';
      pacingTag = 'Kinetic / Fast';
    } else if (d >= 8) {
      pacingLabel = '16-19 kata/klip';
      pacingTag = 'Veo Sinematik';
    }

    // Khusus Recipe Labs (Tipe statis foto grid)
    if (type === 'recipe_labs') {
      return {
        type: 'recipe_labs',
        isStaticGrid: true,
        totalSeconds: 0,
        pacingLabel: 'Format Teks Artikel FB',
        pacingTag: 'Facebook Long-Form',
        headerSummary: `KOMPOSISI FOTO KOMPOSIT & ARTIKEL FB (${c} Slot Layout Grid)`,
        steps: [
          { seq: 1, title: 'Hero Shot Utama (Sajian Matang)', dur: null, tag: 'Hero Split 40%', icon: '🌟' },
          { seq: 2, title: 'Bahan Baku Segar Pilihan', dur: null, tag: 'Macro Texture', icon: '🌿' },
          { seq: 3, title: 'Aksi Peracikan di Dapur', dur: null, tag: 'Action Shot', icon: '🍳' },
          { seq: 4, title: 'Sajian Siap Santap / Plating', dur: null, tag: 'Final Plate', icon: '🍽️' },
          ...(c > 4 ? Array.from({ length: c - 4 }, (_, i) => ({
            seq: 5 + i,
            title: `Detail Tahap Khusus #${i + 1}`,
            dur: null,
            tag: 'Step Photo',
            icon: '📸'
          })) : [])
        ]
      };
    }

    let steps = [];

    // 1. VIDEO PRODUK (product_campaign)
    if (type === 'product_campaign') {
      if (c === 3) {
        steps = [
          { seq: 1, title: 'Hook Pain Point', tag: 'Hook 0-3s', icon: '🎯' },
          { seq: 2, title: 'Pivot Solusi Produk', tag: '🛍️ PIVOT PRODUK', icon: '💡' },
          { seq: 3, title: 'Hasil & Outro CTA', tag: 'CTA Link Bio', icon: '🚀' }
        ];
      } else if (c === 4) {
        steps = [
          { seq: 1, title: 'Hook Masalah Penonton', tag: 'Hook 0-3s', icon: '🎯' },
          { seq: 2, title: 'Eskalasi Kebutuhan', tag: 'Pain Point', icon: '⚡' },
          { seq: 3, title: 'Pivot Solusi Produk', tag: '🛍️ PIVOT PRODUK', icon: '💡' },
          { seq: 4, title: 'Transformasi & Outro CTA', tag: 'CTA Link Bio', icon: '🚀' }
        ];
      } else if (c === 5) {
        steps = [
          { seq: 1, title: 'Hook Relatable', tag: 'Hook 0-3s', icon: '🎯' },
          { seq: 2, title: 'Eskalasi Dampak Masalah', tag: 'Pain Point', icon: '⚡' },
          { seq: 3, title: 'Pivot Intro Produk', tag: '🛍️ PIVOT PRODUK', icon: '💡' },
          { seq: 4, title: 'Demonstrasi Bukti USP', tag: 'Fitur Utama', icon: '🔬' },
          { seq: 5, title: 'Hasil Transformasi & CTA', tag: 'CTA Link Bio', icon: '🚀' }
        ];
      } else if (c === 6) {
        steps = [
          { seq: 1, title: 'Hook Relatable / Pain Point', tag: 'Hook 0-3s', icon: '🎯' },
          { seq: 2, title: 'Eskalasi Masalah Penonton', tag: 'Pain Point', icon: '⚡' },
          { seq: 3, title: 'Solusi & Intro Produk Target', tag: '🛍️ PIVOT PRODUK', icon: '💡' },
          { seq: 4, title: 'Demonstrasi Fitur & USP', tag: 'Fitur Unggulan', icon: '🔬' },
          { seq: 5, title: 'Bukti Nyata / Transformasi', tag: 'Social Proof', icon: '✨' },
          { seq: 6, title: 'Rekomendasi & Outro CTA', tag: 'CTA Link Bio', icon: '🚀' }
        ];
      } else {
        steps = [
          { seq: 1, title: 'Hook Emosional Penonton', tag: 'Hook 0-3s', icon: '🎯' },
          { seq: 2, title: 'Eskalasi Masalah Harian', tag: 'Pain Point', icon: '⚡' },
          { seq: 3, title: 'Akar Masalah Utama', tag: 'Root Cause', icon: '🔍' },
          { seq: 4, title: 'Pivot Pengenalan Produk', tag: '🛍️ PIVOT PRODUK', icon: '💡' },
          { seq: 5, title: 'Fitur Unggulan & Formula', tag: 'Fitur USP', icon: '🔬' },
          { seq: 6, title: 'Demonstrasi Rutinitas Konsumsi', tag: 'Daily Routine', icon: '✨' },
          { seq: 7, title: 'Bukti Hasil Transformasi', tag: 'Social Proof', icon: '🌟' },
          { seq: 8, title: 'Penawaran Spesial & Outro CTA', tag: 'CTA Link Bio', icon: '🚀' }
        ];
      }
    }

    // 2. VIDEO EDITORIAL (editorial_campaign)
    else if (type === 'editorial_campaign') {
      if (c <= 4) {
        steps = [
          { seq: 1, title: 'Tension Hook (Opini Berani)', tag: 'Tension 0-3s', icon: '🔥' },
          { seq: 2, title: 'Fakta Kontras / Realita', tag: 'Contrast', icon: '⚖️' },
          { seq: 3, title: 'Reframe Paradigma Baru', tag: 'Perspective', icon: '💡' },
          { seq: 4, title: 'Refleksi Filosofis & Closing', tag: 'Closing Bio', icon: '🌱' }
        ];
      } else if (c <= 6) {
        steps = [
          { seq: 1, title: 'Tension Hook Pembuka', tag: 'Tension 0-3s', icon: '🔥' },
          { seq: 2, title: 'Realita yang Terabaikan', tag: 'Hidden Reality', icon: '👁️' },
          { seq: 3, title: 'Eksplorasi Dilema & Isu', tag: 'Dilemma', icon: '⚖️' },
          { seq: 4, title: 'Sudut Pandang / Filosofi Baru', tag: 'New Paradigm', icon: '💡' },
          { seq: 5, title: 'Reframe Persepsi Positif', tag: 'Wisdom Core', icon: '🌟' },
          { seq: 6, title: 'Kalimat Penutup & Outro Reflektif', tag: 'Closing Outro', icon: '🌱' }
        ];
      } else {
        steps = [
          { seq: 1, title: 'Tension Hook Sensasional', tag: 'Tension 0-3s', icon: '🔥' },
          { seq: 2, title: 'Dilema / Pertanyaan Kritis', tag: 'Critical Q', icon: '❓' },
          { seq: 3, title: 'Fakta Nyata di Lapangan', tag: 'Field Truth', icon: '👁️' },
          { seq: 4, title: 'Analisa Kontradiksi Pola', tag: 'Contradiction', icon: '⚖️' },
          { seq: 5, title: 'Pencerahan Paradigma', tag: 'Shift Moment', icon: '💡' },
          { seq: 6, title: 'Pilar Filosofi Brand', tag: 'Brand Pillar', icon: '🏛️' },
          { seq: 7, title: 'Sintesis & Makna Hidup', tag: 'Synthesis', icon: '🌟' },
          { seq: 8, title: 'Pesan Moral & Refleksi Outro', tag: 'Closing Bio', icon: '🌱' }
        ];
      }
    }

    // 3. VIDEO MULTIPLIER (multiplier_campaign)
    else if (type === 'multiplier_campaign') {
      if (c <= 4) {
        steps = [
          { seq: 1, title: 'Viral Hook Adaptasi Blueprint', tag: 'Hook 0-3s', icon: '🎬' },
          { seq: 2, title: 'Eskalasi Cerita Remake', tag: 'Story Pacing', icon: '📈' },
          { seq: 3, title: 'Pivot Nilai / Bridge Rekomendasi', tag: 'Bridge Pivot', icon: '🔄' },
          { seq: 4, title: 'Resolusi Cerita & Outro Brand', tag: 'Outro Contract', icon: '🎯' }
        ];
      } else if (c <= 6) {
        steps = [
          { seq: 1, title: 'Viral Hook Adaptasi Blueprint', tag: 'Hook 0-3s', icon: '🎬' },
          { seq: 2, title: 'Pacing Narasi & Visual Layer', tag: 'Visual Flow', icon: '🌊' },
          { seq: 3, title: 'Pengembangan Emosi Penonton', tag: 'Emotional Hook', icon: '⚡' },
          { seq: 4, title: 'Pivot Rekomendasi / Bridge', tag: 'Bridge Pivot', icon: '🔄' },
          { seq: 5, title: 'Penguatan Pesan Utama', tag: 'Key Message', icon: '💎' },
          { seq: 6, title: 'Resolusi Cerita & Outro Khusus', tag: 'Outro Contract', icon: '🎯' }
        ];
      } else {
        steps = [
          { seq: 1, title: 'Viral Hook Adaptasi Blueprint', tag: 'Hook 0-3s', icon: '🎬' },
          { seq: 2, title: 'Pacing Narasi & Visual Layer', tag: 'Visual Flow', icon: '🌊' },
          { seq: 3, title: 'Eskalasi Masalah Awal', tag: 'Escalation', icon: '📈' },
          { seq: 4, title: 'Climax / Momen Puncak', tag: 'Twist / Climax', icon: '💥' },
          { seq: 5, title: 'Transisi Menuju Solusi', tag: 'Transition', icon: '🔄' },
          { seq: 6, title: 'Demonstrasi & Bukti Manfaat', tag: 'Validation', icon: '✨' },
          { seq: 7, title: 'Penguatan Pesan & Makna', tag: 'Core Value', icon: '💎' },
          { seq: 8, title: 'Resolusi Cerita & Outro Kontrak', tag: 'Outro Contract', icon: '🎯' }
        ];
      }
    }

    // 4. VIDEO RESEP (recipe_campaign)
    else {
      if (c <= 4) {
        steps = [
          { seq: 1, title: 'Hook Sensori & Visual Action', tag: 'Sensory Hook', icon: '🔥' },
          { seq: 2, title: 'Racikan Bahan & Bumbu', tag: 'Ingredients', icon: '🥣' },
          { seq: 3, title: 'Proses Memasak & Sizzle', tag: 'Cooking Action', icon: '🍳' },
          { seq: 4, title: 'Plating & CTA Outro Resep', tag: 'Outro CTA', icon: '🍽️' }
        ];
      } else if (c <= 6) {
        steps = [
          { seq: 1, title: 'Hook Pembuka Sensori', tag: 'Sensory Hook', icon: '🔥' },
          { seq: 2, title: 'Persiapan Bahan Segar', tag: 'Prep Fresh', icon: '🥬' },
          { seq: 3, title: 'Proses Pengolahan & Masak', tag: 'Cooking Craft', icon: '🍳' },
          { seq: 4, title: 'Sizzle & Detail Tekstur', tag: 'Texture & Heat', icon: '✨' },
          { seq: 5, title: 'Plating Estetik & Garnish', tag: 'Plating Craft', icon: '🎨' },
          { seq: 6, title: 'Sajian Akhir & Outro Bio', tag: 'Outro CTA', icon: '🍽️' }
        ];
      } else {
        steps = [
          { seq: 1, title: 'Hook Sensori & Gigitan Awal', tag: 'Sensory Hook', icon: '🔥' },
          { seq: 2, title: 'Persiapan Bahan Segar', tag: 'Ingredients', icon: '🥬' },
          { seq: 3, title: 'Marinasi & Racikan Bumbu', tag: 'Seasoning', icon: '🥣' },
          { seq: 4, title: 'Teknik Memasak Inti', tag: 'Core Cooking', icon: '🍳' },
          { seq: 5, title: 'Kematangan & Sizzle Panas', tag: 'Sizzle Heat', icon: '✨' },
          { seq: 6, title: 'Finishing Touch & Aroma', tag: 'Finishing', icon: '🌿' },
          { seq: 7, title: 'Plating Sempurna Resto', tag: 'Plating Art', icon: '🎨' },
          { seq: 8, title: 'Sajian Akhir & Link Resep Bio', tag: 'Outro CTA', icon: '🍽️' }
        ];
      }
    }

    if (type === 'product_campaign' && cepValue && cepValue !== 'auto') {
      const matchedCep = CEP_OPTIONS.find(o => o.id === cepValue);
      if (matchedCep && steps.length > 0) {
        steps[0] = {
          seq: 1,
          title: matchedCep.arcHookTitle,
          tag: matchedCep.id === 'Routine Based' ? 'Routine 0-3s' : (matchedCep.id === 'Emotional Based' ? 'Emotional 0-3s' : (matchedCep.id === 'Aspirational Based' ? 'Aspirational 0-3s' : (matchedCep.id === 'Commitment Based' ? 'Commitment 0-3s' : (matchedCep.id === 'Opportunistic Based' ? 'Situational 0-3s' : 'Problem 0-3s')))),
          icon: matchedCep.icon
        };
      }
    }

    const normalized = steps.slice(0, c).map((s, idx) => ({
      ...s,
      seq: idx + 1,
      dur: d
    }));

    return {
      type,
      isStaticGrid: false,
      totalSeconds,
      clipsCount: c,
      clipDuration: d,
      pacingLabel,
      pacingTag,
      headerSummary: `ALUR BABAK STORY ARC: ${c} Klip • @${d}s • Total: ${totalSeconds}s (${pacingTag})`,
      steps: normalized
    };
  }

  // Alias helper untuk kompatibilitas
  const getStoryArcSteps = (count, dur) => generateAdaptiveStoryArc(instantCampaignType, count, dur, activePresetConfig, selectedCep).steps;

  // Helper ekstraksi ID Reel / Video dari URL (Facebook / Instagram)
  function extractReelId(url) {
    if (!url) return '';
    const m = url.match(/reel\/(\d+)/i) || url.match(/\/(\d{10,})/);
    return m ? m[1] : '';
  }

  // Smart Auto-Detection dari kata kunci topik
  function detectCategoryFromTopic(text) {
    if (!text || !text.trim()) return 'makanan_utama';
    const t = text.toLowerCase();

    // 1. Minuman (Beverages)
    const beverageKeywords = [
      'kopi', 'coffee', 'latte', 'cappuccino', 'tea', 'teh', 'matcha',
      'smoothie', 'juice', 'jus', 'boba', 'drink', 'mojito', 'mocktail',
      'shake', 'milkshake', 'espresso', 'brew', 'soda', 'cocktail', 'infusion'
    ];
    if (beverageKeywords.some(k => t.includes(k))) return 'minuman';

    // 2. Dessert / Baking
    const dessertKeywords = [
      'cake', 'kue', 'cookie', 'cookies', 'baking', 'brownie', 'pancake',
      'waffle', 'donut', 'donat', 'muffin', 'pudding', 'puding', 'pie',
      'pastry', 'croissant', 'tart', 'cheesecake', 'cupcake', 'ice cream',
      'es krim', 'dessert', 'bolu', 'churro', 'lava cake'
    ];
    if (dessertKeywords.some(k => t.includes(k))) return 'dessert';

    // 3. Camilan / Side Dish
    const snackKeywords = [
      'fries', 'kentang goreng', 'chips', 'snack', 'camilan', 'nugget',
      'finger food', 'popcorn', 'bites', 'zucchini fries', 'dimsum',
      'siomay', 'risol', 'spring roll', 'lumpia', 'tahu crispy', 'tempe mendoan',
      'wings', 'onion rings', 'edamame', 'crispy'
    ];
    if (snackKeywords.some(k => t.includes(k))) return 'camilan';

    // 4. Makanan Utama (Main Course) & Default
    return 'makanan_utama';
  }

  function handleTopicChange(newTopic) {
    setTopic(newTopic);
    if (!isCategoryManuallySelected) {
      setCategory(detectCategoryFromTopic(newTopic));
    }
  }

  function handleCategorySelect(catKey) {
    setCategory(catKey);
    setIsCategoryManuallySelected(true);
  }

  function resetCategoryToAuto() {
    setIsCategoryManuallySelected(false);
    setCategory(detectCategoryFromTopic(topic));
  }

  const [isLaunching, setIsLaunching] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [recentCampaigns, setRecentCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [batchesFilterType, setBatchesFilterType] = useState('all');
  const [toast, setToast] = useState(null);

  // Factual Visualizer State
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [activeCampaignData, setActiveCampaignData] = useState(null);
  const [pipelineStages, setPipelineStages] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [retryingStage, setRetryingStage] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  // Factual Pipeline Status Poller
  async function fetchFactualStatus(targetCampaignId) {
    try {
      const url = targetCampaignId
        ? `/api/v2/recipes/autonomous-pipeline/status?campaign_id=${encodeURIComponent(targetCampaignId)}`
        : '/api/v2/recipes/autonomous-pipeline/status';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.stages) {
        setPipelineStages(data.stages);
        setTelemetry(data.telemetry);
        setActiveCampaignData(data.campaign);
        if (data.campaign?.id) setActiveCampaignId(data.campaign.id);
        return data.is_completed;
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching factual status:', e);
    }
    return false;
  }

  async function handleRetryFailedStage(stageKey) {
    const itemId = activeCampaignData?.item_id;
    if (!itemId) {
      showToast('Item ID kampanye tidak ditemukan untuk coba ulang.', 'error');
      return;
    }
    const stepMap = { s4: 'tts', s5: 'visuals', s6: 'ffmpeg' };
    const step = stepMap[stageKey];
    if (!step) return;

    setRetryingStage(stageKey);
    try {
      const res = await fetch(`/api/v2/pillar-campaigns/items/${itemId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Berhasil memicu ulang langkah ${step.toUpperCase()}`);
        setPollingActive(true);
        if (activeCampaignId) fetchFactualStatus(activeCampaignId);
      } else {
        showToast(data.error || 'Gagal memicu langkah', 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setRetryingStage(null);
    }
  }

  // Polling loop
  useEffect(() => {
    fetchFactualStatus();
  }, []);

  useEffect(() => {
    let timer = null;
    if (activeCampaignId && pollingActive) {
      timer = setInterval(async () => {
        const isCompleted = await fetchFactualStatus(activeCampaignId);
        if (isCompleted) {
          setPollingActive(false);
          fetchRecentCampaigns();
          showToast('Produksi resep selesai! Video final siap di Nextcloud dan ContentFlow Hub 🚀');
        }
      }, 2500);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [activeCampaignId, pollingActive]);

  // 1. Fetch Brand Profiles on mount
  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch('/api/v2/brand-profiles');
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setBrands(data.data);
          // Cari habitfolk atau pilih brand pertama
          const defaultBrand = data.data.find(b => b.brand_name.toLowerCase().includes('habit')) || data.data[0];
          setSelectedBrandId(defaultBrand.id);
        } else {
          // Fallback static brands jika DB offline
          const fallbackBrands = [
            { id: 'habitfolk', brand_name: 'HabitFolk' },
            { id: 'dapurbotani', brand_name: 'Dapur Botani' },
            { id: 'nutribake', brand_name: 'NutriBake' }
          ];
          setBrands(fallbackBrands);
          setSelectedBrandId('habitfolk');
        }
      } catch (e) {
        console.warn('[AutoPipeline] Error fetching brands:', e);
      }
    }
    async function fetchProductsList() {
      setLoadingProducts(true);
      try {
        const res = await fetch('/api/v2/products?limit=300');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setCatalogProducts(data.data);
        }
      } catch (e) {
        console.warn('[AutoPipeline] Error fetching products:', e);
      } finally {
        setLoadingProducts(false);
      }
    }

    fetchBrands();
    fetchRecentCampaigns();
    fetchSchedules();
    fetchReplizAccounts();
    fetchProductsList();
    fetchBlueprints();
    fetchThreadsSeriesPosts();
  }, []);

  async function fetchBlueprints(searchQuery = '') {
    setLoadingBlueprints(true);
    try {
      const qParam = searchQuery ? `&blueprint_search=${encodeURIComponent(searchQuery)}` : '';
      const res = await fetch(`/api/v2/recipes/autonomous-pipeline?pipeline_type=multiplier_campaign${qParam}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.blueprints)) {
        setBlueprints(data.blueprints);
        if (data.blueprints.length > 0 && (!instantBlueprintId || !data.blueprints.some(b => b.id === instantBlueprintId))) {
          setInstantBlueprintId(data.blueprints[0].id);
        }
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching blueprints:', e);
    } finally {
      setLoadingBlueprints(false);
    }
  }

  // Server-Side Search Debounce untuk Deconstruct Blueprint (Tab 1 Launcher)
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchBlueprints(blueprintSearchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [blueprintSearchQuery]);

  // Server-Side Search Debounce untuk Modal Penjadwalan Multiplier
  useEffect(() => {
    if (!isScheduleModalOpen || schedCampaignType !== 'multiplier_campaign') return;
    const handler = setTimeout(() => {
      fetchBlueprints(schedBlueprintSearchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [schedBlueprintSearchQuery, isScheduleModalOpen, schedCampaignType]);

  async function generateMultiplierAnglesForBlueprint(bpId) {
    if (!bpId) return;
    setLoadingAngles(true);
    try {
      const res = await fetch(`/api/v2/recipes/autonomous-pipeline?action=get_multiplier_angles&blueprint_id=${encodeURIComponent(bpId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.angles) && data.angles.length > 0) {
        setMultiplierAngles(data.angles);
        setSelectedAngleIndex(0);
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error generating angles:', e);
    } finally {
      setLoadingAngles(false);
    }
  }

  // Auto-fetch angles saat user berpindah ke manual_review pada Multiplier
  useEffect(() => {
    if (instantCampaignType === 'multiplier_campaign' && executionMode === 'manual_review' && instantBlueprintId) {
      if (multiplierAngles.length === 0) {
        generateMultiplierAnglesForBlueprint(instantBlueprintId);
      }
    }
  }, [instantCampaignType, executionMode, instantBlueprintId]);

  async function fetchProducts() {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/v2/products?limit=300');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCatalogProducts(data.data);
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching products:', e);
    } finally {
      setLoadingProducts(false);
    }
  }

  // 2. Fetch Presets dynamically when selected brand or instantCampaignType changes
  useEffect(() => {
    if (!selectedBrandId) return;
    async function fetchPresets() {
      try {
        const url = `/api/v2/recipes/autonomous-pipeline?brand=${encodeURIComponent(selectedBrandId)}&pipeline_type=${encodeURIComponent(instantCampaignType)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          const opList = data.operator_presets || [];
          setOperatorPresets(opList);

          const defaultKey = opList[0]?.key || (instantCampaignType === 'product_campaign' ? 'product_campaign' : (instantCampaignType === 'editorial_campaign' ? 'brand_editorial_campaign' : 'recipe_campaign_default'));
          setSelectedPresetKey(defaultKey);

          const initialConfig = opList[0]?.config || opList[0] || data.default_preset || null;
          setActivePresetConfig(initialConfig);

          if (Array.isArray(data.presets)) {
            setPresets(data.presets);
            const defaultVi = initialConfig?.visual_swap?.visual_identity_preset_id ||
              data.default_preset?.visual_identity_preset_id ||
              data.presets[0]?.id ||
              '';
            setSelectedPresetId(defaultVi);
          }

          const currentBrandObj = brands.find(b => b.id === selectedBrandId);
          setPresetHint(`Terfilter khusus brand ${currentBrandObj?.brand_name || selectedBrandId}`);
        }
      } catch (e) {
        console.warn('[AutoPipeline] Error fetching presets:', e);
      }
    }
    fetchPresets();
  }, [selectedBrandId, instantCampaignType, brands]);

  function handlePresetKeyChange(newKey) {
    setSelectedPresetKey(newKey);
    const found = operatorPresets.find(p => p.key === newKey);
    if (found) {
      const cfg = found.config || found;
      setActivePresetConfig(cfg);
      if (cfg.visual_swap?.visual_identity_preset_id) {
        setSelectedPresetId(cfg.visual_swap.visual_identity_preset_id);
      }
    }
  }

  // 3. Fetch 20 Recent Unified Batches (Lintas Seluruh Tipe Video)
  async function fetchRecentCampaigns() {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/v2/recipes/autonomous-pipeline/batches?limit=20');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRecentCampaigns(data.data);
      } else {
        const fallback = data.campaigns || data.data || [];
        setRecentCampaigns(fallback.slice(0, 20));
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching recent batches:', e);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  // 4. Trigger 1-Click Pipeline (Support Product, Editorial, and Recipe Campaigns)
  async function handleLaunchPipeline(e) {
    e.preventDefault();

    let targetTopic = topic;
    let targetCategory = category || 'makanan_utama';
    let targetProductId = null;
    let targetPillar = null;
    let targetDeconstructId = null;
    let targetChosenAngle = null;

    if (instantCampaignType === 'product_campaign') {
      const effectiveProdId = instantProductId || (catalogProducts[0]?.id || null);
      if (!effectiveProdId) {
        showToast('Pilih produk dari katalog terlebih dahulu.', 'error');
        return;
      }
      const prod = catalogProducts.find(p => p.id === effectiveProdId);
      targetTopic = instantPromotionContext.trim() || prod?.product_name || 'Promosi Produk';
      targetCategory = prod?.category || 'produk';
      targetProductId = effectiveProdId;
    } else if (instantCampaignType === 'editorial_campaign') {
      if (instantEditorialMode === 'keyword') {
        const kw = instantEditorialKeyword.trim();
        if (!kw) {
          showToast('Masukkan kata kunci target editorial terlebih dahulu.', 'error');
          return;
        }
        targetTopic = kw;
        targetCategory = 'editorial';
        targetPillar = kw;
      } else {
        const effectivePillar = instantPillar || (modalAvailablePillars[0] || 'Eat Better, Not Perfect');
        if (!effectivePillar) {
          showToast('Pilih pilar brand terlebih dahulu.', 'error');
          return;
        }
        targetTopic = effectivePillar;
        targetCategory = 'editorial';
        targetPillar = effectivePillar;
      }
    } else if (instantCampaignType === 'multiplier_campaign') {
      targetDeconstructId = instantBlueprintId || (blueprints[0]?.id || null);
      if (!targetDeconstructId) {
        showToast('Pilih Blueprint video referensi Deconstruct Lab terlebih dahulu.', 'error');
        return;
      }
      if (executionMode === 'manual_review' && multiplierAngles.length > 0) {
        targetChosenAngle = multiplierAngles[selectedAngleIndex] || multiplierAngles[0];
      }
      targetTopic = targetChosenAngle?.title || 'Multiplier Remix Hook';
      targetCategory = 'multiplier';
    } else if (instantCampaignType === 'recipe_labs') {
      if (!recipeLabsTopic || !recipeLabsTopic.trim()) {
        showToast('Topik / Nama menu resep wajib diisi.', 'error');
        return;
      }
      targetTopic = recipeLabsTopic.trim();
      targetCategory = instantRecipeClassification || recipeLabsCategory || 'Makanan';
    } else if (instantCampaignType === 'threads_series') {
      if (threadsObjective === 'personal_product') {
        if (!threadsPersonalProductName.trim()) {
          showToast('Nama produk / jasa pribadi wajib diisi.', 'error');
          return;
        }
        targetTopic = threadsPersonalProductName.trim();
      } else if (threadsObjective === 'affiliate_shopee') {
        if (!threadsAffiliateProductTitle.trim()) {
          showToast('Judul produk affiliate Shopee wajib diisi.', 'error');
          return;
        }
        targetTopic = threadsAffiliateProductTitle.trim();
      } else {
        if (!threadsPureOrganicTopic.trim()) {
          showToast('Topik cerita murni / edukasi wajib diisi.', 'error');
          return;
        }
        targetTopic = threadsPureOrganicTopic.trim();
      }
      targetCategory = 'threads_series';
    } else {
      if (!topic || !topic.trim()) {
        showToast('Topik resep wajib diisi.', 'error');
        return;
      }
      targetTopic = topic.trim();
    }

    setIsLaunching(true);

    try {
      const res = await fetch('/api/v2/recipes/autonomous-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_type: instantCampaignType,
          brand_id: selectedBrandId,
          preset_key: selectedPresetKey,
          topic: targetTopic,
          target_language: instantCampaignType === 'recipe_labs' ? instantTargetLanguage : undefined,
          recipe_classification: instantCampaignType === 'recipe_labs' ? instantRecipeClassification : undefined,
          product_id: targetProductId,
          product_title: targetTopic,
          promotion_context: instantPromotionContext.trim() || null,
          selected_cep: selectedCep,
          content_pillar: targetPillar,
          keyword: instantCampaignType === 'editorial_campaign' && instantEditorialMode === 'keyword' ? instantEditorialKeyword.trim() : null,
          use_brand_pillars: instantCampaignType === 'editorial_campaign' ? (instantEditorialMode !== 'keyword') : true,
          deconstruct_asset_id: targetDeconstructId,
          selected_angle: targetChosenAngle,
          category: targetCategory,
          recipe_count: Number(recipeCount || 1),
          execution_mode: executionMode,
          visual_identity_preset_id: selectedPresetId || activePresetConfig?.visual_swap?.visual_identity_preset_id || null,
          auto_sync_contentflow: 1,
          // Parameter khusus Recipe Labs Grid Komposit
          images_per_recipe: imagesPerRecipe,
          selected_layout_id: selectedLayoutId,
          grid_gap_size: gridGapSize,
          grid_border_radius: gridBorderRadius,
          grid_outer_padding: gridOuterPadding,
          grid_bg_color: gridBgColor,
          aspect_ratio: instantRecipeAspectRatio,
          visual_style: recipeLabsVisualStyle,
          post_to_facebook: postToFacebook,
          post_link_affiliate: instantPostAffiliateLink,
          generate_recipe: (instantCampaignType === 'multiplier_campaign' || instantCampaignType === 'recipe_campaign') ? instantGenerateRecipe : undefined,
          // Parameter Khusus Threads Series Utas Berseri
          post_objective: threadsObjective,
          personal_product_name: threadsPersonalProductName,
          personal_product_cta: threadsPersonalProductCta,
          affiliate_product_title: threadsAffiliateProductTitle,
          affiliate_product_link: threadsAffiliateProductLink,
          pure_organic_topic: threadsPureOrganicTopic,
          visual_mode: threadsVisualMode,
          account_id: threadsSelectedAccountId || null,
          auto_publish: schedAutoPublish
        })
      });

      const data = await res.json();

      if (data.success) {
        if (instantCampaignType === 'threads_series') {
          showToast(`Utas Berseri Threads ("${data.theme || targetTopic}") berhasil dibuat (${data.series?.length || 5} Part)! 🧵✨`);
          fetchThreadsSeriesPosts();
          return;
        }

        setActiveCampaignId(data.campaign_id || data.task_id);
        setPollingActive(true);
        fetchFactualStatus(data.campaign_id || data.task_id);
        const typeLabel = instantCampaignType === 'product_campaign' 
          ? 'Video Produk' 
          : (instantCampaignType === 'editorial_campaign'
              ? 'Video Editorial'
              : (instantCampaignType === 'multiplier_campaign'
                  ? 'Video Multiplier'
                  : (instantCampaignType === 'recipe_labs' ? 'Resep Teks & Foto' : 'Video Resep')));
        showToast(`Kampanye ${typeLabel} (${data.campaign_id || data.task_id}) berhasil diluncurkan! Melacak progres produksi faktual... 🚀`);
        fetchRecentCampaigns();
      } else {
        showToast('Gagal meluncurkan pipeline: ' + (data.error || 'Terjadi kesalahan sistem'), 'error');
      }
    } catch (err) {
      showToast('Error request: ' + err.message, 'error');
    } finally {
      setIsLaunching(false);
    }
  }

  // --- AUTO PIPELINE SCHEDULER & REPLIZ PUBLISHING HANDLERS ---
  async function fetchSchedules(silent = false) {
    if (!silent) setLoadingSchedules(true);
    try {
      const res = await fetch('/api/v2/recipes/auto-pipeline-schedules');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSchedules(data.data);
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching schedules:', e);
    } finally {
      if (!silent) setLoadingSchedules(false);
    }
  }

  // Polling loop otomatis saat ada jadwal yang sedang dieksekusi di background
  useEffect(() => {
    const hasRunning = Object.keys(runningScheduleIds).length > 0 || schedules.some(s => s.is_running);
    if (!hasRunning) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/v2/recipes/auto-pipeline-schedules');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setSchedules(data.data);
          data.data.forEach(s => {
            if (!s.is_running && runningScheduleIds[s.id]) {
              setRunningScheduleIds(prev => {
                const next = { ...prev };
                delete next[s.id];
                return next;
              });
              if (s.last_campaign_id) {
                showToast(`✅ Eksekusi selesai! Kampanye baru berhasil dibuat: ${s.last_campaign_id} 🚀`);
                setActiveCampaignId(s.last_campaign_id);
                setPollingActive(true);
              } else if (s.last_error) {
                showToast(`⚠️ Eksekusi jadwal "${s.name}" gagal: ${s.last_error}`, 'error');
              }
            }
          });
        }
      } catch (e) {
        console.warn('[AutoPipeline] Error polling running schedules:', e);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [runningScheduleIds, schedules]);

  async function fetchReplizAccounts(forceSync = false) {
    if (forceSync) setIsSyncingRepliz(true);
    try {
      const url = forceSync
        ? '/api/v2/publishing/accounts?provider=repliz&sync=1'
        : '/api/v2/publishing/accounts?provider=repliz';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const filtered = data.data.filter(a => a.provider === 'repliz' || a.platform);
        setReplizAccounts(filtered);
        if (filtered.length > 0) {
          setSchedReplizAccountIds(prev => {
            if (prev.length === 0 && schedBrandId && !editingSchedule) {
              const bObj = brands.find(b => b.id === schedBrandId);
              const matched = matchAccountsToBrand(filtered, bObj?.brand_name);
              return matched.map(a => a.id);
            }
            return prev;
          });
        }
        if (forceSync) {
          showToast(`Berhasil menyinkronkan ${filtered.length} akun live dari Repliz! 🚀`);
        }
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching repliz accounts:', e);
      if (forceSync) showToast('Gagal sinkronisasi akun Repliz: ' + e.message, 'error');
    } finally {
      if (forceSync) setIsSyncingRepliz(false);
    }
  }

  async function fetchThreadsSeriesPosts() {
    try {
      const res = await fetch('/api/v2/threads-series?limit=30');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setThreadsSeriesPosts(data.data);
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching threads series posts:', e);
    }
  }

  async function fetchPresetsForModalBrand(bId, pType = schedCampaignType) {
    if (!bId) return;
    try {
      const effectiveType = pType || 'recipe_campaign';
      const res = await fetch(`/api/v2/recipes/autonomous-pipeline?brand=${encodeURIComponent(bId)}&pipeline_type=${encodeURIComponent(effectiveType)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.operator_presets)) {
        setModalBrandPresets(data.operator_presets);
        const exists = data.operator_presets.some(p => p.key === schedPresetKey);
        if (!exists && data.operator_presets.length > 0) {
          const brandMatch = data.operator_presets.find(p => p.is_brand_match);
          setSchedPresetKey(brandMatch ? brandMatch.key : data.operator_presets[0].key);
        }
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching modal presets:', e);
    }
  }

  function getCampaignTypeLabel(typeKey) {
    switch (typeKey) {
      case 'multiplier_campaign': return 'Multiplier';
      case 'recipe_campaign': return 'Resep';
      case 'product_campaign': return 'Produk';
      case 'editorial_campaign': return 'Editorial';
      case 'recipe_labs': return 'Resep Teks & Foto';
      default: return 'Multiplier';
    }
  }

  function matchAccountsToBrand(accounts, brandName) {
    if (!brandName || !Array.isArray(accounts)) return [];
    const normBrand = String(brandName).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normBrand) return [];
    return accounts.filter(acc => {
      if (!acc.display_name) return false;
      const normName = String(acc.display_name).toLowerCase().replace(/[^a-z0-9]/g, '');
      return normName.includes(normBrand) || normBrand.includes(normName);
    });
  }

  function getBrandDisplayName(brand, accounts = []) {
    if (!brand) return 'Brand';
    const matched = matchAccountsToBrand(accounts, brand.brand_name);
    if (matched.length > 0) {
      const cleanNames = matched
        .map(a => String(a.display_name || '').replace(/\s+ID$/i, '').trim())
        .filter(n => !n.includes('|') && !n.startsWith('kost_'));
      if (cleanNames.length > 0) {
        return cleanNames[0];
      }
    }
    return brand.brand_name || 'Brand';
  }

  function computeFormattedScheduleName(typeKey, brand, accounts = [], existingName = '') {
    const typeLabel = getCampaignTypeLabel(typeKey);
    const brandName = getBrandDisplayName(brand, accounts);
    const targetPrefix = `${typeLabel} - ${brandName} - `;

    if (!existingName) {
      return targetPrefix;
    }

    // Jika user sudah mengetik suffix setelah tanda '-' kedua, pertahankan suffix tersebut
    const parts = existingName.split(' - ');
    if (parts.length >= 3) {
      const suffix = parts.slice(2).join(' - ').trim();
      return suffix ? `${targetPrefix}${suffix}` : targetPrefix;
    }

    // Jika nama sebelumnya berakhiran ' - ' atau memiliki separator lama ' — ', gunakan targetPrefix
    if (existingName.endsWith(' - ') || existingName.includes(' — ')) {
      return targetPrefix;
    }

    return targetPrefix;
  }

  function handleModalBrandChange(newBrandId) {
    setSchedBrandId(newBrandId);
    const targetBrand = brands.find(b => b.id === newBrandId);
    if (targetBrand) {
      const matched = matchAccountsToBrand(replizAccounts, targetBrand.brand_name);
      setSchedReplizAccountIds(matched.map(a => a.id));
      if (!editingSchedule) {
        setSchedName(prev => computeFormattedScheduleName(schedCampaignType, targetBrand, replizAccounts, prev));
      }
    }
    fetchPresetsForModalBrand(newBrandId, schedCampaignType);
  }

  function toggleDaySelection(dayIndex) {
    setSchedDays(prev => {
      if (prev.includes(dayIndex)) {
        if (prev.length === 1) return prev; // Minimal 1 hari dipilih
        return prev.filter(d => d !== dayIndex).sort();
      } else {
        return [...prev, dayIndex].sort();
      }
    });
  }

  function setQuickDatePreset(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSchedTargetDate(`${yyyy}-${mm}-${dd}`);
  }

  function toggleReplizAccountSelection(accId) {
    setSchedReplizAccountIds(prev => {
      if (prev.includes(accId)) {
        return prev.filter(id => id !== accId);
      } else {
        return [...prev, accId];
      }
    });
  }

  function toggleBlueprintSelection(bpId) {
    setSelectedBlueprintIds(prev => {
      if (prev.includes(bpId)) {
        if (prev.length === 1) return prev; // Minimal 1 blueprint terpilih
        return prev.filter(id => id !== bpId);
      } else {
        return [...prev, bpId];
      }
    });
  }

  function openCreateScheduleModal(initialTargetDate = null) {
    if (isTenantLocked) return showToast('Akses Auto Pipeline dinonaktifkan untuk tenant Anda oleh Superadmin', 'error');
    const currentBrand = brands.find(b => b.id === selectedBrandId) || brands[0];
    const initialTopic = topic || 'Air fryer crispy snack finger foods';
    setEditingSchedule(null);
    const initialType = 'multiplier_campaign';
    setSchedCampaignType(initialType);
    setSchedName(computeFormattedScheduleName(initialType, currentBrand, replizAccounts, ''));
    setSchedBrandId(currentBrand?.id || '');
    setSchedPresetKey(selectedPresetKey || 'habitfolk_6clips_quick');
    setSchedGenTime('05:00');
    setSchedPubTime('09:00');
    setSchedTopic(initialTopic);
    setSchedCategory(detectCategoryFromTopic(initialTopic));
    setIsSchedCategoryManual(false);
    setSchedRecipeMode('umbrella');
    setSchedRecipeMenuList('');
    setSchedProductPromoMode('single');
    setSchedProductAngleList('');
    setSchedDays([0, 1, 2, 3, 4, 5, 6]);

    const hasValidDate = typeof initialTargetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(initialTargetDate);
    if (hasValidDate) {
      setSchedMode('specific_date');
      setSchedTargetDate(initialTargetDate);
    } else {
      setSchedMode('recurring');
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 1);
      setSchedTargetDate(defaultDate.toISOString().slice(0, 10));
    }
    setSchedStaggerCalendar(true);
    setSchedAutoPublish(true);
    setSchedPostAffiliateLink(true);
    setSchedSelectedCep('auto');
    setSchedPromotionContext('');
    setSchedTargetLanguage('en_US');
    setSchedRecipeClassification('Main Courses & Entrees');
    setSchedImagesPerRecipe(4);
    setSchedLayoutId('4_editorial_split');
    setSchedVisualStyle('Food Porn');
    setSchedPostToFacebook(true);

    // Reset item selections
    setSelectedProductIds([]);
    setSelectedPillars([]);
    setSelectedBlueprintIds(blueprints.length > 0 ? [blueprints[0].id] : []);
    setSchedBlueprintId(blueprints[0]?.id || '');
    setSchedEditorialMode('pillar');
    setSchedEditorialKeywordsText('');
    setProductSearchQuery('');
    setPillarSearchQuery('');
    setSchedBlueprintSearchQuery('');

    const matched = matchAccountsToBrand(replizAccounts, currentBrand?.brand_name);
    setSchedReplizAccountIds(matched.map(a => a.id));

    fetchPresetsForModalBrand(currentBrand?.id, initialType);
    setReplizSearchQuery('');
    setSelectedPlatformFilter('all');
    if (replizAccounts.length < 20) {
      fetchReplizAccounts(true);
    }
    if (catalogProducts.length === 0) {
      fetchProducts();
    }
    setSchedPostAffiliateLink(true);
    setSchedGenerateRecipe(true);
    setIsScheduleModalOpen(true);
  }

  function openEditScheduleModal(sched) {
    if (isTenantLocked) return showToast('Akses Auto Pipeline dinonaktifkan untuk tenant Anda oleh Superadmin', 'error');
    setEditingSchedule(sched);
    const pType = sched.pipeline_type || 'recipe_campaign';
    setSchedCampaignType(pType);
    setSchedName(sched.name || '');
    setSchedBrandId(sched.brand_id || '');
    setSchedPresetKey(sched.preset_key || '');
    setSchedGenTime(sched.generation_time || '05:00');
    setSchedPubTime(sched.publish_time || '09:00');
    setSchedTopic(sched.topic || '');
    setSchedCategory(sched.category || 'makanan_utama');
    setIsSchedCategoryManual(true);
    setSchedDays(Array.isArray(sched.days_of_week) ? sched.days_of_week : [0, 1, 2, 3, 4, 5, 6]);
    setSchedMode(sched.schedule_mode || 'recurring');
    setSchedTargetDate(sched.target_date ? String(sched.target_date).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setSchedStaggerCalendar(true);
    setSchedReplizAccountIds(Array.isArray(sched.repliz_account_ids) ? sched.repliz_account_ids : []);
    setSchedAutoPublish(sched.auto_publish_enabled !== false);

    setSchedRecipeMode('umbrella');
    setSchedRecipeMenuList('');
    setSchedProductPromoMode('single');
    setSchedProductAngleList('');

    let schedCfg = {};
    try {
      schedCfg = typeof sched.pipeline_config_json === 'string'
        ? JSON.parse(sched.pipeline_config_json || '{}')
        : (sched.pipeline_config_json || sched.pipeline_config || {});
    } catch (_) {}

    if (pType === 'multiplier_campaign' && (sched.target_item_id || schedCfg.blueprint_id)) {
      const bpId = sched.target_item_id || schedCfg.blueprint_id;
      setSelectedBlueprintIds([bpId]);
      setSchedBlueprintId(bpId);
    } else {
      setSelectedBlueprintIds([]);
    }

    if (pType === 'product_campaign' && sched.target_item_id) {
      setSelectedProductIds([sched.target_item_id]);
    } else {
      setSelectedProductIds([]);
    }

    if (pType === 'editorial_campaign') {
      const isKeywordMode = Boolean(schedCfg.keyword || schedCfg.use_brand_pillars === false);
      if (isKeywordMode) {
        setSchedEditorialMode('keyword');
        const singleKw = schedCfg.keyword || sched.target_item_title || sched.topic || '';
        setSchedEditorialKeywordsText(singleKw);
        setSelectedPillars([]);
      } else {
        setSchedEditorialMode('pillar');
        setSchedEditorialKeywordsText('');
        if (sched.target_item_id || sched.target_item_title) {
          setSelectedPillars([sched.target_item_id || sched.target_item_title]);
        } else {
          setSelectedPillars([]);
        }
      }
    } else {
      setSelectedPillars([]);
      setSchedEditorialKeywordsText('');
    }

    setSchedSelectedCep(schedCfg.selected_cep || 'auto');
    setSchedPostAffiliateLink(schedCfg.post_link_affiliate !== false);
    setSchedGenerateRecipe(schedCfg.generate_recipe !== false);
    setSchedPromotionContext(schedCfg.promotion_context || (sched.topic && sched.topic !== sched.target_item_title ? sched.topic : ''));

    if (pType === 'recipe_labs') {
      setSchedImagesPerRecipe(schedCfg.images_per_recipe || 4);
      setSchedLayoutId(schedCfg.selected_layout_id || '4_editorial_split');
      setSchedRecipeAspectRatio(schedCfg.aspect_ratio || '3:4');
      setSchedVisualStyle(schedCfg.visual_style || 'Modern Minimalist Nordic Studio');
      setSchedPostToFacebook(schedCfg.post_to_facebook !== false);
      setSchedTargetLanguage(schedCfg.target_language || 'en_US');
      setSchedRecipeClassification(schedCfg.recipe_classification || schedCfg.category || sched.category || 'Main Courses & Entrees');
    }

    setProductSearchQuery('');
    setPillarSearchQuery('');
    setSchedBlueprintSearchQuery('');

    fetchPresetsForModalBrand(sched.brand_id, pType);
    setReplizSearchQuery('');
    setSelectedPlatformFilter('all');
    if (replizAccounts.length < 20) {
      fetchReplizAccounts(true);
    }
    if (catalogProducts.length === 0) {
      fetchProducts();
    }
    setIsScheduleModalOpen(true);
  }

  async function handleSaveSchedule(e) {
    e.preventDefault();
    if (!schedBrandId) return showToast('Pilih Brand Profile', 'error');

    // Validasi universal nama jadwal
    if (!schedName.trim()) return showToast('Nama Pengenal Jadwal wajib diisi', 'error');

    // Validasi spesifik tipe kampanye
    if (schedCampaignType === 'product_campaign') {
      if (!editingSchedule) {
        if (selectedProductIds.length === 0) {
          return showToast('Pilih minimal 1 produk dari katalog untuk dijadwalkan.', 'error');
        }
        if (schedProductPromoMode === 'multi_angle') {
          const angles = schedProductAngleList.split('\n').map(a => a.trim()).filter(Boolean);
          if (angles.length === 0) {
            return showToast('Masukkan minimal 1 baris angle promosi produk.', 'error');
          }
        }
      }
    } else if (schedCampaignType === 'editorial_campaign') {
      if (!editingSchedule) {
        if (schedEditorialMode === 'keyword') {
          const kws = schedEditorialKeywordsText.split('\n').map(k => k.trim()).filter(Boolean);
          if (kws.length === 0) {
            return showToast('Masukkan minimal 1 baris kata kunci target.', 'error');
          }
        } else if (selectedPillars.length === 0) {
          return showToast('Pilih minimal 1 pilar konten brand untuk dijadwalkan.', 'error');
        }
      }
    } else if (schedCampaignType === 'recipe_campaign') {
      if (!editingSchedule && schedRecipeMode === 'menu_list') {
        const menus = schedRecipeMenuList.split('\n').map(m => m.trim()).filter(Boolean);
        if (menus.length === 0) {
          return showToast('Masukkan minimal 1 baris nama menu kuliner.', 'error');
        }
      } else {
        if (!schedTopic.trim()) return showToast('Tema / Arahan topik resep wajib diisi', 'error');
      }
    } else if (schedCampaignType === 'multiplier_campaign') {
      if (!editingSchedule && selectedBlueprintIds.length === 0) {
        return showToast('Pilih minimal 1 blueprint acuan video untuk dijadwalkan.', 'error');
      }
    }

    setSavingSchedule(true);
    try {
      if (editingSchedule) {
        // Edit mode (single update)
        let targetId = editingSchedule.target_item_id;
        let targetTitle = editingSchedule.target_item_title;
        let schedTopicVal = schedTopic;
        if (schedCampaignType === 'product_campaign' && selectedProductIds.length > 0) {
          targetId = selectedProductIds[0];
          const prodObj = catalogProducts.find(p => p.id === targetId);
          targetTitle = prodObj?.product_name || targetTitle;
          schedTopicVal = schedPromotionContext.trim() || targetTitle;
        } else if (schedCampaignType === 'editorial_campaign') {
          if (schedEditorialMode === 'keyword') {
            const kw = schedEditorialKeywordsText.split('\n').map(k => k.trim()).filter(Boolean)[0] || schedTopic;
            targetId = kw;
            targetTitle = kw;
            schedTopicVal = kw;
          } else if (selectedPillars.length > 0) {
            targetId = selectedPillars[0];
            targetTitle = selectedPillars[0];
            schedTopicVal = targetTitle;
          }
        } else if (schedCampaignType === 'multiplier_campaign') {
          targetId = schedBlueprintId || editingSchedule.target_item_id || (blueprints[0]?.id || null);
          const bpObj = blueprints.find(b => b.id === targetId);
          targetTitle = bpObj?.original_caption || bpObj?.source_url || 'Winning Blueprint';
          schedTopicVal = targetTitle;
        }

        const schedModalPresets = modalBrandPresets.length > 0 ? modalBrandPresets : operatorPresets;
        const schedFoundPreset = schedModalPresets.find(p => p.key === schedPresetKey);
        const schedFoundCfg = schedFoundPreset?.config || schedFoundPreset || {};
        const schedViId = schedFoundCfg?.visual_swap?.visual_identity_preset_id || null;

        const editPipelineConfig = schedCampaignType === 'product_campaign'
          ? { product_id: targetId, selected_cep: schedSelectedCep || 'auto', promotion_context: schedPromotionContext.trim() || null, visual_identity_preset_id: schedViId }
          : (schedCampaignType === 'editorial_campaign'
              ? {
                  content_pillar: targetTitle,
                  keyword: schedEditorialMode === 'keyword' ? targetTitle : null,
                  use_brand_pillars: schedEditorialMode !== 'keyword',
                  visual_identity_preset_id: schedViId
                }
              : (schedCampaignType === 'multiplier_campaign'
                  ? { blueprint_id: targetId, execution_mode: 'full_autopilot', generate_recipe: schedGenerateRecipe, visual_identity_preset_id: schedViId }
                  : (schedCampaignType === 'recipe_labs'
                      ? { 
                          images_per_recipe: schedImagesPerRecipe, 
                          selected_layout_id: schedLayoutId, 
                          aspect_ratio: schedRecipeAspectRatio || '3:4',
                          visual_style: schedVisualStyle, 
                          post_to_facebook: schedPostToFacebook,
                          topic: schedTopicVal,
                          category: schedCategory,
                          recipe_classification: schedRecipeClassification,
                          target_language: schedTargetLanguage || 'en_US'
                        }
                      : (schedCampaignType === 'threads_series'
                          ? {
                              post_objective: threadsObjective,
                              personal_product_name: threadsPersonalProductName,
                              personal_product_cta: threadsPersonalProductCta,
                              affiliate_product_title: threadsAffiliateProductTitle,
                              affiliate_product_link: threadsAffiliateProductLink,
                              pure_organic_topic: threadsPureOrganicTopic,
                              visual_mode: threadsVisualMode,
                              account_id: threadsSelectedAccountId || null
                            }
                          : { visual_identity_preset_id: schedViId }))));
        editPipelineConfig.post_link_affiliate = schedPostAffiliateLink;
        if (schedCampaignType === 'multiplier_campaign' || schedCampaignType === 'recipe_campaign') {
          editPipelineConfig.generate_recipe = schedGenerateRecipe;
        }

        const payload = {
          name: schedName.trim(),
          brand_id: schedBrandId,
          preset_key: schedPresetKey,
          pipeline_type: schedCampaignType,
          target_item_id: targetId,
          target_item_title: targetTitle,
          topic: schedTopicVal,
          category: schedCategory,
          recipe_count: 1,
          generation_time: schedGenTime,
          publish_time: schedPubTime,
          days_of_week: schedDays,
          schedule_mode: schedMode,
          target_date: schedMode === 'specific_date' ? schedTargetDate : null,
          repliz_account_ids: schedReplizAccountIds,
          auto_publish_enabled: schedAutoPublish,
          timezone: 'Asia/Jakarta',
          pipeline_config: editPipelineConfig
        };

        const res = await fetch(`/api/v2/recipes/auto-pipeline-schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Gagal memperbarui jadwal');
        showToast('Jadwal berhasil diperbarui! ✅');
      } else {
        // Create mode: Cek apakah Batch atau Single
        if (schedCampaignType === 'product_campaign' && selectedProductIds.length > 1) {
          // BATCH PRODUK: 1 Produk = 1 Baris Jadwal Mandiri
          const promoCtx = schedPromotionContext.trim() || null;
          const customNameBase = schedName.trim();
          const items = selectedProductIds.map((prodId, idx) => {
            const prod = catalogProducts.find(p => p.id === prodId);
            const prodName = prod?.product_name || 'Produk Katalog';
            const itemScheduleName = customNameBase
              ? (customNameBase.toLowerCase().includes(prodName.toLowerCase()) ? customNameBase : `${customNameBase} - ${prodName}`)
              : `${prodName} — ${schedGenTime} WIB`;
            let itemDays = schedDays;
            let itemTargetDate = schedTargetDate;
            if (schedMode === 'specific_date') {
              if (schedStaggerCalendar && schedTargetDate) {
                const d = new Date(schedTargetDate);
                d.setDate(d.getDate() + idx);
                itemTargetDate = d.toISOString().slice(0, 10);
              }
            } else if (schedStaggerDays && schedDays.length > 0) {
              itemDays = [schedDays[idx % schedDays.length]];
            }
            return {
              name: itemScheduleName,
              brand_id: schedBrandId,
              preset_key: schedPresetKey,
              pipeline_type: 'product_campaign',
              target_item_id: prodId,
              target_item_title: prodName,
              topic: promoCtx || prodName,
              category: prod?.category || 'produk',
              recipe_count: 1,
              generation_time: schedGenTime,
              publish_time: schedPubTime,
              days_of_week: itemDays,
              schedule_mode: schedMode,
              target_date: schedMode === 'specific_date' ? itemTargetDate : null,
              repliz_account_ids: schedReplizAccountIds,
              auto_publish_enabled: schedAutoPublish,
              timezone: 'Asia/Jakarta',
              pipeline_config: { product_id: prodId, product_name: prodName, selected_cep: schedSelectedCep || 'auto', promotion_context: promoCtx, post_link_affiliate: schedPostAffiliateLink }
            };
          });

          const res = await fetch('/api/v2/recipes/auto-pipeline-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Gagal membuat jadwal batch produk');
          showToast(`Berhasil membuat ${items.length} baris jadwal video produk independen! 🛍️`);
        } else if (schedCampaignType === 'editorial_campaign' && schedEditorialMode === 'keyword') {
          // BATCH KEYWORD EDITORIAL (Opsi A: 1 Baris Keyword = 1 Jadwal Mandiri)
          const keywords = schedEditorialKeywordsText.split('\n').map(k => k.trim()).filter(Boolean);
          if (keywords.length === 0) throw new Error('Masukkan minimal 1 baris kata kunci target.');

          const customNameBase = schedName.trim();
          const items = keywords.map((kw, idx) => {
            let itemDays = schedDays;
            let itemTargetDate = schedTargetDate;
            if (schedMode === 'specific_date') {
              if (schedStaggerCalendar && schedTargetDate) {
                const d = new Date(schedTargetDate);
                d.setDate(d.getDate() + idx);
                itemTargetDate = d.toISOString().slice(0, 10);
              }
            } else if (schedStaggerDays && schedDays.length > 0) {
              itemDays = [schedDays[idx % schedDays.length]];
            }
            const itemScheduleName = customNameBase
              ? (customNameBase.toLowerCase().includes(kw.toLowerCase()) ? customNameBase : `${customNameBase} - ${kw}`)
              : `Keyword: ${kw} — ${schedGenTime} WIB`;
            return {
              name: itemScheduleName,
              brand_id: schedBrandId,
              preset_key: schedPresetKey,
              pipeline_type: 'editorial_campaign',
              target_item_id: kw,
              target_item_title: kw,
              topic: kw,
              category: 'editorial',
              recipe_count: 1,
              generation_time: schedGenTime,
              publish_time: schedPubTime,
              days_of_week: itemDays,
              schedule_mode: schedMode,
              target_date: schedMode === 'specific_date' ? itemTargetDate : null,
              repliz_account_ids: schedReplizAccountIds,
              auto_publish_enabled: schedAutoPublish,
              timezone: 'Asia/Jakarta',
              pipeline_config: { 
                content_pillar: kw, 
                keyword: kw, 
                use_brand_pillars: false, 
                post_link_affiliate: schedPostAffiliateLink 
              }
            };
          });

          const res = await fetch('/api/v2/recipes/auto-pipeline-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Gagal membuat jadwal batch keyword');
          showToast(`Berhasil membuat ${items.length} baris jadwal video keyword independen! 🎯`);
        } else if (schedCampaignType === 'editorial_campaign' && selectedPillars.length > 1) {
          // BATCH EDITORIAL: 1 Pilar = 1 Baris Jadwal Mandiri
          const customNameBase = schedName.trim();
          const items = selectedPillars.map((pillar, idx) => {
            const itemScheduleName = customNameBase
              ? (customNameBase.toLowerCase().includes(pillar.toLowerCase()) ? customNameBase : `${customNameBase} - ${pillar}`)
              : `${pillar} — ${schedGenTime} WIB`;
            let itemDays = schedDays;
            let itemTargetDate = schedTargetDate;
            if (schedMode === 'specific_date') {
              if (schedStaggerCalendar && schedTargetDate) {
                const d = new Date(schedTargetDate);
                d.setDate(d.getDate() + idx);
                itemTargetDate = d.toISOString().slice(0, 10);
              }
            } else if (schedStaggerDays && schedDays.length > 0) {
              itemDays = [schedDays[idx % schedDays.length]];
            }
            return {
              name: itemScheduleName,
              brand_id: schedBrandId,
              preset_key: schedPresetKey,
              pipeline_type: 'editorial_campaign',
              target_item_id: pillar,
              target_item_title: pillar,
              topic: pillar,
              category: 'editorial',
              recipe_count: 1,
              generation_time: schedGenTime,
              publish_time: schedPubTime,
              days_of_week: itemDays,
              schedule_mode: schedMode,
              target_date: schedMode === 'specific_date' ? itemTargetDate : null,
              repliz_account_ids: schedReplizAccountIds,
              auto_publish_enabled: schedAutoPublish,
              timezone: 'Asia/Jakarta',
              pipeline_config: { content_pillar: pillar, post_link_affiliate: schedPostAffiliateLink }
            };
          });

          const res = await fetch('/api/v2/recipes/auto-pipeline-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Gagal membuat jadwal batch editorial');
          showToast(`Berhasil membuat ${items.length} baris jadwal video editorial independen! 📖`);
        } else if (schedCampaignType === 'recipe_campaign' && schedRecipeMode === 'menu_list') {
          // BATCH RESEP KULINER: 1 Menu = 1 Baris Jadwal Mandiri (Auto Category Detect)
          const menus = schedRecipeMenuList.split('\n').map(m => m.trim()).filter(Boolean);
          if (menus.length === 0) throw new Error('Masukkan minimal 1 baris menu resep.');

          const customNameBase = schedName.trim();
          const items = menus.map((menuTitle, idx) => {
            let itemDays = schedDays;
            let itemTargetDate = schedTargetDate;
            if (schedMode === 'specific_date') {
              if (schedStaggerCalendar && schedTargetDate) {
                const d = new Date(schedTargetDate);
                d.setDate(d.getDate() + idx);
                itemTargetDate = d.toISOString().slice(0, 10);
              }
            } else if (schedStaggerDays && schedDays.length > 0) {
              itemDays = [schedDays[idx % schedDays.length]];
            }
            const autoCat = detectCategoryFromTopic(menuTitle);
            const itemScheduleName = customNameBase
              ? (customNameBase.toLowerCase().includes(menuTitle.toLowerCase()) ? customNameBase : `${customNameBase} - ${menuTitle}`)
              : `Resep: ${menuTitle} — ${schedGenTime} WIB`;
            return {
              name: itemScheduleName,
              brand_id: schedBrandId,
              preset_key: schedPresetKey,
              pipeline_type: 'recipe_campaign',
              target_item_id: null,
              target_item_title: menuTitle,
              topic: menuTitle,
              category: autoCat,
              recipe_count: 1,
              generation_time: schedGenTime,
              publish_time: schedPubTime,
              days_of_week: itemDays,
              schedule_mode: schedMode,
              target_date: schedMode === 'specific_date' ? itemTargetDate : null,
              repliz_account_ids: schedReplizAccountIds,
              auto_publish_enabled: schedAutoPublish,
              timezone: 'Asia/Jakarta',
              pipeline_config: {
                generate_recipe: schedGenerateRecipe,
                post_link_affiliate: schedPostAffiliateLink
              }
            };
          });

          const res = await fetch('/api/v2/recipes/auto-pipeline-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Gagal membuat jadwal batch resep');
          showToast(`Berhasil membuat ${items.length} baris jadwal resep kuliner independen! 🍳`);
        } else if (schedCampaignType === 'multiplier_campaign' && selectedBlueprintIds.length > 1) {
          // BATCH MULTIPLIER: 1 Blueprint = 1 Baris Jadwal Mandiri
          const customNameBase = schedName.trim();
          const items = selectedBlueprintIds.map((bpId, idx) => {
            const bpObj = blueprints.find(b => b.id === bpId);
            const bpTitle = bpObj?.core_problem || bpObj?.original_caption || bpObj?.source_url || 'Winning Blueprint';
            let itemDays = schedDays;
            let itemTargetDate = schedTargetDate;
            if (schedMode === 'specific_date') {
              if (schedStaggerCalendar && schedTargetDate) {
                const d = new Date(schedTargetDate);
                d.setDate(d.getDate() + idx);
                itemTargetDate = d.toISOString().slice(0, 10);
              }
            } else if (schedStaggerDays && schedDays.length > 0) {
              itemDays = [schedDays[idx % schedDays.length]];
            }
            const itemScheduleName = customNameBase
              ? (customNameBase.toLowerCase().includes(bpTitle.toLowerCase()) ? customNameBase : `${customNameBase} - ${bpTitle}`)
              : `Multiplier: ${bpTitle} — ${schedGenTime} WIB`;
            return {
              name: itemScheduleName,
              brand_id: schedBrandId,
              preset_key: schedPresetKey,
              pipeline_type: 'multiplier_campaign',
              target_item_id: bpId,
              target_item_title: bpTitle,
              topic: bpTitle,
              category: 'multiplier',
              recipe_count: 1,
              generation_time: schedGenTime,
              publish_time: schedPubTime,
              days_of_week: itemDays,
              schedule_mode: schedMode,
              target_date: schedMode === 'specific_date' ? itemTargetDate : null,
              repliz_account_ids: schedReplizAccountIds,
              auto_publish_enabled: schedAutoPublish,
              timezone: 'Asia/Jakarta',
              pipeline_config: {
                blueprint_id: bpId,
                execution_mode: 'full_autopilot',
                generate_recipe: schedGenerateRecipe,
                post_link_affiliate: schedPostAffiliateLink
              }
            };
          });

          const res = await fetch('/api/v2/recipes/auto-pipeline-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Gagal membuat jadwal batch multiplier');
          showToast(`Berhasil membuat ${items.length} baris jadwal multiplier video independen! 🔀`);
        } else if (schedCampaignType === 'product_campaign' && schedProductPromoMode === 'multi_angle') {
          // BATCH PRODUK MULTI-ANGLE: 1 Angle = 1 Baris Jadwal Mandiri untuk 1 Produk Unggulan
          const angles = schedProductAngleList.split('\n').map(a => a.trim()).filter(Boolean);
          if (angles.length === 0) throw new Error('Masukkan minimal 1 baris angle promosi produk.');
          const prodId = selectedProductIds[0] || catalogProducts[0]?.id;
          const prod = catalogProducts.find(p => p.id === prodId);
          const prodTitle = prod?.product_name || 'Produk Katalog';
          const customNameBase = schedName.trim();

          const items = angles.map((angleText, idx) => {
            let itemDays = schedDays;
            let itemTargetDate = schedTargetDate;
            if (schedMode === 'specific_date') {
              if (schedStaggerCalendar && schedTargetDate) {
                const d = new Date(schedTargetDate);
                d.setDate(d.getDate() + idx);
                itemTargetDate = d.toISOString().slice(0, 10);
              }
            } else if (schedStaggerDays && schedDays.length > 0) {
              itemDays = [schedDays[idx % schedDays.length]];
            }
            const itemScheduleName = customNameBase
              ? `${customNameBase} - ${angleText}`
              : `[${prodTitle}] ${angleText} — ${schedGenTime} WIB`;
            return {
              name: itemScheduleName,
              brand_id: schedBrandId,
              preset_key: schedPresetKey,
              pipeline_type: 'product_campaign',
              target_item_id: prodId,
              target_item_title: prodTitle,
              topic: angleText,
              category: prod?.category || 'produk',
              recipe_count: 1,
              generation_time: schedGenTime,
              publish_time: schedPubTime,
              days_of_week: itemDays,
              schedule_mode: schedMode,
              target_date: schedMode === 'specific_date' ? itemTargetDate : null,
              repliz_account_ids: schedReplizAccountIds,
              auto_publish_enabled: schedAutoPublish,
              timezone: 'Asia/Jakarta',
              pipeline_config: {
                product_id: prodId,
                selected_cep: schedSelectedCep || 'auto',
                promotion_context: angleText,
                post_link_affiliate: schedPostAffiliateLink
              }
            };
          });

          const res = await fetch('/api/v2/recipes/auto-pipeline-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Gagal membuat jadwal batch angle produk');
          showToast(`Berhasil membuat ${items.length} baris jadwal promosi angle produk independen! 📦`);
        } else {
          // Single Creation (1 Produk, 1 Pilar, atau Resep)
          let finalName = schedName.trim();
          let targetId = null;
          let targetTitle = null;
          let finalTopic = schedTopic;
          let finalCategory = schedCategory;

          if (schedCampaignType === 'product_campaign') {
            const prodId = selectedProductIds[0];
            const prod = catalogProducts.find(p => p.id === prodId);
            targetId = prodId;
            targetTitle = prod?.product_name || 'Produk Katalog';
            finalTopic = schedPromotionContext.trim() || targetTitle;
            finalCategory = prod?.category || 'produk';
            if (!finalName) finalName = `${targetTitle} — ${schedGenTime} WIB`;
          } else if (schedCampaignType === 'editorial_campaign') {
            if (schedEditorialMode === 'keyword') {
              const kw = schedEditorialKeywordsText.split('\n').map(k => k.trim()).filter(Boolean)[0] || 'Keyword Editorial';
              targetId = kw;
              targetTitle = kw;
              finalTopic = kw;
              finalCategory = 'editorial';
              if (!finalName) finalName = `Keyword: ${kw} — ${schedGenTime} WIB`;
            } else {
              const pillar = selectedPillars[0];
              targetId = pillar;
              targetTitle = pillar;
              finalTopic = pillar;
              finalCategory = 'editorial';
              if (!finalName) finalName = `${pillar} — ${schedGenTime} WIB`;
            }
          } else if (schedCampaignType === 'multiplier_campaign') {
            targetId = (selectedBlueprintIds.length > 0 ? selectedBlueprintIds[0] : schedBlueprintId) || (blueprints[0]?.id || null);
            const bpObj = blueprints.find(b => b.id === targetId);
            targetTitle = bpObj?.core_problem || bpObj?.core_solution || bpObj?.original_caption || bpObj?.source_url || 'Winning Blueprint';
            finalTopic = targetTitle;
            finalCategory = 'multiplier';
            if (!finalName) finalName = `Multiplier: ${targetTitle} — ${schedGenTime} WIB`;
          } else if (schedCampaignType === 'recipe_labs') {
            targetTitle = schedTopic?.trim() || 'Culinary Recipe';
            finalTopic = targetTitle;
            finalCategory = schedRecipeClassification || (schedTargetLanguage === 'id_ID' ? 'Menu Hidangan Utama & Lauk Pauk (Main Course)' : 'Main Courses & Entrees');
            if (!finalName) finalName = `Recipe: ${targetTitle} (${schedImagesPerRecipe}G) — ${schedGenTime} WIB`;
          } else if (schedCampaignType === 'threads_series') {
            finalCategory = 'threads_series';
            const threadsTitle = threadsObjective === 'personal_product'
              ? threadsPersonalProductName
              : (threadsObjective === 'affiliate_shopee' ? threadsAffiliateProductTitle : threadsPureOrganicTopic);
            targetTitle = threadsTitle;
            finalTopic = threadsTitle;
            if (!finalName) finalName = `Threads: ${threadsTitle} — ${schedGenTime} WIB`;
          }

          const schedModalPresetsSingle = modalBrandPresets.length > 0 ? modalBrandPresets : operatorPresets;
          const schedFoundPresetSingle = schedModalPresetsSingle.find(p => p.key === schedPresetKey);
          const schedFoundCfgSingle = schedFoundPresetSingle?.config || schedFoundPresetSingle || {};
          const schedViIdSingle = schedFoundCfgSingle?.visual_swap?.visual_identity_preset_id || null;

          const pipelineConfigPayload = schedCampaignType === 'product_campaign'
            ? { product_id: targetId, selected_cep: schedSelectedCep || 'auto', promotion_context: schedPromotionContext.trim() || null, visual_identity_preset_id: schedViIdSingle }
            : (schedCampaignType === 'editorial_campaign'
                ? { 
                    content_pillar: targetTitle, 
                    keyword: schedEditorialMode === 'keyword' ? targetTitle : null,
                    use_brand_pillars: schedEditorialMode !== 'keyword',
                    visual_identity_preset_id: schedViIdSingle 
                  }
                : (schedCampaignType === 'multiplier_campaign'
                    ? { blueprint_id: targetId, execution_mode: 'full_autopilot', generate_recipe: schedGenerateRecipe, visual_identity_preset_id: schedViIdSingle }
                    : (schedCampaignType === 'recipe_labs'
                        ? { 
                            images_per_recipe: schedImagesPerRecipe, 
                            selected_layout_id: schedLayoutId, 
                            aspect_ratio: schedRecipeAspectRatio || '3:4',
                            visual_style: schedVisualStyle, 
                            post_to_facebook: schedPostToFacebook,
                            topic: finalTopic,
                            category: finalCategory,
                            recipe_classification: finalCategory,
                            target_language: schedTargetLanguage || 'en_US'
                          }
                        : (schedCampaignType === 'threads_series'
                            ? {
                                post_objective: threadsObjective,
                                personal_product_name: threadsPersonalProductName,
                                personal_product_cta: threadsPersonalProductCta,
                                affiliate_product_title: threadsAffiliateProductTitle,
                                affiliate_product_link: threadsAffiliateProductLink,
                                pure_organic_topic: threadsPureOrganicTopic,
                                visual_mode: threadsVisualMode,
                                account_id: threadsSelectedAccountId || null
                              }
                            : { visual_identity_preset_id: schedViIdSingle }))));
          pipelineConfigPayload.post_link_affiliate = schedPostAffiliateLink;
          if (schedCampaignType === 'multiplier_campaign' || schedCampaignType === 'recipe_campaign') {
            pipelineConfigPayload.generate_recipe = schedGenerateRecipe;
          }

          const payload = {
            name: finalName,
            brand_id: schedBrandId,
            preset_key: schedPresetKey,
            pipeline_type: schedCampaignType,
            target_item_id: targetId,
            target_item_title: targetTitle,
            topic: finalTopic,
            category: finalCategory,
            recipe_count: 1,
            generation_time: schedGenTime,
            publish_time: schedPubTime,
            days_of_week: schedDays,
            schedule_mode: schedMode,
            target_date: schedMode === 'specific_date' ? schedTargetDate : null,
            repliz_account_ids: schedReplizAccountIds,
            auto_publish_enabled: schedAutoPublish,
            timezone: 'Asia/Jakarta',
            pipeline_config: pipelineConfigPayload
          };

          const res = await fetch('/api/v2/recipes/auto-pipeline-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Gagal membuat jadwal');
          showToast('Jadwal rutin baru berhasil dibuat! ⏰');
        }
      }

      setIsScheduleModalOpen(false);
      fetchSchedules();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleTogglePause(sched) {
    try {
      const res = await fetch(`/api/v2/recipes/auto-pipeline-schedules/${sched.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_pause' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(`Jadwal "${sched.name}" ${data.data.status === 'paused' ? 'dijeda ⏸️' : 'dilanjutkan ▶️'}`);
      fetchSchedules();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleArchiveSchedule(sched) {
    if (!confirm(`Apakah Anda yakin ingin mengarsipkan jadwal "${sched.name}"?`)) return;
    try {
      const res = await fetch(`/api/v2/recipes/auto-pipeline-schedules/${sched.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(`Jadwal "${sched.name}" berhasil diarsipkan 📦`);
      fetchSchedules();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDeleteSchedule(sched) {
    if (!confirm(`Hapus permanen jadwal "${sched.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/v2/recipes/auto-pipeline-schedules/${sched.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(`Jadwal "${sched.name}" berhasil dihapus.`);
      fetchSchedules();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRunNow(sched) {
    if (!confirm(`Jalankan pipeline instan sekarang untuk menguji jadwal "${sched.name}"?`)) return;
    try {
      setRunningScheduleIds(prev => ({ ...prev, [sched.id]: true }));
      showToast(`⚡ Memulai eksekusi instan untuk "${sched.name}" di latar belakang...`);
      const res = await fetch(`/api/v2/recipes/auto-pipeline-schedules/${sched.id}/run-now`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(`⚡ Pipeline sedang diproses oleh AI di latar belakang! Memantau status...`);
      fetchSchedules(true);
    } catch (err) {
      setRunningScheduleIds(prev => {
        const next = { ...prev };
        delete next[sched.id];
        return next;
      });
      showToast(err.message, 'error');
    }
  }

  function getPlatformIcon(platform) {
    const p = String(platform).toLowerCase();
    if (p.includes('instagram')) return { icon: '📸', label: 'Instagram Reels', color: '#e1306c' };
    if (p.includes('tiktok')) return { icon: '🎵', label: 'TikTok', color: '#00f2fe' };
    if (p.includes('facebook')) return { icon: '📘', label: 'Facebook Reels', color: '#1877f2' };
    if (p.includes('youtube')) return { icon: '▶️', label: 'YouTube Shorts', color: '#ff0000' };
    return { icon: '🌐', label: platform, color: 'var(--action-primary)' };
  }

  function formatDaysOfWeek(days = []) {
    if (!Array.isArray(days) || days.length === 0) return 'Tidak aktif';
    if (days.length === 7) return 'Setiap Hari (Senin – Minggu)';
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    return days.map(d => dayNames[d]).join(', ');
  }

  const activeSchedulesCount = schedules.filter(s => s.status === 'active').length;
  const countAllCampaigns = schedules.length;
  const countProductCampaigns = schedules.filter(s => s.pipeline_type === 'product_campaign').length;
  const countEditorialCampaigns = schedules.filter(s => s.pipeline_type === 'editorial_campaign').length;
  const countRecipeCampaigns = schedules.filter(s => (s.pipeline_type || 'recipe_campaign') === 'recipe_campaign').length;
  const countMultiplierCampaigns = schedules.filter(s => s.pipeline_type === 'multiplier_campaign').length;
  const countRecipeLabsCampaigns = schedules.filter(s => s.pipeline_type === 'recipe_labs').length;
  const countThreadsSeriesCampaigns = schedules.filter(s => s.pipeline_type === 'threads_series').length;

  const filteredSchedules = schedules.filter(s => {
    const pType = s.pipeline_type || 'recipe_campaign';
    if (campaignTypeFilter !== 'all' && pType !== campaignTypeFilter) return false;
    if (scheduleFilter !== 'all' && s.status !== scheduleFilter) return false;
    if (scheduleBrandFilter !== 'all' && s.brand_id !== scheduleBrandFilter) return false;
    if (scheduleModeFilter !== 'all' && (s.schedule_mode || 'recurring') !== scheduleModeFilter) return false;
    return true;
  });

  function getCampaignTypeBadge(type) {
    switch (type) {
      case 'product_campaign':
        return {
          icon: '🛍️',
          label: 'Video Produk',
          color: 'var(--status-success)',
          bg: 'var(--status-success-soft)',
          border: 'var(--status-success)'
        };
      case 'editorial_campaign':
        return {
          icon: '📖',
          label: 'Video Editorial',
          color: 'var(--status-info)',
          bg: 'var(--status-info-soft)',
          border: 'var(--status-info)'
        };
      case 'multiplier_campaign':
        return {
          icon: '🔀',
          label: 'Video Multiplier',
          color: 'var(--status-purple)',
          bg: 'var(--status-purple-soft)',
          border: 'var(--status-purple)'
        };
      case 'recipe_labs':
        return {
          icon: '🖼️',
          label: 'Resep Teks & Foto',
          color: 'var(--status-rose)',
          bg: 'var(--status-rose-soft)',
          border: 'var(--status-rose)'
        };
      case 'threads_series':
        return {
          icon: '🧵',
          label: 'Threads Series',
          color: 'var(--status-info)',
          bg: 'var(--status-info-soft)',
          border: 'var(--status-info)'
        };
      case 'recipe_campaign':
      default:
        return {
          icon: '🍳',
          label: 'Video Resep',
          color: 'var(--status-warning)',
          bg: 'var(--status-warning-soft)',
          border: 'var(--status-warning)'
        };
    }
  }

  // Filtered Repliz Accounts computation (Search & Platform tabs)
  const filteredReplizAccounts = replizAccounts.filter(acc => {
    const p = String(acc.platform || '').toLowerCase();
    const matchPlatform = selectedPlatformFilter === 'all' || p === selectedPlatformFilter;
    const q = replizSearchQuery.toLowerCase().trim();
    const matchQuery = !q ||
      (acc.display_name && acc.display_name.toLowerCase().includes(q)) ||
      (acc.username && acc.username.toLowerCase().includes(q)) ||
      p.includes(q);
    return matchPlatform && matchQuery;
  });

  const platformTabs = [
    { key: 'all', label: 'Semua Platform', count: replizAccounts.length },
    { key: 'instagram', label: '📸 Instagram Reels', count: replizAccounts.filter(a => String(a.platform).toLowerCase() === 'instagram').length },
    { key: 'tiktok', label: '🎵 TikTok', count: replizAccounts.filter(a => String(a.platform).toLowerCase() === 'tiktok').length },
    { key: 'facebook', label: '📘 Facebook Reels', count: replizAccounts.filter(a => String(a.platform).toLowerCase() === 'facebook').length },
    { key: 'youtube', label: '▶️ YouTube Shorts', count: replizAccounts.filter(a => String(a.platform).toLowerCase() === 'youtube').length },
  ];

  function handleSelectAllVisible() {
    const visibleIds = filteredReplizAccounts.map(a => a.id);
    setSchedReplizAccountIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  }

  function handleClearSelections() {
    setSchedReplizAccountIds([]);
  }

  function handleSyncReplizAccounts() {
    fetchReplizAccounts(true);
  }

  // Filtered Products computation (Product Campaign)
  const filteredCatalogProducts = catalogProducts.filter(p => {
    if (!productSearchQuery.trim()) return true;
    const q = productSearchQuery.toLowerCase().trim();
    return (p.product_name && p.product_name.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q));
  });

  function toggleProductSelection(prodId) {
    setSelectedProductIds(prev => {
      if (prev.includes(prodId)) return prev.filter(id => id !== prodId);
      return [...prev, prodId];
    });
  }

  function handleSelectAllProducts() {
    const visibleIds = filteredCatalogProducts.map(p => p.id);
    setSelectedProductIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  }

  function handleClearProducts() {
    setSelectedProductIds([]);
  }

  // Filtered Pillars computation (Editorial Campaign)
  const currentModalBrandObj = brands.find(b => b.id === schedBrandId);
  let modalAvailablePillars = [];
  if (currentModalBrandObj?.editorial_content_pillars_json) {
    try {
      const parsed = typeof currentModalBrandObj.editorial_content_pillars_json === 'string'
        ? JSON.parse(currentModalBrandObj.editorial_content_pillars_json)
        : currentModalBrandObj.editorial_content_pillars_json;
      if (Array.isArray(parsed) && parsed.length > 0) modalAvailablePillars = parsed;
    } catch (e) {
      console.warn('Error parsing pillars:', e);
    }
  }
  if (modalAvailablePillars.length === 0) {
    modalAvailablePillars = [
      'Eat Better, Not Perfect',
      'Tips Nutrisi & Gaya Hidup Sehat',
      'Mitos vs Fakta Keseharian',
      'Small Habits, Real Life',
      'Review & Eksperimen Dapur'
    ];
  }

  const filteredPillars = modalAvailablePillars.filter(p => {
    if (!pillarSearchQuery.trim()) return true;
    return p.toLowerCase().includes(pillarSearchQuery.toLowerCase().trim());
  });

  function togglePillarSelection(pillar) {
    setSelectedPillars(prev => {
      if (prev.includes(pillar)) return prev.filter(p => p !== pillar);
      return [...prev, pillar];
    });
  }

  function handleSelectAllPillars() {
    setSelectedPillars(prev => Array.from(new Set([...prev, ...filteredPillars])));
  }

  function handleClearPillars() {
    setSelectedPillars([]);
  }

  // Filtered Products & Pillars computation for Tab 1 (1-Klik Instan)
  const currentInstantBrandObj = brands.find(b => b.id === selectedBrandId);
  let instantAvailablePillars = [];
  if (currentInstantBrandObj?.editorial_content_pillars_json) {
    try {
      const parsed = typeof currentInstantBrandObj.editorial_content_pillars_json === 'string'
        ? JSON.parse(currentInstantBrandObj.editorial_content_pillars_json)
        : currentInstantBrandObj.editorial_content_pillars_json;
      if (Array.isArray(parsed) && parsed.length > 0) instantAvailablePillars = parsed;
    } catch (e) {
      console.warn('Error parsing instant pillars:', e);
    }
  }
  if (instantAvailablePillars.length === 0) {
    instantAvailablePillars = [
      'Eat Better, Not Perfect',
      'Tips Nutrisi & Gaya Hidup Sehat',
      'Mitos vs Fakta Keseharian',
      'Small Habits, Real Life',
      'Review & Eksperimen Dapur'
    ];
  }

  const filteredInstantProducts = catalogProducts.filter(p => {
    if (!instantProductSearch.trim()) return true;
    const q = instantProductSearch.toLowerCase().trim();
    return (p.product_name && p.product_name.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q));
  });

  const filteredInstantPillars = instantAvailablePillars.filter(p => {
    if (!instantPillarSearch.trim()) return true;
    return p.toLowerCase().includes(instantPillarSearch.toLowerCase().trim());
  });

  return (
    <div className="app-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Sidebar />

      <main className="main-content" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {/* Top Header */}
        <header style={{
          height: 60,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>CF Studio</span>
            <span>/</span>
            <span>Workflow</span>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>⚡ Auto Pipeline</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setIsQueueDrawerOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'var(--surface-raised)',
                border: (queueSummary.queued > 0 || queueSummary.processing > 0) ? '1px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
              title="Klik untuk melihat antrean produksi konten"
            >
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: queueSummary.processing > 0 ? 'var(--action-primary)' : (queueSummary.queued > 0 ? 'var(--status-warning)' : 'var(--text-muted)')
              }}></span>
              <span>Antrean: {queueSummary.processing > 0 ? `${queueSummary.processing} Diproses` : 'Idle'} {queueSummary.queued > 0 ? `(${queueSummary.queued} Menunggu)` : ''}</span>
            </button>

            <span style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--status-success-soft)',
              color: 'var(--status-success)',
              border: '1px solid var(--status-success)'
            }}>
              ● Production Cluster Online
            </span>
          </div>
        </header>

        {/* Content Container (Single-Column) */}
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem'
        }}>

          {/* Tenant Lock Warning Banner */}
          {isTenantLocked && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.03))',
              border: '1px solid var(--status-danger)',
              borderRadius: 'var(--radius-md)',
              padding: '36px 24px',
              textAlign: 'center',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔒</div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--status-danger)', margin: '0 0 8px' }}>
                Modul Auto Pipeline Dibatasi oleh Superadmin
              </h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '580px', margin: '0 auto', fontSize: '0.92rem', lineHeight: '1.6' }}>
                Akses ke modul penjadwalan otonom ini dinonaktifkan untuk organisasi/tenant Anda. Silakan hubungi administrator platform jika Anda memerlukan aktivasi fitur ini.
              </p>
            </div>
          )}

          {/* Toast Notification */}
          {toast && (
            <div style={{
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              background: toast.type === 'error' ? 'var(--status-danger-soft)' : 'var(--status-success-soft)',
              color: toast.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)',
              border: `1px solid ${toast.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)'}`,
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
              <span>{toast.msg}</span>
            </div>
          )}

          {/* Hero Banner */}
          <section style={{
            background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-raised) 100%)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem 2rem',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>⚡ Auto Pipeline</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                (1-Click Planner-to-Video Engine)
              </span>
            </h1>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '750px', lineHeight: 1.5 }}>
              Otomatisasi end-to-end produksi konten resep: dari ideasi Gemini AI, auto-hydration profil brand & preset visual dinamis, pembuatan kampanye OPC 8-klip, hingga video final di Nextcloud dan otomatis terdaftar di <strong>ContentFlow Hub</strong> dalam 1 kali klik.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 9999, border: '1px solid var(--border-subtle)', background: 'var(--surface-interactive)', color: 'var(--text-secondary)' }}>
                Single-Pass 1-Call AI
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 9999, border: '1px solid var(--border-subtle)', background: 'var(--surface-interactive)', color: 'var(--text-secondary)' }}>
                Google Veo Omni Flash (8 Klip @ 4s)
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 9999, border: '1px solid var(--border-subtle)', background: 'var(--surface-interactive)', color: 'var(--text-secondary)' }}>
                Minimax Expressive TTS
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 9999, border: '1px solid var(--status-success)', background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>
                ✓ Auto-Sync ContentFlow Hub
              </span>
            </div>
          </section>

          {/* Main Navigation Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            padding: '0.4rem',
            borderRadius: 'var(--radius-md)'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('pipeline')}
              style={{
                flex: 1,
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.88rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: activeTab === 'pipeline' ? 'var(--action-primary)' : 'transparent',
                color: activeTab === 'pipeline' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                transition: 'var(--transition)'
              }}
            >
              <span>⚡</span>
              <span>Eksekusi 1-Klik Instan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('schedules')}
              style={{
                flex: 1,
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.88rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: activeTab === 'schedules' ? 'var(--action-primary)' : 'transparent',
                color: activeTab === 'schedules' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                transition: 'var(--transition)'
              }}
            >
              <span>⏰</span>
              <span>Penjadwal Otomatis & Auto-Publish Repliz</span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                background: activeTab === 'schedules' ? 'rgba(255,255,255,0.25)' : 'var(--status-info-soft)',
                color: activeTab === 'schedules' ? '#ffffff' : 'var(--status-info)',
                padding: '0.1rem 0.45rem',
                borderRadius: 9999
              }}>
                {schedules.length} Jadwal
              </span>
            </button>
          </div>

          {activeTab === 'pipeline' && (
            <>
          {/* BARIS 1: Form Konfigurasi 1-Klik (Clean UI & Terintegrasi Preset Manager) */}
          <section style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            {/* Section Header with Preset Manager Direct Link */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div>
                <div style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <span>⚡</span>
                  <span>Eksekusi 1-Klik Instan Multi-Campaign</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Pilih tipe kampanye, tentukan target (Produk Katalog, Pilar Brand, atau Resep), lalu produksi video final otomatis dalam 1 kali klik.
                </div>
              </div>

              <Link
                href="/settings/presets"
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--action-primary)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.95rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  transition: 'var(--transition)'
                }}
              >
                <span>🎛️</span>
                <span>Kelola di Preset Manager</span>
              </Link>
            </div>

            <form onSubmit={handleLaunchPipeline} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
              {/* STEP 1: CAMPAIGN TYPE SELECTOR CARDS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  1. Pilih Tipe Kampanye
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                  {[
                    { key: 'product_campaign', icon: '🛍️', label: 'Video Produk', desc: 'Promosi produk katalog, showcase USP & unboxing 1-pass', color: 'var(--status-success)' },
                    { key: 'editorial_campaign', icon: '📖', label: 'Video Editorial', desc: 'Pilar brand, hook tension & storytelling edukatif 1-pass', color: 'var(--status-info)' },
                    { key: 'recipe_campaign', icon: '🍳', label: 'Video Resep', desc: 'Food reels & cooking guide 4-babak 1-pass', color: 'var(--status-warning)' },
                    { key: 'multiplier_campaign', icon: '🔀', label: 'Video Multiplier', desc: 'Remix angle & hook dari video referensi pemenang', color: 'var(--status-purple)' },
                    { key: 'recipe_labs', icon: '🖼️', label: 'Resep Teks & Foto', desc: 'Naskah resep FB + Foto AI dalam susunan grid komposit', color: 'var(--status-rose)' },
                    { key: 'threads_series', icon: '🧵', label: 'Threads Series', desc: 'Kultwit autopilot 3–5 part + Foto G-Labs atau Text-Only', color: 'var(--status-info)' }
                  ].map(t => {
                    const isSelected = instantCampaignType === t.key;
                    return (
                      <div
                        key={t.key}
                        onClick={() => setInstantCampaignType(t.key)}
                        style={{
                          background: isSelected ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                          border: `1.5px solid ${isSelected ? t.color : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '0.95rem 1.15rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          transition: 'var(--transition)',
                          boxShadow: isSelected ? `0 0 0 1px ${t.color}` : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.35rem' }}>{t.icon}</span>
                            <strong style={{ fontSize: '0.92rem', color: isSelected ? t.color : 'var(--text-primary)' }}>
                              {t.label}
                            </strong>
                          </div>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.55rem',
                            borderRadius: 9999,
                            background: isSelected ? t.color : 'var(--border-subtle)',
                            color: isSelected ? '#ffffff' : 'var(--text-muted)'
                          }}>
                            {isSelected ? 'AKTIF' : 'PILIH'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                          {t.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: BRAND PROFILE, PRESET VIDEO & EXECUTION MODE (DI ATAS) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '1rem'
              }}>
                {/* 1. Brand Profile */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <span>2. Brand Profile</span>
                  </label>
                  <select
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    style={{
                      height: '42px',
                      boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.85rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  >
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.brand_name} {b.account_handle ? `(@${b.account_handle})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Preset Konfigurasi Video (Preset Manager) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>3. Preset Video</span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--status-success)',
                      background: 'var(--status-success-soft)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-xs)'
                    }}>
                      Preset-Driven
                    </span>
                  </label>
                  <select
                    value={selectedPresetKey}
                    onChange={(e) => handlePresetKeyChange(e.target.value)}
                    style={{
                      height: '42px',
                      boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1.5px solid var(--action-primary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.85rem',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  >
                    {operatorPresets.map(op => (
                      <option key={op.key} value={op.key}>
                        {op.label || op.key}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Mode Eksekusi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)'
                  }}>
                    4. Mode Eksekusi
                  </label>
                  <select
                    value={executionMode}
                    onChange={(e) => setExecutionMode(e.target.value)}
                    style={{
                      height: '42px',
                      boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.85rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  >
                    <option value="full_autopilot">⚡ Full Autopilot (Langsung Produksi Video)</option>
                    <option value="manual_review">⏸️ Manual Review (Jeda di Storyboard Approval)</option>
                  </select>
                </div>
              </div>

              {/* READ-ONLY PRESET INSPECTOR CARD */}
              <div style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📋</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Rincian Bawaan Preset Terpilih:
                      <span style={{ color: 'var(--action-primary)', marginLeft: '0.35rem' }}>
                        {activePresetConfig?.label || selectedPresetKey || 'Default Template'}
                      </span>
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: 'var(--status-info-soft)',
                    color: 'var(--status-info)',
                    border: '1px solid var(--status-info)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 9999
                  }}>
                    🔒 Dikunci & Dikelola oleh Preset Manager
                  </span>
                </div>

                {/* 4 Specs Badges */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '0.75rem'
                }}>
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Format Klip & Durasi
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🎬 {targetClipsCount} Klip × {clipDuration} detik (~{targetClipsCount * clipDuration}s)
                    </span>
                  </div>

                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Model AI & Voice-Over
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isNativeVeo ? (
                        <>🤖 {videoModelName} • <span style={{ color: 'var(--status-success)' }}>🔊 Native Veo [{googleVoicePersona}]</span> ({targetLanguage})</>
                      ) : (
                        <>🤖 {videoModelName} • 🎙️ {voicePersonaName} ({targetLanguage})</>
                      )}
                    </span>
                  </div>

                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Finishing Subtitel
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🟡 {motionStyleDesc}
                    </span>
                  </div>

                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Finishing Transisi FFmpeg
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ✂️ {transitionDesc}
                    </span>
                  </div>

                  <div style={{
                    background: 'var(--surface)',
                    border: '1.5px solid var(--status-purple)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--status-purple)', textTransform: 'uppercase' }}>
                      Identitas Visual (VI) Preset
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--status-purple)' }}>
                      🧬 {activePresetConfig?.visual_swap?.visual_identity_preset_id || selectedPresetId || 'Default Brand VI'}
                    </span>
                  </div>

                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Mode Visual &amp; Pacing
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🎥 {activePresetConfig?.visual_engine?.visual_mode || 'hybrid_lock'} • {wordsPerClip}
                    </span>
                  </div>
                </div>

                {/* Mini Story Arc Timeline Preview */}
                {(() => {
                  const arcData = generateAdaptiveStoryArc(instantCampaignType, targetClipsCount, clipDuration, activePresetConfig, selectedCep);
                  return (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>🎯</span>
                          <span>{arcData.headerSummary}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '9999px',
                            background: 'var(--surface-interactive)',
                            color: 'var(--action-primary)',
                            border: '1px solid var(--border-subtle)'
                          }}>
                            {arcData.isStaticGrid ? 'Format Statis' : `${arcData.pacingTag} ~${arcData.pacingLabel}`}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        {arcData.steps.map((step) => {
                          const isPivot = step.tag && step.tag.includes('PIVOT');
                          const isHook = step.seq === 1;
                          return (
                            <div
                              key={step.seq}
                              style={{
                                background: isPivot ? 'var(--surface-interactive)' : 'var(--surface)',
                                border: isPivot
                                  ? '1.5px solid var(--status-success)'
                                  : (isHook ? '1px solid var(--status-warning)' : '1px solid var(--border-subtle)'),
                                borderRadius: 'var(--radius-xs)',
                                padding: '0.4rem 0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.73rem',
                                boxShadow: isPivot ? '0 0 0 1px var(--status-success-soft)' : 'none'
                              }}
                            >
                              <span style={{ fontWeight: 800, color: 'var(--action-primary)' }}>{step.seq}.</span>
                              {step.icon && <span style={{ fontSize: '0.8rem' }}>{step.icon}</span>}
                              <span style={{ fontWeight: isPivot ? 700 : 600, color: isPivot ? 'var(--status-success)' : 'var(--text-primary)' }}>
                                {step.title}
                              </span>
                              {step.dur && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 600 }}>
                                  ({step.dur}s)
                                </span>
                              )}
                              {step.tag && (
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                  background: isPivot ? 'var(--status-success-soft)' : 'var(--surface-raised)',
                                  color: isPivot ? 'var(--status-success)' : 'var(--text-muted)'
                                }}>
                                  {step.tag}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* STEP 3: ADAPTIVE CAMPAIGN CONTENT FORM */}
              {/* 3A: VIDEO PRODUK (Katalog Produk Selector) */}
              {instantCampaignType === 'product_campaign' && (
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1.5px solid var(--status-success)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>🛍️</span>
                      <span>Pilih Produk dari Katalog:</span>
                    </div>
                    {instantProductId && (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.65rem',
                        borderRadius: 9999,
                        background: 'var(--status-success-soft)',
                        color: 'var(--status-success)',
                        border: '1px solid var(--status-success)'
                      }}>
                        Terpilih: {catalogProducts.find(p => p.id === instantProductId)?.product_name || instantProductId}
                      </span>
                    )}
                  </div>

                  {/* Search box */}
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔍</span>
                    <input
                      type="text"
                      value={instantProductSearch}
                      onChange={(e) => setInstantProductSearch(e.target.value)}
                      placeholder="Cari produk katalog (nama atau kategori)..."
                      style={{
                        width: '100%',
                        height: '38px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 10px 0 32px',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Scrollable Products List */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '0.65rem',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}>
                    {loadingProducts ? (
                      <div style={{ gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        Memuat katalog produk...
                      </div>
                    ) : filteredInstantProducts.length === 0 ? (
                      <div style={{ gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                        {instantProductSearch ? `Tidak ada produk yang cocok dengan "${instantProductSearch}"` : 'Belum ada produk di katalog.'}
                      </div>
                    ) : (
                      filteredInstantProducts.map(prod => {
                        const isSelected = instantProductId === prod.id;
                        return (
                          <div
                            key={prod.id}
                            onClick={() => setInstantProductId(prod.id)}
                            style={{
                              background: isSelected ? 'var(--surface-interactive)' : 'var(--surface)',
                              border: isSelected ? '1.5px solid var(--status-success)' : '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.65rem 0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.65rem',
                              transition: 'var(--transition)'
                            }}
                          >
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: 'var(--radius-xs)',
                              background: 'var(--surface-raised)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              overflow: 'hidden'
                            }}>
                              {prod.photo_url ? (
                                <img
                                  src={prod.photo_url}
                                  alt={prod.product_name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <span style={{ fontSize: '1.15rem' }}>🛍️</span>
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={prod.product_name}>
                                {prod.product_name}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {prod.category || 'Katalog'}
                              </div>
                            </div>

                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: isSelected ? '1.5px solid var(--status-success)' : '1.5px solid var(--border-strong)',
                              background: isSelected ? 'var(--status-success)' : 'transparent',
                              color: isSelected ? '#ffffff' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.65rem',
                              fontWeight: 900,
                              flexShrink: 0
                            }}>
                              ✓
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Category Entry Point (CEP) Selector */}
                  <div style={{
                    marginTop: '0.25rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>🎯</span>
                        <span>Sudut Masuk Pembeli (Category Entry Point / CEP):</span>
                      </label>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Psikologi hook & pembukaan cerita
                      </span>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '0.5rem'
                    }}>
                      {CEP_OPTIONS.map(opt => {
                        const isCepSelected = selectedCep === opt.value;
                        return (
                          <div
                            key={opt.value}
                            onClick={() => setSelectedCep(opt.value)}
                            style={{
                              background: isCepSelected ? 'var(--surface-interactive)' : 'var(--surface)',
                              border: isCepSelected ? '1.5px solid var(--status-success)' : '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.55rem 0.7rem',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.2rem',
                              transition: 'var(--transition)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isCepSelected ? 'var(--status-success)' : 'var(--text-primary)' }}>
                                {opt.icon} {opt.label}
                              </span>
                              {isCepSelected && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--status-success)', fontWeight: 900 }}>✓</span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                              {opt.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sudut Pandang / Konteks Promosi (Promotion Context) */}
                  <div style={{
                    marginTop: '0.25rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>🏷️</span>
                        <span>Sudut Pandang / Konteks Promosi (Opsional):</span>
                      </label>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Mengarahkan situasi &amp; emosi spesifik cerita
                      </span>
                    </div>

                    <textarea
                      value={instantPromotionContext}
                      onChange={(e) => setInstantPromotionContext(e.target.value)}
                      placeholder="Contoh: Musim hujan anak sering batuk pilek dan demam, ibu cemas tapi takut beri obat kimia terus-menerus. Butuh suplemen alami yang rasanya manis disukai anak."
                      rows={2}
                      style={{
                        width: '100%',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.6rem 0.75rem',
                        fontSize: '0.82rem',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        resize: 'vertical',
                        lineHeight: 1.4
                      }}
                    />

                    {/* Quick Preset Angle Chips */}
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.3rem' }}>
                        ⚡ Rekomendasi Sudut Pandang Cepat:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {[
                          { label: '🌧️ Musim Flu & Batuk Anak', text: 'Musim pancaroba & hujan bikin anak gampang flu batuk, ibu butuh suplemen daya tahan tubuh alami tanpa efek samping kimia.' },
                          { label: '🎁 Promo Payday Bundling', text: 'Promo Gajian Payday hemat bundling persediaan kesehatan sekeluarga sebulan.' },
                          { label: '💼 Lembur & Stamina Kerja', text: 'Pekerja kantoran sering lembur dan kurang tidur, badan gampang drop & lemas saat bangun pagi.' },
                          { label: '👵 Kolesterol & Orang Tua', text: 'Alternatif suplemen alami untuk orang tua yang punya keluhan kolesterol dan tekanan darah tinggi.' }
                        ].map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setInstantPromotionContext(chip.text)}
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)',
                              borderRadius: 9999,
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'var(--transition)'
                            }}
                          >
                            {chip.label}
                          </button>
                        ))}
                        {instantPromotionContext && (
                          <button
                            type="button"
                            onClick={() => setInstantPromotionContext('')}
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--status-danger-soft)',
                              color: 'var(--status-danger)',
                              borderRadius: 9999,
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ✖ Kosongkan
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                    💡 <strong>1-Pass Product Engine:</strong> AI Gemini langsung menyusun skrip hook, unique selling points, dan storyboard video promosi untuk produk terpilih dalam 1 kali eksekusi.
                  </div>
                </div>
              )}

              {/* 3B: VIDEO EDITORIAL (Segmented Control: Pilar vs Keyword) */}
              {instantCampaignType === 'editorial_campaign' && (
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>📖</span>
                      <span>Konfigurasi Topik Editorial:</span>
                    </div>

                    {/* Segmented Control - 100% Semantic Tokens */}
                    <div style={{ display: 'flex', background: 'var(--surface)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', gap: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() => setInstantEditorialMode('pillar')}
                        style={{
                          padding: '0.35rem 0.75rem',
                          border: 'none',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: instantEditorialMode === 'pillar' ? 'var(--status-info)' : 'transparent',
                          color: instantEditorialMode === 'pillar' ? 'var(--on-action-primary)' : 'var(--text-muted)',
                          transition: 'var(--transition)'
                        }}
                      >
                        🏛️ Pakai Pilar Brand
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstantEditorialMode('keyword')}
                        style={{
                          padding: '0.35rem 0.75rem',
                          border: 'none',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: instantEditorialMode === 'keyword' ? 'var(--status-info)' : 'transparent',
                          color: instantEditorialMode === 'keyword' ? 'var(--on-action-primary)' : 'var(--text-muted)',
                          transition: 'var(--transition)'
                        }}
                      >
                        🎯 Berbasis Keyword (Pilar OFF)
                      </button>
                    </div>
                  </div>

                  {instantEditorialMode === 'pillar' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pilih salah satu pilar konten resmi brand:</span>
                        {instantPillar && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.65rem',
                            borderRadius: 9999,
                            background: 'var(--status-info-soft)',
                            color: 'var(--status-info)',
                            border: '1px solid var(--status-info)'
                          }}>
                            Terpilih: "{instantPillar}"
                          </span>
                        )}
                      </div>

                      {/* Search box */}
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔍</span>
                        <input
                          type="text"
                          value={instantPillarSearch}
                          onChange={(e) => setInstantPillarSearch(e.target.value)}
                          placeholder="Cari topik pilar brand..."
                          style={{
                            width: '100%',
                            height: '38px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 10px 0 32px',
                            color: 'var(--text-primary)',
                            fontSize: '0.84rem',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Scrollable Pillars List */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: '0.65rem',
                        maxHeight: '240px',
                        overflowY: 'auto',
                        paddingRight: '4px'
                      }}>
                        {filteredInstantPillars.length === 0 ? (
                          <div style={{ gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                            Tidak ada pilar yang cocok dengan "{instantPillarSearch}".
                          </div>
                        ) : (
                          filteredInstantPillars.map((pillar, idx) => {
                            const isSelected = instantPillar === pillar;
                            return (
                              <div
                                key={idx}
                                onClick={() => setInstantPillar(pillar)}
                                style={{
                                  background: isSelected ? 'var(--surface-interactive)' : 'var(--surface)',
                                  border: isSelected ? '1.5px solid var(--status-info)' : '1px solid var(--border-subtle)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '0.75rem 0.85rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.65rem',
                                  transition: 'var(--transition)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: '1.1rem' }}>📌</span>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pillar}>
                                    {pillar}
                                  </span>
                                </div>

                                <div style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  border: isSelected ? '1.5px solid var(--status-info)' : '1.5px solid var(--border-strong)',
                                  background: isSelected ? 'var(--status-info)' : 'transparent',
                                  color: isSelected ? 'var(--on-action-primary)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                  flexShrink: 0
                                }}>
                                  ✓
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                        💡 <strong>1-Pass Editorial Engine:</strong> AI Gemini otomatis merancang hook tension kontroversial/fakta, storytelling edukatif, dan format video editorial sesuai pilar brand ini dalam 1-pass.
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Masukkan kata kunci atau topik pencarian audiens (Pilar brand dinonaktifkan):
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--status-warning-soft)', color: 'var(--status-warning)', padding: '0.15rem 0.5rem', borderRadius: 9999 }}>
                          Pilar Brand: OFF ⚠️
                        </span>
                      </div>
                      <input
                        type="text"
                        value={instantEditorialKeyword}
                        onChange={(e) => setInstantEditorialKeyword(e.target.value)}
                        placeholder="Contoh: peredam suara studio podcast murah, cara hilangkan dengung kamar"
                        style={{
                          width: '100%',
                          height: '38px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 10px',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                          outline: 'none'
                        }}
                      />
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--surface-interactive)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                        🤖 <strong>Arahan Single-Pass Gemini Engine:</strong> AI akan membedah search intent dari keyword ini menjadi narasi storytelling tension berdurasi 30-45 detik dengan formula Hook 8-11 kata tanpa terikat pilar bawaan brand.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3C: VIDEO RESEP (Kategori Resep Kuliner & Topik AI) */}
              {instantCampaignType === 'recipe_campaign' && (
                <>
                  {/* Kategori Resep Kuliner */}
                  <div style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <span>🍽️</span>
                        <span>Kategori Resep Kuliner</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          (Menentukan jenis olahan & instruksi AI)
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.25rem 0.65rem',
                          borderRadius: 9999,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: isCategoryManuallySelected ? 'var(--status-warning-soft)' : 'var(--status-info-soft)',
                          color: isCategoryManuallySelected ? 'var(--status-warning)' : 'var(--status-info)',
                          border: `1px solid ${isCategoryManuallySelected ? 'var(--status-warning)' : 'var(--status-info)'}`
                        }}>
                          <span>{isCategoryManuallySelected ? '✏️ Pilihan Manual' : '✨ Auto-Terdeteksi dari Topik'}</span>
                        </span>

                        {isCategoryManuallySelected && (
                          <button
                            type="button"
                            onClick={resetCategoryToAuto}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--link)',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0
                            }}
                          >
                            Reset ke Otomatis
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4 Cards Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.75rem'
                    }}>
                      {[
                        {
                          key: 'makanan_utama',
                          icon: '🍗',
                          name: 'Makanan Utama',
                          desc: 'Main course, ayam, daging, ikan, pasta, rice bowl'
                        },
                        {
                          key: 'camilan',
                          icon: '🍟',
                          name: 'Camilan / Side Dish',
                          desc: 'Snacks, fries, finger food, crispy bites, gorengan'
                        },
                        {
                          key: 'dessert',
                          icon: '🍰',
                          name: 'Baking / Dessert',
                          desc: 'Cake, cookies, pastry, waffle, puding, sweets'
                        },
                        {
                          key: 'minuman',
                          icon: '🥤',
                          name: 'Minuman',
                          desc: 'Coffee, latte, matcha, smoothie, tea, mocktail'
                        }
                      ].map(cat => {
                        const isSelected = category === cat.key;
                        return (
                          <button
                            type="button"
                            key={cat.key}
                            onClick={() => handleCategorySelect(cat.key)}
                            style={{
                              background: isSelected ? 'var(--surface-interactive)' : 'var(--input-bg)',
                              border: `1.5px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                              borderRadius: 'var(--radius-md)',
                              padding: '0.9rem',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: '0.4rem',
                              cursor: 'pointer',
                              textAlign: 'left',
                              boxShadow: isSelected ? '0 0 0 1px var(--action-primary), 0 4px 14px rgba(45, 212, 191, 0.16)' : 'none',
                              transition: 'var(--transition)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                              <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{cat.icon}</span>
                              <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: isSelected ? 'var(--action-primary)' : 'var(--border-subtle)',
                                color: isSelected ? 'var(--on-action-primary)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 900
                              }}>
                                ✓
                              </div>
                            </div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                              {cat.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                              {cat.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Topik Resep (Full Width) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Topik / Arahan Resep AI</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ide olahan makanan/minuman yang akan digenerate</span>
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => handleTopicChange(e.target.value)}
                      placeholder="Contoh: air fryer salmon bites, garlic parmesan wings, keto smoothie"
                      style={{
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.65rem 0.9rem',
                        fontSize: '0.88rem',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    {/* Quick Topic Pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Saran Cepat:</span>
                      {[
                        'air fryer salmon bites',
                        'crispy parmesan zucchini fries',
                        'garlic butter chicken bites',
                        'smoothie alpukat keto'
                      ].map(pill => (
                        <button
                          type="button"
                          key={pill}
                          onClick={() => handleTopicChange(pill)}
                          style={{
                            fontSize: '0.74rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: 9999,
                            background: 'var(--surface-raised)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--link)',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                          }}
                        >
                          {pill}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 3D: MULTIPLIER CAMPAIGN (Winning Blueprint Deconstruct Lab) */}
              {instantCampaignType === 'multiplier_campaign' && (
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1.5px solid var(--status-purple)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>🔀</span>
                      <span>Pilih Blueprint Video Pemenang (Deconstruct Lab):</span>
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.65rem',
                      borderRadius: 9999,
                      background: 'var(--status-purple-soft)',
                      color: 'var(--status-purple)',
                      border: '1px solid var(--status-purple)'
                    }}>
                      Winning Hook Engine
                    </span>
                  </div>

                  {/* Search Blueprint */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔍</span>
                      <input
                        type="text"
                        value={blueprintSearchQuery}
                        onChange={(e) => setBlueprintSearchQuery(e.target.value)}
                        placeholder="Cari blueprint (ID URL misal 1476160110888470, topik, atau niche)..."
                        style={{
                          width: '100%',
                          height: '38px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 32px 0 32px',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                          outline: 'none'
                        }}
                      />
                      {blueprintSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setBlueprintSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '4px'
                          }}
                          title="Hapus pencarian"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Quick Filter Chips */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick:</span>
                      {['1476160110888470', 'Baking', 'Cooking', 'Health'].map(chip => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setBlueprintSearchQuery(chip)}
                          style={{
                            background: blueprintSearchQuery === chip ? 'var(--status-purple)' : 'var(--surface)',
                            color: blueprintSearchQuery === chip ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                            border: `1px solid ${blueprintSearchQuery === chip ? 'var(--status-purple)' : 'var(--border-subtle)'}`,
                            borderRadius: '999px',
                            padding: '0.15rem 0.55rem',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                      {blueprintSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setBlueprintSearchQuery('')}
                          style={{
                            background: 'none',
                            color: 'var(--status-danger)',
                            border: 'none',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Blueprints Scroll List */}
                  <div style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    paddingRight: '4px'
                  }}>
                    {loadingBlueprints ? (
                      <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        Memuat daftar blueprint video...
                      </div>
                    ) : blueprints.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.82rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)' }}>
                        Belum ada video di Deconstruct Lab. Silakan lakukan dekonstruksi video di menu Deconstruct Lab terlebih dahulu.
                      </div>
                    ) : (() => {
                      const filteredBlueprints = blueprints.filter(bp => {
                        if (!blueprintSearchQuery.trim()) return true;
                        const q = blueprintSearchQuery.toLowerCase().trim();
                        const reelId = extractReelId(bp.source_url);
                        return (
                          (reelId && reelId.includes(q)) ||
                          (bp.source_url && bp.source_url.toLowerCase().includes(q)) ||
                          (bp.core_problem && bp.core_problem.toLowerCase().includes(q)) ||
                          (bp.core_solution && bp.core_solution.toLowerCase().includes(q)) ||
                          (bp.niche && bp.niche.toLowerCase().includes(q)) ||
                          (bp.tags && (Array.isArray(bp.tags) ? bp.tags.join(' ') : String(bp.tags)).toLowerCase().includes(q)) ||
                          (bp.viral_pattern_summary && bp.viral_pattern_summary.toLowerCase().includes(q)) ||
                          (bp.original_caption && bp.original_caption.toLowerCase().includes(q))
                        );
                      });

                      if (filteredBlueprints.length === 0) {
                        return (
                          <div style={{
                            textAlign: 'center',
                            padding: '1.25rem',
                            color: 'var(--text-muted)',
                            fontSize: '0.82rem',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px dashed var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}>
                            <span>🔍 Tidak ada blueprint yang cocok dengan "{blueprintSearchQuery}"</span>
                            <button
                              type="button"
                              onClick={() => setBlueprintSearchQuery('')}
                              style={{
                                background: 'var(--status-purple-soft)',
                                color: 'var(--status-purple)',
                                border: '1px solid var(--status-purple)',
                                padding: '0.2rem 0.6rem',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Reset Filter Pencarian
                            </button>
                          </div>
                        );
                      }

                      return filteredBlueprints.map(bp => {
                        const isSelected = instantBlueprintId === bp.id;
                        const rId = extractReelId(bp.source_url);
                        const title = bp.core_problem || bp.core_solution || bp.original_caption || bp.source_url;
                        const subtitle = bp.viral_pattern_summary || bp.core_solution || 'Formula Hook Teruji';
                        return (
                          <div
                            key={bp.id}
                            onClick={() => {
                              setInstantBlueprintId(bp.id);
                              if (executionMode === 'manual_review') {
                                generateMultiplierAnglesForBlueprint(bp.id);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.55rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              background: isSelected ? 'var(--surface-interactive)' : 'var(--surface)',
                              border: isSelected ? '1.5px solid var(--status-purple)' : '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              transition: 'var(--transition)'
                            }}
                          >
                            <div style={{
                              width: '38px',
                              height: '38px',
                              background: 'var(--surface-raised)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-primary)',
                              borderRadius: 'var(--radius-xs)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.1rem',
                              flexShrink: 0
                            }}>
                              🎬
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '2px' }}>
                                <span style={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.68rem',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: 'var(--radius-xs)',
                                  background: 'var(--surface-interactive)',
                                  color: 'var(--status-info)',
                                  fontWeight: 700
                                }}>
                                  ID: {rId || bp.id.slice(0, 8)}
                                </span>
                                {bp.niche && (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: 'var(--radius-xs)',
                                    background: 'var(--status-purple-soft)',
                                    color: 'var(--status-purple)',
                                    fontWeight: 700
                                  }}>
                                    {bp.niche}
                                  </span>
                                )}
                              </div>
                              <div style={{
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }} title={title}>
                                {title}
                              </div>
                              <div style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {subtitle}
                              </div>
                            </div>
                            <span style={{
                              color: isSelected ? 'var(--status-purple)' : 'var(--text-muted)',
                              fontWeight: 800,
                              fontSize: '0.9rem'
                            }}>
                              {isSelected ? '✓' : '○'}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Skenario Angle Box */}
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {executionMode === 'full_autopilot'
                          ? '💡 Skenario Angle: AI Auto-Select Rank #1 (Bebas Repetisi)'
                          : '💡 Skenario Angle: Kurasi 3 Opsi Angle Pilihan Anda'}
                      </div>
                      {executionMode === 'manual_review' && (
                        <button
                          type="button"
                          disabled={loadingAngles}
                          onClick={() => generateMultiplierAnglesForBlueprint(instantBlueprintId || blueprints[0]?.id)}
                          style={{
                            background: 'var(--status-purple-soft)',
                            color: 'var(--status-purple)',
                            border: '1px solid var(--status-purple)',
                            padding: '0.25rem 0.65rem',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: loadingAngles ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {loadingAngles ? '⚡ Meracik Angle...' : '⚡ Regenerate Opsi Angle Baru'}
                        </button>
                      )}
                    </div>

                    {executionMode === 'full_autopilot' ? (
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                        Mesin akan memeriksa tabel riwayat <code>excluded_history</code> agar hook tidak pernah duplikat, merumuskan variasi sudut pandang secara cerdas, otomatis memilih <strong>Angle Rank #1</strong>, dan langsung memproses produksi video tanpa jeda manual.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {loadingAngles ? (
                          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Sedang merumuskan 3 angle viral dengan Gemini AI...
                          </div>
                        ) : multiplierAngles.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Klik tombol <em>Regenerate Opsi Angle Baru</em> untuk memuat preview 3 angle dari blueprint terpilih.
                          </div>
                        ) : (
                          multiplierAngles.map((angle, idx) => {
                            const isAngleSelected = selectedAngleIndex === idx;
                            return (
                              <div
                                key={idx}
                                onClick={() => setSelectedAngleIndex(idx)}
                                style={{
                                  padding: '0.65rem 0.85rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: isAngleSelected ? 'var(--status-purple-soft)' : 'var(--surface-raised)',
                                  border: isAngleSelected ? '1.5px solid var(--status-purple)' : '1px solid var(--border-subtle)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  gap: '0.65rem',
                                  transition: 'var(--transition)'
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    <span style={{
                                      fontSize: '0.66rem',
                                      fontWeight: 800,
                                      background: 'var(--status-purple)',
                                      color: '#ffffff',
                                      padding: '0.1rem 0.45rem',
                                      borderRadius: 9999
                                    }}>
                                      RANK {idx + 1}
                                    </span>
                                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                      {angle.title}
                                    </strong>
                                  </div>
                                  <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0.15rem 0' }}>
                                    <strong>Hook (0-3s):</strong> "{angle.hook_text}"
                                  </p>
                                  {angle.vo_preview && (
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                                      Narasi VO: "{angle.vo_preview}"
                                    </p>
                                  )}
                                </div>
                                <span style={{
                                  color: isAngleSelected ? 'var(--status-purple)' : 'var(--text-muted)',
                                  fontWeight: 800,
                                  fontSize: '0.9rem'
                                }}>
                                  {isAngleSelected ? '✓' : '○'}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3E: RECIPE LABS (Language-First International Classification Engine) */}
              {instantCampaignType === 'recipe_labs' && (
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1.5px solid var(--status-rose)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.95rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>🖼️</span>
                      <span>Konfigurasi Resep Teks & Foto AI (1-Klik Asli)</span>
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.65rem',
                      borderRadius: 9999,
                      background: 'var(--status-rose-soft)',
                      color: 'var(--status-rose)',
                      border: '1px solid var(--status-rose)'
                    }}>
                      Artikel FB + 12-Grid Slot Renderer
                    </span>
                  </div>

                  {/* 1. Language-First Control (Top Hero Box) */}
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--action-primary)' }}>
                      🌐 1. Target Market / Bahasa Resep
                    </label>
                    <select
                      value={instantTargetLanguage}
                      onChange={(e) => {
                        const newLang = e.target.value;
                        setInstantTargetLanguage(newLang);
                        const firstCat = INTERNATIONAL_RECIPE_TAXONOMY[newLang]?.categories?.[0]?.options?.[0] || 'Main Courses & Entrees';
                        setInstantRecipeClassification(firstCat);
                      }}
                      style={{
                        height: '38px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 0.75rem',
                        fontSize: '0.84rem',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontWeight: 600
                      }}
                    >
                      <option value="en_US">🇺🇸 Global English (International / US & UK Standard)</option>
                      <option value="id_ID">🇮🇩 Bahasa Indonesia (Pasar Domestik & UMKM)</option>
                      <option value="bilingual">🌐 Bilingual (English Hook + Indonesian Body)</option>
                    </select>
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Klasifikasi resep di bawah otomatis menyesuaikan dengan standar bahasa terpilih.
                    </small>
                  </div>

                  {/* 2. Klasifikasi Resep Berstandar Internasional/Nasional */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      🏷️ 2. {INTERNATIONAL_RECIPE_TAXONOMY[instantTargetLanguage]?.label || 'Klasifikasi Resep Standar'}
                    </label>
                    <select
                      value={instantRecipeClassification}
                      onChange={(e) => setInstantRecipeClassification(e.target.value)}
                      style={{
                        height: '38px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 0.75rem',
                        fontSize: '0.84rem',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    >
                      {(INTERNATIONAL_RECIPE_TAXONOMY[instantTargetLanguage]?.categories || []).map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Topik Menu & Gaya Visual */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        🎯 3. Topik / Nama Menu Resep Wajib:
                      </label>
                      <input
                        type="text"
                        value={recipeLabsTopic}
                        onChange={(e) => setRecipeLabsTopic(e.target.value)}
                        placeholder={
                          instantTargetLanguage === 'en_US'
                            ? 'e.g., Crispy Honey Garlic Air Fryer Chicken Bites...'
                            : (instantTargetLanguage === 'id_ID'
                                ? 'Contoh: Ayam Goreng Mentega Gurih, Sambal Udang...'
                                : 'e.g., Crispy Honey Butter Wings / Sayap Ayam Madu...')
                        }
                        style={{
                          height: '38px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 0.85rem',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                    {/* Orientasi Rasio Kolase Poster */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>📐 Orientasi / Rasio Kolase Poster:</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--status-rose)', fontWeight: 600 }}>
                          {instantRecipeAspectRatio === '1:1' ? '1080x1080 (Square Feed)' : (instantRecipeAspectRatio === '3:4' ? '1080x1440 (Portrait Feed Optimal)' : '1080x1920 (Full Vertical)')}
                        </span>
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        {[
                          { key: '1:1', icon: '⏹️', label: '1:1 Square', sub: 'IG/FB Feed' },
                          { key: '3:4', icon: '📱', label: '3:4 Portrait', sub: 'Feed Optimal' },
                          { key: '9:16', icon: '📜', label: '9:16 Vertical', sub: 'Stories/Pins' }
                        ].map(ratio => {
                          const isSelected = instantRecipeAspectRatio === ratio.key;
                          return (
                            <button
                              key={ratio.key}
                              type="button"
                              onClick={() => setInstantRecipeAspectRatio(ratio.key)}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.5rem 0.25rem',
                                borderRadius: 'var(--radius-sm)',
                                border: isSelected ? '1.5px solid var(--status-rose)' : '1px solid var(--border-subtle)',
                                background: isSelected ? 'var(--surface-interactive)' : 'var(--surface)',
                                color: isSelected ? 'var(--status-rose)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'var(--transition)'
                              }}
                            >
                              <span style={{ fontSize: '1.1rem' }}>{ratio.icon}</span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{ratio.label}</span>
                              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{ratio.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        🎨 Gaya Environment Fotografi AI:
                      </label>
                      <select
                        value={recipeLabsVisualStyle}
                        onChange={(e) => setRecipeLabsVisualStyle(e.target.value)}
                        style={{
                          height: '38px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 0.75rem',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                          outline: 'none'
                        }}
                      >
                        <option value="Rustic Warm Tabletop & Artisanal Kitchen">🌿 Rustic Warm Tabletop & Artisanal Kitchen (Earthy & Cozy)</option>
                        <option value="Modern Minimalist Nordic Studio">⚪ Modern Minimalist Nordic Studio (Bright, Clean & Scandinavian)</option>
                        <option value="Dark Moody Chiaroscuro & Atmospheric Smoke">🍷 Dark Moody Chiaroscuro & Atmospheric Smoke (Dramatic Fine Dining)</option>
                        <option value="Vibrant Alfresco Sunlit Patio">🍋 Vibrant Alfresco Sunlit Patio (Fresh Mediterranean Outdoors)</option>
                      </select>
                    </div>
                  </div>

                  {/* Susunan Grid Komposit (Adopted 100% from Recipe Labs) */}
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    {/* Pilihan Jumlah Gambar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Pilihan Jumlah Gambar dalam Kolase
                        </label>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Menentukan variasi template layout grid
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[3, 4, 5, 6].map(count => {
                          const isActive = imagesPerRecipe === count;
                          return (
                            <button
                              type="button"
                              key={count}
                              onClick={() => {
                                setImagesPerRecipe(count);
                                const defaultLayout = LAYOUT_PRESET_METADATA[count]?.[0]?.id || '4_editorial_split';
                                setSelectedLayoutId(defaultLayout);
                              }}
                              style={{
                                padding: '0.45rem 1rem',
                                borderRadius: 'var(--radius-sm)',
                                border: isActive ? '1.5px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                                background: isActive ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                                color: isActive ? 'var(--action-primary)' : 'var(--text-secondary)',
                                fontSize: '0.82rem',
                                fontWeight: isActive ? 800 : 600,
                                cursor: 'pointer',
                                transition: 'var(--transition)'
                              }}
                            >
                              {count} Gambar {count === 4 ? '(Default)' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2 Kolom: Preset Thumbnails & Sliders di Kiri, Live 1:1 Canvas di Kanan */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr)) 250px', gap: '1.25rem', alignItems: 'start' }}>
                      {/* Kolom Kiri: Thumbnails & Sliders */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              Template Preset Layout Kolase
                            </label>
                            <span style={{ fontSize: '0.74rem', color: 'var(--action-primary)', fontWeight: 800 }}>
                              {LAYOUT_PRESET_METADATA[imagesPerRecipe]?.find(p => p.id === selectedLayoutId)?.name || selectedLayoutId}
                            </span>
                          </div>

                          {/* Thumbnail Cards Grid */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
                            gap: '8px',
                            marginBottom: '10px'
                          }}>
                            {(LAYOUT_PRESET_METADATA[imagesPerRecipe] || []).map(preset => {
                              const isSelected = selectedLayoutId === preset.id;
                              const presetSlots = GRID_LAYOUT_COORDINATES[imagesPerRecipe]?.[preset.id] || [];

                              return (
                                <div
                                  key={preset.id}
                                  onClick={() => setSelectedLayoutId(preset.id)}
                                  style={{
                                    background: isSelected ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                                    border: isSelected ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  {/* Miniature 12-grid preview */}
                                  <div style={{
                                    width: '100%',
                                    aspectRatio: '1 / 1',
                                    background: 'var(--surface-interactive)',
                                    borderRadius: '3px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    padding: '2px'
                                  }}>
                                    {presetSlots.map((s, idx) => (
                                      <div
                                        key={s.id}
                                        style={{
                                          position: 'absolute',
                                          left: `${(s.x / 12) * 100}%`,
                                          top: `${(s.y / 12) * 100}%`,
                                          width: `calc(${(s.w / 12) * 100}% - 1px)`,
                                          height: `calc(${(s.h / 12) * 100}% - 1px)`,
                                          background: SLOT_GRADIENTS[idx % SLOT_GRADIENTS.length],
                                          borderRadius: '2px'
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <div style={{
                                    fontSize: '0.72rem',
                                    fontWeight: isSelected ? 700 : 600,
                                    color: isSelected ? 'var(--action-primary)' : 'var(--text-primary)',
                                    textAlign: 'center',
                                    lineHeight: 1.15
                                  }}>
                                    {preset.name}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Dropdown Fallback */}
                          <select
                            value={selectedLayoutId}
                            onChange={(e) => setSelectedLayoutId(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              background: 'var(--input-bg)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem'
                            }}
                          >
                            {(LAYOUT_PRESET_METADATA[imagesPerRecipe] || []).map(preset => (
                              <option key={preset.id} value={preset.id}>{preset.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Sliders Box */}
                        <div style={{
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                <span>Celah (Gap):</span>
                                <strong style={{ color: 'var(--action-primary)' }}>{gridGapSize}px</strong>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="30"
                                step="2"
                                value={gridGapSize}
                                onChange={(e) => setGridGapSize(Number(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--action-primary)' }}
                              />
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                <span>Radius:</span>
                                <strong style={{ color: 'var(--action-primary)' }}>{gridBorderRadius}px</strong>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="40"
                                step="2"
                                value={gridBorderRadius}
                                onChange={(e) => setGridBorderRadius(Number(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--action-primary)' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                <span>Padding:</span>
                                <strong style={{ color: 'var(--action-primary)' }}>{gridOuterPadding}px</strong>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="40"
                                step="2"
                                value={gridOuterPadding}
                                onChange={(e) => setGridOuterPadding(Number(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--action-primary)' }}
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Warna Latar Grid</div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                  type="color"
                                  value={gridBgColor}
                                  onChange={(e) => setGridBgColor(e.target.value)}
                                  style={{ border: 'none', width: '28px', height: '28px', padding: 0, background: 'none', cursor: 'pointer', borderRadius: '4px' }}
                                />
                                <input
                                  type="text"
                                  value={gridBgColor}
                                  onChange={(e) => setGridBgColor(e.target.value)}
                                  style={{
                                    height: '28px',
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-xs)',
                                    padding: '0 6px',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-primary)',
                                    flex: 1
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Facebook Auto-Publish Checkbox */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
                          <input
                            type="checkbox"
                            id="fb-autopublish-check"
                            checked={postToFacebook}
                            onChange={(e) => setPostToFacebook(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--action-primary)', cursor: 'pointer' }}
                          />
                          <label htmlFor="fb-autopublish-check" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                            Posting otomatis naskah resep dan gambar kolase ke Halaman Facebook
                          </label>
                        </div>
                      </div>

                      {/* Kolom Kanan: Live Mockup Preview Box (1:1 Canvas 230px x 230px) */}
                      <div style={{
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            📱 Mockup Preview (1:1)
                          </span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--status-rose-soft)', color: 'var(--status-rose)', borderRadius: '4px', fontWeight: 700 }}>
                            {imagesPerRecipe} Slots
                          </span>
                        </div>

                        {/* 1:1 Canvas Container (230px x 230px) */}
                        <div style={{
                          width: '230px',
                          height: '230px',
                          backgroundColor: gridBgColor,
                          borderRadius: `${Math.round(gridBorderRadius * 0.4) + 4}px`,
                          padding: `${Math.round(gridOuterPadding * 0.4)}px`,
                          position: 'relative',
                          boxShadow: '0 8px 24px var(--surface-interactive)',
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          {(() => {
                            const activeSlots = (GRID_LAYOUT_COORDINATES[imagesPerRecipe]?.[selectedLayoutId]) ||
                                                (GRID_LAYOUT_COORDINATES[imagesPerRecipe]?.[(LAYOUT_PRESET_METADATA[imagesPerRecipe]?.[0]?.id)]) || [];
                            const dispPad = Math.round(gridOuterPadding * 0.4);
                            const dispGap = Math.round(gridGapSize * 0.4);
                            const dispRad = Math.round(gridBorderRadius * 0.4);

                            return activeSlots.map((slot, sIdx) => {
                              const leftPct = (slot.x / 12) * 100;
                              const topPct = (slot.y / 12) * 100;
                              const widthPct = (slot.w / 12) * 100;
                              const heightPct = (slot.h / 12) * 100;

                              return (
                                <div
                                  key={slot.id}
                                  style={{
                                    position: 'absolute',
                                    left: `calc(${dispPad}px + ${leftPct}% + ${dispGap / 2}px)`,
                                    top: `calc(${dispPad}px + ${topPct}% + ${dispGap / 2}px)`,
                                    width: `calc(${widthPct}% - ${dispGap}px)`,
                                    height: `calc(${heightPct}% - ${dispGap}px)`,
                                    background: SLOT_GRADIENTS[sIdx % SLOT_GRADIENTS.length],
                                    borderRadius: `${dispRad}px`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px',
                                    boxShadow: 'inset 0 0 10px var(--surface-interactive)',
                                    boxSizing: 'border-box',
                                    overflow: 'hidden'
                                  }}
                                >
                                  <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 800,
                                    background: 'var(--surface-interactive)',
                                    color: 'var(--action-primary)',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    marginBottom: '2px',
                                    fontFamily: 'monospace'
                                  }}>
                                    #{slot.id}
                                  </span>
                                  <span style={{
                                    fontSize: '0.58rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    textAlign: 'center',
                                    lineHeight: 1.1
                                  }}>
                                    {SLOT_DEFAULT_ROLES[sIdx] || `Foto ${sIdx + 1}`}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          Render Output: 2400 x 2400 px
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Checkbox Toggle Ekstraksi Resep Lengkap untuk Multiplier (dan Recipe Campaign) */}
              {(instantCampaignType === 'multiplier_campaign' || instantCampaignType === 'recipe_campaign') && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  background: 'var(--surface-raised)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--status-purple)',
                  marginBottom: '0.85rem'
                }}>
                  <input
                    type="checkbox"
                    id="instantRecipeCheck"
                    checked={instantGenerateRecipe}
                    onChange={(e) => setInstantGenerateRecipe(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--status-purple)', cursor: 'pointer', marginTop: '2px' }}
                  />
                  <div>
                    <label htmlFor="instantRecipeCheck" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', display: 'block' }}>
                      🍳 Hasilkan Resep / Racikan Lengkap di Caption (Bahan, Takaran & Langkah)
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                      Saat aktif, AI wajib menyusun teks resep terperinci (bahan, takaran presisi, langkah pembuatan, khasiat sehat) yang sinkron dengan video referensi dekonstruksi.
                    </span>
                  </div>
                </div>
              )}

              {/* 3F: THREADS SERIES (Utas Berseri 3-5 Part & Foto G-Labs / Text-Only) */}
              {instantCampaignType === 'threads_series' && (
                <ThreadsSeriesForm
                  objective={threadsObjective}
                  setObjective={setThreadsObjective}
                  personalProductName={threadsPersonalProductName}
                  setPersonalProductName={setThreadsPersonalProductName}
                  personalProductCta={threadsPersonalProductCta}
                  setPersonalProductCta={setThreadsPersonalProductCta}
                  affiliateProductTitle={threadsAffiliateProductTitle}
                  setAffiliateProductTitle={setThreadsAffiliateProductTitle}
                  affiliateProductLink={threadsAffiliateProductLink}
                  setAffiliateProductLink={setThreadsAffiliateProductLink}
                  pureOrganicTopic={threadsPureOrganicTopic}
                  setPureOrganicTopic={setThreadsPureOrganicTopic}
                  visualMode={threadsVisualMode}
                  setVisualMode={setThreadsVisualMode}
                  selectedAccountId={threadsSelectedAccountId}
                  setSelectedAccountId={setThreadsSelectedAccountId}
                  replizAccounts={replizAccounts}
                  onSyncAccounts={() => fetchReplizAccounts(true)}
                  isSyncingAccounts={isSyncingRepliz}
                  recentPosts={threadsSeriesPosts}
                />
              )}

              {/* Checkbox Toggle Smart Affiliate untuk 1-Klik */}
              {instantCampaignType !== 'threads_series' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  background: 'var(--surface-raised)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '0.85rem'
                }}>
                  <input
                    type="checkbox"
                    id="instantAffiliateCheck"
                    checked={instantPostAffiliateLink}
                    onChange={(e) => setInstantPostAffiliateLink(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--action-primary)', cursor: 'pointer', marginTop: '2px' }}
                  />
                  <div>
                    <label htmlFor="instantAffiliateCheck" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', display: 'block' }}>
                      🛒 Sertakan Rekomendasi Produk & Affiliate (Shopee FB & Link di Bio)
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                      Otomatis mencocokkan produk brand dan menghasilkan CTA adaptif (FB: link Shopee aktif, Non-FB: Link di Bio). Uncheck jika ingin video viral 1-klik murni edukasi tanpa jualan.
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div style={{ paddingTop: '0.25rem' }}>
                <button
                  type="submit"
                  disabled={isLaunching}
                  style={{
                    background: isLaunching ? 'var(--surface-interactive)' : 'var(--action-primary)',
                    color: isLaunching ? 'var(--text-muted)' : 'var(--on-action-primary)',
                    border: 'none',
                    padding: '0.9rem 1.85rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: isLaunching ? 'not-allowed' : 'pointer',
                    boxShadow: isLaunching ? 'none' : '0 4px 16px var(--accent-glow)',
                    transition: 'var(--transition)'
                  }}
                >
                  <span>
                    {isLaunching ? '⏳ Memproses Pipeline AI...' : (
                      instantCampaignType === 'product_campaign'
                        ? `⚡ Luncurkan Video Produk Sekarang (1-Pass)`
                        : (instantCampaignType === 'editorial_campaign'
                            ? `⚡ Luncurkan Video Editorial Sekarang (1-Pass)`
                            : (instantCampaignType === 'multiplier_campaign'
                                ? `🔀 Luncurkan Multiplier Angle Remix (Winning Blueprint)`
                                : (instantCampaignType === 'recipe_labs'
                                    ? `🖼️ Luncurkan Resep Teks & Foto AI (Grid Komposit)`
                                    : (instantCampaignType === 'threads_series'
                                        ? `🧵 Buat Utas Berseri & Jadwalkan ke Repliz`
                                        : `🚀 Luncurkan Auto Pipeline Resep (${targetClipsCount} Klip Video)`))))
                    )}
                  </span>
                </button>
              </div>
            </form>
          </section>

          {/* BARIS 2: 7-Stage Factual Live Execution Visualizer */}
          <section style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📡</span>
                  <span>Live Execution Visualizer (Alur Faktual)</span>
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 9999,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  background: pollingActive ? 'var(--status-success-soft)' : 'var(--surface-interactive)',
                  color: pollingActive ? 'var(--status-success)' : 'var(--text-muted)',
                  border: `1px solid ${pollingActive ? 'var(--status-success)' : 'var(--border-subtle)'}`
                }}>
                  <div style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: pollingActive ? 'var(--status-success)' : 'var(--text-muted)'
                  }} />
                  <span>{pollingActive ? 'Faktual Polling Aktif (2.5s)' : 'Status Real-Time Ready'}</span>
                </div>
              </div>

              {activeCampaignData && (
                <div style={{
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.75rem',
                  color: 'var(--link)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kampanye Terpantau:</span>
                  <strong>{activeCampaignData.id}</strong>
                  {activeCampaignData.topic && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      ({activeCampaignData.topic})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 7-Stage Dynamic Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.65rem'
            }}>
              {[
                {
                  key: 's1',
                  step: 1,
                  defaultTitle: 'Planner Creation',
                  defaultDesc: 'Container & brand kategori',
                  data: pipelineStages?.s1
                },
                {
                  key: 's2',
                  step: 2,
                  defaultTitle: 'Storyboard Creation',
                  defaultDesc: 'Gemini AI 1-Pass & 8 adegan',
                  data: pipelineStages?.s2
                },
                {
                  key: 's3',
                  step: 3,
                  defaultTitle: 'Start Frame Generation',
                  defaultDesc: 'Gambar acuan continuity',
                  data: pipelineStages?.s3
                },
                {
                  key: 's4',
                  step: 4,
                  defaultTitle: 'TTS Generation',
                  defaultDesc: 'Minimax expressive audio',
                  data: pipelineStages?.s4
                },
                {
                  key: 's5',
                  step: 5,
                  defaultTitle: 'Video Generation',
                  defaultDesc: 'Google Veo Omni Flash @ 4s',
                  data: pipelineStages?.s5
                },
                {
                  key: 's6',
                  step: 6,
                  defaultTitle: 'FFmpeg Processing',
                  defaultDesc: 'Muxing 8 klip + VO + BGM',
                  data: pipelineStages?.s6
                },
                {
                  key: 's7',
                  step: 7,
                  defaultTitle: 'Cloud & Sync',
                  defaultDesc: 'Nextcloud & Hub ContentFlow',
                  data: pipelineStages?.s7
                }
              ].map(st => {
                const stageData = st.data || { status: 'idle', badge: 'Menunggu' };
                const isCompleted = stageData.status === 'completed';
                const isProcessing = stageData.status === 'processing';
                const isFailed = stageData.status === 'failed';

                let borderColor = 'var(--border-subtle)';
                let bgColor = 'var(--surface-raised)';
                let numBg = 'var(--surface-interactive)';
                let numColor = 'var(--text-muted)';
                let badgeBg = 'var(--surface-interactive)';
                let badgeColor = 'var(--text-disabled)';
                let badgeBorder = 'var(--border-subtle)';

                if (isCompleted) {
                  borderColor = 'var(--status-success)';
                  numBg = 'var(--status-success)';
                  numColor = 'var(--on-action-primary)';
                  badgeBg = 'var(--status-success-soft)';
                  badgeColor = 'var(--status-success)';
                  badgeBorder = 'var(--status-success)';
                } else if (isProcessing) {
                  borderColor = 'var(--action-primary)';
                  bgColor = 'var(--surface-interactive)';
                  numBg = 'var(--action-primary)';
                  numColor = 'var(--on-action-primary)';
                  badgeBg = 'var(--surface-raised)';
                  badgeColor = 'var(--action-primary)';
                  badgeBorder = 'var(--action-primary)';
                } else if (isFailed) {
                  borderColor = 'var(--status-danger)';
                  bgColor = 'var(--status-danger-soft)';
                  numBg = 'var(--status-danger)';
                  numColor = 'var(--canvas)';
                  badgeBg = 'var(--status-danger-soft)';
                  badgeColor = 'var(--status-danger)';
                  badgeBorder = 'var(--status-danger)';
                }

                return (
                  <div
                    key={st.key}
                    style={{
                      background: bgColor,
                      border: `1.5px solid ${borderColor}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem 0.65rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '0.5rem',
                      position: 'relative',
                      minHeight: 140,
                      justifyContent: 'flex-start',
                      boxShadow: isProcessing ? '0 0 18px rgba(45, 212, 191, 0.16)' : 'none',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: numBg,
                      color: numColor,
                      border: `1px solid ${borderColor}`
                    }}>
                      {isCompleted ? '✓' : (isProcessing ? '⚡' : (isFailed ? '✕' : st.step))}
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                      {stageData.title || st.defaultTitle}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      {stageData.desc || st.defaultDesc}
                    </div>
                    <div style={{
                      marginTop: 'auto',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 9999,
                      background: badgeBg,
                      color: badgeColor,
                      border: `1px solid ${badgeBorder}`,
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {stageData.badge || 'Menunggu'}
                    </div>

                    {/* Tombol Retry Interaktif jika Tahap Gagal */}
                    {isFailed && ['s4', 's5', 's6'].includes(st.key) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetryFailedStage(st.key);
                        }}
                        disabled={retryingStage === st.key}
                        style={{
                          marginTop: '0.35rem',
                          background: 'var(--status-danger-soft)',
                          color: 'var(--status-danger)',
                          border: '1px solid var(--status-danger)',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.6rem',
                          cursor: retryingStage === st.key ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          boxShadow: 'var(--shadow-card)',
                          transition: 'var(--transition)'
                        }}
                        title={`Coba ulang ${st.defaultTitle}`}
                      >
                        <span>{retryingStage === st.key ? '⏳' : '🔄'}</span>
                        <span>{retryingStage === st.key ? 'Memicu...' : 'Coba Ulang'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live Telemetry Console Bar */}
            <div style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {telemetry?.timestamp ? `[${telemetry.timestamp}]` : '[Live]'}
                </span>
                <span>📡 Status Faktual Scheduler:</span>
                <span style={{ color: 'var(--action-primary)', fontWeight: 600 }}>
                  {telemetry?.message || 'Memantau scheduler background cluster...'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                Interval: <strong>2.5s</strong>
              </div>
            </div>
          </section>

          {/* BARIS 3: Riwayat Batch Kampanye Auto Pipeline */}
          <section style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ fontSize: '1.12rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📋</span>
                <span>Riwayat Batch Kampanye Auto Pipeline</span>
                <span style={{ fontSize: '0.72rem', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '0.15rem 0.5rem', borderRadius: 9999 }}>
                  20 Terakhir Seluruh Tipe
                </span>
              </div>
              <button
                type="button"
                onClick={fetchRecentCampaigns}
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh
              </button>
            </div>

            {/* Filter Pills Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '0.2rem' }}>Filter Tipe:</span>
              {[
                { key: 'all', label: `Semua Tipe (${recentCampaigns.length})` },
                { key: 'multiplier', label: `⚡ Multiplier (${recentCampaigns.filter(c => c.campaign_type === 'multiplier_campaign').length})` },
                { key: 'recipe', label: `🍲 Video Resep (${recentCampaigns.filter(c => c.campaign_type === 'recipe_campaign').length})` },
                { key: 'product', label: `📦 Promosi Produk (${recentCampaigns.filter(c => c.campaign_type === 'product_campaign').length})` },
                { key: 'editorial', label: `📰 Brand Editorial (${recentCampaigns.filter(c => c.campaign_type === 'editorial_campaign').length})` },
                { key: 'recipelabs', label: `📸 Recipe Labs (${recentCampaigns.filter(c => c.campaign_type === 'recipe_labs').length})` }
              ].map(filter => {
                const isActive = batchesFilterType === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setBatchesFilterType(filter.key)}
                    style={{
                      background: isActive ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                      border: `1px solid ${isActive ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                      color: isActive ? 'var(--action-primary)' : 'var(--text-secondary)',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '9999px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Campaign ID & Tipe</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Brand & Judul Batch</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>VI Preset Terpilih</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Format Klip</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Status Produksi</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Aksi & Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCampaigns ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Memuat riwayat batch kampanye...
                      </td>
                    </tr>
                  ) : recentCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Belum ada kampanye batch. Luncurkan kampanye 1-klik di atas untuk memulai produksi otomatis!
                      </td>
                    </tr>
                  ) : (() => {
                    const displayed = batchesFilterType === 'all'
                      ? recentCampaigns
                      : recentCampaigns.filter(c => 
                          c.campaign_type === batchesFilterType ||
                          (batchesFilterType === 'multiplier' && c.campaign_type === 'multiplier_campaign') ||
                          (batchesFilterType === 'recipe' && c.campaign_type === 'recipe_campaign') ||
                          (batchesFilterType === 'product' && c.campaign_type === 'product_campaign') ||
                          (batchesFilterType === 'editorial' && c.campaign_type === 'editorial_campaign') ||
                          (batchesFilterType === 'recipelabs' && c.campaign_type === 'recipe_labs')
                        );

                    if (displayed.length === 0) {
                      return (
                        <tr>
                          <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Tidak ada batch kampanye untuk filter tipe ini.
                          </td>
                        </tr>
                      );
                    }

                    return displayed.map(camp => {
                      const isInspected = camp.id === activeCampaignId;
                      const getTypeBadgeStyle = (type) => {
                        switch (type) {
                          case 'multiplier_campaign':
                            return { background: 'var(--status-purple-soft)', color: 'var(--status-purple)', border: '1px solid var(--status-purple)' };
                          case 'recipe_campaign':
                            return { background: 'var(--status-warning-soft)', color: 'var(--status-warning)', border: '1px solid var(--status-warning)' };
                          case 'editorial_campaign':
                            return { background: 'var(--status-rose-soft)', color: 'var(--status-rose)', border: '1px solid var(--status-rose)' };
                          case 'recipe_labs':
                            return { background: 'var(--status-success-soft)', color: 'var(--status-success)', border: '1px solid var(--status-success)' };
                          default:
                            return { background: 'var(--status-info-soft)', color: 'var(--status-info)', border: '1px solid var(--status-info)' };
                        }
                      };

                      return (
                        <tr
                          key={camp.id}
                          onClick={() => {
                            setActiveCampaignId(camp.id);
                            setPollingActive(camp.status !== 'completed');
                            fetchFactualStatus(camp.id);
                          }}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            background: isInspected ? 'var(--surface-interactive)' : 'transparent',
                            borderLeft: isInspected ? '3px solid var(--action-primary)' : '3px solid transparent',
                            transition: 'var(--transition)'
                          }}
                        >
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: isInspected ? 'var(--action-primary)' : 'inherit', display: 'block' }}>
                              {camp.id}
                            </strong>
                            <div style={{ marginTop: '0.25rem' }}>
                              <span style={{
                                ...getTypeBadgeStyle(camp.campaign_type),
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-xs)',
                                display: 'inline-block'
                              }}>
                                {camp.type_badge || 'Batch'}
                              </span>
                            </div>
                            {isInspected && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--action-primary)', fontWeight: 700, marginTop: '0.2rem' }}>
                                👁️ Terpilih di Visualizer
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{camp.campaign_name || camp.name || 'Batch Campaign'}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              {camp.brand_name || camp.account_name || 'Brand Profile'} • {camp.total_items || 1} Video Items
                              {camp.created_at ? ` • ${new Date(camp.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              {camp.visual_identity_preset_id || 'vi_default'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {camp.format_klip || `${camp.target_clips_count || 8} Klip @ ${camp.clip_duration || 4}s (${camp.video_model || 'omni_flash'})`}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-xs)',
                              background: camp.status === 'completed' ? 'var(--status-success-soft)' : 'var(--status-warning-soft)',
                              color: camp.status === 'completed' ? 'var(--status-success)' : 'var(--status-warning)',
                              border: `1px solid ${camp.status === 'completed' ? 'var(--status-success)' : 'var(--status-warning)'}`
                            }}>
                              ● {camp.status === 'completed' ? 'Selesai & Ready' : (camp.status || 'running')}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <Link
                                href={camp.target_detail_url || '/pillar-campaigns'}
                                style={{ color: 'var(--link)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem' }}
                              >
                                {camp.detail_label || 'Detail OPC ↗'}
                              </Link>
                              <Link
                                href="/content-flow"
                                style={{ color: 'var(--status-success)', textDecoration: 'none', fontWeight: 600, fontSize: '0.76rem' }}
                              >
                                📊 ContentFlow Hub ↗
                              </Link>
                              {camp.video_url && (
                                <a
                                  href={camp.video_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'var(--action-primary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.74rem' }}
                                >
                                  ☁️ Video Nextcloud ↗
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </section>
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PENJADWAL OTOMATIS & REPLIZ MULTI-PLATFORM                         */}
        {/* ========================================================================= */}
        {activeTab === 'schedules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Header Card with Add Schedule Button */}
            <section style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem 1.75rem',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⏰</span>
                  <span>Penjadwal Otomatis & Auto-Publish Repliz</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Atur siklus harian autonomous: pembuatan video otomatis di jam tertentu dan penerusan serempak ke media sosial via Repliz.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <Link
                  href="/content-flow"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <span>📊</span>
                  <span>ContentFlow Hub</span>
                </Link>

                <button
                  type="button"
                  onClick={openCreateScheduleModal}
                  style={{
                    background: 'var(--action-primary)',
                    color: 'var(--on-action-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 2px 10px rgba(6, 182, 212, 0.25)'
                  }}
                >
                  <span>➕</span>
                  <span>Buat Jadwal Rutin Baru</span>
                </button>
              </div>
            </section>

            {/* 4 KPI Stat Boxes */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Jadwal Rutin
                </span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {schedules.length}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--status-success)' }}>
                  ● {activeSchedulesCount} aktif berjalan
                </span>
              </div>

              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Akun Repliz Terhubung
                </span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {replizAccounts.length}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  IG Reels, TikTok, FB, YouTube
                </span>
              </div>

              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Jam Pembuatan Pertama
                </span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-info)' }}>
                  {schedules[0]?.generation_time || '05:00'} WIB
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Pagi hari otomatis oleh AI
                </span>
              </div>

              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Target Publish Pertama
                </span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-success)' }}>
                  {schedules[0]?.publish_time || '09:00'} WIB
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Disinkron ke ContentFlow Hub
                </span>
              </div>
            </div>

            {/* Filter Pills & Schedule List Container */}
            <section style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              {/* Brand Profile Filter Tabs */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.85rem',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>🏷️</span> Filter Brand:
                </span>
                <button
                  type="button"
                  onClick={() => setScheduleBrandFilter('all')}
                  style={{
                    background: scheduleBrandFilter === 'all' ? 'var(--surface-interactive)' : 'transparent',
                    color: scheduleBrandFilter === 'all' ? 'var(--action-primary)' : 'var(--text-secondary)',
                    border: scheduleBrandFilter === 'all' ? '1px solid var(--action-primary)' : '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'var(--transition)'
                  }}
                >
                  <span>Semua Brand</span>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: 9999,
                    background: scheduleBrandFilter === 'all' ? 'var(--status-info-soft)' : 'var(--surface-interactive)',
                    color: scheduleBrandFilter === 'all' ? 'var(--action-primary)' : 'var(--text-muted)'
                  }}>
                    {schedules.length}
                  </span>
                </button>
                {brands.map(b => {
                  const bCount = schedules.filter(s => s.brand_id === b.id).length;
                  const isSelected = scheduleBrandFilter === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setScheduleBrandFilter(b.id)}
                      style={{
                        background: isSelected ? 'var(--surface-interactive)' : 'transparent',
                        color: isSelected ? 'var(--action-primary)' : 'var(--text-secondary)',
                        border: isSelected ? '1px solid var(--action-primary)' : '1px solid transparent',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'var(--transition)'
                      }}
                    >
                      <span>{b.brand_name}</span>
                      <span style={{
                        fontSize: '0.68rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: 9999,
                        background: isSelected ? 'var(--status-info-soft)' : 'var(--surface-interactive)',
                        color: isSelected ? 'var(--action-primary)' : 'var(--text-muted)'
                      }}>
                        {bCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Campaign Type Filter Tabs (Multi-Campaign Header) */}
              <div style={{
                display: 'flex',
                gap: '0.45rem',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.65rem',
                overflowX: 'auto'
              }}>
                {[
                  { key: 'all', label: '🌐 Semua Kampanye', count: countAllCampaigns },
                  { key: 'product_campaign', label: '🛍️ Video Produk', count: countProductCampaigns },
                  { key: 'editorial_campaign', label: '📖 Video Editorial', count: countEditorialCampaigns },
                  { key: 'recipe_campaign', label: '🍳 Video Resep', count: countRecipeCampaigns },
                  { key: 'multiplier_campaign', label: '🔀 Video Multiplier', count: countMultiplierCampaigns },
                  { key: 'recipe_labs', label: '🖼️ Resep Teks & Foto', count: countRecipeLabsCampaigns },
                  { key: 'threads_series', label: '🧵 Threads Series', count: countThreadsSeriesCampaigns }
                ].map(tab => {
                  const isSelected = campaignTypeFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setCampaignTypeFilter(tab.key)}
                      style={{
                        background: isSelected ? 'var(--surface)' : 'transparent',
                        color: isSelected ? 'var(--action-primary)' : 'var(--text-secondary)',
                        border: isSelected ? '1px solid var(--border-subtle)' : '1px solid transparent',
                        boxShadow: isSelected ? 'var(--shadow-card)' : 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.45rem 0.95rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        whiteSpace: 'nowrap',
                        transition: 'var(--transition)'
                      }}
                    >
                      <span>{tab.label}</span>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: 9999,
                        background: isSelected ? 'var(--status-info-soft)' : 'var(--surface-interactive)',
                        color: isSelected ? 'var(--action-primary)' : 'var(--text-muted)'
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Status Filter Tabs */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.85rem'
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                  Filter Status:
                </span>
                {[
                  { key: 'all', label: 'Semua' },
                  { key: 'active', label: '🟢 Aktif Berjalan' },
                  { key: 'paused', label: '⏸️ Dijeda' },
                  { key: 'completed', label: '✅ Selesai' },
                  { key: 'archived', label: '📦 Diarsipkan' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setScheduleFilter(tab.key)}
                    style={{
                      background: scheduleFilter === tab.key ? 'var(--surface-interactive)' : 'transparent',
                      color: scheduleFilter === tab.key ? 'var(--action-primary)' : 'var(--text-secondary)',
                      border: scheduleFilter === tab.key ? '1px solid var(--action-primary)' : '1px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}

                <span style={{ height: '18px', width: '1px', background: 'var(--border-subtle)', margin: '0 0.4rem' }} />

                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>
                  Mode:
                </span>
                {[
                  { key: 'all', label: 'Semua Mode' },
                  { key: 'recurring', label: '🔄 Rutin Mingguan' },
                  { key: 'specific_date', label: '📅 Tanggal Spesifik' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setScheduleModeFilter(tab.key)}
                    style={{
                      background: scheduleModeFilter === tab.key ? 'var(--surface-interactive)' : 'transparent',
                      color: scheduleModeFilter === tab.key ? 'var(--action-primary)' : 'var(--text-secondary)',
                      border: scheduleModeFilter === tab.key ? '1px solid var(--action-primary)' : '1px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}

                {/* View Switcher Segmented Control */}
                <div style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px',
                  gap: '3px'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleViewMode('list');
                      if (typeof window !== 'undefined') localStorage.setItem('cfstudio_schedule_view_mode', 'list');
                    }}
                    style={{
                      border: 'none',
                      background: scheduleViewMode === 'list' ? 'var(--surface)' : 'transparent',
                      color: scheduleViewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: scheduleViewMode === 'list' ? 'var(--shadow-card)' : 'none',
                      transition: 'var(--transition)'
                    }}
                  >
                    <span>📋</span> Tampilan Tabel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleViewMode('calendar');
                      if (typeof window !== 'undefined') localStorage.setItem('cfstudio_schedule_view_mode', 'calendar');
                    }}
                    style={{
                      border: 'none',
                      background: scheduleViewMode === 'calendar' ? 'var(--surface)' : 'transparent',
                      color: scheduleViewMode === 'calendar' ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: scheduleViewMode === 'calendar' ? 'var(--shadow-card)' : 'none',
                      transition: 'var(--transition)'
                    }}
                  >
                    <span>📅</span> Tampilan Kalender
                  </button>
                </div>
              </div>

              {/* Schedule List / Calendar View */}
              {loadingSchedules ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Memuat daftar jadwal rutin...
                </div>
              ) : scheduleViewMode === 'calendar' ? (
                <ScheduleCalendarView
                  schedules={filteredSchedules}
                  allSchedulesCount={schedules.length}
                  onEditSchedule={openEditScheduleModal}
                  onCreateSchedule={(targetDate) => openCreateScheduleModal(targetDate)}
                  brands={brands}
                  replizAccounts={replizAccounts}
                />
              ) : filteredSchedules.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3.5rem 1rem',
                  border: '1.5px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '2.2rem' }}>📭</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Tidak ada jadwal yang cocok dengan filter ({scheduleBrandFilter !== 'all' ? (brands.find(b => b.id === scheduleBrandFilter)?.brand_name || scheduleBrandFilter) : 'Semua Brand'} · {campaignTypeFilter !== 'all' ? campaignTypeFilter : 'Semua Tipe'} · {scheduleFilter})
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '460px' }}>
                    Buat jadwal rutin baru untuk memproduksi video dan mempublikasikannya secara berkala ke Repliz.
                  </div>
                  <button
                    type="button"
                    onClick={openCreateScheduleModal}
                    style={{
                      marginTop: '0.5rem',
                      background: 'var(--action-primary)',
                      color: 'var(--on-action-primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.55rem 1.15rem',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Buat Jadwal Rutin Sekarang
                  </button>
                </div>
              ) : (
                <ScheduleTableView
                  schedules={filteredSchedules}
                  runningScheduleIds={runningScheduleIds}
                  onEditSchedule={openEditScheduleModal}
                  onRunNow={handleRunNow}
                  onTogglePause={handleTogglePause}
                  onArchiveSchedule={handleArchiveSchedule}
                  onDeleteSchedule={handleDeleteSchedule}
                  getCampaignTypeBadge={getCampaignTypeBadge}
                  formatDaysOfWeek={formatDaysOfWeek}
                />
              )}
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL DIALOG: BUAT / EDIT JADWAL RUTIN AUTO PIPELINE                      */}
        {/* ========================================================================= */}
        {isScheduleModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay-backdrop)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
          }}>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-modal)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem'
            }}>
              {/* Modal Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border-subtle)'
              }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⏰</span>
                  <span>{editingSchedule ? 'Edit Jadwal Rutin Auto Pipeline' : 'Buat Jadwal Rutin Auto Pipeline Baru'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.25rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                {/* STEP 1: Pilihan Tipe Kampanye (Multi-Campaign Selector) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Pilih Tipe Kampanye
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                    {[
                      { key: 'product_campaign', icon: '🛍️', label: 'Video Produk', desc: 'Promosi produk katalog & unboxing', color: 'var(--status-success)' },
                      { key: 'editorial_campaign', icon: '📖', label: 'Video Editorial', desc: 'Pilar konten brand & storytelling', color: 'var(--status-info)' },
                      { key: 'recipe_campaign', icon: '🍳', label: 'Video Resep', desc: 'Cooking guide & food reel 4-klip', color: 'var(--status-warning)' },
                      { key: 'multiplier_campaign', icon: '🔀', label: 'Video Multiplier', desc: 'Remix angle hook dari referensi', color: 'var(--status-purple)' },
                      { key: 'recipe_labs', icon: '🖼️', label: 'Resep Teks & Foto', desc: 'Naskah FB + Foto grid komposit', color: 'var(--status-rose)' },
                      { key: 'threads_series', icon: '🧵', label: 'Threads Series', desc: 'Kultwit autopilot 3–5 part + Foto G-Labs atau Teks', color: 'var(--status-info)' }
                    ].map(t => {
                      const isSelected = schedCampaignType === t.key;
                      return (
                        <div
                          key={t.key}
                          onClick={() => {
                            if (!editingSchedule) {
                              setSchedCampaignType(t.key);
                              const bObj = brands.find(b => b.id === schedBrandId);
                              setSchedName(prev => computeFormattedScheduleName(t.key, bObj, replizAccounts, prev));
                              fetchPresetsForModalBrand(schedBrandId, t.key);
                            }
                          }}
                          style={{
                            background: isSelected ? 'var(--surface-interactive)' : 'var(--surface)',
                            border: `1.5px solid ${isSelected ? t.color : 'var(--border-subtle)'}`,
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.75rem 0.85rem',
                            cursor: editingSchedule ? 'default' : 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            transition: 'var(--transition)',
                            position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{ fontSize: '1.25rem' }}>{t.icon}</span>
                              <strong style={{ fontSize: '0.86rem', color: isSelected ? t.color : 'var(--text-primary)' }}>
                                {t.label}
                              </strong>
                            </div>
                            <span style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              background: isSelected ? t.color : 'transparent',
                              border: `1.5px solid ${isSelected ? t.color : 'var(--border-strong)'}`,
                              color: isSelected ? '#ffffff' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.62rem',
                              fontWeight: 900
                            }}>✓</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 2: Brand Profile & Preset Video (DI ATAS KONFIGURASI KHUSUS) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      1. Brand Profile
                    </label>
                    <select
                      value={schedBrandId}
                      onChange={(e) => handleModalBrandChange(e.target.value)}
                      style={{
                        height: '42px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 0.85rem',
                        fontSize: '0.88rem',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    >
                      {brands.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.brand_name} {b.account_handle ? `(@${b.account_handle})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>2. Preset Konfigurasi Video</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--status-success)' }}>Preset-Driven</span>
                    </label>
                    <select
                      value={schedPresetKey}
                      onChange={(e) => setSchedPresetKey(e.target.value)}
                      style={{
                        height: '42px',
                        background: 'var(--input-bg)',
                        border: '1.5px solid var(--action-primary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 0.85rem',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    >
                      {(() => {
                        const presetsList = modalBrandPresets.length > 0 ? modalBrandPresets : operatorPresets;
                        const brandPresets = presetsList.filter(p => p.is_brand_match);
                        const generalPresets = presetsList.filter(p => !p.is_brand_match);
                        const selectedBrandObj = brands.find(b => b.id === schedBrandId);
                        const brandLabel = selectedBrandObj?.brand_name || 'Brand';

                        if (brandPresets.length > 0) {
                          return (
                            <>
                              <optgroup label={`⭐ Preset Khusus ${brandLabel} (${brandPresets.length})`}>
                                {brandPresets.map(p => (
                                  <option key={p.key} value={p.key}>
                                    {p.label || p.key}
                                  </option>
                                ))}
                              </optgroup>
                              {generalPresets.length > 0 && (
                                <optgroup label={`Preset Umum & Alternatif (${generalPresets.length})`}>
                                  {generalPresets.map(p => (
                                    <option key={p.key} value={p.key}>
                                      {p.label || p.key}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </>
                          );
                        }

                        return presetsList.map(p => (
                          <option key={p.key} value={p.key}>
                            {p.label || p.key}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>

                {/* Preset Target Language & Voice Info Banner */}
                {(() => {
                  const modalPresetsList = modalBrandPresets.length > 0 ? modalBrandPresets : operatorPresets;
                  const activePresetItem = modalPresetsList.find(p => p.key === schedPresetKey) || modalPresetsList[0];
                  const pConfig = activePresetItem?.config || activePresetItem || {};
                  const pLang = pConfig?.basic_strategy?.target_language || pConfig?.target_language || (schedBrandId?.includes('botani') ? 'id-ID' : 'en-US');
                  const pVoice = pConfig?.basic_strategy?.voice_persona || pConfig?.voice_persona || (pLang === 'en-US' ? 'English_causual_narrator_vv1' : 'Indonesian_warm_motherly_vv1');
                  const isEn = pLang === 'en-US';

                  return (
                    <div style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      fontSize: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          background: 'var(--status-info-soft)',
                          color: 'var(--status-info)',
                          border: '1px solid var(--border-subtle)',
                          fontWeight: 700
                        }}>
                          {isEn ? '🇺🇸 English (en-US)' : '🇮🇩 Bahasa Indonesia (id-ID)'}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          TTS: <strong style={{ color: 'var(--text-primary)' }}>{pVoice.replace(/_/g, ' ')}</strong>
                        </span>
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          background: 'var(--status-purple-soft)',
                          color: 'var(--status-purple)',
                          border: '1px solid var(--status-purple)',
                          fontWeight: 700
                        }}>
                          🧬 VI: {pConfig?.visual_swap?.visual_identity_preset_id || 'vi_default'}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        ⚡ AI otomatis menyusun Voice-Over &amp; Hook dalam bahasa &amp; tone preset ini
                      </span>
                    </div>
                  );
                })()}

                {/* UNIVERSAL: Nama Pengenal Jadwal (Hadir di Seluruh Tipe Kampanye) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Nama Pengenal Jadwal</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Wajib diisi</span>
                  </label>
                  <input
                    type="text"
                    value={schedName}
                    onChange={(e) => setSchedName(e.target.value)}
                    placeholder="Contoh: Multiplier - Dapur Botani - Batch 1"
                    required
                    style={{
                      height: '42px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.85rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                  {schedCampaignType === 'product_campaign' && selectedProductIds.length > 1 && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      💡 Mode Batch Multi-Produk ({selectedProductIds.length} produk): Nama produk akan otomatis ditambahkan ke nama pengenal di atas.
                    </span>
                  )}
                  {schedCampaignType === 'editorial_campaign' && selectedPillars.length > 1 && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      💡 Mode Batch Multi-Pilar ({selectedPillars.length} pilar): Nama pilar akan otomatis ditambahkan ke nama pengenal di atas.
                    </span>
                  )}
                </div>

                {/* STEP 3: Konfigurasi Khusus Kampanye (Adaptive) */}
                {/* 3A. PRODUK: Multi-Select Produk Katalog */}
                {schedCampaignType === 'product_campaign' && (
                  <div style={{
                    background: 'var(--surface-raised)',
                    border: '1.5px solid var(--status-success)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span>🛍️</span>
                        <span>Pilih Produk dari Katalog:</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.65rem',
                          borderRadius: 9999,
                          background: 'var(--status-success-soft)',
                          color: 'var(--status-success)',
                          border: '1px solid var(--status-success)'
                        }}>
                          {selectedProductIds.length} Produk Dipilih
                        </span>
                      </div>
                    </div>

                    {/* Search box & Quick Selection */}
                    <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔍</span>
                        <input
                          type="text"
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          placeholder="Cari produk katalog (nama atau kategori)..."
                          style={{
                            width: '100%',
                            height: '36px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 10px 0 32px',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.45rem', fontSize: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={handleSelectAllProducts}
                          style={{ background: 'none', border: 'none', color: 'var(--action-primary)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          Pilih Semua
                        </button>
                        <span style={{ color: 'var(--border-strong)' }}>|</span>
                        <button
                          type="button"
                          onClick={handleClearProducts}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          Hapus Pilihan
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Products List */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                      gap: '0.6rem',
                      maxHeight: '230px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {loadingProducts ? (
                        <div style={{ gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          Memuat katalog produk...
                        </div>
                      ) : filteredCatalogProducts.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                          {productSearchQuery ? `Tidak ada produk yang cocok dengan "${productSearchQuery}"` : 'Belum ada produk di katalog.'}
                        </div>
                      ) : (
                        filteredCatalogProducts.map(prod => {
                          const isChecked = selectedProductIds.includes(prod.id);
                          return (
                            <div
                              key={prod.id}
                              onClick={() => toggleProductSelection(prod.id)}
                              style={{
                                background: isChecked ? 'var(--surface-interactive)' : 'var(--surface)',
                                border: isChecked ? '1.5px solid var(--status-success)' : '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.65rem 0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.65rem',
                                transition: 'var(--transition)'
                              }}
                            >
                              {/* Product Thumbnail / Icon */}
                              <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--surface-raised)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                overflow: 'hidden'
                              }}>
                                {prod.photo_url ? (
                                  <img
                                    src={prod.photo_url}
                                    alt={prod.product_name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <span style={{ fontSize: '1.1rem' }}>🛍️</span>
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={prod.product_name}>
                                  {prod.product_name}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                  {prod.category || 'Katalog'}
                                </div>
                              </div>

                              <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                border: isChecked ? '1.5px solid var(--status-success)' : '1.5px solid var(--border-strong)',
                                background: isChecked ? 'var(--status-success)' : 'transparent',
                                color: isChecked ? '#ffffff' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 900,
                                flexShrink: 0
                              }}>
                                ✓
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Category Entry Point (CEP) Selector for Schedule */}
                    <div style={{
                      marginTop: '0.25rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>🎯</span>
                          <span>Sudut Masuk Pembeli (Category Entry Point / CEP):</span>
                        </label>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Diterapkan ke jadwal eksekusi produk
                        </span>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '0.5rem'
                      }}>
                        {CEP_OPTIONS.map(opt => {
                          const isCepSelected = schedSelectedCep === opt.value;
                          return (
                            <div
                              key={opt.value}
                              onClick={() => setSchedSelectedCep(opt.value)}
                              style={{
                                background: isCepSelected ? 'var(--surface-interactive)' : 'var(--surface)',
                                border: isCepSelected ? '1.5px solid var(--status-success)' : '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.5rem 0.65rem',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.2rem',
                                transition: 'var(--transition)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isCepSelected ? 'var(--status-success)' : 'var(--text-primary)' }}>
                                  {opt.icon} {opt.label}
                                </span>
                                {isCepSelected && (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--status-success)', fontWeight: 900 }}>✓</span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                                {opt.desc}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sudut Pandang / Arahan Promosi Harian (Promotion Context) */}
                    <div style={{
                      marginTop: '0.25rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>🏷️</span>
                          <span>Sudut Pandang / Arahan Promosi Konten:</span>
                        </label>
                        {!editingSchedule && (
                          <div style={{
                            display: 'flex',
                            background: 'var(--surface)',
                            padding: '0.15rem',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--border-subtle)',
                            gap: '0.2rem'
                          }}>
                            <button
                              type="button"
                              onClick={() => setSchedProductPromoMode('single')}
                              style={{
                                padding: '0.25rem 0.55rem',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: schedProductPromoMode === 'single' ? 'var(--action-primary)' : 'transparent',
                                color: schedProductPromoMode === 'single' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                                transition: 'var(--transition)'
                              }}
                            >
                              Single Angle
                            </button>
                            <button
                              type="button"
                              onClick={() => setSchedProductPromoMode('multi_angle')}
                              style={{
                                padding: '0.25rem 0.55rem',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: schedProductPromoMode === 'multi_angle' ? 'var(--action-primary)' : 'transparent',
                                color: schedProductPromoMode === 'multi_angle' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                                transition: 'var(--transition)'
                              }}
                            >
                              🎯 Multi-Angle (Batch)
                            </button>
                          </div>
                        )}
                      </div>

                      {schedProductPromoMode === 'single' || editingSchedule ? (
                        <>
                          <input
                            type="text"
                            value={schedPromotionContext}
                            onChange={(e) => setSchedPromotionContext(e.target.value)}
                            placeholder="Contoh: Solusi batuk pilek anak saat musim hujan, rutinitas pagi penambah energi..."
                            style={{
                              width: '100%',
                              height: '38px',
                              background: 'var(--input-bg)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0 0.75rem',
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
                              outline: 'none'
                            }}
                          />
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {[
                              { label: '☀️ Rutinitas Pagi Fit', text: 'Rutinitas pagi 1 sendok sebelum beraktivitas agar tubuh fit sepanjang hari' },
                              { label: '🏫 Jajan Sembarangan Sekolah', text: 'Kekhawatiran ibu terhadap anak yang sering jajan sembarangan di sekolah' },
                              { label: '🌧️ Tangkal Flu Musim Hujan', text: 'Persiapan musim hujan agar anggota keluarga tidak saling tertular flu' }
                            ].map((chip, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSchedPromotionContext(chip.text)}
                                style={{
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-secondary)',
                                  borderRadius: 9999,
                                  padding: '0.2rem 0.55rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {chip.label}
                              </button>
                            ))}
                            {schedPromotionContext && (
                              <button
                                type="button"
                                onClick={() => setSchedPromotionContext('')}
                                style={{
                                  background: 'var(--surface)',
                                  border: '1px solid var(--status-danger-soft)',
                                  color: 'var(--status-danger)',
                                  borderRadius: 9999,
                                  padding: '0.2rem 0.55rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                ✖ Kosongkan
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              Masukkan daftar angle / hook promosi untuk produk terpilih (1 baris = 1 jadwal):
                            </span>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: 'var(--status-info-soft)',
                              color: 'var(--status-info)',
                              padding: '0.15rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid var(--status-info)'
                            }}>
                              {schedProductAngleList.split('\n').filter(a => a.trim()).length} Angle Terdeteksi
                            </span>
                          </div>
                          <textarea
                            rows={4}
                            value={schedProductAngleList}
                            onChange={(e) => setSchedProductAngleList(e.target.value)}
                            placeholder={`Review Kejujuran Mengatasi Suara Bising Tetangga & Kamar Bersebelahan\nTutorial Pasang Mandiri Cepat Tanpa Merusak Cat Dinding Kamar\nPromo Flash Sale Gajian Diskon 40% Plus Bebas Ongkir Se-Indonesia`}
                            style={{
                              width: '100%',
                              background: 'var(--input-bg)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.65rem 0.85rem',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontFamily: 'var(--font-mono)',
                              outline: 'none',
                              lineHeight: 1.6
                            }}
                          />
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            💡 <strong>Universal Batch Angle:</strong> Setiap baris angle akan dibuatkan 1 baris jadwal mandiri untuk produk di atas, lengkap dengan integrasi kalender berurutan (+1 Hari).
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                      💡 <strong>Aturan 1 Produk = 1 Baris Jadwal Mandiri:</strong> Jika Anda memilih {selectedProductIds.length} produk, sistem akan membuat <strong>{selectedProductIds.length} baris jadwal independen</strong> lengkap dengan tombol Run Now dan Pause masing-masing.
                    </div>
                  </div>
                )}

                {/* 3B. EDITORIAL: Segmented Control & Multi-Keyword Textarea */}
                {schedCampaignType === 'editorial_campaign' && (
                  <div style={{
                    background: 'var(--surface-raised)',
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span>📅</span>
                        <span>{editingSchedule ? 'Topik Penjadwalan Editorial:' : 'Mode Sumber Topik Penjadwalan:'}</span>
                      </div>
                      {!editingSchedule ? (
                        <div style={{ display: 'flex', background: 'var(--surface)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => setSchedEditorialMode('pillar')}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: 'none',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: schedEditorialMode === 'pillar' ? 'var(--action-primary)' : 'transparent',
                              color: schedEditorialMode === 'pillar' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                              transition: 'var(--transition)'
                            }}
                          >
                            🏛️ Multi-Pilar Brand
                          </button>
                          <button
                            type="button"
                            onClick={() => setSchedEditorialMode('keyword')}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: 'none',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: schedEditorialMode === 'keyword' ? 'var(--action-primary)' : 'transparent',
                              color: schedEditorialMode === 'keyword' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                              transition: 'var(--transition)'
                            }}
                          >
                            🎯 Multi-Keyword (Pilar OFF)
                          </button>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          background: 'var(--status-info-soft)',
                          color: 'var(--status-info)',
                          padding: '0.2rem 0.65rem',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--status-info)'
                        }}>
                          {schedEditorialMode === 'keyword' ? '🎯 Mode: Kata Kunci Target (Pilar OFF)' : '🏛️ Mode: Pilar Brand'}
                        </span>
                      )}
                    </div>

                    {schedEditorialMode === 'pillar' ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pilih pilar brand yang ingin dijadwalkan:</span>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.65rem',
                            borderRadius: 9999,
                            background: 'var(--status-info-soft)',
                            color: 'var(--status-info)',
                            border: '1px solid var(--status-info)'
                          }}>
                            {selectedPillars.length} Pilar Dipilih
                          </span>
                        </div>

                        {/* Search box & Quick Selection */}
                        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔍</span>
                            <input
                              type="text"
                              value={pillarSearchQuery}
                              onChange={(e) => setPillarSearchQuery(e.target.value)}
                              placeholder="Cari nama pilar brand..."
                              style={{
                                width: '100%',
                                height: '36px',
                                background: 'var(--surface)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0 10px 0 32px',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '0.45rem', fontSize: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={handleSelectAllPillars}
                              style={{ background: 'none', border: 'none', color: 'var(--action-primary)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                            >
                              Pilih Semua
                            </button>
                            <span style={{ color: 'var(--border-strong)' }}>|</span>
                            <button
                              type="button"
                              onClick={handleClearPillars}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                            >
                              Hapus Pilihan
                            </button>
                          </div>
                        </div>

                        {/* Scrollable Pillars List */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                          gap: '0.6rem',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          paddingRight: '4px'
                        }}>
                          {filteredPillars.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                              Tidak ada pilar yang cocok dengan "{pillarSearchQuery}".
                            </div>
                          ) : (
                            filteredPillars.map((pillar, idx) => {
                              const isChecked = selectedPillars.includes(pillar);
                              return (
                                <div
                                  key={idx}
                                  onClick={() => togglePillarSelection(pillar)}
                                  style={{
                                    background: isChecked ? 'var(--surface-interactive)' : 'var(--surface)',
                                    border: isChecked ? '1.5px solid var(--status-info)' : '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '0.65rem 0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.65rem',
                                    transition: 'var(--transition)'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '1rem' }}>📌</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pillar}>
                                      {pillar}
                                    </span>
                                  </div>

                                  <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    border: isChecked ? '1.5px solid var(--status-info)' : '1.5px solid var(--border-strong)',
                                    background: isChecked ? 'var(--status-info)' : 'transparent',
                                    color: isChecked ? 'var(--on-action-primary)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 900,
                                    flexShrink: 0
                                  }}>
                                    ✓
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                          💡 <strong>Aturan 1 Pilar = 1 Baris Jadwal Mandiri:</strong> Jika Anda memilih {selectedPillars.length} pilar, sistem akan membuat <strong>{selectedPillars.length} baris jadwal independen</strong> yang memproduksi konten storytelling sesuai topik pilar tersebut.
                        </div>
                      </>
                    ) : editingSchedule ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Kata Kunci Target Jadwal Ini:
                        </label>
                        <input
                          type="text"
                          value={schedEditorialKeywordsText}
                          onChange={(e) => setSchedEditorialKeywordsText(e.target.value)}
                          placeholder="Masukkan kata kunci target..."
                          required
                          style={{
                            height: '42px',
                            background: 'var(--input-bg)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 0.85rem',
                            fontSize: '0.88rem',
                            color: 'var(--text-primary)',
                            fontWeight: 700,
                            outline: 'none'
                          }}
                        />
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          💡 <strong>Jadwal Mandiri:</strong> Jadwal ini secara khusus memproduksi video storytelling tension berdasarkan 1 kata kunci pencarian di atas dengan pilar brand dinonaktifkan (Pilar OFF).
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            Daftar Kata Kunci (1 baris = 1 jadwal mandiri):
                          </label>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, background: 'var(--status-info-soft)', color: 'var(--status-info)', padding: '0.15rem 0.55rem', borderRadius: 9999 }}>
                            {schedEditorialKeywordsText.split('\n').filter(k => k.trim()).length} Kata Kunci
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={schedEditorialKeywordsText}
                          onChange={(e) => setSchedEditorialKeywordsText(e.target.value)}
                          placeholder={'peredam suara studio podcast murah\ncara hilangkan dengung kamar tidur\nperbedaan rockwool vs glasswool untuk studio'}
                          style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.65rem',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            fontFamily: 'var(--font-mono)',
                            outline: 'none',
                            resize: 'vertical'
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            id="chkSchedStagger"
                            checked={schedStaggerDays}
                            onChange={(e) => setSchedStaggerDays(e.target.checked)}
                            style={{ accentColor: 'var(--action-primary)', cursor: 'pointer' }}
                          />
                          <label htmlFor="chkSchedStagger" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                            <strong>Distribusi Hari Otomatis:</strong> Sebarkan setiap kata kunci ke hari yang berurutan (Senin, Selasa, Rabu, dst).
                          </label>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                          💡 <strong>Opsi A (Batch Multi-Jadwal):</strong> Setiap baris kata kunci akan dibuatkan 1 baris jadwal mandiri di database dengan pilar brand dinonaktifkan (Pilar OFF). AI Gemini 1-Pass akan memproduksi video storytelling tension sesuai intent pencarian keyword tersebut.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3C. RESEP: Topik Resep & Kategori Kuliner */}
                {schedCampaignType === 'recipe_campaign' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {!editingSchedule && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            Mode Perencanaan Resep:
                          </label>
                          <div style={{
                            display: 'flex',
                            background: 'var(--surface)',
                            padding: '0.2rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            gap: '0.25rem'
                          }}>
                            <button
                              type="button"
                              onClick={() => setSchedRecipeMode('umbrella')}
                              style={{
                                padding: '0.35rem 0.75rem',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: schedRecipeMode === 'umbrella' ? 'var(--action-primary)' : 'transparent',
                                color: schedRecipeMode === 'umbrella' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                                transition: 'var(--transition)'
                              }}
                            >
                              🍲 Topik Payung (AI Acak)
                            </button>
                            <button
                              type="button"
                              onClick={() => setSchedRecipeMode('menu_list')}
                              style={{
                                padding: '0.35rem 0.75rem',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: schedRecipeMode === 'menu_list' ? 'var(--action-primary)' : 'transparent',
                                color: schedRecipeMode === 'menu_list' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                                transition: 'var(--transition)'
                              }}
                            >
                              📝 Multi-Line Menu Resep
                            </button>
                          </div>
                        </div>
                      )}

                      {schedRecipeMode === 'umbrella' || editingSchedule ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Tema / Arahan Topik Resep Harian</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AI berkreasi variasi resep baru tiap hari</span>
                          </label>
                          <input
                            type="text"
                            value={schedTopic}
                            onChange={(e) => {
                              const newTopic = e.target.value;
                              setSchedTopic(newTopic);
                              if (!isSchedCategoryManual) {
                                setSchedCategory(detectCategoryFromTopic(newTopic));
                              }
                            }}
                            placeholder="Contoh: Air fryer crispy chicken tenders and snack finger foods"
                            required={schedRecipeMode === 'umbrella'}
                            style={{
                              height: '42px',
                              background: 'var(--input-bg)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0 0.85rem',
                              fontSize: '0.88rem',
                              color: 'var(--text-primary)',
                              outline: 'none'
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              Daftar Nama Menu Kuliner (1 Baris = 1 Jadwal Mandiri):
                            </span>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: 'var(--status-info-soft)',
                              color: 'var(--status-info)',
                              padding: '0.15rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid var(--status-info)'
                            }}>
                              {schedRecipeMenuList.split('\n').filter(k => k.trim()).length} Menu Resep
                            </span>
                          </div>
                          <textarea
                            rows={4}
                            value={schedRecipeMenuList}
                            onChange={(e) => setSchedRecipeMenuList(e.target.value)}
                            placeholder={`Ayam Goreng Lengkuas Air Fryer Gurih Meresap\nTahu Bakso Kukus Rendah Kalori\nSup Jamur Enoki Pedas Segar Ala Resto\nBolu Pisang Kukus Lembut Tanpa Mixer`}
                            style={{
                              width: '100%',
                              background: 'var(--input-bg)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.65rem 0.85rem',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontFamily: 'var(--font-mono)',
                              outline: 'none',
                              lineHeight: 1.6
                            }}
                          />
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            💡 <strong>Deteksi Kategori Otomatis:</strong> Kategori kuliner akan dianalisis secara mandiri dari nama masing-masing masakan untuk menentukan wadah &amp; prompt visual AI.
                          </div>
                        </div>
                      )}
                    </div>

                    {(schedRecipeMode === 'umbrella' || editingSchedule) && (
                      <div style={{
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem'
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>🍽️</span>
                          <span>Kategori Resep Kuliner</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Mengarahkan kit wadah &amp; instruksi AI)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            background: isSchedCategoryManual ? 'var(--status-warning-soft)' : 'var(--status-info-soft)',
                            color: isSchedCategoryManual ? 'var(--status-warning)' : 'var(--status-info)',
                            border: '1px solid var(--border-subtle)'
                          }}>
                            {isSchedCategoryManual ? '✏️ Pilihan Manual' : '✨ Auto-Terdeteksi dari Topik'}
                          </span>
                          {isSchedCategoryManual && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsSchedCategoryManual(false);
                                setSchedCategory(detectCategoryFromTopic(schedTopic));
                              }}
                              style={{
                                background: 'none',
                                border: '1px dashed var(--border-subtle)',
                                color: 'var(--text-muted)',
                                borderRadius: '4px',
                                padding: '0.15rem 0.45rem',
                                fontSize: '0.68rem',
                                cursor: 'pointer'
                              }}
                            >
                              Reset ke Otomatis
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.55rem' }}>
                        {[
                          { key: 'makanan_utama', icon: '🍗', label: 'Makanan Utama', desc: 'Ayam, daging, pasta, rice bowl' },
                          { key: 'camilan', icon: '🍟', label: 'Camilan / Side Dish', desc: 'Finger food, fries, crispy bites' },
                          { key: 'dessert', icon: '🍰', label: 'Baking / Dessert', desc: 'Cake, cookies, waffle, pudding' },
                          { key: 'minuman', icon: '🥤', label: 'Minuman', desc: 'Coffee, latte, smoothie, tea' }
                        ].map(cat => {
                          const isSelected = schedCategory === cat.key;
                          return (
                            <div
                              key={cat.key}
                              onClick={() => {
                                setSchedCategory(cat.key);
                                setIsSchedCategoryManual(true);
                              }}
                              style={{
                                background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'var(--surface)',
                                border: `1.5px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.65rem 0.55rem',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.2rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
                                <span style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  background: isSelected ? 'var(--action-primary)' : 'transparent',
                                  border: `1px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                                  color: isSelected ? 'var(--on-action-primary)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.6rem',
                                  fontWeight: 900
                                }}>✓</span>
                              </div>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{cat.label}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{cat.desc}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    )}
                  </>
                )}

                {/* 3D. MULTIPLIER: Nama Jadwal & Target Blueprint Video */}
                {schedCampaignType === 'multiplier_campaign' && (
                  <div style={{
                    background: 'var(--surface-raised)',
                    border: '1.5px solid var(--status-purple)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                        🔀 Konfigurasi Jadwal Rutin Multiplier
                      </strong>
                      <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 9999, background: 'var(--status-purple-soft)', color: 'var(--status-purple)', fontWeight: 800 }}>
                        Autopilot Angle Remix
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Pilih Blueprint Video Acuan (Deconstruct Lab)
                        </label>
                        {schedBlueprintSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setSchedBlueprintSearchQuery('')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--status-purple)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Reset Filter
                          </button>
                        )}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>🔍</span>
                        <input
                          type="text"
                          value={schedBlueprintSearchQuery}
                          onChange={(e) => setSchedBlueprintSearchQuery(e.target.value)}
                          placeholder="Ketik ID URL (misal: 1476160110888470), niche, atau topik..."
                          style={{
                            width: '100%',
                            height: '36px',
                            background: 'var(--input-bg)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 0.75rem 0 30px',
                            fontSize: '0.8rem',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            marginBottom: '0.35rem'
                          }}
                        />
                      </div>
                      {editingSchedule ? (
                        <select
                          value={schedBlueprintId}
                          onChange={(e) => setSchedBlueprintId(e.target.value)}
                          style={{
                            height: '40px',
                            background: 'var(--input-bg)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 0.75rem',
                            fontSize: '0.84rem',
                            color: 'var(--text-primary)',
                            outline: 'none'
                          }}
                        >
                          <option value="">⚡ Autopilot: Blueprint Video Paling Viral (Rank #1 Hook)</option>
                          {blueprints
                            .filter(bp => {
                              if (!schedBlueprintSearchQuery.trim()) return true;
                              const q = schedBlueprintSearchQuery.toLowerCase().trim();
                              const rId = extractReelId(bp.source_url);
                              return (
                                (rId && rId.includes(q)) ||
                                (bp.source_url && bp.source_url.toLowerCase().includes(q)) ||
                                (bp.core_problem && bp.core_problem.toLowerCase().includes(q)) ||
                                (bp.core_solution && bp.core_solution.toLowerCase().includes(q)) ||
                                (bp.niche && bp.niche.toLowerCase().includes(q)) ||
                                (bp.tags && (Array.isArray(bp.tags) ? bp.tags.join(' ') : String(bp.tags)).toLowerCase().includes(q)) ||
                                (bp.viral_pattern_summary && bp.viral_pattern_summary.toLowerCase().includes(q)) ||
                                (bp.original_caption && bp.original_caption.toLowerCase().includes(q))
                              );
                            })
                            .map(bp => {
                              const rId = extractReelId(bp.source_url);
                              const title = bp.core_problem || bp.core_solution || bp.original_caption || bp.source_url;
                              const label = `[ID: ${rId || bp.id.slice(0, 8)}] ${bp.niche ? `[${bp.niche}] ` : ''}${title}`;
                              return (
                                <option key={bp.id} value={bp.id} title={title}>
                                  {label.length > 80 ? `${label.substring(0, 80)}...` : label}
                                </option>
                              );
                            })}
                        </select>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.75rem' }}>
                            <span style={{
                              fontWeight: 700,
                              background: 'var(--status-info-soft)',
                              color: 'var(--status-info)',
                              padding: '0.15rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid var(--status-info)'
                            }}>
                              {selectedBlueprintIds.length} Blueprint Dipilih {selectedBlueprintIds.length > 1 ? '(Mode Batch ⚡)' : ''}
                            </span>
                            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const filtered = blueprints.filter(bp => {
                                    if (!schedBlueprintSearchQuery.trim()) return true;
                                    const q = schedBlueprintSearchQuery.toLowerCase().trim();
                                    const rId = extractReelId(bp.source_url);
                                    return (
                                      (rId && rId.includes(q)) ||
                                      (bp.source_url && bp.source_url.toLowerCase().includes(q)) ||
                                      (bp.core_problem && bp.core_problem.toLowerCase().includes(q)) ||
                                      (bp.core_solution && bp.core_solution.toLowerCase().includes(q)) ||
                                      (bp.niche && bp.niche.toLowerCase().includes(q))
                                    );
                                  });
                                  setSelectedBlueprintIds(filtered.map(b => b.id));
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--action-primary)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                              >
                                Pilih Semua
                              </button>
                              <span style={{ color: 'var(--border-strong)' }}>|</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (blueprints.length > 0) setSelectedBlueprintIds([blueprints[0].id]);
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                              >
                                Pilih Rank #1 Saja
                              </button>
                            </div>
                          </div>

                          <div style={{
                            maxHeight: '230px',
                            overflowY: 'auto',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                            background: 'var(--surface)'
                          }}>
                            {blueprints
                              .filter(bp => {
                                if (!schedBlueprintSearchQuery.trim()) return true;
                                const q = schedBlueprintSearchQuery.toLowerCase().trim();
                                const rId = extractReelId(bp.source_url);
                                return (
                                  (rId && rId.includes(q)) ||
                                  (bp.source_url && bp.source_url.toLowerCase().includes(q)) ||
                                  (bp.core_problem && bp.core_problem.toLowerCase().includes(q)) ||
                                  (bp.core_solution && bp.core_solution.toLowerCase().includes(q)) ||
                                  (bp.niche && bp.niche.toLowerCase().includes(q)) ||
                                  (bp.tags && (Array.isArray(bp.tags) ? bp.tags.join(' ') : String(bp.tags)).toLowerCase().includes(q)) ||
                                  (bp.viral_pattern_summary && bp.viral_pattern_summary.toLowerCase().includes(q)) ||
                                  (bp.original_caption && bp.original_caption.toLowerCase().includes(q))
                                );
                              })
                              .map(bp => {
                                const isChecked = selectedBlueprintIds.includes(bp.id);
                                const rId = extractReelId(bp.source_url);
                                const title = bp.core_problem || bp.core_solution || bp.original_caption || bp.source_url;
                                return (
                                  <div
                                    key={bp.id}
                                    onClick={() => toggleBlueprintSelection(bp.id)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.55rem 0.75rem',
                                      borderRadius: 'var(--radius-xs)',
                                      background: isChecked ? 'var(--surface-interactive)' : 'transparent',
                                      border: isChecked ? '1px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                                      cursor: 'pointer',
                                      transition: 'var(--transition)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingRight: '0.5rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {title}
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {bp.niche ? `[${bp.niche}] ` : ''}{rId ? `Reel ID: ${rId} • ` : ''}Viral Hook Score: Rank #1
                                      </span>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      style={{
                                        width: '16px',
                                        height: '16px',
                                        accentColor: 'var(--action-primary)',
                                        cursor: 'pointer',
                                        flexShrink: 0
                                      }}
                                    />
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                      💡 <strong>Autopilot Bebas Repetisi:</strong> Setiap hari mesin akan membaca riwayat hook yang telah diproduksi (<code>excluded_history</code>), merumuskan variasi sudut pandang baru dengan Gemini AI, memilih Rank #1, dan langsung merender video klip untuk publikasi otomatis.
                    </div>
                  </div>
                )}

                {/* 3E. RECIPE LABS: Topik, Kolase Grid & Facebook Post */}
                {schedCampaignType === 'recipe_labs' && (
                  <div style={{
                    background: 'var(--surface-raised)',
                    border: '1.5px solid var(--status-rose)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                        🖼️ Konfigurasi Jadwal Resep Teks & Foto Komposit
                      </strong>
                      <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 9999, background: 'var(--status-rose-soft)', color: 'var(--status-rose)', fontWeight: 800 }}>
                        Artikel FB + Grid Poster
                      </span>
                    </div>

                    {/* 1. Language-First Control */}
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--action-primary)' }}>
                        🌐 1. Target Market / Bahasa Resep
                      </label>
                      <select
                        value={schedTargetLanguage}
                        onChange={(e) => {
                          const newLang = e.target.value;
                          setSchedTargetLanguage(newLang);
                          const firstCat = INTERNATIONAL_RECIPE_TAXONOMY[newLang]?.categories?.[0]?.options?.[0] || 'Main Courses & Entrees';
                          setSchedRecipeClassification(firstCat);
                        }}
                        style={{
                          height: '38px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 0.75rem',
                          fontSize: '0.84rem',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          fontWeight: 600
                        }}
                      >
                        <option value="en_US">🇺🇸 Global English (International / US & UK Standard)</option>
                        <option value="id_ID">🇮🇩 Bahasa Indonesia (Pasar Domestik & UMKM)</option>
                        <option value="bilingual">🌐 Bilingual (English Hook + Indonesian Body)</option>
                      </select>
                      <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Klasifikasi resep di bawah otomatis menyesuaikan dengan standar bahasa terpilih.
                      </small>
                    </div>

                    {/* 2. Responsive Classification Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        🏷️ 2. {schedTargetLanguage === 'id_ID' ? 'Klasifikasi Jenis Resep' : 'Culinary Category'}
                      </label>
                      <select
                        value={schedRecipeClassification}
                        onChange={(e) => setSchedRecipeClassification(e.target.value)}
                        style={{
                          height: '38px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 0.75rem',
                          fontSize: '0.84rem',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      >
                        {(INTERNATIONAL_RECIPE_TAXONOMY[schedTargetLanguage]?.categories || []).map((grp, gIdx) => (
                          <optgroup key={gIdx} label={grp.group}>
                            {grp.options.map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>{opt}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* 3. Strict Keyword / Dish Name */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        🎯 3. {schedTargetLanguage === 'id_ID' ? 'Kata Kunci Menu Wajib (Strict Enforcement)' : 'Mandatory Dish Keyword (Strict Enforcement)'}
                      </label>
                      <input
                        type="text"
                        value={schedTopic}
                        onChange={(e) => setSchedTopic(e.target.value)}
                        placeholder={INTERNATIONAL_RECIPE_TAXONOMY[schedTargetLanguage]?.placeholderKeyword || 'e.g., Crispy Honey Garlic Air Fryer Chicken Bites'}
                        required
                        style={{
                          height: '38px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 0.75rem',
                          fontSize: '0.84rem',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      />
                      <small style={{ fontSize: '0.72rem', color: 'var(--status-warning)' }}>
                        ⚠️ Gemini AI dipaksa membuat resep 100% berfokus pada hidangan ini.
                      </small>
                    </div>

                    {/* 4. Orientasi / Rasio Kolase Poster */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>📐 Orientasi / Rasio Kolase Poster:</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--status-rose)', fontWeight: 600 }}>
                          {schedRecipeAspectRatio === '1:1' ? '1080x1080 (Square Feed)' : (schedRecipeAspectRatio === '3:4' ? '1080x1440 (Portrait Feed Optimal)' : '1080x1920 (Full Vertical)')}
                        </span>
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        {[
                          { key: '1:1', icon: '⏹️', label: '1:1 Square', sub: 'IG/FB Feed' },
                          { key: '3:4', icon: '📱', label: '3:4 Portrait', sub: 'Feed Optimal' },
                          { key: '9:16', icon: '📜', label: '9:16 Vertical', sub: 'Stories/Pins' }
                        ].map(ratio => {
                          const isSelected = schedRecipeAspectRatio === ratio.key;
                          return (
                            <button
                              key={ratio.key}
                              type="button"
                              onClick={() => setSchedRecipeAspectRatio(ratio.key)}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.45rem 0.25rem',
                                borderRadius: 'var(--radius-sm)',
                                border: isSelected ? '1.5px solid var(--status-rose)' : '1px solid var(--border-subtle)',
                                background: isSelected ? 'var(--surface-interactive)' : 'var(--surface)',
                                color: isSelected ? 'var(--status-rose)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'var(--transition)'
                              }}
                            >
                              <span style={{ fontSize: '1.05rem' }}>{ratio.icon}</span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{ratio.label}</span>
                              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{ratio.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          🎨 Gaya Environment Foto AI
                        </label>
                        <select
                          value={schedVisualStyle}
                          onChange={(e) => setSchedVisualStyle(e.target.value)}
                          style={{
                            height: '38px',
                            background: 'var(--input-bg)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 0.75rem',
                            fontSize: '0.84rem',
                            color: 'var(--text-primary)',
                            outline: 'none'
                          }}
                        >
                          <option value="Rustic Warm Tabletop & Artisanal Kitchen">🌿 Rustic Warm Tabletop & Artisanal Kitchen</option>
                          <option value="Modern Minimalist Nordic Studio">⚪ Modern Minimalist Nordic Studio</option>
                          <option value="Dark Moody Chiaroscuro & Atmospheric Smoke">🍷 Dark Moody Chiaroscuro & Atmospheric Smoke</option>
                          <option value="Vibrant Alfresco Sunlit Patio">🍋 Vibrant Alfresco Sunlit Patio</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Jumlah Foto dalam Kolase
                        </label>
                        <select
                          value={schedImagesPerRecipe}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSchedImagesPerRecipe(val);
                            setSchedLayoutId(LAYOUT_PRESET_METADATA[val]?.[0]?.id || '4_editorial_split');
                          }}
                          style={{
                            height: '38px',
                            background: 'var(--input-bg)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 0.75rem',
                            fontSize: '0.84rem',
                            color: 'var(--text-primary)',
                            outline: 'none'
                          }}
                        >
                          <option value={3}>3 Gambar Kolase</option>
                          <option value={4}>4 Gambar Kolase (Default)</option>
                          <option value={5}>5 Gambar Kolase</option>
                          <option value={6}>6 Gambar Kolase</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Template Susunan Grid
                        </label>
                        <select
                          value={schedLayoutId}
                          onChange={(e) => setSchedLayoutId(e.target.value)}
                          style={{
                            height: '38px',
                            background: 'var(--input-bg)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 0.75rem',
                            fontSize: '0.84rem',
                            color: 'var(--text-primary)',
                            outline: 'none'
                          }}
                        >
                          {(LAYOUT_PRESET_METADATA[schedImagesPerRecipe] || []).map(preset => (
                            <option key={preset.id} value={preset.id}>{preset.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <input
                        type="checkbox"
                        id="sched-fb-check"
                        checked={schedPostToFacebook}
                        onChange={(e) => setSchedPostToFacebook(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--action-primary)', cursor: 'pointer' }}
                      />
                      <label htmlFor="sched-fb-check" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                        Auto-Publish Naskah FB & Kolase Poster ke Facebook Pages
                      </label>
                    </div>
                  </div>
                )}

                {/* 3F. THREADS SERIES: Konfigurasi Utas Berseri Terjadwal */}
                {schedCampaignType === 'threads_series' && (
                  <ThreadsSeriesForm
                    objective={threadsObjective}
                    setObjective={setThreadsObjective}
                    personalProductName={threadsPersonalProductName}
                    setPersonalProductName={setThreadsPersonalProductName}
                    personalProductCta={threadsPersonalProductCta}
                    setPersonalProductCta={setThreadsPersonalProductCta}
                    affiliateProductTitle={threadsAffiliateProductTitle}
                    setAffiliateProductTitle={setThreadsAffiliateProductTitle}
                    affiliateProductLink={threadsAffiliateProductLink}
                    setAffiliateProductLink={setThreadsAffiliateProductLink}
                    pureOrganicTopic={threadsPureOrganicTopic}
                    setPureOrganicTopic={setThreadsPureOrganicTopic}
                    visualMode={threadsVisualMode}
                    setVisualMode={setThreadsVisualMode}
                    selectedAccountId={threadsSelectedAccountId}
                    setSelectedAccountId={setThreadsSelectedAccountId}
                    replizAccounts={replizAccounts}
                    onSyncAccounts={() => fetchReplizAccounts(true)}
                    isSyncingAccounts={isSyncingRepliz}
                    recentPosts={threadsSeriesPosts}
                  />
                )}

                {/* STEP 4: Dua Waktu Terpisah (Jam Pembuatan & Jam Publish - Format 24 Jam WIB) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                  background: 'var(--surface-raised)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--status-info)' }}>
                      ⚙️ Jam Pembuatan Video (Format 24 Jam WIB)
                    </label>
                    <input
                      type="time"
                      value={schedGenTime}
                      onChange={(e) => setSchedGenTime(e.target.value)}
                      required
                      style={{
                        height: '42px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 0.85rem',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Contoh: <strong>05:00</strong> (Pagi) atau <strong>17:00</strong> (Sore WIB). AI otomatis memproduksi video pada jam ini
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--status-success)' }}>
                      🚀 Jam Publish Repliz (Format 24 Jam WIB)
                    </label>
                    <input
                      type="time"
                      value={schedPubTime}
                      onChange={(e) => setSchedPubTime(e.target.value)}
                      required
                      style={{
                        height: '42px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 0.85rem',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Contoh: <strong>09:00</strong> (Pagi) atau <strong>21:30</strong> (Malam WIB). Video diteruskan ke antrean Repliz untuk jam ini
                    </span>
                  </div>
                </div>

                {/* 6. Mode Penjadwalan & Hari / Tanggal */}
                {(() => {
                  const batchItemCount = (
                    schedCampaignType === 'editorial_campaign' && schedEditorialMode === 'keyword'
                      ? schedEditorialKeywordsText.split('\n').map(s => s.trim()).filter(Boolean).length
                      : (schedCampaignType === 'editorial_campaign' && schedEditorialMode === 'pillars'
                          ? selectedPillars.length
                          : (schedCampaignType === 'recipe_campaign' && schedRecipeMode === 'menu_list'
                              ? schedRecipeMenuList.split('\n').map(s => s.trim()).filter(Boolean).length
                              : (schedCampaignType === 'multiplier_campaign'
                                  ? selectedBlueprintIds.length
                                  : (schedCampaignType === 'product_campaign'
                                      ? (schedProductPromoMode === 'multi_angle'
                                          ? schedProductAngleList.split('\n').map(s => s.trim()).filter(Boolean).length
                                          : selectedProductIds.length)
                                      : 1))))
                  );
                  const isBatchSchedule = !editingSchedule && batchItemCount > 1;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Pilih Mode Penjadwalan:
                        </label>
                        <div style={{
                          display: 'flex',
                          background: 'var(--surface)',
                          padding: '0.2rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          gap: '0.25rem'
                        }}>
                          <button
                            type="button"
                            onClick={() => setSchedMode('recurring')}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: 'none',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: schedMode === 'recurring' ? 'var(--action-primary)' : 'transparent',
                              color: schedMode === 'recurring' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                              transition: 'var(--transition)'
                            }}
                          >
                            🔄 Rutin Mingguan
                          </button>
                          <button
                            type="button"
                            onClick={() => setSchedMode('specific_date')}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: 'none',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: schedMode === 'specific_date' ? 'var(--action-primary)' : 'transparent',
                              color: schedMode === 'specific_date' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                              transition: 'var(--transition)'
                            }}
                          >
                            📅 Tanggal Spesifik
                          </button>
                        </div>
                      </div>

                      {schedMode === 'recurring' ? (
                        <div style={{
                          background: 'var(--surface-raised)',
                          padding: '0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              Hari Rutin Eksekusi:
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--status-info)' }}>
                              Aktif: {schedDays.map(d => ({ 1: 'Sen', 2: 'Sel', 3: 'Rab', 4: 'Kam', 5: 'Jum', 6: 'Sab', 0: 'Min' }[d])).join(', ')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            {[
                              { idx: 1, label: 'Sen' },
                              { idx: 2, label: 'Sel' },
                              { idx: 3, label: 'Rab' },
                              { idx: 4, label: 'Kam' },
                              { idx: 5, label: 'Jum' },
                              { idx: 6, label: 'Sab' },
                              { idx: 0, label: 'Min' }
                            ].map(day => {
                              const isSelected = schedDays.includes(day.idx);
                              return (
                                <button
                                  key={day.idx}
                                  type="button"
                                  onClick={() => toggleDaySelection(day.idx)}
                                  style={{
                                    padding: '0.45rem 0.85rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: isSelected ? '1px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                                    background: isSelected ? 'var(--action-primary)' : 'var(--surface)',
                                    color: isSelected ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'var(--transition)'
                                  }}
                                >
                                  {day.label}
                                </button>
                              );
                            })}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            💡 <strong>Karakteristik Rutin:</strong> Pipeline akan terus dieksekusi berulang setiap minggu pada hari terpilih. Status tetap <code>active</code>.
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          background: 'var(--surface-raised)',
                          padding: '0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-strong)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              Pilih Tanggal Kalender Eksekusi:
                            </span>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'var(--status-warning-soft)',
                              color: 'var(--status-warning)',
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-full)'
                            }}>
                              One-Time Execution 🎯
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="date"
                              value={schedTargetDate}
                              onChange={(e) => setSchedTargetDate(e.target.value)}
                              style={{
                                height: '38px',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0 0.75rem',
                                fontSize: '0.84rem',
                                color: 'var(--text-primary)',
                                fontWeight: 700,
                                outline: 'none'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                              {[
                                { label: 'Hari Ini', offset: 0 },
                                { label: 'Besok', offset: 1 },
                                { label: '+3 Hari', offset: 3 },
                                { label: '+7 Hari', offset: 7 },
                                { label: '+14 Hari', offset: 14 }
                              ].map(preset => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() => setQuickDatePreset(preset.offset)}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    background: 'var(--surface-interactive)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-xs)',
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'var(--transition)'
                                  }}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Stagger Option jika Batch Mode */}
                          {isBatchSchedule && (
                            <div style={{
                              marginTop: '0.25rem',
                              padding: '0.5rem 0.75rem',
                              background: 'var(--surface)',
                              borderRadius: 'var(--radius-xs)',
                              border: '1px dashed var(--action-primary)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem'
                            }}>
                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                cursor: 'pointer'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={schedStaggerCalendar}
                                  onChange={(e) => setSchedStaggerCalendar(e.target.checked)}
                                  style={{ cursor: 'pointer' }}
                                />
                                ⚡ Auto-Stagger Kalender (+1 Hari per baris batch)
                              </label>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {schedStaggerCalendar
                                  ? `Tiap item batch (${batchItemCount} jadwal) akan disebar ke hari-hari berurutan mulai dari tanggal ${schedTargetDate}.`
                                  : `Semua item batch (${batchItemCount} jadwal) akan dieksekusi serentak pada tanggal ${schedTargetDate}.`}
                              </span>
                            </div>
                          )}

                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            💡 <strong>Karakteristik Tanggal Spesifik:</strong> Pipeline hanya dieksekusi <strong>1 kali</strong> pada tanggal tersebut. Setelah selesai dikirim ke Repliz, status otomatis menjadi <strong>Selesai (Completed)</strong>.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 7. Multi-Platform Repliz Publishing Selector (Lengkap dengan Search, Filter Platform & Live Sync) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Target Multi-Platform Repliz (Pilih Akun Tujuan):
                    </label>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--action-primary)',
                      background: 'var(--surface-interactive)',
                      padding: '0.15rem 0.55rem',
                      borderRadius: 9999
                    }}>
                      {schedReplizAccountIds.length} Akun Terpilih
                    </span>
                  </div>

                  {/* Repliz Container Box */}
                  <div style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem'
                  }}>
                    {/* Toolbar: Live Search Box & Tombol Sync */}
                    <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>🔍</span>
                        <input
                          type="text"
                          value={replizSearchQuery}
                          onChange={(e) => setReplizSearchQuery(e.target.value)}
                          placeholder="Cari nama akun platform (misal: HabitFolk, Botani, NutriBake, dll)..."
                          style={{
                            width: '100%',
                            height: '38px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 12px 0 34px',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSyncReplizAccounts}
                        disabled={isSyncingRepliz}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 12px',
                          height: '38px',
                          color: 'var(--text-secondary)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: isSyncingRepliz ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span style={{ display: 'inline-block' }}>🔄</span>
                        <span>{isSyncingRepliz ? 'Menyinkronkan...' : 'Sinkronkan Ulang dari Repliz'}</span>
                      </button>
                    </div>

                    {/* Platform Filter Tabs */}
                    <div style={{
                      display: 'flex',
                      gap: '0.45rem',
                      marginBottom: '0.75rem',
                      overflowX: 'auto',
                      paddingBottom: '2px'
                    }}>
                      {platformTabs.map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setSelectedPlatformFilter(tab.key)}
                          style={{
                            background: selectedPlatformFilter === tab.key ? 'var(--surface-interactive)' : 'var(--surface)',
                            border: selectedPlatformFilter === tab.key ? '1px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                            color: selectedPlatformFilter === tab.key ? 'var(--action-primary)' : 'var(--text-secondary)',
                            borderRadius: 9999,
                            padding: '4px 12px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      ))}
                    </div>

                    {/* Scrollable Accounts Grid (Menampung 33+ Akun) */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                      gap: '0.65rem',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {filteredReplizAccounts.length > 0 ? (
                        filteredReplizAccounts.map(acc => {
                          const pInfo = getPlatformIcon(acc.platform);
                          const isChecked = schedReplizAccountIds.includes(acc.id);
                          const activeBrandObj = brands.find(b => b.id === schedBrandId);
                          const isBrandMatch = activeBrandObj && matchAccountsToBrand([acc], activeBrandObj.brand_name).length > 0;
                          return (
                            <div
                              key={acc.id}
                              onClick={() => toggleReplizAccountSelection(acc.id)}
                              style={{
                                background: isChecked ? 'var(--surface-interactive)' : 'var(--surface)',
                                border: isChecked ? '1.5px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '10px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                transition: 'var(--transition)'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: pInfo.color }}>
                                  <span>{pInfo.icon}</span>
                                  <span>{pInfo.label}</span>
                                  {isBrandMatch && (
                                    <span style={{
                                      fontSize: '0.62rem',
                                      color: 'var(--action-primary)',
                                      background: 'var(--surface-interactive)',
                                      border: '1px solid var(--action-primary)',
                                      padding: '0 4px',
                                      borderRadius: '4px',
                                      fontWeight: 800
                                    }}>
                                      Brand
                                    </span>
                                  )}
                                </div>
                                <div style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  border: isChecked ? '1.5px solid var(--action-primary)' : '1.5px solid var(--border-strong)',
                                  background: isChecked ? 'var(--action-primary)' : 'transparent',
                                  color: isChecked ? 'var(--on-action-primary)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.68rem',
                                  fontWeight: 900
                                }}>
                                  ✓
                                </div>
                              </div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={acc.display_name}>
                                {acc.display_name}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: acc.status === 'disconnected' ? 'var(--status-danger)' : 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: acc.status === 'disconnected' ? 'var(--status-danger)' : 'var(--status-success)' }}></span>
                                <span>{acc.status === 'disconnected' ? 'Terputus' : 'Terhubung di Repliz'}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                          {replizSearchQuery ? `Tidak ada akun yang cocok dengan "${replizSearchQuery}"` : 'Belum ada akun Repliz terhubung.'}
                        </div>
                      )}
                    </div>

                    {/* Quick Action Footer */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '0.75rem',
                      paddingTop: '0.65rem',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.74rem'
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Daftar akun yang menerima video serempak
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const bObj = brands.find(b => b.id === schedBrandId);
                            const matched = matchAccountsToBrand(replizAccounts, bObj?.brand_name);
                            setSchedReplizAccountIds(matched.map(a => a.id));
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--action-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}
                        >
                          🎯 Pilih Akun Brand Ini
                        </button>
                        <span style={{ color: 'var(--border-strong)' }}>|</span>
                        <button
                          type="button"
                          onClick={handleSelectAllVisible}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.74rem' }}
                        >
                          Pilih Semua Hasil
                        </button>
                        <span style={{ color: 'var(--border-strong)' }}>|</span>
                        <button
                          type="button"
                          onClick={handleClearSelections}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.74rem' }}
                        >
                          Hapus Semua Pilihan
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 8. Auto-Publish Toggle Checkbox */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: 'var(--surface-raised)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <input
                    type="checkbox"
                    id="autoPublishCheck"
                    checked={schedAutoPublish}
                    onChange={(e) => setSchedAutoPublish(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--action-primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="autoPublishCheck" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Otomatis teruskan video ke Repliz setelah selesai di-render oleh FFmpeg
                  </label>
                </div>

                {/* 🍳 Toggle Kontrol Ekstraksi Resep Lengkap untuk Multiplier (dan Recipe Campaign) */}
                {(schedCampaignType === 'multiplier_campaign' || schedCampaignType === 'recipe_campaign') && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    background: 'var(--surface-raised)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--status-purple)',
                    marginTop: '0.5rem'
                  }}>
                    <input
                      type="checkbox"
                      id="schedRecipeCheck"
                      checked={schedGenerateRecipe}
                      onChange={(e) => setSchedGenerateRecipe(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--status-purple)', cursor: 'pointer', marginTop: '2px' }}
                    />
                    <div>
                      <label htmlFor="schedRecipeCheck" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', display: 'block' }}>
                        🍳 Hasilkan Resep / Racikan Lengkap di Caption (Bahan, Takaran & Langkah)
                      </label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                        Saat aktif, AI wajib menyusun teks resep terperinci (bahan, takaran presisi, langkah pembuatan, khasiat sehat) yang sinkron dengan video referensi dekonstruksi.
                      </span>
                    </div>
                  </div>
                )}

                {/* 🛒 Toggle Kontrol Post Link Affiliate Shopee & Link di Bio */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  background: 'var(--surface-raised)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  marginTop: '0.5rem'
                }}>
                  <input
                    type="checkbox"
                    id="postAffiliateCheck"
                    checked={schedPostAffiliateLink}
                    onChange={(e) => setSchedPostAffiliateLink(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--action-primary)', cursor: 'pointer', marginTop: '2px' }}
                  />
                  <div>
                    <label htmlFor="postAffiliateCheck" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', display: 'block' }}>
                      🛒 Sertakan Rekomendasi Produk & Affiliate (Shopee FB & Link di Bio)
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                      Secara cerdas menyisipkan link Shopee aktif ke Facebook dan mengarahkan ke Link di Bio untuk Instagram, TikTok, Shorts & Threads. Uncheck untuk jadwal konten murni edukasi tanpa jualan.
                    </span>
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.65rem',
                  marginTop: '0.75rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid var(--border-subtle)'
                }}>
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.6rem 1.15rem',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={savingSchedule}
                    style={{
                      background: 'var(--action-primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.6rem 1.45rem',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--on-action-primary)',
                      cursor: savingSchedule ? 'not-allowed' : 'pointer',
                      opacity: savingSchedule ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem'
                    }}
                  >
                    <span>💾</span>
                    <span>{savingSchedule ? 'Menyimpan...' : (editingSchedule ? 'Simpan Perubahan' : 'Buat Jadwal')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Persistent FIFO Queue Monitoring Drawer */}
        <AutoPipelineQueueDrawer 
          isOpen={isQueueDrawerOpen} 
          onClose={() => setIsQueueDrawerOpen(false)}
          queueSummary={queueSummary}
          onQueueUpdated={setQueueSummary}
        />

        </div>
      </main>
    </div>
  );
}

