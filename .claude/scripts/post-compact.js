#!/usr/bin/env node

/**
 * Post-Compaction Hook - Re-inject critical context after compaction
 *
 * Fires via SessionStart with matcher "compact"
 * Reminds Claude to re-read CLAUDE.md and restores awareness
 */

const fs = require('fs');
const path = require('path');

async function main() {
  // Read hook input from stdin
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const hookData = JSON.parse(input);

  // Only handle SessionStart from compaction
  if (hookData.hook_event_name !== 'SessionStart') {
    return;
  }

  // Check for any currently running background agents
  const transcriptPath = hookData.transcript_path;
  const sessionId = hookData.session_id;
  let agentStatus = '';

  if (transcriptPath && sessionId) {
    const projectDir = path.dirname(transcriptPath);
    const subagentsDir = path.join(projectDir, sessionId, 'subagents');

    if (fs.existsSync(subagentsDir)) {
      const files = fs.readdirSync(subagentsDir);
      const agentCount = files.filter(f => f.startsWith('agent-') && f.endsWith('.jsonl')).length;
      if (agentCount > 0) {
        agentStatus = ` You have ${agentCount} subagents from this session.`;
      }
    }
  }

  const contextMsg = `[POST-COMPACTION] Context was just compacted. IMPORTANT: Re-read .claude/CLAUDE.md to restore your persona and instructions.${agentStatus}`;

  const output = JSON.stringify({
    additionalContext: contextMsg,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: contextMsg
    }
  });

  console.log(output);
}

main().catch(() => process.exit(0));
