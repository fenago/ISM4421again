// Small crafted Algolia HN Search responses (no live calls). Shapes per docs/06.
export function makeAlgoliaState() {
  const comment = (id, author, text, children = [], t = 1764000500) =>
    ({ id, author, text, created_at_i: t, type: "comment", children });
  return {
    log: [],
    // /items/:id -> nested tree. Missing id => 404 like the real API.
    items: {
      50700001: {
        id: 50700001, type: "story", author: "pg", created_at_i: 1764000000, points: 512,
        title: "Why Rust &amp; Go: it&#x27;s &quot;fast&quot; &lt;3", url: "https://www.example.com/rust-go", text: null,
        children: [
          comment(9001, "alice", "First para<p>Second para with <a href=\"https://example.com/very/long/path?x=1\" rel=\"nofollow\">https://example.com/very/lo...</a> and it&#x27;s &gt; fine &amp; ok", [
            comment(9002, "Bob_MiXed", "nested <i>reply</i>"),
          ]),
          // deleted parent that still has a live reply: must render a placeholder AND the reply
          { id: 9003, author: null, text: null, created_at_i: 1764000600, type: "comment", children: [comment(9004, "carol", "reply under deleted")] },
          comment(9005, "mallory", "<script>window.__pwn=1</script><img src=x onerror=\"window.__pwn=2\"><a href=\"javascript:window.__pwn=3\">evil link</a><svg onload=\"window.__pwn=4\"></svg>safe tail"),
        ],
      },
      50700002: { id: 50700002, type: "story", author: "AskerX", created_at_i: 1763999400, points: 120, title: "Ask HN: What are you working on?", url: null, text: "Tell us.<p>Anything.", children: [] },
    },
    // search: returns hits; objectID is a STRING; points/num_comments/url may be null.
    search(query, endpoint, page) {
      const hits = page === 0 ? [
        { objectID: "50700001", title: "Why Rust &amp; Go: it&#x27;s &quot;fast&quot; &lt;3", url: "https://www.example.com/rust-go", author: "pg", points: 512, num_comments: 301, created_at_i: 1764000000 },
        { objectID: "50700002", title: "Ask HN: Rust or Zig?", url: null, author: "AskerX", points: null, num_comments: null, created_at_i: 1763999400 },
        { objectID: "50700003", title: "Entities &amp;lt;b&amp;gt; stay literal", url: "https://github.com/me/reader", author: "maker", points: 5, num_comments: 0, created_at_i: 1763999100 },
        { objectID: "50700099", title: "Rust " + (endpoint === "search_by_date" ? "NEWEST-FIRST" : "relevance"), url: "javascript:alert(1)", author: "bad", points: 1, num_comments: 0, created_at_i: 1763999000 },
      ] : [{ objectID: "50700004", title: "Rust page two", url: "https://p2.example/a", author: "p2", points: 2, num_comments: 1, created_at_i: 1763990000 }];
      return { hits, page, nbPages: 2, nbHits: 5, query };
    },
  };
}
