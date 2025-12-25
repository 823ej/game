

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
function isCardRewardableForPlayer(cardName) {
    const c = CARD_DATA[cardName];
    if (!c) return false;
    if (isPenaltyCard(cardName)) return false;
    if (c.noReward) return false;          // 장비 전용 카드 등 제외
    if (c.job === "enemy") return false;   // 적 전용
    if (c.job === "equipment") return false; // 장비 전용

    const job = player && player.job ? player.job : null;
    if (c.job && c.job !== "common" && job && c.job !== job) return false;
    // 직업 미선택 상태라면 공용 카드만
    if (!job && c.job && c.job !== "common") return false;
    return true;
}

function getRandomCardByRank(rank) {
    // 상점/보상 등 "플레이어 획득용" 풀 기준
    let pool = Object.keys(CARD_DATA).filter(k => {
        const c = CARD_DATA[k];
        if (!c) return false;
        if (c.rank !== rank) return false;
        if (c.type === "social") return false;
        return isCardRewardableForPlayer(k);
    });
    if (pool.length === 0) return "타격";
    return pool[Math.floor(Math.random() * pool.length)];
}


/* SCENARIOS 데이터에 구역 연결 (기존 데이터 유지하되 location은 동적으로 처리 가능) */
// (기존 SCENARIOS 데이터는 그대로 두셔도 됩니다)

const CITY_VIBE_META = {
    safe: { label: "거점", color: "#f1c40f" },
    busy: { label: "번화", color: "#1abc9c" },
    corporate: { label: "빌딩가", color: "#3498db" },
    dark: { label: "음지", color: "#c0392b" },
    calm: { label: "주거", color: "#95a5a6" },
    outskirts: { label: "외곽", color: "#e67e22" },
    water: { label: "해안", color: "#00b5d8" },
    neutral: { label: "기타", color: "#9b59b6" }
};

/* [수정] 도시 지도 렌더링 (전역 거점 배치 확인) */
function renderCityMap() {
    game.state = 'city';
    updateHomeUI();
    resetDungeonState();
    switchScene('city');
    game.inputLocked = false; 
    document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = false);

    const mapEl = document.getElementById('city-map');
    const legendEl = document.getElementById('city-legend');
    if (!mapEl) return;

    mapEl.innerHTML = `
        <svg class="city-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
        <div class="city-map-node-layer"></div>
    `;

    const lineLayer = mapEl.querySelector('.city-map-lines');
    const nodeLayer = mapEl.querySelector('.city-map-node-layer');
    const nodes = (CITY_MAP && Array.isArray(CITY_MAP.nodes)) ? CITY_MAP.nodes : [];
    const lookup = {};
    nodes.forEach(n => lookup[n.id] = n);

    const drawn = new Set();
    nodes.forEach(a => {
        (a.links || []).forEach(toId => {
            const b = lookup[toId];
            if (!b) return;
            const key = [a.id, b.id].sort().join("-");
            if (drawn.has(key)) return;
            drawn.add(key);
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", a.pos?.x ?? 0);
            line.setAttribute("y1", a.pos?.y ?? 0);
            line.setAttribute("x2", b.pos?.x ?? 0);
            line.setAttribute("y2", b.pos?.y ?? 0);
            lineLayer.appendChild(line);
        });
    });

    nodes.forEach(node => {
        const el = document.createElement('button');
        el.className = `city-node tone-${node.vibe || 'neutral'}`;
        el.dataset.id = node.id;
        el.style.left = `${node.pos?.x ?? 0}%`;
        el.style.top = `${node.pos?.y ?? 0}%`;
        el.innerHTML = `
            <span class="city-node-name">${node.name}</span>
            <span class="city-node-sub">${node.label || ""}</span>
        `;
        el.onclick = () => enterDistrict(node.id);
        nodeLayer.appendChild(el);
    });

    if (legendEl) {
        legendEl.innerHTML = Object.keys(CITY_VIBE_META).map(key => {
            const meta = CITY_VIBE_META[key];
            return `<span class="city-chip" style="border-color:${meta.color}; color:${meta.color}">${meta.label}</span>`;
        }).join("");
    }

    const defaultNode = nodes.find(n => n.id === "east_oldtown") || nodes[0];
    if (defaultNode) {
        enterDistrict(defaultNode.id, true);
    }
    autoSave();
}

/* [수정] 도시 거점 선택 (현재는 정보 패널만) */
function enterDistrict(key, silentAreaOpen) {
    const nodes = (CITY_MAP && Array.isArray(CITY_MAP.nodes)) ? CITY_MAP.nodes : [];
    const node = nodes.find(n => n.id === key);
    if (!node) return;

    game.selectedCityNode = key;

    document.querySelectorAll('.city-node').forEach(el => {
        el.classList.toggle('active', el.dataset.id === key);
    });

    const titleEl = document.getElementById('city-detail-title');
    const descEl = document.getElementById('city-detail-desc');
    const tagsEl = document.getElementById('city-detail-tags');
    const statusEl = document.getElementById('city-detail-status');
    const exploreBtn = document.getElementById('city-action-explore');
    const mapMode = document.getElementById('city-map-mode');
    const areaMode = document.getElementById('city-area-mode');

    if (titleEl) titleEl.textContent = node.name;
    if (descEl) descEl.textContent = node.desc;
    if (tagsEl) {
        const tags = (node.tags && node.tags.length > 0) ? node.tags : ["탐색 루트 배치 중"];
        tagsEl.innerHTML = "";
        const area = getCityArea(key);
        const visibleArea = getVisibleCityArea(key);
        const visibleSpots = (visibleArea && visibleArea.spots) ? visibleArea.spots : [];
        const allSpots = (area && area.spots) ? area.spots : [];
        tags.forEach(tag => {
            const chip = document.createElement('button');
            chip.type = "button";
            chip.className = 'city-chip city-chip-action';
            chip.textContent = tag;

            if (area) {
                const visibleSpot = findSpotByTag({ spots: visibleSpots }, tag);
                if (visibleSpot) {
                    chip.onclick = () => quickTravelCitySpot(key, visibleSpot.id);
                } else {
                    const hiddenSpot = findSpotByTag({ spots: allSpots }, tag);
                    if (hiddenSpot && hiddenSpot.requiresDiscovery) {
                        chip.disabled = true;
                        chip.title = "아직 발견되지 않은 장소입니다.";
                    }
                }
            }

            tagsEl.appendChild(chip);
        });
    }
    const hasArea = CITY_AREA_DATA && CITY_AREA_DATA[key];

    if (statusEl) {
        statusEl.textContent = hasArea
            ? "이 구역은 내부 탐색이 가능합니다. 아래 버튼으로 진입하세요."
            : "지금은 도시 지도만 확인할 수 있습니다. 추후 이 거점에서 탐색/던전 진입을 연결합니다.";
    }
    if (exploreBtn) {
        if (hasArea) {
            exploreBtn.textContent = "구역 진입";
            exploreBtn.disabled = false;
            exploreBtn.onclick = () => startCityExploration(key);
        } else {
            exploreBtn.textContent = "탐색 준비 중";
            exploreBtn.disabled = true;
            exploreBtn.onclick = null;
        }
    }

    if (mapMode && areaMode) {
        mapMode.classList.remove('hidden');
        areaMode.classList.add('hidden');
    }
}

function enterCityAreaMode(areaId) {
    const mapMode = document.getElementById('city-map-mode');
    const areaMode = document.getElementById('city-area-mode');
    if (mapMode) mapMode.classList.add('hidden');
    if (areaMode) areaMode.classList.remove('hidden');
    renderCityArea(areaId);
}

function exitCityAreaMode() {
    const mapMode = document.getElementById('city-map-mode');
    const areaMode = document.getElementById('city-area-mode');
    if (mapMode) mapMode.classList.remove('hidden');
    if (areaMode) areaMode.classList.add('hidden');
}

/* --- 시티 내부 지도 렌더링/이동 --- */
function getCityArea(areaId) {
    if (!CITY_AREA_DATA) return null;
    return CITY_AREA_DATA[areaId] || null;
}

function ensureCityDiscoveries() {
    if (!game.cityDiscoveries) game.cityDiscoveries = {};
    return game.cityDiscoveries;
}

function isCitySpotUnlocked(areaId, spot) {
    if (!spot || !spot.requiresDiscovery) return true;
    const discoveries = ensureCityDiscoveries();
    return !!(discoveries[areaId] && discoveries[areaId][spot.requiresDiscovery]);
}

function unlockCitySpot(areaId, discoveryKey) {
    if (!areaId || !discoveryKey) return;
    const discoveries = ensureCityDiscoveries();
    if (!discoveries[areaId]) discoveries[areaId] = {};
    if (!discoveries[areaId][discoveryKey]) {
        discoveries[areaId][discoveryKey] = true;
        autoSave();
    }
}

function getVisibleCityArea(areaId) {
    const area = getCityArea(areaId);
    if (!area) return null;
    if (area.randomNpcPool && area.npcSpotIds) {
        ensureCityAreaNpcAssignments(areaId, area);
    }
    const visibleSpots = (area.spots || []).filter(spot => isCitySpotUnlocked(areaId, spot));
    const npcAssignments = game.cityArea?.npcAssignments?.[areaId] || {};
    const enrichedSpots = visibleSpots.map(spot => {
        const nextSpot = { ...spot };
        if (areaId === "east_oldtown" && spot.id === "youngjin_office") {
            if (isDetectiveJob()) {
                nextSpot.objects = [
                    { id: "return_office", name: "사무소로 복귀", icon: "🏠", action: "return_hub" }
                ];
            } else {
                nextSpot.objects = [
                    { id: "enter_office", name: "탐정 사무소 내부", icon: "🕵️", action: "enter_city_area", areaId: "youngjin_office_interior" }
                ];
            }
        }

        if (spot.npcSlot) {
            const assigned = npcAssignments[spot.id];
            const npcList = Array.isArray(assigned) ? assigned : (assigned ? [assigned] : []);
            if (npcList.length > 0) {
                const primaryNpc = NPC_DATA[npcList[0]];
                if (primaryNpc && !spot.keepBaseName) {
                    nextSpot.name = primaryNpc.name || nextSpot.name;
                    nextSpot.desc = primaryNpc.desc || nextSpot.desc;
                    nextSpot.icon = primaryNpc.icon || nextSpot.icon;
                }
                const baseObjects = Array.isArray(spot.objects) ? [...spot.objects] : [];
                const npcObjects = npcList.map((npcKey, idx) => {
                    const npc = NPC_DATA[npcKey] || {};
                    return {
                        id: `talk_${spot.id}_${idx}`,
                        name: npc.name || "대화하기",
                        icon: npc.icon || "💬",
                        action: "npc_dialogue",
                        npcKey
                    };
                });
                nextSpot.objects = [...baseObjects, ...npcObjects];
            }
        }
        return nextSpot;
    });
    return { ...area, spots: enrichedSpots };
}

function ensureCityAreaNpcAssignments(areaId, area) {
    if (!game.cityArea) game.cityArea = {};
    if (!game.cityArea.npcAssignments) game.cityArea.npcAssignments = {};
    if (game.cityArea.npcAssignments[areaId]) return;

    const pool = Array.isArray(area.randomNpcPool) ? [...area.randomNpcPool] : [];
    const targets = Array.isArray(area.npcSpotIds) ? [...area.npcSpotIds] : [];
    const assignments = {};
    targets.forEach(id => {
        let count = 1;
        if (area.npcSpotCounts && area.npcSpotCounts[id]) {
            const rule = area.npcSpotCounts[id];
            if (typeof rule === "number") {
                count = rule;
            } else if (rule && typeof rule === "object") {
                const min = Number.isInteger(rule.min) ? rule.min : 1;
                const max = Number.isInteger(rule.max) ? rule.max : min;
                count = Math.max(min, Math.floor(Math.random() * (max - min + 1)) + min);
            }
        }
        assignments[id] = [];
        for (let i = 0; i < count; i++) {
            if (pool.length === 0) break;
            const pickIndex = Math.floor(Math.random() * pool.length);
            const picked = pool.splice(pickIndex, 1)[0];
            assignments[id].push(picked);
        }
        if (assignments[id].length === 1) {
            assignments[id] = assignments[id][0];
        } else if (assignments[id].length === 0) {
            delete assignments[id];
        }
    });
    game.cityArea.npcAssignments[areaId] = assignments;
}

function findSpotByTag(area, tag) {
    if (!area || !Array.isArray(area.spots)) return null;
    return area.spots.find(spot => spot.name === tag || (spot.tags || []).includes(tag)) || null;
}

function syncCityDungeonPosition(spotId) {
    if (!DungeonSystem || !Array.isArray(DungeonSystem.map)) return;
    for (let y = 0; y < DungeonSystem.map.length; y++) {
        for (let x = 0; x < DungeonSystem.map[y].length; x++) {
            const cell = DungeonSystem.map[y][x];
            if (cell && cell.citySpot && cell.citySpot.id === spotId) {
                DungeonSystem.currentPos = { x, y };
                DungeonSystem.progress = 0;
                if (typeof DungeonSystem.renderView === 'function') {
                    DungeonSystem.renderView();
                }
                return;
            }
        }
    }
}

function quickTravelCitySpot(areaId, spotId) {
    const area = getVisibleCityArea(areaId);
    if (!area) return;
    const spot = getAreaSpot(area, spotId);
    if (!spot) return;
    startCityExploration(areaId, spotId);
}

function getAreaSpot(area, spotId) {
    if (!area || !Array.isArray(area.spots)) return null;
    return area.spots.find(s => s.id === spotId) || null;
}

function findCityAreaPath(area, startId, targetId) {
    if (!area || !Array.isArray(area.spots)) return [];
    if (startId === targetId) return [startId];
    const queue = [[startId]];
    const visited = new Set([startId]);
    const linkMap = {};
    area.spots.forEach(s => linkMap[s.id] = s.links || []);
    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        for (let next of (linkMap[current] || [])) {
            if (visited.has(next)) continue;
            const nextPath = [...path, next];
            if (next === targetId) return nextPath;
            visited.add(next);
            queue.push(nextPath);
        }
    }
    return [];
}

function renderCityArea(areaId) {
    const area = getVisibleCityArea(areaId);
    if (!area) return;
    if (!game.cityArea) game.cityArea = {};
    game.cityArea.areaId = areaId;
    const validIds = (area.spots || []).map(s => s.id);
    if (!validIds.includes(game.cityArea.currentSpot)) {
        game.cityArea.currentSpot = area.start || validIds[0];
    }
    if (!validIds.includes(game.cityArea.selectedSpot)) {
        game.cityArea.selectedSpot = game.cityArea.currentSpot;
    }
    if (game.cityArea.sideIndex === undefined) {
        game.cityArea.sideIndex = Math.max(0, validIds.indexOf(game.cityArea.currentSpot));
    }

    const nameEl = document.getElementById('city-area-name');
    const descEl = document.getElementById('city-area-desc');
    if (nameEl) nameEl.textContent = area.name || "내부 지도";
    if (descEl) descEl.textContent = area.desc || "구역 내부 주요 지점을 걷거나 퀵 이동할 수 있습니다.";

    const mapEl = document.getElementById('city-area-map');
    if (!mapEl) return;
    mapEl.innerHTML = `
        <svg class="city-area-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
        <div class="city-area-node-layer"></div>
    `;
    const lineLayer = mapEl.querySelector('.city-area-lines');
    const nodeLayer = mapEl.querySelector('.city-area-node-layer');

    const lookup = {};
    (area.spots || []).forEach(s => lookup[s.id] = s);
    const drawn = new Set();
    (area.spots || []).forEach(a => {
        (a.links || []).forEach(toId => {
            const b = lookup[toId];
            if (!b) return;
            const key = [a.id, b.id].sort().join("-");
            if (drawn.has(key)) return;
            drawn.add(key);
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", a.pos?.x ?? 0);
            line.setAttribute("y1", a.pos?.y ?? 0);
            line.setAttribute("x2", b.pos?.x ?? 0);
            line.setAttribute("y2", b.pos?.y ?? 0);
            lineLayer.appendChild(line);
        });
    });

    (area.spots || []).forEach(spot => {
        const el = document.createElement('button');
        el.className = 'city-area-node';
        el.dataset.id = spot.id;
        el.style.left = `${spot.pos?.x ?? 0}%`;
        el.style.top = `${spot.pos?.y ?? 0}%`;
        el.style.setProperty('--accent', '#f1c40f');
        if (spot.id === game.cityArea.currentSpot) {
            el.classList.add('active');
        }
        el.innerHTML = `
            <span class="city-node-name">${spot.name}</span>
        `;
        el.onclick = () => selectCityAreaSpot(spot.id);
        nodeLayer.appendChild(el);
    });

    renderCitySideView(area);
    updateCityAreaDetail();
}

function selectCityAreaSpot(spotId) {
    if (!game.cityArea) game.cityArea = {};
    game.cityArea.selectedSpot = spotId;
    updateCityAreaDetail();
    renderCityArea(game.cityArea.areaId);
}

function moveCityArea(mode) {
    if (!game.cityArea) return;
    const area = getVisibleCityArea(game.cityArea.areaId);
    if (!area) return;
    const currentId = game.cityArea.currentSpot;
    const targetId = game.cityArea.selectedSpot || currentId;
    const validIds = (area.spots || []).map(s => s.id);
    if (!validIds.includes(targetId)) {
        setCitySpotStatus("아직 알려지지 않은 위치입니다.");
        return;
    }
    if (currentId === targetId) {
        setCitySpotStatus("이미 해당 위치에 있습니다.");
        return;
    }

    if (mode === 'walk') {
        const path = findCityAreaPath(area, currentId, targetId);
        if (!path || path.length === 0) {
            setCitySpotStatus("이동 경로를 찾을 수 없습니다.");
            return;
        }
        game.cityArea.currentSpot = targetId;
        game.cityArea.lastPath = path;
        setCitySpotStatus(`걷기: ${path.map(id => getAreaSpot(area, id)?.name || id).join(" → ")}`);
    } else {
        game.cityArea.currentSpot = targetId;
        game.cityArea.lastPath = null;
        setCitySpotStatus("퀵 이동 완료.");
    }
    renderCityArea(area.id);
}

function setCitySpotStatus(text) {
    const statusEl = document.getElementById('city-spot-status');
    if (statusEl) statusEl.textContent = text;
}

function updateCityAreaDetail() {
    const area = getVisibleCityArea(game.cityArea?.areaId);
    if (!area) return;
    const currentId = game.cityArea.currentSpot;
    const targetId = game.cityArea.selectedSpot || currentId;
    const spot = getAreaSpot(area, targetId) || getAreaSpot(area, currentId);

    const titleEl = document.getElementById('city-spot-title');
    const descEl = document.getElementById('city-spot-desc');
    const tagsEl = document.getElementById('city-spot-tags');
    if (titleEl) titleEl.textContent = spot?.name || "지점을 선택하세요";
    if (descEl) descEl.textContent = spot?.desc || "지도를 눌러 이동할 지점을 선택하세요.";
    if (tagsEl) {
        const tags = (spot && spot.tags && spot.tags.length > 0) ? spot.tags : [];
        tagsEl.innerHTML = tags.map(t => `<span class="city-chip">${t}</span>`).join("");
    }

    const walkBtn = document.getElementById('btn-area-walk');
    const warpBtn = document.getElementById('btn-area-warp');
    const disabled = !spot;
    [walkBtn, warpBtn].forEach(btn => {
        if (btn) btn.disabled = disabled;
    });

    if (spot) {
        if (spot.id === currentId) {
            setCitySpotStatus("현재 위치입니다.");
        } else {
            setCitySpotStatus("이동할 지점을 선택했습니다.");
        }
    }
}

/* --- 도시 구역을 던전 모듈로 탐사 --- */
function startCityExploration(areaId, targetSpotId) {
    const area = getVisibleCityArea(areaId);
    if (!area) return;
    storeActiveScenarioState();

    // 시나리오/상태 설정 (도시 탐사용)
    game.state = 'exploration';
    switchScene('exploration');
    game.inputLocked = false;
    document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = false);

    // 저장용 플래그
    game.cityArea = game.cityArea || {};
    game.cityArea.areaId = areaId;
    const validIds = (area.spots || []).map(s => s.id);
    const initialSpot = (targetSpotId && validIds.includes(targetSpotId))
        ? targetSpotId
        : (area.start || (area.spots && area.spots[0] && area.spots[0].id));
    game.cityArea.currentSpot = initialSpot;
    game.cityArea.selectedSpot = initialSpot;
    game.cityArea.sideIndex = Math.max(0, validIds.indexOf(initialSpot));
    game.cityArea.returnToAreaId = areaId; // 던전 탈출 시 돌아올 도시 구역

    // 던전 모듈을 도시 모드로 로드
    if (DungeonSystem && typeof DungeonSystem.loadCityArea === 'function') {
        if (area.randomNpcPool && area.npcSpotIds) {
            ensureCityAreaNpcAssignments(areaId, area);
        }
        DungeonSystem.loadCityArea(area);
        game.dungeonMap = true;
    game.scenario = {
        id: `city:${areaId}`,
        title: area.name || "도시 탐사",
        isCity: true,
            canRetreat: true
        };
        syncCityDungeonPosition(initialSpot);
    }

    // 플레이어 이미지 연결
    const playerEl = document.getElementById('dungeon-player');
    if (playerEl) {
        playerEl.src = player.img || "https://placehold.co/150x150/3498db/ffffff?text=Hero";
    }

    showExplorationView();
    updateUI();
    autoSave();
}

/* 도시 특수 던전 진입 (화이트 큐브 등) */
function startCityDungeon(dungeonId) {
    const config = (typeof CITY_DUNGEON_CONFIGS !== 'undefined' && CITY_DUNGEON_CONFIGS[dungeonId]) ? CITY_DUNGEON_CONFIGS[dungeonId] : null;
    const title = (config && config.title) ? config.title : "도시 던전";

    game.state = 'exploration';
    switchScene('exploration');
    game.inputLocked = false;
    document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = false);
    advanceTimeSlot("city_dungeon");

    storeActiveScenarioState();
    game.dungeonMap = false; // 새 던전 강제 생성
    const activeId = game.activeScenarioId;
    const storedScenario = (activeId && game.activeScenarioState && game.activeScenarioState[activeId])
        ? game.activeScenarioState[activeId]
        : null;
    const missionScenario = (activeId && SCENARIOS[activeId]) ? (storedScenario || null) : null;
    const fallbackDungeon = config || {
        width: 5, height: 5, roomCount: 10,
        data: { battle: 5, event: 2, treasure: 1 }
    };

    if (missionScenario) {
        game.scenario = {
            ...missionScenario,
            isActive: true,
            canRetreat: true,
            customDungeon: fallbackDungeon,
            enemyPool: missionScenario.enemyPool || ((config && Array.isArray(config.enemyPool)) ? config.enemyPool : null)
        };
    } else {
        game.activeScenarioId = null;
        game.scenario = {
            id: `city_dungeon:${dungeonId}`,
            title: title,
            isActive: false,
            canRetreat: true,
            customDungeon: fallbackDungeon,
            enemyPool: (config && Array.isArray(config.enemyPool)) ? config.enemyPool : null
        };
    }

    // 던전 탈출 시 복귀할 도시 구역/스팟 기억
    if (game.cityArea && game.cityArea.areaId) {
        game.scenario.returnToCity = { areaId: game.cityArea.areaId, spotId: game.cityArea.currentSpot };
    }

    renderExploration(true);
}

/* --- 시티 내부 사이드뷰 이동 --- */
function renderCitySideView(area) {
    const lane = document.getElementById('city-side-lane');
    const bWrap = document.getElementById('city-side-buildings');
    const playerEl = document.getElementById('city-side-player');
    if (!lane || !bWrap || !playerEl) return;

    bWrap.innerHTML = "";
    const spots = area.spots || [];
    const count = Math.max(1, spots.length);
    spots.forEach((spot, idx) => {
        const left = count === 1 ? 50 : (idx / (count - 1)) * 90 + 5;
        const el = document.createElement('div');
        el.className = 'city-side-building';
        el.dataset.id = spot.id;
        el.style.left = `${left}%`;
        const icon = "🏢";
        el.innerHTML = `<span class="icon">${icon}</span><span>${spot.name}</span>`;
        if (spot.id === game.cityArea.currentSpot) el.classList.add('active');
        el.onclick = () => {
            game.cityArea.selectedSpot = spot.id;
            game.cityArea.sideIndex = idx;
            updateCityAreaDetail();
            renderCitySideView(area);
        };
        bWrap.appendChild(el);
    });

    const idx = spots.findIndex(s => s.id === game.cityArea.currentSpot);
    const left = spots.length <= 1 ? 50 : (Math.max(0, idx) / (spots.length - 1)) * 90 + 5;
    playerEl.style.left = `${left}%`;
}

function moveCitySide(dir) {
    const area = getVisibleCityArea(game.cityArea?.areaId);
    if (!area || !area.spots) return;
    let idx = area.spots.findIndex(s => s.id === game.cityArea.currentSpot);
    if (idx < 0) idx = 0;
    if (dir === 'left') idx = Math.max(0, idx - 1);
    else idx = Math.min(area.spots.length - 1, idx + 1);
    const target = area.spots[idx];
    if (!target) return;
    game.cityArea.currentSpot = target.id;
    game.cityArea.selectedSpot = target.id;
    game.cityArea.sideIndex = idx;
    setCitySpotStatus(`${target.name} 앞에 섰습니다.`);
    renderCityArea(area.id);
}

function interactCitySpot() {
    const area = getVisibleCityArea(game.cityArea?.areaId);
    const currentId = game.cityArea?.currentSpot;
    if (!area || !currentId) return;
    const spot = getAreaSpot(area, currentId);
    if (!spot) return;
    setCitySpotStatus(`(${spot.name}) 내부 진입/상호작용은 추후 구현 예정`);
}
/* [game.js] 상점 나가기 핸들러 (상황별 복귀) */
function exitShop(shopType) {
    // 인터넷 쇼핑이면 무조건 허브로
    if (shopType === 'shop_internet') {
        renderHub();
        return;
    }

    // [핵심] 현재 게임 상태가 '탐사(exploration)' 중이었다면 던전으로 복귀
    // (상점 진입 시 switchScene('event')를 했지만 game.state는 유지했거나, 여기서 확인 가능)
    // 보통 던전에서 상점을 열면 game.state가 'exploration'인 상태에서 화면만 바뀝니다.
    // 하지만 안전하게 '던전 맵이 생성되어 있는지'로 판단합니다.
    if (game.dungeonMap) {
        closePopup();
        game.state = 'exploration';
        
        // 탐사 화면 UI 복구
        switchScene('exploration');
        toggleBattleUI(false);
        showExplorationView();
        
        // 던전 뷰 갱신 (오브젝트 위치 등)
        if (DungeonSystem && DungeonSystem.updateParallax) {
            DungeonSystem.updateParallax();
        }
        updateUI();
    } else {
        // 그 외에는 도시 지도로
        renderCityMap();
    }
}
/* [필수] 미션 시작 함수 */
function beginMission() {
    closePopup();
    
    if (!game.activeScenarioId || !SCENARIOS[game.activeScenarioId]) {
        showPopup("진행 중인 의뢰 정보를 찾을 수 없습니다.");
        return;
    }
    advanceTimeSlot("mission");

    // 탐사 화면 진입 데이터 설정
    let scData = SCENARIOS[game.activeScenarioId];
    const prevScenario = (game.scenario && game.scenario.id === game.activeScenarioId) ? game.scenario : null;
    game.scenario = {
        id: game.activeScenarioId,
        title: scData.title,
        clues: prevScenario ? (prevScenario.clues || 0) : 0,
        location: (prevScenario && prevScenario.location) ? prevScenario.location : scData.locations[0], 
        bossReady: prevScenario ? !!prevScenario.bossReady : false,
        isActive: true,
        enemyPool: prevScenario?.enemyPool || getEnemyPoolFromScenario(scData),
        returnToCity: prevScenario?.returnToCity
    };
    
    renderExploration(true);
}

/* [수정] 순찰 시작 (복귀 가능 설정) */
function startPatrol(districtKey) {
    closePopup();
    advanceTimeSlot("patrol");
    
    // 1. 활성 시나리오 ID 제거 (순찰이므로)
    game.activeScenarioId = null;
    
    // 2. 새로운 맵 생성을 위해 플래그 초기화 ★중요★
    game.dungeonMap = false; 

    // 3. 순찰용 가짜 시나리오 데이터 생성
    // (districtKey를 저장해두어야 나중에 던전 설정을 불러옵니다)
    const dist = DISTRICTS[districtKey];
    game.scenario = {
        id: "patrol",
        title: `${DISTRICTS[districtKey].name} 순찰`,
        districtKey: districtKey, // ★ 구역 키 저장
        clues: 0,
        isPatrol: true,
        isActive: false,
        canRetreat: true,
        enemyPool: dist ? (dist.enemyPool || (dist.dungeon && dist.dungeon.enemyPool) || null) : null
    };
    
    // 바로 전투를 붙이지 않고 탐사 화면을 먼저 보여준다
    renderExploration(true);
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
    mental: 100, maxMental: 100, // 의지 (소셜용)
    
    // [NEW] 6대 스탯 도입
    // 근력(Str): 물리 공격력
    // 건강(Con): 물리 방어력 & 최대 HP
    // 민첩(Dex): 속도 (행동 순서)
    // 지능(Int): 논리 방어 (소셜 방어)
    // 정신(Wil): 최대 SP & 의지 크기
    // 매력(Cha): 소셜 공격력 (설득/기만)
    stats: {
        str: 1, // 근력
        con: 1, // 건강
        dex: 3, // 민첩 (기본 속도 유지)
        int: 1, // 지능
        wil: 1, // 정신
        cha: 1  // 매력
    },
    gold: 0, ap: 3, maxAp: 3, xp: 0, maxXp: 100,
    // [NEW] 발견한 약점 도감 { "불량배": "strike", ... }
    discoveredWeaknesses: {},
    
    // 덱 관련
    deck: [],       // 전투 덱 (Active)
    socialDeck: [], // 소셜 덱 (Active)
    storage: [],    // 보관함 (Inactive - 모든 타입 섞여 있음)
    
    // 인벤토리 관련
   inventory: [],      // 소모품
    relics: [],         // 유물 (활성화됨)
    equipmentBag: [],   // 장비 (미장착 보관)
    equipment: {        // 장착 슬롯
        head: null,
        body: null,
        legs: null,
        leftHand: null,
        rightHand: null,
        accessory1: null,
        accessory2: null
    },
    equipmentCardGrants: {}, // { [itemName]: [cardName, ...] } 장비로 인해 덱에 추가된 카드 추적
    warehouse: [],      // [NEW] 창고 (비활성화됨)
    maxInventory: 6,
    combatTempCards: [], // 전투 중에만 추가되는 카드(상태이상 등)
    // 상태
    jumadeung: false, lucky: false,
    drawPile: [], discardPile: [], exhaustPile: [], buffs: {},
    thorns: 0,                      // [NEW] 가시: 전투 종료까지 지속되는 고정 반격 피해량 (buffs와 분리)
    currentAttrs: [],                 // 현재 플레이어의 공격 속성 목록 (배열)
    attrBuff: { types: [], turns: 0 },
    handCostOverride: [],             // 이번 전투/턴 임시 코스트 오버라이드 (손패 인덱스 기준)
    permanentCardGrowth: {},          // { [cardName]: { dmg?: number, block?: number } } 영구 누적
    powers: {},                       // { [powerId]: any } 전투 중 지속 효과
    // [NEW] 플레이어도 약점과 상태이상을 가짐
    // 기본 약점은 'none'이지만, 특정 갑옷을 입거나 저주에 걸리면 바뀔 수 있음
    weakness: "none", 
    isBroken: false, 
    isStunned: false
     // 일시적 속성 버프 상태
    
};

const EQUIP_SLOT_META = {
    head: { label: "머리", icon: "🪖" },
    body: { label: "상체", icon: "🧥" },
    legs: { label: "하체", icon: "👖" },
    leftHand: { label: "왼손", icon: "✋" },
    rightHand: { label: "오른손", icon: "🤚" },
    accessory1: { label: "장신구1", icon: "💍" },
    accessory2: { label: "장신구2", icon: "💍" }
};

function ensureEquipmentFields(p) {
    if (!p.equipmentBag) p.equipmentBag = [];
    if (!p.equipment) {
        p.equipment = {
            head: null,
            body: null,
            legs: null,
            leftHand: null,
            rightHand: null,
            accessory1: null,
            accessory2: null
        };
    }
    for (let k in EQUIP_SLOT_META) {
        if (!(k in p.equipment)) p.equipment[k] = null;
    }
    if (!p.equipmentCardGrants) p.equipmentCardGrants = {};
}

function getEquippedItemNames(p) {
    ensureEquipmentFields(p);
    return Object.values(p.equipment).filter(Boolean);
}

function getActivePassiveItemNames() {
    ensureEquipmentFields(player);
    return [
        ...(player.relics || []),
        ...getEquippedItemNames(player)
    ].filter(Boolean);
}

function getEquipmentGrantCards(itemName) {
    const data = ITEM_DATA[itemName];
    if (!data || data.usage !== 'equip') return [];
    if (!Array.isArray(data.grantCards)) return [];
    return data.grantCards.filter(Boolean);
}

function applyEquipCardGrants(itemName) {
    ensureEquipmentFields(player);
    if (!player.deck) player.deck = [];

    const cards = getEquipmentGrantCards(itemName);
    if (cards.length === 0) return;

    if (!player.equipmentCardGrants[itemName]) {
        player.equipmentCardGrants[itemName] = [];
    }

    // 이미 부여된 적이 있으면 중복 부여 방지 (아이템은 중복 소지 불가 정책)
    if (player.equipmentCardGrants[itemName].length > 0) return;

    cards.forEach(cName => {
        if (!CARD_DATA[cName]) return;
        player.deck.push(cName);
        player.equipmentCardGrants[itemName].push(cName);
    });
}

function removeEquipCardGrants(itemName) {
    ensureEquipmentFields(player);
    if (!player.deck) player.deck = [];

    const granted = player.equipmentCardGrants[itemName];
    if (!Array.isArray(granted) || granted.length === 0) return;

    granted.forEach(cName => {
        const idx = player.deck.indexOf(cName);
        if (idx >= 0) player.deck.splice(idx, 1);
    });

    delete player.equipmentCardGrants[itemName];
}

function resyncEquipCardGrantsFromEquipped() {
    ensureEquipmentFields(player);
    if (!player.deck) player.deck = [];

    // 기존 추적분 제거 후 재부여 (중복/누락 방지)
    const old = Object.keys(player.equipmentCardGrants || {});
    old.forEach(itemName => removeEquipCardGrants(itemName));

    getEquippedItemNames(player).forEach(itemName => applyEquipCardGrants(itemName));
}

function getItemAttrList(itemData) {
    if (!itemData) return [];
    const res = [];
    if (itemData.attr) res.push(itemData.attr);
    if (Array.isArray(itemData.attrs)) res.push(...itemData.attrs);
    return res;
}

function getAttackAttrs(entity) {
    if (!entity) return [];
    if (Array.isArray(entity.attackAttrs)) return entity.attackAttrs;
    if (Array.isArray(entity.currentAttrs)) return entity.currentAttrs;
    return [];
}

function getDefenseAttrs(entity) {
    if (!entity) return [];
    if (Array.isArray(entity.defenseAttrs)) return entity.defenseAttrs;
    return [];
}

function isResistTriggered(attackAttrs, target) {
    if (!Array.isArray(attackAttrs) || attackAttrs.length === 0) return false;
    const defAttrs = getDefenseAttrs(target);
    if (!Array.isArray(defAttrs) || defAttrs.length === 0) return false;
    return attackAttrs.some(a => defAttrs.includes(a));
}

function getTotalBonusStats(itemNames) {
    const total = { str: 0, con: 0, dex: 0, int: 0, wil: 0, cha: 0 };
    (itemNames || []).forEach(name => {
        const data = ITEM_DATA[name];
        if (!data || !data.bonusStats) return;
        for (let k in data.bonusStats) {
            if (k in total) total[k] += (data.bonusStats[k] || 0);
        }
    });
    return total;
}

function getTotalBonusDerived(itemNames) {
    const total = { hp: 0, sp: 0, mental: 0 };
    (itemNames || []).forEach(name => {
        const data = ITEM_DATA[name];
        if (!data) return;
        if (data.bonusHp) total.hp += data.bonusHp;
        if (data.bonusSp) total.sp += data.bonusSp;
        if (data.bonusMental) total.mental += data.bonusMental;
    });
    return total;
}

function hasItemAnywhere(name) {
    ensureEquipmentFields(player);
    if (player.inventory && player.inventory.includes(name)) return true;
    if (player.relics && player.relics.includes(name)) return true;
    if (player.warehouse && player.warehouse.includes(name)) return true;
    if (player.equipmentBag && player.equipmentBag.includes(name)) return true;
    return getEquippedItemNames(player).includes(name);
}

function consumeReviveItem() {
    ensureEquipmentFields(player);
    const isReviveItem = (name) => {
        const data = ITEM_DATA[name];
        return data && (data.effect === "revive" || name === "황금 대타");
    };

    const pools = [
        player.relics,
        player.inventory,
        player.equipmentBag
    ];

    for (const list of pools) {
        if (!Array.isArray(list)) continue;
        const idx = list.findIndex(isReviveItem);
        if (idx >= 0) {
            return list.splice(idx, 1)[0];
        }
    }

    return null;
}

function getDuplicateItemCompensation(itemName) {
    const data = ITEM_DATA[itemName];
    if (!data) return 0;
    const base = Number.isFinite(data.price) ? data.price : 0;
    const fallback = (Number.isFinite(data.rank) ? data.rank : 1) * 1000;
    return Math.max(200, Math.floor(Math.max(base, fallback) * 0.5));
}

function isPenaltyCard(cardName, group = null) {
    const data = CARD_DATA[cardName];
    if (!data) return false;
    if (!data.group) return false;
    if (!group) return (data.group === 'status' || data.group === 'curse');
    return data.group === group;
}

function getCardGroupLabel(cardData) {
    if (!cardData || !cardData.group) return "";
    if (cardData.group === 'status') return "상태이상";
    if (cardData.group === 'curse') return "저주";
    return cardData.group;
}

function getCardTypeLabel(cardData) {
    if (!cardData || !cardData.type) return "";
    if (cardData.type === "attack" || (typeof cardData.type === "string" && cardData.type.includes("attack"))) return "공격";
    if (cardData.type === "skill") return "스킬";
    if (cardData.type === "power") return "파워";
    if (cardData.type === "social") {
        const st = cardData.subtype || "";
        if (st === "attack") return "공격";
        if (st === "power") return "파워";
        // defend/skill/magic/trick 등은 소셜 내에서 스킬 취급
        return "스킬";
    }
    return cardData.type;
}

function ensureCardSystems(p) {
    if (!p.handCostOverride) p.handCostOverride = [];
    if (!p.permanentCardGrowth) p.permanentCardGrowth = {};
    if (!p.powers) p.powers = {};
    if (!p.socialPowers) p.socialPowers = {};
}

function ensureThornsField(entity) {
    if (!entity) return;
    if (typeof entity.thorns !== 'number') entity.thorns = 0;
    if (!entity.buffs) entity.buffs = {};
}

function migrateThornsFromBuff(entity) {
    if (!entity || !entity.buffs) return;
    if (entity.buffs["가시"] !== undefined) {
        const val = Math.max(0, Number(entity.buffs["가시"] || 0));
        ensureThornsField(entity);
        entity.thorns = Math.max(entity.thorns, val);
        delete entity.buffs["가시"];
    }
}

function getHandCardCost(handIdx, cardName = null) {
    ensureCardSystems(player);
    const name = cardName ?? player.hand?.[handIdx];
    if (!name) return 999;
    const data = getEffectiveCardData(name) || CARD_DATA[name];
    if (!data) return 999;

    const override = (player.handCostOverride && player.handCostOverride[handIdx] !== undefined)
        ? player.handCostOverride[handIdx]
        : null;

    if (override !== null && override !== undefined) return override;
    return data.cost ?? 0;
}

function applyPowerCard(user, cardName, data) {
    if (user !== player) return false;
    if (!data || data.type !== "power" || !data.power) return false;
    ensureCardSystems(player);

    const id = data.powerId || cardName;
    if (!player.powers[id]) player.powers[id] = {};

    for (let k in data.power) {
        const v = Number(data.power[k] || 0);
        if (!Number.isFinite(v) || v === 0) continue;
        player.powers[id][k] = Number(player.powers[id][k] || 0) + v;
    }

    log(`✨ 파워 획득: [${cardName}]`);
    return true;
}

function applySocialPowerCard(user, cardName, data) {
    if (user !== player) return false;
    if (!data || data.type !== "social" || data.subtype !== "power" || !data.power) return false;
    ensureCardSystems(player);

    const id = data.powerId || cardName;
    if (!player.socialPowers[id]) player.socialPowers[id] = {};

    for (let k in data.power) {
        const v = Number(data.power[k] || 0);
        if (!Number.isFinite(v) || v === 0) continue;
        player.socialPowers[id][k] = Number(player.socialPowers[id][k] || 0) + v;
    }

    log(`✨ 소셜 파워 획득: [${cardName}]`);
    return true;
}

function getTotalPowerValue(key) {
    ensureCardSystems(player);
    let sum = 0;
    const p = player.powers || {};
    for (let id in p) sum += Number(p[id]?.[key] || 0);
    return sum;
}

function getTotalSocialPowerValue(key) {
    ensureCardSystems(player);
    let sum = 0;
    const p = player.socialPowers || {};
    for (let id in p) sum += Number(p[id]?.[key] || 0);
    return sum;
}

function triggerTurnStartPowers() {
    if (game.state !== 'battle') return;
    ensureCardSystems(player);

    const apBonus = getTotalPowerValue('apBonus');
    if (apBonus > 0) {
        player.ap += apBonus;
        log(`✨ 파워 효과: AP +${apBonus}`);
    }
}

function triggerAfterDrawPowers() {
    if (game.state !== 'battle') return;
    ensureCardSystems(player);

    const freeCount = getTotalPowerValue('freeCostEachTurn');
    if (freeCount > 0) {
        for (let i = 0; i < freeCount; i++) setRandomHandCardCostToZeroOnce();
    }
}

function triggerSocialTurnStartPowers() {
    if (game.state !== 'social') return;
    ensureCardSystems(player);

    const apBonus = getTotalSocialPowerValue('apBonus');
    if (apBonus > 0) {
        player.ap += apBonus;
        log(`✨ 소셜 파워 효과: AP +${apBonus}`);
    }
}

function triggerSocialAfterDrawPowers() {
    if (game.state !== 'social') return;
    ensureCardSystems(player);

    const freeCount = getTotalSocialPowerValue('freeCostEachTurn');
    if (freeCount > 0) {
        for (let i = 0; i < freeCount; i++) setRandomHandCardCostToZeroOnce();
    }
}

function getEffectiveCardData(cardName) {
    const base = CARD_DATA[cardName];
    if (!base) return null;

    ensureCardSystems(player);

    const data = { ...base };

    // 영구 성장
    const perm = player.permanentCardGrowth[cardName];
    if (perm) {
        if (typeof perm.dmg === 'number') data.dmg = (data.dmg || 0) + perm.dmg;
        if (typeof perm.block === 'number') data.block = (data.block || 0) + perm.block;
    }

    // 전투 중 성장 (game.combatCardGrowth)
    if (game && game.combatCardGrowth && game.combatCardGrowth[cardName]) {
        const temp = game.combatCardGrowth[cardName];
        if (temp) {
            if (typeof temp.dmg === 'number') data.dmg = (data.dmg || 0) + temp.dmg;
            if (typeof temp.block === 'number') data.block = (data.block || 0) + temp.block;
        }
    }

    return data;
}

function setRandomHandCardCostToZeroOnce() {
    ensureCardSystems(player);
    if (!player.hand || player.hand.length === 0) return false;

    // 이미 0인 카드, 사용 불가 카드 제외
    const candidates = [];
    for (let i = 0; i < player.hand.length; i++) {
        const name = player.hand[i];
        const data = CARD_DATA[name];
        if (!data || data.unplayable) continue;
        const curCost = (player.handCostOverride[i] !== undefined && player.handCostOverride[i] !== null)
            ? player.handCostOverride[i]
            : data.cost;
        if (curCost <= 0) continue;
        candidates.push(i);
    }
    if (candidates.length === 0) return false;

    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    player.handCostOverride[idx] = 0;
    log(`✨ 파워 효과: 손패 [${player.hand[idx]}] 비용이 0이 됩니다.`);
    renderHand();
    return true;
}
function addStatusCardToCombat(cardName, count = 1, destination = 'discard') {
    if (game.state !== 'battle') return false;
    if (!CARD_DATA[cardName] || !isPenaltyCard(cardName, 'status')) return false;
    if (!player.combatTempCards) player.combatTempCards = [];

    for (let i = 0; i < count; i++) {
        if (destination === 'draw') player.drawPile.push(cardName);
        else if (destination === 'hand') player.hand.push(cardName);
        else player.discardPile.push(cardName);
        player.combatTempCards.push(cardName);
    }

    if (count > 0) {
        log(`🩸 [${cardName}] (${count})가 덱에 섞였습니다!`);
    }
    updateUI();
    if (destination === 'hand') renderHand();
    return true;
}

// 적 덱에 상태이상 카드를 섞어 넣기 (플레이어 전용 효과)
function addStatusCardToEnemyDeck(enemy, cardName, count = 1) {
    if (game.state !== 'battle') return false;
    if (!enemy || enemy === player) return false;
    if (!CARD_DATA[cardName] || !isPenaltyCard(cardName)) return false;
    if (!Array.isArray(enemy.deck)) enemy.deck = [];

    const num = Math.max(1, Number(count || 1));
    for (let i = 0; i < num; i++) {
        enemy.deck.push(cardName);
    }
    log(`🩸 ${enemy.name} 덱에 [${cardName}] ${num}장 섞였습니다!`);
    return true;
}

const CURSE_TRAIT_MAP = {
    "저주: 불운": "curse_unlucky",
    "저주: 족쇄": "curse_shackles"
};

function getCurseTraitKey(cardName) {
    return CURSE_TRAIT_MAP[cardName] || null;
}

function getCurseCardByTrait(traitKey) {
    const entries = Object.entries(CURSE_TRAIT_MAP);
    for (let [card, key] of entries) {
        if (key === traitKey) return card;
    }
    return null;
}

function removeCardEverywhere(cardName) {
    const removeFromArray = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return;
        const filtered = arr.filter(name => name !== cardName);
        arr.length = 0;
        arr.push(...filtered);
    };

    removeFromArray(player.deck);
    removeFromArray(player.socialDeck);
    removeFromArray(player.storage);
    removeFromArray(player.drawPile);
    removeFromArray(player.discardPile);
    removeFromArray(player.exhaustPile);
    removeFromArray(player.hand);
    removeFromArray(player.combatTempCards);
}

function addCurseCardToDeck(cardName, count = 1) {
    if (!CARD_DATA[cardName] || !isPenaltyCard(cardName, 'curse')) return false;
    if (!player.deck) player.deck = [];
    for (let i = 0; i < count; i++) player.deck.push(cardName);
    const traitKey = getCurseTraitKey(cardName);
    if (traitKey && !player.traits.includes(traitKey)) addTrait(traitKey);
    autoSave();
    return true;
}

function cleanupCombatTempCards() {
    const list = player.combatTempCards || [];
    if (!Array.isArray(list) || list.length === 0) return;

    const counts = {};
    list.forEach(name => { counts[name] = (counts[name] || 0) + 1; });

    const removeFromArray = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return;
        const res = [];
        for (let i = 0; i < arr.length; i++) {
            const name = arr[i];
            if (counts[name] > 0) {
                counts[name]--;
            } else {
                res.push(name);
            }
        }
        arr.length = 0;
        arr.push(...res);
    };

    removeFromArray(player.hand);
    removeFromArray(player.drawPile);
    removeFromArray(player.discardPile);
    removeFromArray(player.exhaustPile);

    player.combatTempCards = [];
}

function migrateLegacyEquipment(p) {
    ensureEquipmentFields(p);
    if (!Array.isArray(p.relics)) p.relics = [];
    if (!Array.isArray(p.inventory)) p.inventory = [];
    if (!Array.isArray(p.warehouse)) p.warehouse = [];

    // 1) 예전 세이브에서 "유물(relics)"로 들어있던 장비를 장착 슬롯로 이동 (효과 유지)
    const prefer = ["rightHand", "leftHand", "accessory1", "accessory2", "head", "body", "legs"];
    const relicCopy = [...p.relics];
    relicCopy.forEach(name => {
        const data = ITEM_DATA[name];
        if (!data || data.usage !== "equip") return;

        // relics에서 제거
        const idx = p.relics.indexOf(name);
        if (idx >= 0) p.relics.splice(idx, 1);

        const slots = data.equipSlots || [];
        const candidates = prefer.filter(k => slots.includes(k));
        const targetOrder = (candidates.length > 0) ? candidates : slots;

        let equipped = false;
        for (let slotKey of targetOrder) {
            if (!p.equipment[slotKey]) {
                p.equipment[slotKey] = name;
                equipped = true;
                break;
            }
        }
        if (!equipped) p.equipmentBag.push(name);
    });

    // 2) 혹시 inventory에 남아있는 장비(구버전 혼입)도 장비 가방으로 이동
    const invCopy = [...p.inventory];
    invCopy.forEach(name => {
        const data = ITEM_DATA[name];
        if (!data || data.usage !== "equip") return;
        const idx = p.inventory.indexOf(name);
        if (idx >= 0) {
            p.inventory.splice(idx, 1);
            p.equipmentBag.push(name);
        }
    });
}
/* [game.js] updatePlayerAttribute 함수 전면 수정 */
function updatePlayerAttribute() {
    ensureEquipmentFields(player);

    // 공격/방어 속성 분리
    let attackSet = new Set();
    let defenseSet = new Set();
    
    // 1. 버프 속성 합치기 (기본: 공격 속성)
    if (player.attrBuff.turns > 0 && player.attrBuff.types.length > 0) {
        player.attrBuff.types.forEach(t => attackSet.add(t));
    }

    // 2. 유물(Passive): 기본은 공격 속성
    (player.relics || []).forEach(name => {
        const item = ITEM_DATA[name];
        if (!item) return;
        const role = item.attrRole || 'attack';
        const attrs = getItemAttrList(item);
        if (role === 'defense') attrs.forEach(a => defenseSet.add(a));
        else if (role === 'both') attrs.forEach(a => { attackSet.add(a); defenseSet.add(a); });
        else attrs.forEach(a => attackSet.add(a));
    });

    // 3. 장비(Equip): 슬롯 기준으로 공격/방어/장신구 역할 분리
    for (let slotKey in EQUIP_SLOT_META) {
        const equippedName = player.equipment[slotKey];
        if (!equippedName) continue;
        const item = ITEM_DATA[equippedName];
        if (!item) continue;

        const attrs = getItemAttrList(item);

        // 무기(왼손/오른손): 더 이상 '모든 공격'에 속성을 부여하지 않음
        // (무기 장착 시 덱에 전용 카드가 추가되는 방식으로 변경됨)
        if (slotKey === 'leftHand' || slotKey === 'rightHand') continue;

        // 방어구(머리/상체/하체): 방어 속성
        if (slotKey === 'head' || slotKey === 'body' || slotKey === 'legs') {
            attrs.forEach(a => defenseSet.add(a));
            continue;
        }

        // 장신구: 아이템별로 역할 지정 가능 (attack|defense|both)
        const role = item.attrRole || 'attack';
        if (role === 'defense') attrs.forEach(a => defenseSet.add(a));
        else if (role === 'both') attrs.forEach(a => { attackSet.add(a); defenseSet.add(a); });
        else attrs.forEach(a => attackSet.add(a));
    }

    // 4. 배열로 변환하여 저장 (기존 currentAttrs는 공격 속성 호환 유지)
    player.attackAttrs = Array.from(attackSet);
    player.defenseAttrs = Array.from(defenseSet);
    player.currentAttrs = player.attackAttrs;
}
// 2. 현재 보고 있는 탭 상태 변수
let currentInvTab = 'consume'; // 'consume' | 'equip' | 'relic'

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
    state: "char_creation", // [핵심] 초기에는 캐릭터 생성 화면
    started: false, // 캐릭터 생성 완료 여부
    doom: 0, // 글로벌 위험도
    turnOwner: "none", 
    pendingLoot: null,
    winMsg: "",
    lastTurnOwner: "none", // [NEW] 직전 턴 주인 기록용
    // [NEW] 행동 게이지 MAX 상수 (이 수치에 도달하면 턴 획득)
    AG_MAX: 1000,
    // 현재 수락한 의뢰 id (없으면 null)
    activeScenarioId: null,
    // [NEW] 시나리오 진행 상태
    scenario: null,
    // 던전 재진입 시 맵을 재생성해야 하는지 여부
    shouldResetDungeon: false,
    cityDiscoveries: {},
    day: 1,
    timeIndex: 0
};

// 현재 전투에서 사용할 적 목록을 전역으로 보관
let enemies = [];

const TIME_SLOTS = ["오전", "낮", "오후", "밤"];

function ensureTimeState() {
    if (!Number.isInteger(game.day)) game.day = 1;
    if (!Number.isInteger(game.timeIndex)) game.timeIndex = 0;
}

function getTimeLabel() {
    ensureTimeState();
    const slot = TIME_SLOTS[game.timeIndex] || TIME_SLOTS[0];
    return `${game.day}일차 ${slot}`;
}

function advanceTimeSlot(reason) {
    ensureTimeState();
    game.timeIndex = (game.timeIndex + 1) % TIME_SLOTS.length;
    if (game.timeIndex === 0) game.day += 1;
    updateUI();
    autoSave();
}

function getEnemyPoolFromScenario(scData) {
    if (!scData) return null;
    if (Array.isArray(scData.enemyPool) && scData.enemyPool.length > 0) return scData.enemyPool;
    if (scData.dungeon && Array.isArray(scData.dungeon.enemyPool) && scData.dungeon.enemyPool.length > 0) {
        return scData.dungeon.enemyPool;
    }
    if (scData.customDungeon && Array.isArray(scData.customDungeon.enemyPool) && scData.customDungeon.enemyPool.length > 0) {
        return scData.customDungeon.enemyPool;
    }
    return null;
}

function getCurrentEnemyPool() {
    if (game.scenario) {
        const direct = getEnemyPoolFromScenario(game.scenario);
        if (direct) return direct;
    }
    if (game.activeScenarioId && SCENARIOS[game.activeScenarioId]) {
        const pool = getEnemyPoolFromScenario(SCENARIOS[game.activeScenarioId]);
        if (pool) return pool;
    }
    if (game.scenario && game.scenario.isPatrol && game.scenario.districtKey) {
        const dist = DISTRICTS[game.scenario.districtKey];
        if (dist) {
            if (Array.isArray(dist.enemyPool) && dist.enemyPool.length > 0) return dist.enemyPool;
            if (dist.dungeon && Array.isArray(dist.dungeon.enemyPool) && dist.dungeon.enemyPool.length > 0) {
                return dist.dungeon.enemyPool;
            }
        }
    }
    return null;
}

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
/* [game.js] log 함수 수정 (통합 로그창 사용) */
function log(msg) {
    const box = document.getElementById('shared-log');
    if (box) {
        // 새 메시지 추가
        // (가독성을 위해 전투/탐사 구분이 필요하다면 msg 앞에 아이콘을 붙여도 좋습니다)
        const html = (typeof applyTooltip === 'function') ? applyTooltip(String(msg)) : String(msg);
        box.innerHTML += `<div>${html}</div>`;
        
        // 자동 스크롤 (맨 아래로)
        box.scrollTop = box.scrollHeight;
    }
}

// 클릭을 통과시키면서 툴팁 호버를 유지하기 위한 헬퍼
function forwardClickThrough(e) {
    const el = e.currentTarget;
    if (!el) return;
    const prev = el.style.pointerEvents;
    el.style.pointerEvents = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY);
    el.style.pointerEvents = prev;
    if (target && target !== el) {
        if (typeof target.click === 'function') target.click();
        else {
            const evt = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY });
            target.dispatchEvent(evt);
        }
    }
    e.stopPropagation();
    e.preventDefault();
}
// 대미지 폰트
function showDamageText(target, msg, isCrit = false) {
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;
    let targetEl = document.getElementById(targetId);
    
    if (targetEl) {
        let el = document.createElement("div");
        el.className = "damage-number";
        
        // [추가] 치명타일 경우 클래스 추가
        if (isCrit) {
            el.classList.add("crit-text");
            // 텍스트 내용도 조금 더 강조
            el.innerHTML = `<span style="font-size:0.6em">CRITICAL!</span><br>${msg.replace('⚡CRIT! ', '')}`;
        } else {
            el.innerText = msg;
        }
        
        targetEl.appendChild(el);
        
        setTimeout(() => { el.remove(); }, 800);
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

/* [NEW] 적 데이터 생성 헬퍼 (중복 제거용) */
function createEnemyData(key, index) {
    let data = ENEMY_DATA[key];
    if (!data) return null;
    
    let growthMult = game.level - 1;
    let maxHp = Math.floor(data.baseHp + (data.growth.hp * growthMult));
    let atk = Math.floor(data.stats.atk + (data.growth.atk * growthMult));
    let def = Math.floor(data.stats.def + (data.growth.def * growthMult));
    let spd = Math.floor(data.stats.spd + (data.growth.spd * growthMult));

    return {
       id: index,
       enemyKey: key, // ★ [핵심 추가] 적의 원본 종류 키 저장 (도감 등록용)
        name: `${data.name}${index > 0 ? ' ' + String.fromCharCode(65 + index) : ''}`,
        maxHp: maxHp, hp: maxHp,
        baseAtk: atk, baseDef: def, baseSpd: spd,
        block: 0, buffs: {}, 
        thorns: 0,
        deck: (data.deckType === "custom") ? data.deck : getEnemyDeck(data.deckType),
        img: data.img,
        tags: Array.isArray(data.tags) ? data.tags : [],
        // 적에게만 선행 게이지를 주지 않도록 0에서 시작 (플레이어와 동일 조건)
        ag: 0,
        baseAp: 2,
        weakness: data.weakness || "none",
        isBroken: false,
        isStunned: false
    };
}

function isSurrenderableEnemy(enemy) {
    if (!enemy || enemy.hp <= 0) return false;
    const tags = Array.isArray(enemy.tags) ? enemy.tags : [];
    if (!tags.includes("human")) return false;
    if (tags.includes("cult")) return false;
    if (tags.includes("boss")) return false;
    return true;
}

function triggerSurrenderWin() {
    if (game.state === "win") return;
    game.state = "win";

    let rewardGold = 1000 * (player.lucky ? 2 : 1);
    player.gold += rewardGold;

    let gainXp = 40 + (game.level * 10);
    player.xp += gainXp;

    game.winMsg = `승리! (항복 수락) <span style="color:#f1c40f">${rewardGold}원</span>, <span style="color:#3498db">${gainXp} XP</span> 획득.`;
    if (player.lucky) game.winMsg += " (🍀럭키피스 효과!)";

    game.pendingLoot = null;
    if (Math.random() < 0.5) {
            game.pendingLoot = getRandomItem(null, { categories: ["general"] }); 
        game.winMsg += `<br>✨ 전리품이 바닥에 떨어져 있습니다.`;
    }

    updateUI();
    renderWinPopup();
}

/* [NEW] 소셜 NPC 전투 데이터 생성 */
function createNpcEnemyData(npcKey, index = 0) {
    let data = NPC_DATA[npcKey];
    if (!data) return null;

    return {
        id: index,
        npcKey,
        name: data.name,
        maxHp: 100, hp: 100, // 의지 게이지
        baseAtk: data.baseAtk || 0, 
        baseDef: data.baseDef || 0, 
        baseSpd: data.baseSpd || 2,
        block: 0, buffs: {}, 
        thorns: 0,
        deck: data.deck || ["횡설수설"], 
        img: data.img,
        ag: 0,
        baseAp: 2,
        isNpc: true,
    };
}

/* [NEW] 적 의도(다음 행동) 계산 */
function pickEnemyCardForIntent(enemy) {
    if (!enemy || !Array.isArray(enemy.deck) || enemy.deck.length === 0) return null;
    return enemy.deck[Math.floor(Math.random() * enemy.deck.length)];
}

function describeIntentFromCard(cardName, enemy = null) {
    const data = CARD_DATA[cardName] || {};
    const result = { icon: "❓", tooltip: "무슨 행동을 할지 알 수 없습니다.", damageText: "" };
    const atkUser = enemy || null;
    const getPerHitDamage = (statType) => {
        if (typeof data.dmg !== 'number') return null;
        const base = Number(data.dmg || 0);
        if (!atkUser) return Math.max(0, base);
        return Math.max(0, base + getStat(atkUser, statType));
    };
    const getHitCount = () => {
        const randomHits = Math.max(0, Number(data.randomHits || 0));
        if (randomHits > 0) return randomHits;
        return Math.max(1, Number(data.multiHit || 1));
    };
    const appendDamageText = (perHit) => {
        if (!Number.isFinite(perHit)) return;
        const hits = getHitCount();
        result.damageText = hits > 1 ? `${perHit}x${hits}` : `${perHit}`;
        result.tooltip += ` (예상 피해: ${result.damageText})`;
    };

    if (data.special === "summon") {
        result.icon = "📢";
        result.tooltip = "소환/지원 요청을 준비 중";
        return result;
    }

    if (data.type === "social") {
        const isAttack = data.subtype === "attack";
        result.icon = isAttack ? "💬" : "🗣️";
        result.tooltip = isAttack ? "멘탈 공격을 시도하려 함" : "교란/설득을 준비 중";
        if (isAttack) {
            const perHit = getPerHitDamage('socialAtk');
            appendDamageText(perHit);
        }
        return result;
    }

    if (data.type && data.type.includes("attack")) {
        const perHit = getPerHitDamage('atk');
        const hits = getHitCount();
        const totalDmg = (perHit || 0) * hits;
        const isHeavy = totalDmg >= 12 || data.rank >= 3;
        result.icon = isHeavy ? "💥" : "⚔️";
        result.tooltip = isHeavy ? "강한 공격을 준비 중" : "공격하려 함";
        appendDamageText(perHit);
        return result;
    }

    if (data.type === "skill") {
        if (data.block && data.block > 0) {
            result.icon = "🛡️";
            result.tooltip = "방어 태세를 갖추려 함";
            return result;
        }
        if (data.buff || data.power) {
            result.icon = "✨";
            result.tooltip = "자신을 강화하거나 특수 효과를 준비 중";
            return result;
        }
        result.icon = "🎲";
        result.tooltip = "특수 행동을 준비 중";
        return result;
    }

    if (data.type === "power") {
        result.icon = "✨";
        result.tooltip = "지속 효과를 전개하려 함";
        return result;
    }

    return result;
}

// 여러 장 예고를 위해 큐 사용
function setEnemyIntentQueue(enemy, count = 1) {
    if (!enemy || enemy.hp <= 0) {
        if (enemy) enemy.intentQueue = [];
        return;
    }
    const intents = [];
    for (let i = 0; i < count; i++) {
        const cardName = pickEnemyCardForIntent(enemy);
        if (!cardName) break;
        const info = describeIntentFromCard(cardName, enemy);
        intents.push({ card: cardName, icon: info.icon, tooltip: info.tooltip, damageText: info.damageText });
    }
    enemy.intentQueue = intents;
}

function seedEnemyIntents(force = false) {
    if (!Array.isArray(enemies)) return;
    enemies.forEach(e => {
        if (e.hp > 0 && (force || !Array.isArray(e.intentQueue) || e.intentQueue.length === 0)) {
            const planned = e.ap || e.baseAp || 2;
            setEnemyIntentQueue(e, planned);
        }
    });
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
    
    // 소셜 HP (의지)
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
/* [NEW] 적 데이터 생성 헬퍼 (중복 제거용) */

// [game.js] 

/* ============================================================
   [시스템] 자동 저장 & 이어하기 (Auto-Save System)
   ============================================================ */

// [1] 게임 초기화 (진입점)
/* [game.js] initGame 함수 수정 */
function initGame() {
    // 1. 모바일 자동 전체화면 트리거 (첫 터치 시 발동)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        document.body.addEventListener('click', function() {
            // 아직 전체화면이 아니라면 요청
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    // 아이폰(Safari) 등 API 미지원 브라우저는 조용히 무시
                    // (아이폰은 '홈 화면에 추가'로만 전체화면 가능)
                });
            }
        }, { once: true }); // ★ 딱 한 번만 실행되고 사라짐
    }

    // 2. 기존 저장 데이터 확인 로직
    if (localStorage.getItem('midnight_rpg_save')) {
        loadGame();
    } else {
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
        version: "2.4",
        player: targetPlayer,
        enemies: targetEnemies,
        game: targetGame,
        
        // ★ [추가] 던전 시스템의 상태도 함께 저장
        dungeon: {
            map: DungeonSystem.map,
            width: DungeonSystem.width,
            height: DungeonSystem.height,
            currentPos: DungeonSystem.currentPos,
            progress: DungeonSystem.progress,
            isCity: DungeonSystem.isCity
        },
        
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

/* [game.js] loadGame 함수 전면 수정 (상태 기반 복구 로직 강화) */
function loadGame() {
    const saveString = localStorage.getItem('midnight_rpg_save');
    if (!saveString) return;

    try {
        const loadedData = JSON.parse(saveString);

        // 데이터 복구
        player = loadedData.player;
        game = loadedData.game;
        ensureTimeState();
        if (!game.cityDiscoveries) game.cityDiscoveries = {};

        ensureEquipmentFields(player);
        migrateLegacyEquipment(player);
        resyncEquipCardGrantsFromEquipped();
        
        if (game.started === undefined) game.started = true;
        if (game.activeScenarioId === undefined) game.activeScenarioId = null;
        enemies = loadedData.enemies || [];

        if (loadedData.clearedScenarios) {
            loadedData.clearedScenarios.forEach(id => {
                if (SCENARIOS[id]) SCENARIOS[id].cleared = true;
            });
        }
        
        if (!player.img && player.job && JOB_DATA[player.job]) {
            player.img = JOB_DATA[player.job].img;
        }
        // ★ [수정] 저장된 던전 데이터 복구 로직 강화
        if (loadedData.dungeon && loadedData.dungeon.map.length > 0) {
            Object.assign(DungeonSystem, loadedData.dungeon);
            game.dungeonMap = true; // [중요] 맵이 이미 있음을 표시 (재생성 방지)
        } else {
            // 저장된 던전이 없는데 탐사 중이라면 -> 강제로 맵 재생성 유도
            if (game.state === 'exploration') {
                game.dungeonMap = false; 
            }
        }
        recalcStats();
        updatePlayerAttribute();
        
        // [★수정] 화면 복구 로직: game.state를 최우선으로 확인합니다.
        switch (game.state) {
            case 'battle':
            case 'social':
                // 전투/소셜: 시작 시점으로 리셋하여 복구
                game.turnOwner = "none";
                game.lastTurnOwner = "none";
                createBattleCheckpoint();
                switchScene('battle');
                showBattleView();
                // 플레이어 이미지 동기화 (HTML 기본 이미지를 덮어씀)
                const loadedPlayerEl = document.getElementById('dungeon-player');
                if (loadedPlayerEl) {
                    loadedPlayerEl.src = player.img || loadedPlayerEl.src;
                }
                renderEnemies();
                renderHand();
                updateUI();
                processTimeline(); 
                break;

            case 'city':
                // 도시 지도: 지도 다시 그리기
                renderCityMap();
                break;

            case 'exploration':
        // ★ [수정] 복구 조건 완화
        // 기존: if (game.activeScenarioId && game.scenario) 
        // 변경: 의뢰 ID가 있거나, 또는 시나리오 데이터가 있고 그것이 '순찰(Patrol)'인 경우
        if ((game.activeScenarioId || (game.scenario && game.scenario.isPatrol)) && game.scenario) {
            renderExploration();
        } else if (game.scenario && (game.scenario.isCity || (typeof game.scenario.id === "string" && game.scenario.id.startsWith("city:")))) {
            renderExploration();
        } else {
            // 데이터가 깨졌거나 비정상 종료된 경우 안전하게 사무소로
            renderHub(); 
        }
        break;
            case 'storage':
                // 창고 화면 복구
                openStorage();
                break;

            case 'deck':
                // 덱 관리 화면 복구
                openDeckManager();
                break;

            case 'hub':
            default:
                // 그 외 모든 경우는 사무소로
                renderHub();
                break;
        }

        updateUI();

    } catch (e) {
        console.error(e);
        showPopup("오류", "세이브 파일 오류입니다. 데이터를 초기화합니다.", [
            { txt: "확인", func: () => { closePopup(); resetGameData(); } }
        ]);
    }
}

// [4] 데이터 삭제 (초기화)
// [수정] confirmReset: confirm -> showPopup
function confirmReset() {
    showPopup("⚠️ 데이터 초기화", "정말 모든 데이터를 삭제하고 처음부터 시작하시겠습니까?<br><span style='color:#e74c3c'>(되돌릴 수 없습니다)</span>", [
        { 
            txt: "예 (삭제)", 
            func: () => { 
                closePopup(); 
                resetGameData(); 
            } 
        },
        { txt: "아니오", func: closePopup }
    ]);
}

function resetGameData() {
    localStorage.removeItem('midnight_rpg_save');
    location.reload(); // 페이지 새로고침 -> initGame에서 데이터 없으므로 생성 화면으로
}

// 던전 상태 초기화 헬퍼 (맵/위치/플래그 리셋)
function resetDungeonState() {
    game.dungeonMap = false;
    game.shouldResetDungeon = false;
    DungeonSystem.map = [];
    DungeonSystem.currentPos = { x: 0, y: 0 };
    DungeonSystem.progress = 0;
    DungeonSystem.objectAnchor = 0;
    DungeonSystem.isCity = false;
}

function startCharacterCreation() {
    game.state = 'char_creation';
    game.started = false;
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

    const activeItems = getActivePassiveItemNames();
    const bonusDerived = getTotalBonusDerived(activeItems);

    // [수정] 0 이하가 될 수 있도록 Math.max 제거 (생성 제한 확인을 위해)
    // 기본 공식: 30 + (보정치 * 10)
    player.maxHp = 30 + (conMod * 10) + (bonusDerived.hp || 0);
    player.maxSp = 30 + (wilMod * 10) + (bonusDerived.sp || 0);
    
    // 소셜 HP (의지)
    player.maxMental = 100 + (wilMod * 10) + (bonusDerived.mental || 0);

    if (player.hp > player.maxHp) player.hp = player.maxHp;
    if (player.sp > player.maxSp) player.sp = player.maxSp;
    if (player.mental > player.maxMental) player.mental = player.maxMental;
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
            el.onclick = () => showPopup("이 직업의 기본 특성입니다. 해제할 수 없습니다.");
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

    // 캐릭터 생성 완료 상태로 전환
    game.started = true;
    game.day = 1;
    game.timeIndex = 0;
    game.state = 'hub';
    game.activeScenarioId = null;
    game.scenario = null;

    // 데이터 적용
    player.job = tempJob;
    player.img = JOB_DATA[tempJob].img;
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

    // 시작 장비 지급/장착 (직업별)
    ensureEquipmentFields(player);
    player.equipmentCardGrants = {};
    const starterEq = JOB_DATA[tempJob].starterEquipment;
    if (starterEq) {
        for (let slotKey in starterEq) {
            const itemName = starterEq[slotKey];
            if (!itemName || !ITEM_DATA[itemName] || ITEM_DATA[itemName].usage !== "equip") continue;
            if (slotKey in player.equipment) player.equipment[slotKey] = itemName;
        }
        resyncEquipCardGrantsFromEquipped();
    }
    
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
        showPopup("⛔ 캐릭터 생성 불가", 
            `현재 세팅으로는 생존할 수 없습니다.<br>(최대 HP: ${player.maxHp}, 최대 SP: ${player.maxSp})<br><br>건강/정신 스탯을 높이거나, 페널티 특성을 해제해주세요.`,
            [{txt: "확인", func: closePopup}]
        );
        return;
    }

    // 통과 시 체력 회복 및 게임 시작
    player.hp = player.maxHp;
    player.sp = player.maxSp;
    
    renderHub();
    autoSave(); // [추가] 생성 직후 저장
}

/* [NEW] 거점 화면 렌더링 */

function isDetectiveJob() {
    return player && player.job === "detective";
}


function getOfficeName() {
    const area = (typeof CITY_AREA_DATA !== 'undefined' && CITY_AREA_DATA) ? CITY_AREA_DATA.east_oldtown : null;
    if (area && Array.isArray(area.spots)) {
        const spot = area.spots.find(s => s.id === "youngjin_office");
        if (spot && spot.name) return spot.name;
    }
    return "영진 탐정 사무소";
}

function getHomeMeta() {
    const officeName = getOfficeName();
    if (isDetectiveJob()) {
        return {
            tag: officeName,
            title: `🕵️ ${officeName}`,
            sub: "도시의 어둠을 밝히는 유일한 불빛",
            bg: "https://placehold.co/1400x800/1c1f28/3f4757?text=Detective+Office+Panorama",
            returnLabel: "🏠 사무소 복귀",
            returnLabelLong: "🏠 사무소로 복귀"
        };
    }
    return {
        tag: "카페 헤카테",
        title: "☕ 카페 헤카테",
        sub: "해결사들이 쉬어가는 은신처",
        bg: "https://placehold.co/1400x800/2b1f1a/d9c2a3?text=Cafe+Hecate",
        returnLabel: "🏠 카페 복귀",
        returnLabelLong: "🏠 카페로 복귀"
    };
}

function updateHomeUI() {
    const meta = getHomeMeta();
    const hub = document.getElementById('hub-scene');
    if (hub) {
        const tagEl = hub.querySelector('.hub-tag');
        const titleEl = hub.querySelector('.hub-copy h1');
        const subEl = hub.querySelector('.hub-sub');
        if (tagEl) tagEl.textContent = meta.tag;
        if (titleEl) titleEl.textContent = meta.title;
        if (subEl) subEl.textContent = meta.sub;
        const illus = hub.querySelector('.hub-illustration');
        if (illus) illus.style.backgroundImage = `url('${meta.bg}')`;
    }

    const cityBack = document.querySelector('.city-back-btn');
    if (cityBack) cityBack.textContent = meta.returnLabel;

    const returnBtn = document.querySelector('button[onclick="returnToHub()"]');
    if (returnBtn) returnBtn.textContent = meta.returnLabelLong;
}
function renderHub() {
    game.state = 'hub';
    // 사무소로 돌아올 때는 던전 진행을 리셋하여 다음 진입 시 시작방에서 시작
    resetDungeonState();
    switchScene('hub');
    updateHomeUI();
    updateUI(); // 상단 바 갱신
    autoSave();
}

/* [NEW] 거점 휴식 */
function hubRest() {
    if (player.gold < 1900) {
        showPopup("잔액 부족", "커피 사 마실 돈도 없습니다...", [{txt:"확인", func:closePopup}]);
        return;
    }
    
    player.gold -= 1900;
    player.hp = player.maxHp;
    player.sp = player.maxSp;
    
    updateUI();
    advanceTimeSlot("rest");
    showPopup("휴식", "따뜻한 커피를 마시며 안정을 찾았습니다.<br>(HP/SP 완전 회복)", [{txt:"확인", func:closePopup}]);
}

function openHospitalCure() {
    const curseTraits = getCureTraitsByTag("medical");
    if (curseTraits.length === 0) {
        showPopup("대학 병원", "치료할 부상이 없습니다.", [{ txt: "확인", func: closePopup }]);
        return;
    }

    const buttons = curseTraits.map(key => {
        const cardName = getCurseCardByTrait(key);
        const t = TRAIT_DATA[key] || { name: key };
        const cost = Number.isFinite(t.cureCost) ? t.cureCost : 1000;
        return {
            txt: `${t.name}${cardName ? ` (${cardName})` : ""} - ${cost}G`,
            func: () => {
                closePopup();
                if (player.gold < cost) {
                    showPopup("잔액 부족", "치료 비용이 부족합니다.", [{ txt: "확인", func: closePopup }]);
                    return;
                }
                player.gold -= cost;
                removeTrait(key);
                if (cardName) removeCardEverywhere(cardName);
                advanceTimeSlot("hospital_cure");
                showPopup("치료 완료", `${t.name}이(가) 해제되었습니다.`, [{ txt: "확인", func: closePopup }]);
            }
        };
    });
    buttons.push({ txt: "취소", func: closePopup });
    showPopup("대학 병원", "치료할 부상을 선택하세요.", buttons);
}

function getCureTraitsByTag(tag) {
    const list = (player.traits || []).filter(key => {
        if (!getCurseCardByTrait(key)) return false;
        const t = TRAIT_DATA[key] || {};
        const cureTag = t.cureTag || "medical";
        return tag ? cureTag === tag : true;
    });
    return list;
}

function openOccultClinic() {
    const curseTraits = getCureTraitsByTag("occult");
    if (curseTraits.length === 0) {
        showPopup("한의원 제생당", "해주할 오컬트 저주가 없습니다.", [{ txt: "확인", func: closePopup }]);
        return;
    }

    const buttons = curseTraits.map(key => {
        const cardName = getCurseCardByTrait(key);
        const t = TRAIT_DATA[key] || { name: key };
        const cost = Number.isFinite(t.cureCost) ? t.cureCost : 1500;
        return {
            txt: `${t.name}${cardName ? ` (${cardName})` : ""} - ${cost}G`,
            func: () => {
                closePopup();
                if (player.gold < cost) {
                    showPopup("잔액 부족", "치료 비용이 부족합니다.", [{ txt: "확인", func: closePopup }]);
                    return;
                }
                player.gold -= cost;
                removeTrait(key);
                if (cardName) removeCardEverywhere(cardName);
                advanceTimeSlot("occult_cure");
                showPopup("해주 완료", `${t.name}이(가) 해제되었습니다.`, [{ txt: "확인", func: closePopup }]);
            }
        };
    });
    buttons.push({ txt: "한방약 구매", func: () => renderShopScreen("shop_herbal") });
    buttons.push({ txt: "취소", func: closePopup });
    showPopup("한의원 제생당", "해주할 오컬트 저주를 선택하세요.", buttons);
}

function openSaunaRest() {
    if (player.hp >= player.maxHp && player.sp >= player.maxSp) {
        showPopup("용궁 사우나", "이미 충분히 회복되어 있습니다.", [{ txt: "확인", func: closePopup }]);
        return;
    }
    player.hp = player.maxHp;
    player.sp = player.maxSp;
    updateUI();
    advanceTimeSlot("sauna_rest");
    showPopup("용궁 사우나", "뜨끈한 탕에서 쉬며 체력과 이성을 회복했습니다.", [{ txt: "확인", func: closePopup }]);
}

function openHealingClinic() {
    const healCost = 5000;
    const buffCost = 4000;
    const cureTraits = getCureTraitsByTag(null);
    const cureCostBase = cureTraits.reduce((sum, key) => {
        const t = TRAIT_DATA[key] || {};
        const cost = Number.isFinite(t.cureCost) ? t.cureCost : 1500;
        return sum + cost;
    }, 0);
    const cureCost = cureCostBase > 0 ? Math.floor(cureCostBase * 2) : 0;

    const buttons = [
        {
            txt: `회복 진료 - ${healCost}G`,
            func: () => {
                closePopup();
                if (player.gold < healCost) {
                    showPopup("잔액 부족", "진료 비용이 부족합니다.", [{ txt: "확인", func: closePopup }]);
                    return;
                }
                player.gold -= healCost;
                player.hp = player.maxHp;
                player.sp = player.maxSp;
                updateUI();
                advanceTimeSlot("clinic_heal");
                showPopup("힐링 클리닉 사일런스", "컨디션이 완전히 회복되었습니다.", [{ txt: "확인", func: closePopup }]);
            }
        },
        {
            txt: `모든 저주 해제 - ${cureCost}G`,
            func: () => {
                closePopup();
                if (cureTraits.length === 0) {
                    showPopup("힐링 클리닉 사일런스", "해제할 저주가 없습니다.", [{ txt: "확인", func: closePopup }]);
                    return;
                }
                if (player.gold < cureCost) {
                    showPopup("잔액 부족", "진료 비용이 부족합니다.", [{ txt: "확인", func: closePopup }]);
                    return;
                }
                player.gold -= cureCost;
                cureTraits.forEach(key => {
                    const cardName = getCurseCardByTrait(key);
                    removeTrait(key);
                    if (cardName) removeCardEverywhere(cardName);
                });
                advanceTimeSlot("clinic_cure_all");
                showPopup("힐링 클리닉 사일런스", "모든 저주가 해제되었습니다.", [{ txt: "확인", func: closePopup }]);
            }
        },
        {
            txt: `컨디션 부스트 - ${buffCost}G`,
            func: () => {
                closePopup();
                if (player.gold < buffCost) {
                    showPopup("잔액 부족", "진료 비용이 부족합니다.", [{ txt: "확인", func: closePopup }]);
                    return;
                }
                player.gold -= buffCost;
                applyBuff(player, "활력", 3);
                applyBuff(player, "건강", 2);
                applyBuff(player, "쾌속", 2);
                updateUI();
                advanceTimeSlot("clinic_buff");
                showPopup("힐링 클리닉 사일런스", "맞춤 케어로 컨디션이 강화되었습니다.", [{ txt: "확인", func: closePopup }]);
            }
        },
        { txt: "약 구매", func: () => renderShopScreen("shop_clinic") },
        { txt: "닫기", func: closePopup }
    ];

    showPopup("힐링 클리닉 사일런스", "원하시는 서비스를 선택하세요.", buttons);
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
    game.state = 'deck';
    
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
        showPopup("최소 5장의 카드는 있어야 합니다.");
        return;
    }

    let card = targetDeck[deckIdx];
    if (isPenaltyCard(card, 'curse')) {
        showPopup("저주는 제거할 수 없습니다.");
        return;
    }

    card = targetDeck.splice(deckIdx, 1)[0]; // 덱에서 제거
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

function startSocialBattle(npcKey, preserveEnemies = false) {
    game.state = "social";
    game.totalTurns = 0;
    game.isBossBattle = false;
    game.turnOwner = "none";     
    game.lastTurnOwner = "none"; 

    // 1. 플레이어 상태 초기화 (소셜 전용 스탯 설정)
    player.mental = 100; 
    player.maxMental = 100;
    
    // 덱 교체
    player.drawPile = [...player.socialDeck]; 
    shuffle(player.drawPile);
    player.discardPile = []; player.exhaustPile = []; player.hand = [];
    player.buffs = {}; player.block = 0; player.ag = 0;
    migrateThornsFromBuff(player);
    ensureThornsField(player);
    player.thorns = 0; // 소셜에선 의미 없지만 저장/표시 일관성 유지
    ensureCardSystems(player);
    player.handCostOverride = [];
    player.powers = {};        // 전투 파워(안전장치)
    player.socialPowers = {};  // 소셜 파워
    game.combatCardGrowth = {}; // 소셜에서도 '이번 전투 한정 성장' 허용
    game.innateDrawn = false;

    renderHand();

    // 2. 적(NPC) 생성 (프리뷰에서 만들어졌다면 재생성하지 않음)
    if (!preserveEnemies) {
        enemies = [];
        let npc = createNpcEnemyData(npcKey, 0);
        if (npc) enemies.push(npc);
    }
    seedEnemyIntents(true);

    let data = NPC_DATA[npcKey] || enemies[0];
    if (data) log(`💬 [${data.name}]와(과) 설전을 벌입니다! (의지을 무너뜨리세요)`);

    // 탐사 배경을 전투 배경과 동기화
    let explBg = document.getElementById('expl-bg');
    let battleBg = document.getElementById('battle-bg');
    if (explBg && battleBg) {
        battleBg.style.backgroundImage = explBg.style.backgroundImage;
    }

    createBattleCheckpoint();
    autoSave();

    switchScene('battle'); 
    showBattleView();

    // 적 영역 업데이트 (프리뷰 모드 해제)
    const eArea = document.getElementById('dungeon-enemies');
    if (eArea) {
        if (!preserveEnemies) renderEnemies();
        setTimeout(() => {
            eArea.classList.remove('preview-mode');
            updateUI();
        }, 50);
    } else {
        renderEnemies();
        updateUI();
    }
    
    processTimeline();
}

/* [수정] 소셜 임팩트 적용 (플레이어는 무조건 SP 피해) */
function applySocialImpact(target, val) {
    let absVal = Math.abs(val);
    let effectiveVal = absVal;

    // 1. 방어도(의지) 체크
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

function openActiveMissions() {
    let content = "";
    if (game.activeScenarioId && SCENARIOS[game.activeScenarioId]) {
        const sc = SCENARIOS[game.activeScenarioId];
        const stored = game.activeScenarioState && game.activeScenarioState[game.activeScenarioId];
        const activeScenario = (game.scenario && game.scenario.id === game.activeScenarioId) ? game.scenario : stored;
        const isActive = !!(activeScenario && activeScenario.isActive);
        const progress = (Number.isFinite(activeScenario?.clues)) ? `${activeScenario.clues}%` : "대기 중";
        const locationText = Array.isArray(sc.locations) ? sc.locations.join(", ") : (sc.location || "");

        content = `
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="font-weight:bold; font-size:1.05em;">${sc.title}</div>
                <div style="font-size:0.85em; color:#aaa;">${sc.desc || ""}</div>
                <div style="font-size:0.85em; color:#f1c40f;">진행도: ${progress}</div>
                ${locationText ? `<div style="font-size:0.8em; color:#777;">예상 지역: ${locationText}</div>` : ""}
            </div>
        `;
    } else {
        content = `<div style="color:#777;">현재 받은 의뢰가 없습니다.</div>`;
    }

    showPopup("📌 진행 중 의뢰", "현재 수락된 의뢰 정보입니다.", [
        {txt: "닫기", func: closePopup}
    ], content);
}

function storeActiveScenarioState() {
    if (!game.activeScenarioId || !game.scenario) return;
    if (game.scenario.id !== game.activeScenarioId) return;
    if (!game.activeScenarioState) game.activeScenarioState = {};
    game.activeScenarioState[game.activeScenarioId] = { ...game.scenario };
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

function startScenarioFromCity(id) {
    const scData = SCENARIOS[id];
    if (!scData) return;
    advanceTimeSlot("city_scenario");

    game.activeScenarioId = id;
    const prevScenario = (game.scenario && game.scenario.id === id) ? game.scenario : null;
    game.scenario = {
        id: id,
        title: scData.title,
        clues: prevScenario ? (prevScenario.clues || 0) : 0,
        location: (prevScenario && prevScenario.location) ? prevScenario.location : scData.locations[0],
        bossReady: prevScenario ? !!prevScenario.bossReady : false,
        isActive: true,
        enemyPool: prevScenario?.enemyPool || getEnemyPoolFromScenario(scData),
        returnToCity: prevScenario?.returnToCity
    };

    if (Array.isArray(scData.unlocks) && scData.unlocks.length > 0) {
        const unlockMap = {
            cult_hideout: { areaId: "subway_transfer_hall", key: "cult_hideout" }
        };
        scData.unlocks.forEach(unlockKey => {
            const target = unlockMap[unlockKey];
            if (target) unlockCitySpot(target.areaId, target.key);
        });
    }

    if (game.cityArea && game.cityArea.areaId) {
        game.scenario.returnToCity = {
            areaId: game.cityArea.areaId,
            spotId: game.cityArea.currentSpot
        };
    }

    game.dungeonMap = false;
    renderExploration(true);
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
        location: scData.locations[0], 
        bossReady: false,
        isActive: false,
        enemyPool: getEnemyPoolFromScenario(scData)
    };

    if (Array.isArray(scData.unlocks) && scData.unlocks.length > 0) {
        const unlockMap = {
            cult_hideout: { areaId: "subway_transfer_hall", key: "cult_hideout" }
        };
        scData.unlocks.forEach(unlockKey => {
            const target = unlockMap[unlockKey];
            if (target) unlockCitySpot(target.areaId, target.key);
        });
    }
    
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
        showPopup("✅ 의뢰 수락", 
            `<b>[${scData.title}]</b><br><br>"${targetDistrictName}" 구역으로 이동하여 조사를 시작하세요.`, 
            [{txt: "확인", func: closePopup}]
        );
    }, 100);
    
    updateUI();
}

// 교체 성공 시 실행할 콜백 저장 변수
let tempSwapCallback = null;

// [수정] addItem 함수: 중복 체크 범위 확대 (창고 포함)
function addItem(name, onAcquireCallback = null) {
    let data = ITEM_DATA[name];
    if (!data) return false;

    // [CASE A] 유물 (Passive)
    if (data.usage === "passive") {
        // [★핵심] 보유 중이거나 '창고'에 있어도 중복 획득 불가
        if (hasItemAnywhere(name)) return false;

        player.relics.push(name);
        log(`💍 유물 획득! [${name}]`);

        recalcStats();
        updatePlayerAttribute();
        updateInventoryUI();
        if (onAcquireCallback) onAcquireCallback();
        return true;
    }

    // [CASE B] 장비 (Equip)
    if (data.usage === "equip") {
        // 장비도 기본은 중복 획득 불가 (유물과 동일 정책)
        if (hasItemAnywhere(name)) return false;

        ensureEquipmentFields(player);
        player.equipmentBag.push(name);
        log(`🧰 장비 획득! [${name}]`);

        recalcStats();
        updatePlayerAttribute();
        updateInventoryUI();
        if (onAcquireCallback) onAcquireCallback();
        return true;
    }
    
    // [CASE B] 소모품 (기존과 동일)
    else {
        if (player.inventory.length < player.maxInventory) {
            player.inventory.push(name);
            log(`🎒 아이템 획득! [${name}]`);
            updateInventoryUI();
            if (onAcquireCallback) onAcquireCallback();
            return true;
        } else {
            log("🚫 가방이 꽉 찼습니다! 교체할 아이템을 선택하세요.");
            showSwapPopup(name, onAcquireCallback);
            return false;
        }
    }
}
// 현재 창고 탭 상태 ('consume' | 'equip' | 'relic')
let currentStorageMode = 'consume';
/* [수정] 창고 열기 (초기화) */
function openStorage() {
    switchStorageMode('consume'); // 기본은 소모품 탭
    game.state = 'storage';
    switchScene('storage');
}

/* [NEW] 창고 탭 전환 */
function switchStorageMode(mode) {
    currentStorageMode = mode;
    
    // 버튼 스타일 업데이트 (선택된 탭 밝게, 아니면 흐리게)
    document.getElementById('tab-storage-consume').style.opacity = (mode === 'consume') ? 1 : 0.5;
    document.getElementById('tab-storage-equip').style.opacity = (mode === 'equip') ? 1 : 0.5;
    document.getElementById('tab-storage-relic').style.opacity = (mode === 'relic') ? 1 : 0.5;
    
    // 제목 업데이트
    document.getElementById('storage-bag-title').innerText =
        (mode === 'consume') ? "🎒 소모품" : (mode === 'equip' ? "🧰 장비" : "💍 유물");
    
    renderStorage();
}

/* [수정] 창고 렌더링 (필터링 적용) */
function renderStorage() {
    const bagList = document.getElementById('storage-bag-list');
    const warehouseList = document.getElementById('storage-warehouse-list');
    
    bagList.innerHTML = "";
    warehouseList.innerHTML = "";

    // --- [1] 왼쪽: 가방 (현재 탭에 맞는 아이템만 표시) ---
    if (currentStorageMode === 'consume') {
        // 소모품 표시
        player.inventory.forEach((name, idx) => {
            let el = createStorageItemEl(name, () => moveItemToWarehouse('consume', idx));
            bagList.appendChild(el);
        });
    } else if (currentStorageMode === 'equip') {
        ensureEquipmentFields(player);
        player.equipmentBag.forEach((name, idx) => {
            let el = createStorageItemEl(name, () => moveItemToWarehouse('equip', idx));
            el.style.borderColor = "#3498db"; // 장비 강조
            bagList.appendChild(el);
        });
    } else {
        // 유물 표시
        player.relics.forEach((name, idx) => {
            let el = createStorageItemEl(name, () => moveItemToWarehouse('relic', idx));
            el.style.borderColor = "#f1c40f"; // 유물 강조
            bagList.appendChild(el);
        });
    }

    // --- [2] 오른쪽: 창고 (현재 탭에 맞는 아이템만 필터링해서 표시) ---
    player.warehouse.forEach((name, originalIdx) => {
        let data = ITEM_DATA[name];
        let isRelic = (data.usage === 'passive');
        let isEquip = (data.usage === 'equip');
        
        // 필터링: 현재 탭과 타입이 맞지 않으면 건너뜀
        if (currentStorageMode === 'consume' && (isRelic || isEquip)) return;
        if (currentStorageMode === 'equip' && !isEquip) return;
        if (currentStorageMode === 'relic' && !isRelic) return;

        // 아이템 생성 (클릭 시 originalIdx를 사용해 정확한 아이템을 가져옴)
        let el = createStorageItemEl(name, () => moveItemFromWarehouse(originalIdx));
        
        // 창고에 있는 유물/장비는 효과 꺼짐 표시 (흐리게 + 회색 테두리)
        if (isRelic || isEquip) {
            el.style.opacity = "0.7";
            el.style.borderColor = "#7f8c8d";
        }
        
        warehouseList.appendChild(el);
    });
}

/* [NEW] 창고 아이템 엘리먼트 생성 헬퍼 */
function createStorageItemEl(name, onClick) {
    let data = ITEM_DATA[name];
    let el = document.createElement('div');
    el.className = 'shop-item'; // 기존 스타일 재사용
    el.style.width = "60px";
    el.style.margin = "5px";
    
    el.innerHTML = `
        <div class="item-icon item-rank-${data.rank}" style="width:50px; height:50px; font-size:1.2em; pointer-events:none;">
            ${data.icon}
        </div>
        <div style="font-size:0.7em; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:60px;">${name}</div>
    `;
    el.onclick = onClick;
    return el;
}

/* [수정] 가방 -> 창고 이동 (렌더링 갱신 추가) */
function moveItemToWarehouse(type, idx) {
    let item;
    if (type === 'consume') {
        item = player.inventory.splice(idx, 1)[0];
    } else if (type === 'equip') {
        ensureEquipmentFields(player);
        item = player.equipmentBag.splice(idx, 1)[0];
    } else {
        item = player.relics.splice(idx, 1)[0];
        recalcStats();
        updatePlayerAttribute();
    }
    
    player.warehouse.push(item);
    
    renderStorage(); // 화면 갱신
    updateUI(); 
    autoSave();
}

/* [수정] 창고 -> 가방 이동 (렌더링 갱신 추가) */
function moveItemFromWarehouse(idx) {
    let item = player.warehouse[idx];
    let data = ITEM_DATA[item];

    // 공간 확인 (소모품인 경우만)
    if (data.usage === 'consume' && player.inventory.length >= player.maxInventory) {
        showPopup("공간 부족", "가방(소모품) 공간이 부족합니다!", [{txt: "확인", func: closePopup}]);
        return;
    }

    // 창고에서 제거
    player.warehouse.splice(idx, 1);

    // 가방으로 이동
    if (data.usage === 'passive') {
        player.relics.push(item);
        recalcStats();
        updatePlayerAttribute();
    } else if (data.usage === 'equip') {
        ensureEquipmentFields(player);
        player.equipmentBag.push(item);
    } else {
        player.inventory.push(item);
    }

    renderStorage(); // 화면 갱신
    updateUI(); 
    autoSave();
}

/* [game.js] showSwapPopup 함수 수정 (취소 시 복귀 로직 추가) */
function showSwapPopup(newItemName, onSuccess) {
    // 1. 현재 가방의 아이템들을 버튼으로 나열
    let content = `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; padding:10px;">`;
    
    player.inventory.forEach((itemName, idx) => {
        let item = ITEM_DATA[itemName];
        content += `
            <button class="hub-card" onclick="processItemSwap(${idx}, '${newItemName}')" style="display:flex; flex-direction:column; align-items:center; gap:5px; padding:10px; border:1px solid #555;">
                <div class="item-icon item-rank-${item.rank}" style="pointer-events:none;">${item.icon}</div>
                <div style="font-size:0.8em; font-weight:bold; color:#ddd;">${itemName}</div>
                <div style="font-size:0.7em; color:#e74c3c;">▼ 버리기</div>
            </button>
        `;
    });
    content += `</div>`;

    // 2. 콜백 저장
    tempSwapCallback = onSuccess;

    // 3. 팝업 띄우기
    showPopup(
        "🎒 가방 정리", 
        `<span style='color:#2ecc71'>[${newItemName}]</span>을(를) 넣을 공간이 없습니다.<br>대신 버릴 아이템을 선택하세요.`, 
        [
            { 
                txt: "포기하기 (획득 취소)", 
                func: () => { 
                    closePopup();
                    // ★ 핵심 수정: 전투 승리 상태라면 결과 화면을 다시 띄워줌 (닫힘 방지)
                    if (game.state === "win") {
                        setTimeout(() => renderWinPopup(), 100);
                    }
                } 
            }
        ],
        content
    );
}

/* [NEW] 실제 교체 실행 함수 */
function processItemSwap(idx, newItemName) {
    let oldItem = player.inventory[idx];
    
    // 교체 (덮어쓰기)
    player.inventory[idx] = newItemName;
    log(`♻️ [${oldItem}] 버림 -> [${newItemName}] 획득`);
    
    // UI 갱신
    updateInventoryUI();
    updateUI();
    closePopup(); // 팝업 닫기

    // 성공 콜백 실행 (골드 차감, 전리품 삭제 등)
    if (tempSwapCallback) {
        tempSwapCallback();
        tempSwapCallback = null;
    }
}
// [NEW] 탭 전환 함수
function switchInvTab(tab) {
    currentInvTab = tab;
    
    // 버튼 스타일 갱신
    document.getElementById('tab-consume').className = (tab === 'consume' ? 'inv-tab active' : 'inv-tab');
    document.getElementById('tab-equip').className = (tab === 'equip' ? 'inv-tab active' : 'inv-tab');
    document.getElementById('tab-relic').className = (tab === 'relic' ? 'inv-tab active' : 'inv-tab');
    
    updateInventoryUI();
}
// [수정] 아이템 사용 함수 (배열 인덱스 참조 문제 해결)
function useItem(index, target) {
    // 소모품 탭에서만 사용 가능 (안전장치)
    if (currentInvTab !== 'consume') return;

    const name = player.inventory[index]; // 소모품 배열에서 찾음
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
           case "buff_attr":
        // val이 배열이면 그대로, 문자열이면 배열로 감싸서 저장
        let types = Array.isArray(data.val) ? data.val : [data.val];
        
        player.attrBuff = { types: types, turns: data.duration };
        updatePlayerAttribute(); // 갱신
        
        // 로그 메시지 생성
        let attrNames = types.map(t => ATTR_ICONS[t]).join(", ");
        log(`✨ ${data.duration}턴 동안 [${attrNames}] 속성이 부여됩니다.`);
        
        playAnim("player-char", "anim-bounce");
        used = true;
        break;
            case "heal": {
                let healAmt = Math.min(target.maxHp - target.hp, data.val);
                target.hp += healAmt;
                if (Number.isFinite(data.healSp) && data.healSp > 0) {
                    let spHeal = Math.min(target.maxSp - target.sp, data.healSp);
                    target.sp += spHeal;
                    log(`🍷 [${name}] 사용! HP +${healAmt}, SP +${spHeal}`);
                } else {
                    log(`🍷 [${name}] 사용! HP +${healAmt}`);
                }
                playAnim(targetId, 'anim-bounce');
                used = true;
                break;
            }
            case "damage":
                log(`🧴 [${name}] 투척! 적에게 ${data.val} 피해`);
                takeDamage(target, data.val);
                used = true;
                break;
                // ★ [추가] 탈출 아이템 효과 처리
            case "escape":
                log(`📱 [${name}] 사용! 해결사가 도착하여 당신을 호위합니다.`);
                used = true;
                
                // 잠시 후 복귀 처리
                setTimeout(() => {
                    showPopup("🚁 탈출 성공", "해결사의 도움으로 안전하게 복귀했습니다.", [
                        {
                            txt: "사무소로",
                            func: () => {
                                closePopup();
                                // 전투 중이었다면 전투 임시 카드/상태 정리
                                cleanupCombatTempCards();
                                if (game.state === 'battle') {
                                    game.state = 'hub';
                                    game.turnOwner = "none";
                                    game.lastTurnOwner = "none";
                                    game.isBossBattle = false;
                                    const enemyWrapper = document.getElementById('dungeon-enemies');
                                    if (enemyWrapper) enemyWrapper.innerHTML = "";
                                    enemies = [];
                                    toggleBattleUI(false);
                                }
                                renderHub();
                            }
                        }
                    ]);
                }, 800);
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
        player.inventory.splice(index, 1); // 소모품 배열에서 제거
        updateInventoryUI();
        updateUI();
    }
}
/// [수정] 인벤토리 UI 그리기 (현재 탭에 맞는 리스트 출력)
function updateInventoryUI() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = "";
    ensureEquipmentFields(player);

    // 카운트 갱신
    document.getElementById('cnt-consume').innerText = `(${player.inventory.length}/${player.maxInventory})`;
    document.getElementById('cnt-equip').innerText = `(${player.equipmentBag.length})`;
    document.getElementById('cnt-relic').innerText = `(${player.relics.length})`;

    // 보여줄 배열 선택
    let targetArray =
        (currentInvTab === 'consume') ? player.inventory :
        (currentInvTab === 'equip') ? player.equipmentBag :
        player.relics;

    // 장비 탭일 때만 장착 슬롯 패널 표시
    const equipPanel = document.getElementById('inventory-equipment-panel');
    if (equipPanel) {
        equipPanel.style.display = (currentInvTab === 'equip') ? 'block' : 'none';
        if (currentInvTab === 'equip') renderEquipmentPanel();
    }

    if (targetArray.length === 0) {
        list.innerHTML = `<div style="grid-column: 1/-1; color:#777; margin-top:50px;">(비어있음)</div>`;
        return;
    }

    targetArray.forEach((name, idx) => {
        let data = ITEM_DATA[name];
        let el = document.createElement('div');
        el.className = `item-icon item-rank-${data.rank}`;
        el.id = `item-el-${idx}`; // 드래그용 ID

        // 유물은 금색 테두리 강조
        if (data.usage === "passive") {
            el.style.borderColor = "#f39c12";
            el.style.boxShadow = "0 0 5px rgba(243, 156, 18, 0.5)";
        }
        // 장비는 파란 테두리
        if (data.usage === "equip") {
            el.style.borderColor = "#3498db";
            el.style.boxShadow = "0 0 5px rgba(52, 152, 219, 0.35)";
        }

        el.innerHTML = `
            ${data.icon}
            <span class="tooltip">
                <b>${name}</b><br>
                <span style="font-size:0.8em; color:#aaa;">${
                    data.usage==="passive" ? "[유물/지속효과]" :
                    data.usage==="equip" ? "[장비]" :
                    "[소모품]"
                }</span><br>
                ${data.desc}
            </span>
            ${data.usage === "consume" ? `
            <div class="item-actions" id="item-actions-${idx}" style="display:none;">
                <button class="item-btn btn-confirm" onclick="confirmItemUse(event, ${idx})">사용</button>
            </div>` : ""}
            ${data.usage === "equip" ? `
            <div class="item-actions" id="item-actions-${idx}" style="display:none;">
                <button class="item-btn btn-confirm" onclick="confirmEquipItem(event, ${idx})">장착</button>
            </div>` : ""}
        `;

        // 클릭/드래그 이벤트 연결
        // 소모품: 사용 및 드래그 가능
        if (currentInvTab === 'consume') {
            el.onclick = (e) => toggleItemSelect(e, idx);
        }
        // 장비: 클릭 시 장착 메뉴
        else if (currentInvTab === 'equip') {
            el.onclick = (e) => toggleItemSelect(e, idx);
        }
        // 유물: 클릭 시 정보만 (사용 불가)
        else {
            el.onclick = () => log(`[${name}] 보유 중인 유물입니다.`);
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

function renderEquipmentPanel() {
    const panel = document.getElementById('inventory-equipment-panel');
    if (!panel) return;

    ensureEquipmentFields(player);

    panel.innerHTML = `
        <div class="equipment-title">🧰 장착 슬롯</div>
        <div class="equipment-grid" id="equipment-grid"></div>
        <div class="equipment-hint">슬롯을 클릭하면 장착을 해제합니다.</div>
    `;

    const grid = document.getElementById('equipment-grid');
    const order = ["head", "body", "legs", "leftHand", "rightHand", "accessory1", "accessory2"];

    order.forEach(slotKey => {
        const meta = EQUIP_SLOT_META[slotKey];
        const equippedName = player.equipment[slotKey];
        const equippedData = equippedName ? ITEM_DATA[equippedName] : null;
        const el = document.createElement('div');
        el.className = `equip-slot ${equippedName ? "filled" : "empty"}`;

        let itemIcon = "—";
        if (equippedData) itemIcon = equippedData.icon;

        const desc = (equippedData && equippedData.desc) ? equippedData.desc : "";
        const titleText = equippedName ? `${equippedName}\n${desc}` : `${meta.label} 슬롯`;

        el.innerHTML = `
            <div class="equip-slot-head">
                <span class="equip-slot-icon">${meta.icon}</span>
                <span class="equip-slot-label">${meta.label}</span>
            </div>
            <div class="equip-slot-item">
                <span class="equip-slot-item-icon">${itemIcon}</span>
                <span class="equip-slot-item-name">${equippedName || "(비어있음)"}</span>
            </div>
            ${equippedName ? `<div class="equip-slot-desc">${desc}</div>` : ""}
        `;
        el.title = titleText;

        el.onclick = () => openEquipSlotPicker(slotKey);

        grid.appendChild(el);
    });
}

function equipItemToSlot(slotKey, name) {
    ensureEquipmentFields(player);
    if (game.state === "battle" || game.state === "social") {
        showPopup("불가", "전투/대화 중에는 장비를 변경할 수 없습니다.", [{ txt: "확인", func: closePopup }]);
        return;
    }
    const data = ITEM_DATA[name];
    if (!data || data.usage !== "equip") return;

    const slots = data.equipSlots || [];
    if (!slots.includes(slotKey)) {
        showPopup("장착 불가", `[${name}]은(는) ${EQUIP_SLOT_META[slotKey]?.label || slotKey} 슬롯에 장착할 수 없습니다.`, [{ txt: "확인", func: closePopup }]);
        return;
    }

    const removeIdx = player.equipmentBag.indexOf(name);
    if (removeIdx < 0) return;

    player.equipmentBag.splice(removeIdx, 1);

    const old = player.equipment[slotKey];
    if (old) player.equipmentBag.push(old);
    player.equipment[slotKey] = name;

    if (old) removeEquipCardGrants(old);
    applyEquipCardGrants(name);

    recalcStats();
    updatePlayerAttribute();
    updateInventoryUI();
    updateUI();
    autoSave();
    closePopup();
}

function openEquipSlotPicker(slotKey) {
    ensureEquipmentFields(player);

    const meta = EQUIP_SLOT_META[slotKey] || { label: slotKey, icon: "🧰" };
    const current = player.equipment[slotKey];
    const currentData = current ? ITEM_DATA[current] : null;

    const candidates = (player.equipmentBag || []).filter(name => {
        const data = ITEM_DATA[name];
        if (!data || data.usage !== "equip") return false;
        const slots = data.equipSlots || [];
        return slots.includes(slotKey);
    });

    const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const escapeJs = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    let contentHTML = "";
    if (candidates.length === 0) {
        contentHTML = `<div style="color:#777; padding:10px;">(장착 가능한 장비가 없습니다)</div>`;
    } else {
        contentHTML = `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; padding:10px;">`;
        candidates.forEach(name => {
            const data = ITEM_DATA[name];
            contentHTML += `
                <button class="hub-card" onclick="equipItemToSlot('${escapeJs(slotKey)}','${escapeJs(name)}')" style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px; border:1px solid #555;">
                    <div class="item-icon item-rank-${data.rank}" style="pointer-events:none;">${escapeAttr(data.icon)}</div>
                    <div style="font-size:0.85em; font-weight:bold; color:#ddd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">${escapeAttr(name)}</div>
                    <div style="font-size:0.7em; color:#3498db;">장착</div>
                </button>
            `;
        });
        contentHTML += `</div>`;
    }

    const btns = [];
    if (current) {
        btns.push({
            txt: `해제 (${current})`,
            func: () => {
                unequipSlot(slotKey);
                closePopup();
            }
        });
    }
    btns.push({ txt: "닫기", func: closePopup });

    const currentText = current ? `<span style="color:#f1c40f">${escapeAttr(current)}</span>` : `<span style="color:#777">(비어있음)</span>`;
    const currentDesc = (currentData && currentData.desc) ? `<div style="margin-top:6px; font-size:0.9em; color:#cbd5e1;">${currentData.desc}</div>` : "";
    showPopup(
        `${meta.icon} ${meta.label}`,
        `현재 장착: ${currentText}${currentDesc}<br><br>장착할 장비를 선택하세요.`,
        btns,
        contentHTML
    );
}

function confirmEquipItem(e, idx) {
    e.stopPropagation();
    if (currentInvTab !== 'equip') return;
    equipItemFromBag(idx);
    document.querySelectorAll('.item-actions').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.item-icon').forEach(el => el.classList.remove('selected'));
}

function equipItemFromBag(idx) {
    ensureEquipmentFields(player);

    const name = player.equipmentBag[idx];
    const data = ITEM_DATA[name];
    if (!data || data.usage !== "equip") return;

    const slots = data.equipSlots || [];
    if (slots.length === 0) {
        showPopup("장착 불가", `[${name}]은(는) 장착 슬롯 정보가 없습니다.`, [{ txt: "확인", func: closePopup }]);
        return;
    }

    const equipTo = (slotKey) => {
        // idx가 stale일 수 있으므로 이름으로도 탐색
        let removeIdx = player.equipmentBag.indexOf(name);
        if (removeIdx >= 0) player.equipmentBag.splice(removeIdx, 1);

        const old = player.equipment[slotKey];
        if (old) player.equipmentBag.push(old);
        player.equipment[slotKey] = name;

        recalcStats();
        updatePlayerAttribute();
        updateInventoryUI();
        updateUI();
        autoSave();
        closePopup();
    };

    if (slots.length === 1) {
        equipTo(slots[0]);
        return;
    }

    const buttons = slots.map(slotKey => {
        const meta = EQUIP_SLOT_META[slotKey];
        const cur = player.equipment[slotKey];
        const curText = cur ? ` (현재: ${cur})` : "";
        return { txt: `${meta.icon} ${meta.label}${curText}`, func: () => equipTo(slotKey) };
    });
    buttons.push({ txt: "취소", func: closePopup });

    showPopup(
        "장착 위치 선택",
        `<b>[${name}]</b>을(를) 장착할 슬롯을 선택하세요.`,
        buttons
    );
}

function unequipSlot(slotKey) {
    ensureEquipmentFields(player);
    if (game.state === "battle" || game.state === "social") return;
    const old = player.equipment[slotKey];
    if (!old) return;

    player.equipment[slotKey] = null;
    player.equipmentBag.push(old);
    removeEquipCardGrants(old);

    recalcStats();
    updatePlayerAttribute();
    updateInventoryUI();
    updateUI();
    autoSave();
}

let pendingItemTargeting = null;
let pendingItemTargetingListenersAttached = false;

function ensureItemTargetingOverlay() {
    let overlay = document.getElementById('item-targeting-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'item-targeting-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.25)';
    overlay.style.backdropFilter = 'blur(2px)';
    overlay.style.display = 'none';
    overlay.style.zIndex = '1100';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.flexDirection = 'column';
    overlay.style.gap = '10px';
    // 대상 클릭은 아래 전투 화면(유닛)을 그대로 클릭하게 두고,
    // 클릭 이벤트는 문서 레벨에서 가로채서 처리합니다.
    overlay.style.pointerEvents = 'none';

    overlay.innerHTML = `
        <div style="background:#111a24; border:1px solid #3a4b5d; border-radius:12px; padding:12px 14px; text-align:center; color:#ddd; width:min(420px, 90%); pointer-events:none;">
            <div style="color:#f1c40f; font-weight:bold; margin-bottom:6px;">🎯 대상 지정</div>
            <div style="font-size:0.95em; color:#cbd5e1;">
                사용할 대상을 <b>클릭</b>하세요.
                <div style="margin-top:6px; font-size:0.85em; color:#94a3b8;">(적/플레이어)</div>
            </div>
        </div>
        <button class="small-btn" id="btn-cancel-item-targeting" style="background:#7f8c8d; pointer-events:auto;">취소</button>
    `;

    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector('#btn-cancel-item-targeting');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancelItemTargeting();
        });
    }

    return overlay;
}

function cancelItemTargeting() {
    pendingItemTargeting = null;
    detachItemTargetingListeners();
    const overlay = document.getElementById('item-targeting-overlay');
    if (overlay) overlay.style.display = 'none';
}

function beginItemTargeting(itemIdx) {
    if (game.state !== 'battle') return false;
    if (game.turnOwner !== 'player') {
        showPopup("불가", "전투 중 내 턴에만 사용할 수 있습니다.", [{ txt: "확인", func: closePopup }]);
        return false;
    }

    const name = player.inventory[itemIdx];
    const data = ITEM_DATA[name];
    if (!data || data.usage !== "consume") return false;

    pendingItemTargeting = { idx: itemIdx, name };

    const overlay = ensureItemTargetingOverlay();
    overlay.style.display = 'flex';
    attachItemTargetingListeners();
    return true;
}

function attachItemTargetingListeners() {
    if (pendingItemTargetingListenersAttached) return;
    pendingItemTargetingListenersAttached = true;

    document.addEventListener('click', onItemTargetingClickCapture, true);
    // 모바일: 클릭 대신 touchstart만 발생하는 경우가 있어 보조
    document.addEventListener('touchstart', onItemTargetingTouchCapture, { capture: true, passive: false });
}

function detachItemTargetingListeners() {
    if (!pendingItemTargetingListenersAttached) return;
    pendingItemTargetingListenersAttached = false;
    document.removeEventListener('click', onItemTargetingClickCapture, true);
    document.removeEventListener('touchstart', onItemTargetingTouchCapture, true);
}

function getFinalTargetsFromPointer(data, targetInfo) {
    const aliveEnemies = enemies.filter(en => en.hp > 0);

    let finalTargets = [];
    if (targetInfo) {
        if (data.targetType === 'all' || data.target === 'all') {
            finalTargets = aliveEnemies;
        }
        else if ((data.type && (data.type.includes("attack") || data.type === "social")) || data.target === "enemy") {
            if (targetInfo.type === 'specific' && targetInfo.unit !== player) {
                finalTargets = [targetInfo.unit];
            }
            else if (aliveEnemies.length === 1 && targetInfo.type === 'general') {
                finalTargets = [aliveEnemies[0]];
            }
        }
        else if (data.target === "self" || (!data.type?.includes("attack") && data.target !== "enemy")) {
            if (targetInfo.type === 'specific' && targetInfo.unit === player) finalTargets = [player];
            else if (targetInfo.type === 'general') finalTargets = [player];
        }
    }

    // 자동 타겟팅 (빈 공간 클릭 포함)
    if (finalTargets.length === 0) {
        if (data.targetType === 'all' || data.target === 'all') {
            finalTargets = aliveEnemies;
        } else if ((data.type && (data.type.includes("attack") || data.type === "social")) || data.target === "enemy") {
            if (aliveEnemies.length === 1) finalTargets = [aliveEnemies[0]];
        } else if (data.target === "self" || (!data.type?.includes("attack") && data.target !== "enemy")) {
            finalTargets = [player];
        }
    }

    return finalTargets;
}

function onItemTargetingClickCapture(e) {
    if (!pendingItemTargeting) return;
    if (e.target && e.target.id === 'btn-cancel-item-targeting') return;

    // 다른 UI가 같이 눌리지 않도록 캡처 단계에서 차단
    e.preventDefault();
    e.stopPropagation();

    const name = pendingItemTargeting.name;
    const data = ITEM_DATA[name];
    if (!data) {
        cancelItemTargeting();
        return;
    }

    const targetInfo = getTargetUnderMouse(e);
    const targets = getFinalTargetsFromPointer(data, targetInfo);
    if (targets.length === 0) return;

    const idx = pendingItemTargeting.idx;
    cancelItemTargeting();
    useItem(idx, targets[0]);
    updateUI();
    checkGameOver();
}

function onItemTargetingTouchCapture(e) {
    if (!pendingItemTargeting) return;
    if (e.target && e.target.id === 'btn-cancel-item-targeting') return;

    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    const name = pendingItemTargeting.name;
    const data = ITEM_DATA[name];
    if (!data) {
        cancelItemTargeting();
        return;
    }

    const targetInfo = getTargetUnderMouse(e);
    const targets = getFinalTargetsFromPointer(data, targetInfo);
    if (targets.length === 0) return;

    const idx = pendingItemTargeting.idx;
    cancelItemTargeting();
    useItem(idx, targets[0]);
    updateUI();
    checkGameOver();
}

// [수정] confirmItemUse (인자 전달 방식 수정)
function confirmItemUse(e, idx) {
    e.stopPropagation();
    // 현재 탭이 소모품일 때만 동작
    if (currentInvTab !== 'consume') return;

    let name = player.inventory[idx];
    let data = ITEM_DATA[name];

    // 전투 중이면: 인벤토리를 닫고, 드래그로 타겟 지정
    if (game.state === 'battle') {
        closeInventory();
        beginItemTargeting(idx);
        document.querySelectorAll('.item-actions').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.item-icon').forEach(el => el.classList.remove('selected'));
        return;
    }

    // 그 외 상태: 기존 즉시 사용
    let target = player;
    if (data.target === "enemy" && enemies.length > 0) target = enemies[0];
    useItem(idx, target);
    
    // 메뉴 닫기
    document.querySelectorAll('.item-actions').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.item-icon').forEach(el => el.classList.remove('selected'));
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
function renderExploration(forceReset = false) {
    game.state = 'exploration';
    switchScene('exploration');
// ★ [추가] 버튼/이동 잠금 해제
    game.inputLocked = false; 
    document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = false);
    
    // 던전 생성 로직 (우선순위 적용)
    if (!game.dungeonMap) {
        let dungeonConfig = null;

        // [0순위] 커스텀 던전(도시 특수/화이트 큐브 등)
        if (game.scenario && game.scenario.customDungeon) {
            dungeonConfig = game.scenario.customDungeon;
        }
        // [1순위] 현재 활성화된 시나리오의 던전 설정
        else if (game.activeScenarioId && SCENARIOS[game.activeScenarioId]) {
            dungeonConfig = SCENARIOS[game.activeScenarioId].dungeon;
        }
        
        // [2순위] 순찰(Patrol) 중이라면 해당 구역의 던전 설정
        else if (game.scenario && game.scenario.isPatrol && game.scenario.districtKey) {
            let dist = DISTRICTS[game.scenario.districtKey];
            if (dist && dist.dungeon) {
                dungeonConfig = dist.dungeon;
            }
        }

        // [3순위] 설정이 없으면 기본값 (랜덤 생성)
        if (!dungeonConfig) {
            dungeonConfig = { 
                width: 5, height: 5, roomCount: 10, 
                data: { "battle": 4, "event": 2, "treasure": 1 } 
            };
        }

        if (dungeonConfig && typeof dungeonConfig === 'object') {
            dungeonConfig = {
                ...dungeonConfig,
                data: dungeonConfig.data ? { ...dungeonConfig.data } : dungeonConfig.data
            };
        }

        if (game.scenario && game.scenario.isActive === false) {
            dungeonConfig.noBoss = true;
        }
        
        // 던전 생성 실행
        DungeonSystem.generateDungeon(dungeonConfig);
        game.dungeonMap = true; // 생성 완료 플래그
    }
    // 기존 던전이 있다면 시야/패럴럭스 위치를 현재 진행도로 갱신
    if (game.dungeonMap && typeof DungeonSystem.renderView === 'function') {
        DungeonSystem.renderView();
    }
    // 이번 탐사 렌더링 이후에는 리셋 플래그 해제
    game.shouldResetDungeon = false;

    // 플레이어 이미지 연결
    const playerEl = document.getElementById('dungeon-player');
    if (playerEl) {
        playerEl.src = player.img || "https://placehold.co/150x150/3498db/ffffff?text=Hero";
    }

    showExplorationView(); 
    updateUI();
    autoSave();
    log(`<span style="color:#aaa">--- [${game.scenario.location}] ---</span>`);
}

// 탐사/배틀 UI 토글 헬퍼
function showExplorationView() {
    document.querySelectorAll('.exploration-ui').forEach(el => {
        el.classList.remove('hidden');
        el.style.display = '';
    });
    document.querySelectorAll('.battle-ui').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
}
function showBattleView() {
    document.querySelectorAll('.exploration-ui').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    document.querySelectorAll('.battle-ui').forEach(el => {
        el.classList.remove('hidden');
        el.style.display = '';
    });
    const moveControls = document.querySelector('.move-controls');
    if (moveControls) moveControls.style.display = 'none';
}
// 모드 전환 헬퍼 (true: 전투모드, false: 탐사모드)
function toggleBattleUI(isBattle) {
    const moveControls = document.querySelector('.move-controls');
    const dungeonActions = document.getElementById('dungeon-actions');
    const battleUI = document.querySelectorAll('.battle-ui');
    const minimapBtn = document.getElementById('btn-minimap'); // 지도 버튼 (가정)
    const minimapOverlay = document.getElementById('minimap-overlay');
    const minimapInline = document.getElementById('minimap-inline');
    const DS = typeof DungeonSystem !== 'undefined' ? DungeonSystem : null;

    if (isBattle) {
        // [전투 진입]
        if (DS) {
            DS.minimapOverlayWasOpen = minimapOverlay ? !minimapOverlay.classList.contains('hidden') : false;
            DS.minimapInlineWasOpen = minimapInline ? !minimapInline.classList.contains('hidden') : false;
        }
        moveControls.style.display = 'none';   // 이동 키 숨김
        if(dungeonActions) dungeonActions.style.display = 'none'; // 조사 버튼 등 숨김
        if(minimapBtn) minimapBtn.style.display = 'none'; // 전투 중 지도 금지
        if (minimapOverlay) minimapOverlay.classList.add('hidden'); // 큰 지도 자동 닫기
        if (minimapInline) minimapInline.classList.add('hidden');   // 상시 미니맵 닫기

        // 전투 UI 보이기 (카드, 턴 순서 등)
        battleUI.forEach(el => {
            el.classList.remove('hidden');
            el.style.display = '';
        });

       

    } else {
        // [탐사 복귀]
        moveControls.style.display = 'flex';   // 이동 키 복구
        if(dungeonActions) dungeonActions.style.display = 'grid';
        if(minimapBtn) {
            minimapBtn.style.display = 'block'; // 버튼만 복구 (지도는 닫힌 상태 유지)
            minimapBtn.classList.remove('hidden'); // 상시 미니맵이 숨겼던 클래스도 제거
        }
        if (DS) {
            if (DS.minimapOverlayWasOpen && minimapOverlay) {
                minimapOverlay.classList.remove('hidden');
                DS.renderMinimap();
            }
            if (DS.minimapInlineWasOpen && minimapInline) {
                minimapInline.classList.remove('hidden');
                DS.renderMinimap('minimap-inline-grid', 22);
                if (minimapBtn) minimapBtn.classList.add('hidden');
            }
            DS.minimapOverlayWasOpen = false;
            DS.minimapInlineWasOpen = false;
        }

        // 전투 UI 숨김
        battleUI.forEach(el => {
            el.classList.add('hidden');
            el.style.display = 'none';
        });

      
    }
}
/* [game.js] confirmRetreat 함수 수정 (탈출 제약 적용) */
function confirmRetreat() {
    const DS = typeof DungeonSystem !== 'undefined' ? DungeonSystem : null;

    // [도시 모드] 언제든 전역 지도로 복귀
    if (DS && DS.isCity) {
        showPopup("🏙️ 도시 지도 복귀", "지금 탐색을 종료하고 세주시 전역 지도로 돌아갑니다.", [
            { txt: "복귀", func: () => { closePopup(); resetDungeonState(); renderCityMap(); } },
            { txt: "취소", func: closePopup }
        ]);
        return;
    }

    // 현재 방 정보 확인
    let currentRoom = DungeonSystem.map[DungeonSystem.currentPos.y][DungeonSystem.currentPos.x];
    let isStartRoom = (currentRoom.type === 'start');

    // [CASE 1] 시작 방(입구)에 있을 때 -> 자유롭게 탈출 가능
    if (isStartRoom) {
        showPopup("🏠 복귀 확인", "던전을 떠나시겠습니까?<br>(입구에서는 안전하게 나갈 수 있습니다)", [
            { txt: "돌아가기", func: () => { closePopup(); handleDungeonExit(); } },
            { txt: "취소", func: closePopup }
        ]);
        return;
    }

    // [CASE 2] 던전 깊은 곳일 때 -> 아이템 체크
    let itemIdx = player.inventory.indexOf("해결사의 연락처");
    
    if (itemIdx !== -1) {
        // 아이템이 있다면 사용 권유
        showPopup("📞 긴급 탈출", "이곳에서 나가려면 해결사를 불러야 합니다.<br><b>[해결사의 연락처]</b>를 사용하시겠습니까?", [
            { 
                txt: "사용하기 (탈출)", 
                func: () => { 
                    closePopup();
                    // 아이템 사용 함수 호출 (여기서 소모 및 탈출 처리)
                    useItem(itemIdx, player);
                }
            },
            { txt: "취소", func: closePopup }
        ]);
    } else {
        // 아이템도 없다면 탈출 불가
        showPopup("🚫 탈출 불가", "이곳에서는 나갈 수 없습니다.<br><br><b>던전 입구</b>로 돌아가거나,<br><b>[해결사의 연락처]</b> 아이템이 필요합니다.", [
            { txt: "확인", func: closePopup }
        ]);
    }
}

/* 던전 탈출 처리: 도시 입구 복귀 우선 */
function handleDungeonExit() {
    // 도시 던전에서 돌아올 때: 도시 구역/스팟으로 복귀
    if (game.scenario && game.scenario.returnToCity) {
        const { areaId, spotId } = game.scenario.returnToCity;
        resetDungeonState();
        renderCityMap();
        // 바로 해당 도시 구역을 열고 스팟을 현재 위치로 설정
        if (areaId) {
            // 전역 지도 -> 내부 도시 구역 탐사 모드로 전환
            startCityExploration(areaId, spotId);
        }
        return;
    }

    // 기본: 사무소로 복귀
    resetDungeonState();
    renderHub();
}
/* [game.js] exploreAction 수정 (애니메이션 및 심리스 전투 연출) */
function exploreAction(action) {
    if (game.inputLocked) return;
    const logBox = document.getElementById('shared-log');
    const pArea = document.getElementById('player-char'); // 통합 무대의 플레이어 카드
    const bg = document.getElementById('expl-bg');
    let scData = SCENARIOS[game.scenario.id];

    // --- [1] 조사하기 (전투 발생 가능) ---
   if (action === 'investigate') {
        game.inputLocked = true;
        document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = true);
        
        let roll = Math.random();
        
        // 1. 전투 발생 (30%)
        if (roll < 0.3) { 
            // 적 키 선택
            let enemyKeys = Object.keys(ENEMY_DATA).filter(k => !k.startsWith("boss_"));
            let key = enemyKeys[Math.floor(Math.random() * enemyKeys.length)];
            let count = (Math.random() < 0.5) ? 2 : 1; 

            // [핵심] 실제 적 데이터 미리 생성
            enemies = [];
            for(let i=0; i<count; i++) {
                // (만약 적 종류를 섞고 싶다면 key를 다시 뽑으면 됨)
                enemies.push(createEnemyData(key, i));
            }

            logBox.innerHTML = `<span style='color:#e74c3c; font-weight:bold;'>⚠️ 적 발견! 전투 태세!</span>`;
            
            // [핵심] 프리뷰 모드로 렌더링 (HP바 숨김)
            const eArea = document.getElementById('dungeon-enemies');
            eArea.classList.add('preview-mode'); // CSS로 HP바 숨김
            
            renderEnemies(); // 빈 div 생성
            updateUI();      // 이미지 채우기

            // 솟아오르는 애니메이션 적용
            document.querySelectorAll('.enemy-unit').forEach(el => {
                el.classList.add('anim-popup');
            });

            // 플레이어 깜짝 놀람
            pArea.classList.add('anim-walk');
            
            // 1초 뒤 자연스럽게 전투 시작 (Seamless)
            setTimeout(() => { 
                pArea.classList.remove('anim-walk');
                game.inputLocked = false; 
                
                // startBattle에 '이미 적이 있다(true)'는 플래그 전달
                startBattle(false, null, true); 
            }, 1000);
        }
        // 2. 소셜 발생 (20%) - 동일한 Pop-up 연출
        else if (roll < 0.5) { 
            let keys = Object.keys(NPC_DATA);
            let npcKey = keys[Math.floor(Math.random() * keys.length)];
            let npcData = NPC_DATA[npcKey];

            logBox.innerHTML = `<span style='color:#3498db'>누군가 다가옵니다. 대화가 가능해 보입니다.</span>`;
            
            // 적 데이터 미리 생성 후 프리뷰 렌더링
            enemies = [];
            let npc = createNpcEnemyData(npcKey, 0);
            if (npc) enemies.push(npc);

            const eArea = document.getElementById('dungeon-enemies');
            if (eArea) {
                eArea.classList.add('preview-mode'); 
                renderEnemies(); 
                updateUI();      

                document.querySelectorAll('.enemy-unit').forEach(el => {
                    el.classList.add('anim-popup');
                });
            }

            setTimeout(() => { 
                game.inputLocked = false; 
                startSocialBattle(npcKey, true); 
            }, 1000);
        } 
        // 3. 랜덤 이벤트 / 파밍
        else {
            if(roll < 0.75) {
                logBox.innerHTML = "무언가 흥미로운 상황입니다...";
                setTimeout(() => { game.inputLocked = false; triggerRandomEvent(); }, 600);
            } else {
                setTimeout(() => {
                    game.inputLocked = false;
                    if (scData && scData.clueEvents && game.scenario && game.scenario.isActive && !game.scenario.isPatrol) {
                        let evt = scData.clueEvents[Math.floor(Math.random() * scData.clueEvents.length)];
                        game.scenario.clues = Math.min(100, game.scenario.clues + evt.gain);
                        game.doom = Math.min(100, game.doom + 5);
                        logBox.innerHTML = `<span style='color:#f1c40f'>🔍 단서 발견!</span><br>${evt.text}`;
                    } else {
                        let foundItem = null;
                        if (Math.random() < 0.4) { foundItem = getRandomItem(null, { categories: ["general"] }); addItem(foundItem); }
                        game.doom = Math.min(100, game.doom + 2);
                        let msg = foundItem ? `주변을 뒤져 <span style='color:#2ecc71'>[${foundItem}]</span>을(를) 발견했습니다!` : "주변을 샅샅이 뒤져보았습니다. 별다른 특이사항은 없습니다.";
                        logBox.innerHTML = `${msg}`;
                    }
                    renderExploration();
                }, 600);
            }
        }
    }
    // --- [2] 이동하기 (Move) ---
    else if (action === 'move') {
        game.inputLocked = true;
        
        // [연출] 걷는 애니메이션 + 배경 줌 효과
        pArea.classList.add('anim-walk');
        bg.classList.add('anim-bg-move');
        logBox.innerHTML = "이동 중...";

        setTimeout(() => {
            game.inputLocked = false;
            pArea.classList.remove('anim-walk');
            bg.classList.remove('anim-bg-move');

            if (scData && scData.locations) {
                let nextLoc = scData.locations[Math.floor(Math.random() * scData.locations.length)];
                while(nextLoc === game.scenario.location && scData.locations.length > 1) {
                    nextLoc = scData.locations[Math.floor(Math.random() * scData.locations.length)];
                }
                game.scenario.location = nextLoc;
                logBox.innerHTML = `[${nextLoc}] 구역에 도착했습니다.`;
            } else {
                logBox.innerHTML = "다른 골목으로 이동했습니다.";
            }
            
            renderExploration();
        }, 1000); // 1초간 이동 연출
    }
    // --- [3] 휴식 ---
    else if (action === 'rest') {
        game.inputLocked = true;
        logBox.innerHTML = "잠시 휴식을 취합니다...";
        
        setTimeout(() => {
            game.inputLocked = false;
            game.doom = Math.min(100, game.doom + 10);
            
            let hpHeal = 5; let spHeal = 3;
            player.hp = Math.min(player.maxHp, player.hp + hpHeal);
            player.sp = Math.min(player.maxSp, player.sp + spHeal);
            
            logBox.innerHTML = `<span style='color:#2ecc71'>체력을 회복했습니다. (+${hpHeal})</span>`;
            renderExploration();
        }, 800);
    }
}
/* [수정] 전투 시작 함수 (턴 기록 초기화 + 프리뷰 유지) */
/* [game.js] startBattle 함수 수정 (안정성 강화) */
function startBattle(isBoss = false, enemyKeys = null, preserveEnemies = false) {
    if (typeof stopMove === 'function') stopMove();
    // [★수정] 전투 시작 시 왼쪽 보기 클래스 제거 (정면 보기)
    const pImg = document.getElementById('dungeon-player');
    if (pImg) {
        pImg.classList.remove('facing-left');
        pImg.style.transform = ""; // 혹시 남아있을 인라인 스타일 제거
    }
    // 2. 전투 상태 설정
    game.state = "battle"; 
    game.totalTurns = 0; 
    game.isBossBattle = isBoss;
    game.turnOwner = "none";     
    game.lastTurnOwner = "none"; 
    game.surrenderOffered = false;

    // 3. 플레이어 상태 초기화
    // (덱이 비어있으면 기본 덱으로 복구하는 안전장치 추가)
    if (!player.deck || player.deck.length === 0) {
        player.deck = [...JOB_DATA[player.job].starterDeck];
    }
    player.drawPile = [...player.deck]; 
    shuffle(player.drawPile);
    player.discardPile = []; 
    player.exhaustPile = []; 
    player.hand = []; 
    player.buffs = {}; 
    migrateThornsFromBuff(player);
    ensureThornsField(player);
    player.thorns = 0;
    player.block = 0; 
    player.ag = 0; // 행동 게이지 초기화
    player.combatTempCards = []; // 전투 중 상태이상 카드 추적 초기화
    ensureCardSystems(player);
    player.handCostOverride = [];
    player.powers = {};
    game.combatCardGrowth = {}; // 전투 중 성장(이번 전투 한정)
    game.innateDrawn = false;

    // 4. UI 모드 전환 (이동 버튼 숨김, 전투 UI 표시)
    toggleBattleUI(true);
    switchScene('battle'); // 탐사 화면 재사용
    showBattleView();      

    // 5. 적 생성 로직
    if (!preserveEnemies) {
        enemies = []; // 적 목록 초기화

        if (isBoss) {
            let scId = game.scenario ? game.scenario.id : null;
            let bossId = (scId && SCENARIOS[scId]) ? SCENARIOS[scId].boss : "boss_gang_leader";
            let boss = createEnemyData(bossId, 0);
            if (boss) {
                migrateThornsFromBuff(boss);
                ensureThornsField(boss);
                boss.thorns = 0;
                enemies.push(boss);
                log(`⚠️ <b>${boss.name}</b> 출현! 목숨을 걸어라!`);
            }
        } else {
            // 랜덤 적 생성
            let picked = [];
            if (Array.isArray(enemyKeys) && enemyKeys.length > 0) picked = enemyKeys;
            else if (typeof enemyKeys === 'string') picked = [enemyKeys];
              else {
                  let count = (Math.random() < 0.5) ? 2 : 1; 
                  const pool = getCurrentEnemyPool() || Object.keys(ENEMY_DATA).filter(k => !k.startsWith("boss_"));
                  const filteredPool = pool.filter(k => ENEMY_DATA[k] && !k.startsWith("boss_"));
                  const finalPool = (filteredPool.length > 0) ? filteredPool : Object.keys(ENEMY_DATA).filter(k => !k.startsWith("boss_"));
                  for (let i = 0; i < count; i++) picked.push(finalPool[Math.floor(Math.random() * finalPool.length)]);
              }
            
            picked.forEach((key, idx) => {
                let enemy = createEnemyData(key, idx);
                if (enemy) {
                    migrateThornsFromBuff(enemy);
                    ensureThornsField(enemy);
                    enemy.thorns = 0;
                    enemies.push(enemy);
                }
            });
        }
    }

    // 6. 적 화면 렌더링 (즉시 실행)
    seedEnemyIntents(true);
    renderEnemies();

    // 프리뷰 모드 해제 (애니메이션 효과를 위해 약간 딜레이 줄 수 있으나, 안전을 위해 즉시 해제)
    const eArea = document.getElementById('dungeon-enemies');
    if (eArea) eArea.classList.remove('preview-mode');

    // 탐사 -> 전투 전환 시 등장 애니메이션 (솟구침)
    setTimeout(() => {
        document.querySelectorAll('.enemy-unit').forEach(el => {
            el.classList.remove('anim-popup'); // 리셋
            void el.offsetWidth;               // 강제 리플로우
            el.classList.add('anim-popup');
        });
    }, 10);

    // 7. UI 전체 갱신 (적 체력바, 플레이어 정보 등)
    updateUI();
    
    // 8. 핸드 렌더링 (빈 상태로 시작)
    renderHand();

    // 9. 전투 체크포인트 저장 및 턴 시작
    createBattleCheckpoint(); 
    autoSave(); 
    
    // [핵심] 턴 시뮬레이션 시작
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

// [★추가] 전투 종료 시 상태이상 및 방어도 초기화
    player.buffs = {};
    migrateThornsFromBuff(player);
    ensureThornsField(player);
    player.thorns = 0;
    player.block = 0;
    enemies.forEach(e => { e.buffs = {}; migrateThornsFromBuff(e); ensureThornsField(e); e.thorns = 0; e.block = 0; });
    cleanupCombatTempCards(); // 전투 중 상태이상 카드 제거
// ★ [추가] 속성 부여 버프도 즉시 초기화
    player.attrBuff = { types: [], turns: 0 };
    updatePlayerAttribute(); // 속성 상태 갱신 (UI 반영)
    // 전투 종료 공통 처리: 적 초기화 및 전투 플래그 해제
    const wasBoss = game.isBossBattle;
    const enemyWrapper = document.getElementById('dungeon-enemies');
    if (enemyWrapper) enemyWrapper.innerHTML = "";
    enemies = [];
    game.turnOwner = "none";
    game.lastTurnOwner = "none";
    player.ag = 0;

    if (wasBoss) {
        // [수정] 보스전 승리 -> 결과 정산 화면으로 이동
        game.state = 'result';
        renderResultScreen();
    } 
    else if (game.scenario && game.scenario.isPatrol) {
       game.state = 'exploration';
        player.gold += 100; // 순찰 보상
        // 적 유닛 제거
   document.getElementById('dungeon-enemies').innerHTML = "";
   
   // UI 복구
    toggleBattleUI(false); 
    showExplorationView();
    updateUI();
    
    // 자동 저장
    autoSave();
    }
    else {
        // 일반 시나리오 전투 -> 탐사 화면 복귀
        let clueGain = 10;
        game.scenario.clues = Math.min(100, game.scenario.clues + clueGain);
        game.state = 'exploration';
        toggleBattleUI(false);
        renderExploration();
        showExplorationView();
        updateUI();
        autoSave(); // [추가] 결과 저장
        // 탐사 화면 텍스트 업데이트
        const logBox = document.getElementById('shared-log');
        if(logBox) {
            logBox.innerHTML = 
                `<span style='color:#2ecc71'>적들을 제압하고 무사히 복귀했습니다.</span><br>` +
                `<span style='color:#f1c40f'>단서를 일부 확보했습니다. (진척도 +${clueGain})</span>`;
        }
    }
    game.isBossBattle = false;
}

async function processTimeline() {
    // 전투/소셜이 아닐 때는 타임라인을 돌리지 않음 (승리/도망/복귀 등)
    if (!["battle", "social"].includes(game.state)) return;
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
/* [game.js] renderEnemies 함수 수정 (최종) */
function renderEnemies() {
    const wrapper = document.getElementById('dungeon-enemies');
    if (!wrapper) return; 
    
    wrapper.innerHTML = ""; // 초기화

    enemies.forEach(e => {
        let el = document.createElement('div');
        el.className = 'enemy-unit';
        el.id = `enemy-unit-${e.id}`; 
        
        // 이미지 주소 안전장치
        let imgSrc = e.img;
        if (!imgSrc || imgSrc === "") {
            imgSrc = "https://placehold.co/100x100/555/fff?text=Enemy";
        }
        
        // [핵심] 뼈대를 만들 때 이미지 태그를 반드시 포함 (타겟팅 인식용)
        el.innerHTML = `
            <div style="font-weight:bold; font-size:0.9em; margin-bottom:5px;">${e.name}</div>
            <img src="${imgSrc}" alt="${e.name}" class="char-img"
                 onerror="this.src='https://placehold.co/100x100/555/fff?text=No+Img';">
            <div class="hp-bar-bg"><div class="hp-bar-fill" style="width:100%"></div></div>
            <div style="font-size:0.8em;">HP: ${e.hp}/${e.maxHp}</div>
        `;
        
        wrapper.appendChild(el);
    });
}

/* [수정] 플레이어 행동 개시 (연속 턴 방어도 유지) */
function startPlayerTurnLogic() {
    ensureCardSystems(player);
    // 플레이어 턴 시작 시 적 의도 예고를 새로 설정
    seedEnemyIntents(true);
    // [NEW] 기절 체크
    if (player.isStunned) {
        log("😵 <b>기절 상태입니다! 아무것도 할 수 없습니다.</b>");
        showDamageText(player, "STUNNED...");
        
        // 상태 회복
        player.isStunned = false;
        player.isBroken = false; // 기절 풀리면 브레이크도 해제
        
        // 턴 강제 종료 (약간의 딜레이 후)
        setTimeout(() => {
            endPlayerTurn(); 
        }, 1000);
        
        updateUI();
        return; // 아래 로직(카드 뽑기 등) 실행 안 함
    }

    // [NEW] 브레이크 회복 (한 턴 무사히 넘기면 회복)
    if (player.isBroken) {
        log("🛡️ 자세를 바로잡았습니다.");
        player.isBroken = false;
    }
    // [핵심 변경] 직전 턴이 플레이어가 아니었을 때만 방어도 초기화
    // 즉, 적이 행동하고 내 차례가 되면 방어도가 사라지지만,
    // 내가 행동하고 또 바로 내 차례가 오면(속도 차이) 방어도가 유지됨.
    if (game.lastTurnOwner !== 'player') {
        player.block = 0; 
    } else {
        log("⚡ 연속 행동! 방어도가 유지됩니다.");
    }

    player.ap = 3;
    if (game.state === 'battle') triggerTurnStartPowers();
    else if (game.state === 'social') triggerSocialTurnStartPowers();

    // 선천성(innate): 전투 시작 첫 손패에 우선 포함
    if (game.state === 'battle' && !game.innateDrawn) {
        game.innateDrawn = true;
        const MAX_HAND_SIZE = 10;

        // drawPile에서 선천성 카드를 찾아 손으로 이동
        for (let i = player.drawPile.length - 1; i >= 0; i--) {
            if (player.hand.length >= MAX_HAND_SIZE) break;
            const cName = player.drawPile[i];
            const cData = CARD_DATA[cName];
            if (cData && cData.innate) {
                player.drawPile.splice(i, 1);
                player.hand.push(cName);
                player.handCostOverride.push(null);
                applyCardDrawEffect(cName);
            }
        }

        renderHand();
    }

    drawCards(5);
    if (game.state === 'battle') triggerAfterDrawPowers();
    else if (game.state === 'social') triggerSocialAfterDrawPowers();

   const endBtn = document.getElementById('end-turn-btn');
    if(endBtn) endBtn.disabled = false;
    // [수정] turn-info 요소가 사라졌으므로, 에러가 안 나게 체크합니다.
    const turnInfo = document.getElementById('turn-info');
    if (turnInfo) {
        turnInfo.innerText = `나의 턴 (AP: ${player.ap})`;
    }
   // ★ [수정] player-char 대신 dungeon-player 사용
    const pImg = document.getElementById('dungeon-player');
    if(pImg) pImg.classList.add('turn-active'); 
    
    document.querySelectorAll('.enemy-unit').forEach(e => e.classList.remove('turn-active'));
    updateTurnOrderList(); 
    // 1. 속성 버프 턴 차감
    if (player.attrBuff.turns > 0) {
        player.attrBuff.turns--;
        if (player.attrBuff.turns === 0) {
            player.attrBuff.type = "none";
            log("💨 속성 부여 효과가 사라졌습니다.");
        }
        updatePlayerAttribute(); // 갱신
    }
    
    // UI 업데이트 (내 속성 아이콘 표시)
    updateUI();
}

/* [수정] 플레이어 턴 종료 버튼 클릭 시 */
function endPlayerTurn() {
    document.getElementById('end-turn-btn').disabled = true;
    
    // 패 버리기
    if (player.hand.length > 0) { 
        const toDiscard = [];
        const toExhaust = [];
        player.hand.forEach(cName => {
            const cData = CARD_DATA[cName];
            if (cData && cData.volatile) toExhaust.push(cName);
            else toDiscard.push(cName);
        });
        if (toDiscard.length > 0) player.discardPile.push(...toDiscard);
        if (toExhaust.length > 0) {
            player.exhaustPile.push(...toExhaust);
            log(`🔥 휘발성 카드가 소멸되었습니다: ${toExhaust.map(n => `[${n}]`).join(", ")}`);
        }
        player.hand = [];
        if (player.handCostOverride) player.handCostOverride = [];
    }
    renderHand(); 

    const pImg = document.getElementById('dungeon-player');
    if(pImg) pImg.classList.remove('turn-active');
    
    // ★ 중요: 내 행동이 끝났으니 다시 타임라인을 돌립니다.
    // 만약 내 속도가 압도적이라 AG가 1000 이상 남았다면? processTimeline이 즉시 나를 다시 호출함 (연속 턴)
    processTimeline();
}

/* [game.js] startEnemyTurnLogic 함수 수정 (안전장치 추가) */
async function startEnemyTurnLogic(actor) {
    actor.block = 0; 
    actor.ap = actor.baseAp || 2; 
    
    let el = document.getElementById(`enemy-unit-${actor.id}`);
    if (!Array.isArray(actor.intentQueue) || actor.intentQueue.length === 0) {
        setEnemyIntentQueue(actor, actor.ap || actor.baseAp || 2);
        updateUI();
    }
    // 1. 기절(Stun) 체크
    if (actor.isStunned) {
        log(`😵 <b>${actor.name}</b>은(는) 기절하여 움직일 수 없습니다!`);
        
        let el = document.getElementById(`enemy-unit-${actor.id}`);
        if(el) {
            el.classList.remove('stunned'); // 기절 표시 제거
            el.classList.add('recovering'); // 회복 모션
            setTimeout(() => el.classList.remove('recovering'), 500);
        }

        // 상태 회복
        actor.isStunned = false; 
        actor.isBroken = false; 
        
        await sleep(1000);
        updateUI();
        processTimeline(); // 턴 패스
        return;
    }

    // 2. 브레이크 회복 (한 턴 동안 추가타 안 맞으면 회복)
    if (actor.isBroken) {
        log(`🛡️ <b>${actor.name}</b>이(가) 자세를 바로잡습니다.`);
        actor.isBroken = false;
        let el = document.getElementById(`enemy-unit-${actor.id}`);
        if(el) el.classList.remove('broken');
    }
    if(el) el.classList.add('turn-active');
    
    try {
        while (actor.ap > 0) {
            if (game.state === "social") {
                if (player.sp <= 0 || actor.hp <= 0 || actor.hp >= 100) break;
            } else {
                if (player.hp <= 0 || actor.hp <= 0) break;
            }

            await sleep(800);

            let cName = null;
            if (actor.intentQueue && actor.intentQueue.length > 0) {
                const intent = actor.intentQueue.shift();
                cName = intent.card;
            } else {
                cName = pickEnemyCardForIntent(actor);
            }
            let cData = CARD_DATA[cName];

            // [수정/보완] 카드 데이터가 없는 경우(비명 등 누락 시) 방어 로직
            if (!cData) {
                console.warn(`Missing card data: ${cName}. Defaulting to '타격'.`);
                cName = "타격";
                cData = CARD_DATA["타격"];
            }

            if (game.state === "battle" && cData.type === "social") cName = "타격"; 
            else if (game.state === "social" && cData.type !== "social") cName = "횡설수설"; 

            actor.ap--; 
            useCard(actor, player, cName); 
            if (actor.ap > 0 && actor.hp > 0 && (!actor.intentQueue || actor.intentQueue.length === 0)) {
                setEnemyIntentQueue(actor, actor.ap);
            }
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

/* [game.js] useCard 함수 수정 (변수명 오류 수정) */
function useCard(user, target, cardName) {
    const base = CARD_DATA[cardName];
    const data = getEffectiveCardData(cardName) || base;
    if (!data) return;
    let userId = (user === player) ? "player-char" : `enemy-unit-${user.id}`;
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;

    log(`🃏 [${cardName}] 사용!`);

    // [파워] 지속 효과 부여
    if (data.type === "power") {
        playAnim(userId, 'anim-bounce');
        applyPowerCard(user, cardName, data);
        updateUI();
        return;
    }

    // [소셜 파워] 지속 효과 부여
    if (data.type === "social" && data.subtype === "power") {
        playAnim(userId, 'anim-bounce');
        applySocialPowerCard(user, cardName, data);
        updateUI();
        return;
    }

    // AP 추가
    if (data.gainAp && user && typeof user.ap === 'number') {
        const v = Math.max(0, Number(data.gainAp || 0));
        if (v > 0) {
            user.ap += v;
            log(`⚡ AP +${v}`);
        }
    }

    // 카드 조작(가져오기/복사)
    if (user === player && (data.fetch || data.copy)) {
        const cfg = data.fetch || data.copy;
        const isCopy = !!data.copy;
        if (cfg && (cfg.from === 'draw' || cfg.from === 'discard')) {
            const src = (cfg.from === 'draw') ? player.drawPile : player.discardPile;
            const count = Math.max(1, Number(cfg.count || 1));
            const mode = cfg.mode || 'choose';

            if (!Array.isArray(src) || src.length === 0) {
                log("🗂️ 대상 카드 더미가 비어있습니다.");
            } else if (mode === 'random') {
                for (let i = 0; i < count; i++) {
                    if (src.length === 0) break;
                    const idx = Math.floor(Math.random() * src.length);
                    const picked = src[idx];
                    if (!isCopy) src.splice(idx, 1);
                    addCardToHand(picked);
                    log(`🧤 ${isCopy ? "복사" : "회수"}: [${picked}]`);
                }
                updateUI();
                renderHand();
            } else {
                showChooseCardFromPile(cfg.from, isCopy ? "복사할 카드를 선택" : "가져올 카드를 선택", (pickedName, pickedIndex) => {
                    if (!isCopy) {
                        const arr = (cfg.from === 'draw') ? player.drawPile : player.discardPile;
                        if (Array.isArray(arr) && pickedIndex >= 0 && pickedIndex < arr.length && arr[pickedIndex] === pickedName) {
                            arr.splice(pickedIndex, 1);
                        } else {
                            removeFirstCardFromPile(arr, pickedName);
                        }
                    }
                    addCardToHand(pickedName);
                    log(`🧤 ${isCopy ? "복사" : "회수"}: [${pickedName}]`);
                    updateUI();
                    renderHand();
                });
            }
        }
    }

    if (data.type === "social") {
        playAnim(userId, 'anim-bounce');
        if (data.dmg) {
            let finalDmg = data.dmg + getStat(user, 'socialAtk'); 
            takeDamage(target, finalDmg);
            // 상태이상(전투 중 임시 카드): 카드에 statusAdd가 명시된 경우만 추가
            if (game.state === 'battle' && user !== player && target === player && data.statusAdd) {
                addStatusCardToCombat(data.statusAdd.card, data.statusAdd.count || 1, data.statusAdd.destination || 'discard');
            }
        }
        if (data.heal) {
            if (user === player) {
                user.mental = Math.min(100, user.mental + data.heal);
                log(`🌿 의지 회복 +${data.heal}`);
                showDamageText(user, `💚+${data.heal}`);
            } else {
                user.hp = Math.min(100, user.hp + data.heal);
            }
            updateUI(); 
        }
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

        const addStatusIfNeeded = (who, statusAdd) => {
            if (!statusAdd) return;
            if (game.state !== 'battle') return;
            if (who !== player) return;
            addStatusCardToCombat(statusAdd.card, statusAdd.count || 1, statusAdd.destination || 'discard');
        };

        const addStatusToEnemyIfNeeded = (targetUnit, statusEnemyAdd) => {
            if (!statusEnemyAdd) return;
            if (game.state !== 'battle') return;
            if (!targetUnit || targetUnit === player) return;
            addStatusCardToEnemyDeck(targetUnit, statusEnemyAdd.card, statusEnemyAdd.count || 1);
        };

        const doAttackOnce = (atkTarget) => {
            if (!atkTarget) return 0;

            // 1. 공격 속성 결정 (공격 상성)
            let attackAttrs = [];
            if (data.attr) attackAttrs.push(data.attr);

            // 유저가 플레이어면 '공격 속성'만 추가 (무기/공격버프/공격형 장신구/유물 등)
            if (user === player) attackAttrs.push(...getAttackAttrs(player));
            else attackAttrs.push(...getAttackAttrs(user));

            // 공격 모션
            playAnim(userId, (user === player) ? 'anim-atk-p' : 'anim-atk-e');

            // 2. 방어 상성(RESIST) 판정: 발동 시 약점 브레이크를 막음
            const resisted = isResistTriggered(attackAttrs, atkTarget);

            // 3. 약점 공략 판정 (RESIST면 브레이크 불가)
            let isWeaknessHit = false;
            if (atkTarget.weakness && atkTarget.weakness !== "none") {
                if (!resisted && attackAttrs.includes(atkTarget.weakness)) {
                    isWeaknessHit = true;
                }
            }

            // 4. 브레이크/다운 시스템 로직
            if (isWeaknessHit) {
                // ★ [NEW] 약점 발견 및 등록 로직
                if (atkTarget !== player && atkTarget.enemyKey) {
                    if (!player.discoveredWeaknesses[atkTarget.enemyKey]) {
                        player.discoveredWeaknesses[atkTarget.enemyKey] = atkTarget.weakness;
                        log(`💡 <b>[${atkTarget.name}]</b>의 약점(${ATTR_ICONS[atkTarget.weakness]})을 파악했습니다!`);
                        updateUI();
                    }
                }

                if (atkTarget.isStunned) {
                    log(`😵 기절한 대상을 가격합니다!`);
                    showDamageText(atkTarget, "CRITICAL!", true);
                }
                else if (atkTarget.isBroken) {
                    atkTarget.isStunned = true;
                    atkTarget.block = 0;
                    atkTarget.ag = 0;

                    log(`😵 <b>${atkTarget.name}</b> 기절! (약점 공략 성공)`);

                    let atkTargetId = (atkTarget === player) ? "dungeon-player" : `enemy-unit-${atkTarget.id}`;
                    playAnim(atkTargetId, 'anim-hit');
                    showDamageText(atkTarget, "😵DOWN!", true);

                    if (atkTarget !== player) {
                        let el = document.getElementById(atkTargetId);
                        if (el) el.classList.add('stunned');
                    } else {
                        log("🚫 <b>당신은 기절했습니다! 다음 턴 행동 불가!</b>");
                    }
                }
                else {
                    atkTarget.isBroken = true;
                    log(`⚡ <b>${atkTarget.name}</b>의 자세가 무너졌습니다! (WEAK)`);
                    showDamageText(atkTarget, "⚡BREAK!");

                    if (atkTarget !== player) {
                        let el = document.getElementById(`enemy-unit-${atkTarget.id}`);
                        if (el) el.classList.add('broken');
                    } else {
                        log("⚠️ <b>당신의 자세가 무너졌습니다! (피해량 증가)</b>");
                    }
                }
            }

            // 5. 데미지 계산 (기존 로직 + 치명타 복구)
            let baseAtk = getStat(user, 'atk');
            let finalDmg = (data.dmg || 0) + baseAtk;

            // 약점/브레이크 시 1.5배
            if (isWeaknessHit || atkTarget.isBroken || atkTarget.isStunned) {
                finalDmg = Math.floor(finalDmg * 1.5);
            }

            // 치명타(Crit) 계산 로직
            let dexVal = getStat(user, 'spd');
            let critChance = 0.05 + (dexVal * 0.01); // 기본 5% + 민첩 보정
            if (user.lucky) critChance += 0.2;       // 행운 특성

            let isCrit = Math.random() < critChance;
            if (isCrit) finalDmg = Math.floor(finalDmg * 1.5);

            // 공격 실행 (방어 상성은 takeDamage에서 처리)
            const res = takeDamage(atkTarget, finalDmg, isCrit, attackAttrs, user, { isAttack: true });

            // 상태이상(전투 중 임시 카드): 카드에 statusAdd가 명시된 경우만 추가
            if (game.state === 'battle' && user !== player && atkTarget === player && data.statusAdd) {
                addStatusCardToCombat(data.statusAdd.card, data.statusAdd.count || 1, data.statusAdd.destination || 'discard');
            }

            // 플레이어가 적 덱에 상태이상을 섞는 카드
            if (user === player && atkTarget !== player) {
                addStatusToEnemyIfNeeded(atkTarget, data.statusEnemyAdd);
                addStatusToEnemyIfNeeded(atkTarget, data.statusEnemyAdd2);
            }

            return res?.dealt || 0;
        };

        if (data.type && data.type.includes("attack")) {
            const totalHits = Math.max(1, Number(data.multiHit || 1));
            const randomHits = Math.max(0, Number(data.randomHits || 0));
            let dealtSum = 0;

            if (randomHits > 0) {
                for (let i = 0; i < randomHits; i++) {
                    const alive = enemies.filter(e => e && e.hp > 0);
                    if (alive.length === 0) break;
                    const picked = alive[Math.floor(Math.random() * alive.length)];
                    dealtSum += doAttackOnce(picked);
                }
            } else {
                for (let i = 0; i < totalHits; i++) {
                    dealtSum += doAttackOnce(target);
                }
            }

            // 흡혈: 막히지 않은 피해만큼 회복
            if (data.lifesteal && user === player) {
                const ratio = Math.max(0, Number(data.lifesteal || 0));
                const healAmt = Math.floor(dealtSum * ratio);
                if (healAmt > 0) {
                    user.hp = Math.min(user.maxHp, user.hp + healAmt);
                    log(`🩸 흡혈 회복 +${healAmt}`);
                    showDamageText(user, `💚+${healAmt}`);
                }
            }

            // 플레이어가 자기 덱에 상태이상 섞는 카드
            addStatusIfNeeded(user, data.statusAdd);
            // 플레이어가 적 덱에 상태이상 섞는 카드
            if (target !== player) {
                addStatusToEnemyIfNeeded(target, data.statusEnemyAdd);
                addStatusToEnemyIfNeeded(target, data.statusEnemyAdd2);
            }
        } else {
            playAnim(userId, 'anim-bounce');
            addStatusIfNeeded(user, data.statusAdd);
            if (target !== player) {
                addStatusToEnemyIfNeeded(target, data.statusEnemyAdd);
                addStatusToEnemyIfNeeded(target, data.statusEnemyAdd2);
            }
        }
        
        if (data.special === "cure_anger") {
            if (target.buffs["분노"]) { delete target.buffs["분노"]; log("😌 상대가 분노를 가라앉혔습니다."); }
            if (target.buffs["우울"]) { delete target.buffs["우울"]; log("😐 상대가 평정심을 찾았습니다."); }
        }
    }

    if (data.block) {
      let statType = (game.state === "social") ? 'socialDef' : 'def';
        let finalBlock = data.block + getStat(user, statType);
        user.block += finalBlock;
        let defenseText = (game.state === "social") ? "논리 방어" : "방어도";
        log(`🛡️ ${defenseText} +${finalBlock}`);
        updateUI(); 
    }

    if (data.buff) {
        let buffName = data.buff.name;
        let buffTarget = (data.target === "self" || ["강화","건강","쾌속","활력","가시"].includes(buffName)) ? user : target;
        applyBuff(buffTarget, buffName, data.buff.val);
    }
    if (Array.isArray(data.buffs)) {
        data.buffs.forEach(b => {
            if (!b || !b.name) return;
            let buffTarget = (data.target === "self" || ["강화","건강","쾌속","활력","가시"].includes(b.name)) ? user : target;
            applyBuff(buffTarget, b.name, b.val);
        });
    }
    
    if (data.draw && user === player) {
        drawCards(data.draw);
        log(`🃏 카드를 ${data.draw}장 뽑았습니다.`);
    }

    // 사용 시 자기 복제(버린 카드에 추가)
    if (user === player && data.selfDuplicateToDiscard) {
        const cnt = Math.max(0, Number(data.selfDuplicateToDiscard || 0));
        for (let i = 0; i < cnt; i++) player.discardPile.push(cardName);
        if (cnt > 0) log(`🌀 [${cardName}] 카드가 ${cnt}장 복제되어 버린 카드에 추가되었습니다.`);
    }

    // 성장(전투/영구)
    if (user === player && data.growOnUse) {
        const g = data.growOnUse;
        const scope = g.scope || "combat";
        const incDmg = Number(g.dmg || 0);
        const incBlock = Number(g.block || 0);

        const applyGrowth = (store) => {
            if (!store[cardName]) store[cardName] = {};
            if (Number.isFinite(incDmg) && incDmg !== 0) store[cardName].dmg = Number(store[cardName].dmg || 0) + incDmg;
            if (Number.isFinite(incBlock) && incBlock !== 0) store[cardName].block = Number(store[cardName].block || 0) + incBlock;
        };

        if (scope === "permanent") {
            ensureCardSystems(player);
            applyGrowth(player.permanentCardGrowth);
            log(`📈 [${cardName}] 영구 성장!`);
            autoSave();
        } else {
            if (!game.combatCardGrowth) game.combatCardGrowth = {};
            applyGrowth(game.combatCardGrowth);
            log(`📈 [${cardName}] 전투 중 성장!`);
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

    // 3. 화면에 추가 (깜빡임 없이)
    const wrapper = document.getElementById('dungeon-enemies');
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
function takeDamage(target, dmg, isCrit = false, attackAttrs = null, source = null, meta = null) {
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;
    const rawDmg = dmg;
    let blocked = 0;

    // 0. 방어 상성(저항) 적용: 공격 속성과 방어 속성이 겹치면 피해 감소
    if (game.state === "battle" && dmg > 0 && Array.isArray(attackAttrs) && attackAttrs.length > 0) {
        const defAttrs = getDefenseAttrs(target);
        if (defAttrs && defAttrs.length > 0) {
            const hit = attackAttrs.find(a => defAttrs.includes(a));
            if (hit) {
                dmg = Math.max(0, Math.floor(dmg * 0.75));
                showDamageText(target, "🛡️RESIST");
            }
        }
    }
    
    // 1. 방어(멘탈 방어) 계산
    if (target.block > 0) {
        if (target.block >= dmg) {
            blocked = dmg;
            target.block -= dmg;
            dmg = 0; 
            showDamageText(target, "BLOCK");
        } else {
            blocked = target.block;
            dmg -= target.block;
            target.block = 0; 
        }
    }

    // 2. 실제 피해 적용 및 시각 효과
    const dealt = Math.max(0, dmg);
    if (dmg > 0) {
        let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;
        playAnim(targetId, 'anim-hit');
        
        if (game.state === "social") {
            // [변경] 소셜 모드: 'mental'(플레이어) 또는 'hp'(NPC)를 깎음
            if (target === player) {
                target.mental -= dmg;
                log(`💔 내 의지 손상 -${dmg}! (남은 벽: ${target.mental})`);
                showDamageText(target, `💔-${dmg}`);
            } else {
                target.hp -= dmg; // NPC는 hp를 의지으로 씀
                log(`🗣️ 적 의지 타격! -${dmg} (남은 벽: ${target.hp})`);
                showDamageText(target, `💢-${dmg}`);
            }
        } else {
          // [수정] 전투 데미지: 치명타 시 로그 및 텍스트 변경
            target.hp -= dmg;
            
            if (isCrit) {
                log(`⚡ <b>치명타 적중!</b> 💥${dmg} 피해! (HP: ${target.hp})`);
                showDamageText(target, `⚡CRIT! -${dmg}`, true); // true = 치명타 스타일 적용
            } else {
                log(`💥 체력 피해 -${dmg}! (HP: ${target.hp})`);
                showDamageText(target, `💥-${dmg}`, false);
            }
        }
    }
    
    // 2.5 가시/반사: 공격받으면 반격 (전투 전용)
    const isAttackHit = !!(meta && meta.isAttack);
    if (game.state === "battle" && source && target?.buffs && isAttackHit && !(meta && (meta.isThorns || meta.isReflect))) {
        // [가시] 방어도에 막혀도 고정 피해 반격 (원 피해가 0이 아닌 공격에만)
        if (rawDmg > 0 && (target.thorns || 0) > 0) {
            const th = Math.max(0, Number(target.thorns || 0));
            if (th > 0) {
                log(`🌵 [가시] 반격! 공격자에게 ${th} 피해`);
                takeDamage(source, th, false, null, null, { isThorns: true });
            }
        }

        // [반사] 막히지 않은 피해(실제 받은 피해)를 그대로 반격
        if (dealt > 0 && target.buffs["반사"]) {
            log(`🪞 [반사] 반격! 공격자에게 ${dealt} 피해`);
            takeDamage(source, dealt, false, null, null, { isReflect: true });
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
        } else {
            // 보스전 등에서 사망 처리가 누락되는 경우를 방지하기 위해 즉시 체크
            checkGameOver();
        }
    }
    // 적 또는 NPC가 쓰러졌다면 즉시 승리/패배 판정
    if (target !== player) {
        checkGameOver();
    }

    return { raw: rawDmg, blocked, dealt };
}
/* [수정] 승패 판정 로직 (전체 코드) */
function checkGameOver() {
// 0. 이미 게임오버 상태라면 중복 실행 방지
    if (game.state === "gameover") return true;
    // 승리 상태면 추가 진행 중단
    if (game.state === "win") return true;

    // 1. [물리적 사망] HP 0
    if (player.hp <= 0) { 
        const reviveItem = consumeReviveItem();
        if (reviveItem) {
            player.hp = Math.max(1, Math.floor(player.maxHp * 0.4));
            updateInventoryUI();
            updateUI();
            autoSave();
            showPopup("✨ 부활", `[${reviveItem}] 효과로 다시 일어났습니다.`, [
                { txt: "확인", func: closePopup }
            ]);
            return false;
        }
        game.state = "gameover"; // 상태 잠금
        showPopup("💀 사망", "체력이 다했습니다...<br>차가운 도시의 바닥에서 눈을 감습니다.", [
            {
                txt: "다시 하기 (초기화)", 
                func: () => {
                    // [핵심 수정] 세이브 파일을 지우고 새로고침해야 처음으로 돌아갑니다.
                    localStorage.removeItem('midnight_rpg_save'); 
                    location.reload(); 
                }
            }
        ]); 
        return true; 
    }
    
    // 2. [정신적 사망] SP 0
    if (player.sp <= 0) {
        game.state = "gameover"; // 상태 잠금
        showPopup("🤪 발광(Insanity)", "공포를 견디지 못하고 정신이 붕괴되었습니다.<br>당신은 어둠 속으로 사라집니다...", [
            {
                txt: "다시 하기 (초기화)", 
                func: () => {
                    // [핵심 수정] 세이브 파일을 지우고 새로고침
                    localStorage.removeItem('midnight_rpg_save'); 
                    location.reload(); 
                }
            }
        ]);
        return true;
    }
if (game.state === "social") {
        let npc = enemies[0];

        // 1. [승리] NPC의 의지이 0이 됨 -> 정보 획득
        if (npc.hp <= 0) { 
            game.winMsg = `<span style='color:#3498db'>🤝 설득 성공!</span><br>${npc.name}의 의지을 허물었습니다.`;
            endSocialBattle(true);
            return true;
        } 
        
        // 2. [패배] 내 의지이 0이 됨 -> 선택지 발생
        if (player.mental <= 0) {
            // 게임 오버가 아님! 선택지 팝업 호출
            showSocialLossPopup(npc.name);
            return true; // 턴 진행을 멈추기 위해 true 반환
        }
    }

    // 3. [일반 전투] 승리 판정 (적 전멸)
    else if (game.state === "battle") {
        // 모든 적의 HP가 0 이하인지 확인 (유효한 적만 판단)
        const aliveEnemies = enemies.filter(e => e && e.hp > 0);
        if (aliveEnemies.length > 0 && !game.surrenderOffered) {
            const allSurrenderable = aliveEnemies.every(isSurrenderableEnemy);
            const allLowHp = aliveEnemies.every(e => e.hp <= e.maxHp * 0.2);
            if (allSurrenderable && allLowHp) {
                game.surrenderOffered = true;
                showConfirm(
                    "🫱 항복 제의",
                    "상대가 무기를 내려놓고 항복을 제안합니다.<br>수락하시겠습니까?",
                    () => triggerSurrenderWin(),
                    closePopup,
                    "수락",
                    "거절"
                );
                return true;
            }
        }
        // 안전장치: enemies가 비어있거나 정의되지 않은 경우도 승리 처리
        if (!enemies || enemies.length === 0 || aliveEnemies.length === 0) {
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
                game.pendingLoot = getRandomItem(null, { categories: ["general"] }); 
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
        (내 의지 0 도달)
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
            <button class="action-btn" style="background:#7f8c8d" onclick="exitRestArea()">👣 떠나기</button>
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

// 휴식처 종료 후 원래 방(탐사 화면)으로 복귀
function exitRestArea() {
    closePopup();
    game.state = 'exploration';
    toggleBattleUI(false);
    showExplorationView();
    renderExploration();
    updateUI();
}
/* [game.js] renderShopScreen 함수 전체 교체 */
function renderShopScreen(shopType = "shop_black_market") {
    switchScene('event');
    
    // [핵심] 상점 전용 와이드 스타일 적용
    const container = document.getElementById('event-content-box');
    container.classList.add('shop-mode');

    // 1. 상점 설정
    let shopTitle = "상점";
    let shopDesc = "물건을 보고 가세요.";
    let poolRank = 1; 
    let cardCount = 3;
    let itemCount = 2;
    let itemCategories = null;
    
    if (shopType === "shop_black_market") {
        shopTitle = "💀 뒷골목 암시장";
        shopDesc = "출처는 묻지 마쇼. 싸게 넘길 테니.";
        poolRank = 1; 
        itemCategories = ["general"];
    } else if (shopType === "shop_pharmacy") {
        shopTitle = "💊 24시 드럭스토어";
        shopDesc = "회복약과 생필품이 있습니다.";
        poolRank = 1; 
        itemCategories = ["pharmacy"];
    } else if (shopType === "shop_high_end") {
        shopTitle = "💎 아라사카 부티크";
        shopDesc = "최고급 장비만을 취급합니다.";
        poolRank = 2; 
        itemCategories = ["general"];
    } else if (shopType === "shop_occult") {
        shopTitle = "🪔 도깨비 만물상";
        shopDesc = "눈을 속이지 않는 물건들만 모았습니다.";
        poolRank = 1;
        itemCount = 3;
        itemCategories = ["occult"];
    } else if (shopType === "shop_herbal") {
        shopTitle = "🌿 한의원 제생당";
        shopDesc = "몸과 기운을 다스리는 한방약을 판매합니다.";
        poolRank = 1;
        itemCount = 3;
        itemCategories = ["herbal"];
    } else if (shopType === "shop_clinic") {
        shopTitle = "🩺 힐링 클리닉 사일런스";
        shopDesc = "최상급 약품과 처방만 취급합니다.";
        poolRank = 2;
        itemCount = 3;
        itemCategories = ["pharmacy"];
    } else if (shopType === "shop_internet") {
        shopTitle = "📦 익명 배송 센터";
        shopDesc = "집에서 편하게 주문하세요. (배송비 포함)";
        poolRank = 1;
        itemCount = 3;
        itemCategories = ["general"];
    }

    // 2. 물품 생성
    // - 장비 전용 카드는 제외 (getRandomCardByRank에서 처리)
    // - 이미 보유한 장비는 상점에 나오지 않도록 제외
    let cardsForSale = [];
    for (let i = 0; i < cardCount; i++) {
        cardsForSale.push(getRandomCardByRank(poolRank + (Math.random() > 0.7 ? 1 : 0)));
    }

    let itemsForSale = [];
    let safety = 0;
    while (itemsForSale.length < itemCount && safety++ < 200) {
        const candidate = getRandomItem(null, {
            excludeOwnedEquip: true,
            excludeNames: new Set(itemsForSale),
            categories: itemCategories
        });
        if (!candidate) break;
        itemsForSale.push(candidate);
    }

    let removeCost = 200 + (player.deck.length * 10); 

    // 3. HTML 구조 생성 (3단 레이아웃 + 우하단 버튼)
    container.innerHTML = `
        <div class="shop-header-area">
            <div>
                <div class="event-title" style="margin:0; font-size:1.8em;">${shopTitle}</div>
                <div style="color:#aaa; font-size:0.9em; margin-top:5px;">${shopDesc}</div>
            </div>
        </div>

        <div class="shop-main-area">
            <div class="shop-col">
                <h3 class="shop-sec-title">🃏 기술 교본</h3>
                <div class="shop-items-grid" id="shop-cards"></div>
            </div>

            <div class="shop-col">
                <h3 class="shop-sec-title">🎒 장비 및 도구</h3>
                <div class="shop-items-grid" id="shop-items"></div>
            </div>

            <div class="shop-col">
                <h3 class="shop-sec-title">🛠️ 서비스</h3>
                <div class="shop-service-box" onclick="openCardRemoval(${removeCost})">
                    <div class="service-icon">🔥</div>
                    <div class="service-info">
                        <b>기술 망각</b>
                        <span style="font-size:0.8em; opacity:0.8;">덱에서 카드 제거</span>
                        <span class="shop-price-tag">${removeCost} G</span>
                    </div>
                </div>
            </div>
        </div>
<div class="shop-footer-area">
            <button class="action-btn" onclick="exitShop('${shopType}')" style="background:#7f8c8d; padding: 10px 30px; font-size:1.1em;">
                🚪 나가기
            </button>
        </div>
    `;

    // 4. 물품 렌더링 (기존 로직 + 스타일 연결)
    const cardContainer = document.getElementById('shop-cards');
    cardsForSale.forEach(cName => {
        let data = getEffectiveCardData(cName) || CARD_DATA[cName];
        let price = data.rank * 150 + Math.floor(Math.random()*50);
        if (shopType === "shop_high_end") price *= 2; 
        if (shopType === "shop_black_market") price = Math.floor(price * 0.8);
        if (shopType === "shop_occult") price = Math.floor(price * 1.2);
        if (shopType === "shop_herbal") price = Math.floor(price * 1.1);
        if (shopType === "shop_clinic") price = Math.floor(price * 2.0);
        if (shopType === "shop_internet") price = Math.floor(price * 1.1);
        const typeLabel = getCardTypeLabel(data);
        const groupLabel = getCardGroupLabel(data);

        let el = document.createElement('div');
        el.className = "shop-item";
        // 기존 카드 스타일 재사용하되 크기 조정
        el.innerHTML = `
            <div class="card" style="transform:scale(0.85); margin:0;">
                <div class="card-cost">${data.cost}</div>
                <div class="card-rank">${"★".repeat(data.rank)}</div>
                <div class="card-name">${cName}</div>
                ${(typeLabel || groupLabel) ? `<div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin-top:4px;">
                    ${typeLabel ? `<div class="card-group-badge">[${typeLabel}]</div>` : ""}
                    ${groupLabel ? `<div class="card-group-badge">[${groupLabel}]</div>` : ""}
                </div>` : ""}
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
        if (shopType === "shop_black_market") price = Math.floor(price * 0.7); 
        if (shopType === "shop_high_end") price = Math.floor(price * 1.5);
        if (shopType === "shop_occult") price = Math.floor(price * 1.2);
        if (shopType === "shop_herbal") price = Math.floor(price * 1.1);
        if (shopType === "shop_clinic") price = Math.floor(price * 2.0);
        if (shopType === "shop_internet") price = Math.floor(price * 1.1);

        let el = document.createElement('div');
        el.className = "shop-item";
        el.innerHTML = `
            <div class="item-icon item-rank-${data.rank}" style="width:60px; height:60px; font-size:1.5em; margin:0 auto;">
                ${data.icon}
            </div>
            <div class="shop-price">${price} G</div>
            <div style="font-size:0.8em; margin-top:5px; color:#ddd;">${iName}</div>
        `;
        el.onclick = () => buyShopItem(el, 'item', iName, price);
        itemContainer.appendChild(el);
    });
}
// [유틸] 카드가 들어갈 올바른 덱에 자동 분배 (배틀/소셜)
function addCardToAppropriateDeck(cardName) {
    const data = CARD_DATA[cardName] || {};
    const isSocial = data.type === "social";
    if (isSocial) {
        if (!Array.isArray(player.socialDeck)) player.socialDeck = [];
        player.socialDeck.push(cardName);
        return "소셜 덱";
    }
    if (!Array.isArray(player.deck)) player.deck = [];
    player.deck.push(cardName);
    return "전투 덱";
}

// [수정] buyShopItem: alert -> showPopup
function buyShopItem(el, type, name, cost) {
    if (el.classList.contains('sold-out')) return;
    
    // [수정] 잔액 부족 알림
    if (player.gold < cost) { 
        showPopup("잔액 부족", "소지금이 부족합니다.", [{txt: "확인", func: closePopup}]); 
        return; 
    }

    if (type === 'card') {
        player.gold -= cost;
        const deckLabel = addCardToAppropriateDeck(name);
        
        // [수정] 구매 완료 알림
        showPopup("구매 성공", `[${name}] 구매 완료!<br>${deckLabel}에 바로 추가되었습니다.`, [{txt: "확인", func: closePopup}]);
        
        el.classList.add('sold-out');
        el.style.opacity = 0.5;
        updateUI();
        autoSave();
    } 
    else {
        const onBuySuccess = () => {
            player.gold -= cost;
            // [수정] 구매 완료 알림
            showPopup("구매 성공", `[${name}] 구매 완료!`, [{txt: "확인", func: closePopup}]);
            
            el.classList.add('sold-out');
            el.style.opacity = 0.5;
            updateUI();
            autoSave();
        };

        let result = addItem(name, onBuySuccess);
        
        if (result === false) {
            let data = ITEM_DATA[name];
            // [수정] 중복 알림
            if (data.usage === 'passive' || data.usage === 'equip') {
                showPopup(
                    "중복 불가",
                    data.usage === 'equip' ? "이미 보유하고 있는 장비입니다." : "이미 보유하고 있는 유물입니다.",
                    [{txt: "확인", func: closePopup}]
                );
            }
        }
    }
}
// [수정] processCardRemoval: alert -> showPopup
function processCardRemoval(idx, cost) {
    if (player.deck.length <= 5) {
        showPopup("불가", "최소 5장의 카드는 남겨야 합니다.", [{txt: "확인", func: closePopup}]);
        return;
    }

    let removed = player.deck.splice(idx, 1)[0];
    player.gold -= cost;
    
    // 팝업 닫고 알림 (여기서 closePopup은 카드 선택 팝업을 닫는 용도)
    closePopup(); 
    
    // [수정] 제거 완료 알림
    setTimeout(() => {
        showPopup("제거 완료", `[${removed}] 카드를 태워버렸습니다.`, [{txt: "확인", func: closePopup}]);
    }, 100);
    
    updateUI();
    autoSave();
    
    // 상점 리로드 (임시)
    const container = document.getElementById('event-content-box');
    if (container && container.classList.contains('shop-mode')) {
        // 현재 상점 화면이면 갱신 필요 (간단히 UI만 업데이트)
    }
}

/* [NEW] 실제 카드 삭제 로직 */
function processCardRemoval(idx, cost) {
    if (player.deck.length <= 5) {
        showPopup("최소 5장의 카드는 남겨야 합니다.");
        return;
    }

    let removed = player.deck.splice(idx, 1)[0];
    player.gold -= cost;
    
    closePopup();
    showPopup(`[${removed}] 카드를 태워버렸습니다.`);
    
    // 상점 화면 갱신 (돈 줄어든 거 반영)
    // 현재 상점 타입을 알기 어려우므로 간단히 다시 렌더링하거나 UI만 업데이트
    updateUI();
    autoSave();
    // 상점 화면을 유지하고 싶다면 renderShopScreen을 다시 호출해야 하는데 type을 기억해야 함.
    // 여기선 간단히 닫고 끝내거나, 편의상 암시장으로 리로드 (개선 포인트)
    renderShopScreen("shop_black_market"); // 임시: 무조건 암시장 리로드 (실제론 타입 변수 저장 필요)
}
/* [수정] 화면 전환 함수 (안전장치 추가) */
function switchScene(sceneName) {
    // [추가] 상점 모드 클래스 제거 (초기화)
    const eventBox = document.getElementById('event-content-box');
    if (eventBox) eventBox.classList.remove('shop-mode');
    // [핵심] 플레이어가 죽었거나 게임오버 상태면 화면 전환 금지 (캐릭터 생성 화면 제외)
    if (sceneName !== 'char-creation' && (game.state === "gameover" || player.hp <= 0 || player.sp <= 0)) {
        return; 
    }
    // 1. 모든 장면 숨기기
    const scenes = [
        'hub-scene', 'city-scene', 'exploration-scene', 
        'event-scene', 'deck-scene', 'storage-scene',
        'result-scene', 'story-scene',
        'char-creation-scene'
    ];

    scenes.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    document.getElementById('popup-layer').style.display = 'none';
    
    // 2. 선택된 장면만 보여주기
    if (sceneName === 'battle') sceneName = 'exploration';
    
    let targetId = sceneName + '-scene';
    let targetEl = document.getElementById(targetId);
    
    // [★수정] 대상 화면이 없는 경우(캐시 문제 등) 에러 방지
    if (targetEl) {
        targetEl.classList.remove('hidden');
        
        // [NEW] 인벤토리 버튼 제어 (캐릭터 생성 중에는 숨김)
        const invBtn = document.getElementById('btn-main-inventory');
        const statsBtn = document.getElementById('btn-player-stats');
        const btnVisible = sceneName !== 'char-creation';
        
        if (invBtn) invBtn.style.display = btnVisible ? 'inline-block' : 'none';
        
        const cardBtn = document.getElementById('btn-card-collection');
        if (cardBtn) cardBtn.style.display = btnVisible ? 'inline-block' : 'none';
        if (statsBtn) statsBtn.style.display = btnVisible ? 'inline-block' : 'none';

        updateUI();
    } else {
        console.error(`[Error] 화면을 찾을 수 없습니다: ${targetId}`);
        showPopup("화면 로딩 실패! 페이지를 새로고침 해주세요.\n(브라우저 캐시 문제일 수 있습니다.)");
        // 강제로 허브로 보내거나 재시도
        if(sceneName !== 'hub') switchScene('hub');
    }
}
/* [game.js] renderResultScreen 수정 */
function renderResultScreen() {
    game.state = "result"; 
    switchScene('result');
    
    const scId = (game.scenario && game.scenario.id) || game.activeScenarioId;
    let rewardData = (scId && SCENARIOS[scId]) ? SCENARIOS[scId].reward : { gold: 100, xp: 50, itemRank: 1 };
    
    let finalGold = rewardData.gold;
    let finalXp = rewardData.xp;
    if (player.lucky) finalGold = Math.floor(finalGold * 1.5);

    player.gold += finalGold;
    player.xp += finalXp;

    // [수정] 아이템 보상 처리
    let itemReward = "없음";
    const desiredRank = rewardData.itemRank;
    let newItem = getRandomItem(null, { rank: desiredRank, categories: ["general"] });

    if (newItem) {
        const itemData = ITEM_DATA[newItem];

        // 이미 보유한 장비/유물이 보상으로 나왔다면: 아이템 대신 돈 지급
        if (itemData && (itemData.usage === "equip" || itemData.usage === "passive") && hasItemAnywhere(newItem)) {
            const comp = getDuplicateItemCompensation(newItem);
            player.gold += comp;
            itemReward = `중복 보상 (+${comp} G)`;
        } else {
            addItem(newItem);
            itemReward = newItem;
        }
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

/* [game.js] getStat 함수 전면 수정 (6대 스탯 기반 상태이상 분리) */
function getStat(entity, type) {
    let val = 0;
    
    // [1] 플레이어: 스탯 기반 보정치 계산
    if (entity === player) {
        let rawVal = 0;
        const activeItems = getActivePassiveItemNames();
        const bonusStats = getTotalBonusStats(activeItems);
        
        switch (type) {
            case 'atk': rawVal = player.stats.str; break; // 물리공격 <- 근력
            case 'def': rawVal = player.stats.con; break; // 물리방어 <- 건강
            case 'spd': rawVal = player.stats.dex; break; // 속도 <- 민첩
            case 'socialAtk': rawVal = player.stats.cha; break; // 소셜공격 <- 매력
            case 'socialDef': rawVal = player.stats.int; break; // 소셜방어 <- 지능
            default: rawVal = player.stats[type] || 10; break;
        }

        // 장비/유물 보정 (스탯 포인트 직접 증가)
        const applyBonus = (statKey) => { rawVal += (bonusStats[statKey] || 0); };

        if (type === 'atk' || type === 'str') applyBonus('str');
        else if (type === 'def' || type === 'con') applyBonus('con');
        else if (type === 'spd' || type === 'dex') applyBonus('dex');
        else if (type === 'socialAtk' || type === 'cha') applyBonus('cha');
        else if (type === 'socialDef' || type === 'int') applyBonus('int');
        else if (type in bonusStats) applyBonus(type);

        // 보정치(Mod) 계산 공식: (스탯 - 10) / 2
        let mod = Math.floor((rawVal - 10) / 2);

        if (type === 'spd') {
            val = Math.max(1, 2 + mod); // 속도는 최소 1 보장
        } else {
            val = mod; // 공격/방어는 음수 가능 (패널티)
        }
    } 
    // [2] 적: 기본 스탯 사용
    else {
        if (type === 'socialAtk') val = entity.baseAtk;
        else if (type === 'socialDef') val = entity.baseDef;
        else if (type === 'atk') val = entity.baseAtk;
        else if (type === 'def') val = entity.baseDef;
        else if (type === 'spd') val = entity.baseSpd;
    }

    // [3] 상태이상(버프/디버프) 적용 - ★ 핵심 수정 파트
    
    // 1. 물리 공격력 (근력 기반)
    if (type === 'atk') { 
        if (entity.buffs["강화"]) val = Math.floor(val * 1.5) + 2; // 50% 증가 + 2
        if (entity.buffs["약화"]) val = Math.floor(val * 0.5);     // 50% 감소
    } 
    
    // 2. 물리 방어력 (건강 기반)
    else if (type === 'def') { 
        if (entity.buffs["건강"]) val = Math.floor(val * 1.5) + 2; 
        if (entity.buffs["취약"]) val = Math.floor(val * 0.5); 
    } 
    
    // 3. 속도 (민첩 기반)
    else if (type === 'spd') { 
        if (entity.buffs["쾌속"]) val = Math.floor(val * 1.5) + 1; 
        if (entity.buffs["마비"]) val = Math.floor(val * 0.5); 
    }

    // 4. 소셜 공격력 (매력 기반) - ★ 물리 버프 영향 제외
    else if (type === 'socialAtk') {
        // '우울'은 감정이 격해져 공격성이 늘어나는 컨셉
        if (entity.buffs["우울"]) val = Math.floor(val * 1.5) + 2; 
        // '약화'는 물리적이므로 소셜엔 영향 없음 (혹은 미미하게)
    }

    // 5. 소셜 방어력 (지능 기반) - ★ 물리 버프 영향 제외
    else if (type === 'socialDef') {
        // '헤롱헤롱'은 정신을 못 차려 논리 방어가 뚫림
        if (entity.buffs["헤롱헤롱"]) val = Math.floor(val * 0.5);
        // '건강' 버프는 몸이 튼튼한 거지 멘탈이 센 게 아니므로 제외
    }
    
    return val;
}
// [game.js] 특성 추가/제거 함수(이벤트용)

// [수정] addTrait / removeTrait: alert -> showPopup
function addTrait(key) {
    if (player.traits.includes(key)) return;
    player.traits.push(key);
    
    let t = TRAIT_DATA[key];
    if (t.onAcquire) t.onAcquire(player);
    
    recalcStats();
    showPopup("특성 획득", `[${t.name}]<br>${t.desc}`, [{txt: "확인", func: closePopup}]);
}

function removeTrait(key) {
    if (!player.traits.includes(key)) return;
    player.traits = player.traits.filter(k => k !== key);
    
    recalcStats();
    showPopup("특성 제거", `${TRAIT_DATA[key].name} 특성이 사라졌습니다.`, [{txt: "확인", func: closePopup}]);
}

function applyBuff(entity, name, dur) {
    if (!entity || !entity.buffs) entity.buffs = {};
    if (name === "가시") {
        ensureThornsField(entity);
        entity.thorns = (entity.thorns || 0) + Number(dur || 0);
        log(`✨ ${entity===player?"나":"적"}에게 [${name}] 적용`);
        return;
    }
    if (name === "독" || name === "활력" || name === "반사") entity.buffs[name] = (entity.buffs[name] || 0) + dur;
    else entity.buffs[name] = dur;
    log(`✨ ${entity===player?"나":"적"}에게 [${name}] 적용`);
}
function tickBuffs(entity) {
    if (entity.buffs["독"]) { let dmg = entity.buffs["독"]; log(`☠️ 독 피해 ${dmg}!`); takeDamage(entity, dmg); }
    if (entity.buffs["활력"]) { let heal = entity.buffs["활력"]; entity.hp = Math.min(entity.maxHp, entity.hp + heal); log(`🌿 활력 회복 +${heal}`); updateUI(); }
}
function decrementBuffs(entity) {
    for (let k in entity.buffs) {
        entity.buffs[k]--;
        if (entity.buffs[k] <= 0) delete entity.buffs[k];
    }
}
/* [수정] 특정 랭크 카드 추가 (소셜 카드 제외) */
function addRandomCard(rank) { 
    let pool = Object.keys(CARD_DATA).filter(k => 
        CARD_DATA[k].rank === rank && 
        CARD_DATA[k].type !== "social" && // ★ 핵심: 소셜 카드 제외
        isCardRewardableForPlayer(k)
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
        CARD_DATA[k].type !== "social" && // ★ 핵심: 소셜 카드 제외
        isCardRewardableForPlayer(k)
    ); 
    
    // 만약 풀이 비었다면 기본 카드 반환
    if(pool.length === 0) return "타격";
    
    return pool[Math.floor(Math.random() * pool.length)]; 
}
function getRandomItem(filter, opts = null) { 
    const options = opts || {};
    const excludeOwnedEquip = !!options.excludeOwnedEquip;
    const excludeNames = options.excludeNames instanceof Set ? options.excludeNames : null;
    const fixedRank = Number.isFinite(options.rank) ? Number(options.rank) : null;
    const categories = Array.isArray(options.categories) ? options.categories.filter(Boolean) : null;

    let pool = Object.keys(ITEM_DATA);

    if (filter) {
        const normalized = filter.toLowerCase();
        
        // allow filtering by either item.type or usage(consume/passive/equip)
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

    if (categories && categories.length > 0) {
        pool = pool.filter(key => {
            const item = ITEM_DATA[key];
            if (!item) return false;
            const itemCategories = Array.isArray(item.categories)
                ? item.categories
                : (item.category ? [item.category] : ["general"]);
            return itemCategories.some(cat => categories.includes(cat));
        });
    }

    if (excludeNames) {
        pool = pool.filter(k => !excludeNames.has(k));
    }

    if (excludeOwnedEquip) {
        pool = pool.filter(k => {
            const item = ITEM_DATA[k];
            if (!item) return false;
            if (item.usage !== "equip") return true;
            return !hasItemAnywhere(k);
        });
    }

    if (pool.length === 0) return null;
    
    let chosenRank = fixedRank;
    if (!Number.isFinite(chosenRank)) {
        let r = Math.random() * 100; 
        chosenRank = (r < 70) ? 1 : (r < 90) ? 2 : 3; 
    }
    
    let rankPool = pool.filter(k => ITEM_DATA[k].rank === chosenRank); 
    if (rankPool.length === 0) rankPool = pool; 
    
    return rankPool[Math.floor(Math.random() * rankPool.length)]; 
}

/* --- UI Render Helpers --- */
/* [수정] drawCards 함수: 손패 초과 시 자동 버림 처리 */
function applyCardDrawEffect(cardName) {
    const data = CARD_DATA[cardName];
    if (!data || !data.drawEffect) return;
    if (game.state !== 'battle' && game.state !== 'social') return;

    const eff = data.drawEffect;
    if (!eff || !eff.type) return;

    switch (eff.type) {
        case "lose_ap": {
            const val = Math.max(0, Number(eff.val || 0));
            if (val <= 0) break;
            const before = player.ap;
            player.ap = Math.max(0, player.ap - val);
            log(`😨 [${cardName}] 발동: AP -${Math.min(before, val)}`);
            break;
        }
        case "damage_self": {
            const val = Math.max(0, Number(eff.val || 0));
            if (val <= 0) break;
            log(`😖 [${cardName}] 발동: HP -${val}`);
            takeDamage(player, val);
            break;
        }
        case "discard_random": {
            const val = Math.max(1, Number(eff.val || 1));
            for (let i = 0; i < val; i++) {
                if (!player.hand || player.hand.length === 0) break;
                const idx = Math.floor(Math.random() * player.hand.length);
                const removed = player.hand.splice(idx, 1)[0];
                if (player.handCostOverride && player.handCostOverride.length > idx) {
                    player.handCostOverride.splice(idx, 1);
                }
                player.discardPile.push(removed);
                log(`😵 [${cardName}] 발동: 무작위 카드 버림 -> [${removed}]`);
            }
            break;
        }
        default:
            break;
    }
}

function drawCards(n) {
    const MAX_HAND_SIZE = 10; // 최대 핸드 매수
    ensureCardSystems(player);

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
            player.handCostOverride.push(null);
            // 뽑을 때 발동하는 효과 (상태이상 등)
            applyCardDrawEffect(card);
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

/* [game.js] updateUI 함수 수정 (상단 시나리오 정보 갱신 추가) */
function updateUI() {
    // 공용 플래그: 현재 전투/소셜에서도 방어도를 표시할지 여부
    const showBlock = true;

    // 1. 상단 플레이어 정보
    const infoEl = document.getElementById('game-info');
      if (infoEl) {
          if (!game.started) {
              infoEl.textContent = "";
              infoEl.classList.add('hidden');
          } else {
              ensureTimeState();
              infoEl.classList.remove('hidden');
              infoEl.textContent = `${getTimeLabel()} | Lv.${game.level} | ${player.gold}G | HP ${player.hp}/${player.maxHp} | SP ${player.sp}/${player.maxSp}`;
          }
      }

    // 2. [NEW] 상단 시나리오 정보 (진척도/위협도)
    const topScInfo = document.getElementById('top-scenario-info');
    
    // 활성화된 시나리오나 진행 중인 상태(탐사, 전투)일 때만 표시
    if (topScInfo) {
        if (game.started && game.scenario && game.scenario.isActive && (game.state === 'exploration' || game.state === 'battle' || game.state === 'social')) {
            topScInfo.classList.remove('hidden');
            document.getElementById('sc-title-mini').innerText = game.scenario.title;
            document.getElementById('sc-title-mini').innerText = `${game.scenario.title} | ${game.scenario.clues}%`;
        } else {
            topScInfo.classList.add('hidden');
        }
    }
    // 글로벌 위험도 표시
    const doomPill = document.getElementById('doom-pill');
    if (doomPill) {
        if (game.started) {
            doomPill.classList.remove('hidden');
            doomPill.innerText = `Doom ${game.doom}%`;
        } else {
            doomPill.classList.add('hidden');
        }
    }
// [★추가] 플로팅 AP 인디케이터 갱신
    const apIndicator = document.getElementById('ap-indicator');
    if (apIndicator) {
        // 값 갱신
        document.getElementById('ap-val').innerText = player.ap;
        document.getElementById('ap-max').innerText = player.maxAp || 3;
        
        // 시각 효과: AP가 없으면 회색으로 변함
        if (player.ap <= 0) {
            apIndicator.classList.add('low-ap');
            apIndicator.style.transform = "scale(0.9)";
        } else {
            apIndicator.classList.remove('low-ap');
            apIndicator.style.transform = "scale(1)";
        }
    }
   // 3. ★ [핵심 수정] 플레이어 전투 정보 (HUD) 업데이트
    const pHud = document.getElementById('player-hud');
    if (pHud) {
        // 전투/소셜 모드일 때만 상세 정보 표시
        if (game.state === 'battle' || game.state === 'social') {
            let hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
            
            // 소셜 모드일 경우 (멘탈 바)
            if (game.state === 'social') {
                hpPct = Math.max(0, (player.mental / 100) * 100);
                pHud.innerHTML = `
                    <div class="hp-bar-bg" style="background:#222; border:1px solid #3498db; height:8px; margin:2px 0;">
                        <div class="hp-bar-fill" style="width:${hpPct}%; background:#3498db;"></div>
                    </div>
                    <div style="font-size:0.8em; color:#fff;">의지: ${player.mental} <span style="color:#f1c40f">🛡️${player.block}</span></div>
                `;
            } 
            // 일반 전투 모드 (체력 바)
            else {
                pHud.innerHTML = `
                    <div class="hp-bar-bg" style="height:8px; margin:2px 0;">
                        <div class="hp-bar-fill" style="width:${hpPct}%"></div>
                    </div>
                    <div style="font-size:0.8em; color:#fff;">HP: ${player.hp} <span style="color:#f1c40f">🛡️${player.block}</span></div>
                `;
            }
            
            // 버프 표시 (툴팁 적용) + 가시(thorns) 별도 표기
            ensureThornsField(player);
            const entries = Object.entries(player.buffs || {});
            if ((player.thorns || 0) > 0) entries.push(["가시", player.thorns]);
            let buffText = entries.map(([k, v]) => `${k}(${v})`).join(', ');
            if (buffText) {
                const buffHtml = (typeof applyTooltip === 'function') ? applyTooltip(buffText) : buffText;
                pHud.innerHTML += `<div class="status-effects" style="font-size:0.7em; color:#2ecc71; pointer-events:auto;" onclick="forwardClickThrough(event)" onmousedown="forwardClickThrough(event)">${buffHtml}</div>`;
            }
            
        } else {
            // 탐사 모드일 때는 이름만 깔끔하게
            pHud.innerHTML = `<div style="font-size:0.9em; color:#aaa;">탐색 중...</div>`;
        }
    // 내 현재 속성 아이콘들 표시 (공격/방어 분리)
    const atkAttrs = getAttackAttrs(player) || [];
    const defAttrs = getDefenseAttrs(player) || [];

    const atkIconsHtml = atkAttrs.map(attr => {
        return `<div class="player-attr-icon" title="공격 속성: ${attr}">${ATTR_ICONS[attr] || attr}</div>`;
    }).join("");
    const defIconsHtml = defAttrs.map(attr => {
        return `<div class="player-attr-icon" style="border-color:#3498db;" title="방어 속성: ${attr}">${ATTR_ICONS[attr] || attr}</div>`;
    }).join("");

    if (atkIconsHtml || defIconsHtml) {
        pHud.innerHTML += `
            <div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
                ${atkIconsHtml ? `<span style="font-size:0.75em; color:#f1c40f; margin-right:4px;">⚔️</span>${atkIconsHtml}` : ""}
                ${defIconsHtml ? `<span style="font-size:0.75em; color:#3498db; margin-left:8px; margin-right:4px;">🛡️</span>${defIconsHtml}` : ""}
            </div>
        `;
    }
    }
    /* [game.js] updateUI 함수 내 적 렌더링 부분 수정 */

// 4. 적 UI 업데이트
if (enemies && enemies.length > 0) {
    
    enemies.forEach(e => {
      
        let el = document.getElementById(`enemy-unit-${e.id}`);
        
        // 요소가 없으면 renderEnemies를 통해 다시 생성 시도 (안전장치)
        if (!el) {
            renderEnemies();
            el = document.getElementById(`enemy-unit-${e.id}`);
            if (!el) return;
        }

        if (e.hp <= 0 && game.state !== "social") {
            el.classList.add('dead');
            el.innerHTML = `<div style="margin-top:50px; color:#777; font-size:2em;">💀</div><div style="color:#555;">${e.name}</div>`;
            return;
        } else {
                el.classList.remove('dead');
        }
        el.classList.add('enemy-unit');
        
        let isSocialEnemy = (game.state === "social"); 
        let hpPct = isSocialEnemy ? Math.min(100, Math.max(0, e.hp)) : Math.max(0, (e.hp / e.maxHp) * 100);
        let barHTML = `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${hpPct}%"></div></div>`;

        let intentIconsHtml = `<span class="intent-icon" title="행동 준비 중">💤</span>`;
        if (e.intentQueue && e.intentQueue.length > 0) {
            intentIconsHtml = e.intentQueue.map((intObj, idx) => {
                const icon = intObj.icon || "❓";
                const tip = intObj.tooltip || "준비 중";
                const dmgText = intObj.damageText ? `<span class="intent-dmg">${intObj.damageText}</span>` : "";
                return `<span class="intent-icon" title="${tip}" data-int-idx="${idx}">${icon}${dmgText}</span>`;
            }).join(" ");
        } else if (e.intent && e.intent.icon) {
            const tip = e.intent.tooltip || "행동 준비 중";
            const dmgText = e.intent.damageText ? `<span class="intent-dmg">${e.intent.damageText}</span>` : "";
            intentIconsHtml = `<span class="intent-icon" title="${tip}">${e.intent.icon}${dmgText}</span>`;
        }
        
        // 버프 텍스트 툴팁 적용 + 가시(thorns) 별도 표기
        ensureThornsField(e);
        const eEntries = Object.entries(e.buffs || {});
        if ((e.thorns || 0) > 0) eEntries.push(["가시", e.thorns]);
        let buffTextRaw = eEntries.map(([k, v]) => `${k}(${v})`).join(', ');
        let buffText = (typeof applyTooltip === 'function') ? applyTooltip(buffTextRaw) : buffTextRaw;
        
        // ★ [핵심 수정] 이미지 소스 안전 처리 (기본값 + 에러 핸들러)
        let imgSrc = e.img;
        if (!imgSrc || imgSrc === "") imgSrc = "https://placehold.co/100x100/555/fff?text=Enemy";

        // 약점/상태 아이콘 처리
        let weakIcon = "";
        let statusIcon = "";
        if (e.isStunned) statusIcon = "😵";
        else if (e.isBroken) statusIcon = "💔";
        // 1. 적의 종류(Key)를 확인
        if (e.enemyKey) {
            // 2. 플레이어가 이 적의 약점을 이미 발견했는지 확인
            let knownWeakness = player.discoveredWeaknesses[e.enemyKey];
            
            // 3. 발견했다면 아이콘 표시, 아니면 빈 문자열(물음표 등으로 대체 가능)
            if (knownWeakness && typeof ATTR_ICONS !== 'undefined') {
                weakIcon = ATTR_ICONS[knownWeakness] || "";
            } else {
                // (선택사항) 아직 모를 때 '?'로 표시하고 싶다면 아래 주석 해제
                weakIcon = "❓"; 
            }
        }
        // HTML 덮어쓰기 (onerror 추가)
        el.innerHTML = `
            <div style="font-weight:bold; font-size:0.9em; margin-bottom:5px;">
                ${statusIcon} ${e.name} ${intentIconsHtml}
            </div>
            <img src="${imgSrc}" alt="${e.name}" class="char-img"
                 onerror="this.src='https://placehold.co/100x100/555/fff?text=No+Img';">
            ${barHTML} 
            <div style="font-size:0.8em;">
                ${isSocialEnemy ? "의지" : "HP"}: ${e.hp}${isSocialEnemy ? "" : `/${e.maxHp}`} 
                ${typeof showBlock !== 'undefined' && showBlock && e.block > 0 ? `<span class="block-icon">🛡️${e.block}</span>` : ""}
                ${weakIcon ? `<span title="약점: ${e.weakness}" style="margin-left:5px; cursor:help;">${weakIcon}</span>` : ""}
            </div>
            <div class="status-effects" style="font-size:0.7em; min-height:15px; color:#f39c12; margin-top:2px;">${buffText}</div>
        `;
    });
}

    if (typeof updateTurnOrderList === "function") updateTurnOrderList();

    // 5. 추가 버튼 (무력행사/도망치기) 로직
    let btnGroup = document.getElementById('btn-group-right'); 
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
           // ★ [핵심] 턴 종료 버튼(end-turn-btn) 앞에 삽입
        let endBtn = document.getElementById('end-turn-btn');
        btnGroup.insertBefore(extraBtn, endBtn);
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
    // [전투 종료 처리] 상태 전환 및 타임라인 관련 값 초기화
    game.state = 'exploration';
    game.isBossBattle = false;
    game.turnOwner = 'none';
    game.lastTurnOwner = 'none';
    player.ag = 0;

    // [★추가] 도주 성공 시 상태이상 및 방어도 초기화
    player.buffs = {};
    migrateThornsFromBuff(player);
    ensureThornsField(player);
    player.thorns = 0;
    player.block = 0;
    enemies.forEach(e => { e.buffs = {}; migrateThornsFromBuff(e); ensureThornsField(e); e.thorns = 0; e.block = 0; e.ag = 0; });
    cleanupCombatTempCards(); // 전투 중 상태이상 카드 제거

    // 3. 살았다면 패널티 적용 후 복귀
    game.doom = Math.min(100, game.doom + 5); // 글로벌 위협도 증가
    
   // ★ [핵심] 탐사 화면으로 UI 복구
    const wrapper = document.getElementById('dungeon-enemies');
    if(wrapper) wrapper.innerHTML = ""; // 적 삭제
    
    enemies = []; // 남아있는 적 데이터 정리

    toggleBattleUI(false); // 이동 버튼 다시 표시
    
   log("<span style='color:#e74c3c; font-weight:bold;'>🏃 허겁지겁 도망쳤습니다!</span>");
    renderExploration();
}

/* [game.js] renderHand 함수 수정 (PC/모바일 로직 분리) */
function renderHand() {
    const container = document.getElementById('hand-container'); 
    container.innerHTML = "";
    ensureCardSystems(player);
    
    // [1] PC/가로 모드용 로직: 8장 이상이면 겹쳐서 보여줌 (기존 기능 복구)
    if (player.hand.length >= 8) container.classList.add('compact');
    else container.classList.remove('compact');

    // [2] 모바일 세로 모드용 로직: 4장 이상이면 'mobile-multi-row' 클래스 붙임
    // (이 클래스는 CSS 미디어 쿼리 안에서만 작동하므로 PC엔 영향 없음)
    if (player.hand.length >= 4) container.classList.add('mobile-multi-row');
    else container.classList.remove('mobile-multi-row');

    player.hand.forEach((cName, idx) => {
        const data = getEffectiveCardData(cName) || CARD_DATA[cName];
        let el = document.createElement('div'); 
        el.className = 'card';
        el.id = `card-el-${idx}`;
        el.style.pointerEvents = "auto";
     
        const isUnplayable = !!data.unplayable;
        const cost = getHandCardCost(idx, cName);
        if (player.ap < cost || game.turnOwner !== "player" || isUnplayable) el.className += " disabled";

        const groupLabel = getCardGroupLabel(data);
        const typeLabel = getCardTypeLabel(data);
        const badges = `${typeLabel ? `<div class="card-group-badge">[${typeLabel}]</div>` : ""}${groupLabel ? `<div class="card-group-badge">[${groupLabel}]</div>` : ""}`;
        
        el.innerHTML = `
            <div class="card-cost">${cost}</div>
            <div class="card-rank">${"★".repeat(data.rank)}</div>
            <div class="card-name">${cName}</div>
            ${badges}
            <div class="card-desc">${applyTooltip(data.desc)}</div>
        `;
        
        if (isUnplayable) {
            el.onclick = () => log(`🚫 [${cName}]은(는) 사용할 수 없습니다.`);
        }
        else if (game.turnOwner === "player" && player.ap >= cost) {
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
            let data = getEffectiveCardData(cName) || CARD_DATA[cName]; let el = document.createElement('div'); el.className = 'mini-card';
            const groupLabel = getCardGroupLabel(data);
            const typeLabel = getCardTypeLabel(data);
            
            // [수정] 미니 카드에도 별 추가
            el.innerHTML = `
                <div>${data.cost} <span style="color:#f1c40f">${"★".repeat(data.rank)}</span></div>
                <b>${cName}</b>
                ${typeLabel ? `<div style="font-size:0.9em; color:#95a5a6;">[${typeLabel}]</div>` : ""}
                ${groupLabel ? `<div style="font-size:0.9em; color:#7f8c8d;">[${groupLabel}]</div>` : ""}
                <div>${applyTooltip(data.desc)}</div>
            `; 
            listDiv.appendChild(el);
        }); content.appendChild(listDiv);
    }
    document.getElementById('popup-layer').style.display = 'flex';
}

function showPopup(title, desc, buttons = [], contentHTML = "") {
    const layer = document.getElementById('popup-layer'); document.getElementById('popup-title').innerText = title; document.getElementById('popup-desc').innerHTML = desc; document.getElementById('popup-content').innerHTML = contentHTML;
    const btnBox = document.getElementById('popup-buttons'); btnBox.innerHTML = "";
    (buttons || []).forEach(b => { let btn = document.createElement('button'); btn.className = 'action-btn'; btn.style.fontSize = "1em"; btn.style.padding = "5px 15px"; btn.innerText = b.txt; btn.onclick = b.func; btnBox.appendChild(btn); });
    layer.style.display = "flex";
}

function showAlert(title, desc, onClose) {
    const closeFn = onClose || closePopup;
    showChoice(title, desc, [{ txt: "확인", func: closeFn }]);
}

function showConfirm(title, desc, onYes, onNo, yesText = "확인", noText = "취소") {
    showChoice(title, desc, [
        { txt: yesText, func: onYes || closePopup },
        { txt: noText, func: onNo || closePopup }
    ]);
}

function showChoice(title, desc, options = [], contentHTML = "") {
    const buttons = (options || []).map(opt => ({
        txt: opt.txt || opt.label || "선택",
        func: opt.func || closePopup
    }));
    showPopup(title, desc, buttons, contentHTML);
}

/* [누락된 함수 추가] 팝업 닫기 기능 */
function closePopup() {
   // [핵심] 게임오버 상태일 때는 팝업을 절대 닫지 않음 (새로고침만 가능하게)
    if (game.state === "gameover") return;
    
    document.getElementById('popup-layer').style.display = 'none';
}

function removeFirstCardFromPile(arr, cardName) {
    if (!Array.isArray(arr)) return false;
    const idx = arr.indexOf(cardName);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    return true;
}

function addCardToHand(cardName) {
    const MAX_HAND_SIZE = 10;
    ensureCardSystems(player);
    if (!player.hand) player.hand = [];

    if (player.hand.length >= MAX_HAND_SIZE) {
        player.discardPile.push(cardName);
        log(`🔥 손패가 꽉 차서 [${cardName}] 카드가 버려졌습니다!`);
        playAnim('btn-discard-pile', 'anim-bounce');
        return false;
    }

    player.hand.push(cardName);
    player.handCostOverride.push(null);
    return true;
}

function showChooseCardFromPile(pileType, title, onPick) {
    const arr = (pileType === 'draw') ? player.drawPile : player.discardPile;
    if (!Array.isArray(arr) || arr.length === 0) {
        log("🗂️ 대상 카드 더미가 비어있습니다.");
        return false;
    }

    showPopup(title, "카드를 선택하세요.", [{ txt: "취소", func: closePopup }], `<div id="choose-card-list" class="pile-list"></div>`);
    const list = document.getElementById('choose-card-list');
    if (!list) return false;

    // drawPile은 '맨 끝이 최상단'이므로, 팝업에서는 최상단부터 보여줌
    const order = [];
    if (pileType === 'draw') for (let i = arr.length - 1; i >= 0; i--) order.push(i);
    else for (let i = arr.length - 1; i >= 0; i--) order.push(i);

    order.forEach(i => {
        const cName = arr[i];
        const cData = CARD_DATA[cName];
        if (!cData) return;

        const groupLabel = getCardGroupLabel(cData);
        const typeLabel = getCardTypeLabel(cData);

        const el = document.createElement('div');
        el.className = 'mini-card';
        el.innerHTML = `
            <div>${cData.cost} <span style="color:#f1c40f">${"★".repeat(cData.rank)}</span></div>
            <b>${cName}</b>
            ${typeLabel ? `<div style="font-size:0.9em; color:#95a5a6;">[${typeLabel}]</div>` : ""}
            ${groupLabel ? `<div style="font-size:0.9em; color:#7f8c8d;">[${groupLabel}]</div>` : ""}
            <div>${applyTooltip(cData.desc)}</div>
        `;
        el.onclick = () => {
            closePopup();
            onPick(cName, i);
        };
        list.appendChild(el);
    });

    return true;
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
    let data = getEffectiveCardData(newCard) || CARD_DATA[newCard];
    const typeLabel = getCardTypeLabel(data);
    const groupLabel = getCardGroupLabel(data);
    
    let cardHTML = `
    <div style="display:flex; justify-content:center; margin:10px;">
        <div class="card">
            <div class="card-cost">${data.cost}</div>
            <div class="card-rank">${"★".repeat(data.rank)}</div>
            <div class="card-name">${newCard}</div>
            ${(typeLabel || groupLabel) ? `<div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin-top:4px;">
                ${typeLabel ? `<div class="card-group-badge">[${typeLabel}]</div>` : ""}
                ${groupLabel ? `<div class="card-group-badge">[${groupLabel}]</div>` : ""}
            </div>` : ""}
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
                const deckLabel = addCardToAppropriateDeck(newCard);
                log(`🃏 [${newCard}]을(를) ${deckLabel}에 추가했습니다.`);
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
    let el = document.getElementById(elementId);

    // 탐험/전투 겸용으로 player-char가 없을 수 있으니 폴백
    if (!el && elementId === 'player-char') {
        el = document.getElementById('dungeon-player') || document.getElementById('dungeon-player-wrapper');
    }
    if (!el) {
        console.warn(`Animation target not found: ${elementId}`);
        return;
    }

    const isEnemyUnit = (typeof elementId === 'string' && elementId.startsWith('enemy-unit-'));

    // 적 유닛은 updateUI가 innerHTML을 자주 갱신하므로(이미지 노드 교체),
    // 내부 이미지에 애니메이션을 걸면 즉시 사라질 수 있어 래퍼에 적용한다.
    const img = el.querySelector?.('.char-img');
    const target = (isEnemyUnit ? el : (img || el));

    // 기존 애니메이션 클래스가 있다면 제거 (연속 재생을 위해)
    el.classList.remove('anim-atk-p', 'anim-atk-e', 'anim-hit', 'anim-bounce');
    if (img) img.classList.remove('anim-atk-p', 'anim-atk-e', 'anim-hit', 'anim-bounce');

    // 강제 리플로우 (브라우저가 변경사항을 즉시 인식하게 함)
    void target.offsetWidth;

    // 새 애니메이션 클래스 추가
    target.classList.add(animClass);

    // 애니메이션이 끝나면 클래스 제거 (깔끔하게)
    setTimeout(() => {
        target.classList.remove(animClass);
    }, 600); // 가장 긴 애니메이션 시간(0.6s)에 맞춤
}

/* [game.js] renderWinPopup 함수 (안전성 보완) */
function renderWinPopup() {
    // 팝업이 닫혀버리는 문제 방지를 위해 상태 재확인
    game.state = "win"; 

    let btns = [];
    let contentHTML = "";

    // 1. [아이템 줍기 버튼]
    if (game.pendingLoot) {
        let loot = game.pendingLoot;
        let lData = ITEM_DATA[loot];
        
        if (lData) {
            contentHTML = `
                <div style="display:flex; justify-content:center; margin-top:15px;">
                    <div class="item-icon item-rank-${lData.rank}">
                        ${lData.icon}
                        <span class="tooltip"><b>${loot}</b><br>${lData.desc}</span>
                    </div>
                </div>
                <div style="margin-top:5px; font-size:0.9em; color:#aaa;">${loot}</div>
            `;
            
            btns.push({ 
                txt: "🖐️ 아이템 줍기", 
                func: () => getLoot() 
            });
        } else {
            // 데이터 에러 시 전리품 삭제
            game.pendingLoot = null;
        }
    }

    // 2. [레벨업 버튼]
    if (player.xp >= player.maxXp) {
        btns.push({ 
            txt: "🆙 레벨업!", 
            func: () => processLevelUp() 
        });
    }

    // 3. [떠나기 버튼]
    btns.push({ 
        txt: "떠나기", 
        func: () => nextStepAfterWin() 
    });

    // 메시지에 레벨업 알림 추가
    let finalMsg = game.winMsg || "전투 승리!";
    if (player.xp >= player.maxXp) {
        finalMsg += `<br><br><b style="color:#f1c40f; animation:blink 1s infinite;">✨ 레벨 업 가능! ✨</b>`;
    }

    showPopup("🎉 전투 승리!", finalMsg, btns, contentHTML);
}

function getLoot() {
    if (game.pendingLoot) {
        // [성공 콜백] 아이템 획득에 성공했을 때 실행
        const onLootSuccess = () => {
            // 메시지 갱신 (기존 텍스트에서 '떨어져 있습니다' 제거 후 획득 메시지 추가)
            if (game.winMsg) {
                game.winMsg = game.winMsg.replace("전리품이 바닥에 떨어져 있습니다.", "");
                game.winMsg = game.winMsg.replace("<br>✨", ""); // 아이콘 잔여물 제거
            }
            game.winMsg += `<br><span style="color:#2ecc71">✔ [${game.pendingLoot}] 획득함.</span>`;
            
            game.pendingLoot = null; // 바닥에서 삭제
            
            // ★ 핵심: 획득 후 즉시 결과 화면을 다시 그려서 '레벨업' 버튼 등이 유지되게 함
            setTimeout(() => {
                renderWinPopup(); 
            }, 50);
        };

        // 아이템 획득 시도
        let result = addItem(game.pendingLoot, onLootSuccess);

        // [실패 예외 처리] addItem이 false를 반환했을 때 (중복 유물 등)
        // 가방이 꽉 찬 경우는 addItem 내부에서 showSwapPopup을 호출하므로 제외
        if (result === false) {
            let itemData = ITEM_DATA[game.pendingLoot];
            
            // 소모품이 꽉 찬 게 아니라, '중복 불가 유물/장비'라서 실패한 경우
            if (itemData.usage === 'passive' || itemData.usage === 'equip') {
                const label = (itemData.usage === 'equip') ? "장비" : "유물";
                showPopup("획득 불가", `이미 보유하고 있는 ${label}([${game.pendingLoot}])입니다.<br>전리품을 포기합니다.`, [
                    { 
                        txt: "확인", 
                        func: () => {
                            game.pendingLoot = null; // 포기 처리
                            renderWinPopup(); // 결과 화면 복귀
                        }
                    }
                ]);
            }
            // 가방이 꽉 찬 경우는 showSwapPopup이 떴을 것이므로 여기서 처리 안 함
        }
    }
}
/* --- [NEW] 드래그 타겟팅 & 미리보기 시스템 --- */

let drag = { active: false, cardIdx: -1, cardName: "", startX: 0, startY: 0, originalDesc: "", moved: false };

/* [수정] 드래그 시작 함수 (텍스트 즉시 변환 제거) */
function startDrag(e, idx, name, type = 'card') {
  // 마우스 우클릭 방지 (터치는 button 속성이 없음)
    if (e.type === 'mousedown' && e.button !== 0) return; 
    if (e.target.tagName === 'BUTTON') return;

    drag.active = true;
    drag.type = type; 
    drag.idx = idx;   
    drag.name = name; 
    drag.moved = false;
    
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
    // 손패 영역을 벗어나는 순간부터 드래그로 인정
    if (!drag.moved) {
        const handArea = document.getElementById('hand-container');
        if (handArea) {
            const hr = handArea.getBoundingClientRect();
            if (endX < hr.left || endX > hr.right || endY < hr.top || endY > hr.bottom) {
                drag.moved = true;
            }
        } else {
            drag.moved = true; // 안전장치
        }
    }

    const path = document.getElementById('drag-path');
    const head = document.getElementById('drag-head');
    let cpX = (drag.startX + endX) / 2; let cpY = Math.min(drag.startY, endY) - 100;
    path.setAttribute("d", `M${drag.startX},${drag.startY} Q${cpX},${cpY} ${endX},${endY}`);
    head.setAttribute("cx", endX); head.setAttribute("cy", endY);

    let targetInfo = getTargetUnderMouse(e);
    let data = (drag.type === 'card') ? (getEffectiveCardData(drag.name) || CARD_DATA[drag.name]) : ITEM_DATA[drag.name];
    let dragEl = document.getElementById((drag.type==='card')?`card-el-${drag.idx}`:`item-el-${drag.idx}`);
    
    document.querySelectorAll('.enemy-unit').forEach(el => el.classList.remove('selected-target'));
    const playerEl = document.getElementById('player-char') || document.getElementById('dungeon-player');
    if (playerEl) playerEl.classList.remove('selected-target');

    let validTarget = false;
    let aliveEnemies = enemies.filter(en => en.hp > 0);

    if (targetInfo) {
        if (data.targetType === 'all' || data.target === 'all') {
            enemies.forEach(en => { 
                if (en.hp > 0) {
                    const el = document.getElementById(`enemy-unit-${en.id}`);
                    if (el) el.classList.add('selected-target');
                }
            });
            validTarget = true;
        }
        // [핵심 수정] 공격(attack) 뿐만 아니라 소셜(social) 카드도 적을 타겟팅하게 변경
        else if ((data.type && (data.type.includes("attack") || data.type === "social")) || data.target === "enemy") {
            if (targetInfo.type === 'specific' && targetInfo.unit !== player) {
                const el = document.getElementById(`enemy-unit-${targetInfo.unit.id}`);
                if (el) {
                    el.classList.add('selected-target');
                    validTarget = true;
                }
            }
            else if (targetInfo.type === 'general' && aliveEnemies.length === 1) {
                const el = document.getElementById(`enemy-unit-${aliveEnemies[0].id}`);
                if (el) {
                    el.classList.add('selected-target');
                    validTarget = true;
                }
            }
        }
        else if (data.target === "self" || (!data.type?.includes("attack") && data.target !== "enemy")) {
            if ((targetInfo.type === 'specific' && targetInfo.unit === player) || targetInfo.type === 'general') {
                if (playerEl) playerEl.classList.add('selected-target');
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
    if (dragEl) {
        if (validTarget) { dragEl.style.transform = "scale(1.1)"; dragEl.style.zIndex = "1000"; } 
        else { dragEl.style.transform = "scale(1.0)"; dragEl.style.zIndex = "auto"; }
    }
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
    const playerElEnd = document.getElementById('player-char') || document.getElementById('dungeon-player');
    if (playerElEnd) playerElEnd.classList.remove('selected-target');

    // 최종 드롭 위치가 손패 안이면 취소 (클릭 또는 되돌아온 경우)
    const handArea = document.getElementById('hand-container');
    if (!drag.moved || (handArea && (() => {
        const hr = handArea.getBoundingClientRect();
        const pos = getClientPos(e);
        return pos.x >= hr.left && pos.x <= hr.right && pos.y >= hr.top && pos.y <= hr.bottom;
    })())) {
        drag.active = false;
        drag.idx = -1;
        return;
    }

    let targetInfo = getTargetUnderMouse(e);
    let data = (drag.type === 'card') ? (getEffectiveCardData(drag.name) || CARD_DATA[drag.name]) : ITEM_DATA[drag.name];
    let finalTargets = [];
    let aliveEnemies = enemies.filter(en => en.hp > 0);

    if (targetInfo) {
        if (data.targetType === 'all' || data.target === 'all') {
            finalTargets = aliveEnemies;
        }
        // 공격/적 대상 (소셜 포함)
        else if ((data.type && (data.type.includes("attack") || data.type === "social")) || data.target === "enemy") {
            if (targetInfo.type === 'specific' && targetInfo.unit !== player) {
                const tEl = document.getElementById(`enemy-unit-${targetInfo.unit.id}`);
                if (tEl) tEl.classList.add('selected-target');
                finalTargets = [targetInfo.unit];
            }
            else if (aliveEnemies.length === 1 && targetInfo.type === 'general') {
                const tEl = document.getElementById(`enemy-unit-${aliveEnemies[0].id}`);
                if (tEl) tEl.classList.add('selected-target');
                finalTargets = [aliveEnemies[0]];
            }
        }
        // 자기 대상/버프
        else if (data.target === "self" || (!data.type?.includes("attack") && data.target !== "enemy")) {
            if (targetInfo.type === 'specific' && targetInfo.unit === player) finalTargets = [player];
            else if (targetInfo.type === 'general') finalTargets = [player];
        }
    }

    // [자동 타겟팅] 적이 1명뿐이거나 광역기일 때는 빈 공간 드롭만으로 발동
    if (finalTargets.length === 0) {
        if (data.targetType === 'all' || data.target === 'all') {
            finalTargets = aliveEnemies; // 광역
        } else if ((data.type && (data.type.includes("attack") || data.type === "social")) || data.target === "enemy") {
            if (aliveEnemies.length === 1) finalTargets = [aliveEnemies[0]]; // 단일 적
        } else if (data.target === "self" || (!data.type?.includes("attack") && data.target !== "enemy")) {
            finalTargets = [player]; // 자기 대상 버프
        }
    }

    if (finalTargets.length > 0) {
        if (drag.type === 'card') {
            const cost = getHandCardCost(drag.idx, drag.name);
            player.ap -= cost;
            let usedCard = player.hand.splice(drag.idx, 1)[0];
            if (player.handCostOverride && player.handCostOverride.length > drag.idx) {
                player.handCostOverride.splice(drag.idx, 1);
            }
            const base = CARD_DATA[usedCard];
            if (base && base.isExhaust) player.exhaustPile.push(usedCard);
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
/* [game.js] getTargetUnderMouse 함수 수정 (타겟 우선순위 변경) */
function getTargetUnderMouse(e) {
    const pos = getClientPos(e); // {x: ..., y: ...}
    const x = pos.x;
    const y = pos.y;

    // [1순위] 적(Enemy) 충돌 체크 (가장 중요)
    for (let en of enemies) {
        if (en.hp <= 0) continue;
        const enEl = document.getElementById(`enemy-unit-${en.id}`);
        if (enEl) {
            const r = enEl.getBoundingClientRect();
            // 좌표가 적 박스 안에 있는지 확인
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                return { type: 'specific', unit: en };
            }
        }
    }

    // [2순위] 플레이어(Self) 충돌 체크 (버프용)
    const pEl = document.getElementById('player-char') || document.getElementById('dungeon-player') || document.getElementById('dungeon-player-wrapper');
    if (pEl) {
        const r = pEl.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            return { type: 'specific', unit: player };
        }
    }

    // [3순위] 핸드 영역 체크 (취소 판정)
    // 적이나 플레이어 위가 아닌데, 핸드 영역 안이라면? -> 타겟팅 취소
    const handArea = document.getElementById('hand-container');
    if (handArea) {
        const handRect = handArea.getBoundingClientRect();
        if (x >= handRect.left && x <= handRect.right &&
            y >= handRect.top && y <= handRect.bottom) {
            return null; 
        }
    }

    // [4순위] 허공 (광역기 등)
    let el = document.elementFromPoint(x, y);
    if (el) {
        if (el.closest('.container') && !el.closest('.utility-dock')) {
            return { type: 'general' };
        }
    }

    return null;
}

/* [수정] 카드 설명 내 수치 계산 함수 (색상 강조 포함) */
function calcPreview(cardName, user) {
    const base = CARD_DATA[cardName];
    const data = getEffectiveCardData(cardName) || base;
    if (!data) return "";
    // 툴팁 등 기본 설명 가져오기
    let desc = applyTooltip(data.desc); 
    
    // 공격력/방어력 스탯 가져오기 (버프/디버프가 이미 적용된 수치)
    let atk = getStat(user, 'atk');
    let def = getStat(user, 'def');

    // 1. 공격 카드 계산
    if (typeof data.dmg === 'number' && typeof base?.dmg === 'number') {
        // 기본 공식: (카드 데미지 + 플레이어 공격력)
        // ※ 실제 게임에서는 (기본뎀 + 힘) * 배율 등이지만, 여기선 단순 합산으로 구현
        let finalDmg = data.dmg + atk; 
        
        // 색상 결정 (기본값보다 높으면 초록, 낮으면 빨강)
        let colorClass = (finalDmg > data.dmg) ? "mod-val-buff" : 
                         (finalDmg < data.dmg) ? "mod-val-debuff" : "";
        
        // 텍스트 교체 (예: "HP -5" -> "HP -<span class='...'>7</span>")
        // 정규식: 설명 텍스트 내의 '기본 데미지 숫자'를 찾아서 '계산된 숫자'로 교체
        let regex = new RegExp(base.dmg, "g");
        desc = desc.replace(regex, `<span class="${colorClass}">${finalDmg}</span>`);
    }

    // 2. 방어 카드 계산
    if (typeof data.block === 'number' && typeof base?.block === 'number') {
        // 기본 공식: (카드 방어도 + 플레이어 방어력)
        let finalBlock = data.block + def;
        
        let colorClass = (finalBlock > data.block) ? "mod-val-buff" : 
                         (finalBlock < data.block) ? "mod-val-debuff" : "";
                         
        let regex = new RegExp(base.block, "g");
        desc = desc.replace(regex, `<span class="${colorClass}">${finalBlock}</span>`);
    }

    return desc;
}

function updateTurnOrderList() {
    let predictedOrder = []; 
    const MAX_PREDICT = 5;

    // ★ [수정] p-img -> dungeon-player 로 변경 (이미지 소스 안전하게 가져오기)
    const pEl = document.getElementById('dungeon-player');
    let pImgSrc = pEl ? pEl.src : "";

    // 1. 현재 턴 주인 추가
    if (game.turnOwner === 'player') {
        predictedOrder.push({ type: 'player', img: pImgSrc, isCurrent: true });
    } else if (game.turnOwner === 'enemy') {
        let currentEnemy = enemies.find(e => e.id === game.currentActorId);
        if (currentEnemy && currentEnemy.hp > 0) {
            predictedOrder.push({ type: 'enemy', img: currentEnemy.img, isCurrent: true });
        }
    }

    // 2. 미래 예측 시뮬레이션
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
        
        if (index === 0 && unit.isCurrent) {
            node.style.animation = `fadeInScale 0.2s ease forwards`; 
            node.style.borderWidth = "3px";
            node.style.zIndex = "10";
        } else {
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

// 플레이어 스탯/트레잇 확인 팝업
function openPlayerStats() {
    if (!game.started) return;
    const s = player.stats;
    const statRows = `
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:left;">
            <div>💪 근력: <b>${s.str}</b></div>
            <div>❤️ 건강: <b>${s.con}</b></div>
            <div>⚡ 민첩: <b>${s.dex}</b></div>
            <div>🧠 지능: <b>${s.int}</b></div>
            <div>👁️ 정신: <b>${s.wil}</b></div>
            <div>💋 매력: <b>${s.cha}</b></div>
        </div>
    `;

    let traitList = "없음";
    if (player.traits && player.traits.length > 0) {
        traitList = player.traits.map(tKey => {
            const t = TRAIT_DATA[tKey] || { name: tKey, desc: "" };
            return `<li style="margin-bottom:4px;"><b>${t.name || tKey}</b> - <span style="color:#ccc;">${t.desc || ""}</span></li>`;
        }).join("");
        traitList = `<ul style="padding-left:18px; margin:6px 0 0 0;">${traitList}</ul>`;
    }

    const content = `
        <div style="text-align:left; display:flex; flex-direction:column; gap:10px;">
            <div>${statRows}</div>
            <div>
                <div style="color:#f1c40f; font-weight:bold; margin-bottom:4px;">보유 트레잇</div>
                ${traitList}
            </div>
        </div>
    `;

    showPopup("플레이어 정보", "현재 스탯과 트레잇을 확인하세요.", [{ txt: "닫기", func: closePopup }], content);
}
// 현재 보고 있는 덱 탭 ('battle' or 'social')
let currentCollectionTab = 'battle';
/* [수정] 카드 컬렉션 열기 */
function openAllCards() {
    if (!game.started) return;
    
    currentCollectionTab = 'battle'; // 기본은 전투 덱
    document.getElementById('card-collection-overlay').classList.remove('hidden');
    
    // 탭 UI 초기화
    document.getElementById('tab-col-battle').className = 'inv-tab active';
    document.getElementById('tab-col-social').className = 'inv-tab';
    
    renderCardCollection();
}

/* [NEW] 닫기 */
function closeCardCollection() {
    document.getElementById('card-collection-overlay').classList.add('hidden');
}

/* [NEW] 탭 전환 */
function switchCollectionTab(tab) {
    currentCollectionTab = tab;
    
    // 버튼 스타일
    document.getElementById('tab-col-battle').className = (tab === 'battle' ? 'inv-tab active' : 'inv-tab');
    document.getElementById('tab-col-social').className = (tab === 'social' ? 'inv-tab active' : 'inv-tab');
    
    renderCardCollection();
}

/* [NEW] 카드 리스트 렌더링 */
function renderCardCollection() {
    const list = document.getElementById('collection-list');
    list.innerHTML = "";

    // 카운트 갱신
    document.getElementById('cnt-col-battle').innerText = `(${player.deck.length})`;
    document.getElementById('cnt-col-social').innerText = `(${player.socialDeck.length})`;

    // 대상 덱 가져오기
    let targetDeck = (currentCollectionTab === 'battle') ? player.deck : player.socialDeck;

    // 카드 정렬 (가나다순 or 랭크순 -> 여기선 랭크순 추천)
    // 원본 덱 순서를 건드리지 않기 위해 복사본(...) 사용
    let sortedDeck = [...targetDeck].sort((a, b) => {
        let da = CARD_DATA[a], db = CARD_DATA[b];
        if (db.rank !== da.rank) return db.rank - da.rank; // 랭크 높은 순
        return a.localeCompare(b); // 이름 순
    });

    if (sortedDeck.length === 0) {
        list.innerHTML = `<div style="grid-column: 1/-1; color:#777; margin-top:50px;">(카드가 없습니다)</div>`;
        return;
    }

    sortedDeck.forEach(cName => {
        let data = getEffectiveCardData(cName) || CARD_DATA[cName];
        const typeLabel = getCardTypeLabel(data);
        const groupLabel = getCardGroupLabel(data);
        let el = document.createElement('div');
        
        // 기존 card 클래스 사용하여 디자인 통일 + 컬렉션 전용 클래스 추가
        el.className = 'card collection-card-view';
        
        // 카드 내용 HTML 구성 (기존 renderHand와 동일한 구조)
        el.innerHTML = `
            <div class="card-cost">${data.cost}</div>
            <div class="card-rank">${"★".repeat(data.rank)}</div>
            <div class="card-name">${cName}</div>
            ${(typeLabel || groupLabel) ? `<div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin-top:4px;">
                ${typeLabel ? `<div class="card-group-badge">[${typeLabel}]</div>` : ""}
                ${groupLabel ? `<div class="card-group-badge">[${groupLabel}]</div>` : ""}
            </div>` : ""}
            <div class="card-desc">${applyTooltip(data.desc)}</div>
        `;
        
        list.appendChild(el);
    });
}

window.onload = initGame;
