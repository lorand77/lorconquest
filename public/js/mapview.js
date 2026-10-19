// The map on screen (design.md, "The map on screen"): map.svg shown as it is, with lands recoloured by owner,
// borders redrawn where owners change, and an overlay of armies, siege rings and a planned route. Drag to pan,
// wheel or the +/- buttons to zoom; a click (no drag) is reported as what it hit: an army, a place (a settlement
// or pass marker), a land, or the sea. Pointer events, so mouse and touch take one path.
const NS = "http://www.w3.org/2000/svg";
const el = (name, attrs = {}) => {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
};

export async function createMapView(container, svgUrl, onPick) {
    container.innerHTML = await (await fetch(svgUrl)).text();
    const svg = container.querySelector("svg");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    const [, , W, H] = svg.getAttribute("viewBox").split(" ").map(Number);
    let view = { x: 0, y: 0, w: W, h: H };
    const setView = () => svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);

    const layer = (id) => { const g = el("g", { id }); svg.appendChild(g); return g; };
    const siegeLayer = layer("lc-sieges"), routeLayer = layer("lc-route"), armyLayer = layer("lc-armies");
    const markers = new Map();                                       // army id -> <g>

    // ---------- pan and zoom ----------
    const toMap = (clientX, clientY) => {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
    };
    function zoomAt(factor, cx, cy) {
        const w = Math.min(W * 1.2, Math.max(W / 12, view.w * factor));
        const k = w / view.w;
        view = { x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k, w, h: view.h * k };
        setView();
    }
    svg.addEventListener("wheel", (e) => {
        e.preventDefault();
        const p = toMap(e.clientX, e.clientY);
        zoomAt(e.deltaY > 0 ? 1.2 : 1 / 1.2, p.x, p.y);
    }, { passive: false });

    let drag = null;
    svg.addEventListener("pointerdown", (e) => {
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: toMap(e.clientX, e.clientY), view: { ...view }, moved: false, target: e.target };
    });
    svg.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
        if (!drag.moved) { drag.moved = true; svg.setPointerCapture(e.pointerId); svg.classList.add("dragging"); }
        const scale = drag.view.w / svg.getBoundingClientRect().width;
        view = { ...drag.view, x: drag.view.x - (e.clientX - drag.x) * scale, y: drag.view.y - (e.clientY - drag.y) * scale };
        setView();
    });
    svg.addEventListener("pointerup", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        drag = null;
        svg.classList.remove("dragging");
        if (!d.moved) onPick(pick(d.target));
    });
    svg.addEventListener("pointercancel", () => { drag = null; svg.classList.remove("dragging"); });

    // what a click hit
    function pick(target) {
        const army = target.closest("[data-army]");
        if (army) return { kind: "army", id: Number(army.dataset.army) };
        const place = target.closest("[id^='settlement-'], [id^='pass-']");
        if (place) return { kind: "place", key: place.id.replace(/^(settlement|pass)-/, "") };
        const land = target.closest("[id^='land-']");
        if (land) return { kind: "land", key: land.id.replace(/^land-/, "") };
        return { kind: "sea" };
    }

    return {
        zoom: (factor) => zoomAt(factor, view.x + view.w / 2, view.y + view.h / 2),

        // every land in its owner's colour; borders wherever two neighbouring lands have different owners
        colourLands(ownerOf, colourOf) {
            for (const land of svg.querySelectorAll("#lands [id^='land-']")) land.style.fill = colourOf(ownerOf(land.id.slice(5)));
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

        // a planned route as a dashed line, or none
        setRoute(points) {
            routeLayer.replaceChildren(...(points ? [el("polyline", { class: "lc-route", points: points.map((p) => p.join(",")).join(" ") })] : []));
        },
    };
}
