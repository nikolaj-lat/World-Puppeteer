'use strict';

const AI_INSTRUCTION_LEAF_LIMIT = 5_000;
const AI_INSTRUCTION_TASK_LIMIT = 20_000;
// Voyage v35 live-validator behavior (empirically verified 2026-07-11 against
// four exact live error deltas; the wiki size-limits table still says "raw
// characters" and is stale on the measurement method):
// - leaf limit: 5,000 measured as JSON.stringify(leaf).length — the escaped
//   JSON string INCLUDING the surrounding quotes (\n and " cost 2, surrogate
//   pairs cost 2); generateNPCIntents leaves raised to 8,000.
// - task limit: 20,000 measured as JSON.stringify(task, null, 2).length — the
//   pretty-printed JSON of the whole task object, so key names, indentation,
//   braces, and escapes all count; generateNPCIntents raised to 40,000.
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

// Live v35 leaf measure: escaped JSON string including surrounding quotes.
function serializedLeafLength(value) {
  return JSON.stringify(String(value)).length;
}

// Live v35 task measure: pretty-printed (indent=2) JSON of the task value.
function serializedTaskLength(value) {
  return JSON.stringify(value, null, 2).length;
}

function collectAiInstructionLeaves(value, pathName, leafLimit = AI_INSTRUCTION_LEAF_LIMIT) {
  if (typeof value === 'string') {
    return {
      leaves: [{
        path: pathName,
        text: value,
        used: serializedLeafLength(value),
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
      used: serializedTaskLength(taskValue),
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
  serializedLeafLength,
  serializedTaskLength,
  collectAiInstructionLeaves,
  measureAiInstructions,
};
