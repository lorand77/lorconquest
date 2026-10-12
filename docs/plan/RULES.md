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

Every **town** (small circle) starts at **10,000 pop**; every **city** (big dot) at **20,000**.

```
money per year = bank interest
               + core pop × 2
               + non-core pop × 1
               − soldiers × 1.5      (cannon crew and ship crew count as soldiers)
```

**Pop growth:** +1% per year, **+0.5%** if on a river or coast.
**Soldiers may never exceed total population.**

**Casualties cost population.** Every soldier who dies is removed from your population, not
just from the army — whether killed in battle, by snipers, in a lost storm, or when a siege
timer expires. Each lost cannon also kills its **10 crew**, and each ship sunk at sea kills its
**50 crew**. The loss is spread across all settlements you own **in proportion to their
population**, so a 20K city loses twice as many people as a 10K town. Lost people come back
only through growth or **Buy people**.

**Coring.** A settlement becomes core after you have held it **20 years** *and* bought a
**Courthouse**. Special coring (§9) waives both.

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

**Capital.** Each country names a capital at setup — a city if it owns one. If the capital is
lost, name a new one from any city you own; if you own no city, any settlement.

---

## 3. SHOP

| Item | Cost | Tech cost | Effect |
|---|---|---|---|
| **Walls** | 0.1M | — | ×1.8 defence, doubles siege time |
| **Library** | 0.075M | — | +40% research from settlement |
| **Workshop** | 0.075M | — | +3500 money from settlement |
| **Market** | 0.075M | — | +10% money from settlement |
| **Courthouse** | 0.05M | — | Settlement can be cored (also needs 20 years) |
| **1000 soldiers** | **free** | — | Men only — weapons bought separately |
| **Swords** (1000) | 0.005M | unlocked | ×1 |
| **Muskets** (1000) | 0.01M | x1.5MR | ×1.3 |
| **Rifles** (1000) | 0.02M | x4MR | ×2 |
| **Cannons** (100) | 0.02M | x1.5MR | ×13 each · needs 1000 men |
| **Snipers** (20) | 0.01M | x1MR | Mountain only |
| **Buy people** (1000 pop) | 0.1M | — | |
| **10 ships** | 0.1M | — | ×1 each |
| **10 gunships** | 0.2M | x3MR | ×3 each |
| **10 steam ships** | 0.5M | x20MR | ×8 each |

**Every cannon needs 10 crewmen.** Cannon crew do **not** count as men in the power formula.
**Every ship needs 50 crew at sea.** Ships in port need no crew.
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
R per year = max(0, net money per year − bank interest + x10K)
x0.1MR of research = 1 year of progress
```

Money and R are **separate pools**. Pay R over the duration. **Unspent R banks.**

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
army that arrived there first.

**After the battle:** winner may advance or hold. Loser retreats to the nearest settlement
owned by itself or a **military ally** (§10). If neither it nor any military ally owns a
settlement, there is nowhere to retreat and **the whole losing army dies**.

### Defence
| Situation | Multiplier |
|---|---|
| Mountain | ×2 |
| Defending a settlement | ×1.2 |
| Settlement with walls | ×1.8 |

The defender takes **either** the mountain **or** the settlement bonus — they never stack.

Every 100 cannons the attacker brings lowers the wall multiplier by **0.3**, floored at **1.2**.

### Snipers
Mountain only. Cannot move or attack — they wait for an army to pass.
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
The mountain ×2 does **not** apply to snipers. Losses are applied as in a normal battle.

---

## 6. TAKING A SETTLEMENT

**Storm** — a field battle with the defender's bonus applied. If the attacker wins, the settlement
falls immediately and the defender rolls d6: **1–3** escapes with normal losses, **4–6** loses
everything.

**Siege** —
```
n = pop ÷ 20000 years      ×2 if walls
```
**The siege length is fixed when the siege begins and cannot change while it runs.**

The garrison may sortie at any time before the timer expires. **When it expires the defender
loses all its troops.**

---

## 7. NAVAL

```
power = (ships + gunships × 3 + steam ships × 8) × (d6 + 6)
```
Damage as in a land battle, applied to ships (rounded). Crew of sunk ships are lost from
your population (§2).

**Blockade:** the settlement's growth becomes **−0.5% total** — no other growth bonus applies.

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
| River crossing | +2 months |
| Mountain | ×2 time |
| Navy | 3 coastal settlements per year |

**Zone of control.** An army entering a province with an enemy army stops there and engages,
cancelling the rest of its path.

**Orders:** `move` · `besiege` · `storm`.

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
| Good harvest | 10% | +10% tax that year |
| Plague | 5% | −10% pop |
| Peasant uprising | 15% *(only if a plague struck in the last year)* | See below |

**Peasant uprising.** A rebel country forms with **3% of your pop**, armed with swords, spawning
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
