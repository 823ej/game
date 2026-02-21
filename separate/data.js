const CHARACTER_IMAGES = {
    detective: "assets/my_detective.png",
    assistant: "assets/my_assistant.png"
};

const CARD_DATA = {
    // [공용] 누구나 사용 가능
    "테스트용": { rank: 1, cost: 0, type: "attack", desc: "테스트용, 적 HP -50", dmg: 50, job: "common" },
    "타격": { rank: 1, cost: 1, type: "attack", desc: "적 HP -5", dmg: 5, job: "common" },
    "수비": { rank: 1, cost: 1, type: "skill", desc: "방어도 +4", block: 4, job: "common" },
    "심호흡": { rank: 1, cost: 1, type: "social", subtype: "skill", desc: "내 의지 +15 회복", heal: 15, target: "self", job: "common" },

    // --- [신규] 카드군 확장: 공격/스킬/파워 ---
    // [공격] 전체 공격
    "휩쓸기": { rank: 1, cost: 1, type: "attack", targetType: "all", desc: "전체 공격! 적 HP -3", dmg: 3, job: "common" },
    "전면 공격": { rank: 2, cost: 2, type: "attack", targetType: "all", desc: "전체 공격! 적 HP -6", dmg: 6, job: "common" },

    // [공격] 다중 타격 / 랜덤 타격
    "연속 베기": { rank: 2, cost: 1, type: "attack", desc: "두 번 공격! (4 x 2)", dmg: 4, multiHit: 2, job: "common" },
    "난사": { rank: 2, cost: 2, type: "attack", desc: "랜덤한 적을 총 세 번 공격! (3 x 3)", dmg: 3, randomHits: 3, job: "common" },

    // [공격] 흡혈
    "흡혈": { rank: 2, cost: 2, type: "attack", desc: "막히지 않은 피해만큼 내 체력 회복", dmg: 7, lifesteal: 1, job: "common" },

    // [공격] 성장(전투 중 / 영구)
    "단련의 일격": { rank: 1, cost: 1, type: "attack", desc: "적 HP -4 (사용할 때마다 이번 전투에서 피해 +1)", dmg: 4, growOnUse: { scope: "combat", dmg: 1 }, job: "common" },
    "숙련의 일격": { rank: 3, cost: 2, type: "attack", desc: "적 HP -6 (사용할 때마다 영구적으로 피해 +1)", dmg: 6, growOnUse: { scope: "permanent", dmg: 1 }, job: "common" },

    // [공격] 휘발성(턴 종료 시 소멸)
    "불안정한 폭발": { rank: 2, cost: 1, type: "attack", desc: "강력하지만 불안정합니다. (피해 12) [휘발성]", dmg: 12, volatile: true, job: "common" },

    // [스킬] AP 추가
    "전술적 보충": { rank: 2, cost: 0, type: "skill", desc: "AP +1, 카드 1장 뽑기", gainAp: 1, draw: 1, job: "common" },

    // [스킬] 사용 시 자기 복제(버린 카드에 추가)
    "복제 훈련": { rank: 1, cost: 1, type: "skill", desc: "방어도 +3 (사용 시 자신을 1장 복제하여 버린 카드에 추가)", block: 3, selfDuplicateToDiscard: 1, job: "common" },

    // [스킬] 상태이상 카드 섞기 (뽑을 카드/버린 카드)
    "이판사판 돌격": { rank: 1, cost: 1, type: "attack", desc: "적 HP -10, 내 뽑을 카드에 [상처] 1장 추가", dmg: 10, statusAdd: { card: "상처", count: 1, destination: "draw" }, job: "common" },
    "불길한 예감": { rank: 2, cost: 0, type: "skill", desc: "뽑을 카드에서 원하는 카드 1장 가져오기, 내 뽑을 카드에 [혼란] 1장 추가", statusAdd: { card: "혼란", count: 1, destination: "draw" }, job: "common" },

    // [스킬] 원하는 카드/랜덤 카드 가져오기
    "재활용": { rank: 1, cost: 1, type: "skill", desc: "버린 카드에서 원하는 카드 1장 가져오기", fetch: { from: "discard", mode: "choose", count: 1, to: "hand" }, job: "common" },
    "주워담기": { rank: 1, cost: 0, type: "skill", desc: "버린 카드에서 랜덤 카드 1장 가져오기", fetch: { from: "discard", mode: "random", count: 1, to: "hand" }, job: "common" },
    "탐색(공용)": { rank: 2, cost: 1, type: "skill", desc: "뽑을 카드에서 원하는 카드 1장 가져오기", fetch: { from: "draw", mode: "choose", count: 1, to: "hand" }, job: "common" },
    "즉흥": { rank: 1, cost: 0, type: "skill", desc: "뽑을 카드에서 랜덤 카드 1장 가져오기", fetch: { from: "draw", mode: "random", count: 1, to: "hand" }, job: "common" },

    // [스킬] 원하는 카드 복사
    "복제 주문": { rank: 2, cost: 1, type: "skill", desc: "버린 카드에서 원하는 카드 1장 복사하여 손으로 가져오기", copy: { from: "discard", mode: "choose", count: 1, to: "hand" }, job: "common" },

    // [스킬] 적 능력치 낮추기(디버프)
    "약점 노출": { rank: 2, cost: 1, type: "skill", target: "enemy", desc: "적 약화(2턴) + 취약(2턴) + 마비(1턴)", buffs: [{ name: "약화", val: 2 }, { name: "취약", val: 2 }, { name: "마비", val: 1 }], job: "common" },

    // [스킬] 적 덱에 상태이상 카드 섞기
    "독구름 살포": { rank: 2, cost: 1, type: "skill", desc: "적 덱에 [고통] 2장 추가", target: "enemy", statusEnemyAdd: { card: "고통", count: 2 }, job: "common" },
    "방해 연막탄": { rank: 2, cost: 1, type: "skill", desc: "적 덱에 [혼란] 1장, [상처] 1장 추가", target: "enemy", statusEnemyAdd: { card: "혼란", count: 1 }, statusEnemyAdd2: { card: "상처", count: 1 }, job: "common" },

    // [스킬] 가시
    "가시 갑옷": { rank: 2, cost: 1, type: "skill", target: "self", desc: "나에게 [가시] 3 적용 (전투 종료까지, 공격받을 때마다 고정 피해 반격)", buff: { name: "가시", val: 3 }, job: "common" },
    "반사 방패": { rank: 2, cost: 1, type: "skill", target: "self", desc: "나에게 [반사] 2 적용 (반사: 막히지 않은 피해를 그대로 반격)", buff: { name: "반사", val: 2 }, job: "common" },

    // [스킬] 선천성
    "선천성: 준비 태세": { rank: 2, cost: 0, type: "skill", innate: true, isExhaust: true, desc: "선천성. AP +1, 카드 1장 뽑기 (소멸)", gainAp: 1, draw: 1, job: "common" },

    // [파워] 전투 중 지속 효과
    "전투 준비": { rank: 1, cost: 1, type: "power", isExhaust: true, desc: "이번 전투 동안 매 턴 시작 시 AP +1 (소멸)", power: { apBonus: 1 }, job: "common" },
    "절약의 달인": { rank: 2, cost: 1, type: "power", isExhaust: true, desc: "이번 전투 동안 매 턴 시작 시 손패 랜덤 1장의 비용이 0이 됩니다. (소멸)", power: { freeCostEachTurn: 1 }, job: "common" },
    "도발": { rank: 2, cost: 2, type: "skill", desc: "적 약화(2턴), 방어도+3", buff: { name: "약화", val: 2 }, block: 3, target: "enemy", job: "common" },
    "독 뿌리기": { rank: 2, cost: 2, type: "skill", desc: "적 독(2턴), 방어도+3", buff: { name: "독", val: 2 }, block: 3, target: "enemy", job: "common" },
    "힐링광선": { rank: 2, cost: 2, type: "skill", desc: "나 활력(2턴), 방어도+3", buff: { name: "활력", val: 2 }, target: "self", job: "common", block: 3 },
    "껴입기": { rank: 2, cost: 2, type: "skill", desc: "나 건강(2턴), 방어도+4", buff: { name: "건강", val: 2 }, target: "self", job: "common", block: 4 },
    "넘어뜨리기": { rank: 2, cost: 2, type: "attack", desc: "적 취약(2턴), 적 HP -4", buff: { name: "취약", val: 2 }, job: "common", dmg: 4 },
    "전기 충격": { rank: 2, cost: 2, type: "attack", desc: "적 마비(2턴), 적 HP -4", buff: { name: "마비", val: 2 }, job: "common", dmg: 4 },
    "달리기": { rank: 2, cost: 2, type: "attack", desc: "나 쾌속(2턴), 적 HP -4", buff: { name: "쾌속", val: 2 }, target: "self", job: "common", dmg: 4 },
    "마구 뽑기": { rank: 3, cost: 0, type: "skill", desc: "카드 5장 뽑기 (소멸)", job: "common", draw: 5, isExhaust: true },
    "화염병 투척": {
        rank: 2, cost: 1, type: "attack",
        desc: "적에게 [화염] 피해 10",
        dmg: 10, attr: "fire", job: "common"
    },
    "급소 찌르기": {
        rank: 2, cost: 2, type: "attack",
        desc: "적에게 [관통] 피해 8, 약점 시 3배",
        dmg: 8, attr: "pierce", job: "common"
    },
    // 특수 기능 (special 태그 사용)
    "방패 부수기": { rank: 2, cost: 2, type: "attack", desc: "적 방어도 제거, 적 HP -2", special: "break_block", job: "common", dmg: 2 },
    "주머니 뒤지기": { rank: 2, cost: 1, type: "skill", desc: "방어도 +2, 카드 2장 뽑기", job: "common", block: 2, draw: 2 },
    "럭키피스": { rank: 3, cost: 1, type: "attack", desc: "적 HP -8, 상금 2배 (소멸)", special: "lucky", dmg: 8, job: "common", isExhaust: true },

    // [탐정 전용] (Detective) - 단서/조수 기반
    "논리적 반박": { rank: 1, cost: 1, type: "social", subtype: "attack", desc: "적 의지 -10", dmg: 10, job: "detective" },
    "증거 제시": { rank: 2, cost: 2, type: "social", subtype: "attack", desc: "논리 방어를 깨뜨리고 적 의지 -25", dmg: 25, evidence: true, job: "detective" },
    "사실 확인": { rank: 1, cost: 1, type: "social", subtype: "defend", desc: "논리 방어 +8, 프로파일링 +20", block: 8, profilingGain: 20, job: "detective" },
    "결정적 논증": { rank: 3, cost: 0, type: "social", subtype: "attack", desc: "프로파일링 완성 시 생성되는 결정타", dmg: 40, job: "detective", isExhaust: true, noReward: true },
    "관찰": { rank: 1, cost: 0, type: "skill", desc: "카드 2장 뽑기", draw: 2, job: "detective" },
    "단서 수집": { rank: 1, cost: 1, type: "skill", target: "enemy", desc: "적에게 단서 3", addClue: 3, job: "detective" },
    "탐색": { rank: 1, cost: 1, type: "attack", desc: "적 HP -5, 단서 2", dmg: 5, addClue: 2, job: "detective" },
    "조사": { rank: 1, cost: 1, type: "attack", desc: "적 HP -5, 단서 1", dmg: 5, addClue: 1, job: "detective" },
    "회피": { rank: 1, cost: 1, type: "skill", desc: "방어도 +5", block: 5, job: "detective" },
    "경계": { rank: 1, cost: 0, type: "attack", desc: "적 HP -3, 이번 턴 조수 피해 30% 감소", dmg: 3, assistantDamageReductionPct: 0.3, job: "detective" },
    "명령: 유인": { rank: 1, cost: 0, type: "skill", desc: "이번 턴 적의 공격을 조수가 대신 받는다 (조수 생존 시)", assistantTauntTurns: 1, requireAssistant: true, job: "detective" },
    "명령: 방호": { rank: 2, cost: 2, type: "skill", desc: "조수에게 [건강] 적용, 방어도 +4 (조수 생존 시)", assistantBuff: { name: "건강", val: 2 }, assistantBlock: 4, requireAssistant: true, job: "detective" },
    "명령: 제압": { rank: 2, cost: 2, type: "attack", desc: "조수가 돌진해 피해 12, 적 약점 피격 1회 (조수 생존 시)", dmg: 12, requireAssistant: true, forceWeaknessHit: true, job: "detective" },
    "파고들기": { rank: 2, cost: 1, type: "attack", desc: "적의 단서 수치만큼 피해 (단서 유지)", dmgByClue: true, job: "detective" },
    "추리": { rank: 2, cost: 1, type: "attack", desc: "적 HP -6, 단서 5 이상이면 카드 1장 뽑기", dmg: 6, drawOnClue: { threshold: 5, draw: 1 }, job: "detective" },
    "정황 재구성": { rank: 2, cost: 1, type: "attack", desc: "적 HP -4, 단서 모두 소모: 소모된 단서 x3 추가 피해. 단서 3 이상이면 약점 공략", dmg: 4, consumeClueForDamage: { mult: 3, triggerWeaknessHitAt: 3 }, job: "detective" },
    "감정 분석": { rank: 1, cost: 0, type: "skill", target: "enemy", desc: "적에게 단서 1, 다음 공격에 [관통] 부여", addClue: 1, grantNextAttackAttrs: ["pierce"], job: "detective" },
    "증언 채집": { rank: 2, cost: 1, type: "skill", target: "self", desc: "[반응] 다음 적 공격 시 피해 2 감소, 공격자에게 단서 2", reaction: { trigger: "onEnemyAttack", reduceDmgFlat: 2, addClue: 2, expiresOnPlayerTurnStart: true }, job: "detective" },
    "현장 교란": { rank: 2, cost: 1, type: "skill", target: "self", desc: "[반응] 다음 적 공격 시 피해 40% 감소, 공격자 약화(1턴)", reaction: { trigger: "onEnemyAttack", reduceDmgPct: 0.4, debuff: { name: "약화", val: 1 }, expiresOnPlayerTurnStart: true }, job: "detective" },
    "긴급 방호": { rank: 2, cost: 1, type: "skill", target: "self", desc: "[반응] 다음 적 공격 시 방어도 +6, 피해 2 감소", reaction: { trigger: "onEnemyAttack", block: 6, reduceDmgFlat: 2, expiresOnPlayerTurnStart: true }, job: "detective" },
    "허점 포착": { rank: 2, cost: 1, type: "skill", target: "self", desc: "[반응] 다음 적 공격 시 피해 30% 감소, 공격자 취약(1턴)", reaction: { trigger: "onEnemyAttack", reduceDmgPct: 0.3, debuff: { name: "취약", val: 1 }, expiresOnPlayerTurnStart: true }, job: "detective" },
    "응급 브리핑": { rank: 2, cost: 1, type: "skill", target: "self", desc: "[반응] 다음 적 공격 시 조수 방어도 +8, 공격자에게 단서 1", reaction: { trigger: "onEnemyAttack", assistantBlock: 8, addClue: 1, expiresOnPlayerTurnStart: true }, job: "detective" },
    "잠복 근무": { rank: 1, cost: 1, type: "skill", desc: "방어도 +8, 다음 턴 카드 1장 추가 드로우", block: 8, nextTurnDraw: 1, job: "detective" },
    "조수 호출": { rank: 1, cost: 1, type: "skill", desc: "조수 회복 +5", assistantHeal: 5, job: "detective" },
    "명령: 눈길 끌기": { rank: 2, cost: 1, type: "skill", desc: "이번 턴 적의 공격을 조수가 대신 받음, 조수 방어도 +15", assistantTauntTurns: 1, assistantBlock: 15, requireAssistant: true, job: "detective" },
    "고찰": { rank: 2, cost: 1, type: "skill", desc: "적 전체 단서 3, 손패 공격 카드 비용 0 (이번 턴)", addClueAll: 3, reduceAttackCostThisTurn: true, job: "detective" },
    "비정한 결단": { rank: 3, cost: 0, type: "skill", desc: "조수 HP 절반 감소, 감소 HP 2당 AP +1", assistantSacrifice: true, job: "detective" },
    "계획: 미행 기록": { rank: 2, cost: 1, type: "power", desc: "[계획] 전투 종료까지 적 공격 시 공격자에게 단서 1", stakeout: { trigger: "onEnemyAttack", addClue: 1 }, job: "detective" },
    "계획: 급습 대비": { rank: 2, cost: 1, type: "power", desc: "[계획] 전투 종료까지 적 공격 시 피해 1 감소, 방어도 +2", stakeout: { trigger: "onEnemyAttack", reduceDmgFlat: 1, block: 2 }, job: "detective" },
    "조수 보고": { rank: 2, cost: 1, type: "power", desc: "조수가 살아있다면 매 턴 시작 시 무작위 적에게 단서 2", power: { assistantClueOnTurnStart: 2 }, requireAssistant: true, job: "detective" },
    "직감": { rank: 3, cost: 2, type: "power", desc: "매 턴 시작 시 무작위 적에게 단서 3", power: { clueOnTurnStart: 3 }, job: "detective" },
    "방탄 코트": { rank: 2, cost: 1, type: "power", desc: "조수가 받는 모든 피해 3 감소", power: { assistantDamageReductionFlat: 3 }, job: "detective" },
    "연쇄 작용": { rank: 3, cost: 3, type: "power", desc: "단서 부여량 2배", power: { clueMultiplier: 2 }, job: "detective" },
    "결론": { rank: 2, cost: 2, type: "attack", desc: "적 HP -6, 단서 10 이상이면 강력한 결론", dmg: 6, solveCase: { threshold: 10, bonusDmg: 50, consume: true }, job: "detective" },
    "조수 치료": { rank: 1, cost: 0, type: "skill", desc: "조수 회복 +10 (내 HP -5)", assistantHeal: 10, assistantHpCost: 5, job: "detective" },
    "사격": { rank: 3, cost: 1, type: "attack", desc: "나 강화(2턴), 적 HP -8", buff: { name: "강화", val: 2 }, target: "self", job: "detective", dmg: 8 },


    // [해결사 전용] (Fixer) - 물리, 전투적
    "강펀치": { rank: 1, cost: 2, type: "attack", desc: "적 HP -12", dmg: 12, job: "fixer" },
    "위협": { rank: 1, cost: 1, type: "social", subtype: "attack", desc: "적 의지 -15 (공포)", dmg: 15, job: "fixer" },
    "무기 손질": { rank: 2, cost: 1, type: "skill", desc: "나 강화(3턴)", buff: { name: "강화", val: 3 }, target: "self", job: "fixer" },
    "근육자랑": { rank: 2, cost: 2, type: "attack", desc: "나 강화(2턴), 적 HP -4", buff: { name: "강화", val: 2 }, target: "self", job: "fixer", dmg: 4 },
    "돌진": { rank: 2, cost: 2, type: "attack", desc: "적 8 피해, 방어도 +8", job: "fixer", dmg: 8, block: 8 },



    "비명": {
        rank: 2, cost: 1, type: "social", subtype: "attack",
        desc: "날카로운 비명! (SP -10)",
        dmg: 10,
        job: "enemy",
        // (보스 전용 상태이상은 별도 카드로 분리해서 사용)
    },
    // --- 보스 전용 기술 ---
    "강철 분쇄": { rank: 3, cost: 2, type: "attack", desc: "치명적인 일격! (피해 15) [상태이상: 상처]", job: "common", dmg: 15, statusAdd: { card: "상처", count: 2, destination: "discard" } },
    "철제 몽둥이 난타": { rank: 2, cost: 1, type: "attack", desc: "거친 몽둥이질! (피해 9) [상태이상: 고통]", job: "enemy", dmg: 9, statusAdd: { card: "고통", count: 1, destination: "discard" } },
    "사냥꾼의 발차기": { rank: 2, cost: 1, type: "attack", desc: "무릎을 걷어찬다! (피해 6) + 취약(1턴) [상태이상: 혼란]", job: "enemy", dmg: 6, buff: { name: "취약", val: 1 }, statusAdd: { card: "혼란", count: 1, destination: "discard" } },
    "광신의 비명": { rank: 3, cost: 2, type: "social", subtype: "attack", desc: "광기의 비명! (SP -12) [상태이상: 공포]", job: "enemy", dmg: 12, statusAdd: { card: "공포", count: 1, destination: "discard" } },
    "광신의 채찍": { rank: 2, cost: 1, type: "attack", desc: "피부가 찢어진다! (피해 8) [상태이상: 상처]", job: "enemy", dmg: 8, statusAdd: { card: "상처", count: 1, destination: "discard" } },
    "저주의 할퀴기": { rank: 3, cost: 2, type: "attack", desc: "저주가 스민 손톱! (피해 9) [상태이상: 고통]", job: "enemy", dmg: 9, statusAdd: { card: "고통", count: 1, destination: "discard" } },
    "핏빛 실": { rank: 2, cost: 1, type: "attack", desc: "실이 살을 파고든다! (피해 6) [상태이상: 혼란]", job: "enemy", dmg: 6, statusAdd: { card: "혼란", count: 1, destination: "discard" } },
    "쇠약 바늘": { rank: 2, cost: 1, type: "attack", desc: "녹슨 바늘로 찌릅니다. (피해 5) [상태이상: 상처]", job: "enemy", dmg: 5, statusAdd: { card: "상처", count: 1, destination: "discard" } },
    "검은 연기": { rank: 2, cost: 1, type: "skill", desc: "검은 연기를 뿜어 시야를 흐립니다. [상태이상: 혼란 1장 뽑을 카드에 섞음]", job: "enemy", statusAdd: { card: "혼란", count: 1, destination: "draw" } },
    "저주 각인": { rank: 3, cost: 2, type: "skill", desc: "주술 각인을 새깁니다. [상태이상: 고통 1장 손으로]", job: "enemy", statusAdd: { card: "고통", count: 1, destination: "hand" } },
    "광신의 춤": { rank: 3, cost: 2, type: "skill", desc: "체력 회복 +20, 방어도 +10", job: "common", buff: { name: "활력", val: 5 }, block: 10 },
    "정신 붕괴 파동": { rank: 3, cost: 2, type: "attack", desc: "전체 멘탈 공격 (SP 데미지)", job: "common", dmg: 10, type: "social", val: -20 }, // 소셜/배틀 하이브리드
    "발톱 갈기": { rank: 2, cost: 2, type: "skill", desc: "발톱을 갈아 공격력을 올린다", job: "enemy", buff: { name: "강화", val: 2 }, target: "self" },
    "부하 호출": {
        rank: 3,
        cost: 2,
        type: "skill",
        desc: "불량배를 1명 호출하여 전투에 합류시킵니다.",
        job: "common",
        special: "summon",      // 특수 기능 태그
        summonTarget: "불량배",   // 소환할 적의 ENEMY_DATA 키
        playerDesc: "(사용 불가) 적 전용 스킬입니다." // 나중에 플레이어용 효과 구현 시 대체될 텍스트
    },

    // --- 장비 전용 카드 (장비 장착 시 덱에 추가, 해제 시 제거) ---
    "권총 사격": { rank: 2, cost: 1, type: "attack", desc: "권총 사격! 적 HP -8 [관통]", dmg: 8, attr: "pierce", job: "equipment", noReward: true },
    "사격(관통)": { rank: 2, cost: 1, type: "attack", desc: "권총 사격! 적 HP -8 [관통]", dmg: 8, attr: "pierce", job: "equipment", noReward: true },
    "쿠보탄 급소": { rank: 1, cost: 1, type: "attack", desc: "쿠보탄으로 급소를 찌른다! 적 HP -6 [관통]", dmg: 6, attr: "pierce", job: "equipment", noReward: true },
    "은빛 찌르기": { rank: 2, cost: 1, type: "attack", desc: "은 단검의 찌르기! 적 HP -7 [신성]", dmg: 7, attr: "holy", job: "equipment", noReward: true },
    "너클 강타": { rank: 1, cost: 1, type: "attack", desc: "스파이크 너클로 강타! 적 HP -6 [타격]", dmg: 6, attr: "strike", job: "equipment", noReward: true },

   

    // --- 패널티 카드 (Slay the Spire 스타일) ---
    // group: 'status'는 전투 중 일시적으로만 추가되는 카드군 (전투 종료 시 제거)
    // group: 'curse'는 덱에 영구적으로 남는 카드군
    "상처": { rank: 0, cost: 0, type: "skill", group: "status", unplayable: true, desc: "[상태이상] 사용할 수 없습니다. (전투 종료 시 사라짐)", job: "penalty" },
    "멍해짐": { rank: 0, cost: 0, type: "skill", group: "status", unplayable: true, desc: "[상태이상] 사용할 수 없습니다. (전투 종료 시 사라짐)", job: "penalty" },
    "끈적한 점액": { rank: 0, cost: 1, type: "skill", group: "status", desc: "[상태이상] 소멸. (아무 일도 일어나지 않음)", job: "penalty", isExhaust: true },
    "공포": { rank: 0, cost: 0, type: "skill", group: "status", unplayable: true, desc: "[상태이상] 뽑는 순간 손이 떨립니다. (뽑을 때 AP -1, 전투 종료 시 사라짐)", job: "penalty", drawEffect: { type: "lose_ap", val: 1 } },
    "고통": { rank: 0, cost: 0, type: "skill", group: "status", unplayable: true, desc: "[상태이상] 몸이 찢어질 듯 아픕니다. (뽑을 때 HP -2, 전투 종료 시 사라짐)", job: "penalty", drawEffect: { type: "damage_self", val: 2 } },
    "혼란": { rank: 0, cost: 0, type: "skill", group: "status", unplayable: true, desc: "[상태이상] 머리가 하얘집니다. (뽑을 때 무작위 카드 1장 버림, 전투 종료 시 사라짐)", job: "penalty", drawEffect: { type: "discard_random", val: 1 } },

    "저주: 불운": { rank: 0, cost: 0, type: "skill", group: "curse", unplayable: true, desc: "[저주] 사용할 수 없습니다. (덱에 영구적으로 남음)", job: "penalty" },
    "저주: 족쇄": { rank: 0, cost: 0, type: "skill", group: "curse", unplayable: true, desc: "[저주] 사용할 수 없습니다. (덱에 영구적으로 남음)", job: "penalty" }
};

/* [NEW] 적 데이터 정의 */
const ENEMY_DATA = {
    "불량배": {
        name: "불량배",
        baseHp: 20,
        stats: { atk: 1, def: 0, spd: 3 }, // 기본 스탯
        weakness: "strike", // 타격에 약함 (주먹)
        growth: { hp: 4, atk: 0.5, def: 0, spd: 0.1 }, // 레벨당 성장 수치
        deckType: "custom",
        deck: ["타격", "타격", "수비", "쇠약 바늘"], // 사용하는 덱
        img: "https://placehold.co/100x100/c0392b/ffffff?text=Bully",
        tags: ["human"]
    },
    "허수아비": {
        name: "허수아비",
        baseHp: 30, // 조금 더 튼튼하게
        stats: { atk: 1, def: 1, spd: 2 }, // 
        weakness: "fire",  // 불에 약함
        growth: { hp: 5, atk: 0.5, def: 0.5, spd: 0.1 }, // 골고루 성장
        deckType: "player_like", // 타격5+수비4+2성1
        img: "https://placehold.co/100x100/f39c12/ffffff?text=Scarecrow"
    },
    // [NEW] 보스 데이터
    "boss_gang_leader": {
        name: "💀 개조된 불량배 대장",
        baseHp: 150, // 높은 체력
        stats: { atk: 3, def: 2, spd: 2 }, // 묵직한 스탯
        weakness: "electric",
        growth: { hp: 0, atk: 0, def: 0, spd: 0 }, // 보스는 레벨 스케일링을 따로 안 하거나 고정
        deckType: "custom", // 덱 생성 함수 안 쓰고 직접 지정
        deck: ["강철 분쇄", "철제 몽둥이 난타", "사냥꾼의 발차기", "부하 호출", "수비"], // 전용 덱
        img: "https://placehold.co/120x120/000/fff?text=BOSS+1"
    },
    "boss_cult_leader": {
        name: "💀 광신도 교주",
        baseHp: 100,
        stats: { atk: 2, def: 1, spd: 4 }, // 빠른 속도
        weakness: "holy",
        growth: { hp: 0, atk: 0, def: 0, spd: 0 },
        deckType: "custom",
        deck: ["광신의 춤", "독 뿌리기", "검은 연기", "광신의 비명", "광신의 채찍", "사격"], // 하이브리드 패턴
        img: "https://placehold.co/120x120/4b0082/fff?text=BOSS+2"
    },
    "boss_cursed_doll": {
        name: "💀 저주받은 인형",
        baseHp: 120,
        stats: { atk: 4, def: 0, spd: 1 }, // 공격력은 세지만 방어/속도가 낮음
        weakness: "slash",
        growth: { hp: 0, atk: 0, def: 0, spd: 0 },
        deckType: "custom",
        // 독을 걸거나 멘탈 공격(비명)을 섞어 쓰는 까다로운 패턴
        deck: ["독 뿌리기", "독 뿌리기", "비명", "저주의 할퀴기", "핏빛 실", "저주 각인"],
        img: "https://placehold.co/120x120/5e2a84/fff?text=DOLL",
        // [추가 데이터] 패시브/태그/전리품 힌트
        passive: {
            name: "저주의 끈적임",
            desc: "매 턴 시작 시 플레이어에게 독 1 중첩을 남깁니다."
        },
        tags: ["boss", "cursed", "doll"],
        lootHint: ["울끈불끈 패딩", "고급 액세서리"] // 필수는 아니지만 테이블 구성 시 참고용
    }
    ,
    "curator": {
        name: "큐레이터",
        baseHp: 95,
        stats: { atk: 3, def: 2, spd: 3 },
        weakness: "holy",
        growth: { hp: 2, atk: 0.3, def: 0.2, spd: 0.2 },
        deckType: "custom",
        deck: ["광신의 비명", "검은 연기", "독 뿌리기", "비명", "저주의 할퀴기", "수비"],
        img: "https://placehold.co/120x120/222/fff?text=CURATOR"
    },
    "사교도": {
        name: "사교도",
        baseHp: 28,
        stats: { atk: 2, def: 0, spd: 3 },
        weakness: "holy",
        growth: { hp: 4, atk: 0.6, def: 0, spd: 0.2 },
        deckType: "custom",
        deck: ["광신의 비명", "검은 연기", "비명", "타격"],
        img: "https://placehold.co/100x100/6c3483/ffffff?text=Cult",
        tags: ["human", "cult"]
    },
    "괴물 쥐": {
        name: "괴물 쥐",
        baseHp: 17,
        stats: { atk: 1, def: 0, spd: 4 },
        weakness: "fire",
        growth: { hp: 3, atk: 0.5, def: 0, spd: 0.3 },
        deckType: "custom",
        deck: ["타격", "수비", "발톱 갈기", "타격"],
        img: "https://placehold.co/100x100/5d4037/ffffff?text=Rat",
        tags: ["beast"]
    },
    "좀비": {
        name: "좀비",
        baseHp: 32,
        stats: { atk: 2, def: 1, spd: 1 },
        weakness: "fire",
        growth: { hp: 5, atk: 0.4, def: 0.2, spd: 0.1 },
        deckType: "custom",
        deck: ["타격", "타격", "쇠약 바늘", "독 뿌리기", "수비"],
        img: "https://placehold.co/100x100/556b2f/ffffff?text=Zombie",
        tags: ["undead", "cursed"]
    },
    "폭주족": {
        name: "폭주족",
        baseHp: 30,
        stats: { atk: 2, def: 1, spd: 3 },
        weakness: "strike",
        growth: { hp: 4, atk: 0.6, def: 0.3, spd: 0.2 },
        deckType: "custom",
        deck: ["타격", "타격", "사냥꾼의 발차기", "수비"],
        img: "https://placehold.co/100x100/2c3e50/ffffff?text=Biker",
        tags: ["human"]
    }
};

// [data.js] SOCIAL_CARD_DATA 수정

const SOCIAL_CARD_DATA = {
    // [공격 계열] 적의 의지을 깎음 (dmg 사용)
    "논리적 반박": { rank: 1, cost: 1, type: "social", subtype: "attack", desc: "적 의지 -10", dmg: 10 },
    "비꼬기": { rank: 1, cost: 1, type: "social", subtype: "attack", desc: "적 의지 -15", dmg: 15 },
    "증거 제시": { rank: 2, cost: 2, type: "social", subtype: "attack", desc: "적 의지 -25", dmg: 25 },
    "호통치기": { rank: 2, cost: 2, type: "social", subtype: "attack", desc: "적 의지 -15, 적 취약(2턴)", dmg: 15, buff: { name: "취약", val: 2 } },

    // [방어 계열] 내 의지 보호 (block 사용)
    "한귀로 흘리기": { rank: 1, cost: 1, type: "social", subtype: "defend", desc: "방어도 +10", block: 10 },
    "무시": { rank: 1, cost: 1, type: "social", subtype: "defend", desc: "방어도 +15", block: 15 },
    "침묵": { rank: 1, cost: 0, type: "social", subtype: "defend", desc: "방어도 +8", block: 8 },

    // [회복/유틸 계열] 내 의지 회복 (heal 사용)
    "심호흡": { rank: 1, cost: 1, type: "social", subtype: "skill", desc: "내 의지 +15 회복", heal: 15, target: "self" },
    "차 한잔": { rank: 2, cost: 1, type: "social", subtype: "skill", desc: "내 의지 +20 회복, 카드 1장 뽑기", heal: 20, target: "self", draw: 1 },

    // [특수]
    "매혹": { rank: 2, cost: 2, type: "social", subtype: "magic", desc: "적 공격력 감소(2턴), 의지 -10", dmg: 10, buff: { name: "약화", val: 2 } },
    "거짓말": { rank: 2, cost: 1, type: "social", subtype: "trick", desc: "성공 시 적 벽 -40, 실패 시 나 벽 -20", special: "gamble_lie" },

    // [파워 계열] 소셜 전투 동안 지속 효과
    "담화의 기세": { rank: 2, cost: 1, type: "social", subtype: "power", desc: "이번 소셜 전투 동안 매 턴 시작 시 AP +1 (소멸)", power: { apBonus: 1 }, isExhaust: true },
    "말빨 예열": { rank: 1, cost: 1, type: "social", subtype: "power", desc: "이번 소셜 전투 동안 매 턴 시작 시 손패 랜덤 1장의 비용이 0이 됩니다. (소멸)", power: { freeCostEachTurn: 1 }, isExhaust: true }
};

// 기존 카드 데이터에 합치기
Object.assign(CARD_DATA, SOCIAL_CARD_DATA);

// [data.js] NPC_DATA 수정

const NPC_DATA = {
    "겁먹은 목격자": {
        name: "겁먹은 목격자",
        maxSp: 100, sp: 50,
        baseAtk: 2, baseDef: 0, baseSpd: 2,
        logicShield: "silence",
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
        logicShield: "liar",
        // [수정] 덱을 새 카드로 교체 (증거 제시, 비꼬기, 호통치기 등)
        deck: ["증거 제시", "비꼬기", "호통치기", "무시"],
        img: "https://placehold.co/100x100/2c3e50/ffffff?text=Police",
        desc: "돈 냄새를 맡고 왔다. 뇌물이면 통하겠지만, 장난감 같은 건 싫어한다.",
        likes: ["money", "valuable", "alcohol"],
        dislikes: ["toy", "trash", "paper"],
        battle: { maxHp: 80, stats: { atk: 4, def: 2, spd: 2 }, deck: ["타격", "방패 부수기", "수비", "사격"] }
    },
    "라거 트레이스": {
        name: "라거 트레이스",
        maxSp: 100, sp: 60,
        baseAtk: 2, baseDef: 1, baseSpd: 3,
        logicShield: "liar",
        deck: ["무시", "위협", "심호흡"],
        img: "https://placehold.co/100x100/34495e/ffffff?text=Fixer",
        desc: "조용히 커피를 마시며 의뢰를 기다리는 해결사.",
        likes: ["drink", "tool"],
        dislikes: ["noise", "horror"],
        icon: "🧥",
        tags: ["fixer"],
        dialogue: {
            start: "intro",
            nodes: {
                intro: {
                    speaker: "라거 트레이스",
                    text: "조용히 커피를 마시며 의뢰를 기다리고 있다.",
                    choices: [
                        { text: "대화 종료", action: "close" }
                    ]
                }
            }
        }
    },
    "진서 루멘": {
        name: "진서 루멘",
        maxSp: 100, sp: 70,
        baseAtk: 2, baseDef: 0, baseSpd: 4,
        logicShield: "liar",
        deck: ["비꼬기", "심호흡", "논리적 반박"],
        img: "https://placehold.co/100x100/7f8c8d/ffffff?text=Fixer",
        desc: "날카로운 시선으로 주변을 훑는 해결사.",
        likes: ["paper", "valuable"],
        dislikes: ["trash", "noise"],
        icon: "🧤",
        tags: ["fixer"],
        dialogue: {
            start: "intro",
            nodes: {
                intro: {
                    speaker: "진서 루멘",
                    text: "날카로운 시선으로 주변을 훑으며 상황을 읽는다.",
                    choices: [
                        { text: "대화 종료", action: "close" }
                    ]
                }
            }
        }
    },
    "도카 벨": {
        name: "도카 벨",
        maxSp: 100, sp: 55,
        baseAtk: 3, baseDef: 1, baseSpd: 2,
        logicShield: "liar",
        deck: ["위협", "무시", "심호흡"],
        img: "https://placehold.co/100x100/2c3e50/ffffff?text=Fixer",
        desc: "검은 코트를 걸치고 벽에 기대 서 있다.",
        likes: ["weapon", "valuable"],
        dislikes: ["toy", "trash"],
        icon: "🧢",
        tags: ["fixer"],
        dialogue: {
            start: "intro",
            nodes: {
                intro: {
                    speaker: "도카 벨",
                    text: "벽에 기대 서서 대화할 상대를 살핀다.",
                    choices: [
                        { text: "대화 종료", action: "close" }
                    ]
                }
            }
        }
    },
    "레이디 헤카테": {
        name: "레이디 헤카테",
        maxSp: 100, sp: 85,
        baseAtk: 2, baseDef: 2, baseSpd: 3,
        logicShield: "silence",
        deck: ["심호흡", "논리적 반박", "무시"],
        img: "https://placehold.co/100x100/8e44ad/ffffff?text=Hecate",
        desc: "카페 헤카테의 사장. 해결사들을 관리한다.",
        likes: ["coffee", "paper", "warm"],
        dislikes: ["noise", "trash"],
        icon: "👑",
        tags: ["npc", "hecate"],
        dialogue: {
            start: "intro",
            nodes: {
                intro: {
                    speaker: "레이디 헤카테",
                    text: "의뢰가 필요하면 말만 해요.",
                    choices: [
                        { text: "의뢰 목록 보기", action: "open_casefiles" },
                        { text: "대화 종료", action: "close" }
                    ]
                }
            }
        }
    },
    "영진 탐정": {
        name: "영진 탐정",
        maxSp: 100, sp: 80,
        baseAtk: 3, baseDef: 2, baseSpd: 3,
        logicShield: "silence",
        deck: ["논리적 반박", "증거 제시", "심호흡"],
        img: CHARACTER_IMAGES.detective,
        desc: "사무소를 지키며 의뢰를 정리하는 베테랑 탐정.",
        likes: ["paper", "tool", "warm"],
        dislikes: ["noise", "trash"],
        icon: "🕵️",
        tags: ["detective"]
    },
    "사무소 조수": {
        name: "사무소 조수",
        maxSp: 100, sp: 90,
        baseAtk: 2, baseDef: 1, baseSpd: 4,
        logicShield: "silence",
        deck: ["관찰", "심호흡", "무시"],
        img: CHARACTER_IMAGES.assistant,
        desc: "의뢰 목록을 관리하고 의뢰인과 연락을 담당한다.",
        likes: ["paper", "money"],
        dislikes: ["noise", "weapon"],
        icon: "📋",
        tags: ["assistant"]
    },
    "성당 신부": {
        name: "성당 신부",
        maxSp: 100, sp: 80,
        baseAtk: 2, baseDef: 2, baseSpd: 2,
        logicShield: "silence",
        deck: ["침묵", "심호흡", "사실 확인"],
        img: "https://placehold.co/100x100/6c7a89/ffffff?text=Priest",
        desc: "사라진 사람들에 대한 소문을 알고 있다.",
        likes: ["holy", "water", "paper"],
        dislikes: ["profane", "noise"],
        icon: "⛪",
        tags: ["npc", "priest"],
        flagOnTalk: "npc:priest:met"
    }
};

const TOOLTIPS = {
    "약화": "공격 스탯이 절반으로 감소합니다.",
    "취약": "방어 스탯이 절반으로 감소합니다.",
    "마비": "속도 스탯이 절반으로 감소합니다.",
    "독": "턴 시작 시 중첩된 수치만큼 피해를 입고, 1 줄어듭니다.",
    "강화": "공격 스탯이 2배 증가합니다.",
    "건강": "방어 스탯이 2배 증가합니다.",
    "쾌속": "속도 스탯이 2배 증가합니다.",
    "활력": "턴 시작 시 중첩된 수치만큼 체력을 회복하고, 1 줄어듭니다.",
    "가시": "전투 종료까지 유지됩니다. 공격받을 때마다 공격자에게 가시 수치만큼 고정 피해로 반격합니다. (방어도에 막혀도 발동)",
    "반사": "반사 상태가 붙어있는 동안, 막히지 않은 피해(실제 받은 피해)를 공격자에게 그대로 되돌려줍니다.",
    // [추가된 부분] 소멸 설명 추가
    "소멸": "카드를 사용하면 덱에서 제거되어, 이번 전투 동안 다시 나오지 않습니다.",
    // [NEW] 소셜 모드 전용 상태이상
    "헤롱헤롱": "정신을 못 차립니다. 멘탈 방어 스탯이 절반으로 감소합니다.",
    "분노": "화가 나서 참을성이 없어집니다. 턴마다 인내심이 2배로 감소합니다.",
    "우울": "감정이 격해집니다. 멘탈 공격 스탯이 2배 증가합니다.",
    "흐트러짐": "약점 공략으로 자세가 흐트러졌습니다. 다음 약점 피격 시 기절합니다.",
    "기절": "다음 턴 행동이 불가능합니다."

};

/* [CITY MAP] 세주시 전역 구역 데이터 (노드+링크 기반) */
const CITY_MAP = {
    nodes: [
        {
            id: "central_admin",
            name: "중앙 행정구",
            label: "세주시 중심",
            desc: "시청과 빌딩가, 백화점, 지하철역 지하상가, 백산 타워, 성 주드 아카데미, 대학 병원, 비정형관리국(UDRA)이 모여 있는 행정 중심.",
            vibe: "corporate",
            pos: { x: 50, y: 50 },
            tags: ["빌딩가", "백화점", "지하철역 지하상가", "백산 타워", "성 주드 아카데미", "대학 병원", "비정형관리국(UDRA)"],
            links: ["east_oldtown", "west_industrial", "south_coast", "north_mountain"]
        },
        {
            id: "east_oldtown",
            name: "구시가지",
            label: "동쪽",
            desc: "영진 탐정 사무소와 카페 헤카테, 청운맨션, 재래시장, 사이버 벙커, 주택가, 성당이 모여 있는 오래된 거리.",
            vibe: "busy",
            pos: { x: 72, y: 50 },
            tags: ["영진 탐정 사무소", "카페 헤카테", "청운맨션", "재래시장", "사이버 벙커", "주택가", "성당", "동문역"],
            links: ["central_admin"]
        },
        {
            id: "west_industrial",
            name: "공업지대",
            label: "남쪽",
            desc: "폐공장 단지와 시 외곽으로 이어지는 국도, 클럽 Bad Sector가 숨어 있는 산업 구역.",
            vibe: "outskirts",
            pos: { x: 50, y: 78 },
            tags: ["폐공장", "외곽 국도", "화물 트럭", "클럽 Bad Sector", "뒷골목", "남산역"],
            links: ["central_admin"]
        },
        {
            id: "south_coast",
            name: "해안 관광단지",
            label: "서쪽",
            desc: "바닷가와 놀이공원, 대형 마트, 호텔이 이어진 해안 관광 구역.",
            vibe: "water",
            pos: { x: 30, y: 62 },
            tags: ["바닷가", "놀이공원", "대형 마트", "해안 호텔", "서항역"],
            links: ["central_admin"]
        },
        {
            id: "north_mountain",
            name: "성주산 구역",
            label: "북쪽",
            desc: "성주산 능선과 숲, 그 안에 숨겨진 폐연구소가 있는 산악 지대.",
            vibe: "calm",
            pos: { x: 50, y: 24 },
            tags: ["숲 입구", "폐연구소", "성주산역"],
            links: ["central_admin"]
        }
    ]
};

/* [CITY AREAS] 각 구역 내부 이동 노드 정의 */
const CITY_AREA_DATA = {
    central_admin: {
        name: "중앙 행정구 내부",
        desc: "행정 중심을 이루는 주요 건물과 시설들을 직접 걸어서 둘러보거나 퀵 이동할 수 있습니다.",
        bg: "https://placehold.co/1400x900/f3f3f3/333?text=%EC%A4%91%EC%95%99+%ED%96%89%EC%A0%95%EA%B5%AC",
        start: "central_plaza",
        spots: [
            {
                id: "central_plaza",
                name: "중앙 광장",
                desc: "세주시의 중심. 모든 시설이 이 광장을 둘러싸고 있다.",
                bg: "https://placehold.co/1400x900/f6f6f6/333?text=%EC%A4%91%EC%95%99+%EA%B4%91%EC%9E%A5",
                pos: { x: 50, y: 50 },
                grid: { x: 1, y: 1 },
                links: ["baeksan_tower", "subway_gate", "st_jude_academy", "university_hospital", "silence_clinic", "bs_convenience", "udra_annex"],
                tags: ["집결지", "기점"],
                icon: "🧭",
                objects: [
                    { id: "white_cube", name: "화이트 큐브", icon: "⬜", action: "enter_dungeon", dungeonId: "white_cube_beyond", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "baeksan_tower",
                name: "백산 타워",
                desc: "세주시 스카이라인을 장식하는 고층 타워.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%EB%B0%B1%EC%82%B0+%ED%83%80%EC%9B%8C",
                pos: { x: 70, y: 22 },
                grid: { x: 1, y: 0 },
                links: ["central_plaza"],
                tags: ["타워", "전망대"],
                icon: "🏙️"
            },
            {
                id: "subway_gate",
                name: "지하철역 입구",
                desc: "도심 지하철과 연결되는 입구. 사람들의 발길이 끊이지 않는다.",
                bg: "https://placehold.co/1400x900/f1f1f1/333?text=%EC%A7%80%ED%95%98%EC%B2%A0+%EC%9E%85%EA%B5%AC",
                pos: { x: 54, y: 82 },
                grid: { x: 1, y: 2 },
                links: ["central_plaza"],
                tags: ["교통", "만남의 장소", "지하철역 지하상가"],
                icon: "🚇",
                objects: [
                    { id: "to_subway_market", name: "지하철역 지하상가", icon: "🛍️", action: "enter_city_area", areaId: "central_subway_market", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "st_jude_academy",
                name: "성 주드 아카데미",
                desc: "명문 교육기관. 밤이 되면 연구동에 불이 켜진다.",
                bg: "https://placehold.co/1400x900/f2f2f2/333?text=%EC%84%B1+%EC%A3%BC%EB%93%9C+%EC%95%84%EC%B9%B4%EB%8D%B0%EB%AF%B8",
                pos: { x: 28, y: 66 },
                grid: { x: 0, y: 1 },
                links: ["central_plaza"],
                tags: ["교육", "연구"],
                icon: "🏫",
                objects: [
                    { id: "academy_entry", name: "아카데미 내부", icon: "🚪", action: "enter_city_area", areaId: "st_jude_academy_interior", spotId: "academy_courtyard", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "university_hospital",
                name: "대학 병원",
                desc: "의료 연구와 진료가 함께 이뤄지는 대형 병원.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%EB%8C%80%ED%95%99+%EB%B3%91%EC%9B%90",
                pos: { x: 30, y: 30 },
                grid: { x: 0, y: 0 },
                links: ["central_plaza"],
                tags: ["의료", "진료"],
                icon: "🏥",
                objects: [
                    { id: "hospital_cure", name: "저주 치료", icon: "💊", action: "hospital_cure", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "silence_clinic",
                name: "힐링 클리닉 사일런스",
                desc: "조용한 상담과 맞춤 치료를 제공하는 고급 클리닉.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%ED%9E%90%EB%A7%81+%ED%81%B4%EB%A6%AC%EB%8B%89",
                pos: { x: 70, y: 40 },
                grid: { x: 2, y: 0 },
                links: ["central_plaza"],
                tags: ["고급 의료", "회복"],
                icon: "🩺",
                objects: [
                    { id: "healing_clinic", name: "힐링 클리닉 사일런스", icon: "🩺", action: "open_healing_clinic", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "bs_convenience",
                name: "BS편의점",
                desc: "도심 한가운데 있는 24시 편의점. 탐정들의 임시 보급소.",
                bg: "https://placehold.co/1400x900/f5f5f5/333?text=BS+%ED%8E%B8%EC%9D%98%EC%A0%90",
                pos: { x: 76, y: 70 },
                grid: { x: 2, y: 2 },
                links: ["central_plaza"],
                tags: ["보급", "24시"],
                icon: "🏪"
            },
            {
                id: "udra_annex",
                name: "정부 합동 청사 별관",
                desc: "비정형재난대응국이 위장한 부서가 입주해 있다. 허가받은 사람만 드나든다.",
                bg: "https://placehold.co/1400x900/f2f2f2/333?text=%EC%A0%95%EB%B6%80+%EB%B3%84%EA%B4%80",
                pos: { x: 22, y: 32 },
                grid: { x: 2, y: 1 },
                links: ["central_plaza", "udra_hq"],
                tags: ["정부", "보안", "국가표준지표산정실"],
                icon: "🏢",
                objects: [
                    { id: "udra_basement", name: "국가표준지표산정실", icon: "🗂️", action: "enter_city_area", areaId: "udra_basement", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "udra_hq",
                name: "정부 합동 청사 별관",
                desc: "비정형재난대응국이 위장한 부서.",
                bg: "https://placehold.co/1400x900/f2f2f2/333?text=UDRA+%EB%B3%84%EA%B4%80",
                pos: { x: 70, y: 18 },
                grid: { x: 2, y: 0 },
                links: ["udra_annex"],
                tags: ["기관", "정보"],
                icon: "🧿"
            }
        ]
    },
    st_jude_academy_interior: {
        name: "성 주드 아카데미",
        desc: "성 주드 아카데미 내부 구역. 기숙사와 동아리실이 모여 있다.",
        bg: "https://placehold.co/1400x900/f3f3f3/333?text=%EC%84%B1+%EC%A3%BC%EB%93%9C+%EC%95%84%EC%B9%B4%EB%8D%B0%EB%AF%B8+%EB%82%B4%EB%B6%80",
        start: "academy_courtyard",
        spots: [
            {
                id: "academy_courtyard",
                name: "중앙 중정",
                desc: "아카데미 중심의 조용한 중정.",
                bg: "https://placehold.co/1400x900/f6f6f6/333?text=%EC%A4%91%EC%95%99+%EC%A4%91%EC%A0%95",
                pos: { x: 50, y: 50 },
                grid: { x: 1, y: 1 },
                links: ["academy_dormitory", "academy_clubroom"],
                tags: ["중정", "캠퍼스"],
                icon: "🌿",
                objects: [
                    { id: "academy_exit", name: "밖으로 나가기", icon: "🚪", action: "enter_city_area", areaId: "central_admin", spotId: "st_jude_academy", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "academy_dormitory",
                name: "기숙사",
                desc: "학생들이 생활하는 조용한 기숙사.",
                bg: "https://placehold.co/1400x900/f5f5f5/333?text=%EA%B8%B0%EC%88%99%EC%82%AC",
                pos: { x: 22, y: 68 },
                grid: { x: 0, y: 2 },
                links: ["academy_courtyard"],
                tags: ["생활", "휴식"],
                icon: "🛏️",
                objects: [
                    { id: "dorm_return", name: "기숙사로 복귀", icon: "🏠", action: "return_hub", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "academy_clubroom",
                name: "동아리실",
                desc: "아카데미 동아리 활동을 진행하는 공간.",
                bg: "https://placehold.co/1400x900/f5f5f5/333?text=%EB%8F%99%EC%95%84%EB%A6%AC%EC%8B%A4",
                pos: { x: 78, y: 62 },
                grid: { x: 2, y: 1 },
                links: ["academy_courtyard"],
                tags: ["동아리", "의뢰"],
                icon: "📚",
                objects: [
                    { id: "club_leader", name: "동아리 부장", icon: "🧑‍🏫", action: "open_casefiles", pos: { x: 55, y: 60 } }
                ]
            }
        ]
    },
    udra_basement: {
        name: "국가표준지표산정실",
        desc: "정부 부서로 위장한 비정형재난대응국의 내부 구역.",
        bg: "https://placehold.co/1400x900/f2f2f2/333?text=%EA%B5%AD%EA%B0%80%ED%91%9C%EC%A4%80%EC%A7%80%ED%91%9C%EC%82%B0%EC%A0%95%EC%8B%A4",
        start: "udra_core",
        spots: [
            {
                id: "udra_core",
                name: "국가표준지표산정실",
                desc: "형식상 정부 부서로 보이지만, 깊숙한 곳에 비정형재난대응국이 자리한다.",
                bg: "https://placehold.co/1400x900/f6f6f6/333?text=UDRA",
                pos: { x: 50, y: 50 },
                grid: { x: 0, y: 0 },
                links: [],
                tags: ["정부", "비정형재난대응국"],
                icon: "🗂️"
            }
        ]
    },
    central_subway_market: {
        name: "지하철역 지하상가",
        desc: "지하로 내려온 상가 구역. 상점과 개찰구가 이어진다.",
        bg: "https://placehold.co/1400x900/f2f2f2/333?text=%EC%A7%80%ED%95%98%EC%83%81%EA%B0%80",
        start: "market_hall",
        spots: [
            {
                id: "market_hall",
                name: "상가 통로",
                desc: "사람들과 간판이 빽빽한 지하 통로.",
                bg: "https://placehold.co/1400x900/f6f6f6/333?text=%EC%83%81%EA%B0%80+%ED%86%B5%EB%A1%9C",
                pos: { x: 50, y: 52 },
                grid: { x: 1, y: 1 },
                links: ["snack_stall", "convenience_kiosk", "ticket_gate", "surface_exit"],
                tags: ["쇼핑", "먹거리"],
                icon: "🛍️"
            },
            {
                id: "snack_stall",
                name: "먹거리 골목",
                desc: "따뜻한 길거리 음식 냄새가 퍼진다.",
                pos: { x: 22, y: 52 },
                grid: { x: 0, y: 1 },
                links: ["market_hall"],
                tags: ["음식", "휴식"],
                icon: "🥟"
            },
            {
                id: "convenience_kiosk",
                name: "편의점 부스",
                desc: "작은 부스형 편의점. 간단한 물품을 판다.",
                pos: { x: 78, y: 52 },
                grid: { x: 2, y: 1 },
                links: ["market_hall"],
                tags: ["보급", "소모품"],
                icon: "🏪"
            },
            {
                id: "ticket_gate",
                name: "개찰구",
                desc: "플랫폼으로 내려가는 개찰구.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%EA%B0%9C%EC%B0%B0%EA%B5%AC",
                pos: { x: 50, y: 84 },
                grid: { x: 1, y: 2 },
                links: ["market_hall"],
                tags: ["개찰", "플랫폼"],
                icon: "🎫",
                objects: [
                    { id: "to_platform", name: "플랫폼으로", icon: "⬇️", action: "enter_city_area", areaId: "central_subway_platform", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "surface_exit",
                name: "지상 출구",
                desc: "지상으로 올라가는 출구.",
                bg: "https://placehold.co/1400x900/ededed/333?text=%EC%A7%80%EC%83%81+%EC%B6%9C%EA%B5%AC",
                pos: { x: 50, y: 22 },
                grid: { x: 1, y: 0 },
                links: ["market_hall"],
                tags: ["출구", "지상"],
                icon: "⬆️",
                objects: [
                    { id: "to_surface", name: "지상으로", icon: "⬆️", action: "enter_city_area", areaId: "central_admin", spotId: "subway_gate", pos: { x: 55, y: 60 } }
                ]
            }
        ]
    },
    central_subway_platform: {
        name: "세주중앙역 플랫폼",
        desc: "플랫폼 한 칸. 스크린도어 너머로 선로가 이어진다.",
        bg: "https://placehold.co/1400x900/f1f1f1/333?text=%EC%A4%91%EC%95%99%EC%97%AD+%ED%94%8C%EB%9E%AB%ED%8F%BC",
        start: "platform",
        spots: [
            {
                id: "platform",
                name: "플랫폼",
                desc: "기차가 도착하는 플랫폼.",
                bg: "https://placehold.co/1400x900/f4f4f4/333?text=%ED%94%8C%EB%9E%AB%ED%8F%BC",
                pos: { x: 50, y: 50 },
                grid: { x: 0, y: 0 },
                links: [],
                tags: ["플랫폼", "스크린도어"],
                icon: "🚆",
                objects: [
                    {
                        id: "screen_door",
                        name: "스크린도어",
                        icon: "🚪",
                        action: "subway_transfer_select",
                        pos: { x: 55, y: 58 },
                        options: [
                            { label: "환승 구역", areaId: "subway_transfer_hall", spotId: "subway_central" },
                            { label: "동문역", areaId: "subway_east_station", spotId: "east_platform" },
                            { label: "서항역", areaId: "subway_west_station", spotId: "west_platform" },
                            { label: "남산역", areaId: "subway_south_station", spotId: "south_platform" },
                            { label: "성주산역", areaId: "subway_north_station", spotId: "north_platform" }
                        ]
                    },
                    { id: "back_to_market", name: "상가로 올라가기", icon: "⬆️", action: "enter_city_area", areaId: "central_subway_market", spotId: "market_hall", pos: { x: 78, y: 62 } }
                ]
            }
        ]
    },
    subway_transfer_hall: {
        name: "지하철 환승 구역",
        desc: "중앙역에서 동서남북으로 갈 수 있는 환승 통로.",
        bg: "https://placehold.co/1400x900/f3f3f3/333?text=%ED%99%98%EC%8A%B9+%EA%B5%AC%EC%97%AD",
        start: "subway_central",
        spots: [
            {
                id: "subway_central",
                name: "세주중앙역",
                desc: "중앙 환승 지점.",
                bg: "https://placehold.co/1400x900/f6f6f6/333?text=%EC%A4%91%EC%95%99+%ED%99%98%EC%8A%B9",
                pos: { x: 50, y: 50 },
                grid: { x: 1, y: 1 },
                links: ["cult_hideout_track"],
                tags: ["환승", "중앙"],
                icon: "🧭",
                objects: [
                    { id: "to_platform", name: "중앙역 플랫폼", icon: "⬇️", action: "enter_city_area", areaId: "central_subway_platform", spotId: "platform", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "cult_hideout_track",
                name: "선로로 내려가기",
                desc: "선로를 따라 은신처로 갈 수 있다.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%EC%84%A0%EB%A1%9C",
                pos: { x: 78, y: 84 },
                grid: { x: 2, y: 2 },
                links: ["subway_central"],
                tags: ["선로", "은신처"],
                icon: "🛤️",
                requiresDiscovery: "cult_hideout",
                objects: [
                    { id: "to_hideout", name: "교단 은신처로", icon: "🕯️", action: "enter_city_area", areaId: "cult_hideout", pos: { x: 55, y: 60 } }
                ]
            }
        ]
    },
    subway_east_station: {
        name: "동문역",
        desc: "동쪽 구시가지로 이어지는 지하철역.",
        bg: "https://placehold.co/1400x900/f4f4f4/333?text=%EB%8F%99%EB%AC%B8%EC%97%AD",
        start: "east_platform",
        spots: [
            {
                id: "east_platform",
                name: "동문역 플랫폼",
                desc: "동쪽 방면 열차가 정차한다.",
                bg: "https://placehold.co/1400x900/f7f7f7/333?text=%EB%8F%99%EB%AC%B8%EC%97%AD+%ED%94%8C%EB%9E%AB%ED%8F%BC",
                pos: { x: 50, y: 50 },
                grid: { x: 0, y: 0 },
                links: [],
                tags: ["플랫폼", "동쪽"],
                icon: "🚉",
                objects: [
                    {
                        id: "screen_door",
                        name: "스크린도어",
                        icon: "🚪",
                        action: "subway_transfer_select",
                        pos: { x: 55, y: 58 },
                        options: [
                            { label: "환승 구역", areaId: "subway_transfer_hall", spotId: "subway_central" },
                            { label: "세주중앙역", areaId: "central_subway_platform", spotId: "platform" },
                            { label: "동문역", areaId: "subway_east_station", spotId: "east_platform" },
                            { label: "서항역", areaId: "subway_west_station", spotId: "west_platform" },
                            { label: "남산역", areaId: "subway_south_station", spotId: "south_platform" },
                            { label: "성주산역", areaId: "subway_north_station", spotId: "north_platform" }
                        ]
                    },
                    { id: "east_exit_oldtown", name: "동문역 출구", icon: "⬆️", action: "enter_city_area", areaId: "east_oldtown", spotId: "oldtown_station", pos: { x: 78, y: 62 } },
                    { id: "east_exit_market", name: "재래시장 방면", icon: "🧺", action: "enter_city_area", areaId: "east_oldtown", spotId: "oldtown_market", pos: { x: 35, y: 65 } }
                ]
            }
        ]
    },
    subway_west_station: {
        name: "서항역",
        desc: "서쪽 해안으로 이어지는 지하철역.",
        bg: "https://placehold.co/1400x900/f4f4f4/333?text=%EC%84%9C%ED%95%AD%EC%97%AD",
        start: "west_platform",
        spots: [
            {
                id: "west_platform",
                name: "서항역 플랫폼",
                desc: "서쪽 방면 열차가 정차한다.",
                bg: "https://placehold.co/1400x900/f7f7f7/333?text=%EC%84%9C%ED%95%AD%EC%97%AD+%ED%94%8C%EB%9E%AB%ED%8F%BC",
                pos: { x: 50, y: 50 },
                grid: { x: 0, y: 0 },
                links: [],
                tags: ["플랫폼", "서쪽"],
                icon: "🚉",
                objects: [
                    {
                        id: "screen_door",
                        name: "스크린도어",
                        icon: "🚪",
                        action: "subway_transfer_select",
                        pos: { x: 55, y: 58 },
                        options: [
                            { label: "환승 구역", areaId: "subway_transfer_hall", spotId: "subway_central" },
                            { label: "세주중앙역", areaId: "central_subway_platform", spotId: "platform" },
                            { label: "동문역", areaId: "subway_east_station", spotId: "east_platform" },
                            { label: "서항역", areaId: "subway_west_station", spotId: "west_platform" },
                            { label: "남산역", areaId: "subway_south_station", spotId: "south_platform" },
                            { label: "성주산역", areaId: "subway_north_station", spotId: "north_platform" }
                        ]
                    },
                    { id: "west_exit_station", name: "서항역 출구", icon: "⬆️", action: "enter_city_area", areaId: "south_coast", spotId: "coast_station", pos: { x: 78, y: 62 } },
                    { id: "west_exit_boardwalk", name: "해안 산책로 방면", icon: "🌊", action: "enter_city_area", areaId: "south_coast", spotId: "coast_boardwalk", pos: { x: 35, y: 65 } }
                ]
            }
        ]
    },
    subway_south_station: {
        name: "남산역",
        desc: "남쪽 공업지대로 이어지는 지하철역.",
        bg: "https://placehold.co/1400x900/f4f4f4/333?text=%EB%82%A8%EC%82%B0%EC%97%AD",
        start: "south_platform",
        spots: [
            {
                id: "south_platform",
                name: "남산역 플랫폼",
                desc: "남쪽 방면 열차가 정차한다.",
                bg: "https://placehold.co/1400x900/f7f7f7/333?text=%EB%82%A8%EC%82%B0%EC%97%AD+%ED%94%8C%EB%9E%AB%ED%8F%BC",
                pos: { x: 50, y: 50 },
                grid: { x: 0, y: 0 },
                links: [],
                tags: ["플랫폼", "남쪽"],
                icon: "🚉",
                objects: [
                    {
                        id: "screen_door",
                        name: "스크린도어",
                        icon: "🚪",
                        action: "subway_transfer_select",
                        pos: { x: 55, y: 58 },
                        options: [
                            { label: "환승 구역", areaId: "subway_transfer_hall", spotId: "subway_central" },
                            { label: "세주중앙역", areaId: "central_subway_platform", spotId: "platform" },
                            { label: "동문역", areaId: "subway_east_station", spotId: "east_platform" },
                            { label: "서항역", areaId: "subway_west_station", spotId: "west_platform" },
                            { label: "남산역", areaId: "subway_south_station", spotId: "south_platform" },
                            { label: "성주산역", areaId: "subway_north_station", spotId: "north_platform" }
                        ]
                    },
                    { id: "south_exit_station", name: "남산역 출구", icon: "⬆️", action: "enter_city_area", areaId: "west_industrial", spotId: "industrial_station", pos: { x: 78, y: 62 } },
                    { id: "south_exit_alley", name: "뒷골목 방면", icon: "🌒", action: "enter_city_area", areaId: "west_industrial", spotId: "back_alley", pos: { x: 35, y: 65 } }
                ]
            }
        ]
    },
    subway_north_station: {
        name: "성주산역",
        desc: "북쪽 산길로 이어지는 지하철역.",
        bg: "https://placehold.co/1400x900/f4f4f4/333?text=%EC%84%B1%EC%A3%BC%EC%82%B0%EC%97%AD",
        start: "north_platform",
        spots: [
            {
                id: "north_platform",
                name: "성주산역 플랫폼",
                desc: "북쪽 방면 열차가 정차한다.",
                bg: "https://placehold.co/1400x900/f7f7f7/333?text=%EC%84%B1%EC%A3%BC%EC%82%B0%EC%97%AD+%ED%94%8C%EB%9E%AB%ED%8F%BC",
                pos: { x: 50, y: 50 },
                grid: { x: 0, y: 0 },
                links: [],
                tags: ["플랫폼", "북쪽"],
                icon: "🚉",
                objects: [
                    {
                        id: "screen_door",
                        name: "스크린도어",
                        icon: "🚪",
                        action: "subway_transfer_select",
                        pos: { x: 55, y: 58 },
                        options: [
                            { label: "환승 구역", areaId: "subway_transfer_hall", spotId: "subway_central" },
                            { label: "세주중앙역", areaId: "central_subway_platform", spotId: "platform" },
                            { label: "동문역", areaId: "subway_east_station", spotId: "east_platform" },
                            { label: "서항역", areaId: "subway_west_station", spotId: "west_platform" },
                            { label: "남산역", areaId: "subway_south_station", spotId: "south_platform" },
                            { label: "성주산역", areaId: "subway_north_station", spotId: "north_platform" }
                        ]
                    },
                    { id: "north_exit_station", name: "성주산역 출구", icon: "⬆️", action: "enter_city_area", areaId: "north_mountain", spotId: "north_station", pos: { x: 78, y: 62 } },
                    { id: "north_exit_forest", name: "숲 입구 방면", icon: "🌲", action: "enter_city_area", areaId: "north_mountain", spotId: "forest_entry", pos: { x: 35, y: 65 } }
                ]
            }
        ]
    },
    cult_hideout: {
        name: "교단 은신처",
        desc: "음습한 분위기의 폐쇄된 지하철역 구역.",
        bg: "https://placehold.co/1400x900/f1f1f1/333?text=%EA%B5%90%EB%8B%A8+%EC%9D%80%EC%8B%A0%EC%B2%98",
        start: "hideout_entrance",
        spots: [
            {
                id: "hideout_entrance",
                name: "은신처 입구",
                desc: "축축한 공기와 촛농 냄새가 감도는 입구.",
                bg: "https://placehold.co/1400x900/f4f4f4/333?text=%EC%9D%80%EC%8B%A0%EC%B2%98+%EC%9E%85%EA%B5%AC",
                pos: { x: 50, y: 50 },
                grid: { x: 0, y: 0 },
                links: [],
                tags: ["교단", "지하"],
                icon: "🕯️",
                objects: [
                    { id: "start_cult_investigation", name: "은신처 조사", icon: "🔍", action: "enter_scenario", scenarioId: "cult_investigation", pos: { x: 55, y: 60 } },
                    { id: "back_to_tracks", name: "선로로 돌아가기", icon: "↩️", action: "enter_city_area", areaId: "subway_transfer_hall", spotId: "subway_central", pos: { x: 78, y: 70 } }
                ]
            }
        ]
    },
    east_oldtown: {
        name: "구시가지 내부",
        desc: "낡은 거리와 생활권이 촘촘하게 이어진 구역. 걸어서 둘러보며 동선을 잡을 수 있습니다.",
        bg: "https://placehold.co/1400x900/f2f2f2/333?text=%EA%B5%AC%EC%8B%9C%EA%B0%80%EC%A7%80",
        start: "oldtown_market",
        spots: [
            {
                id: "oldtown_market",
                name: "재래시장",
                desc: "손때 묻은 상점과 가판대가 줄지어 있는 시장.",
                bg: "https://placehold.co/1400x900/f6f6f6/333?text=%EC%9E%AC%EB%9E%98%EC%8B%9C%EC%9E%A5",
                pos: { x: 50, y: 52 },
                grid: { x: 1, y: 1 },
                links: ["youngjin_office", "hecate_cafe", "chungwoon_mansion", "cyber_bunker", "residential_block", "cathedral", "oldtown_station"],
                tags: ["먹거리", "소문", "생활"],
                icon: "🧺",
                objects: [
                    { id: "goblin_shop", name: "도깨비 만물상 (구 씨 아저씨)", icon: "🪔", action: "open_occult_shop", pos: { x: 45, y: 60 } },
                    { id: "to_oldtown_station", name: "동문역 출구", icon: "🚇", action: "enter_city_area", areaId: "east_oldtown", spotId: "oldtown_station", pos: { x: 70, y: 62 } }
                ]
            },
            {
                id: "youngjin_office",
                name: "영진 탐정 사무소",
                desc: "오래된 간판이 걸려 있는 작은 탐정 사무소.",
                bg: "https://placehold.co/1400x900/f7f7f7/333?text=%ED%83%90%EC%A0%95+%EC%82%AC%EB%AC%B4%EC%86%8C",
                pos: { x: 22, y: 50 },
                grid: { x: 0, y: 1 },
                links: ["oldtown_market", "hecate_cafe", "residential_block"],
                tags: ["사무소", "의뢰"],
                icon: "🕵️",
                objects: [
                    { id: "return_office", name: "사무소로 복귀", icon: "🏠", action: "return_hub", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "hecate_cafe",
                name: "카페 헤카테",
                desc: "진한 커피 향과 함께 비밀 이야기가 오간다.",
                bg: "https://placehold.co/1400x900/f5f5f5/333?text=%EC%B9%B4%ED%8E%98+%ED%97%A4%EC%B9%B4%ED%85%8C",
                pos: { x: 20, y: 22 },
                grid: { x: 0, y: 0 },
                links: ["oldtown_market", "youngjin_office", "chungwoon_mansion"],
                tags: ["카페", "휴식"],
                icon: "☕",
                objects: [
                    { id: "enter_hecate", name: "카페 헤카테 내부", icon: "☕", action: "enter_city_area", areaId: "hecate_cafe_interior", pos: { x: 55, y: 60 }, hideOnMap: true }
                ]
            },
            {
                id: "chungwoon_mansion",
                name: "청운맨션",
                desc: "낡았지만 규모가 있는 공동주택.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%EC%B2%AD%EC%9A%B4%EB%A7%A8%EC%85%98",
                pos: { x: 76, y: 22 },
                grid: { x: 2, y: 0 },
                links: ["oldtown_market", "hecate_cafe", "cyber_bunker"],
                tags: ["주거", "소문"],
                icon: "🏘️"
            },
            {
                id: "cyber_bunker",
                name: "사이버 벙커",
                desc: "해커 동료들이 모이는 네트워크 거점.",
                bg: "https://placehold.co/1400x900/f1f1f1/333?text=%EC%82%AC%EC%9D%B4%EB%B2%84+%EB%B2%99%EC%BB%A4",
                pos: { x: 78, y: 52 },
                grid: { x: 2, y: 1 },
                links: ["oldtown_market", "chungwoon_mansion", "cathedral"],
                tags: ["네트워크", "해커"],
                icon: "🛰️"
            },
            {
                id: "residential_block",
                name: "주택가",
                desc: "오래된 주택들이 빼곡하게 들어선 생활 구역.",
                bg: "https://placehold.co/1400x900/f4f4f4/333?text=%EC%A3%BC%ED%83%9D%EA%B0%80",
                pos: { x: 22, y: 84 },
                grid: { x: 0, y: 2 },
                links: ["oldtown_market", "youngjin_office", "oldtown_station"],
                tags: ["생활", "거주"],
                icon: "🏠",
                objects: [
                    { id: "yonggung_sauna", name: "용궁 사우나", icon: "♨️", action: "open_sauna", pos: { x: 45, y: 60 } },
                    { id: "jesaengdang", name: "한의원 제생당 (마고 원장님)", icon: "🌿", action: "open_occult_clinic", pos: { x: 70, y: 62 } }
                ]
            },
            {
                id: "cathedral",
                name: "성당",
                desc: "낡은 종탑이 구시가지의 밤을 지킨다.",
                bg: "https://placehold.co/1400x900/efefef/333?text=%EC%84%B1%EB%8B%B9",
                pos: { x: 78, y: 84 },
                grid: { x: 2, y: 2 },
                links: ["oldtown_market", "cyber_bunker"],
                tags: ["성지", "기도"],
                icon: "⛪",
                objects: [
                    { id: "cathedral_priest", name: "신부님", icon: "💬", action: "npc_dialogue", npcKey: "성당 신부", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "oldtown_station",
                name: "동문역",
                desc: "구시가지와 이어진 지하철역 출구.",
                bg: "https://placehold.co/1400x900/ededed/333?text=%EB%8F%99%EB%AC%B8%EC%97%AD",
                pos: { x: 50, y: 92 },
                grid: { x: 1, y: 3 },
                links: ["oldtown_market", "residential_block"],
                tags: ["역", "지하철"],
                icon: "🚉",
                objects: [
                    { id: "to_east_platform", name: "지하철로 내려가기", icon: "⬇️", action: "enter_city_area", areaId: "subway_east_station", spotId: "east_platform", pos: { x: 55, y: 60 } },
                    { id: "to_oldtown_market", name: "재래시장 방면", icon: "🧺", action: "enter_city_area", areaId: "east_oldtown", spotId: "oldtown_market", pos: { x: 35, y: 65 } },
                    { id: "to_residential_block", name: "주택가 방면", icon: "🏠", action: "enter_city_area", areaId: "east_oldtown", spotId: "residential_block", pos: { x: 75, y: 65 } }
                ]
            }
        ]
    },
    hecate_cafe_interior: {
        name: "카페 헤카테",
        desc: "잔잔한 조명 아래 해결사들이 모여드는 카페.",
        bg: "https://placehold.co/1400x900/f7f7f7/333?text=%ED%97%A4%EC%B9%B4%ED%85%8C+%EC%B9%B4%ED%8E%98",
        parentAreaId: "east_oldtown",
        parentSpotId: "hecate_cafe",
        parentLabel: "구시가지로",
        hideNodes: true,
        showNpcObjects: true,
        start: "hecate_counter",
        randomNpcPool: ["라거 트레이스", "진서 루멘", "도카 벨"],
        npcSpotIds: ["hecate_counter"],
        npcSpotCounts: { hecate_counter: { min: 1, max: 3 } },
        spots: [
            {
                id: "hecate_counter",
                name: "카페 헤카테",
                desc: "조용한 카운터에서 해결사들이 이야기를 나눈다.",
                bg: "https://placehold.co/1400x900/f9f9f9/333?text=%ED%97%A4%EC%B9%B4%ED%85%8C+%EC%B9%B4%EC%9A%B4%ED%84%B0",
                pos: { x: 50, y: 52 },
                grid: { x: 1, y: 1 },
                links: [],
                tags: ["카페", "의뢰"],
                icon: "👑",
                npcSlot: true,
                keepBaseName: true,
                fixedNpcKeys: ["레이디 헤카테"],
                objects: []
            }
        ]
    },
    youngjin_office_interior: {
        name: "영진 탐정 사무소",
        desc: "서류와 사진으로 가득한 작은 탐정 사무소.",
        bg: "https://placehold.co/1400x900/f3f3f3/333?text=%EC%82%AC%EB%AC%B4%EC%86%8C",
        start: "office_desk",
        spots: [
            {
                id: "office_desk",
                name: "사무소 데스크",
                desc: "탐정과 조수가 의뢰를 정리하는 자리.",
                bg: "https://placehold.co/1400x900/f7f7f7/333?text=%EC%82%AC%EB%AC%B4%EC%86%8C+%EB%8D%B0%EC%8A%A4%ED%81%AC",
                pos: { x: 50, y: 52 },
                grid: { x: 1, y: 1 },
                links: [],
                tags: ["사무소", "의뢰"],
                icon: "🕵️",
                objects: [
                    { id: "office_detective", name: "탐정", icon: "<img src=\"assets/my_detective.png\" alt=\"탐정\" class=\"npc-icon\">", action: "npc_dialogue", npcKey: "영진 탐정", pos: { x: 42, y: 58 } },
                    { id: "office_assistant", name: "조수", icon: "📋", action: "open_casefiles", npcKey: "사무소 조수", pos: { x: 58, y: 58 } },
                    { id: "office_exit", name: "구시가지로", icon: "🚪", action: "enter_city_area", areaId: "east_oldtown", spotId: "youngjin_office", pos: { x: 90, y: 62 } }
                ]
            }
        ]
    },
    west_industrial: {
        name: "공업지대 내부",
        desc: "폐공장과 국도가 얽힌 산업 지대. 거친 소음과 기계음이 끊이지 않습니다.",
        bg: "https://placehold.co/1400x900/e9e9e9/333?text=%EA%B3%B5%EC%97%85%EC%A7%80%EB%8C%80",
        start: "industrial_yard",
        spots: [
            {
                id: "industrial_yard",
                name: "폐공장 단지",
                desc: "녹슨 설비와 컨베이어가 멈춰 선 넓은 부지.",
                bg: "https://placehold.co/1400x900/e6e6e6/333?text=%ED%8F%90%EA%B3%B5%EC%9E%A5+%EB%8B%A8%EC%A7%80",
                pos: { x: 50, y: 52 },
                grid: { x: 1, y: 1 },
                links: ["cargo_depot", "national_road", "bad_sector", "industrial_station", "black_market"],
                tags: ["폐공장", "소음", "암시장"],
                icon: "🏭"
            },
            {
                id: "cargo_depot",
                name: "화물 집하장",
                desc: "대형 트럭과 컨테이너가 드나드는 곳.",
                bg: "https://placehold.co/1400x900/e2e2e2/333?text=%ED%99%94%EB%AC%BC+%EC%A7%91%ED%95%98%EC%9E%A5",
                pos: { x: 78, y: 52 },
                grid: { x: 2, y: 1 },
                links: ["industrial_yard", "national_road"],
                tags: ["화물 트럭", "물류"],
                icon: "🚛"
            },
            {
                id: "national_road",
                name: "외곽 국도",
                desc: "도시 외곽으로 빠져나가는 넓은 도로.",
                bg: "https://placehold.co/1400x900/eaeaea/333?text=%EC%99%B8%EA%B3%BD+%EA%B5%AD%EB%8F%84",
                pos: { x: 50, y: 84 },
                grid: { x: 1, y: 2 },
                links: ["industrial_yard", "cargo_depot", "bad_sector", "industrial_station", "black_market"],
                tags: ["국도", "외곽"],
                icon: "🛣️"
            },
            {
                id: "black_market",
                name: "암시장",
                desc: "폐공장 옆 그늘진 통로. 불법 거래가 은밀히 이뤄진다.",
                bg: "https://placehold.co/1400x900/ededed/333?text=%EC%95%94%EC%8B%9C%EC%9E%A5",
                pos: { x: 78, y: 84 },
                grid: { x: 2, y: 2 },
                links: ["industrial_yard", "national_road", "back_alley"],
                tags: ["암시장", "불법 거래"],
                icon: "🕶️",
                objects: [
                    { id: "open_black_market", name: "암시장 거래", icon: "🛒", action: "open_black_market", pos: { x: 55, y: 60 } }
                ]
            },
            {
                id: "bad_sector",
                name: "클럽 Bad Sector",
                desc: "산업 지대 속에 숨겨진 클럽. 밤에만 문을 연다.",
                bg: "https://placehold.co/1400x900/e8e8e8/333?text=Bad+Sector",
                pos: { x: 22, y: 52 },
                grid: { x: 0, y: 1 },
                links: ["industrial_yard", "national_road"],
                tags: ["클럽", "은밀"],
                icon: "🎧"
            },
            {
                id: "industrial_station",
                name: "남산역",
                desc: "공업지대와 이어지는 지하철역 출구.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%EB%82%A8%EC%82%B0%EC%97%AD",
                pos: { x: 78, y: 22 },
                grid: { x: 2, y: 0 },
                links: ["industrial_yard", "national_road"],
                tags: ["역", "지하철"],
                icon: "🚉",
                objects: [
                    { id: "to_south_platform", name: "지하철로 내려가기", icon: "⬇️", action: "enter_city_area", areaId: "subway_south_station", spotId: "south_platform", pos: { x: 55, y: 58 } },
                    { id: "to_industrial_yard", name: "공업단지 방면", icon: "🏭", action: "enter_city_area", areaId: "west_industrial", spotId: "industrial_yard", pos: { x: 35, y: 62 } },
                    { id: "to_back_alley", name: "뒷골목 방면", icon: "🌒", action: "enter_city_area", areaId: "west_industrial", spotId: "back_alley", pos: { x: 75, y: 65 } }
                ]
            },
            {
                id: "back_alley",
                name: "뒷골목",
                desc: "사람들의 시선을 피해 걷기 좋은 어두운 골목.",
                bg: "https://placehold.co/1400x900/e0e0e0/333?text=%EB%92%B7%EA%B3%A8%EB%AA%A9",
                pos: { x: 22, y: 84 },
                grid: { x: 0, y: 2 },
                links: ["industrial_yard", "national_road", "black_market"],
                tags: ["은신", "위험"],
                icon: "🌒",
                objects: [
                    { id: "slums_dungeon", name: "뒷골목 슬럼", icon: "🧭", action: "enter_dungeon", dungeonId: "slums_back_alley", pos: { x: 55, y: 60 } },
                    { id: "to_south_station", name: "남산역 출구", icon: "🚇", action: "enter_city_area", areaId: "west_industrial", spotId: "industrial_station", pos: { x: 78, y: 70 } }
                ]
            }
        ]
    },
    south_coast: {
        name: "해안 관광단지 내부",
        desc: "바닷바람과 네온이 뒤섞인 관광 구역. 산책하며 들를 곳이 많습니다.",
        bg: "https://placehold.co/1400x900/f3f3f3/333?text=%ED%95%B4%EC%95%88+%EA%B4%80%EA%B4%91%EB%8B%A8%EC%A7%80",
        start: "coast_boardwalk",
        spots: [
            {
                id: "coast_boardwalk",
                name: "해안 산책로",
                desc: "바닷바람을 느끼며 걸을 수 있는 산책길.",
                bg: "https://placehold.co/1400x900/f5f5f5/333?text=%ED%95%B4%EC%95%88+%EC%82%B0%EC%B1%85%EB%A1%9C",
                pos: { x: 50, y: 52 },
                grid: { x: 1, y: 1 },
                links: ["amusement_park", "mega_mart", "seaside_hotel", "beachfront", "coast_station"],
                tags: ["바닷가", "산책"],
                icon: "🌊",
                objects: [
                    { id: "to_west_station", name: "서항역 출구", icon: "🚇", action: "enter_city_area", areaId: "south_coast", spotId: "coast_station", pos: { x: 70, y: 62 } }
                ]
            },
            {
                id: "amusement_park",
                name: "놀이공원",
                desc: "빛과 소음으로 가득한 관광 명소.",
                bg: "https://placehold.co/1400x900/f7f7f7/333?text=%EB%86%80%EC%9D%B4%EA%B3%B5%EC%9B%90",
                pos: { x: 22, y: 52 },
                grid: { x: 0, y: 1 },
                links: ["coast_boardwalk", "mega_mart"],
                tags: ["놀이기구", "축제"],
                icon: "🎡"
            },
            {
                id: "mega_mart",
                name: "대형 마트",
                desc: "관광객과 주민 모두가 들르는 대형 상점.",
                bg: "https://placehold.co/1400x900/f2f2f2/333?text=%EB%8C%80%ED%98%95+%EB%A7%88%ED%8A%B8",
                pos: { x: 78, y: 52 },
                grid: { x: 2, y: 1 },
                links: ["coast_boardwalk", "amusement_park", "seaside_hotel", "coast_station"],
                tags: ["쇼핑", "보급"],
                icon: "🛒"
            },
            {
                id: "seaside_hotel",
                name: "해안 호텔",
                desc: "전망 좋은 고급 숙박 시설.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%ED%95%B4%EC%95%88+%ED%98%B8%ED%85%94",
                pos: { x: 50, y: 84 },
                grid: { x: 1, y: 2 },
                links: ["coast_boardwalk", "mega_mart", "beachfront"],
                tags: ["숙박", "전망"],
                icon: "🏨"
            },
            {
                id: "coast_station",
                name: "서항역",
                desc: "해안 관광단지와 이어지는 지하철역 출구.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%EC%84%9C%ED%95%AD%EC%97%AD",
                pos: { x: 78, y: 84 },
                grid: { x: 2, y: 2 },
                links: ["coast_boardwalk", "mega_mart"],
                tags: ["역", "지하철"],
                icon: "🚉",
                objects: [
                    { id: "to_west_platform", name: "지하철로 내려가기", icon: "⬇️", action: "enter_city_area", areaId: "subway_west_station", spotId: "west_platform", pos: { x: 55, y: 60 } },
                    { id: "to_coast_boardwalk", name: "해안 산책로 방면", icon: "🌊", action: "enter_city_area", areaId: "south_coast", spotId: "coast_boardwalk", pos: { x: 35, y: 65 } },
                    { id: "to_mega_mart", name: "대형 마트 방면", icon: "🛒", action: "enter_city_area", areaId: "south_coast", spotId: "mega_mart", pos: { x: 75, y: 65 } }
                ]
            },
            {
                id: "beachfront",
                name: "바닷가",
                desc: "파도 소리와 모래사장이 이어지는 해변.",
                bg: "https://placehold.co/1400x900/f4f4f4/333?text=%EB%B0%94%EB%8B%B7%EA%B0%80",
                pos: { x: 50, y: 22 },
                grid: { x: 1, y: 0 },
                links: ["coast_boardwalk", "seaside_hotel"],
                tags: ["해변", "휴식"],
                icon: "🏖️"
            }
        ]
    },
    north_mountain: {
        name: "성주산 구역 내부",
        desc: "짙은 숲과 산길이 이어지는 지대. 길을 잃기 쉬워 주의가 필요합니다.",
        bg: "https://placehold.co/1400x900/f1f1f1/333?text=%EC%84%B1%EC%A3%BC%EC%82%B0",
        start: "forest_entry",
        spots: [
            {
                id: "forest_entry",
                name: "숲 입구",
                desc: "성주산 숲으로 들어가는 입구. 여기서부터 길이 모호해진다.",
                bg: "https://placehold.co/1400x900/f4f4f4/333?text=%EC%88%B2+%EC%9E%85%EA%B5%AC",
                pos: { x: 50, y: 52 },
                grid: { x: 0, y: 0 },
                links: ["abandoned_lab", "north_station"],
                tags: ["산길", "주의"],
                icon: "🌲",
                objects: [
                    { id: "deep_forest", name: "깊은 숲으로", icon: "🌲", action: "enter_dungeon", dungeonId: "north_mountain_forest", pos: { x: 55, y: 60 } },
                    { id: "to_north_station", name: "성주산역 출구", icon: "🚇", action: "enter_city_area", areaId: "north_mountain", spotId: "north_station", pos: { x: 78, y: 70 } }
                ]
            },
            {
                id: "abandoned_lab",
                name: "폐연구소",
                desc: "숲속 깊숙한 곳에서 발견된 폐쇄 연구시설.",
                bg: "https://placehold.co/1400x900/f2f2f2/333?text=%ED%8F%90%EC%97%B0%EA%B5%AC%EC%86%8C",
                pos: { x: 78, y: 52 },
                grid: { x: 1, y: 0 },
                links: ["forest_entry"],
                tags: ["연구소", "폐쇄"],
                icon: "🧪",
                requiresDiscovery: "abandoned_lab"
            },
            {
                id: "north_station",
                name: "성주산역",
                desc: "성주산과 이어지는 지하철역 출구.",
                bg: "https://placehold.co/1400x900/f0f0f0/333?text=%EC%84%B1%EC%A3%BC%EC%82%B0%EC%97%AD",
                pos: { x: 78, y: 80 },
                grid: { x: 1, y: 1 },
                links: ["forest_entry"],
                tags: ["역", "지하철"],
                icon: "🚉",
                objects: [
                    { id: "to_north_platform", name: "지하철로 내려가기", icon: "⬇️", action: "enter_city_area", areaId: "subway_north_station", spotId: "north_platform", pos: { x: 55, y: 60 } },
                    { id: "to_forest_entry", name: "숲 입구 방면", icon: "🌲", action: "enter_city_area", areaId: "north_mountain", spotId: "forest_entry", pos: { x: 75, y: 65 } }
                ]
            }
        ]
    }
};

/* [CITY DUNGEONS] 도시 오브젝트로 진입하는 던전 설정 (추가 확장용) */
const CITY_DUNGEON_CONFIGS = {
    white_cube_beyond: {
        title: "화이트 큐브 너머",
        desc: "도심 한복판에 숨겨진 이면세계. 큐레이터가 지배한다.",
        width: 6,
        height: 3,
        roomCount: 12,
        data: {
            battle: 5,
            investigate: 3,
            event: 2,
            treasure: 1,
            boss: 1
        },
        enemyPool: ["curator"],
        boss: "curator"
    },
    north_mountain_forest: {
        title: "성주산 깊은 숲",
        desc: "짙은 숲길을 헤매다 보면 어딘가로 이어지는 흔적이 보인다.",
        width: 7,
        height: 3,
        roomCount: 12,
        data: {
            battle: 4,
            investigate: 3,
            event: 3,
            treasure: 1,
            boss: 1
        },
        noClueLock: true,
        discoverCitySpot: { areaId: "north_mountain", key: "abandoned_lab", name: "폐연구소" }
    },
    slums_back_alley: {
        title: "뒷골목 슬럼",
        desc: "범죄와 오물이 뒤섞인 골목. 위험하지만 정보가 모인다.",
        width: 6,
        height: 3,
        roomCount: 12,
        data: {
            battle: 4,
            box: 2,
            event: 2,
            shop: 1,
            heal: 1
        },
        enemyPool: ["괴물 쥐", "불량배"]
    }
};

const DISTRICTS = {
    "slums": {
        name: "뒷골목 슬럼",
        desc: "범죄와 오물이 뒤섞인 곳. 불량배가 많지만 정보도 많다.",
        danger: 1,
        color: "#c0392b",
        scenarios: ["tutorial", "hecate_trial"],
        facilities: ["shop_black_market"],
        enemyPool: ["괴물 쥐", "불량배"],
        dungeon: {
            width: 6,        // 맵 길이
            height: 3,       // 맵 높이
            roomCount: 12,   // 총 방 개수
            data: {
                "battle": 4,      // 전투방 3개
                "box": 2,         // 📦 상자방 2개 (NEW)
                "event": 2,       // ❔ 이벤트방 2개 (NEW)
                "shop": 1,        // 상점 1개
                "heal": 1         // 회복 1개
            }
        },
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
        facilities: ["shop_high_end"],
        // ★ [추가] 플라자 순찰 설정
        dungeon: {
            width: 6,
            height: 6,
            roomCount: 15, // 넓고 방이 많음
            data: {
                "battle": 3,
                "investigate": 5, // 조사가 많음
                "shop": 2,        // 상점도 있음
                "treasure": 3
            }
        }
    },
    "cult_hideout": {
        name: "👁️ 교단 은신처",
        desc: "음습한 기운이 느껴지는 폐쇄된 지하철역.",
        danger: 3,
        color: "#8e44ad",
        hidden: true,
        scenarios: ["cult_investigation"],
        facilities: [],
        enemyPool: ["사교도"]
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
    // --- 장비 아이템 (유물에서 분리) ---
    // bonusStats는 '원본 스탯'에 더해지는 값입니다. (예: +2 => 보정치(mod) +1)
    "권총": { type: "item", usage: "equip", equipSlots: ["leftHand", "rightHand"], rank: 2, price: 3000, icon: "🔫", desc: "탐정의 기본 무기. 장착 시 덱에 [사격(관통)] 카드가 추가됩니다.", grantCards: ["사격(관통)"], tags: ["weapon", "gun"], categories: ["general"] },
    "쿠보탄": { type: "item", usage: "equip", equipSlots: ["leftHand", "rightHand"], rank: 1, price: 2000, icon: "🥊", desc: "공격력 +1 (장착 효과) 장착 시 덱에 [쿠보탄 급소] 카드가 추가됩니다.", bonusStats: { str: 2 }, grantCards: ["쿠보탄 급소"], tags: ["weapon", "tool"], categories: ["general"] },
    "강인함의 부적": { type: "item", usage: "equip", equipSlots: ["accessory1", "accessory2"], rank: 1, price: 2000, icon: "🧿", desc: "방어력 +1 (장착 효과)", bonusStats: { con: 2 }, tags: ["charm", "accessory"], categories: ["occult"] },
    "좋은 운동화": { type: "item", usage: "equip", equipSlots: ["legs"], rank: 1, price: 2000, icon: "👟", desc: "속도 +1 (장착 효과)", bonusStats: { dex: 2 }, tags: ["clothes", "brand"], categories: ["general"] },
    "울끈불끈 패딩": { type: "item", usage: "equip", equipSlots: ["body"], rank: 2, price: 3000, icon: "🧥", desc: "최대 HP +50 (장착 효과)", bonusHp: 50, tags: ["clothes", "warm"], categories: ["general"] },
    "은 단검": {
        type: "item", usage: "equip", equipSlots: ["leftHand", "rightHand"], rank: 2, price: 3500, icon: "⚔️",
        desc: "장착 시 덱에 [은빛 찌르기] 카드가 추가됩니다.",
        grantCards: ["은빛 찌르기"], tags: ["weapon", "holy"], categories: ["occult"]
    },
    "스파이크 너클": {
        type: "item", usage: "equip", equipSlots: ["leftHand", "rightHand"], rank: 1, price: 1500, icon: "🔨",
        desc: "장착 시 덱에 [너클 강타] 카드가 추가됩니다.",
        grantCards: ["너클 강타"], tags: ["weapon", "physical"], categories: ["general"]
    },

    // --- 유물 아이템 (수집/지속효과) ---
    "황금 대타": { type: "item", usage: "passive", rank: 3, price: 4000, icon: "🏺", desc: "부활 1회 (보유 효과)", tags: ["magic", "valuable"], categories: ["occult"] },


    // --- 소모성 아이템 ---
    "회복약": { type: "item", usage: "consume", rank: 1, price: 1000, icon: "🍷", desc: "HP 25 회복 (사용 시 소모)", effect: "heal", val: 25, target: "self", tags: ["drink", "alcohol"], categories: ["pharmacy"] },
    "호신용 스프레이": { type: "item", usage: "consume", rank: 1, price: 1000, icon: "🧴", desc: "적 10 피해 (사용 시 소모)", effect: "damage", val: 10, target: "enemy", tags: ["weapon", "chemical"], categories: ["general"] },
    "해결사의 연락처": {
        type: "item",
        usage: "consume",
        rank: 2,
        price: 1500,
        icon: "📱",
        desc: "즉시 던전을 탈출합니다. (전문 해결사 호출)",
        effect: "escape", // ★ 새로운 효과 정의
        target: "self",
        tags: ["tool", "phone"],
        categories: ["general"]
    },
    "뇌물 봉투": { type: "item", usage: "consume", rank: 2, price: 1500, icon: "✉️", desc: "NPC 호감도 대폭 상승", effect: "none", target: "enemy", tags: ["money", "paper"], categories: ["general"] },
    "공포 영화 포스터": { type: "item", usage: "consume", rank: 1, price: 500, icon: "👻", desc: "NPC 멘탈 감소", effect: "none", target: "enemy", tags: ["horror", "paper"], categories: ["general"] },
    "라이터": {
        type: "item", usage: "consume", rank: 1, price: 2000, icon: "🔥",
        desc: "3턴 동안 공격에 [화염] 속성을 부여합니다.",
        effect: "buff_attr", val: "fire", duration: 3, target: "self",
        tags: ["tool", "fire"], categories: ["general"]
    },
    "성수": {
        type: "item", usage: "consume", rank: 1, price: 500, icon: "💧",
        desc: "3턴 동안 공격에 [물]과 [신성] 속성을 부여합니다.",
        effect: "buff_attr",
        val: ["water", "holy"], // ★ 핵심: 배열로 정의
        duration: 3, target: "self",
        tags: ["holy", "water"], categories: ["occult"]
    },
    "숫돌": {
        type: "item", usage: "consume", rank: 1, price: 300, icon: "🪨",
        desc: "3턴 동안 공격에 [참격] 속성을 부여합니다.",
        effect: "buff_attr", val: "slash", duration: 3, target: "self", categories: ["general"]
    },
    "한방차": { type: "item", usage: "consume", rank: 1, price: 1200, icon: "🍵", desc: "SP 15 회복 (한방)", effect: "heal", val: 0, target: "self", tags: ["herbal"], categories: ["herbal"], healSp: 15 },
    "보혈환": { type: "item", usage: "consume", rank: 2, price: 1800, icon: "🟢", desc: "HP 20, SP 10 회복 (한방)", effect: "heal", val: 20, target: "self", tags: ["herbal"], categories: ["herbal"], healSp: 10 },
    // --- 특수 (패시브지만 소모품처럼 취급되었던 것들) ---
    // 대타 인형은 가지고 있으면 효과가 발동하고 사라지므로 'passive'에 가깝지만 로직상 특수 처리
    "대타 인형": { type: "item", usage: "passive", rank: 3, price: 3000, icon: "🧸", desc: "사망 시 자동 소모하여 부활", effect: "revive", target: "passive", tags: ["doll", "toy"], categories: ["occult"] }
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
            {
                type: "choice", options: [
                    { txt: "자세한 이야기를 듣는다", next: 6 },
                    { txt: "귀찮으니 돌려보낸다 (하지만 의뢰는 받아야 한다)", next: 6 }
                ]
            },
            { type: "talk", id: "client", name: "의뢰인", text: "마지막으로 연락된 곳이 '뒷골목' 근처였어요. 사례는 넉넉히 하겠습니다." },
            { type: "end" } // 스토리가 끝나면 자동으로 callback(의뢰 수락) 실행
        ],
        // ★ [추가] 던전 생성 설정 (여기서 방 개수를 조절하세요)
        dungeon: {
            width: 5,        // 맵 가로 크기
            height: 5,       // 맵 세로 크기
            roomCount: 12,   // 생성할 총 방의 개수 (시작/보스방 제외)
            data: {          // 방 종류별 개수 (합계가 roomCount보다 작으면 나머지는 empty/battle 랜덤)
                "battle": 4,      // 전투방 4개
                "investigate": 3, // 조사방 3개 (단서)
                "event": 2,       // 이벤트방 2개
                "shop": 1,        // 상점 1개
                "treasure": 1,    // 보물방 1개
                "heal": 1         // 회복방 1개
            }
        },
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
        enemyPool: ["괴물 쥐"],
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

        // [NEW] 던전 설정 (폐쇄된 저택 Map)
        dungeon: {
            width: 6,
            height: 3,
            roomCount: 14,
            data: {
                "battle": 5,
                "investigate": 3,
                "event": 2,
                "treasure": 1,
                "heal": 1
            },
            noClueLock: false // 단서 모아야 보스 진입 가능
        },

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
    ,
    "hecate_trial": {
        title: "헤카테의 의뢰: 잃어버린 재료",
        desc: "카페 헤카테의 특별한 재료가 사라졌다. 회수해 달라는 의뢰.",
        source: "hecate",
        locations: ["구시가지 뒷골목", "재래시장 골목"],
        events: [{ type: "battle", chance: 0.35 }, { type: "text", chance: 0.35 }, { type: "nothing", chance: 0.3 }],
        enemyPool: ["불량배"],
        boss: "boss_gang_leader",
        clueEvents: [{ text: "깨진 유리병 발견.", gain: 10 }, { text: "운반 흔적 발견.", gain: 15 }],
        reward: { gold: 900, xp: 180, itemRank: 1 },
        canRetreat: true
    }
};

// 의뢰 해금/제한 규칙 (추가/수정은 여기서)
// 플래그 네이밍 규칙:
// - 형식: domain:subject:action[:state]
// - 예시: npc:priest:met, item:holy_water:obtained, quest:tutorial:cleared, story:cult:altar_seen
// - 도메인: npc, quest, item, story, event, area
// - 소문자 + 언더바 권장, 공백 금지
// 규칙은 AND 조건으로 모두 만족해야 노출됩니다.
// 사용 가능 키:
// - minLevel: 최소 레벨
// - requiredFlags: 필요한 플래그 배열 (NPC 대화, 이벤트 트리거 등)
// - leadFlag: 실마리 탭 노출을 위한 대표 플래그 (없으면 requiredFlags[0] 사용)
// - requiredItems: 필요한 아이템 배열 (인벤/유물/창고 포함)
// - requiredScenariosCleared: 선행 의뢰 완료 배열
// - minClearedCount: 완료한 의뢰 개수 최소치
// - startAt: { day, timeIndex? } 시작 가능 시점
// - expireAt: { day, timeIndex? } 만료 시점 (지나면 비노출)
// - hideAfterClear: 완료 후 목록에서 숨김 여부
const SCENARIO_RULES = {
    tutorial: {
        // 기본 튜토리얼은 항상 표시
    },
    cult_investigation: {
        leadFlag: "npc:priest:met",
        requiredFlags: ["npc:priest:met"],
        requiredScenariosCleared: ["tutorial"]
    },
    hecate_trial: {
        leadFlag: "lead:hecate:trial",
        requiredFlags: ["lead:hecate:trial"]
    },
    cursed_antique: {
        requiredScenariosCleared: ["cult_investigation"]
    }
};

// [NARRATION] 내레이션 텍스트 (통합 관리)
const NARRATION = {
    city: {
        map: {
            idle: "당신은 다음으로 갈 장소를 생각해 봅니다…",
            ask: "이곳으로 갈까요?",
            go: "당신은 [PLACE:으로] 향했습니다."
        },
        area: {
            arrive: "당신은 [PLACE:에] 도착했습니다.",
            inspect: "당신은 [PLACE:을를] 살펴봅니다.",
            next: "이제 어디로 갈까요?"
        }
    },
    battle: {
        start: "당신은 전투를 준비합니다.",
        victory: "당신은 전투에서 승리했습니다.",
        defeat: "당신은 더 이상 싸울 수 없습니다.",
        hpDamage: "당신은 체력 피해 [AMOUNT]를 입었습니다. (HP: [HP])",
        enemyHpDamage: "적이 체력 피해 [AMOUNT]를 입었습니다. (HP: [HP])",
        mentalDamage: "당신은 의지 피해 [AMOUNT]를 입었습니다. (남은 벽: [MENTAL])",
        enemyMentalDamage: "적이 의지 피해 [AMOUNT]를 입었습니다. (남은 벽: [MENTAL])",
        critical: "당신은 치명타로 [AMOUNT]의 피해를 주었습니다. (HP: [HP])",
        thorns: "가시 반격으로 [AMOUNT]의 피해를 입었습니다.",
        reflect: "반사 반격으로 [AMOUNT]의 피해를 입었습니다.",
        lastStand: "당신은 간신히 버텼습니다.",
        blockGain: "당신은 방어도를 [AMOUNT] 얻었습니다.",
        assistantBlockGain: "조수가 방어도를 [AMOUNT] 얻었습니다.",
        buffApply: "[TARGET:에게] [BUFF] 효과가 적용되었습니다.",
        poison: "독 피해 [AMOUNT]를 입었습니다.",
        regen: "활력으로 HP가 [AMOUNT] 회복되었습니다.",
        assistantTook: "조수가 피해를 대신 받았습니다. (-[AMOUNT])",
        reactionGone: "당신의 반응 준비가 사라졌습니다.",
        stunned: "당신은 기절 상태입니다. 아무것도 할 수 없습니다.",
        postureRecovered: "당신은 자세를 바로잡았습니다.",
        comboAction: "당신은 연속 행동으로 방어도를 유지합니다.",
        attrExpired: "속성 부여 효과가 사라졌습니다.",
        cardExhausted: "휘발성 카드가 소멸되었습니다.",
        targetStunned: "[TARGET:은는] 기절하여 움직일 수 없습니다.",
        postureRecoverTarget: "[TARGET:이가] 자세를 바로잡습니다.",
        hitStunnedTarget: "당신은 기절한 대상을 가격합니다.",
        stunSuccess: "[TARGET:이가] 기절했습니다. (약점 공략 성공)",
        selfStunned: "당신은 기절했습니다. 다음 턴 행동 불가입니다.",
        postureBreakEnemy: "[TARGET:의] 자세가 무너졌습니다. (약점 노출)",
        postureBreakSelf: "당신의 자세가 무너졌습니다. (피해량 증가)",
        cardUse: "당신은 [CARD:을를] 사용합니다.",
        noAssistant: "조수가 없어 사용할 수 없습니다.",
        reactionOnly: "전투 중에만 반응 카드를 사용할 수 있습니다.",
        reactionReady: "당신은 [CARD] 반응 준비를 합니다.",
        planOnly: "전투 중에만 계획 카드를 사용할 수 있습니다.",
        planSet: "당신은 [CARD] 계획을 설정합니다.",
        apGain: "당신은 AP [AMOUNT]를 얻었습니다.",
        drawCards: "당신은 카드를 [AMOUNT]장 뽑았습니다.",
        drawNextTurn: "당신은 다음 턴에 카드를 [AMOUNT]장 추가로 뽑습니다.",
        emptyPile: "대상 카드 더미가 비어있습니다.",
        copyOrRecover: "당신은 [CARD:을를] [ACTION]했습니다.",
        evidenceBreak: "당신은 증거로 논리 방어를 깨뜨렸습니다.",
        lieSuccess: "당신의 거짓말이 성공했습니다.",
        lieFail: "당신의 거짓말이 들켰습니다.",
        noSummon: "당신은 부하를 부를 수 없습니다.",
        weaknessFound: "당신은 [TARGET:의] 약점을 파악했습니다.",
        nextAttackAttr: "당신의 다음 공격에 속성이 부여됩니다.",
        assistantFocus: "이번 턴 적의 공격이 조수에게 집중됩니다.",
        cruelDecision: "당신은 비정한 결단으로 조수 체력을 희생합니다.",
        noAssistantEffect: "조수가 없어 효과가 없습니다.",
        cardCopyAdded: "카드가 복제되어 버린 카드에 추가되었습니다.",
        cardGrowPermanent: "[CARD:이가] 영구 성장했습니다.",
        cardGrowBattle: "[CARD:이가] 전투 중 성장했습니다.",
        fieldFull: "전장이 꽉 차서 더 이상 소환할 수 없습니다.",
        reinforced: "[TARGET:이가] 증원되었습니다."
    },
    system: {
        itemGain: "당신은 [ITEM:을를] 획득했습니다.",
        clueGain: "당신은 단서를 확보했습니다.",
        clueGainAmount: "당신은 단서를 [AMOUNT]개 확보했습니다.",
        clueGainTarget: "당신은 [TARGET:에] 단서 [AMOUNT]개를 추가했습니다. (현재 [TOTAL])",
        clueInsight: "당신은 직감으로 단서를 확보했습니다. (현재 [TOTAL])",
        clueAssistant: "당신은 조수의 보고로 단서를 확보했습니다. (현재 [TOTAL])",
        clueConsume: "당신은 단서 [AMOUNT]개를 소모해 추가 피해를 입혔습니다.",
        clueConclusion: "당신은 단서를 모아 강력한 결론을 도출했습니다.",
        clueThresholdDraw: "당신은 단서 [THRESHOLD] 이상으로 카드를 [AMOUNT]장 추가 드로우합니다.",
        assistantDown: "조수가 기절했습니다.",
        assistantShaken: "조수가 흐트러졌습니다.",
        assistFail: "체력이 부족해 조수를 치료할 수 없습니다.",
        assistHeal: "조수가 회복되었습니다. (+[AMOUNT])",
        profilingDone: "프로파일링이 완료되었습니다. 결정적 논증을 손에 추가합니다.",
        mansionEnter: "당신은 폐쇄된 저택에 진입했습니다.",
        powerGain: "당신은 파워 [CARD:을를] 획득했습니다.",
        powerGainSocial: "당신은 소셜 파워 [CARD:을를] 획득했습니다.",
        powerAp: "당신은 파워 효과로 AP [AMOUNT]를 얻었습니다.",
        powerCostZero: "당신은 손패 [CARD:의] 비용을 0으로 만듭니다.",
        deckMix: "당신의 덱에 [CARD] 카드 [AMOUNT]장이 섞였습니다.",
        enemyDeckMix: "적의 덱에 [CARD] 카드 [AMOUNT]장이 섞였습니다.",
        socialStart: "당신은 [TARGET:과와] 설전을 벌입니다.",
        spDamage: "당신은 정신적 충격으로 SP [AMOUNT]를 잃었습니다.",
        spDamageShock: "당신은 정신적 충격으로 SP [AMOUNT]를 잃었습니다.",
        inventoryFull: "가방이 꽉 찼습니다. 교체할 아이템을 선택하세요.",
        swapItem: "당신은 [OLD:을를] 버리고 [NEW:을를] 획득했습니다.",
        itemPassive: "[ITEM:은는] 가지고 있으면 효과를 발휘합니다.",
        battleTurnOnly: "전투 중 내 턴에만 가능합니다.",
        giftItem: "당신은 [ITEM:을를] 선물합니다.",
        giftGreat: "효과가 굉장합니다.",
        giftBad: "상대가 기겁합니다.",
        giftOk: "나쁘지 않은 반응입니다.",
        attrGranted: "당신은 [ATTR] 속성을 [TURNS]턴 동안 부여받습니다.",
        healBoth: "당신은 HP [HP]와 SP [SP]를 회복했습니다.",
        healHp: "당신은 HP [HP]를 회복했습니다.",
        throwItem: "당신은 [ITEM:을를] 던져 적에게 피해를 입혔습니다.",
        callFixer: "당신은 해결사를 불러 호위를 요청했습니다.",
        itemRest: "당신은 휴식을 취합니다.",
        relicOwned: "당신은 이미 [ITEM:을를] 보유 중입니다.",
        locationMarker: "[PLACE:에] 도착했습니다.",
        bossAppear: "[BOSS:이가] 출현했습니다.",
        willHeal: "당신은 의지 [AMOUNT]를 회복했습니다.",
        retreat: "당신은 서둘러 물러납니다.",
        noBattleNpc: "전투 데이터가 없는 NPC입니다.",
        socialFail: "협상이 결렬되어 전투가 시작됩니다.",
        cardTriggerApLoss: "[CARD] 발동: AP -[AMOUNT]",
        cardTriggerHpLoss: "[CARD] 발동: HP -[AMOUNT]",
        cardTriggerDiscard: "[CARD] 발동: 무작위 카드가 버려졌습니다.",
        shuffleDeck: "당신은 덱을 섞습니다.",
        handFullDiscard: "손패가 가득 차 [CARD] 카드가 버려졌습니다.",
        addCardToDeck: "당신은 [CARD:을를] [DECK:에] 추가했습니다.",
        infiniteStageBoss: "무한 모드 보스 스테이지 [STAGE]가 시작됩니다.",
        infiniteStage: "무한 모드 스테이지 [STAGE]가 시작됩니다.",
        notice: "[TEXT]",
        openCaseFiles: "당신은 의뢰 목록을 살펴보았습니다.",
        openActiveMissions: "당신은 진행 중인 의뢰를 확인했습니다.",
        levelUp: "당신의 레벨이 상승했습니다.",
        cardReward: "당신은 카드 보상을 확인했습니다.",
        learnCard: "당신은 새로 [CARD:을를] 습득했습니다.",
        openShop: "당신은 상점에 진입했습니다. 어떤 것을 구매할까요?",
        openPlayerInfo: "당신은 현재 정보를 확인했습니다."
    },
    event: {
        vendingTitle: "⚡ 고장 난 자판기",
        vendingDesc: "골목길 구석에 네온사인이 깜빡이는 낡은 자판기가 있습니다. 안에 내용물이 들어있지만 전원이 불안정해 보입니다.",
        shadyTitle: "🕶️ 수상한 거래",
        shadyDesc: "코트 깃을 세운 남자가 은밀하게 접근합니다. \"좋은 물건이 있는데, 피를 좀 나눌 수 있나?\"",
        altarTitle: "🕯️ 기이한 제단",
        altarDesc: "건물 지하에서 촛불이 켜진 작은 제단을 발견했습니다. 알 수 없는 속삭임이 들려옵니다.",
        walletTitle: "👛 떨어진 지갑",
        walletDesc: "바닥에 두툼한 지갑이 떨어져 있습니다.",
        bushTitle: "🌿 수상한 덤불",
        bushDesc: "덤불 속에서 부스럭거리는 소리가 들립니다. (전투가 발생할 수 있습니다)",
        supplyTitle: "버려진 보급품",
        supplyDesc: "길가에 버려진 보급 상자를 발견했습니다.",
        vendingNoMoney: "돈이 부족합니다.",
        vendingItem: "덜컹! [ITEM:이가] 나왔습니다.",
        vendingKickItem: "쾅! 충격으로 [ITEM:이가] 떨어졌습니다!",
        vendingKickFail: "쾅! 자판기가 쓰러지며 발을 찧었습니다. (체력 -5)",
        shadyTrade: "남자는 피를 뽑아가고 돈을 쥐어줍니다. (HP -10, +5000원)",
        shadyReject: "남자는 혀를 차며 사라졌습니다.",
        altarPray: "마음이 차분해지지만, 시간이 많이 흘렀습니다. (SP +10, 위협도 +10)",
        altarBattle: "제단을 걷어차자 숨어있던 광신도가 튀어나옵니다!",
        walletTake: "죄책감이 들지만 지갑은 두둑합니다. (+[GAIN]원, SP -3)",
        walletReturn: "착한 일을 했다는 뿌듯함이 느껴집니다. (SP +5)",
        bushAmbush: "덤불 속에 숨어있던 적이 튀어나왔습니다!",
        supplyFound: "[ITEM:을를] 획득했습니다!"
    }
};

const EVENT_DATA = [
    {
        id: "vending_machine",
        titleKey: "event.vendingTitle",
        descKey: "event.vendingDesc",
        choices: [
            {
                txt: "돈을 넣는다 (800원)",
                func: () => {
                    if (player.gold < 800) {
                        logNarration("event.vendingNoMoney");
                        finishEvent("exploration");
                        return;
                    }

                    player.gold -= 800;
                    let item = getRandomItem("consumable", { categories: ["general"] });

                    // 아이템 획득 시도 (성공 시 팝업 띄우고 종료)
                    addItem(item, () => {
                        logNarration("event.vendingItem", { item });
                        finishEvent("exploration");
                    });
                }
            },
            {
                txt: "발로 찬다 (체력 -5, 50% 확률)",
                func: () => {
                    if (Math.random() < 0.5) {
                        let item = getRandomItem("consumable", { categories: ["general"] });
                        addItem(item, () => {
                            logNarration("event.vendingKickItem", { item });
                            finishEvent("exploration");
                        });
                    } else {
                        takeDamage(player, 5);
                        // 사망 체크는 takeDamage -> checkGameOver에서 처리되지만, 생존 시 팝업
                        if (player.hp > 0) {
                            logNarration("event.vendingKickFail");
                            finishEvent("exploration");
                        }
                    }
                }
            },
            { txt: "무시한다", func: () => { finishEvent("exploration"); } }
        ]
    },
    {
        id: "shady_merchant",
        titleKey: "event.shadyTitle",
        descKey: "event.shadyDesc",
        choices: [
            {
                txt: "피를 판다 (HP -10, +5000원)",
                func: () => {
                    takeDamage(player, 10);
                    if (player.hp > 0) {
                        player.gold += 5000;
                        logNarration("event.shadyTrade");
                        finishEvent("exploration");
                    }
                }
            },
            {
                txt: "거절한다",
                func: () => {
                    logNarration("event.shadyReject");
                    finishEvent("exploration");
                }
            }
        ]
    },
    {
        id: "cult_altar",
        titleKey: "event.altarTitle",
        descKey: "event.altarDesc",
        choices: [
            {
                txt: "기도한다 (SP +10, 위협 +10)",
                func: () => {
                    player.sp = Math.min(player.maxSp, player.sp + 10);
                    game.scenario.doom += 10;
                    logNarration("event.altarPray");
                    finishEvent("exploration");
                }
            },
            {
                txt: "제단을 부순다 (전투)",
                func: () => {
                    showNarrationChoice(getNarration("event.altarBattle"), [
                        { txt: "전투!", func: () => { startBattle(false); } }
                    ]);
                }
            },
            { txt: "지나친다", func: () => { finishEvent("exploration"); } }
        ]
    },
    {
        id: "lost_wallet",
        titleKey: "event.walletTitle",
        descKey: "event.walletDesc",
        choices: [
            {
                txt: "가진다 (+소지금, SP -3)",
                func: () => {
                    let gain = 3000 + Math.floor(Math.random() * 200);
                    player.gold += gain;
                    player.sp -= 3;
                    logNarration("event.walletTake", { gain });
                    finishEvent("exploration");
                }
            },
            {
                txt: "경찰서에 맡긴다 (SP +5)",
                func: () => {
                    player.sp = Math.min(player.maxSp, player.sp + 5);
                    logNarration("event.walletReturn");
                    finishEvent("exploration");
                }
            }
        ]
    },
    {
        id: "suspicious_bush",
        titleKey: "event.bushTitle",
        descKey: "event.bushDesc",
        choices: [
            {
                txt: "살펴본다",
                func: () => {
                    showNarrationChoice(getNarration("event.bushAmbush"), [{
                        txt: "전투 개시",
                        func: () => {
                            startBattle();
                        }
                    }]);
                }
            },
            { txt: "건드리지 않는다", func: () => { finishEvent("exploration"); } }
        ]
    },

    {
        titleKey: "event.supplyTitle",
        descKey: "event.supplyDesc",
        icon: "📦",
        effect: () => {
            let foundItem = getRandomItem(null, { categories: ["general", "medicine"] });
            addItem(foundItem);
            return getNarration("event.supplyFound", { item: foundItem });
        }
    },
    {
        title: "수상한 상인",
        desc: "지나가던 상인이 물건을 강매합니다. (500G 지불)",
        icon: "💰",
        effect: () => {
            if (player.gold >= 500) {
                player.gold -= 500;
                let item = getRandomItem(null, { rank: 2 });
                addItem(item);
                return `500G를 내고 <span style='color:#f1c40f'>[${item}]</span>을(를) 얻었습니다.`;
            } else {
                return "돈이 없어 무시하고 지나갑니다.";
            }
        }
    },
    {
        title: "기습적인 깨달음",
        desc: "전투의 경험이 머릿속을 스치고 지나갑니다.",
        icon: "💡",
        effect: () => {
            player.xp += 100;
            return `경험치를 <span style='color:#3498db'>100 XP</span> 획득했습니다.`;
        }
    },
    {
        title: "함정!",
        desc: "이런! 발을 헛디뎠습니다.",
        icon: "⚠️",
        effect: () => {
            let dmg = Math.floor(player.maxHp * 0.1);
            player.hp = Math.max(1, player.hp - dmg);
            return `체력이 <span style='color:#e74c3c'>${dmg}</span> 감소했습니다.`;
        }
    }
];
/* [data.js] JOB_DATA 수정 */

/* [data.js] JOB_DATA 수정 (이미지 경로 추가) */
const JOB_DATA = {
    "detective": {
        name: "사립 탐정",
        desc: "논리와 이성으로 사건을 해결합니다.",
        baseStats: { str: 10, con: 9, dex: 12, int: 16, wil: 14, cha: 12 },
        defaultTraits: ["sharp_eye"],
        starterDeck: ["조사", "조사", "조사", "조사", "회피", "조수 호출", "추리", "명령: 유인", "명령: 방호"],
        starterSocialDeck: ["논리적 반박", "논리적 반박", "증거 제시", "사실 확인", "심호흡"],
        starterEquipment: { rightHand: "권총" },
        // [NEW] 탐정 이미지
        img: CHARACTER_IMAGES.detective
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
    },
    "wizard": {
        name: "마법사",
        desc: "기초 마법과 이론으로 힘을 끌어냅니다.",
        baseStats: { str: 8, con: 10, dex: 10, int: 18, wil: 16, cha: 10 },
        defaultTraits: ["arcane_student"],
        starterDeck: ["타격", "타격", "수비", "수비", "힐링광선", "전술적 보충"],
        starterSocialDeck: ["침묵", "무시", "심호흡", "심호흡"],
        img: "https://placehold.co/150x150/1f1f1f/ffffff?text=Wizard"
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
    "arcane_student": {
        name: "비전 수련생",
        type: "job_unique",
        desc: "[마법사] 이성 보정 (지능 +2)",
        cost: 0,
        stats: { int: 2 }
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
    },
    "curse_unlucky": {
        name: "저주: 불운",
        type: "curse",
        desc: "덱에 [저주: 불운]이(가) 고정됩니다. 치료로만 해제 가능",
        cost: -2,
        cureCost: 1000,
        cureTag: "occult"
    },
    "curse_shackles": {
        name: "저주: 족쇄",
        type: "curse",
        desc: "덱에 [저주: 족쇄]이(가) 고정됩니다. 치료로만 해제 가능",
        cost: -2,
        cureCost: 2000,
        cureTag: "occult"
    }
};

/* 1. 속성 정의 (아이콘 매핑) */
const ATTR_ICONS = {
    none: "⚪", // 무속성
    fire: "🔥", water: "💧", grass: "🌿", electric: "⚡", ice: "❄️", // 원소
    slash: "⚔️", pierce: "🏹", strike: "🔨", // 물리
    holy: "✨", profane: "😈" // 특수
};




