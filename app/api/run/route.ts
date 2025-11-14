import { NextRequest, NextResponse } from "next/server";
import { fetchNotes } from "@/lib/notion";
import { makeSuperText, chunkText } from "@/lib/preprocess";
import { analyzeChunks } from "@/lib/analyze";
import { generatePattern } from "@/lib/localAnalysis";
import { mergeChunkResults } from "@/lib/report";
import { ApiResponse } from "@/lib/types";
import { ProfileKey } from "@/config/profiles";

// 프로필 설정을 런타임에 읽기
function getProfile(profileKey: ProfileKey) {
  const envPrefix = profileKey.toUpperCase();
  return {
    notionToken: process.env[`${envPrefix}_NOTION_TOKEN`],
    notionDataSourceId: process.env[`${envPrefix}_NOTION_DATA_SOURCE_ID`],
    propertyName: process.env[`${envPrefix}_PROPERTY_NAME`],
    tagPropertyName: process.env[`${envPrefix}_TAG_PROPERTY_NAME`],
  };
}

const DEFAULT_PERIOD_DAYS = parseInt(process.env.DEFAULT_PERIOD_DAYS || "7", 10);

/**
 * 날짜 범위 계산
 */
function getDateRange(preset?: string, from?: string, to?: string): { fromISO: string; toISO: string } {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const toISO = to ? new Date(to + "T23:59:59.999Z").toISOString() : now.toISOString();

  let fromISO: string;

  if (from) {
    // from/to가 있으면 preset 무시
    fromISO = new Date(from + "T00:00:00.000Z").toISOString();
  } else if (preset) {
    // preset 사용
    const days = parseInt(preset, 10);
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - (days - 1)); // 오늘 포함
    fromDate.setHours(0, 0, 0, 0);
    fromISO = fromDate.toISOString();
  } else {
    // 기본값
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - (DEFAULT_PERIOD_DAYS - 1));
    fromDate.setHours(0, 0, 0, 0);
    fromISO = fromDate.toISOString();
  }

  return { fromISO, toISO };
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const preset = searchParams.get("preset");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const profileKey = (searchParams.get("profile") || "yoyo") as ProfileKey;

    // 프로필 설정 확인 (런타임에 환경 변수 읽기)
    const profile = getProfile(profileKey);
    
    // 디버깅: 환경 변수 확인 (프로덕션에서는 로그만 출력)
    console.log(`[Profile ${profileKey}] Env check:`, {
      hasToken: !!profile.notionToken,
      hasDataSourceId: !!profile.notionDataSourceId,
      hasPropertyName: !!profile.propertyName,
      envKeys: Object.keys(process.env).filter(k => k.includes(profileKey.toUpperCase())),
    });
    
    const missingFields: string[] = [];
    if (!profile.notionToken) missingFields.push("notionToken");
    if (!profile.notionDataSourceId) missingFields.push("notionDataSourceId");
    if (!profile.propertyName) missingFields.push("propertyName");
    
    if (missingFields.length > 0) {
      const response: ApiResponse = {
        status: "error",
        type: "server_error",
        message: `프로필 설정이 올바르지 않습니다. 서버 환경 변수를 확인하세요. (누락: ${missingFields.join(", ")})`,
        detail: `Profile: ${profileKey}, Missing: ${missingFields.join(", ")}, Env keys found: ${Object.keys(process.env).filter(k => k.includes(profileKey.toUpperCase())).join(", ")}`,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // 날짜 범위 계산
    const { fromISO, toISO } = getDateRange(preset || undefined, from || undefined, to || undefined);

    // Notion에서 메모 수집
    let notes;
    try {
      notes = await fetchNotes({
        fromISO,
        toISO,
        notionToken: profile.notionToken,
        notionDataSourceId: profile.notionDataSourceId,
        propertyName: profile.propertyName,
        tagPropertyName: profile.tagPropertyName,
      });
    } catch (error: any) {
      console.error("Notion API error:", error);
      if (error.message === "NOTION_AUTH_ERROR") {
        const response: ApiResponse = {
          status: "error",
          type: "notion_auth",
          message: "노션 인증 오류: 토큰 또는 DB 권한을 확인하세요.",
          detail: error.message,
        };
        return NextResponse.json(response, { status: 200 });
      }
      if (error.message?.includes("NOTION_DB_NOT_FOUND")) {
        const response: ApiResponse = {
          status: "error",
          type: "notion_auth",
          message: error.message.replace("NOTION_DB_NOT_FOUND: ", ""),
          detail: error.message,
        };
        return NextResponse.json(response, { status: 200 });
      }
      throw error;
    }

    // 빈 데이터 처리
    if (notes.length === 0) {
      const response: ApiResponse = {
        status: "empty",
        noteCount: 0,
        message: "선택한 기간에 메모가 없습니다.",
      };
      return NextResponse.json(response, { status: 200 });
    }

    // 패턴 분석 (로컬 계산)
    const pattern = generatePattern(notes);

    // LLM 분석
    let content;
    try {
      const superText = makeSuperText(notes);
      const chunks = chunkText(superText);
      const chunkResults = await analyzeChunks(chunks);
      content = mergeChunkResults(chunkResults);
    } catch (error: any) {
      console.error("AI analysis error:", error);
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes("AI_AUTH_ERROR")) {
        const response: ApiResponse = {
          status: "error",
          type: "ai_failed",
          message: "AI 분석 요청에 실패했습니다. OpenAI API 키를 확인해주세요.",
          detail: errorMessage,
        };
        return NextResponse.json(response, { status: 200 });
      }
      
      if (errorMessage.includes("AI_RATE_LIMIT_ERROR")) {
        const response: ApiResponse = {
          status: "error",
          type: "ai_failed",
          message: "AI 분석 요청에 실패했습니다. Rate limit에 도달했습니다. 잠시 후 다시 시도해주세요.",
          detail: errorMessage,
        };
        return NextResponse.json(response, { status: 200 });
      }
      
      if (errorMessage.includes("AI_MODEL_ERROR")) {
        const response: ApiResponse = {
          status: "error",
          type: "ai_failed",
          message: errorMessage.replace("AI_MODEL_ERROR: ", ""),
          detail: errorMessage,
        };
        return NextResponse.json(response, { status: 200 });
      }
      
      if (errorMessage.includes("AI_TIMEOUT_ERROR")) {
        const response: ApiResponse = {
          status: "error",
          type: "ai_failed",
          message: errorMessage.replace("AI_TIMEOUT_ERROR: ", ""),
          detail: errorMessage,
        };
        return NextResponse.json(response, { status: 200 });
      }
      
      if (errorMessage.includes("AI_REQUEST_FAILED")) {
        const response: ApiResponse = {
          status: "error",
          type: "ai_failed",
          message: errorMessage.replace("AI_REQUEST_FAILED: ", ""),
          detail: errorMessage,
        };
        return NextResponse.json(response, { status: 200 });
      }
      
      throw error;
    }

    // 성공 응답
    const response: ApiResponse = {
      status: "success",
      noteCount: notes.length,
      pattern,
      content,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Server error:", error);
    const response: ApiResponse = {
      status: "error",
      type: "server_error",
      message: "서버 오류가 발생했습니다. 로그를 확인해주세요.",
      detail: error.message || String(error),
    };
    return NextResponse.json(response, { status: 200 });
  }
}

// 타임아웃 설정 (60초)
export const maxDuration = 60;

