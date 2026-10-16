# Editable synthetic display fixtures

`data.json` supplies 2 synthetic projects, 52 unit records, saved screen variants, inventory layouts, historical price facts and calculation-summary examples. `feedback.json` is a hand-written feedback registry and administrator plan example.

Edit display labels and numbers directly while preserving object/array shapes expected by `render.js`. The adapter clones data before filtering and sorting. Arrays in different saved variants are separate fixed examples; changing one does not recompute any other value. Bilingual UI strings belong in `../dict.js`; the hand-written feedback text contains both languages.

Policy/algorithm stamps and hashes are opaque preview placeholders. Actor/organization attribution, recurrence/calibration inputs, coefficients and detailed calculation evidence are removed. Result `payload` contains a preview notice only. Do not restore these fields or import source workbooks. Display identifiers connect units, layouts, projects and saved example screens only.

All mutations reject locally. A rendered permission allows previewing a form; it never authorizes a real save or calculation. The only network reads are same-origin GET requests for these static JSON files.
