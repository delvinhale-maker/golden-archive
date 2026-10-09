import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const source = readFileSync(new URL("../src/lib/food-os-billing.server.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261008202000_food_entitlement_subscription_order.sql", import.meta.url), "utf8");

test("Food OS checkout return URLs use validated canonical HTTPS origin", () => {
  assert.match(source, /appUrl\.protocol!=="https:"/);
  assert.match(source, /appUrl\.username \|\| appUrl\.password/);
  assert.match(source, /success_url:`\$\{appUrl\.origin\}\/food-os\?billing=success`/);
  assert.match(source, /cancel_url:`\$\{appUrl\.origin\}\/food-os\?billing=cancelled`/);
});
test("Food OS billing rejects ambiguous subscription replacements", () => {
  assert.match(source, /recordedCreated>subscription\.created/);
  assert.match(source, /recordedCreated===subscription\.created/);
  assert.match(source, /previous\.created===subscription\.created/);
  assert.match(source, /stripe_subscription_created_at:new Date\(subscription\.created\*1000\)/);
  assert.match(migration, /add column if not exists stripe_subscription_created_at timestamptz/);
});
test("Food OS billing validates one item and preserves organization authorization", () => {
  assert.match(source, /subscription\.items\.data\.length!==1 \|\| item\.quantity!==1/);
  assert.match(source, /"owner","compliance_admin"/);
  assert.match(source, /Organization billing access denied/);
});
