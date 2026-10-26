// Answering questions put to a country, and looking after one whose player has gone (docs/design.md, "Players"; plan.md,
// milestone 5). The caretaker defends with the armies the country has, within its own and friendly land, sorties when the
// odds favour it, and joins the wars its allies call it into (refusing would end the alliance, which cannot be undone).
// It buys nothing, changes no setting, declares and proposes nothing, and lets every other question expire. The full AI
// (index.js) takes over after a while, and answers the rest by the same formulas the other computer countries use.
import { agreementAnswer, peaceAnswer, validateTerms } from "../engine/index.js";
import { warOrders } from "./war.js";

// a call to arms is always answered yes: the player would have to, or lose the alliance
export const callAnswers = (game, code) => game.state.offers.filter((o) => o.to === code && o.kind === "call").map((o) => ({ type: "answerOffer", country: code, id: o.id, accept: true }));

// each question waiting for `code` — a person's, whose country the full computer player has while they are away: peace and
// agreements by the formulas, a call to arms yes (a no would end their alliance for good, which a lapse never does); the rest
// — a demand, the Empire, integration — are left to lapse, which leaves no mark, where a no is remembered
export function answerOffers(game, code) {
    const st = game.state, out = [];
    for (const o of st.offers.filter((x) => x.to === code)) {
        let accept;
        if (o.kind === "peace") accept = !validateTerms(game, o.from, code, o.terms) && peaceAnswer(game, code, o.from, o.terms).accept;
        else if (o.kind === "agreement") accept = agreementAnswer(game, code, o.from, o.agreement).accept;
        else if (o.kind === "call") accept = true;
        else continue;
        out.push({ type: "answerOffer", country: code, id: o.id, accept });
    }
    return out;
}

export function caretakerOrders(game, code, fl) {
    const out = callAnswers(game, code);
    out.push(...warOrders(game, code, fl, { muster: false, defend: true }));
    return out;
}
