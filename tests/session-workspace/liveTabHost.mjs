/**
 * Host-side simulation of the live sheet tab apply/persist path.
 * snapshot = raw unit; apply inPlace; materialize every applied sheet;
 * persist the merged snapshot (not rememberDurable cosmetics).
 */
import {
  applyCommandsToWorkbookData,
  cloneSheetRows,
  mergeWorkbookSnapshot,
  sheetsToWorkbookData,
  workbookDataToSheets
} from '../../src/agent/vnext/sessionWorkspace/sheetApply.js';

export function createLiveTabHost(initialSheets, name = 'Book') {
  let unit = sheetsToWorkbookData(
    (initialSheets || []).map((s) => ({ name: s.name, rows: cloneSheetRows(s.rows) })),
    name,
    { id: 'live-unit' }
  );
  let durable = (initialSheets || []).map((s) => ({ name: s.name, rows: cloneSheetRows(s.rows) }));
  let persisted = mergeWorkbookSnapshot(unit, durable);
  let paints = 0;
  let autosaves = 0;

  function apply(commands) {
    const snap = applyCommandsToWorkbookData(unit, commands, { agentWrite: true, inPlace: true });
    if (snap.ok === false) return snap;
    unit = snap.data;
    paints += 1;
    durable = (snap.sheets || []).map((s) => ({ name: s.name, rows: cloneSheetRows(s.rows) }));
    persisted = mergeWorkbookSnapshot(unit, durable);
    autosaves += 1;
    return snap;
  }

  return {
    apply,
    paintCount: () => paints,
    autosaveCount: () => autosaves,
    unitSheets: () => workbookDataToSheets(unit),
    persistSheets: () => workbookDataToSheets(persisted),
    read: () => workbookDataToSheets(persisted)
  };
}
