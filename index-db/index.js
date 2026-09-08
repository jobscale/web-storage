export const indexStore = {
  enc: new TextEncoder(),
  dec: new TextDecoder(),
  DATABASE: 'SecureDB',
  TABLE: 'SecureStore',
  PASSWORD: '<secret>',

  async secretProvider() {
    indexStore.PASSWORD = `2026:${location.hostname.split('.').reverse().join('.')}:custom-storage`;
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

  async deriveKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw', indexStore.enc.encode(password), 'PBKDF2', false, ['deriveKey'],
    );
    return crypto.subtle.deriveKey({
      name: 'PBKDF2', salt, iterations: 10_000, hash: 'SHA-256',
    }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },

  async encrypt(value) {
    const data = indexStore.enc.encode(JSON.stringify(value));
    const compressed = new Uint8Array(await indexStore.gzip(data));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    if (indexStore.PASSWORD === '<secret>') await indexStore.secretProvider();
    const key = await indexStore.deriveKey(indexStore.PASSWORD, salt);
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
    if (indexStore.PASSWORD === '<secret>') await indexStore.secretProvider(false);
    const key = await indexStore.deriveKey(indexStore.PASSWORD, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, data,
    );
    const value = await indexStore.gunzip(new Uint8Array(decrypted));
    return JSON.parse(indexStore.dec.decode(value));
  },

  async init() {
    if (indexStore.db) return indexStore.db;
    indexStore.db = new Promise((resolve, reject) => {
      const req = indexedDB.open(indexStore.DATABASE, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(indexStore.TABLE)) {
          db.createObjectStore(indexStore.TABLE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return indexStore.db;
  },

  async setItem(key, value) {
    const insecure = location.protocol.endsWith('http:');
    const db = await indexStore.init();
    const encrypted = insecure ? JSON.stringify(value) : await indexStore.encrypt(value);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(indexStore.TABLE, 'readwrite');
      const store = tx.objectStore(indexStore.TABLE);
      const req = store.put(encrypted, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async getItem(key) {
    const insecure = location.protocol.endsWith('http:');
    return Promise.resolve().then(async () => {
      const decode = encrypted => {
        if (!encrypted) return undefined;
        if (insecure) JSON.parse(encrypted);
        return indexStore.decrypt(encrypted).catch(() => undefined);
      };
      const db = await indexStore.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(indexStore.TABLE, 'readonly');
        const store = tx.objectStore(indexStore.TABLE);
        const req = store.get(key);
        req.onsuccess = () => resolve(decode(req.result));
        req.onerror = () => reject(req.error);
      });
    })
    .catch(() => undefined);
  },

  async removeItem(key) {
    if (location.protocol.endsWith('http:')) {
      localStorage.removeItem(key);
      return undefined;
    }
    const db = await indexStore.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(indexStore.TABLE, 'readwrite');
      const store = tx.objectStore(indexStore.TABLE);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async clear() {
    if (location.protocol.endsWith('http:')) {
      localStorage.clear();
      return undefined;
    }
    const db = await indexStore.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(indexStore.TABLE, 'readwrite');
      const store = tx.objectStore(indexStore.TABLE);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },
};
