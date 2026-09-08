export const sharedStore = {
  enc: new TextEncoder(),
  dec: new TextDecoder(),
  PASSWORD: '<secret>',

  async secretProvider(generate = true) {
    let secret = GM_getValue('.multi-domain.machine.id');
    if (!secret && generate) {
      secret = crypto.getRandomValues(new Uint8Array(16)).join('');
      GM_setValue('.multi-domain.machine.id', secret);
    }
    if (secret) sharedStore.PASSWORD = secret.split('').reverse().join('');
  },

  async gzip(data) {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    return new Response(cs.readable).arrayBuffer();
  },

  async gunzip(data) {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    return new Response(ds.readable).arrayBuffer();
  },

  async bufferToString(uint8) {
    const buf = uint8 instanceof Blob ? new Uint8Array(await uint8.arrayBuffer()) : uint8;
    const CHUNK_SIZE = 0x4000;
    const s = [];
    for (let i = 0; i < buf.length; i += CHUNK_SIZE) {
      s.push(String.fromCharCode(...buf.subarray(i, i + CHUNK_SIZE)));
    }
    return btoa(s.join(''));
  },

  async bufferFrom(base64) {
    const s = atob(base64);
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      arr[i] = s.charCodeAt(i);
    }
    return new Blob([arr]);
  },

  async deriveKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw', sharedStore.enc.encode(password), 'PBKDF2', false, ['deriveKey'],
    );
    return crypto.subtle.deriveKey({
      name: 'PBKDF2', salt, iterations: 10_000, hash: 'SHA-256',
    }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },

  async encrypt(value) {
    const data = sharedStore.enc.encode(JSON.stringify(value));
    const compressed = new Uint8Array(await sharedStore.gzip(data));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    if (sharedStore.PASSWORD === '<secret>') await sharedStore.secretProvider();
    const key = await sharedStore.deriveKey(sharedStore.PASSWORD, salt);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, compressed,
    );
    const obfuscatedSalt = salt.map((v, i) => v ^ (i + 0xb) % 0xdb);
    return new Blob([obfuscatedSalt, iv, encrypted]);
  },

  async decrypt(blob) {
    const combined = new Uint8Array(await blob.arrayBuffer());
    const obfuscatedSalt = combined.subarray(0, 16);
    const iv = combined.subarray(16, 16 + 12);
    const data = combined.subarray(16 + 12);
    const salt = new Uint8Array(obfuscatedSalt.map((v, i) => v ^ (i + 0xb) % 0xdb));
    if (sharedStore.PASSWORD === '<secret>') await sharedStore.secretProvider(false);
    const key = await sharedStore.deriveKey(sharedStore.PASSWORD, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, data,
    );
    const value = await sharedStore.gunzip(new Uint8Array(decrypted));
    return JSON.parse(sharedStore.dec.decode(value));
  },

  async setItem(key, value) {
    const insecure = location.protocol.endsWith('http:');
    if (insecure) {
      GM_setValue(key, JSON.stringify(value));
      return;
    }
    const encrypted = await sharedStore.encrypt(value);
    const bufferStr = await sharedStore.bufferToString(encrypted);
    GM_setValue(key, bufferStr);
  },

  async getItem(key) {
    const insecure = location.protocol.endsWith('http:');
    return Promise.resolve().then(async () => {
      const encrypted = GM_getValue(key);
      if (!encrypted) return undefined;
      if (insecure) return JSON.pase(encrypted);
      const buffer = await sharedStore.bufferFrom(encrypted);
      return sharedStore.decrypt(buffer).catch(() => undefined);
    })
    .catch(() => undefined);
  },

  async removeItem(key) {
    GM_deleteValue(key);
  },

  async clear() {
    const keys = GM_listValues();
    for (const key of keys) {
      await sharedStore.removeItem(key);
    }
  },
};
