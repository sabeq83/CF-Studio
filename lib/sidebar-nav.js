export const menuKeyMap = {
  '/auto-pipeline': 'auto_pipeline',
  '/threads-labs': 'threads_labs',
  '/content-flow': 'content_flow',
  '/re-campaigns': 're_campaign',
  '/pillar-campaigns': 'pillar_campaign',
  '/content-planner': 'content_planner',
  '/product-radar': 'product_research',
  '/products': 'product_database',
  '/recipe-library': 'product_database',
  '/deconstruct': 'deconstruct_lab',
  '/multiplier-lab': 'multiplier_lab',
  '/recipe-labs': 'recipe_labs',
  '/recipe-exporter': 'recipe_labs',
  '/product-bridge-inject': 'product_bridging',
  '/video-studio': 'ffmpeg_studio',
  '/tts-studio': 'tts_studio',
  '/settings/brand-profiles': 'brand_profiles',
  '/settings/presets': 'operator_presets',
  '/settings/visual-identities': 'operator_presets',
  '/settings/universes': 'universe_manager',
  '/settings/users': 'admin_only',
  '/settings/tenants': 'superadmin_only',
  '/settings': 'system_settings'
};

export const PLANNING_SECTION_HREFS = [
  '/content-planner',
  '/product-radar',
  '/products',
  '/recipe-library',
  '/deconstruct',
  '/settings/presets',
  '/settings/visual-identities',
  '/settings/universes',
  '/settings/brand-profiles'
];

export const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '◈' },

  { section: 'PLANNING' },
  { label: 'Content Planner', href: '/content-planner', icon: '🗓️' },
  { label: 'Radar Produk', href: '/product-radar', icon: '📡' },
  { label: 'Product Database', href: '/products', icon: '📦' },
  { label: 'Recipe Library', href: '/recipe-library', icon: '🍲' },
  { label: 'Deconstruct Lab', href: '/deconstruct', icon: '🔬' },
  { label: 'Preset Manager', href: '/settings/presets', icon: '🎛️' },
  { label: 'Visual Identity', href: '/settings/visual-identities', icon: '🎨' },
  { label: 'Universe Manager', href: '/settings/universes', icon: '🏰' },
  { label: 'Brand Profile Manager', href: '/settings/brand-profiles', icon: '🧬' },

  { section: 'WORKFLOW' },
  { label: 'Auto Pipeline', href: '/auto-pipeline', icon: '⚡' },
  { label: 'Threads Labs', href: '/threads-labs', icon: '🧵' },
  { label: 'RE Campaign', href: '/re-campaigns', icon: '🎬' },
  { label: 'Pillar Campaign', href: '/pillar-campaigns', icon: '🌱' },
  { label: 'Recipe Labs', href: '/recipe-labs', icon: '🍳' },
  { label: 'Multiplier Labs', href: '/multiplier-lab', icon: '🎛️' },
  { label: 'Product Bridging', href: '/product-bridge-inject', icon: '🎯' },

  { section: 'PUBLISHING' },
  { label: 'ContentFlow Hub', href: '/content-flow', icon: '📊' },
  { label: 'Recipe Exporter', href: '/recipe-exporter', icon: '📱' },

  { section: 'TOOLS' },
  { label: 'Video Studio', href: '/video-studio', icon: '🎞' },
  { label: 'TTS Studio', href: '/tts-studio', icon: '🎙' },

  { section: 'SYSTEM' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
  { label: 'User Management', href: '/settings/users', icon: '👥', adminOnly: true },
  { label: 'Tenant Management', href: '/settings/tenants', icon: '🏢', superadminOnly: true },
];
