export const profiles = {
  yoyo: {
    notionToken: process.env.YOYO_NOTION_TOKEN!,
    notionDataSourceId: process.env.YOYO_NOTION_DATA_SOURCE_ID!,
    propertyName: process.env.YOYO_PROPERTY_NAME!,
    tagPropertyName: process.env.YOYO_TAG_PROPERTY_NAME,
  },
  jojo: {
    notionToken: process.env.JOJO_NOTION_TOKEN!,
    notionDataSourceId: process.env.JOJO_NOTION_DATA_SOURCE_ID!,
    propertyName: process.env.JOJO_PROPERTY_NAME!,
    tagPropertyName: process.env.JOJO_TAG_PROPERTY_NAME,
  },
} as const;

export type ProfileKey = keyof typeof profiles; // "yoyo" | "jojo"

