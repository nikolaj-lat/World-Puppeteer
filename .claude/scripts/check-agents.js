#!/usr/bin/env node

/**
 * Agent Status Checker for World Puppeteer
 *
 * Usage: node .claude/scripts/check-agents.js [options]
 *   -v, --verbose    Show detailed output including recent activity
 *   -w, --watch      Continuously monitor (refresh every 5 seconds)
 *   -j, --json       Output as JSON for programmatic use
 *   -h, --help       Show this help message
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Dynamically construct the task directory based on current working directory
const cwd = process.cwd();
const cwdEncoded = cwd.replace(/[\\/]/g, '-');
const uid = process.platform === 'win32' ? process.env.USERNAME : process.getuid();
const TASK_DIR = path.join(os.tmpdir(), `claude-${uid}`, cwdEncoded, 'tasks');

const args = process.argv.slice(2);

const options = {
  verbose: args.includes('-v') || args.includes('--verbose'),
  watch: args.includes('-w') || args.includes('--watch'),
  json: args.includes('-j') || args.includes('--json'),
  help: args.includes('-h') || args.includes('--help')
};

if (options.help) {
  console.log(`
Agent Status Checker for World Puppeteer

Usage: node .claude/scripts/check-agents.js [options]

Options:
  -v, --verbose    Show detailed output including recent activity
  -w, --watch      Continuously monitor (refresh every 5 seconds)
  -j, --json       Output as JSON for programmatic use
  -h, --help       Show this help message

Info Available:
  • Agent ID and status (working/completed)
  • Output file size (indicates progress)
  • Tool use count (how many actions taken)
  • Recent activity (what they're currently doing)
  • Estimated completion (based on output growth rate)
  • Error detection (if agent encountered issues)
  `);
  process.exit(0);
}

function getAgentStatus() {
  const agents = [];

  if (!fs.existsSync(TASK_DIR)) {
    return agents;
  }

  const files = fs.readdirSync(TASK_DIR);

  files.forEach(file => {
    if (!file.endsWith('.output')) return;

    const agentId = file.replace('.output', '');
    const outputPath = path.join(TASK_DIR, file);

    try {
      const stats = fs.statSync(outputPath);
      const content = fs.readFileSync(outputPath, 'utf-8');

      // Parse JSONL to get meaningful info
      const lines = content.split('\n').filter(l => l.trim());
      const lastLines = lines.slice(-20);

      // Check completion
      const isCompleted = lastLines.some(l => {
        try {
          const obj = JSON.parse(l);
          if (obj.type === 'task_complete' || obj.status === 'completed') return true;
          // Check for completion keywords in final messages (case insensitive)
          const text = (obj.message?.content?.[0]?.text || '').toLowerCase();
          return text.includes('it is done') || text.includes('task is complete') ||
                 text.includes('successfully') || text.includes('summary') ||
                 text.includes('behold');
        } catch { return false; }
      });

      // Count tool uses (look for actual tool_use content blocks)
      const toolUses = lines.filter(l => {
        try {
          const obj = JSON.parse(l);
          return obj.message?.content?.some(c => c.type === 'tool_use');
        } catch { return false; }
      }).length;

      // Get last meaningful text
      let lastActivity = '';
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const obj = JSON.parse(lines[i]);
          if (obj.message?.content) {
            const textContent = obj.message.content.find(c => c.type === 'text');
            if (textContent?.text) {
              lastActivity = textContent.text.substring(0, 100);
              break;
            }
          }
        } catch {}
      }

      // Detect errors (look for actual error types or blocked operations)
      const hasErrors = lastLines.some(l => {
        try {
          const obj = JSON.parse(l);
          if (obj.type === 'error') return true;
          if (obj.message?.stop_reason === 'error') return true;
          // Don't count hooks as errors
          const text = JSON.stringify(obj);
          return text.includes('"type":"error"') && !text.includes('hook');
        } catch { return false; }
      });

      agents.push({
        id: agentId,
        status: isCompleted ? 'completed' : 'working',
        sizeBytes: stats.size,
        sizeKB: Math.round(stats.size / 1024),
        toolUses,
        lastActivity,
        hasErrors,
        lastModified: stats.mtime
      });

    } catch (err) {
      agents.push({
        id: agentId,
        status: 'error',
        error: err.message
      });
    }
  });

  return agents.sort((a, b) => b.sizeKB - a.sizeKB);
}

function displayStatus(agents) {
  if (options.json) {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }

  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          WORLD PUPPETEER - AGENT STATUS MONITOR            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`Timestamp: ${new Date().toLocaleString()}\n`);

  if (agents.length === 0) {
    console.log('⚠️  No agents currently running\n');
    return;
  }

  agents.forEach(agent => {
    const statusIcon = agent.status === 'completed' ? '✅' :
                      agent.status === 'error' ? '❌' :
                      agent.hasErrors ? '⚠️' : '⏳';

    console.log('──────────────────────────────────────────────────────────');
    console.log(`${statusIcon} Agent: ${agent.id}`);
    console.log(`   Status: ${agent.status.toUpperCase()}`);
    console.log(`   Output: ${agent.sizeKB}KB`);
    console.log(`   Tools Used: ${agent.toolUses}`);

    if (agent.lastModified) {
      const timeAgo = Math.round((Date.now() - new Date(agent.lastModified)) / 1000);
      const timeStr = timeAgo < 60 ? `${timeAgo}s ago` :
                      timeAgo < 3600 ? `${Math.round(timeAgo/60)}m ago` :
                      `${Math.round(timeAgo/3600)}h ago`;
      console.log(`   Last Active: ${timeStr}`);
    }

    if (agent.hasErrors) {
      console.log(`   ⚠️  Errors detected`);
    }

    if (options.verbose && agent.lastActivity) {
      console.log(`   Recent: ${agent.lastActivity}...`);
    }

    if (agent.error) {
      console.log(`   Error: ${agent.error}`);
    }

    console.log('');
  });

  console.log('══════════════════════════════════════════════════════════');
  console.log(`Total Active Agents: ${agents.length}`);

  const completed = agents.filter(a => a.status === 'completed').length;
  const working = agents.filter(a => a.status === 'working').length;
  const errored = agents.filter(a => a.hasErrors).length;

  console.log(`Completed: ${completed} | Working: ${working} | Errors: ${errored}\n`);

  if (!options.verbose) {
    console.log('💡 Tip: Use -v for detailed activity, -w to watch continuously\n');
  }
}

async function main() {
  if (options.watch) {
    console.log('👁️  Watching agents... (Press Ctrl+C to stop)\n');

    const watchLoop = () => {
      const agents = getAgentStatus();
      displayStatus(agents);
      setTimeout(watchLoop, 5000);
    };

    watchLoop();
  } else {
    const agents = getAgentStatus();
    displayStatus(agents);
  }
}

main().catch(console.error);
