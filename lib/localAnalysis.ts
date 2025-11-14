import { Note, PatternSection } from "./types";

/**
 * 작성 시간 히트맵 데이터를 생성합니다.
 */
export function generateHeatmap(notes: Note[]): { dow: number; hour: number; count: number }[] {
  const map = new Map<string, number>();

  for (const note of notes) {
    const key = `${note.dow}-${note.hour}`;
    map.set(key, (map.get(key) || 0) + 1);
  }

  const heatmap: { dow: number; hour: number; count: number }[] = [];

  for (const [key, count] of map.entries()) {
    const [dow, hour] = key.split("-").map(Number);
    heatmap.push({ dow, hour, count });
  }

  return heatmap;
}

/**
 * 일자별 메모 개수를 계산합니다.
 */
export function generateDailyCount(notes: Note[]): { date: string; count: number }[] {
  const map = new Map<string, number>();

  for (const note of notes) {
    const date = new Date(note.created);
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    map.set(dateStr, (map.get(dateStr) || 0) + 1);
  }

  const dailyCount: { date: string; count: number }[] = [];

  for (const [date, count] of map.entries()) {
    dailyCount.push({ date, count });
  }

  // 날짜 순으로 정렬
  dailyCount.sort((a, b) => a.date.localeCompare(b.date));

  return dailyCount;
}

/**
 * 패턴 섹션을 생성합니다.
 */
export function generatePattern(notes: Note[]): PatternSection {
  return {
    heatmap: generateHeatmap(notes),
    dailyCount: generateDailyCount(notes),
  };
}

