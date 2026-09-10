"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contributionEntry = contributionEntry;
const registration_1 = require("./registration");
const tokens_1 = require("./tokens");
/** Authenticate and snapshot one entry before creating its independent binding. */
function contributionEntry(token, registration) {
    const key = (0, tokens_1.readTokenKey)(token);
    (0, registration_1.normalize)(registration);
    return Object.freeze([key, registration]);
}
