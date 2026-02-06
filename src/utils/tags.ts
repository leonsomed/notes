export const normalizeTag = (value: string) => value.trim().replace(/\s+/g, " ");

export const tagKey = (value: string) => normalizeTag(value).toLowerCase();
