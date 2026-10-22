# MITTELEUROPA 1440
### Real-time grand strategy — current ruleset

> **Scenario scaling.** `x` is a per-scenario cost multiplier. `x1.5MR` means `x × 1.5M` R.
> `x` applies to **tech costs, starting treasury, the flat R bonus, the sharpshooter and cannon
> counts in combat and the ships needed to cross a strait** (§5, §6, §8) — never to shop prices.
> Each scenario sets its own `x`; the Mitteleuropa scenario is in [SCENARIO.md](../scenarios/mitteleuropa/SCENARIO.md).
> **Money and R** are in the same unit as `M`: 0.1M is 100,000.
> Town and city populations (10K / 20K) are the same in every scenario; what changes between
> scenarios is the map, country sizes, costs, coring, and the victory condition.

---

## 1. TIME

| Game time | Real time |
|---|---|
| 1 day | 0.1s |
| 1 month | ≈3.04s |
| **1 year** | **36.5s** |
| 100 years | ≈61 min |

Start **1440 AD**. The calendar has **365 days** with the usual months and no leap years. "The
start of each month" is its 1st; "the start of each year" is 1 January.

**Single player:** free pause; the game runs at this one speed. Leaving pauses the game, and it
can be resumed later.
**Multiplayer:** up to **4 human players**; the computer runs every other country. For the first
minute the clock stands still while players look around and give their first orders; after that
there are no pauses.

- **A player who disconnects** is replaced at once by a **caretaker**. It defends with the
  armies the country already has and joins wars its allies call it into, but buys nothing,
  declares no war, makes no peace and signs no agreement. After **2 minutes** away the full
  computer player takes over. A player who comes back takes their country back at once.
- **The game ends when no human player is left** — every one has quit, or been away longer
  than 2 minutes.

---

## 2. ECONOMY

Every **town** (red circle) starts at **10,000 pop**; every **city** (red square) at **20,000**.

```
civilians        = pop − soldiers − rebels (§11), spread over your settlements in proportion to their pop
settlement money = (core civilians × tax + non-core civilians × tax ÷ 2 + 3500 per Workshop)
                   × (1 + 15% if it has a Market)           (Workshops and Markets, §3)
                   × (1 − your conscription law's income penalty, §9)

money per year   = settlement money
                 − soldiers × 5      (cannon crew, ship crew at sea and sharpshooters count as soldiers)
                 − mercenaries × 15  (§8)
                 − loan interest     (8% a year of what you owe)
                 + tribute you receive − tribute you pay (§10)
                 + bank interest
```

**Paid monthly.** Every amount given per year — money, upkeep, interest, tribute, research (§4)
and population growth — is paid at the start of each month, a twelfth at a time.

The conscription penalty cuts **settlement money only**, before upkeep is paid — never upkeep,
bank interest or tribute (§10). A subject pays its overlord a share of its money per year *before* its own tribute is counted.

**Tax.** You set the tax from **2 to 3** in steps of 0.1. Every country starts at **2**, the
normal rate, and you may move it at any time. Each core civilian pays `tax` a year and each
non-core civilian half of it, so tax 3 brings in 50% more than tax 2 (a Workshop's flat 3500 does
not change). Taxing above 2 risks a **peasant uprising** (§11), rolled each year on your
**average tax over the past year** — lowering it just before the roll does not help:
```
uprising chance per year = (average tax − 2)² × 25%
```

| Tax | Settlement money | Uprising chance per year |
|---|---|---|
| **2** | normal | **0%** |
| 2.2 | +10% | 1% |
| 2.4 | +20% | 4% |
| 2.5 | +25% | 6.25% |
| 2.6 | +30% | 9% |
| 2.8 | +40% | 16% |
| **3** | **+50%** | **25%** — about one every 4 years |

**Soldiers are still people, but earn nothing.** A serving soldier stays in your population — they
count toward growth and come home when disbanded — but while serving they farm and trade nothing:
they pay no tax, and cost upkeep on top. Every man who counts as a soldier in the upkeep line
above (men in training, cannon crew, ship crew at sea and sharpshooters too) is left out of
`civilians`. A soldier therefore costs **7 a year** at tax 2 — 5 upkeep and 2 in lost tax. Only
death (below) takes them out of the population.

**Pop growth:** +1% per year, **+0.5%** more if on a river or coast.

**Casualties cost population.** Every soldier who dies is removed from your population, not
just from the army — whether killed in battle, by sharpshooters, in a lost storm, by lack of
supply (§8) or by disease in a siege (§6). Each lost cannon also kills its **10 crew**, and each
ship sunk at sea kills its **50 crew**. Sharpshooters count too — each one killed when its post
is stormed or its pass is lost (§8) is one person lost. The loss is spread across all settlements
you own **in proportion to their population**, so a 20K city loses twice as many people as a 10K
town. Lost people come back
only through growth or **Buy people**.
**Mercenaries** are the exception: they are foreigners, and their dead cost you no people (§8).

**Coring.** A settlement becomes core after you have held it **20 years** *and* bought a
**Courthouse**. Special coring (see [Special coring](../scenarios/mitteleuropa/SCENARIO.md#special-coring)) waives both.

**Conquest.** A captured settlement is held from the day it falls: the 20 years start again, its
courthouse is lost, and any soldiers or mercenaries still being raised in it are cancelled (§8). It
keeps its walls, library, workshop and market. It **stays core for every country that had it core**,
so retaking it makes it core again at once.

**Bank:** deposits earn `0.25% per month` interest (≈3%/year compounded). Withdraw any time.
Bank interest is **money only** — it never goes to research (§4).

Interest is added to the deposit each month, so it compounds.

**Loans.** Bankers lend to princes at war. You may borrow in chunks of **0.05M**, as long as your
total loans stay within **2 years of your settlement money**. The money goes straight to your
treasury; it is never income, so it never goes to research (§4). You pay **8% a year** on what you
owe, charged monthly as part of money per year, and may repay any amount in chunks of 0.05M at
any time. The bank pays only 3%, so borrowing to deposit loses money. If your settlement money
falls — lost settlements, a blockade — you keep your loans but cannot borrow more until you are
back under the limit.

**Default.** While you owe anything you may **default**, as Spain did six times: every loan is
**cancelled** and nothing is sold, but you **cannot borrow again for 20 years** — and your
mercenaries, paid from those loans, are not: **half of them desert at once**. A default is not
breaking an agreement (§10).

**Debt.** You may **not buy anything** that would take your treasury below zero. Debt therefore
only arises when upkeep and loan interest exceed income. That is allowed — you repay it later.
Owing a banker is not debt: a treasury in the red can be refilled with a loan. The **10-year
clock starts when your treasury first goes below zero** and resets once the debt is fully
repaid. If the debt is still unpaid **10 years after it began** and exceeds **pop × 10**, you go
bankrupt: buildings are sold off to clear it, then soldiers and weapons.

**Bankruptcy** sells, at their shop prices and until the treasury is no longer below zero: first the
buildings (in settlement order), then the weapons and cannons in the reserve, then the weapons the armies
carry — their men fight on, unarmed. The debt clock then stops.

**Each month**, in this order: people grow; unpaid mercenaries desert; the month's money is paid; the bank
pays interest; research is added and a tech whose cost is covered unlocks; the debt clock starts or stops;
a bankrupt country is sold up; settlements held 20 years with a courthouse become core. Every figure is
worked out from the state on that day.

A country with **no settlement left** is out of the game (§10, *Elimination*): it has no monthly step at all — no money,
interest, research or debt — whatever its treasury or loans stood at when its last settlement fell.

### Starting values
| | |
|---|---|
| Treasury | **x × pop × 2** — about one year of money from its people (a 10K town 20K, a 50K country 100K) |
| Soldiers | pop ÷ 25, equipped with swords — a garrison in every settlement of its own pop ÷ 25: 400 in a town, 800 in a city |
| Ships | pop ÷ 2000 cogs — **coastal countries only** |
| Cores | **every starting settlement is core** |

**Capital.** Each country starts with the capital its scenario names — a city if it owns one. If
the capital is lost, name a new one from any city you own; if you own no city, any settlement.
The capital trains soldiers twice as fast as other settlements (§8).

**Ships** start as cogs, in one fleet, in the capital's port — or, if the capital is not a port, in the
country's lowest-numbered port.

---

## 3. SHOP

| Item | Cost | Tech cost | Effect |
|---|---|---|---|
| **Walls** | 0.1M | — | ×1.8 defence, doubles siege time |
| **Library** | 0.075M | — | +5% of total R · max one per settlement · capped at +50% (see §4) |
| **Workshop** | 0.075M | — | +3500 money from settlement |
| **Market** | 0.075M | — | +15% money from settlement — its Workshop's 3500 included |
| **Courthouse** | 0.05M | — | Settlement can be cored (also needs 20 years) · only where it is not your core already |
| **1000 soldiers** | **free** | — | Men only — weapons bought separately · trained in 3–6 months (§8) |
| **1000 mercenaries** | 0.05M | — | Hired, not raised — come with pikes · arrive in 1 month · 15 upkeep each (§8) |
| **Swords** (1000) | 0.025M | unlocked | ×1 |
| **Pikes** (1000) | 0.03M | unlocked | ×1.2 · makes guns stronger in pike and shot (§5) |
| **Cavalry** (1000) | 0.06M | unlocked | ×1.4 · horses, armour and lances · field battles only (§5) |
| **Hand cannons** (1000) | 0.05M | x1.5MR | ×1.3 |
| **Arquebuses** (1000) | 0.07M | x2MR | ×1.6 |
| **Muskets** (1000) | 0.1M | x3.5MR | ×2 |
| **Cannons** (100) | 0.1M | unlocked | ×13 each, then ×1.2 — worth 15.6 men · manned by 10 of an army's soldiers each |
| **Sharpshooters** (100) | 0.015M | x1MR | ×2.5 · rifles · bought and stationed at a mountain pass you own (§5, §8) |
| **Buy people** (1000 pop) | 0.1M | — | |
| **10 cogs** | 0.1M | unlocked | ×1 each |
| **10 carracks** | 0.2M | x3MR | ×3 each |
| **10 galleons** | 0.33M | x8MR | ×5 each |
| **10 men-of-war** | 0.5M | x12MR | ×8 each |

**Where purchases go.** Swords, pikes, cavalry, guns and cannons go to your **reserve**; an army
is equipped from it instantly, wherever it is (§8) — each cannon taking 10 of the army's soldiers as its crew.
New ships appear in a port you own, of your
choice. People you buy are spread over your settlements in proportion to their pop.

A settlement holds **one** of each building. A **Library** beyond the tenth adds nothing, so you
cannot buy it. **Cannon crew and soldiers over the cap:** if the law changes to a lower one, or
people are lost, men already raised stay; only raising more is refused (§9).

**Every cannon is manned by 10 crewmen**, taken from the army's own soldiers when the cannon is added to it: the unarmed
first, then the weakest weapons (swords, pikes, hand cannons, cavalry, arquebuses, muskets), which go to the reserve;
mercenaries never. Crew are not raised on their own. A cannon returned to the reserve leaves its crew soldiers again,
unarmed. Crew without cannons — their cannons lost — are like men without weapons: power 0, but they take losses.
Cannon crew do **not** count as men in the power formula.
**Every ship needs 50 crew at sea.** Ships in port need no crew. **Ships have no upkeep** of
their own — only their crew at sea do.
**Crew are soldiers.** Cannon crew and ship crew at sea pay soldier upkeep (§2). Cannon crew
count toward your **army** cap and ship crew at sea toward your **navy** cap (§9). **So do
sharpshooters** — each sharpshooter is one soldier on the army cap.

**Putting to sea.** A fleet leaves port for the sea only if the crew it needs (50 a ship) fit under the
navy cap with the crew already at sea.

---

## 4. TECHNOLOGY

```
Swords, Pikes, Cavalry, Cannons (unlocked)
Swords ──▶ Hand cannons ──▶ Arquebuses ──┬──▶ Muskets
                                         └──▶ Sharpshooters

Cogs (unlocked) ──▶ Carracks ──▶ Galleons ──▶ Men-of-war
```

**Research slider.** You set the slider from **0% to 100%** in steps of 10%. Every country starts
at **50%**, and you may move it at any time.

```
investable = max(0, money per year − bank interest)        (§2, plus tribute you receive and
                                                             minus tribute you pay, §10)
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

Money and R are **separate pools**. R builds up every year. **You choose which tech to
research**, one at a time; it unlocks the moment your R covers its full cost, which is taken from
your R. **Unspent R banks** — with no tech chosen, it simply builds up. The flat x10K comes whatever the slider says, and bank
interest always goes to the treasury. When your money per year is zero or less there is nothing
to invest: the slider does nothing — the treasury takes the loss and you research only the flat
x10K.

**Libraries.** Each Library you own adds **+5%** to your R per year. Bonuses **add up** — they
do not multiply — and the total is **capped at +50%** (10 Libraries). A settlement can hold only
one Library.

**Naming the tech.** A tech needs its parent unlocked first (the tree above). Choosing another tech
while one is being researched replaces it; the R already in store stays.

---

## 5. LAND COMBAT

```
power = (men + cannons × 13) × (2d6 + 4)
        ×2 for musketeers · ×1.6 for arquebusiers · ×1.4 for cavalry · ×1.3 for hand gunners
        ×1.2 for pikemen · ×1.2 for the cannons
```

- Cannon crew are **not** counted in `men`.
- **Men without weapons have power 0.**
- Multipliers apply per weapon group — if 1,000 men have muskets and the rest swords, only those
  1,000 get the ×2. The cannons’ ×1.2 applies only to the `cannons × 13` part.
- **Pike and shot.** If at least **a third** of an army's armed men carry pikes, its guns — hand
  gunners, arquebusiers and musketeers — fight at **+20%** (muskets ×2.4, arquebuses ×1.92, hand
  cannons ×1.56). A third pikes and two thirds arquebuses averages ×1.68, better and cheaper than
  all arquebuses; with muskets the mix only ties on power (though pikes cost less), as pikes
  faded once muskets took over.
- **Cavalry** is a field arm. It fights at **×1** — no bonus — in a storm on either side (§6), at
  a mountain pass, against a sharpshooter post, and against an army in which at least **a third**
  of the armed men carry pikes or **half** carry muskets.
- **`2d6 + 4`** — each side rolls two dice and adds 4, so its factor is 6–16, most often around
  11. Every battle in the game uses it (land, sharpshooter posts, sea). An army 2:1 stronger wins
  about 98% of the time; only at about 2.7:1 is the win certain.

**Military power** — a country's whole land force on paper, used by diplomacy (§10) rather than
battles:
```
military power = men × their weapon multiplier + cannons × 15.6 + sharpshooters × 2.5
```
It is the power formula without the dice or any defence bonus, summed over every army, garrison
and sharpshooter post the country owns. Weapons count at their plain multipliers — cavalry ×1.4,
no pike-and-shot bonus. Men without weapons and men still in training count 0; ships do not
count.

**Damage** — applied as a percentage of men, cannons and equipment:
```
winner loses  (P_loser  ÷ P_winner) × 10 %
loser  loses  (P_winner ÷ P_loser ) × 25 %      capped at 100%
```

| Ratio | Winner loses | Loser loses |
|---|---|---|
| 1:1 | 10% | 25% |
| 2:1 | 5% | 50% |
| 3:1 | 3.3% | 75% |
| 4:1 or more | 2.5% or less | wiped out |

The loser always suffers more: most men in a real battle fell when their side broke and ran.
Men killed are also lost from your population — see *Casualties cost population* (§2).

**Armies fight together.** Every army of one side in the place where a battle happens fights it
as one, its military allies' armies (§10) included: their power is added up and each army takes
the same percentage of losses. Each losing army retreats on its own.

**Ties.** If both sides end with exactly equal power, the **defender wins**. The defender is
the side holding the settlement or province where the battle happens; if neither holds it, the
army that arrived there first. At a mountain pass, the defender is the army that reached the pass
first. In a head-on meeting on a route (§8), it is the side holding the settlement or pass at the
nearer end of the route; if neither holds it, the army that set out first.

**After the battle:** winner may advance or hold. Loser retreats to the nearest settlement
owned by itself or a **friend** — an ally of either kind, its overlord or a subject (§10), whether or not that friend is in
the war — nearest by marching time; from a route, back along it either way. Once there it stays, as a guest in a friend's
settlement.

**Retreating armies march.** The loser marches there at army speed (§8), by the fastest way
open to it: only through land it may enter (§10), with river and pass delays as usual. On the
way it takes no orders, takes no settlement and does not stop for zone of control, but enemy
armies it meets attack it — head-on on a route, at a pass it crosses, or besieging a settlement of
its own it passes; a garrison stays inside. It fights as a normal army, with no defence bonus.
When it arrives it can be given orders again; if the settlement fell to someone else on the way, it retreats again from there.
If no settlement of its own or a friend's can be reached, there is
nowhere to retreat and **the whole losing army dies**.

### Defence
| Situation | Multiplier |
|---|---|
| Defending a mountain pass (§8) | ×2 |
| Defending a settlement | ×1.2 |
| Settlement with walls | ×1.8 |

The mountain ×2 applies **only at mountain passes**. A pass has no settlement, so the pass and
settlement bonuses never stack. **Walls replace the settlement bonus** — a walled settlement
defends at ×1.8, not 1.2 × 1.8.

Every **100 × x** cannons the attacker brings lowers the wall multiplier by **0.3**, floored at **1.2**.

### Sharpshooters
Sharpshooters are **bought and stationed only at a mountain pass your country owns** (§8). They cannot
move or attack — they wait for an enemy army to pass through.
```
damage = sharpshooters × d6                      a pass holds at most 500 × x sharpshooters
Total damage may never exceed 25% of the passing army.
```
**Once per army per crossing.** Sharpshooters fire once at each enemy army when it enters the pass —
not again while it stays there, nor when it leaves. An army that leaves and later comes back is
fired on again. Sharpshooters take no losses when they fire, and survivors pass through freely.

The post fires when an enemy army **arrives** at the pass — also one retreating through it — whether
or not any army of the pass's owner is there. The sharpshooters are soldiers on the army cap (§9), and are
bought only while that cap has room. A post that wins a storm keeps its survivors; one that loses is wiped
out; the people killed in it are lost from the country it belongs to. The army that loses a storm falls
back as after any battle.

**Clearing sharpshooters.** An army may `storm` the sharpshooter post. Resolve it as a field
battle in which each sharpshooter counts as **2.5 power** — better than a musketeer — and, dug in
on the mountainside, gets the pass ×2:
```
sharpshooter power = sharpshooters × 2.5 × 2 × (2d6 + 4)
```
Losses are applied as in a normal battle. *Example:* a full post of 500 kills about 1,750 men per
crossing (capped at a quarter of the army), and storming it means facing 2,500 power — as much as
625 musketeers holding the same pass, or 1,250 in the open.

---

## 6. TAKING A SETTLEMENT

**Undefended settlement** — if an enemy's settlement (§10) has no army in it, an army that enters
captures it immediately. No battle is fought and no one dies.

**Defended settlement** — an army that arrives at an enemy settlement with an army inside
**begins a siege at once**, unless its orders say storm. It may be ordered to storm at any time
— as part of its move, or during the siege.

**Storm** — a field battle with the defender's bonus applied. If the attacker wins, the settlement
falls immediately and the defender rolls d6: **1–3** escapes with normal losses, **4–6** loses
everything.

**Siege** —
```
n = pop ÷ 20000 years      ×2 if walls
                           × (1 − 0.2 per full 100 × x cannons the besieger brings), at least × 0.4
```
**The siege length is fixed when the siege begins and cannot change while it runs** — cannons
that arrive later do not shorten it.

**Disease.** The besieging army loses **1% of its men every month** of the siege. They are lost
from your population like any casualty (§2). A two-year siege (a walled city) costs about a
fifth of the army; a six-month siege of an open town about 6%.

**Sortie.** The garrison may order `sortie` at any time before the timer expires. It marches out
and fights the besieging army in a normal land battle (§5) — out in the open, so **neither side gets a
defence bonus** (no settlement or wall multiplier). If the garrison wins, the besiegers retreat
and the siege ends. If it loses, it falls back inside and the siege continues on the same timer.

**Surrender.** When the timer expires the garrison surrenders and the settlement falls to the
besieger. The garrison is **disbanded on the spot**: its men come home as civilians
(no one dies), but its weapons and cannons are lost — they do **not** go to the reserve.

---

## 7. NAVAL

```
power = (cogs + carracks × 3 + galleons × 5 + men-of-war × 8) × (2d6 + 4)
```
Damage as in a land battle, applied to ships (rounded). Crew of sunk ships are lost from
your population (§2).

**Fleet orders.** Sail a fleet into a sea zone (zones are listed in
[SCENARIO.md](../scenarios/mitteleuropa/SCENARIO.md#sea-zones)), then give it one of two orders:

**Fleets in battle.** A fleet is in a port, or at sea in one zone; a fleet **sailing** to the next zone
(2 months) is in neither: it cannot fight, blockade, be fought or count for a strait. A **patrol** attacks
the enemy fleets at sea in its zone on the day it arrives or is ordered, if the fleets have not fought
within 3 months; if two patrols meet, the one that came to the zone later attacks. There is no bonus for
the defender but a tie goes to it. Fleets in port are safe. The beaten side **runs for its nearest port**
in the zone, if it has one, and waits there; ships sunk take their 50 crew each from the population. A
blockade holds only while its fleet is at sea in the zone, and ends if it leaves, is sunk or runs. A
fleet takes on one order at a time: patrol, blockade or none.

- `blockade` — pick an enemy port in that sea zone. While the blockade holds, **all money from
  that settlement is halved** (§2, its Workshop and Market included). Its growth is not affected.
- `patrol` — the fleet engages **any enemy ship in that sea zone**. Distance inside the zone does
  not matter; being in the same zone is enough.

---

## 8. ARMIES, FLEETS AND MOVEMENT

*(The army speed and the route lengths are scenario-specific.)*

**Raising forces.** New soldiers are trained in a **core settlement** (they also man cannons, §3) and take
time to appear:

A country may only raise or hire up to its **army cap**, counting men in training, soldiers, crew and
sharpshooters, and may not raise more men than it has civilians. The men appear in their settlement and
join an army of the country there that is not retreating and not outside the walls, or form a new one.

| Trained in | Time |
|---|---|
| Your capital (§2) | 3 months |
| Any other core settlement | 6 months |

While training, men already count toward your army cap (§9) and pay soldier upkeep (§2).
When they are ready they appear in that settlement and join any army of yours there, or form a
new one; to reach an army elsewhere they march like any other army. If the settlement is
captured or stops being core before they are ready, the training is cancelled and the men come
home.

You may upgrade weapons in an army instantly. You may also **remove men or crew from an army** —
they come home and their weapons and cannons go to a reserve for later use; men and crew raised
again must be trained again. Fleets work the same way — add ships to an existing task force or form a new
one.

**Mercenaries.** Swiss and Landsknecht companies fight for whoever pays. Hire them by the thousand
(§3): they arrive **1 month** later, armed with **pikes**, at any core settlement you choose, and
join or form an army there like trained men. If that settlement is captured first, the hire is
cancelled and the money lost. They are **foreigners**:

A mercenary stays a mercenary in the army he is in: casualties are shared between regulars and
mercenaries in proportion, and only the regulars cost population. Splitting an army takes mercenaries
along in proportion to the men taken; merging joins them. Desertion takes a tenth of each army's mercenaries,
rounded up, and a default half; an army that loses all its men is gone.

- they are **not** taken from your civilians and do **not** count toward your army cap (§9) — but
  you may have at most as many mercenaries as your army cap;
- their upkeep is **15 a year** each, three times a soldier's (§2);
- their dead cost you **no population** (§2).

Otherwise they are men like any other: they fight, count toward supply and military power, and may
be re-equipped with your weapons (their pikes go to your reserve). **Dismissing** them is instant —
they leave, and the weapons they carry go to your reserve. **Unpaid mercenaries desert:** at the
start of every month your treasury is below zero, **10%** of your mercenaries leave, taking their
weapons with them.

| Movement | |
|---|---|
| Army | route length ÷ army speed |
| River crossing | +1 month |
| Leg to or from a mountain pass | +2 months |
| Fleet, to a neighbouring sea zone | 2 months |

**Marching time is proportional to distance.** Every route has a length — the length of its line on
the map — and an army covers it at the army speed set by the scenario. A route twice as long takes
twice as long. River crossings and mountain passes add their delays on top.

**Fleets move zone to zone.** A fleet is always in exactly one sea zone — at sea, or in one of that
zone's ports. Sailing to a neighbouring zone takes 2 months; entering or leaving a port in its own
zone is instant. Which zones neighbour each other is listed in
[SCENARIO.md](../scenarios/mitteleuropa/SCENARIO.md#sea-zones).

**Mountain passes (yellow triangles).** Some routes cross the mountains through a pass. A pass is
a node on the map, like a settlement with no people in it, and the route runs settlement → pass →
settlement.

- **Armies can be sent to a pass** and stay there. The route is split at the pass, and each leg
  (settlement to pass, pass to settlement) takes time by its own length **plus 2 months** for the
  climb, so going through a pass costs 4 months on top of the distance. An army that stops at the
  pass has paid half, and pays the rest when it moves on.
- **An army defending a pass gets ×2** defence (§5).
- **Sharpshooters** are bought and stationed only at passes (§5).
- **Each pass belongs to one country** — whoever's territory it lies in, i.e. whoever owns the
  settlement whose land the pass is in (listed in [SCENARIO.md](../scenarios/mitteleuropa/SCENARIO.md#mountain-passes)).
  It changes hands with that settlement. Only the owner can buy sharpshooters there.
- **Sharpshooters die when the pass changes hands** — if the settlement whose land the pass is in is
  lost, every sharpshooter stationed at that pass dies.

**Zone of control — where armies meet.** An army is always either at a place (a settlement or a
pass) or marching along a route, at an even pace — its river and pass delays are spread over the
whole leg. Enemy armies meet in two ways:

- **At a place.** An army arriving where an enemy army stands stops there, cancelling the rest
  of its path. At an enemy settlement with an army inside it begins a siege (§6); anywhere else
  — a pass, or a settlement where the enemy is the besieger — the two fight a battle (§5). An army
  that reaches its own besieged settlement fights the besiegers as a relief force; the garrison
  stays inside, and may sortie (§6). If the relief force wins it goes inside too.
- **Head-on on a route.** Two enemy armies marching towards each other along the same route
  fight where they meet. No army stays on a route: the loser retreats (§5) and the winner carries
  on its march, from where they met, and can be given new orders. Armies marching the same way
  never meet — every army marches at the same speed.

If two armies reach a place at the same moment, an army falling back to its refuge gets in first.

**New orders** take effect at once. An army on a route turns back or carries on, whichever is the
faster way to its new destination. `stop` halts it at the next place it reaches — no army stays on
a route.

**Supply.** Armies live off the land. A settlement's land feeds **half its pop** in soldiers — a
10K town 5,000, a 20K city 10,000 — and **×1.5 if the settlement is on a river** (listed in the
scenario). A pass is fed by the land it lies in. An army outside **friendly land** (its own
country's, its subjects' or overlord's, its allies') that has more men than the land feeds —
soldiers and mercenaries alike, not cannon crews — loses **1% of its men every month**, lost
from your population like any casualty (§2). An army counts as in the land of the settlement or pass it is
at or besieging, and while marching, of the one it is marching to. Every army of the same country
in one land counts together, so splitting up means spreading out. A besieger over the limit loses
2% a month: 1% to supply, 1% to siege disease (§6). Peasant rebels (§11) are fed by their own
people and never suffer this.

**Orders:** `move` · `besiege` · `storm` · `sortie` (garrison only, §6).
**Fleet orders:** `move` · `blockade` · `patrol` (§7).

**Battle cooldown:** one resolution per pair of armies per 3 months. The loser retreats
immediately, as in §5 *After the battle*. Storms and sorties are battles too. Enemy armies that
meet at a place while on cooldown wait there, and fight when it ends; enemy armies that pass each
other on a route while on cooldown have passed.

**Straits (dashed lines).** An army may cross if you control **≥10 × x ships** in that sea zone (see
[Sea zones](../scenarios/mitteleuropa/SCENARIO.md#sea-zones)) and no enemy fleet contests it. Crossing takes
**3 months**. If an enemy fleet is present, fight a naval battle first — lose and the crossing fails.

**Counting the ships.** All the country's ships in the zone count — in port or at sea, not sailing. An
army sets out only if they are at least **10 × x**; if enemy fleets are at sea in the zone, the country's
fleets there fight them first, and a defeat — or too few ships left — means the army does not cross and
stays where it is. The crossing takes 3 months whatever the length of the dashed line, and armies on a
strait are at sea: they do not meet one another.

---

## 9. CONSCRIPTION LAWS

You cannot change again for **5 years**. Every country starts at **Feudal levy**.

| Law | Max army | Max navy | Total | Settlement money (§2) |
|---|---|---|---|---|
| Feudal levy | 5% | 2.5% | 7.5% | — |
| Standing army | 7.5% | 3% | 10.5% | −3% |
| Militarized | 10% | 4% | 14% | −6% |
| Mass levy | 15% | 5% | 20% | −15% |
| Scrape the barrel | 22% | 7% | 29% | −40% |

Men of fighting age were only about a fifth to a quarter of the people, so **Scrape the barrel**
takes nearly all of them. The money penalty is the cost of the law itself — the disruption of
raising and running the army. The tax lost from every soldier (§2) comes on top: at Mass levy with
a full army a country keeps about 0.7 money per person after upkeep; at Scrape the barrel it runs
into debt.

The percentages apply to **core manpower + half of non-core**. The two caps are separate — men
on one cannot be moved to the other.

- **Army cap:** soldiers, men in training (§8), cannon crew and sharpshooters. Mercenaries do
  not count, but you may hire at most as many as your army cap (§8).
- **Navy cap:** ship crew at sea (50 per ship). Ships in port need no crew, so you may own more
  ships than you can crew — only the crewed ones can sail.

The navy cap comes **on top of** the army cap, so a fleet never takes men from the army. At
Feudal levy, ships of pop ÷ 2000 with 50 crew each are 2.5% — coastal countries start exactly at
their navy cap. The starting army of pop ÷ 25 is 4%, below the 5% army cap (§2).

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
  cost: the alliance with the caller ends. A human player who has not answered within
  **6 months** joins.

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
only — through the Holy Roman Empire ([SCENARIO.md](../scenarios/mitteleuropa/SCENARIO.md#the-holy-roman-empire)).

**Breaking free.** A subject breaks free the moment its **military power** (§5) is greater than
your own — the overlord's forces only, not those of its other subjects. This is not breaking an
agreement. Raising unarmed men never frees a subject — it has to arm them, and an overlord with
better weapons stays ahead with fewer men.

### Peace
Either side may propose peace, with **any terms both sides agree to**: settlements, money, making
one side a vassal or protectorate of the other, releasing subjects. If you have conquered all of
your enemy's settlements, you dictate the terms. Settlements stay with whoever holds them when
peace is signed, unless the terms move them. Signing peace starts a **truce**.

### Warmongers
Every country has a **warmonger score**, starting at 0 and shown to everyone. It rises when you
go to war for gain:

| You | On the attacking side | On the defending side |
|---|---|---|
| Declare a war | +5 | — |
| End a war holding a settlement you took in it — captured, or given to you in the peace | +1 per 1,000 of its pop (a town ≈ +10, a city ≈ +20) | **half**: +1 per 2,000 (a town ≈ +5, a city ≈ +10) |
| Make a country your vassal in a peace | +10 | +5 |
| Make a country your protectorate in a peace | +5 | +2.5 |

**The defending side** is the country that was declared on and everyone who joined the war on its
side — defensive allies, guarantors and military allies it called in. The world sees it as the
victim, so it is forgiven half of what it takes from the aggressor. Everyone else is on the
attacking side: the country that declared and everyone who joined it.

Retaking a settlement that was **your core when the war began** adds nothing, on either side.
Subjects gained by demand or through the HRE add nothing either — they agreed. The score falls
by **2 every year**, down to 0.

*Example:* Bavaria declares war on Bohemia and keeps all three of its settlements (40K) at the
peace: +5 + 40 = **45**, gone in about 22 years.

A warmonger is punished in two ways: computer countries like it less (*Opinion* below), and its
neighbours are more willing to ally with each other against it (*Alliances* below).

### Elimination
A country that has **no settlement left** — its last one taken by storm or siege, or given up in a peace — is **out of the
game**, at the end of that day or that order (a peace taking several settlements is signed whole first):

- its armies, wherever they stand, and its fleets **vanish** with every man in them, and its training and hires with them;
- its **wars end**, with no truce, and every **agreement** with it lapses, as do questions put to it or by it;
- its **subjects are free**, and if it was a subject, it is nobody's now;
- it gives **no more orders**, and nobody may declare war on it, make peace with it or propose anything to it.

It is never back: there is nothing left to come back with. Its name stays in the history of the game. Peasant rebels hold no
land of their own and are not eliminated.

**A person whose country is eliminated has lost.** A single-player game ends there, as a defeat. With other people in the
game, the player is out: they may watch it to the end, but give no orders, and are placed after everyone whose country was
still in it (the later to fall first). When every player's country has fallen, the game ends as a defeat for all.

### Computer countries
A computer-run country answers a proposal the moment it is made. You may make each kind of
proposal to the same country **once every 5 years**. The HRE proposal is not limited by this —
it has its own once-ever rule ([SCENARIO.md](../scenarios/mitteleuropa/SCENARIO.md#the-holy-roman-empire)).

**Strength** compares **military power** (§5) — armed men, cannons and sharpshooters, not ships:
```
strength = your military power ÷ their military power
```
**No army.** If the country divided by has no military power, the ratio counts as at its cap wherever
it is used — here and in `need` below. If neither side has any, it counts as 1.

**Size** compares population — every settlement each side owns, core and non-core, not counting
subjects. Unlike armies, population cannot be raised in a hurry, so size is what subject
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
| It refused your demand to become your subject in the last 10 years (not the HRE vote) | −30 |
| Your warmonger score — in full if you share a border, half if you do not | −score, at most −60 |

**Peace** — strength and war progress. The computer accepts if `war score ≥ cost`:
```
war score = % of its pop you have taken in this war − % of your pop it has taken
            + 10 × (strength − 1), this part at most +30
cost      = settlements you ask for, as % of its pop
            + 10 for each year of its money (§2) you ask for
            + 50 to make it your vassal · 25 to make it your protectorate
```
Pops are counted as they were when the war began. A plain peace (cost 0) is accepted whenever your
war score is 0 or more.

**Alliances, guarantees and pacts** — opinion, plus how threatened it feels by its neighbours.
The computer accepts if `opinion + need ≥ the bar`:
```
need = 10 × (its strongest neighbour's military power ÷ its own − 1), between 0 and +40
     + its neighbours' highest warmonger score ÷ 2, up to +30       not counting you
```
The warmonger part never counts the country making the proposal — a warmonger frightens its
neighbours into each other's arms, not into its own.
| Proposal | Bar |
|---|---|
| You guarantee it | −20 |
| Non-aggression pact | 0 |
| It gives you military access | +10 |
| Defensive alliance | +20 |
| Military alliance | +40 |

A neighbour is any country whose settlements share a land route with its settlements.

**Coalitions.** At the start of each year, every computer country that borders a country with a
warmonger score of **30 or more** proposes a **defensive alliance** to every other computer
country that borders the same warmonger. Each proposal is answered as above — the warmonger part
of `need` counts for both, since neither is the warmonger. A coalition's alliance is **against that warmonger**: it lapses
at the start of a year when the warmonger's score has fallen below 30, or the moment the warmonger is out of the game. (An
alliance the two had already, or sign for themselves, is not a coalition's and does not lapse.)

**Becoming your subject** — mostly size, a little opinion. The HRE vote is rolled the same way
([SCENARIO.md](../scenarios/mitteleuropa/SCENARIO.md#the-holy-roman-empire)):
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

### How the engine reads these rules

Where §10 is silent, these are the readings the game uses.

**Wars are between two countries.** Each pair at war has its own record: which of the two is on the
attacking side, the people each had when the war began (or when it joined it), and the people each has taken.
A country that joins a war fights the **principal** on the other side — the one who declared, or the one
declared on — and nobody else; those it joins do not draw in their own allies. So a peace is between two
countries, and **their allies make their own peace**. A vassal's wars end with its overlord's.
- *Who joins:* the target's defensive allies, guarantors and vassals join it at once; the declarer's vassals join the
  declarer; each side's military allies are **called**. A computer ally always joins; a human has 6 months and joins
  if it does not answer; refusing ends the alliance. A defensive ally of the attacker is not called: it was not
  attacked. A protectorate is never obliged.
- *A country that would fight an ally* — called by both sides, or allied with both — joins one side only, and the
  alliance with the other ends. That is no break of faith.
- *Declaring war* on a country you have a pact, a truce or an alliance with, or guarantee, breaks it (see below). You
  cannot declare war on your overlord or your subject: a subject breaks free instead. Only the one who declares gets the
  +5 warmonger score.

**Peace terms.** The proposer may take settlements of the other, give settlements of its own, ask or pay money, make the
other its vassal or protectorate, become the other's, and free subjects of the other. A computer accepts if its war
score is at least the price. The price is what is asked, in the units of §10 — and **what the proposer gives counts the
same way against it**: a country losing a war can buy peace with a city. A settlement's people are those at the start of
the war. A peace may take a country's last settlement, and then it is out of the game (*Elimination*). A vassal does not sign peace: its
overlord does. A peace starts a **truce** of 5 years between the two, and sends every army left in land now closed to it
home. Offered to a human, terms wait 6 months for an answer and lapse after.

**The warmonger score at a peace** counts each settlement held that was taken in the war or given in the peace, unless it
is the holder's own core, at +1 per 1,000 people (half for the defending side of that pair); and +10 / +5 for a vassal made,
+5 / +2.5 for a protectorate. Each pair at war is scored on its own sides: a country that joined a war is scored for its war with the principal it fought.

**Proposals.** The same proposal to the same country once in 5 years — peace, each kind of agreement, and each kind of
demand — whether it was accepted or not. An agreement cannot be proposed while at war, nor to a vassal. A guarantee is
given by the proposer; access is given by the one asked. A pact lasts 10 years, a truce 5; neither can be re-signed
while it stands.

**Breaking an agreement** ends the agreement, **all the breaker's alliances**, and costs its name for 10 years (−40 in
every computer country's opinion). Cancelling military access you give is not a break. Declaring war through a pact,
truce or alliance is. When an agreement ends or a peace is signed, armies in land now closed go home.

**Subjects.** A subject has one overlord, and overlords never form a ring. A vassal gives up its agreements and joins its
overlord's wars; a war between the two ends. It cannot declare war, propose peace or make agreements: its overlord speaks
for it. The tribute is a share of the subject's money *before* its own tribute — received or paid — is counted, when that
is positive; it counts in the overlord's money per year and so in its research. A subject breaks free the moment its
military power is greater than its overlord's own: raising men without weapons never frees one, and the overlord's other
subjects do not count for it. Each day this is checked.

**Friends.** A country's friends are itself, its allies of either kind, its subjects and its overlord. Their land feeds
its armies, is open to them, and a friend's army inside a besieged settlement defends it — once it is at war with the
besieger — with the owner's. A friend's army falls back, not disbands, when the garrison surrenders. Land opened by military
access is open but does not feed an army, and its holder may not capture anything there.

**Opinion** counts a country's friends as its allies, subjects and overlord. "A war fought against it in the last 20
years" includes one going on. "Years since you were last at war" run from the start of the game if there has been none.

**The Empire.** One proposal ever per country, with at least the scenario's number of settlements inside it. Every other
country that holds an Empire settlement and is not already someone's subject rolls once, in the order of their codes; a
human is asked. The refusers form the League: a defensive alliance between each pair. A scenario with no such number has no
proposal. (The historical scenario's Emperor, Imperial Authority, elections, ban and reforms are not built.)

**Winning** is checked every day: a country with the scenario's number of settlements — its own and its vassals' count 1, its
protectorates' ½ — wins at once; otherwise at the start of the end year the most settlements win, then the most people (its
own and its subjects'), then the lower code. When the game is won it stops: nothing more happens and nothing is accepted. A
computer country may win, and then every human has lost.

**Starting wars and agreements** of a scenario count as if declared and signed in play: the wars are on from the first day,
the agreements are in force, a pact has the years it has left, and every warmonger score is 0.

## 11. RANDOM EVENTS

Rolled at the start of each year.

| Event | Chance | Effect |
|---|---|---|
| Good harvest | 10% | +10% money that year |
| Plague | 5% | −10% pop |
| Peasant uprising | (average tax − 2)² × 25% — **0%** at tax 2, **25%** at tax 3 (§2) | See below |

**Peasant uprising.** Overtaxed peasants rise against you. A rebel country forms with soldiers
equal to **3% of your total population** (every settlement you own, core and non-core), armed
with swords, spawning outside your capital. It holds cores on everything and attacks towns and
cities, favouring undefended ones and your core territory. **There is no peace with peasants.**

**The rebels' behaviour.** The rebels are a country of their own, `REB1`, `REB2`…, with no money. Every
10 days each idle rebel army marches on a settlement of the country it rose against: **undefended ones
first, then core ones, then the nearest**; an army besieging one stays until it falls or the siege is lifted.
Rebels take no orders and make no peace. They are fed by their own people, but still sicken in a siege. If
the country has lost its capital, they rise outside its largest settlement. The uprising is over when the
rebels have no army and hold no settlement.

**The rebels are your own people.** They are taken from your civilians (§2), spread over your
settlements in proportion to their pop, and pay no tax while they are under arms — but they stay
in your population and still count toward growth. Rebels killed are lost from your population
like any casualty (§2). A beaten rebel army with no settlement of its own to fall back to does not
die to the last man (§5): after the battle's losses, its **survivors scatter home** and become
your civilians again. The uprising is crushed when it has no army left; any settlement it still
holds is then undefended and yours to walk back into (§6).

