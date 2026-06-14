import { e as ensure_array_like, a as attr, d as derived } from "./index-CFTlFGQt.mjs";
import { p as VIDEOS, q as VIDEO_CATEGORIES } from "../server-entry.mjs";
import { e as escape_html } from "./escaping-ukrAy0Ul.mjs";
import "./utils-C1AuI3vl.mjs";
import "./base64-rR4j1CBY.mjs";
function VideoRow($$renderer, $$props) {
  let { title, videos } = $$props;
  $$renderer.push(`<div class="row svelte-d7pmp0"><h2 class="rowTitle svelte-d7pmp0">${escape_html(title)}</h2> <div class="rowScrollWrap svelte-d7pmp0">`);
  {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<button type="button" class="scrollBtn scrollBtnRight svelte-d7pmp0" aria-label="Scroll right"><span class="scrollBtnInner svelte-d7pmp0"><svg class="scrollBtnIcon svelte-d7pmp0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></span></button>`);
  }
  $$renderer.push(`<!--]--> <div class="cards svelte-d7pmp0"><!--[-->`);
  const each_array = ensure_array_like(videos);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let video = each_array[$$index];
    $$renderer.push(`<button type="button" class="card svelte-d7pmp0"><div class="thumbWrap svelte-d7pmp0"><img${attr("src", video.thumbnail)}${attr("alt", video.title)} loading="lazy" class="thumb svelte-d7pmp0"/> `);
    if (video.isMock) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<span class="mockBadge svelte-d7pmp0">MOCK</span>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--> <span class="durationBadge svelte-d7pmp0">${escape_html(video.duration)}</span> <span class="playOverlay svelte-d7pmp0"><span class="playBtn svelte-d7pmp0"><svg class="playIcon svelte-d7pmp0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg></span></span></div> <div class="meta svelte-d7pmp0"><h3 class="cardTitle svelte-d7pmp0">${escape_html(video.title)}</h3> <p class="cardViews svelte-d7pmp0">${escape_html(video.views.toLocaleString())} views</p></div></button>`);
  }
  $$renderer.push(`<!--]--></div></div></div>`);
}
function StreamingLibrary($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      initialVideos = VIDEOS
      /** Optional override for the seed catalog — used for tests and fixtures. */
      /** Optional override for the seed catalog — used for tests and fixtures. */
    } = $$props;
    let searchQuery = "";
    let activeSearch = "";
    const filtered = derived(() => {
      if (!activeSearch.trim()) return initialVideos;
      const q = activeSearch.trim().toLowerCase();
      return initialVideos.filter((v) => v.title.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q) || v.category.toLowerCase().includes(q));
    });
    const byCategory = derived(() => {
      const map = {
        "Getting Started": [],
        "Advanced Strategies": [],
        "Case Studies": [],
        "Tools & Resources": []
      };
      for (const v of filtered()) {
        if (v.category in map) {
          map[v.category].push(v);
        }
      }
      return map;
    });
    $$renderer2.push(`<form class="searchForm svelte-1pl8mra"><div class="searchRow svelte-1pl8mra"><div class="searchInputWrap svelte-1pl8mra"><svg class="searchIcon svelte-1pl8mra" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg> <input type="text" placeholder="Search courses..."${attr("value", searchQuery)} class="searchInput svelte-1pl8mra"/> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <button type="submit"${attr("disabled", !searchQuery.trim(), true)} class="searchSubmit svelte-1pl8mra">Search</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></form> <div class="rows svelte-1pl8mra"><!--[-->`);
    const each_array = ensure_array_like(VIDEO_CATEGORIES);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let cat = each_array[$$index];
      if (byCategory()[cat].length > 0) {
        $$renderer2.push("<!--[0-->");
        VideoRow($$renderer2, { title: cat, videos: byCategory()[cat] });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  StreamingLibrary as default
};
