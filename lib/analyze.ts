import OpenAI from "openai";
import { ChunkAnalysis } from "./types";

const INSIGHT_MODEL = process.env.INSIGHT_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a JSON-only analysis engine for Korean diary and memo text.

Your job:

- Input: a single text chunk that contains multiple memo entries.

  Each entry looks like:

    [YYYY-MM-DD HH:MM][tags: 태그1,태그2]

    실제 메모 내용...

- Output: ONE JSON object with the following exact schema:

  {
    "keywords": [
      { "term": string, "desc": string }
    ],
    "sentiment": {
      "trend": string,
      "summary": string,
      "score": number
    },
    "contentFlow": string,
    "nextActions": string[]
  }

Requirements:

1. Respond in KOREAN.

2. Return ONLY valid JSON. Do not include any explanation, markdown, or comments.

3. Field constraints:

   - "keywords":
     - 5~10개 항목.
     - 각 항목의 "term"은 1~5 단어 이내의 핵심 주제어.
     - "desc"는 1~2문장, 40~120자 정도로 해당 키워드가 어떤 맥락에서 자주 등장하는지 설명.

   - "sentiment":
     - "trend": 감정 경향을 한 줄 요약 (예: "약간 긍정적", "스트레스를 많이 느끼는 편").
     - "summary": 2~4문장으로 감정 흐름을 설명 (최대 400자).
     - "score": -1.0 ~ 1.0 사이 숫자. -1.0은 매우 부정적, 0은 중립, 1.0은 매우 긍정적.

   - "contentFlow":
     - 메모 전체의 흐름과 고민의 변화를 3~5문장으로 요약 (최대 500자).

   - "nextActions":
     - 배열 길이 3~5개.
     - 각 항목은 "바로 실행 가능한 행동 제안" 한 줄 (최대 120자).
     - 사용자의 실제 메모 내용을 기반으로 구체적인 실험/실천 아이디어를 제안할 것.

4. If the text chunk is short or repetitive, still follow the same JSON schema and provide the best possible analysis.

5. Never invent JSON fields that are not in the schema.`;

function getUserPrompt(chunkText: string): string {
  return `다음은 사용자가 특정 기간 동안 작성한 메모 일부입니다.

각 메모는 아래 형식으로 구성되어 있습니다:

[YYYY-MM-DD HH:MM][tags: 태그1,태그2]

메모 본문...

여러 개의 메모가 시간 순으로 이어져 있을 수 있습니다.

이 텍스트를 바탕으로, 이전에 설명한 JSON 스키마에 맞춰 분석해 주세요.

아래에 메모 텍스트를 제공합니다.

<<<MEMO_CHUNK_START>>>

${chunkText}

<<<MEMO_CHUNK_END>>>`;
}

/**
 * 단일 chunk를 분석합니다.
 */
export async function analyzeChunk(chunkText: string): Promise<ChunkAnalysis> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY must be set in environment variables");
  }

  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    timeout: 60000, // 60초 타임아웃
  });

  try {
    const response = await openai.chat.completions.create({
      model: INSIGHT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: getUserPrompt(chunkText) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // JSON 파싱
    const parsed = JSON.parse(content) as ChunkAnalysis;

    // 검증: 필수 필드 확인
    if (!parsed.keywords || !parsed.sentiment || !parsed.contentFlow || !parsed.nextActions) {
      throw new Error("Invalid response structure from OpenAI");
    }

    // score 범위 검증
    if (parsed.sentiment.score < -1 || parsed.sentiment.score > 1) {
      parsed.sentiment.score = Math.max(-1, Math.min(1, parsed.sentiment.score));
    }

    return parsed;
  } catch (error: any) {
    console.error("OpenAI API error details:", {
      status: error.status,
      code: error.code,
      message: error.message,
      model: INSIGHT_MODEL,
    });
    
    // OpenAI API 오류 처리
    if (error.status === 401 || error.status === 403) {
      throw new Error("AI_AUTH_ERROR");
    }
    if (error.status === 429) {
      throw new Error("AI_RATE_LIMIT_ERROR");
    }
    if (error.code === "model_not_found" || error.message?.includes("model")) {
      throw new Error(`AI_MODEL_ERROR: 모델을 찾을 수 없습니다. 모델명: ${INSIGHT_MODEL}`);
    }
    if (error.message?.includes("timeout") || error.message?.includes("timed out")) {
      throw new Error(`AI_TIMEOUT_ERROR: 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.`);
    }
    throw new Error(`AI_REQUEST_FAILED: ${error.message || error.code || "알 수 없는 오류"}`);
  }
}

/**
 * 여러 chunk를 순차적으로 분석합니다.
 */
export async function analyzeChunks(chunks: string[]): Promise<ChunkAnalysis[]> {
  const results: ChunkAnalysis[] = [];

  for (const chunk of chunks) {
    const result = await analyzeChunk(chunk);
    results.push(result);
  }

  return results;
}

