# 📘 Get Note Insight — v0

기간 내 Notion 메모를 수집하여 작성 패턴·키워드·감정·내용 흐름·다음 행동 리포트를 자동 생성하는 웹 분석 도구.

## 🧭 1. 프로젝트 개요

Get Note Insight는 사용자가 Notion DB에 기록한 메모들을 기간 단위로 수집하여 다음 항목을 분석하는 개인용 분석 도구입니다.

- **언제 메모를 많이 쓰는가?** (작성 패턴 분석)
- **어떤 내용을 가장 자주 기록하는가?** (키워드/주제 분석)
- **감정 흐름은 어떤가?** (positive → negative 변화)
- **전체 흐름은 어떤 스토리로 이어지는가?**
- **다음 행동으로 발전시킬 만한 아이디어는 무엇인가?**

### v0 목표

"입력값 → 단일 리포트(JSON) → 단일 화면 출력" 이 안정적으로 동작하는 End-to-End 파이프라인 확립

## 🧩 2. 기술 스택

- **Next.js** (App Router, TypeScript)
- **Tailwind CSS** (간단한 UI 스타일링)
- **react-heatmap-grid** (작성 시간 히트맵)
- **OpenAI API** (LLM 분석 – gpt-5-mini-2025-08-07)
- **Notion Data Source API** (2025-09-03)

## 🔐 3. 환경 변수 설정

루트에 `.env.local` 생성 후 아래 입력:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Notion Data Source API
NOTION_TOKEN=secret_xxx
NOTION_DATA_SOURCE_ID=xxxxxx  # 직접 제공 (권장)
# 또는
NOTION_DB_ID=xxxxxx  # data_source_id가 없을 때만 사용 (하위 호환성)
NOTION_VERSION=2025-09-03

# 메모 텍스트가 들어있는 Notion property 이름
PROPERTY_NAME=내용

# 선택 사항 (태그)
TAG_PROPERTY_NAME=태그

# 분석 옵션
MAX_NOTES=100
DEFAULT_PERIOD_DAYS=7

# 분석용 모델 (v0에서 고정)
# 사용 가능한 모델: gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-4
INSIGHT_MODEL=gpt-4o-mini
```

## 📅 4. 분석 기간 선택 (UI → API 규칙)

사용자는 두 방식 중 하나로 기간을 선택할 수 있습니다.

### ✔ 1) 최근 N일 프리셋

- 7일 / 14일 / 28일
- 오늘 포함 N일
- 예: 오늘 11/13, 최근 7일 → 11/7 ~ 11/13

### ✔ 2) 날짜 범위 지정

- 시작일 ~ 종료일
- inclusive
- 예: 11/01 ~ 11/10 → 11/01 00:00 ~ 11/10 23:59:59

### ✔ 우선순위

- `from` / `to`가 있으면 → `preset` 무시
- 둘 다 없으면 → `DEFAULT_PERIOD_DAYS` 사용

## 📥 5. Notion 데이터 수집

### Query 조건

- `created_time` 기준으로 `on_or_after` + `on_or_before`
- 메모 텍스트는 `PROPERTY_NAME` `rich_text[].plain_text` 조합
- 태그는 선택 사항
- 내용 비어 있으면 제외

### 반환 타입

```typescript
export type Note = {
  id: string;
  created: string;  // ISO
  dow: number;      // 1~7
  hour: number;     // 0~23
  text: string;
  tags?: string[];
};
```

## 🔧 6. 전처리

### 6-1. 작성 패턴 계산 (LLM 없이)

- 요일(dow)
- 시간(hour)
- 날짜별 count

### 6-2. LLM용 "슈퍼 텍스트" 생성

작성 시간 오름차순으로 정렬 후 아래와 같이 변환:

```
[2025-11-11 09:12][tags: 일상,육아]
오늘 히로와 아침 루틴...

[2025-11-11 13:45][tags: 프로젝트,개발]
Get Note Insight 구조 재정리...
```

### 6-3. Chunking (v0 기준)

- 문자 기준 6,000자 단위로 나눔
- token 계산 없음 (v1에서 고려)

## 🧠 7. LLM 분석 (OpenAI)

### ✔ 모델

`gpt-5-mini-2025-08-07`

(v0에서는 모델 선택 기능 없음)

### ✔ 분석하는 항목

1. **키워드 / 주제 5~10개**
   - `term`
   - `term` 설명(`desc`)

2. **감정 흐름**
   - 긍/부/중립 경향(`trend`)
   - 3~5줄 요약(`summary`)
   - -1 ~ +1 사이 `score`

3. **내용 흐름 요약** (전체 스토리 요약)

4. **다음 행동 3가지**
   - 실험 또는 Actionable Task

### ✔ LLM 요청 구조

각 chunk마다 보내는 구조:

**SYSTEM:**
```
You are a JSON-only analysis engine.
```

**USER:**
```
"아래는 기간 내 메모 내용입니다. JSON 형식으로 분석하세요."

--- chunk text ---
```

### ✔ LLM 응답 구조

```json
{
  "keywords": [
    { "term": "노션", "desc": "템플릿 실험과 구조 고민이 자주 등장함" }
  ],
  "sentiment": {
    "trend": "약간 긍정적",
    "summary": "최근 프로젝트 추진력이 증가...",
    "score": 0.15
  },
  "contentFlow": "지난 2주간 기록은 ...",
  "nextActions": [
    "아침 기록 시간대 실험",
    "반복 등장 패턴 1개 시도",
    "Memo → Task 변환 실험"
  ]
}
```

## 🔄 8. 결과 병합 로직

여러 chunk 결과를 아래 방식으로 통합:

- **키워드** → `term` 기준으로 merge 후 상위 10개
- **sentiment.score** → 평균
- **trend** → 가장 빈도가 높은 label
- **summary/contentFlow** → 3~5줄로 재통합
- **nextActions** → 중복 제거 후 3개 추출

## 📊 9. 최종 API 명세

### POST `/api/run`

#### Query parameters

- `preset=7|14|28`
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`

#### Responses

##### 📌 (A) 정상 분석 결과

```json
{
  "status": "success",
  "noteCount": 42,
  "pattern": {
    "heatmap": [
      {"dow": 1, "hour": 9, "count": 3}
    ],
    "dailyCount": [
      {"date": "2025-11-10", "count": 5}
    ]
  },
  "content": {
    "keywords": [...],
    "sentiment": {...},
    "contentFlow": "...",
    "nextActions": [...]
  }
}
```

##### 📌 (B) 기간 내 메모 없음

```json
{
  "status": "empty",
  "noteCount": 0,
  "message": "선택한 기간에 메모가 없습니다."
}
```

##### 📌 (C) 에러 응답

```json
{
  "status": "error",
  "type": "notion_auth" | "ai_failed" | "server_error",
  "message": "에러 메시지",
  "detail": "상세 정보 (optional)"
}
```

## 🛠 10. 오류 처리 기준 (v0)

UI에는 다음 네 가지 오류만 표시:

1. **노션 인증 오류**
   - "노션 인증 오류: 토큰 또는 DB 권한을 확인하세요."

2. **기간 내 메모 없음**
   - "선택한 기간에 메모가 없습니다."

3. **AI 요청 실패**
   - "AI 분석 요청에 실패했습니다. (rate-limit 또는 토큰 오류 가능)"

4. **기타 서버 오류**
   - "서버 오류가 발생했습니다. 로그를 확인해주세요."

📌 서버 콘솔에는 full error stack 출력 (디버깅용)

## 🖥 11. UI/UX 계획

### 11-1. 스타일링

- Tailwind CSS 사용

### 11-2. 로딩 상태

전체 화면 overlay:

```
(Spinner)
"분석 중입니다… 평균 5–15초 소요"
```

### 11-3. 히트맵

- react-heatmap-grid 사용

### 11-4. 페이지 구성

**상단**
- preset 버튼: [7일] [14일] [28일]
- DatePicker(시작~종료)
- "분석 실행" 버튼

**본문**
1. 패턴 분석
   - Heatmap
   - Daily count bar chart
2. 키워드 Top 10
3. 감정 분석 summary
4. ContentFlow (흐름 요약)
5. NextActions (3개 체크리스트)

## 📁 12. 프로젝트 구조 (파일트리)

```
project/
  app/
    page.tsx
    api/run/route.ts
  lib/
    types.ts
    notion.ts
    preprocess.ts
    analyze.ts
    localAnalysis.ts
    report.ts
  components/
    LoadingOverlay.tsx
    Heatmap.tsx
    DailyCountChart.tsx
```

## 📦 13. 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 🚀 14. v0 Scope (확정)

- Notion → 메모 수집
- 전처리 → chunk
- OpenAI 분석 (gpt-5-mini-2025-08-07)
- pattern(heatmap/daily) 계산
- 리포트 JSON 생성
- 단일 페이지 UI로 출력

## 🔮 15. v1 후보 로드맵 (미포함)

- 모델 선택 기능
- 임베딩 기반 유사노트 추천
- 캐시(Vercel KV)
- 계정 구분(yoyo/jojo)
- 에러 retry/backoff
- 더 정교한 키워드 clustering
- 모바일 UI 최적화

## 🎯 END

이 README는 Cursor가 즉시 작업 시작 가능한 수준의 공식 문서입니다.
