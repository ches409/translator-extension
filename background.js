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

async function updateEntry(id, updates) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		const store = tx.objectStore(STORE);
		const getReq = store.get(id);
		getReq.onsuccess = () => {
			const current = getReq.result;
			if (!current) {
				resolve(false);
				return;
			}
			const next = { ...current, ...updates };
			store.put(next);
		};
		getReq.onerror = () => reject(getReq.error);
		tx.oncomplete = () => resolve(true);
		tx.onerror = () => reject(tx.error);
	});
}

async function deleteEntry(id) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		const store = tx.objectStore(STORE);
		store.delete(id);
		tx.oncomplete = () => resolve(true);
		tx.onerror = () => reject(tx.error);
	});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	(async () => {
		if (!msg || !msg.type) return;
		if (msg.type === 'idbAddVocab') {
			// { id, dateKey, sourceText, translatedText }
			const id = msg.id || `${msg.dateKey}-${Date.now()}`;
			await addEntry({ id, ...msg });
			sendResponse({ ok: true });
			return;
		}
		if (msg.type === 'idbListByDate') {
			const rows = await listByDate(msg.dateKey);
			sendResponse({ ok: true, rows });
			return;
		}
		if (msg.type === 'idbDeleteVocab') {
			const { id, dateKey } = msg;
			if (!id || !dateKey) { sendResponse({ ok: false, error: 'missing id/dateKey' }); return; }
			await deleteEntry(id);
			try {
				chrome.storage.sync.get(['vocabByDate'], (result) => {
					const store = (result && result.vocabByDate) ? result.vocabByDate : {};
					if (Array.isArray(store[dateKey])) {
						store[dateKey] = store[dateKey].filter(it => (it.id||'') !== id);
						chrome.storage.sync.set({ vocabByDate: store }, () => sendResponse({ ok: true }));
					} else {
						sendResponse({ ok: true });
					}
				});
			} catch (e) {
				sendResponse({ ok: true });
			}
			return;
		}
		if (msg.type === 'idbUpdateVocab') {
			const { id, dateKey, sourceText, translatedText } = msg;
			if (!id || !dateKey) { sendResponse({ ok: false, error: 'missing id/dateKey' }); return; }
			const updates = {};
			if (typeof sourceText === 'string') updates.sourceText = sourceText;
			if (typeof translatedText === 'string') updates.translatedText = translatedText;
			await updateEntry(id, updates);
			try {
				chrome.storage.sync.get(['vocabByDate'], (result) => {
					const store = (result && result.vocabByDate) ? result.vocabByDate : {};
					if (Array.isArray(store[dateKey])) {
						store[dateKey] = store[dateKey].map(it => (it.id===id ? { ...it, ...updates } : it));
						chrome.storage.sync.set({ vocabByDate: store }, () => sendResponse({ ok: true }));
					} else {
						sendResponse({ ok: true });
					}
				});
			} catch (e) {
				sendResponse({ ok: true });
			}
			return;
		}
		if (msg.type === 'openPopupPage') {
			try {
				const url = chrome.runtime.getURL('popup.html');
				chrome.tabs.create({ url }, () => sendResponse({ ok: true }));
			} catch (e) {
				sendResponse({ ok: false, error: String(e) });
			}
			return;
		}
	})().catch((e) => sendResponse({ ok: false, error: String(e) }));
	return true; // keep channel open
});
