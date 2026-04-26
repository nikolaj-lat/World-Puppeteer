#!/usr/bin/env node

/**
 * Agent Completion Hook - Injects agent completion summary into Claude's context
 *
 * PostToolUse hook for Task tool - fires when an agent completes
 * Receives hook input via stdin, outputs additionalContext for Claude
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEBUG_LOG = path.join(os.tmpdir(), 'agent-completed-debug.log');
const DEBUG = false;

function debug(msg) {
  if (DEBUG) {
    fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
  }
}

async function main() {
  debug('Hook started');

  // Read hook input from stdin
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const hookData = JSON.parse(input);
  debug(`Parsed hookData: ${JSON.stringify(hookData)}`);

  // Only handle PostToolUse on Task
  if (hookData.hook_event_name !== 'PostToolUse' || hookData.tool_name !== 'Task') {
    return;
  }

  const toolInput = hookData.tool_input || {};
  const toolResponse = hookData.tool_response || {};

  const agentType = toolInput.subagent_type || 'unknown';
  const description = toolInput.description || '';
  const status = toolResponse.status || 'unknown';
  const duration = toolResponse.totalDurationMs ? Math.round(toolResponse.totalDurationMs / 1000) : 0;
  const toolCount = toolResponse.totalToolUseCount || 0;
  const tokens = toolResponse.totalTokens || 0;

  // Build a concise summary
  let summary = `${agentType} agent "${description}" ${status}`;
  summary += ` (${duration}s, ${toolCount} tools, ${tokens} tokens)`;

  debug(`Summary: ${summary}`);

  // Output JSON for Claude Code to inject
  const output = JSON.stringify({
    additionalContext: `[AGENT COMPLETED] ${summary}`
  });

  console.log(output);
}

main().catch(err => {
  debug(`ERROR: ${err.message}\n${err.stack}`);
  process.exit(0); // Don't fail the hook on errors
});
