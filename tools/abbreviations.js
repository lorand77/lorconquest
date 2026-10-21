// Short forms of settlement names for the map at a distance: 3 or 4 letters, mixed case, taken from the name in order and
// unique within the scenario — "Vie" for Vienna, "Kön" for Königsberg, "FrO" for Frankfurt (Oder). Generated, never written
// by hand (tools/map.js draws them inside the settlement markers). The most important places choose first, so a city gets
// the plain first three letters before a town that starts the same way.
//
// For each name the candidates are tried in order, and the first one no place has taken yet is its own:
//   the first three letters of its first word; with more words, its first two letters and the next word's initial, or its
//   initial and the next word's first two; then its first two letters and a later letter (consonants first); its initial and
//   two later letters; and the same again with four letters.

const VOWELS = new Set([..."aeiouyäöüåæøéèêáàíóúůý"]);
const letters = (w) => [...w].filter((ch) => /\p{L}/u.test(ch));

// the words of a name: "Frankfurt (Oder)" -> Frankfurt, Oder; "Hradec Králové" -> Hradec, Králové
export function wordsOf(name) {
    return name.split(/[\s\-()/.,']+/).map((w) => letters(w).join("")).filter(Boolean);
}

// every short form of a name worth trying, best first (letters keep the case they have in the name; the first is a capital)
export function candidates(name) {
    const words = wordsOf(name);
    if (!words.length) return [];
    const w = letters(words[0]), out = [];
    const add = (chars) => {
        if (chars.length < 3 || chars.length > 4) return;
        const s = chars[0].toUpperCase() + chars.slice(1).join("");
        if (!out.includes(s)) out.push(s);
    };
    const rest = w.slice(1).map((ch, i) => ({ ch, i: i + 1 }));
    const byConsonant = [...rest].sort((a, b) => VOWELS.has(a.ch.toLowerCase()) - VOWELS.has(b.ch.toLowerCase()) || a.i - b.i);
    for (const len of [3, 4]) {
        add(w.slice(0, len));
        if (words.length > 1) {
            const v = letters(words[1]);
            add([...w.slice(0, len - 1), v[0]]);
            add([w[0], ...v.slice(0, len - 1)]);
            if (len === 4) add([...w.slice(0, 2), ...v.slice(0, 2)]);
        }
        // the first two letters (or one) and later ones, in the name's order, consonants preferred
        for (const head of [2, 1]) {
            const pool = byConsonant.filter((x) => x.i >= head);
            const need = len - head;
            const pick = (from, chosen) => {
                if (chosen.length === need) { add([...w.slice(0, head), ...[...chosen].sort((a, b) => a.i - b.i).map((x) => x.ch)]); return; }
                for (let k = from; k < pool.length; k++) pick(k + 1, [...chosen, pool[k]]);
            };
            pick(0, []);
        }
    }
    return out;
}

// places: [{ id, name }] in the order they choose (most important first) -> Map id -> short form; throws if one finds none
export function abbreviate(places) {
    const taken = new Set(), out = new Map();
    for (const p of places) {
        const pick = candidates(p.name).find((c) => !taken.has(c.toLowerCase()));
        if (!pick) throw new Error(`no free short form for ${p.name} (settlement ${p.id})`);
        taken.add(pick.toLowerCase());
        out.set(p.id, pick);
    }
    return out;
}
