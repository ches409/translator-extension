// 팝업이 열릴 때 간단한 애니메이션
document.addEventListener('DOMContentLoaded', function() {
	const container = document.querySelector('.container');
	if (!container) return;
	container.style.transform = 'scale(0.9)';
	container.style.opacity = '0';
	setTimeout(() => {
		container.style.transition = 'all 0.3s ease';
		container.style.transform = 'scale(1)';
		container.style.opacity = '1';
	}, 50);

	initCalendarVocab();
});

// 현재 탭에서 번역기 상태 확인 (실제로는 content script와 통신)
function checkTranslatorStatus() {
	const indicator = document.querySelector('.toggle-indicator');
	if (indicator) {
		indicator.style.background = '#10b981';
	}
}

checkTranslatorStatus();

function initCalendarVocab() {
	const calendarGrid = document.getElementById('calendarGrid');
	const monthLabel = document.getElementById('monthLabel');
	const selectedDateLabel = document.getElementById('selectedDateLabel');
	const wordItems = document.getElementById('wordItems');
	const exportBtn = document.getElementById('exportBtn');
	const exportTxtBtn = document.getElementById('exportTxtBtn');
	const prevBtn = document.getElementById('prevMonth');
	const nextBtn = document.getElementById('nextMonth');

	if (!calendarGrid || !monthLabel || !selectedDateLabel || !wordItems) return;

	let current = new Date();
	let selectedDate = new Date();

	const fmtDateKey = (d) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
	const yyyymm = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

	async function readStore() {
		// IDB 우선 조회, 실패 시 chrome.storage → localStorage 순
		try {
			if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
				const key = fmtDateKey(selectedDate);
				const resp = await new Promise((resolve) => {
					chrome.runtime.sendMessage({ type: 'idbListByDate', dateKey: key }, resolve);
				});
				if (resp && resp.ok) {
					return { [key]: resp.rows || [] };
				}
			}
		} catch (e) {}

		return new Promise((resolve) => {
			try {
				if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
					chrome.storage.sync.get(['vocabByDate'], (result) => {
						resolve(result && result.vocabByDate ? result.vocabByDate : {});
					});
				} else {
					const raw = localStorage.getItem('vocabByDate');
					resolve(raw ? JSON.parse(raw) : {});
				}
			} catch (e) {
				resolve({});
			}
		});
	}

	function renderMonth(d) {
		const year = d.getFullYear();
		const month = d.getMonth();
		monthLabel.textContent = `${year}년 ${month+1}월`;
		calendarGrid.innerHTML = '';

		const firstDay = new Date(year, month, 1);
		const startWeekday = firstDay.getDay();
		const daysInMonth = new Date(year, month+1, 0).getDate();

		// 요일 헤더
		['일','월','화','수','목','금','토'].forEach(weekday => {
			const h = document.createElement('div');
			h.textContent = weekday;
			h.style.fontSize = '12px';
			h.style.color = '#6b7280';
			h.style.textAlign = 'center';
			h.style.fontWeight = '600';
			calendarGrid.appendChild(h);
		});

		// 빈칸(첫 주 시작 전)
		for (let i=0; i<startWeekday; i++) {
			const empty = document.createElement('div');
			calendarGrid.appendChild(empty);
		}

		// 날짜 셀
		for (let day=1; day<=daysInMonth; day++) {
			const cell = document.createElement('button');
			cell.textContent = String(day);
			cell.style.border = '1px solid #e5e7eb';
			cell.style.background = '#fff';
			cell.style.borderRadius = '6px';
			cell.style.padding = '4px 0';
			cell.style.cursor = 'pointer';
			cell.style.fontSize = '12px';

			const cellDate = new Date(year, month, day);
			const isToday = fmtDateKey(cellDate) === fmtDateKey(new Date());
			const isSelected = fmtDateKey(cellDate) === fmtDateKey(selectedDate);
			if (isSelected) {
				cell.style.background = '#eef2ff';
				cell.style.borderColor = '#6366f1';
				cell.style.color = '#3730a3';
				cell.style.fontWeight = '700';
			} else if (isToday) {
				cell.style.borderColor = '#6366f1';
				cell.style.fontWeight = '700';
			}

			cell.addEventListener('click', async () => {
				selectedDate = cellDate;
				selectedDateLabel.textContent = `${fmtDateKey(selectedDate)} 단어장`;
				renderMonth(current);
				await loadWordsForSelected();
			});

			calendarGrid.appendChild(cell);
		}
	}

	async function loadWordsForSelected() {
		const store = await readStore();
		const key = fmtDateKey(selectedDate);
		const items = Array.isArray(store[key]) ? store[key] : [];

		wordItems.innerHTML = '';
		if (items.length === 0) {
			const li = document.createElement('li');
			li.textContent = '저장된 단어가 없습니다';
			li.style.color = '#9ca3af';
			li.style.fontSize = '12px';
			wordItems.appendChild(li);
			return;
		}

		for (const it of items.sort((a,b)=>a.timestamp-b.timestamp)) {
			const li = document.createElement('li');
			li.style.display = 'flex';
			li.style.justifyContent = 'space-between';
			li.style.alignItems = 'center';
			li.style.padding = '8px 6px';
			li.style.borderBottom = '1px solid #f3f4f6';

			const left = document.createElement('div');
			left.innerHTML = `<div style="font-weight:600;color:#111827">${escapeHtml(it.sourceText)}</div>
			<div style="font-size:12px;color:#6b7280">${escapeHtml(it.translatedText)}</div>`;

			const right = document.createElement('div');
			right.style.display = 'flex';
			right.style.gap = '8px';

			const openA = document.createElement('a');
			openA.textContent = '↗';
			openA.href = it.url || '#';
			openA.target = '_blank';
			openA.style.textDecoration = 'none';
			openA.style.fontSize = '12px';
			openA.style.color = '#6366f1';

			const editBtn = document.createElement('button');
			editBtn.textContent = '수정';
			editBtn.style.fontSize = '12px';
			editBtn.style.border = '1px solid #d1d5db';
			editBtn.style.background = '#fff';
			editBtn.style.borderRadius = '4px';
			editBtn.style.padding = '2px 6px';
			editBtn.style.cursor = 'pointer';

			const delBtn = document.createElement('button');
			delBtn.textContent = '삭제';
			delBtn.style.fontSize = '12px';
			delBtn.style.border = '1px solid #ef4444';
			delBtn.style.color = '#ef4444';
			delBtn.style.background = '#fff';
			delBtn.style.borderRadius = '4px';
			delBtn.style.padding = '2px 6px';
			delBtn.style.cursor = 'pointer';

			right.appendChild(openA);
			right.appendChild(editBtn);
			right.appendChild(delBtn);

			li.appendChild(left);
			li.appendChild(right);
			wordItems.appendChild(li);

			editBtn.addEventListener('click', async () => {
				const newSource = prompt('원문 수정', it.sourceText || '');
				if (newSource == null) return;
				const newTranslated = prompt('번역 수정', it.translatedText || '');
				if (newTranslated == null) return;
				const dateKey = fmtDateKey(new Date(it.timestamp || Date.now()));
				const id = it.id || `${dateKey}-${encodeURIComponent(it.sourceText||'')}-${encodeURIComponent(it.translatedText||'')}`;
				const payload = { type: 'idbUpdateVocab', id, dateKey, sourceText: newSource, translatedText: newTranslated };
				try {
					await new Promise((resolve) => chrome.runtime.sendMessage(payload, resolve));
				} catch (e) {}
				await loadWordsForSelected();
			});

			delBtn.addEventListener('click', async () => {
				if (!confirm('삭제하시겠습니까?')) return;
				const dateKey = fmtDateKey(new Date(it.timestamp || Date.now()));
				const id = it.id || `${dateKey}-${encodeURIComponent(it.sourceText||'')}-${encodeURIComponent(it.translatedText||'')}`;
				const payload = { type: 'idbDeleteVocab', id, dateKey };
				try {
					await new Promise((resolve) => chrome.runtime.sendMessage(payload, resolve));
				} catch (e) {}
				await loadWordsForSelected();
			});
		}
	}

	prevBtn && prevBtn.addEventListener('click', async () => {
		current = new Date(current.getFullYear(), current.getMonth()-1, 1);
		renderMonth(current);
		await loadWordsForSelected();
	});

	nextBtn && nextBtn.addEventListener('click', async () => {
		current = new Date(current.getFullYear(), current.getMonth()+1, 1);
		renderMonth(current);
		await loadWordsForSelected();
	});

	exportBtn && exportBtn.addEventListener('click', async () => {
		const store = await readStore();
		const key = fmtDateKey(selectedDate);
		const items = Array.isArray(store[key]) ? store[key] : [];
		const csv = ['원문,번역,URL,시간'].concat(items.map(i => (
			`"${(i.sourceText||'').replace(/"/g,'""')}","${(i.translatedText||'').replace(/"/g,'""')}","${(i.url||'').replace(/"/g,'""')}","${new Date(i.timestamp||Date.now()).toLocaleString()}"`
		))).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `vocab-${key}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	});

	exportTxtBtn && exportTxtBtn.addEventListener('click', async () => {
		const store = await readStore();
		const key = fmtDateKey(selectedDate);
		const items = Array.isArray(store[key]) ? store[key] : [];
		const lines = items.map(i => `- ${i.sourceText} => ${i.translatedText} [${new Date(i.timestamp||Date.now()).toLocaleString()}] ${i.url||''}`);
		const content = `Vocabulary ${key}\n\n` + (lines.join('\n') || 'No items');
		const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `vocab-${key}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	});

	// 초기 렌더
	renderMonth(current);
	selectedDateLabel.textContent = `${fmtDateKey(selectedDate)} 단어장`;
	loadWordsForSelected();

	// 저장 알림 수신 시 비동기 새로고침
	try {
		if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
			chrome.runtime.onMessage.addListener((msg) => {
				if (msg && msg.type === 'vocabUpdated') {
					setTimeout(() => {
						loadWordsForSelected();
					}, 50);
				}
			});
		}
	} catch (e) {}

	// storage 변경 감지로 자동 새로고침 (팝업이 열려 있을 때)
	try {
		if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
			chrome.storage.onChanged.addListener((changes, area) => {
				if (area === 'sync' && changes && changes.vocabByDate) {
					loadWordsForSelected();
				}
			});
		}
	} catch (e) {}
}

function escapeHtml(s) {
	return String(s||'')
		.replace(/&/g,'&amp;')
		.replace(/</g,'&lt;')
		.replace(/>/g,'&gt;')
		.replace(/"/g,'&quot;')
		.replace(/'/g,'&#039;');
}
