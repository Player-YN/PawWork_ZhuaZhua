/**
 * External capability catalog (MCP later). Empty this wave — never dumped into model tools[].
 * Not the browser ABI list. Guest sys ops live in browserSys.js (SYS_OPS / SYS_HELP);
 * the agent reads them via inspect view=sys or sys.help(), not this file.
 */

export function listCapabilities() {
  return [];
}

/**
 * @param {{ id?: string, input?: object }} _args
 */
export async function invoke(_args = {}) {
  return {
    ok: false,
    code: 'NO_CAPABILITY',
    error: 'capability catalog is empty; no external MCP tools are registered'
  };
}

export function catalogToolNames() {
  return listCapabilities().map((c) => c.id).filter(Boolean);
}
