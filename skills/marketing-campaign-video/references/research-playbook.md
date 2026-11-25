# Research Playbook (Phases 1–3)

## Contents
1. Product research sources
2. Where real problems live, by product type
3. Query patterns
4. Evidence rules
5. Timely hooks
6. Scoring the solution map

---

## 1. Product research sources

Check these in priority order and stop once the brief is complete:
1. **Local repo** (if you're in it): README, `/docs`, landing-page copy, `fastlane/metadata`, `store-listing`, i18n strings for feature names, pricing config.
2. **Official site**: home, features, pricing, FAQ, changelog/blog (shows what's new and what the team is proud of).
3. **App stores**: Google Play (`play.google.com/store/apps/details?id=...`) and Apple App Store pages. Note the description, rating, review count, "what's new", and 5 recent reviews (what users love = proof, what they complain about = honesty check).
4. **Third-party**: Product Hunt, G2/Capterra (B2B), press coverage, YouTube reviews.
5. **Competitors (2–3)**: their headline promise and pricing. You're looking for the gap the product fills.

Search queries: `"<product>" app`, `"<product>" review`, `"<product>" vs`, `"<product>" pricing`, `site:<domain> features`.

If the product has no web presence yet (pre-launch), the user's description is the source. Cite it as "user-provided" and keep every claim within it.

## 2. Where real problems live, by product type

| Product type | Best sources for live pain |
|---|---|
| Consumer mobile app | Reddit (topic subreddits + country subs), competitor 1–3★ app-store reviews, Quora, YouTube comments on "best X app" videos, X/Threads posts |
| B2B SaaS | G2/Capterra 1–3★ reviews of competitors, Reddit (r/smallbusiness, r/SaaS, r/sysadmin, role subs), Hacker News, LinkedIn posts, Stack Exchange |
| Fintech / payments | Reddit personal-finance subs (country-specific), app-store reviews, consumer complaint forums, regulator or news coverage |
| Health / fitness | Reddit fitness/nutrition subs, app reviews, forum threads (careful: no medical claims) |
| Education / edtech | Reddit student and parent subs, Quora, exam-season news, app reviews |
| Local services / D2C | Google Maps / Trustpilot reviews of competitors, local forums, Facebook groups (snippets only) |
| Non-English market | The same platforms in the local language plus regional forums. Search in that language too. |

Reddit and some review sites block automated fetching. If a fetch fails, rely on search snippets, try `old.reddit.com`, or move on. Don't retry the same blocked site.

## 3. Query patterns

Fill in `<task>` (the job the product does), `<category>`, `<competitor>`, `<audience>`, `<year>`. Run 6–12 of these in parallel in one turn, mixed across sources:

- `<task> reddit frustrated OR struggling OR "hate" <year>`
- `site:reddit.com "<task>" "anyone else"`
- `"is there an app that" <task>` · `"how do you" <task> reddit`
- `<competitor> review "1 star" OR "uninstalled" OR "waste"`
- `<competitor> app complaints <year>` · `<competitor> alternative reddit`
- `site:g2.com <competitor> "dislike"` (B2B)
- `<audience> biggest problem <task> <year>` · `<task> survey <year> statistics`
- `<category> news <month> <year>` (for timely hooks)
- Local language: the same intents in the market's language, e.g. Hindi or Hinglish for India

## 4. Evidence rules

- **Dated and sourced.** Every problem entry carries URL + date. Prefer the last 90 days, accept up to 12 months; older material is OK only for statistics, labeled "(older)".
- **Independent mentions.** Frequency = number of independent sources or threads, not upvotes on one post. A theme needs at least 2 independent mentions to rank.
- **Intensity (1–5).** 1 = mild annoyance, 3 = costs time or money regularly, 5 = emotional distress, lost money or job, or urgent workaround-seeking ("I'll pay anything").
- **Voice of customer.** Keep snippets ≤25 words, or paraphrase. They inform hooks and dialogue but don't appear verbatim in ads, and usernames never do.
- **Saturation.** Stop when 3 consecutive searches add no new theme. Note the themes you looked for but didn't find. That is useful negative evidence.

## 5. Timely hooks

Look for what makes a problem urgent this month. Typical triggers: seasons (exam season, tax deadline, festive sales, New Year resolutions, monsoon, back to school), news (price hikes, outages of a competitor, new regulations), and platform trends (a viral format or sound). Each hook needs a date, and keep it factual. Don't exploit tragedies or disasters.

## 6. Scoring the solution map

`Score = Pain (1–5) × Frequency (1–5) × Fit (0–5)`

- **Frequency scale:** 1 = 2 mentions, 2 = 3–4, 3 = 5–7, 4 = 8–12, 5 = 13+ or confirmed by a survey or statistic.
- **Fit:** 5 = a core feature directly removes the pain; 3 = it helps but partially; 1 = tangential; 0 = it doesn't solve it (drop it, however juicy).
- **Proof column:** the brief's source that shows the feature exists. Without proof, cap Fit at 2.
- **Ties:** prefer the problem with the clearest *visual* pain moment. Video sells what it can show.
