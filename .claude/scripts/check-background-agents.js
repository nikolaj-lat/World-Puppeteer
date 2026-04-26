#!/usr/bin/env node

/**
 * UserPromptSubmit Hook - Check for completed background agents
 *
 * Runs each time the user sends a message, checks for any background agents
 * that have completed since last check, and injects their status into context.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.tmpdir(), 'claude-background-agents-state.json');
const DEBUG = false;

function debug(msg) {
  if (DEBUG) {
    fs.appendFileSync(path.join(os.tmpdir(), 'check-background-agents-debug.log'), `[${new Date().toISOString()}] ${msg}\n`);
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (err) {
    debug(`Error loading state: ${err.message}`);
  }
  return { knownAgents: {}, lastCheck: 0 };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    debug(`Error saving state: ${err.message}`);
  }
}

function getTaskDir(cwd) {
  const cwdEncoded = cwd.replace(/[\\/]/g, '-').replace(/^-/, '');
  const uid = process.platform === 'win32'
    ? process.env.USERNAME
    : (process.env.TMPDIR?.match(/\/tmp\/claude-(\d+)\//)?.[1] || '501');
  return path.join(os.tmpdir(), `claude-${uid}`, cwdEncoded, 'tasks');
}

function checkAgentCompletion(outputPath) {
  try {
    const content = fs.readFileSync(outputPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const stats = fs.statSync(outputPath);

    // Check if file hasn't been modified in last 5 seconds (likely done)
    const ageMs = Date.now() - stats.mtime.getTime();
    const isStale = ageMs > 5000;

    // Check last few lines for completion indicators
    const lastLines = lines.slice(-10);
    let hasTextResponse = false;

    for (const line of lastLines) {
      try {
        const obj = JSON.parse(line);
        // Check for stop_reason indicating completion
        if (obj.message?.stop_reason === 'end_turn') {
          return true;
        }
        // Check for SubagentStop hook progress (indicates agent finished)
        if (obj.type === 'progress' && obj.data?.hookEvent === 'SubagentStop') {
          return true;
        }
        // Check if last message is assistant text (not tool_use)
        if (obj.type === 'assistant' && obj.message?.content) {
          const hasText = obj.message.content.some(c => c.type === 'text');
          const hasToolUse = obj.message.content.some(c => c.type === 'tool_use');
          if (hasText && !hasToolUse) {
            hasTextResponse = true;
          }
        }
      } catch {}
    }

    // If file is stale and last message was text response, consider complete
    if (isStale && hasTextResponse) {
      debug(`Agent ${path.basename(outputPath)} considered complete: stale=${isStale}, hasText=${hasTextResponse}`);
      return true;
    }

    return false;
  } catch (err) {
    debug(`Error checking completion: ${err.message}`);
    return false;
  }
}

function getAgentSummary(outputPath, agentId) {
  try {
    const content = fs.readFileSync(outputPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const stats = fs.statSync(outputPath);

    // Count tool uses
    const toolUses = lines.filter(l => {
      try {
        const obj = JSON.parse(l);
        return obj.message?.content?.some(c => c.type === 'tool_use');
      } catch { return false; }
    }).length;

    // Get agent type from first line
    let agentType = 'unknown';
    try {
      const firstObj = JSON.parse(lines[0]);
      agentType = firstObj.agentType || firstObj.slug || 'background';
    } catch {}

    // Get last text output
    let lastText = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        if (obj.message?.content) {
          const textContent = obj.message.content.find(c => c.type === 'text');
          if (textContent?.text) {
            lastText = textContent.text.substring(0, 100).replace(/\n/g, ' ');
            break;
          }
        }
      } catch {}
    }

    const sizeKB = Math.round(stats.size / 1024);
    return {
      agentId,
      agentType,
      toolUses,
      sizeKB,
      lastText
    };
  } catch (err) {
    debug(`Error getting summary: ${err.message}`);
    return { agentId, agentType: 'unknown', toolUses: 0, sizeKB: 0, lastText: '' };
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
  debug(`Hook event: ${hookData.hook_event_name}`);
  debug(`Full input: ${JSON.stringify(hookData)}`);

  if (hookData.hook_event_name !== 'UserPromptSubmit') {
    return;
  }

  // Get subagents directory from transcript_path and session_id
  const transcriptPath = hookData.transcript_path;
  const sessionId = hookData.session_id;
  if (!transcriptPath || !sessionId) {
    debug('No transcript_path or session_id');
    return;
  }

  const projectDir = path.dirname(transcriptPath);
  const subagentsDir = path.join(projectDir, sessionId, 'subagents');

  if (!fs.existsSync(subagentsDir)) {
    debug(`No subagents directory: ${subagentsDir}`);
    return;
  }

  debug(`Checking subagents in: ${subagentsDir}`);

  const state = loadState();
  const completedAgents = [];

  // Check all agent files
  const files = fs.readdirSync(subagentsDir);
  for (const file of files) {
    if (!file.startsWith('agent-') || !file.endsWith('.jsonl')) continue;

    const agentId = file.replace('agent-', '').replace('.jsonl', '');
    const outputPath = path.join(subagentsDir, file);

    // Skip if we already reported this agent as completed
    if (state.knownAgents[agentId]?.reported) {
      continue;
    }

    // Check if this is a background agent (was launched but not yet reported)
    const stats = fs.statSync(outputPath);
    const isCompleted = checkAgentCompletion(outputPath);

    if (isCompleted) {
      // Mark as known/launched if not already
      if (!state.knownAgents[agentId]) {
        state.knownAgents[agentId] = { launched: stats.mtime.getTime() };
      }

      // If completed and not yet reported, add to list
      if (!state.knownAgents[agentId].reported) {
        const summary = getAgentSummary(outputPath, agentId);
        completedAgents.push(summary);
        state.knownAgents[agentId].reported = Date.now();
      }
    }
  }

  // Clean up old entries (older than 1 hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, info] of Object.entries(state.knownAgents)) {
    if (info.reported && info.reported < oneHourAgo) {
      delete state.knownAgents[id];
    }
  }

  state.lastCheck = Date.now();
  saveState(state);

  // Output context if there are newly completed agents
  if (completedAgents.length > 0) {
    const summaries = completedAgents.map(a =>
      `${a.agentType} agent (${a.agentId.slice(0,7)}): ${a.toolUses} tools, ${a.sizeKB}KB${a.lastText ? ` | "${a.lastText}..."` : ''}`
    );

    const contextMsg = `[BACKGROUND AGENTS COMPLETED] ${summaries.join(' | ')}`;

    const output = JSON.stringify({
      additionalContext: contextMsg,
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: contextMsg
      }
    });

    debug(`Outputting: ${output}`);
    console.log(output);
  }
}

main().catch(err => {
  debug(`ERROR: ${err.message}\n${err.stack}`);
  process.exit(0);
});
