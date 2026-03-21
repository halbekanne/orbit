// @ts-check
const akAbgleich = require('./ak-abgleich');
const codeQuality = require('./code-quality');

/** @type {import('./agent-definition').AgentDefinition[]} */
const AGENT_REGISTRY = [akAbgleich, codeQuality];

module.exports = { AGENT_REGISTRY };
