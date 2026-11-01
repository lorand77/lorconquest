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

// a WebM as a browser records it: the EBML header, a Segment of unknown size, an Info with no Duration, a Cluster
const webm = ({ seekHead = false, segmentSize = null } = {}) => {
    const info = [0x15, 0x49, 0xa9, 0x66, 0x87, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40];          // TimecodeScale 1,000,000 ns
    const cluster = [0x1f, 0x43, 0xb6, 0x75, 0x82, 0xe7, 0x80];
    const seek = seekHead ? [0x11, 0x4d, 0x9b, 0x74, 0x80] : [];
    const body = [...seek, ...info, ...cluster];
    const size = segmentSize === null ? [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff] : [0x40 | (body.length >> 8), body.length & 0xff];
    return new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01, 0x18, 0x53, 0x80, 0x67, ...size, ...body]);
};
const durationIn = (b) => {
    for (let i = 0; i + 11 <= b.length; i++) if (b[i] === 0x44 && b[i + 1] === 0x89 && b[i + 2] === 0x88) return new DataView(b.buffer, b.byteOffset + i + 3, 8).getFloat64(0);
    return null;
};

test("a WebM is given the duration browsers leave out: added to its Info, or written over one that is there", async () => {
    const { withDuration } = await import("../../public/js/mapcanvas.js");
    const plain = webm(), timed = withDuration(plain, 42000);
    assert.equal(durationIn(plain), null);
    assert.equal(durationIn(timed), 42000);                                                       // milliseconds, at a scale of 1 ms
    assert.deepEqual([...timed.subarray(timed.length - 7)], [0x1f, 0x43, 0xb6, 0x75, 0x82, 0xe7, 0x80], "the clusters follow untouched");
    const again = withDuration(timed, 9000);
    assert.equal(again.length, timed.length, "one already there is written over in place");
    assert.equal(durationIn(again), 9000);
    // a Segment of known size grows by the bytes added; a SeekHead before the Info leaves the file as it was
    const known = webm({ segmentSize: true }), grown = withDuration(known, 1000);
    const sizeOf = (b) => ((b[13] & 0x3f) << 8) | b[14];
    assert.equal(sizeOf(grown) - sizeOf(known), grown.length - known.length);
    const sought = webm({ seekHead: true });
    assert.equal(withDuration(sought, 1000), sought);
    assert.equal(withDuration(new Uint8Array([1, 2, 3]), 1000).length, 3, "not a WebM: left alone");
});
