#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  resolveWorld,
  runTransactionalFileMutation,
} = require('./world-puppeteer-lib.cjs');
const {
  MOD_ATTRIBUTION,
  runNameFilterCommand,
} = require('./name-filter-tool.cjs');
const prettyPrint = require('./pretty-print.js');

const repoRoot = path.resolve(__dirname, '../..');
const failures = [];
const scratchRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'world-puppeteer-transactional-')
);

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertThrows(fn, matcher, message) {
  try {
    fn();
    failures.push(`${message}: expected error`);
  } catch (error) {
    assert(matcher.test(error.message), `${message}: ${error.message}`);
    return error;
  }
  return null;
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function writeJson(filePath, value) {
  writeText(filePath, JSON.stringify(value, null, 2) + '\n');
}

function marker(id, role = 'editable', overrides = {}) {
  return {
    schemaVersion: 1,
    id,
    name: id,
    role,
    format: 'voyage-v33',
    paths: {
      tabs: 'tabs',
      compiledOutput: `${id}.json`,
      instructions: 'AGENTS.override.md',
    },
    toolchain: {
      formatProfile: 'voyage-json-tabs',
      buildProfile: 'world-build-cjs',
      validationProfiles: ['voyage-local-validator'],
    },
    activeProfiles: [],
    ...overrides,
  };
}

function minimalWorldConfig(label) {
  return {
    configVersion: 'V33',
    heroesVersion: '1.0.0',
    storySettings: { worldBackground: label },
    aiInstructions: {},
    worldLore: {},
    embeddings: {},
    triggers: [],
    storyStarts: [],
    abilities: {},
    npcTypes: {},
    items: {},
    realms: {},
    regions: {},
    locations: {},
    factions: {},
    npcs: {},
    quests: {},
    attributeSettings: {},
    skills: {},
    skillSettings: {},
    traits: {},
    traitCategories: {},
    locationSettings: {},
    itemSettings: {},
    combatSettings: {},
    otherSettings: {},
    tipSettings: {},
    resourceSettings: {},
    death: {},
    nameFilterSettings: {},
    narratorStyle: {},
    premadeCharacters: [],
    authorSeeds: [],
    characterArchetypes: {},
    locationArchetypes: {},
    regionArchetypes: {},
    encounterElements: {},
    randomNames: {},
    mods: [],
  };
}

function createWorld(name, tabs = {}) {
  const root = path.join(scratchRoot, name);
  writeJson(path.join(root, '.world-puppeteer.json'), marker(name));
  writeText(path.join(root, 'AGENTS.override.md'), '# fixture instructions\n');
  for (const [fileName, value] of Object.entries(tabs)) {
    const filePath = path.join(root, 'tabs', fileName);
    if (typeof value === 'string') {
      writeText(filePath, value);
    } else {
      writeJson(filePath, value);
    }
  }
  return root;
}

function runNode(args, cwd = repoRoot) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
  });
}

function tryCreateSymlink(target, linkPath, type) {
  try {
    fs.symlinkSync(target, linkPath, type);
    return true;
  } catch (error) {
    const message = String(error && error.message);
    if (
      error.code === 'EPERM' ||
      error.code === 'EACCES' ||
      /privilege|not held/i.test(message)
    ) {
      return false;
    }
    throw error;
  }
}

try {
  {
    const root = path.join(scratchRoot, 'transaction-rollback');
    const firstPath = path.join(root, 'first.json');
    const secondPath = path.join(root, 'second.json');
    writeText(firstPath, '{"first":true}\n');
    writeText(secondPath, '{"second":true}\n');

    assertThrows(
      () =>
        runTransactionalFileMutation(
          [
            { path: firstPath, content: '{"first":false}\n' },
            { path: secondPath, content: '{"second":false}\n' },
          ],
          ({ recordCleanupPath }) => {
            const tempPath = path.join(root, 'transaction.tmp');
            writeText(tempPath, 'temporary\n');
            recordCleanupPath(tempPath);
            throw new Error('simulated build failure');
          }
        ),
      /simulated build failure/,
      'transaction helper must surface the primary downstream failure'
    );
    assert(
      read(firstPath) === '{"first":true}\n',
      'transaction helper must restore the first modified file after downstream failure'
    );
    assert(
      read(secondPath) === '{"second":true}\n',
      'transaction helper must restore the second modified file after downstream failure'
    );
    assert(
      !fs.existsSync(path.join(root, 'transaction.tmp')),
      'transaction helper must remove recorded temporary files after downstream failure'
    );
  }

  {
    const worldRoot = createWorld('name-filter-failure', {
      'meta.json': {
        mods: [],
        randomNames: {},
      },
    });
    const metaPath = path.join(worldRoot, 'tabs', 'meta.json');
    const originalText = read(metaPath);

    assertThrows(
      () =>
        runNameFilterCommand({
          argv: ['--world', worldRoot],
          invocationPath: 'test-name-filter',
          runConfiguredBuildImpl() {
            return {
              status: 1,
              stdout: '',
              stderr: 'forced build failure',
              error: null,
            };
          },
        }),
      /Configured build failed: forced build failure/,
      'name-filter must fail when the configured build fails'
    );
    assert(
      read(metaPath) === originalText,
      'name-filter must restore meta.json byte-for-byte after a failed build'
    );
  }

  {
    const worldRoot = createWorld('name-filter-success', {
      'meta.json': {
        mods: [],
        randomNames: {},
      },
    });
    const metaPath = path.join(worldRoot, 'tabs', 'meta.json');

    const status = runNameFilterCommand({
      argv: ['--world', worldRoot],
      invocationPath: 'test-name-filter',
      runConfiguredBuildImpl() {
        return {
          status: 0,
          stdout: '',
          stderr: '',
          error: null,
        };
      },
    });
    assert(status === 0, 'name-filter must return success after a successful build');

    const parsed = JSON.parse(read(metaPath));
    assert(
      parsed.nameFilterSettings &&
        Object.keys(parsed.nameFilterSettings).length > 0,
      'name-filter must retain injected filters after a successful build'
    );
    assert(
      Array.isArray(parsed.mods) &&
        parsed.mods.some(
          (entry) =>
            entry.shortId === MOD_ATTRIBUTION.shortId &&
            entry.version === MOD_ATTRIBUTION.version
        ),
      'name-filter must retain mod attribution after a successful build'
    );
  }

  {
    const claudeWrapper = require(path.join(
      repoRoot,
      '.claude/skills/name-filter-settings/scripts/name-filter.js'
    ));
    const codexWrapper = require(path.join(
      repoRoot,
      '.agents/skills/name-filter-settings/scripts/name-filter.js'
    ));
    assert(
      claudeWrapper.runNameFilterCli === codexWrapper.runNameFilterCli,
      'Claude and Codex name-filter wrappers must export the same canonical implementation'
    );
  }

  {
    const sentinel = '" with practiced efficiency"';
    const dataText = read(
      path.join(repoRoot, '.claude/scripts/name-filter-settings.data.json')
    );
    const toolText = read(
      path.join(repoRoot, '.claude/scripts/name-filter-tool.cjs')
    );
    const claudeWrapperText = read(
      path.join(
        repoRoot,
        '.claude/skills/name-filter-settings/scripts/name-filter.js'
      )
    );
    const codexWrapperText = read(
      path.join(
        repoRoot,
        '.agents/skills/name-filter-settings/scripts/name-filter.js'
      )
    );

    assert(
      dataText.includes(sentinel),
      'shared name-filter payload file must own the canonical filter data'
    );
    assert(
      !toolText.includes(sentinel) &&
        !claudeWrapperText.includes(sentinel) &&
        !codexWrapperText.includes(sentinel),
      'name-filter payload must not be duplicated in the tool or frontend wrappers'
    );
    assert(
      !toolText.includes("execFileSync('node'") &&
        !toolText.includes('spawnSync(\'node\'') &&
        !claudeWrapperText.includes('child_process') &&
        !codexWrapperText.includes('child_process'),
      'name-filter entry points must not assume a literal node executable on PATH'
    );
  }

  {
    const scripts = [
      '.claude/skills/name-filter-settings/scripts/name-filter.js',
      '.agents/skills/name-filter-settings/scripts/name-filter.js',
    ];

    for (const script of scripts) {
      const unknown = runNode([script, '--bogus']);
      assert(
        unknown.status !== 0 &&
          /Unknown option: --bogus/.test(`${unknown.stdout}\n${unknown.stderr}`),
        `${script}: unknown option parsing must be strict`
      );

      const missing = runNode([script, '--world']);
      assert(
        missing.status !== 0 &&
          /--world requires a value/.test(`${missing.stdout}\n${missing.stderr}`),
        `${script}: missing world value parsing must be strict`
      );

      const positional = runNode([script, 'unexpected']);
      assert(
        positional.status !== 0 &&
          /Unexpected positional argument: unexpected/.test(
            `${positional.stdout}\n${positional.stderr}`
          ),
        `${script}: unexpected positional parsing must be strict`
      );

      const help = runNode([script, '--help']);
      assert(
        help.status === 0 && /Usage:/.test(help.stdout),
        `${script}: help output must succeed`
      );
    }
  }

  {
    const worldRoot = createWorld('pretty-print-invalid', {
      'a.json': '{"alpha":1}\n',
      'b.json': '{ broken\n',
    });
    const target = {
      tabsPath: resolveWorld({
        worldRoot,
        preferNearest: false,
      }).tabsPath,
    };
    const beforeA = read(path.join(target.tabsPath, 'a.json'));
    const result = prettyPrint.formatPrettyPrintTarget(target);

    assert(result.status === 1, 'pretty-print must fail when any later file is malformed');
    assert(
      result.errors.length === 1 &&
        /error: b\.json - /.test(result.errors[0]),
      'pretty-print must report malformed JSON errors'
    );
    assert(
      read(path.join(target.tabsPath, 'a.json')) === beforeA,
      'pretty-print must leave earlier valid files byte-for-byte unchanged when a later file is malformed'
    );
  }

  {
    const worldRoot = createWorld('pretty-print-valid', {
      'a.json': '{"alpha":1}\n',
      'b.json': '{"beta":2}\n',
    });
    const target = {
      tabsPath: resolveWorld({
        worldRoot,
        preferNearest: false,
      }).tabsPath,
    };
    const result = prettyPrint.formatPrettyPrintTarget(target);

    assert(result.status === 0, 'pretty-print must succeed for valid tabs');
    assert(
      read(path.join(target.tabsPath, 'a.json')) === '{\n  "alpha": 1\n}\n',
      'pretty-print must rewrite valid files with canonical indentation'
    );
    assert(
      read(path.join(target.tabsPath, 'b.json')) === '{\n  "beta": 2\n}\n',
      'pretty-print must format each valid JSON file'
    );
  }

  {
    const worldRoot = createWorld('pretty-print-paths', {
      'a.json': '{"alpha":1}\n',
    });
    const tabsPath = resolveWorld({
      worldRoot,
      preferNearest: false,
    }).tabsPath;

    fs.mkdirSync(path.join(tabsPath, 'nested'));
    assertThrows(
      () => prettyPrint.planPrettyPrint(tabsPath),
      /must be flat/,
      'pretty-print must reject nested directories through the shared tabs policy'
    );
    fs.rmSync(path.join(tabsPath, 'nested'), {
      recursive: true,
      force: true,
    });

    const targetFile = path.join(tabsPath, 'a.json');
    const linkPath = path.join(tabsPath, 'linked.json');
    if (tryCreateSymlink(targetFile, linkPath, 'file')) {
      assertThrows(
        () => prettyPrint.planPrettyPrint(tabsPath),
        /symlinked entry/,
        'pretty-print must reject symlinked entries through the shared tabs policy'
      );
      fs.rmSync(linkPath, { force: true });
    }

    const notesPath = path.join(worldRoot, 'notes');
    fs.mkdirSync(notesPath, { recursive: true });
    assertThrows(
      () =>
        prettyPrint.resolvePrettyPrintTarget({
          cwd: repoRoot,
          positionals: [notesPath],
        }),
      /must resolve to a world tabs directory/,
      'pretty-print positional paths must stay contained to the resolved tabs directory'
    );
  }

  {
    const worldRoot = createWorld('pretty-print-unchanged', {
      'changed.json': '{"alpha":1}\n',
      'unchanged.json': '{\n  "beta": 2\n}\n',
    });
    const target = {
      tabsPath: resolveWorld({
        worldRoot,
        preferNearest: false,
      }).tabsPath,
    };
    const writesByFile = new Map();
    const fsProxy = {
      ...fs,
      writeFileSync(filePath, content) {
        const key = path.basename(filePath);
        writesByFile.set(key, (writesByFile.get(key) || 0) + 1);
        return fs.writeFileSync(filePath, content);
      },
    };

    const result = prettyPrint.formatPrettyPrintTarget(target, {
      fsImpl: fsProxy,
    });

    assert(result.status === 0, 'pretty-print unchanged-file test must succeed');
    assert(
      writesByFile.get('changed.json') === 1,
      'pretty-print must write changed files exactly once'
    );
    assert(
      !writesByFile.has('unchanged.json'),
      'pretty-print must not rewrite files whose formatted bytes are unchanged'
    );
  }
} finally {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('transactional tooling tests passed');
