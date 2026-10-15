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
               − soldiers × 1.5      (cannon crew and ship crew count as soldiers)
```

**Pop growth:** +1% per year, **+0.5%** if on a river or coast.

**Casualties cost population.** Every soldier who dies is removed from your population, not
just from the army — whether killed in battle, by snipers, in a lost storm, or when a siege
timer expires. Each lost cannon also kills its **10 crew**, and each ship sunk at sea kills its
**50 crew**. Snipers count too — each sniper killed when its post is stormed or its pass is lost
(§8) is one person lost. The loss is spread across all settlements you own **in proportion to their
population**, so a 20K city loses twice as many people as a 10K town. Lost people come back
only through growth or **Buy people**.

**Coring.** A settlement becomes core after you have held it **20 years** *and* bought a
**Courthouse**. Special coring (see [Special coring](SCENARIO.md#special-coring)) waives both.

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

Naval (unlocked) ──▶ Gunships ──▶ Steam Ships   [not supposed to get this]
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

**Undefended settlement** — if an enemy's settlement (§10) has no army in it, an army that enters
captures it immediately. No battle is fought and no one dies.

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

**Fleet orders.** Sail a fleet into a sea zone (zones are listed in
[SCENARIO.md](SCENARIO.md#sea-zones)), then give it one of two orders:

- `blockade` — pick an enemy port in that sea zone. While the blockade holds, that settlement's
  growth becomes **−0.5% total** — no other growth bonus applies.
- `patrol` — the fleet engages **any enemy ship in that sea zone**. Distance inside the zone does
  not matter; being in the same zone is enough.

---

## 8. ARMIES, FLEETS AND MOVEMENT

*(The army speed and the route lengths are scenario-specific.)*

**Raising forces.** New armies are made in any **core settlement**. You may add men and upgrade
weapons in existing armies. You may also **remove men from an army** — their weapons go to a
reserve for later use. Fleets work the same way — add ships to an existing task force or
form a new one.

**Reinforcement:** instant inside core territory; otherwise it arrives on a timer based on distance.

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

**Neutral land is open.** Armies may march through and stop in the land of any country they are
not at war with, but cannot capture, besiege or storm its settlements, and armies that are not at
war ignore each other — no battle and no zone of control.

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
| **Non-aggression pact** | Neither side may declare war on the other | 10 years |
| **Truce** | Starts when a peace is signed; neither side may declare war on the other | 5 years |

A **military ally** (§5) is any country allied with you, by either kind of alliance, that is
fighting the same war on your side.

**Breaking an agreement.** You may break any agreement — including declaring war through a pact or
truce. If you do, **all your alliances end**, and computer countries trust you less for
**10 years** (see *Computer countries*).

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
your enemy's settlements, you dictate the terms. Signing peace starts a **truce**.

### Computer countries
*(How a computer-run country decides whether to accept a proposal is still to be defined.)*

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

