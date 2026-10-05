// Encrypted device database: expo-sqlite built with SQLCipher (`useSQLCipher: true` in app.json).
// A random 32-byte key is created with expo-crypto on first launch and kept in SecureStore
// (Keychain / Android Keystore). It is applied as a raw key (`PRAGMA key = "x'…'"`), so SQLCipher
// skips its slow passphrase derivation. Everything here is synchronous so headless JS (widget
// handler, background task, notification actions) can use the same single connection.
//
// The connection opens lazily on first query: importing data modules at the JS entry must not touch
// the Keychain, which is unreadable before the first unlock after a reboot.
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { defaultDatabaseDirectory, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'dosely.db';
const KEY_NAME = 'dosely.db.key.v1';

// AFTER_FIRST_UNLOCK: background tasks and notification actions run while the phone is locked.
// Not THIS_DEVICE_ONLY, so an encrypted iCloud backup restores key and database together.
const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const isHexKey = (value: string | null): value is string => !!value && /^[0-9a-f]{64}$/.test(value);

/**
 * The stored key, or null when none exists yet. Throws when the Keychain / Keystore is unavailable
 * (e.g. locked before first unlock): never treat that as "no key", or the database would be lost.
 */
function readKey(): string | null {
  const value = SecureStore.getItem(KEY_NAME, KEY_OPTIONS);
  if (value === null) return null;
  if (!isHexKey(value)) throw new Error('Stored database key is malformed');
  return value;
}

function createKey(): string {
  const key = toHex(Crypto.getRandomBytes(32));
  SecureStore.setItem(KEY_NAME, key, KEY_OPTIONS);
  return key;
}

/** expo-sqlite reports a plain path; expo-file-system wants a `file://` URI. */
function databaseDirectoryUri(): string {
  const dir = String(defaultDatabaseDirectory);
  return dir.startsWith('file://') ? dir : `file://${dir}`;
}

const dbFiles = () => ['', '-wal', '-shm'].map((suffix) => new File(databaseDirectoryUri(), `${DATABASE_NAME}${suffix}`));

/**
 * Moves an undecryptable database out of the way (kept, renamed, never silently deleted) so a fresh
 * one can be created. Happens when a backup restored the file but not the key.
 */
function setAsideUnreadableDatabase(): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const file of dbFiles()) {
    try {
      if (file.exists) file.rename(`${file.name}.unreadable-${stamp}`);
    } catch (error) {
      console.warn('[db] could not move aside', file.name, error);
    }
  }
}

function openWithKey(key: string): SQLiteDatabase {
  // `useNewConnection`: never reuse a cached handle that was opened with another key.
  const conn = openDatabaseSync(DATABASE_NAME, { useNewConnection: true });
  try {
    // `key` is validated hex (isHexKey / createKey), so interpolating it is safe.
    conn.execSync(`PRAGMA key = "x'${key}'";`);
    // The first real read fails with "file is not a database" when the key does not match.
    conn.getFirstSync('SELECT count(*) AS n FROM sqlite_master;');
    conn.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
    return conn;
  } catch (error) {
    try {
      conn.closeSync();
    } catch {
      // already closed
    }
    throw error;
  }
}

function openEncrypted(): SQLiteDatabase {
  let key = readKey();
  if (!key) {
    if (dbFiles()[0]!.exists) setAsideUnreadableDatabase();
    key = createKey();
  }
  try {
    return openWithKey(key);
  } catch (error) {
    console.warn('[db] could not decrypt the database; keeping it aside and starting empty', error);
    setAsideUnreadableDatabase();
    return openWithKey(key);
  }
}

let connection: SQLiteDatabase | null = null;
let orm: ExpoSQLiteDatabase<typeof schema> | null = null;

/** The raw expo-sqlite connection (opened on first use). */
export function getSqlite(): SQLiteDatabase {
  if (!connection) connection = openEncrypted();
  return connection;
}

export function getDb(): ExpoSQLiteDatabase<typeof schema> {
  if (!orm) orm = drizzle(getSqlite(), { schema });
  return orm;
}

export type Database = ExpoSQLiteDatabase<typeof schema>;

/** Drizzle database (lazy proxy: the encrypted connection opens on the first query). */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
