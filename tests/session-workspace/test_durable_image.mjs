import assert from 'node:assert/strict';
import {
  isEphemeralImageSrc,
  rewriteHtmlImageSrcs,
  rewriteWorkbookImages,
  snapshotNeedsImageReinsert
} from '../../src/preview/durableImage.js';

const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
);

assert.equal(isEphemeralImageSrc('blob:http://localhost/abc'), true);
assert.equal(isEphemeralImageSrc('data:image/png;base64,QQ=='), false);
assert.equal(isEphemeralImageSrc('https://cdn.example/a.png'), false);

const snap = {
  sheets: {
    s0: {
      name: 'Logic',
      cellData: {
        0: {
          1: {
            p: {
              drawings: {
                d1: {
                  source: 'blob:http://localhost/dead',
                  imageSourceType: 'URL',
                  sheetTransform: { from: { row: 0, column: 1 } }
                }
              }
            }
          }
        }
      }
    }
  },
  resources: [
    {
      name: 'SHEET_DRAWING_PLUGIN',
      data: JSON.stringify({
        data: {
          u: {
            sh: [
              {
                source: 'blob:http://localhost/dead',
                sheetTransform: { from: { row: 0, column: 1 } }
              }
            ]
          }
        }
      })
    }
  ]
};
assert.equal(snapshotNeedsImageReinsert(snap), true);
rewriteWorkbookImages(snap, [
  {
    sheet: 'Logic',
    row: 0,
    col: 1,
    src: 'blob:http://localhost/dead',
    bytes: PNG,
    mime: 'image/png'
  }
]);
assert.match(snap.sheets.s0.cellData[0][1].p.drawings.d1.source, /^data:image\/png;base64,/);
assert.equal(snap.sheets.s0.cellData[0][1].p.drawings.d1.imageSourceType, 'BASE64');
const res = JSON.parse(snap.resources[0].data);
assert.match(res.data.u.sh[0].source, /^data:image\/png;base64,/);
assert.equal(snapshotNeedsImageReinsert(snap), false);

const html = rewriteHtmlImageSrcs('<img src="blob:http://x/1" alt="a">', [
  { src: 'blob:http://x/1', bytes: PNG, mime: 'image/png' }
]);
assert.match(html, /src="data:image\/png;base64,/);
assert.doesNotMatch(html, /blob:/);

console.log('test_durable_image: ok');
