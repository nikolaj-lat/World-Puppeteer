const fs = require('fs');
const path = require('path');

// Mapping of region names to portrait keys
const regionMapping = {
  "Republic of Padokea": "Republic of Padokea",
  "Arena City": "Heavens Arena",
  "Yorknew & Environs": "Yorknew City",
  "Mitene Union": "NGL",
  "Kakin Empire": "Kakin Empire",
  "Greed Island — Settled Lands": "Greed Island",
  "Greed Island — Wilds": "Greed Island",
  "Lake Mobius — The Voyage": "Black Whale",
  "The New Shore": "Dark Continent",
  "The Exam Circuit": "Zaban City",
  "Whale Island & Southern Seas": "Whale Island",
  "Swardani City": "Hunter Association"
};

// Read the portraits file
const portraitsPath = path.join(__dirname, 'stuff', 'portraits.json');
const portraits = JSON.parse(fs.readFileSync(portraitsPath, 'utf8'));

// Read the regions file
const regionsPath = path.join(__dirname, 'tabs', 'regions.json');
const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));

let appliedCount = 0;
const missingKeys = [];

// Update each region
for (const [regionName, portraitKey] of Object.entries(regionMapping)) {
  if (regionsData.regions[regionName]) {
    if (portraits[portraitKey]) {
      regionsData.regions[regionName].imageUrl = portraits[portraitKey];
      appliedCount++;
    } else {
      missingKeys.push(portraitKey);
    }
  }
}

// Write the updated regions file with 2-space indent
fs.writeFileSync(regionsPath, JSON.stringify(regionsData, null, 2) + '\n', 'utf8');

console.log(`Applied: ${appliedCount} region image URLs`);
if (missingKeys.length > 0) {
  console.log(`Missing keys: ${missingKeys.join(', ')}`);
}
