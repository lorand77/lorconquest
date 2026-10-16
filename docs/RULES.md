# MITTELEUROPA 1440
### Real-time grand strategy — current ruleset

> **Scenario scaling.** `x` is a per-scenario cost multiplier. `x0.1M` means `x × 0.1M`.
> `x` applies to **tech costs, starting treasury and the flat R bonus only** — never to shop prices.
> Each scenario sets its own `x`; the Mitteleuropa scenario is in [SCENARIO.md](SCENARIO.md).
> Town and city populations (10K / 20K) are the same in every scenario; what changes between
> scenarios is the map, country sizes, costs, coring, and the victory condition.

---

## 1. TIME

| Game time | Real time |
|---|---|
| 1 day | 0.1s |
| 1 month | ≈3.04s |
| **1 year** | **36.5s** |
| 100 years | 60 min |

Start **1440 AD**.

**Single player:** free pause.
**Multiplayer:** 1 minute to set up, then a 30s pause every 10 years.

---

## 2. ECONOMY

Every **town** (red circle) starts at **10,000 pop**; every **city** (red square) at **20,000**.

```
money per year = bank interest
               + core pop × 2
               + non-core pop × 1
               − soldiers × 5        (cannon crew and ship crew count as soldiers)
```

**Pop growth:** +1% per year, **+0.5%** if on a river or coast.

**Casualties cost population.** Every soldier who dies is removed from your population, not
just from the army — whether killed in battle, by snipers, in a lost storm, or by disease in a
siege (§6). Each lost cannon also kills its **10 crew**, and each ship sunk at sea kills its
**50 crew**. Snipers count too — each sniper killed when its post is stormed or its pass is lost
(§8) is one person lost. The loss is spread across all settlements you own **in proportion to their
population**, so a 20K city loses twice as many people as a 10K town. Lost people come back
only through growth or **Buy people**.

**Coring.** A settlement becomes core after you have held it **20 years** *and* bought a
**Courthouse**. Special coring (see [Special coring](SCENARIO.md#special-coring)) waives both.

**Bank:** deposits earn `0.125% per month` interest (≈1.5%/year compounded). Withdraw any time.
Bank interest is **money only** — it never goes to research (§4).

**Debt.** You may **not buy anything** that would take your treasury below zero. Debt therefore
only arises when upkeep exceeds income. That is allowed — you repay it later. The **10-year
clock starts when your treasury first goes below zero** and resets once the debt is fully
repaid. If the debt is still unpaid **10 years after it began** and exceeds **pop × 10**, you go
bankrupt: buildings are sold off to clear it, then soldiers and weapons.

### Starting values
| | |
|---|---|
| Treasury | **x0.1M** |
| Soldiers | pop ÷ 25, equipped with swords |
| Ships | pop ÷ 2000 — **coastal countries only** |
| Cores | **every starting settlement is core** |

**Capital.** Each country starts with the capital its scenario names — a city if it owns one. If
the capital is lost, name a new one from any city you own; if you own no city, any settlement.
The capital trains soldiers twice as fast as other settlements (§8).

---

## 3. SHOP

| Item | Cost | Tech cost | Effect |
|---|---|---|---|
| **Walls** | 0.1M | — | ×1.8 defence, doubles siege time |
| **Library** | 0.075M | — | +5% of total R · max one per settlement · capped at +50% (see §4) |
| **Workshop** | 0.075M | — | +3500 money from settlement |
| **Market** | 0.075M | — | +10% money from settlement |
| **Courthouse** | 0.05M | — | Settlement can be cored (also needs 20 years) |
| **1000 soldiers** | **free** | — | Men only — weapons bought separately · trained in 3–6 months (§8) |
| **Swords** (1000) | 0.025M | unlocked | ×1 |
| **Muskets** (1000) | 0.05M | x1.5MR | ×1.3 |
| **Rifles** (1000) | 0.1M | x4MR | ×2 |
| **Cannons** (100) | 0.1M | x1.5MR | ×13 each, then ×1.2 — worth 15.6 men · needs 1000 men |
| **Snipers** (20) | 0.01M | x1MR | Bought and stationed at a mountain pass you own (§8) |
| **Buy people** (1000 pop) | 0.1M | — | |
| **10 ships** | 0.1M | — | ×1 each |
| **10 gunships** | 0.2M | x3MR | ×3 each |
| **10 steam ships** | 0.5M | x20MR | ×8 each |

**Every cannon needs 10 crewmen.** Cannon crew do **not** count as men in the power formula.
**Every ship needs 50 crew at sea.** Ships in port need no crew. **Ships have no upkeep** of
their own — only their crew at sea do.
**Crew are soldiers.** Cannon crew and ship crew at sea pay soldier upkeep (§2) and count
toward your conscription cap (§9). **So do snipers** — each sniper is one soldier.

---

## 4. TECHNOLOGY

```
Swords (unlocked) ──▶ Muskets ──▶ Cannons ──┬──▶ Rifles
                                             └──▶ Snipers

Naval (unlocked) ──▶ Gunships ──▶ Steam Ships   [not supposed to get this]
```

**Research slider.** You set the slider from **0% to 100%** in steps of 10%. Every country starts
at **50%**, and you may move it at any time.

```
investable = max(0, money per year − bank interest)        (§2, after any tribute you pay, §10)
R per year = (2 × slider × investable + x10K) × (1 + 0.05 × libraries)
                                                             libraries counts at most 10
treasury gets money per year + (1 − 2 × slider) × investable
```

| Slider | Treasury gets | R per year (before Libraries) |
|---|---|---|
| 0% | money per year + investable (about **double**) | x10K only |
| **50%** | **money per year** | **investable + x10K** |
| 100% | money per year − investable (about **nothing**) | 2 × investable + x10K |

At **50%** you get your full money *and* your full research. Each 10% above 50% moves a fifth of
your investable money from the treasury to research; each 10% below moves it the other way.

Money and R are **separate pools**. R builds up every year; a tech unlocks as soon as you have
paid its full R cost. **Unspent R banks.** The flat x10K comes whatever the slider says, and bank
interest always goes to the treasury. When your money per year is zero or less there is nothing
to invest: the slider does nothing — the treasury takes the loss and you research only the flat
x10K.

**Libraries.** Each Library you own adds **+5%** to your R per year. Bonuses **add up** — they
do not multiply — and the total is **capped at +50%** (10 Libraries). A settlement can hold only
one Library.

---

## 5. LAND COMBAT

```
power = (men + cannons × 13) × (d6 + 6)
        ×2 for the riflemen · ×1.3 for the musketmen · ×1.2 for the cannons
```

- Cannon crew are **not** counted in `men`.
- **Men without weapons have power 0.**
- Multipliers apply per weapon group — if 1,000 men have rifles and the rest swords, only those
  1,000 get the ×2. The cannons’ ×1.2 applies only to the `cannons × 13` part.

**Damage** — applied as a percentage of men, cannons and equipment:
```
winner loses  (P_loser  ÷ P_winner) × 30 %
loser  loses  (P_winner ÷ P_loser ) × 30 %      capped at 100%
```

| Ratio | Winner loses | Loser loses |
|---|---|---|
| 1:1 | 30% | 30% |
| 2:1 | 15% | 60% |
| 3:1 | 10% | 90% |
| 10:3 (≈3.33:1) or more | 9% or less | wiped out |

Men killed are also lost from your population — see *Casualties cost population* (§2).

**Ties.** If both sides end with exactly equal power, the **defender wins**. The defender is
the side holding the settlement or province where the battle happens; if neither holds it, the
army that arrived there first. At a mountain pass, the defender is the army that reached the pass
first.

**After the battle:** winner may advance or hold. Loser retreats to the nearest settlement
owned by itself or a **military ally** (§10). If neither it nor any military ally owns a
settlement, there is nowhere to retreat and **the whole losing army dies**.

### Defence
| Situation | Multiplier |
|---|---|
| Defending a mountain pass (§8) | ×2 |
| Defending a settlement | ×1.2 |
| Settlement with walls | ×1.8 |

The mountain ×2 applies **only at mountain passes**. A pass has no settlement, so the pass and
settlement bonuses never stack.

Every 100 cannons the attacker brings lowers the wall multiplier by **0.3**, floored at **1.2**.

### Snipers
Snipers are **bought and stationed only at a mountain pass your country owns** (§8). They cannot
move or attack — they wait for an enemy army to pass through.
```
damage = number of snipers × d6 × 10      max 25 snipers per battle
Total damage may never exceed 50% of the passing army.
```
**Once per army per crossing.** Snipers fire once at each enemy army when it enters the pass —
not again while it stays there, nor when it leaves. An army that leaves and later comes back is
fired on again. Snipers take no losses when they fire, and survivors pass through freely.

**Clearing snipers.** An army may `storm` the sniper post. Resolve it as a field battle in which
each sniper counts as **50 power**:
```
sniper power = snipers × 50 × (d6 + 6)
```
The pass ×2 does **not** apply to snipers. Losses are applied as in a normal battle.

---

## 6. TAKING A SETTLEMENT

**Undefended settlement** — if an enemy's settlement (§10) has no army in it, an army that enters
captures it immediately. No battle is fought and no one dies.

**Storm** — a field battle with the defender's bonus applied. If the attacker wins, the settlement
falls immediately and the defender rolls d6: **1–3** escapes with normal losses, **4–6** loses
everything.

**Siege** —
```
n = pop ÷ 20000 years      ×2 if walls
                           × (1 − 0.2 per full 100 cannons the besieger brings), at least × 0.4
```
**The siege length is fixed when the siege begins and cannot change while it runs** — cannons
that arrive later do not shorten it.

**Disease.** The besieging army loses **1% of its men every month** of the siege. They are lost
from your population like any casualty (§2). A two-year siege (a walled city) costs about a
fifth of the army; a six-month siege of an open town about 6%.

**Sortie.** The garrison may order `sortie` at any time before the timer expires. It marches out
and fights the besieging army in a normal land battle (§5). If the garrison wins, the besiegers
retreat and the siege ends. If it loses, it falls back inside and the siege continues on the
same timer.

**Surrender.** When the timer expires the garrison surrenders and the settlement falls to the
besieger. The garrison is **disbanded on the spot**: its men go back to its country's population
(no one dies), but its weapons and cannons are lost — they do **not** go to the reserve.

---

## 7. NAVAL

```
power = (ships + gunships × 3 + steam ships × 8) × (d6 + 6)
```
Damage as in a land battle, applied to ships (rounded). Crew of sunk ships are lost from
your population (§2).

**Fleet orders.** Sail a fleet into a sea zone (zones are listed in
[SCENARIO.md](SCENARIO.md#sea-zones)), then give it one of two orders:

- `blockade` — pick an enemy port in that sea zone. While the blockade holds, **all money from
  that settlement is halved** (§2, its Workshop and Market included). Its growth is not affected.
- `patrol` — the fleet engages **any enemy ship in that sea zone**. Distance inside the zone does
  not matter; being in the same zone is enough.

---

## 8. ARMIES, FLEETS AND MOVEMENT

*(The army speed and the route lengths are scenario-specific.)*

**Raising forces.** New soldiers are trained in a **core settlement** and take time to appear:

| Trained in | Time |
|---|---|
| Your capital (§2) | 3 months |
| Any other core settlement | 6 months |

While training, men already count toward your conscription cap (§9) and pay soldier upkeep (§2).
When they are ready they appear in that settlement and join any army of yours there, or form a
new one; to reach an army elsewhere they march like any other army. If the settlement is
captured or stops being core before they are ready, the training is cancelled and the men go
back to the population.

You may upgrade weapons in an army instantly. You may also **remove men from an army** — they go
back to the population and their weapons go to a reserve for later use; men raised again must
be trained again. Fleets work the same way — add ships to an existing task force or form a new
one.

| Movement | |
|---|---|
| Army | route length ÷ army speed |
| River crossing | +2 months |
| Leg to or from a mountain pass | +3 months |
| Fleet, to a neighbouring sea zone | 2 months |

**Marching time is proportional to distance.** Every route has a length — the length of its line on
the map — and an army covers it at the army speed set by the scenario. A route twice as long takes
twice as long. River crossings and mountain passes add their delays on top.

**Fleets move zone to zone.** A fleet is always in exactly one sea zone — at sea, or in one of that
zone's ports. Sailing to a neighbouring zone takes 2 months; entering or leaving a port in its own
zone is instant. Which zones neighbour each other is listed in
[SCENARIO.md](SCENARIO.md#sea-zones).

**Mountain passes (yellow triangles).** Some routes cross the mountains through a pass. A pass is
a node on the map, like a settlement with no people in it, and the route runs settlement → pass →
settlement.

- **Armies can be sent to a pass** and stay there. The route is split at the pass, and each leg
  (settlement to pass, pass to settlement) takes time by its own length **plus 3 months** for the
  climb, so going through a pass costs 6 months on top of the distance. An army that stops at the
  pass has paid half, and pays the rest when it moves on.
- **An army defending a pass gets ×2** defence (§5).
- **Snipers** are bought and stationed only at passes (§5).
- **Each pass belongs to one country** — whoever's territory it lies in, i.e. whoever owns the
  settlement whose land the pass is in (listed in [SCENARIO.md](SCENARIO.md#mountain-passes)).
  It changes hands with that settlement. Only the owner can buy snipers there.
- **Snipers die when the pass changes hands** — if the settlement whose land the pass is in is
  lost, every sniper stationed at that pass dies.

**Zone of control.** An army entering a province with an enemy army stops there and engages,
cancelling the rest of its path.

**Orders:** `move` · `besiege` · `storm` · `sortie` (garrison only, §6).
**Fleet orders:** `move` · `blockade` · `patrol` (§7).

**Battle cooldown:** one resolution per pair of armies per 3 months. The loser retreats
immediately, as in §5 *After the battle*.

**Straits (dashed lines).** An army may cross if you control **≥10 ships** in that sea zone (see
[Sea zones](SCENARIO.md#sea-zones)) and no enemy fleet contests it. Crossing consumes the entire
year. If an enemy fleet is present, fight a naval battle first — lose and the crossing fails.

---

## 9. CONSCRIPTION LAWS

You cannot change again for **5 years**.

| Government | Max army | Income |
|---|---|---|
| Feudal | 6.5% | — |
| Centralized | 10% | −6% |
| Militarized | 15% | −10% |
| Total War | 25% | −30% |
| Scrap the Barrel | 40% | −80% |

The percentage applies to **core manpower + half of non-core**. Cannon crew and ship crew
at sea count toward this limit.

---

## 10. DIPLOMACY

### War
**War must be declared.** You can only fight a country you are at war with — your **enemy**.
Battles, sieges, storms, blockades and patrols (§5–§8) act on enemies only. Peasant rebels (§11)
are always at war with you.

**Neutral land is closed.** An army may only enter land that belongs to its own country, its
subjects or overlord, its allies (either kind), a country that gives it **military access**, or an
enemy. Every other country is **neutral**: its land cannot be entered or marched through, its
mountain passes cannot be used, and a strait cannot be crossed into it. Armies that are not at war
ignore each other — no battle and no zone of control. When peace is signed, or an alliance or
military access ends, any army left in land now closed to it returns to the nearest settlement
its country owns.

When you declare war:
- your target's **defensive allies** and **guarantors** join against you automatically;
- your **military allies** are called to join you, and so are your target's. Each may refuse at a
  cost: the alliance with the caller ends.

### Agreements
| Agreement | Effect | Lasts |
|---|---|---|
| **Defensive alliance** | If either side is declared on, the other joins the war automatically | until broken |
| **Military alliance** | Each side is called into every war the other fights, attacking or defending; it may refuse (above) | until broken |
| **Guarantee** | One-way: if the guaranteed country is declared on, the guarantor joins automatically | until broken |
| **Military access** | One-way: your armies may enter and march through its land and use its passes and straits. It never joins your wars and you may not capture anything there. It may cancel at any time — that is not breaking an agreement | until cancelled |
| **Non-aggression pact** | Neither side may declare war on the other | 10 years |
| **Truce** | Starts when a peace is signed; neither side may declare war on the other | 5 years |

A **military ally** (§5) is any country allied with you, by either kind of alliance, that is
fighting the same war on your side.

**Breaking an agreement.** You may break any agreement — including declaring war through a pact or
truce. If you do, **all your alliances end**, and every computer country's opinion of you
drops by **40 for 10 years** (see *Computer countries*).

### Subjects
| | Vassal | Protectorate |
|---|---|---|
| Pays you | **40%** of its yearly money (§2), when positive | **10%** of its yearly money (§2), when positive |
| Joins your wars | every war, automatically — it cannot refuse | never obliged |
| Its own diplomacy | none: it cannot declare war, make agreements or sign peace | keeps it |
| Counts as your military ally (§5) | yes | only if it chooses to join the war |

A country becomes your subject through a peace treaty, by agreeing to your demand, or — protectorates
only — through the Holy Roman Empire ([SCENARIO.md](SCENARIO.md#the-holy-roman-empire)).

**Breaking free.** A subject breaks free the moment it has **more soldiers than you**. This is not
breaking an agreement.

### Peace
Either side may propose peace, with **any terms both sides agree to**: settlements, money, making
one side a vassal or protectorate of the other, releasing subjects. If you have conquered all of
your enemy's settlements, you dictate the terms. Settlements stay with whoever holds them when
peace is signed, unless the terms move them. Signing peace starts a **truce**.

### Computer countries
A computer-run country answers a proposal the moment it is made. You may make each kind of
proposal to the same country **once every 5 years**. The HRE proposal is not limited by this —
it has its own once-ever rule ([SCENARIO.md](SCENARIO.md#the-holy-roman-empire)).

**Strength** compares soldiers (§2 — cannon and ship crew included):
```
strength = your soldiers ÷ their soldiers
```

**Size** compares population — every settlement each side owns, core and non-core, not counting
subjects. Unlike soldiers, population cannot be raised in a hurry, so size is what subject
demands and the HRE vote are rolled on:
```
size = your pop ÷ their pop
```

**Opinion.** Every computer country holds an opinion of every other country, from −100 to +100 —
the sum of everything below that applies:

| Between it and you | Opinion |
|---|---|
| You are both at war with the same country | +20 |
| You both hold HRE settlements | +10 |
| Each full year since you were last at war with each other (or since the start) | +1, up to +20 |
| You share a border (a land route joins your settlements) | −15 |
| You are at war with one of its allies or subjects | −30 |
| You fought a war against it in the last 20 years | −25 |
| You broke an agreement with anyone in the last 10 years | −40 |
| It refused your demand to become your subject, or to join your Empire, in the last 10 years | −30 |

**Peace** — strength and war progress. The computer accepts if `war score ≥ cost`:
```
war score = % of its pop you have taken in this war − % of your pop it has taken
            + 10 × (strength − 1), this part between −30 and +30
cost      = settlements you ask for, as % of its pop
            + 10 for each year of its money (§2) you ask for
            + 50 to make it your vassal · 25 to make it your protectorate
```
Pops are counted as they were when the war began. A plain peace (cost 0) is accepted whenever your
war score is 0 or more.

**Alliances, guarantees and pacts** — opinion, plus how threatened it feels by its neighbours.
The computer accepts if `opinion + need ≥ the bar`:
```
need = 10 × (its strongest neighbour's soldiers ÷ its soldiers − 1), between 0 and +40
```
| Proposal | Bar |
|---|---|
| You guarantee it | −20 |
| Non-aggression pact | 0 |
| It gives you military access | +10 |
| Defensive alliance | +20 |
| Military alliance | +40 |

A neighbour is any country whose settlements share a land route with its settlements.

**Becoming your subject** — mostly size, a little opinion. The HRE vote is rolled the same way
([SCENARIO.md](SCENARIO.md#the-holy-roman-empire)):
```
protectorate chance = size × 10 % + opinion ÷ 10 %
vassal chance       = size × 5 %  + opinion ÷ 10 %      also to turn your protectorate into a vassal
at most 75%
0% if your pop is not larger than theirs, or if their opinion of you is below −50
```
**Refusing makes it hostile:** a country that refuses gets the −30 opinion above for 10 years,
so asking again in 5 years is much less likely to work.

You cannot demand this of a country you are at war with — make it your subject in the peace
terms instead.

---

## 11. RANDOM EVENTS

Rolled at the start of each year.

| Event | Chance | Effect |
|---|---|---|
| Good harvest | 10% | +10% money that year |
| Plague | 5% | −10% pop |
| Peasant uprising | 15% *(only if a plague struck in the last year)* | See below |

**Peasant uprising.** A rebel country forms with soldiers equal to **3% of your total population**
(every settlement you own, core and non-core), armed with swords, spawning
outside your capital. It holds cores on everything and attacks towns and cities, favouring
undefended ones and your core territory. **There is no peace with peasants.**

