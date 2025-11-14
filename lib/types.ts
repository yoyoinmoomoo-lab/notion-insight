// Notion 메모 타입
export type Note = {
  id: string;
  created: string; // ISO
  dow: number; // 1~7 (월~일)
  hour: number; // 0~23
  text: string; // PROPERTY_NAME text
  tags?: string[];
};

// 패턴 섹션
export type PatternSection = {
  heatmap: { dow: number; hour: number; count: number }[];
  dailyCount: { date: string; count: number }[];
};

// 콘텐츠 섹션
export type ContentSection = {
  keywords: { term: string; desc: string }[];
  sentiment: {
    trend: string;
    summary: string;
    score: number;
  };
  contentFlow: string;
  nextActions: string[];
};

// 성공 응답
export type AnalysisResult = {
  status: "success";
  noteCount: number;
  pattern: PatternSection;
  content: ContentSection;
};

// 빈 데이터 응답
export type EmptyResult = {
  status: "empty";
  noteCount: 0;
  message: string;
};

// 에러 응답
export type ErrorResult = {
  status: "error";
  type: "notion_auth" | "ai_failed" | "server_error";
  message: string;
  detail?: string;
};

// API 응답 유니온 타입
export type ApiResponse = AnalysisResult | EmptyResult | ErrorResult;

// LLM 분석 결과 (chunk 단위)
export type ChunkAnalysis = {
  keywords: { term: string; desc: string }[];
  sentiment: {
    trend: string;
    summary: string;
    score: number;
  };
  contentFlow: string;
  nextActions: string[];
};

