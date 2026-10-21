// A short fingerprint of a game's final state (FNV-1a over the snapshot's text, 32 bits, in hex). The server stores it
// when a game ends; a replay, in the browser or on the server, works out its own at the same day and compares, so a
// replay that comes out differently — a changed rule, a different engine — says so. It is a check against accident, not a
// signature.
export function fingerprint(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16).padStart(8, "0");
}
