# Enhanced Controls for Instagram — 1.1.5

Chrome / Chromium Manifest V3 extension.

## v1.1.5 — Playback controls over home feed videos

- On the Instagram **home feed** (`/`), the full playback toolbar now appears
  **inside the bottom of the video**, the same as the in-video Reels behavior.
- The toolbar never docks to the left or right of a home-feed post, and stays
  clear of the reaction row and caption immediately below the video.
- Respects the visible portion of partially scrolled videos and avoids
  displaying a bar when too little of the video is on-screen.
- The bar is open by default; **×** collapses it to **☷**, which reopens it.
- All previous Reels controls and Story background playback stay unchanged.

## v1.1.4 — Toolbar open by default

- Every newly selected video automatically displays its full control bar, even
  when only the compact (inside-video) location is available.
- Press **×** to close the toolbar. A small **☷** button remains on the video;
  press it to reopen the toolbar. Manual closing is respected until reopening.
- The `Show controls only on hover` option is now **off by default**. On upgrade,
  the previous hover-only setting is reset once; you can change it afterwards.
- The full bar still docks only in areas verified free of Instagram interface.
  When there is no safe external space, its expanded state overlays a portion
  of the video, never the separate reaction/caption region.
- All v1.1.1 features, including Story background playback, remain in place.

## What's new in v1.1.1

- **Instagram UI collision protection:** toolbar docking now checks whether the
  destination is actually unobstructed. It no longer treats any free space in
  the viewport as safe; post reaction buttons, like counts, captions, navigation,
  and other content are protected.
- **Earlier safe default (v1.1.1):** if no verified empty area existed, only a
  small launcher appeared. In v1.1.4 this behavior is overridden by the
  requested default-open preference.
- **No intrusive layout changes:** Instagram posts are not resized, moved, or
  padded to make space for the extension.
- **All v1.1.0 features retained, including background playback for Stories.**

## Earlier v1.1.0 improvements

- **Adaptive controls placement:** the 42px bar docks outside the video only when the destination is both large enough and verified not to contain Instagram UI.
- **Compact fallback:** when there is no room outside the video (for example, an edge-to-edge video), the full bar now starts expanded. Press `×` to reduce it to a small `☷` button. Click `×` on the bar to collapse again. This avoids persistently obscuring the video.
- **Story background playback:** supports the currently playing **video Story** when the page loses focus or the user switches tabs. No full playback bar is added to Stories.
- **Respects manual pauses:** a paused Story is not automatically restarted; on navigation to a new video Story, the previous Story is paused.
- **New setting:** *Background playback for Stories* (enabled by default). Both it and *Background playback* must be enabled.

## Install or update

1. Extract the ZIP.
2. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge).
3. Enable **Developer mode**.
4. Use **Load unpacked** and select the `Enhanced-Controls-for-Instagram` folder.
5. If an earlier unpacked copy is installed, replace/remove that version, then reload Instagram.
6. Open **Details → Extension options** to configure behavior.

## Limitations

- Instagram can change its internal Story player and page structure; actual integration should be checked against the current website.
- Background playback preserves the selected **video media** whenever possible; it does not force image Stories to advance, guarantee continuous progression through the Story playlist, or override browser tab freezing, OS suspension, or autoplay restrictions.
- When no external safe area exists, a default-open toolbar uses the bottom portion of the video. Closing it reduces the overlay to a small (34×30px) launcher. The original Instagram video dimensions are left unchanged.

## Tests

Run `node tests/test.js` for placement/collision checks and mocked background-video/Story pause behavior. These tests do not simulate Instagram's private runtime.

## Privacy

No new permissions, analytics, or network requests were introduced.
