/* [dungeon.js] 던전 시스템 모듈 */

const DungeonSystem = {
    map: [],        // 현재 층의 2D 맵 데이터
    width: 5,       // 맵 너비
    height: 5,      // 맵 높이
    currentPos: { x: 0, y: 0 }, // 현재 방 좌표
    progress: 0,    // 현재 방 안에서의 진행도 (0~100)
    objectAnchor: 0, // 방 입장 시 오브젝트가 화면 중앙에 있는 기준 위치
    bgOffset: 0,    // 배경 스크롤 위치 (시각적)
    isCity: false,  // 도시 모드 여부
    minimapOverlayWasOpen: false, // 전투 진입 전 지도 상태 기억용
    minimapInlineWasOpen: false,  // 전투 진입 전 미니맵 상태 기억용
    // [설정] 보스방 잠금 해제에 필요한 단서량
    REQUIRED_CLUES: 100,
    // 방 타입 정의
    ROOM_TYPES: ["battle", "heal", "shop", "treasure", "event", "investigate", "empty"],

    /* [dungeon.js] generateDungeon 함수 교체 */

   /* [dungeon.js] generateDungeon 수정 (다키스트 던전 스타일 + config.data 반영) */
    generateDungeon: function(config) {
        this.isCity = false;
    if (typeof game !== 'undefined') game.hasRested = false;

    // 1. 방 덱(Deck) 구성하기
    // config.data에 정의된 방들을 리스트에 모두 담습니다.
    let roomDeck = [];
    if (config.data) {
        for (let type in config.data) {
            let count = config.data[type];
            for (let i = 0; i < count; i++) roomDeck.push(type);
        }
    }

    // 목표 방 개수보다 설정된 방이 적다면, 나머지는 'battle'이나 'empty'로 채웁니다.
    let targetCount = config.roomCount || 12;
    while (roomDeck.length < targetCount) {
        roomDeck.push(Math.random() < 0.6 ? "battle" : "empty");
    }

    // 덱 섞기 (Fisher-Yates Shuffle)
    for (let i = roomDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roomDeck[i], roomDeck[j]] = [roomDeck[j], roomDeck[i]];
    }

    // 덱에서 방을 하나씩 꺼내는 헬퍼 함수
    const popRoom = () => {
        if (roomDeck.length > 0) return roomDeck.pop();
        return Math.random() < 0.5 ? "battle" : "empty"; // 덱이 동나면 랜덤
    };

    // 2. 맵 크기 설정
    // 방을 다 배치할 수 있을 만큼 충분히 길게 잡습니다.
    // (메인 경로에 절반, 곁가지에 절반 정도 들어간다고 가정)
    this.width = Math.max(config.width || 8, Math.ceil(targetCount * 0.7) + 2);
    this.height = 3; // 위/중앙/아래 고정
    
    // 맵 배열 초기화
    this.map = Array.from({ length: this.height }, () => 
        Array.from({ length: this.width }, () => ({
            type: "wall", visited: false, exits: [], events: null
        }))
    );

    // ---------------------------------------------------------
    // [STEP 1] 척추 생성 (중앙 경로)
    // ---------------------------------------------------------
    let startY = 1; 
    let placedCount = 0;

    for (let x = 0; x < this.width; x++) {
        let type;

        if (x === 0) type = "start";
        else if (x === this.width - 1) type = "boss";
        else {
            // ★ 여기서 덱에서 뽑습니다.
            // 단, 너무 중요한 방(상점, 회복)이 메인 경로에만 몰리면 재미 없으므로
            // 50% 확률로 메인 경로에 배치하고, 아니면 곁가지 배치를 위해 아껴둡니다.
            // (덱이 많이 남았으면 배치, 얼마 안 남았으면 무조건 배치)
            
            if (roomDeck.length > (this.width - x) && Math.random() < 0.5) {
                // 아껴두기 (빈 복도로 만듦) -> 곁가지에서 쓰임
                type = "empty"; 
            } else {
                type = popRoom();
            }
        }

        this.map[startY][x] = { type: type, visited: false, exits: [], events: null };
        if (type === "boss") this.map[startY][x].locked = true;

        if (x === 0) {
            this.currentPos = { x: 0, y: startY };
            this.map[startY][x].visited = true;
        } else {
            this._connectRooms(x - 1, startY, x, startY);
        }
    }

    // ---------------------------------------------------------
    // [STEP 2] 갈비뼈 생성 (곁가지 방) - 남은 덱 털기
    // ---------------------------------------------------------
    // 메인 경로의 각 방(x)에서 위/아래로 방을 뚫어 남은 roomDeck을 배치합니다.
    
    for (let x = 1; x < this.width - 1; x++) {
        // 덱이 비었으면 더 이상 무리해서 만들지 않음 (확률적 중단)
        if (roomDeck.length === 0 && Math.random() < 0.8) continue;

        // 위쪽 방 (0, x)
        if (Math.random() < 0.4 || (roomDeck.length > 0 && Math.random() < 0.6)) {
            let type = popRoom();
            this.map[0][x] = { type: type, visited: false, exits: [], events: null };
            this._connectRooms(x, 1, x, 0);
        }

        // 아래쪽 방 (2, x)
        // 위쪽을 안 만들었으면 아래쪽은 만들 확률을 높임
        if (Math.random() < 0.4 || (roomDeck.length > 0 && Math.random() < 0.7)) {
            // 이미 위쪽을 만들었고 덱도 비었으면 패스
            if (this.map[0][x].type !== 'wall' && roomDeck.length === 0) continue;

            let type = popRoom();
            this.map[2][x] = { type: type, visited: false, exits: [], events: null };
            this._connectRooms(x, 1, x, 2);
        }
    }

    this.progress = 0;
    this.renderView();
},
    // (헬퍼 함수 추가) 가장 먼 방 찾기
    _findFurthestRoom: function(startX, startY) {
        let queue = [{x: startX, y: startY, dist: 0}];
        let visited = new Set([`${startX},${startY}`]);
        let maxDist = -1;
        let furthestRoom = null;

        while(queue.length > 0) {
            let curr = queue.shift();
            
            // 벽이 아니고 시작점이 아닌 방 중에서 가장 먼 곳 갱신
            if (this.map[curr.y][curr.x].type !== 'wall' && this.map[curr.y][curr.x].type !== 'start') {
                if (curr.dist > maxDist) {
                    maxDist = curr.dist;
                    furthestRoom = {x: curr.x, y: curr.y};
                }
            }

            // 연결된 방 탐색 (exits 정보 활용)
            let exits = this.map[curr.y][curr.x].exits;
            let neighbors = [];
            if (exits.includes('n')) neighbors.push({x: curr.x, y: curr.y - 1});
            if (exits.includes('s')) neighbors.push({x: curr.x, y: curr.y + 1});
            if (exits.includes('e')) neighbors.push({x: curr.x + 1, y: curr.y});
            if (exits.includes('w')) neighbors.push({x: curr.x - 1, y: curr.y});

            for (let n of neighbors) {
                if (!visited.has(`${n.x},${n.y}`)) {
                    visited.add(`${n.x},${n.y}`);
                    queue.push({x: n.x, y: n.y, dist: curr.dist + 1});
                }
            }
        }
        return furthestRoom;
    },

    // 도시 맵 생성 (고정 데이터)
    loadCity: function(districtData) {
        this.isCity = true;
        this.width = 3; this.height = 3; // 예시
        // 도시 데이터에 맞춰 this.map 수동 구성...
        // 도시에서는 모든 방 visited: true
    },

    // 2. 이동 로직 (스크롤)
    moveScroll: function(direction) {
        // direction: -1 (Left), 1 (Right)
        const speed = 2; // 이동 속도
        
        this.progress += direction * speed;
        
        // 범위 제한 및 방 이동 트리거
        if (this.progress < 0) {
            this.progress = 0;
            this.checkRoomTransition("left");
        } else if (this.progress > 100) {
            this.progress = 100;
            this.checkRoomTransition("right");
        }
        
        // 중앙 이벤트 트리거 (50% 지점)
        if (Math.abs(this.progress - 50) < speed) {
            this.checkRoomEvent();
        }

        this.updateParallax();
    },

// [dungeon.js] updateParallax 함수 교체 (자동 좌표 동기화)
updateParallax: function() {
    const bgLayer = document.getElementById('layer-bg');
    const fgLayer = document.getElementById('layer-fg');
    const objLayer = document.getElementById('dungeon-object');
    
    // [핵심] 플레이어와 스테이지 요소를 가져옵니다.
    const playerEl = document.getElementById('dungeon-player');
    const stageEl = document.getElementById('dungeon-stage');

    // [핵심 1] 동적 기준점 계산: "지금 플레이어가 스테이지 어디에 있는가?"
    // 이 계산 덕분에 수동으로 -400 같은 값을 넣을 필요가 사라집니다.
    // 플레이어가 왼쪽에 있든 중앙에 있든, 그 위치가 곧 '0'이 됩니다.
    let playerCenterX = 0;
    if (playerEl && stageEl) {
        const pRect = playerEl.getBoundingClientRect();
        const sRect = stageEl.getBoundingClientRect();
        // (플레이어 왼쪽 좌표 - 스테이지 왼쪽 좌표) + (플레이어 절반 너비) = 스테이지 내 플레이어 중심 X
        playerCenterX = (pRect.left - sRect.left) + (pRect.width / 2);
    }

    // [설정] 화면 배율 (방의 길이감)
    // 6.0 정도면 0~100 이동 시 적절한 거리가 나옵니다.
    const PIXEL_SCALE = 12; 

    // 배경 스크롤 (기존 유지)
    let globalX = (this.currentPos.x * 100) + this.progress;
    if (bgLayer) bgLayer.style.backgroundPosition = `${-globalX * 1.5}px 0`;
    if (fgLayer) fgLayer.style.backgroundPosition = `${-globalX * 4}px 0`;

    // 1. 오브젝트(상자 등) 위치 동기화
    if (objLayer && !objLayer.classList.contains('hidden')) {
        if (this.objectAnchor === undefined || this.objectAnchor === null) {
            this.objectAnchor = this.progress;
        }
        const objPos = this.objectAnchor;
        const dist = objPos - this.progress;
        const objOffset = dist * PIXEL_SCALE; 
        
        let absDist = Math.abs(dist);
        if (absDist > 70) {
            objLayer.style.opacity = 0;
            objLayer.style.pointerEvents = "none";
        } else {
            // ★ [변경점] left를 플레이어 위치로 고정하고, transform으로 거리만큼 이동
            // CSS의 left: 50% 등을 무시하고 JS가 계산한 좌표를 직접 꽂습니다.
            objLayer.style.left = `${playerCenterX}px`;
            objLayer.style.transform = `translateX(calc(-50% + ${objOffset}px))`;
            
            objLayer.style.opacity = 1;
            if (dist >= -15 && dist <= 15) objLayer.style.pointerEvents = "auto";
            else objLayer.style.pointerEvents = "none";
        }
    }

    // 2. 문(Door) 위치 동기화
    const doors = document.querySelectorAll('.dungeon-door');
    doors.forEach(door => {
        let doorPos = parseFloat(door.dataset.pos); // 0(시작) 또는 100(끝)
        let dist = doorPos - this.progress;         // 플레이어와의 거리 차이
        let doorOffset = dist * PIXEL_SCALE;        // 화면상 픽셀 거리
        
        // ★ [변경점] 문의 기준점(left)을 '현재 플레이어의 중심(playerCenterX)'으로 설정
        door.style.left = `${playerCenterX}px`;
        
        // ★ [변경점] 그 기준점에서 거리만큼만 이동 (자체 중심 정렬 포함)
        // progress가 0이고 doorPos가 0이면 offset은 0이 되어 플레이어와 정확히 겹칩니다.
        door.style.transform = `translateX(calc(-50% + ${doorOffset}px))`;
    });

    this.checkObjectVisibility();
},
    // [신규] 방 타입에 따라 오브젝트 표시/숨김 결정
  checkObjectVisibility: function() {
    let room = this.map[this.currentPos.y][this.currentPos.x];
    const objEl = document.getElementById('dungeon-object');
    const iconEl = document.getElementById('dungeon-obj-icon');
    const labelEl = document.getElementById('dungeon-obj-label');

    if (!objEl) return;

        // 1. 전투/시작/빈방/벽은 숨김 (클리어 여부 무관)
        if (room.type === 'battle' || room.type === 'start' || room.type === 'empty' || room.type === 'wall') {
            objEl.classList.add('hidden');
            return;
        }

        // [수정] 아이콘 및 라벨 설정
    let icon = "❓";
    let label = "조사하기";

    switch (room.type) {
        case 'treasure': icon = "🎁"; label = "보물상자"; break;
        case 'heal': icon = "🔥"; label = "모닥불"; break;
        case 'shop': icon = "⛺"; label = "상점"; break;
        case 'event': icon = "❔"; label = "무언가 있다"; break;
        case 'investigate': icon = "🔍"; label = "수상한 흔적"; break;
        case 'boss': icon = room.locked ? "🔒" : "👹"; label = room.locked ? "잠긴 문" : "보스"; break;
        
        // ★ [추가된 부분] 새로운 타입 정의
        case 'box': icon = "📦"; label = "낡은 상자"; break;
        case 'note': icon = "📄"; label = "떨어진 쪽지"; break;
        case 'bush': icon = "🌿"; label = "수상한 덤불"; break;
    }
        // 클리어된 방이면 표시만 하고 상호작용 비활성화
        if (room.cleared) {
            objEl.classList.remove('hidden');
            objEl.style.pointerEvents = 'none';
            objEl.style.opacity = 0.5;
            iconEl.innerText = "✔";
            labelEl.innerText = "비어 있음";
            return;
        }

        iconEl.innerText = icon;
        labelEl.innerText = label;
        
        // 3. 표시 + 활성화
        objEl.classList.remove('hidden');
        objEl.style.pointerEvents = 'auto';
        objEl.style.opacity = 1;
    },
    // [수정] 방 전환 팝업 제거 (이동 제한만 함)
    checkRoomTransition: function(side) {
        // 더 이상 팝업을 띄우지 않고, 그냥 진행도가 0이나 100을 넘어가지 않게만 막습니다.
        // 문이 그 위치에 있으니 클릭하면 됩니다.
        if (this.progress < 0) this.progress = 0;
        if (this.progress > 100) this.progress = 100;
        
        this.updateParallax(); // 위치 고정
    },
    // [dungeon.js] enterRoom 함수 교체
/* [dungeon.js] enterRoom 함수 수정 (슬라이딩 현상 완벽 제거) */
    enterRoom: function(dx, dy, fromBack = false) {
        closePopup();
        this.currentPos.x += dx;
        this.currentPos.y += dy;

    let room = this.map[this.currentPos.y][this.currentPos.x];
    room.visited = true;
    if (room.type === 'battle') {
        room.battleTriggered = false; // 재방문 시 다시 전투 가능
    }
    
    // 위치 데이터 초기화
    this.progress = fromBack ? 100 : 0;
    this.objectAnchor = 50; 

    // 1. DOM 요소 생성 (문, 오브젝트 등)
    this.renderDoors(room);
    this.checkObjectVisibility();

    // 2. [핵심] 화면에 배치된 움직이는 요소들을 모두 선택
    const targets = document.querySelectorAll('.dungeon-door, #dungeon-object');

    // 3. 트랜지션 '강제' 차단 (CSS 우선순위 최상위 !important 적용)
    // 위치를 잡는 동안에는 절대 애니메이션이 작동하지 않게 합니다.
    targets.forEach(el => {
        el.style.setProperty('transition', 'none', 'important');
        // 위치 잡는 찰나의 깜빡임도 방지하기 위해 투명하게 시작
        el.style.opacity = '0';
    });

    // 4. 위치 계산 즉시 실행 (여기서 transform/left 값이 텔레포트하듯 바뀜)
    this.updateParallax();

    // 5. 강제 리플로우 (브라우저가 변경된 위치를 즉시 계산하도록 강요)
    targets.forEach(el => void el.offsetWidth);

    // 6. 위치가 확정되었으므로 투명도 복구 (트랜지션은 여전히 꺼진 상태)
    targets.forEach(el => {
        el.style.opacity = '1';
    });

    // 7. [더블 rAF 패턴] 다음 프레임에 트랜지션 복구
    // setTimeout 대신 requestAnimationFrame을 두 번 중첩하면,
    // 브라우저가 "화면을 그리기(Paint)" 완료한 직후 시점을 정확히 잡아낼 수 있습니다.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            targets.forEach(el => {
                // 강제로 적용했던 transition: none 스타일 제거 -> CSS 파일의 설정으로 복귀
                el.style.removeProperty('transition');
            });
            // 혹시 모를 위치 어긋남 방지를 위해 한 번 더 갱신
            this.updateParallax();
        });
    });

    this.renderMinimap();
    log(`[${room.type}] 방에 진입했습니다.`);
    if (typeof autoSave === 'function') {
        autoSave();
    }

    // 방 진입 시 열려 있는 미니맵들 갱신
    const minimap = document.getElementById('minimap-overlay');
    if (minimap && !minimap.classList.contains('hidden')) {
        this.renderMinimap();
    }
    const miniInline = document.getElementById('minimap-inline');
    if (miniInline && !miniInline.classList.contains('hidden')) {
        this.renderMinimap('minimap-inline-grid', 22);
    }
},
/* [dungeon.js] renderDoors 함수 수정 (위치 논리 재정립) */
renderDoors: function(room) {
    const container = document.getElementById('dungeon-doors');
    if (!container) return;
    container.innerHTML = ""; // 초기화

    let exits = room.exits || [];

    // 1. [서쪽/West] = "뒤로 가기" (무조건 왼쪽 끝 0)
    // 시작 방이거나 서쪽 출구가 있을 때
    if (room.type === 'start' || exits.includes('w')) {
        let isStart = (room.type === 'start');
        let label = isStart ? "🚪 나가기" : "⬅ 이전 구역";
        let func = isStart 
            ? () => showPopup("나가기", "던전을 벗어납니다.", [{txt:"떠나기", func:()=>{closePopup(); renderHub();}}, {txt:"취소", func:closePopup}])
            : () => this.enterRoom(-1, 0, true); // 뒤로 들어가기(fromBack=true)

        this._createDoor(container, 0, "w", "🔙", label, func);
    }

    // 2. [동쪽/East] = "앞으로 가기" (무조건 오른쪽 끝 100)
    if (exits.includes('e')) {
        this._createDoor(container, 100, "e", "➡", "다음 구역", () => this.enterRoom(1, 0));
    }

    // 3. [북쪽/North] = "배경의 윗 문" (화면 중간 40 지점)
    if (exits.includes('n')) {
        // 아이콘을 문 모양으로 변경하여 '들어간다'는 느낌 주기
        this._createDoor(container, 40, "n", "🚪", "윗방 진입", () => this.enterRoom(0, -1));
    }

    // 4. [남쪽/South] = "배경의 아랫 문/지하실" (화면 중간 70 지점)
    if (exits.includes('s')) {
        this._createDoor(container, 70, "s", "🕳️", "아랫방 진입", () => this.enterRoom(0, 1));
    }
},

// [스타일 보정] 남/북 문은 배경에 박힌 느낌을 주기 위해 스타일을 조금 다르게 줄 수 있습니다.
_createDoor: function(container, pos, type, icon, label, onClick) {
    let el = document.createElement('div');
    el.className = `dungeon-door door-${type}`;
    el.dataset.pos = pos; 
    el.onclick = onClick;
    
    // 남/북 문은 조금 더 작게, 배경처럼 보이게 연출 (CSS 클래스 활용 가능)
    let extraStyle = "";
    if (type === 'n' || type === 's') {
        // 배경에 있는 문처럼 보이게 위로 살짝 올리고 색상 조정
        extraStyle = "filter: brightness(0.8); transform: scale(0.8) translateX(-50%); bottom: 60px;"; 
    }

    el.innerHTML = `
        <div class="door-icon" style="${extraStyle}">${icon}</div>
        <div class="door-label">${label}</div>
    `;
    
    container.appendChild(el);
},
    checkRoomEvent: function() {
        if (Math.abs(this.progress - 50) < 2) {
            let room = this.map[this.currentPos.y][this.currentPos.x];
            if (room.type === 'battle' && !room.battleTriggered) {
                if (typeof stopMove === 'function') stopMove();
                room.battleTriggered = true; // 이번 진입에서 한 번만 발생
                // [수정] 팝업을 닫고 전투를 시작하도록 변경
                showPopup("적 출현!", "전방에 적들이 있습니다!", [{
                    txt: "전투 개시",
                    func: () => {
                        closePopup(); // ★ 팝업 닫기 추가
                        startBattle();
                    }
                }]);
            }
        }
    },
    // [신규] 오브젝트 클릭 시 실행되는 함수
    interactWithObject: function() {
        let room = this.map[this.currentPos.y][this.currentPos.x];
        if (room.cleared) return;

        // 플레이어와 오브젝트 거리 체크 (너무 멀면 상호작용 불가)
        // 진입/퇴출 직전(5% 이내 또는 90% 이상)일 때는 상호작용 불가
        if (this.progress < 5 || this.progress > 90) {
            log("🚫 너무 멉니다. 더 가까이 가세요.");
            return;
        }

        // 이벤트 실행 분기
        if (room.type === 'treasure') {
            room.cleared = true;
            let gold = Math.floor(Math.random() * 200) + 100;
            player.gold += gold;
            updateUI();
            showPopup("상자 열기", `상자를 열었습니다!<br><span style="color:#f1c40f">${gold} 골드</span>를 획득했습니다.`, [{txt:"확인", func:closePopup}]);
        }
        else if (room.type === 'heal') {
            // 휴식은 반복 가능하게 할지, 1회성일지 결정 (여기선 1회성)
            // room.cleared = true; 
            renderRestScreen(); // 기존 game.js의 휴식 화면 호출 (팝업 형태가 아니라면 수정 필요)
            // 만약 팝업 형태라면:
            // showPopup("휴식", "쉬시겠습니까?", [{txt:"휴식", func:() => { restAction(); closePopup(); }}]);
        }
        else if (room.type === 'shop') {
            renderShopScreen(); // 상점 열기
        }
        else if (room.type === 'investigate') {
            this.resolveInvestigate(room); // 기존 조사 함수 호출
        }
        else if (room.type === 'event') {
            room.cleared = true;
            triggerRandomEvent(); // 랜덤 이벤트 실행
        }
        // 1. [상자] 아이템 획득 (회복약 등)
    else if (room.type === 'box') {
        room.cleared = true;
        let item = "회복약"; // 혹은 getRandomItem("consumable") 사용 가능
        
        // 아이템 획득 시도
        addItem(item, () => {
            updateUI();
            showPopup("상자 개봉", `상자 안에서 <span style="color:#2ecc71">[${item}]</span>을(를) 발견했습니다!`, [{txt:"확인", func:closePopup}]);
        });
        this.checkObjectVisibility(); // 아이콘 갱신 (빈 상자 처리)
    }

    // 2. [쪽지] 단서 획득 & 텍스트 출력
    else if (room.type === 'note') {
        room.cleared = true;
        let gain = 15; // 단서 획득량
        game.scenario.clues = Math.min(100, game.scenario.clues + gain);
        updateUI();

        let noteText = room.text || "'배달부는 폐기물 처리장으로 갔다'라고 적혀있습니다.";
        showPopup("쪽지 읽기", `<i>"${noteText}"</i><br><br><span style="color:#f1c40f">🔍 단서 획득 (+${gain})</span>`, [{txt:"확인", func:closePopup}]);
        this.checkObjectVisibility();
    }

    // 3. [덤불] 기습 전투 (경고 후 전투)
    else if (room.type === 'bush') {
        showPopup("⚠️ 경고", "덤불 속에서 부스럭거리는 소리가 들립니다.<br>(전투가 발생할 수 있습니다)", [
            {
                txt: "살펴본다",
                func: () => {
                    closePopup();
                    room.cleared = true;
                    // 적이 튀어나오는 연출 후 전투
                    showPopup("기습!", "덤불 속에 숨어있던 적이 튀어나왔습니다!", [{
                        txt: "전투 개시",
                        func: () => {
                            closePopup();
                            startBattle(); // 일반 전투 시작
                        }
                    }]);
                }
            },
            { txt: "건드리지 않는다", func: closePopup }
        ]);
    }
       else if (room.type === 'boss') {
    if (room.locked) {
        // [1] 잠겨 있을 때
        if (game.scenario.clues >= this.REQUIRED_CLUES) {
            room.locked = false; 
            this.checkObjectVisibility(); 
            showPopup("해금", "단서를 맞춰보니 보스의 위치가 확실해졌습니다.<br>문이 열립니다.", [{txt:"확인", func:closePopup}]);
        } else {
            showPopup("잠김", `단서가 부족하여 진입할 수 없습니다.<br>(${game.scenario.clues}/${this.REQUIRED_CLUES})`, [{txt:"돌아가기", func:closePopup}]);
        }
    } else {
        // [2] 열려 있을 때 (전투 진입)
        
        // ★ [수정] 보스전 시작 시 오브젝트(아이콘)를 즉시 숨깁니다.
        const objEl = document.getElementById('dungeon-object');
        if (objEl) objEl.classList.add('hidden');

        startBossBattle();
    }
}
        
        // 상호작용 후 UI 갱신 (클리어 표시만 갱신)
        if (room.cleared && room.type !== 'shop' && room.type !== 'heal') {
            this.checkObjectVisibility();
        }
    },
    // 3. 조사 결과 처리
    resolveInvestigate: function(room) {
        room.cleared = true; // 중복 조사 방지
        
        // 단서 획득 (20~30 랜덤)
        let gain = Math.floor(Math.random() * 10) + 20;
        game.scenario.clues = Math.min(100, game.scenario.clues + gain);
        
        // UI 갱신 (game.js의 updateUI 호출)
        updateUI(); 

        let msg = `단서를 확보했습니다! (+${gain})<br>현재 진척도: ${game.scenario.clues}%`;
        
        // 보스 해금 알림
        if (game.scenario.clues >= this.REQUIRED_CLUES) {
            msg += `<br><br><b style="color:#f1c40f">★ 보스 방의 위치가 파악되었습니다!</b>`;
            // (선택 사항) 미니맵에 보스방 아이콘 강조 표시 로직 추가 가능
        }

        showPopup("조사 완료", msg, [{txt:"확인", func:closePopup}]);
    },

    // 헬퍼: 방 연결
    _connectRooms: function(x1, y1, x2, y2) {
        let r1 = this.map[y1][x1];
        let r2 = this.map[y2][x2];
        
        if (x2 > x1) { r1.exits.push('e'); r2.exits.push('w'); }
        if (x2 < x1) { r1.exits.push('w'); r2.exits.push('e'); }
        if (y2 > y1) { r1.exits.push('s'); r2.exits.push('n'); }
        if (y2 < y1) { r1.exits.push('n'); r2.exits.push('s'); }
    },
    /* [dungeon.js] renderView 함수 수정 (초기 진입/텔레포트 시 슬라이딩 방지) */
renderView: function() {
    // 1. 현재 방 데이터 가져오기 및 문 생성
    let room = this.map[this.currentPos.y][this.currentPos.x];
    this.renderDoors(room);

    // 2. [핵심] 화면 요소 선택 (문, 오브젝트)
    const targets = document.querySelectorAll('.dungeon-door, #dungeon-object');

    // 3. 트랜지션 강제 차단 & 숨김 (위치 잡기 전)
    targets.forEach(el => {
        el.style.setProperty('transition', 'none', 'important');
        el.style.opacity = '0';
    });

    // 4. 위치 계산 (즉시 이동)
    this.updateParallax(); 

    // 5. 강제 리플로우 (브라우저가 이동한 위치를 즉시 인식하게 함)
    targets.forEach(el => void el.offsetWidth);

    // 6. 투명도 복구 (트랜지션은 아직 꺼진 상태)
    targets.forEach(el => el.style.opacity = '1');

    // 7. 다음 프레임에 트랜지션 복구 (애니메이션 기능 되살리기)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            targets.forEach(el => el.style.removeProperty('transition'));
            // 위치 재보정 (혹시 모를 오차 방지)
            this.updateParallax();
        });
    });
    
    // 미니맵 갱신
    const minimap = document.getElementById('minimap-overlay');
    if (minimap && !minimap.classList.contains('hidden')) {
        this.renderMinimap();
    }
    const miniMapPanel = document.getElementById('minimap-inline');
    if (miniMapPanel && !miniMapPanel.classList.contains('hidden')) {
        this.renderMinimap('minimap-inline-grid', 22);
    }
},
    // --- 지도 시스템 ---

    // 지도 켜기/끄기 (전역 함수 toggleMinimap에서 호출됨)
    toggleMinimap: function() {
        const el = document.getElementById('minimap-overlay');
        if (el.classList.contains('hidden')) {
            el.classList.remove('hidden');
            this.renderMinimap(); // 열 때마다 갱신
        } else {
            el.classList.add('hidden');
        }
    },

    // 상시 미니맵 토글 (우상단)
    toggleMiniMapInline: function() {
        const panel = document.getElementById('minimap-inline');
        const btn = document.getElementById('btn-minimap');
        if (!panel || !btn) return;
        const show = panel.classList.contains('hidden');
        if (show) {
            panel.classList.remove('hidden');
            btn.classList.add('hidden');
            this.renderMinimap('minimap-inline-grid', 22);
        } else {
            panel.classList.add('hidden');
            btn.classList.remove('hidden');
        }
    },

    /* [dungeon.js] renderMinimap 함수 전체 교체 */

renderMinimap: function(gridId = 'minimap-grid', cellSize = 50) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${this.width}, ${cellSize}px)`;
    grid.style.gridAutoRows = `${cellSize}px`;

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            let cellData = this.map[y][x];
            let el = document.createElement('div');
            el.className = 'map-cell';

            // [1] 가시성 체크
            let isRoom = cellData.type !== 'wall';
            let isVisited = cellData.visited;
            let isKnownWall = false;
            let isCurrent = (this.currentPos.x === x && this.currentPos.y === y);

            // 던전 모드일 때: 방문한 방 주변의 벽을 '아는 벽'으로 처리
            if (!this.isCity && !isVisited && !isRoom) {
                const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
                for (let d of dirs) {
                    let ny = y + d[1], nx = x + d[0];
                    if (ny >= 0 && ny < this.height && nx >= 0 && nx < this.width) {
                        if (this.map[ny][nx].visited && this.map[ny][nx].type !== 'wall') {
                            isKnownWall = true;
                            break;
                        }
                    }
                }
            }

            let isVisible = this.isCity || isCurrent || (isRoom && isVisited) || isKnownWall;

            if (isVisible) {
                // [2] 벽(Wall) 구역 표시
                if (!isRoom) {
                    el.classList.add('wall-cell');
                    el.innerText = "";
                } 
                // [3] 방(Room) 구역 표시
                else {
                    el.classList.add('visited');
                    
                    // 아이콘 설정
                    let icon = "";
                    switch(cellData.type) {
                        case 'start': icon = "🏠"; el.classList.add('start'); break;
                        case 'battle': icon = "⚔️"; break;
                        case 'boss': icon = "💀"; el.classList.add('boss'); break;
                        case 'shop': icon = "💰"; el.classList.add('shop'); break;
                        case 'heal': icon = "❤️"; break;
                        case 'treasure': icon = "📦"; break;
                        case 'event': icon = "❔"; break;
                        case 'investigate': icon = "🔍"; break;
                    }
                    el.innerText = icon;

                    // 현재 위치 표시
                    if (isCurrent) {
                        el.classList.add('current');
                        el.innerText = "";
                    }

                    // [4] 통로(Path) 연결 표시 (뚫린 길)
                    // CSS에서 border 색상을 다르게 하여 '문'처럼 보이게 함
                    if (cellData.exits.includes('n')) el.classList.add('path-n');
                    if (cellData.exits.includes('s')) el.classList.add('path-s');
                    if (cellData.exits.includes('e')) el.classList.add('path-e');
                    if (cellData.exits.includes('w')) el.classList.add('path-w');

                    if (this.isCity) {
                        el.classList.add('teleport-target');
                        el.onclick = () => this.teleport(x, y);
                    }
                }
            } else {
                // 완전히 모르는 구역 (안개)
                el.classList.add('fog');
            }

            grid.appendChild(el);
        }
    }
},

    // 도시 모드 전용: 클릭한 방으로 즉시 이동
    teleport: function(x, y) {
        if (this.currentPos.x === x && this.currentPos.y === y) return; // 제자리 클릭 무시
        
        this.currentPos = { x, y };
        this.progress = 0; // 방 입구로 초기화
        
        this.renderView();    // 화면 갱신 (배경 등)
        this.renderMinimap(); // 지도 갱신 (내 위치 마커 이동)
        
        // 이동 메시지
        let roomType = this.map[y][x].type;
        log(`🚀 [${roomType}] 구역으로 신속 이동했습니다.`);
    }
    
};

// 이동 버튼 홀드 처리용 변수
let moveInterval = null;

function startMove(direction) {
    if (moveInterval) clearInterval(moveInterval);
    
    const playerImg = document.getElementById('dungeon-player');
    
    if (playerImg) {
        if (direction === 1) {
            // 오른쪽: 클래스 제거 (정면)
            playerImg.classList.remove('facing-left'); 
        } else {
            // 왼쪽: 클래스 추가 (반전)
            playerImg.classList.add('facing-left'); 
        }
        
        // 걷기 애니메이션 시작
        playerImg.classList.add('anim-walk');
    }

    moveInterval = setInterval(() => {
        DungeonSystem.moveScroll(direction);
    }, 20);
}

function stopMove() {
    if (moveInterval) clearInterval(moveInterval);
    moveInterval = null;

    // 멈추면 걷기 애니메이션 제거
    const playerImg = document.getElementById('dungeon-player');
    if (playerImg) {
        playerImg.classList.remove('anim-walk');
    }
}
function toggleMinimap() {
    DungeonSystem.toggleMinimap();
}
