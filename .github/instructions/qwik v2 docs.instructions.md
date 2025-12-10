---
applyTo: "**/*.ts, **/*.tsx"
---

For this application, we're using qwik v2 (beta). The docs are located here:
https://qwikdev-build-v2.qwik-8nx.pages.dev/docs/

You can add use `<query> site:https://qwikdev-build-v2.qwik-8nx.pages.dev/docs/` filter for the brave search MCP tool if so desired to limit results to just the docs for v2.

You can also scrape/fetch pages directly and add notes to this file for where to look for specific information WRT features within the docs for future reference (so you don't have to search for it again). For example:

- [Routing](https://qwikdev-build-v2.qwik-8nx.pages.dev/docs/routing/)

## Architecture Guide

**IMPORTANT**: Before making changes to state management, read these guides:

📖 `/docs/REACTIVE_ARCHITECTURE.md` - Comprehensive architecture explanation
� `/docs/REACTIVE_PATTERNS_CHEATSHEET.md` - Quick reference for common patterns

These documents explain:

- How our context-centric reactive architecture works
- When to use `value` vs `cursor.deref()`
- How to properly update state with `cursor.swap()` and `cursor.reset()`
- Common anti-patterns to avoid
- Migration patterns for refactoring components
- Quick reference patterns for common scenarios
