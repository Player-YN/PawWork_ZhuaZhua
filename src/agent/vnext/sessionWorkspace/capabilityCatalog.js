/**
 * External capability catalog (MCP later). Empty this wave — never dumped into model tools[].
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
