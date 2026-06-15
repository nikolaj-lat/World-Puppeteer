'use strict';

const AI_INSTRUCTION_LEAF_LIMIT = 5_000;
const AI_INSTRUCTION_TASK_LIMIT = 20_000;

function codePointLength(value) {
  return Array.from(String(value)).length;
}

function collectAiInstructionLeaves(value, pathName) {
  if (typeof value === 'string') {
    return {
      leaves: [{
        path: pathName,
        text: value,
        used: codePointLength(value),
        limit: AI_INSTRUCTION_LEAF_LIMIT,
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
        `${pathName}[${index}]`
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
        `${pathName}.${key}`
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
    const serialized = JSON.stringify(taskValue, null, 2);
    tasks.push({
      path,
      used: codePointLength(serialized === undefined ? '' : serialized),
      limit: AI_INSTRUCTION_TASK_LIMIT,
    });

    const taskResult = collectAiInstructionLeaves(taskValue, path);
    leaves.push(...taskResult.leaves);
    invalid.push(...taskResult.invalid);
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
  AI_INSTRUCTION_TASK_LIMIT,
  codePointLength,
  collectAiInstructionLeaves,
  measureAiInstructions,
};
