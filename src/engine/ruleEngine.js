const workflowConfig = require("../config/workflow.config.json");

function evaluateSingleRule(rule, data) {
  const actualValue = data[rule.field];
  let passed = false;

  if (actualValue === undefined || actualValue === null) {
    return {
      field: rule.field,
      operator: rule.operator,
      expectedValue: rule.value,
      actualValue,
      passed: false,
    };
  }

  if (rule.operator === "gt") {
    passed = actualValue > rule.value;
  } else if (rule.operator === "lt") {
    passed = actualValue < rule.value;
  } else if (rule.operator === "eq") {
    passed = actualValue === rule.value;
  }

  return {
    field: rule.field,
    operator: rule.operator,
    expectedValue: rule.value,
    actualValue,
    passed,
  };
}

function evaluateRulesWithConfig(data, config) {
  const evaluations = config.rules.map((rule) =>
    evaluateSingleRule(rule, data),
  );

  const allPassed = evaluations.every((result) => result.passed);

  return {
    decision: allPassed ? "approved" : "rejected",
    evaluations,
    stages: config.stages,
    workflowName: config.workflowName,
  };
}

function evaluateRules(data) {
  return evaluateRulesWithConfig(data, workflowConfig);
}

module.exports = {
  evaluateRules,
  evaluateRulesWithConfig,
};
