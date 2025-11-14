import { Note } from "./types";

const CHUNK_SIZE = 6000; // 문자 기준 6,000자

/**
 * Note 배열을 LLM 입력용 "슈퍼 텍스트"로 변환합니다.
 * 작성 시간 오름차순으로 정렬되어 있어야 합니다.
 */
export function makeSuperText(notes: Note[]): string {
  const lines: string[] = [];

  for (const note of notes) {
    const date = new Date(note.created);
    const dateStr = date.toISOString().slice(0, 16).replace("T", " ");

    let line = `[${dateStr}]`;
    if (note.tags && note.tags.length > 0) {
      line += `[tags: ${note.tags.join(",")}]`;
    }
    line += `\n${note.text}\n`;

    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * 텍스트를 6,000자 기준으로 chunk로 나눕니다.
 */
export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) {
    return [text];
  }

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    const chunk = text.slice(currentIndex, currentIndex + CHUNK_SIZE);
    chunks.push(chunk);
    currentIndex += CHUNK_SIZE;
  }

  return chunks;
}

