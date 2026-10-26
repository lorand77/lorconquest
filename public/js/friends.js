// Friends in the browser (design.md, "Friends"), as in LorCiv: the client of /api/friends (src/friends/routes.js) and the
// control set beside a player — + Add friend, Requested (Withdraw), Accept or Decline, ✓ Friends (Remove). A page loads the
// lists once (load), then asks for a control per player (control); an action fetches the lists again and calls the page back
// to draw anew. relation() is the pure part, tested in Node.

let lists = { friends: [], incoming: [], outgoing: [] };

async function api(method, path, body) {
    const res = await fetch(`/api/friends${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? "Something went wrong.");
    return out;
}

export async function load() { lists = await api("GET", ""); return lists; }
export const friendsOf = async (name) => (await api("GET", `/user/${encodeURIComponent(name)}`)).friends;
export const request = (username) => api("POST", "/requests", { username });
export const accept = (id) => api("POST", `/requests/${id}/accept`);
export const decline = (id) => api("POST", `/requests/${id}/decline`);
export const remove = (id) => api("DELETE", `/${id}`);
export const current = () => lists;

// what `name` is to the person signed in, by the lists: { kind: "friend" | "incoming" | "outgoing" | "none", row }
export function relation(state, name) {
    const lower = name.toLowerCase(), find = (list) => list.find((f) => f.username.toLowerCase() === lower);
    for (const kind of ["friends", "incoming", "outgoing"]) {
        const row = find(state[kind]);
        if (row) return { kind: kind === "friends" ? "friend" : kind, row };
    }
    return { kind: "none", row: null };
}

// the control for `name`: nothing for yourself; `compact` leaves Remove out (a table with a control on every row)
export function control(make, name, me, onChange, { compact = false } = {}) {
    const wrap = make("span", { class: "friend-ctl" });
    if (!name || name.toLowerCase() === me.toLowerCase()) return wrap;
    const act = (fn) => async () => {
        for (const b of wrap.querySelectorAll?.("button") ?? []) b.disabled = true;
        try { await fn(); } catch (e) { wrap.title = e.message; }
        await load().catch(() => {});
        onChange?.();
    };
    const button = (label, cls, fn) => make("button", { class: cls, onclick: act(fn) }, label);
    const { kind, row } = relation(lists, name);
    if (kind === "friend") wrap.append(make("span", { class: "tag friend" }, "✓ Friends"), ...(compact ? [] : [button("Remove", "", () => remove(row.id))]));
    else if (kind === "incoming") wrap.append(button("Accept friend", "primary", () => accept(row.id)), button("Decline", "", () => decline(row.id)));
    else if (kind === "outgoing") wrap.append(make("span", { class: "tag" }, "Requested"), button("Withdraw", "", () => remove(row.id)));
    else wrap.append(button("+ Add friend", "", () => request(name)));
    return wrap;
}
