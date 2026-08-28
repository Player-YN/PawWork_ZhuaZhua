/**
 * Reusable helper for HTML report skill (import from guest code via skill resource
 * or copy pattern into run({ code })).
 * @param {string} template
 * @param {Record<string, string>} vars
 */
export function fillTemplate(template, vars = {}) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] == null ? '' : String(vars[key])
  );
}
