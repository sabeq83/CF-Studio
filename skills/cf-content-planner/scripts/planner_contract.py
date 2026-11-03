#!/usr/bin/env python3
"""Offline distribution and structural validation for CF Content Planner."""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import sys
import unicodedata
from urllib.parse import urlparse

CEPS = ['Problem-Solution Based', 'Routine Based', 'Emotional Based',
        'Aspirational Based', 'Commitment Based', 'Opportunistic Based']
VFOS = ['Concrete', 'Instinctive', 'Uncharted', 'Aspirational']
WS = ['When', 'Where', 'With/For Whom', 'How Feeling', 'While', 'With What', 'Why']
ANGLES = {
    'Concrete': ['The Life Hack', 'The Scientific Proof', 'The Math Whiz',
                 'The Stress Test', "The Problem You Didn't Know"],
    'Instinctive': ['The Guilty Pleasure', 'The Pure Relief', 'The Sensory ASMR', 'The Safe Haven'],
    'Uncharted': ['The Origin Story', 'The Scientific Proof', 'The Intellectual Flex'],
    'Aspirational': ['The Second Chance', 'The Status Signal', 'The Artist', 'The Belonging', 'The Caregiver'],
}
FOCI = ['product_campaign', 'brand_editorial', 'recipe_campaign']
CATEGORIES = ['masakan', 'minuman', 'dessert', 'kue']
CTAS = ['save', 'share', 'follow', 'comment', 'try', 'learn_more', 'buy', 'visit_product', 'none']
ORGANIC_CTAS = ['save', 'share', 'follow', 'comment', 'try', 'none']


def issue(path, message):
    return {'path': path, 'message': message}


def text(value):
    return isinstance(value, str) and bool(value.strip())


def integer(value):
    return type(value) is int


def unique_strings(value, allowed=None, empty=True):
    return (isinstance(value, list) and (empty or bool(value))
            and all(text(x) and (allowed is None or x in allowed) for x in value)
            and len(set(value)) == len(value))


class BriefError(ValueError):
    def __init__(self, issues):
        self.issues = issues
        super().__init__('Brief tidak valid')


def normalize_brief(raw):
    errors, notes = [], []
    if not isinstance(raw, dict):
        raise BriefError([issue('brief', 'Wajib berupa objek JSON.')])
    brief = copy.deepcopy(raw)
    focus = brief.get('planner_focus')
    if focus not in FOCI:
        errors.append(issue('brief.planner_focus', 'Pilih ' + ', '.join(FOCI)))
    if not text(brief.get('platform')):
        errors.append(issue('brief.platform', 'Platform wajib diisi.'))
    brief.setdefault('language', 'id-ID')
    if brief['language'] not in ['id-ID', 'en-US']:
        errors.append(issue('brief.language', 'Gunakan id-ID atau en-US.'))
    pillars = brief.get('pillars', [])
    use_pillars = brief.get('use_content_pillars', bool(pillars) if isinstance(pillars, list) else False)
    if type(use_pillars) is not bool:
        errors.append(issue('brief.use_content_pillars', 'Wajib boolean.'))
    if not isinstance(pillars, list):
        errors.append(issue('brief.pillars', 'Wajib array.'))
        pillars = []
    if use_pillars is True:
        if not unique_strings(pillars, empty=False):
            errors.append(issue('brief.pillars', 'ON memerlukan array pilar unik dan tidak kosong.'))
    else:
        if pillars:
            notes.append('Pilar diabaikan karena use_content_pillars=false.')
        pillars = []
    if focus == 'recipe_campaign' and use_pillars is True:
        errors.append(issue('brief.use_content_pillars', 'Recipe Campaign tidak memakai pilar.'))
    brief['use_content_pillars'], brief['pillars'] = use_pillars, pillars
    default_count = 3 if focus == 'recipe_campaign' else (len(pillars) * 2 if focus == 'brand_editorial' and use_pillars is True else 12)
    brief.setdefault('planner_count', default_count)
    count = brief['planner_count']
    if not integer(count) or not 1 <= count <= 30:
        errors.append(issue('brief.planner_count', 'Wajib integer 1–30.'))
    elif focus == 'product_campaign' and count not in [6, 12, 18, 24, 30]:
        errors.append(issue('brief.planner_count', 'Product Campaign: 6, 12, 18, 24, 30.'))
    elif focus == 'brand_editorial' and use_pillars is True and pillars and count % len(pillars):
        errors.append(issue('brief.planner_count', 'Editorial ON harus kelipatan jumlah pilar.'))
    brief.setdefault('history_count', 0)
    if not integer(brief['history_count']) or brief['history_count'] < 0:
        errors.append(issue('brief.history_count', 'Wajib integer >=0.'))
    if focus == 'brand_editorial':
        for key in ['account_name', 'brand_context']:
            if not text(brief.get(key)):
                errors.append(issue('brief.' + key, 'Wajib diisi untuk editorial.'))
    if focus == 'product_campaign' or (focus == 'brand_editorial' and any(brief.get(k) is not None for k in ['product_name', 'product_description'])):
        for key in ['product_name', 'product_description']:
            if not text(brief.get(key)):
                errors.append(issue('brief.' + key, 'Nama dan deskripsi produk wajib diberikan berpasangan.'))
    if focus != 'recipe_campaign':
        brief.setdefault('selected_ceps', CEPS[:])
        if not unique_strings(brief['selected_ceps'], CEPS, empty=False):
            errors.append(issue('brief.selected_ceps', 'Pilih array CEP valid, unik, tidak kosong.'))
    else:
        if brief.get('recipe_category') not in CATEGORIES:
            errors.append(issue('brief.recipe_category', 'Pilih masakan/minuman/dessert/kue.'))
        brief.setdefault('strategy_mode', 'synergy')
        if brief['strategy_mode'] not in ['synergy', 'rotation']:
            errors.append(issue('brief.strategy_mode', 'Pilih synergy atau rotation.'))
        brief.setdefault('products', [])
        products = brief['products']
        if not isinstance(products, list):
            errors.append(issue('brief.products', 'Wajib array katalog produk.'))
        else:
            ids, names = [], []
            for i, product in enumerate(products):
                if not isinstance(product, dict) or any(not text(product.get(k)) for k in ['id', 'name', 'description']):
                    errors.append(issue(f'brief.products[{i}]', 'Wajib objek dengan id, name, description.'))
                else:
                    ids.append(product['id'])
                    names.append(product['name'])
            if len(set(ids)) != len(ids) or len(set(names)) != len(names):
                errors.append(issue('brief.products', 'ID dan nama produk harus unik.'))
    if errors:
        raise BriefError(errors)
    return brief, notes


def build_distribution(raw):
    brief, notes = normalize_brief(raw)
    count, offset = brief['planner_count'], brief['history_count']
    rows = []
    if brief['planner_focus'] == 'recipe_campaign':
        products = brief['products']
        for index in range(count):
            allocated = (products if brief['strategy_mode'] == 'synergy' else [products[(index + offset) % len(products)]]) if products else []
            primary = allocated[0] if allocated else None
            rows.append({'sequence': index + 1, 'category': brief['recipe_category'], 'pillar': None,
                         'primary_product_id': primary['id'] if primary else None,
                         'product_reference': primary['name'] if primary else None,
                         'allocated_product_ids': [p['id'] for p in allocated]})
    else:
        seed = int.from_bytes(hashlib.sha256(str(brief.get('account_name') or brief.get('product_name') or '').encode()).digest()[:8], 'big')
        for index in range(count):
            n = index + offset
            pillars, ceps = brief['pillars'], brief['selected_ceps']
            rows.append({'sequence': index + 1,
                         'pillar': pillars[(n + seed) % len(pillars)] if brief['use_content_pillars'] else None,
                         'category_cep': ceps[(n + seed + 1) % len(ceps)],
                         'vfo': VFOS[(n + seed + 2) % len(VFOS)],
                         'product_reference': brief.get('product_name') or None})
    return {'brief': brief, 'distribution': rows, 'assumptions': notes}


def normalized(value):
    return ' '.join(''.join(c if c.isalnum() else ' ' for c in unicodedata.normalize('NFKC', value).casefold()).split())


def validate_output(payload, locked, stage='final', previous=None, target_sequence=None, target_field=None):
    errors = []
    if not isinstance(payload, dict) or not isinstance(locked, dict):
        return [issue('$', 'Input dan locked wajib objek JSON.')]
    try:
        expected = build_distribution(payload.get('brief'))
    except BriefError as exc:
        return exc.issues
    brief, allocation = expected['brief'], expected['distribution']
    if payload.get('brief') != brief:
        errors.append(issue('brief', 'Salin brief ternormalisasi dari distribute.'))
    for label, envelope in [('input', payload), ('locked', locked)]:
        if envelope.get('brief') != brief or envelope.get('distribution') != allocation:
            errors.append(issue(label, 'Brief/distribusi tidak sesuai alokasi deterministik atau acuan.'))
    for field in ['assumptions', 'history', 'evidence']:
        if not isinstance(payload.get(field), list):
            errors.append(issue(field, 'Wajib array.'))
    assumptions = payload.get('assumptions', [])
    if isinstance(assumptions, list) and not all(text(x) for x in assumptions):
        errors.append(issue('assumptions', 'Setiap asumsi wajib string tidak kosong.'))
    history = payload.get('history') if isinstance(payload.get('history'), list) else []
    if any(not isinstance(row, dict) for row in history):
        errors.append(issue('history', 'Setiap history row wajib objek.'))
    evidence = payload.get('evidence') if isinstance(payload.get('evidence'), list) else []
    evidence_ids = set()
    for i, entry in enumerate(evidence):
        if not isinstance(entry, dict) or not text(entry.get('id')) or not text(entry.get('claim')) or not text(entry.get('source_url')):
            errors.append(issue(f'evidence[{i}]', 'Wajib id, claim dan source_url.'))
            continue
        url = urlparse(entry['source_url'])
        if url.scheme not in ['http', 'https'] or not url.netloc or entry['id'] in evidence_ids:
            errors.append(issue(f'evidence[{i}]', 'URL harus http/https dan ID unik.'))
        evidence_ids.add(entry['id'])
    rows = payload.get('rows')
    if not isinstance(rows, list) or len(rows) != len(allocation):
        return errors + [issue('rows', 'Jumlah rows harus tepat planner_count.')]
    locked_rows = locked.get('rows')
    if stage == 'final' and (not isinstance(locked_rows, list) or len(locked_rows) != len(rows)):
        return errors + [issue('locked.rows', 'Final memerlukan skeleton lengkap, bukan hanya distribution.')]
    if stage == 'final':
        errors.extend(issue('locked.' + x['path'], x['message']) for x in validate_output(locked, expected, stage='skeleton'))
        for key in ['history', 'evidence', 'assumptions']:
            if payload.get(key) != locked.get(key):
                errors.append(issue(key, 'Metadata skeleton tidak boleh berubah pada final.'))
    seen = {key: {} for key in ['hook', 'context', 'visual_action', 'title']}
    for old in history:
        if isinstance(old, dict):
            for key in seen:
                if text(old.get(key)):
                    seen[key][normalized(old[key])] = 'history'
    recipe = brief['planner_focus'] == 'recipe_campaign'
    for i, row in enumerate(rows):
        prefix = f'rows[{i}]'
        if not isinstance(row, dict):
            errors.append(issue(prefix, 'Wajib objek.'))
            continue
        for key, value in allocation[i].items():
            if key not in row or type(row[key]) is not type(value) or row[key] != value:
                errors.append(issue(prefix + '.' + key, 'Field alokasi tidak sesuai atau hilang.'))
        required_text = ['title', 'content_subject'] if recipe else ['context', 'strategic_angle', 'narrative_mode', 'content_subject']
        if stage == 'final':
            required_text += ['hook', 'visual_action']
        elif any(key in row for key in ['hook', 'visual_action']):
            errors.append(issue(prefix, 'Skeleton tidak boleh berisi hook/visual_action.'))
        for key in required_text:
            if not text(row.get(key)):
                errors.append(issue(prefix + '.' + key, 'Wajib string tidak kosong.'))
        if 'product' not in row or row['product'] != allocation[i]['product_reference']:
            errors.append(issue(prefix + '.product', 'Produk harus sesuai referensi eksplisit, atau null.'))
        intent, cta = row.get('commercial_intent'), row.get('cta_type')
        if intent not in ['no_sell', 'soft_sell', 'hard_sell']:
            errors.append(issue(prefix + '.commercial_intent', 'Intent tidak valid.'))
        if cta not in CTAS:
            errors.append(issue(prefix + '.cta_type', 'CTA tidak valid.'))
        if allocation[i]['product_reference'] is None and (intent != 'no_sell' or cta not in ORGANIC_CTAS):
            errors.append(issue(prefix, 'Tanpa produk wajib no_sell dan CTA nonkomersial.'))
        if intent == 'no_sell' and cta in ['buy', 'visit_product']:
            errors.append(issue(prefix + '.cta_type', 'No sell tidak boleh memakai CTA pembelian.'))
        if not recipe:
            dims = row.get('ws_matrix')
            if not unique_strings(dims, WS, empty=False) or len(dims) < 2:
                errors.append(issue(prefix + '.ws_matrix', 'Minimal dua dimensi W’s valid dan unik.'))
            if row.get('strategic_angle') not in ANGLES.get(allocation[i]['vfo'], []):
                errors.append(issue(prefix + '.strategic_angle', 'Angle tidak kompatibel dengan VFO.'))
        refs = row.get('evidence_ids', [])
        if not unique_strings(refs) or any(x not in evidence_ids for x in refs):
            errors.append(issue(prefix + '.evidence_ids', 'Gunakan array ID evidence terdaftar dan unik.'))
        if not recipe and row.get('strategic_angle') == 'The Scientific Proof' and not refs:
            errors.append(issue(prefix + '.evidence_ids', 'Scientific Proof membutuhkan evidence.'))
        if stage == 'final' and isinstance(locked_rows[i], dict):
            for key, value in locked_rows[i].items():
                if key not in row or row[key] != value or type(row[key]) is not type(value):
                    errors.append(issue(prefix + '.' + key, 'Field skeleton terkunci berubah.'))
        for key in seen:
            if text(row.get(key)):
                fingerprint = normalized(row[key])
                if fingerprint in seen[key]:
                    errors.append(issue(prefix + '.' + key, 'Duplikat dengan ' + seen[key][fingerprint]))
                seen[key][fingerprint] = f'rows[{i}]'
        if recipe and stage == 'final':
            errors.extend(validate_recipe(row, allocation[i], brief, prefix))
    if previous is not None:
        errors.extend(validate_revision(payload, previous, target_sequence, target_field))
    return errors


def validate_recipe(row, allocation, brief, prefix):
    errors = []
    for field in ['servings', 'difficulty', 'cta']:
        if not text(row.get(field)):
            errors.append(issue(prefix + '.' + field, 'Wajib string tidak kosong.'))
    for field in ['prep_time_minutes', 'cook_time_minutes']:
        value = row.get(field)
        if type(value) not in [int, float] or not math.isfinite(value) or value < 0:
            errors.append(issue(prefix + '.' + field, 'Wajib angka finite >=0.'))
    if not unique_strings(row.get('chef_tips')):
        errors.append(issue(prefix + '.chef_tips', 'Wajib array string unik.'))
    allocated = allocation['allocated_product_ids']
    catalog = {p['id']: p['name'] for p in brief['products']}
    ingredients = row.get('ingredients')
    if not isinstance(ingredients, list) or not ingredients:
        errors.append(issue(prefix + '.ingredients', 'Minimal satu bahan.'))
    else:
        for i, item in enumerate(ingredients):
            if (not isinstance(item, dict) or not text(item.get('name')) or not text(item.get('amount'))
                    or not isinstance(item.get('unit'), str) or 'product_id' not in item
                    or (item['product_id'] is not None and (not isinstance(item['product_id'], str) or item['product_id'] not in allocated))):
                errors.append(issue(f'{prefix}.ingredients[{i}]', 'Bahan/takaran/unit/product_id tidak valid atau produk tidak dialokasikan.'))
    steps = row.get('steps')
    if not isinstance(steps, list) or not steps:
        errors.append(issue(prefix + '.steps', 'Minimal satu langkah.'))
    else:
        for i, step in enumerate(steps):
            if not isinstance(step, dict) or type(step.get('index')) is not int or step['index'] != i + 1 or not text(step.get('instruction')):
                errors.append(issue(f'{prefix}.steps[{i}]', 'Index harus berurutan dan instruksi wajib diisi.'))
    featured = row.get('featured_products')
    if not isinstance(featured, list):
        errors.append(issue(prefix + '.featured_products', 'Wajib array.'))
    else:
        found = []
        for i, product in enumerate(featured):
            if not isinstance(product, dict) or not isinstance(product.get('product_id'), str) or product['product_id'] not in allocated:
                errors.append(issue(f'{prefix}.featured_products[{i}]', 'Produk tidak dialokasikan.'))
                continue
            found.append(product['product_id'])
            if product.get('product_name') != catalog[product['product_id']] or product.get('role') not in ['main_ingredient', 'supporting_ingredient', 'appliance', 'topping'] or not text(product.get('action_step')):
                errors.append(issue(f'{prefix}.featured_products[{i}]', 'Nama/role/action_step tidak valid.'))
        if sorted(found) != sorted(allocated):
            errors.append(issue(prefix + '.featured_products', 'Harus tepat memuat seluruh produk yang dialokasikan sekali.'))
    return errors


def validate_revision(payload, previous, sequence, field):
    if not isinstance(previous, dict) or not isinstance(previous.get('rows'), list):
        return [issue('previous', 'Wajib planner final lengkap.')]
    if field not in ['hook', 'visual_action'] or not integer(sequence) or not 1 <= sequence <= len(payload['rows']):
        return [issue('revision', 'Target sequence/field tidak valid.')]
    old, new = copy.deepcopy(previous), copy.deepcopy(payload)
    if len(old['rows']) != len(new['rows']) or not isinstance(old['rows'][sequence - 1], dict):
        return [issue('previous.rows', 'Jumlah row sebelumnya harus sama dan target wajib objek.')]
    old['rows'][sequence - 1].pop(field, None)
    new['rows'][sequence - 1].pop(field, None)
    return [] if old == new else [issue('revision', 'Regenerasi hanya boleh mengubah satu field pada satu sequence.')]


def load_json(path):
    def reject(value):
        raise ValueError('Konstanta JSON tidak valid: ' + value)
    return json.loads(Path(path).read_text(encoding='utf-8'), parse_constant=reject)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    distribute = commands.add_parser('distribute')
    distribute.add_argument('--brief', required=True)
    distribute.add_argument('--out')
    validate = commands.add_parser('validate')
    validate.add_argument('--input', required=True)
    validate.add_argument('--locked', required=True)
    validate.add_argument('--stage', choices=['skeleton', 'final'], default='final')
    validate.add_argument('--previous')
    validate.add_argument('--target-sequence', type=int)
    validate.add_argument('--target-field', choices=['hook', 'visual_action'])
    args = parser.parse_args()
    try:
        if args.command == 'distribute':
            result = build_distribution(load_json(args.brief))
            output = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
            if args.out:
                # Exclusive create: never silently overwrite a user's artifact.
                with Path(args.out).open('x', encoding='utf-8') as stream:
                    stream.write(output)
            else:
                print(output, end='')
            return 0
        revision_args = [args.previous is not None, args.target_sequence is not None, args.target_field is not None]
        if any(revision_args) and not all(revision_args):
            parser.error('--previous, --target-sequence, --target-field wajib dipakai bersama.')
        if args.previous and args.stage != 'final':
            parser.error('Regenerasi satu field hanya untuk tahap final.')
        errors = validate_output(load_json(args.input), load_json(args.locked), args.stage,
                                 load_json(args.previous) if args.previous else None,
                                 args.target_sequence, args.target_field)
        print(json.dumps({'status': 'fail' if errors else 'pass', 'issues': errors,
                          'scope': 'structure_and_exact_duplicates_only'}, ensure_ascii=False, indent=2))
        return 1 if errors else 0
    except BriefError as exc:
        print(json.dumps({'status': 'fail', 'issues': exc.issues}, ensure_ascii=False, indent=2))
        return 1
    except (OSError, ValueError) as exc:
        print(json.dumps({'status': 'error', 'issues': [issue('$', str(exc))]}, ensure_ascii=False))
        return 2


if __name__ == '__main__':
    sys.exit(main())
