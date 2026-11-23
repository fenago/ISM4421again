Synthetic HN fixtures (shape per docs/02-03, written 2026-11-23; the sandbox cannot reach HN).
- topstories.json: 35 ids 50700001..50700035; newstories.json: 5 ids.
- item-<id>.json, one per top id. Missing item => HN returns literal `null` (item-50700008.json is `null`).
  - 50700001 story, entities in title (&amp; &#x27; &quot; &lt;), www. domain, unknown extra fields
  - 50700002 Ask HN (no url, text); 50700003 Show HN; 50700004 job with url ""
  - 50700005 poll (parts); 50700006 dead; 50700007 deleted; 50700008 null
  - 50700009 story with no title/score/by; 50700010 Tell HN; 50700011 Launch HN
  - 50700012 url + text both; 50700013 javascript: url; 50700014 type comment (must be dropped)
  - rest: plain link stories
