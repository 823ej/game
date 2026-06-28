/* ============================================================
   scenarios.js — 직접 쓰는 사건 / 스토리 모음
   ------------------------------------------------------------
   이 파일은 "내가 쓴 사건"만 모아두는 안전한 작업 공간입니다.
   엔진 코드(game.js, story.js 등)는 건드릴 필요가 없습니다.

   [사건 추가 방법]
   1) 이 파일 맨 아래 "사건 양식(템플릿)" 주석을 통째로 복사한다.
   2) 아래 NEW_SCENARIOS = { ... } 의 중괄호 안에 붙여넣는다.
   3) 내용을 내 사건에 맞게 고친다.
   4) 브라우저를 새로고침하고 [사건 파일]에서 확인한다.

   [노출 조건(잠금) — 선택]
   특정 조건에서만 사건이 보이게 하려면 NEW_SCENARIO_RULES 에
   같은 id 로 규칙을 적는다. (안 적으면 처음부터 항상 보임)

   ※ 로드 순서: data.js  →  (이 파일)  →  game.js
   ============================================================ */


/* 여기에 내가 쓴 사건을 추가합니다. (맨 아래 템플릿을 복사해서 붙여넣기) */
const NEW_SCENARIOS = {

    // ──────────────────────────────────────────────────────────
    // 탐정과 조수의 첫 만남 — 잃어버린 고양이를 찾으러 갔다가 던전에서 조수를 만난다.
    //   introStory        : 의뢰 수락 시        (시작)
    //   dungeonEnterStory : 던전 입구 발견 직후  (지하로 내려가는 순간)
    //   midStory          : 보스 방 진입 직후    (조수와의 첫 만남)
    //   outroStory        : 보스 클리어 직후     (조수 합류 / 사건 마무리)
    // ──────────────────────────────────────────────────────────
    "lost_cat_meeting": {
        title: "잃어버린 고양이",
        desc: "고양이를 찾아달라는 의뢰… 인데, 수상한 지하로 이어진다.",
        locations: ["골목 끝", "낡은 맨홀", "지하 통로"],
        boss: "boss_sewer_rat",            // 0일차 혼자 클리어용 약한 보스(거대 시궁쥐)
        enemyPool: ["괴물 쥐"],

        // ── 인트로 없음 ──
        //  의뢰인=집주인으로 통일. 의뢰 받는 장면은 프롤로그의 flashbackStory(회상)가 대신하므로
        //  1화 자체 인트로는 두지 않는다. (수락은 회상 종료 시 acceptMission으로 자동 처리)

        // ── 던전 입구 컷신: 던전을 처음 발견하고 막 들어설 때 (짧게) ──
        dungeonEnterStory: [
            { type: "bg",   src: "https://placehold.co/1200x800/1c1c22/9a9a9a?text=Old+Manhole", loc: "구시가지 · 낡은 맨홀" },
            { type: "char", id: "detective", src: "assets/standing/detective.png", pos: "left" },
            { type: "talk", id: "none", name: "", text: "(골목 끝, 낡은 맨홀. 발자국이 여기서 끊겼다.)" },
            { type: "talk", id: "none", name: "", text: "(아래에서 희미한 울음소리… 나비인가.)" },
            { type: "talk", id: "detective", name: "탐정", text: "…내려가 보는 수밖에." },
            { type: "end" }
        ],

        // ── 중간 컷신: 보스 방 진입 직후 (조수와의 첫 만남) ──
        midStory: [
            { type: "bg",   src: "https://placehold.co/1200x800/14141a/aa8855?text=Underground", loc: "지하 통로" },
            { type: "char", id: "detective", src: "assets/standing/detective.png", pos: "left" },
            { type: "talk", id: "none", name: "", text: "(여기가 가장 깊은 곳인가. 고양이 울음소리가 들린다.)" },

            { type: "char", id: "assistant", src: "assets/my_assistant.png", pos: "right" },
            { type: "talk", id: "assistant", name: "???", text: "거기 누구예요! …아, 사람이다. 다행이야." },
            { type: "talk", id: "none", name: "", text: "(웬 아이가 고양이 한 마리를 품에 꼭 안고 있다.)" },
            { type: "talk", id: "assistant", name: "???", text: "이 아이가 길을 잃었길래 지켜주고 있었어요. 그런데 저 안쪽에 뭔가 커다란 게…" },
            { type: "talk", id: "detective", name: "탐정", text: "뒤로 물러서 있어. 나비도, 저것도 — 내가 맡지." },
            { type: "end" }
        ],

        // ── 엔딩 컷신: 보스 클리어 직후 (조수 합류) ──
        outroStory: [
            { type: "bg",   src: "https://placehold.co/1200x800/1a1a22/cc9966?text=Aftermath", loc: "지하 통로" },
            { type: "char", id: "detective", src: "assets/standing/detective.png", pos: "left" },
            { type: "char", id: "assistant", src: "assets/my_assistant.png", pos: "right" },

            { type: "talk", id: "none", name: "", text: "(가까스로 정리했다. 둘 다 무사하군.)" },
            { type: "talk", id: "assistant", name: "조수", text: "굉장해요! 저… 그쪽 같은 사람 옆에서 일을 배우고 싶어요." },
            { type: "talk", id: "detective", name: "탐정", text: "위험한 일인데. …뭐, 손이 부족하긴 했지." },
            { type: "talk", id: "assistant", name: "조수", text: "잘 부탁드려요, 탐정님!" },
            { type: "talk", id: "none", name: "", text: "(이렇게 나의 조수와의 첫 사건이 끝났다. 나비도 무사히 주인 품으로.)" },
            { type: "end" }
        ],

        // ── 던전 구성 ──
        dungeon: {
            width: 5, height: 5,
            roomCount: 10,
            data: { battle: 3, investigate: 3, event: 1, treasure: 1, heal: 1 }
        },

        clueEvents: [
            { text: "고양이 발자국이 맨홀 안쪽으로 이어진다.", gain: 20 },
            { text: "뜯어먹은 사료 봉지를 발견했다.", gain: 20 },
            { text: "작은 방울이 달린 목걸이를 주웠다. 나비의 것이다.", gain: 25 }
        ],

        reward: { gold: 800, xp: 150, itemRank: 1 },
        canRetreat: true
    }

};


/* 사건의 노출 조건(잠금)을 여기에 적습니다. (선택 사항) */
const NEW_SCENARIO_RULES = {

    // [1화] 메인 스토리 전용이므로 [사건 파일] 목록에 자유 의뢰로는 뜨지 않게 한다.
    //  - requires의 "__main_story_only__"는 일부러 '절대 세우지 않는 플래그'라, 수락 전엔 목록에서 숨겨진다.
    //  - 단, 의뢰를 수락(active)하면 진행 중으로 표시되고, 클리어하면 해결된 사건 탭으로 간다(hideAfterClear).
    lost_cat_meeting: {
        requiredFlags: ["__main_story_only__"],
        hideAfterClear: true
    }

};


/* ↓↓↓ 아래 두 줄은 위 내용을 게임에 합쳐주는 장치입니다. 건드리지 마세요. ↓↓↓ */
if (typeof SCENARIOS !== 'undefined') Object.assign(SCENARIOS, NEW_SCENARIOS);
if (typeof SCENARIO_RULES !== 'undefined') Object.assign(SCENARIO_RULES, NEW_SCENARIO_RULES);


/* ============================================================
   [메인 스토리] 직업별 주인공 스토리 정의
   - 스토리 모드를 시작하면 해당 직업의 prologue(악몽 컷신) → prologueBattle(튜토리얼
     전투) → wakeStory(기상 컷신)가 재생되고, 이후 사무소에서 [문]을 누르면 episode1이
     진행된다.
   - 지금은 detective(탐정)만 채워져 있다. 다른 직업의 스토리를 추가하려면 같은 형식으로
     아래에 직업 키를 늘리면 된다. (해당 직업 스토리가 없으면 일반 진행)
   ============================================================ */
const MAIN_STORY = {
    detective: {
        job: "detective",
        episode1: "lost_cat_meeting",     // [문]을 눌렀을 때 진행되는 스토리 1화

        // [프롤로그] 게임 시작 직후 재생되는 악몽 컷신 — 교주(양어머니)와의 대화
        prologue: [
            { type: "bg",   src: "https://placehold.co/1200x800/0d0a12/3a2a45?text=Nightmare", loc: "기억 속" },
            { type: "char", id: "mother", src: "https://placehold.co/520x900/1a0d1a/7a3a7a?text=%E2%9C%9D", pos: "center" },

            { type: "talk", id: "none",   name: "",  text: "(또… 그 꿈이다.)" },
            { type: "talk", id: "mother", name: "양어머니", text: "돌아왔구나, 내 아이. 그 문을 열고 나가면 넌 아무것도 아니게 된단다." },
            { type: "talk", id: "none",   name: "나", text: "…난 더 이상 당신의 인형이 아니야." },

            { type: "choice", options: [
                { txt: "\"전부 끝내러 왔어.\"", goto: "defy" },
                { txt: "\"…어머니.\" (망설인다)", goto: "hesitate" }
            ]},

            { type: "label", name: "hesitate" },
            { type: "talk", id: "mother", name: "양어머니", text: "그래, 넌 약하지. 그 망설임이 널 영원히 이곳에 붙들어 둘 거야." },
            { type: "jump", goto: "clash" },

            { type: "label", name: "defy" },
            { type: "talk", id: "mother", name: "양어머니", text: "가소롭구나. 그 작은 의지로 날 넘어설 수 있을 것 같으냐?" },

            { type: "label", name: "clash" },
            { type: "talk", id: "mother", name: "양어머니", text: "오너라. 네 죄가 얼마나 무거운지, 몸에 새겨주마." },
            { type: "talk", id: "none",   name: "", text: "(피할 수 없다. — 맞선다.)" },
            { type: "end" }
        ],

        // [프롤로그 전투] 교주와의 튜토리얼 전투. 이길 수 없을 만큼 강하며,
        //   빈사에 몰리면 '최후의 의지' 카드가 주어져 그것으로 승리하게 된다.
        prologueBattle: { boss: "boss_mother" },

        // [기상 컷신] 악몽에서 깨어남 → 풀 일러스트(CG)로, 사무소에 처음 보는 소년이 죽어 있는
        //   장면을 목격한다. 주인공은 어젯밤 과음으로 어제 일을 기억하지 못한다.
        //   (이후 사무소 조사 → 어제의 회상 → 1화 연결은 추후 작업 예정)
        wakeStory: [
            { type: "bg", src: "https://placehold.co/1200x800/15131a/444444?text=Office+at+Night", loc: "영진 탐정 사무소" },
            { type: "talk", id: "none", name: "", text: "헉…! 헉…" },
            { type: "talk", id: "none", name: "", text: "(…또 그 악몽인가. 온몸이 식은땀으로 젖어 있다.)" },
            { type: "talk", id: "none", name: "", text: "(머리가 깨질 듯 아프다. 어젯밤… 대체 얼마나 마신 거야.)" },

            // [CG] 대사창을 숨긴 채 풀 일러스트를 보여주고, 한 번 클릭하면 대사창이 뜨며 진행된다.
            //  ※ src는 임시 placeholder입니다. 실제 일러스트가 준비되면 이 경로만 바꾸세요.
            { type: "cg", src: "https://placehold.co/1200x800/1c0e0e/d98c8c?text=Dead+Boy+(CG)" },
            { type: "talk", id: "none", name: "", text: "(……잠깐. 저게, 뭐야.)" },
            { type: "talk", id: "none", name: "", text: "(처음 보는 소년이… 내 사무소 바닥에 쓰러져 있다. 숨을, 쉬지 않는다.)" },
            { type: "talk", id: "none", name: "", text: "(어제 무슨 일이 있었던 거지. 과음한 탓에… 아무것도 기억나지 않는다.)" },
            { type: "cg", src: "" },   // CG 치우기 → 다시 사무소 배경/입상으로
            { type: "end" }
        ],

        // [회상] 사건 보드에서 '고양이 수색 의뢰' 단서를 완성하면 재생 → 끝나면 1화 인트로로 이어짐.
        flashbackStory: [
            { type: "talk", id: "none", name: "", text: "(큭…! 머리가… 깨질 듯이 아프다.)" },
            { type: "talk", id: "none", name: "", text: "(…맞아. 어제. 갑자기 집주인 할머니가 찾아왔었지.)" },
            { type: "bg",   src: "https://placehold.co/1200x800/3a3228/d9c9b0?text=Office+(Yesterday)", loc: "영진 탐정 사무소 · 어제" },
            { type: "char", id: "landlord", src: "https://placehold.co/480x900/2a2018/c9b89a?text=Landlord", pos: "right" },
            { type: "talk", id: "landlord", name: "집주인 할머니", text: "탐정 양반, 미안하지만 부탁 좀 들어주겠나?" },
            { type: "talk", id: "landlord", name: "집주인 할머니", text: "1층 카페 알바 아이가 돌보는 고양이가 사라졌다네. 좀 찾아봐 줘." },
            { type: "talk", id: "none", name: "", text: "(그래… 나는 분명, 그 의뢰를 받았다. 그리고 그 다음은—)" },
            { type: "end" }
        ],

        // [소년 조사] 사무소의 조사 포인트 [소년]을 누르면 재생. 풀 일러스트(CG) + 탐정의 고찰(역전재판식).
        //  끝나면 단서 [기억나지 않는 어제의 일]이 사건 보드에 추가된다. (대사는 임시)
        bodyInvestigateStory: [
            { type: "cg",   src: "https://placehold.co/1200x800/1c0e0e/d98c8c?text=Dead+Boy+(CG)" },
            { type: "talk", id: "none", name: "", text: "(난생 처음 보는 소년이다. 열대여섯이나 됐을까.)" },
            { type: "talk", id: "none", name: "", text: "(외상은 보이지 않아. 몸싸움을 한 흔적도… 없다.)" },
            { type: "talk", id: "none", name: "", text: "(그런데 어째서, 잠겨 있던 내 사무소 안에서 숨을 거둔 거지?)" },
            { type: "talk", id: "none", name: "", text: "(…큭. 머리가 깨질 듯 아프다. 어제의 기억이 통째로 비어 있다.)" },
            { type: "cg",   src: "" },
            { type: "end" }
        ],

        // [외출 독백] 회상(1화) 중 처음 [문]을 눌러 사무소를 나설 때 1회 재생.
        goOutStory: [
            { type: "talk", id: "none", name: "", text: "(그래, 고양이를 찾으러 일단 사무소를 나섰었다.)" },
            { type: "end" }
        ]
    }
    // 예) fixer: { job:"fixer", episode1:"...", prologue:[...], ... }
};


/* ============================================================
   [사건 양식 / 템플릿]
   아래 블록을 복사해서 위의 NEW_SCENARIOS { } 안에 붙여넣고 고치세요.
   (이 부분은 주석이라 게임에 영향을 주지 않습니다.)
   ------------------------------------------------------------

    "my_first_case": {                       // 사건의 고유 별명(영문). 다른 사건과 겹치면 안 됩니다.
        title: "사건 제목",                   // [사건 파일] 목록에 보이는 제목
        desc: "한 줄 설명.",                  // 제목 아래 부제
        locations: ["장소1", "장소2"],        // 탐사 중 표시될 장소 이름(분위기용)
        boss: "boss_gang_leader",             // 마지막 보스(적 데이터의 별명). 잘 모르면 이대로 둬도 됩니다.

        // ── 도입부 스토리: 위에서 아래로 한 줄씩 재생됩니다 ──
        introStory: [
            { type: "bg",   src: "assets/bg/office.png", loc: "사무소" },                    // 배경(생략 가능). loc을 적으면 배경이 바뀔 때 장소명이 잠깐 표시됨
            // [CG/풀 일러스트] 대사창을 숨긴 채 그림을 보여주고, 한 번 클릭하면 대사창이 떠 진행됨.
            //   { type: "cg", src: "assets/cg/scene.png" },   // 일러스트 표시
            //   { type: "cg", src: "" },                       // 일러스트 치우기(다시 배경/입상)
            { type: "char", id: "client", src: "assets/standing/client.png", pos: "right" }, // 인물 등장 (pos: left / center / right)

            { type: "talk", id: "client", name: "의뢰인", text: "탐정님, 도와주세요." },
            { type: "talk", id: "none",   name: "",       text: "(무슨 사연일까...)" },      // 지문/속마음/효과음 등 '상황'은 name을 비우면("") 이름 라벨이 안 뜬다

            // 선택지: goto 에 적은 '이름표'로 점프합니다 (줄 번호를 셀 필요 없음!)
            { type: "choice", options: [
                { txt: "이야기를 듣는다", goto: "listen" },
                { txt: "일단 거절한다",   goto: "refuse" }
            ]},

            { type: "label", name: "listen" },                                  // ↓ "이야기를 듣는다"를 고르면 여기로
            { type: "talk", id: "client", name: "의뢰인", text: "사실은 말이죠..." },
            { type: "jump", goto: "merge" },                                     // refuse 부분을 건너뜀

            { type: "label", name: "refuse" },                                  // ↓ "거절한다"를 고르면 여기로
            { type: "talk", id: "none", name: "나", text: "(그래도 의뢰는 받아야겠지.)" },

            { type: "label", name: "merge" },                                   // 두 갈래가 다시 합류하는 지점
            { type: "talk", id: "client", name: "의뢰인", text: "잘 부탁드립니다." },
            { type: "exit", id: "client" },                                     // 인물 퇴장
            { type: "end" }                                                     // 끝 → 의뢰가 자동 수락됩니다
        ],

        // (선택) 던전 입구 컷신 — 던전을 처음 발견해 막 들어설 때 1회 재생됩니다.
        // dungeonEnterStory: [
        //     { type: "talk", id: "none", name: "나", text: "(여기가 입구인가…)" },
        //     { type: "end" }
        // ],

        // (선택) 중간 컷신 — 보스 방에 진입한 직후 1회 재생됩니다. 형식은 introStory와 같습니다.
        // midStory: [
        //     { type: "talk", id: "none", name: "나", text: "(가장 깊은 곳에 다다랐다…)" },
        //     { type: "end" }
        // ],

        // (선택) 엔딩 컷신 — 보스를 쓰러뜨린 직후 1회 재생됩니다. 형식은 introStory와 같습니다.
        // outroStory: [
        //     { type: "talk", id: "none", name: "나", text: "(사건은 이렇게 마무리되었다.)" },
        //     { type: "end" }
        // ],

        // ── 던전 구성 ──
        dungeon: {
            width: 5, height: 5,     // 맵 크기
            roomCount: 12,           // 시작/보스방을 제외한 방 개수
            data: { battle: 4, investigate: 3, event: 2, shop: 1, treasure: 1, heal: 1 }
        },

        // ── 조사방에서 단서를 찾을 때 나오는 문구 ──
        clueEvents: [
            { text: "수상한 메모를 발견했다.", gain: 15 },
            { text: "목격자의 증언을 확보했다.", gain: 20 }
        ],

        reward: { gold: 800, xp: 150, itemRank: 1 },   // 클리어 보상
        canRetreat: true                                // 도중에 도망 허용
    },

   ── (선택) 노출 조건은 NEW_SCENARIO_RULES { } 안에 같은 id 로 ──

    "my_first_case": {
        requiredScenariosCleared: ["tutorial"]   // 예) 튜토리얼을 깬 뒤에만 목록에 보임
    }

   ============================================================ */
