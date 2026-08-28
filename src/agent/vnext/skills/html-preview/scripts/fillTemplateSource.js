/** Source string for guest run() virtual files / documentation. */
export const fillTemplateSource = `/**
 * Reusable helper for HTML report skill.
 */
export function fillTemplate(template, vars = {}) {
  return String(template || '').replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) =>
    vars[key] == null ? '' : String(vars[key])
  );
}
`;
