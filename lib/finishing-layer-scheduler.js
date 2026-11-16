/**
 * Finishing Layer Scheduler: Menerapkan Prinsip "Satu Fokus" (R1 - R6).
 *
 * Mengatur slot waktu setiap elemen visual agar tidak terjadi penumpukan teks.
 * Aturan utama:
 * - R1: Maksimal 2 blok teks aktif bersamaan (1 kartu di Zona Atas ATAU Tengah + 1 subtitle).
 * - R2: Prioritas hierarki lapisan:
 *   hook > punch > endCard > product > save > cta > chapter > step > tip > timing > ingredients > callout
 * - R3: Ketika hook/punch/endCard aktif, kartu Zona Atas disembunyikan.
 * - R4: Kartu Zona Atas tampil minimal 1.2 detik, dengan jeda antar kartu minimal 0.25 detik.
 * - R5: Durasi kartu maksimal 3.5 detik (kecuali step yang mengikuti klip).
 * - R6: Subtitle otomatis beralih ke mode kompak (maks 4 kata) ketika kartu Zona Atas aktif.
 */

export const LAYER_PRIORITY = [
  'hook',
  'punch',
  'endCard',
  'product',
  'save',
  'cta',
  'chapter',
  'compare',
  'mythFact',
  'numbers',
  'chips',
  'step',
  'tip',
  'timing',
  'ingredients',
  'callout'
];

export const ZONE_OF = {
  hook: 'mid',
  punch: 'mid',
  endCard: 'full',
  product: 'top',
  save: 'top',
  cta: 'top',
  chapter: 'top',
  compare: 'top',
  mythFact: 'top',
  numbers: 'top',
  chips: 'top',
  step: 'top',
  tip: 'top',
  timing: 'top',
  ingredients: 'top',
  callout: 'top'
};

const PRIORITY_MAP = new Map(LAYER_PRIORITY.map((layer, idx) => [layer, idx]));

function getPriorityIndex(layer) {
  return PRIORITY_MAP.has(layer) ? PRIORITY_MAP.get(layer) : 999;
}

/**
 * Mengumpulkan semua kandidat lapisan dari timeline menjadi array event berwaktu.
 */
export function collectCandidatesFromTimeline(timeline = {}) {
  const candidates = [];
  const hookDuration = Number(timeline?.config?.hookDuration || 1.75);

  // 1. Hook Card (mid)
  if (timeline.hookCard && (timeline.hookCard.l1 || timeline.hookCard.text)) {
    candidates.push({
      layer: 'hook',
      zone: 'mid',
      s: 0,
      e: hookDuration,
      ref: timeline.hookCard
    });
  }

  // 2. Punches (mid)
  if (Array.isArray(timeline.punches)) {
    for (const p of timeline.punches) {
      if (p && Number.isFinite(p.s) && Number.isFinite(p.e)) {
        candidates.push({
          layer: 'punch',
          zone: 'mid',
          s: Number(p.s),
          e: Number(p.e),
          ref: p
        });
      }
    }
  }

  // 3. End Card (full)
  if (timeline.endCard) {
    const s = Number(timeline.endCard.s);
    const e = Number(timeline.endCard.e);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
      candidates.push({
        layer: 'endCard',
        zone: 'full',
        s,
        e,
        ref: timeline.endCard
      });
    }
  }

  // 4. Product Card (top)
  if (timeline.productCard && timeline.productCard.name) {
    const s = Number(timeline.productCard.s);
    const e = Number(timeline.productCard.e);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
      candidates.push({
        layer: 'product',
        zone: 'top',
        s,
        e,
        ref: timeline.productCard
      });
    }
  }

  // 5. Save Prompt (top)
  if (timeline.savePrompt && (timeline.savePrompt.titleText || timeline.savePrompt.text)) {
    const s = Number(timeline.savePrompt.s);
    const e = Number(timeline.savePrompt.e);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
      candidates.push({
        layer: 'save',
        zone: 'top',
        s,
        e,
        ref: timeline.savePrompt
      });
    }
  }

  // 6. CTA (top)
  if (timeline.cta && timeline.cta.text) {
    const s = Number(timeline.cta.s);
    const e = Number(timeline.cta.e);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
      candidates.push({
        layer: 'cta',
        zone: 'top',
        s,
        e,
        ref: timeline.cta
      });
    }
  }

  // 7. Chapters / Babak (top)
  if (Array.isArray(timeline.chapters)) {
    for (const ch of timeline.chapters) {
      if (ch && Number.isFinite(ch.s) && Number.isFinite(ch.e) && ch.e > ch.s) {
        candidates.push({
          layer: 'chapter',
          zone: 'top',
          s: Number(ch.s),
          e: Number(ch.e),
          ref: ch
        });
      }
    }
  }

  // 7b. Comparison Split Card (top)
  if (Array.isArray(timeline.compare)) {
    for (const cmp of timeline.compare) {
      if (cmp && Number.isFinite(cmp.s) && Number.isFinite(cmp.e) && cmp.e > cmp.s) {
        candidates.push({
          layer: 'compare',
          zone: 'top',
          s: Number(cmp.s),
          e: Number(cmp.e),
          ref: cmp
        });
      }
    }
  }

  // 7c. Myth/Fact Stamp Card (top)
  if (Array.isArray(timeline.mythFact)) {
    for (const mf of timeline.mythFact) {
      if (mf && Number.isFinite(mf.s) && Number.isFinite(mf.e) && mf.e > mf.s) {
        candidates.push({
          layer: 'mythFact',
          zone: 'top',
          s: Number(mf.s),
          e: Number(mf.e),
          ref: mf
        });
      }
    }
  }

  // 7d. Real-Number Counter (top)
  if (Array.isArray(timeline.numbers)) {
    for (const num of timeline.numbers) {
      if (num && Number.isFinite(num.s) && Number.isFinite(num.e) && num.e > num.s) {
        candidates.push({
          layer: 'numbers',
          zone: 'top',
          s: Number(num.s),
          e: Number(num.e),
          ref: num
        });
      }
    }
  }

  // 7e. Sequential Material/Cost Chips (top)
  if (Array.isArray(timeline.chips)) {
    for (const cp of timeline.chips) {
      if (cp && Number.isFinite(cp.s) && Number.isFinite(cp.e) && cp.e > cp.s) {
        candidates.push({
          layer: 'chips',
          zone: 'top',
          s: Number(cp.s),
          e: Number(cp.e),
          ref: cp
        });
      }
    }
  }

  // 8. Recipe Steps (top)
  if (Array.isArray(timeline.recipe?.steps)) {
    for (const st of timeline.recipe.steps) {
      if (st && Number.isFinite(st.s) && Number.isFinite(st.e) && st.e > st.s) {
        candidates.push({
          layer: 'step',
          zone: 'top',
          s: Number(st.s),
          e: Number(st.e),
          ref: st
        });
      }
    }
  }

  // 9. Tips (top)
  if (Array.isArray(timeline.tips)) {
    for (const tp of timeline.tips) {
      if (tp && Number.isFinite(tp.s) && Number.isFinite(tp.e) && tp.e > tp.s) {
        candidates.push({
          layer: 'tip',
          zone: 'top',
          s: Number(tp.s),
          e: Number(tp.e),
          ref: tp
        });
      }
    }
  }

  // 10. Timing Badges (top)
  if (Array.isArray(timeline.timingBadges)) {
    for (const tb of timeline.timingBadges) {
      if (tb && Number.isFinite(tb.s) && Number.isFinite(tb.e) && tb.e > tb.s) {
        candidates.push({
          layer: 'timing',
          zone: 'top',
          s: Number(tb.s),
          e: Number(tb.e),
          ref: tb
        });
      }
    }
  }

  // 11. Ingredients Phase (top)
  const ing = timeline.recipe?.ingredients;
  if (ing && Array.isArray(ing.items) && ing.items.length > 0) {
    const s = Number(ing.s ?? ing.items[0]?.s ?? 0);
    const e = Number(ing.until ?? ing.items[ing.items.length - 1]?.e ?? s + 3.5);
    if (e > s) {
      candidates.push({
        layer: 'ingredients',
        zone: 'top',
        s,
        e,
        ref: ing
      });
    }
  }

  // 12. Callouts (top)
  if (Array.isArray(timeline.callouts)) {
    for (const cl of timeline.callouts) {
      if (cl && Number.isFinite(cl.s) && Number.isFinite(cl.e) && cl.e > cl.s) {
        candidates.push({
          layer: 'callout',
          zone: 'top',
          s: Number(cl.s),
          e: Number(cl.e),
          ref: cl
        });
      }
    }
  }

  return candidates;
}

/**
 * Menjadwalkan lapisan overlay sesuai aturan Satu Fokus (R1 - R6).
 *
 * @param {Object} timeline - Timeline preview/render
 * @param {Object} options - Pengaturan timing
 * @param {number} [options.minDwell=1.2] - Durasi minimal kartu (detik)
 * @param {number} [options.gap=0.25] - Jeda antar kartu Zona Atas (detik)
 * @param {number} [options.maxCard=3.5] - Durasi maksimal kartu non-step (detik)
 * @returns {Object} timeline yang telah dilengkapi `slots` dan `subtitleCompact`
 */
export function scheduleOverlayLayers(timeline, { minDwell = 1.2, gap = 0.25, maxCard = 3.5 } = {}) {
  if (!timeline || typeof timeline !== 'object') return timeline;

  const rawCandidates = collectCandidatesFromTimeline(timeline);
  if (rawCandidates.length === 0) {
    timeline.slots = [];
    timeline.subtitleCompact = [];
    return timeline;
  }

  // Pisahkan kandidat mid/full (hook, punch, endCard) dari top
  const dominantBlocks = rawCandidates
    .filter((c) => c.zone === 'mid' || c.zone === 'full')
    .sort((a, b) => a.s - b.s);

  const topCandidates = rawCandidates
    .filter((c) => c.zone === 'top')
    .map((c) => {
      let dur = c.e - c.s;
      // Step cards may follow clip duration; others capped at maxCard
      if (c.layer !== 'step' && dur > maxCard) {
        return { ...c, e: Number((c.s + maxCard).toFixed(3)) };
      }
      return { ...c };
    });

  // Potong top candidates agar tidak bertabrakan dengan dominant blocks (R3)
  const clippedTopCandidates = [];
  for (const tc of topCandidates) {
    let s = tc.s;
    let e = tc.e;

    for (const dom of dominantBlocks) {
      if (s < dom.e && e > dom.s) {
        if (dom.s <= s && dom.e >= e) {
          // Tertelan penuh oleh dominant block
          s = e;
          break;
        } else if (dom.s <= s && dom.e > s) {
          // Menutupi bagian awal
          s = dom.e + 0.05;
        } else if (dom.s < e && dom.e >= e) {
          // Menutupi bagian akhir
          e = dom.s - 0.05;
        } else if (dom.s > s && dom.e < e) {
          // Dominant berada di tengah rentang kartu
          if (dom.s - s >= minDwell) {
            e = dom.s - 0.05;
          } else if (e - dom.e >= minDwell) {
            s = dom.e + 0.05;
          } else {
            s = e;
            break;
          }
        }
      }
    }

    if (e - s >= minDwell) {
      clippedTopCandidates.push({
        ...tc,
        s: Number(s.toFixed(3)),
        e: Number(e.toFixed(3))
      });
    }
  }

  // Urutkan kandidat top berdasarkan s, lalu prioritas
  clippedTopCandidates.sort((a, b) => {
    if (Math.abs(a.s - b.s) > 0.05) return a.s - b.s;
    return getPriorityIndex(a.layer) - getPriorityIndex(b.layer);
  });

  // Resolusi tabrakan antar kartu di Zona Atas (hanya boleh 1 kartu pada waktu yang sama + jeda gap)
  const resolvedTopSlots = [];
  for (const cand of clippedTopCandidates) {
    if (resolvedTopSlots.length === 0) {
      resolvedTopSlots.push(cand);
      continue;
    }

    const last = resolvedTopSlots[resolvedTopSlots.length - 1];
    const requiredStart = last.e + gap;

    if (cand.s < requiredStart) {
      // Terjadi konflik waktu
      const lastPri = getPriorityIndex(last.layer);
      const candPri = getPriorityIndex(cand.layer);

      if (candPri < lastPri) {
        // Kartu baru memiliki prioritas lebih tinggi -> perpendek kartu sebelumnya
        const newLastEnd = Math.max(last.s + minDwell, cand.s - gap);
        if (newLastEnd - last.s >= minDwell) {
          last.e = Number(newLastEnd.toFixed(3));
          if (cand.s < last.e + gap) {
            cand.s = Number((last.e + gap).toFixed(3));
          }
          if (cand.e - cand.s >= minDwell) {
            resolvedTopSlots.push(cand);
          }
        } else {
          // Kartu sebelumnya digantikan penuh
          resolvedTopSlots.pop();
          resolvedTopSlots.push(cand);
        }
      } else {
        // Kartu sebelumnya memiliki prioritas lebih tinggi -> geser atau potong kartu baru
        const shiftedStart = Number(requiredStart.toFixed(3));
        if (cand.e - shiftedStart >= minDwell) {
          cand.s = shiftedStart;
          resolvedTopSlots.push(cand);
        }
        // Jika sisa durasi < minDwell, lewati
      }
    } else {
      resolvedTopSlots.push(cand);
    }
  }

  // Gabungkan semua slot (dominant + top)
  const allSlots = [...dominantBlocks, ...resolvedTopSlots].sort((a, b) => a.s - b.s);

  // Buat daftar jendela subtitleCompact (R6: saat ada kartu Zona Atas aktif)
  const compactWindows = resolvedTopSlots.map((sl) => ({
    s: sl.s,
    e: sl.e,
    layer: sl.layer
  }));

  timeline.slots = allSlots;
  timeline.subtitleCompact = compactWindows;

  return timeline;
}
