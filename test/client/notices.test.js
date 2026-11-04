// The notices over the game's map (public/js/notices.js): the kind each event is of, the choice by the screen's defaults and
// as stored, and at most a few at once — the same one counted up, not stacked.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./loader.mjs", import.meta.url);
const { NOTICE_KINDS, kindOf, noticePrefs, pushNotice, loadNotices, saveNotices, resetNotices, STORAGE_KEY } = await import("../../public/js/notices.js");

test("each event is a kind of notice — war (peasants rising too), questions, research, diplomacy, armies, the country — or none", () => {
    const state = { settlements: { 5: { owner: "BAV" } } };
    const kind = (e, who) => kindOf(e, "BAV", who, state);
    assert.equal(kind({ type: "siegeStart", settlement: 5 }, ["AUS"]), "war");
    assert.equal(kind({ type: "capture", from: "BAV", to: "AUS" }, ["BAV", "AUS"]), "war");
    assert.equal(kind({ type: "capture", from: "AUS", to: "BAV" }, ["AUS", "BAV"]), null, "a capture of ours is no alarm");
    assert.equal(kind({ type: "uprising" }, ["BAV"]), "war");
    assert.equal(kind({ type: "offer" }, ["BAV", "AUS"]), "questions");
    assert.equal(kind({ type: "tech" }, ["BAV"]), "research");
    assert.equal(kind({ type: "agreement" }, ["BAV", "AUS"]), "diplomacy");
    assert.equal(kind({ type: "ready" }, ["BAV"]), "armies");
    assert.equal(kind({ type: "plague" }, ["BAV"]), "country");
    assert.equal(kind({ type: "agreement" }, ["SAX", "AUS"]), null, "not ours");
    assert.equal(kindOf({ type: "tech" }, null, ["BAV"], state), null, "a watcher gets no notices of a country");
});

test("unless chosen, a phone shows fewer kinds; a choice made is kept, the rest by the defaults", () => {
    assert.deepEqual(NOTICE_KINDS.map((k) => k.key), ["war", "questions", "refused", "research", "diplomacy", "armies", "country"]);
    const computer = noticePrefs(null, false), phone = noticePrefs(null, true);
    assert.ok(Object.values(computer).every(Boolean));
    assert.deepEqual(Object.keys(phone).filter((k) => phone[k]), ["war", "questions", "refused", "research"]);
    assert.deepEqual(noticePrefs({ war: false, diplomacy: true, bogus: 1 }, true), { ...phone, war: false, diplomacy: true });
    // kept in the browser, under one key; a stored mess counts as nothing stored
    const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    saveNotices({ ...phone, armies: true }, storage);
    assert.equal(loadNotices(storage, true).armies, true);
    resetNotices(storage);
    assert.equal(store.has(STORAGE_KEY), false);
    store.set(STORAGE_KEY, "{not json");
    assert.deepEqual(loadNotices(storage, true), phone);
});

test("at most a few notices at once, newest last; the same one again counts up and stays longer instead of stacking", () => {
    let list = [];
    for (let i = 0; i < 3; i++) list = pushNotice(list, "1,000 soldiers ready at Munich", "armies", 1000 + i, { max: 2, ms: 3000 });
    assert.deepEqual(list, [{ text: "1,000 soldiers ready at Munich", kind: "armies", count: 3, until: 4002 }]);
    list = pushNotice(list, "plague in Bavaria", "country", 2000, { max: 2, ms: 3000 });
    list = pushNotice(list, "Saxony accepts", "diplomacy", 2100, { max: 2, ms: 3000 });
    assert.deepEqual(list.map((n) => n.text), ["plague in Bavaria", "Saxony accepts"], "past the cap the oldest go");
    assert.deepEqual(pushNotice(list, "later", "war", 9000, { max: 2, ms: 3000 }).map((n) => n.text), ["later"], "the ones out of time are gone");
});

test("a click on a destination with an army: ask, march at once, or march and storm at once — storming only an enemy town", async () => {
    const { MARCH_KEY, loadMarch, saveMarch, marchFor } = await import("../../public/js/notices.js");
    const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    assert.equal(loadMarch(storage), "ask", "unless chosen, it asks");
    saveMarch("storm", storage);
    assert.deepEqual([store.get(MARCH_KEY), loadMarch(storage)], ["storm", "storm"]);
    store.set(MARCH_KEY, "nonsense");
    assert.equal(loadMarch(storage), "ask");
    assert.equal(marchFor("ask", true), "ask");
    assert.deepEqual([marchFor("march", true), marchFor("storm", true), marchFor("storm", false)], [{ storm: false }, { storm: true }, { storm: false }]);
});
