const CARD_DATA = {
// [공용] 누구나 사용 가능
    "테스트용": { rank: 1, cost: 0, type: "attack", desc: "테스트용, 적 HP -50", dmg: 50, job: "common" },
    "타격": { rank: 1, cost: 1, type: "attack", desc: "적 HP -5", dmg: 5, job: "common" },
    "수비": { rank: 1, cost: 1, type: "skill", desc: "방어도 +4", block: 4, job: "common" },
    "심호흡": { rank: 1, cost: 1, type: "social", subtype: "skill", desc: "내 마음의 벽 +15 회복", heal: 15, target: "self", job: "common" },
    "도발": { rank: 2, cost: 2, type: "skill", desc: "적 약화(2턴), 방어도+3", buff: {name:"약화", val:2}, block: 3, target: "enemy", job: "common" },
    "독 뿌리기": { rank: 2, cost: 2, type: "skill", desc: "적 독(2턴), 방어도+3", buff: {name:"독", val:2}, block: 3, target: "enemy", job: "common" },   
    "힐링광선": { rank: 2, cost: 2, type: "skill", desc: "나 활력(2턴), 방어도+3", buff: {name:"활력", val:2}, target:"self", job: "common", block: 3 },
    "껴입기": { rank: 2, cost: 2, type: "skill", desc: "나 건강(2턴), 방어도+4", buff: {name:"건강", val:2}, target:"self", job: "common", block: 4 },
    "넘어뜨리기": { rank: 2, cost: 2, type: "attack", desc: "적 취약(2턴), 적 HP -4", buff: {name:"취약", val:2}, job: "common", dmg: 4 },
    "전기 충격": { rank: 2, cost: 2, type: "attack", desc: "적 마비(2턴), 적 HP -4", buff: {name:"마비", val:2}, job: "common", dmg: 4 },
    "달리기": { rank: 2, cost: 2, type: "attack", desc: "나 쾌속(2턴), 적 HP -4", buff: {name:"쾌속", val:2}, target:"self", job: "common", dmg: 4 },
   // 특수 기능 (special 태그 사용)
    "방패 부수기": { rank: 2, cost: 2, type: "attack", desc: "적 방어도 제거, 적 HP -2", special: "break_block", job: "common", dmg: 2 },
    "주머니 뒤지기": { rank: 2, cost: 1, type: "skill", desc: "방어도 +2, 카드 2장 뽑기", job: "common", block: 2, draw: 2 },
   "럭키피스": { rank: 3, cost: 1, type: "attack", desc: "적 HP -8, 상금 2배 (소멸)", special: "lucky", dmg: 8, job: "common", isExhaust: true },
   
   // [탐정 전용] (Detective) - 논리, 이성적
    "논리적 반박": { rank: 1, cost: 1, type: "social", subtype: "attack", desc: "적 마음의 벽 -10", dmg: 10, job: "detective" },
    "증거 제시": { rank: 2, cost: 2, type: "social", subtype: "attack", desc: "적 마음의 벽 -25", dmg: 25, job: "detective" },
    "관찰": { rank: 1, cost: 0, type: "skill", desc: "카드 2장 뽑기", draw: 2, job: "detective" },
    "사격": { rank: 3, cost: 1, type: "attack", desc: "나 강화(2턴), 적 HP -8", buff: {name:"강화", val:2}, target:"self", job: "detective", dmg: 8 },
    
   
    // [해결사 전용] (Fixer) - 물리, 전투적
    "강펀치": { rank: 1, cost: 2, type: "attack", desc: "적 HP -12", dmg: 12, job: "fixer" },
    "위협": { rank: 1, cost: 1, type: "social", subtype: "attack", desc: "적 마음의 벽 -15 (공포)", dmg: 15, job: "fixer" },
    "무기 손질": { rank: 2, cost: 1, type: "skill", desc: "나 강화(3턴)", buff: {name:"강화", val:3}, target:"self", job: "fixer" },
    "근육자랑": { rank: 2, cost: 2, type: "attack", desc: "나 강화(2턴), 적 HP -4", buff: {name:"강화", val:2}, target:"self",job: "fixer", dmg: 4 },
    "돌진" : { rank: 2, cost: 2, type: "attack", desc: "적 8 피해, 방어도 +8", job: "fixer", dmg: 8, block: 8},
     "마구 뽑기": { rank: 3, cost: 0, type: "skill", desc: "카드 5장 뽑기 (소멸)", job: "common",draw: 5, isExhaust: true },
    

     "비명": { 
        rank: 2, cost: 1, type: "social", subtype: "attack", 
        desc: "날카로운 비명! (SP -10)", 
        dmg: 10, 
        job: "enemy"
    },
    // --- 보스 전용 기술 ---
    "강철 분쇄": { rank: 3, cost: 2, type: "attack", desc: "치명적인 일격! (피해 15)",job: "common", dmg: 15 },
    
    "광신의 춤": { rank: 3, cost: 2, type: "skill", desc: "체력 회복 +20, 방어도 +10",job: "common", buff: {name:"활력", val:5}, block: 10 },
    "정신 붕괴 파동": { rank: 3, cost: 2, type: "attack", desc: "전체 멘탈 공격 (SP 데미지)",job: "common", dmg: 10, type: "social", val: -20 }, // 소셜/배틀 하이브리드
    
    "부하 호출": { 
        rank: 3, 
        cost: 2, 
        type: "skill", 
        desc: "불량배를 1명 호출하여 전투에 합류시킵니다.", 
        job: "common",
        special: "summon",      // 특수 기능 태그
        summonTarget: "불량배",   // 소환할 적의 ENEMY_DATA 키
        playerDesc: "(사용 불가) 적 전용 스킬입니다." // 나중에 플레이어용 효과 구현 시 대체될 텍스트
    }
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
    },
    "boss_cursed_doll": {
        name: "💀 저주받은 인형",
        baseHp: 120,
        stats: { atk: 4, def: 0, spd: 1 }, // 공격력은 세지만 방어/속도가 낮음
        growth: { hp: 0, atk: 0, def: 0, spd: 0 },
        deckType: "custom",
        // 독을 걸거나 멘탈 공격(비명)을 섞어 쓰는 까다로운 패턴
        deck: ["독 뿌리기", "독 뿌리기", "비명", "타격"], 
        img: "https://placehold.co/120x120/5e2a84/fff?text=DOLL",
        // [추가 데이터] 패시브/태그/전리품 힌트
        passive: {
            name: "저주의 끈적임",
            desc: "매 턴 시작 시 플레이어에게 독 1 중첩을 남깁니다."
        },
        tags: ["boss", "cursed", "doll"],
        lootHint: ["울끈불끈 패딩", "고급 액세서리"] // 필수는 아니지만 테이블 구성 시 참고용
    }
};

// [data.js] SOCIAL_CARD_DATA 수정

const SOCIAL_CARD_DATA = {
    // [공격 계열] 적의 마음의 벽을 깎음 (dmg 사용)
    "논리적 반박": { rank: 1, cost: 1, type: "social", subtype: "attack", desc: "적 마음의 벽 -10", dmg: 10 },
    "비꼬기": { rank: 1, cost: 1, type: "social", subtype: "attack", desc: "적 마음의 벽 -15", dmg: 15 },
    "증거 제시": { rank: 2, cost: 2, type: "social", subtype: "attack", desc: "적 마음의 벽 -25", dmg: 25 },
    "호통치기": { rank: 2, cost: 2, type: "social", subtype: "attack", desc: "적 마음의 벽 -15, 적 취약(2턴)", dmg: 15, buff: {name:"취약", val:2} },

    // [방어 계열] 내 마음의 벽 보호 (block 사용)
    "한귀로 흘리기": { rank: 1, cost: 1, type: "social", subtype: "defend", desc: "방어도 +10", block: 10 },
    "무시": { rank: 1, cost: 1, type: "social", subtype: "defend", desc: "방어도 +15", block: 15 },
    "침묵": { rank: 1, cost: 0, type: "social", subtype: "defend", desc: "방어도 +8", block: 8 },

    // [회복/유틸 계열] 내 마음의 벽 회복 (heal 사용)
    "심호흡": { rank: 1, cost: 1, type: "social", subtype: "skill", desc: "내 마음의 벽 +15 회복", heal: 15, target: "self" },
    "차 한잔": { rank: 2, cost: 1, type: "social", subtype: "skill", desc: "내 마음의 벽 +20 회복, 카드 1장 뽑기", heal: 20, target: "self", draw: 1 },
    
    // [특수]
    "매혹": { rank: 2, cost: 2, type: "social", subtype: "magic", desc: "적 공격력 감소(2턴), 마음의 벽 -10", dmg: 10, buff: {name:"약화", val:2} },
    "거짓말": { rank: 2, cost: 1, type: "social", subtype: "trick", desc: "성공 시 적 벽 -40, 실패 시 나 벽 -20", special: "gamble_lie" }
};

// 기존 카드 데이터에 합치기
Object.assign(CARD_DATA, SOCIAL_CARD_DATA);

// [data.js] NPC_DATA 수정

const NPC_DATA = {
    "겁먹은 목격자": {
        name: "겁먹은 목격자",
        maxSp: 100, sp: 50,
        baseAtk: 2, baseDef: 0, baseSpd: 2,
        // [수정] 덱을 새 카드로 교체 (침묵, 무시, 심호흡 등)
        deck: ["침묵", "무시", "심호흡", "논리적 반박"], 
        img: "https://placehold.co/100x100/7f8c8d/ffffff?text=Witness",
        desc: "무언가 끔찍한 것을 본 것 같다. 대화가 통할까?",
        likes: ["drink", "food", "warm", "money"], 
        dislikes: ["weapon", "horror", "noise"],
        battle: { maxHp: 40, stats: { atk: 2, def: 0, spd: 4 }, deck: ["타격", "비명", "수비"] }
    },
    "부패 경찰": {
        name: "부패 경찰",
        maxSp: 100, sp: 50,
        baseAtk: 3, baseDef: 2, baseSpd: 3,
        // [수정] 덱을 새 카드로 교체 (증거 제시, 비꼬기, 호통치기 등)
        deck: ["증거 제시", "비꼬기", "호통치기", "무시"],
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
    },
    "abandoned_mansion": {
        name: "🏚️ 폐쇄된 저택",
        desc: "오랫동안 방치되어 잡초가 무성한 대저택. 기분 나쁜 시선이 느껴진다.",
        danger: 4, // 난이도 높음 (별 4개)
        color: "#5e2a84", // 보라색 테마
        hidden: true, // 평소에는 안 보임! (시나리오를 받아야 보임)
        scenarios: ["cursed_antique"], // 이 구역에서 진행할 시나리오 ID
        facilities: [] // 상점 없음 (오직 수사뿐)
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
        introStory: [
            { type: "bg", src: "https://placehold.co/800x600/111/333?text=Rainy+Street" },
            { type: "char", id: "client", name: "???", src: "https://placehold.co/400x600/555/fff?text=Client", pos: "center" },
            { type: "talk", id: "client", name: "의뢰인", text: "탐정님... 제발 도와주세요." },
            { type: "talk", id: "client", name: "의뢰인", text: "제 동생이 배달을 나갔다가 3일째 돌아오지 않고 있어요." },
            { type: "talk", id: "none", name: "나", text: "(흠... 단순 가출일까, 아니면 사고일까.)" },
            { type: "choice", options: [
                { txt: "자세한 이야기를 듣는다", next: 6 },
                { txt: "귀찮으니 돌려보낸다 (하지만 의뢰는 받아야 한다)", next: 6 }
            ]},
            { type: "talk", id: "client", name: "의뢰인", text: "마지막으로 연락된 곳이 '뒷골목' 근처였어요. 사례는 넉넉히 하겠습니다." },
            { type: "end" } // 스토리가 끝나면 자동으로 callback(의뢰 수락) 실행
        ],
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
    },
    "cursed_antique": {
        title: "저주받은 골동품",
        desc: "한 골동품점에서 시작된 저주가 사람들을 위협하고 있다. 원흉을 찾아라.",
        
        // 탐사 화면에서 이동할 장소들 (분위기용)
        locations: ["먼지 쌓인 응접실", "어두운 복도", "인형의 방"],
        
        // 탐사 중 발생할 랜덤 이벤트 (기본 3종 세트)
        events: [
            { type: "battle", chance: 0.4 }, 
            { type: "text", chance: 0.3 }, 
            { type: "nothing", chance: 0.3 }
        ],
        
        // ★ 위에서 만든 보스 연결
        boss: "boss_cursed_doll",
        
        // ★ 의뢰 수락 시 해금될 구역 (위에서 만든 저택)
        unlocks: ["abandoned_mansion"], 
        
       
        
        // 조사 성공 시 나오는 문구들
        clueEvents: [
            { text: "일기장의 찢어진 페이지를 발견했습니다.", gain: 15 },
            { text: "누군가를 노려보는 듯한 그림을 찾았습니다.", gain: 20 },
            { text: "바닥에 떨어진 핏방울을 따라갑니다.", gain: 25 }
        ],
        
        // 클리어 보상
        reward: { gold: 2000, xp: 500, itemRank: 2 },
        canRetreat: true, // 도망 가능
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
                txt: "돈을 넣는다 (100원)", 
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
                txt: "피를 판다 (HP -10, +500원)", 
                func: () => {
                    takeDamage(player, 10);
                    if(player.hp > 0) {
                        player.gold += 500;
                        alert("남자는 피를 뽑아가고 돈을 쥐어줍니다. (HP -10, +500원)");
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
                txt: "기도한다 (SP +10, 위협 +10)", 
                func: () => {
                    player.sp = Math.min(player.maxSp, player.sp + 10);
                    game.scenario.doom += 10;
                    alert("마음이 차분해지지만, 시간이 많이 흘렀습니다. (SP +10, 위협도 +10)");
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
                txt: "가진다 (+소지금, SP -3)", 
                func: () => {
                    let gain = 300 + Math.floor(Math.random() * 200);
                    player.gold += gain;
                    player.sp -= 3;
                    alert(`죄책감이 들지만 지갑은 두둑합니다. (+${gain}원, SP -3)`);
                    closePopup();
                    renderExploration();
                }
            },
            { 
                txt: "경찰서에 맡긴다 (SP +5)", 
                func: () => {
                    player.sp = Math.min(player.maxSp, player.sp + 5);
                    alert("착한 일을 했다는 뿌듯함이 느껴집니다. (SP +5)");
                    closePopup();
                    renderExploration();
                }
            }
        ]
    }
];
/* [data.js] JOB_DATA 수정 */

/* [data.js] JOB_DATA 수정 (이미지 경로 추가) */
const JOB_DATA = {
    "detective": {
        name: "사립 탐정",
        desc: "논리와 이성으로 사건을 해결합니다.",
        baseStats: { str: 10, con: 10, dex: 12, int: 16, wil: 14, cha: 12 }, 
        defaultTraits: ["sharp_eye"], 
        starterDeck: ["테스트용", "타격", "수비", "수비", "사격", "달리기", "관찰"],
        starterSocialDeck: ["논리적 반박", "논리적 반박", "비꼬기", "심호흡", "무시"],
        // [NEW] 탐정 이미지
        img: "https://placehold.co/150x150/2c3e50/ffffff?text=Detective"
    },
    "fixer": {
        name: "해결사",
        desc: "주먹과 무력이 법보다 가깝습니다.",
        baseStats: { str: 16, con: 14, dex: 12, int: 8, wil: 10, cha: 12 },
        defaultTraits: ["street_fighter"],
        starterDeck: ["타격", "타격", "타격", "강펀치", "수비", "도발"],
        starterSocialDeck: ["위협", "위협", "무시", "무시", "심호흡"],
        // [NEW] 해결사 이미지
        img: "https://placehold.co/150x150/c0392b/ffffff?text=Fixer"
    }
};

/* [data.js] TRAIT_DATA 수정 (스탯 보너스 수치 상향) */
/* 기존 +1, +2는 티가 안 나므로 +2, +3 정도로 조정하거나 유지하되 Mod 계산에 맡김 */
const TRAIT_DATA = {
    "sharp_eye": {
        name: "예리한 눈",
        type: "job_unique",
        desc: "[탐정] 관찰력 보정 (지능 +2)",
        cost: 0,
        stats: { int: 2 } // [수정] +1 -> +2 (보정치 +1 효과)
    },
    "street_fighter": {
        name: "싸움꾼",
        type: "job_unique",
        desc: "[해결사] 주먹질 보정 (근력 +2)",
        cost: 0,
        stats: { str: 2 } // [수정] +1 -> +2
    },
    "genius": { 
        name: "천재성", 
        type: "positive", 
        desc: "지능 +4, 경험치 +20%", 
        cost: 4,
        stats: { int: 4 }, // [수정] +2 -> +4 (확실한 보너스)
        onGainXp: (val) => Math.floor(val * 1.2)
    },
    "tough_body": { 
        name: "강철 신체", 
        type: "positive", 
        desc: "건강 +4, 최대 HP 증가", 
        cost: 3,
        stats: { con: 4 } 
    },
    "rich": {
        name: "금수저",
        type: "positive", 
        desc: "시작금 +3000원", 
        cost: 2,
        onAcquire: (p) => { p.gold += 3000; }
    },
    "attractive": {
        name: "매력적",
        type: "positive",
        desc: "매력 +4 (설득력 증가)",
        cost: 2,
        stats: { cha: 4 }
    },
    "weak_mind": { 
        name: "유리 멘탈", 
        type: "negative", 
        desc: "정신 -4 (최대 SP 감소)", 
        cost: -3,
        stats: { wil: -4 } 
    },
    "clumsy": { 
        name: "덜렁이", 
        type: "negative", 
        desc: "민첩 -4 (행동 순서 느림)", 
        cost: -2, 
        stats: { dex: -4 } 
    },
    "debt": {
        name: "빚쟁이",
        type: "negative", 
        desc: "시작금 -1000원", 
        cost: -1,
        onAcquire: (p) => { p.gold -= 1000; }
    },
    "frail": {
        name: "허약함",
        type: "negative", 
        desc: "건강 -4, 최대 HP 감소",
        cost: -3,
        stats: { con: -4 }
    }
};