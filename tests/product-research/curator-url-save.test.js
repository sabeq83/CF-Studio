import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCuratorUrlSave } from '../../app/product-radar/radar-labels.js';

const OFFICIAL = 'https://www.tokopedia.com/ecentioindonesia/premium-ecentio-tumbler-900ml-1732140420632053394';
const OTHER = 'https://www.tokopedia.com/ecentioindonesia/premium-ecentio-tumbler-900ml-1733269059183478418';

describe('resolveCuratorUrlSave — tombol Simpan & Tandai Terverifikasi', () => {
  it('kolom kosong + URL riset Resmi → verifikasi URL riset (kasus bug Staging)', () => {
    const plan = resolveCuratorUrlSave('', { url_status: 'official', source_url: OFFICIAL, curated_data: {} });
    assert.equal(plan.mode, 'research');
    assert.equal(plan.url, OFFICIAL);
  });

  it('kolom kosong + URL riset Listing → verifikasi URL riset', () => {
    const plan = resolveCuratorUrlSave('   ', { url_status: 'listing', source_url: OFFICIAL, curated_data: null });
    assert.equal(plan.mode, 'research');
  });

  it('kolom berisi URL lain → simpan URL ketikan dan tandai belum disimpan', () => {
    const plan = resolveCuratorUrlSave(` ${OTHER} `, { url_status: 'official', source_url: OFFICIAL, curated_data: {} });
    assert.equal(plan.mode, 'typed');
    assert.equal(plan.url, OTHER);
    assert.equal(plan.dirty, true);
  });

  it('kolom sama dengan URL kurator tersimpan → tidak dianggap perubahan', () => {
    const plan = resolveCuratorUrlSave(OTHER, { url_status: 'user', source_url: OFFICIAL, curated_data: { target_url: OTHER } });
    assert.equal(plan.mode, 'saved');
    assert.equal(plan.dirty, false);
  });

  it('URL riset hanya hasil pencarian (Terdekat) → tidak boleh diverifikasi otomatis', () => {
    const plan = resolveCuratorUrlSave('', { url_status: 'nearest', source_url: 'https://www.tokopedia.com/find/tumbler-ecentio', curated_data: {} });
    assert.equal(plan.mode, 'none');
    assert.equal(plan.url, '');
    assert.match(plan.reason, /hasil pencarian/);
  });

  it('tanpa URL riset dan kolom kosong → tidak ada yang disimpan', () => {
    const plan = resolveCuratorUrlSave('', { url_status: 'not_found', source_url: null, curated_data: {} });
    assert.equal(plan.mode, 'none');
  });

  it('URL kurator sudah ada lalu kolom dikosongkan → tidak menimpa dengan URL riset', () => {
    const plan = resolveCuratorUrlSave('', { url_status: 'user', source_url: OFFICIAL, curated_data: { target_url: OTHER } });
    assert.equal(plan.mode, 'none');
  });
});
