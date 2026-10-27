import { expect, test } from "vitest";
import { cardExtras, readCardFields } from "./card";

test("old excerpt payloads with only text still read", () => {
  expect(readCardFields({ text: "quoted" })).toEqual({
    text: "quoted",
    title: undefined,
    comment: undefined,
    color: undefined,
    tags: [],
    highlight: "fill",
    collapsed: false,
    asTitle: false,
  });
  expect(readCardFields(undefined).text).toBe("");
});

test("color, tags, title, comment, and collapse round-trip", () => {
  const fields = readCardFields({
    text: "body",
    title: " 标题 ",
    comment: "一条评论",
    color: 6,
    tags: ["不等式", " ", 3, "太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长"],
    highlight: "underline",
    collapsed: true,
    asTitle: true,
  });
  expect(fields.title).toBe("标题");
  expect(fields.comment).toBe("一条评论");
  expect(fields.color).toBe(6);
  expect(fields.tags).toEqual(["不等式"]);
  expect(fields.highlight).toBe("underline");
  expect(fields.collapsed).toBe(true);
  expect(fields.asTitle).toBe(true);
  expect(cardExtras(fields)).toMatchObject({
    title: "标题",
    comment: "一条评论",
    color: 6,
    tags: ["不等式"],
    highlight: "underline",
    collapsed: true,
    asTitle: true,
  });
});

test("out of range colors are ignored", () => {
  expect(readCardFields({ text: "x", color: 0 }).color).toBeUndefined();
  expect(readCardFields({ text: "x", color: 17 }).color).toBeUndefined();
});
