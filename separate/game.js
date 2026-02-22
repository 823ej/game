

/* [NEW] 적 덱 생성 헬퍼 함수 */
function getEnemyDeck(type) {
    let deck = [];
    if (type === "basic") {
        // 불량배: 단순 공격 위주
        deck = ["타격", "타격", "수비"];
    }
    else if (type === "player_like") {
        // 허수아비: 플레이어 초기 덱 구성 (타격5, 수비4, 2성 1장)
        for (let i = 0; i < 5; i++) deck.push("타격");
        for (let i = 0; i < 4; i++) deck.push("수비");
        // 랜덤 2성 카드 1장 추가 (함수 재사용)
        let randomRank2 = getRandomCardByRank(2);
        deck.push(randomRank2);
    }
    return deck;
}


/* [NEW] 랭크별 랜덤 카드 뽑기 유틸리티 (기존 getRandomCard 보완) */
function isCardRewardableForPlayer(cardName, opts = {}) {
    const c = CARD_DATA[cardName];
    if (!c) return false;
    if (isPenaltyCard(cardName)) return false;
    if (c.noReward) return false;          // 장비 전용 카드 등 제외
    if (c.job === "enemy") return false;   // 적 전용
    if (c.job === "equipment") return false; // 장비 전용

    const job = player && player.job ? player.job : null;
    if (opts.onlyCommon) return c.job === "common";
    if (opts.onlyJob) {
        if (!job) return c.job === "common";
        return c.job === job;
    }
    if (c.job && c.job !== "common" && job && c.job !== job) return false;
    // 직업 미선택 상태라면 공용 카드만
    if (!job && c.job && c.job !== "common") return false;
    return true;
}

function getRandomCardByRank(rank, opts = {}) {
    // 상점/보상 등 "플레이어 획득용" 풀 기준
    let pool = Object.keys(CARD_DATA).filter(k => {
        const c = CARD_DATA[k];
        if (!c) return false;
        if (c.rank !== rank) return false;
        if (c.type === "social") return false;
        return isCardRewardableForPlayer(k, opts);
    });
    if (pool.length === 0) return "타격";
    return pool[Math.floor(Math.random() * pool.length)];
}

class Debuff {
    constructor(name) {
        this.name = name;
    }
}

class ClueDebuff extends Debuff {
    constructor() {
        super("Clue");
    }
    getStacks(target) {
        return Math.max(0, Number(target?.clueStacks || 0));
    }
    addStacks(target, amount) {
        if (!target) return 0;
        const add = Math.max(0, Number(amount || 0));
        const next = Math.max(0, this.getStacks(target) + add);
        target.clueStacks = next;
        return next;
    }
    consumeAll(target) {
        if (!target) return 0;
        const cur = this.getStacks(target);
        target.clueStacks = 0;
        return cur;
    }
}

class AssistantManager {
    constructor() {
        this.maxHp = 0;
        this.hp = 0;
        this.block = 0;
        this.buffs = {};
        this.stats = { con: 0 };
        this.isBroken = false;
        this.isStunned = false;
    }
    reset(maxHp) {
        this.maxHp = Math.max(0, Number(maxHp || 0));
        this.hp = this.maxHp;
        this.block = 0;
        this.buffs = {};
        this.isBroken = false;
        this.isStunned = false;
    }
    isAlive() {
        return this.hp > 0;
    }
    takeDamage(dmg) {
        const val = Math.max(0, Number(dmg || 0));
        let remain = val;
        if (this.buffs["건강"]) {
            remain = Math.floor(remain * 0.5);
        }
        if (this.block > 0) {
            const blocked = Math.min(this.block, remain);
            this.block -= blocked;
            remain -= blocked;
        }
        const dealt = Math.min(this.hp, remain);
        this.hp -= dealt;
        if (remain > 0) {
            if (this.isBroken && !this.isStunned) {
                this.isStunned = true;
                this.block = 0;
                logNarration("system.assistantDown");
            } else if (this.hp <= 0 && !this.isBroken && !this.isStunned) {
                this.isBroken = true;
                logNarration("system.assistantShaken");
            }
        }
        return dealt;
    }
    addBlock(amount) {
        const val = Math.max(0, Number(amount || 0));
        if (val > 0) this.block += val;
    }
    heal(amount) {
        const val = Math.max(0, Number(amount || 0));
        if (val <= 0) return 0;
        const before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + val);
        if (this.hp > 0) {
            this.isBroken = false;
            this.isStunned = false;
        }
        return this.hp - before;
    }
}

const clueDebuff = new ClueDebuff();

function getClueMultiplier() {
    const mul = Number(getTotalPowerValue('clueMultiplier') || 1);
    return Math.max(1, mul);
}

function addClueStacks(target, count) {
    const base = Math.max(0, Number(count || 0));
    if (!target || base <= 0) return clueDebuff.getStacks(target);

    const prevStacks = clueDebuff.getStacks(target);
    const mult = getClueMultiplier();
    const total = Math.max(0, Math.floor(base * mult));
    const nextStacks = clueDebuff.addStacks(target, total);

    // [New] 탐정 전용: 단서 10개 달성 시 [결정적 논증] 생성
    if (isDetectiveJob() && prevStacks < 10 && nextStacks >= 10) {
        if (!Array.isArray(player.combatTempCards)) player.combatTempCards = [];
        player.hand.push("결정적 논증");
        player.combatTempCards.push("결정적 논증"); // 전투 종료 후 사라지게 하려면
        // 즉시 손패 렌더링이 필요할 수 있음
        renderHand();
    logNarration("system.clueConclusion");
        playAnim(player, 'anim-success'); // 시각적 피드백
    }

    return nextStacks;
}

function CardEffect_CheckClue(target, threshold = 10) {
    return clueDebuff.getStacks(target) >= Math.max(1, Number(threshold || 10));
}

function Card_SolveCase(user, target, config = {}) {
    if (!target) return { triggered: false, dealt: 0 };
    const threshold = Math.max(1, Number(config.threshold || 10));
    if (!CardEffect_CheckClue(target, threshold)) return { triggered: false, dealt: 0 };

    const bonus = Math.max(0, Number(config.bonusDmg || 0));
    const consume = config.consume !== false;
    if (consume) clueDebuff.consumeAll(target);
    const res = takeDamage(target, bonus + getStat(user, 'atk'), false, null, user, { isAttack: true, isFinisher: true });
    return { triggered: true, dealt: res?.dealt || 0 };
}

function ensureAssistantManager() {
    const existing = player.assistantManager;
    if (!existing || typeof existing.isAlive !== "function") {
        const maxHp = Math.max(0, Number(existing?.maxHp || 0));
        const hp = Math.max(0, Number(existing?.hp || 0));
        const block = Math.max(0, Number(existing?.block || 0));
        player.assistantManager = new AssistantManager();
        player.assistantManager.maxHp = maxHp;
        player.assistantManager.hp = Math.min(maxHp, hp);
        player.assistantManager.block = block;
    }
    if (!player.assistantManager.buffs) player.assistantManager.buffs = {};
    if (!player.assistantManager.stats) player.assistantManager.stats = { con: 0 };
    if (typeof player.assistantManager.isBroken !== "boolean") player.assistantManager.isBroken = false;
    if (typeof player.assistantManager.isStunned !== "boolean") player.assistantManager.isStunned = false;
    // 순환 참조 방지: owner는 사용하지 않으므로 제거
    if (player.assistantManager.owner) player.assistantManager.owner = null;
    return player.assistantManager;
}

function initAssistantForDetective() {
    if (!isDetectiveJob()) return;
    const mgr = ensureAssistantManager();

    if (mgr.baseMaxHp && mgr.baseMaxHp > 0) {
        return;
    }

    // 캐릭터 생성 시점 한 번만: 탐정 건강 기준으로 조수 건강 결정
    const detectiveCon = Math.max(1, Number(player.stats?.con || 1));
    mgr.stats.con = detectiveCon;
    mgr.baseMaxHp = Math.max(1, Number(player.maxHp || 1));

    const bonus = Math.max(0, Number(mgr.stats?.con || 0) * 2);
    mgr.reset(Math.max(1, mgr.baseMaxHp + bonus));
}

function healAssistant(amount, hpCost = 0) {
    if (!isDetectiveJob()) return false;
    const mgr = ensureAssistantManager();
    if (!mgr || mgr.maxHp <= 0) return false;
    const cost = Math.max(0, Number(hpCost || 0));
    if (cost > 0 && player.hp <= cost) {
        logNarration("system.assistFail");
        return false;
    }
    if (cost > 0) player.hp -= cost;
    const healed = mgr.heal(amount);
    if (healed > 0) logNarration("system.assistHeal", { amount: healed });
    updateUI();
    return healed > 0;
}

function hasLogicShield(target) {
    const buffs = target?.buffs || {};
    return !!(buffs["거짓말"] || buffs["침묵"] || buffs["Liar"] || buffs["Silence"]);
}

function breakLogicShield(target) {
    if (!target || !target.buffs) return;
    delete target.buffs["거짓말"];
    delete target.buffs["침묵"];
    delete target.buffs["Liar"];
    delete target.buffs["Silence"];
}

function addProfiling(amount) {
    const inc = Math.max(0, Number(amount || 0));
    if (!game.profilingGauge) game.profilingGauge = 0;
    game.profilingGauge = Math.min(100, game.profilingGauge + inc);
    if (game.profilingGauge >= 100) {
        game.profilingGauge = 0;
        if (!Array.isArray(player.combatTempCards)) player.combatTempCards = [];
        player.hand.push("결정적 논증");
        player.combatTempCards.push("결정적 논증");
        logNarration("system.profilingDone");
        renderHand();
    }
    updateUI();
}


/* SCENARIOS 데이터에 구역 연결 (기존 데이터 유지하되 location은 동적으로 처리 가능) */
// (기존 SCENARIOS 데이터는 그대로 두셔도 됩니다)

const CITY_VIBE_META = {
    safe: { label: getUIText("cityMap.vibeSafe"), color: "#f1c40f" },
    busy: { label: getUIText("cityMap.vibeBusy"), color: "#1abc9c" },
    corporate: { label: getUIText("cityMap.vibeCorporate"), color: "#3498db" },
    dark: { label: getUIText("cityMap.vibeDark"), color: "#c0392b" },
    calm: { label: getUIText("cityMap.vibeCalm"), color: "#95a5a6" },
    outskirts: { label: getUIText("cityMap.vibeOutskirts"), color: "#e67e22" },
    water: { label: getUIText("cityMap.vibeWater"), color: "#00b5d8" },
    neutral: { label: getUIText("cityMap.vibeNeutral"), color: "#9b59b6" }
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
    if (!mapEl) return;
    setCityPanelVisible('map', false);
    clearCityLogSticky("city_area_desc");

    mapEl.innerHTML = `
        <svg class="city-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
        <div class="city-map-node-layer"></div>
    `;

    const lineLayer = mapEl.querySelector('.city-map-lines');
    const nodeLayer = mapEl.querySelector('.city-map-node-layer');
    // [Mod] const nodes -> let nodes for dynamic injection
    let nodes = (CITY_MAP && Array.isArray(CITY_MAP.nodes)) ? [...CITY_MAP.nodes] : [];

    // [Quest] 저주받은 골동품 진행 중일 때 '폐쇄된 저택' 노드 추가
    if (game.activeScenarioId === 'cursed_antique' || (game.scenario && game.scenario.id === 'cursed_antique')) {
        nodes.push({
            id: "abandoned_mansion",
            name: getUIText("cityMap.missionNodeName"),
            label: getUIText("cityMap.missionNodeLabel"),
            desc: getUIText("cityMap.missionNodeDesc"),
            vibe: "active", // violet/purple style if available, or just neutral
            pos: { x: 72, y: 35 },
            tags: [getUIText("cityMap.tagQuest"), getUIText("cityMap.tagDungeon")],
            links: ["east_oldtown"],
            isMissionNode: true,
            scenarioId: "cursed_antique"
        });
    }
    game.cityMapNodes = nodes;
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

    const defaultNode = nodes.find(n => n.id === "east_oldtown") || nodes[0];
    if (defaultNode) {
        enterDistrict(defaultNode.id, true);
        setCityPanelVisible('map', true);
    }
    autoSave();
}

/* [수정] 도시 거점 선택 (현재는 정보 패널만) */
function enterDistrict(key, silentAreaOpen) {
    const nodes = (Array.isArray(game.cityMapNodes) && game.cityMapNodes.length > 0)
        ? game.cityMapNodes
        : ((CITY_MAP && Array.isArray(CITY_MAP.nodes)) ? CITY_MAP.nodes : []);
    let node = nodes.find(n => n.id === key);

    // [Quest] 동적 노드 체크
    if (!node && key === "abandoned_mansion") {
        node = {
            id: "abandoned_mansion",
            name: getUIText("cityMap.missionNodeName"),
            desc: getUIText("cityMap.missionNodeDesc"),
            tags: [getUIText("cityMap.tagQuest"), getUIText("cityMap.tagDungeon")],
            isMissionNode: true,
            scenarioId: "cursed_antique"
        };
    }

    if (!node) return;

    game.selectedCityNode = key;

    document.querySelectorAll('.city-node').forEach(el => {
        el.classList.toggle('active', el.dataset.id === key);
    });

    const titleEl = document.getElementById('city-detail-title');
    const descEl = document.getElementById('city-detail-desc');
    const exploreBtn = document.getElementById('city-action-explore');
    const mapMode = document.getElementById('city-map-mode');
    const areaMode = document.getElementById('city-area-mode');

    if (titleEl) titleEl.textContent = node.name;
    if (descEl) descEl.textContent = node.desc;
    updateCityLeftInfo('map', node.name, node.desc);
    if (!game.cityMapNarrated) {
        appendCityLogLine("", getNarration("city.map.idle"), false, true);
        game.cityMapNarrated = true;
    }
    setCityLogSticky("city_map_desc", `${node.name} — ${node.desc || ""}`.trim(), false);
    const hasArea = CITY_AREA_DATA && CITY_AREA_DATA[key];

    if (exploreBtn) {
        if (node.isMissionNode) {
            exploreBtn.textContent = getUIText("explore.enterLabel");
            exploreBtn.disabled = false;
            exploreBtn.onclick = () => {
                const scData = SCENARIOS[node.scenarioId];
                appendCityLogLine("", `${node.name} — ${node.desc || ""}`.trim(), false, false);
                appendCityLogLine("", getNarration("city.map.ask"), false, true);
                appendCityLogLine("", getNarration("city.map.go", { place: node.name }), false, true);
                if (scData && scData.dungeon) {
                    game.activeScenarioId = node.scenarioId;
                    const prevScenario = (game.scenario && game.scenario.id === node.scenarioId) ? game.scenario : null;
                    game.scenario = {
                        id: node.scenarioId,
                        title: scData.title,
                        clues: prevScenario ? (prevScenario.clues || 0) : 0,
                        location: (prevScenario && prevScenario.location) ? prevScenario.location : (scData.locations ? scData.locations[0] : ""),
                        bossReady: prevScenario ? !!prevScenario.bossReady : false,
                        isActive: true,
                        enemyPool: prevScenario?.enemyPool || getEnemyPoolFromScenario(scData),
                        returnToCity: prevScenario?.returnToCity
                    };
                    game.dungeonMap = false;
                    DungeonSystem.isCity = false;
                    renderExploration(true);
                } else {
                    notifyNarration(getUIText("system.noDungeonData"));
                }
            };
        } else if (hasArea) {
            exploreBtn.textContent = getUIText("explore.enterLabel");
            exploreBtn.disabled = false;
            exploreBtn.onclick = () => {
                appendCityLogLine("", `${node.name} — ${node.desc || ""}`.trim(), false, false);
                appendCityLogLine("", getNarration("city.map.ask"), false, true);
                appendCityLogLine("", getNarration("city.map.go", { place: node.name }), false, true);
                enterCityAreaMode(key);
            };
        } else {
            exploreBtn.textContent = getUIText("explore.enterLabel");
            exploreBtn.disabled = true;
            exploreBtn.onclick = null;
        }
    }

    if (silentAreaOpen !== true) setCityPanelVisible('map', true);

    if (mapMode && areaMode) {
        mapMode.classList.remove('hidden');
        areaMode.classList.add('hidden');
    }
}

function enterCityAreaMode(areaId, targetSpotId) {
    const mapMode = document.getElementById('city-map-mode');
    const areaMode = document.getElementById('city-area-mode');
    if (mapMode) mapMode.classList.add('hidden');
    if (areaMode) areaMode.classList.remove('hidden');
    setCityPanelVisible('area', false);
    setCityDialogueMode(false);
    setCityCasePanelVisible(false);
    game.cityDialogue = null;
    clearCityLogSticky("city_map_desc");
    if (!game.cityArea) game.cityArea = {};
    game.cityArea.explicitSelection = !!targetSpotId;
    if (!targetSpotId) game.cityArea.selectedSpot = null;
    renderCityArea(areaId, targetSpotId);
    const area = getCityArea(areaId);
    if (area) {
        updateCityLeftInfo('area', area.name, area.desc);
        appendCityLogLine("", `${area.name} — ${area.desc || ""}`.trim(), false, false);
        appendCityLogLine("", getNarration("city.area.next"), false, true);
    }
}

function exitCityAreaMode() {
    const mapMode = document.getElementById('city-map-mode');
    const areaMode = document.getElementById('city-area-mode');
    if (mapMode) mapMode.classList.remove('hidden');
    if (areaMode) areaMode.classList.add('hidden');
    setCityPanelVisible('map', false);
    setCityDialogueMode(false);
    setCityCasePanelVisible(false);
    game.cityDialogue = null;
    clearCityLogSticky("city_area_desc");
    game.cityMapNarrated = false;
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
                    { id: "return_office", name: getUIText("cityArea.returnOffice"), icon: "🏠", action: "return_hub" }
                ];
            } else {
                nextSpot.objects = [
                    { id: "enter_office", name: getUIText("cityArea.enterOffice"), icon: "🕵️", action: "enter_city_area", areaId: "youngjin_office_interior" }
                ];
            }
        }

    if (spot.npcSlot) {
        const assigned = npcAssignments[spot.id];
        const npcList = Array.isArray(assigned) ? assigned : (assigned ? [assigned] : []);
        const fixedList = Array.isArray(spot.fixedNpcKeys) ? spot.fixedNpcKeys.filter(Boolean) : [];
        const mergedNpcList = [...fixedList, ...npcList];
        if (mergedNpcList.length > 0) {
            const primaryNpc = NPC_DATA[mergedNpcList[0]];
            if (primaryNpc && !spot.keepBaseName) {
                nextSpot.name = primaryNpc.name || nextSpot.name;
                nextSpot.desc = primaryNpc.desc || nextSpot.desc;
                nextSpot.icon = primaryNpc.icon || nextSpot.icon;
            }
            const baseObjects = Array.isArray(spot.objects) ? [...spot.objects] : [];
            const npcObjects = mergedNpcList.map((npcKey, idx) => {
                const npc = NPC_DATA[npcKey] || {};
                return {
                    id: `talk_${spot.id}_${idx}`,
                    name: npc.name || getUIText("city.talkFallback"),
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
    enterCityAreaMode(areaId, spotId);
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

function renderCityArea(areaId, targetSpotId) {
    const area = getVisibleCityArea(areaId);
    if (!area) return;
    if (!game.cityArea) game.cityArea = {};
    game.cityArea.areaId = areaId;
    const validIds = (area.spots || []).map(s => s.id);
    if (!validIds.includes(game.cityArea.currentSpot)) {
        game.cityArea.currentSpot = area.start || validIds[0];
    }
    if (targetSpotId && validIds.includes(targetSpotId)) {
        game.cityArea.selectedSpot = targetSpotId;
    } else if (!validIds.includes(game.cityArea.selectedSpot)) {
        game.cityArea.selectedSpot = null;
    }

    if (area.hideNodes) {
        if (!game.cityArea.selectedSpot) {
            game.cityArea.selectedSpot = area.start || validIds[0] || null;
        }
        if (!targetSpotId && !game.cityArea.explicitSelection) {
            game.cityArea.explicitSelection = false;
        }
    }

    const mapEl = document.getElementById('city-area-map');
    if (!mapEl) return;
    mapEl.innerHTML = `
        <div class="city-area-node-layer"></div>
        <div class="city-area-object-layer"></div>
    `;
    const nodeLayer = mapEl.querySelector('.city-area-node-layer');
    const objectLayer = mapEl.querySelector('.city-area-object-layer');

    if (!area.hideNodes) {
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
    }

    if (game.cityArea.selectedSpot) {
        renderCitySpotBackground(area, game.cityArea.selectedSpot);
        renderCitySpotObjects(area, game.cityArea.selectedSpot, objectLayer);
    } else {
        renderCitySpotBackground(area, null);
        if (objectLayer) objectLayer.innerHTML = "";
    }
    updateCityAreaDetail();
}

function selectCityAreaSpot(spotId) {
    if (!game.cityArea) game.cityArea = {};
    game.cityArea.selectedSpot = spotId;
    game.cityArea.explicitSelection = true;
    const area = getVisibleCityArea(game.cityArea.areaId);
    const spot = area ? getAreaSpot(area, spotId) : null;
    if (spot) {
        updateCityLeftInfo('area', spot.name, spot.desc);
        if (game.cityArea.inspectNarratedAreaId !== area?.id) {
            appendCityLogLine("", getNarration("city.area.inspect", { place: spot.name }), false, true);
            game.cityArea.inspectNarratedAreaId = area?.id || null;
        }
        setCityLogSticky("city_area_desc", `${spot.name} — ${spot.desc || ""}`.trim(), false);
    }
    updateCityAreaDetail();
    renderCityArea(game.cityArea.areaId);
}

function updateCityAreaDetail() {
    const area = getVisibleCityArea(game.cityArea?.areaId);
    if (!area) return;
    const targetId = game.cityArea.selectedSpot;
    const spot = targetId ? getAreaSpot(area, targetId) : null;

    const titleEl = document.getElementById('city-spot-title');
    const descEl = document.getElementById('city-spot-desc');
    if (titleEl) titleEl.textContent = spot?.name || getUIText("cityArea.selectSpotTitle");
    if (descEl) descEl.textContent = spot?.desc || getUIText("cityArea.selectSpotDesc");
    const enterBtn = document.getElementById('btn-area-enter');
    if (enterBtn) {
        if (!spot) {
            enterBtn.disabled = true;
            enterBtn.onclick = null;
            enterBtn.textContent = getUIText("cityArea.enterLabel");
        } else {
            const objects = Array.isArray(spot.objects) ? spot.objects : [];
            const npcObjects = objects.filter(obj => obj?.action === 'npc_dialogue');
            const primaryObj = npcObjects[0] || objects[0] || null;
            if (npcObjects.length > 0) {
                enterBtn.textContent = getUIText("cityArea.talkLabel");
                enterBtn.disabled = false;
                enterBtn.onclick = () => {
                    if (npcObjects.length === 1) {
                        performCityAction(npcObjects[0], area.id, spot.id);
                        return;
                    }
                    const options = npcObjects.map(obj => ({
                        txt: obj.name || getUIText("city.talkFallback"),
                        func: () => { closePopup(); performCityAction(obj, area.id, spot.id); }
                    }));
                    if (typeof showChoice === 'function') {
                        showChoice(spot.name || getUIText("cityArea.talkLabel"), getUIText("cityArea.talkPrompt"), options);
                    } else {
                        showPopup(spot.name || getUIText("cityArea.talkLabel"), getUIText("cityArea.talkPrompt"), options);
                    }
                };
            } else if (primaryObj) {
                enterBtn.textContent = getUIText("cityArea.enterLabel");
                enterBtn.disabled = false;
                enterBtn.onclick = () => performCityAction(primaryObj, area.id, spot.id);
            } else {
                enterBtn.textContent = getUIText("cityArea.enterLabel");
                enterBtn.disabled = true;
                enterBtn.onclick = null;
            }
        }
    }
    if (spot) setCityPanelVisible('area', true);
    else setCityPanelVisible('area', false);

    if (area.hideNodes && !game.cityArea.explicitSelection) {
        if (enterBtn) {
            enterBtn.disabled = true;
            enterBtn.onclick = null;
            enterBtn.textContent = getUIText("cityArea.talkLabel");
            enterBtn.classList.add('hidden');
        }
        setCityPanelVisible('area', false);
    } else if (enterBtn) {
        enterBtn.classList.remove('hidden');
    }

    if (spot && !area.hideNodes) {
        updateCityLeftInfo('area', spot.name, spot.desc);
    } else if (!spot) {
        updateCityLeftInfo('area', area.name, area.desc);
    }

    updateCityAreaNavButtons(area);
}

function performCityAction(obj, areaId, spotId) {
    if (!obj || !obj.action) return;
    const action = obj.action;
    if (action === 'enter_city_area' && obj.areaId) {
        enterCityAreaMode(obj.areaId, obj.spotId || null);
        return;
    }
    if (action === 'enter_dungeon' && obj.dungeonId) {
        if (typeof startCityDungeon === 'function') startCityDungeon(obj.dungeonId);
        return;
    }
    if (action === 'enter_scenario' && obj.scenarioId) {
        if (typeof startScenarioFromCity === 'function') startScenarioFromCity(obj.scenarioId);
        return;
    }
    if (action === 'open_casefiles') {
        if (typeof openCaseFiles === 'function') openCaseFiles();
        return;
    }
    if (action === 'open_black_market') {
        if (typeof renderShopScreen === 'function') renderShopScreen("shop_black_market");
        return;
    }
    if (action === 'open_occult_shop') {
        if (typeof renderShopScreen === 'function') renderShopScreen("shop_occult");
        return;
    }
    if (action === 'open_sauna') {
        if (typeof openSaunaRest === 'function') openSaunaRest();
        return;
    }
    if (action === 'open_occult_clinic') {
        if (typeof openOccultClinic === 'function') openOccultClinic();
        return;
    }
    if (action === 'open_healing_clinic') {
        if (typeof openHealingClinic === 'function') openHealingClinic();
        return;
    }
    if (action === 'hospital_cure') {
        if (typeof openHospitalCure === 'function') openHospitalCure();
        return;
    }
    if (action === 'hecate_dialogue') {
        startNpcDialogue(getUIText("dialogue.hecateName"));
        return;
    }
    if (action === 'npc_dialogue' && obj.npcKey) {
        startNpcDialogue(obj.npcKey);
        return;
    }
    if (action === 'return_hub') {
        if (typeof renderHub === 'function') renderHub();
        return;
    }
}

function startNpcDialogue(npcKey) {
    if (!npcKey || typeof NPC_DATA === 'undefined') return;
    const npc = NPC_DATA[npcKey] || {};
    const dialogue = normalizeNpcDialogue(npc, npcKey);
    if (!dialogue) return;
    if (npc.flagOnTalk && typeof hasGameFlag === 'function' && typeof setGameFlag === 'function') {
        if (!hasGameFlag(npc.flagOnTalk)) {
            setGameFlag(npc.flagOnTalk);
        }
    }
    game.cityDialogue = {
        npcKey,
        dialogue,
        nodeId: dialogue.start,
        log: [],
        typing: null
    };
    const logEl = document.getElementById('city-dialogue-log');
    const choicesEl = document.getElementById('city-dialogue-choices');
    if (logEl) {
        logEl.innerHTML = "";
        logEl.onclick = () => {
            if (game.cityDialogue?.typing) completeDialogueTyping();
        };
    }
    if (choicesEl) choicesEl.innerHTML = "";
    setCityDialogueMode(true);
    setCityCasePanelVisible(false);
    showDialogueNode(dialogue.start);
}

function normalizeNpcDialogue(npc, npcKey) {
    if (!npc) return null;
    if (npc.dialogue && npc.dialogue.nodes && npc.dialogue.start) {
        return npc.dialogue;
    }
    const fallbackText = npc.desc || getUIText("dialogue.npcFallback");
    return {
        start: "start",
        nodes: {
            start: {
                speaker: npc.name || npcKey || "NPC",
                text: fallbackText,
                choices: [{ text: getUIText("dialogue.endTalk"), action: "close" }]
            }
        }
    };
}

function showDialogueNode(nodeId) {
    const state = game.cityDialogue;
    if (!state || !state.dialogue) return;
    const node = state.dialogue.nodes ? state.dialogue.nodes[nodeId] : null;
    if (!node) return endNpcDialogue();
    state.nodeId = nodeId;
    const speaker = node.speaker || (NPC_DATA[state.npcKey]?.name || "NPC");
    appendDialogueLine(speaker, node.text || "", false, true);
    renderDialogueChoices(node.choices || []);
}

function appendDialogueLine(speaker, text, isPlayer, useTyping) {
    appendCityLogLine(speaker, text, isPlayer, useTyping);
}

function startDialogueTyping(textEl, fullText) {
    if (!textEl) return;
    if (game.cityDialogue?.typing) completeDialogueTyping();
    const state = {
        el: textEl,
        fullText,
        index: 0,
        timer: null
    };
    if (game.cityDialogue) game.cityDialogue.typing = state;
    state.timer = setInterval(() => {
        if (!game.cityDialogue || game.cityDialogue.typing !== state) {
            clearInterval(state.timer);
            return;
        }
        state.index += 1;
        state.el.textContent = fullText.slice(0, state.index);
        if (state.index >= fullText.length) {
            clearInterval(state.timer);
            if (game.cityDialogue && game.cityDialogue.typing === state) {
                game.cityDialogue.typing = null;
            }
        }
    }, 18);
}

function completeDialogueTyping() {
    const typing = game.cityDialogue?.typing;
    if (!typing) return;
    clearInterval(typing.timer);
    typing.el.textContent = typing.fullText;
    if (game.cityDialogue) game.cityDialogue.typing = null;
}

function renderDialogueChoices(choices) {
    const filtered = filterDialogueChoices(choices);
    if (filtered.length === 0) return;
    addCityLogChoices(filtered.map(choice => ({
        text: choice.text || getUIText("dialogue.choiceDefault"),
        onSelect: () => handleDialogueChoice(choice)
    })));
}

function filterDialogueChoices(choices) {
    if (!Array.isArray(choices)) return [];
    return choices.filter(choice => isDialogueChoiceAvailable(choice));
}

function isDialogueChoiceAvailable(choice) {
    if (!choice || !Array.isArray(choice.requires)) return true;
    if (typeof hasGameFlag !== 'function') return true;
    return choice.requires.every(req => {
        if (req.flag) return hasGameFlag(req.flag);
        if (req.notFlag) return !hasGameFlag(req.notFlag);
        return true;
    });
}

function handleDialogueChoice(choice) {
    if (!choice) return;
    if (game.cityDialogue?.typing) {
        completeDialogueTyping();
    }
    appendDialogueLine(getUIText("dialogue.playerName"), choice.text || "", true, false);
    applyDialogueEffects(choice.effects || []);
    if (choice.action) {
        handleDialogueAction(choice.action);
        if (choice.action === 'close') return;
    }
    if (choice.next) {
        showDialogueNode(choice.next);
        return;
    }
    if (!choice.action) {
        endNpcDialogue();
    }
}

function applyDialogueEffects(effects) {
    if (!Array.isArray(effects)) return;
    effects.forEach(effect => {
        if (effect.setFlag && typeof setGameFlag === 'function') setGameFlag(effect.setFlag);
        if (effect.clearFlag && typeof clearGameFlag === 'function') clearGameFlag(effect.clearFlag);
    });
}

function handleDialogueAction(action) {
    if (action === 'open_casefiles' && typeof openCaseFiles === 'function') {
        renderHecateOfferPanel();
        return;
    }
    if (action === 'close') {
        endNpcDialogue();
        return;
    }
}

function endNpcDialogue() {
    if (!game.cityDialogue) return;
    if (game.cityDialogue.typing) completeDialogueTyping();
    game.cityDialogue = null;
    setCityDialogueMode(false);
    setCityCasePanelVisible(false);
    updateCityAreaDetail();
}

function setCityDialogueMode(active) {
    const panel = document.getElementById('city-dialogue-panel');
    const enterBtn = document.getElementById('btn-area-enter');
    if (panel) panel.classList.remove('hidden');
    if (enterBtn) enterBtn.classList.toggle('hidden', active);
    const choices = document.getElementById('city-dialogue-choices');
    if (choices) choices.classList.toggle('hidden', !active);
}

function setCityCasePanelVisible(active) {
    const panel = document.getElementById('city-case-panel');
    const enterBtn = document.getElementById('btn-area-enter');
    if (panel) panel.classList.toggle('hidden', !active);
    if (enterBtn) enterBtn.classList.toggle('hidden', active);
}

function renderHecateOfferPanel(noticeText) {
    setCityDialogueMode(false);
    const listEl = document.getElementById('city-case-list');
    const closeBtn = document.getElementById('btn-case-close');
    if (!listEl) return;
    listEl.innerHTML = "";

    if (noticeText) {
        const notice = document.createElement('div');
        notice.className = 'city-case-item';
        notice.innerHTML = `<div class="case-note">${noticeText}</div>`;
        listEl.appendChild(notice);
    }

    let added = 0;
    for (let id in SCENARIOS) {
        const sc = SCENARIOS[id];
        if (!sc || sc.source !== 'hecate') continue;
        const rule = (typeof SCENARIO_RULES !== 'undefined') ? SCENARIO_RULES[id] : null;
        const unlocked = isScenarioAvailable(id);
        const btn = document.createElement('button');
        btn.className = 'action-btn city-case-item';
        btn.innerHTML = `
            <div class="case-title">${sc.title}</div>
            <div class="case-desc">${sc.desc || ""}</div>
            <div class="case-note">${unlocked ? getUIText("dialogue.hecateAlready") : getUIText("dialogue.hecateOffer")}</div>
        `;
        if (unlocked) {
            continue;
        }
        btn.onclick = () => {
            if (unlocked) return;
            if (rule?.leadFlag && typeof setGameFlag === 'function') {
                setGameFlag(rule.leadFlag);
            }
            if (Array.isArray(rule?.requiredFlags) && typeof setGameFlag === 'function') {
                rule.requiredFlags.forEach(flag => setGameFlag(flag));
            }
            appendCityLogLine("", getUIText("dialogue.hecateLog"), false, true);
            renderHecateOfferPanel(getUIText("dialogue.hecateAdded"));
        };
        listEl.appendChild(btn);
        added += 1;
    }
    if (added === 0) {
        const item = document.createElement('div');
        item.className = 'city-case-item';
        item.innerHTML = `<div class="case-note">${getUIText("dialogue.hecateNone")}</div>`;
        listEl.appendChild(item);
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            setCityCasePanelVisible(false);
        };
    }
    setCityCasePanelVisible(true);
}

function appendCityLogLine(speaker, text, isPlayer, useTyping) {
    const logs = getLogTargets();
    if (logs.length === 0) return;
    logs.forEach((logEl, idx) => {
        const line = document.createElement('div');
        line.className = `city-dialogue-line${isPlayer ? " is-player" : ""}`;
        line.innerHTML = speaker ? `<span class="speaker">${speaker}</span><span class="text"></span>` : `<span class="text"></span>`;
        const textEl = line.querySelector('.text');
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
        requestAnimationFrame(() => {
            logEl.scrollTop = logEl.scrollHeight;
        });
        if (idx === 0 && useTyping) {
            startDialogueTyping(textEl, text || "");
        } else if (textEl) {
            textEl.textContent = text || "";
        }
        logEl.onclick = () => {
            if (game.cityDialogue?.typing) completeDialogueTyping();
        };
    });
    if (!game.cityLog) game.cityLog = [];
    game.cityLog.push({ speaker, text: text || "", isPlayer: !!isPlayer });
}

function clearCityLogSticky(stickyKey) {
    if (!stickyKey || !game.cityLog) return;
    game.cityLog = game.cityLog.filter(e => !(e && e.stickyKey === stickyKey));
    const logs = getLogTargets();
    logs.forEach(logEl => {
        logEl.querySelectorAll(`.city-dialogue-line[data-sticky-key="${stickyKey}"]`).forEach(el => el.remove());
    });
}

function setCityLogSticky(stickyKey, text, isPlayer) {
    if (!stickyKey) return;
    if (!game.cityLog) game.cityLog = [];
    const entry = game.cityLog.find(e => e && e.stickyKey === stickyKey);
    const logs = getLogTargets();
    if (entry) {
        entry.text = text || "";
        entry.isPlayer = !!isPlayer;
        logs.forEach(logEl => {
            const textEl = logEl.querySelector(`.city-dialogue-line[data-sticky-key="${stickyKey}"] .text`);
            if (textEl) textEl.textContent = text || "";
        });
        return;
    }
    logs.forEach(logEl => {
        const line = document.createElement('div');
        line.className = `city-dialogue-line${isPlayer ? " is-player" : ""}`;
        line.dataset.stickyKey = stickyKey;
        line.innerHTML = `<span class="text"></span>`;
        const textEl = line.querySelector('.text');
        if (textEl) textEl.textContent = text || "";
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
        requestAnimationFrame(() => {
            logEl.scrollTop = logEl.scrollHeight;
        });
        logEl.onclick = () => {
            if (game.cityDialogue?.typing) completeDialogueTyping();
        };
    });
    game.cityLog.push({ speaker: "", text: text || "", isPlayer: !!isPlayer, stickyKey });
}

function updateCityLeftInfo(mode, title, desc) {
    const titleEl = document.getElementById(mode === 'map' ? 'city-map-left-title' : 'city-area-left-title');
    const descEl = document.getElementById(mode === 'map' ? 'city-map-left-desc' : 'city-area-left-desc');
    if (titleEl) titleEl.textContent = title || "";
    if (descEl) descEl.textContent = desc || "";
}

function updateCityAreaNavButtons(area) {
    const backAreaBtn = document.getElementById('btn-area-back-area');
    const backMapBtn = document.getElementById('btn-area-back-map');
    if (backAreaBtn) {
        if (area && area.parentAreaId) {
            backAreaBtn.classList.remove('hidden');
            backAreaBtn.textContent = `${getUIText("city.backAreaPrefix")}${area.parentLabel || getUIText("city.backAreaFallback")}`;
            backAreaBtn.onclick = () => enterCityAreaMode(area.parentAreaId, area.parentSpotId || null);
        } else {
            backAreaBtn.classList.add('hidden');
            backAreaBtn.onclick = null;
        }
    }
    if (backMapBtn) {
        backMapBtn.onclick = () => exitCityAreaMode();
    }
}

function setCityPanelVisible(mode, visible) {
    const shell = document.getElementById(mode === 'area' ? 'city-area-mode' : 'city-map-mode');
    const panel = mode === 'area'
        ? document.querySelector('#city-area-mode .city-detail-panel')
        : document.getElementById('city-detail-panel');
    if (!shell || !panel) return;
    shell.classList.toggle('panel-hidden', !visible);
    panel.classList.toggle('is-hidden', !visible);
    if (mode === 'area') {
        const actions = panel.querySelector('.city-spot-actions');
        if (actions) actions.classList.toggle('hidden', !visible);
    } else {
        const actions = panel.querySelector('.city-detail-actions');
        if (actions) actions.classList.toggle('hidden', !visible);
    }
    if (visible) syncCityLogPanels();
}

function syncCityLogPanels() {
    if (!game.cityLog) return;
    const logs = getLogTargets();
    logs.forEach(logEl => {
        logEl.innerHTML = "";
        game.cityLog.forEach(entry => {
            if (entry && entry.type === "choices") {
                const wrapper = document.createElement('div');
                wrapper.className = 'city-dialogue-line is-player';
                if (entry.resolved) {
                    wrapper.innerHTML = `<span class="text">${getUIText("popup.choiceDefault")}: ${entry.selectedText || ""}</span>`;
                } else {
                    const btnWrap = document.createElement('div');
                    btnWrap.className = 'city-dialogue-choices';
                    entry.choices.forEach((txt, idx) => {
                        const btn = document.createElement('button');
                        btn.className = 'action-btn';
                        btn.textContent = txt || getUIText("popup.choiceDefault");
                        btn.onclick = () => resolveCityLogChoice(entry.id, idx);
                        btnWrap.appendChild(btn);
                    });
                    wrapper.appendChild(btnWrap);
                }
                logEl.appendChild(wrapper);
            } else {
                const line = document.createElement('div');
                line.className = `city-dialogue-line${entry.isPlayer ? " is-player" : ""}`;
                if (entry.stickyKey) line.dataset.stickyKey = entry.stickyKey;
                line.innerHTML = entry.speaker
                    ? `<span class="speaker">${entry.speaker}</span><span class="text"></span>`
                    : `<span class="text"></span>`;
                const textEl = line.querySelector('.text');
                if (textEl) textEl.textContent = entry.text || "";
                logEl.appendChild(line);
            }
        });
        logEl.scrollTop = logEl.scrollHeight;
        logEl.onclick = () => {
            if (game.cityDialogue?.typing) completeDialogueTyping();
        };
    });
}

function renderCitySpotBackground(area, spotId) {
    const mapEl = document.getElementById('city-area-map');
    if (!mapEl) return;
    const spot = getAreaSpot(area, spotId);
    const title = spot?.name || area?.name || "City";
    const bg = spot?.bg || area?.bg || `https://placehold.co/1400x900/efefef/333?text=${encodeURIComponent(title)}`;
    mapEl.style.backgroundImage = `url('${bg}')`;
    mapEl.style.backgroundSize = 'cover';
    mapEl.style.backgroundPosition = 'center';
}

function renderCitySpotObjects(area, spotId, layerEl) {
    if (!layerEl) return;
    layerEl.innerHTML = "";
    const spot = getAreaSpot(area, spotId);
    const allowNpcObjects = !!area?.showNpcObjects;
    const objects = Array.isArray(spot?.objects)
        ? spot.objects.filter(obj => !obj?.hideOnMap && (allowNpcObjects || obj?.action !== 'npc_dialogue'))
        : [];
    if (objects.length === 0) return;

    const positions = getCityObjectPositions(area.id, spotId, objects);
    objects.forEach((obj, idx) => {
        const pos = positions[idx] || { x: 50, y: 50 };
        const el = document.createElement('button');
        el.className = 'city-area-object';
        el.style.left = `${pos.x}%`;
        el.style.top = `${pos.y}%`;
        el.innerHTML = `${obj.icon ? `${obj.icon} ` : ""}${obj.name || getUIText("city.interactionFallback")}`;
        el.onclick = () => {
            if (game.cityArea) game.cityArea.explicitSelection = true;
            setCityCasePanelVisible(false);
            setCityPanelVisible('area', true);
            const titleEl = document.getElementById('city-spot-title');
            const descEl = document.getElementById('city-spot-desc');
            if (titleEl) titleEl.textContent = obj.name || (spot?.name || getUIText("city.selectSpotTitle"));
            const npc = obj?.npcKey && (typeof NPC_DATA !== 'undefined') ? NPC_DATA[obj.npcKey] : null;
            if (descEl) descEl.textContent = obj.desc || npc?.desc || spot?.desc || getUIText("city.selectSpotDesc");
            if (npc?.desc) {
                appendCityLogLine("", `${npc.name} — ${npc.desc}`, false, true);
            }
            const enterBtn = document.getElementById('btn-area-enter');
            if (enterBtn) {
                enterBtn.disabled = false;
                enterBtn.textContent = obj.action === 'npc_dialogue'
                    ? getUIText("city.areaTalk")
                    : getUIText("city.areaEnter");
                enterBtn.onclick = () => performCityAction(obj, area.id, spotId);
            }
        };
        layerEl.appendChild(el);
    });
}

function hasFinalConsonant(word) {
    if (!word) return false;
    const str = String(word).trim();
    if (!str) return false;
    const ch = str[str.length - 1];
    const code = ch.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return false;
    const index = (code - 0xac00) % 28;
    return index !== 0;
}

function getFinalConsonantIndex(word) {
    if (!word) return 0;
    const str = String(word).trim();
    if (!str) return 0;
    const ch = str[str.length - 1];
    const code = ch.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return 0;
    return (code - 0xac00) % 28;
}

function pickJosa(word, pair) {
    const raw = String(pair || "").trim();
    if (!raw) return "";
    const map = {
        "을를": ["을", "를"],
        "이가": ["이", "가"],
        "은는": ["은", "는"],
        "과와": ["과", "와"],
        "으로": ["으로", "로"],
        "로": ["으로", "로"],
        "에게": ["에게", "에게"]
    };
    let first = "";
    let second = "";
    if (raw.includes("/")) {
        const parts = raw.split("/");
        first = parts[0] || "";
        second = parts[1] || "";
    } else if (map[raw]) {
        [first, second] = map[raw];
    } else if (raw.length >= 2) {
        first = raw[0];
        second = raw[1];
    } else {
        return raw;
    }

    if (first === "으로" || second === "로") {
        const idx = getFinalConsonantIndex(word);
        if (idx === 0 || idx === 8) return second; // 받침 없음 or ㄹ
        return first;
    }
    return hasFinalConsonant(word) ? first : second;
}

function getNarration(path, vars = {}) {
    const root = (typeof NARRATION !== 'undefined') ? NARRATION : null;
    if (!root || !path) return "";
    const value = path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), root);
    if (typeof value !== 'string') return "";
    let out = value;
    const upperVars = {};
    Object.keys(vars || {}).forEach(k => {
        upperVars[String(k).toUpperCase()] = vars[k];
    });
    out = out.replace(/\[([A-Z0-9_]+)(?:[:\/]([^\]]+))\]/g, (m, key, particle) => {
        const v = upperVars[key];
        if (v === undefined || v === null) return "";
        return `${v}${pickJosa(v, particle)}`;
    });
    Object.keys(upperVars).forEach(k => {
        out = out.replace(`[${k}]`, upperVars[k]);
    });
    return out;
}

function getUIText(path, fallback = "") {
    const root = (typeof UI_TEXT !== 'undefined') ? UI_TEXT : null;
    if (!root || !path) return fallback || "";
    const value = path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), root);
    return (typeof value === 'string') ? value : (fallback || "");
}

function getDisplayText(category, key, fallback = "") {
    const root = (typeof DISPLAY_TEXT !== 'undefined') ? DISPLAY_TEXT : null;
    if (!root || !category || key === undefined || key === null) {
        return fallback || String(key ?? "");
    }
    const bucket = root[category];
    if (bucket && Object.prototype.hasOwnProperty.call(bucket, key)) {
        return bucket[key];
    }
    return fallback || String(key);
}

function getCardDisplayName(name) {
    return getDisplayText("cards", name, String(name ?? ""));
}

function getItemDisplayName(name) {
    return getDisplayText("items", name, String(name ?? ""));
}

function getBuffDisplayName(name) {
    return getDisplayText("buffs", name, String(name ?? ""));
}

function getActorDisplayName(name) {
    const fallback = String(name ?? "");
    const npcName = getDisplayText("npcs", name, fallback);
    if (npcName !== fallback) return npcName;
    return getDisplayText("enemies", name, fallback);
}

function getLocationDisplayName(name) {
    return getDisplayText("locations", name, String(name ?? ""));
}

function getCityObjectPositions(areaId, spotId, objects) {
    if (!game.cityObjectLayout) game.cityObjectLayout = {};
    if (!game.cityObjectLayout[areaId]) game.cityObjectLayout[areaId] = {};
    if (!game.cityObjectLayout[areaId][spotId]) {
        const layout = objects.map((obj, i) => {
            if (obj.pos && Number.isFinite(obj.pos.x) && Number.isFinite(obj.pos.y)) return obj.pos;
            const angle = (i / Math.max(1, objects.length)) * Math.PI * 2;
            const radius = 22 + (i % 3) * 8;
            return {
                x: 50 + Math.cos(angle) * radius,
                y: 50 + Math.sin(angle) * radius
            };
        });
        game.cityObjectLayout[areaId][spotId] = layout;
    }
    return game.cityObjectLayout[areaId][spotId];
}

/* 도시 특수 던전 진입 (화이트 큐브 등) */
function startCityDungeon(dungeonId) {
    const config = (typeof CITY_DUNGEON_CONFIGS !== 'undefined' && CITY_DUNGEON_CONFIGS[dungeonId]) ? CITY_DUNGEON_CONFIGS[dungeonId] : null;
    const title = (config && config.title)
        ? config.title
        : getUIText("cityDungeon.titleDefault");

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
    setCitySpotStatus(getUIText("city.spotArrive").replace("[NAME]", target.name));
    renderCityArea(area.id);
}

function interactCitySpot() {
    const area = getVisibleCityArea(game.cityArea?.areaId);
    const currentId = game.cityArea?.currentSpot;
    if (!area || !currentId) return;
    const spot = getAreaSpot(area, currentId);
    if (!spot) return;
    setCitySpotStatus(getUIText("city.spotEnterPending").replace("[NAME]", spot.name));
}
/* [game.js] 상점 나가기 핸들러 (상황별 복귀) */
/* [game.js] 상점 나가기 핸들러 (상황별 복귀) */
function exitShop(shopType) {
    // [Infinite Mode] Check
    if (game.mode === 'infinite') {
        nextInfiniteStage();
        return;
    }

    // 상점 로그 패널 숨김
    const eventBox = document.getElementById('event-content-box');
    if (eventBox) eventBox.classList.remove('shop-mode');
    const shell = document.getElementById('event-shell');
    if (shell) shell.classList.remove('shop-mode');
    const eventLogPanel = document.getElementById('event-log-panel');
    if (eventLogPanel) eventLogPanel.classList.add('is-hidden');

    // 인터넷 쇼핑이면 무조건 허브로
    if (shopType === 'shop_internet') {
        renderHub();
        return;
    }

    // [핵심] 현재 게임 상태가 '탐사(exploration)' 중이었다면 던전으로 복귀
    // ... (rest of the logic)
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
        notifyNarration(getUIText("scenario.missingActive"));
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
        title: getUIText("cityMap.patrolTitle").replace("[DISTRICT]", DISTRICTS[districtKey].name),
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
    nextAttackAttrs: [],             // [NEW] 다음 공격에만 부여되는 속성 (소모됨)
    pendingReactions: [],            // [NEW] 반응 카드 대기열
    persistentReactions: [],         // [NEW] 계획(전투 종료까지 유지되는 반응)
    handCostOverride: [],             // 이번 전투/턴 임시 코스트 오버라이드 (손패 인덱스 기준)
    nextTurnDraw: 0,                  // 다음 턴 추가 드로우
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
    head: { label: getUIText("equipSlots.head"), icon: "🪖" },
    body: { label: getUIText("equipSlots.body"), icon: "🧥" },
    legs: { label: getUIText("equipSlots.legs"), icon: "👖" },
    leftHand: { label: getUIText("equipSlots.leftHand"), icon: "✋" },
    rightHand: { label: getUIText("equipSlots.rightHand"), icon: "🤚" },
    accessory1: { label: getUIText("equipSlots.accessory1"), icon: "💍" },
    accessory2: { label: getUIText("equipSlots.accessory2"), icon: "💍" }
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

function getEquipmentBonusStats(equipment) {
    const base = { str: 0, con: 0, dex: 0, int: 0, wil: 0, cha: 0 };
    if (!equipment) return base;
    for (let slotKey in equipment) {
        const name = equipment[slotKey];
        if (!name) continue;
        const data = ITEM_DATA?.[name];
        const bonus = data?.bonusStats;
        if (!bonus) continue;
        for (let key in base) {
            base[key] += Number(bonus[key] || 0);
        }
    }
    return base;
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
    if (cardData.group === 'status') return getUIText("cardLabel.status");
    if (cardData.group === 'curse') return getUIText("cardLabel.curse");
    return cardData.group;
}

function getCardTypeLabel(cardData) {
    if (!cardData || !cardData.type) return "";
    if (cardData.stakeout) return getUIText("cardLabel.plan");
    if (cardData.reaction) return getUIText("cardLabel.reaction");
    if (cardData.type === "attack" || (typeof cardData.type === "string" && cardData.type.includes("attack"))) return getUIText("cardLabel.attack");
    if (cardData.type === "skill") return getUIText("cardLabel.skill");
    if (cardData.type === "power") return getUIText("cardLabel.power");
    if (cardData.type === "social") {
        const st = cardData.subtype || "";
        if (st === "attack") return getUIText("cardLabel.attack");
        if (st === "power") return getUIText("cardLabel.power");
        // defend/skill/magic/trick 등은 소셜 내에서 스킬 취급
        return getUIText("cardLabel.skill");
    }
    return cardData.type;
}

function ensureCardSystems(p) {
    if (!p.handCostOverride) p.handCostOverride = [];
    if (!p.permanentCardGrowth) p.permanentCardGrowth = {};
    if (!p.powers) p.powers = {};
    if (!p.socialPowers) p.socialPowers = {};
    if (typeof p.nextTurnDraw !== 'number') p.nextTurnDraw = 0;
}

function ensureReactionSystems(p) {
    if (!p) return;
    if (!Array.isArray(p.pendingReactions)) p.pendingReactions = [];
    if (!Array.isArray(p.nextAttackAttrs)) p.nextAttackAttrs = [];
    if (!Array.isArray(p.persistentReactions)) p.persistentReactions = [];
}

function logClueGainTarget(name, amount, total) {
    if (game.state !== "battle" && game.state !== "social") return;
    logNarration("system.clueGainTarget", { target: name, amount, total });
}

function logBattleByActor(actor, playerKey, enemyKey, vars = {}) {
    if (!actor) return;
    if (actor === player) logNarration(playerKey, vars);
    else logNarration(enemyKey, vars);
}

function triggerPendingReactionsOnEnemyAttack(source, target, incomingDmg) {
    ensureReactionSystems(player);
    if (!Array.isArray(player.pendingReactions) || player.pendingReactions.length === 0) return incomingDmg;
    if (!source || source === player || target !== player) return incomingDmg;

    let dmg = incomingDmg;

    const applyReaction = (r, label) => {
        if (!r || r.trigger !== "onEnemyAttack") return dmg;
        const name = label || (r.name ? `[${r.name}]` : getUIText("cardLabel.reaction"));
        if (r.block) {
            const val = Math.max(0, Number(r.block || 0));
            if (val > 0) {
                player.block += val;
                logNarration("battle.blockGain", { amount: val });
            }
        }
        if (r.assistantBlock) {
            const val = Math.max(0, Number(r.assistantBlock || 0));
            if (val > 0) {
                const mgr = ensureAssistantManager();
                if (mgr) mgr.addBlock(val);
                logNarration("battle.assistantBlockGain", { amount: val });
            }
        }
        if (r.reduceDmgPct) {
            const pct = Math.max(0, Math.min(1, Number(r.reduceDmgPct || 0)));
            if (pct > 0) dmg = Math.floor(dmg * (1 - pct));
        }
        if (r.reduceDmgFlat) {
            const val = Math.max(0, Number(r.reduceDmgFlat || 0));
            if (val > 0) dmg = Math.max(0, dmg - val);
        }
        if (r.addClue && source) {
            const count = Math.max(0, Number(r.addClue || 0));
            if (count > 0) {
                const next = addClueStacks(source, count);
                logClueGainTarget(name, count, next);
            }
        }
        if (r.debuff && source) {
            const b = r.debuff;
            if (b.name) applyBuff(source, b.name, b.val);
        }
        return dmg;
    };

    const keep = [];
    player.pendingReactions.forEach(r => {
        if (!r || r.trigger !== "onEnemyAttack") {
            keep.push(r);
            return;
        }
        applyReaction(r, r.name ? `[${r.name}]` : getUIText("cardLabel.reaction"));
        const remaining = Math.max(0, Number(r.remaining ?? 1) - 1);
        if (remaining > 0) keep.push({ ...r, remaining });
    });
    player.pendingReactions = keep;

    if (Array.isArray(player.persistentReactions) && player.persistentReactions.length > 0) {
        player.persistentReactions.forEach(r => {
            applyReaction(r, r.name ? `[${r.name}]` : getUIText("cardLabel.plan"));
        });
    }

    return dmg;
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

    logNarration("system.powerGain", { card: cardName });
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

    logNarration("system.powerGainSocial", { card: cardName });
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
        logNarration("system.powerAp", { amount: apBonus });
    }

    const clueOnTurnStart = Math.max(0, Number(getTotalPowerValue('clueOnTurnStart') || 0));
    if (clueOnTurnStart > 0) {
        const alive = enemies.filter(e => e && e.hp > 0);
        if (alive.length > 0) {
            const picked = alive[Math.floor(Math.random() * alive.length)];
            const next = addClueStacks(picked, clueOnTurnStart);
            logNarration("system.clueInsight", { total: next });
        }
    }

    const assistantClueOnTurnStart = Math.max(0, Number(getTotalPowerValue('assistantClueOnTurnStart') || 0));
    if (assistantClueOnTurnStart > 0) {
        const mgr = ensureAssistantManager();
        if (mgr && mgr.isAlive()) {
            const alive = enemies.filter(e => e && e.hp > 0);
            if (alive.length > 0) {
                const picked = alive[Math.floor(Math.random() * alive.length)];
                const next = addClueStacks(picked, assistantClueOnTurnStart);
                logNarration("system.clueAssistant", { total: next });
            }
        }
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
        logNarration("system.powerAp", { amount: apBonus });
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
    logNarration("system.powerCostZero", { card: player.hand[idx] });
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
        logNarration("system.deckMix", { card: cardName, amount: count });
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
    logNarration("system.enemyDeckMix", { card: cardName, amount: num });
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

function ensureCurseCardForTrait(traitKey) {
    const cardName = getCurseCardByTrait(traitKey);
    if (!cardName) return false;
    if (!Array.isArray(player.deck)) player.deck = [];
    if (!player.deck.includes(cardName)) player.deck.push(cardName);
    return true;
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
    assistantDamageReductionPct: 0,
    assistantTauntTurns: 0,
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

const TIME_SLOTS = (typeof UI_TEXT !== "undefined" && UI_TEXT.timeSlots && Array.isArray(UI_TEXT.timeSlots.list))
    ? UI_TEXT.timeSlots.list
    : [];

function ensureTimeState() {
    if (!Number.isInteger(game.day)) game.day = 1;
    if (!Number.isInteger(game.timeIndex)) game.timeIndex = 0;
}

function getTimeLabel() {
    ensureTimeState();
    const slot = TIME_SLOTS[game.timeIndex] || TIME_SLOTS[0] || "";
    return getUIText("timeSlots.dayFormat")
        .replace("[DAY]", game.day)
        .replace("[SLOT]", slot);
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
    if (!EVENT_DATA.length) return;
    let event = EVENT_DATA[Math.floor(Math.random() * EVENT_DATA.length)];

    // 2. 선택지 버튼 생성 (choices 우선, 없으면 effect 기반 단일 버튼)
    let buttons = [];
    if (Array.isArray(event.choices) && event.choices.length > 0) {
        const title = event.titleKey ? getNarration(event.titleKey) : (event.title || "");
        const desc = event.descKey ? getNarration(event.descKey) : (event.desc || "");
        notifyNarration(`${title} ${stripHtml(desc || "")}`.trim());
        addCityLogChoices(event.choices.map(choice => ({
            text: choice.txtKey ? getUIText(choice.txtKey, choice.txt || "") : (choice.txt || ""),
            onSelect: choice.func
        })));
        return;
    }

    if (typeof event.effect === "function") {
        const resultText = event.effect();
        const icon = event.icon || "";
        const desc = event.descKey ? getNarration(event.descKey) : (event.desc || "");
        const btnLabel = (game.mode === "infinite")
            ? getUIText("event.randomNextStage")
            : getUIText("event.randomConfirm");

        buttons = [{
            txt: btnLabel,
            func: () => finishEvent((game.mode === "infinite") ? "infinite" : "exploration")
        }];

        const title = event.titleKey ? getNarration(event.titleKey) : (event.title || getUIText("event.randomConfirm"));
        const parts = [
            title,
            desc ? stripHtml(desc) : "",
            resultText ? stripHtml(resultText) : ""
        ].filter(Boolean);
        notifyNarration(parts.join(" "));
        const resume = (game.mode === "infinite") ? "infinite" : "exploration";
        setTimeout(() => finishEvent(resume), 600);
    }
}

function finishEvent(resume = "exploration") {
    closePopup();
    if (resume === "infinite") {
        nextInfiniteStage();
        return;
    }
    if (resume === "exploration" && typeof renderExploration === "function") {
        renderExploration();
    }
}

/* --- 유틸리티 --- */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[array[i], array[j]] = [array[j], array[i]]; } }
/* [game.js] log 함수 수정 (통합 로그창 사용) */
function log(msg) {
    const normalized = normalizeLogMessage(msg);
    const box = document.getElementById('shared-log');
    if (box) {
        const html = (typeof applyTooltip === 'function')
            ? applyTooltip(String(normalized.html))
            : String(normalized.html);
        box.innerHTML += `<div>${html}</div>`;
        box.scrollTop = box.scrollHeight;
    }
    appendCityLogLine("", stripHtml(String(normalized.text)), false, false);
}

function logNarration(type, vars = {}) {
    log({ type, vars });
}

function mapNarrationVars(vars = {}) {
    const mapped = { ...vars };
    if (mapped.card) mapped.card = getCardDisplayName(mapped.card);
    if (mapped.item) mapped.item = getItemDisplayName(mapped.item);
    if (mapped.buff) mapped.buff = getBuffDisplayName(mapped.buff);
    if (mapped.target) mapped.target = getActorDisplayName(mapped.target);
    if (mapped.boss) mapped.boss = getActorDisplayName(mapped.boss);
    if (mapped.trait) mapped.trait = getDisplayText("traits", mapped.trait, String(mapped.trait ?? ""));
    if (mapped.place) mapped.place = getLocationDisplayName(mapped.place);
    return mapped;
}

function normalizeLogMessage(msg) {
    if (msg && typeof msg === "object" && !Array.isArray(msg)) {
        const type = msg.type || msg.path || "";
        const vars = mapNarrationVars(msg.vars || {});
        const fallback = msg.text || msg.raw || "";
        if (type) {
            const narrated = getNarration(type, vars);
            if (narrated) {
                return { text: narrated, html: narrated };
            }
        }
        if (fallback) return { text: fallback, html: fallback };
    }
    const text = String(msg ?? "");
    return { text, html: text };
}

function stripHtml(text) {
    return String(text).replace(/<[^>]*>/g, '').trim();
}

function setSharedLogMessage(msg) {
    const normalized = normalizeLogMessage(msg);
    const box = document.getElementById('shared-log');
    const html = (typeof applyTooltip === 'function') ? applyTooltip(String(normalized.html)) : String(normalized.html);
    if (box) {
        box.innerHTML = `<div>${html}</div>`;
        box.scrollTop = box.scrollHeight;
    }
    appendCityLogLine("", stripHtml(String(normalized.text)), false, false);
}

function clearGlobalLog() {
    if (game.cityLog) game.cityLog.length = 0;
    const logs = [
        document.getElementById('city-dialogue-log'),
        document.getElementById('city-dialogue-log-map'),
        document.getElementById('global-log'),
        document.getElementById('shared-log')
    ].filter(Boolean);
    logs.forEach(logEl => {
        logEl.innerHTML = "";
    });
}

function notifyNarration(text) {
    log({ type: "system.notice", vars: { text }, text });
}

function showNarrationChoice(desc, choices) {
    notifyNarration(stripHtml(desc));
    if (game.state === 'hub') {
        setHubPanelVisible(true);
    } else if (game.state === 'city') {
        const mapMode = document.getElementById('city-map-mode');
        const areaMode = document.getElementById('city-area-mode');
        const mapVisible = mapMode && !mapMode.classList.contains('hidden');
        const areaVisible = areaMode && !areaMode.classList.contains('hidden');
        if (areaVisible) setCityPanelVisible('area', true);
        else if (mapVisible) setCityPanelVisible('map', true);
    }
    addCityLogChoices((choices || []).map(c => ({
        text: c.txt || getUIText("popup.choiceDefault"),
        onSelect: c.func
    })));
    syncCityLogPanels();
}

function getLogTargets() {
    return [
        document.getElementById('city-dialogue-log'),
        document.getElementById('city-dialogue-log-map'),
        document.getElementById('explore-dialogue-log'),
        document.getElementById('global-log'),
        document.getElementById('hub-dialogue-log'),
        document.getElementById('event-dialogue-log')
    ].filter(Boolean);
}

function addCityLogChoices(choices) {
    if (!Array.isArray(choices) || choices.length === 0) return;
    if (!game.cityLog) game.cityLog = [];
    if (!game.cityLogSeq) game.cityLogSeq = 0;
    if (!game.cityLogChoiceHandlers) game.cityLogChoiceHandlers = {};
    const id = ++game.cityLogSeq;
    game.cityLogChoiceHandlers[id] = choices.map(c => c.onSelect);
    game.cityLog.push({
        type: "choices",
        id,
        choices: choices.map(c => c.text),
        resolved: false,
        selectedText: null
    });
    syncCityLogPanels();
}

function resolveCityLogChoice(id, index) {
    if (!game.cityLog || !game.cityLogChoiceHandlers) return;
    const entry = game.cityLog.find(e => e && e.type === "choices" && e.id === id);
    if (!entry || entry.resolved) return;
    const handlers = game.cityLogChoiceHandlers[id] || [];
    entry.resolved = true;
    entry.selectedText = entry.choices[index] || getUIText("popup.choiceDefault");
    appendCityLogLine("", `${getUIText("popup.choiceDefault")}: ${entry.selectedText}`, true, false);
    syncCityLogPanels();
    const handler = handlers[index];
    if (typeof handler === "function") handler();
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
            const critTitle = getUIText("battle.damageCritTitle");
            const critPrefix = getUIText("battle.damageCritPrefix");
            el.innerHTML = `<span style="font-size:0.6em">${critTitle}</span><br>${msg.replace(critPrefix, '')}`;
        } else {
            el.innerText = msg;
        }

        targetEl.appendChild(el);

        setTimeout(() => { el.remove(); }, 800);
    }
}
function createBattleCheckpoint() {
    const safeClone = (obj) => JSON.parse(JSON.stringify(obj, (key, value) => {
        if (key === "owner") return null;
        return value;
    }));
    battleCheckpoint = {
        // 객체를 깊은 복사(Deep Copy)하여 현재 상태와 분리
        player: safeClone(player),
        enemies: safeClone(enemies),
        game: safeClone(game)
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
    game.winAutoAdvanceDelay = 0;
    game.winRewardLogged = false;

    let rewardGold = 1000 * (player.lucky ? 2 : 1);
    player.gold += rewardGold;

    let gainXp = 40 + (game.level * 10);
    player.xp += gainXp;
    game.lastWinReward = { gold: rewardGold, xp: gainXp };

    game.winMsg = getUIText("battle.winMsgSurrender")
        .replace("[GOLD]", rewardGold)
        .replace("[XP]", gainXp);
    if (player.lucky) game.winMsg += getUIText("battle.winLuckySuffix");

    // 일반 승리와 동일하게 전리품 처리
    game.pendingLoot = null;
    if (Math.random() < 0.5) {
        game.pendingLoot = getRandomItem(null, { categories: ["general"] });
        const lootLine = getUIText("battle.lootOnGround");
        game.winMsg += `<br>${lootLine}`;
    }

    updateUI();
    renderWinPopup();
}

/* [NEW] 소셜 NPC 전투 데이터 생성 */
function createNpcEnemyData(npcKey, index = 0) {
    let data = NPC_DATA[npcKey];
    if (!data) return null;

    const logicShieldType = data.logicShield;
    const buffs = {};
    if (logicShieldType === "silence") buffs["침묵"] = 1;
    else if (logicShieldType === "liar") buffs["거짓말"] = 1;
    else if (logicShieldType === true) buffs["거짓말"] = 1;

    return {
        id: index,
        npcKey,
        name: data.name,
        maxHp: 100, hp: 100, // 의지 게이지
        baseAtk: data.baseAtk || 0,
        baseDef: data.baseDef || 0,
        baseSpd: data.baseSpd || 2,
        block: 0, buffs,
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
    const result = { icon: "❓", tooltip: getUIText("battleIntent.unknown"), damageText: "" };
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
        const expected = getUIText("battleIntent.expectedDamage")
            .replace("[DAMAGE]", result.damageText);
        result.tooltip += expected;
    };

    if (data.special === "summon") {
        result.icon = "📢";
        result.tooltip = getUIText("battleIntent.summon");
        return result;
    }

    if (data.type === "social") {
        const isAttack = data.subtype === "attack";
        result.icon = isAttack ? "💬" : "🗣️";
        result.tooltip = isAttack
            ? getUIText("battleIntent.socialAttack")
            : getUIText("battleIntent.socialDebuff");
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
        result.tooltip = isHeavy
            ? getUIText("battleIntent.heavyAttack")
            : getUIText("battleIntent.attack");
        appendDamageText(perHit);
        return result;
    }

    if (data.type === "skill") {
        if (data.block && data.block > 0) {
            result.icon = "🛡️";
            result.tooltip = getUIText("battleIntent.defend");
            return result;
        }
        if (data.buff || data.power) {
            result.icon = "✨";
            result.tooltip = getUIText("battleIntent.buff");
            return result;
        }
        result.icon = "🎲";
        result.tooltip = getUIText("battleIntent.special");
        return result;
    }

    if (data.type === "power") {
        result.icon = "✨";
        result.tooltip = getUIText("battleIntent.power");
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
        document.body.addEventListener('click', function () {
            // 아직 전체화면이 아니라면 요청
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    // 아이폰(Safari) 등 API 미지원 브라우저는 조용히 무시
                    // (아이폰은 '홈 화면에 추가'로만 전체화면 가능)
                });
            }
        }, { once: true }); // ★ 딱 한 번만 실행되고 사라짐
    }

    applyStaticUIText();
    renderStartScreen();
}

function applyStaticUIText() {
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    const setHTML = (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    };

    setText("game-menu-title", getUIText("menuTile.title"));
    setText("menu-tile-status-title", getUIText("menuTile.statusTitle"));
    setText("menu-tile-status-desc", getUIText("menuTile.statusDesc"));
    setText("menu-tile-inventory-title", getUIText("menuTile.inventoryTitle"));
    setText("menu-tile-inventory-desc", getUIText("menuTile.inventoryDesc"));
    setText("menu-tile-cards-title", getUIText("menuTile.cardsTitle"));
    setText("menu-tile-cards-desc", getUIText("menuTile.cardsDesc"));
    setText("menu-tile-missions-title", getUIText("menuTile.missionsTitle"));
    setText("menu-tile-missions-desc", getUIText("menuTile.missionsDesc"));
    setText("menu-tile-options-title", getUIText("menuTile.optionsTitle"));
    setText("menu-tile-options-desc", getUIText("menuTile.optionsDesc"));
    setText("menu-tile-reset-title", getUIText("menuTile.resetTitle"));
    setText("menu-tile-reset-desc", getUIText("menuTile.resetDesc"));
    setText("menu-tile-fullscreen-title", getUIText("menuTile.fullscreenTitle"));
    setText("menu-tile-fullscreen-desc", getUIText("menuTile.fullscreenDesc"));

    setText("btn-continue", getUIText("start.continue"));
    setText("btn-new-game", getUIText("start.newGame"));
    setText("btn-infinite-mode", getUIText("start.infiniteMode"));
    setText("sc-title-mini", getUIText("scenario.miniPlaceholder"));

    setHTML("tab-consume", `${getUIText("menu.itemTabConsume")} <span id="cnt-consume" style="font-size:0.8em">(0/6)</span>`);
    setHTML("tab-equip", `${getUIText("menu.itemTabEquip")} <span id="cnt-equip" style="font-size:0.8em">(0)</span>`);
    setHTML("tab-relic", `${getUIText("menu.itemTabRelic")} <span id="cnt-relic" style="font-size:0.8em">(0)</span>`);
    setText("inventory-hint", getUIText("inventory.hint"));

    setText("storage-title", getUIText("storage.title"));
    setText("tab-storage-consume", getUIText("storage.tabConsume"));
    setText("tab-storage-equip", getUIText("storage.tabEquip"));
    setText("tab-storage-relic", getUIText("storage.tabRelic"));
    setText("storage-exit", getUIText("storage.exit"));
    setText("storage-bag-title", getUIText("storage.bagTitle"));
    setText("storage-bag-desc", getUIText("storage.bagDesc"));
    setText("storage-wh-title", getUIText("storage.warehouseTitle"));
    setText("storage-wh-desc", getUIText("storage.warehouseDesc"));

    setText("city-map-left-title", getUIText("cityUi.mapTitle"));
    setText("city-map-left-desc", getUIText("cityUi.mapDesc"));
    setText("city-action-explore", getUIText("explore.enterLabel"));
    setText("city-back-office", getUIText("cityUi.backOffice"));
    setText("city-area-left-title", getUIText("cityUi.areaTitle"));
    setText("city-area-left-desc", getUIText("cityUi.areaDesc"));
    setText("btn-case-close", getUIText("scenario.caseListClose"));
    setText("btn-area-enter", getUIText("cityArea.enterLabel"));
    setText("btn-area-back-map", getUIText("cityUi.backMap"));

    setText("tab-col-battle-label", getUIText("cardCollection.battleTab"));
    setText("tab-col-social-label", getUIText("cardCollection.socialTab"));

    setText("minimap-title", getUIText("minimap.title"));
    setHTML("minimap-legend", getUIText("minimap.legend"));

    setText("deck-title", getUIText("deck.managerTitle"));
    setText("tab-battle", getUIText("deck.tabBattle"));
    setText("tab-social", getUIText("deck.tabSocial"));
    setText("deck-close", getUIText("deck.managerClose"));
    setText("deck-active-label", getUIText("deck.activeHeader"));
    setText("deck-active-help", getUIText("deck.activeHelp"));
    setText("deck-storage-label", getUIText("deck.storageHeader"));
    setText("deck-storage-help", getUIText("deck.storageHelp"));

    setText("btn-draw-pile-floating", `${getUIText("battleHud.deckLabel")}(0)`);
    setText("btn-exhaust-pile-floating", `${getUIText("battleHud.exhaustLabel")}(0)`);
    setText("btn-discard-pile-floating", `${getUIText("battleHud.discardLabel")}(0)`);
    setText("interaction-bubble", getUIText("explore.interactionBubble"));
    setText("ap-label", getUIText("battleHud.apLabel"));
    setHTML("end-turn-btn", getUIText("battleHud.endTurn"));
    setText("explore-minimap-title", getUIText("explore.minimapHeader"));
    setText("explore-btn-status", getUIText("explore.actionStatus"));
    setText("explore-btn-inventory", getUIText("explore.actionInventory"));
    setText("explore-btn-escape", getUIText("explore.actionEscape"));

    setText("event-clear-desc", getUIText("event.clearDesc"));
    setText("res-gold-label", getUIText("event.rewardGoldLabel"));
    setText("res-xp-label", getUIText("event.rewardXpLabel"));
    setText("res-item-label", getUIText("event.rewardItemLabel"));
    setText("res-item", getUIText("event.rewardItemNone"));
    setText("event-return-office", getUIText("event.returnOffice"));

    setText("story-name", getUIText("story.namePlaceholder"));
    setText("story-text", getUIText("story.textPlaceholder"));
    setText("popup-title", getUIText("popup.titlePlaceholder"));
    setText("popup-desc", getUIText("popup.descPlaceholder"));
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
        version: "2.5",
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
        localStorage.setItem('midnight_rpg_save', JSON.stringify(saveData, (key, value) => {
            if (key === "owner") return null;
            return value;
        }));
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

        if (loadedData.version !== "2.5") {
            const remapCardName = (list, from, to) => {
                if (!Array.isArray(list)) return;
                for (let i = 0; i < list.length; i++) {
                    if (list[i] === from) list[i] = to;
                }
            };
            remapCardName(player.deck, "추리", "탐색");
            remapCardName(player.drawPile, "추리", "탐색");
            remapCardName(player.discardPile, "추리", "탐색");
            remapCardName(player.exhaustPile, "추리", "탐색");
            remapCardName(player.storage, "추리", "탐색");
        }

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
            migrateDungeonRoomTypes(DungeonSystem.map);
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
                syncCityLogPanels();
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
        notifyNarration(getUIText("misc.saveReset"));
        resetGameData();
    }
}

// [4] 데이터 삭제 (초기화)
// [수정] confirmReset: confirm -> showPopup
function confirmReset() {
    showPopup(
        getUIText("confirm.resetTitle"),
        getUIText("confirm.resetDesc"),
        [
            { txt: getUIText("confirm.resetYes"), func: resetGameData },
            { txt: getUIText("confirm.resetNo"), func: closePopup }
        ],
        "",
        { forcePopup: true }
    );
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
    container.innerHTML = `
        <h2 style="color:#f1c40f">${getUIText("char.jobSelectTitle")}</h2>
        <div class="hub-grid" id="job-list"></div>
        <div style="margin-top:20px; text-align:center;">
             <button class="action-btn" style="background:#7f8c8d; width:200px;" onclick="renderStartScreen()">${getUIText("char.jobBack")}</button>
        </div>
    `;

    const list = document.getElementById('job-list');
    for (let key in JOB_DATA) {
        let job = JOB_DATA[key];
        let el = document.createElement('div');
        // [FIX] 호버 움직임 제거 클래스 추가
        el.className = 'hub-card no-hover-move';
        // [FIX] 흰 배경, 검은 글씨, 호버 움직임 제거
        el.style.background = "#fff";
        el.style.color = "#000";
        el.style.transform = "none";
        el.style.transition = "none";

        // title color
        el.innerHTML = `
            <div class="hub-card-title" style="color:#000; font-weight:bold;">${job.name}</div>
            <div class="hub-card-desc" style="color:#333;">${job.desc}</div>
            <div style="font-size:0.7em; color:#555; margin-top:5px;">
                💪${job.baseStats.str} ❤️${job.baseStats.con} ⚡${job.baseStats.dex}<br>
                🧠${job.baseStats.int} 👁️${job.baseStats.wil} 💋${job.baseStats.cha}
            </div>
        `;
        // 호버 시 움직임 제거를 위해 클래스 대신 인라인 스타일 강제 (CSS 우선순위 고려)
        el.onmouseenter = function () { this.style.borderColor = "#f1c40f"; };
        el.onmouseleave = function () { this.style.borderColor = "#444"; };

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
    tempBonusStats = { str: 0, con: 0, dex: 0, int: 0, wil: 0, cha: 0 };

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
/* [game.js] renderTraitSelection 함수 교체 (UI 레이아웃 통일 - Light Theme) */
function renderTraitSelection() {
    calculateTP(); // TP 계산

    const container = document.getElementById('char-creation-content');

    // TP 상태 변수 및 UI 텍스트 설정
    let tpColor = currentTP >= 0 ? "#27ae60" : "#c0392b"; // Green / Red (Darker for light theme visibility)
    let btnText = currentTP >= 0
        ? getUIText("char.finishReady")
        : getUIText("char.finishNeedPoints").replace("[POINTS]", currentTP);
    let btnDisabled = currentTP < 0 ? "disabled" : "";

    // 직업 기본 정보 가져오기
    let base = JOB_DATA[tempJob].baseStats;
    const statLabels = {
        str: getUIText("char.statLabelStr"),
        con: getUIText("char.statLabelCon"),
        dex: getUIText("char.statLabelDex"),
        int: getUIText("char.statLabelInt"),
        wil: getUIText("char.statLabelWil"),
        cha: getUIText("char.statLabelCha")
    };
    const statDesc = {
        str: getUIText("char.statDescStr"),
        con: getUIText("char.statDescCon"),
        dex: getUIText("char.statDescDex"),
        int: getUIText("char.statDescInt"),
        wil: getUIText("char.statDescWil"),
        cha: getUIText("char.statDescCha")
    };


    // --- [UI 1] 스탯 조정 패널 (Light Theme) ---
    // Background: White, Text: Black, Border: Light Gray
    let statHtml = `
        <div class="hub-card no-hover-move" style="margin-bottom:15px; cursor:default; text-align:left; border-color:#ccc; background:#fff; color:#000;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:8px;">
                <h3 style="margin:0; color:#2980b9; font-size:1.1em;">${getUIText("char.statPanelTitle")}</h3>
                <div style="font-size:0.9em; color:#555;">${getUIText("char.pointsRemaining")}: <span style="color:#f39c12; font-weight:bold; font-size:1.2em;">${currentStatPoints}</span></div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
    `;

    for (let k in tempBonusStats) {
        let currentVal = base[k] + tempBonusStats[k];
        let mod = Math.floor((currentVal - 10) / 2);
        let modSign = mod >= 0 ? "+" : "";
        let modText = `<span style="color:#777; font-size:0.8em; margin-left:4px;">(${modSign}${mod})</span>`;
        // Value colors suitable for light background
        let valColor = tempBonusStats[k] > 0 ? "#27ae60" : (tempBonusStats[k] < 0 ? "#c0392b" : "#333");

        // [Unified Style] Use .char-stat-row class (defined in CSS now)
        statHtml += `
            <div class="char-stat-row">
                <div title="${statDesc[k]}" style="color:#333; font-weight:bold; width:80px;">${statLabels[k]}</div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="small-btn" onclick="adjustStat('${k}', -1)" style="width:28px; height:28px; background:#f0f0f0; border:1px solid #ccc; color:#000;">-</button>
                    <span style="width:60px; text-align:center; font-weight:bold; color:${valColor}; font-size:1.1em;">${currentVal} ${modText}</span>
                    <button class="small-btn" onclick="adjustStat('${k}', 1)" style="width:28px; height:28px; background:#f0f0f0; border:1px solid #ccc; color:#000;">+</button>
                </div>
            </div>
        `;
    }
    statHtml += `</div><div style="font-size:0.8em; color:#777; margin-top:10px; text-align:center;">${getUIText("char.statHint")}</div></div>`;

    // --- [UI 2] 특성 선택 패널 (Light Theme) ---
    let traitHtml = `
        <div class="hub-card no-hover-move" style="margin-bottom:15px; cursor:default; text-align:left; border-color:#ccc; height: 100%; background:#fff; display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:8px;">
                <h3 style="margin:0; color:#8e44ad; font-size:1.1em;">${getUIText("char.traitSelectTitle")}</h3>
                <div style="font-size:0.9em; color:#555;">${getUIText("char.traitRemaining")}: <span style="color:${tpColor}; font-weight:bold; font-size:1.2em;">${currentTP}</span></div>
            </div>
            
            <div id="trait-list" style="flex:1; overflow-y:auto; padding-right:5px; display:flex; flex-direction:column; gap:6px;"></div>
        </div>
    `;

    // --- [UI 3] 전체 조립 ---
    // [Request] Removed text-shadow from h2
    container.innerHTML = `
        <h2 style="color:#111; margin-bottom:15px;">${getUIText("char.detailTitle")}</h2>
        <div class="char-creation-split">
            <div class="char-col-left">
                ${statHtml}
                
                <div style="position:sticky; bottom:10px; z-index:10;">
                    <button id="btn-finish-creation" class="action-btn" style="margin-top:10px; width:100%; height:50px; font-size:1.1em; background:#ffffff; border:1px solid #111; box-shadow:none;" onclick="finishCreation()" ${btnDisabled}>
                        ${btnText}
                    </button>
                    <button class="action-btn" style="margin-top:8px; width:100%; background:#ffffff; border:1px solid #111; box-shadow:none;" onclick="renderJobSelection()">${getUIText("char.finishBack")}</button>
                </div>
            </div>
            
            <div class="char-col-right">
                ${traitHtml}
            </div>
        </div>
    `;

    // 특성 목록 생성
    const list = document.getElementById('trait-list');
    let jobDefaults = JOB_DATA[tempJob].defaultTraits || [];

    for (let key in TRAIT_DATA) {
        let t = TRAIT_DATA[key];

        // 직업 전용 특성 필터링
        if (t.type === 'job_unique') {
            if (!tempTraits.includes(key)) continue;
        }

        let isSelected = tempTraits.includes(key);
        let isDefault = jobDefaults.includes(key);

        // [Unified Style] 리스트 아이템 생성
        let el = document.createElement('div');
        el.className = 'char-trait-item';

        if (isSelected) el.classList.add('selected');
        if (isDefault) el.classList.add('default');

        // 비용 표시 (배지 형태)
        let costBadge = "";
        if (t.cost > 0) costBadge = `<span class="trait-cost negative">-${t.cost}P</span>`; // 포인트 차감 (나쁜 효과는 아님, 좋은 특성이라 비싼 것)
        else if (t.cost < 0) costBadge = `<span class="trait-cost positive">+${Math.abs(t.cost)}P</span>`; // 포인트 획득 (나쁜 특성)
        else costBadge = `<span class="trait-cost neutral">${getUIText("char.traitCostBase")}</span>`;

        // 아이콘/체크마크
        let icon = isSelected ? "✅" : "⬜";
        if (isDefault) icon = "🔒";

        el.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; width:100%;">
                <div style="font-size:1.2em;">${icon}</div>
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="color:${isSelected ? '#000' : '#444'}; font-size:1em;">${t.name}</b>
                        ${costBadge}
                    </div>
                    <div style="font-size:0.85em; color:#666; margin-top:2px; line-height:1.3;">${t.desc}</div>
                </div>
            </div>
        `;

        if (isDefault) {
            el.onclick = () => notifyNarration(getUIText("misc.jobTraitLocked"));
            el.style.cursor = "default";
            el.style.opacity = "0.8";
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

    // [Infinite Mode Check]
    if (tempGameMode === 'infinite') {
        game.mode = 'infinite';
        game.state = 'battle'; // 바로 전투 준비로 진입
    } else {
        game.mode = 'normal';
        game.state = 'hub';
    }

    game.activeScenarioId = null;
    game.scenario = null;

    // 데이터 적용
    player.job = tempJob;
    player.img = JOB_DATA[tempJob].img;
    player.traits = [...tempTraits];

    // [STEP 1] 직업 기본 스탯 적용
    player.stats = { ...JOB_DATA[tempJob].baseStats };

    // [STEP 2] 보너스 스탯 합산 (스탯 포인트로 찍은 것)
    for (let k in tempBonusStats) {
        if (player.stats[k] !== undefined) {
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
    // 저주 트레잇은 덱에 저주 카드를 고정으로 추가
    player.traits.forEach(tKey => ensureCurseCardForTrait(tKey));

    // [STEP 4] 스탯 재계산 및 유효성 검사
    recalcStats();

    // ★ [핵심] HP나 SP가 0 이하라면 생성 차단
    if (player.maxHp <= 0 || player.maxSp <= 0) {
        notifyNarration(
            getUIText("misc.survivalFail")
                .replace("[HP]", player.maxHp)
                .replace("[SP]", player.maxSp)
        );
        return;
    }

    // 통과 시 체력 회복 및 게임 시작
    player.hp = player.maxHp;
    player.sp = player.maxSp;

    if (game.mode === 'infinite') {
        startInfiniteLoop();
    } else {
        renderHub();
        autoSave(); // [추가] 생성 직후 저장
    }
}

/* [NEW] 거점 화면 렌더링 */

function isDetectiveJob() {
    return player && player.job === "detective";
}

function isWizardJob() {
    return player && player.job === "wizard";
}


function getOfficeName() {
    const area = (typeof CITY_AREA_DATA !== 'undefined' && CITY_AREA_DATA) ? CITY_AREA_DATA.east_oldtown : null;
    if (area && Array.isArray(area.spots)) {
        const spot = area.spots.find(s => s.id === "youngjin_office");
        if (spot && spot.name) return spot.name;
    }
    return getUIText("home.officeFallback");
}

function getAcademyDormName() {
    const area = (typeof CITY_AREA_DATA !== 'undefined' && CITY_AREA_DATA) ? CITY_AREA_DATA.st_jude_academy_interior : null;
    if (area && Array.isArray(area.spots)) {
        const spot = area.spots.find(s => s.id === "academy_dormitory");
        if (spot && spot.name) return spot.name;
    }
    return getUIText("home.dormFallback");
}

function getHomeMeta() {
    const cafeStyle = {
        sub: getUIText("home.cafeSub"),
        bg: "https://placehold.co/1400x800/2b1f1a/d9c2a3?text=Cafe+Hecate"
    };
    const officeStyle = {
        sub: cafeStyle.sub,
        bg: "https://placehold.co/1400x800/2b1f1a/d9c2a3?text=Detective+Office"
    };
    const officeName = getOfficeName();
    if (isDetectiveJob()) {
        return {
            tag: officeName,
            title: getUIText("home.detectiveTitle").replace("[NAME]", officeName),
            sub: officeStyle.sub,
            bg: officeStyle.bg,
            returnLabel: getUIText("home.returnOfficeShort"),
            returnLabelLong: getUIText("home.returnOfficeLong")
        };
    }
    if (isWizardJob()) {
        const dormName = getAcademyDormName();
        return {
            tag: getUIText("home.wizardTag").replace("[NAME]", dormName),
            title: getUIText("home.wizardTitle").replace("[NAME]", dormName),
            sub: getUIText("home.wizardSub"),
            bg: "https://placehold.co/1400x800/141414/ffffff?text=Academy+Dormitory",
            returnLabel: getUIText("home.returnDormShort").replace("[NAME]", dormName),
            returnLabelLong: getUIText("home.returnDormLong").replace("[NAME]", dormName)
        };
    }
    return {
        tag: getUIText("home.cafeName"),
        title: getUIText("home.cafeTitle"),
        sub: cafeStyle.sub,
        bg: cafeStyle.bg,
        returnLabel: getUIText("home.returnCafeShort"),
        returnLabelLong: getUIText("home.returnCafeLong")
    };
}

function updateHomeUI() {
    const meta = getHomeMeta();
    const hub = document.getElementById('hub-scene');
    if (hub) {
        const titleEl = document.getElementById('hub-left-title');
        const subEl = document.getElementById('hub-left-desc');
        if (titleEl) titleEl.textContent = meta.title;
        if (subEl) subEl.textContent = meta.sub;
        const mapEl = document.getElementById('hub-map');
        if (mapEl) mapEl.style.backgroundImage = `url('${meta.bg}')`;
    }

    const cityBack = document.querySelector('.city-back-btn');
    if (cityBack) cityBack.textContent = meta.returnLabel;

    const returnBtn = document.querySelector('button[onclick="returnToHub()"]');
    if (returnBtn) returnBtn.textContent = meta.returnLabelLong;
}

function setHubPanelVisible(visible) {
    const hubPanel = document.getElementById('hub-detail-panel');
    const hubShell = document.getElementById('hub-shell');
    if (!hubPanel || !hubShell) return;
    hubPanel.classList.toggle('is-hidden', !visible);
    hubShell.classList.toggle('panel-hidden', !visible);
    if (visible) syncCityLogPanels();
}
function renderHub() {
    game.state = 'hub';
    // 사무소로 돌아올 때는 던전 진행을 리셋하여 다음 진입 시 시작방에서 시작
    resetDungeonState();
    switchScene('hub');
    updateHomeUI();
    setHubPanelVisible(false);
    const layer = document.getElementById('hub-object-layer');
    if (layer) {
        layer.innerHTML = "";
        const actions = [
            { name: getUIText("hub.actionCaseName"), desc: getUIText("hub.actionCaseDesc"), pos: { x: 20, y: 30 }, func: () => openCaseFiles() },
            { name: getUIText("hub.actionCityName"), desc: getUIText("hub.actionCityDesc"), pos: { x: 58, y: 24 }, func: () => renderCityMap() },
            { name: getUIText("hub.actionCoffeeName"), desc: getUIText("hub.actionCoffeeDesc"), pos: { x: 28, y: 58 }, func: () => hubRest() },
            { name: getUIText("hub.actionShopName"), desc: getUIText("hub.actionShopDesc"), pos: { x: 70, y: 42 }, func: () => renderShopScreen('shop_internet') },
            { name: getUIText("hub.actionDeckName"), desc: getUIText("hub.actionDeckDesc"), pos: { x: 62, y: 68 }, func: () => openDeckManager() },
            { name: getUIText("hub.actionStorageName"), desc: getUIText("hub.actionStorageDesc"), pos: { x: 36, y: 78 }, func: () => openStorage() }
        ];
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'city-area-object';
            btn.style.left = `${action.pos.x}%`;
            btn.style.top = `${action.pos.y}%`;
            btn.textContent = action.name;
            btn.title = action.desc || action.name;
            btn.onclick = action.func;
            layer.appendChild(btn);
        });
    }
    updateUI(); // 상단 바 갱신
    autoSave();
}

/* [NEW] 거점 휴식 */
function hubRest() {
    const cost = 1900;
    setHubPanelVisible(true);
    if (player.gold < cost) {
        notifyNarration(getUIText("hub.coffeeNoMoney"));
        return;
    }
    showNarrationChoice(
        getUIText("hub.coffeePromptLine"),
        [
            {
                txt: getUIText("hub.coffeeDrinkOption"),
                func: () => {
                    if (player.gold < cost) {
                        notifyNarration(getUIText("hub.coffeeNoMoney"));
                        return;
                    }
                    const hpBefore = player.hp;
                    const spBefore = player.sp;
                    player.gold -= cost;
                    player.hp = player.maxHp;
                    player.sp = player.maxSp;
                    updateUI();
                    advanceTimeSlot("rest");
                    const hpGain = Math.max(0, player.hp - hpBefore);
                    const spGain = Math.max(0, player.sp - spBefore);
                    notifyNarration(
                        getUIText("hub.coffeeDrinkResult")
                            .replace("[HP]", hpGain)
                            .replace("[SP]", spGain)
                    );
                }
            },
            {
                txt: getUIText("hub.coffeeSkipOption"),
                func: () => {
                    notifyNarration(getUIText("hub.coffeeSkip"));
                }
            }
        ]
    );
}

function openHospitalCure() {
    const curseTraits = getCureTraitsByTag("medical");
    if (curseTraits.length === 0) {
        notifyNarration(getUIText("medical.noInjury"));
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
                    notifyNarration(getUIText("medical.noMoney"));
                    return;
                }
                player.gold -= cost;
                removeTrait(key);
                if (cardName) removeCardEverywhere(cardName);
                advanceTimeSlot("hospital_cure");
                notifyNarration(getUIText("medical.removeTrait").replace("[TRAIT]", t.name));
            }
        };
    });
    buttons.push({ txt: getUIText("medical.btnCancel"), func: closePopup });
    showPopup(
        getUIText("medical.hospitalTitle"),
        getUIText("medical.hospitalDesc"),
        buttons
    );
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
        notifyNarration(getUIText("medical.noOccultCurse"));
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
                    notifyNarration(getUIText("medical.noMoney"));
                    return;
                }
                player.gold -= cost;
                removeTrait(key);
                if (cardName) removeCardEverywhere(cardName);
                advanceTimeSlot("occult_cure");
                notifyNarration(getUIText("medical.removeTrait").replace("[TRAIT]", t.name));
            }
        };
    });
    buttons.push({ txt: getUIText("medical.btnHerbalShop"), func: () => renderShopScreen("shop_herbal") });
    buttons.push({ txt: getUIText("medical.btnCancel"), func: closePopup });
    showPopup(
        getUIText("medical.orientalTitle"),
        getUIText("medical.orientalDesc"),
        buttons
    );
}

function openSaunaRest() {
    if (player.hp >= player.maxHp && player.sp >= player.maxSp) {
        notifyNarration(getUIText("medical.clinicFull"));
        return;
    }
    player.hp = player.maxHp;
    player.sp = player.maxSp;
    updateUI();
    advanceTimeSlot("sauna_rest");
    notifyNarration(getUIText("medical.saunaHeal"));
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
            txt: getUIText("medical.optHeal").replace("[COST]", healCost),
            func: () => {
                closePopup();
                if (player.gold < healCost) {
                    notifyNarration(getUIText("medical.noClinicMoney"));
                    return;
                }
                player.gold -= healCost;
                player.hp = player.maxHp;
                player.sp = player.maxSp;
                updateUI();
                advanceTimeSlot("clinic_heal");
                notifyNarration(getUIText("medical.clinicFull"));
            }
        },
        {
            txt: getUIText("medical.optCureAll").replace("[COST]", cureCost),
            func: () => {
                closePopup();
                if (cureTraits.length === 0) {
                    notifyNarration(getUIText("medical.noRoomCurse"));
                    return;
                }
                if (player.gold < cureCost) {
                    notifyNarration(getUIText("medical.noClinicMoney"));
                    return;
                }
                player.gold -= cureCost;
                cureTraits.forEach(key => {
                    const cardName = getCurseCardByTrait(key);
                    removeTrait(key);
                    if (cardName) removeCardEverywhere(cardName);
                });
                advanceTimeSlot("clinic_cure_all");
                notifyNarration(getUIText("medical.removeAllCurses"));
            }
        },
        {
            txt: getUIText("medical.optBuff").replace("[COST]", buffCost),
            func: () => {
                closePopup();
                if (player.gold < buffCost) {
                    notifyNarration(getUIText("medical.noClinicMoney"));
                    return;
                }
                player.gold -= buffCost;
                applyBuff(player, "활력", 3);
                applyBuff(player, "건강", 2);
                applyBuff(player, "쾌속", 2);
                updateUI();
                advanceTimeSlot("clinic_buff");
                notifyNarration(getUIText("medical.clinicBuff"));
            }
        },
        { txt: getUIText("medical.btnClinicShop"), func: () => renderShopScreen("shop_clinic") },
        { txt: getUIText("medical.btnClose"), func: closePopup }
    ];

    showPopup(
        getUIText("medical.clinicTitle"),
        getUIText("medical.clinicDesc"),
        buttons
    );
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

    // 카운트/라벨 갱신
    document.getElementById('deck-count').innerText = targetDeck.length;
    const deckTitle = document.getElementById('deck-title');
    if (deckTitle) deckTitle.textContent = getUIText("deck.managerTitle");
    const deckClose = document.getElementById('deck-close');
    if (deckClose) deckClose.textContent = getUIText("deck.managerClose");
    const tabBattle = document.getElementById('tab-battle');
    if (tabBattle) tabBattle.textContent = getUIText("deck.tabBattle");
    const tabSocial = document.getElementById('tab-social');
    if (tabSocial) tabSocial.textContent = getUIText("deck.tabSocial");
    const activeLabel = document.getElementById('deck-active-label');
    if (activeLabel) activeLabel.textContent = getUIText("deck.activeHeader");
    const storageLabel = document.getElementById('deck-storage-label');
    if (storageLabel) storageLabel.textContent = getUIText("deck.storageHeader");
    const activeHelp = document.getElementById('deck-active-help');
    if (activeHelp) activeHelp.textContent = getUIText("deck.activeHelp");
    const storageHelp = document.getElementById('deck-storage-help');
    if (storageHelp) storageHelp.textContent = getUIText("deck.storageHelp");

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
        notifyNarration(getUIText("deck.notEnoughCards"));
        return;
    }

    let card = targetDeck[deckIdx];
    if (isPenaltyCard(card, 'curse')) {
        notifyNarration(getUIText("deck.cannotRemoveCurse"));
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
    game.profilingGauge = 0;
    game.winNarrated = false;

    // 1. 플레이어 상태 초기화 (소셜 전용 스탯 설정)
    player.mental = 100;
    player.maxMental = 100;

    // 덱 교체
    if (!Array.isArray(player.socialDeck)) player.socialDeck = [];
    const validSocial = player.socialDeck.filter(name => CARD_DATA[name]);
    player.socialDeck = (validSocial.length > 0) ? validSocial : ["논리적 반박", "심호흡"];
    player.drawPile = [...player.socialDeck];
    shuffle(player.drawPile);
    player.discardPile = []; player.exhaustPile = []; player.hand = [];
    player.buffs = {}; player.block = 0; player.ag = 0;
    player.isStunned = false;
    player.isBroken = false;
    migrateThornsFromBuff(player);
    ensureThornsField(player);
    player.thorns = 0; // 소셜에선 의미 없지만 저장/표시 일관성 유지
    ensureCardSystems(player);
    player.handCostOverride = [];
    player.nextTurnDraw = 0;
    player.powers = {};        // 전투 파워(안전장치)
    player.socialPowers = {};  // 소셜 파워
    game.combatCardGrowth = {}; // 소셜에서도 '이번 전투 한정 성장' 허용
    game.innateDrawn = false;
    game.assistantDamageReductionPct = 0;
    game.assistantTauntTurns = 0;

    renderHand();

    // 2. 적(NPC) 생성 (프리뷰에서 만들어졌다면 재생성하지 않음)
    if (!preserveEnemies) {
        enemies = [];
        let npc = createNpcEnemyData(npcKey, 0);
        if (npc) enemies.push(npc);
    }
    seedEnemyIntents(true);

    let data = NPC_DATA[npcKey] || enemies[0];
    if (data) logNarration("system.socialStart", { target: data.name });

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
            showDamageText(target, getUIText("battle.damageResistText"));
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
                logNarration("system.spDamage", { amount: effectiveVal });
                showDamageText(target, `💖-${effectiveVal}`);
            } else {
                // 부정적 공격 (공포, 협박, 충격) -> 💔 상처입음
                logNarration("system.spDamageShock", { amount: effectiveVal });
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
    if (handleExpiredScenarios()) return;
    logNarration("system.openCaseFiles");
    const cityScene = document.getElementById('city-scene');
    const hubScene = document.getElementById('hub-scene');
    if (cityScene && !cityScene.classList.contains('hidden')) {
        setCityPanelVisible('area', true);
    }
    if (hubScene && !hubScene.classList.contains('hidden')) {
        setHubPanelVisible(true);
    }
    // 팝업으로 시나리오 목록 보여주기
    let content = `
        <div style="display:flex; gap:6px; justify-content:center; margin-bottom:10px;">
            <button class="small-btn" onclick="switchCaseTab('missions')">${getUIText("scenario.tabMissions")}</button>
            <button class="small-btn" onclick="switchCaseTab('clues')">${getUIText("scenario.tabClues")}</button>
        </div>
        <div id="case-tab-missions" style="display:flex; flex-direction:column; gap:10px;">
    `;

    // SCENARIOS 데이터를 순회하며 버튼 생성
    for (let id in SCENARIOS) {
        if (!isScenarioAvailable(id)) continue;
        const sc = SCENARIOS[id];
        const isActive = (game.activeScenarioId === id);
        if (isActive) {
            content += `
                <button class="action-btn" onclick="openActiveMissions()">
                    <b>${sc.title}</b> <span style="font-size:0.7em; color:#f1c40f;">${getUIText("scenario.tagActive")}</span><br>
                    <span style="font-size:0.7em;">${sc.desc}</span>
                </button>
            `;
        } else {
            content += `
                <button class="action-btn" onclick="startScenario('${id}')">
                    <b>${sc.title}</b><br>
                    <span style="font-size:0.7em;">${sc.desc}</span>
                </button>
            `;
        }
    }
    content += `</div>`;

    // 실마리 탭
    content += `<div id="case-tab-clues" style="display:none; flex-direction:column; gap:10px;">`;
    let clueCount = 0;
    for (let id in SCENARIOS) {
        if (isScenarioAvailable(id)) continue;
        if (!isScenarioLeadUnlocked(id)) continue;
        if (isScenarioExpired(id)) continue;
        const sc = SCENARIOS[id];
        const lines = getScenarioUnlockHints(id);
        const hintHtml = (lines.length > 0)
            ? lines.map(l => `<div style="font-size:0.7em; color:#777;">${l}</div>`).join("")
            : `<div style="font-size:0.7em; color:#777;">${getUIText("scenario.unlockHint")}</div>`;
        content += `
            <div class="action-btn" style="cursor:default; opacity:0.9;">
                <b>${sc.title}</b> <span style="font-size:0.7em; color:#999;">${getUIText("scenario.tagLocked")}</span><br>
                <span style="font-size:0.7em;">${sc.desc}</span>
                <div style="margin-top:6px;">${hintHtml}</div>
            </div>
        `;
        clueCount++;
    }
    if (clueCount === 0) {
        content += `<div style="color:#777; text-align:center; padding:12px 0;">${getUIText("scenario.caseListNoClue")}</div>`;
    }
    content += `</div>`;

    showPopup(
        getUIText("scenario.caseListTitle"),
        getUIText("scenario.caseListDesc"),
        [{ txt: getUIText("scenario.caseListClose"), func: closePopup }],
        content,
        { forcePopup: true }
    );
}

function switchCaseTab(tab) {
    const missions = document.getElementById('case-tab-missions');
    const clues = document.getElementById('case-tab-clues');
    if (!missions || !clues) return;
    if (tab === 'clues') {
        missions.style.display = 'none';
        clues.style.display = 'flex';
    } else {
        missions.style.display = 'flex';
        clues.style.display = 'none';
    }
}

function openActiveMissions() {
    logNarration("system.openActiveMissions");
    let content = "";
    if (game.activeScenarioId && SCENARIOS[game.activeScenarioId]) {
        const sc = SCENARIOS[game.activeScenarioId];
        const stored = game.activeScenarioState && game.activeScenarioState[game.activeScenarioId];
        const activeScenario = (game.scenario && game.scenario.id === game.activeScenarioId) ? game.scenario : stored;
        const isActive = !!(activeScenario && activeScenario.isActive);
        const progress = (Number.isFinite(activeScenario?.clues)) ? `${activeScenario.clues}%` : getUIText("progress.pending");
        const locationText = Array.isArray(sc.locations) ? sc.locations.join(", ") : (sc.location || "");

        content = `
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="font-weight:bold; font-size:1.05em;">${sc.title}</div>
                <div style="font-size:0.85em; color:#aaa;">${sc.desc || ""}</div>
                <div style="font-size:0.85em; color:#f1c40f;">${getUIText("scenario.progressLabel")}: ${progress}</div>
                ${locationText ? `<div style="font-size:0.8em; color:#777;">${getUIText("scenario.locationLabel")}: ${locationText}</div>` : ""}
            </div>
        `;
    } else {
        content = `<div style="color:#777;">${getUIText("scenario.activeNone")}</div>`;
    }

    showPopup(getUIText("scenario.activeTitle"), getUIText("scenario.activeDesc"), [
        { txt: getUIText("scenario.caseListClose"), func: closePopup }
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

    console.log("스토리 엔진 비활성화: 바로 수락.");
    acceptMission(id);
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
    let targetDistrictName = getUIText("cityMap.unknownDistrict");
    for (let dKey in DISTRICTS) {
        if (DISTRICTS[dKey].scenarios.includes(id)) {
            targetDistrictName = DISTRICTS[dKey].name;
            break;
        }
    }

    // 스토리가 끝난 후에는 'story-scene'에 있으므로, 다시 'hub'나 'city'로 보내줘야 함
    renderHub(); // 사무소 화면으로 복귀
    setHubPanelVisible(true);

    // 알림은 로그로만 출력 (확인 버튼 제거)
    setTimeout(() => {
    notifyNarration(
        getUIText("scenario.accepted")
            .replace("[TITLE]", scData.title)
            .replace("[DISTRICT]", targetDistrictName)
    );
    }, 100);

    updateUI();
}

// 교체 성공 시 실행할 콜백 저장 변수
let tempSwapCallback = null;

function showItemGainPopup(name) {
    if (!name) return;
    const data = ITEM_DATA ? ITEM_DATA[name] : null;
    const icon = data?.icon || "🎁";
    const displayName = getItemDisplayName(name);
    const desc = data?.desc ? `<br><span style="color:#aaa; font-size:0.9em;">${data.desc}</span>` : "";
    showPopup(
        getUIText("popup.itemGainTitle"),
        getUIText("popup.itemGainDesc")
            .replace("[ICON]", icon)
            .replace("[ITEM]", displayName)
            .replace("[DESC]", desc),
        [],
        "",
        { forcePopup: true }
    );
    setTimeout(() => {
        closePopup();
    }, 1200);
}

// [수정] addItem 함수: 중복 체크 범위 확대 (창고 포함)
function addItem(name, onAcquireCallback = null) {
    let data = ITEM_DATA[name];
    if (!data) return false;

    // [CASE A] 유물 (Passive)
    if (data.usage === "passive") {
        // [★핵심] 보유 중이거나 '창고'에 있어도 중복 획득 불가
        if (hasItemAnywhere(name)) return false;

        player.relics.push(name);
        showItemGainPopup(name);

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
        showItemGainPopup(name);

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
            showItemGainPopup(name);
            updateInventoryUI();
            if (onAcquireCallback) onAcquireCallback();
            return true;
        } else {
            logNarration("system.inventoryFull");
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
        (mode === 'consume') ? getUIText("menu.itemTabConsume") : (mode === 'equip' ? getUIText("menu.itemTabEquip") : getUIText("menu.itemTabRelic"));

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
    const displayName = getItemDisplayName(name);
    let el = document.createElement('div');
    el.className = 'shop-item'; // 기존 스타일 재사용
    el.style.width = "60px";
    el.style.margin = "5px";

    el.innerHTML = `
        <div class="item-icon item-rank-${data.rank}" style="width:50px; height:50px; font-size:1.2em; pointer-events:none;">
            ${data.icon}
        </div>
        <div style="font-size:0.7em; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:60px;">${displayName}</div>
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
        notifyNarration(getUIText("inventory.noSpace"));
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
        const displayName = getItemDisplayName(itemName);
        content += `
            <button class="hub-card" onclick="processItemSwap(${idx}, '${newItemName}')" style="display:flex; flex-direction:column; align-items:center; gap:5px; padding:10px; border:1px solid #555;">
                <div class="item-icon item-rank-${item.rank}" style="pointer-events:none;">${item.icon}</div>
                <div style="font-size:0.8em; font-weight:bold; color:#ddd;">${displayName}</div>
                <div style="font-size:0.7em; color:#e74c3c;">${getUIText("inventory.swapDiscard")}</div>
            </button>
        `;
    });
    content += `</div>`;

    // 2. 콜백 저장
    tempSwapCallback = onSuccess;

    // 3. 팝업 띄우기
    showPopup(
        getUIText("inventory.swapTitle"),
        `${getUIText("inventory.swapNoSpace")}`.replace("[ITEM]", getItemDisplayName(newItemName)),
        [
            {
                txt: getUIText("inventory.swapGiveUp"),
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
    logNarration("system.swapItem", { old: getItemDisplayName(oldItem), new: getItemDisplayName(newItemName) });

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
        logNarration("system.itemPassive", { item: name });
        return;
    }

    // 전투 중 공격 아이템 체크
    if (data.effect === "damage" && (game.state !== "battle" || game.turnOwner !== "player") && !isSocialGift) {
        logNarration("system.battleTurnOnly");
        return;
    }

    let used = false;
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;

    // --- 1. 소셜 모드 선물하기 ---
    if (isSocialGift) {
        logNarration("system.giftItem", { item: name });

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
            logNarration("system.giftGreat");
            playAnim(targetId, 'anim-bounce');
        }
        else if (isDislike) {
            score = -30; // 싫어하는 물건: 멘탈 타격 (공포/혐오)
            logNarration("system.giftBad");
            playAnim(targetId, 'anim-hit');
        }
        else {
            score = 10; // 그저 그런 물건: 소소한 호감
            logNarration("system.giftOk");
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
                logNarration("system.attrGranted", { attr: attrNames, turns: data.duration });

                playAnim("player-char", "anim-bounce");
                used = true;
                break;
            case "heal": {
                let healAmt = Math.min(target.maxHp - target.hp, data.val);
                target.hp += healAmt;
                if (Number.isFinite(data.healSp) && data.healSp > 0) {
                    let spHeal = Math.min(target.maxSp - target.sp, data.healSp);
                    target.sp += spHeal;
                    logNarration("system.healBoth", { hp: healAmt, sp: spHeal });
                } else {
                    logNarration("system.healHp", { hp: healAmt });
                }
                playAnim(targetId, 'anim-bounce');
                used = true;
                break;
            }
            case "damage":
                logNarration("system.throwItem", { item: name });
                takeDamage(target, data.val);
                used = true;
                break;
            // ★ [추가] 탈출 아이템 효과 처리
            case "escape":
                logNarration("system.callFixer");
                used = true;

                // 잠시 후 복귀 처리
                setTimeout(() => {
                    showPopup(getUIText("item.escapeTitle"), getUIText("item.escapeDesc"), [
                        {
                            txt: getUIText("item.escapeGoHub"),
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
                logNarration("system.itemRest");
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
        list.innerHTML = `<div style="grid-column: 1/-1; color:#777; margin-top:50px;">${getUIText("menu.emptyParen")}</div>`;
        return;
    }

    targetArray.forEach((name, idx) => {
        let data = ITEM_DATA[name];
        const displayName = getItemDisplayName(name);
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
                <b>${displayName}</b><br>
                <span style="font-size:0.8em; color:#aaa;">${data.usage === "passive" ? getUIText("inventory.tagRelic") :
                data.usage === "equip" ? getUIText("inventory.tagEquip") :
                    getUIText("inventory.tagConsume")
            }</span><br>
                ${data.desc}
            </span>
            ${data.usage === "consume" ? `
            <div class="item-actions" id="item-actions-${idx}" style="display:none;">
                <button class="item-btn btn-confirm" onclick="confirmItemUse(event, ${idx})">${getUIText("menu.use")}</button>
            </div>` : ""}
            ${data.usage === "equip" ? `
            <div class="item-actions" id="item-actions-${idx}" style="display:none;">
                <button class="item-btn btn-confirm" onclick="confirmEquipItem(event, ${idx})">${getUIText("menu.equip")}</button>
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
            el.onclick = () => logNarration("system.relicOwned", { item: displayName });
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

function openGameMenu() {
    const el = document.getElementById('game-menu-overlay');
    if (el) el.classList.remove('hidden');
    showGameMenuHome();
}

function closeGameMenu() {
    const el = document.getElementById('game-menu-overlay');
    if (el) el.classList.add('hidden');
}

function openGameMenuAction(action) {
    showGameMenuView(action);
}

function showGameMenuHome() {
    const home = document.getElementById('game-menu-home');
    const content = document.getElementById('game-menu-content');
    const backBtn = document.getElementById('game-menu-back');
    const prevBtn = document.getElementById('game-menu-prev');
    const nextBtn = document.getElementById('game-menu-next');
    if (home) home.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    if (backBtn) backBtn.classList.add('hidden');
    if (prevBtn) prevBtn.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');

    // [New] 시작 전에는 옵션, 초기화, 전체화면만 노출
    const tilesToHide = ['menu-tile-status', 'menu-tile-inventory', 'menu-tile-cards', 'menu-tile-missions'];
    tilesToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (game.started) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });
}

let gameMenuInventoryTab = 'consume';
const GAME_MENU_ORDER = ['status', 'inventory', 'cards', 'missions', 'options', 'fullscreen', 'reset'];
let gameMenuCurrentView = null;

function showGameMenuView(view) {
    const home = document.getElementById('game-menu-home');
    const content = document.getElementById('game-menu-content');
    const backBtn = document.getElementById('game-menu-back');
    const prevBtn = document.getElementById('game-menu-prev');
    const nextBtn = document.getElementById('game-menu-next');
    if (!content) return;

    if (home) home.classList.add('hidden');
    content.classList.remove('hidden');
    if (backBtn) backBtn.classList.remove('hidden');
    if (prevBtn) prevBtn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
    gameMenuCurrentView = view;
    const order = getMenuOrderForState();
    const idx = order.indexOf(view);
    if (prevBtn) prevBtn.disabled = (idx <= 0);
    if (nextBtn) nextBtn.disabled = (idx < 0 || idx >= order.length - 1);

    const escapeHtml = (val) => String(val)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const makeItemChips = (names, limit = 10) => {
        const safeNames = Array.isArray(names) ? names.slice(0, limit) : [];
        if (safeNames.length === 0) return `<div class="menu-item-chip">${getUIText("menu.none")}</div>`;
        return safeNames.map(name => {
            const data = ITEM_DATA?.[name];
            const icon = data?.icon ? escapeHtml(data.icon) : "•";
            const displayName = getItemDisplayName(name);
            return `<div class="menu-item-chip">${icon} ${escapeHtml(displayName)}</div>`;
        }).join("");
    };

    const makeCardChips = (names, limit = 10) => {
        const safeNames = Array.isArray(names) ? names.slice(0, limit) : [];
        if (safeNames.length === 0) return `<div class="menu-item-chip">${getUIText("menu.none")}</div>`;
        return safeNames.map(name => `<div class="menu-item-chip">🃏 ${escapeHtml(getCardDisplayName(name))}</div>`).join("");
    };
    const makeTraitList = (keys, limit = 12) => {
        const safeKeys = Array.isArray(keys) ? keys.slice(0, limit) : [];
        if (safeKeys.length === 0) return `<div class="menu-pill">${getUIText("menu.none")}</div>`;
        return safeKeys.map(key => {
            const t = TRAIT_DATA?.[key] || {};
            const name = t.name || key;
            const desc = t.desc || "";
            return `
                <div class="menu-list-item">
                    <div class="menu-list-left">
                        <div class="menu-list-icon">✦</div>
                        <div class="menu-list-text">
                            <div class="menu-list-title">${escapeHtml(name)}</div>
                            <div class="menu-list-desc">${escapeHtml(desc)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    };
    const makeCardList = (names, limit = 12) => {
        const safeNames = Array.isArray(names) ? names.slice(0, limit) : [];
        if (safeNames.length === 0) return `<div class="menu-pill">${getUIText("menu.none")}</div>`;
        return safeNames.map(name => {
            const data = getEffectiveCardData(name) || CARD_DATA?.[name] || {};
            const typeLabel = getCardTypeLabel(data);
            const groupLabel = getCardGroupLabel(data);
            const displayName = getCardDisplayName(name);
            return `
                <div class="card" style="margin:0;">
                    <div class="card-cost">${data.cost ?? 0}</div>
                    <div class="card-rank">${"★".repeat(data.rank || 1)}</div>
                    <div class="card-name">${escapeHtml(displayName)}</div>
                    ${(typeLabel || groupLabel) ? `<div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin-top:4px;">
                        ${typeLabel ? `<div class="card-group-badge">[${escapeHtml(typeLabel)}]</div>` : ""}
                        ${groupLabel ? `<div class="card-group-badge">[${escapeHtml(groupLabel)}]</div>` : ""}
                    </div>` : ""}
                    <div class="card-desc">${applyTooltip(escapeHtml(data.desc || ""))}</div>
                </div>
            `;
        }).join("");
    };

    const makeMenuTabs = (tabs, active) => {
        return `
            <div class="menu-tabs">
                ${tabs.map(t => `
                    <button class="menu-tab ${t.key === active ? "active" : ""}" onclick="${t.action}">
                        ${escapeHtml(t.label)}
                    </button>
                `).join("")}
            </div>
        `;
    };

    if (view === 'status') {
        const playerContent = `
            <div class="menu-content-section">
                <div class="menu-content-label">${getUIText("menu.sectionCore")}</div>
                <div class="menu-content-grid">
                    <div class="menu-pill">HP ${player.hp}/${player.maxHp}</div>
                    <div class="menu-pill">SP ${player.sp}/${player.maxSp}</div>
                    <div class="menu-pill">Gold ${player.gold}G</div>
                    <div class="menu-pill">Lv ${game.level || 1} · XP ${player.xp}/${player.maxXp}</div>
                </div>
            </div>
            <div class="menu-content-section">
                <div class="menu-content-label">${getUIText("menu.sectionStats")}</div>
                <div class="menu-content-grid">
                    <div class="menu-pill">STR ${player.stats?.str ?? "-"}</div>
                    <div class="menu-pill">CON ${player.stats?.con ?? "-"}</div>
                    <div class="menu-pill">DEX ${player.stats?.dex ?? "-"}</div>
                    <div class="menu-pill">INT ${player.stats?.int ?? "-"}</div>
                    <div class="menu-pill">WIL ${player.stats?.wil ?? "-"}</div>
                    <div class="menu-pill">CHA ${player.stats?.cha ?? "-"}</div>
                </div>
            </div>
            <div class="menu-content-section">
                <div class="menu-content-label">${getUIText("menu.sectionTraits")}</div>
                <div class="menu-list">${makeTraitList(player.traits, 12)}</div>
            </div>
        `;

        content.innerHTML = `
            <div class="menu-content-title">${getUIText("menu.statusTitle")}</div>
            ${playerContent}
        `;
    } else if (view === 'inventory') {
        const tabs = [
            { key: 'consume', label: getUIText("menu.tabConsume"), action: "setGameMenuInventoryTab('consume')" },
            { key: 'equip', label: getUIText("menu.tabEquip"), action: "setGameMenuInventoryTab('equip')" },
            { key: 'relic', label: getUIText("menu.tabRelic"), action: "setGameMenuInventoryTab('relic')" }
        ];
        const listData = (gameMenuInventoryTab === 'consume')
            ? (player.inventory || [])
            : (gameMenuInventoryTab === 'equip')
                ? (player.equipmentBag || [])
                : (player.relics || []);
        const relicTitle = getUIText("popup.relicTitle");
        const confirmOk = getUIText("popup.confirmOk");

        const listHtml = (listData.length === 0)
            ? `<div class="menu-pill">${getUIText("menu.empty")}</div>`
            : listData.map((name, idx) => {
                const data = ITEM_DATA?.[name] || {};
                const icon = data.icon ? escapeHtml(data.icon) : "•";
                const desc = data.desc ? escapeHtml(data.desc) : "";
                const displayName = escapeHtml(getItemDisplayName(name));
                const actionBtn = (gameMenuInventoryTab === 'consume')
                    ? `<button class="small-btn" onclick="menuUseItem(${idx})">${getUIText("menu.use")}</button>`
                    : (gameMenuInventoryTab === 'equip')
                        ? `<button class="small-btn" onclick="menuEquipItem(${idx})">${getUIText("menu.equip")}</button>`
                        : `<button class="small-btn" onclick="showPopup('${escapeHtml(relicTitle)}', '${displayName}<br>${desc}', [{ txt: '${escapeHtml(confirmOk)}', func: closePopup }])">${getUIText("menu.view")}</button>`;
                return `
                    <div class="menu-list-item">
                        <div class="menu-list-left">
                            <div class="menu-list-icon">${icon}</div>
                            <div class="menu-list-text">
                                <div class="menu-list-title">${displayName}</div>
                                <div class="menu-list-desc">${desc}</div>
                            </div>
                        </div>
                        <div>${actionBtn}</div>
                    </div>
                `;
            }).join("");

        if (gameMenuInventoryTab === 'equip') {
            const slotOrder = ["head", "body", "legs", "leftHand", "rightHand", "accessory1", "accessory2"];
            const equipOwner = player.equipment;
            const equippedHtml = slotOrder.map(slotKey => {
                const meta = EQUIP_SLOT_META[slotKey];
            const equippedName = equipOwner?.[slotKey] || "";
            const equippedDisplay = equippedName ? escapeHtml(getItemDisplayName(equippedName)) : "";
            const data = equippedName ? ITEM_DATA?.[equippedName] : null;
            const icon = data?.icon ? escapeHtml(data.icon) : meta.icon;
            const desc = data?.desc ? escapeHtml(data.desc) : getUIText("menu.empty");
            const canUnequip = !!equippedName;
                const unequipBtn = canUnequip ? `<button class="small-btn" onclick="unequipSlot('${escapeHtml(slotKey)}')">${getUIText("menu.unequip")}</button>` : "";
                return `
                    <div class="menu-list-item">
                        <div class="menu-list-left">
                            <div class="menu-list-icon">${icon}</div>
                            <div class="menu-list-text">
                                <div class="menu-list-title">${meta.label}</div>
                                <div class="menu-list-desc">${equippedName ? equippedDisplay : getUIText("menu.empty")} · ${desc}</div>
                            </div>
                        </div>
                        <div>${unequipBtn}</div>
                    </div>
                `;
            }).join("");

            content.innerHTML = `
                <div class="menu-content-title">${getUIText("menu.itemTitle")}</div>
                ${makeMenuTabs(tabs, gameMenuInventoryTab)}
                <div class="menu-split">
                    <div class="menu-pane">
                        <div class="menu-content-label">${getUIText("menu.equipBagLabel")} (${player.equipmentBag?.length || 0})</div>
                        <div class="menu-list">${listHtml}</div>
                    </div>
                    <div class="menu-pane">
                        <div class="menu-content-label">${getUIText("menu.currentEquipLabel")}</div>
                        <div class="menu-list">${equippedHtml}</div>
                    </div>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="menu-content-title">${getUIText("menu.itemTitle")}</div>
                ${makeMenuTabs(tabs, gameMenuInventoryTab)}
                <div class="menu-list">${listHtml}</div>
            `;
        }
    } else if (view === 'cards') {
        content.innerHTML = `
            <div class="menu-content-title">${getUIText("menu.skillCardTitle")}</div>
            <div class="menu-content-section">
                <div class="menu-content-label">${getUIText("menu.battleDeckLabel")} (${player.deck?.length || 0})</div>
                <div class="card-grid">${makeCardList(player.deck, 12)}</div>
            </div>
            <div class="menu-content-section">
                <div class="menu-content-label">${getUIText("deck.tabSocial")} (${player.socialDeck?.length || 0})</div>
                <div class="card-grid">${makeCardList(player.socialDeck, 12)}</div>
            </div>
        `;
    } else if (view === 'missions') {
        const scId = game.activeScenarioId;
        const sc = (scId && SCENARIOS?.[scId]) ? SCENARIOS[scId] : null;
        const stored = game.activeScenarioState?.[scId];
        const activeScenario = (game.scenario && game.scenario.id === scId) ? game.scenario : stored;
        const progress = Number.isFinite(activeScenario?.clues) ? `${activeScenario.clues}%` : getUIText("progress.pending");
            content.innerHTML = `
            <div class="menu-content-title">${getUIText("menu.missionTitle")}</div>
            <div class="menu-content-section">
                <div class="menu-content-label">${getUIText("menu.missionCurrent")}</div>
                <div class="menu-pill">${sc ? escapeHtml(sc.title) : getUIText("menu.none")}</div>
                <div class="menu-pill">${getUIText("menu.missionProgress")} ${progress}</div>
            </div>
            <div class="menu-action-row">
                <button class="small-btn" onclick="openActiveMissions()">${getUIText("menu.missionDetail")}</button>
            </div>
        `;
    } else if (view === 'options') {
        content.innerHTML = `
            <div class="menu-content-title">${getUIText("menu.optionTitle")}</div>
            <div class="menu-content-section">
                <div class="menu-pill">${getUIText("menu.optionDesc")}</div>
            </div>
            <div class="menu-action-row">
                <button class="small-btn" onclick="toggleFullScreen()">${getUIText("menu.optionFullscreen")}</button>
            </div>
        `;
    } else if (view === 'fullscreen') {
        content.innerHTML = `
            <div class="menu-content-title">${getUIText("menu.optionFullscreen")}</div>
            <div class="menu-content-section">
                <div class="menu-pill">${getUIText("menu.optionFullscreenDesc")}</div>
            </div>
            <div class="menu-action-row">
                <button class="small-btn" onclick="toggleFullScreen()">${getUIText("menu.optionToggle")}</button>
            </div>
        `;
    } else if (view === 'reset') {
        content.innerHTML = `
            <div class="menu-content-title">${getUIText("menu.resetTitle")}</div>
            <div class="menu-content-section">
                <div class="menu-pill" style="border-color: rgba(231, 76, 60, 0.6);">${getUIText("menu.resetWarning")}</div>
            </div>
            <div class="menu-action-row">
                <button class="small-btn" style="background:#c0392b; border-color:#e74c3c;" onclick="confirmReset()">${getUIText("menu.resetAction")}</button>
            </div>
        `;
    } else {
        showGameMenuHome();
    }
}

function setGameMenuInventoryTab(tab) {
    gameMenuInventoryTab = tab;
    showGameMenuView('inventory');
}

function getMenuOrderForState() {
    if (!game.started) {
        return GAME_MENU_ORDER.filter(key => key === 'options' || key === 'fullscreen' || key === 'reset');
    }
    return GAME_MENU_ORDER.slice();
}

function showGameMenuPrev() {
    const order = getMenuOrderForState();
    const current = gameMenuCurrentView;
    const idx = Math.max(0, order.indexOf(current));
    if (idx <= 0) return;
    showGameMenuView(order[idx - 1]);
}

function showGameMenuNext() {
    const order = getMenuOrderForState();
    const current = gameMenuCurrentView;
    const idx = Math.max(0, order.indexOf(current));
    if (idx < 0 || idx >= order.length - 1) return;
    showGameMenuView(order[idx + 1]);
}

function menuUseItem(idx) {
    currentInvTab = 'consume';
    useItem(idx, player);
    showGameMenuView('inventory');
}

function menuEquipItem(idx) {
    currentInvTab = 'equip';
    equipItemFromBag(idx);
    setTimeout(() => showGameMenuView('inventory'), 0);
}

function renderEquipmentPanel() {
    const panel = document.getElementById('inventory-equipment-panel');
    if (!panel) return;

    ensureEquipmentFields(player);

    panel.innerHTML = `
        <div class="equipment-title">${getUIText("menu.equipSlotTitle")}</div>
        <div class="equipment-grid" id="equipment-grid"></div>
        <div class="equipment-hint">${getUIText("menu.equipSlotHint")}</div>
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
        const equippedDisplay = equippedName ? getItemDisplayName(equippedName) : "";
        const titleText = equippedName ? `${equippedDisplay}\n${desc}` : `${meta.label} ${getUIText("menu.slotLabel")}`;

        el.innerHTML = `
            <div class="equip-slot-head">
                <span class="equip-slot-icon">${meta.icon}</span>
                <span class="equip-slot-label">${meta.label}</span>
            </div>
            <div class="equip-slot-item">
                <span class="equip-slot-item-icon">${itemIcon}</span>
                <span class="equip-slot-item-name">${equippedName ? equippedDisplay : getUIText("menu.emptyParen")}</span>
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
        notifyNarration(getUIText("inventory.cannotChangeInBattle"));
        return;
    }
    const data = ITEM_DATA[name];
    if (!data || data.usage !== "equip") return;

    const slots = data.equipSlots || [];
    if (!slots.includes(slotKey)) {
        notifyNarration(
            getUIText("inventory.slotMismatch")
                .replace("[ITEM]", getItemDisplayName(name))
                .replace("[SLOT]", EQUIP_SLOT_META[slotKey]?.label || slotKey)
        );
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
        contentHTML = `<div style="color:#777; padding:10px;">${getUIText("equip.noneAvailable")}</div>`;
    } else {
        contentHTML = `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; padding:10px;">`;
        candidates.forEach(name => {
            const data = ITEM_DATA[name];
            const displayName = getItemDisplayName(name);
            contentHTML += `
                <button class="hub-card" onclick="equipItemToSlot('${escapeJs(slotKey)}','${escapeJs(name)}')" style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px; border:1px solid #555;">
                    <div class="item-icon item-rank-${data.rank}" style="pointer-events:none;">${escapeAttr(data.icon)}</div>
                    <div style="font-size:0.85em; font-weight:bold; color:#ddd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">${escapeAttr(displayName)}</div>
                    <div style="font-size:0.7em; color:#3498db;">${getUIText("menu.equip")}</div>
                </button>
            `;
        });
        contentHTML += `</div>`;
    }

    const btns = [];
    if (current) {
        btns.push({
            txt: getUIText("inventory.equipSlotUnequip").replace("[ITEM]", getItemDisplayName(current)),
            func: () => {
                unequipSlot(slotKey);
                closePopup();
            }
        });
    }
    btns.push({ txt: getUIText("medical.btnClose"), func: closePopup });

    const currentText = current ? `<span style="color:#f1c40f">${escapeAttr(getItemDisplayName(current))}</span>` : `<span style="color:#777">${getUIText("menu.emptyParen")}</span>`;
    const currentDesc = (currentData && currentData.desc) ? `<div style="margin-top:6px; font-size:0.9em; color:#cbd5e1;">${currentData.desc}</div>` : "";
    showPopup(
        `${meta.icon} ${meta.label}`,
        getUIText("inventory.equipCurrent")
            .replace("[CURRENT]", currentText)
            .replace("[DESC]", currentDesc),
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
        notifyNarration(
            getUIText("inventory.noSlotInfo")
                .replace("[ITEM]", getItemDisplayName(name))
        );
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
        const curText = cur ? getUIText("inventory.equipSlotCurrent").replace("[ITEM]", getItemDisplayName(cur)) : "";
        return { txt: `${meta.icon} ${meta.label}${curText}`, func: () => equipTo(slotKey) };
    });
    buttons.push({ txt: getUIText("inventory.equipSlotCancel"), func: closePopup });

    showPopup(
        getUIText("inventory.equipSlotTitle"),
        getUIText("inventory.equipSlotDesc").replace("[ITEM]", getItemDisplayName(name)),
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
            <div style="color:#f1c40f; font-weight:bold; margin-bottom:6px;">${getUIText("targeting.title")}</div>
            <div style="font-size:0.95em; color:#cbd5e1;">
                ${getUIText("targeting.desc")}
                <div style="margin-top:6px; font-size:0.85em; color:#94a3b8;">${getUIText("targeting.hint")}</div>
            </div>
        </div>
        <button class="small-btn" id="btn-cancel-item-targeting" style="background:#7f8c8d; pointer-events:auto;">${getUIText("inventory.cancelTargeting")}</button>
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
        notifyNarration(getUIText("misc.turnOnly"));
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
    let dungeonConfig = null;
    if (!game.dungeonMap) {
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
        try {
            DungeonSystem.generateDungeon(dungeonConfig);
            game.dungeonMap = true; // 생성 완료 플래그
        } catch (e) {
            console.error(e);
            game.dungeonMap = false;
        }
    }
    // 맵이 비어있다면 강제 재생성
    if (!Array.isArray(DungeonSystem.map) || DungeonSystem.map.length === 0) {
        game.dungeonMap = false;
        const fallbackConfig = dungeonConfig || {
            width: 5, height: 5, roomCount: 10,
            data: { "battle": 4, "event": 2, "treasure": 1 }
        };
        try {
            DungeonSystem.generateDungeon(fallbackConfig);
            game.dungeonMap = true;
        } catch (e) {
            console.error(e);
        }
    }
    if (forceReset) {
        game.locationMarkerShown = false;
    }
    // 기존 던전이 있다면 시야/패럴럭스 위치를 현재 진행도로 갱신
    if (game.dungeonMap && typeof DungeonSystem.renderView === 'function') {
        DungeonSystem.renderView();
    }
    if (game.dungeonMap && typeof DungeonSystem.renderMinimap === 'function') {
        DungeonSystem.renderMinimap('minimap-right-grid', 26);
    }
    // 이번 탐사 렌더링 이후에는 리셋 플래그 해제
    game.shouldResetDungeon = false;

    // 플레이어 이미지 연결
    const playerEl = document.getElementById('dungeon-player');
    if (playerEl) {
        if (!player.img && player.job && JOB_DATA[player.job]) {
            player.img = JOB_DATA[player.job].img;
        }
        playerEl.src = player.img || "https://placehold.co/150x150/3498db/ffffff?text=Hero";
    }

    showExplorationView();
    syncCityLogPanels();
    updateUI();
    autoSave();
    if (!game.locationMarkerShown) {
        game.locationMarkerShown = true;
        logNarration("system.locationMarker", { place: game.scenario.location });
    }
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
    document.body.classList.toggle('is-battle', isBattle);
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
        if (moveControls) moveControls.style.display = 'none';   // 이동 키 숨김
        if (dungeonActions) dungeonActions.style.display = 'none'; // 조사 버튼 등 숨김
        if (minimapBtn) minimapBtn.style.display = 'none'; // 전투 중 지도 금지
        if (minimapOverlay) minimapOverlay.classList.add('hidden'); // 큰 지도 자동 닫기
        if (minimapInline) minimapInline.classList.add('hidden');   // 상시 미니맵 닫기

        // 전투 UI 보이기 (카드, 턴 순서 등)
        battleUI.forEach(el => {
            el.classList.remove('hidden');
            el.style.display = '';
        });



    } else {
        // [탐사 복귀]
        if (moveControls) moveControls.style.display = 'flex';   // 이동 키 복구
        if (dungeonActions) dungeonActions.style.display = 'grid';
        if (minimapBtn) {
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

    // [Infinite Mode Check]
    if (game.mode === 'infinite' || (typeof tempGameMode !== 'undefined' && tempGameMode === 'infinite')) {
        notifyNarration(getUIText("battle.cannotRunHere"));
        return;
    }

    // [도시 모드] 언제든 전역 지도로 복귀
    if (DS && DS.isCity) {
        showNarrationChoice(getUIText("explore.exitToWorldPrompt"), [
            { txt: getUIText("explore.exitToWorldConfirm"), func: () => { resetDungeonState(); renderCityMap(); } },
            { txt: getUIText("popup.confirmCancel"), func: () => {} }
        ]);
        return;
    }

    // 현재 방 정보 확인
    let currentRoom = DungeonSystem.map[DungeonSystem.currentPos.y][DungeonSystem.currentPos.x];
    let isStartRoom = (currentRoom.type === 'start');

    // [CASE 1] 시작 방(입구)에 있을 때 -> 자유롭게 탈출 가능
    if (isStartRoom) {
        showNarrationChoice(getUIText("explore.exitDungeonPrompt"), [
            { txt: getUIText("explore.exitDungeonConfirm"), func: () => { handleDungeonExit(); } },
            { txt: getUIText("popup.confirmCancel"), func: () => {} }
        ]);
        return;
    }

    // [CASE 2] 던전 깊은 곳일 때 -> 아이템 체크
    let itemIdx = player.inventory.indexOf("해결사의 연락처");

    if (itemIdx !== -1) {
        // 아이템이 있다면 사용 권유
        showNarrationChoice(getUIText("explore.callFixerPrompt"), [
            {
                txt: getUIText("explore.callFixerConfirm"),
                func: () => { useItem(itemIdx, player); }
            },
            { txt: getUIText("popup.confirmCancel"), func: () => {} }
        ]);
    } else {
        // 아이템도 없다면 탈출 불가
        notifyNarration(getUIText("misc.cannotExitHere"));
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
            // 전역 지도 -> 내부 도시 구역으로 전환
            enterCityAreaMode(areaId, spotId);
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
            for (let i = 0; i < count; i++) {
                // (만약 적 종류를 섞고 싶다면 key를 다시 뽑으면 됨)
                enemies.push(createEnemyData(key, i));
            }

            log({ type: "battle.start" });

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

            setSharedLogMessage(getNarration("city.npcApproach"));

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
            if (roll < 0.75) {
                setSharedLogMessage(getUIText("explore.interesting"));
                setTimeout(() => { game.inputLocked = false; triggerRandomEvent(); }, 600);
            } else {
                setTimeout(() => {
                    game.inputLocked = false;
                    if (scData && scData.clueEvents && game.scenario && game.scenario.isActive && !game.scenario.isPatrol) {
                        let evt = scData.clueEvents[Math.floor(Math.random() * scData.clueEvents.length)];
                        game.scenario.clues = Math.min(100, game.scenario.clues + evt.gain);
                        game.doom = Math.min(100, game.doom + 5);
                        logNarration("system.clueGain");
                        setSharedLogMessage(`${evt.text}`);
                    } else {
                        let foundItem = null;
                        if (Math.random() < 0.4) { foundItem = getRandomItem(null, { categories: ["general"] }); addItem(foundItem); }
                        game.doom = Math.min(100, game.doom + 2);
                        let msg = foundItem
                            ? getUIText("explore.searchFound").replace("[ITEM]", getItemDisplayName(foundItem))
                            : getUIText("explore.searchNothing");
                        setSharedLogMessage(msg);
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
        setSharedLogMessage(getUIText("explore.moving"));

        setTimeout(() => {
            game.inputLocked = false;
            pArea.classList.remove('anim-walk');
            bg.classList.remove('anim-bg-move');

            if (scData && scData.locations) {
                let nextLoc = scData.locations[Math.floor(Math.random() * scData.locations.length)];
                while (nextLoc === game.scenario.location && scData.locations.length > 1) {
                    nextLoc = scData.locations[Math.floor(Math.random() * scData.locations.length)];
                }
                game.scenario.location = nextLoc;
                setSharedLogMessage(getUIText("explore.arrivedDistrict").replace("[PLACE]", `[${nextLoc}]`));
            } else {
                setSharedLogMessage(getUIText("explore.movedElsewhere"));
            }

            renderExploration();
        }, 1000); // 1초간 이동 연출
    }
    // --- [3] 휴식 ---
    else if (action === 'rest') {
        game.inputLocked = true;
        setSharedLogMessage(getUIText("explore.restStart"));

        setTimeout(() => {
            game.inputLocked = false;
            game.doom = Math.min(100, game.doom + 10);

            let hpHeal = 5; let spHeal = 3;
            player.hp = Math.min(player.maxHp, player.hp + hpHeal);
            player.sp = Math.min(player.maxSp, player.sp + spHeal);

            setSharedLogMessage(getUIText("explore.restHeal").replace("[HP]", hpHeal));
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
    game.winNarrated = false;

    // 3. 플레이어 상태 초기화
    // (덱이 비어있으면 기본 덱으로 복구하는 안전장치 추가)
    if (!player.deck || player.deck.length === 0) {
        player.deck = [...JOB_DATA[player.job].starterDeck];
    }
    if (!Array.isArray(player.deck)) player.deck = [];
    const validBattle = player.deck.filter(name => CARD_DATA[name]);
    player.deck = (validBattle.length > 0) ? validBattle : ["타격", "타격", "수비", "수비"];
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
    player.isStunned = false;
    player.isBroken = false;
    player.ag = 0; // 행동 게이지 초기화
    player.combatTempCards = []; // 전투 중 상태이상 카드 추적 초기화
    ensureCardSystems(player);
    player.handCostOverride = [];
    player.nextTurnDraw = 0;
    player.powers = {};
    player.pendingReactions = [];
    player.nextAttackAttrs = [];
    player.persistentReactions = [];
    game.combatCardGrowth = {}; // 전투 중 성장(이번 전투 한정)
    game.innateDrawn = false;
    game.assistantDamageReductionPct = 0;
    game.assistantTauntTurns = 0;
    if (isDetectiveJob()) {
        initAssistantForDetective();
    } else if (player.assistantManager) {
        player.assistantManager.reset(0);
    }

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
                logNarration("system.bossAppear", { boss: boss.name });
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
    // 플레이어가 선턴인데 손패가 비어있으면 첫 턴 초기화가 누락된 것으로 간주
    setTimeout(() => {
        if (game.state === "battle" && game.turnOwner === "player" && player.hand.length === 0) {
            startPlayerTurnLogic();
        }
    }, 0);
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
    // [Infinite Mode] 무한 모드 승리 처리
    else if (game.mode === 'infinite') {
        handleInfiniteWin();
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
        if (logBox) {
            logNarration("battle.victory");
            logNarration("system.clueGainAmount", { amount: clueGain });
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
                showPopup(
                    getUIText("battle.enemyTalkBreakTitle"),
                    getUIText("battle.enemyTalkBreakDesc")
                        .replace("[NAME]", unit.name),
                    [
                        { txt: getUIText("battle.enemyTalkBreakFight"), func: () => { closePopup(); forcePhysicalBattle(); } },
                        { txt: getUIText("battle.enemyTalkBreakRun"), func: () => { closePopup(); escapeSocialBattle(); } }
                    ]
                );
                return; // 턴 진행 중단
            }
        }
    }

    tickBuffs(unit);
    decrementBuffs(unit);
    if (game.state === "battle" && isDetectiveJob()) {
        const mgr = ensureAssistantManager();
        if (mgr && mgr.buffs) {
            for (let k in mgr.buffs) {
                mgr.buffs[k]--;
                if (mgr.buffs[k] <= 0) delete mgr.buffs[k];
            }
        }
        if (mgr && mgr.isAlive()) {
            const healed = mgr.heal(2);
            if (healed > 0) {
                logNarration("system.assistantTurnHeal", { amount: healed });
            }
        }
    }

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
        const enemyPlaceholder = encodeURIComponent(getUIText("misc.enemyImageText"));
        const noImgText = encodeURIComponent(getUIText("misc.noImageText"));
        let imgSrc = e.img;
        if (!imgSrc || imgSrc === "") {
            imgSrc = `https://placehold.co/100x100/555/fff?text=${enemyPlaceholder}`;
        }

        // [핵심] 뼈대를 만들 때 이미지 태그를 반드시 포함 (타겟팅 인식용)
        el.innerHTML = `
            <div style="font-weight:bold; font-size:0.9em; margin-bottom:5px;">${e.name}</div>
            <img src="${imgSrc}" alt="${e.name}" class="char-img"
                 onerror="this.src='https://placehold.co/100x100/555/fff?text=${noImgText}';">
            <div class="hp-bar-bg"><div class="hp-bar-fill" style="width:100%"></div></div>
            <div style="font-size:0.8em;">${getUIText("battleHud.hpLabel")}: ${e.hp}/${e.maxHp}</div>
        `;

        wrapper.appendChild(el);
    });
}

/* [수정] 플레이어 행동 개시 (연속 턴 방어도 유지) */
function startPlayerTurnLogic() {
    ensureCardSystems(player);
    ensureReactionSystems(player);
    if (player.pendingReactions.length > 0) {
        const before = player.pendingReactions.length;
        player.pendingReactions = player.pendingReactions.filter(r => !r?.expiresOnPlayerTurnStart);
        if (player.pendingReactions.length < before) {
            logNarration("battle.reactionGone");
        }
    }
    // 플레이어 턴 시작 시 적 의도 예고를 새로 설정
    seedEnemyIntents(true);
    // [NEW] 기절 체크
    if (player.isStunned) {
        logNarration("battle.stunned");
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
        logNarration("battle.postureRecovered");
        player.isBroken = false;
    }
    // [핵심 변경] 직전 턴이 플레이어가 아니었을 때만 방어도 초기화
    // 즉, 적이 행동하고 내 차례가 되면 방어도가 사라지지만,
    // 내가 행동하고 또 바로 내 차례가 오면(속도 차이) 방어도가 유지됨.
    if (game.lastTurnOwner !== 'player') {
        player.block = 0;
        const mgr = ensureAssistantManager();
        if (mgr) mgr.block = 0;
    } else {
        logNarration("battle.comboAction");
    }

    player.ap = 3;
    game.assistantDamageReductionPct = 0;
    if (game.assistantTauntTurns > 0) game.assistantTauntTurns -= 1;
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

    const extraDraw = Math.max(0, Number(player.nextTurnDraw || 0));
    player.nextTurnDraw = 0;
    drawCards(5 + extraDraw);
    if (game.state === 'battle') triggerAfterDrawPowers();
    else if (game.state === 'social') triggerSocialAfterDrawPowers();

    const endBtn = document.getElementById('end-turn-btn');
    if (endBtn) endBtn.disabled = false;
    // [수정] turn-info 요소가 사라졌으므로, 에러가 안 나게 체크합니다.
    const turnInfo = document.getElementById('turn-info');
    if (turnInfo) {
        turnInfo.innerText = getUIText("battleHud.turnInfo").replace("[AP]", player.ap);
    }
    // ★ [수정] player-char 대신 dungeon-player 사용
    const pImg = document.getElementById('dungeon-player');
    if (pImg) pImg.classList.add('turn-active');

    document.querySelectorAll('.enemy-unit').forEach(e => e.classList.remove('turn-active'));
    updateTurnOrderList();
    // 1. 속성 버프 턴 차감
    if (player.attrBuff.turns > 0) {
        player.attrBuff.turns--;
        if (player.attrBuff.turns === 0) {
            player.attrBuff.type = "none";
            logNarration("battle.attrExpired");
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
            logNarration("battle.cardExhausted");
        }
        player.hand = [];
        if (player.handCostOverride) player.handCostOverride = [];
    }
    renderHand();

    const pImg = document.getElementById('dungeon-player');
    if (pImg) pImg.classList.remove('turn-active');

    // ★ 중요: 내 행동이 끝났으니 다시 타임라인을 돌립니다.
    // 만약 내 속도가 압도적이라 AG가 1000 이상 남았다면? processTimeline이 즉시 나를 다시 호출함 (연속 턴)
    processTimeline();
}

/* [game.js] startEnemyTurnLogic 함수 수정 (안전장치 추가) */
async function startEnemyTurnLogic(actor) {
    if (game.lastTurnOwner === 'enemy' && game.lastEnemyTurnId === actor.id) {
        logNarration("battle.enemyComboAction");
    }
    game.lastEnemyTurnId = actor.id;
    actor.block = 0;
    actor.ap = actor.baseAp || 2;

    let el = document.getElementById(`enemy-unit-${actor.id}`);
    if (!Array.isArray(actor.intentQueue) || actor.intentQueue.length === 0) {
        setEnemyIntentQueue(actor, actor.ap || actor.baseAp || 2);
        updateUI();
    }
    // 1. 기절(Stun) 체크
    if (actor.isStunned) {
        logNarration("battle.enemyStunned");

        let el = document.getElementById(`enemy-unit-${actor.id}`);
        if (el) {
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
        logNarration("battle.enemyPostureRecovered");
        actor.isBroken = false;
        let el = document.getElementById(`enemy-unit-${actor.id}`);
        if (el) el.classList.remove('broken');
    }
    if (el) el.classList.add('turn-active');

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
        if (el) el.classList.remove('turn-active');
        await sleep(500);
        processTimeline();
    }
}

function applyWeaknessHit(atkTarget) {
    if (!atkTarget) return;
    if (atkTarget.isStunned) {
        logNarration(atkTarget === player ? "battle.enemyHitStunnedTarget" : "battle.hitStunnedTarget");
        showDamageText(atkTarget, getUIText("battle.damageCritTitle"), true);
        return;
    }
    if (atkTarget.isBroken) {
        atkTarget.isStunned = true;
        atkTarget.block = 0;
        atkTarget.ag = 0;

        if (atkTarget === player) {
            logNarration("battle.selfStunned");
        } else {
            logNarration("battle.stunSuccess", { target: atkTarget.name });
        }

        const atkTargetId = (atkTarget === player) ? "dungeon-player" : `enemy-unit-${atkTarget.id}`;
        playAnim(atkTargetId, 'anim-hit');
        showDamageText(atkTarget, getUIText("battle.damageDownText"), true);

        if (atkTarget !== player) {
            const el = document.getElementById(atkTargetId);
            if (el) el.classList.add('stunned');
        } else {
            logNarration("battle.selfStunned");
        }
        return;
    }

    atkTarget.isBroken = true;
    if (atkTarget === player) {
        logNarration("battle.postureBreakSelf");
    } else {
        logNarration("battle.postureBreakEnemy", { target: atkTarget.name });
    }
    showDamageText(atkTarget, "⚡BREAK!");

    if (atkTarget !== player) {
        const el = document.getElementById(`enemy-unit-${atkTarget.id}`);
        if (el) el.classList.add('broken');
    } else {
        logNarration("battle.postureBreakSelf");
    }
}

/* [game.js] useCard 함수 수정 (변수명 오류 수정) */
function useCard(user, target, cardName) {
    const base = CARD_DATA[cardName];
    const data = getEffectiveCardData(cardName) || base;
    if (!data) return;
    let userId = (user === player) ? "player-char" : `enemy-unit-${user.id}`;
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;

    if (user === player) {
    if (user === player) {
        logNarration("battle.cardUse", { card: cardName });
    } else {
        logNarration("battle.enemyCardUse", { card: cardName });
    }
    } else {
        logNarration("battle.enemyCardUse", { card: cardName });
    }

    if (user === player && data.requireAssistant) {
        const mgr = ensureAssistantManager();
        if (!mgr || !mgr.isAlive()) {
            logNarration("battle.noAssistant");
            return;
        }
    }

    // [반응] 적의 행동에 반응하는 카드(대기열 등록)
    if (user === player && data.reaction) {
        if (game.state !== "battle") {
            logNarration("battle.reactionOnly");
            return;
        }
        ensureReactionSystems(player);
        const cfg = data.reaction || {};
        player.pendingReactions.push({
            name: cardName,
            trigger: cfg.trigger || "onEnemyAttack",
            block: cfg.block,
            assistantBlock: cfg.assistantBlock,
            reduceDmgPct: cfg.reduceDmgPct,
            reduceDmgFlat: cfg.reduceDmgFlat,
            addClue: cfg.addClue,
            debuff: cfg.debuff,
            remaining: cfg.remaining ?? 1,
            expiresOnPlayerTurnStart: cfg.expiresOnPlayerTurnStart !== false
        });
        logBattleByActor(user, "battle.reactionReady", "battle.enemyReactionReady", { card: cardName });
        updateUI();
        return;
    }

    // [계획] 전투 종료까지 유지되는 반응
    if (user === player && data.stakeout) {
        if (game.state !== "battle") {
            logNarration("battle.planOnly");
            return;
        }
        ensureReactionSystems(player);
        const cfg = data.stakeout || {};
        player.persistentReactions.push({
            name: cardName,
            trigger: cfg.trigger || "onEnemyAttack",
            block: cfg.block,
            assistantBlock: cfg.assistantBlock,
            reduceDmgPct: cfg.reduceDmgPct,
            reduceDmgFlat: cfg.reduceDmgFlat,
            addClue: cfg.addClue,
            debuff: cfg.debuff
        });
        logBattleByActor(user, "battle.planSet", "battle.enemyPlanSet", { card: cardName });
        updateUI();
        return;
    }

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
            logBattleByActor(user, "battle.apGain", "battle.enemyApGain", { amount: v });
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
                logNarration("battle.emptyPile");
            } else if (mode === 'random') {
                for (let i = 0; i < count; i++) {
                    if (src.length === 0) break;
                    const idx = Math.floor(Math.random() * src.length);
                    const picked = src[idx];
                    if (!isCopy) src.splice(idx, 1);
                    addCardToHand(picked);
                    logNarration("battle.copyOrRecover", { card: picked, action: isCopy ? getUIText("battle.copyAction") : getUIText("battle.recoverAction") });
                }
                updateUI();
                renderHand();
            } else {
                showChooseCardFromPile(cfg.from, isCopy ? getUIText("cardPick.copyTitle") : getUIText("cardPick.fetchTitle"), (pickedName, pickedIndex) => {
                    if (!isCopy) {
                        const arr = (cfg.from === 'draw') ? player.drawPile : player.discardPile;
                        if (Array.isArray(arr) && pickedIndex >= 0 && pickedIndex < arr.length && arr[pickedIndex] === pickedName) {
                            arr.splice(pickedIndex, 1);
                        } else {
                            removeFirstCardFromPile(arr, pickedName);
                        }
                    }
                    addCardToHand(pickedName);
                    logNarration("battle.copyOrRecover", { card: pickedName, action: isCopy ? getUIText("battle.copyAction") : getUIText("battle.recoverAction") });
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
            if (game.state === "social" && user === player && target !== player) {
                if (hasLogicShield(target)) {
                    if (data.evidence) {
                        breakLogicShield(target);
                        logNarration("battle.evidenceBreak");
                        showDamageText(target, "🧠BREAK");
                        const tEl = document.getElementById(targetId);
                        if (tEl) {
                            tEl.classList.add('logic-break');
                            setTimeout(() => tEl.classList.remove('logic-break'), 300);
                        }
                    } else {
                        finalDmg = 1;
                    }
                }
            }
            takeDamage(target, finalDmg);
            // 상태이상(전투 중 임시 카드): 카드에 statusAdd가 명시된 경우만 추가
            if (game.state === 'battle' && user !== player && target === player && data.statusAdd) {
                addStatusCardToCombat(data.statusAdd.card, data.statusAdd.count || 1, data.statusAdd.destination || 'discard');
            }
        }
        if (data.heal) {
            if (user === player) {
                user.mental = Math.min(100, user.mental + data.heal);
                logNarration("system.willHeal", { amount: data.heal });
                showDamageText(user, `💚+${data.heal}`);
            } else {
                user.hp = Math.min(100, user.hp + data.heal);
            }
            updateUI();
        }
        if (data.special === "gamble_lie") {
            if (Math.random() < 0.5) {
                logNarration("battle.lieSuccess");
                takeDamage(target, 40);
            } else {
                logNarration("battle.lieFail");
                takeDamage(user, 20);
            }
        }
        if (game.state === "social" && user === player && data.profilingGain && !data.block) {
            addProfiling(data.profilingGain);
        }
    }
    else {
        if (data.special === "summon") {
            if (user === player) {
                logNarration("battle.noSummon");
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

        const shouldUseNextAttackAttrs = (user === player &&
            Array.isArray(player.nextAttackAttrs) &&
            player.nextAttackAttrs.length > 0);
        const pendingAttackAttrs = shouldUseNextAttackAttrs ? [...player.nextAttackAttrs] : null;

        const doAttackOnce = (atkTarget) => {
            if (!atkTarget) return 0;

            // 1. 공격 속성 결정 (공격 상성)
            let attackAttrs = [];
            if (data.attr) attackAttrs.push(data.attr);

            // 유저가 플레이어면 '공격 속성'만 추가 (무기/공격버프/공격형 장신구/유물 등)
            if (user === player) attackAttrs.push(...getAttackAttrs(player));
            else attackAttrs.push(...getAttackAttrs(user));
            if (pendingAttackAttrs && pendingAttackAttrs.length > 0) {
                attackAttrs.push(...pendingAttackAttrs);
            }

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
                        logNarration("battle.weaknessFound", { target: atkTarget.name });
                        updateUI();
                    }
                }
                applyWeaknessHit(atkTarget);
            }

            // 5. 데미지 계산 (기존 로직 + 치명타 복구)
            let baseAtk = getStat(user, 'atk');
            let finalDmg = 0;
            if (data.dmgByClue) {
                finalDmg = Math.max(0, clueDebuff.getStacks(atkTarget));
            } else {
                finalDmg = (data.dmg || 0) + baseAtk;
            }

            if (data.consumeClueForDamage) {
                const cfg = data.consumeClueForDamage || {};
                const consumed = clueDebuff.consumeAll(atkTarget);
                const mult = Math.max(0, Number(cfg.mult || 0));
                const bonus = Math.max(0, Number(cfg.bonus || 0));
                if (consumed > 0) {
                    finalDmg += bonus + (consumed * mult);
                    logNarration("system.clueConsume", { amount: consumed });
                }
                const triggerAt = Math.max(0, Number(cfg.triggerWeaknessHitAt || 0));
                if (triggerAt > 0 && consumed >= triggerAt) {
                    applyWeaknessHit(atkTarget);
                }
            }

            if (data.solveCase) {
                const config = data.solveCase || {};
                if (CardEffect_CheckClue(atkTarget, config.threshold || 10)) {
                    finalDmg = Math.max(finalDmg, Number(config.bonusDmg || finalDmg));
                    if (config.consume !== false) clueDebuff.consumeAll(atkTarget);
                    logNarration("system.clueConclusion");
                }
            }

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

            // [FIX] 피격 애니메이션 강제 적용 (불량배 외 다른 적/플레이어도 반응하도록)
            if (res && res.dealt >= 0 && !res.redirectedToAssistant) {
                const targetId = (atkTarget === player) ? "dungeon-player" : `enemy-unit-${atkTarget.id}`;
                playAnim(targetId, 'anim-hit');
            }

            // 상태이상(전투 중 임시 카드): 카드에 statusAdd가 명시된 경우만 추가
            if (game.state === 'battle' && user !== player && atkTarget === player && data.statusAdd) {
                addStatusCardToCombat(data.statusAdd.card, data.statusAdd.count || 1, data.statusAdd.destination || 'discard');
            }

            // 플레이어가 적 덱에 상태이상을 섞는 카드
            if (user === player && atkTarget !== player) {
                addStatusToEnemyIfNeeded(atkTarget, data.statusEnemyAdd);
                addStatusToEnemyIfNeeded(atkTarget, data.statusEnemyAdd2);
            }

            if (user === player && atkTarget !== player && data.addClue) {
                const cfg = data.addClue;
                const count = Math.max(0, Number(typeof cfg === "number" ? cfg : (cfg.count || 0)));
                const chance = (typeof cfg === "object" && cfg.chance !== undefined) ? Number(cfg.chance || 0) : 1;
                if (count > 0 && Math.random() <= chance) {
                    const next = addClueStacks(atkTarget, count);
                    logClueGainTarget(getUIText("misc.targetLabel"), count, next);
                }
            }

            if (user === player && atkTarget !== player && data.forceWeaknessHit) {
                applyWeaknessHit(atkTarget);
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
            logNarration("battle.regen", { amount: healAmt });
                    showDamageText(user, `💚+${healAmt}`);
                }
            }

            if (user === player && target !== player && data.drawOnClue) {
                const cfg = data.drawOnClue || {};
                const threshold = Math.max(1, Number(cfg.threshold || 5));
                const drawCount = Math.max(0, Number(cfg.draw || 0));
                if (drawCount > 0 && clueDebuff.getStacks(target) >= threshold) {
                    drawCards(drawCount);
                    logNarration("system.clueThresholdDraw", { threshold, amount: drawCount });
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
            if (user === player && target !== player && data.addClue) {
                const cfg = data.addClue;
                const count = Math.max(0, Number(typeof cfg === "number" ? cfg : (cfg.count || 0)));
                if (count > 0) {
                    const next = addClueStacks(target, count);
                    logClueGainTarget(getUIText("misc.targetLabel"), count, next);
                }
            }
        }

        if (user === player && shouldUseNextAttackAttrs && data.type && data.type.includes("attack")) {
            player.nextAttackAttrs = [];
            logNarration("battle.nextAttackAttr");
        }

        if (data.special === "cure_anger") {
            if (target.buffs["분노"]) { delete target.buffs["분노"]; logNarration("battle.attrExpired"); }
            if (target.buffs["우울"]) { delete target.buffs["우울"]; logNarration("battle.attrExpired"); }
        }
    }

    if (data.block) {
        let statType = (game.state === "social") ? 'socialDef' : 'def';
        let finalBlock = data.block + getStat(user, statType);
        user.block += finalBlock;
        let defenseText = (game.state === "social")
            ? getUIText("battle.defenseTextSocial")
            : getUIText("battle.defenseTextBattle");
        logBattleByActor(user, "battle.blockGain", "battle.enemyBlockGain", { amount: finalBlock });
        updateUI();
        if (game.state === "social" && user === player) {
            const gain = Number(data.profilingGain || 5);
            addProfiling(gain);
        }
    }

    if (data.buff) {
        let buffName = data.buff.name;
        let buffTarget = (data.target === "self" || ["강화", "건강", "쾌속", "활력", "가시"].includes(buffName)) ? user : target;
        applyBuff(buffTarget, buffName, data.buff.val);
    }
    if (Array.isArray(data.buffs)) {
        data.buffs.forEach(b => {
            if (!b || !b.name) return;
            let buffTarget = (data.target === "self" || ["강화", "건강", "쾌속", "활력", "가시"].includes(b.name)) ? user : target;
            applyBuff(buffTarget, b.name, b.val);
        });
    }

    if (data.draw && user === player) {
        drawCards(data.draw);
            logNarration("battle.drawCards", { amount: data.draw });
    }

    if (user === player && data.nextTurnDraw) {
        const extra = Math.max(0, Number(data.nextTurnDraw || 0));
        if (extra > 0) {
            player.nextTurnDraw += extra;
            logNarration("battle.drawNextTurn", { amount: extra });
        }
    }

    if (user === player && data.addClueAll) {
        const count = Math.max(0, Number(data.addClueAll || 0));
        if (count > 0) {
            enemies.filter(e => e && e.hp > 0).forEach(e => {
                const next = addClueStacks(e, count);
                logClueGainTarget(getUIText("misc.targetLabel"), count, next);
            });
        }
    }

    if (user === player && data.reduceAttackCostThisTurn) {
        ensureCardSystems(player);
        player.hand.forEach((cName, idx) => {
            const cData = getEffectiveCardData(cName) || CARD_DATA[cName];
            if (!cData) return;
            if (cData.type === "attack" || (typeof cData.type === "string" && cData.type.includes("attack"))) {
                player.handCostOverride[idx] = 0;
            }
        });
        renderHand();
    }

    if (user === player && data.grantNextAttackAttrs) {
        ensureReactionSystems(player);
        const list = Array.isArray(data.grantNextAttackAttrs) ? data.grantNextAttackAttrs : [data.grantNextAttackAttrs];
        player.nextAttackAttrs.push(...list.filter(Boolean));
        if (list.length > 0) {
            const icons = list.map(a => ATTR_ICONS[a] || a).join(", ");
            logNarration("battle.nextAttackAttr");
        }
    }

    if (user === player && game.state === "battle" && data.assistantDamageReductionPct) {
        const pct = Math.max(0, Number(data.assistantDamageReductionPct || 0));
        game.assistantDamageReductionPct = Math.max(game.assistantDamageReductionPct || 0, pct);
        if (pct > 0) logNarration("battle.assistantBlockGain", { amount: Math.floor(pct * 100) });
    }

    if (user === player && game.state === "battle" && data.assistantTauntTurns) {
        const turns = Math.max(0, Number(data.assistantTauntTurns || 0));
        game.assistantTauntTurns = Math.max(game.assistantTauntTurns || 0, turns);
        const block = Math.max(0, Number(data.assistantBlock || 0));
        if (block > 0) {
            const mgr = ensureAssistantManager();
            if (mgr) mgr.addBlock(block);
        }
        if (turns > 0) logNarration("battle.assistantFocus");
    }

    if (user === player && game.state === "battle" && data.assistantBuff) {
        const mgr = ensureAssistantManager();
        const buff = data.assistantBuff || {};
        if (mgr && buff.name) {
            const dur = Math.max(1, Number(buff.val || 1));
            if (!mgr.buffs) mgr.buffs = {};
            mgr.buffs[buff.name] = (mgr.buffs[buff.name] || 0) + dur;
            logNarration("battle.buffApply", { target: getUIText("misc.assistantLabel"), buff: buff.name });
        }
        const block = Math.max(0, Number(data.assistantBlock || 0));
        if (mgr && block > 0) {
            mgr.addBlock(block);
            logNarration("battle.assistantBlockGain", { amount: block });
        }
    }

    if (user === player && game.state === "battle" && data.assistantSacrifice) {
        const mgr = ensureAssistantManager();
        if (mgr && mgr.isAlive()) {
            const before = Math.max(0, Number(mgr.hp || 0));
            const after = Math.floor(before / 2);
            const removed = Math.max(0, before - after);
            mgr.hp = after;
            const apGain = Math.floor(removed / 2);
            if (apGain > 0) player.ap += apGain;
            logNarration("battle.cruelDecision");
            updateUI();
        } else {
            logNarration("battle.noAssistantEffect");
        }
    }

    // 사용 시 자기 복제(버린 카드에 추가)
    if (user === player && data.selfDuplicateToDiscard) {
        const cnt = Math.max(0, Number(data.selfDuplicateToDiscard || 0));
        for (let i = 0; i < cnt; i++) player.discardPile.push(cardName);
        if (cnt > 0) logNarration("battle.cardCopyAdded");
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
            logNarration("battle.cardGrowPermanent", { card: cardName });
            autoSave();
        } else {
            if (!game.combatCardGrowth) game.combatCardGrowth = {};
            applyGrowth(game.combatCardGrowth);
            logNarration("battle.cardGrowBattle", { card: cardName });
        }
    }

    if (user === player && data.assistantHeal) {
        const amt = Number(data.assistantHeal || 0);
        const cost = Number(data.assistantHpCost || 0);
        healAssistant(amt, cost);
    }
}

/* [NEW] 적 소환(증원) 함수 */
function summonMinion(enemyKey) {
    // 1. 소환 제한 확인 (화면에 적이 너무 많으면 소환 실패)
    // 죽은 적은 제외하고 산 적만 카운트 (최대 3~4명 제한 추천)
    let aliveCount = enemies.filter(e => e.hp > 0).length;
    if (aliveCount >= 3) {
        logNarration("battle.fieldFull");
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
        name: `${data.name}${getUIText("battle.reinforcementSuffix")}`, // 이름 뒤에 표식 추가
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
        if (createdEl) {
            createdEl.style.transform = "scale(1.1)";
            setTimeout(() => createdEl.style.transform = "scale(1)", 200);
            showDamageText(newEnemy, getUIText("battle.appearText"));
        }
    }, 50);

    logNarration("battle.reinforced", { target: data.name });
}

/* [수정] 데미지 처리 함수 (소셜 모드 완벽 지원) */
function takeDamage(target, dmg, isCrit = false, attackAttrs = null, source = null, meta = null) {
    let targetId = (target === player) ? "player-char" : `enemy-unit-${target.id}`;
    const rawDmg = dmg;
    let blocked = 0;

    if (game.state === "battle" && target === player && meta && meta.isAttack && source && source !== player) {
        dmg = triggerPendingReactionsOnEnemyAttack(source, target, dmg);
    }

    if (game.state === "battle" && target === player && isDetectiveJob()) {
        const mgr = ensureAssistantManager();
        const isEnemyAttack = !!(meta && meta.isAttack && source && source !== player);
        if (mgr && mgr.isAlive() && isEnemyAttack) {
            const forceAssist = game.assistantTauntTurns > 0;
            const redirect = forceAssist || Math.random() < 0.5;
            if (redirect) {
                let assistantDmg = dmg;
                const pct = Math.max(0, Number(game.assistantDamageReductionPct || 0));
                if (pct > 0) assistantDmg = Math.floor(assistantDmg * (1 - pct));
                const flat = Math.max(0, Number(getTotalPowerValue('assistantDamageReductionFlat') || 0));
                if (flat > 0) assistantDmg = Math.max(0, assistantDmg - flat);
                const dealt = mgr.takeDamage(assistantDmg);
                // [FIX] 조수가 피격 시 조수에게만 애니메이션 표시 (탐정에게 표시되지 않도록)
                playAnim('assistant-player', 'anim-hit');
                logNarration("battle.assistantTook", { amount: dealt });
                updateUI();
                return { raw: rawDmg, blocked: 0, dealt, redirectedToAssistant: true };
            }
        }
        if (mgr && !mgr.isAlive()) {
            dmg = Math.floor(dmg * 2);
        }
    }

    // 0. 방어 상성(저항) 적용: 공격 속성과 방어 속성이 겹치면 피해 감소
    if (game.state === "battle" && dmg > 0 && Array.isArray(attackAttrs) && attackAttrs.length > 0) {
        const defAttrs = getDefenseAttrs(target);
        if (defAttrs && defAttrs.length > 0) {
            const hit = attackAttrs.find(a => defAttrs.includes(a));
            if (hit) {
                dmg = Math.max(0, Math.floor(dmg * 0.75));
                showDamageText(target, getUIText("battle.damageResistText"));
            }
        }
    }

    // 1. 방어(멘탈 방어) 계산
    if (target.block > 0) {
        if (target.block >= dmg) {
            blocked = dmg;
            target.block -= dmg;
            dmg = 0;
            showDamageText(target, getUIText("battle.damageBlockText"));
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
                logNarration("battle.mentalDamage", { amount: dmg, mental: target.mental });
                showDamageText(target, `💔-${dmg}`);
            } else {
                target.hp -= dmg; // NPC는 hp를 의지으로 씀
                logNarration("battle.enemyMentalDamage", { amount: dmg, mental: target.hp });
                showDamageText(target, `💢-${dmg}`);
            }
        } else {
            // [수정] 전투 데미지: 치명타 시 로그 및 텍스트 변경
            target.hp -= dmg;

            if (isCrit) {
                if (target === player && source && source !== player) {
                    logNarration("battle.enemyCriticalHit", { amount: dmg, hp: target.hp });
                } else if (target === player) {
                    logNarration("battle.critical", { amount: dmg, hp: target.hp });
                } else {
                    logNarration("battle.enemyCritical", { amount: dmg, hp: target.hp });
                }
                showDamageText(target, `${getUIText("battle.damageCritPrefix")}-${dmg}`, true); // true = 치명타 스타일 적용
            } else {
                if (target === player) {
                    logNarration("battle.hpDamage", { amount: dmg, hp: target.hp });
                } else {
                    logNarration("battle.enemyHpDamage", { amount: dmg, hp: target.hp });
                }
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
                logNarration("battle.thorns", { amount: th });
                takeDamage(source, th, false, null, null, { isThorns: true });
            }
        }

        // [반사] 막히지 않은 피해(실제 받은 피해)를 그대로 반격
        if (dealt > 0 && target.buffs["반사"]) {
            logNarration("battle.reflect", { amount: dealt });
            takeDamage(source, dealt, false, null, null, { isReflect: true });
        }
    }

    updateUI();

    // 3. 사망/패배 체크 (즉시 호출하지 않고 checkGameOver가 턴 루프에서 감지하게 함)
    // 단, 플레이어 주마등 처리는 즉시 해야 함
    if (game.state !== "social" && target === player && target.hp <= 0) {
        if (!target.jumadeung) {
            target.hp = 1;
            target.jumadeung = true;
        logNarration("battle.lastStand");
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
            showPopup(
                getUIText("status.reviveTitle"),
                getUIText("status.reviveDesc").replace("[ITEM]", getItemDisplayName(reviveItem)),
                [{ txt: getUIText("popup.confirmOk"), func: closePopup }]
            );
            return false;
        }
        clearGlobalLog();
        game.state = "gameover"; // 상태 잠금
        showPopup(getUIText("status.deathTitle"), getUIText("status.deathDesc"), [
            {
                txt: getUIText("status.retryButton"),
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
        clearGlobalLog();
        game.state = "gameover"; // 상태 잠금
        showPopup(getUIText("status.insanityTitle"), getUIText("status.insanityDesc"), [
            {
                txt: getUIText("status.retryButton"),
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
            game.winMsg = `<span style='color:#3498db'>${getUIText("social.persuadeSuccess")}</span><br>${getUIText("social.persuadeBreak").replace("[NAME]", npc.name)}`;
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
                    getUIText("battle.surrenderTitle"),
                    getUIText("battle.surrenderDesc"),
                    () => triggerSurrenderWin(),
                    closePopup,
                    getUIText("battle.surrenderAccept"),
                    getUIText("battle.surrenderDecline")
                );
                return true;
            }
        }
        // 안전장치: enemies가 비어있거나 정의되지 않은 경우도 승리 처리
        if (!enemies || enemies.length === 0 || aliveEnemies.length === 0) {
            // 중복 승리 처리 방지
            if (game.state === "win") return true;

            game.state = "win";
            game.winRewardLogged = false;

            // --- 보상 계산 ---
            // 1. 골드 (럭키피스 카드 효과가 있다면 2배)
            let rewardGold = 1000 * (player.lucky ? 2 : 1);
            player.gold += rewardGold;

            // 2. 경험치 (기본 40 + 레벨당 10)
            let gainXp = 40 + (game.level * 10);
            player.xp += gainXp;
            game.lastWinReward = { gold: rewardGold, xp: gainXp };

            // 승리 메시지 생성
            game.winMsg = getUIText("battle.winMsg")
                .replace("[GOLD]", rewardGold)
                .replace("[XP]", gainXp);
            if (player.lucky) game.winMsg += getUIText("battle.winLuckySuffix");
            game.winAutoAdvanceDelay = 400;

            // 3. 전리품(아이템) 드랍 (확률 50%)
            game.pendingLoot = null;
            if (Math.random() < 0.5) {
                game.pendingLoot = getRandomItem(null, { categories: ["general"] });
                const lootLine = getUIText("battle.lootOnGround");
                game.winMsg += `<br>${lootLine}`;
            }

            // [NEW] 조수 회복 특성: 전투 종료 시 HP 6 회복
            if (isDetectiveJob() && player.assistantManager) {
                const healed = player.assistantManager.heal(6);
                if (healed > 0) {
                    const healText = getUIText("battle.assistantWinHeal")
                        .replace("[AMOUNT]", healed);
                    game.winMsg += `<br>${healText}`;
                }
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
    notifyNarration(
        getUIText("misc.winClueGain")
            .replace("[MSG]", stripHtml(game.winMsg || ""))
            .replace("[AMOUNT]", clueGain)
    );
    addCityLogChoices([{ text: getUIText("social.leaveChoice"), onSelect: nextStepAfterWin }]);
}
// [game.js] 적절한 곳(checkGameOver 근처)에 추가

function showSocialLossPopup(npcName) {
    let msg = `
        <div style="color:#e74c3c; font-size:1.2em; font-weight:bold;">${getUIText("social.lossTitle")}</div>
        <br>
        ${getUIText("social.lossDesc")}
    `;

    notifyNarration(getUIText("misc.narrationDivider").replace("[TEXT]", stripHtml(msg)));
    addCityLogChoices([
        { text: getUIText("social.forceFight"), onSelect: () => forcePhysicalBattle() },
        {
            text: getUIText("social.giveUp"),
            onSelect: () => {
                notifyNarration(getUIText("system.retreat"));
                if (game.scenario && game.scenario.isPatrol) renderCityMap();
                else renderExploration();
            }
        }
    ]);
}
/* [NEW] 무력 행사 확인 팝업 */
function confirmForceBattle() {
    showNarrationChoice(getUIText("battle.socialAttackPrompt"), [
        { txt: getUIText("battle.socialAttackConfirm"), func: () => forcePhysicalBattle() },
        { txt: getUIText("battle.socialAttackCancel"), func: () => {} }
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
    notifyNarration(getUIText("system.noBattleNpc"));
        return;
    }

    notifyNarration(getUIText("system.socialFail"));

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
    // 휴식 버튼 HTML 생성 (상태에 따라 다름)
    let restBtnHTML = "";
    if (!game.hasRested) {
        // 아직 휴식 안 함: 버튼 활성화
        restBtnHTML = `<button class="action-btn" onclick="restAction()">${getUIText("rest.actionRest")}</button>`;
    } else {
        // 이미 휴식 함: 버튼 대신 텍스트 표시
        restBtnHTML = `<button class="action-btn" disabled style="background:#555; cursor:default;">${getUIText("rest.actionRestDone")}</button>`;
    }

    const content = `
        <div class="event-desc" style="text-align:center;">
            ${getUIText("rest.desc")}<br><br>
            <span style="color:#e74c3c">${getUIText("rest.currentHp").replace("[CUR]", player.hp).replace("[MAX]", player.maxHp)}</span>
        </div>
        <div style="display:flex; justify-content:center; gap:16px; margin-top:18px;">
            ${restBtnHTML}
            <button class="action-btn" style="background:#7f8c8d" onclick="exitRestArea()">${getUIText("rest.actionLeave")}</button>
        </div>
    `;
    showPopup(getUIText("rest.title"), "", [], content);
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

    showPopup(getUIText("rest.completeTitle"),
        getUIText("rest.completeDesc")
            .replace("[HP]", actualHeal)
            .replace("[SP]", spHeal),
        [
        {
            txt: getUIText("popup.confirmOk"),
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
    logNarration("system.openShop");
    switchScene('event');

    // [핵심] 상점 전용 와이드 스타일 적용
    const container = document.getElementById('event-content-box');
    container.classList.add('shop-mode');
    const shell = document.getElementById('event-shell');
    if (shell) shell.classList.add('shop-mode');
    const eventLogPanel = document.getElementById('event-log-panel');
    if (eventLogPanel) eventLogPanel.classList.remove('is-hidden');
    syncCityLogPanels();

    // 1. 상점 설정
    let shopTitle = getUIText("shop.titleDefault");
    let shopDesc = getUIText("shop.descDefault");
    let poolRank = 1;
    let cardCount = 3;
    let itemCount = 2;
    let itemCategories = null;

    if (shopType === "shop_black_market") {
        shopTitle = getUIText("shop.titleBlack");
        shopDesc = getUIText("shop.descBlack");
        poolRank = 1;
        itemCategories = ["general"];
    } else if (shopType === "shop_pharmacy") {
        shopTitle = getUIText("shop.titlePharmacy");
        shopDesc = getUIText("shop.descPharmacy");
        poolRank = 1;
        itemCategories = ["pharmacy"];
    } else if (shopType === "shop_high_end") {
        shopTitle = getUIText("shop.titleHighEnd");
        shopDesc = getUIText("shop.descHighEnd");
        poolRank = 2;
        itemCategories = ["general"];
    } else if (shopType === "shop_occult") {
        shopTitle = getUIText("shop.titleOccult");
        shopDesc = getUIText("shop.descOccult");
        poolRank = 1;
        itemCount = 3;
        itemCategories = ["occult"];
    } else if (shopType === "shop_herbal") {
        shopTitle = getUIText("shop.titleHerbal");
        shopDesc = getUIText("shop.descHerbal");
        poolRank = 1;
        itemCount = 3;
        itemCategories = ["herbal"];
    } else if (shopType === "shop_clinic") {
        shopTitle = getUIText("shop.titleClinic");
        shopDesc = getUIText("shop.descClinic");
        poolRank = 2;
        itemCount = 3;
        itemCategories = ["pharmacy"];
    } else if (shopType === "shop_internet") {
        shopTitle = getUIText("shop.titleInternet");
        shopDesc = getUIText("shop.descInternet");
        poolRank = 1;
        itemCount = 3;
        itemCategories = ["general"];
    }

    // 2. 물품 생성
    // - 장비 전용 카드는 제외 (getRandomCardByRank에서 처리)
    // - 이미 보유한 장비는 상점에 나오지 않도록 제외
    let cardsForSale = [];
    const pickRank = () => poolRank + (Math.random() > 0.7 ? 1 : 0);
    if (cardCount > 0) {
        const commonCard = getRandomCardByRank(pickRank(), { onlyCommon: true });
        cardsForSale.push(commonCard);
    }
    for (let i = cardsForSale.length; i < cardCount; i++) {
        let card = getRandomCardByRank(pickRank(), { onlyJob: true });
        if (!card || card === "타격") card = getRandomCardByRank(pickRank());
        cardsForSale.push(card);
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
                <h3 class="shop-sec-title">${getUIText("shop.sectionCard")}</h3>
                <div class="shop-items-grid" id="shop-cards"></div>
            </div>

            <div class="shop-col">
                <h3 class="shop-sec-title">${getUIText("shop.sectionEquip")}</h3>
                <div class="shop-items-grid" id="shop-items"></div>
            </div>

            <div class="shop-col">
                <h3 class="shop-sec-title">${getUIText("shop.sectionService")}</h3>
                <div class="shop-service-box" onclick="openCardRemoval(${removeCost})">
                    <div class="service-icon">🔥</div>
                    <div class="service-info">
                        <b>${getUIText("shop.serviceRemoveTitle")}</b>
                        <span style="font-size:0.8em; opacity:0.8;">${getUIText("shop.serviceRemoveDesc")}</span>
                        <span class="shop-price-tag">${removeCost} G</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="shop-footer-area">
            <button class="action-btn" onclick="exitShop('${shopType}')" style="background:#7f8c8d; padding: 10px 30px; font-size:1.1em;">
                🚪 ${game.mode === 'infinite' ? getUIText("shop.exitNextStage") : getUIText("shop.exitLabel")}
            </button>
        </div>
    `;

    // 4. 물품 렌더링 (기존 로직 + 스타일 연결)
    const cardContainer = document.getElementById('shop-cards');
    cardsForSale.forEach(cName => {
        let data = getEffectiveCardData(cName) || CARD_DATA[cName];
        let price = data.rank * 150 + Math.floor(Math.random() * 50);
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
        const cardDisplayName = getCardDisplayName(cName);
        el.innerHTML = `
            <div class="card" style="transform:scale(0.85); margin:0;">
                <div class="card-cost">${data.cost}</div>
                <div class="card-rank">${"★".repeat(data.rank)}</div>
                <div class="card-name">${cardDisplayName}</div>
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
        const itemDisplayName = getItemDisplayName(iName);
        el.innerHTML = `
            <div class="item-icon item-rank-${data.rank}" style="width:60px; height:60px; font-size:1.5em; margin:0 auto;">
                ${data.icon}
            </div>
            <div class="shop-price">${price} G</div>
            <div style="font-size:0.8em; margin-top:5px; color:#ddd;">${itemDisplayName}</div>
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
        return getUIText("deck.labelSocial");
    }
    if (!Array.isArray(player.deck)) player.deck = [];
    player.deck.push(cardName);
    return getUIText("deck.labelBattle");
}

// [수정] buyShopItem: alert -> showPopup
function buyShopItem(el, type, name, cost) {
    if (el.classList.contains('sold-out')) return;

    // [수정] 잔액 부족 알림
    if (player.gold < cost) {
        notifyNarration(getUIText("shop.noMoney"));
        return;
    }

    if (type === 'card') {
        player.gold -= cost;
        const deckLabel = addCardToAppropriateDeck(name);
        const cardDisplayName = getCardDisplayName(name);

        // [수정] 구매 완료 알림
        notifyNarration(getUIText("shop.buyCardAdd")
            .replace("[CARD]", cardDisplayName)
            .replace("[DECK]", deckLabel));

        el.classList.add('sold-out');
        el.style.opacity = 0.5;
        updateUI();
        autoSave();
    }
    else {
        const onBuySuccess = () => {
            player.gold -= cost;
            // [수정] 구매 완료 알림
            notifyNarration(getUIText("shop.buyItem").replace("[ITEM]", getItemDisplayName(name)));

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
                notifyNarration(
                    data.usage === 'equip'
                        ? getUIText("shop.alreadyHaveEquip")
                        : getUIText("shop.alreadyHaveRelic")
                );
            }
        }
    }
}
// [수정] processCardRemoval: alert -> showPopup
function processCardRemoval(idx, cost) {
    if (player.deck.length <= 5) {
        notifyNarration(getUIText("deck.notEnoughCards"));
        return;
    }

    let removed = player.deck.splice(idx, 1)[0];
    player.gold -= cost;

    // 팝업 닫고 알림 (여기서 closePopup은 카드 선택 팝업을 닫는 용도)
    closePopup();

    // [수정] 제거 완료 알림
    setTimeout(() => {
        notifyNarration(getUIText("deck.removedCard").replace("[CARD]", getCardDisplayName(removed)));
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
        notifyNarration(getUIText("deck.notEnoughCards"));
        return;
    }

    let removed = player.deck.splice(idx, 1)[0];
    player.gold -= cost;

    closePopup();
    notifyNarration(getUIText("deck.removedCard").replace("[CARD]", getCardDisplayName(removed)));

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
        'char-creation-scene', 'start-scene'
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
        const btnVisible = (sceneName !== 'char-creation' && sceneName !== 'start');

        if (invBtn) invBtn.style.display = btnVisible ? 'inline-block' : 'none';

        const cardBtn = document.getElementById('btn-card-collection');
        if (cardBtn) cardBtn.style.display = btnVisible ? 'inline-block' : 'none';
        if (statsBtn) statsBtn.style.display = btnVisible ? 'inline-block' : 'none';

        updateUI();
    } else {
        console.error(`[Error] 화면을 찾을 수 없습니다: ${targetId}`);
        notifyNarration(getUIText("system.loadFail"));
        // 강제로 허브로 보내거나 재시도
        if (sceneName !== 'hub') switchScene('hub');
    }

    const globalLog = document.getElementById('global-log-panel');
    if (globalLog) {
        const hideLog = (
            sceneName === 'city' ||
            sceneName === 'hub' ||
            sceneName === 'event' ||
            sceneName === 'start' ||
            sceneName === 'char-creation' ||
            sceneName === 'deck' ||
            sceneName === 'storage' ||
            sceneName === 'exploration' ||
            sceneName === 'battle'
        );
        globalLog.classList.toggle('hidden', hideLog);
        if (!hideLog) syncCityLogPanels();
    }

    // 던전(탐사/전투) 진입 시 도시/허브/이벤트 우측 패널은 확실히 닫기
    if (sceneName === 'exploration' || sceneName === 'battle') {
        setHubPanelVisible(false);
        setCityPanelVisible('map', false);
        setCityPanelVisible('area', false);
        const eventLogPanel = document.getElementById('event-log-panel');
        if (eventLogPanel) eventLogPanel.classList.add('is-hidden');
        if (typeof DungeonSystem !== 'undefined' && DungeonSystem && typeof DungeonSystem.renderMinimap === 'function') {
            DungeonSystem.renderMinimap('minimap-right-grid', 26);
        }
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
    let itemReward = getUIText("reward.itemRewardNone");
    const desiredRank = rewardData.itemRank;
    let newItem = getRandomItem(null, { rank: desiredRank, categories: ["general"] });

    if (newItem) {
        const itemData = ITEM_DATA[newItem];

        // 이미 보유한 장비/유물이 보상으로 나왔다면: 아이템 대신 돈 지급
        if (itemData && (itemData.usage === "equip" || itemData.usage === "passive") && hasItemAnywhere(newItem)) {
            const comp = getDuplicateItemCompensation(newItem);
            player.gold += comp;
            itemReward = getUIText("reward.itemRewardDuplicate").replace("[GOLD]", comp);
        } else {
            addItem(newItem);
            itemReward = getItemDisplayName(newItem);
        }
    }

    document.getElementById('res-gold').innerText = `+${finalGold} ${getUIText("misc.currencyUnit")}`;
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

    // [1] 플레이어/조수: 스탯 기반 보정치 계산
    if (entity === player || (typeof AssistantManager !== "undefined" && entity instanceof AssistantManager)) {
        let rawVal = 0;
        const sourceStats = entity === player ? player.stats : (entity.stats || {});
        let bonusStats = { str: 0, con: 0, dex: 0, int: 0, wil: 0, cha: 0 };

        if (entity === player) {
            const activeItems = getActivePassiveItemNames();
            bonusStats = getTotalBonusStats(activeItems);
        }

        switch (type) {
            case 'atk': rawVal = sourceStats.str; break; // 물리공격 <- 근력
            case 'def': rawVal = sourceStats.con; break; // 물리방어 <- 건강
            case 'spd': rawVal = sourceStats.dex; break; // 속도 <- 민첩
            case 'socialAtk': rawVal = sourceStats.cha; break; // 소셜공격 <- 매력
            case 'socialDef': rawVal = sourceStats.int; break; // 소셜방어 <- 지능
            default: rawVal = sourceStats[type] || 10; break;
        }

        if (entity === player) {
            const applyBonus = (statKey) => { rawVal += (bonusStats[statKey] || 0); };

            if (type === 'atk' || type === 'str') applyBonus('str');
            else if (type === 'def' || type === 'con') applyBonus('con');
            else if (type === 'spd' || type === 'dex') applyBonus('dex');
            else if (type === 'socialAtk' || type === 'cha') applyBonus('cha');
            else if (type === 'socialDef' || type === 'int') applyBonus('int');
            else if (type in bonusStats) applyBonus(type);
        }

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
    ensureCurseCardForTrait(key);

    recalcStats();
    notifyNarration(getUIText("misc.traitGain").replace("[NAME]", t.name).replace("[DESC]", t.desc));
}

function removeTrait(key) {
    if (!player.traits.includes(key)) return;
    player.traits = player.traits.filter(k => k !== key);

    recalcStats();
    notifyNarration(getUIText("misc.traitLose").replace("[NAME]", TRAIT_DATA[key].name));
}

function applyBuff(entity, name, dur) {
    if (!entity || !entity.buffs) entity.buffs = {};
    if (name === "가시") {
        ensureThornsField(entity);
        entity.thorns = (entity.thorns || 0) + Number(dur || 0);
        logNarration("battle.buffApply", { target: entity === player ? getUIText("misc.targetPlayer") : getUIText("misc.targetEnemy"), buff: name });
        return;
    }
    if (name === "독" || name === "활력" || name === "반사") entity.buffs[name] = (entity.buffs[name] || 0) + dur;
    else entity.buffs[name] = dur;
    logNarration("battle.buffApply", { target: entity === player ? getUIText("misc.targetPlayer") : getUIText("misc.targetEnemy"), buff: name });
}
function tickBuffs(entity) {
    if (entity.buffs["독"]) { let dmg = entity.buffs["독"]; logNarration("battle.poison", { amount: dmg }); takeDamage(entity, dmg); }
    if (entity.buffs["활력"]) { let heal = entity.buffs["활력"]; entity.hp = Math.min(entity.maxHp, entity.hp + heal); logNarration("battle.regen", { amount: heal }); updateUI(); }
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
        isCardRewardableForPlayer(k, { onlyJob: true })
    );
    if (pool.length > 0) {
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
        isCardRewardableForPlayer(k, { onlyJob: true })
    );

    // 만약 풀이 비었다면 기본 카드 반환
    if (pool.length === 0) return "타격";

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
            logNarration("system.cardTriggerApLoss", { card: cardName, amount: Math.min(before, val) });
            break;
        }
        case "damage_self": {
            const val = Math.max(0, Number(eff.val || 0));
            if (val <= 0) break;
            logNarration("system.cardTriggerHpLoss", { card: cardName, amount: val });
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
                logNarration("system.cardTriggerDiscard", { card: cardName });
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

    for (let i = 0; i < n; i++) {
        // 1. 덱 리필 확인
        if (player.drawPile.length === 0) {
            if (player.discardPile.length > 0) {
                logNarration("system.shuffleDeck");
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
        notifyNarration(getUIText("system.handFullDiscard").replace("[CARD]", getCardDisplayName(card)));

            // 시각적 효과 (버림 카드 더미가 흔들림)
            playAnim('btn-discard-pile-floating', 'anim-bounce');
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

    // 의뢰를 받았다면 언제든 표시 (현재 맵과 무관하게 진행도 유지)
    if (topScInfo) {
        const activeId = game.activeScenarioId;
        const activeScenario = (activeId && game.scenario && game.scenario.id === activeId)
            ? game.scenario
            : (game.activeScenarioState && game.activeScenarioState[activeId]) || null;

        if (game.started && activeId && activeScenario) {
            topScInfo.classList.remove('hidden');
            const title = activeScenario.title || (SCENARIOS[activeId]?.title) || getUIText("scenario.titleFallback");
            const clues = Number.isFinite(activeScenario.clues) ? activeScenario.clues : 0;
            document.getElementById('sc-title-mini').innerText = `${title} | ${clues}%`;
        } else {
            topScInfo.classList.add('hidden');
        }
    }
    // 글로벌 위험도 표시
    const doomPill = document.getElementById('doom-pill');
    if (doomPill) {
        if (game.started) {
            doomPill.classList.remove('hidden');
            doomPill.innerText = `${getUIText("misc.doomLabel")} ${game.doom}%`;
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
    updatePileButtons();
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
                    <div class="hp-bar-bg" style="width:80px; background:#222; border:1px solid #3498db; height:8px; margin:2px auto;">
                        <div class="hp-bar-fill" style="width:${hpPct}%; background:#3498db;"></div>
                    </div>
                    <div style="font-size:0.8em; color:#fff;">${getUIText("battleHud.mentalLabel")}: ${player.mental} <span style="color:#f1c40f">🛡️${player.block}</span></div>
                `;
                const gauge = Math.max(0, Math.min(100, Number(game.profilingGauge || 0)));
                pHud.innerHTML += `
                    <div class="hud-subpanel">
                        <div class="hud-label">${getUIText("battleHud.profilingLabel")}</div>
                        <div class="hud-bar">
                            <div class="hud-bar-fill" style="width:${gauge}%"></div>
                        </div>
                        <div class="hud-value">${gauge}%</div>
                    </div>
                `;
            }
            // 일반 전투 모드 (체력 바)
            else {
                pHud.innerHTML = `
                    <div class="hp-bar-bg" style="width:80px; height:8px; margin:2px auto;">
                        <div class="hp-bar-fill" style="width:${hpPct}%"></div>
                    </div>
                    <div style="font-size:0.8em; color:#fff;">${getUIText("battleHud.hpLabel")}: ${player.hp} <span style="color:#f1c40f">🛡️${player.block}</span></div>
                `;
            }

            // 버프 표시 (툴팁 적용) + 가시(thorns) 별도 표기
            ensureThornsField(player);
            const entries = Object.entries(player.buffs || {}).map(([k, v]) => [getBuffDisplayName(k), v]);
            if ((player.thorns || 0) > 0) entries.push([getUIText("battleHud.statusThorns"), player.thorns]);
            if (player.isStunned) entries.push([getUIText("battleHud.statusStun"), 1]);
            else if (player.isBroken) entries.push([getUIText("battleHud.statusBroken"), 1]);

            // [FIX] 플레이어 상태이상도 머리 위로 (status-overhead)
            // wrapper 찾기
            const pWrapper = document.getElementById('dungeon-player-wrapper');
            if (pWrapper) {
                // [NEW] 플레이어 그림자 업데이트
                // 플레이어 이미지가 없거나(초기화 전), 기본 이미지(assets/player.png)라면 직업 이미지로 강제 보정 시도
                let currentImg = player.img;
                if ((!currentImg || currentImg.includes("assets/player.png")) && player.job && JOB_DATA[player.job]) {
                    currentImg = JOB_DATA[player.job].img;
                }

                if (currentImg) {
                    const shadow = document.getElementById('dungeon-player-shadow');
                    // 그림자 소스가 현재 이미지와 다르면 즉시 동기화
                    if (shadow && shadow.src !== currentImg) {
                        shadow.src = currentImg;
                    }

                    const pImg = document.getElementById('dungeon-player');
                    if (pImg && pImg.src !== currentImg) {
                        pImg.src = currentImg;
                    }
                }
                // 기존 오버헤드 제거
                const old = pWrapper.querySelector('.status-overhead');
                if (old) old.remove();

                if (entries.length > 0) {
                    const badges = entries.map(([k, v]) => `<div class="status-badge">${k} ${v}</div>`).join("");
                    const overhead = document.createElement('div');
                    overhead.className = 'status-overhead';
                    overhead.innerHTML = badges;
                    // 이미지가 컨테이너로 이동되어 있을 수 있으므로 부모 기준으로 삽입
                    const img = document.getElementById('dungeon-player');
                    if (img && img.parentNode) img.parentNode.insertBefore(overhead, img);
                    else pWrapper.prepend(overhead);
                }
            }
            // pHud에서는 제거됨

        } else {
            // 탐사 모드일 때는 이름만 깔끔하게
            pHud.innerHTML = `<div style="font-size:0.9em; color:#aaa;">${getUIText("explore.hudExploring")}</div>`;
        }


        // [FIX] 조수 및 플레이어 그림자 위치 보정 (컨테이너 분리)
        const assistantWrapper = document.getElementById('assistant-wrapper') || (() => {
            const wrapper = document.getElementById('dungeon-player-wrapper');
            if (!wrapper) return null;

            // 1. 플레이어 이미지 + 그림자 컨테이너 생성
            // 이미 생성되었는지 확인
            let pContainer = document.getElementById('player-img-container');
            if (!pContainer) {
                pContainer = document.createElement('div');
                pContainer.id = 'player-img-container';
                pContainer.style.position = 'relative';
                pContainer.style.display = 'inline-block';
                pContainer.style.zIndex = '20';
                pContainer.style.pointerEvents = 'none';

                // 기존 플레이어 이미지 이동
                const existingPlayerImg = document.getElementById('dungeon-player');
                if (existingPlayerImg) {
                    // 그림자 생성
                    const playerShadow = document.createElement('img');
                    playerShadow.id = 'dungeon-player-shadow';
                    playerShadow.className = 'char-shadow';
                    playerShadow.src = existingPlayerImg.src || "assets/player.png";

                    // 순서: [플레이어] -> [그림자] 순으로 넣어야 CSS 형제 선택자(+)가 먹힘
                    // z-index로 레이어 순서는 제어 (그림자 -1)
                    pContainer.appendChild(existingPlayerImg);
                    pContainer.appendChild(playerShadow);

                    // wrapper의 맨 앞에 컨테이너 삽입 (HUD, 오버헤드보다 안쪽일 수 있으니 주의)
                    const pHud = document.getElementById('player-hud');
                    // 오버헤드가 있다면 그 뒤에, 아니면 맨 앞? 
                    // 단순하게 HUD 앞에 넣고, 오버헤드는 updateUI에서 처리됨
                    if (pHud) wrapper.insertBefore(pContainer, pHud);
                    else wrapper.appendChild(pContainer);
                }
            }

            // 2. 조수 래퍼 생성
            const el = document.createElement('div');
            el.id = 'assistant-wrapper';

            // 조수 이미지 + 그림자 컨테이너
            const aContainer = document.createElement('div');
            aContainer.style.position = 'relative';
            aContainer.style.display = 'inline-block';

            const img = document.createElement('img');
            img.id = 'assistant-player';
        img.alt = getUIText("assistant.imgAlt");

            const shadow = document.createElement('img');
            shadow.id = 'assistant-shadow';
            shadow.className = 'char-shadow';

            aContainer.appendChild(shadow);
            aContainer.appendChild(img);

            const hud = document.createElement('div');
            hud.id = 'assistant-hud';

            el.appendChild(aContainer); // 이미지 그룹
            el.appendChild(hud);        // HUD는 이미지 그룹 아래

            wrapper.appendChild(el);
            return el;
        })();
        const assistantHud = document.getElementById('assistant-hud');
        const assistantImgEl = document.getElementById('assistant-player');
        if (assistantWrapper && assistantHud && assistantImgEl) {
            if (isDetectiveJob() && game.state === 'battle') {
                const assistantKey = getUIText("assistant.npcName");
                const assistantMeta = (typeof NPC_DATA !== 'undefined' && NPC_DATA && NPC_DATA[assistantKey])
                    ? NPC_DATA[assistantKey]
                    : null;
                const assistantImg = assistantMeta?.img || getUIText("assistant.imgFallback");
                assistantImgEl.src = assistantImg;

                // [NEW] 조수 그림자 소스 동기화
                const assistantShadow = document.getElementById('assistant-shadow');
                if (assistantShadow) {
                    assistantShadow.src = assistantImg;
                }
                const mgr = ensureAssistantManager();
                const cur = Math.max(0, Number(mgr?.hp || 0));
                const max = Math.max(0, Number(mgr?.maxHp || 0));
                const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((cur / max) * 100))) : 0;
                const assistantBlock = Math.max(0, Number(mgr?.block || 0));

                // [FIX] 조수 상태이상/어그로 -> status-overhead로 이동
                const aEntries = [];
                if (game.assistantTauntTurns > 0) aEntries.push([getUIText("battleHud.statusAggro"), ""]); // 어그로 표시

                // 버프/디버프 처리
                if (mgr.buffs) {
                    Object.entries(mgr.buffs).forEach(([k, v]) => {
                        aEntries.push([getBuffDisplayName(k), v]);
                    });
                }

                if (mgr.isStunned) aEntries.push([getUIText("battleHud.statusStun"), 1]);
                else if (mgr.isBroken) aEntries.push([getUIText("battleHud.statusBroken"), 1]);

                // 기존 오버헤드 제거 및 새로 생성
                const oldOverhead = assistantWrapper.querySelector('.status-overhead');
                if (oldOverhead) oldOverhead.remove();

                if (aEntries.length > 0) {
                    const badges = aEntries.map(([k, v]) => {
                        const valStr = v ? ` ${v}` : "";
                        return `<div class="status-badge">${k}${valStr}</div>`;
                    }).join("");
                    const overhead = document.createElement('div');
                    overhead.className = 'status-overhead';
                    overhead.innerHTML = badges;
                    // [FIX] assistantImgEl은 aContainer 안에 있으므로, 부모(aContainer)에 insertBefore 해야 함
                    if (assistantImgEl.parentNode) {
                        assistantImgEl.parentNode.insertBefore(overhead, assistantImgEl);
                    }
                }

                assistantHud.innerHTML = `
                    <div class="hp-bar-bg" style="height:8px; margin:2px 0;">
                        <div class="hp-bar-fill" style="width:${pct}%"></div>
                    </div>
                    <div style="font-size:0.8em; color:#fff;">${getUIText("battleHud.hpLabel")}: ${cur} <span style="color:#f1c40f">🛡️${assistantBlock}</span></div>
                `;
                assistantWrapper.style.display = '';
            } else {
                assistantWrapper.style.display = 'none';
                assistantHud.innerHTML = '';
            }
        }
        // 내 현재 속성 아이콘들 표시 (공격/방어 분리)
        const atkAttrs = getAttackAttrs(player) || [];
        const defAttrs = getDefenseAttrs(player) || [];

        const atkIconsHtml = atkAttrs.map(attr => {
            const title = getUIText("battleAttr.attackTitle").replace("[ATTR]", attr);
            return `<div class="player-attr-icon" title="${title}">${ATTR_ICONS[attr] || attr}</div>`;
        }).join("");
        const defIconsHtml = defAttrs.map(attr => {
            const title = getUIText("battleAttr.defenseTitle").replace("[ATTR]", attr);
            return `<div class="player-attr-icon" style="border-color:#3498db;" title="${title}">${ATTR_ICONS[attr] || attr}</div>`;
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
                el.innerHTML = `<div style="margin-top:50px; color:#777; font-size:2em;">💀</div><div style="color:#555;">${getActorDisplayName(e.name)}</div>`;
                return;
            } else {
                el.classList.remove('dead');
            }
            el.classList.add('enemy-unit');

            let isSocialEnemy = (game.state === "social");
            let hpPct = isSocialEnemy ? Math.min(100, Math.max(0, e.hp)) : Math.max(0, (e.hp / e.maxHp) * 100);
            let barHTML = `<div class="hp-bar-bg" style="width:80px; height:8px; margin:2px auto;"><div class="hp-bar-fill" style="width:${hpPct}%"></div></div>`;

            let intentIconsHtml = `<span class="intent-icon" title="${getUIText("battleHud.intentSleep")}">💤</span>`;
            if (e.intentQueue && e.intentQueue.length > 0) {
                intentIconsHtml = e.intentQueue.map((intObj, idx) => {
                    const icon = intObj.icon || "❓";
                    const tip = intObj.tooltip || getUIText("battleHud.intentReady");
                    const dmgText = intObj.damageText ? `<span class="intent-dmg">${intObj.damageText}</span>` : "";
                    return `<span class="intent-icon" title="${tip}" data-int-idx="${idx}">${icon}${dmgText}</span>`;
                }).join(" ");
            } else if (e.intent && e.intent.icon) {
                const tip = e.intent.tooltip || getUIText("battleHud.intentSleep");
                const dmgText = e.intent.damageText ? `<span class="intent-dmg">${e.intent.damageText}</span>` : "";
                intentIconsHtml = `<span class="intent-icon" title="${tip}">${e.intent.icon}${dmgText}</span>`;
            }

            // [FIX] 상태이상을 머리 위로 이동 (status-overhead)
            ensureThornsField(e);
            const eEntries = Object.entries(e.buffs || {}).map(([k, v]) => [getBuffDisplayName(k), v]);
            if ((e.thorns || 0) > 0) eEntries.push([getUIText("battleHud.statusThorns"), e.thorns]);
            const clueStacks = clueDebuff.getStacks(e);
            if (clueStacks > 0) eEntries.push([getUIText("battleHud.statusClue"), clueStacks]);
            if (e.isStunned) eEntries.push([getUIText("battleHud.statusStun"), 1]);
            else if (e.isBroken) eEntries.push([getUIText("battleHud.statusBroken"), 1]);

            let overheadHTML = "";
            if (eEntries.length > 0) {
                const badges = eEntries.map(([k, v]) => `<div class="status-badge">${k} ${v}</div>`).join("");
                overheadHTML = `<div class="status-overhead">${badges}</div>`;
            }

            // ★ [핵심 수정] 이미지 소스 안전 처리 (기본값 + 에러 핸들러)
            const enemyFallback = encodeURIComponent(getUIText("misc.enemyImageText"));
            const enemyNoImg = encodeURIComponent(getUIText("misc.noImageText"));
            let imgSrc = e.img;
            if (!imgSrc || imgSrc === "") imgSrc = `https://placehold.co/100x100/555/fff?text=${enemyFallback}`;

            // 약점/상태 아이콘 처리
            let weakIcon = "";
            let statusIcon = "";
            if (e.isStunned) statusIcon = `<div class="status-icon-overlay">😵</div>`;
            else if (e.isBroken) statusIcon = `<div class="status-icon-overlay">💔</div>`;

            // 1. 적의 종류(Key)를 확인
            if (e.enemyKey) {
                // [FIX] discoveredWeaknesses 안전 접근
                if (!player.discoveredWeaknesses) player.discoveredWeaknesses = {};

                // 2. 플레이어가 이 적의 약점을 이미 발견했는지 확인
                let knownWeakness = player.discoveredWeaknesses[e.enemyKey];
                // 3. 발견했다면 아이콘 표시
                if (knownWeakness) {
                    const tip = getUIText("battleAttr.weaknessTitle").replace("[ATTR]", knownWeakness);
                    weakIcon = `<div class="weakness-icon" title="${tip}">${ATTR_ICONS[knownWeakness] || knownWeakness}</div>`;
                }
            }

            // [FIX] 적 HTML 구조 변경: status-overhead 추가
            el.innerHTML = `
                ${intentIconsHtml}
                <div class="enemy-main-content">
                    ${overheadHTML}
                    <div style="position:relative; display:inline-block;">
                        <img class="char-shadow" src="${imgSrc}">
                        <img class="char-img" src="${imgSrc}" loading="lazy" onerror="this.src='https://placehold.co/100x100/555/fff?text=${enemyNoImg}';">
                        ${statusIcon}
                    </div>
                    <div class="enemy-stats">${getActorDisplayName(e.name)}</div>
                    ${barHTML}
                    <div style="font-size:0.8em; color:#fff;">${getUIText("battleHud.hpLabel")}: ${e.hp} <span style="color:#f1c40f">🛡️${e.block}</span></div>
            </div>
            ${weakIcon}
        `;
        });
    }

    function updatePileButtons() {
        const drawBtn = document.getElementById('btn-draw-pile-floating');
        const exhaustBtn = document.getElementById('btn-exhaust-pile-floating');
        const discardBtn = document.getElementById('btn-discard-pile-floating');
        if (!drawBtn && !exhaustBtn && !discardBtn) return;

        const inCombat = (game.state === 'battle' || game.state === 'social');
        const drawCount = inCombat ? (player.drawPile?.length || 0) : 0;
        const exhaustCount = inCombat ? (player.exhaustPile?.length || 0) : 0;
        const discardCount = inCombat ? (player.discardPile?.length || 0) : 0;

        if (drawBtn) drawBtn.textContent = `${getUIText("battleHud.deckLabel")}(${drawCount})`;
        if (exhaustBtn) exhaustBtn.textContent = `${getUIText("battleHud.exhaustLabel")}(${exhaustCount})`;
        if (discardBtn) discardBtn.textContent = `${getUIText("battleHud.discardLabel")}(${discardCount})`;
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
            btnHTML = getUIText("battleHud.forceAction");
            btnColor = "#c0392b";
            btnFunc = () => confirmForceBattle();
        }
        else if (game.state === "battle" && !game.isBossBattle) {
            btnHTML = getUIText("battleHud.runAway");
            btnColor = "#7f8c8d";
            btnFunc = () => confirmRunAway();
        }

        if (btnHTML) {
            extraBtn = document.createElement('button');
            extraBtn.id = 'extra-action-btn';
            extraBtn.className = 'action-btn';
            extraBtn.dataset.actionType = (game.state === "social") ? "force" : "run";
            extraBtn.style.cssText = `font-size:0.9em; padding:5px; line-height:1.2; word-break:keep-all; font-weight:bold;`;
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
    showNarrationChoice(getUIText("battle.runAwayPrompt"), [
        { txt: getUIText("battle.runAwayConfirm"), func: () => { escapePhysicalBattle(); } },
        { txt: getUIText("battle.runAwayCancel"), func: () => {} }
    ]);
}

/* [수정] 전투 도주 처리 함수 (사망 체크 추가) */
function escapePhysicalBattle() {
    notifyNarration(getUIText("system.retreat"));

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
    if (wrapper) wrapper.innerHTML = ""; // 적 삭제

    enemies = []; // 남아있는 적 데이터 정리

    toggleBattleUI(false); // 이동 버튼 다시 표시

    notifyNarration(getUIText("system.retreat"));
    renderExploration();
}

/* [game.js] renderHand 함수 수정 (STS 스타일 부채꼴 핸드) */
function renderHand() {
    const container = document.getElementById('hand-container');
    if (!container) return;
    container.innerHTML = "";
    ensureCardSystems(player);

    // [1] PC/가로 모드용 로직: 8장 이상이면 겹쳐서 보여줌 (기존 기능 복구)
    if (player.hand.length >= 8) container.classList.add('compact');
    else container.classList.remove('compact');

    // [2] 모바일 세로 모드용 로직: 4장 이상이면 'mobile-multi-row' 클래스 붙임
    // (이 클래스는 CSS 미디어 쿼리 안에서만 작동하므로 PC엔 영향 없음)
    if (player.hand.length >= 4) container.classList.add('mobile-multi-row');
    else container.classList.remove('mobile-multi-row');

    const total = player.hand.length;
    // STS 스타일 fan 파라미터
    const MAX_FAN_ANGLE = 20;   // 전체 부채꼴 각도 범위 (deg)
    const ARC_DEPTH = 18;       // 양끝 카드가 아래로 내려가는 곡선 깊이 (px)
    const HOVER_SCALE = 1.22;   // 호버 시 카드 배율
    const HOVER_RISE = 60;      // 호버 시 카드가 위로 올라가는 거리 (px)

    // 모바일 여부: pointer:coarse 이거나 세로 화면이면 fan 효과 비활성화
    const isMobile = window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches
        || window.matchMedia('(pointer: coarse) and (max-height: 600px)').matches;

    player.hand.forEach((cName, idx) => {
        const data = getEffectiveCardData(cName) || CARD_DATA[cName];
        if (!data) {
            console.warn(`Missing card data for ${cName}`);
            return;
        }
        let el = document.createElement('div');
        el.className = 'card';
        el.id = `card-el-${idx}`;
        el.style.pointerEvents = "auto";

        const isUnplayable = !!data.unplayable;
        const assistantRequired = !!data.requireAssistant;
        const assistantAlive = assistantRequired ? (ensureAssistantManager()?.isAlive?.() || false) : true;
        const cost = getHandCardCost(idx, cName);
        if (player.ap < cost || game.turnOwner !== "player" || isUnplayable || !assistantAlive) el.className += " disabled";

        const groupLabel = getCardGroupLabel(data);
        const typeLabel = getCardTypeLabel(data);
        const badges = `${typeLabel ? `<div class="card-group-badge">[${typeLabel}]</div>` : ""}${groupLabel ? `<div class="card-group-badge">[${groupLabel}]</div>` : ""}`;

        const cardDisplayName = getCardDisplayName(cName);
        el.innerHTML = `
            <div class="card-cost">${cost}</div>
            <div class="card-rank">${"★".repeat(data.rank)}</div>
            <div class="card-name">${cardDisplayName}</div>
            ${badges}
            <div class="card-desc">${applyTooltip(data.desc)}</div>
        `;

        // --- STS Fan 레이아웃 ---
        if (!isMobile && total > 1) {
            el.classList.add('fan-card');
            // 0→1 사이의 정규화 위치 (가운데 0.5)
            const t = total === 1 ? 0.5 : idx / (total - 1);
            const angle = (t - 0.5) * MAX_FAN_ANGLE;   // 음수=왼쪽, 양수=오른쪽
            // 포물선: 가운데가 가장 올라옴, 양끝이 내려감
            const arcOffset = ARC_DEPTH * (4 * t * t - 4 * t + 1); // (2t-1)^2 * ARC_DEPTH
            const baseTransform = `rotate(${angle}deg) translateY(${arcOffset}px)`;
            el.style.transform = baseTransform;
            el.style.zIndex = idx + 1;
            el.style.margin = "0 -8px"; // 약간 겹치게

            // 호버: 수직 + 확대 + 위로 솟음
            el.addEventListener('mouseenter', () => {
                el.style.transform = `rotate(0deg) translateY(-${HOVER_RISE}px) scale(${HOVER_SCALE})`;
                el.style.zIndex = 200;
                el.style.borderColor = '#f1c40f';
                el.style.boxShadow = 'none';
                el.style.margin = "0 6px";
            });
            el.addEventListener('mouseleave', () => {
                el.style.transform = baseTransform;
                el.style.zIndex = idx + 1;
                el.style.borderColor = '';
                el.style.boxShadow = '';
                el.style.margin = "0 -8px";
            });
        }

        if (isUnplayable) {
            el.onclick = () => logNarration("system.battleTurnOnly");
        }
        else if (!assistantAlive) {
            el.onclick = () => logNarration("battle.noAssistant");
        }
        else if (game.turnOwner === "player" && player.ap >= cost) {
            el.onmousedown = (e) => startDrag(e, idx, cName);
            el.ontouchstart = (e) => startDrag(e, idx, cName);
        } else {
            el.onclick = () => logNarration("battle.reactionOnly");
        }

        container.appendChild(el);
    });
}

// [수정됨] openPileView: 목록 창에서도 일반 카드처럼 보이게 수정
function openPileView(type) {
    const title = document.getElementById('popup-title'); const content = document.getElementById('popup-content'); const btns = document.getElementById('popup-buttons');
    content.innerHTML = ""; btns.innerHTML = `<button class='action-btn' onclick='closePopup()'>${getUIText("popup.close")}</button>`;

    let sourceArray;
    if (type === 'draw') sourceArray = [...player.drawPile].sort();
    else if (type === 'discard') sourceArray = player.discardPile;
    else if (type === 'exhaust') sourceArray = player.exhaustPile;

    let typeText = (type === 'draw')
        ? getUIText("popup.pileTitleDraw")
        : (type === 'discard')
            ? getUIText("popup.pileTitleDiscard")
            : getUIText("popup.pileTitleExhaust");
    title.innerText = getUIText("popup.pileCount")
        .replace("[TITLE]", typeText)
        .replace("[COUNT]", sourceArray.length);
    document.getElementById('popup-desc').innerText = getUIText("popup.pileDesc");
    if (sourceArray.length === 0) content.innerHTML = `<div style='padding:20px; color:#777;'>${getUIText("menu.listEmpty")}</div>`;
    else {
        let listDiv = document.createElement('div'); listDiv.className = 'pile-list';
        sourceArray.forEach(cName => {
            let data = getEffectiveCardData(cName) || CARD_DATA[cName]; let el = document.createElement('div'); el.className = 'mini-card';
            const displayName = getCardDisplayName(cName);
            const groupLabel = getCardGroupLabel(data);
            const typeLabel = getCardTypeLabel(data);

            // [수정] 미니 카드에도 별 추가
            el.innerHTML = `
                <div>${data.cost} <span style="color:#f1c40f">${"★".repeat(data.rank)}</span></div>
                <b>${displayName}</b>
                ${typeLabel ? `<div style="font-size:0.9em; color:#95a5a6;">[${typeLabel}]</div>` : ""}
                ${groupLabel ? `<div style="font-size:0.9em; color:#7f8c8d;">[${groupLabel}]</div>` : ""}
                <div>${applyTooltip(data.desc)}</div>
            `;
            listDiv.appendChild(el);
        }); content.appendChild(listDiv);
    }
    document.getElementById('popup-layer').style.display = 'flex';
}

function showPopup(title, desc, buttons = [], contentHTML = "", options = {}) {
    const hasContent = !!(contentHTML && String(contentHTML).trim());
    const btns = Array.isArray(buttons) ? buttons : [];
    const forcePopup = !!(options && options.forcePopup) || btns.some(b => b && b.keepPopup);
    // 전용 UI(장비창 등)만 팝업 유지. 콘텐츠 없는 단순 선택지는 로그 버튼으로 이동.
    if (!hasContent && !forcePopup) {
        showNarrationChoice(desc, btns.map(b => ({ txt: b.txt, func: b.func })));
        return;
    }
    const layer = document.getElementById('popup-layer');
    const box = layer ? layer.querySelector('.popup-box') : null;
    document.getElementById('popup-title').innerText = title;
    document.getElementById('popup-desc').innerHTML = desc;
    document.getElementById('popup-content').innerHTML = contentHTML;
    const btnBox = document.getElementById('popup-buttons');
    btnBox.innerHTML = "";
    btns.forEach(b => {
        let btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.style.fontSize = "1em";
        btn.style.padding = "5px 15px";
        btn.innerText = b.txt;
        btn.onclick = b.func;
        btnBox.appendChild(btn);
    });
    if (options && options.dismissOnOverlay) {
        const dismiss = () => {
            closePopup();
            if (typeof options.onDismiss === "function") options.onDismiss();
        };
        layer.onclick = dismiss;
        if (box) box.onclick = dismiss;
    } else {
        layer.onclick = null;
        if (box) box.onclick = (e) => e.stopPropagation();
    }
    layer.style.display = "flex";
}

function showAlert(title, desc, onClose) {
    const closeFn = onClose || closePopup;
    showChoice(title, desc, [{ txt: getUIText("popup.confirmOk"), func: closeFn }]);
}

function showConfirm(title, desc, onYes, onNo, yesText = getUIText("popup.confirmOk"), noText = getUIText("popup.confirmCancel")) {
    showPopup(
        title,
        desc,
        [
            { txt: yesText, func: onYes || closePopup },
            { txt: noText, func: onNo || closePopup }
        ],
        "",
        { forcePopup: true }
    );
}

function showChoice(title, desc, options = [], contentHTML = "") {
    const buttons = (options || []).map(opt => ({
        txt: opt.txt || opt.label || getUIText("popup.choiceDefault"),
        func: opt.func || closePopup
    }));
    showPopup(title, desc, buttons, contentHTML);
}

/* [누락된 함수 추가] 팝업 닫기 기능 */
function closePopup() {
    // [핵심] 게임오버 상태일 때는 팝업을 절대 닫지 않음 (새로고침만 가능하게)
    if (game.state === "gameover") return;

    const layer = document.getElementById('popup-layer');
    if (layer) layer.onclick = null;
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
        notifyNarration(getUIText("system.handFullDiscard").replace("[CARD]", getCardDisplayName(cardName)));
        playAnim('btn-discard-pile-floating', 'anim-bounce');
        return false;
    }

    player.hand.push(cardName);
    player.handCostOverride.push(null);
    return true;
}

function showChooseCardFromPile(pileType, title, onPick) {
    const arr = (pileType === 'draw') ? player.drawPile : player.discardPile;
    if (!Array.isArray(arr) || arr.length === 0) {
        logNarration("battle.emptyPile");
        return false;
    }

    showPopup(title, getUIText("popup.chooseCardTitle"), [{ txt: getUIText("popup.confirmCancel"), func: closePopup }], `<div id="choose-card-list" class="pile-list"></div>`);
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
    logNarration("system.levelUp");
    let content = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <button class="action-btn" onclick="applyStatUp('str')">${getUIText("levelUp.strBtn")}</button>
            <button class="action-btn" onclick="applyStatUp('con')">${getUIText("levelUp.conBtn")}</button>
            <button class="action-btn" onclick="applyStatUp('dex')">${getUIText("levelUp.dexBtn")}</button>
            <button class="action-btn" onclick="applyStatUp('int')">${getUIText("levelUp.intBtn")}</button>
            <button class="action-btn" onclick="applyStatUp('wil')">${getUIText("levelUp.wilBtn")}</button>
            <button class="action-btn" onclick="applyStatUp('cha')">${getUIText("levelUp.chaBtn")}</button>
        </div>
    `;

    showPopup(getUIText("popup.levelUpTitle"), getUIText("popup.levelUpDesc"), [], content);
}
/* [NEW] 스탯 적용 헬퍼 */
function applyStatUp(type) {
    player.stats[type]++; // 해당 스탯 증가
    recalcStats();        // 파생 스탯(HP/SP) 재계산 (최대치 증가분 반영)

    // 만약 건강/정신을 찍어서 최대치가 늘었다면, 현재 수치도 소폭 회복시켜주는 센스
    if (type === 'con') player.hp += 10;
    if (type === 'wil') player.sp += 10;

    closePopup();
    getCardReward(); // 카드 보상으로 이어짐
}

/* [수정] 카드 보상 획득 로직 (화면 이동 강제 제거) */
function getCardReward() {
    let newCard = getRandomCard();
    let data = getEffectiveCardData(newCard) || CARD_DATA[newCard];
    const typeLabel = getCardTypeLabel(data);
    const groupLabel = getCardGroupLabel(data);

    const displayName = getCardDisplayName(newCard);
    let cardHTML = `
    <div style="display:flex; justify-content:center; margin:10px;">
        <div class="card">
            <div class="card-cost">${data.cost}</div>
            <div class="card-rank">${"★".repeat(data.rank)}</div>
            <div class="card-name">${displayName}</div>
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

    logNarration("system.cardReward");
    showPopup(getUIText("popup.cardRewardTitle"), getUIText("popup.cardRewardDesc"), [
        {
            txt: getUIText("popup.rewardGet"),
            func: () => {
                const deckLabel = addCardToAppropriateDeck(newCard);
                logNarration("system.addCardToDeck", { card: displayName, deck: deckLabel });
                logNarration("system.learnCard", { card: displayName });
                logNarration("system.cardRewardAccept");
                finishReward(); // 제자리 유지
            }
        },
        {
            txt: getUIText("popup.rewardSkip"),
            func: () => {
                logNarration("system.cardRewardSkip");
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

    // 조수 건강은 레벨업마다 +1
    if (isDetectiveJob()) {
        const mgr = ensureAssistantManager();
        mgr.stats.con = Math.max(0, Number(mgr.stats?.con || 0)) + 1;
        const bonus = Math.max(0, Number(mgr.stats?.con || 0) * 2);
        const base = Math.max(1, Number(mgr.baseMaxHp || 1));
        const newMax = Math.max(1, base + bonus);
        const delta = Math.max(0, newMax - mgr.maxHp);
        mgr.maxHp = newMax;
        mgr.hp = Math.min(newMax, mgr.hp + delta);
    }
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
    const elId = el?.id;
    const hasShadow = !!(el?.parentElement && el.parentElement.querySelector?.('.char-shadow'));
    const shouldAnimateGroup = !isEnemyUnit && hasShadow && (elId === 'dungeon-player' || elId === 'assistant-player');
    const target = shouldAnimateGroup ? el.parentElement : (isEnemyUnit ? el : (img || el));

    // 기존 애니메이션 클래스가 있다면 제거 (연속 재생을 위해)
    const animTargets = new Set([el, img, target].filter(Boolean));
    animTargets.forEach(node => node.classList.remove('anim-atk-p', 'anim-atk-e', 'anim-hit', 'anim-bounce'));

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
    if (!game.winNarrated) {
        logNarration("battle.victory");
        game.winNarrated = true;
    }

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
                txt: getUIText("battle.lootPickup"),
                func: () => getLoot()
            });
        } else {
            // 데이터 에러 시 전리품 삭제
            game.pendingLoot = null;
        }
    }

    // 2. [레벨업 버튼]
    if (player.xp >= player.maxXp) {
        processLevelUp();
    }

    // 3. [떠나기 버튼]
    btns = btns.filter(Boolean);

    // 메시지에 레벨업 알림 추가
    let finalMsg = game.winMsg || getUIText("battle.winDefaultMsg");
    if (game.lastWinReward && !game.winRewardLogged) {
        logNarration("battle.winReward", { gold: game.lastWinReward.gold, xp: game.lastWinReward.xp });
        game.winRewardLogged = true;
    }
    showPopup(
        getUIText("battle.winTitleDecorated"),
        finalMsg,
        btns,
        contentHTML,
        {
            forcePopup: true,
            dismissOnOverlay: true,
            onDismiss: () => {
                if (game.pendingLoot) {
                    getLoot();
                }
                if (!game.pendingLoot) nextStepAfterWin();
            }
        }
    );
}

function getLoot() {
    if (game.pendingLoot) {
        // [성공 콜백] 아이템 획득에 성공했을 때 실행
        const onLootSuccess = () => {
            // 메시지 갱신 (기존 텍스트에서 '떨어져 있습니다' 제거 후 획득 메시지 추가)
            if (game.winMsg) {
                const lootLine = getUIText("battle.lootOnGround");
                game.winMsg = game.winMsg.replace(`<br>${lootLine}`, "");
            }
            const lootPicked = getUIText("battle.lootPicked").replace("[ITEM]", getItemDisplayName(game.pendingLoot));
            game.winMsg += `<br><span style="color:#2ecc71">${lootPicked}</span>`;

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
                const label = (itemData.usage === 'equip')
                    ? getUIText("menu.tabEquip")
                    : getUIText("menu.tabRelic");
                notifyNarration(getUIText("misc.alreadyHaveLabel").replace("[LABEL]", label));
                showPopup(
                    getUIText("popup.lootFailTitle"),
                    getUIText("popup.lootFailDesc")
                        .replace("[LABEL]", label)
                        .replace("[ITEM]", getItemDisplayName(game.pendingLoot)),
                    [
                    {
                        txt: getUIText("popup.confirmOk"),
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
    if (e.cancelable) e.preventDefault();

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
    let dragEl = document.getElementById((drag.type === 'card') ? `card-el-${drag.idx}` : `item-el-${drag.idx}`);

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
    logNarration("system.openPlayerInfo");
    const s = player.stats;
    const statRows = `
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:left;">
            <div>${getUIText("stats.str")}: <b>${s.str}</b></div>
            <div>${getUIText("stats.con")}: <b>${s.con}</b></div>
            <div>${getUIText("stats.dex")}: <b>${s.dex}</b></div>
            <div>${getUIText("stats.int")}: <b>${s.int}</b></div>
            <div>${getUIText("stats.wil")}: <b>${s.wil}</b></div>
            <div>${getUIText("stats.cha")}: <b>${s.cha}</b></div>
        </div>
    `;

    let traitList = getUIText("menu.none");
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
                <div style="color:#f1c40f; font-weight:bold; margin-bottom:4px;">${getUIText("menu.ownedTraits")}</div>
                ${traitList}
            </div>
        </div>
    `;

    showPopup(
        getUIText("popup.playerInfoTitle"),
        getUIText("popup.playerInfoDesc"),
        [{ txt: getUIText("popup.confirmOk"), func: closePopup }],
        content
    );
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
        list.innerHTML = `<div style="grid-column: 1/-1; color:#777; margin-top:50px;">${getUIText("menu.noCards")}</div>`;
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
        const displayName = getCardDisplayName(cName);
        el.innerHTML = `
            <div class="card-cost">${data.cost}</div>
            <div class="card-rank">${"★".repeat(data.rank)}</div>
            <div class="card-name">${displayName}</div>
            ${(typeLabel || groupLabel) ? `<div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin-top:4px;">
                ${typeLabel ? `<div class="card-group-badge">[${typeLabel}]</div>` : ""}
                ${groupLabel ? `<div class="card-group-badge">[${groupLabel}]</div>` : ""}
            </div>` : ""}
            <div class="card-desc">${applyTooltip(data.desc)}</div>
        `;

        list.appendChild(el);
    });
}


/* ============================================================
   [NEW] Start Screen & Infinite Mode Logic
   ============================================================ */

let tempGameMode = 'normal'; // 'normal' or 'infinite'
let infiniteStage = 1;

function renderStartScreen() {
    game.state = 'start';
    switchScene('start');

    // Check save data for "Continue" button
    const hasSave = !!localStorage.getItem('midnight_rpg_save');
    const btnContinue = document.getElementById('btn-continue');
    if (btnContinue) {
        if (hasSave) btnContinue.classList.remove('hidden');
        else btnContinue.classList.add('hidden');
    }
}

function startInfiniteJobSelection() {
    tempGameMode = 'infinite';
    startCharacterCreation();
}

function startInfiniteLoop() {
    infiniteStage = 1;
    game.state = 'battle';
    game.mode = 'infinite';

    // Initial healing / setup
    player.hp = player.maxHp;
    player.sp = player.maxSp;

    // [FIX] 조수 일러스트나 플레이어 일러스트가 기본값으로 뜨는 문제 해결
    // Infinite Mode에서도 캐릭터 생성 시 선택한 직업 이미지가 뜨도록 강제 설정
    const pImg = document.getElementById('dungeon-player');
    if (pImg) {
        pImg.src = player.img || "assets/player.png";
    }

    startInfiniteStage();
}

function startInfiniteStage() {
    // Stage HUD
    let stageHud = document.getElementById('infinite-stage-hud');
    if (!stageHud) {
        stageHud = document.createElement('div');
        stageHud.id = 'infinite-stage-hud';
        stageHud.className = 'infinite-stage-hud';
        document.body.appendChild(stageHud);
    }
    stageHud.innerText = `STAGE ${infiniteStage}`;
    stageHud.style.display = 'block';

    // Enemy Scaling
    let enemyCount = 1;
    if (infiniteStage >= 3) enemyCount = 2;
    if (infiniteStage >= 6) enemyCount = 3;

    // Every 5th stage is a Boss
    let isBoss = (infiniteStage % 5 === 0);

    // Start Battle
    switchScene('battle');

    if (isBoss) {
        // Find a boss
        let bossKeys = Object.keys(ENEMY_DATA).filter(k => k.startsWith('boss_'));
        let bossKey = bossKeys[Math.floor(Math.random() * bossKeys.length)] || "boss_gang_leader";
        startBattle(true, bossKey);
        logNarration("system.infiniteStageBoss", { stage: infiniteStage });
    } else {
        // Random enemies (Count logic is inside startBattle if we pass null/array, 
        // but let's customize it or rely on random. 
        // startBattle(false) spawns 1 or 2 enemies randomly.
        // Let's force count if we want scaling.)

        // Construct array of random keys
        let pool = Object.keys(ENEMY_DATA).filter(k => !k.startsWith("boss_"));
        let picked = [];
        for (let i = 0; i < enemyCount; i++) {
            picked.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        startBattle(false, picked);
        logNarration("system.infiniteStage", { stage: infiniteStage });
    }
}

function handleInfiniteWin() {
    closePopup();
    showInfiniteIntermissionChoices();
}

function showInfiniteIntermissionChoices() {
    game.state = 'intermission';

    let html = `
        <div style="text-align:center; padding:20px;">
            <h2 style="color:#f1c40f;">${getUIText("infinite.stageClear").replace("[STAGE]", infiniteStage)}</h2>
            <p style="color:#bdc3c7; margin-bottom:20px;">${getUIText("infinite.choosePath")}</p>
            
            <div style="display:flex; flex-direction:column; gap:15px; width:100%;">
                <button class="action-btn" style="background:#27ae60;" onclick="handleInfiniteRest()">
                    <div style="font-size:1.3em;">${getUIText("infinite.restTitle")}</div>
                    <div style="font-size:0.8em; color:#ddd;">${getUIText("infinite.restDesc")}</div>
                </button>
                
                <button class="action-btn" style="background:#d35400;" onclick="handleInfiniteShop()">
                    <div style="font-size:1.3em;">${getUIText("infinite.shopTitle")}</div>
                    <div style="font-size:0.8em; color:#ddd;">${getUIText("infinite.shopDesc")}</div>
                </button>
                
                <button class="action-btn" style="background:#8e44ad;" onclick="handleInfiniteRandom()">
                    <div style="font-size:1.3em;">${getUIText("infinite.randomTitle")}</div>
                    <div style="font-size:0.8em; color:#ddd;">${getUIText("infinite.randomDesc")}</div>
                </button>
            </div>

             <div style="margin-top:20px; display:flex; gap:10px; justify-content:center;">
                <button class="action-btn" onclick="openAllCards()" style="font-size:0.9em; padding:8px 15px;">${getUIText("infinite.deckManage")}</button>
                <button class="action-btn" onclick="openPlayerStats()" style="font-size:0.9em; padding:8px 15px;">${getUIText("infinite.statsView")}</button>
            </div>
        </div>
    `;

    logNarration("battle.victory");
    showPopup(getUIText("popup.victoryTitle"), getUIText("popup.victoryDesc"), [], html);
}

function handleInfiniteRest() {
    closePopup();

    // HP 30% / SP 30% Heal
    let hpHeal = Math.floor(player.maxHp * 0.3);
    let spHeal = Math.floor(player.maxSp * 0.3);

    player.hp = Math.min(player.maxHp, player.hp + hpHeal);
    player.sp = Math.min(player.maxSp, player.sp + spHeal);

    updateUI(); // [CI] UI 갱신 추가

    notifyNarration(getUIText("misc.restShort"));
    showPopup(getUIText("popup.campfireTitle"), `
        <div style="text-align:center;">
            <div style="font-size:3em; margin-bottom:10px;">🔥</div>
            <p>${getUIText("infinite.campfireDesc")}</p>
            <p style="color:#2ecc71; font-weight:bold; margin-top:10px;">
                HP +${hpHeal} / SP +${spHeal}
            </p>
        </div>
    `, [{
        txt: getUIText("infinite.nextStage"),
        func: () => {
            closePopup();
            nextInfiniteStage();
        }
    }]);
}

function handleInfiniteShop() {
    closePopup();
    const shopTypes = ["shop_black_market", "shop_high_end", "shop_occult", "shop_herbal"];
    const type = shopTypes[Math.floor(Math.random() * shopTypes.length)];
    renderShopScreen(type);
}

function handleInfiniteRandom() {
    closePopup();
    triggerRandomEvent();
}

function setGameFlag(flag, value = true) {
    if (!game.flags) game.flags = {};
    game.flags[flag] = value;
    autoSave();
}

function hasGameFlag(flag) {
    return !!(game.flags && game.flags[flag]);
}

function getClearedScenarioCount() {
    let count = 0;
    for (let id in SCENARIOS) {
        if (SCENARIOS[id] && SCENARIOS[id].cleared) count++;
    }
    return count;
}

function compareTime(a, b) {
    if (!a || !b) return 0;
    if (a.day !== b.day) return a.day - b.day;
    return (a.timeIndex || 0) - (b.timeIndex || 0);
}

function getScenarioRule(id) {
    if (typeof SCENARIO_RULES !== "undefined" && SCENARIO_RULES && SCENARIO_RULES[id]) {
        return SCENARIO_RULES[id];
    }
    return null;
}

function getScenarioLeadFlag(id) {
    const rule = getScenarioRule(id);
    if (!rule) return null;
    if (rule.leadFlag) return rule.leadFlag;
    if (Array.isArray(rule.requiredFlags) && rule.requiredFlags.length > 0) {
        return rule.requiredFlags[0];
    }
    return null;
}

function isScenarioLeadUnlocked(id) {
    const flag = getScenarioLeadFlag(id);
    if (!flag) return false;
    return hasGameFlag(flag);
}

function isScenarioExpired(id) {
    const sc = SCENARIOS[id];
    if (!sc) return false;
    if (game.activeScenarioId === id) return false;
    const rule = getScenarioRule(id);
    if (!rule || !rule.expireAt) return false;
    ensureTimeState();
    const now = { day: game.day, timeIndex: game.timeIndex };
    return compareTime(now, rule.expireAt) > 0;
}

function handleExpiredScenarios() {
    const expiredIds = [];
    for (let id in SCENARIOS) {
        if (!SCENARIOS[id]) continue;
        if (SCENARIOS[id].cleared) continue;
        if (isScenarioExpired(id)) expiredIds.push(id);
    }

    if (expiredIds.length === 0) return false;

    if (!game.expiredScenarios) game.expiredScenarios = [];
    const newlyExpired = expiredIds.filter(id => !game.expiredScenarios.includes(id));
    if (newlyExpired.length === 0) return false;

    newlyExpired.forEach(id => game.expiredScenarios.push(id));

    const list = newlyExpired.map(id => {
        const title = SCENARIOS[id]?.title || id;
        return `<div style="color:#777;">${title} <span style="color:#c0392b;">${getUIText("infinite.expiredTag")}</span></div>`;
    }).join("");

    showPopup(getUIText("scenario.expiredTitle"),
        getUIText("scenario.expiredDesc"),
        [{
            txt: getUIText("scenario.expiredConfirm"),
            func: () => {
                newlyExpired.forEach(id => {
                    SCENARIOS[id].expired = true;
                });
                closePopup();
                openCaseFiles();
            }
        }],
        `<div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">${list}</div>`
    );
    return true;
}

function isScenarioAvailable(id) {
    const sc = SCENARIOS[id];
    if (!sc) return false;

    // 진행 중인 의뢰는 항상 표시
    if (game.activeScenarioId === id) return true;

    if (sc.expired) return false;

    const rule = getScenarioRule(id);
    if (!rule) return true;

    if (rule.hideAfterClear && sc.cleared) return false;

    if (Number.isFinite(rule.minLevel) && game.level < rule.minLevel) return false;

    if (Array.isArray(rule.requiredFlags) && rule.requiredFlags.length > 0) {
        for (const f of rule.requiredFlags) {
            if (!hasGameFlag(f)) return false;
        }
    }

    if (Array.isArray(rule.requiredItems) && rule.requiredItems.length > 0) {
        for (const item of rule.requiredItems) {
            if (!hasItemAnywhere(item)) return false;
        }
    }

    if (Array.isArray(rule.requiredScenariosCleared) && rule.requiredScenariosCleared.length > 0) {
        for (const sid of rule.requiredScenariosCleared) {
            if (!SCENARIOS[sid] || !SCENARIOS[sid].cleared) return false;
        }
    }

    if (Number.isFinite(rule.minClearedCount)) {
        if (getClearedScenarioCount() < rule.minClearedCount) return false;
    }

    if (rule.startAt) {
        ensureTimeState();
        const now = { day: game.day, timeIndex: game.timeIndex };
        if (compareTime(now, rule.startAt) < 0) return false;
    }

    if (rule.expireAt) {
        ensureTimeState();
        const now = { day: game.day, timeIndex: game.timeIndex };
        if (compareTime(now, rule.expireAt) > 0) return false;
    }

    return true;
}

function getScenarioUnlockHints(id) {
    const rule = getScenarioRule(id);
    if (!rule) return [];

    const lines = [];
    if (Number.isFinite(rule.minLevel)) lines.push(getUIText("scenario.ruleMinLevel").replace("[LEVEL]", rule.minLevel));
    if (Array.isArray(rule.requiredFlags) && rule.requiredFlags.length > 0) {
        const remaining = rule.requiredFlags.filter(f => !hasGameFlag(f));
        if (remaining.length > 0) lines.push(getUIText("scenario.ruleNeedInfo").replace("[LIST]", remaining.join(", ")));
    }
    if (Array.isArray(rule.requiredItems) && rule.requiredItems.length > 0) {
        const missing = rule.requiredItems.filter(item => !hasItemAnywhere(item));
        if (missing.length > 0) lines.push(getUIText("scenario.ruleNeedItem").replace("[LIST]", missing.join(", ")));
    }
    if (Array.isArray(rule.requiredScenariosCleared) && rule.requiredScenariosCleared.length > 0) {
        const missing = rule.requiredScenariosCleared.filter(sid => !SCENARIOS[sid] || !SCENARIOS[sid].cleared);
        if (missing.length > 0) lines.push(getUIText("scenario.ruleNeedPrereq").replace("[LIST]", missing.join(", ")));
    }
    if (Number.isFinite(rule.minClearedCount)) {
        const cur = getClearedScenarioCount();
        if (cur < rule.minClearedCount) {
            lines.push(
                getUIText("scenario.ruleMinCleared")
                    .replace("[COUNT]", rule.minClearedCount)
                    .replace("[CURRENT]", cur)
            );
        }
    }
    if (rule.startAt) {
        lines.push(getUIText("scenario.ruleStartAt")
            .replace("[DAY]", rule.startAt.day)
            .replace("[TIME]", TIME_SLOTS[rule.startAt.timeIndex || 0] || "")
            .trim());
    }
    if (rule.expireAt) {
        lines.push(getUIText("scenario.ruleExpireAt")
            .replace("[DAY]", rule.expireAt.day)
            .replace("[TIME]", TIME_SLOTS[rule.expireAt.timeIndex || 0] || "")
            .trim());
    }
    return lines;
}

function migrateDungeonRoomTypes(map) {
    if (!Array.isArray(map)) return;
    for (let y = 0; y < map.length; y++) {
        const row = map[y];
        if (!Array.isArray(row)) continue;
        for (let x = 0; x < row.length; x++) {
            const room = row[x];
            if (!room || typeof room !== "object") continue;
            if (room.type === "bush") room.type = "event";
        }
    }
}


function nextInfiniteStage() {
    closePopup();
    infiniteStage++;
    startInfiniteStage();
}

window.onload = initGame;

