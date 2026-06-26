/* story.js - 버그 수정판 (로그 창 표시 문제 및 스킵 차단 해결) */

const StoryEngine = {
    script: [], index: 0, isTyping: false, timer: null, fullText: "", callback: null, chars: {},
    lastDialog: null, lastDialogIndex: -1,
    sceneState: { bgSrc: "", chars: {} },
    choiceDebugCount: 0,
    
    // [기능 변수]
    logData: [], isSkipping: false, skipSpeed: 50, // 속도: 0.05초
    isAuto: false, autoDelay: 900, isUiHidden: false,

    start: function(scriptData, onComplete, startIndex = 0) {
        if (typeof game !== 'undefined' && game && game.storyMode === false) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }
        this.script = scriptData;
        // [이름표 점프] { type:"label", name:"xxx" } 위치를 미리 기록해 둔다.
        // goto:"xxx" 로 줄 번호 대신 이름으로 점프할 수 있게 한다.
        this.labels = {};
        if (Array.isArray(scriptData)) {
            scriptData.forEach((c, i) => {
                if (c && c.type === 'label' && c.name) this.labels[c.name] = i;
            });
        }
        this.index = Math.max(0, startIndex | 0);
        this.currentLocation = "";   // 장소 배너 표시용(배경 loc 변화 추적)
        this.cgWaiting = false;
        this.hideCg();               // 이전 컷신의 CG 잔재 정리
        this.callback = onComplete;
        this.chars = {};
        this.sceneState = { bgSrc: "", chars: {} };
        if (!game.storyState || game.storyState.index !== startIndex || !Array.isArray(game.storyState.logData)) {
            this.logData = [];
        } else {
            this.logData = game.storyState.logData.slice();
        }
        if (game.storyState && game.storyState.lastDialog) {
            this.lastDialog = { ...game.storyState.lastDialog };
            this.lastDialogIndex = game.storyState.lastDialogIndex ?? -1;
        } else {
            this.lastDialog = null;
            this.lastDialogIndex = -1;
        }
        if (game.storyState && game.storyState.sceneState) {
            this.sceneState = {
                bgSrc: game.storyState.sceneState.bgSrc || "",
                chars: { ...(game.storyState.sceneState.chars || {}) }
            };
        }
        this.isSkipping = false;
        this.isAuto = false;
        this.isUiHidden = false;
        
        // 기존 UI 초기화
        const standing = document.getElementById("story-standing");
        if (standing) standing.innerHTML = "";
        const overlay = this.ensureChoiceOverlay();
        if (overlay) overlay.style.display = "none";
        const storyScene = document.getElementById("story-scene");
        if (storyScene) {
            storyScene.classList.remove('ui-hidden');
            storyScene.onclick = null;
        }

        // 저장된 씬 상태 복원 (배경/스탠딩)
        if (this.sceneState && (this.sceneState.bgSrc || Object.keys(this.sceneState.chars || {}).length > 0)) {
            const bgEl = document.getElementById("story-bg");
            if (bgEl && this.sceneState.bgSrc) bgEl.style.backgroundImage = `url('${this.sceneState.bgSrc}')`;
            const savedChars = this.sceneState.chars || {};
            Object.keys(savedChars).forEach((id) => {
                const info = savedChars[id];
                if (info && info.src && info.pos) {
                    this.showCharacter(id, info.src, info.pos);
                }
            });
        }

        // [핵심] 기능 UI 생성
        this.initControlUI();

        // 화면 전환
        if (typeof switchScene === 'function') switchScene('story');
        this.playNext();
    },

    playNext: function() {
        if (this.index >= this.script.length) { this.end(); return; }
        let cmd = this.script[this.index];

        if (cmd.type === "bg") {
            const bgEl = document.getElementById("story-bg");
            if (bgEl) bgEl.style.backgroundImage = `url('${cmd.src}')`;
            this.sceneState.bgSrc = cmd.src || "";
            // 배경에 장소명(loc)이 지정돼 있고, 직전 장소와 다르면 장소 배너를 한 번 띄운다.
            if (cmd.loc && cmd.loc !== this.currentLocation) {
                this.currentLocation = cmd.loc;
                this.showLocationBanner(cmd.loc);
            }
            this.index++; this.playNext();
        }
        else if (cmd.type === "cg") {
            // 풀 일러스트. src가 있으면 CG를 띄우고 대사창을 숨긴 채 '클릭 대기'(다른 게임의 CG 연출).
            // 한 번 클릭하면 대사창이 나타나며 다음 줄로 진행한다. src가 비면("") CG를 치운다.
            if (cmd.src) {
                this.showCg(cmd.src);
                this.index++;
                this.cgWaiting = true;
                if (this.isSkipping) { this.revealCgDialog(); this.playNext(); }
                else if (this.isAuto) { setTimeout(() => { if (this.cgWaiting && this.isAuto) { this.revealCgDialog(); this.playNext(); } }, this.autoDelay); }
                // 그 외엔 클릭(nextDialog)을 기다린다.
            } else {
                this.hideCg();
                this.index++; this.playNext();
            }
        }
        else if (cmd.type === "char") {
            this.showCharacter(cmd.id, cmd.src, cmd.pos);
            this.index++; this.playNext();
        }
        else if (cmd.type === "exit") {
            if (this.chars[cmd.id]) { this.chars[cmd.id].remove(); delete this.chars[cmd.id]; }
            if (cmd.id && this.sceneState.chars[cmd.id]) delete this.sceneState.chars[cmd.id];
            this.index++; this.playNext();
        }
        else if (cmd.type === "talk") {
            this.addLog(cmd.name, cmd.text);
            this.showDialog(cmd.id, cmd.name, cmd.text);
            this.index++;
            this.saveProgress();
        }
        else if (cmd.type === "choice") {
            if (this.isSkipping) this.toggleSkip(); // 선택지에서 스킵 멈춤
            if (this.isAuto) this.toggleAuto(); // 선택지에서는 오토 정지
            this.showChoices(cmd.options);
        }
        else if (cmd.type === "label") {
            // 이름표는 점프 목적지 표시일 뿐, 그냥 다음 줄로 넘어간다.
            this.index++; this.playNext();
        }
        else if (cmd.type === "jump") {
            const target = this.resolveIndex(cmd);
            this.index = (target >= 0) ? target : (this.index + 1);
            this.playNext();
        }
        else if (cmd.type === "end") {
            this.end();
        }
    },

    // 점프 목적지 계산: goto("이름표") 우선, 없으면 next(줄 번호) 사용.
    // 둘 다 못 찾으면 -1 을 돌려준다(호출한 쪽에서 안전하게 처리).
    resolveIndex: function(target) {
        if (target && target.goto != null) {
            if (this.labels && Object.prototype.hasOwnProperty.call(this.labels, target.goto)) {
                return this.labels[target.goto];
            }
            console.warn("[StoryEngine] goto 이름표를 찾을 수 없습니다:", target.goto);
            return -1;
        }
        const n = Number(target && target.next);
        return Number.isFinite(n) ? n : -1;
    },

    // 장소 배너: 컷신 중 배경(loc)이 바뀔 때 화면 상단에 장소명을 잠깐 띄운다.
    showLocationBanner: function(name) {
        if (!name) return;
        let el = document.getElementById("story-location-banner");
        if (!el) {
            el = document.createElement("div");
            el.id = "story-location-banner";
            // 네모/배경 없이 왼쪽 상단에 글자만. 어떤 배경에서도 읽히도록 그림자만 준다.
            el.style.cssText = "position:fixed; top:16px; left:20px; z-index:21000; color:#fff; font-size:1.05em; letter-spacing:1px; pointer-events:none; opacity:0; transition:opacity 0.4s ease; white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.7);";
            document.body.appendChild(el);
        }
        el.textContent = name;
        void el.offsetWidth;          // 리플로우 강제 → 트랜지션 적용
        el.style.opacity = "1";
        if (this._locBannerTimer) clearTimeout(this._locBannerTimer);
        this._locBannerTimer = setTimeout(() => { el.style.opacity = "0"; }, 2200);
    },

    hideLocationBanner: function() {
        if (this._locBannerTimer) { clearTimeout(this._locBannerTimer); this._locBannerTimer = null; }
        const el = document.getElementById("story-location-banner");
        if (el) el.remove();
    },

    // [CG] 풀 일러스트 레이어. 입상 위·대사창 앞(DOM상 대사창 직전)에 끼워, 대사창을 끄면 CG만,
    // 켜면 CG 위에 대사창이 보이도록 한다.
    ensureCgLayer: function() {
        let el = document.getElementById("story-cg");
        if (!el) {
            el = document.createElement("div");
            el.id = "story-cg";
            el.style.cssText = "position:absolute; inset:0; width:100%; height:100%; background-size:contain; background-position:center; background-repeat:no-repeat; background-color:#000; display:none; cursor:pointer;";
            el.onclick = function () { nextDialog(); };
            const scene = document.getElementById("story-scene");
            const box = scene ? scene.querySelector(".dialog-container") : null;
            if (scene) { box ? scene.insertBefore(el, box) : scene.appendChild(el); }
        }
        return el;
    },
    getDialogBox: function() { return document.querySelector("#story-scene .dialog-container"); },
    showCg: function(src) {
        const el = this.ensureCgLayer();
        el.style.backgroundImage = `url('${src}')`;
        el.style.display = "block";
        const box = this.getDialogBox();
        if (box) box.style.display = "none";   // 대사창 숨김
        this.cgVisible = true;
    },
    revealCgDialog: function() {              // CG는 유지한 채 대사창만 다시 표시
        const box = this.getDialogBox();
        if (box) box.style.display = "";
        this.cgWaiting = false;
    },
    hideCg: function() {
        const el = document.getElementById("story-cg");
        if (el) el.style.display = "none";
        const box = this.getDialogBox();
        if (box) box.style.display = "";
        this.cgVisible = false;
        this.cgWaiting = false;
    },

    showCharacter: function(id, src, pos) {
        if (this.chars[id]) return;
        let img = document.createElement("img");
        img.src = src; img.className = `story-char pos-${pos}`;
        document.getElementById("story-standing").appendChild(img);
        this.chars[id] = img;
        if (id) this.sceneState.chars[id] = { src, pos };
    },

    showDialog: function(id, name, text) {
        let nameTag = document.getElementById("story-name");
        if (name) { nameTag.innerText = name; nameTag.style.display = "block"; } 
        else { nameTag.style.display = "none"; }

        for (let key in this.chars) this.chars[key].classList.remove("speaking");
        if (id && this.chars[id]) this.chars[id].classList.add("speaking");

        const textBox = document.getElementById("story-text");
        textBox.innerHTML = "";
        this.fullText = text;
        this.isTyping = true;

        this.lastDialog = { id, name, text };
        this.lastDialogIndex = this.index;
        
        if (this.timer) clearInterval(this.timer);

        if (this.isSkipping) {
            textBox.innerHTML = text;
            this.finishTyping();
            return;
        }

        let i = 0;
        this.timer = setInterval(() => {
            textBox.innerHTML += text.charAt(i); i++;
            if (i >= text.length) this.finishTyping();
        }, 30);
    },

    finishTyping: function() {
        clearInterval(this.timer);
        document.getElementById("story-text").innerHTML = this.fullText;
        this.isTyping = false;
        if (this.isSkipping) {
            setTimeout(() => { if (this.isSkipping) nextDialog(); }, this.skipSpeed);
        }
        if (this.isAuto) {
            setTimeout(() => { if (this.isAuto) nextDialog(); }, this.autoDelay);
        }
    },

    renderDialogSnapshot: function() {
        if (!this.lastDialog) return;
        const { id, name, text } = this.lastDialog;
        let nameTag = document.getElementById("story-name");
        if (name) { nameTag.innerText = name; nameTag.style.display = "block"; }
        else { nameTag.style.display = "none"; }

        for (let key in this.chars) this.chars[key].classList.remove("speaking");
        if (id && this.chars[id]) this.chars[id].classList.add("speaking");

        const textBox = document.getElementById("story-text");
        textBox.innerHTML = text || "";
        this.fullText = text || "";
        this.isTyping = false;
    },

    showChoices: function(options) {
        if (this.isUiHidden) this.toggleUi();
        // 선택지 전에 마지막 대사를 화면에 복원 (새로고침 복구용)
        if (this.lastDialog && this.lastDialogIndex >= 0) {
            this.renderDialogSnapshot();
        }
        const overlay = this.ensureChoiceOverlay();
        overlay.innerHTML = "";
        overlay.style.display = "flex";
        overlay.style.pointerEvents = "auto";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.zIndex = "20000";
        overlay.style.background = "rgba(0, 0, 0, 0.05)";
        overlay.onclick = (e) => {
            e.stopPropagation();
            const btn = e.target.closest(".story-choice-btn");
            if (!btn) return;
            const next = Number(btn.dataset.next);
            if (Number.isFinite(next)) {
                this.selectChoice(next);
            }
        };
        const storyScene = document.getElementById("story-scene");
        if (storyScene) storyScene.style.pointerEvents = "none";
        options.forEach(opt => {
            let btn = document.createElement("button");
            btn.className = "story-choice-btn";
            btn.innerText = opt.txt;
            btn.type = "button";
            // goto("이름표") 또는 next(줄 번호)를 실제 목적지 줄 번호로 변환.
            const target = this.resolveIndex(opt);
            btn.dataset.next = String(target >= 0 ? target : (this.index + 1));
            btn.style.pointerEvents = "auto";
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const next = Number(btn.dataset.next);
                if (Number.isFinite(next)) this.selectChoice(next);
            }, true);
            overlay.appendChild(btn);
        });
    },

    end: function() {
        this.isSkipping = false;
        this.isAuto = false;
        
        // 생성했던 버튼과 로그창 제거 (스토리 끝나면 깔끔하게 정리)
        const uiControls = document.getElementById("story-ui-controls");
        if (uiControls) uiControls.remove();
        
        const logOverlay = document.getElementById("story-log-overlay");
        if (logOverlay) logOverlay.remove();

        this.hideLocationBanner();
        this.hideCg();

        if (game && game.storyState) {
            game.storyState = null;
            if (typeof autoSave === 'function') autoSave();
        }
        if (this.callback) this.callback();
        else if (typeof renderHub === 'function') renderHub();
    },

    addLog: function(name, text) {
        this.logData.push({ name: name || "", text: text });
        if (game && game.storyState) {
            game.storyState.logData = this.logData.slice();
        }
    },

    saveProgress: function() {
        if (!game) return;
        if (!game.storyState) return;
        game.storyState.index = this.index;
        game.storyState.logData = this.logData.slice();
        if (this.lastDialog) {
            game.storyState.lastDialog = { ...this.lastDialog };
            game.storyState.lastDialogIndex = this.lastDialogIndex;
        }
        if (this.sceneState) {
            game.storyState.sceneState = {
                bgSrc: this.sceneState.bgSrc || "",
                chars: { ...(this.sceneState.chars || {}) }
            };
        }
        if (typeof autoSave === 'function') autoSave();
    },

    toggleSkip: function() {
        this.isSkipping = !this.isSkipping;
        const btn = document.getElementById("btn-skip");
        if (this.isSkipping) {
            if (btn) { btn.innerText = getUIText("story.skipOn"); btn.classList.add("active"); }
            if (this.isAuto) this.toggleAuto();
            if (this.isTyping) this.finishTyping();
            else nextDialog();
        } else {
            if (btn) { btn.innerText = getUIText("story.skipButton"); btn.classList.remove("active"); }
        }
    },

    toggleAuto: function() {
        this.isAuto = !this.isAuto;
        const btn = document.getElementById("btn-auto");
        if (this.isAuto) {
            if (btn) { btn.innerText = getUIText("story.autoOn"); btn.classList.add("active"); }
            if (this.isTyping) this.finishTyping();
            else nextDialog();
        } else {
            if (btn) { btn.innerText = getUIText("story.autoButton"); btn.classList.remove("active"); }
        }
    },

    toggleUi: function() {
        this.isUiHidden = !this.isUiHidden;
        const dialog = document.querySelector('.dialog-container');
        const uiControls = document.getElementById('story-ui-controls');
        const choiceOverlay = document.getElementById('story-choice-overlay');
        const storyScene = document.getElementById('story-scene');
        if (dialog) dialog.style.display = this.isUiHidden ? 'none' : '';
        if (uiControls) uiControls.style.display = this.isUiHidden ? 'none' : '';
        if (choiceOverlay && choiceOverlay.style.display === "flex") {
            choiceOverlay.style.display = this.isUiHidden ? 'none' : 'flex';
        }
        if (storyScene) {
            if (this.isUiHidden) {
                storyScene.classList.add('ui-hidden');
                storyScene.onclick = (e) => { e.stopPropagation(); this.toggleUi(); };
            } else {
                storyScene.classList.remove('ui-hidden');
                storyScene.onclick = null;
            }
        }
    },

    toggleLog: function() {
        let logOverlay = document.getElementById("story-log-overlay");
        if (!logOverlay) return;
        
        // hidden 클래스가 혹시 남아있다면 제거
        logOverlay.classList.remove('hidden');

        if (logOverlay.style.display === "flex") {
            logOverlay.style.display = "none";
        } else {
            const logContent = document.getElementById("story-log-content");
            logContent.innerHTML = "";
            this.logData.forEach(log => {
                let p = document.createElement("p");
                p.innerHTML = log.name ? `<span class="log-name">[${log.name}]</span> ${log.text}` : `${log.text}`;
                logContent.appendChild(p);
            });
            logOverlay.style.display = "flex";
            logContent.scrollTop = logContent.scrollHeight;
        }
    },

    initControlUI: function() {
        if (typeof game !== 'undefined' && game && game.storyMode === false) {
            return;
        }
        // 기존 UI가 있다면 제거 후 재생성
        if (document.getElementById("story-ui-controls")) document.getElementById("story-ui-controls").remove();
        if (document.getElementById("story-log-overlay")) document.getElementById("story-log-overlay").remove();

        // 1. 버튼 컨테이너
        let uiContainer = document.createElement("div");
        uiContainer.id = "story-ui-controls";
        document.body.appendChild(uiContainer);

        let btnLog = document.createElement("button");
        btnLog.innerText = getUIText("story.logButton"); btnLog.className = "story-ui-btn";
        btnLog.onclick = (e) => { e.stopPropagation(); this.toggleLog(); };
        uiContainer.appendChild(btnLog);

        let btnSkip = document.createElement("button");
        btnSkip.id = "btn-skip"; btnSkip.innerText = getUIText("story.skipButton"); btnSkip.className = "story-ui-btn";
        btnSkip.onclick = (e) => { e.stopPropagation(); this.toggleSkip(); };
        uiContainer.appendChild(btnSkip);

        let btnAuto = document.createElement("button");
        btnAuto.id = "btn-auto"; btnAuto.innerText = getUIText("story.autoButton"); btnAuto.className = "story-ui-btn";
        btnAuto.onclick = (e) => { e.stopPropagation(); this.toggleAuto(); };
        uiContainer.appendChild(btnAuto);

        let btnUi = document.createElement("button");
        btnUi.id = "btn-ui-toggle"; btnUi.innerText = getUIText("story.uiToggle"); btnUi.className = "story-ui-btn";
        btnUi.onclick = (e) => { e.stopPropagation(); this.toggleUi(); };
        uiContainer.appendChild(btnUi);

        // 2. 로그 오버레이 (★중요 수정: hidden 클래스 제거)
        let logOverlay = document.createElement("div");
        logOverlay.id = "story-log-overlay";
        logOverlay.className = "story-overlay"; // 'hidden' 클래스를 뺐습니다!
        logOverlay.style.display = "none";      // style로만 제어
        logOverlay.onclick = (e) => { e.stopPropagation(); this.toggleLog(); };

        let logBox = document.createElement("div");
        logBox.id = "story-log-content";
        logBox.onclick = (e) => e.stopPropagation();
        
        logOverlay.appendChild(logBox);
        document.body.appendChild(logOverlay);
    },

    ensureChoiceOverlay: function() {
        let overlay = document.getElementById("story-choice-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "story-choice-overlay";
            document.body.appendChild(overlay);
        } else if (overlay.parentElement !== document.body) {
            document.body.appendChild(overlay);
        }
        overlay.style.pointerEvents = "auto";
        overlay.style.zIndex = "20000";
        return overlay;
    },

    selectChoice: function(next) {
        const overlay = document.getElementById("story-choice-overlay");
        if (overlay) overlay.style.display = "none";
        const storyScene = document.getElementById("story-scene");
        if (storyScene) storyScene.style.pointerEvents = "";
        this.index = next;
        this.playNext();
    },

    debugChoiceClick: function(e) {
        const overlay = document.getElementById("story-choice-overlay");
        if (!overlay || overlay.style.display !== "flex") return;
        if (this.choiceDebugCount >= 3) return;
        this.choiceDebugCount += 1;
        const x = e.clientX, y = e.clientY;
        const el = document.elementFromPoint(x, y);
        const overlayRect = overlay.getBoundingClientRect();
        console.log("[StoryChoiceDebug] click target:", e.target);
        console.log("[StoryChoiceDebug] elementFromPoint:", el);
        console.log("[StoryChoiceDebug] overlay rect:", overlayRect);
    }
};

// [전역 함수] 다음 대사 진행
function nextDialog() {
    const choiceOverlay = document.getElementById("story-choice-overlay");
    const logOverlay = document.getElementById("story-log-overlay");
    
    // 로그 창이 열려있으면 클릭 무시 (이제 로그 창이 눈에 보일 것이므로 정상 작동함)
    if (choiceOverlay && choiceOverlay.style.display === "flex") return;
    if (logOverlay && logOverlay.style.display === "flex") return;
    if (StoryEngine.isUiHidden) {
        StoryEngine.toggleUi();
        return;
    }

    // [CG] 대사창을 숨긴 풀 일러스트 상태에서 클릭하면, 대사창을 띄우고 다음 줄로 진행한다.
    if (StoryEngine.cgWaiting) {
        StoryEngine.revealCgDialog();
        StoryEngine.playNext();
        return;
    }

    if (StoryEngine.isTyping) {
        StoryEngine.finishTyping();
    } else {
        StoryEngine.playNext();
    }
}

