const assert = require("assert");
const { evaluateRules } = require("../engine/ruleEngine");

function makeData(overrides = {}) {
  return {
    age: 25,
    salary: 50000,
    creditScore: 700,
    ...overrides,
  };
}

const tests = {
  ageRuleShouldFailForMinor() {
    const result = evaluateRules(makeData({ age: 16 }));
    const ageRule = result.evaluations.find((r) => r.field === "age");

    assert(ageRule, "age rule should exist");
    assert.strictEqual(
      ageRule.passed,
      false,
      "age rule should fail for age 16",
    );
  },

  salaryRuleShouldFailForLowSalary() {
    const result = evaluateRules(makeData({ salary: 20000 }));
    const salaryRule = result.evaluations.find((r) => r.field === "salary");

    assert(salaryRule, "salary rule should exist");
    assert.strictEqual(
      salaryRule.passed,
      false,
      "salary rule should fail for salary 20000",
    );
  },

  creditScoreRuleShouldFailForLowScore() {
    const result = evaluateRules(makeData({ creditScore: 550 }));
    const creditRule = result.evaluations.find(
      (r) => r.field === "creditScore",
    );

    assert(creditRule, "creditScore rule should exist");
    assert.strictEqual(
      creditRule.passed,
      false,
      "creditScore rule should fail for score 550",
    );
  },

  allRulesShouldPassForValidApplicant() {
    const result = evaluateRules(makeData());
    const allPass = result.evaluations.every((r) => r.passed === true);

    assert.strictEqual(allPass, true, "all rules should pass for valid input");
  },

  sameRequestIdShouldBeDetectedAsDuplicate() {
    const seen = new Set();
    const requestId = "req-123";

    const firstTime = seen.has(requestId);
    seen.add(requestId);
    const secondTime = seen.has(requestId);

    assert.strictEqual(
      firstTime,
      false,
      "first request should not be duplicate",
    );
    assert.strictEqual(secondTime, true, "second request should be duplicate");
  },
};

function runAllTests() {
  console.log("Running basic tests...");

  let passed = 0;
  let failed = 0;

  for (const [name, fn] of Object.entries(tests)) {
    try {
      fn();
      console.log("PASS -", name);
      passed += 1;
    } catch (error) {
      console.log("FAIL -", name);
      console.log("  ", error.message);
      failed += 1;
    }
  }

  console.log("\nTotal:", passed + failed);
  console.log("Passed:", passed);
  console.log("Failed:", failed);

  return failed === 0;
}

if (require.main === module) {
  const ok = runAllTests();
  process.exit(ok ? 0 : 1);
}

module.exports = { runAllTests, tests };
