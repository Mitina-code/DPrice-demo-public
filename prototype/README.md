# Earlier three-market interface

This is the earlier independent DPrice UI, preserved separately from the released v0.16.9 account preview. It contains nine views, three markets (UAE, Russia, Kazakhstan), five projects per market and RU/EN copy.

Edit the vanilla ES modules and CSS under `ui/`. Fixed synthetic display snapshots live in `ui/fixtures/{uae,rf,kz}.json`; their field shapes match `ui/render.js`. See `ui/fixtures/README.md` for the display contract. The source UI revision is `53826608f96db9f4b51dc5c2b36f17f21df4402e`, captured on 2026-10-01.

Serve the enclosing `site/` directory with a static HTTP server and open `prototype/`. Its relative module, JSON and local-font URLs also work under a repository subpath. There is no framework, backend, authentication or calculation engine.

Controls change local presentation state. Numbers remain fixed. Confirmation dialogs explain that nothing saves or runs; the reset control restores local presentation defaults. The gallery link identifies this as an earlier interface. Dictionary method descriptions and engine verdict thresholds are excluded; fixed fixture `bar_class` fields provide already-chosen display styling.

Preserve all views, markets, projects and these honest preview interactions. Do not add policies, live API clients, buyer/renter data or pricing-uplift claims. Keep font licenses and translations. The repository browser suite checks this entry with the other interfaces.

Chart month labels are anchored to the fixed snapshot date 2026-10-01 UTC; they never follow the viewer's system month. The entry accepts `?lang=ru|en` and the gallery return preserves the selected language.
