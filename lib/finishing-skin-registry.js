/**
 * Finishing Skin Registry: Single Source of Truth untuk 6 Skin General Finishing.
 * Pure JS (no Node fs/DB imports) agar dapat dibagikan ke UI, MCP, Server, dan Worker.
 *
 * Menerapkan prinsip Finishing Satu Fokus:
 * - Template mendefinisikan tata letak (layout)
 * - Skin mendefinisikan gaya visual (warna, font, radius, stroke, casing)
 */

export const DEFAULT_FINISHING_SKIN = 'pop_kuning';

export const FINISHING_SKIN_REGISTRY = [
  {
    id: 'pop_kuning',
    label: 'Pop Kuning (Default)',
    description: 'Aksen kuning kontras, tipografi tebal Impact & stroke tegas.',
    tokens: {
      '--fx-accent': '#ffcc3d',
      '--fx-accent-ink': '#111111',
      '--fx-card': 'rgba(20, 12, 8, 0.82)',
      '--fx-card-ink': '#ffffff',
      '--fx-card-muted': 'rgba(255, 255, 255, 0.72)',
      '--fx-chip': '#fff8ee',
      '--fx-chip-ink': '#2a1a10',
      '--fx-stroke': '#000000',
      '--fx-stroke-width': '0.55cqw',
      '--fx-shadow': '0 0.8cqw 2cqw rgba(0, 0, 0, 0.5)',
      '--fx-text-case': 'uppercase',
      '--fx-radius': '99cqw',
      '--fx-font-display': '"Anton", Impact, sans-serif',
      '--fx-font-body': '"Montserrat", "Arial Black", sans-serif',
      '--fx-font-ui': '"Inter", system-ui, sans-serif',
      '--fx-size-sub': '6.2cqw',
      '--fx-phase-problem': '#e5484d',
      '--fx-phase-cause': '#f2850d',
      '--fx-phase-solution': '#1f9d55',
      '--fx-phase-result': '#2f7fe0'
    },
    fonts: ['Anton-Regular.ttf', 'Montserrat-ExtraBold.ttf', 'Montserrat-Black.ttf', 'Inter-Bold.ttf']
  },
  {
    id: 'bersih_putih',
    label: 'Bersih Putih',
    description: 'Kartu putih semi-transparan, teks gelap kontras, tanpa stroke, DM Sans.',
    tokens: {
      '--fx-accent': '#2563eb',
      '--fx-accent-ink': '#ffffff',
      '--fx-card': 'rgba(255, 255, 255, 0.94)',
      '--fx-card-ink': '#111827',
      '--fx-card-muted': 'rgba(17, 24, 39, 0.65)',
      '--fx-chip': '#f3f4f6',
      '--fx-chip-ink': '#111827',
      '--fx-stroke': 'transparent',
      '--fx-stroke-width': '0',
      '--fx-shadow': '0 0.6cqw 1.8cqw rgba(0, 0, 0, 0.15)',
      '--fx-text-case': 'none',
      '--fx-radius': '2.2cqw',
      '--fx-font-display': '"DM Sans", system-ui, sans-serif',
      '--fx-font-body': '"DM Sans", system-ui, sans-serif',
      '--fx-font-ui': '"DM Sans", system-ui, sans-serif',
      '--fx-size-sub': '5.6cqw',
      '--fx-phase-problem': '#dc2626',
      '--fx-phase-cause': '#d97706',
      '--fx-phase-solution': '#059669',
      '--fx-phase-result': '#2563eb'
    },
    fonts: ['DMSans-Regular.ttf', 'Inter-Bold.ttf']
  },
  {
    id: 'hangat_earthy',
    label: 'Hangat Earthy',
    description: 'Warna krem, terakota & zaitun, nuansa hangat natural.',
    tokens: {
      '--fx-accent': '#c25e34',
      '--fx-accent-ink': '#ffffff',
      '--fx-card': 'rgba(45, 36, 28, 0.88)',
      '--fx-card-ink': '#fbf7ee',
      '--fx-card-muted': 'rgba(251, 247, 238, 0.72)',
      '--fx-chip': '#eeddc7',
      '--fx-chip-ink': '#38271a',
      '--fx-stroke': '#20150e',
      '--fx-stroke-width': '0.35cqw',
      '--fx-shadow': '0 0.8cqw 2cqw rgba(32, 21, 14, 0.4)',
      '--fx-text-case': 'none',
      '--fx-radius': '3.2cqw',
      '--fx-font-display': '"Montserrat", sans-serif',
      '--fx-font-body': '"Montserrat", sans-serif',
      '--fx-font-ui': '"Inter", sans-serif',
      '--fx-size-sub': '5.8cqw',
      '--fx-phase-problem': '#b91c1c',
      '--fx-phase-cause': '#c25e34',
      '--fx-phase-solution': '#4d7c0f',
      '--fx-phase-result': '#1e40af'
    },
    fonts: ['Montserrat-ExtraBold.ttf', 'Montserrat-Black.ttf', 'Inter-Bold.ttf']
  },
  {
    id: 'gelap_tegas',
    label: 'Gelap Tegas',
    description: 'Latar gelap pekat, aksen cyan/neon, tipografi tebal modern.',
    tokens: {
      '--fx-accent': '#06b6d4',
      '--fx-accent-ink': '#000000',
      '--fx-card': 'rgba(10, 15, 24, 0.92)',
      '--fx-card-ink': '#f8fafc',
      '--fx-card-muted': 'rgba(248, 250, 252, 0.65)',
      '--fx-chip': '#1e293b',
      '--fx-chip-ink': '#f8fafc',
      '--fx-stroke': '#000000',
      '--fx-stroke-width': '0.45cqw',
      '--fx-shadow': '0 1cqw 2.5cqw rgba(0, 0, 0, 0.6)',
      '--fx-text-case': 'uppercase',
      '--fx-radius': '1.6cqw',
      '--fx-font-display': '"Anton", Impact, sans-serif',
      '--fx-font-body': '"Inter", system-ui, sans-serif',
      '--fx-font-ui': '"Inter", system-ui, sans-serif',
      '--fx-size-sub': '6.0cqw',
      '--fx-phase-problem': '#f43f5e',
      '--fx-phase-cause': '#f59e0b',
      '--fx-phase-solution': '#10b981',
      '--fx-phase-result': '#06b6d4'
    },
    fonts: ['Anton-Regular.ttf', 'Inter-Bold.ttf']
  },
  {
    id: 'pastel_lembut',
    label: 'Pastel Lembut',
    description: 'Nuansa pink/pastel manis, sudut membulat lebar, ramah & elegan.',
    tokens: {
      '--fx-accent': '#ec4899',
      '--fx-accent-ink': '#ffffff',
      '--fx-card': 'rgba(255, 255, 255, 0.94)',
      '--fx-card-ink': '#334155',
      '--fx-card-muted': 'rgba(51, 65, 85, 0.70)',
      '--fx-chip': '#fce7f3',
      '--fx-chip-ink': '#831843',
      '--fx-stroke': 'transparent',
      '--fx-stroke-width': '0',
      '--fx-shadow': '0 0.8cqw 2cqw rgba(236, 72, 153, 0.18)',
      '--fx-text-case': 'none',
      '--fx-radius': '4.5cqw',
      '--fx-font-display': '"Montserrat", sans-serif',
      '--fx-font-body': '"DM Sans", system-ui, sans-serif',
      '--fx-font-ui': '"Inter", system-ui, sans-serif',
      '--fx-size-sub': '5.6cqw',
      '--fx-phase-problem': '#e11d48',
      '--fx-phase-cause': '#ea580c',
      '--fx-phase-solution': '#16a34a',
      '--fx-phase-result': '#0284c7'
    },
    fonts: ['DMSans-Regular.ttf', 'Montserrat-ExtraBold.ttf', 'Inter-Bold.ttf']
  },
  {
    id: 'editorial_serif',
    label: 'Editorial Serif',
    description: 'Header Playfair Display berwibawa, kartu gading bersih, gaya majalah.',
    tokens: {
      '--fx-accent': '#b45309',
      '--fx-accent-ink': '#ffffff',
      '--fx-card': 'rgba(254, 252, 246, 0.95)',
      '--fx-card-ink': '#1c1917',
      '--fx-card-muted': 'rgba(28, 25, 23, 0.65)',
      '--fx-chip': '#f5efe6',
      '--fx-chip-ink': '#292524',
      '--fx-stroke': 'transparent',
      '--fx-stroke-width': '0',
      '--fx-shadow': '0 0.6cqw 1.8cqw rgba(0, 0, 0, 0.18)',
      '--fx-text-case': 'none',
      '--fx-radius': '1.2cqw',
      '--fx-font-display': '"Playfair Display", Georgia, serif',
      '--fx-font-body': '"DM Sans", system-ui, sans-serif',
      '--fx-font-ui': '"Inter", system-ui, sans-serif',
      '--fx-size-sub': '5.6cqw',
      '--fx-phase-problem': '#991b1b',
      '--fx-phase-cause': '#b45309',
      '--fx-phase-solution': '#166534',
      '--fx-phase-result': '#1e40af'
    },
    fonts: ['PlayfairDisplay-Regular.ttf', 'DMSans-Regular.ttf', 'Inter-Bold.ttf']
  }
];

export const FINISHING_SKIN_IDS = FINISHING_SKIN_REGISTRY.map((s) => s.id);

/**
 * Resolves a skin configuration by id, falling back to 'pop_kuning' if not recognized.
 * @param {string} skinId
 * @returns {Object} Deep clone of resolved skin object
 */
export function resolveFinishingSkin(skinId) {
  const targetId = String(skinId || '').trim().toLowerCase();
  const found = FINISHING_SKIN_REGISTRY.find((s) => s.id === targetId)
    || FINISHING_SKIN_REGISTRY.find((s) => s.id === DEFAULT_FINISHING_SKIN);
  return {
    id: found.id,
    label: found.label,
    description: found.description,
    tokens: { ...found.tokens },
    fonts: [...found.fonts]
  };
}

/**
 * Helper to get CSS snippet or token map for embedding.
 */
export function getSkinCssVariables(skinId, overrides = {}) {
  const skin = resolveFinishingSkin(skinId);
  const merged = { ...skin.tokens, ...(overrides || {}) };
  return Object.entries(merged)
    .map(([prop, val]) => `${prop}: ${val};`)
    .join('\n');
}
