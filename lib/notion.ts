import { Client } from "@notionhq/client";
import { Note } from "./types";

const NOTION_VERSION = process.env.NOTION_VERSION || "2025-09-03";
const MAX_NOTES = parseInt(process.env.MAX_NOTES || "100", 10);

interface FetchNotesParams {
  fromISO: string;
  toISO: string;
  notionToken: string;
  notionDbId?: string;
  notionDataSourceId?: string;
  propertyName: string;
  tagPropertyName?: string;
}

/**
 * Notion DB에서 메모를 가져옵니다.
 * @param params 파라미터 객체
 * @returns Note 배열
 */
export async function fetchNotes({
  fromISO,
  toISO,
  notionToken,
  notionDbId,
  notionDataSourceId,
  propertyName,
  tagPropertyName,
}: FetchNotesParams): Promise<Note[]> {
  if (!notionToken) {
    throw new Error("notionToken must be provided");
  }

  const notion = new Client({
    auth: notionToken,
  });

  try {
    // 종료일은 23:59:59까지 포함
    const toDate = new Date(toISO);
    toDate.setHours(23, 59, 59, 999);
    const toISOEnd = toDate.toISOString();

    // data_source_id가 파라미터로 제공되면 바로 사용
    let dataSourceId = notionDataSourceId;

    // data_source_id가 없으면 데이터베이스에서 조회
    if (!dataSourceId) {
      if (!notionDbId) {
        throw new Error("notionDataSourceId or notionDbId must be provided");
      }

      try {
        const database = await notion.databases.retrieve({
          database_id: notionDbId,
        });
        dataSourceId = (database as any).data_sources?.[0]?.id;
      } catch (retrieveError: any) {
        console.error("Database retrieve error:", retrieveError);
        if (retrieveError.code === "object_not_found" || retrieveError.message?.includes("Could not find database")) {
          throw new Error(`NOTION_DB_NOT_FOUND: 데이터베이스를 찾을 수 없습니다. DB ID를 확인해주세요: ${notionDbId.substring(0, 8)}...`);
        }
        throw retrieveError;
      }

      if (!dataSourceId) {
        // data_sources가 없는 경우, 기존 방식으로 시도
        console.warn("No data_sources found, trying direct database query...");
        return await fetchNotesLegacy(notion, notionDbId, fromISO, toISOEnd, propertyName, tagPropertyName);
      }
    }

    // Data Source API 사용 (2025-09-03 버전)
    // 참고: created_time 필터는 timestamp 필드를 사용
    const response = await (notion.dataSources as any).query({
      data_source_id: dataSourceId,
      filter: {
        and: [
          {
            timestamp: "created_time",
            created_time: {
              on_or_after: fromISO,
            },
          },
          {
            timestamp: "created_time",
            created_time: {
              on_or_before: toISOEnd,
            },
          },
        ],
      },
      sorts: [
        {
          timestamp: "created_time",
          direction: "ascending",
        },
      ],
      page_size: MAX_NOTES,
    });

    const notes: Note[] = [];

    for (const page of response.results) {
      if (!("properties" in page)) continue;

      // 텍스트 속성 추출
      const textProperty = page.properties[propertyName];
      if (!textProperty || textProperty.type !== "rich_text") continue;

      const richText = textProperty.rich_text;
      if (!richText || richText.length === 0) continue;

      // plain_text 합치기
      const text = richText.map((rt: any) => rt.plain_text || "").join("").trim();
      if (!text) continue; // 내용이 비어있으면 제외

      // 태그 속성 추출 (optional)
      let tags: string[] = [];
      if (tagPropertyName) {
        const tagProperty = page.properties[tagPropertyName];
        if (tagProperty) {
          if (tagProperty.type === "multi_select") {
            tags = tagProperty.multi_select.map((item: any) => item.name);
          } else if (tagProperty.type === "select" && tagProperty.select) {
            tags = [tagProperty.select.name];
          } else if (tagProperty.type === "rich_text") {
            // 텍스트 타입인 경우 comma split 또는 전체를 하나의 태그로
            const tagText = tagProperty.rich_text
              .map((rt: any) => rt.plain_text || "")
              .join("")
              .trim();
            if (tagText) {
              tags = tagText.includes(",") ? tagText.split(",").map((t: string) => t.trim()) : [tagText];
            }
          }
        }
      }

      // created_time 추출
      const createdTime = page.created_time;
      const createdDate = new Date(createdTime);

      // 요일 계산 (월=1, 일=7)
      const dow = createdDate.getDay() === 0 ? 7 : createdDate.getDay();
      const hour = createdDate.getHours();

      notes.push({
        id: page.id,
        created: createdTime,
        dow,
        hour,
        text,
        tags: tags.length > 0 ? tags : undefined,
      });
    }

    return notes;
  } catch (error: any) {
    console.error("Notion API error:", error);
    // Notion 인증 오류 체크
    if (error.code === "unauthorized" || error.status === 401) {
      throw new Error("NOTION_AUTH_ERROR");
    }
    // 데이터베이스 찾을 수 없음
    if (error.message?.includes("NOTION_DB_NOT_FOUND")) {
      throw error;
    }
    throw error;
  }
}

/**
 * 레거시 방식으로 메모 가져오기 (data_sources가 없는 경우)
 */
async function fetchNotesLegacy(
  notion: Client,
  databaseId: string,
  fromISO: string,
  toISOEnd: string,
  propertyName: string,
  tagPropertyName?: string
): Promise<Note[]> {

  // 기존 databases.query 방식 사용
  const response = await (notion.databases as any).query({
    database_id: databaseId,
    filter: {
      and: [
        {
          property: "created_time",
          created_time: {
            on_or_after: fromISO,
          },
        },
        {
          property: "created_time",
          created_time: {
            on_or_before: toISOEnd,
          },
        },
      ],
    },
    sorts: [
      {
        property: "created_time",
        direction: "ascending",
      },
    ],
    page_size: MAX_NOTES,
  });

  const notes: Note[] = [];

  for (const page of response.results) {
    if (!("properties" in page)) continue;

    // 텍스트 속성 추출
    const textProperty = page.properties[propertyName];
    if (!textProperty || textProperty.type !== "rich_text") continue;

    const richText = textProperty.rich_text;
    if (!richText || richText.length === 0) continue;

    // plain_text 합치기
    const text = richText.map((rt: any) => rt.plain_text || "").join("").trim();
    if (!text) continue;

    // 태그 속성 추출 (optional)
    let tags: string[] = [];
    if (tagPropertyName) {
      const tagProperty = page.properties[tagPropertyName];
      if (tagProperty) {
        if (tagProperty.type === "multi_select") {
          tags = tagProperty.multi_select.map((item: any) => item.name);
        } else if (tagProperty.type === "select" && tagProperty.select) {
          tags = [tagProperty.select.name];
        } else if (tagProperty.type === "rich_text") {
          // 텍스트 타입인 경우 comma split 또는 전체를 하나의 태그로
          const tagText = tagProperty.rich_text
            .map((rt: any) => rt.plain_text || "")
            .join("")
            .trim();
          if (tagText) {
            tags = tagText.includes(",") ? tagText.split(",").map((t: string) => t.trim()) : [tagText];
          }
        }
      }
    }

    // created_time 추출
    const createdTime = page.created_time;
    const createdDate = new Date(createdTime);

    // 요일 계산 (월=1, 일=7)
    const dow = createdDate.getDay() === 0 ? 7 : createdDate.getDay();
    const hour = createdDate.getHours();

    notes.push({
      id: page.id,
      created: createdTime,
      dow,
      hour,
      text,
      tags: tags.length > 0 ? tags : undefined,
    });
  }

  return notes;
}

