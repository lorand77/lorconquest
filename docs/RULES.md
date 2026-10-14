# MITTELEUROPA 1440
### Real-time grand strategy — current ruleset

> **Scenario scaling.** `x` is a per-scenario cost multiplier. `x0.1M` means `x × 0.1M`.
> `x` applies to **tech costs, starting treasury and the flat R bonus only** — never to shop prices.
> For Mitteleuropa, **x = 1**. Town and city populations (10K / 20K) are the same in every
> scenario; what changes between scenarios is the map, country sizes, costs, coring, and the
> victory condition.

---

## 1. TIME

| Game time | Real time |
|---|---|
| 1 day | 0.1s |
| 1 month | 3s |
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
               − soldiers × 1.5      (cannon crew and ship crew count as soldiers)
```

**Pop growth:** +1% per year, **+0.5%** if on a river or coast.

**Casualties cost population.** Every soldier who dies is removed from your population, not
just from the army — whether killed in battle, by snipers, in a lost storm, or when a siege
timer expires. Each lost cannon also kills its **10 crew**, and each ship sunk at sea kills its
**50 crew**. The loss is spread across all settlements you own **in proportion to their
population**, so a 20K city loses twice as many people as a 10K town. Lost people come back
only through growth or **Buy people**.

**Coring.** A settlement becomes core after you have held it **20 years** *and* bought a
**Courthouse**. Special coring (see *Special coring* in the scenario) waives both.

**Bank:** deposits earn `0.25% per month` interest (≈3.04%/year compounded). Withdraw any time.
Bank interest is **money only** — it never counts toward research (§4).

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

**Capital.** Each country names a capital at setup — a city if it owns one. If the capital is
lost, name a new one from any city you own; if you own no city, any settlement.

---

## 3. SHOP

| Item | Cost | Tech cost | Effect |
|---|---|---|---|
| **Walls** | 0.1M | — | ×1.8 defence, doubles siege time |
| **Library** | 0.075M | — | +5% of total R · max one per settlement · capped at +50% (see §4) |
| **Workshop** | 0.075M | — | +3500 money from settlement |
| **Market** | 0.075M | — | +10% money from settlement |
| **Courthouse** | 0.05M | — | Settlement can be cored (also needs 20 years) |
| **1000 soldiers** | **free** | — | Men only — weapons bought separately |
| **Swords** (1000) | 0.005M | unlocked | ×1 |
| **Muskets** (1000) | 0.01M | x1.5MR | ×1.3 |
| **Rifles** (1000) | 0.02M | x4MR | ×2 |
| **Cannons** (100) | 0.02M | x1.5MR | ×13 each · needs 1000 men |
| **Snipers** (20) | 0.01M | x1MR | Bought and stationed at a mountain pass you own (§8) |
| **Buy people** (1000 pop) | 0.1M | — | |
| **10 ships** | 0.1M | — | ×1 each |
| **10 gunships** | 0.2M | x3MR | ×3 each |
| **10 steam ships** | 0.5M | x20MR | ×8 each |

**Every cannon needs 10 crewmen.** Cannon crew do **not** count as men in the power formula.
**Every ship needs 50 crew at sea.** Ships in port need no crew. **Ships have no upkeep** of
their own — only their crew at sea do.
**Crew are soldiers.** Cannon crew and ship crew at sea pay soldier upkeep (§2) and count
toward your conscription cap (§9).

---

## 4. TECHNOLOGY

```
Swords (unlocked) ──▶ Muskets ──▶ Cannons ──┬──▶ Rifles
                                             └──▶ Snipers

Naval (unlocked) ──▶ Better Ships ──▶ Steam Ships   [not supposed to get this]
```

```
R per year = max(0, net money per year − bank interest + x10K) × (1 + 0.05 × libraries)
             libraries counts at most 10
```

Money and R are **separate pools**. R builds up every year; a tech unlocks as soon as you
have paid its full R cost. **Unspent R banks.**

**Libraries.** Each Library you own adds **+5%** to your R per year. Bonuses **add up** — they
do not multiply — and the total is **capped at +50%** (10 Libraries). A settlement can hold only
one Library.

---

## 5. LAND COMBAT

```
power = (men + cannons × 13) × (d6 + 6)
        ×2 for the riflemen · ×1.3 for the musketmen
```

- Cannon crew are **not** counted in `men`.
- **Men without weapons have power 0.**
- Multipliers apply per weapon group — if 1,000 men have rifles and the rest swords, only those
  1,000 get the ×2.

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
| 3.4:1+ | 9% | wiped out |

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
move or attack — they wait for an army to pass through.
```
damage = number of snipers × d6 × 10      max 25 snipers per battle
Total damage may never exceed 50% of the passing army.
```
Snipers take no losses when they fire, and survivors pass through freely.

**Clearing snipers.** An army may `storm` the sniper post. Resolve it as a field battle in which
each sniper counts as **50 power**:
```
sniper power = snipers × 50 × (d6 + 6)
```
The pass ×2 does **not** apply to snipers. Losses are applied as in a normal battle.

---

## 6. TAKING A SETTLEMENT

**Undefended settlement** — if no enemy army is in it, an army that enters captures it
immediately. No battle is fought and no one dies.

**Storm** — a field battle with the defender's bonus applied. If the attacker wins, the settlement
falls immediately and the defender rolls d6: **1–3** escapes with normal losses, **4–6** loses
everything.

**Siege** —
```
n = pop ÷ 20000 years      ×2 if walls
```
**The siege length is fixed when the siege begins and cannot change while it runs.**

**Sortie.** The garrison may order `sortie` at any time before the timer expires. It marches out
and fights the besieging army in a normal land battle (§5). If the garrison wins, the besiegers
retreat and the siege ends. If it loses, it falls back inside and the siege continues on the
same timer. **When the timer expires the defender loses all its troops.**

---

## 7. NAVAL

```
power = (ships + gunships × 3 + steam ships × 8) × (d6 + 6)
```
Damage as in a land battle, applied to ships (rounded). Crew of sunk ships are lost from
your population (§2).

**Fleet orders.** Sail a fleet into a sea zone (zones are defined in the scenario), then give it
one of two orders:

- `blockade` — pick an enemy port in that sea zone. While the blockade holds, that settlement's
  growth becomes **−0.5% total** — no other growth bonus applies.
- `patrol` — the fleet engages **any enemy ship in that sea zone**. Distance inside the zone does
  not matter; being in the same zone is enough.

---

## 8. ARMIES, FLEETS AND MOVEMENT

*(Movement distances are scenario-specific.)*

**Raising forces.** New armies are made in any **core settlement**. You may add men and upgrade
weapons in existing armies. You may also **remove men from an army** — their weapons go to a
reserve for later use. Fleets work the same way — add ships to an existing task force or
form a new one.

**Reinforcement:** instant inside core territory; otherwise it arrives on a timer based on distance.

| Movement | |
|---|---|
| Army, one settlement | 0.5 years (avg) |
| Army, settlement ↔ mountain pass | 0.5 years (avg) |
| River crossing | +2 months |
| Navy | 3 coastal settlements per year |

**Mountain passes (yellow triangles).** Some routes cross the mountains through a pass. A pass is
a node on the map, like a settlement with no people in it, and the route runs settlement → pass →
settlement.

- **Armies can be sent to a pass** and stay there. Each leg (settlement to pass, pass to settlement)
  is one step, so a route through a pass takes twice as long as an ordinary route.
- **An army defending a pass gets ×2** defence (§5).
- **Snipers** are bought and stationed only at passes (§5).
- **Each pass belongs to one country** — whoever's territory it lies in, i.e. whoever owns the
  settlement whose land the pass is in (listed in the scenario). It changes hands with that
  settlement. Only the owner can buy snipers there.
- **Snipers stay when a pass changes hands** — they still belong to the country that bought them.
  A country's snipers are removed only when that country **no longer owns any city**.

**Zone of control.** An army entering a province with an enemy army stops there and engages,
cancelling the rest of its path.

**Orders:** `move` · `besiege` · `storm` · `sortie` (garrison only, §6).
**Fleet orders:** `move` · `blockade` · `patrol` (§7).

**Battle cooldown:** one resolution per pair of armies per 3 months. The loser retreats
immediately, as in §5 *After the battle*.

**Straits (dashed lines).** An army may cross if you control **≥10 ships** in that sea zone (see
*Sea zones* in the scenario) and
no enemy fleet contests it. Crossing consumes the entire year. If an enemy fleet is present,
fight a naval battle first — lose and the crossing fails.

---

## 9. CONSCRIPTION LAWS

You cannot change again for **5 years**.

| Government | Max army | Income |
|---|---|---|
| Feudal | 6% | — |
| Centralized | 10% | −6% |
| Militarized | 15% | −10% |
| Total War | 25% | −30% |
| Scrap the Barrel | 40% | −80% |

The percentage applies to **core manpower + half of non-core**. Cannon crew and ship crew
at sea count toward this limit.

---

## 10. DIPLOMACY

Alliances · Non-aggression pacts · Declarations of war · Guarantees · Peace treaties

- **Vassal** — pays you **40%** of its income.
- **Protectorate** — pays you **10%** of its income.

**Peace:** if you have conquered everything you dictate terms. Otherwise either side may propose
peace and both must agree. *(Terms still to be defined.)*

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

---

# SCENARIO: MITTELEUROPA

*Everything below is specific to this map.*

**x = 1** · 87 settlements · 45 countries · country sizes 10K–50K

## Special coring
*(no Courthouse and no 20-year wait)*

You may proclaim a region when **both** are true:

1. Your **capital** lies within the region.
2. You control **100%** of its settlements.

Every settlement in the region becomes core immediately. If you later lose one and retake it, it
is core again on capture.

| Formable | Settlements | Count |
|---|---|---|
| **Unite Austria** | 32, 33, 34, 35, 39 | 5 |
| **Unite Czechoslovakia** | 26, 28, 29, 30, 31 | 5 |
| **Unite the Benelux** | 53, 54, 55, 56, 57, 58 | 6 |
| **Unite French-speaking people** | 41, 42, 43, 44, 45, 53, 54, 55 | 8 |
| **Unite Scandinavia** | 1–9 | 9 |
| **Old Poland** | 22, 23, 80, 81, 83, 84, 85, 86, 87, 88 | 10 |
| **AustroHungary** | 23, 24, 26, 28–35, 39, 86 | 13 |
| **Modern Poland** | 14, 15, 16, 20, 22, 23, 79–88 | 16 |
| **Polish–Lithuanian Commonwealth** | Modern Poland + 17, 18, 19, 21, 24, 89 | 22 |
| **Germany** (1990) | 10–13, 36–38, 47–52, 59–78 | 33 |
| **Post Germany** (1930) | Germany + 14, 17, 20, 79, 85 | 38 |
| **Greater Germany** (Kaiser 1880) | Post Germany + 16, 19, 45, 80, 82, 83 | 44 |
| **Greater German Reich** (all German-speaking) | Greater Germany + 28, 29, 30, 32–35, 39, 40, 46, 53 | 55 |

Settlements 25 and 27 were deleted from the map and are not part of any region.

## Sea zones

**North Sea · Skagerrak–Kattegat · Baltic.** A fleet operates in one zone at a time.

## Mountain passes

7 passes, shown as yellow triangles on `map-connections.png` and numbered west to east. A pass
lies in one settlement's land and belongs to whoever owns that settlement. Every route listed
runs settlement → pass → settlement.

| Pass | Routes through it | In the land of | Owner at start |
|---|---|---|---|
| **P1** | 41 Bern – 42 Geneva · 41 Bern – 45 Strassburg · 41 Bern – 46 Basel | 41 Bern | Z Switzerland |
| **P2** | 41 Bern – 47 Konstanz · 40 Zurich – 47 Konstanz | 40 Zurich | Z Switzerland |
| **P3** | 39 Innsbruck – 40 Zurich | 40 Zurich | Z Switzerland |
| **P4** | 30 Prague – 36 Passau · 30 Prague – 72 Chemnitz | 30 Prague | Q Bohemia |
| **P5** | 30 Prague – 73 Dresden · 30 Prague – 85 Breslau · 29 Ostrava – 85 Breslau | 30 Prague | Q Bohemia |
| **P6** | 28 Brno – 35 Linz · 28 Brno – 33 Vienna · 28 Brno – 31 Bratislava · 28 Brno – 32 Hainburg | 28 Brno | Q Bohemia |
| **P7** | 29 Ostrava – 86 Krakow | 29 Ostrava | Q Bohemia |

## The Holy Roman Empire

> **HRE settlements:** 10–14, 28–30, 32–42, 44–78, 85 *(55 settlements)*

Of the two countries partly inside the Empire, O Silesia's **85** is in and **86** is out, and
AB Nancy's **44** is in and **43** is out.

Demand to become leader of the Empire under your hegemony. You must control **at least 10
settlements inside the HRE**, and may propose **only once, ever**.

```
chance each German state joins = your soldiers ÷ their soldiers × 10 %
0% if you do not have more soldiers than they do
```

Protectorates pay you **10%** of their income.

## Victory

> **Control or vassalize 45 settlements.** Protectorates count as half — unless you demand one
> become a vassal and it agrees.

There is **no end date**. The game ends only when a player reaches 45.
