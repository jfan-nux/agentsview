import { describe, it, expect } from "vitest";
import { commitsDisagree } from "./sync.svelte.js";

describe("commitsDisagree", () => {
  it.each([
    // Unknown / undefined handling
    [false, "unknown", "unknown", "both are unknown"],
    [false, "unknown", "abc1234", "frontend is unknown"],
    [false, "abc1234", "unknown", "server is unknown"],
    [false, undefined, "abc1234", "first hash is undefined"],
    [false, "abc1234", undefined, "second hash is undefined"],
    [false, undefined, undefined, "both hashes are undefined"],

    // Empty strings
    [false, "", "abc1234", "first hash is empty"],
    [false, "abc1234", "", "second hash is empty"],
    [false, "", "", "both hashes are empty"],

    // Matches
    [false, "abc1234", "abc1234", "identical short hashes"],
    [false, "abc1234", "abc1234def5678", "short matches full SHA prefix"],
    [false, "abc1234aaaaaaaaaaaa", "abc1234aaaaaaaaaaaa", "identical full SHAs"],
    [false, "abc12", "abc1234def5678", "short abbreviation matching prefix"],

    // Mismatches
    [true, "abc1234", "def5678", "different hashes"],
    [true, "abc1234aaaaaaaaaaaa", "def5678bbbbbbbbbbb", "full SHAs differ"],
    [true, "abc1234aaaaaaaaaaaa", "abc1234bbbbbbbbbbb", "full SHAs share 7-char prefix"],
    [true, "xyz99", "abc1234def5678", "short abbreviation not matching"],
  ] as const)(
    "returns %s when %s",
    (expected, hash1, hash2, _scenario) => {
      expect(commitsDisagree(hash1, hash2)).toBe(expected);
    },
  );
});
