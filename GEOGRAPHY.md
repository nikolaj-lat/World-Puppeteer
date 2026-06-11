# GEOGRAPHY.md — Canonical Geography Registry (P4 blueprint)

Fixed key registry so realms/regions/locations agents, story starts (P8), arc triggers, and NPCs all reference identical names. Each Story Start anchors to a UNIQUE location (the arc-flag trigger keys on it — NEN-DESIGN §8).

## Realms (3)

1. **"The Known World"** — the six continents around (secretly) Lake Mobius. Default realm.
2. **"Greed Island"** — a Nen-construct island posing as a video game. Separate realm (locked decision).
3. **"The Dark Continent"** — Lake Mobius and beyond; contains the Black Whale voyage. EXTRAPOLATED content beyond ch. 410 flagged in lore.

## Regions & Locations (★ = story-start anchor location)

### Realm: The Known World

**"Whale Island & Southern Seas"** — Gon's home waters.
- "Whale Island" (areas: Mito's House, Harbor Village, Forest Heights)
- "Dolle Harbor" (areas: Docks, Market Street)

**"The Exam Circuit"** — the 287th Hunter Exam's scattered route, abstracted as one region.
- ★ "Zaban City" (areas: Exam Tunnel Entrance, Noodle Stand Front, Underground Hall) — **A1 START**
- "Milsy Wetlands" (areas: Fog Bank, Frog Hollow)
- "Visca Forest Preserve" (areas: Biska Forest Camp, Examiner's Clearing)
- "Trick Tower" (areas: Rooftop, Majority-Rules Block, Arena Pits)
- "Zevil Island" (areas: Landing Beach, Deep Jungle, Lookout Crag)
- "Final Selection Hall" (areas: Tournament Floor, Waiting Gallery)

**"Republic of Padokea"** — Zoldyck country.
- ★ "Kukuroo Mountain Base" (areas: Testing Gate, Servants' Quarters Path, Tourist Bus Stop) — **A2 START**
- "Zoldyck Estate" (areas: Butlers' Quarters, Training Grounds, Main House, Killua's Room... gated deep)
- "Dentora City" (areas: Airship Port, Old Town)

**"Arena City"** — the metropolis around the 251-floor tower.
- ★ "Heavens Arena" (areas: Registration Lobby, Lower Floors, Floor 200 Corridor, Floor Masters' Halls) — **A3 START**
- "Arena District" (areas: Fighters' Lodgings, Night Market)

**"Yorknew & Environs"** — auction season country.
- ★ "Yorknew City" (areas: Southernpiece Auction House, Hotel Beitacle, Flea Market, Underground Auction Hall) — **A4 START**
- "Cemetery Building" (areas: Grand Hall, Catacombs)
- "Lingon Airport" (areas: Terminal, Underground Tunnel)
- "Nostrade City Base" (areas: Operations Floor, Neon's Suite)

**"Mitene Union"** — NGL and East Gorteau.
- ★ "NGL Border Checkpoint" (areas: Quarantine Gate, Inspection Yard) — **A6 START**
- "NGL Interior" (areas: Villages, Colony Nest, Gyro's Factory Ruins)
- "Peijin" (areas: Capital Streets, Hideout Cellars)
- "East Gorteau Royal Palace" (areas: Central Stairway, Throne Hall, Dragon-Strike Courtyard, Komugi's Chamber)

**"Swardani City"** — Hunter Association seat.
- ★ "Hunter Association HQ" (areas: Election Hall, Chairman's Office, Press Floor) — **A7 START**
- "Harbview Hospital" (areas: Intensive Ward, Rooftop)
- "World Tree" (areas: Visitor Base, Upper Boughs)

**"Kakin Empire"** — the rising power.
- "Kakin Royal Capital" (areas: Royal Palace, Harbor of Ten Thousand Banners)

### Realm: Greed Island

**"Greed Island — Settled Lands"**
- ★ "Greed Island Gateway" (areas: Arrival Plain, Tutorial Stone) — **A5 START**
- "Antokiba" (areas: Town Square, Prize Hall)
- "Masadora" (areas: Spell Shop Row, Cliff Approach)
- "Soufrabi" (areas: Harbor, Razor's Pirate House)
- "Limeiro" (areas: Castle Gate, Clear-Bonus Chamber)

**"Greed Island — Wilds"**
- "Dorias Wastes" (areas: Bandit Camp, Monster Dens)
- "Mt. Kabool" (areas: Switchbacks, Wolf Pass)

### Realm: The Dark Continent

**"Lake Mobius — The Voyage"**
- ★ "The Black Whale" (areas: Tier 1 Royal Quarters, Tier 3 Steerage, Tier 4 Hold, Prince Woble's Suite, Banquet Hall, Brig) — **A8 START**

**"The New Shore"** ⚠ EXTRAPOLATED
- "Forbidden Landing" (areas: Beachhead Camp, Ruined Gate of the Ancients)

## Notes
- ~36 locations total; npcs/locations budgets comfortable (1M chars).
- Region `imageUrl`/location `imageUrl`: per D-006, official/wiki URLs where stable, else empty.
- Coordinates/paths: locations agent decides via map conventions; start locations must NOT share a region-cell with each other where avoidable (arc triggers key on exact location names, so uniqueness of the eight ★ keys is the hard requirement).
