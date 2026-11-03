"""Behavioral invariants for the portable CF Content Planner contract."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'skills/cf-content-planner/scripts/planner_contract.py'
spec = importlib.util.spec_from_file_location('planner_contract', SCRIPT)
cf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cf)


def brief(focus='brand_editorial', **updates):
    value = {'planner_focus': focus, 'platform': 'instagram', 'planner_count': 6,
             'account_name': 'Dapur Contoh', 'brand_context': 'Edukasi dapur praktis'}
    if focus == 'product_campaign':
        value.update(product_name='Wadah Contoh', product_description='Wadah bekal dengan dua kompartemen')
    if focus == 'recipe_campaign':
        value.update(recipe_category='minuman')
    value.update(updates)
    return value


def skeleton(raw):
    value = cf.build_distribution(raw)
    value.update(history=[], evidence=[], rows=[])
    for i, allocated in enumerate(value['distribution']):
        row = copy.deepcopy(allocated)
        row.update(product=allocated['product_reference'], commercial_intent='soft_sell' if allocated['product_reference'] else 'no_sell', cta_type='save', content_subject=f'Topik dapur {i + 1}')
        if raw['planner_focus'] == 'recipe_campaign':
            row['title'] = f'Minuman contoh {i + 1}'
        else:
            row.update(ws_matrix=['When', 'While'], context=f'Situasi dapur {i + 1}',
                       strategic_angle=cf.ANGLES[row['vfo']][0], narrative_mode='Demonstrasi')
        value['rows'].append(row)
    return value


def final(locked):
    value = copy.deepcopy(locked)
    recipe = value['brief']['planner_focus'] == 'recipe_campaign'
    products = {p['id']: p for p in value['brief'].get('products', [])}
    for i, row in enumerate(value['rows']):
        row.update(hook=f'Pembuka kreatif {i + 1}', visual_action=f'Aksi kamera {i + 1}')
        if recipe:
            row.update(servings='1 porsi', prep_time_minutes=2, cook_time_minutes=0, difficulty='Mudah',
                       ingredients=[{'name': 'Air', 'amount': '200', 'unit': 'ml', 'product_id': None}],
                       steps=[{'index': 1, 'instruction': 'Tuangkan air ke gelas.'}], chef_tips=[],
                       featured_products=[{'product_id': pid, 'product_name': products[pid]['name'], 'role': 'appliance', 'action_step': 'Gunakan saat persiapan.'} for pid in row['allocated_product_ids']], cta='Simpan ide ini.')
    return value


class ContractTests(unittest.TestCase):
    def test_product_counts_both_pillar_modes(self):
        for count in [6, 12, 18, 24, 30]:
            for enabled in [False, True]:
                raw = brief('product_campaign', planner_count=count, use_content_pillars=enabled, pillars=['A', 'B', 'C'])
                locked = skeleton(raw)
                self.assertEqual([], cf.validate_output(final(locked), locked))
                distribution = cf.build_distribution(raw)
                self.assertEqual(distribution, cf.build_distribution(raw))
                for field in ['category_cep', 'vfo'] + (['pillar'] if enabled else []):
                    pool = {'category_cep': cf.CEPS, 'vfo': cf.VFOS, 'pillar': ['A', 'B', 'C']}[field]
                    counts = [sum(row[field] == x for row in distribution['distribution']) for x in pool]
                    self.assertLessEqual(max(counts) - min(counts), 1)

    def test_editorial_count_boundaries(self):
        for count in [1, 10, 30]:
            locked = skeleton(brief(planner_count=count, use_content_pillars=False))
            self.assertEqual([], cf.validate_output(final(locked), locked))
            self.assertTrue(all(r['pillar'] is None for r in locked['rows']))
        for count in [0, 31, 1.5, '12', True]:
            with self.assertRaises(cf.BriefError):
                cf.build_distribution(brief(planner_count=count))
        with self.assertRaises(cf.BriefError):
            cf.build_distribution(brief(planner_count=10, pillars=['A', 'B', 'C']))
        locked = skeleton(brief(pillars=['A', 'B', 'C']))
        self.assertEqual([], cf.validate_output(final(locked), locked))

    def test_off_ignores_stale_pillars(self):
        a = cf.build_distribution(brief(use_content_pillars=False, pillars=['SECRET THEME']))
        b = cf.build_distribution(brief(use_content_pillars=False))
        self.assertEqual(a['distribution'], b['distribution'])
        self.assertEqual([], a['brief']['pillars'])
        self.assertTrue(a['assumptions'])
        with self.assertRaises(cf.BriefError):
            cf.build_distribution(brief(use_content_pillars=True, pillars=[]))

    def test_subset_ceps_and_history_offset(self):
        raw = brief(selected_ceps=[cf.CEPS[0], cf.CEPS[1]], history_count=3)
        plan = cf.build_distribution(raw)
        self.assertEqual(set(raw['selected_ceps']), {r['category_cep'] for r in plan['distribution']})
        self.assertNotEqual(plan['distribution'], cf.build_distribution(brief())['distribution'])
        for selected in [[], ['invented'], [cf.CEPS[0], cf.CEPS[0]]]:
            with self.assertRaises(cf.BriefError):
                cf.build_distribution(brief(selected_ceps=selected))

    def test_locked_full_strategy_and_metadata(self):
        locked = skeleton(brief())
        value = final(locked)
        for key, replacement in [('context', 'Changed context'), ('pillar', 'Invented'), ('sequence', True), ('product', 'Invented'), ('ws_matrix', ['Why', 'Where'])]:
            changed = copy.deepcopy(value)
            changed['rows'][0][key] = replacement
            self.assertTrue(cf.validate_output(changed, locked), key)
        for key in ['history', 'evidence', 'assumptions']:
            changed = copy.deepcopy(value)
            changed[key] = ['Changed metadata']
            self.assertTrue(cf.validate_output(changed, locked), key)
        value['distribution'][0]['pillar'] = 'Tampered'
        self.assertTrue(cf.validate_output(value, locked))

    def test_invalid_shapes_and_missing_fields(self):
        locked = skeleton(brief())
        for bad in [[], None, 7]:
            self.assertTrue(cf.validate_output(bad, locked))
        for key, val in [('vfo', []), ('ws_matrix', None), ('ws_matrix', ['When']), ('ws_matrix', [[], {}]), ('cta_type', 'buy'), ('evidence_ids', [2]), ('hook', '')]:
            value = final(locked)
            value['rows'][0][key] = val
            self.assertTrue(cf.validate_output(value, locked))
        value = final(locked)
        value['rows'].pop()
        self.assertTrue(cf.validate_output(value, locked))

    def test_history_and_batch_duplicates(self):
        locked = skeleton(brief())
        locked['history'] = [{'hook': '  PEMBUKA kreatif... 1!'}]
        self.assertTrue(cf.validate_output(final(locked), locked))
        locked = skeleton(brief())
        value = final(locked)
        value['rows'][1]['hook'] = value['rows'][0]['hook'].upper() + '!'
        self.assertTrue(cf.validate_output(value, locked))

    def test_scientific_proof_requires_evidence(self):
        locked = skeleton(brief())
        target = next(row for row in locked['rows'] if row['vfo'] in ['Concrete', 'Uncharted'])
        target['strategic_angle'] = 'The Scientific Proof'
        self.assertTrue(cf.validate_output(locked, cf.build_distribution(locked['brief']), 'skeleton'))
        locked['evidence'] = [{'id': 'source-1', 'claim': 'Contoh klaim bersumber', 'source_url': 'https://example.org/report'}]
        target['evidence_ids'] = ['source-1']
        self.assertEqual([], cf.validate_output(final(locked), locked))

    def test_single_field_revision(self):
        locked = skeleton(brief())
        old = final(locked)
        value = copy.deepcopy(old)
        value['rows'][1]['hook'] = 'Hook baru untuk satu ide'
        self.assertEqual([], cf.validate_output(value, locked, previous=old, target_sequence=2, target_field='hook'))
        value['rows'][0]['visual_action'] = 'Aksi berbeda'
        self.assertTrue(cf.validate_output(value, locked, previous=old, target_sequence=2, target_field='hook'))
        value = final(locked)
        value['brief']['use_content_pillars'] = True
        self.assertTrue(cf.validate_output(value, locked))

    def test_recipe_organic_and_catalog_modes(self):
        products = [{'id': 'p1', 'name': 'Gelas Contoh', 'description': 'Gelas saji'}, {'id': 'p2', 'name': 'Sendok Contoh', 'description': 'Sendok pengaduk'}]
        for count in [1, 30]:
            for mode in ['synergy', 'rotation']:
                for catalog in [[], products]:
                    locked = skeleton(brief('recipe_campaign', planner_count=count, products=catalog, strategy_mode=mode))
                    self.assertEqual([], cf.validate_output(final(locked), locked))
        locked = skeleton(brief('recipe_campaign'))
        value = final(locked)
        value['rows'][0]['featured_products'] = [{'product_id': 'invented'}]
        self.assertTrue(cf.validate_output(value, locked))
        for key, replacement in [('steps', [{'index': 2, 'instruction': 'Masak'}]), ('prep_time_minutes', True), ('ingredients', []), ('ingredients', [{'name': 'Air', 'amount': '1', 'unit': 'ml', 'product_id': []}])]:
            value = final(locked)
            value['rows'][0][key] = replacement
            self.assertTrue(cf.validate_output(value, locked))

    def test_cli_is_portable_and_rejects_invalid_json(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            portable = folder / 'planner_contract.py'
            portable.write_bytes(SCRIPT.read_bytes())
            source = folder / 'brief.json'
            source.write_text(json.dumps(brief()))
            result = subprocess.run([sys.executable, str(portable), 'distribute', '--brief', str(source), '--out', str(folder / 'distribution.json')], cwd=temp, capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            self.assertEqual(6, len(json.loads((folder / 'distribution.json').read_text())['distribution']))
            source.write_text('{')
            result = subprocess.run([sys.executable, str(portable), 'distribute', '--brief', str(source)], cwd=temp, capture_output=True, text=True)
            self.assertEqual(2, result.returncode)
            self.assertEqual('error', json.loads(result.stdout)['status'])


if __name__ == '__main__':
    unittest.main()
