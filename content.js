class UniversalTranslator {
    constructor() {
        this.selectedText = '';
        this.mouseX = 0;
        this.mouseY = 0;
        this.popup = null;
        this.isLoading = false;
        this.isEnabled = true;
        this.indicatorEnabled = true;
        
        this.init();
    }

    init() {
        // 최상위 창에서만 UI 생성, 중복 주입 방지
        try {
            if (window.self !== window.top) {
                return;
            }
        } catch (e) {
            // cross-origin 접근 시에도 아이콘 생성 방지
            return;
        }
        const rootEl = document.documentElement;
        if (rootEl && rootEl.getAttribute('data-translator-injected') === '1') {
            return;
        }
        if (rootEl) {
            rootEl.setAttribute('data-translator-injected', '1');
        }

        this.createPopup();
        this.createToggleButton();
        this.createSettingsButton();
        this.createOpenPopupButton();
        this.addStyles();
        this.loadIndicatorSetting();
        
        // 마우스 위치 추적
        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });

        // 텍스트 선택 감지
        document.addEventListener('mouseup', () => {
            if (this.isEnabled) {
                this.handleTextSelection();
            }
        });

        // 키보드 이벤트 (C키)
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'c' && 
                this.selectedText && 
                !this.isLoading && 
                this.isEnabled &&
                !e.ctrlKey && // Ctrl+C 제외
                !this.isInputFocused()) {
                
                e.preventDefault();
                // 드래그 안내 인디케이터 즉시 숨김
                this.hideSelectionIndicator();
                this.translateSelectedText();
            }
        });

        // ESC키로 팝업 숨기기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hidePopup();
            }
        });

        // 클릭으로 팝업 숨기기
        document.addEventListener('click', (e) => {
            if (this.popup && !this.popup.contains(e.target)) {
                this.hidePopup();
            }
        });
    }

    async loadIndicatorSetting() {
        try {
            const enabled = await this.getShowIndicator();
            this.indicatorEnabled = enabled;
        } catch (_) {
            this.indicatorEnabled = true;
        }
    }

    addStyles() {
        if (!document.getElementById('translator-styles')) {
            const style = document.createElement('style');
            style.id = 'translator-styles';
            style.textContent = `
                @keyframes translator-spin {
                    to { transform: rotate(360deg); }
                }
                
                .translator-popup::before {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 6px solid transparent;
                    border-top-color: #4f46e5;
                }

                /* 사이트 전역 CSS가 색상을 덮어쓰는 문제 방지 */
                .translator-popup, .translator-popup * {
                    color: #ffffff !important;
                    -webkit-text-fill-color: #ffffff !important;
                    mix-blend-mode: normal !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    createPopup() {
        // 기존 팝업 제거 후 재생성 방지
        try {
            const existing = document.querySelector('.translator-popup');
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        } catch (e) {}
        this.popup = document.createElement('div');
        this.popup.className = 'translator-popup';
        this.popup.style.cssText = `
            all: initial !important;
            position: fixed !important;
            background: linear-gradient(135deg, #4f46e5, #7c3aed) !important;
            color: white !important;
            -webkit-text-fill-color: white !important;
            padding: 12px 18px !important;
            border-radius: 12px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            z-index: 2147483647 !important;
            opacity: 0 !important;
            transform: scale(0.8) translateY(10px) !important;
            transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
            pointer-events: none !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
            backdrop-filter: blur(10px) !important;
            border: 1px solid rgba(255,255,255,0.2) !important;
            max-width: 300px !important;
            word-wrap: break-word !important;
            line-height: 1.4 !important;
            isolation: isolate !important;
        `;
        document.body.appendChild(this.popup);
    }

    createToggleButton() {
        // 기존 토글 제거
        try {
            const existToggle = document.querySelector('.translator-toggle');
            if (existToggle && existToggle.parentNode) existToggle.parentNode.removeChild(existToggle);
        } catch (e) {}
        const button = document.createElement('div');
        button.className = 'translator-toggle';
        button.innerHTML = '🌍';
        button.title = '번역기 켜기/끄기 (현재: ' + (this.isEnabled ? '켜짐' : '꺼짐') + ')';
        button.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            width: 50px !important;
            height: 50px !important;
            background: ${this.isEnabled ? '#4f46e5' : '#6b7280'} !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            z-index: 2147483646 !important;
            font-size: 20px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            transition: all 0.3s ease !important;
            user-select: none !important;
        `;

        button.addEventListener('click', () => {
            this.toggleTranslator(button);
        });

        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });

        document.body.appendChild(button);
    }

    createSettingsButton() {
        // 기존 설정 버튼 제거
        try {
            const existSettings = document.querySelector('.translator-settings');
            if (existSettings && existSettings.parentNode) existSettings.parentNode.removeChild(existSettings);
        } catch (e) {}
        const settingsButton = document.createElement('div');
        settingsButton.className = 'translator-settings';
        settingsButton.innerHTML = '⚙️';
        settingsButton.title = 'API 키 설정';
        settingsButton.style.cssText = `
            position: fixed !important;
            top: 80px !important;
            right: 20px !important;
            width: 40px !important;
            height: 40px !important;
            background: #6b7280 !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            z-index: 2147483645 !important;
            font-size: 16px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
            transition: all 0.3s ease !important;
            user-select: none !important;
            opacity: 0.7 !important;
        `;

        settingsButton.addEventListener('click', () => {
            this.showApiKeyModal();
        });

        settingsButton.addEventListener('mouseenter', () => {
            settingsButton.style.transform = 'scale(1.1)';
            settingsButton.style.opacity = '1';
        });

        settingsButton.addEventListener('mouseleave', () => {
            settingsButton.style.transform = 'scale(1)';
            settingsButton.style.opacity = '0.7';
        });

        document.body.appendChild(settingsButton);
    }

    createOpenPopupButton() {
        // 기존 버튼 제거
        try {
            const exist = document.querySelector('.translator-open-popup');
            if (exist && exist.parentNode) exist.parentNode.removeChild(exist);
        } catch (e) {}

        const btn = document.createElement('div');
        btn.className = 'translator-open-popup';
        btn.innerHTML = '🔗';
        btn.title = '팝업 사이트 열기 (확장 ID 입력)';
        btn.style.cssText = `
            position: fixed !important;
            top: 130px !important;
            right: 20px !important;
            width: 40px !important;
            height: 40px !important;
            background: #10b981 !important;
            color: #fff !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            z-index: 2147483645 !important;
            font-size: 16px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
            transition: all 0.3s ease !important;
            user-select: none !important;
            opacity: 0.9 !important;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.opacity = '1';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.9';
        });
        btn.addEventListener('click', async () => {
            // 백그라운드에서 안전하게 팝업 페이지 열기
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    await new Promise((resolve) => chrome.runtime.sendMessage({ type: 'openPopupPage' }, resolve));
                    return;
                }
            } catch (e) {}
            // 폴백: 현재 확장 ID로 직접 열기
            try {
                const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
                    ? chrome.runtime.getURL('popup.html')
                    : 'popup.html';
                window.open(url, '_blank');
            } catch (e) {}
        });

        document.body.appendChild(btn);
    }

    async getStoredExtId() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                return new Promise((resolve) => {
                    chrome.storage.sync.get(['extId'], (result) => resolve(result && result.extId ? result.extId : ''));
                });
            }
        } catch (e) {}
        try { return localStorage.getItem('extId') || ''; } catch (e) { return ''; }
    }

    async setStoredExtId(value) {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                return new Promise((resolve) => chrome.storage.sync.set({ extId: value || '' }, resolve));
            }
        } catch (e) {}
        try { localStorage.setItem('extId', value || ''); } catch (e) {}
    }

    async getCurrentApiKey() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                return new Promise((resolve) => {
                    chrome.storage.sync.get(['googleTranslateApiKey'], (result) => {
                        resolve(result.googleTranslateApiKey || '');
                    });
                });
            }
        } catch (error) {
            console.log('Chrome storage not available');
        }
        return localStorage.getItem('googleTranslateApiKey') || '';
    }

    async getShowIndicator() {
        // 기본값: true
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                return new Promise((resolve) => {
                    chrome.storage.sync.get(['showSelectionIndicator'], (result) => {
                        if (Object.prototype.hasOwnProperty.call(result || {}, 'showSelectionIndicator')) {
                            resolve(!!result.showSelectionIndicator);
                        } else {
                            resolve(true);
                        }
                    });
                });
            }
        } catch (e) {}
        try {
            const v = localStorage.getItem('showSelectionIndicator');
            if (v === null) return true;
            return v === '1' || v === 'true';
        } catch (e) {
            return true;
        }
    }

    async showApiKeyModal() {
        // 기존 모달이 있으면 제거
        const existingModal = document.querySelector('.translator-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'translator-modal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0,0,0,0.5) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 2147483648 !important;
            backdrop-filter: blur(4px) !important;
        `;

        const currentApiKey = await this.getCurrentApiKey();
        const currentShowIndicator = await this.getShowIndicator();

        modal.innerHTML = `
            <div style="
                background: white !important;
                padding: 30px !important;
                border-radius: 16px !important;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
                max-width: 500px !important;
                width: 90% !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            ">
                <h3 style="
                    margin: 0 0 20px 0 !important;
                    color: #333 !important;
                    font-size: 24px !important;
                    text-align: center !important;
                ">🔑 Google Translate API 설정</h3>
                
                <div style="
                    background: #f0f9ff !important;
                    padding: 16px !important;
                    border-radius: 8px !important;
                    margin-bottom: 20px !important;
                    border-left: 4px solid #3b82f6 !important;
                ">
                    <p style="
                        margin: 0 0 8px 0 !important;
                        color: #1e40af !important;
                        font-weight: 600 !important;
                        font-size: 14px !important;
                    ">💡 API 키가 없어도 사용 가능합니다!</p>
                    <p style="
                        margin: 0 !important;
                        color: #1e40af !important;
                        font-size: 13px !important;
                        line-height: 1.4 !important;
                    ">API 키 없이도 기본 사전으로 번역됩니다. 더 정확한 번역을 원하시면 Google API 키를 입력하세요.</p>
                </div>

                <label style="
                    display: block !important;
                    margin-bottom: 8px !important;
                    color: #374151 !important;
                    font-weight: 600 !important;
                    font-size: 14px !important;
                ">API 키 (선택사항):</label>
                
                <input 
                    type="password" 
                    id="apiKeyInput" 
                    placeholder="AIzaSy... (비워두면 기본 사전 사용)"
                    value="${currentApiKey}"
                    style="
                        width: 100% !important;
                        padding: 12px !important;
                        border: 2px solid #e5e7eb !important;
                        border-radius: 8px !important;
                        font-size: 14px !important;
                        margin-bottom: 20px !important;
                        box-sizing: border-box !important;
                        font-family: monospace !important;
                    "
                />

                <div style="
                    background: #fffbeb !important;
                    padding: 12px !important;
                    border-radius: 8px !important;
                    margin-bottom: 20px !important;
                    border-left: 4px solid #f59e0b !important;
                ">
                    <p style="
                        margin: 0 !important;
                        color: #92400e !important;
                        font-size: 12px !important;
                        line-height: 1.4 !important;
                    ">📋 API 키 발급: Google Cloud Console > Translate API > 사용자 인증 정보<br>
                    💰 요금: 월 50만 글자까지 무료</p>
                </div>

                <div style="
                    background: #ecfeff !important;
                    padding: 14px !important;
                    border-radius: 8px !important;
                    margin-bottom: 20px !important;
                    border-left: 4px solid #06b6d4 !important;
                    color: #0e7490 !important;
                    font-size: 13px !important;
                ">
                    <label for="indicatorToggle" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                        <input id="indicatorToggle" type="checkbox" ${currentShowIndicator ? 'checked' : ''} />
                        드래그 시 'C' 인디케이터 표시
                    </label>
                </div>

                <div style="
                    display: flex !important;
                    gap: 12px !important;
                    justify-content: flex-end !important;
                ">
                    <button id="cancelBtn" style="
                        padding: 10px 20px !important;
                        border: 2px solid #d1d5db !important;
                        background: white !important;
                        border-radius: 8px !important;
                        cursor: pointer !important;
                        font-size: 14px !important;
                        color: #374151 !important;
                        transition: all 0.2s ease !important;
                    ">취소</button>
                    
                    <button id="saveBtn" style="
                        padding: 10px 20px !important;
                        border: none !important;
                        background: linear-gradient(135deg, #4f46e5, #7c3aed) !important;
                        color: white !important;
                        border-radius: 8px !important;
                        cursor: pointer !important;
                        font-size: 14px !important;
                        font-weight: 600 !important;
                        transition: all 0.2s ease !important;
                    ">저장</button>
                </div>
            </div>
        `;

        // 이벤트 리스너
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        modal.querySelector('#cancelBtn').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#saveBtn').addEventListener('click', async () => {
            const apiKey = modal.querySelector('#apiKeyInput').value.trim();
            const showIndicator = !!modal.querySelector('#indicatorToggle').checked;
            
            try {
                // Chrome storage 사용 시도
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    chrome.storage.sync.set({ googleTranslateApiKey: apiKey, showSelectionIndicator: showIndicator }, () => {
                        this.indicatorEnabled = showIndicator;
                        this.showStatusMessage('설정이 저장되었습니다');
                    });
                } else {
                    // localStorage 폴백
                    localStorage.setItem('googleTranslateApiKey', apiKey);
                    try { localStorage.setItem('showSelectionIndicator', showIndicator ? '1' : '0'); } catch (e) {}
                    this.indicatorEnabled = showIndicator;
                    this.showStatusMessage('설정이 저장되었습니다');
                }
            } catch (error) {
                console.error('저장 오류:', error);
                // localStorage로 폴백
                localStorage.setItem('googleTranslateApiKey', apiKey);
                try { localStorage.setItem('showSelectionIndicator', showIndicator ? '1' : '0'); } catch (e) {}
                this.indicatorEnabled = showIndicator;
                this.showStatusMessage('설정이 저장되었습니다');
            }
            
            modal.remove();
        });

        // ESC 키로 모달 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        document.body.appendChild(modal);

        // 입력 필드에 포커스
        setTimeout(() => {
            modal.querySelector('#apiKeyInput').focus();
        }, 100);
    }

    toggleTranslator(button) {
        this.isEnabled = !this.isEnabled;
        button.style.background = this.isEnabled ? '#4f46e5' : '#6b7280';
        button.title = '번역기 켜기/끄기 (현재: ' + (this.isEnabled ? '켜짐' : '꺼짐') + ')';
        
        if (!this.isEnabled) {
            this.hidePopup();
        }

        // 상태 변경 알림
        this.showStatusMessage(this.isEnabled ? '번역기 켜짐' : '번역기 꺼짐');
    }

    showStatusMessage(message) {
        const statusDiv = document.createElement('div');
        statusDiv.textContent = message;
        statusDiv.style.cssText = `
            position: fixed !important;
            top: 80px !important;
            right: 20px !important;
            background: #4f46e5 !important;
            color: white !important;
            padding: 8px 16px !important;
            border-radius: 20px !important;
            font-size: 14px !important;
            z-index: 2147483646 !important;
            transition: all 0.3s ease !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        `;
        
        document.body.appendChild(statusDiv);
        
        setTimeout(() => {
            statusDiv.style.opacity = '0';
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.parentNode.removeChild(statusDiv);
                }
            }, 300);
        }, 2000);
    }

    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true' ||
            activeElement.isContentEditable
        );
    }

    handleTextSelection() {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text && text.length > 0 && text.length <= 200) { // 200자 제한
            this.selectedText = text;
            if (this.indicatorEnabled) {
                this.showSelectionIndicator();
            }
        } else {
            this.selectedText = '';
        }
    }

    showSelectionIndicator() {
        // 기존 표시기 제거
        const existing = document.querySelector('.translator-indicator');
        if (existing) {
            existing.remove();
        }

        const indicator = document.createElement('div');
        indicator.className = 'translator-indicator';
        indicator.textContent = 'C';
        indicator.style.cssText = `
            position: fixed !important;
            top: ${Math.max(10, this.mouseY - 35)}px !important;
            left: ${Math.min(window.innerWidth - 30, this.mouseX + 15)}px !important;
            background: #4f46e5 !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 2147483647 !important;
            pointer-events: none !important;
            opacity: 0.9 !important;
            font-family: monospace !important;
            animation: translator-pulse 1.5s ease-in-out infinite !important;
        `;
        
        // 펄스 애니메이션 추가
        if (!document.getElementById('translator-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'translator-pulse-style';
            style.textContent = `
                @keyframes translator-pulse {
                    0%, 100% { opacity: 0.6; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(indicator);
        
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    if (indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                }, 300);
            }
        }, 2000);
    }

    hideSelectionIndicator() {
        try {
            const existing = document.querySelector('.translator-indicator');
            if (existing && existing.parentNode) {
                existing.parentNode.removeChild(existing);
            }
        } catch (e) {}
    }

    async translateSelectedText() {
        if (!this.selectedText || this.isLoading) return;

        // 안전 장치: 번역 시작 시에도 인디케이터 제거
        this.hideSelectionIndicator();

        this.isLoading = true;
        this.showLoadingPopup();

        try {
            const translation = await this.getTranslation(this.selectedText);
            this.showTranslation(translation);
            // 번역 성공 시 단어장에 저장
            try {
                await this.saveVocabularyEntry(this.selectedText, translation);
            } catch (e) {
                console.warn('Save vocab failed:', e);
            }
        } catch (error) {
            console.error('Translation error:', error);
            this.showTranslation('번역 중 오류가 발생했습니다');
        } finally {
            this.isLoading = false;
        }
    }

    showLoadingPopup() {
        this.popup.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: translator-spin 1s linear infinite; margin-right: 8px;"></div>
                번역 중...
            </div>
        `;

        this.showPopup();
    }

    async getTranslation(text) {
        // Google Translate API 키 설정 (사용자가 설정해야 함)
        const API_KEY = await this.getApiKey();
        
        if (!API_KEY) {
            return await this.getFallbackTranslation(text);
        }

        try {
            // Google Translate API 호출
            const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    source: 'en',  // 영어에서
                    target: 'ko',  // 한국어로
                    format: 'text'
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.data && data.data.translations && data.data.translations[0]) {
                return data.data.translations[0].translatedText;
            } else {
                throw new Error('Invalid API response');
            }

        } catch (error) {
            console.error('Google Translate API Error:', error);
            // API 오류 시 폴백 사전 사용
            return await this.getFallbackTranslation(text);
        }
    }

    async getApiKey() {
        // Chrome extension에서 저장된 API 키 가져오기
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                return new Promise((resolve) => {
                    chrome.storage.sync.get(['googleTranslateApiKey'], (result) => {
                        resolve(result.googleTranslateApiKey || '');
                    });
                });
            }
        } catch (error) {
            console.log('Chrome storage not available, using localStorage');
        }
        
        // 폴백: localStorage 사용
        return localStorage.getItem('googleTranslateApiKey') || '';
    }

    async getFallbackTranslation(text) {
        // API가 없거나 오류가 있을 때 사용할 기본 사전
        const dictionary = {
            // 자주 사용되는 기본 단어들
            'the': '그', 'and': '그리고', 'or': '또는', 'but': '하지만',
            'in': '~에', 'on': '~위에', 'at': '~에서', 'to': '~에게',
            'for': '~를 위해', 'of': '~의', 'with': '~와 함께', 'by': '~에 의해',
            
            // 기술 관련 핵심 단어
            'artificial': '인공의', 'intelligence': '지능', 'machine': '기계',
            'learning': '학습', 'algorithm': '알고리즘', 'data': '데이터',
            'technology': '기술', 'computer': '컴퓨터', 'software': '소프트웨어',
            'application': '애플리케이션', 'website': '웹사이트', 'internet': '인터넷',
            'network': '네트워크', 'system': '시스템', 'programming': '프로그래밍',
            'development': '개발', 'innovation': '혁신', 'research': '연구',
            
            // 일반 단어
            'information': '정보', 'important': '중요한', 'different': '다른',
            'example': '예시', 'question': '질문', 'answer': '답변',
            'problem': '문제', 'solution': '해결책', 'person': '사람',
            'people': '사람들', 'time': '시간', 'work': '일하다',
            'make': '만들다', 'use': '사용하다', 'get': '얻다', 'know': '알다',
            'good': '좋은', 'new': '새로운', 'first': '첫 번째', 'great': '훌륭한',
            
            // 비즈니스
            'business': '사업', 'company': '회사', 'service': '서비스',
            'product': '제품', 'market': '시장', 'customer': '고객',
            'user': '사용자', 'management': '관리'
        };

        await new Promise(resolve => setTimeout(resolve, 300));

        const lowerText = text.toLowerCase().trim();
        
        // 정확한 단어 매치
        if (dictionary[lowerText]) {
            return dictionary[lowerText];
        }

        // 복수형 처리
        if (lowerText.endsWith('s') && dictionary[lowerText.slice(0, -1)]) {
            return dictionary[lowerText.slice(0, -1)] + '들';
        }

        // ing 형태 처리
        if (lowerText.endsWith('ing')) {
            const base = lowerText.slice(0, -3);
            if (dictionary[base]) {
                return dictionary[base] + '하는';
            }
        }

        // 문장인 경우 단어별로 번역 시도
        if (text.includes(' ')) {
            const words = text.split(' ');
            const translatedWords = words.map(word => {
                const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
                return dictionary[cleanWord] || word;
            });
            return translatedWords.join(' ');
        }

        // 사전에 없는 경우
        return `"${text}" (번역 필요)`;
    }

    showTranslation(translation) {
        this.popup.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 2px;">
                ${this.selectedText}
            </div>
            <div style="font-size: 12px; opacity: 0.8; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px; margin-top: 6px;">
                ${translation}
            </div>
        `;
        
        this.showPopup();

        // 6초 후 자동 숨기기
        setTimeout(() => {
            this.hidePopup();
        }, 6000);
    }

    showPopup() {
        // 팝업 위치 계산 (더 정확한 위치 계산)
        const popupWidth = 300;
        const popupHeight = 80;
        
        let x = this.mouseX - popupWidth / 2;
        let y = this.mouseY - popupHeight - 15;

        // 화면 경계 체크
        if (x < 10) x = 10;
        if (x + popupWidth > window.innerWidth - 10) {
            x = window.innerWidth - popupWidth - 10;
        }
        if (y < 10) {
            y = this.mouseY + 15;
        }

        this.popup.style.left = `${x}px`;
        this.popup.style.top = `${y}px`;
        // 강제 표시: !important로 오버라이드
        this.popup.style.setProperty('opacity', '1', 'important');
        this.popup.style.setProperty('transform', 'scale(1) translateY(0)', 'important');
        this.popup.style.setProperty('pointer-events', 'auto', 'important');
        this.popup.style.setProperty('display', 'block', 'important');
        this.popup.style.setProperty('visibility', 'visible', 'important');

        // 실제 크기를 측정해 "드래그한 선택 영역" 바로 위에 정확히 배치 (경계 보정 포함)
        requestAnimationFrame(() => {
            try {
                // 측정을 위해 일시적으로 표시 상태 보장
                this.popup.style.setProperty('display', 'block', 'important');
                this.popup.style.setProperty('visibility', 'hidden', 'important');
                this.popup.style.setProperty('opacity', '0', 'important');

                const popupRect = this.popup.getBoundingClientRect();
                const popupWidth = Math.max(10, popupRect.width || 300);
                const popupHeight = Math.max(10, popupRect.height || 80);
                const margin = 12;

                // 선택 영역의 바운딩 박스를 기준으로 배치
                let anchorRect = null;
                try {
                    const sel = window.getSelection && window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        const r = range.getBoundingClientRect();
                        if (r && (r.width > 0 || r.height > 0)) {
                            anchorRect = r;
                        } else {
                            const rects = range.getClientRects();
                            if (rects && rects.length > 0) anchorRect = rects[0];
                        }
                    }
                } catch (e) {}

                // 기본 위치: 선택 영역 중심 상단, 없으면 마우스 기준
                let x, y;
                if (anchorRect) {
                    x = (anchorRect.left + anchorRect.right) / 2 - popupWidth / 2;
                    y = anchorRect.top - popupHeight - margin;
                } else {
                    x = this.mouseX - popupWidth / 2;
                    y = this.mouseY - popupHeight - margin;
                }

                // 경계 보정
                if (x < 10) x = 10;
                if (x + popupWidth > window.innerWidth - 10) x = window.innerWidth - popupWidth - 10;
                if (y < 10) {
                    // 위에 공간이 없으면 기준의 아래쪽으로
                    if (anchorRect) {
                        y = anchorRect.bottom + margin;
                    } else {
                        y = this.mouseY + margin;
                    }
                }

                this.popup.style.setProperty('left', `${x}px`, 'important');
                this.popup.style.setProperty('top', `${y}px`, 'important');
                this.popup.style.setProperty('visibility', 'visible', 'important');
                this.popup.style.setProperty('opacity', '1', 'important');
                this.popup.style.setProperty('transform', 'scale(1) translateY(0)', 'important');
                this.popup.style.setProperty('pointer-events', 'auto', 'important');
                this.popup.style.setProperty('z-index', '2147483647', 'important');
            } catch (e) {}
        });
    }

    hidePopup() {
        // 강제 숨김: !important로 오버라이드
        this.popup.style.setProperty('opacity', '0', 'important');
        this.popup.style.setProperty('transform', 'scale(0.8) translateY(10px)', 'important');
        this.popup.style.setProperty('pointer-events', 'none', 'important');
        this.popup.style.setProperty('visibility', 'hidden', 'important');
    }
}

// 번역 유효성 검사: 제대로 번역된 경우만 저장
UniversalTranslator.prototype.isValidTranslation = function(sourceText, translatedText) {
    try {
        const s = String(sourceText || '').trim();
        const t = String(translatedText || '').trim();
        if (!s || !t) return false;
        if (t.includes('(번역 필요)')) return false;
        const normalizedSource = s.toLowerCase();
        const normalizedTranslated = t.toLowerCase().replace(/^"|"$/g, '');
        if (normalizedSource === normalizedTranslated) return false;
        return true;
    } catch (_) {
        return false;
    }
};

// 단어장 저장 메서드
UniversalTranslator.prototype.saveVocabularyEntry = async function(sourceText, translatedText) {
    // 유효하지 않은 번역은 저장하지 않음
    if (!this.isValidTranslation(sourceText, translatedText)) {
        return;
    }

    // 문장 중복 방지를 위한 정규화 함수 (공백 압축, 소문자, 제로폭 제거)
    const normalizeForDup = (s) => String(s||'')
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const normSrc = normalizeForDup(sourceText);
    const normDst = normalizeForDup(translatedText);

    // 날짜 키를 팝업과 동일한 방식으로 계산(로컬 날짜 기준, TZ 보정)
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const dateKey = localDate.toISOString().slice(0, 10); // YYYY-MM-DD

    // 고정 ID(시간/URL 미사용): 날짜+원문+번역 기반
    const makeIdSafe = (s) => encodeURIComponent(String(s||'').trim()).slice(0,256);
    const id = `${dateKey}-${makeIdSafe(sourceText)}-${makeIdSafe(translatedText)}`;

    const entry = {
        id,
        sourceText,
        translatedText
    };

    const readFromChrome = () => new Promise((resolve) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get(['vocabByDate'], (result) => {
                    resolve(result && result.vocabByDate ? result.vocabByDate : {});
                });
            } else {
                resolve(null);
            }
        } catch (e) {
            resolve(null);
        }
    });

    const writeToChrome = (data) => new Promise((resolve) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ vocabByDate: data }, () => resolve(true));
            } else {
                resolve(false);
            }
        } catch (e) {
            resolve(false);
        }
    });

    let store = await readFromChrome();
    if (!store) {
        try {
            const raw = localStorage.getItem('vocabByDate');
            store = raw ? JSON.parse(raw) : {};
        } catch (e) {
            store = {};
        }
    }

    // 모든 항목(단어/문장)에서 날짜와 무관하게 동일 원문+번역이 이미 있으면 저장하지 않음 (chrome.storage + IDB 전체 확인)
    let foundDup = false;
    try {
        const dates = Object.keys(store || {});
        for (const dk of dates) {
            const arr = Array.isArray(store[dk]) ? store[dk] : [];
            const dup = arr.some(it => (
                normalizeForDup(it && it.sourceText) === normSrc &&
                normalizeForDup(it && it.translatedText) === normDst
            ));
            if (dup) { foundDup = true; break; }
        }
    } catch (_) {}
    if (!foundDup) {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                const resp = await new Promise((resolve) => chrome.runtime.sendMessage({ type: 'idbHasDuplicate', sourceText, translatedText }, resolve));
                if (resp && resp.ok && resp.dup) {
                    return; // IDB에서 전역 중복 발견
                }
            }
        } catch (_) {}
    } else {
        return; // chrome.storage에 전역 중복 발견
    }

    if (!store[dateKey]) store[dateKey] = [];
    // 동일한 ID가 이미 있으면 저장 생략
    const alreadyExists = store[dateKey].some(i => (i.id || '') === id);
    if (alreadyExists) {
        return;
    }
    // 같은 원문이 있으면 최신 번역으로 교체
    store[dateKey] = store[dateKey].filter(i => i.sourceText !== sourceText);
    store[dateKey].push(entry);

    const wrote = await writeToChrome(store);
    if (!wrote) {
        try { localStorage.setItem('vocabByDate', JSON.stringify(store)); } catch (e) {}
    }
    // 저장 알림을 팝업에 전달 (비동기 갱신 유도)
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'vocabUpdated', dateKey });
        }
    } catch (e) {}

    // IndexedDB(배경)에도 저장 (이중 저장)
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                type: 'idbAddVocab',
                id,
                dateKey,
                sourceText,
                translatedText
            }, () => {});
        }
    } catch (e) {}
};

// 확장 프로그램이 로드되면 번역기 초기화 (전역 단일 주입 보장)
function bootTranslatorOnce() {
    // 하위 프레임(iframe)에서는 실행하지 않음
    try {
        if (window.self !== window.top) return;
    } catch (e) {
        return;
    }
    // 이미 주입되었으면 재주입 금지
    if (window.__translatorInjected) return;
    window.__translatorInjected = true;
    new UniversalTranslator();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootTranslatorOnce);
} else {
    bootTranslatorOnce();
}