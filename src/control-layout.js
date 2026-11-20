(function () {
  const igvc = window.__igvc;
  const OBSTRUCTION_SELECTOR = [
    'article', '[role="dialog"]', '[role="listitem"]',
    'button', 'a', 'input', 'textarea', 'select', 'label',
    '[role="button"]', '[role="link"]', '[role="navigation"]',
    '[role="menuitem"]', '[contenteditable="true"]',
    'svg', 'img', 'picture', 'canvas', 'p', 'span', 'strong',
    'time', 'h1', 'h2', 'h3', 'h4', 'li'
  ].join(', ');

  function intersects(a, b, padding) {
    const pad = padding || 0;
    return a.left < b.right + pad && a.right > b.left - pad &&
      a.top < b.bottom + pad && a.bottom > b.top - pad;
  }

  function candidateRect(candidate) {
    return {
      left: candidate.left,
      top: candidate.top,
      right: candidate.left + candidate.width,
      bottom: candidate.top + igvc.BAR_HEIGHT,
    };
  }

  /**
   * Reject areas occupied by Instagram UI. The video rectangle alone isn't
   * enough: the like/share/save row and caption commonly sit right below it.
   * Fail closed if hit testing is unavailable, rather than hiding controls.
   */
  function isDockingAreaSafe(candidate, video, doc, extensionIframes) {
    if (!doc || typeof doc.elementsFromPoint !== 'function' || !video) return false;
    const target = candidateRect(candidate);
    const owner = typeof video.closest === 'function'
      ? video.closest('article, [role="dialog"], [role="listitem"]') : null;
    if (owner && typeof owner.getBoundingClientRect === 'function' &&
        intersects(target, owner.getBoundingClientRect(), 3)) return false;

    const ignored = new Set(extensionIframes || []);
    // Include edge and interior samples: a narrow row of Instagram buttons
    // must not be mistaken for whitespace between its icons.
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 11; col++) {
        const x = target.left + (target.right - target.left) * (col + 0.5) / 11;
        const y = target.top + (target.bottom - target.top) * (row + 0.5) / 3;
        const elements = doc.elementsFromPoint(x, y);
        if (!elements || elements.length === 0) return false;
        const top = elements.find(function (element) {
          return element && !ignored.has(element) &&
            !(element.dataset && element.dataset.igvcOverlay);
        });
        if (!top || typeof top.closest !== 'function') return false;
        if (top.closest(OBSTRUCTION_SELECTOR)) return false;
      }
    }
    return true;
  }

  // The page can have space in the *viewport* that is already taken by
  // Instagram's own interface. A dock candidate must also pass isSafe.
  function computeControlsPlacement(rect, viewportWidth, viewportHeight, isSafe) {
    const edge = 8;
    const gap = 6;
    const height = igvc.BAR_HEIGHT;
    const usableWidth = Math.max(1, viewportWidth - edge * 2);
    const preferredWidth = Math.min(usableWidth, Math.max(360, rect.width));
    const minimumWidth = Math.min(360, usableWidth);
    const centeredLeft = Math.max(
      edge,
      Math.min(rect.left + (rect.width - preferredWidth) / 2, viewportWidth - preferredWidth - edge),
    );
    const limitedTop = Math.max(edge, Math.min(rect.bottom - height, viewportHeight - height - edge));
    const accepts = typeof isSafe === 'function' ? isSafe : () => true;
    const candidates = [];

    if (rect.bottom + gap + height + edge <= viewportHeight) {
      candidates.push({ mode: 'docked', side: 'below', left: centeredLeft,
        top: rect.bottom + gap, width: preferredWidth });
    }
    if (rect.top - gap - height - edge >= 0) {
      candidates.push({ mode: 'docked', side: 'above', left: centeredLeft,
        top: rect.top - gap - height, width: preferredWidth });
    }

    const spaceRight = viewportWidth - rect.right - gap - edge;
    const spaceLeft = rect.left - gap - edge;
    if (spaceRight >= minimumWidth) {
      candidates.push({ mode: 'docked', side: 'right', left: rect.right + gap,
        top: limitedTop, width: Math.min(preferredWidth, spaceRight) });
    }
    if (spaceLeft >= minimumWidth) {
      const width = Math.min(preferredWidth, spaceLeft);
      candidates.push({ mode: 'docked', side: 'left', left: rect.left - gap - width,
        top: limitedTop, width });
    }

    for (const candidate of candidates) {
      if (accepts(candidate)) return candidate;
    }

    // No verified empty area around this video: never cover reaction buttons,
    // the caption, or another post with a permanently visible 42px bar.
    return {
      mode: 'compact', side: 'inside',
      left: centeredLeft, top: limitedTop, width: preferredWidth,
      launcherLeft: Math.max(edge, Math.min(rect.right - 42, viewportWidth - 44)),
      launcherTop: Math.max(edge, Math.min(rect.top + 8, viewportHeight - 40)),
    };
  }

  /**
   * Home feed: pin the playback bar within the *visible part of the video*.
   * Never dock in the side gutters or on the reaction row/caption below.
   * This is deliberately separate from the Reels/post positioning algorithm.
   * Returning null means too little of the video is visible for the full bar.
   */
  function computeFeedOverlayPlacement(rect, viewportWidth, viewportHeight) {
    const inset = 4;
    const left = Math.max(0, rect.left);
    const right = Math.min(viewportWidth, rect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(viewportHeight, rect.bottom);
    const width = right - left - inset * 2;
    if (width < 220 || bottom - top < igvc.BAR_HEIGHT + inset * 2) {
      return null;
    }
    return {
      mode: 'compact', side: 'inside',
      left: left + inset,
      top: bottom - igvc.BAR_HEIGHT - inset,
      width,
    };
  }

  igvc.computeControlsPlacement = computeControlsPlacement;
  igvc.computeFeedOverlayPlacement = computeFeedOverlayPlacement;
  igvc.isDockingAreaSafe = isDockingAreaSafe;
})();
