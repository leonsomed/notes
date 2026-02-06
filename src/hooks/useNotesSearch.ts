import { useMemo, useState } from "react";
import { normalizeTag, tagKey } from "../utils/tags";
import type { NoteDocument } from "../services/notesDb";

const normalizeSearchText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

const extractTextFromBlocks = (blocks: NoteDocument["content"]) => {
  if (!blocks) return "";
  const parts: string[] = [];

  const collectInlineText = (content: unknown) => {
    if (!Array.isArray(content)) return;
    content.forEach((item) => {
      if (typeof item === "string") {
        parts.push(item);
        return;
      }
      if (item && typeof item === "object") {
        const maybeText = (item as { text?: unknown }).text;
        if (typeof maybeText === "string") parts.push(maybeText);
        const nested = (item as { content?: unknown }).content;
        if (Array.isArray(nested)) collectInlineText(nested);
      }
    });
  };

  const walkBlocks = (items: NoteDocument["content"]) => {
    if (!items) return;
    items.forEach((block) => {
      if (!block || typeof block !== "object") return;
      const maybeContent = (block as { content?: unknown }).content;
      if (Array.isArray(maybeContent)) collectInlineText(maybeContent);
      const maybeChildren = (block as { children?: unknown }).children;
      if (Array.isArray(maybeChildren)) walkBlocks(maybeChildren);
    });
  };

  walkBlocks(blocks);
  return parts.join(" ");
};

const fuzzyScore = (query: string, text: string) => {
  if (!query || !text) return 0;
  if (text.includes(query)) {
    const lengthBonus = Math.min(30, Math.round((query.length / text.length) * 20));
    return 100 + lengthBonus;
  }
  let score = 0;
  let lastIndex = -1;
  let consecutive = 0;
  for (let i = 0; i < query.length; i += 1) {
    const nextIndex = text.indexOf(query[i], lastIndex + 1);
    if (nextIndex === -1) return 0;
    if (nextIndex === lastIndex + 1) {
      consecutive += 1;
      score += 5 + consecutive;
    } else {
      consecutive = 0;
      score += 2;
    }
    if (nextIndex === 0 || /[\s._-]/.test(text[nextIndex - 1])) {
      score += 3;
    }
    lastIndex = nextIndex;
  }
  return score;
};

const scoreDocument = (doc: NoteDocument, tokens: string[]) => {
  if (tokens.length === 0) return 0;
  const titleText = normalizeSearchText(doc.title);
  const tagsText = normalizeSearchText(doc.tags.join(" "));
  const contentText = normalizeSearchText(extractTextFromBlocks(doc.content));
  const fields = [
    { text: titleText, weight: 3 },
    { text: tagsText, weight: 2 },
    { text: contentText, weight: 1 },
  ];

  let score = 0;
  for (const token of tokens) {
    let bestTokenScore = 0;
    for (const field of fields) {
      const fieldScore = fuzzyScore(token, field.text);
      if (fieldScore > 0) {
        bestTokenScore = Math.max(bestTokenScore, fieldScore * field.weight);
      }
    }
    if (bestTokenScore === 0) return 0;
    score += bestTokenScore;
  }
  return score;
};

export function useNotesSearch(documents: NoteDocument[]) {
  const [searchQuery, setSearchQuery] = useState("");

  const tagSearchQuery = useMemo(() => {
    const trimmed = searchQuery.trim();
    const match = /^tag:\s*(.*)$/i.exec(trimmed);
    if (!match) return null;
    return normalizeTag(match[1]);
  }, [searchQuery]);

  const searchTokens = useMemo(() => {
    if (tagSearchQuery !== null) return [];
    const normalized = normalizeSearchText(searchQuery);
    if (!normalized) return [];
    return normalized.split(" ").filter(Boolean);
  }, [searchQuery, tagSearchQuery]);

  const filteredDocuments = useMemo(() => {
    if (tagSearchQuery !== null) {
      if (!tagSearchQuery) return [];
      const queryKey = tagKey(tagSearchQuery);
      return documents
        .filter((doc) => doc.tags.some((tag) => tagKey(tag) === queryKey))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }
    if (searchTokens.length === 0) {
      return [...documents].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return documents
      .map((doc) => ({ doc, score: scoreDocument(doc, searchTokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (
          new Date(b.doc.createdAt).getTime() -
          new Date(a.doc.createdAt).getTime()
        );
      })
      .map((entry) => entry.doc);
  }, [documents, searchTokens, tagSearchQuery]);

  const hasActiveSearch = searchTokens.length > 0 || tagSearchQuery !== null;

  return {
    filteredDocuments,
    hasActiveSearch,
    searchQuery,
    setSearchQuery,
  };
}
