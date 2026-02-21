import { describe, it, expect } from "vitest";
import { commitsDisagree } from "./sync.svelte.js";

describe("commitsDisagree", () => {
  it.each([
    // Unknown / undefined handling
    { expected: false, hash1: "unknown", hash2: "unknown", scenario: "both are unknown" },
    { expected: false, hash1: "unknown", hash2: "abc1234", scenario: "frontend is unknown" },
    { expected: false, hash1: "abc1234", hash2: "unknown", scenario: "server is unknown" },
    { expected: false, hash1: undefined, hash2: "abc1234", scenario: "first hash is undefined" },
    { expected: false, hash1: "abc1234", hash2: undefined, scenario: "second hash is undefined" },
    { expected: false, hash1: undefined, hash2: undefined, scenario: "both hashes are undefined" },

    // Empty strings
    { expected: false, hash1: "", hash2: "abc1234", scenario: "first hash is empty" },
    { expected: false, hash1: "abc1234", hash2: "", scenario: "second hash is empty" },
    { expected: false, hash1: "", hash2: "", scenario: "both hashes are empty" },

    // Matches
    { expected: false, hash1: "abc1234", hash2: "abc1234", scenario: "identical short hashes" },
    { expected: false, hash1: "abc1234", hash2: "abc1234def5678", scenario: "short matches full SHA prefix" },
    { expected: false, hash1: "abc1234aaaaaaaaaaaa", hash2: "abc1234aaaaaaaaaaaa", scenario: "identical full SHAs" },
    { expected: false, hash1: "abc12", hash2: "abc1234def5678", scenario: "short abbreviation matching prefix" },

    // Mismatches
    { expected: true, hash1: "abc1234", hash2: "def5678", scenario: "different hashes" },
    { expected: true, hash1: "abc1234aaaaaaaaaaaa", hash2: "def5678bbbbbbbbbbb", scenario: "full SHAs differ" },
    { expected: true, hash1: "abc1234aaaaaaaaaaaa", hash2: "abc1234bbbbbbbbbbb", scenario: "full SHAs share 7-char prefix" },
    { expected: true, hash1: "xyz99", hash2: "abc1234def5678", scenario: "short abbreviation not matching" },
  ])(
    "returns $expected when $scenario",
    ({ expected, hash1, hash2 }) => {
      expect(commitsDisagree(hash1, hash2)).toBe(expected);
    },
  );
});
