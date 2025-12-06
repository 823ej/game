

/* [NEW] 적 덱 생성 헬퍼 함수 */
function getEnemyDeck(type) {
    let deck = [];
    if (type === "basic") {
        // 불량배: 단순 공격 위주
        deck = ["타격", "타격", "수비"];
    } 
    else if (type === "player_like") {
        // 허수아비: 플레이어 초기 덱 구성 (타격5, 수비4, 2성 1장)
        for(let i=0; i<5; i++) deck.push("타격");
        for(let i=0; i<4; i++) deck.push("수비");
        // 랜덤 2성 카드 1장 추가 (함수 재사용)
        let randomRank2 = getRandomCardByRank(2);
        deck.push(randomRank2);
    }
    return deck;
}


/* [NEW] 랭크별 랜덤 카드 뽑기 유틸리티 (기존 getRandomCard 보완) */
function getRandomCardByRank(rank) {
    let pool = Object.keys(CARD_DATA).filter(k => CARD_DATA[k].rank === rank);
    return pool[Math.floor(Math.random() * pool.length)];
}


/* SCENARIOS 데이터에 구역 연결 (기존 데이터 유지하되 location은 동적으로 처리 가능) */
// (기존 SCENARIOS 데이터는 그대로 두셔도 됩니다)

/* [수정] 도시 지도 렌더링 (수락한 의뢰 위치 강조) */
function renderCityMap() {
    switchScene('city');
    const grid = document.getElementById('district-grid');
    grid.innerHTML = "";
    
    // 현재 활성화된(수락한) 시나리오 데이터 가져오기
    let activeScId = game.activeScenarioId;
    let unlockList = [];
    if (activeScId && SCENARIOS[activeScId]) {
        unlockList = SCENARIOS[activeScId].unlocks || [];
    }

    for (let key in DISTRICTS) {
        let d = DISTRICTS[key];
        
        // [표시 조건]
        // 1. 숨겨진 구역이 아님 OR
        // 2. 현재 의뢰로 인해 해금된 구역임
        let isVisible = !d.hidden || unlockList.includes(key);

        if (!isVisible) continue; 

        let el = document.createElement('div');
        el.className = "hub-card";
        el.style.borderColor = d.color;
        
        // [핵심] 현재 수락한 의뢰가 이 구역에 있는가?
        let isTarget = d.scenarios.includes(activeScId);
        let badge = isTarget ? "🎯 <span style='color:#e74c3c; font-weight:bold;'>목표 지역</span>" : "";

        el.innerHTML = `
            <h3 style="color:${d.color}">${d.name}</h3>
            <div style="margin-bottom:5px;">${badge}</div>
            <p style="font-size:0.8em; color:#aaa;">${d.desc}</p>
            <div style="font-size:0.8em; margin-top:5px;">⚠️ 위험도: ${"★".repeat(d.danger)}</div>
        `;
        
        // 클릭 시 해당 구역 진입
        el.onclick = () => enterDistrict(key);
        grid.appendChild(el);
    }
}
/* [수정] 구역 진입 함수 (안전장치 강화) */
function enterDistrict(key) {
    let d = DISTRICTS[key];
    // scenarios 배열이 없으면 빈 배열로 취급 (에러 방지)
    let distScenarios = d.scenarios || []; 
    
    let content = `<div style="display:flex; flex-direction:column; gap:10px;">`;

    // 1. [메인] 수락한 의뢰가 이 구역에 있는 경우
    if (game.activeScenarioId && distScenarios.includes(game.activeScenarioId)) {
        let scId = game.activeScenarioId;
        let scTitle = SCENARIOS[scId].title;
        
        content += `
            <button class="action-btn" onclick="beginMission()" style="border-left:5px solid #e74c3c; background:#2c3e50;">
                🕵️ <b>수사 시작: ${scTitle}</b><br>
                <span style="font-size:0.7em; color:#ddd;">이 구역에서 사건을 조사합니다.</span>
            </button>
            <div style="height:1px; background:#444; margin:5px 0;"></div>
        `;
    }

    // 2. [서브] 순찰
    content += `
        <button class="action-btn" onclick="startPatrol('${key}')" style="background:#555;">
            🚓 주변 순찰 (랜덤 전투/파밍)
        </button>
    `;

    // 3. [시설] 상점
    // facilities가 없을 수도 있으니 안전하게 체크
    if (d.facilities) {
        d.facilities.forEach(fac => {
            if (fac.startsWith("shop_")) {
                let shopName = "상점";
                let btnColor = "#e67e22";
                
                if (fac === "shop_black_market") { shopName = "💀 암시장"; btnColor = "#444"; }
                else if (fac === "shop_pharmacy") { shopName = "💊 약국/편의점"; btnColor = "#27ae60"; }
                else if (fac === "shop_high_end") { shopName = "💎 고급 부티크"; btnColor = "#8e44ad"; }

                content += `<button class="action-btn" onclick="renderShopScreen('${fac}')" style="background:${btnColor};">${shopName}</button>`;
            }
        });
    }

    content += `</div>`;

    showPopup(`📍 ${d.name}`, "무엇을 하시겠습니까?", [
        {txt: "뒤로가기", func: closePopup}
    ], content);
}
/* [필수] 미션 시작 함수 */
function beginMission() {
    closePopup();
    
    if (!game.activeScenarioId || !SCENARIOS[game.activeScenarioId]) {
        alert("진행 중인 의뢰 정보를 찾을 수 없습니다.");
        return;
    }

    // 탐사 화면 진입 데이터 설정
    let scData = SCENARIOS[game.activeScenarioId];
    game.scenario = {
        id: game.activeScenarioId,
        title: scData.title,
        clues: 0,
        doom: 0,
        location: scData.locations[0], 
        bossReady: false,
        isActive: true
    };
    
    renderExploration();
}

/* [수정] 순찰 시작 (복귀 가능 설정) */
function startPatrol(districtKey) {
    closePopup();
    
    // 순찰 시나리오 데이터 생성
    game.scenario = {
        id: "patrol",
        title: `${DISTRICTS[districtKey].name} 순찰`,
        location: DISTRICTS[districtKey].name,
        clues: 0,
        doom: 0,
        isPatrol: true,
        
        // [NEW] 순찰은 언제든 복귀 가능
        canRetreat: true 
    };
    
    // 바로 인카운터 발생
    let roll = Math.random();
    if (roll < 0.5) startBattle(false);
    else startSocialBattle("부패 경찰"); // 나중엔 구역별 랜덤 NPC로 변경 가능
}

function applyTooltip(text) {
    let res = text;
    for (let key in TOOLTIPS) {
        let regex = new RegExp(key, 'g'); 
        res = res.replace(regex, `<span class="keyword">${key}<span class="tip-text">${TOOLTIPS[key]}</span></span>`);
    }
    return res;
}


/* --- 상태 변수 --- */
/* [수정] 플레이어 상태 (인벤토리 통합) */
let player = { 
    // ... (기존 속성들 유지) ...
    maxHp: 30, hp: 30, maxSp: 100, sp: 100, 
    baseAtk: 1, baseDef: 1, baseSpd: 3, 
    gold: 0, ap: 3, xp: 0, maxXp: 100,
    
    // 덱 관련
    deck: [],       // 전투 덱 (Active)
    socialDeck: [], // 소셜 덱 (Active)
    storage: [],    // 보관함 (Inactive - 모든 타입 섞여 있음)
    
    // 인벤토리 관련
    inventory: [], maxInventory: 6,
    
    // 상태
    jumadeung: false, lucky: false,
    drawPile: [], discardPile: [], exhaustPile: [], buffs: {}
};

let enemies = [];

/* [수정] game 상태 변수 */
let game = { 
    level: 1, 
    // turnCount는 이제 '라운드'가 아니라 '누적 행동 횟수' 정도로 씁니다.
    totalTurns: 0, 
    state: "exploration", // [핵심] 기본 상태가 'battle'이 아니라 'exploration'
    turnOwner: "none", 
    pendingLoot: null,
    winMsg: "",
    lastTurnOwner: "none", // [NEW] 직전 턴 주인 기록용
    // [NEW] 행동 게이지 MAX 상수 (이 수치에 도달하면 턴 획득)
    AG_MAX: 1000,
    // [NEW] 시나리오 진행 상태
    scenario: {
        id: "tutorial",
        clues: 0,       // 단서 (100 되면 보스)
        doom: 0,        // 위협도 (100 되면 게임오버 or 페널티)
        location: "뒷골목",
        bossReady: false
    }
};

/* [NEW] 랜덤 이벤트 실행기 */
function triggerRandomEvent() {
    // 1. 랜덤 이벤트 선택
    let event = EVENT_DATA[Math.floor(Math.random() * EVENT_DATA.length)];
    
    // 2. 선택지 버튼 생성
    // (showPopup 함수 형식이 [{txt, func}] 이므로 그대로 매핑)
    let buttons = event.choices.map(choice => {
        return {
            txt: choice.txt,
            func: choice.func
        };
    });

    // 3. 팝업 표시
    // (이미지는 있으면 넣고 없으면 생략하는 로직 추가 가능)
    showPopup(event.title, event.desc, buttons);
}

/* --- 유틸리티 --- */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function log(msg) { const box = document.getElementById('log-box'); box.innerHTML += `<div>${msg}</div>`; box.scrollTop = box.scrollHeight; }
/* [NEW] 대미지 텍스트 표시 효과 (누락된 함수) */
function showDamageText(target, msg) {
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;
    let targetEl = document.getElementById(targetId);
    
    if (targetEl) {
        let el = document.createElement("div");
        el.className = "damage-number";
        el.innerText = msg;
        targetEl.appendChild(el);
        
        // 애니메이션(0.8초) 후 HTML에서 삭제
        setTimeout(() => {
            el.remove();
        }, 800);
    }
}

/* [NEW] 마우스/터치 좌표 통합 추출 함수 */
function getClientPos(e) {
    // 터치 이벤트인 경우
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    // 터치가 끝나는 순간(touchend)에는 touches가 비어있음 -> changedTouches 확인
    if (e.changedTouches && e.changedTouches.length > 0) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    // 마우스 이벤트인 경우
    return { x: e.clientX, y: e.clientY };
}

/* [수정] initGame (기본 덱 + 보관함 초기화) */
function initGame() {
    // 1. 기본 전투 덱
    player.deck = ["타격","타격","타격","수비","수비","수비"];
    
    // 2. 기본 소셜 덱
    player.socialDeck = ["미소짓기", "미소짓기", "미소짓기", "인상 쓰기", "인상 쓰기", "안부 묻기"];
    
    // 3. 보관함 (테스트용 여분 카드 지급)
    player.storage = ["잠자기", "도발", "농담하기", "거짓말", "비명"]; 
    
    addRandomCard(2); // 랜덤 카드는 덱으로 들어감 (기존 로직)
    
    renderHub();
}

/* [NEW] 거점 화면 렌더링 */
function renderHub() {
    switchScene('hub');
    updateUI(); // 상단 바 갱신
}

/* [NEW] 거점 휴식 */
function hubRest() {
    if (player.gold < 500) {
        showPopup("잔액 부족", "커피 사 마실 돈도 없습니다...", [{txt:"확인", func:closePopup}]);
        return;
    }
    
    player.gold -= 500;
    player.hp = player.maxHp;
    player.sp = player.maxSp;
    
    updateUI();
    showPopup("휴식", "따뜻한 커피를 마시며 안정을 찾았습니다.<br>(HP/SP 완전 회복)", [{txt:"확인", func:closePopup}]);
}
/* [NEW] 덱 관리 시스템 변수 */
let currentDeckMode = 'battle'; // 'battle' or 'social'

/* [NEW] 덱 관리 화면 열기 */
function openDeckManager() {
    switchDeckMode('battle'); // 기본은 배틀 덱
}

/* [NEW] 탭 전환 및 렌더링 */
function switchDeckMode(mode) {
    currentDeckMode = mode;
    
    // 탭 스타일 갱신
    document.getElementById('tab-battle').style.opacity = (mode === 'battle') ? 1 : 0.5;
    document.getElementById('tab-social').style.opacity = (mode === 'social') ? 1 : 0.5;
    
    renderDeckBuilder();
    switchScene('deck'); // 화면 전환 (html에 id="deck-scene" 추가 필수)
}

/* [NEW] 덱 빌더 UI 그리기 */
function renderDeckBuilder() {
    const activeList = document.getElementById('active-deck-list');
    const storageList = document.getElementById('storage-list');
    
    activeList.innerHTML = "";
    storageList.innerHTML = "";
    
    // 1. 현재 모드에 맞는 덱 가져오기
    let targetDeck = (currentDeckMode === 'battle') ? player.deck : player.socialDeck;
    
    // 카운트 갱신
    document.getElementById('deck-count').innerText = targetDeck.length;
    
    // --- 왼쪽: 장착 중인 덱 렌더링 ---
    targetDeck.forEach((cName, idx) => {
        let el = createBuilderCard(cName, () => moveCardToStorage(idx));
        activeList.appendChild(el);
    });

    // --- 오른쪽: 보관함 렌더링 (필터링 적용) ---
    // 전투 모드면 -> 소셜 카드 제외하고 보여줌
    // 소셜 모드면 -> 소셜 카드만 보여줌 (혹은 공용)
    let filteredStorageIndices = [];
    
    player.storage.forEach((cName, idx) => {
        let data = CARD_DATA[cName];
        let isSocialCard = (data.type === "social");
        
        let show = false;
        if (currentDeckMode === 'battle' && !isSocialCard) show = true;
        if (currentDeckMode === 'social' && isSocialCard) show = true;
        
        if (show) {
            // 클릭 시 index가 꼬이지 않게 원본 storage의 인덱스를 전달해야 함
            let el = createBuilderCard(cName, () => moveCardToDeck(idx));
            storageList.appendChild(el);
        }
    });
    
    document.getElementById('storage-count').innerText = storageList.children.length;
}

/* [NEW] 빌더용 카드 엘리먼트 생성 */
function createBuilderCard(cName, onClickFunc) {
    let data = CARD_DATA[cName];
    let el = document.createElement('div');
    el.className = 'builder-card';
    // 소셜/배틀 색상 구분
    if (data.type === 'social') el.style.borderColor = '#8e44ad';
    else if (data.type === 'attack') el.style.borderColor = '#c0392b';
    
    el.innerHTML = `
        <div class="cost">${data.cost}</div>
        <b>${cName}</b>
        <div style="font-size:0.9em; color:#f1c40f;">${"★".repeat(data.rank)}</div>
        <div style="color:#555; overflow:hidden;">${data.desc}</div>
    `;
    el.onclick = onClickFunc;
    return el;
}

/* [NEW] 카드 이동: 덱 -> 보관함 */
function moveCardToStorage(deckIdx) {
    let targetDeck = (currentDeckMode === 'battle') ? player.deck : player.socialDeck;
    
    // 최소 덱 매수 제한 (예: 5장)
    if (targetDeck.length <= 5) {
        alert("최소 5장의 카드는 있어야 합니다.");
        return;
    }

    let card = targetDeck.splice(deckIdx, 1)[0]; // 덱에서 제거
    player.storage.push(card); // 보관함에 추가
    
    renderDeckBuilder(); // 재렌더링
}

/* [NEW] 카드 이동: 보관함 -> 덱 */
function moveCardToDeck(storageIdx) {
    let targetDeck = (currentDeckMode === 'battle') ? player.deck : player.socialDeck;
    
    let card = player.storage.splice(storageIdx, 1)[0]; // 보관함에서 제거
    targetDeck.push(card); // 덱에 추가
    
    renderDeckBuilder(); // 재렌더링
}

/* [수정] 대화 모드 시작 (턴 기록 초기화 추가) */
function startSocialBattle(npcKey) {
    game.state = "social";
    game.totalTurns = 0;
    game.isBossBattle = false;

    // [핵심 수정] 턴 기록 초기화
    game.turnOwner = "none";     
    game.lastTurnOwner = "none"; 

    // 덱 교체
    player.drawPile = [...player.socialDeck]; 
    shuffle(player.drawPile);
    player.discardPile = []; player.exhaustPile = []; player.hand = [];
    player.buffs = {}; player.block = 0; player.ag = 0;

    renderHand();

    enemies = [];
    let data = NPC_DATA[npcKey];
    enemies.push({ 
        id: 0, 
        name: data.name, 
        maxHp: 100, hp: 50, maxSp: 100, 
        baseAtk: data.baseAtk, baseDef: data.baseDef, baseSpd: data.baseSpd,
        block: 0, buffs: {}, deck: data.deck, img: data.img, ag: 0,
        patience: 6 + Math.floor(Math.random() * 4),
        maxPatience: 9
    });

    log(`💬 [${data.name}]와(과) 대화를 시작합니다! (목표: SP 0 또는 100)`);

    switchScene('battle'); 
    renderEnemies();
    updateUI(); 
    processTimeline();
}

/* [수정] 소셜 임팩트 적용 (플레이어는 무조건 SP 피해) */
function applySocialImpact(target, val) {
    let absVal = Math.abs(val);
    let effectiveVal = absVal;

    // 1. 방어도(마음의 벽) 체크
    if (target.block > 0) {
        if (target.block >= absVal) {
            target.block -= absVal;
            effectiveVal = 0;
            showDamageText(target, "RESIST");
        } else {
            effectiveVal -= target.block;
            target.block = 0;
        }
    }

    if (effectiveVal > 0) {
        // [CASE A] 대상이 플레이어일 때 (방어하는 입장)
        if (target === player) {
            // NPC가 긍정적(양수)인 행동을 했든, 부정적(음수)인 행동을 했든
            // 플레이어는 '정신력(SP)'을 잃습니다.
            
            target.sp -= effectiveVal; // 무조건 감소

            // 연출 분기
            if (val > 0) {
                // 긍정적 공격 (유혹, 회유, 기만) -> 💖 매료됨
                log(`😵 상대의 언변에 마음이 흔들립니다! (SP -${effectiveVal})`);
                showDamageText(target, `💖-${effectiveVal}`);
            } else {
                // 부정적 공격 (공포, 협박, 충격) -> 💔 상처입음
                log(`😱 정신적 충격을 받았습니다! (SP -${effectiveVal})`);
                showDamageText(target, `💔-${effectiveVal}`);
            }
        } 
        // [CASE B] 대상이 NPC일 때 (공략하는 입장)
        else {
            // 기존 로직 유지 (0이나 200으로 보냄)
            if (val > 0) {
                target.hp += effectiveVal; // 호감(설득) 쪽으로 이동
                showDamageText(target, `❤️+${effectiveVal}`);
            } else {
                target.hp -= effectiveVal; // 공포(굴복) 쪽으로 이동
                showDamageText(target, `💔-${effectiveVal}`);
            }
        }
    }
    updateUI();
}

/* [NEW] 사건 파일 열기 (시나리오 선택) */
function openCaseFiles() {
    // 팝업으로 시나리오 목록 보여주기
    let content = `<div style="display:flex; flex-direction:column; gap:10px;">`;
    
    // SCENARIOS 데이터를 순회하며 버튼 생성
    for (let id in SCENARIOS) {
        let sc = SCENARIOS[id];
        content += `
            <button class="action-btn" onclick="startScenario('${id}')">
                <b>${sc.title}</b><br>
                <span style="font-size:0.7em;">${sc.desc}</span>
            </button>
        `;
    }
    content += `</div>`;

    showPopup("📁 의뢰 목록", "해결할 사건을 선택하세요.", [
        {txt: "닫기", func: closePopup}
    ], content);
}

function startScenario(id) {
    console.log("시나리오 시작 시도:", id); // [확인용 로그]
    closePopup();
    
    let scData = SCENARIOS[id];
    console.log("데이터 확인:", scData.introStory); // [확인용 로그]

    if (scData.introStory && scData.introStory.length > 0) {
        console.log("스토리 모드 진입!"); // [확인용 로그]
        StoryEngine.start(scData.introStory, function() {
            acceptMission(id);
        });
    } else {
        console.log("스토리 없음. 바로 수락."); // [확인용 로그]
        acceptMission(id);
    }
}

/* [NEW] 실제 의뢰 수락 로직 (기존 startScenario의 내용을 여기로 옮김) */
function acceptMission(id) {
    let scData = SCENARIOS[id];
    
    // 1. 현재 수행 중인 의뢰로 등록
    game.activeScenarioId = id; 
    
    // 2. 게임 상태에 초기 데이터 세팅
    game.scenario = {
        id: id,
        title: scData.title,
        clues: 0,
        doom: 0,
        location: scData.locations[0], 
        bossReady: false,
        isActive: false
    };
    
    // 3. 알림 메시지 및 화면 복귀
    let targetDistrictName = "알 수 없는 곳";
    for (let dKey in DISTRICTS) {
        if (DISTRICTS[dKey].scenarios.includes(id)) {
            targetDistrictName = DISTRICTS[dKey].name;
            break;
        }
    }
    
    // 스토리가 끝난 후에는 'story-scene'에 있으므로, 다시 'hub'나 'city'로 보내줘야 함
    renderHub(); // 사무소 화면으로 복귀

    // 약간의 딜레이를 주어 화면 전환 후 알림이 뜨게 함
    setTimeout(() => {
        alert(`✅ 의뢰 수락 완료: [${scData.title}]\n\n"${targetDistrictName}" 구역으로 이동하여 조사를 시작하세요.`);
    }, 100);
    
    updateUI();
}

/* [수정] 아이템 획득 함수 (인벤토리 제한 적용) */
function addItem(name) {
    // 1. 인벤토리 공간 확인
    if (player.inventory.length >= player.maxInventory) {
        log("🚫 가방이 꽉 찼습니다! (최대 6개)");
        // (나중에 '버리기' 기능을 추가하거나 획득 취소 처리를 할 수 있음)
        showPopup("가방 가득 참", `[${name}]을(를) 넣을 공간이 없습니다.<br>기존 아이템을 버리시겠습니까?`, [
            {txt: "포기하기", func: closePopup}
            // 여기에 '인벤토리 관리' 버튼을 넣어 교체하게 할 수도 있음
        ]);
        return false; 
    }

    // 2. 아이템 추가
    player.inventory.push(name);
    
    // 3. 즉시 효과 적용 (최대 체력 증가 등 획득 시 발동하는 패시브)
    if (name === "울끈불끈 패딩") { 
        player.maxHp += 50; 
        player.hp += 50; 
        log("🧥 패딩 장착! 최대 체력이 50 증가했습니다."); 
        updateUI();
    }
    
    updateInventoryUI(); 
    return true;
}
/* [수정] 아이템 사용 함수 (useItem으로 이름 변경) */
function useItem(index, target) {
    const name = player.inventory[index];
    const data = ITEM_DATA[name];

    // 패시브 아이템은 직접 사용 불가 (단, 선물은 가능하게 할 수도 있음 - 아래 로직에서 처리)
    // 여기서는 기본적으로 '사용(consume)' 속성이 아니면 사용 불가로 처리하되, 소셜 모드 선물은 예외 허용
    
    let isSocialGift = (game.state === "social" && target !== player);
    
    // 사용 불가 조건: (소모품 아님) AND (선물하기도 아님)
    if (data.usage !== "consume" && !isSocialGift) {
        log(`🚫 [${name}]은(는) 가지고 있으면 효과를 발휘합니다.`);
        return;
    }

    // 전투 중 공격 아이템 체크
    if (data.effect === "damage" && (game.state !== "battle" || game.turnOwner !== "player") && !isSocialGift) {
        log("🚫 전투 중 내 턴에만 가능합니다."); 
        return;
    }

    let used = false;
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;

    // --- 1. 소셜 모드 선물하기 ---
    if (isSocialGift) {
        log(`🎁 [${name}] 아이템을 선물합니다.`);
        
        // 1. 태그 매칭 계산
        let npcData = NPC_DATA[enemies[0].name]; // 현재 NPC 데이터 원본 가져오기 (취향 확인용)
        // NPC 이름 뒤에 ' A' 같은 게 붙어있을 수 있으므로 원본 이름을 찾아야 함. 
        // 편의상 현재 enemies[0]의 이름에서 ' A' 등을 떼거나, 
        // startSocialBattle에서 npcKey를 어딘가 저장해두는 게 좋지만, 
        // 여기서는 간단히 NPC_DATA를 순회해서 찾거나 태그를 확인합니다.
        
        // (간단 구현: 현재 적 객체에 likes/dislikes가 없으므로 NPC_DATA에서 다시 찾음)
        let originalNPC = Object.values(NPC_DATA).find(n => target.name.startsWith(n.name));
        let likes = originalNPC ? (originalNPC.likes || []) : [];
        let dislikes = originalNPC ? (originalNPC.dislikes || []) : [];
        let tags = data.tags || [];

        // 2. 점수 계산
        let score = 0;
        let isLike = tags.some(t => likes.includes(t));
        let isDislike = tags.some(t => dislikes.includes(t));

        if (isLike) {
            score = 40; // 좋아하는 물건: 호감도 대폭 상승
            log(`🥰 효과가 굉장합니다! (취향 저격)`);
            playAnim(targetId, 'anim-bounce');
        } 
        else if (isDislike) {
            score = -30; // 싫어하는 물건: 멘탈 타격 (공포/혐오)
            log(`😱 기겁합니다! (약점 공략)`);
            playAnim(targetId, 'anim-hit');
        } 
        else {
            score = 10; // 그저 그런 물건: 소소한 호감
            log(`🙂 나쁘지 않은 반응입니다.`);
        }

        // 3. SP 변동 적용
        applySocialImpact(target, score);
        used = true;
    }
    
    // --- 2. 일반 사용 ---
    else if (data.usage === "consume") {
        switch (data.effect) {
            case "heal":
                let healAmt = Math.min(target.maxHp - target.hp, data.val);
                target.hp += healAmt;
                log(`🍷 [${name}] 사용! HP +${healAmt}`);
                playAnim(targetId, 'anim-bounce');
                used = true;
                break;
            case "damage":
                log(`🧴 [${name}] 투척! 적에게 ${data.val} 피해`);
                takeDamage(target, data.val);
                used = true;
                break;
            case "event_rest":
                game.forceRest = true;
                log(`🎼 [${name}] 사용. 다음은 휴식입니다.`);
                playAnim("player-char", 'anim-bounce');
                used = true;
                break;
        }
    }
   // 3. 소모 및 갱신
    if (used) {
        player.inventory.splice(index, 1); // 인벤토리에서 제거
        updateInventoryUI(); 
        updateUI();
    }
}
/* [수정] 인벤토리 UI 업데이트 (통합 리스트) */

    function updateInventoryUI() {
    const list = document.getElementById('inventory-list');
    document.getElementById('inv-count').innerText = player.inventory.length;
    list.innerHTML = "";

    player.inventory.forEach((name, idx) => { 
        let data = ITEM_DATA[name]; 
        let el = document.createElement('div'); 
        
        // 클래스: 기본 item-icon + 랭크 + 사용타입(passive/consumable)에 따른 스타일 구분
        el.className = `item-icon item-rank-${data.rank}`;
        el.id = `item-el-${idx}`;
        
        // 패시브 아이템은 테두리나 배경을 다르게 해서 시각적 구분
        if (data.usage === "passive") {
            el.style.borderColor = "#f39c12"; // 금색 테두리
            el.style.borderStyle = "double";
        } else {
            el.style.borderColor = "#555"; // 일반 테두리
        }
        
        el.innerHTML = `
            ${data.icon}
            <span class="tooltip">
                <b>${name}</b> <span style="font-size:0.8em; color:#aaa;">(${data.usage==="passive"?"패시브":"소모품"})</span><br>
                ${data.desc}<br>
                <span style='color:#f1c40f'>태그: ${data.tags ? data.tags.join(', ') : '-'}</span>
            </span>
            <div class="item-actions" id="item-actions-${idx}" style="display:none;">
                <button class="item-btn btn-confirm" onclick="confirmItemUse(event, ${idx})">V</button>
                <button class="item-btn btn-cancel" onclick="toggleItemSelect(event, ${idx})">X</button>
            </div>
        `;
        
        // 드래그 및 클릭 이벤트 (이전과 동일 로직이지만 대상 변수명만 변경)
        let isSocial = (game.state === "social");
        let isBattle = (game.state === "battle");
        let canUse = (data.usage === "consume"); // 소모품만 기본 사용 가능

        // 소셜 모드면 모든 아이템(패시브 포함) 선물 가능
        // 배틀 모드면 소모품 중 target!=passive 인 것만 가능
        let canDrag = (isSocial) || (isBattle && canUse && data.target !== 'passive');

        if (canDrag) {
            el.onmousedown = (e) => startDrag(e, idx, name, 'item');
            el.ontouchstart = (e) => startDrag(e, idx, name, 'item');
        } else if (!canUse && !isSocial) {
            // 패시브 아이템 클릭 시 (사용 불가 메시지 대신 정보 확인용으로 놔두거나)
            // 여기선 그냥 둠
        }
        
        // 클릭 시 메뉴 토글 (사용 가능한 경우만)
        // 패시브 아이템도 버리기 기능 등을 위해 메뉴는 뜨게 할 수 있음 (일단은 사용 가능할 때만 뜨게 설정)
        if (canDrag || canUse) {
            el.onclick = (e) => toggleItemSelect(e, idx);
        } else {
            // 패시브 아이템 클릭 시 "착용 중입니다" 로그
            el.onclick = () => log(`[${name}] 효과 적용 중.`);
        }

        list.appendChild(el);
    });
}

function openInventory() {
    updateInventoryUI();
    document.getElementById('inventory-overlay').classList.remove('hidden');
}

function closeInventory() {
    document.getElementById('inventory-overlay').classList.add('hidden');
}

// [수정] confirmItemUse도 useConsumable 대신 useItem을 호출하도록 변경
function confirmItemUse(e, idx) {
    e.stopPropagation();
    let name = player.inventory[idx]; // inventory 참조
    let data = ITEM_DATA[name];

    // ... (타겟팅 로직 동일) ...
    let target = player; 
    if (data.target === "enemy") target = enemies.find(en => en.hp > 0);

    useItem(idx, target); // useItem 호출
    toggleItemSelect(e, idx);
}
// [추가] 아이템 선택 토글 함수
function toggleItemSelect(e, idx) {
    e.stopPropagation(); // 이벤트 버블링 방지
    // 다른 열린 아이템 닫기
    document.querySelectorAll('.item-actions').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.item-icon').forEach(el => el.classList.remove('selected'));

    let actions = document.getElementById(`item-actions-${idx}`);
    let icon = document.getElementById(`item-el-${idx}`);
    
    if (actions.style.display === 'none') {
        actions.style.display = 'flex';
        icon.classList.add('selected');
    } else {
        actions.style.display = 'none';
        icon.classList.remove('selected');
    }
}
/* [수정] 탐사 화면 렌더링 (복귀 버튼 제어 추가) */
function renderExploration() {
    switchScene('exploration');
    
    // 잠금 해제
    game.inputLocked = false;
    document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = false);

    // 시나리오 데이터 확인
    const scData = game.scenario; // 현재 진행 중인 시나리오 상태 객체
    
    // 타이틀 등 UI 업데이트
    document.getElementById('scenario-title').innerText = `${scData.title} (${scData.location})`;
    document.getElementById('clue-bar').style.width = `${scData.clues}%`;
    document.getElementById('doom-bar').style.width = `${scData.doom}%`;
    
    // [NEW] 복귀 버튼 활성화/비활성화 처리
    const retreatBtn = document.getElementById('btn-retreat');
    if (retreatBtn) {
        // 시나리오 데이터에 canRetreat가 없거나 true면 -> 버튼 보이기 (기본값: 허용)
        // 명시적으로 false라고 적혀있을 때만 -> 숨기기
        if (scData.canRetreat !== false) {
            retreatBtn.style.display = "inline-block"; 
            retreatBtn.disabled = false;
        } else {
            retreatBtn.style.display = "none"; // 숨기기 (혹은 disabled)
            // retreatBtn.disabled = true; // 비활성화만 하려면 이걸 사용
            // retreatBtn.innerText = "🔒 봉쇄됨";
        }
    }
    
    // 보스전 체크
    if (game.scenario.clues >= 100 && !game.scenario.bossReady) {
        game.scenario.bossReady = true;
        showPopup("❗ 단서 확보 완료", "사건의 전말이 드러났습니다.<br>보스의 위치를 특정했습니다.", [
            {txt: "보스전 돌입", func: startBossBattle}
        ]);
    }

    updateUI(); 
}

/* [NEW] 복귀 확인 팝업 */
function confirmRetreat() {
    let msg = "탐사를 중단하고 사무소로 복귀하시겠습니까?";
    
    if (!game.scenario.isPatrol) {
        msg += "<br><span style='color:#e74c3c; font-size:0.8em;'>※ 현재 진행 중인 조사는 초기화됩니다.</span>";
    } else {
        msg += "<br><span style='color:#aaa; font-size:0.8em;'>(순찰 종료)</span>";
    }

    showPopup("🏠 복귀 확인", msg, [
        { 
            txt: "돌아가기", 
            func: () => { 
                closePopup();
                // 의뢰 중이었다면 중단 처리 (activeScenarioId는 유지하되, 진행도는 날아감)
                // 만약 '포기' 처리하고 싶으면 activeScenarioId = null로 하면 됨.
                // 여기서는 단순히 사무소로 복귀만 시킵니다.
                renderHub(); 
            }
        },
        { txt: "취소", func: closePopup }
    ]);
}

/* [수정] 탐사 행동 처리 (랜덤 이벤트 연결) */
function exploreAction(action) {
    if (game.inputLocked) return;
    const logBox = document.getElementById('loc-desc');
    let scData = SCENARIOS[game.scenario.id];

    if (action === 'investigate') {
        game.inputLocked = true;
        document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = true);
        
        // 확률 분포 조정
        // 전투(30%) | 소셜(20%) | 랜덤 이벤트(25%) | 시나리오 단서/파밍(25%)
        let roll = Math.random();
        
        if (roll < 0.3) { 
            // 1. 전투 (30%)
            logBox.innerHTML = "<span style='color:#e74c3c'>살기가 느껴집니다! 적과 마주쳤습니다!</span>";
            setTimeout(() => { game.inputLocked = false; startBattle(false); }, 800);
        } 
        else if (roll < 0.5) { 
            // 2. 소셜 (20%)
            logBox.innerHTML = "<span style='color:#3498db'>수상한 인물을 발견했습니다. 대화를 시도합니다.</span>";
            setTimeout(() => { 
                game.inputLocked = false; 
                let k = Object.keys(NPC_DATA); 
                startSocialBattle(k[Math.floor(Math.random() * k.length)]); 
            }, 800);
        } 
        else if (roll < 0.75) {
            // 3. [NEW] 랜덤 이벤트 (25%)
            logBox.innerHTML = "무언가 흥미로운 상황입니다...";
            setTimeout(() => {
                game.inputLocked = false;
                triggerRandomEvent(); // ★ 여기서 이벤트 발동!
                
            }, 800);
        }
        else {
            // 4. 단서/파밍 (25%)
            setTimeout(() => {
                game.inputLocked = false;
                if (scData && scData.clueEvents && !game.scenario.isPatrol) {
                    let evt = scData.clueEvents[Math.floor(Math.random() * scData.clueEvents.length)];
                    game.scenario.clues = Math.min(100, game.scenario.clues + evt.gain);
                    game.scenario.doom = Math.min(100, game.scenario.doom + 5);
                    logBox.innerHTML = `<span style='color:#f1c40f'>🔍 단서 발견!</span><br>${evt.text} (진척도 +${evt.gain}, 위협도 +5)`;
                } else {
                    let foundItem = null;
                    if (Math.random() < 0.4) { foundItem = getRandomItem(); addItem(foundItem); }
                    game.scenario.doom += 2;
                    let msg = foundItem ? `주변을 뒤져 <span style='color:#2ecc71'>[${foundItem}]</span>을(를) 발견했습니다!` : "주변을 샅샅이 뒤져보았습니다. 별다른 특이사항은 없습니다.";
                    logBox.innerHTML = `${msg} (위협도 +2)`;
                }
                renderExploration();
            }, 600);
        }
    }
    // --- [B] 휴식하기 (Rest) ---
    else if (action === 'rest') {
        game.inputLocked = true;
        logBox.innerHTML = "잠시 숨을 고릅니다...";
        
        setTimeout(() => {
            game.inputLocked = false;
            
            // 위협도 대폭 증가 (시간 많이 씀)
            game.scenario.doom = Math.min(100, game.scenario.doom + 10);
            
            // HP, SP 소량 회복
            let hpHeal = 5;
            let spHeal = 10;
            player.hp = Math.min(player.maxHp, player.hp + hpHeal);
            player.sp = Math.min(player.maxSp, player.sp + spHeal);
            
            logBox.innerHTML = `
                <span style='color:#2ecc71'>잠시 휴식을 취했습니다.</span><br>
                (체력 +${hpHeal}, 이성 +${spHeal}, 위협도 +10)
            `;
            
            renderExploration();
        }, 600);
    }
    // --- [C] 장소 이동 (Move) ---
    else if (action === 'move') {
        // 시나리오에 정의된 장소 목록 중 랜덤 이동 (분위기 전환용)
        if (scData && scData.locations) {
            let nextLoc = scData.locations[Math.floor(Math.random() * scData.locations.length)];
            
            // 같은 장소면 다시 뽑기 (선택사항)
            while(nextLoc === game.scenario.location && scData.locations.length > 1) {
                nextLoc = scData.locations[Math.floor(Math.random() * scData.locations.length)];
            }
            
            game.scenario.location = nextLoc;
            logBox.innerHTML = `[${nextLoc}]으로 이동했습니다. 주변을 둘러봅니다.`;
        } else {
            logBox.innerHTML = "이 구역의 다른 골목으로 이동했습니다.";
        }
        
        renderExploration();
    }
}
/* [수정] 전투 시작 함수 (턴 기록 초기화 추가) */
function startBattle(isBoss = false) {
    game.state = "battle"; 
    game.totalTurns = 0; 
    game.isBossBattle = isBoss;
    
    // [핵심 수정] 새 전투니까 '직전 턴 주인' 기록을 지워야 함
    game.turnOwner = "none";     
    game.lastTurnOwner = "none"; 

    // 플레이어 초기화
    player.drawPile = [...player.deck]; 
    shuffle(player.drawPile);
    player.discardPile = []; 
    player.exhaustPile = []; 
    player.hand = []; 
    player.buffs = {}; 
    player.block = 0; 
    player.lucky = false; 
    player.jumadeung = false; 
    player.ag = 0;
    
    renderHand();

    enemies = [];
    
    // 보스/일반 적 생성 로직 (기존과 동일)
    if (isBoss) {
        let scId = game.scenario.id;
        let bossId = SCENARIOS[scId] ? SCENARIOS[scId].boss : "boss_gang_leader";
        let data = ENEMY_DATA[bossId];
        
        enemies.push({
            id: 0, name: data.name, maxHp: data.baseHp, hp: data.baseHp, 
            baseAtk: data.stats.atk, baseDef: data.stats.def, baseSpd: data.stats.spd,
            block: 0, buffs: {}, deck: (data.deckType === "custom") ? data.deck : getEnemyDeck(data.deckType),
            img: data.img, ag: 0 
        });
        log(`⚠️ <b>${data.name}</b> 출현! 목숨을 걸어라!`);
    } else {
        let enemyCount = (Math.random() < 0.5) ? 2 : 1; 
        const enemyKeys = Object.keys(ENEMY_DATA).filter(k => !k.startsWith("boss_"));
        
        for (let i = 0; i < enemyCount; i++) {
            let key = enemyKeys[Math.floor(Math.random() * enemyKeys.length)]; 
            let data = ENEMY_DATA[key]; 
            let growthMult = game.level - 1;
            
            let maxHp = Math.floor(data.baseHp + (data.growth.hp * growthMult)); 
            let atk = Math.floor(data.stats.atk + (data.growth.atk * growthMult));
            let def = Math.floor(data.stats.def + (data.growth.def * growthMult)); 
            let spd = Math.floor(data.stats.spd + (data.growth.spd * growthMult));
            
            enemies.push({ 
                id: i, name: `${data.name} ${String.fromCharCode(65+i)}`, 
                maxHp: maxHp, hp: maxHp, baseAtk: atk, baseDef: def, baseSpd: spd, 
                block: 0, buffs: {}, deck: getEnemyDeck(data.deckType), img: data.img, 
                ag: Math.floor(Math.random() * 150) 
            });
        }
    }
    
    switchScene('battle'); 
    renderEnemies(); 
    updateUI(); 
    processTimeline();
}

/* [NEW] 보스전 시작 래퍼 */
function startBossBattle() {
    closePopup();
    startBattle(true);
}

/* [수정] 전투 승리 후 이동 로직 */
function nextStepAfterWin() {
    closePopup();

    if (game.isBossBattle) {
        // [수정] 보스전 승리 -> 결과 정산 화면으로 이동
        renderResultScreen();
    } 
    else if (game.scenario && game.scenario.isPatrol) {
    
        player.gold += 100; // 순찰 보상
        renderCityMap();
    }
    else {
        // 일반 시나리오 전투 -> 탐사 화면 복귀
        let clueGain = 10;
        game.scenario.clues = Math.min(100, game.scenario.clues + clueGain);
        renderExploration();
        
        // 탐사 화면 텍스트 업데이트
        const logBox = document.getElementById('loc-desc');
        if(logBox) {
            logBox.innerHTML = 
                `<span style='color:#2ecc71'>적들을 제압하고 무사히 복귀했습니다.</span><br>` +
                `<span style='color:#f1c40f'>단서를 일부 확보했습니다. (진척도 +${clueGain})</span>`;
        }
    }
}

async function processTimeline() {
    if (checkGameOver()) return;

    // 1. 현재 턴을 잡을 수 있는 후보 찾기 (AG >= 1000)
    // 후보가 여러 명이면 AG가 가장 높은 순서대로 (오버플로우 고려)
    let candidates = [];
    
    // 플레이어 체크
    if (player.ag >= game.AG_MAX) candidates.push({ unit: player, type: 'player', ag: player.ag });
    // 적 체크
    enemies.forEach(e => {
        if (e.hp > 0 && e.ag >= game.AG_MAX) candidates.push({ unit: e, type: 'enemy', ag: e.ag });
    });

    // 2. 턴 대상자가 있다면 행동 개시
    if (candidates.length > 0) {
        // AG가 가장 높은 유닛이 우선권을 가짐
        candidates.sort((a, b) => b.ag - a.ag);
        let winner = candidates[0];

        // 턴 시작 처리
        await startTurn(winner.unit, winner.type);
        return;
    }

    // 3. 턴 대상자가 없다면 시간을 흘려보냄 (Tick)
    // 모든 유닛의 AG에 자신의 속도(Spd)를 더함
    // 시각적 연출을 위해 조금씩 더하는 게 좋지만, 로직 단순화를 위해 한 번에 계산
    // "가장 빠른 녀석이 목표에 도달할 때까지" 시간을 점프시킵니다.
    
    // (1) 현재 가장 AG가 높은 비율을 계산해서 한 번에 점프할 수도 있지만,
    // 간단하게 Tick 단위(예: 속도의 10%)로 반복해서 더함
    while (true) {
        let anyoneReady = false;
        
        // 플레이어 AG 증가
        let pSpd = getStat(player, 'spd');
        player.ag += pSpd;
        if (player.ag >= game.AG_MAX) anyoneReady = true;

        // 적 AG 증가
        enemies.forEach(e => {
            if (e.hp > 0) {
                let eSpd = getStat(e, 'spd');
                e.ag += eSpd;
                if (e.ag >= game.AG_MAX) anyoneReady = true;
            }
        });

        // 누군가 준비되었으면 루프 종료하고 재귀 호출 -> 1번 단계에서 걸림
        if (anyoneReady) {
            updateUI(); // 게이지 차는 거 갱신
            processTimeline(); // 다시 체크
            return;
        }
    }
}
/* [수정] 유닛 턴 시작 (인내심 감소 로직 추가) */
async function startTurn(unit, type) {
// [NEW] 턴 넘기기 전에, 방금 누가 했는지 기록
game.lastTurnOwner = game.turnOwner; // 직전 턴 기록
    game.turnOwner = type;
    game.totalTurns++;
    
    // 인내심 처리 (소셜 모드 & 적 턴일 때)
    if (game.state === "social" && type === "enemy") {
        if (unit.patience !== undefined) {
            // [NEW] 분노 상태면 인내심이 2씩 감소, 아니면 1씩 감소
            let decrement = unit.buffs["분노"] ? 2 : 1;
            
            unit.patience -= decrement;
            
            let statusMsg = unit.buffs["분노"] ? " (😡분노로 인해 빠르게 감소!)" : "";
            log(`💢 [${unit.name}]의 인내심이 ${decrement} 줄어듭니다.${statusMsg} (남은 턴: ${unit.patience})`);
            
            if (unit.patience <= 0) {
                updateUI();
                showPopup("🖐️ 대화 결렬", `"${unit.name}"이(가) 더 이상 당신의 말을 듣지 않습니다.<br>협상이 불가능해졌습니다.`, [
                    { txt: "무력 행사 (전투 돌입)", func: () => { closePopup(); forcePhysicalBattle(); }},
                    { txt: "도망치기 (패널티)", func: () => { closePopup(); escapeSocialBattle(); }}
                ]);
                return; // 턴 진행 중단
            }
        }
    }

    tickBuffs(unit); 
    decrementBuffs(unit);
    
    if (checkGameOver()) return;
    if (unit.hp <= 0 && game.state !== 'social') { // 소셜모드 아닐때 죽음 체크
        processTimeline(); 
        return; 
    }

    unit.ag -= game.AG_MAX;
    updateUI();

    if (type === 'player') {
        startPlayerTurnLogic();
    } else {
        game.currentActorId = unit.id;
        await startEnemyTurnLogic(unit);
    }
}
// 적들의 HTML 뼈대를 만드는 함수
function renderEnemies() {
    const wrapper = document.getElementById('enemies-area');
    wrapper.innerHTML = ""; // 초기화

    enemies.forEach(e => {
        let el = document.createElement('div');
        el.className = 'enemy-unit';
        el.id = `enemy-unit-${e.id}`; // 예: enemy-unit-0
        
        // 내부는 updateUI에서 수치와 함께 채워집니다.
        // 여기서는 이미지 태그 등 기본 구조만 잡아도 되지만, 
        // 편의상 updateUI가 내용을 다 덮어쓰도록 비워둡니다.
        
        wrapper.appendChild(el);
    });
}

/* [수정] 플레이어 행동 개시 (연속 턴 방어도 유지) */
function startPlayerTurnLogic() {
    // [핵심 변경] 직전 턴이 플레이어가 아니었을 때만 방어도 초기화
    // 즉, 적이 행동하고 내 차례가 되면 방어도가 사라지지만,
    // 내가 행동하고 또 바로 내 차례가 오면(속도 차이) 방어도가 유지됨.
    if (game.lastTurnOwner !== 'player') {
        player.block = 0; 
    } else {
        log("⚡ 연속 행동! 방어도가 유지됩니다.");
    }

    player.ap = 3; 
    drawCards(5); 

    document.getElementById('end-turn-btn').disabled = false;
    document.getElementById('turn-info').innerText = `나의 턴 (AP: ${player.ap})`;
    
    document.getElementById('player-char').classList.add('turn-active'); 
    document.querySelectorAll('.enemy-unit').forEach(e => e.classList.remove('turn-active'));
    
    updateTurnOrderList(); 
}

/* [수정] 플레이어 턴 종료 버튼 클릭 시 */
function endPlayerTurn() {
    document.getElementById('end-turn-btn').disabled = true;
    
    // 패 버리기
    if (player.hand.length > 0) { 
        player.discardPile.push(...player.hand); 
        player.hand = []; 
    }
    renderHand(); 

    document.getElementById('player-char').classList.remove('turn-active');
    
    // ★ 중요: 내 행동이 끝났으니 다시 타임라인을 돌립니다.
    // 만약 내 속도가 압도적이라 AG가 1000 이상 남았다면? processTimeline이 즉시 나를 다시 호출함 (연속 턴)
    processTimeline();
}

/* [수정] 적 AI 로직 (종료 조건 100으로 변경) */
async function startEnemyTurnLogic(actor) {
    actor.block = 0; 
    actor.ap = 2; 
    
    let el = document.getElementById(`enemy-unit-${actor.id}`);
    if(el) el.classList.add('turn-active');
    
    try {
        while (actor.ap > 0) {
            if (game.state === "social") {
                // [변경] 200 -> 100
                if (player.sp <= 0 || actor.hp <= 0 || actor.hp >= 100) break;
            } else {
                if (player.hp <= 0 || actor.hp <= 0) break;
            }

            await sleep(800);

            // (카드 선택 및 사용 로직 기존과 동일)
            let cName = actor.deck[Math.floor(Math.random() * actor.deck.length)];
            let cData = CARD_DATA[cName];
            if (game.state === "battle" && cData.type === "social") cName = "타격"; 
            else if (game.state === "social" && cData.type !== "social") cName = "횡설수설"; 

            actor.ap--; 
            useCard(actor, player, cName); 
            
            updateUI(); 
            if (checkGameOver()) return; 
        }
    } catch (err) {
        console.error("적 턴 에러:", err);
    } finally {
        if(el) el.classList.remove('turn-active');
        await sleep(500);
        processTimeline();
    }
}

/* [수정] useCard: 방어 로그 텍스트 분기 처리 */
function useCard(user, target, cardName) {
    let data = CARD_DATA[cardName];
    let userId = (user === player) ? "player-char" : `enemy-unit-${user.id}`;
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;

    log(`🃏 [${cardName}] 사용!`);

    // [CASE 0] 소셜 카드 (대화)
    if (data.type === "social") {
        playAnim(userId, 'anim-bounce');
        
        if (data.special === "gamble" && Math.random() < 0.3) {
             log("💦 실패! 내 멘탈이 흔들립니다. (-10)");
             if(user === player) {
                 player.sp -= 10;
                 updateUI();
             }
             return;
        }

        let val = data.val;
        
        // 방어(마음의 벽) 계산
        if (target.block > 0) {
            let absorb = Math.min(target.block, Math.abs(val));
            target.block -= absorb;
            if (val > 0) val -= absorb; 
            else val += absorb;         
            
            log(`🛡️ 상대의 마음의 벽이 ${absorb}만큼 막아냈습니다.`);
        }

        if (val !== 0) {
            if (target === player) {
                player.sp += val; 
            } else {
                target.hp += val; 
            }
            
            if (val > 0) {
                log(`🥰 설득 시도! SP +${val}`);
                showDamageText(target, `❤️+${val}`);
                playAnim(targetId, 'anim-bounce');
            } else {
                log(`👿 위압감 조성! SP ${val}`); 
                showDamageText(target, `💔${val}`);
                playAnim(targetId, 'anim-hit');
            }
        }
        updateUI();
    }
    // [CASE 1] 일반/공격 카드
    else {
        if (data.special === "summon") {
            // 1. 플레이어가 사용한 경우 (현재는 막힘/대체 효과)
            if (user === player) {
                log("🚫 플레이어는 부하를 부를 수 없습니다. (카드 효과 불발)");
                // 추후 구현: "그림자 분신" 같은 걸로 대체 가능
                // summonMinion("shadow_clone"); 
                return; 
            } 
            // 2. 적(보스)이 사용한 경우
            else {
                playAnim(userId, 'anim-bounce'); // 보스가 명령 내리는 모션
                summonMinion(data.summonTarget); // 데이터에 지정된 몬스터("불량배") 소환
            }
        }
        
        if (data.type.includes("attack")) {
            if (user === player) playAnim(userId, 'anim-atk-p');
            else playAnim(userId, 'anim-atk-e');

            if (data.special === "break_block") { target.block = 0; log(`🔨 방어 파괴!`); }
            
            let finalDmg = (data.dmg || 0) + getStat(user, 'atk');
            takeDamage(target, finalDmg); 
        } 
        else {
            playAnim(userId, 'anim-bounce');
        }
// [NEW] 상태이상 해제 (진정시키기)
        if (data.special === "cure_anger") {
            if (target.buffs["분노"]) { delete target.buffs["분노"]; log("😌 상대가 분노를 가라앉혔습니다."); }
            if (target.buffs["우울"]) { delete target.buffs["우울"]; log("😐 상대가 평정심을 찾았습니다."); }
        }
        // 2. 방어 (Block) 로그 수정
        if (data.block) {
            let finalBlock = data.block + getStat(user, 'def');
            user.block += finalBlock;
            
            // [핵심 변경] 모드에 따라 텍스트 다르게 출력
            let defenseText = (game.state === "social") ? "멘탈 방어" : "방어도";
            log(`🛡️ ${defenseText} +${finalBlock}`);
        }

        if (data.buff) {
            let buffName = data.buff.name;
            let buffTarget = (data.target === "self" || ["강화","건강","쾌속"].includes(buffName)) ? user : target;
            applyBuff(buffTarget, buffName, data.buff.val);
        }
        
        if (data.draw && user === player) {
            drawCards(data.draw);
            log(`🃏 카드를 ${data.draw}장 뽑았습니다.`);
        }
    }
}

/* [NEW] 적 소환(증원) 함수 */
function summonMinion(enemyKey) {
    // 1. 소환 제한 확인 (화면에 적이 너무 많으면 소환 실패)
    // 죽은 적은 제외하고 산 적만 카운트 (최대 3~4명 제한 추천)
    let aliveCount = enemies.filter(e => e.hp > 0).length;
    if (aliveCount >= 3) {
        log("🚫 전장이 꽉 차서 더 이상 소환할 수 없습니다!");
        return;
    }

    let data = ENEMY_DATA[enemyKey];
    if (!data) return;

    // 2. 새 ID 부여 (기존 ID 중 가장 큰 값 + 1)
    // enemies 배열이 비어있을 리는 없지만(보스가 있으니), 안전하게 처리
    let maxId = enemies.reduce((max, cur) => Math.max(max, cur.id), -1);
    let newId = maxId + 1;

    // 3. 레벨 스케일링 (startBattle의 로직과 비슷하게)
    let growthMult = game.level - 1;
    let maxHp = Math.floor(data.baseHp + (data.growth.hp * growthMult));
    let atk = Math.floor(data.stats.atk + (data.growth.atk * growthMult));
    let def = Math.floor(data.stats.def + (data.growth.def * growthMult));
    let spd = Math.floor(data.stats.spd + (data.growth.spd * growthMult));

    // 4. 새 적 객체 생성
    let newEnemy = {
        id: newId,
        name: `${data.name} (증원)`, // 이름 뒤에 표식 추가
        maxHp: maxHp, hp: maxHp,
        baseAtk: atk, baseDef: def, baseSpd: spd,
        block: 0, buffs: {}, 
        deck: getEnemyDeck(data.deckType), // 덱 생성
        img: data.img,
        ag: 0 // 행동 게이지 0부터 시작 (바로 턴 잡지 않음)
    };

    // 5. 배열 추가 및 화면 갱신
    enemies.push(newEnemy);
    
    // UI 전체 다시 그리기 (새로운 적의 HTML 요소를 생성하기 위해)
    renderEnemies();
    updateUI();
    
    // 등장 애니메이션 효과 (CSS 클래스 활용)
    setTimeout(() => {
        let el = document.getElementById(`enemy-unit-${newId}`);
        if(el) {
            el.style.animation = "float-up 0.5s reverse forwards"; // 위에서 아래로 떨어지거나 나타나는 연출
            showDamageText(newEnemy, "APPEAR!");
        }
    }, 100);

    log(`📢 <b>${data.name}</b>이(가) 증원되었습니다!`);
}

/* [수정] 데미지 처리 함수 (소셜 모드 완벽 지원) */
function takeDamage(target, dmg) {
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;
    
    // 1. 방어(멘탈 방어) 계산
    if (target.block > 0) {
        if (target.block >= dmg) {
            target.block -= dmg;
            dmg = 0; 
            showDamageText(target, "BLOCK");
        } else {
            dmg -= target.block;
            target.block = 0; 
        }
    }

    // 2. 실제 피해 적용 및 시각 효과
    if (dmg > 0) {
        playAnim(targetId, 'anim-hit');
        
        // [핵심] 게임 모드에 따른 분기
        if (game.state === "social") {
            // 소셜 모드: 무조건 SP(멘탈) 피해
            if (target === player) {
                target.sp -= dmg;
                log(`🧠 내 멘탈 피해 -${dmg}! (SP: ${target.sp})`);
                showDamageText(target, `💔-${dmg}`); // 멘탈 깨지는 연출
            } else {
                // 적(NPC)의 SP를 깎음 (협박/공포) -> 0 방향으로 이동
                target.hp -= dmg; 
                log(`👿 적 멘탈 타격! -${dmg} (SP: ${target.hp})`);
                showDamageText(target, `💔-${dmg}`);
            }
        } 
        else {
            // 일반 전투: HP 피해
            target.hp -= dmg;
            log(`💥 체력 피해 -${dmg}! (HP: ${target.hp})`);
            showDamageText(target, `💥-${dmg}`);
        }
    }
    
    updateUI();

    // 3. 사망/패배 체크 (즉시 호출하지 않고 checkGameOver가 턴 루프에서 감지하게 함)
    // 단, 플레이어 주마등 처리는 즉시 해야 함
    if (game.state !== "social" && target === player && target.hp <= 0) {
        if (!target.jumadeung) { 
            target.hp=1; 
            target.jumadeung=true; 
            log("⚡ [주마등] 버티기!"); 
            updateUI(); 
        }
    }
}
/* [수정] 승패 판정 로직 (전체 코드) */
function checkGameOver() {
if (game.state !== "social" && player.hp <= 0) { 
        showPopup("💀 사망", "체력이 다했습니다...<br>차가운 도시의 바닥에서 눈을 감습니다.", [{txt:"다시 하기", func: ()=>location.reload()}]); 
        return true; 
    }
    
    if (game.state === "social") {
        if (player.sp <= 0) {
            showPopup("😵 멘탈 붕괴", "정신적 충격으로 대화를 이어갈 수 없습니다...<br>(SP 0 도달)", [{txt:"다시 하기", func: ()=>location.reload()}]);
            return true;
        }

        let npc = enemies[0]; 
        if (!npc) return false;

        // [변경] 설득 성공 기준: 100 이상
        if (npc.hp >= 100) { 
            game.winMsg = `<span style='color:#3498db'>🤝 설득 성공!</span><br>${npc.name}의 마음을 완전히 열었습니다.`;
            endSocialBattle(true);
            return true;
        } 
        // 굴복 기준: 0 이하 (동일)
        else if (npc.hp <= 0) { 
            game.winMsg = `<span style='color:#e74c3c'>😱 굴복 성공!</span><br>${npc.name}은(는) 공포에 질려 입을 열었습니다.`;
            endSocialBattle(true);
            return true;
        }
    }

    // 3. [일반 전투] 승리 판정 (적 전멸)
    else if (game.state === "battle") {
        // 모든 적의 HP가 0 이하인지 확인
        if (enemies.every(e => e.hp <= 0)) {
            // 중복 승리 처리 방지
            if(game.state === "win") return true; 
            
            game.state = "win";
            
            // --- 보상 계산 ---
            // 1. 골드 (럭키피스 카드 효과가 있다면 2배)
            let rewardGold = 1000 * (player.lucky ? 2 : 1); 
            player.gold += rewardGold; 
            
            // 2. 경험치 (기본 40 + 레벨당 10)
            let gainXp = 40 + (game.level * 10);
            player.xp += gainXp;
            
            // 승리 메시지 생성
            game.winMsg = `승리! <span style="color:#f1c40f">${rewardGold}G</span>, <span style="color:#3498db">${gainXp} XP</span> 획득.`; 
            if (player.lucky) game.winMsg += " (🍀럭키피스 효과!)";
            
            // 3. 전리품(아이템) 드랍 (확률 50%)
            game.pendingLoot = null;
            if (Math.random() < 0.5) { 
                game.pendingLoot = getRandomItem(); 
                game.winMsg += `<br>✨ 전리품이 바닥에 떨어져 있습니다.`; 
            }
            
            updateUI(); 
            renderWinPopup(); // 승리 팝업 호출
            return true;
        }
    }
    
    return false; // 게임이 아직 끝나지 않음
}
/* [NEW] 소셜 배틀 종료 처리 */
function endSocialBattle(success) {
    if (game.state === "win") return;
    game.state = "win";
    
    // 보상: 대량의 단서
    let clueGain = 25;
    game.scenario.clues = Math.min(100, game.scenario.clues + clueGain);
    
    // UI 갱신 후 팝업
    updateUI();
    showPopup("대화 종료", game.winMsg + `<br><br><b>단서 획득 (+${clueGain})</b>`, [
        { txt: "떠나기", func: nextStepAfterWin } // 기존 복귀 함수 재사용
    ]);
}

/* [NEW] 무력 행사 확인 팝업 */
function confirmForceBattle() {
    showPopup("👊 무력 행사", "대화를 중단하고 공격하시겠습니까?<br><span style='color:#e74c3c; font-size:0.8em;'>※ 적이 전투 태세를 갖춥니다.</span>", [
        { txt: "공격 개시!", func: () => { closePopup(); forcePhysicalBattle(); }},
        { txt: "취소", func: closePopup }
    ]);
}

/* [수정] 소셜 -> 물리 전투 전환 함수 (NPC 데이터 로드) */
function forcePhysicalBattle() {
    let currentEnemy = enemies[0];
    if (!currentEnemy) return;

    // NPC 원본 데이터 찾기
    // (이름으로 매칭. 만약 '부패 경찰 A' 처럼 변형되었다면 split 필요하지만 소셜은 보통 1:1이라 이름 그대로 씀)
    let npcData = NPC_DATA[currentEnemy.name];
    
    if (!npcData || !npcData.battle) {
        log("🚫 전투 데이터가 없는 NPC입니다.");
        return;
    }

    log("⚔️ <b>협상 결렬! 적이 무기를 꺼내 듭니다!</b>");
    
    // 1. 모드 변경
    game.state = "battle";
    
    // 2. 플레이어 덱 복구 (전투 덱으로)
    player.drawPile = [...player.deck];
    shuffle(player.drawPile);
    player.discardPile = [];
    player.exhaustPile = [];
    player.hand = [];
    player.block = 0; // 방어도 초기화
    renderHand(); 

    // 3. [핵심] 적 상태를 '전투 모드'로 변신
    let bData = npcData.battle;
    
    currentEnemy.maxHp = bData.maxHp;
    currentEnemy.hp = bData.maxHp;
    
    currentEnemy.baseAtk = bData.stats.atk;
    currentEnemy.baseDef = bData.stats.def;
    currentEnemy.baseSpd = bData.stats.spd;
    
    currentEnemy.deck = bData.deck; // 전투용 덱 장착
    
    // 소셜 속성 제거 (깔끔하게)
    delete currentEnemy.maxSp;
    delete currentEnemy.patience; 
    
    // 4. UI 갱신 및 전투 재개
    updateUI();
    
    // 플레이어 선공 보너스 (기습)
    player.ag = game.AG_MAX; 
    processTimeline();
}

/* --- 이벤트 및 상점 --- */
/* [수정] runRandomEvent 함수 */
function runRandomEvent() {
    if (game.forceRest) {
        game.forceRest = false;
        
        game.hasRested = false; // [NEW] 휴식 여부 초기화
        renderRestScreen();
        return;
    }

    let rand = Math.random();
    if (rand < 0.6) {
        startBattle();
    } else if (rand < 0.8) {
        game.hasRested = false; // [NEW] 휴식 여부 초기화
        renderRestScreen();
    } else {
        renderShopScreen();
    }
}
/* [수정] renderRestScreen 함수 전체 교체 */
function renderRestScreen() {
    switchScene('event');
    const container = document.getElementById('event-content-box');
    
    // 휴식 버튼 HTML 생성 (상태에 따라 다름)
    let restBtnHTML = "";
    if (!game.hasRested) {
        // 아직 휴식 안 함: 버튼 활성화
        restBtnHTML = `<button class="action-btn" onclick="restAction()">😴 쉬기 (50% 회복)</button>`;
    } else {
        // 이미 휴식 함: 버튼 대신 텍스트 표시
        restBtnHTML = `<button class="action-btn" disabled style="background:#555; cursor:default;">✅ 휴식 완료</button>`;
    }

    container.innerHTML = `
        <div class="event-title">🔥 휴식처</div>
        <div class="event-desc">
            따뜻한 모닥불이 있습니다.<br>
            잠시 쉬어가거나 정비를 할 수 있습니다.<br><br>
            <span style="color:#e74c3c">현재 HP: ${player.hp} / ${player.maxHp}</span>
        </div>
        
        <div style="display:flex; justify-content:center; gap:20px;">
            ${restBtnHTML}
            <button class="action-btn" style="background:#7f8c8d" onclick="startBattle()">👣 떠나기</button>
        </div>
        
        <div style="margin-top:20px; font-size:0.9em; color:#aaa;">
            (떠나기 전에 인벤토리의 아이템을 사용할 수 있습니다)
        </div>
    `;
}
/* [수정] 휴식 로직 (SP 회복 추가) */
function restAction() {
    let maxHeal = Math.floor(player.maxHp / 2);
    let missingHp = player.maxHp - player.hp;
    let actualHeal = Math.min(maxHeal, missingHp);
    
    // [NEW] 이성(SP)도 회복
    let spHeal = 30;
    player.sp = Math.min(player.maxSp, player.sp + spHeal);
    
    player.hp += actualHeal;
    game.hasRested = true; 
    
    updateUI();
    
    showPopup("휴식 완료", `체력이 ${actualHeal}, 이성이 ${spHeal}만큼 회복되었습니다.<br>이제 출발 준비가 되셨나요?`, [
        {
            txt: "확인", 
            func: () => {
                closePopup();
                renderRestScreen(); 
            }
        }
    ]);
}
/* [수정] 상점 화면 렌더링 (인터넷 상점 추가) */
function renderShopScreen(shopType = "shop_black_market") {
    switchScene('event');
    
    // 1. 상점 설정 (기본값)
    let shopTitle = "상점";
    let shopDesc = "물건을 보고 가세요.";
    let poolRank = 1; 
    let cardCount = 3;
    let itemCount = 2;
    
    // 2. 타입별 설정
    if (shopType === "shop_black_market") {
        shopTitle = "💀 뒷골목 암시장";
        shopDesc = "출처는 묻지 마쇼. 싸게 넘길 테니.";
        poolRank = 1; 
    } else if (shopType === "shop_pharmacy") {
        shopTitle = "💊 24시 드럭스토어";
        shopDesc = "회복약과 생필품이 있습니다.";
        poolRank = 1; 
    } else if (shopType === "shop_high_end") {
        shopTitle = "💎 아라사카 부티크";
        shopDesc = "최고급 장비만을 취급합니다. 가격은 비쌉니다.";
        poolRank = 2; 
    } 
    // [NEW] 인터넷 상점 추가
    else if (shopType === "shop_internet") {
        shopTitle = "📦 익명 배송 센터";
        shopDesc = "집에서 편하게 주문하세요. (배송비 포함 가격)";
        poolRank = 1;
        itemCount = 3; // 인터넷은 물건 종류가 더 많음
    }

    // 3. 물품 생성
    let cardsForSale = [];
    for(let i=0; i<cardCount; i++) cardsForSale.push(getRandomCardByRank(poolRank + (Math.random()>0.7?1:0)));
    
    let itemsForSale = [];
    for(let i=0; i<itemCount; i++) itemsForSale.push(getRandomItem());

    // 4. 카드 제거 비용
    let removeCost = 200 + (player.deck.length * 10); 

    // 5. HTML 생성
    const container = document.getElementById('event-content-box');
    container.innerHTML = `
        <div class="event-title">${shopTitle}</div>
        <div class="event-desc">${shopDesc}<br><span style="color:#f1c40f; font-weight:bold;">소지금{player.gold} 원</span></div>
        
        <h3 style="margin:10px 0; border-bottom:1px solid #555;">🃏 기술 교본</h3>
        <div class="shop-items" id="shop-cards"></div>

        <h3 style="margin:10px 0; border-bottom:1px solid #555;">🎒 장비 및 도구</h3>
        <div class="shop-items" id="shop-items"></div>

        <h3 style="margin:10px 0; border-bottom:1px solid #555;">🛠️ 서비스</h3>
        <div style="display:flex; justify-content:center; gap:20px; margin-bottom:20px;">
            <div class="shop-item" onclick="openCardRemoval(${removeCost})">
                <div style="background:#c0392b; width:120px; padding:15px; border-radius:8px;">
                    <div style="font-size:2em;">🔥</div>
                    <b>기술 망각</b>
                </div>
                <div class="shop-price">${removeCost} G</div>
            </div>
        </div>

        <button class="action-btn" onclick="${shopType === 'shop_internet' ? 'renderHub()' : 'renderCityMap()'}" style="background:#7f8c8d; margin-top:20px;">나가기</button>
    `;

    // 물품 렌더링
    const cardContainer = document.getElementById('shop-cards');
    cardsForSale.forEach(cName => {
        let data = CARD_DATA[cName];
        let price = data.rank * 150 + Math.floor(Math.random()*50);
        
        // [가격 정책]
        if (shopType === "shop_high_end") price *= 2; 
        if (shopType === "shop_black_market") price = Math.floor(price * 0.8);
        if (shopType === "shop_internet") price = Math.floor(price * 1.1); // 배송비 10% 추가

        let el = document.createElement('div');
        el.className = "shop-item";
        el.innerHTML = `
            <div class="card" style="transform:scale(0.8);">
                <div class="card-cost">${data.cost}</div>
                <div class="card-rank">${"★".repeat(data.rank)}</div>
                <div class="card-name">${cName}</div>
                <div class="card-desc">${applyTooltip(data.desc)}</div>
            </div>
            <div class="shop-price">${price} G</div>
        `;
        el.onclick = () => buyShopItem(el, 'card', cName, price);
        cardContainer.appendChild(el);
    });

    const itemContainer = document.getElementById('shop-items');
    itemsForSale.forEach(iName => {
        let data = ITEM_DATA[iName];
        let price = data.price;
        
        // [가격 정책]
        if (shopType === "shop_black_market") price = Math.floor(price * 0.7); 
        if (shopType === "shop_high_end") price = Math.floor(price * 1.5);
        if (shopType === "shop_internet") price = Math.floor(price * 1.1); // 배송비 10% 추가

        let el = document.createElement('div');
        el.className = "shop-item";
        el.innerHTML = `
            <div class="item-icon item-rank-${data.rank}" style="width:60px; height:60px; font-size:1.5em;">
                ${data.icon}
            </div>
            <div class="shop-price">${price} G</div>
            <div style="font-size:0.8em; margin-top:5px;">${iName}</div>
        `;
        el.onclick = () => buyShopItem(el, 'item', iName, price);
        itemContainer.appendChild(el);
    });
}
/* [수정] 아이템 구매 로직 */
function buyShopItem(el, type, name, cost) {
    if (el.classList.contains('sold-out')) return;
    if (player.gold < cost) { 
        alert("소지금이니다."); 
        return; 
    }
    
    // 인벤토리 체크
    if (type === 'item' && player.inventory.length >= player.maxInventory) {
        alert("가방이 꽉 찼습니다.");
        return;
    }

    player.gold -= cost;
    el.classList.add('sold-out');
    el.style.opacity = 0.5; // 시각적 품절 처리

    if (type === 'card') {
        // 구매한 카드는 바로 덱이 아니라 '보관함(Storage)'으로 가는 게 안전
        player.storage.push(name);
        alert(`[${name}] 구매 완료! 보관함으로 이동되었습니다.`);
    } else {
        player.inventory.push(name);
        alert(`[${name}] 구매 완료!`);
    }
    
    updateInventoryUI();
    updateUI();
}
/* [NEW] 카드 제거 서비스 UI */
function openCardRemoval(cost) {
    if (player.gold < cost) {
        alert("소지금이 부족합니다.");
        return;
    }

    // 덱 목록 보여주기 (클릭 시 삭제)
    let content = `<div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">`;
    
    player.deck.forEach((cName, idx) => {
        content += `
            <button onclick="processCardRemoval(${idx}, ${cost})" class="small-btn" style="width:80px; height:100px; background:#eee; color:#333; display:flex; flex-direction:column; justify-content:center; align-items:center; border:2px solid #c0392b;">
                <b>${cName}</b>
                <span style="font-size:0.7em; margin-top:5px; color:#555;">제거하기</span>
            </button>
        `;
    });
    content += `</div>`;

    showPopup("🔥 기술 망각", "제거할 카드를 선택하세요. (되돌릴 수 없습니다)", [
        {txt: "취소", func: closePopup}
    ], content);
}

/* [NEW] 실제 카드 삭제 로직 */
function processCardRemoval(idx, cost) {
    if (player.deck.length <= 5) {
        alert("최소 5장의 카드는 남겨야 합니다.");
        return;
    }

    let removed = player.deck.splice(idx, 1)[0];
    player.gold -= cost;
    
    closePopup();
    alert(`[${removed}] 카드를 태워버렸습니다.`);
    
    // 상점 화면 갱신 (돈 줄어든 거 반영)
    // 현재 상점 타입을 알기 어려우므로 간단히 다시 렌더링하거나 UI만 업데이트
    updateUI();
    // 상점 화면을 유지하고 싶다면 renderShopScreen을 다시 호출해야 하는데 type을 기억해야 함.
    // 여기선 간단히 닫고 끝내거나, 편의상 암시장으로 리로드 (개선 포인트)
    renderShopScreen("shop_black_market"); // 임시: 무조건 암시장 리로드 (실제론 타입 변수 저장 필요)
}
/* [수정] 화면 전환 함수 (result 추가) */
function switchScene(sceneName) {
    // 1. 모든 장면 숨기기
    const scenes = [
        'hub-scene', 'city-scene', 'exploration-scene', 
        'battle-scene', 'event-scene', 'deck-scene', 
        'result-scene', 'story-scene' 
    ];

    scenes.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    document.getElementById('popup-layer').style.display = 'none';
    
    // 2. 선택된 장면만 보여주기
    let targetId = sceneName + '-scene';
    let targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.remove('hidden');
    
    updateUI();
}

/* [수정] 결과 화면 렌더링 (상태값 설정 추가) */
function renderResultScreen() {
    // [핵심] 현재 상태를 'result'로 설정 (getCardReward가 알 수 있게)
    game.state = "result"; 
    
    switchScene('result');
    
    // 시나리오 정보가 없더라도 결과 처리가 멈추지 않도록 안전하게 처리
    const scId = (game.scenario && game.scenario.id) || game.activeScenarioId;
    let rewardData = (scId && SCENARIOS[scId]) ? SCENARIOS[scId].reward : { gold: 100, xp: 50, itemRank: 1 };
    
    let finalGold = rewardData.gold;
    let finalXp = rewardData.xp;
    
    if (player.lucky) finalGold = Math.floor(finalGold * 1.5);

    player.gold += finalGold;
    player.xp += finalXp;

    let itemReward = "없음";
    let newItem = getRandomItem(); 
    if (newItem) {
        addItem(newItem);
        itemReward = newItem;
    }
    
    document.getElementById('res-gold').innerText = `+${finalGold} G`;
    document.getElementById('res-xp').innerText = `+${finalXp} XP`;
    document.getElementById('res-item').innerText = itemReward;
    
    if (scId && SCENARIOS[scId]) {
        SCENARIOS[scId].cleared = true;
    }
}

/* [NEW] 사무소 복귀 (최종) */
function returnToHub() {
    // 상태 초기화
    game.activeScenarioId = null;
    game.scenario = null;
    
    // 레벨업 체크 (보상으로 경험치를 받았으므로)
    if (player.xp >= player.maxXp) {
        processLevelUp(); // 레벨업 팝업 띄우고, 닫으면 허브로 가도록 유도
        // processLevelUp 내부에서 showPopup을 쓰므로, 팝업 닫기 버튼에 renderHub를 연결해야 자연스러움
        // 일단은 팝업 닫으면 현재 화면(결과창) 유지되므로, 다시 복귀 버튼 누르게 됨 -> OK
    } else {
        renderHub();
    }
}

/* --- 유틸리티 및 계산 --- */
/* [수정] 스탯 계산 함수 (소셜 상태이상 적용) */
function getStat(entity, type) {
    let val = (type==='atk')? entity.baseAtk : (type==='def')? entity.baseDef : entity.baseSpd;
    
    // 플레이어 패시브 아이템 체크
    if (entity === player) {
        if (type === 'atk' && player.inventory.includes("쿠보탄")) val += 1; 
        if (type === 'def' && player.inventory.includes("강인함의 부적")) val += 1; 
        if (type === 'spd' && player.inventory.includes("좋은 운동화")) val += 1; 
    }

    // 버프/디버프 계산
    if (type==='atk') { 
        if (entity.buffs["약화"]) val /= 2; 
        if (entity.buffs["강화"]) val *= 2; 
        // [NEW] 우울: 공격력 1.5배 (상대 멘탈을 더 아프게 때림)
        if (entity.buffs["우울"]) val *= 1.5; 
    } 
    else if (type==='def') { 
        if (entity.buffs["취약"]) val /= 2; 
        if (entity.buffs["건강"]) val *= 2; 
        // [NEW] 헤롱헤롱: 방어력 절반 (설득/협박이 더 잘 먹힘)
        if (entity.buffs["헤롱헤롱"]) val /= 2; 
    } 
    else if (type==='spd') { 
        if (entity.buffs["마비"]) val /= 2; 
        if (entity.buffs["쾌속"]) val *= 2; 
    }
    
    return Math.floor(val);
}

function applyBuff(entity, name, dur) { if (name === "독" || name === "활력") entity.buffs[name] = (entity.buffs[name] || 0) + dur; else entity.buffs[name] = dur; log(`✨ ${entity===player?"나":"적"}에게 [${name}] 적용`); }
function tickBuffs(entity) {
    if (entity.buffs["독"]) { let dmg = entity.buffs["독"]; log(`☠️ 독 피해 ${dmg}!`); takeDamage(entity, dmg); }
    if (entity.buffs["활력"]) { let heal = entity.buffs["활력"]; entity.hp = Math.min(entity.maxHp, entity.hp + heal); log(`🌿 활력 회복 +${heal}`); updateUI(); }
}
function decrementBuffs(entity) { for (let k in entity.buffs) { entity.buffs[k]--; if (entity.buffs[k] <= 0) delete entity.buffs[k]; } }
/* [수정] 특정 랭크 카드 추가 (소셜 카드 제외) */
function addRandomCard(rank) { 
    let pool = Object.keys(CARD_DATA).filter(k => 
        CARD_DATA[k].rank === rank && 
        CARD_DATA[k].type !== "social" // ★ 핵심: 소셜 카드 제외
    ); 
    if(pool.length > 0) {
        player.deck.push(pool[Math.floor(Math.random() * pool.length)]); 
    }
}
/* [수정] 랜덤 카드 획득 (소셜 카드 제외) */
function getRandomCard() { 
    let r = Math.random() * 100; 
    let rank = (r < 70) ? 1 : (r < 95) ? 2 : 3; 
    
    let pool = Object.keys(CARD_DATA).filter(k => 
        CARD_DATA[k].rank === rank && 
        CARD_DATA[k].type !== "social" // ★ 핵심: 소셜 카드 제외
    ); 
    
    // 만약 풀이 비었다면 기본 카드 반환
    if(pool.length === 0) return "타격";
    
    return pool[Math.floor(Math.random() * pool.length)]; 
}
function getRandomItem(filter) { 
    let pool = Object.keys(ITEM_DATA);

    if (filter) {
        const normalized = filter.toLowerCase();
        
        // allow filtering by either item.type or usage(consume/passive)
        pool = pool.filter(key => {
            const item = ITEM_DATA[key];
            if (!item) return false;

            const typeMatch = item.type && item.type.toLowerCase() === normalized;
            const usageMatch = item.usage && item.usage.toLowerCase() === normalized;
            const consumeAlias = (normalized === "consumable" || normalized === "consume") && item.usage === "consume";
            
            return typeMatch || usageMatch || consumeAlias;
        });

        // fallback to full pool if nothing matched to avoid undefined picks
        if (pool.length === 0) pool = Object.keys(ITEM_DATA);
    }

    if (pool.length === 0) return null;
    
    let r = Math.random() * 100; 
    let rank = (r < 70) ? 1 : (r < 90) ? 2 : 3; 
    
    let rankPool = pool.filter(k => ITEM_DATA[k].rank === rank); 
    if (rankPool.length === 0) rankPool = pool; 
    
    return rankPool[Math.floor(Math.random() * rankPool.length)]; 
}

/* --- UI Render Helpers --- */
/* [수정] drawCards 함수: 손패 초과 시 자동 버림 처리 */
function drawCards(n) {
    const MAX_HAND_SIZE = 10; // 최대 핸드 매수

    for(let i=0; i<n; i++) {
        // 1. 덱 리필 확인
        if (player.drawPile.length === 0) {
            if (player.discardPile.length > 0) { 
                log("🔄 덱을 섞습니다!"); 
                player.drawPile = [...player.discardPile]; 
                player.discardPile = []; 
                shuffle(player.drawPile); 
            }
            else {
                // 덱도 없고 버린 카드도 없으면 아예 뽑을 수 없음
                break; 
            }
        }
        
        // 2. 일단 카드를 뽑음
        let card = player.drawPile.pop();

        // 3. 손패 공간 확인
        if (player.hand.length < MAX_HAND_SIZE) {
            // 공간이 있으면 손패로
            player.hand.push(card);
        } else {
            // 공간이 없으면 바로 버림 패로 이동 (카드가 타버림)
            player.discardPile.push(card);
            log(`🔥 손패가 꽉 차서 [${card}] 카드가 버려졌습니다!`);
            
            // 시각적 효과 (버림 카드 더미가 흔들림)
            playAnim('btn-discard-pile', 'anim-bounce');
        }
    }
    
    renderHand(); 
    updateUI();
}

/* [수정] UI 업데이트 함수 (HP 표시 개선 & 죽음 처리 수정) */
function updateUI() {
    // 1. 상단 정보 (플레이어) - 경험치 바 제거
    const infoEl = document.getElementById('game-info');
    if (infoEl) {
        infoEl.textContent = `Lv.${game.level} | ${player.gold}원 | HP ${player.maxHp}/${player.hp} | SP ${player.maxSp}/${player.sp}`;
    }

    let playerBarHTML = "";
    if (game.state === "social") {
        let spPct = Math.max(0, (player.sp / player.maxSp) * 100);
        playerBarHTML = `
            <div class="hp-bar-bg" style="background:#222; border-color:#8e44ad;">
                <div class="hp-bar-fill" style="width:${spPct}%; background: linear-gradient(90deg, #8e44ad, #9b59b6);"></div>
            </div>
            <div style="font-size:0.9em;">이성(SAN): <span id="p-hp">${player.sp}</span>/${player.maxSp} <span class="block-icon">🛡️<span id="p-block">${player.block}</span></span></div>
        `;
    } else {
        let hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
        playerBarHTML = `
            <div class="hp-bar-bg"><div class="hp-bar-fill" id="p-hp-bar" style="width:${hpPct}%"></div></div>
            <div style="font-size:0.9em;">HP: <span id="p-hp">${player.hp}</span>/<span id="p-max-hp">${player.maxHp}</span> <span class="block-icon">🛡️<span id="p-block">${player.block}</span></span></div>
        `;
    }
    
    document.getElementById('player-char').innerHTML = `
        <h3 style="margin:2px 0; font-size:1em;">👤 플레이어</h3>
        <img id="p-img" src="https://placehold.co/150x150/3498db/ffffff?text=Hero" alt="Player" class="char-img" style="width:100px; height:100px;"> 
        ${playerBarHTML}
        <div class="stats" id="p-stats" style="font-size:0.8em;">공${getStat(player,'atk')} 방${getStat(player,'def')} 속${getStat(player,'spd')}</div>
        <div class="buffs" id="p-buffs" style="min-height:20px;">${applyTooltip(Object.entries(player.buffs).map(([k,v])=>`${k}(${v})`).join(', '))}</div>
        <div style="margin-top: 5px; display: flex; justify-content: center; gap: 3px;">
            <button id="btn-draw-pile" class="small-btn" style="font-size:0.7em;" onclick="openPileView('draw')">덱(${player.drawPile.length})</button>
            <button id="btn-discard-pile" class="small-btn" style="font-size:0.7em;" onclick="openPileView('discard')">버림(${player.discardPile.length})</button>
            <button id="btn-exhaust-pile" class="small-btn" style="font-size:0.7em;" onclick="openPileView('exhaust')">소멸(${player.exhaustPile.length})</button>
        </div>
    `;
    updateInventoryUI();

    // 2. 적 UI 업데이트
    if (!enemies || enemies.length === 0) return;
    enemies.forEach(e => {
        let el = document.getElementById(`enemy-unit-${e.id}`);
        if (!el) return; 
        
        // [수정] className을 덮어쓰지 않고 dead 클래스만 제어합니다.
        // 이렇게 해야 playAnim으로 추가된 애니메이션 클래스가 유지됩니다.
        if (e.hp <= 0 && game.state !== "social") { 
            el.classList.add('dead');
            el.innerHTML = `<div style="margin-top:50px; color:#777; font-size:2em;">💀</div><div style="color:#555;">${e.name}</div>`;
            return;
        } else {
             el.classList.remove('dead');
             // el.className = 'enemy-unit';  <-- 이 줄을 삭제하거나 주석 처리해야 합니다!
        }
        el.classList.add('enemy-unit');
        let isSocialEnemy = (game.state === "social"); 
        let barHTML = "";
        let patienceHTML = ""; // [NEW] 인내심 HTML

        if (isSocialEnemy) {
            // [변경] 분모를 100으로 변경 (e.hp / 100 * 100 이므로 그냥 e.hp)
            let spPct = Math.min(100, Math.max(0, e.hp)); 
            let barColor = `linear-gradient(90deg, #e74c3c 0%, #f1c40f 50%, #3498db 100%)`;
            barHTML = `
                <div style="font-size:0.7em; color:#aaa; margin-bottom:2px;">멘탈: ${e.hp}/100</div>
                <div class="hp-bar-bg" style="background: #333; position:relative;">
                    <div style="width:100%; height:100%; background:${barColor}; opacity:0.3;"></div>
                    <div style="position:absolute; top:0; left:${spPct}%; width:4px; height:100%; background:#fff; box-shadow:0 0 5px #fff; transform:translateX(-50%); transition:left 0.5s;"></div>
                </div>
            `;
            // [NEW] 인내심 표시
            patienceHTML = `<div style="color:#e67e22; font-weight:bold; font-size:0.9em; margin-bottom:5px;">💢 인내심: ${e.patience}턴</div>`;
        } else {
            let hpPct = Math.max(0, (e.hp / e.maxHp) * 100);
            barHTML = `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${hpPct}%"></div></div>`;
        }

        let intent = "💤";
        if (game.turnOwner === "enemy" && game.currentActorId === e.id) intent = isSocialEnemy ? "💬" : "⚔️";
        let buffText = applyTooltip(Object.entries(e.buffs).map(([k,v])=>`${k}(${v})`).join(', '));

        el.innerHTML = `
            ${patienceHTML} <div style="font-weight:bold; font-size:0.9em; margin-bottom:5px;">${e.name} ${intent}</div>
            <img src="${e.img}" alt="${e.name}" class="char-img" style="width:80px; height:80px;">
            ${barHTML} 
            <div style="background:#444; height:6px; margin:2px 10px; border-radius:3px; overflow:hidden;">
                <div style="background:#f1c40f; height:100%; width:${Math.min(100, (e.ag / game.AG_MAX) * 100)}%"></div>
            </div>
            <div style="font-size:0.8em;">
                ${isSocialEnemy ? "" : `HP: ${e.hp}/${e.maxHp}`} 
                <span class="block-icon">🛡️${e.block}</span>
            </div>
            <div class="stats" style="font-size:0.7em;">공${getStat(e,'atk')} 방${getStat(e,'def')} <span style="color:#f1c40f; font-weight:bold;">⚡${getStat(e,'spd')}</span></div>
            <div class="status-effects" style="font-size:0.7em; min-height:15px; color:#f39c12; margin-top:2px;">${buffText}</div>
        `;
    });

if (typeof updateTurnOrderList === "function") updateTurnOrderList();

    // [NEW] 특수 행동 버튼 처리 (무력행사 or 도망치기)
    let controlGroup = document.querySelector('.control-group');
    let extraBtn = document.getElementById('extra-action-btn');
    
    // 일단 기존 버튼이 있다면 제거 (상태가 바뀌었을 수 있으므로)
    if (extraBtn) extraBtn.remove();

    // 플레이어 턴일 때만 버튼 생성
    if (game.turnOwner === "player") {
        let btnHTML = "";
        let btnFunc = null;
        let btnColor = "";

        // 1. 소셜 모드 -> [무력 행사]
        if (game.state === "social") {
            btnHTML = "👊<br>무력행사";
            btnColor = "#c0392b"; // 빨강
            btnFunc = () => confirmForceBattle();
        }
        // 2. 배틀 모드 (보스전 제외) -> [도망치기]
        else if (game.state === "battle" && !game.isBossBattle) {
            btnHTML = "🏃<br>도망치기";
            btnColor = "#7f8c8d"; // 회색
            btnFunc = () => confirmRunAway();
        }

        // 버튼이 필요하면 생성해서 삽입
        if (btnHTML) {
            extraBtn = document.createElement('button');
            extraBtn.id = 'extra-action-btn';
            extraBtn.className = 'action-btn';
            extraBtn.style.cssText = `background:${btnColor}; width:80px; font-size:0.9em; padding:5px; line-height:1.2; word-break:keep-all; font-weight:bold;`;
            extraBtn.innerHTML = btnHTML;
            extraBtn.onclick = btnFunc;
            
            // 턴 종료 버튼 앞에 삽입
            controlGroup.insertBefore(extraBtn, document.getElementById('end-turn-btn'));
        }
    }
}
/* [NEW] 도망치기 확인 팝업 */
function confirmRunAway() {
    showPopup("🏃 도망치기", "전투를 포기하고 도망치시겠습니까?<br><span style='color:#e74c3c; font-size:0.8em;'>(패널티: HP -5, 위협도 증가)</span>", [
        { txt: "도망친다!", func: () => { closePopup(); escapePhysicalBattle(); }},
        { txt: "취소", func: closePopup }
    ]);
}

/* [수정] 전투 도주 처리 함수 (사망 체크 추가) */
function escapePhysicalBattle() {
    log("🏃 허겁지겁 도망칩니다!");
    
    // 1. 패널티 적용 (HP -5)
    // takeDamage 함수 내부에서 HP 감소 및 사망 시 팝업 처리를 수행함
    takeDamage(player, 5); 
    
    // 2. [핵심] 도망치다 죽었으면 중단!
    // 이 체크가 없으면 죽었는데도 탐사 화면으로 이동해버려서 게임이 꼬입니다.
    if (player.hp <= 0) {
        checkGameOver(); // 확실하게 게임 오버 처리
        return; 
    }

    // 3. 살았다면 패널티 적용 후 복귀
    game.scenario.doom += 5; // 위협도 증가
    
    // 탐사 화면으로 복귀
    document.getElementById('loc-desc').innerHTML = 
        "<span style='color:#e74c3c'>상처를 입고 간신히 도망쳐 나왔습니다.</span><br>(HP -5, 위협도 증가)";
    renderExploration();
}

/* [수정] renderHand: 터치 이벤트 지원 추가 */
function renderHand() {
    const container = document.getElementById('hand-container'); 
    container.innerHTML = "";
    
    if (player.hand.length >= 8) container.classList.add('compact');
    else container.classList.remove('compact');

    player.hand.forEach((cName, idx) => {
        let data = CARD_DATA[cName];
        let el = document.createElement('div'); 
        el.className = 'card';
        el.id = `card-el-${idx}`;
        el.style.pointerEvents = "auto";
     
        if (player.ap < data.cost || game.turnOwner !== "player") el.className += " disabled";
        
        el.innerHTML = `
            <div class="card-cost">${data.cost}</div>
            <div class="card-rank">${"★".repeat(data.rank)}</div>
            <div class="card-name">${cName}</div>
            <div class="card-desc">${applyTooltip(data.desc)}</div>
        `;
        
        if (game.turnOwner === "player" && player.ap >= data.cost) {
            // [핵심 변경] 마우스와 터치 둘 다 연결
            el.onmousedown = (e) => startDrag(e, idx, cName);
            el.ontouchstart = (e) => startDrag(e, idx, cName);
        } else {
            el.onclick = () => log("🚫 행동력이 부족하거나 사용할 수 없습니다.");
        }
        
        container.appendChild(el);
    });
}

// [수정됨] openPileView: 목록 창에서도 일반 카드처럼 보이게 수정
function openPileView(type) {
    const title = document.getElementById('popup-title'); const content = document.getElementById('popup-content'); const btns = document.getElementById('popup-buttons');
    content.innerHTML = ""; btns.innerHTML = "<button class='action-btn' onclick='closePopup()'>닫기</button>";
    
    let sourceArray;
    if (type === 'draw') sourceArray = [...player.drawPile].sort();
    else if (type === 'discard') sourceArray = player.discardPile;
    else if (type === 'exhaust') sourceArray = player.exhaustPile;

    let typeText = (type==='draw')?'남은 덱':(type==='discard')?'버린 카드':'소멸된 카드';
    title.innerText = `${typeText} (${sourceArray.length}장)`;
    document.getElementById('popup-desc').innerText = "카드 목록을 확인합니다.";
    if (sourceArray.length === 0) content.innerHTML = "<div style='padding:20px; color:#777;'>비어있음</div>";
    else {
        let listDiv = document.createElement('div'); listDiv.className = 'pile-list';
        sourceArray.forEach(cName => {
            let data = CARD_DATA[cName]; let el = document.createElement('div'); el.className = 'mini-card';
            
            // [수정] 미니 카드에도 별 추가
            el.innerHTML = `
                <div>${data.cost} <span style="color:#f1c40f">${"★".repeat(data.rank)}</span></div>
                <b>${cName}</b>
                <div>${applyTooltip(data.desc)}</div>
            `; 
            listDiv.appendChild(el);
        }); content.appendChild(listDiv);
    }
    document.getElementById('popup-layer').style.display = 'flex';
}

function showPopup(title, desc, buttons, contentHTML = "") {
    const layer = document.getElementById('popup-layer'); document.getElementById('popup-title').innerText = title; document.getElementById('popup-desc').innerHTML = desc; document.getElementById('popup-content').innerHTML = contentHTML;
    const btnBox = document.getElementById('popup-buttons'); btnBox.innerHTML = "";
    buttons.forEach(b => { let btn = document.createElement('button'); btn.className = 'action-btn'; btn.style.fontSize = "1em"; btn.style.padding = "5px 15px"; btn.innerText = b.txt; btn.onclick = b.func; btnBox.appendChild(btn); });
    layer.style.display = "flex";
}

/* [누락된 함수 추가] 팝업 닫기 기능 */
function closePopup() {
    document.getElementById('popup-layer').style.display = 'none';
}

function showLevelUp() {
    // game.level++;  <-- [삭제] 이 줄을 찾아서 지우거나 주석 처리하세요!
    
    showPopup("🆙 레벨 업!", "올릴 스탯을 선택하세요.", [
        {txt: "공격력 +1", func: ()=> { player.baseAtk++; getCardReward(); }},
        {txt: "방어력 +1", func: ()=> { player.baseDef++; getCardReward(); }},
        {txt: "속도 +1", func: ()=> { player.baseSpd++; getCardReward(); }}
    ]);
}
/* [수정] 카드 보상 획득 로직 (화면 이동 강제 제거) */
function getCardReward() {
    let newCard = getRandomCard(); 
    let data = CARD_DATA[newCard];
    
    let cardHTML = `
    <div style="display:flex; justify-content:center; margin:10px;">
        <div class="card">
            <div class="card-cost">${data.cost}</div>
            <div class="card-rank">${"★".repeat(data.rank)}</div>
            <div class="card-name">${newCard}</div>
            <div class="card-desc">${applyTooltip(data.desc)}</div>
        </div>
    </div>`;
    
    // [핵심 변경] 카드를 고른 후의 동작 정의
    const finishReward = () => {
        // 1. 전투 승리 화면에서 레벨업을 한 경우
        if (game.state === "win") {
            // 다시 승리 팝업을 띄워준다 (그래야 '떠나기' 버튼을 누를 수 있음)
            // (이미 XP를 소모했으므로 레벨업 버튼은 사라진 상태로 나옴)
            renderWinPopup();
        } 
        // 2. 그 외 (엔딩 화면, 이벤트 등)
        else {
            // 그냥 팝업만 닫고 가만히 있는다. (원래 화면 유지)
            closePopup();
            updateUI();
        }
    };

    showPopup("🎁 카드 보상", "획득하시겠습니까?", [
        {
            txt: "받기", 
            func: ()=>{
                player.deck.push(newCard); 
                finishReward(); // 제자리 유지
            }
        }, 
        {
            txt: "건너뛰기", 
            func: () => {
                finishReward(); // 제자리 유지
            }
        }
    ], cardHTML);
}

// 레벨업 처리 로직
function processLevelUp() {
    player.xp -= player.maxXp; // 경험치 차감 (오버플로우 된 경험치는 유지됨)
    game.level++;
    
    // [NEW] 다음 레벨 필요 경험치 공식 (레벨 * 100)
    // 예: 1->2 (100xp), 2->3 (200xp), 3->4 (300xp) ...
    player.maxXp = game.level * 100;
    
    // 기존 스탯 선택 팝업 호출
    showLevelUp(); 
}

/* [추가] 애니메이션 실행 함수 */
function playAnim(elementId, animClass) {
    const el = document.getElementById(elementId);
    
    // 기존 애니메이션 클래스가 있다면 제거 (연속 재생을 위해)
    el.classList.remove('anim-atk-p', 'anim-atk-e', 'anim-hit', 'anim-bounce');
    
    // 강제 리플로우 (브라우저가 변경사항을 즉시 인식하게 함)
    void el.offsetWidth;
    
    // 새 애니메이션 클래스 추가
    el.classList.add(animClass);
    
    // 애니메이션이 끝나면 클래스 제거 (깔끔하게)
    setTimeout(() => {
        el.classList.remove(animClass);
    }, 600); // 가장 긴 애니메이션 시간(0.6s)에 맞춤
}
/* --- [추가] 저장 및 불러오기 시스템 --- */

function saveGame() {
    // 1. 저장할 데이터 묶기
    const saveData = {
        playerData: player,       // 플레이어의 모든 정보 (덱, 체력, 아이템 등)
        gameLevel: game.level     // 현재 레벨
    };

    // 2. 브라우저 저장소(Local Storage)에 'myRPG_save'라는 이름으로 저장
    // 객체(Object)는 저장 못 하므로 JSON.stringify로 문자열로 변환합니다.
    localStorage.setItem('myRPG_save', JSON.stringify(saveData));

    // 3. 알림
    alert("게임이 저장되었습니다! (브라우저를 닫아도 유지됩니다)");
}

function loadGame() {
    // 1. 저장소에서 데이터 가져오기
    const saveString = localStorage.getItem('myRPG_save');

    // 2. 데이터가 없으면 중단
    if (!saveString) {
        alert("저장된 파일이 없습니다.");
        return;
    }

    // 3. 데이터 복구
    try {
        const loadedData = JSON.parse(saveString); // 문자열을 다시 객체로 변환

        // 데이터 덮어쓰기
        player = loadedData.playerData;
        game.level = loadedData.gameLevel;

        // [중요] 불러온 뒤, 현재 레벨의 전투를 '처음부터' 다시 시작
        // (전투 중간 상태까지 완벽하게 저장하는 건 매우 복잡하므로, 체크포인트 방식 사용)
        alert(`Lv.${game.level} 데이터를 불러왔습니다.`);
        
        // UI 갱신 및 전투 재시작
        updateUI();
        startBattle(); 

    } catch (e) {
        console.error(e);
        alert("세이브 파일이 손상되어 불러올 수 없습니다.");
    }
}
/* [NEW] 승리 팝업을 상황에 맞춰 그려주는 함수 */
function renderWinPopup() {
    let btns = [];
    let contentHTML = "";

    // 1. [아이템 줍기 버튼] - 아직 줍지 않은 아이템이 있다면
    if (game.pendingLoot) {
        let loot = game.pendingLoot;
        let lData = ITEM_DATA[loot];
        
        // 아이템 정보 표시
        contentHTML = `
            <div style="display:flex; justify-content:center; margin-top:15px;">
                <div class="item-icon item-${lData.type} item-rank-${lData.rank}">
                    ${lData.icon}
                    <span class="tooltip"><b>${loot}</b><br>${lData.desc}</span>
                </div>
            </div>
            <div style="margin-top:5px; font-size:0.9em; color:#aaa;">${loot}</div>
        `;
        
        // [중요] 아이템 줍기 버튼: 줍고 나서 'renderWinPopup'을 다시 호출함 (팝업 유지)
        btns.push({ 
            txt: "아이템 줍기", 
            func: () => getLoot() 
        });
    }

    // 2. [레벨업 버튼] - 경험치가 꽉 찼다면
    if (player.xp >= player.maxXp) {
        btns.push({ 
            txt: "🆙 레벨업!", 
            func: processLevelUp 
        });
    }

    // 3. [떠나기 버튼] - 언제나 존재 (선택지 제공)
    // 레벨업이 가능해도, 지금 안 하고 나중에 하거나 그냥 떠날 수도 있게 함
    btns.push({ 
        txt: "떠나기", 
        func: nextStepAfterWin 
    });

    // 팝업 표시
    // (레벨업 가능하면 메시지에 강조 표시)
    let finalMsg = game.winMsg;
    if (player.xp >= player.maxXp) finalMsg += `<br><b style="color:#f1c40f">🆙 레벨 업 가능!</b>`;

    showPopup("전투 승리!", finalMsg, btns, contentHTML);
}

/* [NEW] 아이템 획득 처리 함수 */
function getLoot() {
    if (game.pendingLoot) {
        addItem(game.pendingLoot); // 인벤토리에 추가
        
        // 메시지 갱신
        game.winMsg = game.winMsg.replace("전리품이 바닥에 떨어져 있습니다.", "");
        game.winMsg += `<br><span style="color:#2ecc71">✔ [${game.pendingLoot}] 획득함.</span>`;
        
        game.pendingLoot = null; // 바닥에서 치움
        
        updateUI(); // 인벤토리 갱신
        renderWinPopup(); // [핵심] 팝업 다시 그리기 (이제 줍기 버튼은 사라짐)
    }
}
/* --- [NEW] 드래그 타겟팅 & 미리보기 시스템 --- */

let drag = { active: false, cardIdx: -1, cardName: "", startX: 0, startY: 0, originalDesc: "" };

/* [수정] 드래그 시작 함수 (텍스트 즉시 변환 제거) */
function startDrag(e, idx, name, type = 'card') {
  // 마우스 우클릭 방지 (터치는 button 속성이 없음)
    if (e.type === 'mousedown' && e.button !== 0) return; 
    if (e.target.tagName === 'BUTTON') return;

    drag.active = true;
    drag.type = type; 
    drag.idx = idx;   
    drag.name = name; 
    
    let elId = (type === 'card') ? `card-el-${idx}` : `item-el-${idx}`;
    let dragEl = document.getElementById(elId);
    
    dragEl.style.pointerEvents = "none"; 
    
    let rect = dragEl.getBoundingClientRect();
    drag.startX = rect.left + rect.width / 2;
    drag.startY = rect.top + rect.height / 2;
    
    // --- [핵심] 클릭 순간에는 무조건 원본 텍스트로 초기화 ---
    if (type === 'card') {
        // 데이터에서 원본 설명을 가져옴
        drag.originalDesc = applyTooltip(CARD_DATA[name].desc);
        
        // ★ 화면의 텍스트를 강제로 원본으로 되돌림 ★
        // 이렇게 하면 클릭하는 순간은 무조건 '하얀색' 글씨가 됩니다.
        dragEl.querySelector('.card-desc').innerHTML = drag.originalDesc;
        
    } else {
        drag.originalDesc = ""; 
    }
    // ---------------------------------------

    document.getElementById('drag-layer').style.display = 'block';
 // [핵심 변경] 마우스와 터치 이동/종료 이벤트 모두 연결
    // { passive: false } 옵션은 모바일 스크롤 방지를 위해 중요함
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
}

/* [수정] 드래그 이동 함수 (핸드 영역 벗어나면 수치 변환) */
/* [수정] onDragMove: 소셜 카드도 적 타겟팅 허용 */
function onDragMove(e) {
    if (!drag.active) return;
    if(e.cancelable) e.preventDefault();

    const pos = getClientPos(e);
    let endX = pos.x; let endY = pos.y;

    const path = document.getElementById('drag-path');
    const head = document.getElementById('drag-head');
    let cpX = (drag.startX + endX) / 2; let cpY = Math.min(drag.startY, endY) - 100;
    path.setAttribute("d", `M${drag.startX},${drag.startY} Q${cpX},${cpY} ${endX},${endY}`);
    head.setAttribute("cx", endX); head.setAttribute("cy", endY);

    let targetInfo = getTargetUnderMouse(e);
    let data = (drag.type === 'card') ? CARD_DATA[drag.name] : ITEM_DATA[drag.name];
    let dragEl = document.getElementById((drag.type==='card')?`card-el-${drag.idx}`:`item-el-${drag.idx}`);
    
    document.querySelectorAll('.enemy-unit').forEach(el => el.classList.remove('selected-target'));
    document.getElementById('player-char').classList.remove('selected-target');

    let validTarget = false;
    let aliveEnemies = enemies.filter(en => en.hp > 0);

    if (targetInfo) {
        if (data.targetType === 'all' || data.target === 'all') {
            enemies.forEach(en => { if (en.hp > 0) document.getElementById(`enemy-unit-${en.id}`).classList.add('selected-target'); });
            validTarget = true;
        }
        // [핵심 수정] 공격(attack) 뿐만 아니라 소셜(social) 카드도 적을 타겟팅하게 변경
        else if ((data.type && (data.type.includes("attack") || data.type === "social")) || data.target === "enemy") {
            if (targetInfo.type === 'specific' && targetInfo.unit !== player) {
                document.getElementById(`enemy-unit-${targetInfo.unit.id}`).classList.add('selected-target');
                validTarget = true;
            }
            else if (targetInfo.type === 'general' && aliveEnemies.length === 1) {
                document.getElementById(`enemy-unit-${aliveEnemies[0].id}`).classList.add('selected-target');
                validTarget = true;
            }
        }
        else if (data.target === "self" || (!data.type?.includes("attack") && data.target !== "enemy")) {
            if ((targetInfo.type === 'specific' && targetInfo.unit === player) || targetInfo.type === 'general') {
                document.getElementById('player-char').classList.add('selected-target');
                validTarget = true;
            }
        }
    }

    // 텍스트 업데이트 등 나머지 로직은 기존 유지
    if (drag.type === 'card') {
        let descEl = dragEl.querySelector('.card-desc');
        if (validTarget) {
            let newText = calcPreview(drag.name, player);
            if (descEl.innerHTML !== newText) descEl.innerHTML = newText;
        } else {
            if (descEl.innerHTML !== drag.originalDesc) descEl.innerHTML = drag.originalDesc;
        }
    }
    if (validTarget) { dragEl.style.transform = "scale(1.1)"; dragEl.style.zIndex = "1000"; } 
    else { dragEl.style.transform = "scale(1.0)"; dragEl.style.zIndex = "auto"; }
}

/* [수정] onDragEnd: 소셜 카드 타겟팅 로직 반영 */
function onDragEnd(e) {
    if (!drag.active) return;
    
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);

    document.getElementById('drag-layer').style.display = 'none';
    
    let elId = (drag.type === 'card') ? `card-el-${drag.idx}` : `item-el-${drag.idx}`;
    let dragEl = document.getElementById(elId);
    if (dragEl) {
        dragEl.style.pointerEvents = "auto"; 
        dragEl.style.transform = "scale(1.0)";
        dragEl.style.zIndex = "auto";
        if (drag.type === 'card') dragEl.querySelector('.card-desc').innerHTML = drag.originalDesc;
    }
    
    document.querySelectorAll('.enemy-unit').forEach(el => el.classList.remove('selected-target'));
    document.getElementById('player-char').classList.remove('selected-target');

    let targetInfo = getTargetUnderMouse(e);
    let data = (drag.type === 'card') ? CARD_DATA[drag.name] : ITEM_DATA[drag.name];
    let finalTargets = [];
    let aliveEnemies = enemies.filter(en => en.hp > 0);

    if (targetInfo) {
        if (data.targetType === 'all' || data.target === 'all') {
            finalTargets = aliveEnemies;
        }
        // [핵심 수정] 여기도 동일하게 social 타입 추가
        else if ((data.type && (data.type.includes("attack") || data.type === "social")) || data.target === "enemy") {
            if (targetInfo.type === 'specific' && targetInfo.unit !== player) finalTargets = [targetInfo.unit];
            else if (aliveEnemies.length === 1 && targetInfo.type === 'general') finalTargets = [aliveEnemies[0]];
        }
        else if (data.target === "self" || (!data.type?.includes("attack") && data.target !== "enemy")) {
            if (targetInfo.type === 'specific' && targetInfo.unit === player) finalTargets = [player];
            else if (targetInfo.type === 'general') finalTargets = [player];
        }
    }

    if (finalTargets.length > 0) {
        if (drag.type === 'card') {
            player.ap -= data.cost;
            let usedCard = player.hand.splice(drag.idx, 1)[0];
            if (data.isExhaust) player.exhaustPile.push(usedCard);
            else player.discardPile.push(usedCard);
            finalTargets.forEach(target => useCard(player, target, drag.name));
            renderHand();
        } else {
            useItem(drag.idx, finalTargets[0]); 
        }
        updateUI();
        checkGameOver();
    }
    drag.active = false;
    drag.idx = -1;
}
/* [수정] 마우스 아래 타겟 판정 (좌표 기반 핸드 영역 감지) */
/* [수정] getTargetUnderMouse: 모바일 좌표 지원 */
function getTargetUnderMouse(e) {
    // 1. 핸드 영역 감지 (좌표 계산)
    const handArea = document.getElementById('hand-container');
    const handRect = handArea.getBoundingClientRect();
    
    // [핵심] 좌표 추출
    const pos = getClientPos(e); // {x: ..., y: ...}
    const x = pos.x;
    const y = pos.y;

    // 마우스/터치가 핸드 영역 사각형 안에 있다면 -> 타겟팅 중단
    if (x >= handRect.left && x <= handRect.right &&
        y >= handRect.top && y <= handRect.bottom) {
        return null; 
    }

    // 2. 해당 좌표의 요소 확인
    let el = document.elementFromPoint(x, y);
    if (!el) return null;

    // 3. 유닛 확인
    let enemyUnit = el.closest('.enemy-unit');
    if (enemyUnit) {
        let id = parseInt(enemyUnit.id.split('-')[2]); 
        let target = enemies.find(e => e.id === id);
        if (target && target.hp > 0) return { type: 'specific', unit: target };
    }

    if (el.closest('#player-char')) return { type: 'specific', unit: player };

    // 4. 전투 구역(허공) 확인
     if (el.closest('.container') && !el.closest('.utility-dock')) {
        return { type: 'general' };
    }

    return null;
}

/* [수정] 카드 설명 내 수치 계산 함수 (색상 강조 포함) */
function calcPreview(cardName, user) {
    let data = CARD_DATA[cardName];
    // 툴팁 등 기본 설명 가져오기
    let desc = applyTooltip(data.desc); 
    
    // 공격력/방어력 스탯 가져오기 (버프/디버프가 이미 적용된 수치)
    let atk = getStat(user, 'atk');
    let def = getStat(user, 'def');

    // 1. 공격 카드 계산
    if (data.dmg) {
        // 기본 공식: (카드 데미지 + 플레이어 공격력)
        // ※ 실제 게임에서는 (기본뎀 + 힘) * 배율 등이지만, 여기선 단순 합산으로 구현
        let finalDmg = data.dmg + atk; 
        
        // 색상 결정 (기본값보다 높으면 초록, 낮으면 빨강)
        let colorClass = (finalDmg > data.dmg) ? "mod-val-buff" : 
                         (finalDmg < data.dmg) ? "mod-val-debuff" : "";
        
        // 텍스트 교체 (예: "HP -5" -> "HP -<span class='...'>7</span>")
        // 정규식: 설명 텍스트 내의 '기본 데미지 숫자'를 찾아서 '계산된 숫자'로 교체
        let regex = new RegExp(data.dmg, "g");
        desc = desc.replace(regex, `<span class="${colorClass}">${finalDmg}</span>`);
    }

    // 2. 방어 카드 계산
    if (data.block) {
        // 기본 공식: (카드 방어도 + 플레이어 방어력)
        let finalBlock = data.block + def;
        
        let colorClass = (finalBlock > data.block) ? "mod-val-buff" : 
                         (finalBlock < data.block) ? "mod-val-debuff" : "";
                         
        let regex = new RegExp(data.block, "g");
        desc = desc.replace(regex, `<span class="${colorClass}">${finalBlock}</span>`);
    }

    return desc;
}

/* [수정] 턴 순서 예측 및 세로 타임라인 렌더링 */
function updateTurnOrderList() {
    // 1. 시뮬레이션용 데이터 준비 (이미지 소스 포함)
    // 플레이어 이미지 소스 가져오기 (DOM에서 직접)
    let pImgSrc = document.getElementById('p-img') ? document.getElementById('p-img').src : "";
    
    let simPlayer = { 
        type: 'player', 
        ag: player.ag, 
        spd: getStat(player, 'spd'), 
        img: pImgSrc 
    };
    
    // 적 데이터 복사 (img 속성 포함)
    let simEnemies = enemies.filter(e => e.hp > 0).map(e => ({
        type: 'enemy',
        id: e.id,
        ag: e.ag,
        spd: getStat(e, 'spd'),
        img: e.img
    }));
    
    let allUnits = [simPlayer, ...simEnemies];
    let predictedOrder = []; // 순서대로 저장될 배열
    const MAX_PREDICT = 5;   // 미리 보여줄 턴 개수 (너무 많으면 화면 가림)

    // 2. 턴 시뮬레이션 루프
    let safety = 0;
    while (predictedOrder.length < MAX_PREDICT && safety < 1000) {
        safety++;
        
        // 행동 게이지(AG)가 꽉 찬 유닛 찾기
        let readyUnits = allUnits.filter(u => u.ag >= game.AG_MAX);
        
        if (readyUnits.length > 0) {
            // AG 높은 순(턴 우선순위) 정렬
            readyUnits.sort((a, b) => b.ag - a.ag);
            
            for (let unit of readyUnits) {
                // 예측 리스트에 추가 (유닛 정보 전체 저장)
                predictedOrder.push(unit);
                
                // 시뮬레이션 상에서만 게이지 소모
                unit.ag -= game.AG_MAX;
                
                if (predictedOrder.length >= MAX_PREDICT) break;
            }
        } else {
            // 행동 가능한 유닛이 없으면 시간(Tick) 흐르게 함
            allUnits.forEach(u => u.ag += u.spd);
        }
    }

    // 3. 타임라인 DOM 렌더링
    const timelineContainer = document.getElementById('turn-timeline');
    if (!timelineContainer) return;

    timelineContainer.innerHTML = ""; // 기존 내용 초기화

    predictedOrder.forEach((unit, index) => {
        let node = document.createElement('div');
        // 클래스: 기본노드 + (플레이어/적 구분)
        node.className = `timeline-node ${unit.type === 'player' ? 'node-player' : 'node-enemy'}`;
        
        // 애니메이션 딜레이 (순차적으로 나타나게)
        node.style.animation = `fadeIn 0.1s ease forwards ${index * 0.05}s`;
        node.style.opacity = "0"; // 애니메이션 전 숨김

        // 이미지 삽입
        node.innerHTML = `<img src="${unit.img}" class="timeline-img" alt="Unit">`;
        
        timelineContainer.appendChild(node);
    });

    // (선택 사항) 기존 텍스트 기반 턴 정보창은 간소화하거나 숨김
    // document.getElementById('turn-info').innerHTML = `<div>${game.turnOwner === 'player' ? "나의 턴" : "적의 턴"}</div>`;
}

// [추가] CSS 애니메이션용 키프레임 (style.css에 넣거나 JS로 주입)
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(styleSheet);
window.onload = initGame;
