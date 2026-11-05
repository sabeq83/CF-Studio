import test from 'node:test';
import assert from 'node:assert/strict';

// Helper auto-detection logic (identik dengan implementasi app/auto-pipeline/page.js)
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

test('Smart Category Auto-Detection detects food keywords correctly', () => {
  // Test 1: Makanan Utama
  assert.equal(detectCategoryFromTopic('air fryer baked potato'), 'makanan_utama');
  assert.equal(detectCategoryFromTopic('garlic butter chicken thighs'), 'makanan_utama');
  assert.equal(detectCategoryFromTopic('pan-seared salmon with asparagus'), 'makanan_utama');
  assert.equal(detectCategoryFromTopic('wagyu beef bowl'), 'makanan_utama');
  assert.equal(detectCategoryFromTopic(''), 'makanan_utama');

  // Test 2: Camilan / Side Dish
  assert.equal(detectCategoryFromTopic('crispy parmesan zucchini fries'), 'camilan');
  assert.equal(detectCategoryFromTopic('buffalo chicken wings'), 'camilan');
  assert.equal(detectCategoryFromTopic('crispy potato chips'), 'camilan');

  // Test 3: Dessert / Baking
  assert.equal(detectCategoryFromTopic('fudgy chocolate lava cake'), 'dessert');
  assert.equal(detectCategoryFromTopic('chewy oatmeal cookies'), 'dessert');
  assert.equal(detectCategoryFromTopic('japanese souffle pancake'), 'dessert');

  // Test 4: Minuman
  assert.equal(detectCategoryFromTopic('iced matcha espresso latte'), 'minuman');
  assert.equal(detectCategoryFromTopic('avocado keto smoothie'), 'minuman');
  assert.equal(detectCategoryFromTopic('sparkling berry mocktail'), 'minuman');
});

test('Engine core defaults fallback category to makanan_utama', async () => {
  const { createDraftContentPlanner } = await import('../lib/content-planner-engine.js');
  const { getDb } = await import('../lib/db.js');
  
  // Create a draft with recipe_campaign focus and no explicit category
  const draft = await createDraftContentPlanner({
    title: 'Test Fallback Category Unit Test',
    account_name: 'test_brand',
    planner_focus: 'recipe_campaign',
    promotion_context: 'air fryer potato',
    planner_count: 1
  });

  assert.ok(draft.planner_id, 'Draft should be created');
  const cfg = JSON.parse(draft.recipe_config_json || '{}');
  assert.equal(cfg.category, 'makanan_utama', 'Default category MUST be makanan_utama, NOT minuman');

  // Verify from DB directly
  const db = getDb();
  const row = await db.prepare('SELECT recipe_config_json FROM content_planners WHERE id = ?').get(draft.planner_id);
  assert.ok(row, 'Row should exist in DB');
  const savedCfg = typeof row.recipe_config_json === 'string'
    ? JSON.parse(row.recipe_config_json)
    : (row.recipe_config_json || {});
  assert.equal(savedCfg.category, 'makanan_utama', 'DB persisted category MUST be makanan_utama');
});

test('Engine core preserves explicit category when provided', async () => {
  const { createDraftContentPlanner } = await import('../lib/content-planner-engine.js');
  const { getDb } = await import('../lib/db.js');
  
  // Create a draft with explicit category camilan
  const draft = await createDraftContentPlanner({
    title: 'Test Explicit Category Unit Test',
    account_name: 'test_brand',
    planner_focus: 'recipe_campaign',
    recipe_config: { category: 'camilan' },
    promotion_context: 'zucchini fries',
    planner_count: 1
  });

  assert.ok(draft.planner_id, 'Draft should be created');
  const cfg = JSON.parse(draft.recipe_config_json || '{}');
  assert.equal(cfg.category, 'camilan', 'Explicit category camilan must be preserved');

  // Verify from DB directly
  const db = getDb();
  const row = await db.prepare('SELECT recipe_config_json FROM content_planners WHERE id = ?').get(draft.planner_id);
  assert.ok(row, 'Row should exist in DB');
  const savedCfg = typeof row.recipe_config_json === 'string'
    ? JSON.parse(row.recipe_config_json)
    : (row.recipe_config_json || {});
  assert.equal(savedCfg.category, 'camilan', 'DB persisted category MUST be camilan');
});

