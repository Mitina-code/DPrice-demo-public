# The DPrice server inside the visitor's browser (Pyodide).
#
# engine-worker.js runs this file once after Pyodide, the packages, the dprice
# source (/app/src) and the database (/app/var/prod.db) are in place. It makes
# the three adjustments the browser needs and nothing else:
#   1. no threads in WebAssembly: FastAPI's thread pool runs the function
#      directly (same result, one request at a time);
#   2. this Python has no OpenSSL, so hashlib.scrypt is missing: it is provided
#      here (standard scrypt, RFC 7914; the memory-hard core runs in JavaScript,
#      engine/scrypt.js) so passwords are checked exactly as on the server;
#   3. requests arrive as ASGI calls from the page, not from a socket.
# The application itself, its database schema and every rule are the product's
# unchanged code.
import asyncio
import hashlib
import hmac
import os
import sys

sys.path.insert(0, "/app/src")

# --- 1. thread pool -> direct call -------------------------------------------
import anyio.to_thread  # noqa: E402


async def _run_directly(func, *args, abandon_on_cancel=False, cancellable=None, limiter=None):
    return func(*args)


anyio.to_thread.run_sync = _run_directly

# The reverse direction (a "worker thread" calling back into the event loop,
# e.g. the upload route reading its multipart body) is the same thread here:
# the coroutine is driven to its end in place. Every await on that path
# completes at once (the whole request body is already delivered); one that
# would really have to wait cannot, and says so instead of hanging.
import anyio.from_thread  # noqa: E402


def _run_in_place(func, *args, token=None):
    coroutine = func(*args)
    try:
        while True:
            pending = coroutine.send(None)
            if pending is not None:
                coroutine.close()
                raise RuntimeError("an in-browser request had to wait on the event loop")
    except StopIteration as finished:
        return finished.value


anyio.from_thread.run = _run_in_place

# --- 2. hashlib.scrypt --------------------------------------------------------
import js  # noqa: E402
from pyodide.ffi import to_js  # noqa: E402


def _pbkdf2_sha256_one_round(password: bytes, salt: bytes, dklen: int) -> bytes:
    # PBKDF2-HMAC-SHA256 with one iteration, as scrypt uses it.
    out = bytearray()
    block = 1
    while len(out) < dklen:
        out += hmac.new(password, salt + block.to_bytes(4, "big"), hashlib.sha256).digest()
        block += 1
    return bytes(out[:dklen])


def _scrypt(password, *, salt, n, r, p, maxmem=0, dklen=64):
    password = bytes(password)
    salt = bytes(salt)
    if n < 2 or n & (n - 1):
        raise ValueError("n must be a power of 2 greater than 1")
    blocks = _pbkdf2_sha256_one_round(password, salt, p * 128 * r)
    mixed = bytearray()
    for i in range(p):
        chunk = blocks[i * 128 * r:(i + 1) * 128 * r]
        mixed += js.dpriceScryptRomix(to_js(chunk), n, r).to_bytes()
    return _pbkdf2_sha256_one_round(password, bytes(mixed), dklen)


if not hasattr(hashlib, "scrypt"):
    hashlib.scrypt = _scrypt

# --- the application ------------------------------------------------------------
from dprice.env import resolve_env  # noqa: E402
from dprice.store.db import init_db  # noqa: E402

# Bring a visitor's stored database up to this code's schema (new migrations,
# insert-if-absent seeds), exactly as `dprice init` does on every deploy.
init_db(resolve_env())

from dprice.web.app import create_app  # noqa: E402

app = create_app()

# The workbook upload route reads its body through from_thread.run (above);
# behind the app's own middleware that read waits on a task group, which a
# single thread cannot do in place. The bytes are already here, so the
# product's own reader gets a request that replays exactly those bytes.
import contextvars  # noqa: E402

import dprice.web.routes_imports as _routes_imports  # noqa: E402
from starlette.requests import Request as _Request  # noqa: E402

_delivered_body = contextvars.ContextVar("dprice_delivered_body", default=b"")
_read_workbook_upload = _routes_imports._read_workbook_upload


async def _read_delivered_workbook(request):
    body = _delivered_body.get()

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return await _read_workbook_upload(_Request(request.scope, receive))


_routes_imports._read_workbook_upload = _read_delivered_workbook

# The session cookie the app sets, kept for this tab only.
_cookies: dict[str, str] = {}


def _remember_cookies(headers):
    for name, value in headers:
        if name.lower() != b"set-cookie":
            continue
        text = value.decode("latin-1")
        pair, _, attributes = text.partition(";")
        key, _, val = pair.partition("=")
        key = key.strip()
        attrs = attributes.lower()
        if "max-age=0" in attrs.replace(" ", "") or "expires=thu, 01 jan 1970" in attrs or val.strip() in ("", '""', "null"):
            _cookies.pop(key, None)
        else:
            _cookies[key] = val.strip()


async def handle(method, path, query, headers, body):
    """Serve one request: returns [status, [[name, value], ...], body bytes]."""
    method = str(method).upper()
    pairs = [(str(k).lower(), str(v)) for k, v in (headers.to_py() if hasattr(headers, "to_py") else headers)]
    pairs = [(k, v) for k, v in pairs if k not in ("cookie", "host", "sec-fetch-site", "origin")]
    pairs.append(("host", "localhost"))
    pairs.append(("sec-fetch-site", "same-origin"))
    if _cookies:
        pairs.append(("cookie", "; ".join(f"{k}={v}" for k, v in _cookies.items())))
    payload = body.to_bytes() if hasattr(body, "to_bytes") else bytes(body or b"")
    if payload and not any(k == "content-length" for k, _ in pairs):
        pairs.append(("content-length", str(len(payload))))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": str(path),
        "raw_path": str(path).encode("utf-8"),
        "query_string": str(query or "").encode("latin-1"),
        "root_path": "",
        "headers": [(k.encode("latin-1"), v.encode("latin-1")) for k, v in pairs],
        "client": ("127.0.0.1", 0),
        "server": ("localhost", 80),
        "state": {},
    }
    done = asyncio.Event()
    delivered = False

    async def receive():
        nonlocal delivered
        if not delivered:
            delivered = True
            return {"type": "http.request", "body": payload, "more_body": False}
        await done.wait()
        return {"type": "http.disconnect"}

    status = 500
    response_headers = []
    chunks = []

    async def send(message):
        nonlocal status, response_headers
        if message["type"] == "http.response.start":
            status = message["status"]
            response_headers = list(message.get("headers") or [])
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body") or b"")
            if not message.get("more_body"):
                done.set()

    _delivered_body.set(payload)
    try:
        await app(scope, receive, send)
    finally:
        done.set()
    _remember_cookies(response_headers)
    out_headers = [
        [k.decode("latin-1"), v.decode("latin-1")]
        for k, v in response_headers
        if k.lower() != b"set-cookie"
    ]
    return to_js([status, out_headers, to_js(b"".join(chunks))])


def forget_session():
    _cookies.clear()
