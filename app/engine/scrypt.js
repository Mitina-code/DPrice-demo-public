// The memory-hard core of scrypt (RFC 7914, ROMix with Salsa20/8 BlockMix)
// for the browser's Python, which has no OpenSSL and so no hashlib.scrypt.
// engine.py derives the PBKDF2 parts itself and calls this for the middle step,
// so a password is checked exactly as the server checks it.

const R = (a, b) => (a << b) | (a >>> (32 - b));

function salsa20_8(B, x) {
  x.set(B);
  for (let i = 0; i < 8; i += 2) {
    x[4] ^= R(x[0] + x[12], 7); x[8] ^= R(x[4] + x[0], 9);
    x[12] ^= R(x[8] + x[4], 13); x[0] ^= R(x[12] + x[8], 18);
    x[9] ^= R(x[5] + x[1], 7); x[13] ^= R(x[9] + x[5], 9);
    x[1] ^= R(x[13] + x[9], 13); x[5] ^= R(x[1] + x[13], 18);
    x[14] ^= R(x[10] + x[6], 7); x[2] ^= R(x[14] + x[10], 9);
    x[6] ^= R(x[2] + x[14], 13); x[10] ^= R(x[6] + x[2], 18);
    x[3] ^= R(x[15] + x[11], 7); x[7] ^= R(x[3] + x[15], 9);
    x[11] ^= R(x[7] + x[3], 13); x[15] ^= R(x[11] + x[7], 18);
    x[1] ^= R(x[0] + x[3], 7); x[2] ^= R(x[1] + x[0], 9);
    x[3] ^= R(x[2] + x[1], 13); x[0] ^= R(x[3] + x[2], 18);
    x[6] ^= R(x[5] + x[4], 7); x[7] ^= R(x[6] + x[5], 9);
    x[4] ^= R(x[7] + x[6], 13); x[5] ^= R(x[4] + x[7], 18);
    x[11] ^= R(x[10] + x[9], 7); x[8] ^= R(x[11] + x[10], 9);
    x[9] ^= R(x[8] + x[11], 13); x[10] ^= R(x[9] + x[8], 18);
    x[12] ^= R(x[15] + x[14], 7); x[13] ^= R(x[12] + x[15], 9);
    x[14] ^= R(x[13] + x[12], 13); x[15] ^= R(x[14] + x[13], 18);
  }
  for (let i = 0; i < 16; i += 1) B[i] = (B[i] + x[i]) | 0;
}

// B (32·r words) <- BlockMix(B); Y is scratch of the same size.
function blockMix(B, Y, X, x, r) {
  X.set(B.subarray((2 * r - 1) * 16, 2 * r * 16));
  for (let i = 0; i < 2 * r; i += 1) {
    for (let k = 0; k < 16; k += 1) X[k] ^= B[i * 16 + k];
    salsa20_8(X, x);
    const at = (i % 2 === 0 ? i / 2 : r + (i - 1) / 2) * 16;
    Y.set(X, at);
  }
  B.set(Y);
}

// ROMix over one 128·r-byte block; returns the mixed block.
export function scryptRomix(input, N, r) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const words = 32 * r;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const B = new Uint32Array(words);
  for (let i = 0; i < words; i += 1) B[i] = view.getUint32(i * 4, true);
  const V = new Uint32Array(words * N);
  const Y = new Uint32Array(words);
  const X = new Uint32Array(16);
  const x = new Uint32Array(16);
  for (let i = 0; i < N; i += 1) {
    V.set(B, i * words);
    blockMix(B, Y, X, x, r);
  }
  for (let i = 0; i < N; i += 1) {
    const j = B[(2 * r - 1) * 16] & (N - 1);
    const off = j * words;
    for (let k = 0; k < words; k += 1) B[k] ^= V[off + k];
    blockMix(B, Y, X, x, r);
  }
  const out = new Uint8Array(words * 4);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < words; i += 1) outView.setUint32(i * 4, B[i], true);
  return out;
}
