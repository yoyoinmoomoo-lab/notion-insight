import { ChunkAnalysis, ContentSection } from "./types";

/**
 * 여러 chunk 분석 결과를 병합합니다.
 */
export function mergeChunkResults(chunks: ChunkAnalysis[]): ContentSection {
  if (chunks.length === 0) {
    // 빈 결과 반환
    return {
      keywords: [],
      sentiment: {
        trend: "분석할 데이터가 없습니다.",
        summary: "",
        score: 0,
      },
      contentFlow: "",
      nextActions: [],
    };
  }

  if (chunks.length === 1) {
    // 단일 chunk는 그대로 반환 (하지만 키워드/nextActions 개수 조정)
    const chunk = chunks[0];
    return {
      keywords: chunk.keywords.slice(0, 10), // 최대 10개
      sentiment: chunk.sentiment,
      contentFlow: chunk.contentFlow,
      nextActions: chunk.nextActions.slice(0, 3), // 최대 3개
    };
  }

  // 여러 chunk 병합
  // 1. 키워드 병합 (term 기준으로 빈도 계산)
  const keywordMap = new Map<string, { term: string; desc: string; count: number }>();

  for (const chunk of chunks) {
    for (const kw of chunk.keywords) {
      const existing = keywordMap.get(kw.term);
      if (existing) {
        existing.count += 1;
        // desc는 더 긴 설명을 유지
        if (kw.desc.length > existing.desc.length) {
          existing.desc = kw.desc;
        }
      } else {
        keywordMap.set(kw.term, { ...kw, count: 1 });
      }
    }
  }

  // 빈도 기준으로 정렬 후 상위 10개
  const keywords = Array.from(keywordMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ term, desc }) => ({ term, desc }));

  // 2. 감정 병합
  const sentimentScores = chunks.map((c) => c.sentiment.score);
  const avgScore = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;

  // trend는 가장 빈도가 높은 label 선택 (간단히 평균 점수 기반으로 결정)
  let trend = "중립적";
  if (avgScore > 0.2) {
    trend = "긍정적";
  } else if (avgScore > 0.05) {
    trend = "약간 긍정적";
  } else if (avgScore < -0.2) {
    trend = "부정적";
  } else if (avgScore < -0.05) {
    trend = "약간 부정적";
  }

  // summary는 모든 chunk의 summary를 합쳐서 3~5줄로 요약
  const summaries = chunks.map((c) => c.sentiment.summary).filter((s) => s);
  const summary = summaries.length > 0
    ? summaries.join(" ") + (summaries.length > 1 ? " 전반적으로 여러 주제에 걸쳐 다양한 감정이 나타났습니다." : "")
    : "감정 분석 결과가 없습니다.";

  // 3. contentFlow 병합
  const flows = chunks.map((c) => c.contentFlow).filter((f) => f);
  const contentFlow = flows.length > 0
    ? flows.join(" ") + (flows.length > 1 ? " 전체적으로 시간에 따라 고민과 관심사가 변화하는 흐름이 보입니다." : "")
    : "내용 흐름 분석 결과가 없습니다.";

  // 4. nextActions 병합 (중복 제거 후 상위 3개)
  const actionSet = new Set<string>();
  for (const chunk of chunks) {
    for (const action of chunk.nextActions) {
      actionSet.add(action);
    }
  }
  const nextActions = Array.from(actionSet).slice(0, 3);

  return {
    keywords,
    sentiment: {
      trend,
      summary: summary.length > 400 ? summary.slice(0, 400) + "..." : summary,
      score: Math.round(avgScore * 100) / 100, // 소수점 2자리
    },
    contentFlow: contentFlow.length > 500 ? contentFlow.slice(0, 500) + "..." : contentFlow,
    nextActions,
  };
}

