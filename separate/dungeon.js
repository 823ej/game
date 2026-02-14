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

    /* [dungeon.js] generateDungeon 수정 (나뭇가지형 루트 + 재접속) */
    generateDungeon: function (config) {
        this.isCity = false;
        if (typeof game !== 'undefined') game.hasRested = false;

        // 1. 방 덱(Deck) 구성하기
        let roomDeck = [];
        if (config.data) {
            for (let type in config.data) {
                let count = config.data[type];
                for (let i = 0; i < count; i++) roomDeck.push(type);
            }
        }

        let targetCount = config.roomCount || 12;
        while (roomDeck.length < targetCount) {
            roomDeck.push(Math.random() < 0.6 ? "battle" : "empty");
        }

        for (let i = roomDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [roomDeck[i], roomDeck[j]] = [roomDeck[j], roomDeck[i]];
        }

        const popRoom = () => {
            if (roomDeck.length > 0) return roomDeck.pop();
            return Math.random() < 0.5 ? "battle" : "empty";
        };

        // 2. 맵 크기 설정
        this.width = Math.max(config.width || 8, Math.ceil(targetCount * 0.65) + 2);
        this.height = Math.max(3, config.height || 5);
        const midY = Math.floor(this.height / 2);

        const inBounds = (x, y) => (x >= 0 && x < this.width && y >= 0 && y < this.height);
        const isWall = (x, y) => inBounds(x, y) && this.map[y][x].type === "wall";

        // 맵 배열 초기화
        this.map = Array.from({ length: this.height }, () =>
            Array.from({ length: this.width }, () => ({
                type: "wall", visited: false, exits: [], events: null
            }))
        );

        const placeRoom = (x, y, type) => {
            if (!inBounds(x, y)) return false;
            if (!isWall(x, y)) return false;
            this.map[y][x] = { type: type, visited: false, exits: [], events: null };
            if (type === "boss" && !config.noClueLock) this.map[y][x].locked = true;
            return true;
        };

        // ---------------------------------------------------------
        // [STEP 1] 척추 생성 (중앙 경로)
        // ---------------------------------------------------------
        for (let x = 0; x < this.width; x++) {
            let type;

            if (x === 0) type = "start";
            else if (x === this.width - 1) type = config.noBoss ? popRoom() : "boss";
            else {
                if (roomDeck.length > (this.width - x) && Math.random() < 0.45) {
                    type = "empty";
                } else {
                    type = popRoom();
                }
            }

            this.map[midY][x] = { type: type, visited: false, exits: [], events: null };
            if (type === "boss" && !config.noClueLock) this.map[midY][x].locked = true;

            if (x === 0) {
                this.currentPos = { x: 0, y: midY };
                this.map[midY][x].visited = true;
            } else {
                this._connectRooms(x - 1, midY, x, midY);
            }
        }

        // ---------------------------------------------------------
        // [STEP 2] 가지 생성 (상/하 분기 + 가끔 재접속)
        // ---------------------------------------------------------
        const maxBranchLen = Math.max(1, Math.min(
            (Number.isInteger(config.branchMaxLen) ? config.branchMaxLen : 3),
            this.height - 1
        ));
        const branchChance = (typeof config.branchChance === "number") ? config.branchChance : 0.55;
        const branchDirChance = (typeof config.branchDirChance === "number") ? config.branchDirChance : 0.6;
        const reconnectChance = (typeof config.reconnectChance === "number") ? config.reconnectChance : 0.65;
        const tryBranch = (baseX, baseY, dir) => {
            if (roomDeck.length === 0) return 0;
            let made = 0;
            let lastX = baseX;
            let lastY = baseY;
            const len = 1 + Math.floor(Math.random() * maxBranchLen);

            for (let i = 1; i <= len; i++) {
                const y = baseY + (dir * i);
                if (!isWall(baseX, y)) break;
                placeRoom(baseX, y, popRoom());
                this._connectRooms(lastX, lastY, baseX, y);
                lastX = baseX;
                lastY = y;
                made++;
            }

            if (made === 0) return 0;

            // 가지 끝에서 오른쪽으로 이어지며 재접속 시도
            if (Math.random() < reconnectChance) {
                const driftMax = Math.min(4, this.width - lastX - 1);
                const driftLen = 1 + Math.floor(Math.random() * Math.max(1, driftMax));
                let x = lastX;
                for (let i = 1; i <= driftLen; i++) {
                    const nx = x + 1;
                    if (!inBounds(nx, lastY)) break;
                    if (!isWall(nx, lastY)) {
                        this._connectRooms(x, lastY, nx, lastY);
                        break;
                    }
                    placeRoom(nx, lastY, popRoom());
                    this._connectRooms(x, lastY, nx, lastY);
                    x = nx;
                    made++;
                }
            }
            return made;
        };

        for (let x = 1; x < this.width - 1; x++) {
            if (roomDeck.length === 0 && Math.random() < 0.75) continue;

            if (Math.random() < branchChance) {
                if (Math.random() < branchDirChance) tryBranch(x, midY, -1);
                if (Math.random() < branchDirChance) tryBranch(x, midY, 1);
            }
        }

        // ---------------------------------------------------------
        // [STEP 3] 남은 방 분산 배치 (가지 확장)
        // ---------------------------------------------------------
        let roomList = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.map[y][x].type !== "wall") roomList.push({ x, y });
            }
        }

        const dirs = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
        ];
        const loopChance = (typeof config.loopChance === "number") ? config.loopChance : 0.25;
        let guard = 0;
        while (roomDeck.length > 0 && guard < 5000 && roomList.length > 0) {
            guard++;
            const src = roomList[Math.floor(Math.random() * roomList.length)];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            const nx = src.x + dir.dx;
            const ny = src.y + dir.dy;
            if (!isWall(nx, ny)) continue;
            placeRoom(nx, ny, popRoom());
            this._connectRooms(src.x, src.y, nx, ny);
            roomList.push({ x: nx, y: ny });

            // 가끔 이웃 방과 추가 연결해 루프 생성
            if (Math.random() < loopChance) {
                for (let d of dirs) {
                    const ax = nx + d.dx;
                    const ay = ny + d.dy;
                    if (!inBounds(ax, ay)) continue;
                    if (this.map[ay][ax].type === "wall") continue;
                    this._connectRooms(nx, ny, ax, ay);
                }
            }
        }

        this.progress = 0;
        this.renderView();
    },
    // (헬퍼 함수 추가) 가장 먼 방 찾기
    _findFurthestRoom: function (startX, startY) {
        let queue = [{ x: startX, y: startY, dist: 0 }];
        let visited = new Set([`${startX},${startY}`]);
        let maxDist = -1;
        let furthestRoom = null;

        while (queue.length > 0) {
            let curr = queue.shift();

            // 벽이 아니고 시작점이 아닌 방 중에서 가장 먼 곳 갱신
            if (this.map[curr.y][curr.x].type !== 'wall' && this.map[curr.y][curr.x].type !== 'start') {
                if (curr.dist > maxDist) {
                    maxDist = curr.dist;
                    furthestRoom = { x: curr.x, y: curr.y };
                }
            }

            // 연결된 방 탐색 (exits 정보 활용)
            let exits = this.map[curr.y][curr.x].exits;
            let neighbors = [];
            if (exits.includes('n')) neighbors.push({ x: curr.x, y: curr.y - 1 });
            if (exits.includes('s')) neighbors.push({ x: curr.x, y: curr.y + 1 });
            if (exits.includes('e')) neighbors.push({ x: curr.x + 1, y: curr.y });
            if (exits.includes('w')) neighbors.push({ x: curr.x - 1, y: curr.y });

            for (let n of neighbors) {
                if (!visited.has(`${n.x},${n.y}`)) {
                    visited.add(`${n.x},${n.y}`);
                    queue.push({ x: n.x, y: n.y, dist: curr.dist + 1 });
                }
            }
        }
        return furthestRoom;
    },

    // 도시 맵 생성 (고정 데이터)
    loadCityArea: function (area) {
        if (!area || !Array.isArray(area.spots) || area.spots.length === 0) return;
        this.isCity = true;

        // 그리드 좌표 계산 (grid.x/y가 있으면 사용, 없으면 일렬 배치)
        let coords = area.spots.map((s, idx) => {
            if (s.grid && Number.isInteger(s.grid.x) && Number.isInteger(s.grid.y)) {
                return { id: s.id, x: s.grid.x, y: s.grid.y };
            }
            return { id: s.id, x: idx, y: 0 };
        });
        let minX = Math.min(...coords.map(c => c.x));
        let maxX = Math.max(...coords.map(c => c.x));
        let minY = Math.min(...coords.map(c => c.y));
        let maxY = Math.max(...coords.map(c => c.y));
        const width = (maxX - minX + 1);
        const height = (maxY - minY + 1);

        this.width = Math.max(1, width);
        this.height = Math.max(1, height);

        this.map = Array.from({ length: this.height }, () =>
            Array.from({ length: this.width }, () => ({
                type: "city", visited: true, exits: [], events: null, citySpot: null
            }))
        );

        area.spots.forEach((spot, idx) => {
            const coord = coords[idx];
            const x = coord.x - minX;
            const y = coord.y - minY;
            const room = this.map[y][x];
            room.type = "city";
            room.citySpot = spot;
            room.visited = true; // 도시 모드는 전체 가시화
            // 네 방향 연결은 아래에서 일괄 처리
        });

        // 네 방향 인접 연결 생성
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const room = this.map[y][x];
                if (!room.citySpot) continue;
                const exits = room.exits;
                if (y > 0 && this.map[y - 1][x].citySpot) exits.push('n');
                if (y < this.height - 1 && this.map[y + 1][x].citySpot) exits.push('s');
                if (x > 0 && this.map[y][x - 1].citySpot) exits.push('w');
                if (x < this.width - 1 && this.map[y][x + 1].citySpot) exits.push('e');
            }
        }

        // 시작 위치: 중앙 하단 칸을 우선 선택 (가장 아래 줄에서 중앙에 가까운 스팟)
        const maxRow = Math.max(...coords.map(c => c.y - minY));
        const bottomSpots = coords.filter(c => (c.y - minY) === maxRow);
        const centerX = this.width / 2;
        let startCoord = bottomSpots.sort((a, b) => Math.abs((a.x - minX) - centerX) - Math.abs((b.x - minX) - centerX))[0];

        // 만약 하단 스팟이 없다면 지정된 start나 첫 스팟 사용
        if (!startCoord) {
            const startId = area.start || (area.spots[0] && area.spots[0].id);
            startCoord = coords.find(c => c.id === startId) || coords[0];
        }

        this.currentPos = { x: startCoord.x - minX, y: startCoord.y - minY };
        if (this.currentPos.x < 0) this.currentPos.x = 0;
        if (this.currentPos.y < 0) this.currentPos.y = this.height - 1;
        this.progress = 0;
        this.objectAnchor = 50;
        this.renderView();
    },

    // 2. 이동 로직 (스크롤)
    moveScroll: function (direction) {
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
    updateParallax: function () {
        const bgLayer = document.getElementById('layer-bg');
        const fgLayer = document.getElementById('layer-fg');
        const objLayer = document.getElementById('dungeon-objects');

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
                const inBattle = (typeof game !== 'undefined') && (game.state === 'battle' || game.state === 'social');
                if (inBattle) {
                    objLayer.style.pointerEvents = "none";
                } else if (dist >= -15 && dist <= 15) {
                    objLayer.style.pointerEvents = "auto";
                } else {
                    objLayer.style.pointerEvents = "none";
                }
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
    checkObjectVisibility: function () {
        let room = this.map[this.currentPos.y][this.currentPos.x];
        const objWrap = document.getElementById('dungeon-objects');
        if (!objWrap) return;

        const setObjects = (list, opts = {}) => {
            objWrap.innerHTML = "";
            list.forEach(obj => {
                const el = document.createElement('div');
                el.className = 'room-object';
                if (opts.disabled) {
                    el.style.pointerEvents = 'none';
                }
                const icon = obj.icon || "❓";
                const label = obj.label || "조사하기";
                el.innerHTML = `
                  <div class="dungeon-obj-icon">${icon}</div>
                  <div class="dungeon-obj-label">${label}</div>
              `;
                if (!opts.disabled) {
                    el.onclick = () => {
                        if (obj.onClick) obj.onClick();
                        else if (obj.data) this.interactWithObject(obj.data);
                        else this.interactWithObject();
                    };
                }
                objWrap.appendChild(el);
            });
        };

        // 1. 전투/시작/빈방/벽은 숨김 (클리어 여부 무관)
        if (!this.isCity && (room.type === 'battle' || room.type === 'start' || room.type === 'empty' || room.type === 'wall')) {
            objWrap.classList.add('hidden');
            return;
        }

        const inBattle = (typeof game !== 'undefined') && (game.state === 'battle' || game.state === 'social');

        if (this.isCity && room.citySpot) {
            const objects = Array.isArray(room.citySpot.objects) ? room.citySpot.objects : [];
            if (objects.length === 0) {
                objWrap.classList.add('hidden');
                return;
            }
            const list = objects.map(obj => ({
                icon: obj.icon || room.citySpot.icon || "🏢",
                label: obj.name || room.citySpot.name || "건물",
                data: obj
            }));
            setObjects(list, { disabled: inBattle });
            objWrap.classList.remove('hidden');
            objWrap.style.pointerEvents = inBattle ? 'none' : 'auto';
            objWrap.style.opacity = 1;
            return;
        }

        // 비도시: 아이콘 및 라벨 설정
        let icon = "❓";
        let label = "조사하기";
        switch (room.type) {
            case 'treasure': icon = "🎁"; label = "보물상자"; break;
            case 'heal': icon = "🔥"; label = "모닥불"; break;
            case 'shop': icon = "⛺"; label = "상점"; break;
            case 'event': icon = "❔"; label = "무언가 있다"; break;
            case 'investigate': icon = "🔍"; label = "수상한 흔적"; break;
            case 'boss': icon = room.locked ? "🔒" : "👹"; label = room.locked ? "잠긴 문" : "보스"; break;
            case 'box': icon = "📦"; label = "낡은 상자"; break;
            case 'note': icon = "📄"; label = "떨어진 쪽지"; break;
            case 'bush': icon = "🌿"; label = "수상한 덤불"; break;
        }

        if (room.cleared && !this.isCity) {
            setObjects([{ icon: "✔", label: "비어 있음" }], { disabled: true });
            objWrap.classList.remove('hidden');
            objWrap.style.pointerEvents = 'none';
            objWrap.style.opacity = 0.5;
            return;
        }

        setObjects([{ icon, label }], { disabled: inBattle });
        objWrap.classList.remove('hidden');
        objWrap.style.pointerEvents = inBattle ? 'none' : 'auto';
        objWrap.style.opacity = 1;
    },
    // [수정] 방 전환 팝업 제거 (이동 제한만 함)
    checkRoomTransition: function (side) {
        if (this.progress < 0) this.progress = 0;
        if (this.progress > 100) this.progress = 100;
        this.updateParallax();
    },

    /* [dungeon.js] enterRoom 함수 수정 (슬라이딩 현상 완벽 제거 + 전투 중 이동 방지) */
    enterRoom: function (dx, dy, fromBack = false) {
        // [방어 로직] 전투 중 이동 불가
        if (typeof game !== 'undefined' && game.state === 'battle') {
            if (typeof log === 'function') log("⚠️ 전투 중에는 이동할 수 없습니다.");
            return;
        }

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
        const targets = document.querySelectorAll('.dungeon-door, #dungeon-objects');

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
    renderDoors: function (room) {
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
                ? () => showPopup("나가기", "던전을 벗어납니다.", [{ txt: "떠나기", func: () => { closePopup(); renderHub(); } }, { txt: "취소", func: closePopup }])
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
    _createDoor: function (container, pos, type, icon, label, onClick) {
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
    checkRoomEvent: function () {
        if (this.isCity) return;
        if (Math.abs(this.progress - 50) < 2) {
            let room = this.map[this.currentPos.y][this.currentPos.x];
            if (room.type === 'battle' && !room.battleTriggered) {
                if (typeof stopMove === 'function') stopMove();
                room.battleTriggered = true; // 이번 진입에서 한 번만 발생
                // 팝업 없이 로그에만 알림 후 바로 전투 시작
                log("⚠️ 적이 나타났습니다! 전투를 시작합니다.");
                startBattle();
            }
        }
    },
    // [신규] 오브젝트 클릭 시 실행되는 함수
    interactWithObject: function (objOverride) {
        if (typeof game !== 'undefined' && game.state === 'battle') {
            log("⚠️ 전투 중에는 상호작용할 수 없습니다.");
            return;
        }
        let room = this.map[this.currentPos.y][this.currentPos.x];
        if (room.cleared && !this.isCity) return;

        // 플레이어와 오브젝트 거리 체크 (너무 멀면 상호작용 불가)
        if (this.progress < 5 || this.progress > 90) {
            log("🚫 너무 멉니다. 더 가까이 가세요.");
            return;
        }

        if (this.isCity && room.citySpot) {
            const objects = Array.isArray(room.citySpot.objects) ? room.citySpot.objects : [];
            const runCityObject = (obj) => {
                const name = obj.name || "이름 없는 객체";
                const action = obj.action || "";
                const dungeonId = obj.dungeonId || obj.targetDungeon;
                if (action === 'enter_dungeon' && dungeonId) {
                    if (typeof startCityDungeon === 'function') startCityDungeon(dungeonId);
                } else if (action === 'return_hub') {
                    if (typeof renderHub === 'function') renderHub();
                } else if (action === 'enter_city_area' && obj.areaId) {
                    if (typeof startCityExploration === 'function') {
                        startCityExploration(obj.areaId, obj.spotId);
                    }
                } else if (action === 'enter_scenario' && obj.scenarioId) {
                    if (typeof startScenarioFromCity === 'function') {
                        startScenarioFromCity(obj.scenarioId);
                    }
                } else if (action === 'subway_transfer_select') {
                    const options = Array.isArray(obj.options) ? obj.options : [];
                    if (options.length === 0) return;
                    const buttons = options.map(opt => ({
                        txt: opt.label,
                        func: () => {
                            closePopup();
                            if (typeof startCityExploration === 'function') {
                                startCityExploration(opt.areaId, opt.spotId);
                            }
                        }
                    }));
                    if (typeof showChoice === 'function') {
                        showChoice("🚇 이동할 역을 선택하세요", "목적지를 선택하면 바로 이동합니다.", buttons);
                    } else {
                        showPopup("🚇 이동할 역을 선택하세요", "목적지를 선택하면 바로 이동합니다.", buttons);
                    }
                } else if (action === 'open_casefiles') {
                    if (typeof closePopup === 'function') closePopup();
                    if (typeof openCaseFiles === 'function') openCaseFiles();
                } else if (action === 'hospital_cure') {
                    if (typeof openHospitalCure === 'function') openHospitalCure();
                } else if (action === 'open_occult_shop') {
                    if (typeof renderShopScreen === 'function') renderShopScreen("shop_occult");
                } else if (action === 'open_sauna') {
                    if (typeof openSaunaRest === 'function') openSaunaRest();
                } else if (action === 'open_occult_clinic') {
                    if (typeof openOccultClinic === 'function') openOccultClinic();
                } else if (action === 'open_healing_clinic') {
                    if (typeof openHealingClinic === 'function') openHealingClinic();
                } else if (action === 'hecate_dialogue') {
                    const options = [
                        {
                            txt: "의뢰 목록 보기",
                            func: () => {
                                closePopup();
                                if (typeof openCaseFiles === 'function') openCaseFiles();
                            }
                        },
                        { txt: "대화 종료", func: closePopup }
                    ];
                    if (typeof showChoice === 'function') {
                        showChoice("레이디 헤카테", "의뢰가 필요하면 말만 해요.", options);
                    } else {
                        showPopup("레이디 헤카테", "의뢰가 필요하면 말만 해요.", options);
                    }
                } else if (action === 'npc_dialogue' && obj.npcKey) {
                    const npc = (typeof NPC_DATA !== 'undefined') ? NPC_DATA[obj.npcKey] : null;
                    const title = npc?.name || "해결사";
                    const desc = npc?.desc || "말을 건다.";
                    if (typeof showChoice === 'function') {
                        showChoice(title, desc, [{ txt: "대화 종료", func: closePopup }]);
                    } else {
                        showPopup(title, desc, [{ txt: "대화 종료", func: closePopup }]);
                    }
                } else {
                    log(`▶ ${name}을(를) 살펴봅니다. (내부 진입 예정)`);
                }
            };
            if (objOverride) {
                runCityObject(objOverride);
                return;
            }
            if (objects.length > 0) {
                if (objects.length === 1) {
                    runCityObject(objects[0]);
                } else {
                    const title = room.citySpot.name || "상호작용";
                    const desc = "무엇을 할까?";
                    const buttons = objects.map(obj => {
                        const label = `${obj.icon ? `${obj.icon} ` : ""}${obj.name || "상호작용"}`;
                        return {
                            txt: label,
                            func: () => {
                                if (typeof closePopup === 'function') closePopup();
                                runCityObject(obj);
                            }
                        };
                    });
                    buttons.push({ txt: "취소", func: closePopup });
                    if (typeof showChoice === 'function') {
                        showChoice(title, desc, buttons);
                    } else {
                        showPopup(title, desc, buttons);
                    }
                }
            } else {
                log("▶ 내부 진입/상호작용은 추후 구현 예정입니다.");
            }
            return;
        }

        // 이벤트 실행 분기
        if (room.type === 'treasure') {
            room.cleared = true;
            let gold = Math.floor(Math.random() * 200) + 100;
            player.gold += gold;
            updateUI();
            showPopup("상자 열기", `상자를 열었습니다!<br><span style="color:#f1c40f">${gold} 골드</span>를 획득했습니다.`, [{ txt: "확인", func: closePopup }]);
        }
        else if (room.type === 'heal') {
            renderRestScreen();
        }
        else if (room.type === 'shop') {
            renderShopScreen();
        }
        else if (room.type === 'investigate') {
            this.resolveInvestigate(room);
        }
        else if (room.type === 'event') {
            room.cleared = true;
            triggerRandomEvent();
        }
        // 1. [상자] 아이템 획득 (회복약 등)
        else if (room.type === 'box') {
            room.cleared = true;
            let item = "회복약"; // 혹은 getRandomItem("consumable") 사용 가능

            // 아이템 획득 시도
            addItem(item, () => {
                updateUI();
                showPopup("상자 개봉", `상자 안에서 <span style="color:#2ecc71">[${item}]</span>을(를) 발견했습니다!`, [{ txt: "확인", func: closePopup }]);
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
            showPopup("쪽지 읽기", `<i>"${noteText}"</i><br><br><span style="color:#f1c40f">🔍 단서 획득 (+${gain})</span>`, [{ txt: "확인", func: closePopup }]);
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
            const discovery = game.scenario && game.scenario.customDungeon && game.scenario.customDungeon.discoverCitySpot;
            if (discovery && !room.cleared) {
                room.cleared = true;
                if (typeof unlockCitySpot === 'function') {
                    unlockCitySpot(discovery.areaId, discovery.key);
                }
                showPopup("발견", `${discovery.name} 구역을 찾아냈습니다!<br>이제 지도에서 바로 이동할 수 있습니다.`, [
                    { txt: "복귀", func: () => { closePopup(); handleDungeonExit(); } },
                    { txt: "계속 탐색", func: closePopup }
                ]);
                return;
            }
            if (room.locked) {
                // [1] 잠겨 있을 때
                if (game.scenario.clues >= this.REQUIRED_CLUES) {
                    room.locked = false;
                    this.checkObjectVisibility();
                    showPopup("해금", "단서를 맞춰보니 보스의 위치가 확실해졌습니다.<br>문이 열립니다.", [{ txt: "확인", func: closePopup }]);
                } else {
                    showPopup("잠김", `단서가 부족하여 진입할 수 없습니다.<br>(${game.scenario.clues}/${this.REQUIRED_CLUES})`, [{ txt: "돌아가기", func: closePopup }]);
                }
            } else {
                // [2] 열려 있을 때 (전투 진입)

                // ★ [수정] 보스전 시작 시 오브젝트(아이콘)를 즉시 숨깁니다.
                const objEl = document.getElementById('dungeon-objects');
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
    resolveInvestigate: function (room) {
        room.cleared = true; // 중복 조사 방지

        if (!game.scenario || !game.scenario.isActive) {
            updateUI();
            showPopup("조사 완료", "주변을 조사했지만 진행도에 영향이 없습니다.", [{ txt: "확인", func: closePopup }]);
            return;
        }

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

        showPopup("조사 완료", msg, [{ txt: "확인", func: closePopup }]);
    },

    // 헬퍼: 방 연결
    _connectRooms: function (x1, y1, x2, y2) {
        let r1 = this.map[y1][x1];
        let r2 = this.map[y2][x2];

        if (x2 > x1) { r1.exits.push('e'); r2.exits.push('w'); }
        if (x2 < x1) { r1.exits.push('w'); r2.exits.push('e'); }
        if (y2 > y1) { r1.exits.push('s'); r2.exits.push('n'); }
        if (y2 < y1) { r1.exits.push('n'); r2.exits.push('s'); }
    },
    /* [dungeon.js] renderView 함수 수정 (초기 진입/텔레포트 시 슬라이딩 방지) */
    renderView: function () {
        // 1. 현재 방 데이터 가져오기 및 문 생성
        let room = this.map[this.currentPos.y][this.currentPos.x];
        this.renderDoors(room);

        // 2. [핵심] 화면 요소 선택 (문, 오브젝트)
        const targets = document.querySelectorAll('.dungeon-door, #dungeon-objects');

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
    toggleMinimap: function () {
        const el = document.getElementById('minimap-overlay');
        if (el.classList.contains('hidden')) {
            el.classList.remove('hidden');
            this.renderMinimap(); // 열 때마다 갱신
        } else {
            el.classList.add('hidden');
        }
    },

    // 상시 미니맵 토글 (우상단)
    toggleMiniMapInline: function () {
        const panel = document.getElementById('minimap-inline');
        const btn = document.getElementById('btn-minimap');
        if (!panel || !btn) return;
        if (this.isCity) {
            panel.classList.add('hidden');
            btn.classList.remove('hidden');
            this.toggleMinimap();
            return;
        }
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

    renderMinimap: function (gridId = 'minimap-grid', cellSize = 50) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        // 도시 모드일 때는 지도를 넉넉하게 키움
        if (this.isCity) {
            if (gridId === 'minimap-grid') cellSize = 110;
            if (gridId === 'minimap-inline-grid') cellSize = 40;
        }

        const overlay = document.getElementById('minimap-overlay');
        const isCityOverlay = this.isCity && gridId === 'minimap-grid';
        if (overlay) overlay.classList.toggle('city-minimap-full', isCityOverlay);
        grid.classList.toggle('city-minimap-grid', isCityOverlay);

        const panel = overlay ? overlay.querySelector('.inventory-panel') : null;
        const scrollWrap = grid.parentElement;
        if (panel && isCityOverlay) {
            if (!panel.dataset.defaultMaxWidth) {
                panel.dataset.defaultMaxWidth = panel.style.maxWidth || "";
                panel.dataset.defaultWidth = panel.style.width || "";
                panel.dataset.defaultHeight = panel.style.height || "";
                panel.dataset.defaultDisplay = panel.style.display || "";
                panel.dataset.defaultFlexDirection = panel.style.flexDirection || "";
                panel.dataset.defaultAlignItems = panel.style.alignItems || "";
                panel.dataset.defaultOverflow = panel.style.overflow || "";
            }
            panel.style.maxWidth = "95vw";
            panel.style.width = "95vw";
            panel.style.height = "90vh";
            panel.style.display = "flex";
            panel.style.flexDirection = "column";
            panel.style.alignItems = "stretch";
            panel.style.overflow = "hidden";

            if (scrollWrap) {
                if (!scrollWrap.dataset.defaultOverflow) {
                    scrollWrap.dataset.defaultOverflow = scrollWrap.style.overflow || "";
                    scrollWrap.dataset.defaultFlex = scrollWrap.style.flex || "";
                    scrollWrap.dataset.defaultMinHeight = scrollWrap.style.minHeight || "";
                }
                scrollWrap.style.flex = "1";
                scrollWrap.style.overflow = "auto";
                scrollWrap.style.minHeight = "0";
            }
        } else if (panel) {
            panel.style.maxWidth = panel.dataset.defaultMaxWidth || "";
            panel.style.width = panel.dataset.defaultWidth || "";
            panel.style.height = panel.dataset.defaultHeight || "";
            panel.style.display = panel.dataset.defaultDisplay || "";
            panel.style.flexDirection = panel.dataset.defaultFlexDirection || "";
            panel.style.alignItems = panel.dataset.defaultAlignItems || "";
            panel.style.overflow = panel.dataset.defaultOverflow || "";

            if (scrollWrap && scrollWrap.dataset.defaultOverflow !== undefined) {
                scrollWrap.style.overflow = scrollWrap.dataset.defaultOverflow || "";
                scrollWrap.style.flex = scrollWrap.dataset.defaultFlex || "";
                scrollWrap.style.minHeight = scrollWrap.dataset.defaultMinHeight || "";
            }
        }

        grid.innerHTML = "";
        grid.style.gridTemplateColumns = `repeat(${this.width}, ${cellSize}px)`;
        grid.style.gridAutoRows = `${cellSize}px`;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let cellData = this.map[y][x];
                let el = document.createElement('div');
                el.className = 'map-cell';

                // [1] 가시성 체크
                let isRoom = cellData.type !== 'wall' && (!this.isCity || !!cellData.citySpot);
                let isVisited = cellData.visited;
                let isKnownWall = false;
                let isCurrent = (this.currentPos.x === x && this.currentPos.y === y);

                // 던전 모드일 때: 방문한 방 주변의 벽을 '아는 벽'으로 처리
                if (!this.isCity && !isVisited && !isRoom) {
                    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
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
                        switch (cellData.type) {
                            case 'start': icon = "🏠"; el.classList.add('start'); break;
                            case 'battle': icon = "⚔️"; break;
                            case 'boss': icon = "💀"; el.classList.add('boss'); break;
                            case 'shop': icon = "💰"; el.classList.add('shop'); break;
                            case 'heal': icon = "❤️"; break;
                            case 'treasure': icon = "📦"; break;
                            case 'event': icon = "❔"; break;
                            case 'investigate': icon = "🔍"; break;
                            case 'city': icon = "🏢"; break;
                        }

                        const isCitySpot = this.isCity && cellData.citySpot;
                        let hasLabelContent = false;
                        if (isCitySpot) {
                            const label = cellData.citySpot.name || cellData.citySpot.id || "";
                            const shortLabel = (gridId === 'minimap-inline-grid') ? label.slice(0, 3) : label;
                            el.classList.add('city-cell');
                            el.title = label;
                            el.innerHTML = `<span class=\"map-cell-icon\">${icon}</span><span class=\"map-cell-label\">${shortLabel}</span>`;
                            hasLabelContent = true;
                        } else {
                            el.innerText = icon;
                        }

                        // 현재 위치 표시
                        if (isCurrent) {
                            el.classList.add('current');
                            if (!hasLabelContent) {
                                el.innerText = "";
                            }
                        }

                        // [4] 통로(Path) 연결 표시 (뚫린 길)
                        // CSS에서 border 색상을 다르게 하여 '문'처럼 보이게 함
                        if (cellData.exits.includes('n')) el.classList.add('path-n');
                        if (cellData.exits.includes('s')) el.classList.add('path-s');
                        if (cellData.exits.includes('e')) el.classList.add('path-e');
                        if (cellData.exits.includes('w')) el.classList.add('path-w');

                        if (this.isCity && cellData.citySpot) {
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
    teleport: function (x, y) {
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
let moveDirection = 0;
let pointerMoveActive = false;

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
    moveDirection = direction;
}

function stopMove() {
    if (moveInterval) clearInterval(moveInterval);
    moveInterval = null;
    moveDirection = 0;

    // 멈추면 걷기 애니메이션 제거
    const playerImg = document.getElementById('dungeon-player');
    if (playerImg) {
        playerImg.classList.remove('anim-walk');
    }
}
function toggleMinimap() {
    DungeonSystem.toggleMinimap();
}

function canDungeonMove() {
    if (typeof game === 'undefined') return false;
    if (game.state !== 'exploration') return false;
    if (game.inputLocked) return false;
    return true;
}

function isInputTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName ? target.tagName.toLowerCase() : "";
    return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function isBlockedMoveTarget(target) {
    if (!target) return false;
    return !!target.closest(
        '#dungeon-objects, .dungeon-door, .action-btn, .battle-ui, .exploration-ui, .utility-dock, #minimap-inline, #minimap-overlay, .inventory-overlay, .card, .shop-item, .hub-card, button'
    );
}

function handleMoveKeyDown(e) {
    if (!canDungeonMove()) return;
    if (isInputTarget(e.target)) return;

    let dir = 0;
    if (e.key === 'ArrowLeft') dir = -1;
    else if (e.key === 'ArrowRight') dir = 1;
    else return;

    e.preventDefault();
    if (moveDirection !== dir) startMove(dir);
}

function handleMoveKeyUp(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    stopMove();
}

function handleStagePointerDown(e) {
    if (!canDungeonMove()) return;
    if (isBlockedMoveTarget(e.target)) return;

    const stage = document.getElementById('dungeon-stage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    if (!Number.isFinite(x)) return;

    const playerEl = document.getElementById('dungeon-player');
    let playerCenterX = rect.left + rect.width / 2;
    if (playerEl) {
        const pRect = playerEl.getBoundingClientRect();
        playerCenterX = pRect.left + (pRect.width / 2);
    }

    const dir = (x < playerCenterX) ? -1 : 1;
    pointerMoveActive = true;
    startMove(dir);
}

function handleStagePointerUp() {
    if (!pointerMoveActive) return;
    pointerMoveActive = false;
    stopMove();
}

function initDungeonMovementInputs() {
    document.addEventListener('keydown', handleMoveKeyDown);
    document.addEventListener('keyup', handleMoveKeyUp);

    const stage = document.getElementById('dungeon-stage');
    if (!stage) return;
    stage.addEventListener('mousedown', handleStagePointerDown);
    stage.addEventListener('touchstart', handleStagePointerDown, { passive: true });
    document.addEventListener('mouseup', handleStagePointerUp);
    document.addEventListener('touchend', handleStagePointerUp);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDungeonMovementInputs);
} else {
    initDungeonMovementInputs();
}

