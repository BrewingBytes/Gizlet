import { handoffLifetimeMs, isFreshHandoff, isHandoffId } from '../data/file-handoff';

/**
 * The browser half of the handoff: putting a file somewhere the next page of
 * this site can pick it up, and picking it up.
 *
 * IndexedDB rather than anything else because it stores a `File` as a `File` —
 * no re-encoding into a string, no size ceiling worth arguing about, and it
 * survives the page load that a variable would not. It is this browser's own
 * storage on this device: nothing is sent anywhere, and the record is deleted
 * as it is read.
 *
 * Every failure here is silent and total. A browser with storage turned off, a
 * private window that refuses it, a quota that will not take a large file: the
 * handoff simply does not happen, the Gizlet opens with an empty picker, and
 * the visitor chooses the file the ordinary way. A dropped file is never worth
 * an error message about a database.
 */

const databaseName = 'gizlet-handoff';
const storeName = 'files';
const databaseVersion = 1;

interface HandoffRecord {
  readonly id: string;
  readonly file: File;
  readonly storedAt: number;
}

function openDatabase(): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;

    try {
      request = indexedDB.open(databaseName, databaseVersion);
    } catch {
      resolve(undefined);
      return;
    }

    request.addEventListener('upgradeneeded', () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'id' });
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => resolve(undefined));
    request.addEventListener('blocked', () => resolve(undefined));
  });
}

function newHandoffId(): string {
  const bytes = new Uint8Array(12);

  crypto.getRandomValues(bytes);

  return [...bytes].map((byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 24);
}

/** Stores the file and returns the identifier a link carries, or nothing. */
export async function putHandoffFile(file: File): Promise<string | undefined> {
  const database = await openDatabase();

  if (!database) return undefined;

  const id = newHandoffId();

  if (!isHandoffId(id)) return undefined;

  const stored = await new Promise<boolean>((resolve) => {
    try {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const now = Date.now();

      store.put({ id, file, storedAt: now } satisfies HandoffRecord);

      // A record nobody came back for is cleared on the next handoff rather
      // than left to sit in storage.
      const stale = store.openCursor();

      stale.addEventListener('success', () => {
        const cursor = stale.result;

        if (!cursor) return;

        const record = cursor.value as HandoffRecord;

        if (record.id !== id && !isFreshHandoff(record.storedAt, now)) cursor.delete();
        cursor.continue();
      });

      transaction.addEventListener('complete', () => resolve(true));
      transaction.addEventListener('error', () => resolve(false));
      transaction.addEventListener('abort', () => resolve(false));
    } catch {
      resolve(false);
    }
  });

  database.close();

  return stored ? id : undefined;
}

/** Reads a handed-over file back, once. The record is deleted either way. */
export async function takeHandoffFile(id: string): Promise<File | undefined> {
  if (!isHandoffId(id)) return undefined;

  const database = await openDatabase();

  if (!database) return undefined;

  const file = await new Promise<File | undefined>((resolve) => {
    try {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.addEventListener('success', () => {
        const record = request.result as HandoffRecord | undefined;

        store.delete(id);
        resolve(
          record && record.file instanceof File && isFreshHandoff(record.storedAt, Date.now())
            ? record.file
            : undefined,
        );
      });
      request.addEventListener('error', () => resolve(undefined));
      transaction.addEventListener('abort', () => resolve(undefined));
    } catch {
      resolve(undefined);
    }
  });

  database.close();

  return file;
}

export { handoffLifetimeMs };
