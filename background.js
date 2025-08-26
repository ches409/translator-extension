// IndexedDB helpers
const DB_NAME = 'translator-db';
const DB_VERSION = 1;
const STORE = 'vocab'; // keyPath: id (dateKey + timestamp)

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = (e) => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains(STORE)) {
				const os = db.createObjectStore(STORE, { keyPath: 'id' });
				os.createIndex('byDate', 'dateKey', { unique: false });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function addEntry(entry) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		const store = tx.objectStore(STORE);
		store.put(entry);
		tx.oncomplete = () => resolve(true);
		tx.onerror = () => reject(tx.error);
	});
}

async function listByDate(dateKey) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const store = tx.objectStore(STORE);
		const idx = store.index('byDate');
		const req = idx.getAll(IDBKeyRange.only(dateKey));
		req.onsuccess = () => resolve(req.result || []);
		req.onerror = () => reject(req.error);
	});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	(async () => {
		if (!msg || !msg.type) return;
		if (msg.type === 'idbAddVocab') {
			// { dateKey, sourceText, translatedText, url, timestamp }
			const id = `${msg.dateKey}-${msg.timestamp}`;
			await addEntry({ id, ...msg });
			sendResponse({ ok: true });
			return;
		}
		if (msg.type === 'idbListByDate') {
			const rows = await listByDate(msg.dateKey);
			sendResponse({ ok: true, rows });
			return;
		}
	})().catch((e) => sendResponse({ ok: false, error: String(e) }));
	return true; // keep channel open
});
