---
name: maps
description: Generate visual maps of the world showing realms, regions, and locations. Use when the user wants to see a map or visualize the world layout.
context: fork
agent: maps
---

# Maps

Generate a self-contained HTML map from world config data. Output to `stuff/world-map.html`.

## Design

- Squares = regions, circles = locations
- No text on map - hover tooltips show name, coordinates, radius, description

## Data Sources

```javascript
const settings = JSON.parse(fs.readFileSync('tabs/settings.json'))
const realms = JSON.parse(fs.readFileSync('tabs/realms.json'))
const regions = JSON.parse(fs.readFileSync('tabs/regions.json'))
const locations = JSON.parse(fs.readFileSync('tabs/locations.json'))

const regionSize = settings.locationSettings.regionSize // e.g., 100
const coordRange = regionSize / 2 // e.g., 50
```

## Coordinate System

- **Region coordinates** (in regions.json): Position within the realm grid (e.g., x:0, y:1)
- **Location coordinates** (in locations.json): Position within the region, where 0,0 is center
- `regionSize: 100` means location coordinates span -50 to 50
- **Y-axis**: Positive y goes UP (invert for CSS: `top = centerY - (loc.y * scale)`)

## Data Grouping

```javascript
// Group regions by realm
const realmRegions = {};
Object.entries(regions.regions).forEach(([key, r]) => {
  if (!realmRegions[r.realm]) realmRegions[r.realm] = [];
  realmRegions[r.realm].push({ key, ...r });
});

// Group locations by region
const locsByRegion = {};
Object.entries(locations.locations).forEach(([key, loc]) => {
  if (!locsByRegion[loc.region]) locsByRegion[loc.region] = [];
  locsByRegion[loc.region].push({ key, ...loc });
});
```

## Region Grid Layout

For each realm, build a grid from region x,y coordinates:

```javascript
function getGridBounds(regionList) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  regionList.forEach(r => {
    if (r.x !== undefined && r.y !== undefined) {
      minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x);
      minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y);
    }
  });
  return { minX, maxX, minY, maxY };
}
// Grid dimensions: (maxX - minX + 1) columns, (maxY - minY + 1) rows
```

## Location Positioning

Plot locations within their region cell using x,y coordinates relative to center:

```javascript
const coordRange = regionSize / 2; // e.g., 50
const scale = cellSize / (coordRange * 2);

// For each location:
const scaledDiameter = Math.max(6, loc.radius * 2 * scale);
const centerX = cellWidth / 2;
const centerY = cellHeight / 2;
const left = centerX + (loc.x * scale) - scaledDiameter / 2;
const top = centerY - (loc.y * scale) - scaledDiameter / 2; // NEGATIVE for y inversion
```

## Steps

1. Read config files (settings, realms, regions, locations)
2. Group regions by realm, locations by region
3. For each realm, determine grid bounds from region coordinates
4. Render realm as CSS grid, place regions at their x,y positions
5. Within each region cell, plot locations using the positioning formula
6. Add hover tooltips for regions (name, description) and locations (name, x, y, radius, description)
7. Write to `stuff/world-map.html`, open in browser
