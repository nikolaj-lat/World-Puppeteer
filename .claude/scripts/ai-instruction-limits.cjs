'use strict';

const AI_INSTRUCTION_LEAF_LIMIT = 5_000;
const AI_INSTRUCTION_TASK_LIMIT = 20_000;
// Per the wiki mirror (size-limits, snapshot refreshed 2026-07-06):
// - leaf limit: 5,000 raw codepoints; generateNPCIntents leaves raised to 8,000.
// - task limit: 20,000 as the SUM of instruction chars across the task's string
//   leaves (raw codepoints, not serialized JSON); generateNPCIntents raised to 40,000.
const AI_INSTRUCTION_TASK_LIMIT_OVERRIDES = {
  generateNPCIntents: 40_000,
};
const AI_INSTRUCTION_LEAF_LIMIT_OVERRIDES = {
  generateNPCIntents: 8_000,
};

function aiInstructionTaskLimit(taskId) {
  return Object.prototype.hasOwnProperty.call(AI_INSTRUCTION_TASK_LIMIT_OVERRIDES, taskId)
    ? AI_INSTRUCTION_TASK_LIMIT_OVERRIDES[taskId]
    : AI_INSTRUCTION_TASK_LIMIT;
}

function aiInstructionLeafLimit(taskId) {
  return Object.prototype.hasOwnProperty.call(AI_INSTRUCTION_LEAF_LIMIT_OVERRIDES, taskId)
    ? AI_INSTRUCTION_LEAF_LIMIT_OVERRIDES[taskId]
    : AI_INSTRUCTION_LEAF_LIMIT;
}

function codePointLength(value) {
  return Array.from(String(value)).length;
}

function collectAiInstructionLeaves(value, pathName, leafLimit = AI_INSTRUCTION_LEAF_LIMIT) {
  if (typeof value === 'string') {
    return {
      leaves: [{
        path: pathName,
        text: value,
        used: codePointLength(value),
        limit: leafLimit,
      }],
      invalid: [],
    };
  }

  if (Array.isArray(value)) {
    const leaves = [];
    const invalid = [];
    value.forEach((child, index) => {
      const result = collectAiInstructionLeaves(
        child,
        `${pathName}[${index}]`,
        leafLimit
      );
      leaves.push(...result.leaves);
      invalid.push(...result.invalid);
    });
    return { leaves, invalid };
  }

  if (value && typeof value === 'object') {
    const leaves = [];
    const invalid = [];
    for (const [key, child] of Object.entries(value)) {
      const result = collectAiInstructionLeaves(
        child,
        `${pathName}.${key}`,
        leafLimit
      );
      leaves.push(...result.leaves);
      invalid.push(...result.invalid);
    }
    return { leaves, invalid };
  }

  return {
    leaves: [],
    invalid: [{
      path: pathName,
      actual: value === null ? 'null' : typeof value,
    }],
  };
}

function measureAiInstructions(aiInstructions, rootPath = 'aiInstructions') {
  const tasks = [];
  const leaves = [];
  const invalid = [];

  if (
    aiInstructions === undefined ||
    aiInstructions === null ||
    typeof aiInstructions !== 'object'
  ) {
    return {
      tasks,
      leaves,
      invalid,
      leafLimit: AI_INSTRUCTION_LEAF_LIMIT,
      taskLimit: AI_INSTRUCTION_TASK_LIMIT,
    };
  }

  for (const [taskId, taskValue] of Object.entries(aiInstructions)) {
    const path = `${rootPath}.${taskId}`;
    const taskResult = collectAiInstructionLeaves(taskValue, path, aiInstructionLeafLimit(taskId));
    leaves.push(...taskResult.leaves);
    invalid.push(...taskResult.invalid);
    tasks.push({
      path,
      used: taskResult.leaves.reduce((sum, leaf) => sum + leaf.used, 0),
      limit: aiInstructionTaskLimit(taskId),
    });
  }

  return {
    tasks,
    leaves,
    invalid,
    leafLimit: AI_INSTRUCTION_LEAF_LIMIT,
    taskLimit: AI_INSTRUCTION_TASK_LIMIT,
  };
}

module.exports = {
  AI_INSTRUCTION_LEAF_LIMIT,
  AI_INSTRUCTION_LEAF_LIMIT_OVERRIDES,
  AI_INSTRUCTION_TASK_LIMIT,
  AI_INSTRUCTION_TASK_LIMIT_OVERRIDES,
  aiInstructionLeafLimit,
  aiInstructionTaskLimit,
  codePointLength,
  collectAiInstructionLeaves,
  measureAiInstructions,
};
