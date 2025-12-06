const CARD_DATA = {
    // 1성 (기본)
    "타격": { rank: 1, cost: 1, type: "attack", desc: "적 HP -5", dmg: 5 },
    "수비": { rank: 1, cost: 1, type: "skill", desc: "방어도 +4", block: 4 },
   
    
    // 1성 (특수)
    "잠자기": { rank: 1, cost: 0, type: "skill", desc: "활력(2턴), 방어도+2 (소멸)", buff: {name:"활력", val:2}, block: 2, isExhaust: true },

    // 2성 (디버프 & 복합)
    // 기존: val이 방어도였음 -> block: 3으로 명시
    "도발": { rank: 2, cost: 2, type: "skill", desc: "적 약화(2턴), 방어도+3", buff: {name:"약화", val:2}, block: 3, target: "enemy" },
    "독 뿌리기": { rank: 2, cost: 2, type: "skill", desc: "적 독(2턴), 방어도+3", buff: {name:"독", val:2}, block: 3, target: "enemy" },    "힐링광선": { rank: 2, cost: 2, type: "skill", desc: "나 활력(2턴), 방어도+3", buff: {name:"활력", val:2}, target:"self", block: 3 },
    "껴입기": { rank: 2, cost: 2, type: "skill", desc: "나 건강(2턴), 방어도+4", buff: {name:"건강", val:2}, target:"self", block: 4 },

    // 2성 (공격 + 디버프/버프)
    "넘어뜨리기": { rank: 2, cost: 2, type: "attack", desc: "적 취약(2턴), 적 HP -4", buff: {name:"취약", val:2}, dmg: 4 },
    "전기 충격": { rank: 2, cost: 2, type: "attack", desc: "적 마비(2턴), 적 HP -4", buff: {name:"마비", val:2}, dmg: 4 },
    "근육자랑": { rank: 2, cost: 2, type: "attack", desc: "나 강화(2턴), 적 HP -4", buff: {name:"강화", val:2}, target:"self", dmg: 4 },
    "달리기": { rank: 2, cost: 2, type: "attack", desc: "나 쾌속(2턴), 적 HP -4", buff: {name:"쾌속", val:2}, target:"self", dmg: 4 },

    "돌진" : { rank: 2, cost: 2, type: "attack", desc: "적 8 피해, 방어도 +8", dmg: 8, block: 8},

    // 특수 기능 (special 태그 사용)
    "방패 부수기": { rank: 2, cost: 2, type: "attack", desc: "적 방어도 제거, 적 HP -2", special: "break_block", dmg: 2 },
    "주머니 뒤지기": { rank: 2, cost: 1, type: "skill", desc: "방어도 +2, 카드 2장 뽑기", block: 2, draw: 2 },
    // 3성
    "사격": { rank: 3, cost: 1, type: "attack", desc: "나 강화(2턴), 적 HP -8", buff: {name:"강화", val:2}, target:"self", dmg: 8 },
    "럭키피스": { rank: 3, cost: 1, type: "attack", desc: "적 HP -8, 상금 2배 (소멸)", special: "lucky", dmg: 8, isExhaust: true },
    "마구 뽑기": { rank: 3, cost: 0, type: "skill", desc: "카드 5장 뽑기 (소멸)", draw: 5, isExhaust: true },
    
    // --- 보스 전용 기술 ---
    "강철 분쇄": { rank: 3, cost: 2, type: "attack", desc: "치명적인 일격! (피해 15)", dmg: 15 },
    "부하 호출": { rank: 3, cost: 2, type: "skill", desc: "방어도 +15, 힘 모으기(강화)", block: 15, buff: {name:"강화", val:3} },
    "광신의 춤": { rank: 3, cost: 2, type: "skill", desc: "체력 회복 +20, 방어도 +10", buff: {name:"활력", val:5}, block: 10 },
    "정신 붕괴 파동": { rank: 3, cost: 2, type: "attack", desc: "전체 멘탈 공격 (SP 데미지)", dmg: 10, type: "social", val: -20 } // 소셜/배틀 하이브리드
};

/* [NEW] 적 데이터 정의 */
const ENEMY_DATA = {
    "불량배": {
        name: "불량배",
        baseHp: 20,
        stats: { atk: 1, def: 0, spd: 3 }, // 기본 스탯
        growth: { hp: 4, atk: 0.5, def: 0, spd: 0.1 }, // 레벨당 성장 수치
        deckType: "basic", // 사용하는 덱 타입
        img: "https://placehold.co/100x100/c0392b/ffffff?text=Bully"
    },
    "허수아비": {
        name: "허수아비",
        baseHp: 30, // 조금 더 튼튼하게
        stats: { atk: 1, def: 1, spd: 2 }, // 
        growth: { hp: 5, atk: 0.5, def: 0.5, spd: 0.1 }, // 골고루 성장
        deckType: "player_like", // 타격5+수비4+2성1
        img: "https://placehold.co/100x100/f39c12/ffffff?text=Scarecrow"
    },
    // [NEW] 보스 데이터
    "boss_gang_leader": {
        name: "💀 개조된 불량배 대장",
        baseHp: 150, // 높은 체력
        stats: { atk: 3, def: 2, spd: 2 }, // 묵직한 스탯
        growth: { hp: 0, atk: 0, def: 0, spd: 0 }, // 보스는 레벨 스케일링을 따로 안 하거나 고정
        deckType: "custom", // 덱 생성 함수 안 쓰고 직접 지정
        deck: ["강철 분쇄", "강철 분쇄", "부하 호출", "타격", "수비"], // 전용 덱
        img: "https://placehold.co/120x120/000/fff?text=BOSS+1"
    },
    "boss_cult_leader": {
        name: "💀 광신도 교주",
        baseHp: 100,
        stats: { atk: 2, def: 1, spd: 4 }, // 빠른 속도
        growth: { hp: 0, atk: 0, def: 0, spd: 0 },
        deckType: "custom",
        deck: ["광신의 춤", "독 뿌리기", "비명", "사격"], // 하이브리드 패턴
        img: "https://placehold.co/120x120/4b0082/fff?text=BOSS+2"
    }
};

/* [수정] 대화(탐문) 카드 데이터 (상태이상 카드 추가) */
const SOCIAL_CARD_DATA = {
    // 1성
    "미소짓기": { rank: 1, cost: 1, type: "social", subtype: "friendly", desc: "호감도 +15", val: 15 },
    "안부 묻기": { rank: 1, cost: 1, type: "social", subtype: "friendly", desc: "호감도 +10, 방어도 +3", val: 10, block: 3 },
    "인상 쓰기": { rank: 1, cost: 1, type: "social", subtype: "hostile", desc: "멘탈 -15", val: -15 },
    "증거 제시": { rank: 1, cost: 1, type: "social", subtype: "hostile", desc: "멘탈 -10, 방어도 +3", val: -10, block: 3 },
    
    // [NEW] 상태이상 카드 (1성)
    "진정시키기": { rank: 1, cost: 1, type: "social", subtype: "skill", desc: "적의 분노/우울 상태 해제, 호감도 +5", val: 5, target: "enemy", special: "cure_anger" },

    // [NEW] 상태이상 카드 (2성)
    "매혹": { rank: 2, cost: 2, type: "social", subtype: "magic", desc: "적 헤롱헤롱(2턴). 방어력 감소.", buff: {name:"헤롱헤롱", val:2}, target:"enemy", val: 0 },
    "비꼬기": { rank: 2, cost: 1, type: "social", subtype: "hostile", desc: "멘탈 -30. 적 분노(3턴). (인내심 빠르게 감소)", val: -30, buff: {name:"분노", val:3}, target:"enemy" },
    "죄책감 자극": { rank: 2, cost: 2, type: "social", subtype: "hostile", desc: "멘탈 -25. 적 우울(3턴). (적 공격력 증가)", val: -25, buff: {name:"우울", val:3}, target:"enemy" },

    // (기존 2~3성 카드들 유지)
    "농담하기": { rank: 2, cost: 2, type: "social", subtype: "friendly", desc: "호감도 +25, 방어도 +5", val: 25, block: 5 },
    "침묵": { rank: 1, cost: 1, type: "social", subtype: "defend", desc: "방어도 +10", block: 10, val: 0 },
    "비명": { rank: 1, cost: 1, type: "social", subtype: "hostile", desc: "멘탈 -20", val: -20 },
    "무시": { rank: 1, cost: 1, type: "social", subtype: "defend", desc: "방어도 +15", block: 15, val: 0 },
    "거짓말": { rank: 2, cost: 1, type: "social", subtype: "trick", desc: "호감도 +30. 실패 시 내 멘탈 -10", special: "gamble", val: 30 },
    "기억 조작": { rank: 3, cost: 3, type: "social", subtype: "magic", desc: "호감도 +50. 마법적인 매료.", val: 50 },
    "심연의 응시": { rank: 3, cost: 3, type: "social", subtype: "magic", desc: "멘탈 -50. 공포를 심어줍니다.", val: -50 },
};

// 기존 카드 데이터에 합치기
Object.assign(CARD_DATA, SOCIAL_CARD_DATA);

/* [수정] 대화 상대(NPC) 데이터 (100/50 스케일 적용) */
const NPC_DATA = {
    "겁먹은 목격자": {
        name: "겁먹은 목격자",
        maxSp: 100, sp: 50, // [변경] 200/100 -> 100/50
        baseAtk: 2, baseDef: 0, baseSpd: 2,
        deck: ["침묵", "비명", "미소짓기", "안부 묻기"], 
        img: "https://placehold.co/100x100/7f8c8d/ffffff?text=Witness",
        desc: "무언가 끔찍한 것을 본 것 같다. 대화가 통할까?",
        likes: ["drink", "food", "warm", "money"], 
        dislikes: ["weapon", "horror", "noise"],
        battle: { maxHp: 40, stats: { atk: 2, def: 0, spd: 4 }, deck: ["타격", "비명", "수비"] }
    },
    "부패 경찰": {
        name: "부패 경찰",
        maxSp: 100, sp: 50, // [변경] 200/100 -> 100/50
        baseAtk: 3, baseDef: 2, baseSpd: 3,
        deck: ["증거 제시", "인상 쓰기", "책상 내려치기", "무시"],
        img: "https://placehold.co/100x100/2c3e50/ffffff?text=Police",
        desc: "돈 냄새를 맡고 왔다. 뇌물이면 통하겠지만, 장난감 같은 건 싫어한다.",
        likes: ["money", "valuable", "alcohol"], 
        dislikes: ["toy", "trash", "paper"],
        battle: { maxHp: 80, stats: { atk: 4, def: 2, spd: 2 }, deck: ["타격", "방패 부수기", "수비", "사격"] }
    }
};

const TOOLTIPS = {
    "약화": "공격 스탯이 절반으로 감소합니다.",
    "취약": "방어 스탯이 절반으로 감소합니다.",
    "마비": "속도 스탯이 절반으로 감소합니다.",
    "독": "턴 시작 시 중첩된 수치만큼 피해를 입고, 1 줄어듭니다.",
    "강화": "공격 스탯이 2배로 증가합니다.",
    "건강": "방어 스탯이 2배로 증가합니다.",
    "쾌속": "속도 스탯이 2배로 증가합니다.",
    "활력": "턴 시작 시 중첩된 수치만큼 체력을 회복하고, 1 줄어듭니다.",
    // [추가된 부분] 소멸 설명 추가
    "소멸": "카드를 사용하면 덱에서 제거되어, 이번 전투 동안 다시 나오지 않습니다.",
    // [NEW] 소셜 모드 전용 상태이상
    "헤롱헤롱": "정신을 못 차립니다. 방어(멘탈 방어) 스탯이 절반으로 감소합니다.",
    "분노": "화가 나서 참을성이 없어집니다. 턴마다 인내심이 2배로 감소합니다.",
    "우울": "감정이 격해집니다. 공격(멘탈 공격) 스탯이 50% 증가합니다."
    
};

const DISTRICTS = {
    "slums": {
        name: "뒷골목 슬럼",
        desc: "범죄와 오물이 뒤섞인 곳. 불량배가 많지만 정보도 많다.",
        danger: 1, 
        color: "#c0392b", 
        scenarios: ["tutorial"], 
        facilities: ["shop_black_market"]
    },
    "downtown": {
        name: "네온 다운타운",
        desc: "화려한 네온사인 아래 부패한 경찰과 취객들이 넘쳐난다.",
        danger: 2, 
        color: "#8e44ad", 
        scenarios: [], 
        facilities: ["shop_pharmacy"]
    },
    "plaza": {
        name: "기업 플라자",
        desc: "거대 기업들의 본사가 있는 곳. 보안이 삼엄하다.",
        danger: 3, 
        color: "#3498db", 
        scenarios: [], 
        facilities: ["shop_high_end"]
    },
    "cult_hideout": {
        name: "👁️ 교단 은신처",
        desc: "음습한 기운이 느껴지는 폐쇄된 지하철역.",
        danger: 3, 
        color: "#8e44ad", 
        hidden: true, 
        
        // ★ [이 부분이 빠져 있었습니다!] 추가해주세요. ★
        scenarios: ["cult_investigation"], 
        
        facilities: [] 
    }
};

/* [수정] 아이템 데이터 (통합 시스템) */
const ITEM_DATA = {
    // --- 패시브 아이템 (구 유물) ---
    "쿠보탄": {type: "item", usage: "passive", rank: 1, price: 2000, icon: "🥊", desc: "공격력 +1 (보유 효과)", tags: ["weapon", "tool"]},
    "강인함의 부적": {type: "item", usage: "passive", rank: 1, price: 2000, icon: "🧿", desc: "방어력 +1 (보유 효과)", tags: ["charm", "accessory"]},
    "좋은 운동화": {type: "item", usage: "passive", rank: 1, price: 2000, icon: "👟", desc: "속도 +1 (보유 효과)", tags: ["clothes", "brand"]},
    "울끈불끈 패딩": {type: "item", usage: "passive", rank: 2, price: 3000, icon: "🧥", desc: "최대 HP +50 (보유 효과)", tags: ["clothes", "warm"]},
    "황금 대타": {type: "item", usage: "passive", rank: 3, price: 4000, icon: "🏺", desc: "부활 1회 (보유 효과)", tags: ["magic", "valuable"]},

    // --- 소모성 아이템 ---
    "회복약": {type: "item", usage: "consume", rank: 1, price: 1000, icon: "🍷", desc: "HP 25 회복 (사용 시 소모)", effect: "heal", val: 25, target: "self", tags: ["drink", "alcohol"]},
    "호신용 스프레이": {type: "item", usage: "consume", rank: 1, price: 1000, icon: "🧴", desc: "적 10 피해 (사용 시 소모)", effect: "damage", val: 10, target: "enemy", tags: ["weapon", "chemical"]},
    "피난의 피리": {type: "item", usage: "consume", rank: 2, price: 2000, icon: "🎼", desc: "다음 이벤트 휴식 고정", effect: "event_rest", target: "self", tags: ["instrument", "noise"]},
    "뇌물 봉투": {type: "item", usage: "consume", rank: 2, price: 1500, icon: "✉️", desc: "NPC 호감도 대폭 상승", effect: "none", target: "enemy", tags: ["money", "paper"]},
    "공포 영화 포스터": {type: "item", usage: "consume", rank: 1, price: 500, icon: "👻", desc: "NPC 멘탈 감소", effect: "none", target: "enemy", tags: ["horror", "paper"]},
    
    // --- 특수 (패시브지만 소모품처럼 취급되었던 것들) ---
    // 대타 인형은 가지고 있으면 효과가 발동하고 사라지므로 'passive'에 가깝지만 로직상 특수 처리
    "대타 인형": {type: "item", usage: "passive", rank: 3, price: 3000, icon: "🧸", desc: "사망 시 자동 소모하여 부활", effect: "revive", target: "passive", tags: ["doll", "toy"]}
};

/* [수정] 시나리오 데이터 (복귀 가능 여부 플래그 추가) */
const SCENARIOS = {
    "tutorial": {
        title: "사라진 배달부",
        desc: "배달부의 행방을 찾아라.",
        locations: ["뒷골목", "폐기물 처리장", "네온 마켓"],
        events: [{ type: "battle", chance: 0.4 }, { type: "text", chance: 0.3 }, { type: "nothing", chance: 0.3 }],
        boss: "boss_gang_leader",
        unlocks: [], 
        clueEvents: [{ text: "찢어진 전표 발견.", gain: 15 }, { text: "파편 발견.", gain: 20 }],
        reward: { gold: 500, xp: 100, itemRank: 1 },
        
        // [NEW] 복귀 가능 여부 (켜고 끄기)
        canRetreat: true 
    },
    "cult_investigation": {
        title: "기묘한 실종",
        desc: "사람들이 지하철역 근처에서 사라진다.",
        locations: ["지하철 승강장", "환기구 통로", "제물 보관소"],
        events: [{ type: "battle", chance: 0.4 }, { type: "text", chance: 0.3 }, { type: "nothing", chance: 0.3 }],
        boss: "boss_cult_leader",
        unlocks: ["cult_hideout"], 
        clueEvents: [{ text: "부적 발견.", gain: 10 }, { text: "제사 도구 발견.", gain: 25 }],
        reward: { gold: 1200, xp: 300, itemRank: 2 },
        
        // [NEW] 복귀 가능 여부
        canRetreat: true
    }
};
/* [수정] 이벤트 데이터 (종료 시 renderExploration 호출) */
const EVENT_DATA = [
    {
        id: "vending_machine",
        title: "⚡ 고장 난 자판기",
        desc: "골목길 구석에 네온사인이 깜빡이는 낡은 자판기가 있습니다.<br>안에 내용물이 들어있지만 전원이 불안정해 보입니다.",
        choices: [
            { 
                txt: "돈을 넣는다 (100G)", 
                func: () => {
                    if(player.gold < 100) { alert("돈이 부족합니다."); return; }
                    player.gold -= 100;
                    let item = getRandomItem("consumable");
                    addItem(item);
                    alert(`덜컹! [${item}]이(가) 나왔습니다.`);
                    closePopup();
                    renderExploration(); // [핵심] 여기서 화면 갱신 및 버튼 활성화
                }
            },
            { 
                txt: "발로 찬다 (체력 -5, 50% 확률)", 
                func: () => {
                    if(Math.random() < 0.5) {
                        let item = getRandomItem("consumable");
                        addItem(item);
                        alert(`쾅! 충격으로 [${item}]이(가) 떨어졌습니다!`);
                    } else {
                        takeDamage(player, 5);
                        alert("쾅! 자판기가 쓰러지며 발을 찧었습니다. (체력 -5)");
                    }
                    closePopup();
                    renderExploration(); // [핵심]
                }
            },
            { txt: "무시한다", func: () => { closePopup(); renderExploration(); } }
        ]
    },
    {
        id: "shady_merchant",
        title: "🕶️ 수상한 거래",
        desc: "코트 깃을 세운 남자가 은밀하게 접근합니다.<br>\"좋은 물건이 있는데, 피를 좀 나눌 수 있나?\"",
        choices: [
            { 
                txt: "피를 판다 (HP -10, +500G)", 
                func: () => {
                    takeDamage(player, 10);
                    if(player.hp > 0) {
                        player.gold += 500;
                        alert("남자는 피를 뽑아가고 돈을 쥐어줍니다. (HP -10, +500G)");
                        closePopup();
                        renderExploration(); // [핵심]
                    } else {
                        closePopup(); // 죽으면 어차피 게임오버 팝업 뜸
                    }
                }
            },
            { 
                txt: "거절한다", 
                func: () => {
                    alert("남자는 혀를 차며 사라졌습니다.");
                    closePopup();
                    renderExploration(); // [핵심]
                }
            }
        ]
    },
    {
        id: "cult_altar",
        title: "🕯️ 기이한 제단",
        desc: "건물 지하에서 촛불이 켜진 작은 제단을 발견했습니다.<br>알 수 없는 속삭임이 들려옵니다.",
        choices: [
            { 
                txt: "기도한다 (SP +30, 위협 +10)", 
                func: () => {
                    player.sp = Math.min(player.maxSp, player.sp + 30);
                    game.scenario.doom += 10;
                    alert("마음이 차분해지지만, 시간이 많이 흘렀습니다. (SP +30, 위협도 +10)");
                    closePopup();
                    renderExploration();
                }
            },
            { 
                txt: "제단을 부순다 (전투)", 
                func: () => {
                    alert("제단을 걷어차자 숨어있던 광신도가 튀어나옵니다!");
                    closePopup();
                    startBattle(false); // 전투는 끝나면 알아서 복귀하므로 renderExploration 불필요
                }
            },
            { txt: "지나친다", func: () => { closePopup(); renderExploration(); } }
        ]
    },
    {
        id: "lost_wallet",
        title: "👛 떨어진 지갑",
        desc: "바닥에 두툼한 지갑이 떨어져 있습니다.",
        choices: [
            { 
                txt: "가진다 (+골드, SP -10)", 
                func: () => {
                    let gain = 300 + Math.floor(Math.random() * 200);
                    player.gold += gain;
                    player.sp -= 10;
                    alert(`죄책감이 들지만 지갑은 두둑합니다. (+${gain}G, SP -10)`);
                    closePopup();
                    renderExploration();
                }
            },
            { 
                txt: "경찰서에 맡긴다 (SP +20)", 
                func: () => {
                    player.sp = Math.min(player.maxSp, player.sp + 20);
                    alert("착한 일을 했다는 뿌듯함이 느껴집니다. (SP +20)");
                    closePopup();
                    renderExploration();
                }
            }
        ]
    }
];