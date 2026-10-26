// The map on screen (design.md, "The map on screen"): map.svg shown as it is, with lands recoloured by owner,
// borders redrawn where owners change, and an overlay of armies, siege rings and a planned route. Drag to pan,
// wheel or the +/- buttons to zoom, never out past the map's edges (mirror.js, fitView); a click (no drag) is reported as what it hit: an army, a place (a settlement
// or pass marker), a land, or the sea; a right-click as onCancel (to deselect). Two fingers pinch to zoom. Pointer events, so mouse and touch take one path. Zoomed out, a settlement shows only the
// short form in its marker; zoomed in to twice the whole map or more, its name too (the svg gets the class "zoomed").
import { fitView, pinchView } from "./mirror.js";

const NS = "http://www.w3.org/2000/svg";
// names show from this zoom on: the whole map's width over the width in view
const NAMES_FROM = 2;
const el = (name, attrs = {}) => {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
};

export async function createMapView(container, svgUrl, onPick, onCancel = () => {}) {
    container.innerHTML = await (await fetch(svgUrl)).text();
    const svg = container.querySelector("svg");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    const [, , W, H] = svg.getAttribute("viewBox").split(" ").map(Number);
    // the view is shaped like the box the map is shown in, so the box shows exactly the view, and kept on the map
    const aspect = () => { const r = svg.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r.width / r.height : W / H; };
    let view = { x: 0, y: 0, w: W };
    const setView = () => {
        view = fitView(view, W, H, aspect());
        svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
        svg.classList.toggle("zoomed", W / view.w >= NAMES_FROM);
    };

    const layer = (id) => { const g = el("g", { id }); svg.appendChild(g); return g; };
    const labelLayer = layer("lc-labels");               // countries' codes where their land is now (mapdraw.js); the map's own are hidden
    svg.querySelector("#labels")?.setAttribute("display", "none");
    const siegeLayer = layer("lc-sieges"), routeLayer = layer("lc-route"), postLayer = layer("lc-posts"), fleetLayer = layer("lc-fleets"), armyLayer = layer("lc-armies");
    const markers = new Map(), ships = new Map();                    // army id -> <g>, fleet id -> <g>

    // a subject's stripes: one pattern for each pair of colours and kind, made the first time it is needed. In map units, so
    // they zoom with the land: broad for a vassal, thin for a protectorate, at 45°
    const defs = svg.querySelector("defs") ?? svg.insertBefore(el("defs"), svg.firstChild);
    const patterns = new Set();
    function paint(fill) {
        if (typeof fill === "string") return fill;
        const id = `lc-stripe-${fill.kind}-${fill.colour}-${fill.stripe}`.replace(/[^\w-]/g, "");
        if (!patterns.has(id)) {
            patterns.add(id);
            const period = 10, width = fill.kind === "vassal" ? 4.5 : 1.6;
            const p = el("pattern", { id, patternUnits: "userSpaceOnUse", width: period, height: period, patternTransform: "rotate(45)" });
            p.append(el("rect", { width: period, height: period, fill: fill.colour }), el("rect", { width, height: period, fill: fill.stripe }));
            defs.append(p);
        }
        return `url(#${id})`;
    }

    // ---------- pan and zoom ----------
    const toMap = (clientX, clientY) => {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
    };
    // zoom about a point; at the limit the step is what is left of it, so the map does not lurch sideways
    function zoomAt(factor, cx, cy) {
        const w = fitView({ ...view, w: view.w * factor }, W, H, aspect()).w, k = w / view.w;
        view = { x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k, w };
        setView();
    }
    window.addEventListener("resize", setView);
    setView();
    requestAnimationFrame(setView);                         // again once the page is laid out and the box has its size
    svg.addEventListener("wheel", (e) => {
        e.preventDefault();
        const p = toMap(e.clientX, e.clientY);
        zoomAt(e.deltaY > 0 ? 1.2 : 1 / 1.2, p.x, p.y);
    }, { passive: false });

    // one finger (or the mouse) drags the map, or taps; two pinch it. A finger moves more than a mouse in a tap: it may stray
    // 10 pixels before the tap is a drag, the mouse 5. Once two fingers have touched, nothing is picked until all are lifted.
    let drag = null, pinch = null, lastType = "mouse";
    const fingers = new Map();                              // pointer id -> where it is now
    const mid = () => { const [a, b] = [...fingers.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
    svg.addEventListener("pointerdown", (e) => {
        if (e.button === 2) return;                         // the right button picks nothing: it cancels (contextmenu)
        lastType = e.pointerType;
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.size === 2) {
            const m = mid();
            pinch = { from: m.d, anchor: toMap(m.x, m.y), view: { ...view } };
            drag = null;
            svg.classList.remove("dragging");
            return;
        }
        if (fingers.size > 2 || pinch) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: toMap(e.clientX, e.clientY), view: { ...view }, moved: false, target: e.target, slop: e.pointerType === "touch" ? 10 : 5 };
    });
    svg.addEventListener("pointermove", (e) => {
        if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && fingers.size >= 2) {
            const m = mid(), r = svg.getBoundingClientRect();
            view = pinchView(pinch.view, { from: pinch.from, to: m.d, anchor: pinch.anchor, at: { x: m.x - r.left, y: m.y - r.top }, width: r.width }, W, H, aspect());
            setView();
            return;
        }
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < drag.slop) return;
        if (!drag.moved) { drag.moved = true; svg.setPointerCapture(e.pointerId); svg.classList.add("dragging"); }
        const scale = drag.view.w / svg.getBoundingClientRect().width;
        view = { x: drag.view.x - (e.clientX - drag.x) * scale, y: drag.view.y - (e.clientY - drag.y) * scale, w: drag.view.w };
        setView();
    });
    const lift = (e) => {
        fingers.delete(e.pointerId);
        if (pinch && fingers.size === 0) pinch = null;      // the pinch is over when every finger is up
    };
    svg.addEventListener("pointerup", (e) => {
        lift(e);
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        drag = null;
        svg.classList.remove("dragging");
        if (!d.moved) onPick(pick(d.target));
    });
    svg.addEventListener("pointercancel", (e) => { lift(e); drag = null; svg.classList.remove("dragging"); });
    // a finger lifted off the map counts too, or a pinch could wait for it for ever
    for (const ev of ["pointerup", "pointercancel"]) window.addEventListener(ev, lift);
    // a right-click anywhere on the map: no browser menu, the selection is dropped. A long press on a touch screen opens no menu
    // either, but drops nothing: a finger held still before a slow drag would lose the selection (and the drag) otherwise.
    svg.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (lastType === "touch" || lastType === "pen") return;
        drag = null;
        svg.classList.remove("dragging");
        onCancel();
    });

    // what a click hit
    function pick(target) {
        const army = target.closest("[data-army]");
        if (army) return { kind: "army", id: Number(army.dataset.army) };
        const fleet = target.closest("[data-fleet]");
        if (fleet) return { kind: "fleet", id: Number(fleet.dataset.fleet) };
        const place = target.closest("[id^='settlement-'], [id^='pass-']");
        if (place) return { kind: "place", key: place.id.replace(/^(settlement|pass)-/, "") };
        const land = target.closest("[id^='land-']");
        if (land) return { kind: "land", key: land.id.replace(/^land-/, "") };
        return { kind: "sea" };
    }

    return {
        zoom: (factor) => zoomAt(factor, view.x + view.w / 2, view.y + view.h / 2),

        // bring a point of the map to the middle of the view, at the same zoom (as near as the map's edges allow)
        centerOn(x, y) {
            view = { x: x - view.w / 2, y: y - view.h / 2, w: view.w };
            setView();
        },

        // dim every land not in `keep` (a Set of land keys), to show a part of the map — the Empire; null shows it all again
        markLands(keep) {
            for (const land of svg.querySelectorAll("#lands [id^='land-']")) land.classList.toggle("lc-dim", Boolean(keep) && !keep.has(land.id.slice(5)));
        },

        // every land in its owner's fill (mapdraw.js, landFill): a colour, or a subject's colour striped with its overlord's;
        // borders wherever two neighbouring lands have different owners
        colourLands(ownerOf, fillOf) {
            for (const land of svg.querySelectorAll("#lands [id^='land-']")) land.style.fill = paint(fillOf(ownerOf(land.id.slice(5))));
            for (const edge of svg.querySelectorAll("#edges [id^='edge-']")) {
                const [a, b] = edge.id.slice(5).split("-");
                const border = ownerOf(a) !== ownerOf(b);
                edge.classList.toggle("border", border);
                edge.classList.toggle("province", !border);
            }
        },

        // armies: [{ id, x, y, colour, label, mine, selected, retreating }]; markers are kept by id and moved
        setArmies(armies) {
            const keep = new Set();
            for (const a of armies) {
                keep.add(a.id);
                let g = markers.get(a.id);
                if (!g) {
                    g = el("g", { class: "lc-army", "data-army": a.id });
                    g.append(el("rect", { y: -7, height: 14, rx: 3 }), el("text", { y: 3.6 }));
                    armyLayer.appendChild(g);
                    markers.set(a.id, g);
                }
                const w = 8 + 6 * a.label.length;
                const [rect, text] = g.children;
                rect.setAttribute("width", w);
                rect.setAttribute("fill", a.colour);
                text.setAttribute("x", w / 2);
                text.textContent = a.label;
                g.classList.toggle("mine", a.mine);
                g.classList.toggle("selected", a.selected);
                g.classList.toggle("retreating", a.retreating);
                g.setAttribute("transform", `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)})`);
            }
            for (const [id, g] of markers) if (!keep.has(id)) { g.remove(); markers.delete(id); }
        },

        // fleets: [{ id, x, y, colour, label, mine, selected, sailing }], drawn like armies, as ship chips
        setFleets(fleets) {
            const keep = new Set();
            for (const f of fleets) {
                keep.add(f.id);
                let g = ships.get(f.id);
                if (!g) {
                    g = el("g", { class: "lc-fleet", "data-fleet": f.id });
                    g.append(el("rect", { y: -7, height: 14, rx: 7 }), el("text", { y: 3.6 }));
                    fleetLayer.appendChild(g);
                    ships.set(f.id, g);
                }
                const w = 20 + 6 * f.label.length;
                const [rect, text] = g.children;
                rect.setAttribute("width", w);
                rect.setAttribute("fill", f.colour);
                text.setAttribute("x", w / 2);
                text.textContent = `⛵${f.label}`;
                g.classList.toggle("mine", f.mine);
                g.classList.toggle("selected", f.selected);
                g.classList.toggle("sailing", f.sailing);
                g.setAttribute("transform", `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)})`);
            }
            for (const [id, g] of ships) if (!keep.has(id)) { g.remove(); ships.delete(id); }
        },

        moveFleet(id, x, y) {
            const g = ships.get(id);
            if (g) g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        },

        // sharpshooter posts: [{ x, y, n, colour }] beside their pass
        setPosts(posts) {
            postLayer.replaceChildren(...posts.flatMap((p) => {
                const t = el("text", { class: "lc-post", x: p.x + 13, y: p.y + 5 });
                t.textContent = `◎${p.n}`;
                t.style.fill = p.colour;
                return [t];
            }));
        },

        // move one marker without redrawing it (between ticks)
        moveArmy(id, x, y) {
            const g = markers.get(id);
            if (g) g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        },

        // siege rings: [{ x, y, frac }], frac the share of the siege gone by
        setSieges(sieges) {
            siegeLayer.replaceChildren(...sieges.flatMap((s) => {
                const r = 15, c = 2 * Math.PI * r;
                return [
                    el("circle", { class: "lc-siege-track", cx: s.x, cy: s.y, r }),
                    el("circle", { class: "lc-siege", cx: s.x, cy: s.y, r, "stroke-dasharray": `${(c * s.frac).toFixed(1)} ${c.toFixed(1)}`, transform: `rotate(-90 ${s.x} ${s.y})` }),
                ];
            }));
        },

        // the countries' codes: [{ code, x, y, size }]
        setLabels(labels) {
            labelLayer.replaceChildren(...labels.map((l) => {
                const t = el("text", { class: `label${l.size < 15 ? " small" : ""}`, x: l.x, y: l.y });
                t.textContent = l.text ?? l.code;
                return t;
            }));
        },

        // a planned route as a dashed line, or none
        setRoute(points) {
            routeLayer.replaceChildren(...(points ? [el("polyline", { class: "lc-route", points: points.map((p) => p.join(",")).join(" ") })] : []));
        },
    };
}
