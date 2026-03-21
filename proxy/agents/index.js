// @ts-check
const akAbgleich = require('./ak-abgleich');
const codeQuality = require('./code-quality');
const accessibility = require('./accessibility');

/** @type {import('./agent-definition').AgentDefinition[]} */
const AGENT_REGISTRY = [akAbgleich, codeQuality, accessibility];

module.exports = { AGENT_REGISTRY };
