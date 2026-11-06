// The prebuilt game uses a fixed deployment prefix in Next's static flight files.
// Resolve that prefix to this mount point; preserve the independent local game.
const gameBase = location.pathname.slice(0, location.pathname.indexOf('/game/')) + '/game';
globalThis.__DPRICE_GAME_BASE__ = gameBase;
globalThis.__DPRICE_LANDING__ = gameBase.slice(0, -5) + '/landing/';
globalThis.__DPRICE_REBASE_PATH__ = (match) => match === '/DPrice-demo-public/game'
  ? gameBase : globalThis.__DPRICE_LANDING__;
const staticFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const response = await staticFetch(input, init);
  const url = new URL(response.url || (typeof input === 'string' ? input : input.url), location.href);
  if (url.origin === location.origin && url.pathname.startsWith(gameBase + '/') && url.pathname.endsWith('/index.txt')) {
    const text = (await response.text()).replace(/\/DPrice-demo-public\/game|\/DPrice-demo-public\/landing\/?|\/DPrice-demo-public\//g, globalThis.__DPRICE_REBASE_PATH__);
    return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  return response;
};
