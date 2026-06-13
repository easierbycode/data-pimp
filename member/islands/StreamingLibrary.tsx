import { useMemo, useRef, useState } from "preact/hooks";
import {
  type Video,
  VIDEO_CATEGORIES,
  type VideoCategory,
  VIDEOS,
} from "./video-data.ts";
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, SearchIcon, XIcon } from "../components/icons.tsx";
import styles from "./StreamingLibrary.module.css";

interface StreamingLibraryProps {
  /** Optional override for the seed catalog — used for tests and fixtures. */
  initialVideos?: Video[];
}

/**
 * Port of `apps/web/modules/saas/content/components/streaming-library.tsx`
 * + `video-row.tsx`. Search runs locally over the stub catalog (the original
 * calls `orpcClient.content.videos.list` server-side); detail and player
 * modals are deferred — clicking a card no-ops for now.
 */
export default function StreamingLibrary(
  { initialVideos = VIDEOS }: StreamingLibraryProps,
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!activeSearch.trim()) return initialVideos;
    const q = activeSearch.trim().toLowerCase();
    return initialVideos.filter((v) =>
      v.title.toLowerCase().includes(q) ||
      v.description?.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q)
    );
  }, [initialVideos, activeSearch]);

  const byCategory = useMemo(() => {
    const map: Record<VideoCategory, Video[]> = {
      "Getting Started": [],
      "Advanced Strategies": [],
      "Case Studies": [],
      "Tools & Resources": [],
    };
    for (const v of filtered) {
      if (v.category in map) {
        map[v.category as VideoCategory].push(v);
      }
    }
    return map;
  }, [filtered]);

  function handleClear() {
    setSearchQuery("");
    setActiveSearch("");
    inputRef.current?.focus();
  }

  return (
    <>
      <form
        class={styles.searchForm}
        onSubmit={(e) => {
          e.preventDefault();
          setActiveSearch(searchQuery);
        }}
      >
        <div class={styles.searchRow}>
          <div class={styles.searchInputWrap}>
            <SearchIcon class={styles.searchIcon} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onInput={(e) =>
                setSearchQuery((e.target as HTMLInputElement).value)}
              class={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClear}
                class={styles.searchClear}
                aria-label="Clear search"
              >
                <XIcon class={styles.searchClearIcon} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!searchQuery.trim()}
            class={styles.searchSubmit}
          >
            Search
          </button>
        </div>
        {activeSearch && (
          <p class={styles.searchSummary}>
            Showing results for{" "}
            <span class={styles.searchTerm}>"{activeSearch}"</span> —{" "}
            <button
              type="button"
              onClick={handleClear}
              class={styles.searchClearLink}
            >
              clear
            </button>
          </p>
        )}
      </form>

      <div class={styles.rows}>
        {VIDEO_CATEGORIES.map((cat) => {
          const videos = byCategory[cat];
          if (videos.length === 0) return null;
          return <VideoRow key={cat} title={cat} videos={videos} />;
        })}
      </div>
    </>
  );
}

function VideoRow({ title, videos }: { title: string; videos: Video[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollTo({
      left: direction === "left"
        ? el.scrollLeft - amount
        : el.scrollLeft + amount,
      behavior: "smooth",
    });
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 0);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }

  return (
    <div class={styles.row}>
      <h2 class={styles.rowTitle}>{title}</h2>
      <div class={styles.rowScrollWrap}>
        {showLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            class={[styles.scrollBtn, styles.scrollBtnLeft].join(" ")}
            aria-label="Scroll left"
          >
            <span class={styles.scrollBtnInner}>
              <ChevronLeftIcon class={styles.scrollBtnIcon} />
            </span>
          </button>
        )}
        {showRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            class={[styles.scrollBtn, styles.scrollBtnRight].join(" ")}
            aria-label="Scroll right"
          >
            <span class={styles.scrollBtnInner}>
              <ChevronRightIcon class={styles.scrollBtnIcon} />
            </span>
          </button>
        )}
        <div ref={scrollRef} onScroll={handleScroll} class={styles.cards}>
          {videos.map((video) => <VideoCard key={video.id} video={video} />)}
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: Video }) {
  return (
    <button type="button" class={styles.card}>
      <div class={styles.thumbWrap}>
        <img
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
          class={styles.thumb}
        />
        {video.isMock && <span class={styles.mockBadge}>MOCK</span>}
        <span class={styles.durationBadge}>{video.duration}</span>
        <span class={styles.playOverlay}>
          <span class={styles.playBtn}>
            <PlayIcon class={styles.playIcon} />
          </span>
        </span>
      </div>
      <div class={styles.meta}>
        <h3 class={styles.cardTitle}>{video.title}</h3>
        <p class={styles.cardViews}>{video.views.toLocaleString()} views</p>
      </div>
    </button>
  );
}
