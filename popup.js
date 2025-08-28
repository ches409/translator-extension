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

// Web Speech API: 텍스트 발음 도우미
function detectPreferredLangForText(text, fallbackLang) {
	try {
		const s = String(text||'');
		if (/[\u3131-\uD79D]/.test(s)) return 'ko-KR';
		if (/[A-Za-z]/.test(s)) return 'en-US';
		if (/[\u3040-\u30ff]/.test(s)) return 'ja-JP';
		if (/[\u4e00-\u9fff]/.test(s)) return 'zh-CN';
		return fallbackLang || 'en-US';
	} catch (_) {
		return fallbackLang || 'en-US';
	}
}

function pickVoiceByLang(lang) {
	try {
		const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
		if (!voices || voices.length === 0) return null;
		const primaryTag = String(lang||'').split('-')[0];
		return (
			voices.find(v => v.lang === lang) ||
			voices.find(v => (v.lang||'').toLowerCase().startsWith(primaryTag.toLowerCase())) ||
			voices[0]
		);
	} catch (_) {
		return null;
	}
}

function speakText(text, preferredLang) {
	try {
		if (!('speechSynthesis' in window)) {
			alert('이 브라우저에서는 음성 합성이 지원되지 않습니다.');
			return;
		}
		const lang = preferredLang || detectPreferredLangForText(text, 'en-US');
		speechSynthesis.cancel();
		const u = new SpeechSynthesisUtterance(String(text||''));
		u.lang = lang;
		u.rate = 1;
		u.pitch = 1;
		u.volume = 1;
		const v = pickVoiceByLang(lang);
		if (v) u.voice = v;
		speechSynthesis.speak(u);
	} catch (e) {
		console.warn('TTS 실패:', e);
	}
}

// 일부 환경에서 voices가 지연 로드되므로 미리 트리거
try { if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function() { /* no-op, 캐시 */ }; } } catch (e) {}

// 현재 탭에서 번역기 상태 확인 (실제로는 content script와 통신)
function checkTranslatorStatus() {
	const indicator = document.querySelector('.toggle-indicator');
	if (indicator) {
		indicator.style.background = '#10b981';
	}
}

checkTranslatorStatus();

async function initCalendarVocab() {
	const calendarGrid = document.getElementById('calendarGrid');
	const monthLabel = document.getElementById('monthLabel');
	const selectedDateLabel = document.getElementById('selectedDateLabel');
	const wordItems = document.getElementById('wordItems');
	const exportBtn = document.getElementById('exportBtn');
	const exportTxtBtn = document.getElementById('exportTxtBtn');
	const toggleHideModeBtn = document.getElementById('toggleHideModeBtn');
	const prevBtn = document.getElementById('prevMonth');
	const nextBtn = document.getElementById('nextMonth');

	if (!calendarGrid || !monthLabel || !selectedDateLabel || !wordItems) return;

	// 가리기 모드(저장/복원): 0=원상태, 1=영어(원문) 가리기, 2=뜻(번역) 가리기
	let hideMode = 0;

	try {
		const raw = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync)
			? await new Promise((resolve)=>chrome.storage.sync.get(['hideMode'], resolve))
			: null;
		if (raw && typeof raw.hideMode === 'number') {
			hideMode = raw.hideMode;
		} else {
			try { hideMode = parseInt(localStorage.getItem('hideMode')||'0', 10) || 0; } catch (e) {}
		}
	} catch (e) {}

	let current = new Date();
	let selectedDate = new Date();
	let monthCounts = {}; // { 'YYYY-MM-DD': number }

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

	async function renderMonth(d) {
		const year = d.getFullYear();
		const month = d.getMonth();
		monthLabel.textContent = `${year}년 ${month+1}월`;
		calendarGrid.innerHTML = '';

		// 월별 저장 카운트 로드 (IDB 우선)
		monthCounts = {};
		try {
			if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
				const resp = await new Promise((resolve) => {
					chrome.runtime.sendMessage({ type: 'idbListMonthCounts', y: year, m: month+1 }, resolve);
				});
				if (resp && resp.ok && resp.counts) {
					monthCounts = resp.counts || {};
				}
			}
		} catch (e) {}

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
			const hasAny = (monthCounts[fmtDateKey(cellDate)] || 0) > 0;
			if (isSelected) {
				cell.style.background = '#eef2ff';
				cell.style.borderColor = '#6366f1';
				cell.style.color = '#3730a3';
				cell.style.fontWeight = '700';
			} else if (isToday) {
				cell.style.borderColor = '#6366f1';
				cell.style.fontWeight = '700';
			} else if (!hasAny) {
				cell.style.color = '#9ca3af'; // 회색 텍스트
				cell.style.borderColor = '#e5e7eb';
			}

			cell.addEventListener('click', async () => {
				selectedDate = cellDate;
				selectedDateLabel.textContent = `${fmtDateKey(selectedDate)}`;
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
			const sourceSpan = document.createElement('div');
			sourceSpan.className = 'v-src';
			sourceSpan.style.fontWeight = '600';
			sourceSpan.style.color = '#111827';
			sourceSpan.textContent = String(it.sourceText||'');
			const transSpan = document.createElement('div');
			transSpan.className = 'v-trans';
			transSpan.style.fontSize = '12px';
			transSpan.style.color = '#6b7280';
			transSpan.textContent = String(it.translatedText||'');
			left.appendChild(sourceSpan);
			left.appendChild(transSpan);

			const right = document.createElement('div');
			right.style.display = 'flex';
			right.style.gap = '8px';

			const speakSrcBtn = document.createElement('button');
			speakSrcBtn.textContent = '🔊원문';
			speakSrcBtn.style.fontSize = '12px';
			speakSrcBtn.style.border = '1px solid #3b82f6';
			speakSrcBtn.style.color = '#1d4ed8';
			speakSrcBtn.style.background = '#fff';
			speakSrcBtn.style.borderRadius = '4px';
			speakSrcBtn.style.padding = '2px 6px';
			speakSrcBtn.style.cursor = 'pointer';

			const speakDstBtn = document.createElement('button');
			speakDstBtn.textContent = '🔊번역';
			speakDstBtn.style.fontSize = '12px';
			speakDstBtn.style.border = '1px solid #3b82f6';
			speakDstBtn.style.color = '#1d4ed8';
			speakDstBtn.style.background = '#fff';
			speakDstBtn.style.borderRadius = '4px';
			speakDstBtn.style.padding = '2px 6px';
			speakDstBtn.style.cursor = 'pointer';

			const openA = document.createElement('a');
			openA.textContent = '↗';
			// 원문(없으면 번역문)으로 구글 검색
			try {
				const q = (it && it.sourceText) ? String(it.sourceText) : String(it && it.translatedText || '');
				openA.href = 'https://www.google.com/search?q=' + encodeURIComponent(q + ' 영어 번역');
			} catch (e) {
				openA.href = '#';
			}
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
			right.appendChild(speakSrcBtn);
			right.appendChild(speakDstBtn);
			right.appendChild(editBtn);
			right.appendChild(delBtn);
			speakSrcBtn.addEventListener('click', () => {
				speakText(it.sourceText, detectPreferredLangForText(it.sourceText, 'en-US'));
			});

			speakDstBtn.addEventListener('click', () => {
				speakText(it.translatedText, detectPreferredLangForText(it.translatedText, 'ko-KR'));
			});

			li.appendChild(left);
			li.appendChild(right);
			wordItems.appendChild(li);
			// 가리기 상태 적용
			if (hideMode === 1) {
				sourceSpan.style.filter = 'blur(6px)';
				sourceSpan.style.userSelect = 'none';
			}
			if (hideMode === 2) {
				transSpan.style.filter = 'blur(6px)';
				transSpan.style.userSelect = 'none';
			}

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

	// 단일 버튼 3단계 토글
	function persistHideState() {
		try {
			if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
				chrome.storage.sync.set({ hideMode }, () => {});
			} else {
				localStorage.setItem('hideMode', String(hideMode||0));
			}
		} catch (e) {}
	}

	function updateHideButtonLabel() {
		if (!toggleHideModeBtn) return;
		if (hideMode === 0) toggleHideModeBtn.textContent = '영어 가리기';
		else if (hideMode === 1) toggleHideModeBtn.textContent = '뜻 가리기';
		else toggleHideModeBtn.textContent = '다시 원상태';
	}

	function applyHideStateToList() {
		try {
			const items = wordItems.querySelectorAll('li');
			items.forEach((li) => {
				const source = li.querySelector('.v-src');
				const trans = li.querySelector('.v-trans');
				if (source) {
					source.style.filter = (hideMode === 1) ? 'blur(6px)' : 'none';
					source.style.userSelect = (hideMode === 1) ? 'none' : 'auto';
				}
				if (trans) {
					trans.style.filter = (hideMode === 2) ? 'blur(6px)' : 'none';
					trans.style.userSelect = (hideMode === 2) ? 'none' : 'auto';
				}
			});
		} catch (e) {}
	}

	updateHideButtonLabel();

	toggleHideModeBtn && toggleHideModeBtn.addEventListener('click', () => {
		hideMode = (hideMode + 1) % 3; // 0 -> 1 -> 2 -> 0
		persistHideState();
		updateHideButtonLabel();
		applyHideStateToList();
	});

	exportBtn && exportBtn.addEventListener('click', async () => {
		const store = await readStore();
		const key = fmtDateKey(selectedDate);
		const items = Array.isArray(store[key]) ? store[key] : [];
		const csv = ['원문,번역'].concat(items.map(i => (
			`"${(i.sourceText||'').replace(/"/g,'""')}","${(i.translatedText||'').replace(/"/g,'""')}"`
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
		const lines = items.map(i => `- ${i.sourceText} => ${i.translatedText}`);
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
	selectedDateLabel.textContent = `${fmtDateKey(selectedDate)}`;
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
