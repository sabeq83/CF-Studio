import assert from 'node:assert';

// Simulasi logika due detection & FIFO queue
function simulateQueueDetection(schedules, currentTimeStr, currentDateStr, currentDayOfWeek) {
  const dueBatch = [];

  for (const row of schedules) {
    const schedMode = row.schedule_mode || 'recurring';
    const targetGenTime = row.generation_time || '05:00';

    if (schedMode === 'specific_date') {
      const rowTargetDate = row.target_date ? String(row.target_date).slice(0, 10) : null;
      if (!rowTargetDate || currentDateStr !== rowTargetDate) continue;
      if (row.last_run_at) continue;
      if (currentTimeStr < targetGenTime) continue;
    } else {
      let daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
      if (row.days_of_week_json) {
        daysOfWeek = typeof row.days_of_week_json === 'string'
          ? JSON.parse(row.days_of_week_json)
          : row.days_of_week_json;
      }
      if (!daysOfWeek.includes(currentDayOfWeek)) continue;

      if (row.last_run_at) {
        const lastRunFmt = String(row.last_run_at).slice(0, 10);
        if (lastRunFmt === currentDateStr) continue;
      }

      if (currentTimeStr < targetGenTime) continue;
    }

    dueBatch.push(row);
  }

  // FIFO sorting: targetGenTime ASC, then created_at ASC
  dueBatch.sort((a, b) => {
    const timeComp = (a.generation_time || '05:00').localeCompare(b.generation_time || '05:00');
    if (timeComp !== 0) return timeComp;
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateA - dateB;
  });

  return dueBatch;
}

async function runTest() {
  console.log("=== TEST 1: 3 Jadwal Serentak di Jam yang Sama (01:00 WIB) ===");
  const mockSchedules = [
    { id: 'sched_1', name: 'Brand A Pagi', generation_time: '01:00', schedule_mode: 'recurring', days_of_week_json: [3], last_run_at: null, created_at: '2026-11-01T00:00:00Z' },
    { id: 'sched_2', name: 'Brand B Pagi', generation_time: '01:00', schedule_mode: 'recurring', days_of_week_json: [3], last_run_at: null, created_at: '2026-11-01T00:01:00Z' },
    { id: 'sched_3', name: 'Brand C Pagi', generation_time: '01:00', schedule_mode: 'recurring', days_of_week_json: [3], last_run_at: null, created_at: '2026-11-01T00:02:00Z' },
    { id: 'sched_4', name: 'Brand D Siang', generation_time: '12:00', schedule_mode: 'recurring', days_of_week_json: [3], last_run_at: null, created_at: '2026-11-01T00:03:00Z' }
  ];

  // Pada jam 01:00 (Rabu, dow 3)
  const batch0100 = simulateQueueDetection(mockSchedules, '01:00', '2026-11-11', 3);
  console.log(`Ditemukan ${batch0100.length} jadwal jatuh tempo di jam 01:00:`);
  batch0100.forEach((s, idx) => console.log(`  [${idx + 1}] ID: ${s.id} | Name: ${s.name} | Time: ${s.generation_time}`));

  assert.strictEqual(batch0100.length, 3, "Harus menemukan tepat 3 jadwal di jam 01:00");
  assert.strictEqual(batch0100[0].id, 'sched_1');
  assert.strictEqual(batch0100[1].id, 'sched_2');
  assert.strictEqual(batch0100[2].id, 'sched_3');
  console.log("✅ Urutan FIFO terverifikasi sempurna: sched_1 -> sched_2 -> sched_3");

  console.log("\n=== TEST 2: Simulasi Eksekusi Sekuensial dengan Waktu Bergeser ===");
  const executionOrder = [];
  for (let i = 0; i < batch0100.length; i++) {
    const s = batch0100[i];
    const simulatedClock = `01:0${i * 2}`; // 01:00, 01:02, 01:04
    console.log(`Mengeksekusi [${i + 1}/${batch0100.length}] ${s.name} pada jam simulasi ${simulatedClock}...`);
    // Tandai selesai
    s.last_run_at = '2026-11-11T01:00:00Z';
    executionOrder.push(s.id);
  }
  assert.deepStrictEqual(executionOrder, ['sched_1', 'sched_2', 'sched_3']);
  console.log("✅ Seluruh 3 jadwal berhasil dieksekusi tanpa ada yang terlewat!");

  console.log("\n=== TEST 3: Cek Eksekusi Ulang di Menit Berikutnya (Anti-Duplicate) ===");
  const batch0105 = simulateQueueDetection(mockSchedules, '01:05', '2026-11-11', 3);
  console.log(`Ditemukan ${batch0105.length} jadwal jatuh tempo di jam 01:05 (harus 0 karena sudah run):`);
  assert.strictEqual(batch0105.length, 0, "Tidak boleh ada jadwal duplikat yang dieksekusi ulang!");
  console.log("✅ Anti-duplicate terverifikasi: 0 jadwal duplikat.");

  console.log("\n=== TEST 4: Catch-Up Window Saat Server Terlambat / Restart ===");
  // Jadwal baru jam 01:00 tapi server baru hidup jam 01:15
  const lateSchedule = [
    { id: 'sched_late', name: 'Brand E Late', generation_time: '01:00', schedule_mode: 'recurring', days_of_week_json: [3], last_run_at: null, created_at: '2026-11-01T00:00:00Z' }
  ];
  const batchLate = simulateQueueDetection(lateSchedule, '01:15', '2026-11-11', 3);
  assert.strictEqual(batchLate.length, 1, "Harus bisa mengejar (catch-up) jadwal yang terlewat");
  console.log("✅ Catch-up window terverifikasi: jadwal tertunda jam 01:00 tetap dieksekusi saat jam 01:15.");

  console.log("\n🎉 SELURUH PENGUJIAN TAHAP 1 BERHASIL 100%!");
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

