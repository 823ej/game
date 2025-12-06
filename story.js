/* --------------------------------------------------------------------------
   story.js - 비주얼 노벨 엔진 모듈
   -------------------------------------------------------------------------- */

const StoryEngine = {
    script: [],       // 현재 실행 중인 스크립트 데이터
    index: 0,         // 현재 진행 중인 줄 번호
    isTyping: false,  // 타이핑 효과 중인지 여부
    timer: null,      // 타이핑 타이머
    fullText: "",     // 현재 출력해야 할 전체 텍스트
    callback: null,   // 스토리가 끝난 후 실행할 함수 (예: 전투 시작)
    chars: {},        // 로드된 캐릭터 이미지 객체

    // 스토리 시작 함수
    start: function(scriptData, onComplete) {
        this.script = scriptData;
        this.index = 0;
        this.callback = onComplete;
        this.chars = {};
        
        // UI 초기화
        document.getElementById("story-standing").innerHTML = "";
        document.getElementById("story-choice-overlay").style.display = "none";
        
        // 화면 전환 (game.js의 switchScene 사용)
        switchScene('story');
        
        // 첫 번째 컷 실행
        this.playNext();
    },

    // 다음 컷 실행
    playNext: function() {
        if (this.index >= this.script.length) {
            this.end();
            return;
        }

        let cmd = this.script[this.index];

        // [배경 변경] { type: "bg", src: "url" }
        if (cmd.type === "bg") {
            document.getElementById("story-bg").style.backgroundImage = `url('${cmd.src}')`;
            this.index++;
            this.playNext(); // 배경만 바꾸고 바로 다음 대사로
        }
        // [캐릭터 등장] { type: "char", id: "a", name: "탐정", src: "url", pos: "left" }
        else if (cmd.type === "char") {
            this.showCharacter(cmd.id, cmd.src, cmd.pos);
            this.index++;
            this.playNext();
        }
        // [캐릭터 퇴장] { type: "exit", id: "a" }
        else if (cmd.type === "exit") {
            if (this.chars[cmd.id]) {
                this.chars[cmd.id].remove();
                delete this.chars[cmd.id];
            }
            this.index++;
            this.playNext();
        }
        // [대사 출력] { type: "talk", id: "a", name: "탐정", text: "안녕" }
        else if (cmd.type === "talk") {
            this.showDialog(cmd.id, cmd.name, cmd.text);
            this.index++;
        }
        // [선택지] { type: "choice", options: [{txt:"A", next: 5}, {txt:"B", next: 10}] }
        else if (cmd.type === "choice") {
            this.showChoices(cmd.options);
        }
        // [점프] { type: "jump", next: 10 }
        else if (cmd.type === "jump") {
            this.index = cmd.next;
            this.playNext();
        }
        // [종료] { type: "end" }
        else if (cmd.type === "end") {
            this.end();
        }
    },

    // 캐릭터 표시
    showCharacter: function(id, src, pos) {
        if (this.chars[id]) return; // 이미 있으면 패스

        let img = document.createElement("img");
        img.src = src;
        img.className = `story-char pos-${pos}`; // css 클래스 적용
        document.getElementById("story-standing").appendChild(img);
        this.chars[id] = img;
    },

    // 대사 출력 (타이핑 효과)
    showDialog: function(id, name, text) {
        // 1. 이름표 설정
        let nameTag = document.getElementById("story-name");
        if (name) {
            nameTag.innerText = name;
            nameTag.style.display = "block";
        } else {
            nameTag.style.display = "none";
        }

        // 2. 말하는 캐릭터 강조 (Spotlight)
        for (let key in this.chars) {
            this.chars[key].classList.remove("speaking");
        }
        if (id && this.chars[id]) {
            this.chars[id].classList.add("speaking");
        }

        // 3. 텍스트 타이핑
        const textBox = document.getElementById("story-text");
        textBox.innerHTML = "";
        this.fullText = text;
        this.isTyping = true;
        
        let i = 0;
        if (this.timer) clearInterval(this.timer);
        
        this.timer = setInterval(() => {
            textBox.innerHTML += text.charAt(i);
            i++;
            if (i >= text.length) {
                this.finishTyping();
            }
        }, 30); // 속도 (ms)
    },

    finishTyping: function() {
        clearInterval(this.timer);
        document.getElementById("story-text").innerHTML = this.fullText;
        this.isTyping = false;
    },

    // 선택지 표시
    showChoices: function(options) {
        const overlay = document.getElementById("story-choice-overlay");
        overlay.innerHTML = ""; // 초기화
        overlay.style.display = "flex";

        options.forEach(opt => {
            let btn = document.createElement("button");
            btn.className = "story-choice-btn";
            btn.innerText = opt.txt;
            btn.onclick = (e) => {
                e.stopPropagation();
                overlay.style.display = "none";
                this.index = opt.next; // 선택한 인덱스로 점프
                this.playNext();
            };
            overlay.appendChild(btn);
        });
    },

    // 스토리 종료
    end: function() {
        if (this.callback) this.callback();
        else {
            // 콜백 없으면 기본적으로 허브로 복귀
            renderHub();
        }
    }
};

// [전역 함수] 화면 클릭 시 다음 대사
function nextDialog() {
    // 선택지 떠있으면 클릭 무시
    if (document.getElementById("story-choice-overlay").style.display === "flex") return;

    if (StoryEngine.isTyping) {
        StoryEngine.finishTyping();
    } else {
        StoryEngine.playNext();
    }
}