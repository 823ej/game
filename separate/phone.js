/* ============================================================
   phone.js — 탐정의 휴대폰 (전화 / 문자 / 메신저)
   ------------------------------------------------------------
   [작가가 채우는 곳] 맨 위의 데이터 3종:
     PHONE_CONTACTS : 연락처(이름/아바타)
     PHONE_THREADS  : 문자(sms)·메신저(messenger) 대화
     PHONE_CALLS    : 통화 대사 스크립트
   대화는 메시지와 선택지로 구성한다:
     메시지   : { who: "them"|"me", text: "..." }
     선택지   : { choices: [ { text: "내 답장", then: [ ...이어질 메시지/선택지... ] } ] }

   [스토리에서 푸시] 컷신/시나리오 진행 중 새 알림을 띄우려면:
     phonePush("messenger", "landlord", "새 메시지 내용")   // 새 문자/메신저
     phoneMissedCall("hecate")                              // 부재중 전화

   ※ 로드 순서: data.js → scenarios.js → phone.js → game.js
   ============================================================ */

/* ===== [데이터] 연락처 ===== */
const PHONE_CONTACTS = {
    landlord:  { name: "집주인 할머니", avatar: "👵" },
    cafe_alba: { name: "카페 알바 · 유나", avatar: "🧑‍🍳" },
    hecate:    { name: "레이디 헤카테", avatar: "🔮" }
};

/* ===== [데이터] 문자/메신저 대화 ===== */
const PHONE_THREADS = [
    {
        id: "messenger:hecate", app: "messenger", contact: "hecate",
        script: [
            { who: "them", text: "탐정 양반, 깨어났수?" },
            { who: "them", text: "어젯밤 꽤나 취해 있던데. 기억은 좀 나고?" },
            { choices: [
                { text: "무슨 소리야?", then: [
                    { who: "them", text: "…정말 아무것도 기억 안 나는 모양이군." },
                    { who: "them", text: "사무소부터 천천히 둘러봐. 뭐라도 단서가 있을 테니." }
                ]},
                { text: "지금 좀 바빠.", then: [
                    { who: "them", text: "흥, 늘 그렇지. 필요하면 연락하슈." }
                ]}
            ]}
        ]
    },
    {
        // deferred:true → 처음엔 안 보이고, 스토리에서 phoneDeliver("sms:cafe_alba")로 '지금 도착'시킨다.
        // 읽으면(onRead) 사건 보드에 단서가 추가된다. img로 사진 첨부.
        id: "sms:cafe_alba", app: "sms", contact: "cafe_alba", onRead: "cat_returned", deferred: true,
        script: [
            { who: "them", text: "탐정님!! 어제 나비 찾아주셔서 정말정말 감사해요 ㅠㅠ" },
            { who: "them", text: "덕분에 무사히 품에 안았어요. 사진 보세요!" },
            { who: "them", img: "https://placehold.co/420x320/4a4035/ffffff?text=Nabi+%F0%9F%90%88", text: "나비랑 같이 찍었어요 🐈" },
            { who: "them", text: "다음에 오시면 커피는 제가 쏠게요!" }
        ]
    }
];

/* ===== [데이터] 통화 스크립트 (연락처별 대사) ===== */
const PHONE_CALLS = {
    hecate: [
        { who: "them", text: "여보세요, 탐정 양반." },
        { who: "me",   text: "…헤카테. 무슨 일이야." },
        { who: "them", text: "그냥. 잘 살아있나 해서. 또 보자고." }
    ]
};


/* ============================================================
   [런타임] 아래는 휴대폰 동작 코드입니다. (보통은 건드릴 필요 없음)
   ============================================================ */
const Phone = {
    view: "home",       // "home" | "app:call"|"app:sms"|"app:messenger" | "thread:<id>" | "call:<contact>"
    callIndex: 0,

    // ---- 상태(game.phone) 초기화 ----
    ensureState() {
        if (typeof game === 'undefined') return null;
        if (!game.phone) game.phone = {};
        const p = game.phone;
        if (!p.threads) p.threads = {};
        if (!Array.isArray(p.callLog)) p.callLog = [];
        if (typeof p.missedUnread !== 'number') p.missedUnread = 0;
        if (!p.initialized) {
            PHONE_THREADS.forEach(def => {
                const delivered = !def.deferred;
                p.threads[def.id] = {
                    app: def.app, contact: def.contact,
                    shown: [], queue: JSON.parse(JSON.stringify(def.script || [])),
                    waiting: null, unread: false,
                    onRead: def.onRead || null, onReadFired: false,
                    delivered: delivered
                };
                if (delivered) { p.threads[def.id].unread = true; this._advance(def.id); }
            });
            p.initialized = true;
        }
        return p;
    },

    // 큐에서 메시지를 공개. 선택지를 만나면 멈추고 waiting에 보관.
    _advance(threadId) {
        const t = game.phone.threads[threadId];
        if (!t) return;
        while (t.queue.length > 0) {
            const step = t.queue[0];
            if (step && Array.isArray(step.choices)) { t.waiting = step.choices; t.queue.shift(); return; }
            t.queue.shift();
            if (step && (step.text || step.img)) t.shown.push({ who: step.who || "them", text: step.text || "", img: step.img || null });
        }
        t.waiting = null;
    },

    // ---- DOM 생성 ----
    init() {
        if (document.getElementById('phone-fab')) return;
        // 플로팅 버튼
        const fab = document.createElement('button');
        fab.id = 'phone-fab';
        fab.type = 'button';
        fab.innerHTML = `📱<span id="phone-fab-badge" class="phone-badge" style="display:none;">0</span>`;
        fab.onclick = () => Phone.open();
        document.body.appendChild(fab);

        // 오버레이 + 폰 프레임
        const overlay = document.createElement('div');
        overlay.id = 'phone-overlay';
        overlay.style.display = 'none';
        overlay.innerHTML = `
            <div id="phone-frame">
                <div class="phone-statusbar"><span id="phone-clock"></span><span>📶 🔋</span></div>
                <div id="phone-screen"></div>
            </div>`;
        overlay.onclick = (e) => { if (e.target === overlay) Phone.close(); };
        document.body.appendChild(overlay);

        this.updateBadge();
        if (typeof updatePhoneButtonVisibility === 'function') updatePhoneButtonVisibility();
    },

    open() {
        this.ensureState();
        const ov = document.getElementById('phone-overlay');
        if (!ov) return;
        this.stopRing();   // 폰을 열면 진동(붕붕) 멈춤
        ov.style.display = 'flex';
        this.view = 'home';
        this.render();
    },

    // [문자/메신저] 도착 시 딱 한 번 짧게 붕 떨린다. (확인 유도는 속마음 나레이션이 담당)
    buzzOnce() {
        const fab = document.getElementById('phone-fab');
        if (fab) {
            fab.classList.remove('phone-fab-buzz-once');
            void fab.offsetWidth;   // 애니메이션 재시작용 리플로우
            fab.classList.add('phone-fab-buzz-once');
            setTimeout(() => { const f = document.getElementById('phone-fab'); if (f) f.classList.remove('phone-fab-buzz-once'); }, 800);
        }
        try { if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(120); } catch (e) {}
    },
    // [걸려온 전화 전용] 확인(받기/거절)할 때까지 계속 울린다. (전화 기능 붙일 때 사용)
    ring() {
        const fab = document.getElementById('phone-fab');
        if (fab) fab.classList.add('phone-fab-ringing');
        try { if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) {}
    },
    stopRing() {
        const fab = document.getElementById('phone-fab');
        if (fab) fab.classList.remove('phone-fab-ringing');
    },

    // 보류(deferred)해 둔 스레드를 '지금 도착'시킨다 → 메시지 공개 + 미읽음 + 붕붕.
    deliver(threadId) {
        this.ensureState();
        const t = game.phone.threads[threadId];
        if (!t || t.delivered) return;     // 없는 스레드/이미 배달됨 → 무시
        t.delivered = true;
        t.unread = true;
        this._advance(threadId);           // 메시지 공개
        if (typeof autoSave === 'function') autoSave();
        if (typeof updatePhoneButtonVisibility === 'function') updatePhoneButtonVisibility();
        this.updateBadge();
        this.buzzOnce();
    },
    close() {
        const ov = document.getElementById('phone-overlay');
        if (ov) ov.style.display = 'none';
    },
    go(view) { this.view = view; this.render(); },

    // ---- 알림 배지 ----
    unreadByApp(app) {
        this.ensureState();
        return Object.values(game.phone.threads).filter(t => t.app === app && t.unread && t.delivered !== false).length;
    },
    unreadTotal() {
        this.ensureState();
        const msgs = Object.values(game.phone.threads).filter(t => t.unread && t.delivered !== false).length;
        return msgs + (game.phone.missedUnread || 0);
    },
    updateBadge() {
        const b = document.getElementById('phone-fab-badge');
        if (!b) return;
        const n = this.unreadTotal();
        if (n > 0) { b.textContent = n > 9 ? '9+' : String(n); b.style.display = ''; }
        else b.style.display = 'none';
    },

    // ---- 렌더 ----
    render() {
        const screen = document.getElementById('phone-screen');
        if (!screen) return;
        const clock = document.getElementById('phone-clock');
        if (clock && typeof getTimeLabel === 'function') { try { clock.textContent = getTimeLabel(); } catch (e) { clock.textContent = ''; } }

        const v = this.view;
        if (v === 'home') screen.innerHTML = this.htmlHome();
        else if (v === 'app:call') screen.innerHTML = this.htmlContacts();
        else if (v === 'app:sms' || v === 'app:messenger') screen.innerHTML = this.htmlThreadList(v.split(':')[1]);
        else if (v.startsWith('thread:')) screen.innerHTML = this.htmlThread(v.slice('thread:'.length));
        else if (v.startsWith('call:')) screen.innerHTML = this.htmlCall(v.slice('call:'.length));
        const log = screen.querySelector('.phone-thread-log');
        if (log) log.scrollTop = log.scrollHeight;
        this.updateBadge();
    },

    header(title, back) {
        const left = back
            ? `<button class="phone-back" onclick="Phone.go('${back}')">‹</button>`
            : `<button class="phone-back" onclick="Phone.close()">✕</button>`;
        return `<div class="phone-header">${left}<div class="phone-title">${title}</div><div style="width:36px"></div></div>`;
    },

    htmlHome() {
        const badge = (n) => n > 0 ? `<span class="phone-badge">${n > 9 ? '9+' : n}</span>` : '';
        const missed = game.phone.missedUnread || 0;
        return `
            ${this.header("휴대폰", null)}
            <div class="phone-home">
                <button class="phone-app-icon" onclick="Phone.go('app:call')"><div class="ico">📞</div><div>전화${badge(missed)}</div></button>
                <button class="phone-app-icon" onclick="Phone.go('app:sms')"><div class="ico">💬</div><div>문자${badge(this.unreadByApp('sms'))}</div></button>
                <button class="phone-app-icon" onclick="Phone.go('app:messenger')"><div class="ico">📨</div><div>메신저${badge(this.unreadByApp('messenger'))}</div></button>
            </div>`;
    },

    // 전화 앱: 연락처 목록 + 통화기록
    htmlContacts() {
        let list = Object.keys(PHONE_CONTACTS).map(id => {
            const c = PHONE_CONTACTS[id];
            const callable = !!PHONE_CALLS[id];
            return `<button class="phone-list-item" onclick="Phone.startCall('${id}')">
                <span class="ava">${c.avatar || '👤'}</span>
                <span class="phone-li-main"><b>${c.name}</b><small>${callable ? '전화 걸기' : '연결되지 않음'}</small></span>
                <span class="phone-li-act">📞</span>
            </button>`;
        }).join('');
        let logHtml = '';
        const log = game.phone.callLog || [];
        if (log.length > 0) {
            logHtml = `<div class="phone-section">통화 기록</div>` + log.slice(0, 12).map(e => {
                const c = PHONE_CONTACTS[e.contact] || { name: e.contact, avatar: '👤' };
                const tag = e.type === 'missed' ? '<span style="color:#e74c3c">부재중</span>' : (e.type === 'out' ? '발신' : '수신');
                return `<button class="phone-list-item" onclick="Phone.startCall('${e.contact}')">
                    <span class="ava">${c.avatar}</span>
                    <span class="phone-li-main"><b>${c.name}</b><small>${tag}</small></span>
                    <span class="phone-li-act">📞</span></button>`;
            }).join('');
        }
        // 전화 기록 확인 → 부재중 읽음 처리
        game.phone.missedUnread = 0;
        if (typeof autoSave === 'function') autoSave();
        return `${this.header("전화", 'home')}<div class="phone-list"><div class="phone-section">연락처</div>${list}${logHtml}</div>`;
    },

    // 문자/메신저 스레드 목록
    htmlThreadList(app) {
        const title = app === 'sms' ? '문자' : '메신저';
        const threads = Object.entries(game.phone.threads).filter(([id, t]) => t.app === app && t.delivered !== false);
        let list;
        if (threads.length === 0) {
            list = `<div class="phone-empty">아직 ${title}가 없습니다.</div>`;
        } else {
            list = threads.map(([id, t]) => {
                const c = PHONE_CONTACTS[t.contact] || { name: t.contact, avatar: '👤' };
                const last = t.shown.length ? t.shown[t.shown.length - 1].text : '';
                const dot = t.unread ? `<span class="phone-unread-dot"></span>` : '';
                return `<button class="phone-list-item" onclick="Phone.go('thread:${id}')">
                    <span class="ava">${c.avatar}</span>
                    <span class="phone-li-main"><b>${c.name}</b><small>${last}</small></span>
                    ${dot}
                </button>`;
            }).join('');
        }
        return `${this.header(title, 'home')}<div class="phone-list">${list}</div>`;
    },

    // 대화 화면 (말풍선 + 답장 선택지)
    htmlThread(threadId) {
        const t = game.phone.threads[threadId];
        if (!t) return `${this.header("대화", 'home')}<div class="phone-empty">대화를 찾을 수 없습니다.</div>`;
        // 열면 읽음 처리 + onRead(읽으면 단서 추가 등) 1회 발동
        if (t.unread) { t.unread = false; if (typeof autoSave === 'function') autoSave(); }
        if (t.onRead && !t.onReadFired) {
            t.onReadFired = true;
            if (typeof onPhoneRead === 'function') onPhoneRead(t.onRead);
            if (typeof autoSave === 'function') autoSave();
        }
        const c = PHONE_CONTACTS[t.contact] || { name: t.contact, avatar: '👤' };
        const back = t.app === 'sms' ? 'app:sms' : 'app:messenger';
        // 말풍선(텍스트) + 사진 첨부(img) 렌더
        const bubbleInner = (m) => {
            const photo = m.img ? `<img class="phone-photo" src="${m.img}" alt="사진">` : '';
            const txt = m.text ? `<div>${m.text}</div>` : '';
            return photo + txt;
        };
        const bubbles = t.shown.map(m => {
            if (m.who === 'me') return `<div class="phone-bubble me">${bubbleInner(m)}</div>`;
            return `<div class="phone-row"><span class="ava sm">${c.avatar}</span><div class="phone-bubble them">${bubbleInner(m)}</div></div>`;
        }).join('');
        let replies = '';
        if (Array.isArray(t.waiting) && t.waiting.length > 0) {
            replies = `<div class="phone-replies">` + t.waiting.map((ch, i) =>
                `<button class="phone-reply-btn" onclick="Phone.pickReply('${threadId}', ${i})">${ch.text}</button>`
            ).join('') + `</div>`;
        }
        return `${this.header(c.name, back)}
            <div class="phone-thread-log">${bubbles}</div>
            ${replies}`;
    },

    pickReply(threadId, idx) {
        const t = game.phone.threads[threadId];
        if (!t || !Array.isArray(t.waiting)) return;
        const ch = t.waiting[idx];
        if (!ch) return;
        t.shown.push({ who: 'me', text: ch.text });
        t.waiting = null;
        // 선택지의 then을 큐 앞에 끼우고 이어서 공개
        const then = Array.isArray(ch.then) ? JSON.parse(JSON.stringify(ch.then)) : [];
        t.queue = then.concat(t.queue);
        this._advance(threadId);
        if (typeof autoSave === 'function') autoSave();
        this.render();
    },

    // ---- 통화 ----
    startCall(contact) {
        const script = PHONE_CALLS[contact];
        // 통화기록 남기기
        this.ensureState();
        game.phone.callLog.unshift({ contact, type: script ? 'out' : 'missed' });
        if (!script) game.phone.missedUnread = game.phone.missedUnread; // 발신 실패는 부재중 취급 안 함
        if (typeof autoSave === 'function') autoSave();
        if (!script) { this.go('app:call'); return; }
        this.callIndex = 0;
        this.go('call:' + contact);
    },
    htmlCall(contact) {
        const c = PHONE_CONTACTS[contact] || { name: contact, avatar: '👤' };
        const script = PHONE_CALLS[contact] || [];
        const upto = script.slice(0, this.callIndex + 1);
        const lines = upto.map(l => l.who === 'me'
            ? `<div class="phone-call-line me"><b>나</b> ${l.text}</div>`
            : `<div class="phone-call-line them"><b>${c.name}</b> ${l.text}</div>`).join('');
        const more = this.callIndex < script.length - 1;
        const footer = more
            ? `<button class="phone-call-next" onclick="Phone.callNext('${contact}')">다음 ▸</button>`
            : `<button class="phone-call-end" onclick="Phone.go('app:call')">통화 종료</button>`;
        return `${this.header("통화 중", 'app:call')}
            <div class="phone-call">
                <div class="phone-call-ava">${c.avatar}</div>
                <div class="phone-call-name">${c.name}</div>
                <div class="phone-call-log">${lines}</div>
            </div>
            <div class="phone-call-footer">${footer}</div>`;
    },
    callNext(contact) {
        const script = PHONE_CALLS[contact] || [];
        if (this.callIndex < script.length - 1) this.callIndex++;
        this.render();
    },

    // ---- 스토리에서 호출하는 푸시 API ----
    pushMessage(app, contact, text, img) {
        this.ensureState();
        const id = app + ':' + contact;
        let t = game.phone.threads[id];
        if (!t) { t = { app, contact, shown: [], queue: [], waiting: null, unread: true, onRead: null, onReadFired: false, delivered: true }; game.phone.threads[id] = t; }
        t.delivered = true;
        t.shown.push({ who: 'them', text: text || '', img: img || null });
        t.unread = true;
        if (typeof autoSave === 'function') autoSave();
        this.updateBadge();
        if (typeof updatePhoneButtonVisibility === 'function') updatePhoneButtonVisibility();
        // 폰이 열려 그 화면을 보는 중이면 갱신, 아니면 붕붕 울림
        const ov = document.getElementById('phone-overlay');
        if (ov && ov.style.display !== 'none') this.render();
        else this.buzzOnce();
    },
    addMissedCall(contact) {
        this.ensureState();
        game.phone.callLog.unshift({ contact, type: 'missed' });
        game.phone.missedUnread = (game.phone.missedUnread || 0) + 1;
        if (typeof autoSave === 'function') autoSave();
        this.updateBadge();
        if (typeof updatePhoneButtonVisibility === 'function') updatePhoneButtonVisibility();
    }
};

/* 스토리/시나리오에서 쓰는 짧은 헬퍼 */
function phonePush(app, contact, text, img) { Phone.pushMessage(app, contact, text, img); }
function phoneMissedCall(contact) { Phone.addMissedCall(contact); }
function phoneDeliver(threadId) { Phone.deliver(threadId); }   // 보류해 둔 스레드를 '지금 도착'시킴

/* 플로팅 버튼 표시 제어: 걸어다니는 화면(허브/도시/탐사)에서만, 전투/스토리/결과 등에서는 숨김 */
function updatePhoneButtonVisibility() {
    const btn = document.getElementById('phone-fab');
    if (!btn) return;
    let show = false;
    try {
        const blocked = (typeof game !== 'undefined' && game) ? ['battle', 'social', 'story', 'result', 'start', 'gameover', 'win', 'char-creation'].includes(game.state) : true;
        const walkVisible = ['hub-scene', 'city-scene', 'exploration-scene'].some(id => {
            const el = document.getElementById(id); return el && !el.classList.contains('hidden');
        });
        show = !blocked && walkVisible;
    } catch (e) { show = false; }
    btn.style.display = show ? '' : 'none';
    if (show) Phone.updateBadge();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Phone.init());
    else Phone.init();
}
