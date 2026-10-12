# GRAND CAMPAIGN 1440
### A strategy game of Central Europe, 1440–1540 AD

---

## 0. THE BASICS

- The map is divided into **89 provinces**, each outlined in grey and each containing one settlement.
- **Towns** (small red circles) start at **10,000 pop**. **Cities** (grey squares) start at **20,000 pop**.
- A **country** is a group of provinces. Countries start between **10,000 and 50,000 pop**.
- **1 turn = 1 year.** The game begins in **1400 AD**.
- Money is written in millions. `0.1M = 100,000`. Population and money use the same units.
- All dice are **d6**.

### Starting values
| | |
|---|---|
| Population | Cities 20,000 · Towns 10,000 |
| Treasury | 1M |
| Soldiers | pop ÷ 25 |
| Ships | pop ÷ 2000 — **coastal countries only** |
| Government | Feudal |
| Technology | Military + Naval unlocked, Muskets unlocked |

Each country names a **capital** at setup (a city if it owns one). If the capital is lost, name a
new one from any city you own; if you own no city, any settlement.

---

## 1. TURN ORDER

Each year, resolve these phases in order. Within a phase, players act in seating order.

1. **Income** — collect money, pay upkeep and research.
2. **Events** — each player rolls for random events.
3. **Purchases** — buy from the shop, start or continue research, deposit or withdraw from the bank.
4. **Movement** — move armies and fleets.
5. **Combat** — resolve all battles, storms, sieges and blockades.
6. **Diplomacy** — declare war, offer treaties, propose the Empire, proclaim formables.
7. **Growth** — apply population growth. Advance the year.

---

## 2. ECONOMY

### Income per turn

```
income = bank interest
       + core pop × 2
       + non-core pop × 1
       − soldiers × 1.5
       − research payment
```

- **Bank:** deposits earn **2% per turn**. Deposit or withdraw freely during the Purchase phase.
- **Core** provinces are your original provinces, provinces held **20+ years**, and provinces
  cored by a **special coring** (§9).
- **Soldiers** includes ship crews at sea and cannon crews.
- **Negative income:** soldiers desert until income reaches zero. You choose which.

### Population growth
Every settlement grows **+1% per turn**, or **+1.5%** if it is on a river or the coast.
Soldiers may never exceed total population.

---

## 3. THE SHOP

| Item | Cost | Tech required | Tech cost |
|---|---|---|---|
| 1000 soldiers (men only) | **free** | — | — |
| Muskets (1000) | 0.01M | Muskets | unlocked |
| Rifles (1000) | 0.02M | Rifles | 1M |
| Cannons (100) | 0.15M | Cannons | 0.2M |
| Sniper (each) | 0.01M | Snipers | 0.2M |
| Walls | 0.5M | — | — |
| Buy people (1000 pop) | 0.1M | — | — |
| 10 ships | 0.1M | — | — |
| 10 gunships | 0.2M | Better Ships | 1M |
| 10 steam ships | 0.5M | Steam Ships | 10M |

**Manpower is free; equipment is not.** Men are limited by your population and your government's
army cap, not by money.

- **Every cannon needs 10 crewmen.** Crew count as men for the cap and for upkeep.
- **Every ship needs 50 crew when at sea.** Ships in port need no crew.
- **Unarmed men contribute 0 power.** Every soldier who fights needs a musket or a rifle.
- **Equipment is lost with the men.** If you lose 40% of an army, you lose 40% of its muskets,
  rifles and cannons too.

### Research
`0.1M of research = 1 year of progress.` Pay as you go — **any amount per turn**. A technology
completes when total payments equal its cost. Progress is never lost.

```
Military (unlocked) ──▶ Muskets (unlocked) ──▶ Cannons ──┬──▶ Rifles
                                                          └──▶ Snipers

Naval (unlocked) ──▶ Better Ships ──▶ Steam Ships   [10M — you are not supposed to get this]
```

---

## 4. GOVERNMENT

You may change government once, then **not again for 5 years**.

| Government | Max army | Income |
|---|---|---|
| Feudal | 6% of pop | — |
| Centralized | 10% | −5% |
| Militarized | 15% | −10% |
| Total War | 25% | −30% |
| Scrap the Barrel | 40% | −80% |

Scrap the Barrel nets roughly **−0.2 × pop per turn** at full strength. It is an emergency, not a
posture — you will start losing soldiers to desertion.

---

## 5. LAND COMBAT

### Field battle

```
power = (riflemen × 2 + musketmen + cannons × 10) × (d6 + 6)
```

Unarmed men add nothing. Higher power wins. The dice band (7–12) means a **1.75:1 advantage is a
guaranteed win**; anything closer is a gamble.

**Casualties**, applied as a percentage of men, cannons and equipment:

```
winner loses  (P_loser  ÷ P_winner) × 30 %
loser  loses  (P_winner ÷ P_loser ) × 30 %      (capped at 100%)
```

| Ratio | Winner loses | Loser loses |
|---|---|---|
| 1:1 | 30% | 30% |
| 2:1 | 15% | 60% |
| 3:1 | 10% | 90% |
| 3.4:1+ | 9% | **wiped out** |

**After the battle:** the winner may advance or hold. The loser retreats to the nearest friendly
city. If no friendly city is reachable, the army is destroyed.

### Defensive bonuses — choose ONE

The defender picks **either** the terrain **or** the settlement. They never stack.

| Situation | Multiplier |
|---|---|
| Defending in a mountain province | **×2** |
| Defending in a city | **×1.2** |
| Defending in a walled city | **×1.8** |
| Defending in a walled city, attacker has cannons | **×1.2** |

### Zone of control
An army moves in a straight line out of a settlement. If an enemy army stands in the way, you must
fight it — you cannot slip past.

### Snipers
Snipers may only be placed in a **mountain** province. They cannot attack or move. When an enemy
army enters or passes through, the snipers fire:

```
damage = number of snipers × d6 × 10      (×2 with rifles)
Maximum 100 snipers per battle.
Total damage may never exceed 50% of the passing army.
```

Snipers take no losses and the survivors of the enemy army pass through freely. An attacker who
wants the mountain cleared must **spend a full turn attacking the snipers**: each sniper counts as
**50 power**, and the mountain ×2 does *not* apply to them.

---

## 6. CITIES

### Storming
Resolve as a field battle with the defender's bonus applied. If the attacker wins, the city falls
immediately and the defender rolls d6: **1–3** he escapes to the nearest friendly city with normal
losses, **4–6** his entire army is destroyed.

### Siege
Surround the city and wait.

```
n = pop ÷ 5000 turns          (round up)
n × 2 if the city has walls
```

`n` is **locked when the siege begins** — later population growth does not extend it.
A 20,000 city falls in 4 turns, or 8 if walled. A 10,000 town falls in 2, or 4 if walled.

The siege breaks if the besieging army leaves or is defeated in the field. When the city
surrenders, the garrison escapes to the nearest friendly city having **lost 50%** of its strength.

---

## 7. NAVAL

```
power = (ships + gunships × 3 + steam ships × 8) × (d6 + 6)
```

Damage is calculated exactly as in a field battle, applied to ships.

**Sea zones:** North Sea · Skagerrak–Kattegat · Baltic. Fleets operate in one zone at a time.

**Blockade:** as a siege, but **twice as long**. Blockade and siege timers run together if both are
in place; use the shorter.

**Straits (dashed lines).** An army may cross a dashed line if you control **10+ ships** in that sea
zone and no enemy fleet contests it. Crossing consumes the entire turn. If an enemy fleet is
present, fight a naval battle first — lose, and the crossing fails and the army stays put.

---

## 8. MOVEMENT

Each army has **3 movement points** per turn.

| Terrain | Cost |
|---|---|
| Normal province | 2 |
| Province linked by road | 1 |
| River crossing | +1 |
| Mountain province | **Ends your turn on entry** |

So: one normal province per turn, or up to three along roads, or one river crossing.

---

## 9. CORING AND FORMABLES

A province becomes **core** (income ×2 instead of ×1) when you have held it for **20 years**, or
instantly through **special coring** below.

### Special coring
If your **capital** lies within one of these regions and you control **75%** of its provinces, you
may proclaim it. Every province in the region you own becomes core immediately, and every province
in the region you later take is core on capture.

| Formable | Provinces | Count |
|---|---|---|
| **Unite Austria** | 32, 33, 34, 35, 39 | 5 |
| **Unite the Benelux** | 53, 54, 55, 56, 57, 58 | 6 |
| **Unite Czechoslovakia** | 25, 26, 27, 28, 29, 30, 31 | 7 |
| **Unite French-speaking people** | 41, 42, 43, 44, 45, 53, 54, 55 | 8 |
| **Unite Scandinavia** | 1–9 | 9 |
| **Proclaim Old Poland** | 22, 23, 80, 81, 83, 84, 85, 86, 87, 88 | 10 |
| **Proclaim Austro-Hungary** | 23–35, 39, 86 | 15 |
| **Proclaim Modern Poland** | 14, 15, 16, 20, 22, 23, 79–88 | 16 |
| **Proclaim the Polish–Lithuanian Commonwealth** | Modern Poland + 17, 18, 19, 21, 24, 89 | 22 |
| **Proclaim Germany** (1990) | 10–13, 36–38, 47–52, 59–78 | 33 |
| **Proclaim Post Germany** (1930) | Germany + 14, 17, 20, 79, 85 | 38 |
| **Proclaim Greater Germany** (Kaiser, 1880) | Post Germany + 16, 19, 45, 80, 82, 83 | 44 |
| **Proclaim the Greater German Reich** (all German-speaking) | Greater Germany + 28, 29, 30, 32–35, 39, 40, 46, 53 | 55 |

Formables of **15 provinces or more** also grant a permanent **+2% max army**.

---

## 10. DIPLOMACY

Available: alliances · non-aggression pacts · trade agreements · declarations of war ·
guarantees · peace treaties.

- **Vassal** — pays you **40%** of its income. Counts fully toward victory.
- **Protectorate** — pays you **10%** of its income. Counts as **half** toward victory. You may
  later demand a protectorate become a vassal; if it accepts, it counts fully.

### The Holy Roman Empire
To propose the Empire you must control **10 or more settlements inside the HRE**.

> **HRE provinces:** 10, 11, 12, 13, 14, 28, 29, 30, 32–42, 44–78, 85

Every independent HRE state rolls to join you as a protectorate:

```
chance = (your soldiers ÷ their soldiers) × 10 %      maximum 60%
If you do not have more soldiers than them, the chance is 0%.
```

Roll **once per state per proposal**. States allied to a rival, or at war with you, do not roll.
You may propose again after **5 years**. The Emperor collects 10% from every protectorate.

---

## 11. RANDOM EVENTS

Roll once per year, per country.

| Event | Chance | Effect |
|---|---|---|
| Good harvest | 10% | +10% income this year |
| Plague | 5% | −10% population |
| Peasant uprising | 15% *(only if a plague struck in the last 3 years)* | See below |

**Peasant uprising.** A rebel army of **3% of your population**, armed with muskets, appears in your
least-developed province. It does not move. It besieges that province normally. While it holds a
province you collect no income from it. Defeat it in battle to disperse it. It cannot be
negotiated with.

---

## 12. VICTORY

> **Control or vassalize 45 settlements.** Protectorates count as half.

The game ends immediately when a player reaches 45, or in **1500 AD** (turn 100), whichever comes
first. If nobody has reached 45 by 1500, the highest total wins.

---

## APPENDIX — OPTIONAL RULES

Not part of the core game. Add them if the problems they solve show up at your table.

- **Blood price.** Battle casualties remove population 1:1. Makes defeat lastingly expensive and
  gives "Buy people" a real purpose. *Recommended if wars feel too cheap.*
- **Lean start.** Starting treasury 0.1M instead of 1M. At 2% interest, banking the full 1M yields
  0.02M/turn — worth +100% income to a 10,000-pop country and +20% to a 50,000-pop one, so the flat
  treasury quietly equalizes small states and makes "bank everything on turn 1" the strongest
  opening. *Use this if you would rather balance the map deliberately than through the bank.*
- **Trade cities.** Danzig (16), Hamburg (66), Antwerp (56), Rotterdam (57), Rostock (13),
  Cologne (61) and Kraków (86) produce double income. *Adds economic war aims.*
- **The Sound toll.** Whoever holds Copenhagen (7) collects 0.05M per turn from every country with
  a Baltic coastline.
