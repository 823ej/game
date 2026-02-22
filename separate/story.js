/* story.js - 버그 수정판 (로그 창 표시 문제 및 스킵 차단 해결) */

const StoryEngine = {
    script: [], index: 0, isTyping: false, timer: null, fullText: "", callback: null, chars: {},
    
    // [기능 변수]
    logData: [], isSkipping: false, skipSpeed: 50, // 속도: 0.05초

    start: function(scriptData, onComplete) {
        this.script = scriptData;
        this.index = 0;
        this.callback = onComplete;
        this.chars = {};
        this.logData = [];
        this.isSkipping = false;
        
        // 기존 UI 초기화
        const standing = document.getElementById("story-standing");
        if (standing) standing.innerHTML = "";
        const overlay = document.getElementById("story-choice-overlay");
        if (overlay) overlay.style.display = "none";

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
            this.index++; this.playNext(); 
        }
        else if (cmd.type === "char") {
            this.showCharacter(cmd.id, cmd.src, cmd.pos);
            this.index++; this.playNext();
        }
        else if (cmd.type === "exit") {
            if (this.chars[cmd.id]) { this.chars[cmd.id].remove(); delete this.chars[cmd.id]; }
            this.index++; this.playNext();
        }
        else if (cmd.type === "talk") {
            this.addLog(cmd.name, cmd.text);
            this.showDialog(cmd.id, cmd.name, cmd.text);
            this.index++;
        }
        else if (cmd.type === "choice") {
            if (this.isSkipping) this.toggleSkip(); // 선택지에서 스킵 멈춤
            this.showChoices(cmd.options);
        }
        else if (cmd.type === "jump") {
            this.index = cmd.next; this.playNext();
        }
        else if (cmd.type === "end") {
            this.end();
        }
    },

    showCharacter: function(id, src, pos) {
        if (this.chars[id]) return;
        let img = document.createElement("img");
        img.src = src; img.className = `story-char pos-${pos}`;
        document.getElementById("story-standing").appendChild(img);
        this.chars[id] = img;
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
    },

    showChoices: function(options) {
        const overlay = document.getElementById("story-choice-overlay");
        overlay.innerHTML = ""; overlay.style.display = "flex";
        options.forEach(opt => {
            let btn = document.createElement("button");
            btn.className = "story-choice-btn";
            btn.innerText = opt.txt;
            btn.onclick = (e) => {
                e.stopPropagation(); overlay.style.display = "none";
                this.index = opt.next; this.playNext();
            };
            overlay.appendChild(btn);
        });
    },

    end: function() {
        this.isSkipping = false;
        
        // 생성했던 버튼과 로그창 제거 (스토리 끝나면 깔끔하게 정리)
        const uiControls = document.getElementById("story-ui-controls");
        if (uiControls) uiControls.remove();
        
        const logOverlay = document.getElementById("story-log-overlay");
        if (logOverlay) logOverlay.remove();

        if (this.callback) this.callback();
        else if (typeof renderHub === 'function') renderHub();
    },

    addLog: function(name, text) {
        this.logData.push({ name: name || "", text: text });
    },

    toggleSkip: function() {
        this.isSkipping = !this.isSkipping;
        const btn = document.getElementById("btn-skip");
        if (this.isSkipping) {
            if (btn) { btn.innerText = getUIText("story.skipOn"); btn.classList.add("active"); }
            if (this.isTyping) this.finishTyping();
            else nextDialog();
        } else {
            if (btn) { btn.innerText = getUIText("story.skipButton"); btn.classList.remove("active"); }
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
    }
};

// [전역 함수] 다음 대사 진행
function nextDialog() {
    const choiceOverlay = document.getElementById("story-choice-overlay");
    const logOverlay = document.getElementById("story-log-overlay");
    
    // 로그 창이 열려있으면 클릭 무시 (이제 로그 창이 눈에 보일 것이므로 정상 작동함)
    if (choiceOverlay && choiceOverlay.style.display === "flex") return;
    if (logOverlay && logOverlay.style.display === "flex") return;

    if (StoryEngine.isTyping) {
        StoryEngine.finishTyping();
    } else {
        StoryEngine.playNext();
    }
}

