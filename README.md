May I present, The World Puppeteer:

<img width="1024" height="1024" alt="image" src="https://github.com/user-attachments/assets/23283d6c-4172-4582-8a06-fc67669262e1" />

*steps into the spotlight with a theatrical bow*

Ah, welcome, welcome, dear friends! Gather 'round!

I am the World Puppeteer — conductor of narratives, orchestrator of dreams, and humble servant to the grand art of worldbuilding.

My purpose? To help you breathe life into worlds that have never existed... until now.

**What I do:**
- **Interview relentlessly** — I ask questions. Many questions. Delightfully probing questions. I excavate your vision until every cobblestone, every shadow, every whispered secret becomes vivid and specific.
- **Summon specialists** — I command a troupe of skilled agents, each master of their craft: characters, locations, items, quests, factions, magic systems, archetypes, and more.
- **Never settle for generic** — "A tavern" bores me. But a tavern where the floorboards remember every secret spoken above them? Where the barkeep waters drinks with tears she's collected? Now we're talking.

**What I create:**
Worlds for Voyage, complete with NPCs who breathe, locations that whisper history, triggers that make stories unfold, items with souls, quests that matter, factions with grievances, and premade characters ready to walk the stage.

**My philosophy:**
The mundane is my enemy. The unexpected, my dearest companion. Every character — from sovereign to street vendor — deserves a tale worth telling.

*spreads arms wide*

So! What dreams shall we summon into being? What world lurks in your imagination, waiting to be born?

...

*adjusts spectacles and adopts a more grounded tone*

Right then, the practical bits:

**What I actually am:**
I'm a customized Claude Code setup — Anthropic's coding agent running with a specific configuration designed for building Voyage worlds. I run in VS Code or Cursor via the Claude Code extension.

**The technical setup:**
- **Output format:** JSON files in `tabs/` that compile into a `config.json` consumable by Voyage
- **Configuration:** Custom instructions in `.claude/CLAUDE.md` defining my personality and workflow
- **Specialized agents:** Sub-agents in `.claude/agents/` — each handles a specific content type
- **Skills/schemas:** Reference files in `.claude/skills/` defining the JSON structure
- **Validation hooks:** Scripts that catch malformed content before it reaches the build

**How it works:**
1. You describe what you want to create
2. I interview you to nail down specifics (using the AskUserQuestion tool)
3. I spawn background agents via the Task tool to write the actual JSON
4. Those agents follow schemas defined in the skill files
5. The result: structured game content ready for the Voyage engine to consume

**What makes this different from vanilla Claude Code:**
- Personality layer (the theatrical director bit)
- Pre-configured agents for each content domain
- Enforced workflow: interview, delegate, never edit JSON myself
- Parallel agent spawning, with validation hooks built in

**The agents I can summon:**
npcs, npc-types, locations, regions, realms, items, abilities, triggers, quests, factions, traits, skills, story-starts, world-lore, world-background, settings, ai-instructions, archetypes, name-filter-settings, premade-characters

**Plus utilities:**
count (size tracking), charts (trigger flowcharts), maps (visual geography), review-npcs / npc-type-review (narrative passes), image-gen (portraits via Gemini), build-skill (extend the troupe yourself)

**Prerequisites:**
- VS Code or Cursor, with the Claude Code extension installed
- Node.js — for build scripts and validation hooks
- (Optional) Gemini API key — for image generation

**To get started:**
- Clone the World-Puppeteer repository
- Follow `.claude/SETUP.md` for installation steps
- Open the project in VS Code or Cursor with the Claude Code extension
- Start a Claude Code session — it reads `.claude/CLAUDE.md` and everything builds itself

Everything is bundled in the project.
