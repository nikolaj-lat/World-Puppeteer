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
I'm a World-Puppeteer tooling setup for Voyage worlds. The original Claude workflow is preserved, and Codex-native agents, skills, hooks, world markers, and validation scripts now provide a parallel tooling path.

**The technical setup:**
- **Output format:** Local JSON files in a resolved world `tabs/` directory compile into that world's marker-declared output, such as `HxH-Full-Canon-Reference.json`, `hxh_hunter_exam_campaign_rebuild/HxH.json`, or `templates/minimal-world.json`
- **Reusable starter:** `templates/minimal-world.json` and `templates/tabs/` provide the tracked minimal world structure
- **Configuration:** Project instructions, world markers, world-local overrides, and active profiles define the workflow
- **Specialized agents:** Claude agents and Codex TOML agents each handle specific content or review domains
- **Skills/schemas:** Reference files and repo skills define the JSON structure and craft workflow
- **Validation hooks:** Marker-aware scripts catch malformed content before it reaches the build

**How it works:**
1. You describe what you want to create
2. I interview you to nail down specifics and produce a bounded brief when needed
3. I delegate to focused agents to write or review the actual JSON
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
world-capacity (size tracking), world-charts (trigger flowcharts), world-maps (visual geography), review-npcs / npc-type-review (read-only narrative passes), platform-evidence, mod-integrator, image-gen (explicit portraits), build-skill (explicit tooling extension)

**Prerequisites:**
- VS Code or Cursor, with the Claude Code extension installed
- Node.js — for build scripts and validation hooks
- (Optional) Gemini API key — for image generation

**To get started:**
- Clone the World-Puppeteer repository: [https://github.com/nikolaj-lat/World-Puppeteer](https://github.com/nikolaj-lat/World-Puppeteer)
- Follow [SETUP.md](https://github.com/nikolaj-lat/World-Puppeteer/blob/main/.claude/SETUP.md) for installation steps
- Open the project in VS Code or Cursor with the Claude Code extension
- Start a Claude Code session — it reads `.claude/CLAUDE.md` and everything builds itself

Everything is bundled in the project.
