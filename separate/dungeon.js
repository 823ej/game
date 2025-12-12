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
    // [설정] 보스방 잠금 해제에 필요한 단서량
    REQUIRED_CLUES: 100,
    // 방 타입 정의
    ROOM_TYPES: ["battle", "heal", "shop", "treasure", "event", "investigate", "empty"],

    /* [dungeon.js] generateDungeon 함수 교체 */

    // 1. 던전 생성 (설정 기반)
    generateDungeon: function(config) {
        // 새 던전을 시작하면 휴식/이벤트 재사용 가능하도록 초기화
        if (typeof game !== 'undefined') {
            game.hasRested = false;
        }
        // 다키스트 던전 스타일: 좌→우 직선(전진) + 상/하 분기, 뒤로 이동 가능
        let targetCount = config.roomCount || 12;
        // 중앙 라인으로 충분히 깔 수 있도록 폭 보정
        this.width = Math.max(config.width || 8, targetCount + 1);
        this.height = 3; // 위/중앙/아래 3줄
        this.isCity = false;
        
        // [STEP 1] 방 덱 구성
        let roomDeck = [];
        if (config.data) {
            for (let type in config.data) {
                let count = config.data[type];
                for(let i=0; i<count; i++) roomDeck.push(type);
            }
        }
        while (roomDeck.length < targetCount) roomDeck.push(Math.random() < 0.7 ? "battle" : "empty");
        // 섞기
        for (let i = roomDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [roomDeck[i], roomDeck[j]] = [roomDeck[j], roomDeck[i]];
        }
        // 안전한 방 타입 추출 헬퍼 (덱이 비면 랜덤 생성)
        const pickRoomType = () => {
            if (roomDeck.length > 0) return roomDeck.pop();
            // 덱이 모두 소비된 경우에도 분기 방을 만들 수 있도록 기본 분포 사용
            const roll = Math.random();
            if (roll < 0.5) return "battle";
            if (roll < 0.7) return "event";
            if (roll < 0.85) return "treasure";
            return "empty";
        };

        // [STEP 2] 맵 초기화
        this.map = Array.from({ length: this.height }, () => 
            Array.from({ length: this.width }, () => ({
                type: "wall", visited: false, exits: [], events: null
            }))
        );

        // [STEP 3] 시작점 (좌측 중앙)
        let startX = 0;
        let startY = 1;
        this.currentPos = { x: startX, y: startY };
        this.map[startY][startX] = { type: "start", visited: true, exits: [], events: null };

        // [STEP 4] 메인 경로(중앙 열) 생성: 좌→우 직선
        let lastCol = startX;
        for (let x = 1; x < this.width && roomDeck.length > 0; x++) {
            let rType = pickRoomType() || "empty";
            this.map[startY][x] = { type: rType, visited: false, exits: [], events: null };
            this._connectRooms(x-1, startY, x, startY); // 좌우 연결
            lastCol = x;
        }

        // [STEP 5] 분기(위/아래) 생성: 각 열마다 랜덤으로 추가
        let hasNorthBranch = false;
        let hasSouthBranch = false;
        for (let x = 1; x <= lastCol; x++) {
            [0,2].forEach(y => {
                if (Math.random() < 0.6) { // 60% 확률로 분기 생성
                    if (this.map[y][x].type === 'wall') {
                        let rType = pickRoomType() || "empty";
                        this.map[y][x] = { type: rType, visited: false, exits: [], events: null };
                        // 같은 열의 중앙과 연결 (위/아래 이동)
                        this._connectRooms(x, 1, x, y);
                    }
                }
                if (this.map[y][x].type !== 'wall') {
                    if (y === 0) hasNorthBranch = true;
                    if (y === 2) hasSouthBranch = true;
                }
            });
        }
        // 분기가 하나도 없는 경우 강제로 위/아래에 최소 1개씩 생성 시도 (맵 겹침 없이)
        const forceBranch = (y) => {
            if (lastCol < 1) return;
            let candidates = [];
            for (let x = 1; x <= lastCol; x++) {
                if (this.map[y][x].type === 'wall') candidates.push(x);
            }
            if (candidates.length === 0) return;
            let pickX = candidates[Math.floor(Math.random() * candidates.length)];
            let rType = pickRoomType() || "empty";
            this.map[y][pickX] = { type: rType, visited: false, exits: [], events: null };
            this._connectRooms(pickX, 1, pickX, y);
        };
        if (!hasNorthBranch) forceBranch(0);
        if (!hasSouthBranch) forceBranch(2);
        // 위/아래 분기끼리 좌우 연결 (앞뒤 이동 가능)
        for (let x = 1; x < lastCol; x++) {
            [0,2].forEach(y => {
                if (this.map[y][x].type !== 'wall' && this.map[y][x+1].type !== 'wall') {
                    this._connectRooms(x, y, x+1, y);
                }
            });
        }

        // [STEP 6] 보스방: 가장 오른쪽(거리 최대) 방을 보스로 지정
        let furthest = this._findFurthestRoom(startX, startY);
        if (furthest) {
            this.map[furthest.y][furthest.x].type = "boss";
            this.map[furthest.y][furthest.x].locked = true;
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

    // [수정] 3. 시각적 업데이트 (오브젝트 위치 동기화 추가)
    updateParallax: function() {
        const bgLayer = document.getElementById('layer-bg');
        const fgLayer = document.getElementById('layer-fg');
        const objLayer = document.getElementById('dungeon-object');

        // 배경 스크롤 계산
        let globalX = (this.currentPos.x * 100) + this.progress;
        
        if (bgLayer) bgLayer.style.backgroundPosition = `${-globalX * 2}px 0`;
        if (fgLayer) fgLayer.style.backgroundPosition = `${-globalX * 6}px 0`;

        // ★ 오브젝트 위치 계산: 방 중앙에서 시작해 전진할수록 왼쪽으로 이동, 플레이어를 지나치면 사라짐
        if (objLayer && !objLayer.classList.contains('hidden')) {
            // 앵커가 초기화되지 않은 경우 현재 진행도를 기준으로 설정
            if (this.objectAnchor === undefined || this.objectAnchor === null) {
                this.objectAnchor = this.progress;
            }
            const objPos = this.objectAnchor; // 입장 시점(중앙)을 기준으로 위치 계산
            const dist = objPos - this.progress;
            const objOffset = Math.max(-800, Math.min(800, dist * 12)); // 이동량/클램프
            
            // 플레이어가 충분히 지나치면 사라지고 클릭 불가
            if (this.progress > objPos + 60) {
                objLayer.style.transform = `translateX(-800px)`;
                objLayer.style.opacity = 0;
                objLayer.style.pointerEvents = "none";
            } else {
                objLayer.style.transform = `translateX(${objOffset}px)`;
                objLayer.style.opacity = 1;
                // 근접 구간(입장 기준 ±15)에서만 클릭 가능
                if (this.progress >= objPos - 5 && this.progress <= objPos + 15) objLayer.style.pointerEvents = "auto";
                else objLayer.style.pointerEvents = "none";
            }
        }
        
        // ★ [추가] 방 진입/이동 시 오브젝트 표시 여부 실시간 체크
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
    // 4. 방 전환 및 갈림길 처리
    checkRoomTransition: function(side) {
    let currentRoom = this.map[this.currentPos.y][this.currentPos.x];
    let exits = currentRoom.exits; // 연결된 방향들 ['n', 's', 'e', 'w']
    
    // -------------------------------------------------------
    // [1] 오른쪽 끝 (100%): 다음 방으로 전진 (동쪽/북쪽/남쪽)
    // -------------------------------------------------------
    if (side === "right") {
        const options = [];
        
        // 1. 동쪽(e)으로 계속 전진
        if (exits.includes('e')) {
            options.push({txt: "➡ 동쪽 방으로", func: () => this.enterRoom(1, 0)});
        }
        
        // 2. 메인 경로(y=1)에서 위/아래 분기로 이동
        // (현재 방이 메인 통로이고, 위/아래와 연결되어 있다면)
        if (this.currentPos.y === 1) {
            if (exits.includes('n')) options.push({txt: "⬆ 위쪽 방으로", func: () => this.enterRoom(0, -1)});
            if (exits.includes('s')) options.push({txt: "⬇ 아래쪽 방으로", func: () => this.enterRoom(0, 1)});
        }

        // [★수정] 갈 곳이 없는 막다른 길일 때
            if (options.length === 0) {
                showPopup("막다른 길", "더 이상 나아갈 수 없습니다.", [
                    { 
                        txt: "확인", 
                        func: () => { 
                            closePopup(); 
                            // 방을 이동하지 않고, 위치만 살짝 뒤(90%)로 물러납니다.
                            this.progress = 90; 
                            this.updateParallax(); 
                        } 
                    }
                ]);
            }
        // 갈 곳이 있는 경우 (선택지 표시)
        else {
            options.push({
                txt: "취소",
                func: () => {
                    closePopup();
                    this.progress = 95; // 살짝 뒤로
                    this.updateParallax();
                }
            });
            showPopup("갈림길", "어디로 가시겠습니까?", options);
        }
    }
    
    // -------------------------------------------------------
    // [2] 왼쪽 끝 (0%): 이전 방으로 복귀 (뒤로 가기)
    // -------------------------------------------------------
    else if (side === "left") {
        // 시작방이면 던전 탈출
        if (currentRoom.type === 'start') {
            showPopup("나가기", "던전을 벗어납니다.", [
                { txt: "떠나기", func: () => { closePopup(); renderHub(); } },
                { txt: "취소", func: () => { closePopup(); this.progress = 5; this.updateParallax(); } }
            ]);
            return;
        }

        // 그 외 모든 방에서는 '이전 방'으로 이동
        // (어떤 방향에서 왔든, 왼쪽 끝은 돌아가는 문으로 통일)
        showPopup("이전 방으로 이동", "왔던 길로 돌아갑니다.", [
            { 
                txt: "돌아가기", 
                func: () => { 
                    closePopup(); 
                    this.returnToPreviousRoom(); // 지난번에 만든 복귀 헬퍼 사용
                } 
            },
            { 
                txt: "취소", 
                func: () => { 
                    closePopup(); 
                    this.progress = 5; // 살짝 앞으로
                    this.updateParallax(); 
                } 
            }
        ]);
    }
},
// [신규 헬퍼] 현재 위치에 맞춰 알맞은 '이전 방'으로 이동
returnToPreviousRoom: function() {
    // 1. 위쪽 방(y=0) -> 아래(남쪽, y+1)로 복귀
    if (this.currentPos.y === 0) {
        this.enterRoom(0, 1, true); // fromBack=true (문 앞에서 나옴)
    } 
    // 2. 아래쪽 방(y=2) -> 위(북쪽, y-1)로 복귀
    else if (this.currentPos.y === 2) {
        this.enterRoom(0, -1, true);
    } 
    // 3. 메인 통로(y=1) -> 서쪽(x-1)으로 복귀
    else {
        this.enterRoom(-1, 0, true);
    }
},
    enterRoom: function(dx, dy, fromBack = false) {
        closePopup();
        this.currentPos.x += dx;
        this.currentPos.y += dy;
        
        // 방 진입 처리
        let room = this.map[this.currentPos.y][this.currentPos.x];
        room.visited = true;
        
        // 위치 초기화 (앞문 진입: 0%, 뒷문 진입: 100%)
        this.progress = fromBack ? 100 : 0;
        this.objectAnchor = this.progress; // 입장 위치를 오브젝트 기준점으로 설정 (중앙에서 시작)
        // [★수정] 방 전환 시 슬라이딩 애니메이션 제거 (순간 이동)
        const objEl = document.getElementById('dungeon-object');
        if (objEl) {
            // 1. 애니메이션 끄기
            objEl.style.transition = 'none'; 
            
            // 2. 위치 강제 이동 (Parallax 계산)
            this.updateParallax(); 
            
            // 3. 강제 리플로우 (브라우저가 변경된 위치를 즉시 적용하게 함)
            void objEl.offsetWidth; 
            
            // 4. 애니메이션 복구 (CSS 파일의 원래 설정으로 되돌림)
            objEl.style.transition = ''; 
        } else {
            this.updateParallax();
        }
        
        // 미니맵 갱신
        this.renderMinimap();
        
        log(`[${room.type}] 방에 진입했습니다.`);
    },

    checkRoomEvent: function() {
        if (Math.abs(this.progress - 50) < 2) {
            let room = this.map[this.currentPos.y][this.currentPos.x];
            if (!room.cleared && room.type === 'battle') {
                if (typeof stopMove === 'function') stopMove();
                room.cleared = true; 
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
    // [★추가] renderView 함수 정의 (초기 화면 그리기)
    renderView: function() {
        this.updateParallax(); // 배경 및 캐릭터 위치 초기화
        
        // 만약 미니맵이 켜져 있다면 갱신
        const minimap = document.getElementById('minimap-overlay'); // (혹시 ID가 다르다면 확인 필요)
        if (minimap && !minimap.classList.contains('hidden')) {
            this.renderMinimap();
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

    /* [dungeon.js] renderMinimap 함수 전체 교체 */

renderMinimap: function() {
    const grid = document.getElementById('minimap-grid');
    if (!grid) return;
    
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${this.width}, 50px)`;

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            let cellData = this.map[y][x];
            let el = document.createElement('div');
            el.className = 'map-cell';
            
            // [1] 가시성 체크
            let isRoom = cellData.type !== 'wall';
            let isVisited = cellData.visited;
            let isKnownWall = false;

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

            let isVisible = this.isCity || (isRoom && isVisited) || isKnownWall;

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
                    if (this.currentPos.x === x && this.currentPos.y === y) {
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
                el.style.opacity = "0"; 
                el.style.pointerEvents = "none";
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
