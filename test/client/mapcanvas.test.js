// Pictures and timelapses (public/js/mapcanvas.js): the days a timelapse shows, and what each frame keeps of a state — enough
// for the map's colours, stripes and codes and the leaders, and little else. The drawing itself needs a browser's canvas.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };

register("./loader.mjs", import.meta.url);
const { Game, scores } = await import("../../src/engine/index.js");
const { framePlan, frameOf } = await import("../../public/js/mapcanvas.js");
const { countryLabels, landFill } = await import("../../public/js/mapdraw.js");

test("a timelapse shows a frame every so many days, the last day always among them", () => {
    assert.deepEqual(framePlan(0, 100, 1, 30), [0, 12, 24, 36, 48, 60, 72, 84, 96, 100]);         // a year a second: 12 days a frame
    const days = framePlan(0, 210 * 365, 5, 30);
    assert.equal(days.length, Math.ceil(210 * 365 / 61) + 1);                                      // 5 years a second: 61 days a frame
    assert.equal(days.at(-1), 210 * 365);
    assert.deepEqual(framePlan(50, 50, 5), [50]);
});

test("a frame keeps who holds what, who is whose subject and the leaders — and the map draws from it as from the state", () => {
    const game = Game.create(scenario, { seed: 1 });
    Object.assign(game.state.countries.BOH, { overlord: "AUS", subjectKind: "vassal" });
    const frame = frameOf(game.state, scores(game.state));
    assert.equal(frame.day, 0);
    assert.equal(Object.keys(frame.settlements).length, scenario.settlements.length);
    assert.deepEqual(frame.countries.BOH, { code: "BOH", name: "Bohemia", overlord: "AUS", subjectKind: "vassal", rebel: false, out: null });
    assert.equal(frame.top.length, 5);
    assert.ok(frame.top.every((t, i) => i === 0 || frame.top[i - 1].settlements >= t.settlements));
    assert.deepEqual(countryLabels(frame, scenario), countryLabels(game.state, scenario));
    const colourOf = (c) => c;
    assert.deepEqual(landFill(frame, colourOf)("BOH"), landFill(game.state, colourOf)("BOH"));
    assert.ok(JSON.stringify(frame).length < 20000, "small: a whole game's frames stay in memory");
});

test("a video is MP4 wherever the browser records it, WebM only where it records nothing else (Firefox)", async () => {
    const { videoType } = await import("../../public/js/mapcanvas.js");
    assert.equal(videoType((t) => true), "video/mp4;codecs=avc1");                                   // Chrome 126+
    assert.equal(videoType((t) => t === "video/mp4"), "video/mp4");                                  // Safari
    assert.equal(videoType((t) => t.startsWith("video/webm")), "video/webm;codecs=vp9");             // Firefox
    assert.equal(videoType(() => false), null);
});
