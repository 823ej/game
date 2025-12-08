

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
    autoSave();
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
let battleCheckpoint = null; // 전투 시작 시점 저장용
/* [수정] 플레이어 상태 (인벤토리 통합) */
let player = { 
// 기본 생명력/정신력 (현재값)
    maxHp: 30, hp: 30, 
    maxSp: 30, sp: 30, 
    mental: 100, maxMental: 100, // 마음의 벽 (소셜용)
    
    // [NEW] 6대 스탯 도입
    // 근력(Str): 물리 공격력
    // 건강(Con): 물리 방어력 & 최대 HP
    // 민첩(Dex): 속도 (행동 순서)
    // 지능(Int): 논리 방어 (소셜 방어)
    // 정신(Wil): 최대 SP & 마음의 벽 크기
    // 매력(Cha): 소셜 공격력 (설득/기만)
    stats: {
        str: 1, // 근력
        con: 1, // 건강
        dex: 3, // 민첩 (기본 속도 유지)
        int: 1, // 지능
        wil: 1, // 정신
        cha: 1  // 매력
    },
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
let tempBonusStats = {};   // 스탯 분배로 추가된 보너스 스탯
let currentStatPoints = 0; // 남은 스탯 포인트
let tempJob = null;
let tempTraits = [];
let currentTP = 0;

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

// 현재 전투에서 사용할 적 목록을 전역으로 보관
let enemies = [];

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
function createBattleCheckpoint() {
    battleCheckpoint = {
        // 객체를 깊은 복사(Deep Copy)하여 현재 상태와 분리
        player: JSON.parse(JSON.stringify(player)),
        enemies: JSON.parse(JSON.stringify(enemies)),
        game: JSON.parse(JSON.stringify(game))
    };
    // 체크포인트 안의 game 객체에는 체크포인트 자신이 포함되지 않도록 주의(순환 참조 방지)
    // (game 변수 안에 battleCheckpoint를 넣지 않고 전역 변수로 뺐으므로 안전함)
}
/* [NEW] 스탯 기반 파생 능력치 재계산 */
function recalcStats() {
 // 보정치 계산
    let conMod = Math.floor((player.stats.con - 10) / 2);
    let wilMod = Math.floor((player.stats.wil - 10) / 2);

    // [안전장치] 보정치가 마이너스여도 최소 HP/SP는 보장
    // 기본 30 + (보정치 * 5) -> 계수를 10에서 5로 줄이거나, 최소값을 10으로 고정 추천
    // 여기선 기존 10배수 유지하되 최소값 10 보장
    
    player.maxHp = Math.max(10, 30 + (conMod * 10));
    if (player.hp > player.maxHp) player.hp = player.maxHp;

    player.maxSp = Math.max(10, 30 + (wilMod * 10));
    if (player.sp > player.maxSp) player.sp = player.maxSp;
    
    // 소셜 HP (마음의 벽)
    player.maxMental = Math.max(50, 100 + (wilMod * 10));
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

// [game.js] 

/* ============================================================
   [시스템] 자동 저장 & 이어하기 (Auto-Save System)
   ============================================================ */

// [1] 게임 초기화 (진입점)
function initGame() {
    // 저장된 데이터가 있는지 확인
    if (localStorage.getItem('midnight_rpg_save')) {
        // 데이터가 있으면 자동으로 로드
        loadGame();
    } else {
        // 데이터가 없으면 캐릭터 생성 시작
        startCharacterCreation();
    }
}

// [2] 자동 저장 함수 (알림 없이 조용히 저장)
function autoSave() {
    // 전투 중 로직: 현재 상태가 아니라 '체크포인트(시작 시점)'를 저장
    let targetPlayer = player;
    let targetEnemies = enemies;
    let targetGame = game;

    if ((game.state === 'battle' || game.state === 'social') && battleCheckpoint) {
        targetPlayer = battleCheckpoint.player;
        targetEnemies = battleCheckpoint.enemies;
        targetGame = battleCheckpoint.game;
        // console.log("자동 저장: 전투 시작 시점으로 기록됨");
    }

    // 클리어 목록
    let clearedList = [];
    for (let id in SCENARIOS) {
        if (SCENARIOS[id].cleared) clearedList.push(id);
    }

    const saveData = {
        version: "2.3",
        player: targetPlayer,
        enemies: targetEnemies,
        game: targetGame,
        clearedScenarios: clearedList,
        timestamp: new Date().toLocaleString()
    };

    try {
        localStorage.setItem('midnight_rpg_save', JSON.stringify(saveData));
        // console.log(`[AutoSave] 저장 완료 (${saveData.timestamp})`);
    } catch (e) {
        console.error("자동 저장 실패:", e);
    }
}

// [3] 게임 불러오기 (시작 시 자동 호출)
function loadGame() {
    const saveString = localStorage.getItem('midnight_rpg_save');
    if (!saveString) return; // 안전장치

    try {
        const loadedData = JSON.parse(saveString);

        // 데이터 복구
        player = loadedData.player;
        game = loadedData.game;
        enemies = loadedData.enemies || [];

        if (loadedData.clearedScenarios) {
            loadedData.clearedScenarios.forEach(id => {
                if (SCENARIOS[id]) SCENARIOS[id].cleared = true;
            });
        }

        recalcStats();
        
        // 화면 복구 로직
        // [A] 전투/소셜 상태에서 종료했던 경우 -> 전투 시작 시점으로 복구
        if (game.state === 'battle' || game.state === 'social') {
            // 전투 관련 변수 초기화
            game.turnOwner = "none";
            game.lastTurnOwner = "none";
            
            // 체크포인트도 현재(로드된 깨끗한 상태)로 다시 갱신
            createBattleCheckpoint();

            switchScene('battle');
            renderEnemies();
            renderHand();
            updateUI();
            processTimeline(); 
            
            // 유저에게 알림 (선택사항)
            // alert("전투 시작 시점으로 복귀했습니다.");
        } 
        // [B] 탐사 중
        else if (game.activeScenarioId && game.scenario) {
            renderExploration();
        } 
        // [C] 그 외 (사무소, 맵 등)
        else {
            if (game.state === 'city') renderCityMap();
            else renderHub();
        }

        updateUI();

    } catch (e) {
        console.error(e);
        alert("세이브 파일 오류. 데이터를 초기화합니다.");
        resetGameData();
    }
}

// [4] 데이터 삭제 (초기화)
function confirmReset() {
    if (confirm("정말 모든 데이터를 삭제하고 처음부터 시작하시겠습니까?\n(되돌릴 수 없습니다)")) {
        resetGameData();
    }
}

function resetGameData() {
    localStorage.removeItem('midnight_rpg_save');
    location.reload(); // 페이지 새로고침 -> initGame에서 데이터 없으므로 생성 화면으로
}

function startCharacterCreation() {
    switchScene('char-creation');
    renderJobSelection();
}

// 1. 직업 선택 UI
function renderJobSelection() {
    const container = document.getElementById('char-creation-content');
    container.innerHTML = `<h2 style="color:#f1c40f">직업 선택</h2><div class="hub-grid" id="job-list"></div>`;
    
    const list = document.getElementById('job-list');
    for (let key in JOB_DATA) {
        let job = JOB_DATA[key];
        let el = document.createElement('div');
        el.className = 'hub-card';
        el.innerHTML = `
            <div class="hub-card-title">${job.name}</div>
            <div class="hub-card-desc">${job.desc}</div>
            <div style="font-size:0.7em; color:#aaa; margin-top:5px;">
                💪${job.baseStats.str} ❤️${job.baseStats.con} ⚡${job.baseStats.dex}<br>
                🧠${job.baseStats.int} 👁️${job.baseStats.wil} 💋${job.baseStats.cha}
            </div>
        `;
        el.onclick = () => selectJob(key);
        list.appendChild(el);
    }
}

// [game.js] selectJob 함수 수정

function selectJob(key) {
    tempJob = key;
    
    // [NEW] 직업 변경 시 선택한 특성 초기화 및 기본 특성 장착
    tempTraits = [...JOB_DATA[key].defaultTraits];
    
    // [NEW] 스탯 포인트 시스템 초기화 (기본 3 포인트 제공)
    currentStatPoints = 3; 
    tempBonusStats = { str:0, con:0, dex:0, int:0, wil:0, cha:0 };

    // TP 초기화
    calculateTP();
    
    renderTraitSelection();
}

/* [game.js] recalcStats 함수 수정 (최소값 제한 해제: 있는 그대로 계산) */
function recalcStats() {
    let conMod = Math.floor((player.stats.con - 10) / 2);
    let wilMod = Math.floor((player.stats.wil - 10) / 2);

    // [수정] 0 이하가 될 수 있도록 Math.max 제거 (생성 제한 확인을 위해)
    // 기본 공식: 30 + (보정치 * 10)
    player.maxHp = 30 + (conMod * 10);
    player.maxSp = 30 + (wilMod * 10);
    
    // 소셜 HP (마음의 벽)
    player.maxMental = 100 + (wilMod * 10);
}
// 2. 스탯 조정 함수 (버튼 클릭 시 호출됨)
function adjustStat(type, delta) {
    // 현재 수치 계산 (직업 기본값 + 투자한 보너스)
    let baseVal = JOB_DATA[tempJob].baseStats[type];
    let currentVal = baseVal + tempBonusStats[type];

    // [CASE 1] 스탯 올리기 (+)
    if (delta > 0) {
        if (currentStatPoints < 1) return; // 포인트 부족하면 중단
        
        tempBonusStats[type] += 1;
        currentStatPoints -= 1;
    } 
    // [CASE 2] 스탯 내리기 (-)
    else {
        // ★ 핵심: 현재 수치가 8 이하라면 더 이상 내릴 수 없음 (DnD 룰)
        // 만약 data.js를 업데이트하지 않아 기본 스탯이 1이라면, 여기서 막혀서 버튼이 안 눌리는 것처럼 보입니다.
        if (currentVal <= 8) {
            console.log("최소 수치(8) 제한에 도달했습니다.");
            return;
        }
        // 보너스 스탯이 0 이하라면(직업 기본치보다 낮추려 한다면) 불가능하게 설정
        // (원한다면 이 줄을 지워 직업 기본치보다 깎고 포인트를 벌게 할 수도 있습니다)
        //if (tempBonusStats[type] <= 0) return; 

        tempBonusStats[type] -= 1;
        currentStatPoints += 1; // 포인트 반환
    }
    
    // 화면 갱신하여 숫자 업데이트
    renderTraitSelection();
}
/* [game.js] renderTraitSelection 함수 교체 (UI 레이아웃 통일) */
function renderTraitSelection() {
    calculateTP(); // TP 계산

    const container = document.getElementById('char-creation-content');
    
    // TP 상태 변수 및 UI 텍스트 설정
    let tpColor = currentTP >= 0 ? "#2ecc71" : "#e74c3c";
    let btnText = currentTP >= 0 ? "결정 완료 (게임 시작)" : `포인트 부족! (${currentTP})`;
    let btnDisabled = currentTP < 0 ? "disabled" : "";

    // 직업 기본 정보 가져오기
    let base = JOB_DATA[tempJob].baseStats;
    const statLabels = {str:"💪근력", con:"❤️건강", dex:"⚡민첩", int:"🧠지능", wil:"👁️정신", cha:"💋매력"};
    const statDesc = {
        str:"물리 공격력", con:"체력/물리방어", dex:"행동 속도", 
        int:"논리 방어(소셜)", wil:"이성/저항(소셜)", cha:"설득/공격(소셜)"
    };
    
    // --- [UI 1] 스탯 조정 패널 ---
    let statHtml = `
        <div class="hub-card" style="margin-bottom:15px; cursor:default; text-align:left; border-color:#3498db;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="margin:0; color:#3498db;">📊 능력치 조정</h3>
                <div style="font-size:0.9em;">남은 포인트: <span style="color:#f1c40f; font-weight:bold; font-size:1.2em;">${currentStatPoints}</span></div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
    `;

    for(let k in tempBonusStats) {
        let currentVal = base[k] + tempBonusStats[k];
        
        let mod = Math.floor((currentVal - 10) / 2);
        let modSign = mod >= 0 ? "+" : "";
        let modText = `<span style="color:#888; font-size:0.8em; margin-left:2px;">(${modSign}${mod})</span>`;
        let valColor = tempBonusStats[k] > 0 ? "#2ecc71" : (tempBonusStats[k] < 0 ? "#e74c3c" : "#eee");

        statHtml += `
            <div style="background:#222; padding:8px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
                <div title="${statDesc[k]}">${statLabels[k]}</div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <button class="small-btn" onclick="adjustStat('${k}', -1)" style="width:24px; pointer-events:auto;">-</button>
                    <span style="width:50px; text-align:center; font-weight:bold; color:${valColor};">${currentVal} ${modText}</span>
                    <button class="small-btn" onclick="adjustStat('${k}', 1)" style="width:24px; pointer-events:auto;">+</button>
                </div>
            </div>
        `;
    }
    statHtml += `</div><div style="font-size:0.7em; color:#777; margin-top:5px; text-align:center;">최소 8, 기본 10점 기준. (괄호 안은 보정치)</div></div>`;

    // --- [UI 2] 특성 선택 패널 (디자인 변경됨) ---
    let traitHtml = `
        <div class="hub-card" style="margin-bottom:15px; cursor:default; text-align:left; border-color:#9b59b6;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="margin:0; color:#9b59b6;">🧬 특성 선택</h3>
                <div style="font-size:0.9em;">남은 포인트: <span style="color:${tpColor}; font-weight:bold; font-size:1.2em;">${currentTP}</span></div>
            </div>
            <div style="font-size:0.7em; color:#aaa; margin-bottom:10px; text-align:center;">
                부정적 특성을 선택하여 포인트를 얻으세요.
            </div>
            <div class="action-grid" id="trait-list" style="max-height:250px; overflow-y:auto; padding-right:5px;"></div>
        </div>
    `;

    // --- [UI 3] 전체 조립 ---
    container.innerHTML = `
        <h2 style="color:#f1c40f">캐릭터 상세 설정</h2>
        ${statHtml}
        ${traitHtml}
        
        <button id="btn-finish-creation" class="action-btn" style="margin-top:10px; width:100%;" onclick="finishCreation()" ${btnDisabled}>
            ${btnText}
        </button>
    `;

    // 특성 목록 생성 (기존 로직 유지)
    const list = document.getElementById('trait-list');
    let jobDefaults = JOB_DATA[tempJob].defaultTraits || [];

    for (let key in TRAIT_DATA) {
        let t = TRAIT_DATA[key];
        
        // 직업 전용 특성 필터링 (내 직업 거 아니면 숨김)
        if (t.type === 'job_unique') {
            if (!tempTraits.includes(key)) continue; 
        }

        let isSelected = tempTraits.includes(key);
        let isDefault = jobDefaults.includes(key);
        
        let borderColor = "#444";
        if (isSelected) borderColor = t.type === 'positive' ? "#2ecc71" : (t.type==='negative' ? "#e74c3c" : "#f1c40f");
        
        let el = document.createElement('button');
        el.className = 'hub-card';
        el.style.border = `2px solid ${borderColor}`;
        el.style.opacity = isSelected ? "1" : "0.6";
        el.style.position = "relative";

        let costText = "";
        if (t.cost > 0) costText = `<span style="color:#e74c3c">-${t.cost} P</span>`;
        else if (t.cost < 0) costText = `<span style="color:#2ecc71">+${Math.abs(t.cost)} P</span>`;
        else costText = `<span style="color:#f1c40f">기본</span>`;

        el.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <b style="color:${isSelected?'#fff':'#aaa'}">${t.name}</b>
                <span style="font-weight:bold;">${costText}</span>
            </div>
            <div style="font-size:0.75em; color:#ccc; margin-top:5px; text-align:left;">${t.desc}</div>
        `;

        if (isDefault) {
            el.onclick = () => alert("이 직업의 기본 특성입니다. 해제할 수 없습니다.");
            el.style.cursor = "default";
        } else {
            el.onclick = () => toggleTrait(key);
        }
        
        list.appendChild(el);
    }
}
// [game.js] toggleTrait 함수 수정

function toggleTrait(key) {
    if (tempTraits.includes(key)) {
        // 해제
        tempTraits = tempTraits.filter(k => k !== key);
    } else {
        // 선택
        tempTraits.push(key);
    }
    
    // 화면 갱신 (TP 재계산 포함)
    renderTraitSelection();
}

// 3. 생성 완료 처리
// [game.js] finishCreation 함수 수정
/* [game.js] finishCreation 함수 수정 (생성 제한 유효성 검사 추가) */
function finishCreation() {
    if (!tempJob) return;

    // 데이터 적용
    player.job = tempJob;
    player.traits = [...tempTraits];
    
    // [STEP 1] 직업 기본 스탯 적용
    player.stats = { ...JOB_DATA[tempJob].baseStats };

    // [STEP 2] 보너스 스탯 합산 (스탯 포인트로 찍은 것)
    for(let k in tempBonusStats) {
        if(player.stats[k] !== undefined) {
            player.stats[k] += tempBonusStats[k];
        }
    }
    
    // 직업 덱 지급
    player.deck = [...JOB_DATA[tempJob].starterDeck];
    player.socialDeck = [...JOB_DATA[tempJob].starterSocialDeck];
    
    // [STEP 3] 특성(Trait) 효과 적용
    player.traits.forEach(tKey => {
        let t = TRAIT_DATA[tKey];
        if (!t) return;

        // 1. 획득 시 발동 효과
        if (t.onAcquire) t.onAcquire(player);

        // 2. 스탯 보너스 적용
        if (t.stats) {
            for (let statKey in t.stats) {
                if (player.stats[statKey] !== undefined) {
                    player.stats[statKey] += t.stats[statKey];
                }
            }
        }
    });

    // [STEP 4] 스탯 재계산 및 유효성 검사
    recalcStats(); 

    // ★ [핵심] HP나 SP가 0 이하라면 생성 차단
    if (player.maxHp <= 0 || player.maxSp <= 0) {
        alert(`⛔ 캐릭터 생성 불가!\n\n현재 세팅으로는 생존할 수 없습니다.\n(최대 HP: ${player.maxHp}, 최대 SP: ${player.maxSp})\n\n건강/정신 스탯을 높이거나, 페널티 특성을 해제해주세요.`);
        
        // 플레이어 상태를 롤백하거나 단순히 함수를 종료하여 진행을 막음
        // (이미 player 객체에 스탯이 적용되었지만, 다시 설정 화면에서 수정하고 버튼을 누르면 덮어씌워지므로 괜찮습니다.)
        return; 
    }

    // 통과 시 체력 회복 및 게임 시작
    player.hp = player.maxHp;
    player.sp = player.maxSp;
    
    renderHub();
    autoSave(); // [추가] 생성 직후 저장
}

/* [NEW] 거점 화면 렌더링 */
function renderHub() {
    switchScene('hub');
    updateUI(); // 상단 바 갱신
    autoSave();
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

// [game.js] startSocialBattle 함수 교체

function startSocialBattle(npcKey) {
    game.state = "social";
    game.totalTurns = 0;
    game.isBossBattle = false;
    game.turnOwner = "none";     
    game.lastTurnOwner = "none"; 

    // 1. 플레이어 상태 초기화 (소셜 전용 스탯 설정)
    // 기존 sp 대신 'mental'이라는 임시 스탯을 사용 (100점 만점)
    player.mental = 100; 
    player.maxMental = 100;
    
    // 덱 교체
    player.drawPile = [...player.socialDeck]; 
    shuffle(player.drawPile);
    player.discardPile = []; player.exhaustPile = []; player.hand = [];
    player.buffs = {}; player.block = 0; player.ag = 0;

    renderHand();

    // 2. 적(NPC) 생성
    enemies = [];
    let data = NPC_DATA[npcKey];
    
    // NPC도 동일하게 100의 마음의 벽을 가짐
    enemies.push({ 
        id: 0, 
        name: data.name, 
        maxHp: 100, hp: 100, // hp 변수를 '마음의 벽' 수치로 사용
        baseAtk: data.baseAtk, baseDef: data.baseDef, baseSpd: data.baseSpd,
        block: 0, buffs: {}, deck: data.deck, img: data.img, ag: 0,
        
        // 인내심 시스템은 제거하거나, 특수 기믹으로만 남김
        isNpc: true 
    });
    createBattleCheckpoint();
    log(`💬 [${data.name}]와(과) 설전을 벌입니다! (마음의 벽을 무너뜨리세요)`);

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
    autoSave();
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
            let spHeal = 3;
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
    
// [여기] 적 생성과 덱 셔플이 끝난 직후, 턴 시작 전에 체크포인트 생성
    createBattleCheckpoint(); // 체크포인트 생성
    autoSave(); // [추가] 체크포인트 내용으로 저장 (전투 중 끄면 여기로 돌아옴)
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
        autoSave(); // [추가] 결과 저장
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
/* [game.js] startTurn 함수 수정 (현재 행동 주체 기록 시점 변경) */
async function startTurn(unit, type) {
    // [NEW] 턴 넘기기 전에, 방금 누가 했는지 기록
    game.lastTurnOwner = game.turnOwner; 
    game.turnOwner = type;
    game.totalTurns++;
    
    // 인내심 처리 (소셜 모드 & 적 턴일 때)
    if (game.state === "social" && type === "enemy") {
        if (unit.patience !== undefined) {
            let decrement = unit.buffs["분노"] ? 2 : 1;
            unit.patience -= decrement;
            
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
    if (unit.hp <= 0 && game.state !== 'social') { 
        processTimeline(); 
        return; 
    }

    unit.ag -= game.AG_MAX;

    // ★ [핵심 변경] updateUI 호출 전에 현재 행동 중인 적 ID를 미리 설정
    // (그래야 updateUI 내부의 타임라인 그리기 함수가 '현재 턴이 누구인지' 알 수 있음)
    if (type === 'enemy') {
        game.currentActorId = unit.id;
    }

    updateUI();

    if (type === 'player') {
        startPlayerTurnLogic();
    } else {
        // game.currentActorId = unit.id; // (기존 위치: 여기였던 것을 위로 올림)
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

/* [수정] useCard: 방어/버프/드로우 로직을 공통으로 분리 */
function useCard(user, target, cardName) {
    let data = CARD_DATA[cardName];
    let userId = (user === player) ? "player-char" : `enemy-unit-${user.id}`;
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;

    log(`🃏 [${cardName}] 사용!`);

    // --- [1] 모드별 특수 효과 처리 ---
    
    // [A] 소셜 카드 (공격/회복/특수)
    if (data.type === "social") {
        playAnim(userId, 'anim-bounce');

        // 1. 공격 (dmg)
      if (data.dmg) {
            // [수정] 소셜 공격력(매력) 적용
            let finalDmg = data.dmg + getStat(user, 'socialAtk'); 
            takeDamage(target, finalDmg);
        }
        // 2. 회복 (heal) - 내 마음의 벽 회복
        if (data.heal) {
            if (user === player) {
                user.mental = Math.min(100, user.mental + data.heal);
                log(`🌿 마음의 벽 회복 +${data.heal}`);
                showDamageText(user, `💚+${data.heal}`);
            } else {
                user.hp = Math.min(100, user.hp + data.heal);
            }
            updateUI(); // 회복 즉시 반영
        }

        // 3. 도박 (거짓말)
        if (data.special === "gamble_lie") {
            if (Math.random() < 0.5) {
                log("🎲 거짓말 성공! 상대가 크게 동요합니다.");
                takeDamage(target, 40);
            } else {
                log("💦 거짓말을 들켰습니다! 망신살이 뻗칩니다.");
                takeDamage(user, 20); 
            }
        }
    }
    // [B] 일반/전투 카드 (소환/공격)
    else {
        if (data.special === "summon") {
            if (user === player) {
                log("🚫 플레이어는 부하를 부를 수 없습니다.");
                return; 
            } else {
                playAnim(userId, 'anim-bounce');
                summonMinion(data.summonTarget);
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
        
        // 상태이상 해제
        if (data.special === "cure_anger") {
            if (target.buffs["분노"]) { delete target.buffs["분노"]; log("😌 상대가 분노를 가라앉혔습니다."); }
            if (target.buffs["우울"]) { delete target.buffs["우울"]; log("😐 상대가 평정심을 찾았습니다."); }
        }
    }

    // --- [2] 공통 처리 (방어/버프/드로우) ---
    // ★ 이제 소셜 카드도 방어도(block) 속성이 있으면 여기서 적용됩니다!
    
    if (data.block) {
      let statType = (game.state === "social") ? 'socialDef' : 'def';
        let finalBlock = data.block + getStat(user, statType);
        
        user.block += finalBlock;
        
        let defenseText = (game.state === "social") ? "논리 방어" : "방어도";
        log(`🛡️ ${defenseText} +${finalBlock}`);
        updateUI(); // 방어도 즉시 반영
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

    // 3. 화면에 추가 (깜빡임 없이)
    const wrapper = document.getElementById('enemies-area');
    let el = document.createElement('div');
    el.className = 'enemy-unit';
    el.id = `enemy-unit-${newId}`;
    wrapper.appendChild(el);

    updateUI(); 
    
    // 등장 효과
    setTimeout(() => {
        let createdEl = document.getElementById(`enemy-unit-${newId}`);
        if(createdEl) {
           createdEl.style.transform = "scale(1.1)";
            setTimeout(() => createdEl.style.transform = "scale(1)", 200);
            showDamageText(newEnemy, "APPEAR!");
        }
    }, 50);

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
        let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;
        playAnim(targetId, 'anim-hit');
        
        if (game.state === "social") {
            // [변경] 소셜 모드: 'mental'(플레이어) 또는 'hp'(NPC)를 깎음
            if (target === player) {
                target.mental -= dmg;
                log(`💔 내 마음의 벽 손상 -${dmg}! (남은 벽: ${target.mental})`);
                showDamageText(target, `💔-${dmg}`);
            } else {
                target.hp -= dmg; // NPC는 hp를 마음의 벽으로 씀
                log(`🗣️ 적 마음의 벽 타격! -${dmg} (남은 벽: ${target.hp})`);
                showDamageText(target, `💢-${dmg}`);
            }
        } else {
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
// 1. [물리적 사망] HP 0
    if (player.hp <= 0) { 
        showPopup("💀 사망", "체력이 다했습니다...<br>차가운 도시의 바닥에서 눈을 감습니다.", [{txt:"다시 하기", func: ()=>location.reload()}]); 
        return true; 
    }
    
    // 2. [정신적 사망] SP 0 (광기/발광)
    // ★ 여기가 추가/수정된 부분입니다 ★
    if (player.sp <= 0) {
        showPopup("🤪 발광(Insanity)", "공포를 견디지 못하고 정신이 붕괴되었습니다.<br>당신은 어둠 속으로 사라집니다...", [{txt:"다시 하기", func: ()=>location.reload()}]);
        return true;
    } 
if (game.state === "social") {
        let npc = enemies[0];

        // 1. [승리] NPC의 마음의 벽이 0이 됨 -> 정보 획득
        if (npc.hp <= 0) { 
            game.winMsg = `<span style='color:#3498db'>🤝 설득 성공!</span><br>${npc.name}의 마음의 벽을 허물었습니다.`;
            endSocialBattle(true);
            return true;
        } 
        
        // 2. [패배] 내 마음의 벽이 0이 됨 -> 선택지 발생
        if (player.mental <= 0) {
            // 게임 오버가 아님! 선택지 팝업 호출
            showSocialLossPopup(npc.name);
            return true; // 턴 진행을 멈추기 위해 true 반환
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
            game.winMsg = `승리! <span style="color:#f1c40f">${rewardGold}원</span>, <span style="color:#3498db">${gainXp} XP</span> 획득.`; 
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
// [game.js] 적절한 곳(checkGameOver 근처)에 추가

function showSocialLossPopup(npcName) {
    let msg = `
        <div style="color:#e74c3c; font-size:1.2em; font-weight:bold;">😵 말문이 막혔습니다!</div>
        <br>
        상대의 논리에 압도당해 더 이상 대화를 이어갈 수 없습니다.<br>
        (내 마음의 벽 0 도달)
    `;

    showPopup("💬 협상 실패", msg, [
        { 
            txt: "👊 무력 행사 (전투 돌입)", 
            func: () => { 
                closePopup(); 
                // 체력 페널티 없이 바로 전투 시작? 아니면 약간의 불리함?
                // 여기선 '기습 실패'로 간주하여 적의 턴게이지를 채워주는 식으로 구현 가능
                forcePhysicalBattle(); 
            }
        },
        { 
            txt: "🏃 포기하고 떠나기", 
            func: () => { 
                closePopup();
                log("패배를 인정하고 물러납니다...");
                // 보상 없이 복귀
                if (game.scenario && game.scenario.isPatrol) renderCityMap();
                else renderExploration();
            }
        }
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
// [game.js] restAction 함수 수정

function restAction() {
    let maxHeal = Math.floor(player.maxHp / 2); // 체력 50%
    let missingHp = player.maxHp - player.hp;
    let actualHeal = Math.min(maxHeal, missingHp);
    
    // [수정] 이성(SP) 회복량 조정 (30 -> 10)
    let spHeal = 10; 
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
        <div class="event-desc">${shopDesc}<br><span style="color:#f1c40f; font-weight:bold;">소지금${player.gold} 원</span></div>
        
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
            <div class="shop-price">${price} 원</div>
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
            <div class="shop-price">${price} 원</div>
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
    autoSave(); // [추가] 돈 쓰고 물건 샀으니 저장
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
    autoSave();
    // 상점 화면을 유지하고 싶다면 renderShopScreen을 다시 호출해야 하는데 type을 기억해야 함.
    // 여기선 간단히 닫고 끝내거나, 편의상 암시장으로 리로드 (개선 포인트)
    renderShopScreen("shop_black_market"); // 임시: 무조건 암시장 리로드 (실제론 타입 변수 저장 필요)
}
/* [수정] 화면 전환 함수 (result 추가) */
function switchScene(sceneName) {
// 1. 모든 장면 숨기기 (목록에 'char-creation-scene' 추가)
    const scenes = [
        'hub-scene', 'city-scene', 'exploration-scene', 
        'battle-scene', 'event-scene', 'deck-scene', 
        'result-scene', 'story-scene',
        'char-creation-scene' // ★ 이 부분이 꼭 추가되어야 합니다!
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
    
    document.getElementById('res-gold').innerText = `+${finalGold} 원`;
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

//트레잇 포인트 계산
function calculateTP() {
    let usedPoints = 0;
    tempTraits.forEach(tKey => {
        let t = TRAIT_DATA[tKey];
        if (t) usedPoints += t.cost;
    });
    
    // 시작 포인트 0 - 사용한 포인트
    // (부정적 특성은 cost가 음수이므로 빼면 더해짐 => 포인트 획득)
    currentTP = 0 - usedPoints;
}

/* [game.js] getStat 함수 수정 (모든 스탯 보정치 공식 통일) */
function getStat(entity, type) {
    let val = 0;
    
    // [1] 플레이어
    if (entity === player) {
        let rawVal = 0;
        
        // 1. 기초 스탯 매핑
        switch (type) {
            case 'atk': rawVal = player.stats.str; break; // 공격 -> 근력
            case 'def': rawVal = player.stats.con; break; // 방어 -> 건강
            case 'spd': rawVal = player.stats.dex; break; // 속도 -> 민첩
            case 'socialAtk': rawVal = player.stats.cha; break; // 소셜공격 -> 매력
            case 'socialDef': rawVal = player.stats.int; break; // 소셜방어 -> 지능
            
            // 그 외 직접 호출 시 (str, con 등)
            default: rawVal = player.stats[type] || 10; break;
        }

        // 2. 아이템 보정 (스탯 자체를 증가시킴)
        // (예: 운동화는 민첩+2 -> 보정치+1 효과)
        if ((type === 'atk' || type === 'str') && player.inventory.includes("쿠보탄")) rawVal += 2;
        if ((type === 'def' || type === 'con') && player.inventory.includes("강인함의 부적")) rawVal += 2;
        if ((type === 'spd' || type === 'dex') && player.inventory.includes("좋은 운동화")) rawVal += 2;

        // 3. [핵심 수정] 보정치 계산 공식 통일
        // 공식: (스탯 - 10) / 2 (소수점 버림)
        // 예: 10~11 -> +0, 12~13 -> +1, 14~15 -> +2
        let mod = Math.floor((rawVal - 10) / 2);

        if (type === 'spd') {
            // ★ 속도 = 기본속도(2) + 민첩 보정치
            // 민첩 10(보정0) -> 속도 2 (기본)
            // 민첩 8(보정-1) -> 속도 1 (느림)
            val = Math.max(1, 2 + mod); // 최소 1 보장
        } else {
            // 공격/방어 등은 보정치 그대로 사용
            val = mod;
        }
    } 
    // [2] 적 (기존 유지)
    else {
        if (type === 'socialAtk') val = entity.baseAtk;
        else if (type === 'socialDef') val = entity.baseDef;
        else if (type === 'atk') val = entity.baseAtk;
        else if (type === 'def') val = entity.baseDef;
        else if (type === 'spd') val = entity.baseSpd;
    }

    // 4. 버프/디버프 계산 (최종 값에 적용)
    if (type === 'atk' || type === 'socialAtk') { 
        if (entity.buffs["약화"]) val = Math.floor(val * 0.5); 
        if (entity.buffs["강화"]) val = Math.max(1, val * 2); 
        if (entity.buffs["우울"]) val = Math.floor(val * 1.5); 
    } 
    else if (type === 'def' || type === 'socialDef') { 
        if (entity.buffs["취약"]) val = Math.floor(val * 0.5); 
        if (entity.buffs["건강"]) val = Math.max(1, val * 2);
        if (entity.buffs["헤롱헤롱"]) val = Math.floor(val * 0.5); 
    } 
    else if (type === 'spd') { 
        if (entity.buffs["마비"]) val = Math.floor(val * 0.5); 
        if (entity.buffs["쾌속"]) val = Math.max(1, val * 2); 
    }
    
    return val;
}
// [game.js] 특성 추가/제거 함수(이벤트용)

function addTrait(key) {
    if (player.traits.includes(key)) return;
    player.traits.push(key);
    
    let t = TRAIT_DATA[key];
    if (t.onAcquire) t.onAcquire(player);
    
    recalcStats();
    alert(`[특성 획득] ${t.name}: ${t.desc}`);
}

function removeTrait(key) {
    if (!player.traits.includes(key)) return;
    player.traits = player.traits.filter(k => k !== key);
    
    // onRemove가 있다면 호출
    recalcStats();
    alert(`[특성 제거] ${TRAIT_DATA[key].name} 특성이 사라졌습니다.`);
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

/* [수정] updateUI: 인내심 턴 표시 제거 및 소셜 UI 개선 */
function updateUI() {
    // 1. 상단 정보
    const infoEl = document.getElementById('game-info');
    if (infoEl) {
        infoEl.textContent = `Lv.${game.level} | ${player.gold}원 | HP ${player.maxHp}/${player.hp} | SP ${player.maxSp}/${player.sp}`;
    }

    // 플레이어 바 (소셜일 땐 '마음의 벽')
    let playerBarHTML = "";
    if (game.state === "social") {
        let mentalPct = Math.max(0, (player.mental / 100) * 100);
        playerBarHTML = `
            <div class="hp-bar-bg" style="background:#222; border-color:#3498db;">
                <div class="hp-bar-fill" style="width:${mentalPct}%; background: linear-gradient(90deg, #3498db, #8e44ad);"></div>
            </div>
            <div style="font-size:0.9em;">
                마음의 벽: <span id="p-hp">${player.mental}</span>/100 
                <span class="block-icon">🛡️<span id="p-block">${player.block}</span></span>
            </div>
        `;
    } else {
        let hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
        playerBarHTML = `
            <div class="hp-bar-bg"><div class="hp-bar-fill" id="p-hp-bar" style="width:${hpPct}%"></div></div>
            <div style="font-size:0.9em;">HP: <span id="p-hp">${player.hp}</span>/<span id="p-max-hp">${player.maxHp}</span> <span class="block-icon">🛡️<span id="p-block">${player.block}</span></span></div>
        `;
    }
    // [수정] 스탯 표시부 (6개 스탯을 2줄로 표시하거나 작게 나열)
    let statsHTML = `
        <div class="stats-grid" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:2px; font-size:0.7em; margin:5px 0;">
            <div title="근력: 물리 공격력">💪 ${player.stats.str}</div>
            <div title="건강: 체력/방어력">❤️ ${player.stats.con}</div>
            <div title="민첩: 행동 속도">⚡ ${player.stats.dex}</div>
            <div title="지능: 논리 방어">🧠 ${player.stats.int}</div>
            <div title="정신: 이성/저항">👁️ ${player.stats.wil}</div>
            <div title="매력: 설득/교섭">💋 ${player.stats.cha}</div>
        </div>
    `;
   document.getElementById('player-char').innerHTML = `
        <h3 style="margin:2px 0; font-size:1em;">👤 플레이어</h3>
        <img id="p-img" src="https://placehold.co/150x150/3498db/ffffff?text=Hero" alt="Player" class="char-img" style="width:100px; height:100px;"> 
        ${playerBarHTML}
        ${statsHTML}
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
        
        if (e.hp <= 0 && game.state !== "social") { 
            el.classList.add('dead');
            el.innerHTML = `<div style="margin-top:50px; color:#777; font-size:2em;">💀</div><div style="color:#555;">${e.name}</div>`;
            return;
        } else {
             el.classList.remove('dead');
        }
        el.classList.add('enemy-unit');
        
        let isSocialEnemy = (game.state === "social"); 
        let barHTML = "";
        let patienceHTML = ""; // ★ 빈 문자열로 초기화 (인내심 표시 제거)

        if (isSocialEnemy) {
       // [수정] 플레이어와 동일한 '마음의 벽' 스타일 적용
            let mentalPct = Math.min(100, Math.max(0, e.hp)); 
            
            // 파란색 -> 보라색 그라데이션
            barHTML = `
                <div class="hp-bar-bg" style="background:#222; border-color:#3498db;">
                    <div class="hp-bar-fill" style="width:${mentalPct}%; background: linear-gradient(90deg, #3498db, #8e44ad);"></div>
                </div>
                <div style="font-size:0.7em; color:#ddd; margin-top:2px;">마음의 벽: ${e.hp}/100</div>
            `;
        } else {
            let hpPct = Math.max(0, (e.hp / e.maxHp) * 100);
            barHTML = `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${hpPct}%"></div></div>`;
        }

        let intent = "💤";
        if (game.turnOwner === "enemy" && game.currentActorId === e.id) intent = isSocialEnemy ? "💬" : "⚔️";
        let buffText = applyTooltip(Object.entries(e.buffs).map(([k,v])=>`${k}(${v})`).join(', '));

        el.innerHTML = `
            ${patienceHTML} 
            <div style="font-weight:bold; font-size:0.9em; margin-bottom:5px;">${e.name} ${intent}</div>
            <img src="${e.img}" alt="${e.name}" class="char-img" style="width:80px; height:80px;">
            ${barHTML} 
            <div style="background:#444; height:6px; margin:2px 10px; border-radius:3px; overflow:hidden;">
                <div style="background:#f1c40f; height:100%; width:${Math.min(100, (e.ag / game.AG_MAX) * 100)}%"></div>
            </div>
            <div style="font-size:0.8em;">
                ${isSocialEnemy ? `<span class="block-icon">🛡️${e.block}</span>` : `HP: ${e.hp}/${e.maxHp} <span class="block-icon">🛡️${e.block}</span>`} 
            </div>
            <div class="stats" style="font-size:0.7em;">공${getStat(e,'atk')} 방${getStat(e,'def')} <span style="color:#f1c40f; font-weight:bold;">⚡${getStat(e,'spd')}</span></div>
            <div class="status-effects" style="font-size:0.7em; min-height:15px; color:#f39c12; margin-top:2px;">${buffText}</div>
        `;
    });

    if (typeof updateTurnOrderList === "function") updateTurnOrderList();

    // (버튼 로직은 기존과 동일하므로 유지)
    let controlGroup = document.querySelector('.control-group');
    let extraBtn = document.getElementById('extra-action-btn');
    if (extraBtn) extraBtn.remove();

    if (game.turnOwner === "player") {
        let btnHTML = "";
        let btnFunc = null;
        let btnColor = "";

        if (game.state === "social") {
            btnHTML = "👊<br>무력행사";
            btnColor = "#c0392b"; 
            btnFunc = () => confirmForceBattle();
        }
        else if (game.state === "battle" && !game.isBossBattle) {
            btnHTML = "🏃<br>도망치기";
            btnColor = "#7f8c8d";
            btnFunc = () => confirmRunAway();
        }

        if (btnHTML) {
            extraBtn = document.createElement('button');
            extraBtn.id = 'extra-action-btn';
            extraBtn.className = 'action-btn';
            extraBtn.style.cssText = `background:${btnColor}; width:80px; font-size:0.9em; padding:5px; line-height:1.2; word-break:keep-all; font-weight:bold;`;
            extraBtn.innerHTML = btnHTML;
            extraBtn.onclick = btnFunc;
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
    let content = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <button class="action-btn" onclick="applyStatUp('str')">💪 근력 (공격↑)</button>
            <button class="action-btn" onclick="applyStatUp('con')">❤️ 건강 (체력/방어↑)</button>
            <button class="action-btn" onclick="applyStatUp('dex')">⚡ 민첩 (속도↑)</button>
            <button class="action-btn" onclick="applyStatUp('int')">🧠 지능 (논리방어↑)</button>
            <button class="action-btn" onclick="applyStatUp('wil')">👁️ 정신 (이성↑)</button>
            <button class="action-btn" onclick="applyStatUp('cha')">💋 매력 (설득↑)</button>
        </div>
    `;

    showPopup("🆙 레벨 업!", "강화할 능력을 선택하세요.", [], content);
}
/* [NEW] 스탯 적용 헬퍼 */
function applyStatUp(type) {
    player.stats[type]++; // 해당 스탯 증가
    recalcStats();        // 파생 스탯(HP/SP) 재계산 (최대치 증가분 반영)
    
    // 만약 건강/정신을 찍어서 최대치가 늘었다면, 현재 수치도 소폭 회복시켜주는 센스
    if(type === 'con') player.hp += 10;
    if(type === 'wil') player.sp += 10;
    
    closePopup();
    getCardReward(); // 카드 보상으로 이어짐
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

/* [game.js] updateTurnOrderList 함수 수정 */
function updateTurnOrderList() {
    let predictedOrder = []; 
    const MAX_PREDICT = 5;

    // 1. 현재 턴 주인 추가
    if (game.turnOwner === 'player') {
        let pImgSrc = document.getElementById('p-img') ? document.getElementById('p-img').src : "";
        predictedOrder.push({ type: 'player', img: pImgSrc, isCurrent: true });
    } else if (game.turnOwner === 'enemy') {
        let currentEnemy = enemies.find(e => e.id === game.currentActorId);
        if (currentEnemy && currentEnemy.hp > 0) {
            predictedOrder.push({ type: 'enemy', img: currentEnemy.img, isCurrent: true });
        }
    }

    // 2. 미래 예측 시뮬레이션
    let pImgSrc = document.getElementById('p-img') ? document.getElementById('p-img').src : "";
    let simPlayer = { type: 'player', ag: player.ag, spd: getStat(player, 'spd'), img: pImgSrc };
    let simEnemies = enemies.filter(e => e.hp > 0).map(e => ({
        type: 'enemy', id: e.id, ag: e.ag, spd: getStat(e, 'spd'), img: e.img
    }));
    let allUnits = [simPlayer, ...simEnemies];

    let safety = 0;
    while (predictedOrder.length < MAX_PREDICT && safety < 1000) {
        safety++;
        let readyUnits = allUnits.filter(u => u.ag >= game.AG_MAX);
        if (readyUnits.length > 0) {
            readyUnits.sort((a, b) => b.ag - a.ag);
            for (let unit of readyUnits) {
                predictedOrder.push(unit);
                unit.ag -= game.AG_MAX;
                if (predictedOrder.length >= MAX_PREDICT) break;
            }
        } else {
            allUnits.forEach(u => u.ag += u.spd);
        }
    }

    // 3. 렌더링
    const timelineContainer = document.getElementById('turn-timeline');
    if (!timelineContainer) return;
    timelineContainer.innerHTML = "";

    predictedOrder.forEach((unit, index) => {
        let node = document.createElement('div');
        node.className = `timeline-node ${unit.type === 'player' ? 'node-player' : 'node-enemy'}`;
        node.innerHTML = `<img src="${unit.img}" class="timeline-img" alt="Unit">`;
        
        // [수정됨] 애니메이션 충돌 방지를 위해 animation 속성으로 크기 제어
        if (index === 0 && unit.isCurrent) {
            // ★ 현재 턴: 크기가 커진 상태(scale 1.2)로 등장하는 전용 애니메이션 사용
            node.style.animation = `fadeInScale 0.2s ease forwards`; 
            node.style.borderWidth = "3px";
            node.style.zIndex = "10";
            // node.style.boxShadow = "0 0 15px #f1c40f"; // 발광 효과 (원하면 주석 해제)
        } else {
            // ★ 대기열: 일반 등장 애니메이션
            node.style.animation = `fadeIn 0.2s ease forwards ${index * 0.1}s`;
        }
        node.style.opacity = "0"; 

        timelineContainer.appendChild(node);
    });
}
/* [game.js] 맨 아래에 추가: 전체화면 토글 함수 */
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            // 아이폰(Safari) 등 일부 브라우저는 지원하지 않을 수 있음
            console.log(`전체화면 오류: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

window.onload = initGame;
