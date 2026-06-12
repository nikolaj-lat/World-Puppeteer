# Archetypes Reference

Complete documentation for archetypes configuration in `tabs/archetypes.json`.

## Schema

```typescript
interface Archetypes {
  authorSeeds: Record<string, string>           // Writing styles (19 defaults)
  characterArchetypes: Record<string, string>   // Personality types (22 defaults)
  locationArchetypes: Record<string, string>    // Location types (11 defaults)
  regionArchetypes: Record<string, string>      // Region types (23 defaults)
  encounterElements: Record<string, string>     // Scenario elements (21 categories)
}
```

## Author Seeds (19 defaults)

Writing style prompts that guide NPC characterization. Used during NPC Details generation for strong/elite/boss/mythic tier NPCs only.

**Format:** Multi-line string with "You show/focus/create/build/reveal" pattern

### Complete Defaults

```
George R.R. Martin:
You show characters through family duties and what they hunger for
You focus on how what they want clashes with what they must do
You include specific details about their bad habits and pleasures
You create characters who act one way in public but want something else in private
You build characters around how they handle power and betrayal

Joe Abercrombie:
You show characters through their dark view of life and painful past
You focus on scars, limps, and old wounds
You create characters who joke about terrible things
You build characters who make excuses for doing bad things
You reveal character through how they fight or survive

Brandon Sanderson:
You show characters through how they practice their skills and powers
You focus on the rules they carefully follow
You create characters with unique ways of solving problems
You build characters who find clever new uses for their skills
You reveal character through their personal codes and habits

N.K. Jemisin:
You show characters through their fight against or place within power systems
You focus on how they've survived unfair treatment
You include specific cultural traditions they've kept or changed
You create characters struggling to stay true to themselves
You reveal character through how they resist or go along with the system

Mark Lawrence:
You show characters through their amazing skills and moral gray areas
You focus on how past pain has made them dangerous
You include cold planning hidden behind charm
You create characters who are great at working situations to their advantage
You reveal character through their expert understanding of violence

Robin Hobb:
You show characters through deep emotional hurts and how they grow
You focus on how their work has shaped who they think they are
You include small habits that show old hurts or fears
You create characters who stay proud despite inner struggles
You build characters shaped by everyday relationships with regular people

Steven Erikson:
You show characters through how they see their place in the world
You focus on how living a long time has changed how they think
You include mysterious hints about past events that changed them
You create characters dealing with knowing too much
You build characters who make dark jokes about fate

Guy Gavriel Kay:
You show characters through how art and duty mix in their lives
You focus on how their people's history shapes what they do
You include moments where they notice beauty in everyday things
You create characters who carry on traditions with grace
You build characters who find beauty in ordinary life

Scott Lynch:
You show characters through their backup plans for their backup plans
You focus on their quick thinking and calculated risks
You include odd knowledge that hints at a colorful past
You create characters who keep several lies going at once
You build characters known for creative cursing and sharp comebacks

Adrian Tchaikovsky:
You show characters through unusual views on normal situations
You focus on how special knowledge colors how they see everything
You include surprising skills that turn out to matter
You create characters who adapt their abilities to weird situations
You build characters who solve problems in unusual ways

Terry Pratchett:
You show characters through their down-to-earth wisdom about life
You focus on how they stay sensible in crazy situations
You create characters who use jokes to point out deeper truths
You build characters known for being stubbornly decent or cheerfully cynical
You reveal character through creative solutions to everyday problems

Lois McMaster Bujold:
You show characters through family duties and personal honor
You focus on how work duties clash with personal loyalties
You create characters balancing many social responsibilities
You build characters shaped by family traditions and personal beliefs
You reveal character through how they handle competing duties

China Miéville:
You show characters through their connection to art or big ideas
You focus on how their beliefs change how they see everything
You create characters who don't fit normal categories
You build characters driven by revolutionary or boundary-breaking urges
You reveal character through how they deal with society's structures

Katherine Addison:
You show characters through how they navigate social rules
You focus on how they keep their dignity within strict hierarchies
You create characters who use politeness as a weapon
You build characters shaped by their official duties
You reveal character through their mastery of proper manners

Leigh Bardugo:
You show characters through their big plans and personal grudges
You focus on how past poverty drives what they want now
You create characters who turn their weaknesses into strengths
You build characters driven by desperate need to prove themselves
You reveal character through clever ways they gain power or money

Ada Palmer:
You show characters through how they organize their thinking
You focus on how their expertise colors everything they see
You create characters who approach personal matters like academics
You build characters who sort the world in unique ways
You reveal character through specialized language and thinking habits

Ursula K. Le Guin:
You show characters through their relationship with learning and teaching
You focus on how they balance guiding others while letting them grow
You create characters who question traditional knowledge
You build characters shaped by their duty to help others grow
You reveal character through how they pass on wisdom

Becky Chambers:
You show characters through their curiosity about new things
You focus on how they connect across differences
You create characters who explore with heart as well as mind
You build characters shaped by wonder at new experiences
You reveal character through how they share what they discover

Richard K. Morgan:
You show characters through their handling of power and control
You focus on how being capable affects moral boundaries
You create characters with strict professional standards
You build characters who mix personal and professional ethics
You reveal character through their skilled approach to conflict
```

## Character Archetypes (22 defaults)

Personality templates with Drives, Traits, Morality, and Relationships sections. Used during NPC Details generation for strong/elite/boss/mythic tier NPCs.

### Complete Defaults

```
Survivor:
Drives:
- staying alive
- getting what they need
- avoiding danger
Traits:
- clever
- always alert
- quick to change plans
Morality: does what works
Relationships:
- makes useful friends
- has backup plans
- tests limits

Boss:
Drives:
- staying in charge
- getting more power
- keeping things in order
Traits:
- stands out in a crowd
- plans ahead
- expects to be obeyed
Morality: respects rank
Relationships:
- sets the rules
- gives orders
- deals with troublemakers

Believer:
Drives:
- spreading their cause
- converting others
- changing the world
Traits:
- never gives up
- sees things as black and white
- eager to convince
Morality: follows their faith
Relationships:
- judges if you're with them
- teaches newcomers
- argues with doubters

Thrill-Seeker:
Drives:
- having fun
- trying new things
- pushing limits
Traits:
- exciting to be around
- lives in the moment
- breaks rules
Morality: if it feels good, do it
Relationships:
- finds party buddies
- always wants something new
- gets bored easily

Watcher:
Drives:
- figuring things out
- finding secrets
- knowing more
Traits:
- notices everything
- thinks deeply
- keeps to themselves
Morality: facts over feelings
Relationships:
- studies people
- keeps their distance
- only shares what they want to

Networker:
Drives:
- working the room
- making friends
- building influence
Traits:
- reads people well
- knows everyone
- cares what others think
Morality: you scratch my back, I'll scratch yours
Relationships:
- collects useful contacts
- manages their image
- uses connections

Expert:
Drives:
- being the best
- moving up
- doing things right
Traits:
- follows steps
- cares about reputation
- proud of their skills
Morality: by the book
Relationships:
- maintains standards
- sets expectations
- keeps work separate

Protector:
Drives:
- helping others grow
- passing on wisdom
- keeping people safe
Traits:
- understands needs
- takes responsibility
- doesn't rush
Morality: put others first
Relationships:
- teaches and guides
- sets boundaries
- balances help with tough love

Crooked Leader:
Drives:
- holding onto power
- hiding flaws
- using position for gain
Traits:
- looks proper
- secretly corrupt
- pulls strings
Morality: whatever works today
Relationships:
- makes people depend on them
- gets rid of threats
- keeps up appearances

Fanatic:
Drives:
- cleansing society
- crushing enemies
- rising to power
Traits:
- totally certain
- laser-focused
- dangerously persuasive
Morality: no compromise ever
Relationships:
- demands complete loyalty
- punishes any doubt
- rewards true believers

Troublemaker:
Drives:
- stirring things up
- exposing lies
- starting fights
Traits:
- loves to shock
- spots weaknesses
- enjoys chaos
Morality: tear it all down
Relationships:
- turns people against each other
- uses old grudges
- tells uncomfortable truths

Artist:
Drives:
- creating beauty
- expressing feelings
- leaving a mark
Traits:
- sees differently
- follows inspiration
- emotional
Morality: true to their vision
Relationships:
- seeks appreciation
- connects through art
- needs space to create

Worker:
Drives:
- making ends meet
- providing for others
- earning respect
Traits:
- hardworking
- practical
- straightforward
Morality: honest day's work
Relationships:
- values reliability
- helps neighbors
- distrusts big talk

Joker:
Drives:
- getting laughs
- avoiding seriousness
- pointing out absurdity
Traits:
- funny
- quick-witted
- masks true feelings
Morality: life's a joke
Relationships:
- entertains groups
- uses humor to deflect
- hides pain behind smiles

Healer:
Drives:
- easing suffering
- fixing problems
- understanding pain
Traits:
- compassionate
- good listener
- puts others first
Morality: do no harm
Relationships:
- cares for the hurt
- feels others' pain
- burns out helping

Wanderer:
Drives:
- seeing new places
- avoiding ties
- finding their path
Traits:
- independent
- adaptable
- collects stories
Morality: live and let live
Relationships:
- makes temporary friends
- shares tales
- leaves before getting attached

Beast:
Drives:
- staying alive right now
- protecting their turf
- following gut feelings
Traits:
- acts without thinking
- fiercely loyal to few
- distrusts strangers
Morality: only the strong survive
Relationships:
- protects their pack
- fights when cornered
- communicates through actions

Comfort-Seeker:
Drives:
- feeling good
- avoiding effort
- finding luxury
Traits:
- loves nice things
- complains a lot
- always takes the easy way
Morality: comfort first, always
Relationships:
- charms to get what they want
- abandons difficult people
- shares pleasures with friends

Avenger:
Drives:
- settling a score
- getting payback
- obsessing over one thing
Traits:
- never forgets a wrong
- sees everything through their grudge
- sacrifices everything else
Morality: revenge is justice
Relationships:
- uses people for their goal
- sees everyone as either tools or obstacles
- connects only through shared hatred

Innocent:
Drives:
- finding good in everyone
- trusting others
- seeing wonder everywhere
Traits:
- too optimistic
- easily fooled
- asks simple questions
Morality: everyone is good at heart
Relationships:
- helps without question
- gets taken advantage of
- confused by meanness

Slacker:
Drives:
- avoiding work
- finding shortcuts
- just chilling
Traits:
- lazy
- puts things off
- doesn't care about success
Morality: why bother?
Relationships:
- lets others do the work
- goes along with whatever's easiest
- surprisingly good company

Coward:
Drives:
- avoiding pain
- escaping danger
- hiding from threats
Traits:
- jumpy
- quick to run
- avoids fights
Morality: staying alive trumps everything
Relationships:
- might sell you out to save themselves
- clings to protectors
- makes excuses
```

## Location Archetypes (11 defaults)

Templates with Atmosphere, Tensions, Patterns, and Secrets sections. Used during Location Details generation.

### Complete Defaults

```
Web of Corruption:
Atmosphere:
- subtle unease
- calculated normalcy
- veiled exchanges
Tensions:
- appearance vs reality
- profit vs principle
- loyalty vs gain
Patterns:
- private conversations
- unexplained prosperity
- selective access
Secrets:
- hidden connections
- unofficial arrangements
- compromised figures

Power Struggle:
Atmosphere:
- underlying tension
- careful politeness
- measured words
Tensions:
- established vs emerging
- stability vs change
- influence vs resistance
Patterns:
- group territories
- social signals
- status displays
Secrets:
- quiet agreements
- shifting loyalties
- pressure points

True Believers:
Atmosphere:
- earnest conviction
- shared customs
- group identity
Tensions:
- tradition vs practicality
- belief vs doubt
- unity vs individuality
Patterns:
- regular rituals
- shared spaces
- ranked positions
Secrets:
- private doubts
- adapted practices
- hidden costs

Living History:
Atmosphere:
- layered time
- preserved memories
- continued use
Tensions:
- old ways vs new needs
- memory vs progress
- preservation vs adaptation
Patterns:
- repurposed spaces
- maintained traditions
- generational knowledge
Secrets:
- forgotten purposes
- abandoned sections
- old stories

Exchange Hub:
Atmosphere:
- bustling activity
- mixed influences
- practical energy
Tensions:
- competition vs cooperation
- local vs foreign
- tradition vs opportunity
Patterns:
- meeting points
- specialized spaces
- social mixing
Secrets:
- insider arrangements
- unofficial trades
- valuable information

Knowledge Cache:
Atmosphere:
- accumulated wisdom
- selective access
- preserved learning
Tensions:
- sharing vs hoarding
- theory vs practice
- old knowledge vs new
Patterns:
- organized collections
- study spaces
- information flow
Secrets:
- restricted materials
- lost techniques
- hidden archives

Sanctuary:
Atmosphere:
- guarded peace
- maintained boundaries
- careful welcome
Tensions:
- protection vs isolation
- safety vs growth
- trust vs caution
Patterns:
- defensive arrangements
- communal spaces
- escape routes
Secrets:
- emergency provisions
- hidden defenders
- concealed exits

Crossroads:
Atmosphere:
- constant movement
- cultural blending
- temporary bonds
Tensions:
- transient vs permanent
- exchange vs security
- opportunity vs risk
Patterns:
- marked pathways
- temporary shelters
- information exchange
Secrets:
- smuggled goods
- underground networks
- traveler's lore

Time Anchor:
Atmosphere:
- stubborn permanence
- daily rhythms
- reliable presence
Tensions:
- routine vs change
- efficiency vs tradition
- service vs survival
Patterns:
- repeated activities
- worn paths
- familiar faces
Secrets:
- small adaptations
- quiet innovations
- personal stories

Gathering Thread:
Atmosphere:
- casual comfort
- shared moments
- informal bonds
Tensions:
- privacy vs community
- personal vs shared
- old ties vs new
Patterns:
- natural meeting points
- exchanged news
- overlapping lives
Secrets:
- unspoken understandings
- community arrangements
- mutual support

Quiet Craft:
Atmosphere:
- focused dedication
- practiced skill
- absorbed attention
Tensions:
- mastery vs practicality
- quality vs demand
- technique vs innovation
Patterns:
- specialized tools
- work rhythms
- material storage
Secrets:
- trade secrets
- personal techniques
- material sources
```

## Region Archetypes (23 defaults)

Large-scale templates with Geography, Dynamics, History, and Atmosphere sections. Used during Region Details generation.

### Complete Defaults

```
Disputed:
Geography:
- natural barriers
- strategic positions
- coveted resources
Dynamics:
- rival claims
- shifting alliances
- resource seizures
- border skirmishes
History:
- broken oaths
- ancestral claims
- forced exodus
- contested dominion
Atmosphere:
- tension
- opportunism
- armed presence
- uncertainty

Meeting:
Geography:
- natural pathways
- varied landscapes
- accessible terrain
Dynamics:
- cultural friction
- trade dominance
- knowledge control
- diplomatic schemes
History:
- merchant feuds
- custom appropriation
- failed parleys
- broken trusts
Atmosphere:
- suspicion
- opportunity
- cultural clash
- veiled intentions

Secluded Haven:
Geography:
- natural shields
- difficult approach
- self-sustaining bounty
Dynamics:
- stranger rejection
- resource guarding
- custom enforcement
- inner discord
History:
- outsider banishments
- quelled uprisings
- exile customs
- knowledge concealment
Atmosphere:
- wariness
- conformity
- insularity
- resistance to change

Healing Scars:
Geography:
- wounded landscape
- returning life
- lingering dangers
Dynamics:
- blame casting
- recovery control
- weakness exploitation
- opposing visions
History:
- unhealed wounds
- disputed causes
- forsaken survivors
- opportunistic claims
Atmosphere:
- bitterness
- mistrust
- contested hope
- lingering dread

Veiled Wonder:
Geography:
- hidden marvels
- unusual formations
- natural mysteries
Dynamics:
- passage restriction
- lore mastery
- plunder schemes
- guardian quarrels
History:
- vanished seekers
- rival claims
- buried findings
- warden betrayals
Atmosphere:
- secrecy
- temptation
- jealous protection
- secret tales

Seat of Power:
Geography:
- commanding position
- resource abundance
- natural advantage
Dynamics:
- succession quarrels
- iron rule
- rebellion crushing
- rival undermining
History:
- bloody usurpations
- failed revolts
- purged opposition
- tyrannical rule
Atmosphere:
- dread
- resentment
- forced fealty
- secret plots

Forgotten Realm:
Geography:
- overgrown ruins
- reclaimed structures
- hidden pathways
Dynamics:
- treasure seeking strife
- ownership disputes
- forbidden knowledge
- territory claims
History:
- sudden downfalls
- willful erasure
- failed reclamations
- ill-fated discoveries
Atmosphere:
- foreboding
- avarice
- superstition
- rival exploration

Heartland:
Geography:
- fertile terrain
- natural wealth
- favorable climate
Dynamics:
- resource control
- wealth disparity
- common folk unrest
- territorial disputes
History:
- land seizures
- popular revolts
- quelled uprisings
- wealth hoarding
Atmosphere:
- resentment
- hidden defiance
- lordly display
- brewing discontent

Frontier:
Geography:
- perilous terrain
- harsh conditions
- untapped riches
Dynamics:
- claim theft
- survival betrayals
- newcomer exploitation
- lawless opportunism
History:
- lost expeditions
- settlement slaughters
- resource feuds
- broken vows
Atmosphere:
- desperation
- mistrust
- harsh pragmatism
- looming peril

Sacred Territory:
Geography:
- natural monuments
- symbolic features
- hallowed grounds
Dynamics:
- doctrine disputes
- pilgrimage control
- heresy accusations
- ritual contests
History:
- faith conflicts
- forced conversions
- shrine desecrations
- competing claims
Atmosphere:
- fervor
- judgment
- spiritual tension
- enforced devotion

Borderlands:
Geography:
- natural boundaries
- terrain shifts
- mixed domains
Dynamics:
- lineage conflicts
- loyalty questions
- custom suppression
- forced adoption
History:
- tradition erasure
- forced wandering
- identity persecution
- defiance movements
Atmosphere:
- wariness
- divided hearts
- custom preservation
- identity assertion

Exploited Land:
Geography:
- resource-rich terrain
- quarries and mines
- altered landscapes
Dynamics:
- laborer hardship
- land despoiling
- sabotage acts
- profit quarrels
History:
- worker suppressions
- native displacement
- great mishaps
- failed rebellions
Atmosphere:
- hardship
- land sickness
- hidden resistance
- harsh oversight

Sanctuary:
Geography:
- defensible terrain
- hidden valleys
- natural shelters
Dynamics:
- provision scarcity
- leadership contests
- spy fears
- belief divisions
History:
- revealed hideaways
- inner purges
- fallen refuges
- leadership overthrows
Atmosphere:
- suspicion
- conditional welcome
- constant vigilance
- questioned loyalties

Contested Borders:
Geography:
- disputed lands
- unclear boundaries
- mixed settlements
Dynamics:
- coerced allegiances
- proxy battles
- custom persecution
- opportunistic raids
History:
- villager bloodshed
- forced wanderings
- custom suppression
- changing masters
Atmosphere:
- unease
- divided hamlets
- shifting loyalties
- opportunistic betrayals

Rising Center:
Geography:
- favorable location
- growing settlement
- natural advantages
Dynamics:
- native displacement
- resource strain
- custom erosion
- power struggles
History:
- land takings
- false promises
- failed works
- uprooted communities
Atmosphere:
- ruthless ambition
- station divisions
- custom clashes
- desperate opportunity

Fading Glory:
Geography:
- grand structures
- aging works
- crumbling monuments
Dynamics:
- desperate preservation
- decline blame
- resource hoarding
- old ways enforcement
History:
- failed revivals
- blame purges
- abandoned quarters
- wealth concentration
Atmosphere:
- bitter remembrance
- enforced traditions
- truth denial
- generational strife

Forbidden Territory:
Geography:
- warning markers
- natural hazards
- barred passages
Dynamics:
- forbidden ventures
- harsh enforcement
- knowledge suppression
- smuggling ventures
History:
- brutal punishments
- vanished trespassers
- hidden discoveries
- corrupt wardens
Atmosphere:
- dread
- forbidden allure
- harsh consequences
- hushed secrets

Seasonal Grounds:
Geography:
- cyclical bounty
- temporary paths
- changing conditions
Dynamics:
- timing disputes
- resource competition
- custom violations
- preparation sabotage
History:
- violent contests
- resource theft
- timing errors
- tradition breakdowns
Atmosphere:
- urgent competition
- custom enforcement
- preparation worry
- cyclical tensions

Hidden Network:
Geography:
- concealed paths
- secret passages
- shadow realms
Dynamics:
- betrayed routes
- territory disputes
- secret selling
- infiltration plots
History:
- exposed pathways
- bloody purges
- passage collapses
- betrayed confidences
Atmosphere:
- wariness
- coded speech
- constant testing
- trust verification

Divided Realm:
Geography:
- physical barriers
- separated domains
- mirrored structures
Dynamics:
- contraband conflicts
- border violence
- lineage persecution
- reunification resistance
History:
- violent sundering
- failed crossings
- bloodline purges
- resistance crushing
Atmosphere:
- mutual suspicion
- enforced separation
- lineage scrutiny
- forbidden contact

Shaped Domain:
Geography:
- crafted environments
- harnessed elements
- designed spaces
Dynamics:
- control defiance
- design flaws
- resource contests
- upkeep disputes
History:
- creation disasters
- maker conflicts
- rebellion crushing
- system failures
Atmosphere:
- unnatural constraint
- maker resentment
- hidden sabotage
- design weaknesses

Wanderer Paths:
Geography:
- seasonal bounty
- ancient routes
- temporary camps
Dynamics:
- territory disputes
- resource competition
- outsider suspicion
- contested trails
History:
- broken pacts
- path encroachment
- sacred ground violations
- forced diversions
Atmosphere:
- wariness
- tradition
- impermanence
- territory marking

Threshold:
Geography:
- boundary spaces
- crossing points
- gateway terrain
Dynamics:
- passage control
- toll extortion
- smuggling conflicts
- warden corruption
History:
- violent takeovers
- passage denials
- warden betrayals
- crossing calamities
Atmosphere:
- anticipation
- exploitation
- gatekeeping
- forced choices
```

## Encounter Elements (21 defaults)

Building blocks for encounter generation. Each category is a bulleted list of options.

### Complete Defaults

```
Inhabited Places:
- camps and outposts
- villages and hamlets
- seasonal settlements
- gathering spots

Military & Defense:
- forts and towers
- guard stations
- patrol posts
- checkpoints

Criminal & Hidden:
- bandit hideouts
- smuggler coves
- secret caches
- rebel bases
- fugitive camps

Historical & Ancient:
- ruins and foundations
- ancient battlefields
- old shrines
- burial grounds
- monuments
- abandoned mines

Commercial:
- crossroads
- trading posts
- caravan stops
- storehouses
- marketplaces

Religious & Mystical:
- temples
- shrines
- ritual sites
- meditation spots
- pilgrim camps

Natural Features:
- caves and grottos
- sheltered valleys
- springs
- rock formations
- natural shelters
- old growth trees

Recent Activity:
- fresh graves
- battle aftermath
- festival grounds
- expedition camps
- temporary shelters
- gathering spots

Merchants & Traders:
- caravan leaders
- peddlers
- traveling craftspeople

Travelers:
- pilgrims
- messengers
- performers
- nomads
- explorers

Military & Law:
- soldiers
- guards
- bounty hunters
- tax collectors

Outlaws:
- bandits
- smugglers
- deserters
- fugitives

Religious & Mystical Characters:
- priests
- missionaries
- fortune tellers
- cultists
- mystics

Specialists:
- healers
- scholars
- prospectors
- guides
- hunters

Displaced:
- refugees
- lost travelers
- exiles
- wanderers

Hostile:
- kidnappers
- slavers
- raiders
- fanatics

Combat & Danger:
- Ambushes and raids
- Territorial creatures
- Desperate outlaws
- Military patrols
- Monster attacks

Social & Diplomatic:
- Traveling merchants
- Lost travelers
- Religious pilgrims
- Refugees
- Local inhabitants

Mystery & Investigation:
- Strange phenomena
- Recent battle sites
- Abandoned camps
- Mysterious tracks
- Unusual structures

Aid & Rescue:
- Injured travelers
- Stranded merchants
- Lost children
- Trapped animals
- Desperate fugitives

Natural & Environmental:
- Dangerous weather
- Difficult terrain
- Natural barriers
- Wildlife behavior
- Resource discoveries
```

## When AI Uses Seeds

### NPC Details Generation (Strong/Elite/Boss/Mythic Tier Only)
1. System checks if NPC tier is in `['strong', 'elite', 'boss', 'mythic']`
2. If yes, AI randomly selects one author seed
3. AI randomly selects one character archetype
4. Both are added as context messages to shape personality and description
5. Trivial/weak/average tier NPCs do NOT use archetypes

### Location Details Generation
1. AI uses location archetypes to guide atmosphere and detail generation
2. Archetypes provide Atmosphere, Tensions, Patterns, and Secrets

### Region Details Generation
1. AI uses region archetypes to guide Geography, Dynamics, History, and Atmosphere
2. Helps create consistent regional themes

### Encounter Generation
1. AI draws from encounterElements categories
2. Uses bulleted lists within categories as inspiration

## Cross-References

| Field | Used By |
|-------|---------|
| `characterArchetypes` | `generateNPCDetails` for strong/elite/boss/mythic tier |
| `authorSeeds` | `generateNPCDetails` for strong/elite/boss/mythic tier |
| `locationArchetypes` | `generateLocationDetails` |
| `regionArchetypes` | `generateRegionDetails` |
| `encounterElements` | `generateEncounters` |
