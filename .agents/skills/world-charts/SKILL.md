---
name: world-charts
description: Generate a bounded output HTML Mermaid flowchart for trigger relationships in a resolved World-Puppeteer world.
context: fork
agent: world-charts
---

# World Charts

Generate a mermaid flowchart from the resolved triggers source. Output only to `<resolved-world>/stuff/trigger-chart.html`.

This skill may create the resolved world's ignored `stuff/` directory if absent. It must not edit files under `<TABS_PATH>/`, markers, profiles, instructions, generated world JSON, other reports, or other worlds. After writing, run a diff/status check and fail if any unexpected path changed.

## Design Principles

- **Organized sections**: Group related triggers into labeled subgraphs
- **Decision trees**: Use diamond nodes `{}` for branching logic
- **Detailed nodes**: Include descriptions, not just names
- **Visual hierarchy**: Flow from top to bottom, sidebars for reference data
- **Emoji labels**: Use icons to distinguish section types

## Mermaid Structure

```mermaid
flowchart TD
    subgraph SECTION1["🎮 SECTION TITLE"]
        NODE1["Description"]
    end

    subgraph SECTION2["🔴 ANOTHER SECTION"]
        DECISION{"Question?"}
        DECISION -->|Option A| RESULT_A["Result A"]
        DECISION -->|Option B| RESULT_B["Result B"]
    end

    subgraph SIDEBAR["📋 REFERENCE DATA"]
        ITEM1["1: Name<br/>Description<br/>Details"]
        ITEM2["2: Name<br/>Description<br/>Details"]
    end

    NODE1 --> DECISION
    RESULT_A --> SIDEBAR
```

## Node Types

- **Start nodes**: `["Label"]` - rectangles
- **Decision nodes**: `{"Question?"}` - diamonds
- **Multi-line content**: Use `<br/>` for line breaks
- **Connections**: `-->|"label"| ` for labeled edges

## Analyzing Triggers

1. Identify trigger categories (setup, gameplay, context, etc.)
2. Find decision points (conditions that branch)
3. Map cause → effect relationships
4. Group related triggers into subgraphs
5. Create sidebar for reference data (characters, locations, items)

## HTML Template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Trigger Chart</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body { background: #1a1a1a; padding: 40px; font-family: system-ui; color: #e0e0e0; }
    h1 { color: #fff; text-align: center; margin-bottom: 40px; }
    .mermaid { background: #252525; padding: 40px; border-radius: 12px; }
  </style>
</head>
<body>
  <h1>Game Flow</h1>
  <pre class="mermaid">
flowchart TD
    %% Content here
  </pre>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      flowchart: { curve: 'basis', padding: 20, nodeSpacing: 50, rankSpacing: 60 }
    });
  </script>
</body>
</html>
```

## Section Patterns

**Game start**:
```
subgraph START["🎮 GAME START"]
    BEGIN["Player Begins"]
end
```

**Branching logic**:
```
subgraph BRANCH["🔴 SECTION NAME"]
    QUESTION{"Condition?"}
    QUESTION -->|Yes| PATH_A["Result A"]
    QUESTION -->|No| PATH_B["Result B"]
end
```

**Reference sidebar**:
```
subgraph SIDEBAR["📋 REFERENCE"]
    ITEM1["1: Name<br/>Description<br/>Type: Value"]
    ITEM2["2: Name<br/>Description<br/>Type: Value"]
end
```

**Gameplay section**:
```
subgraph GAMEPLAY["🔴 DURING GAMEPLAY"]
    EVENT1["📋 EVENT NAME<br/>Description line 1<br/>Description line 2"]
    EVENT2["⚔️ ANOTHER EVENT<br/>More details"]
end
```

## Steps

1. Read the resolved triggers file at `<TABS_PATH>/triggers.json`
2. Categorize triggers by purpose (setup, selection, gameplay, context)
3. Identify decision points and branching conditions
4. Extract reference data (characters, locations, items) for sidebars
5. Build flowchart with labeled subgraphs
6. Connect sections with meaningful flow
7. Write to `stuff/trigger-chart.html`
8. Open in browser
