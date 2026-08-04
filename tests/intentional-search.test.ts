import { describe, expect, it } from "vitest";
import { selectorsForRoute } from "../lib/intentional-search";

describe("intentional search routes", () => {
  const config = {
    inputSelectors: ["input"],
    suggestionSelectors: ["[role=listbox]"],
    routeRules: [
      {
        paths: ["/explore"],
        selectors: ["[role=tablist]", "[role=region]"],
      },
      { paths: ["/search"], selectors: ["[role=tablist]"] },
    ],
  };

  it("keeps requested search results while hiding route-specific discovery", () => {
    expect(
      selectorsForRoute(config, new URL("https://x.com/explore")),
    ).toContain("[role=region]");
    expect(
      selectorsForRoute(config, new URL("https://x.com/search?q=typescript")),
    ).toEqual(["[role=tablist]"]);
    expect(selectorsForRoute(config, new URL("https://x.com/home"))).toEqual(
      [],
    );
  });
});
