import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateReferenceQuote,
  formatUsd,
  multiplyBasisPointsHalfUp,
} from "../lib/domain/money.mjs";

test("calculates the PRD reference economics with integer arithmetic", () => {
  const quote = calculateReferenceQuote();

  assert.deepEqual(quote, {
    currency: "USD",
    productMinor: 27900,
    discountMinor: 1000,
    merchandiseMinor: 26900,
    shippingMinor: 1200,
    taxMinor: 2219,
    totalMinor: 30319,
    budgetMinor: 31500,
    remainingMinor: 1181,
    costOfGoodsMinor: 19000,
    shippingCostMinor: 1200,
    processorFeeMinor: 909,
    contributionMinor: 6991,
    contributionBasisMinor: 28100,
  });
});

test("rounds basis-point multiplication half up without floating point", () => {
  assert.equal(multiplyBasisPointsHalfUp(26900, 825), 2219);
  assert.equal(multiplyBasisPointsHalfUp(30319, 290), 879);
  assert.equal(multiplyBasisPointsHalfUp(1, 5000), 1);
});

test("formats integer USD minor units", () => {
  assert.equal(formatUsd(30319), "$303.19");
  assert.equal(formatUsd(-909), "-$9.09");
});

test("rejects non-integer money", () => {
  assert.throws(() => multiplyBasisPointsHalfUp(1.5, 825), /integer/);
  assert.throws(() => formatUsd(Number.NaN), /integer/);
});
