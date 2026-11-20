(function () {
  const igvc = window.__igvc;
  const { BAR_HEIGHT, VOLUME_WIDTH, VOLUME_HEIGHT } = igvc;

  function createBarIframe() {
    const iframe = document.createElement("iframe");

    iframe.setAttribute("title", "Instagram Video Controls");
    iframe.dataset.igvcOverlay = "bar";
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowtransparency", "true");

    iframe.style.position = "fixed";
    iframe.style.left = "0px";
    iframe.style.top = "0px";
    iframe.style.width = "300px";
    iframe.style.height = `${BAR_HEIGHT}px`;
    iframe.style.border = "none";
    iframe.style.background = "transparent";
    iframe.style.backgroundColor = "transparent";
    iframe.style.zIndex = "2147483647";
    iframe.style.display = "none";
    iframe.style.opacity = "0";
    iframe.style.transform = "translateY(12px)";
    iframe.style.transition = "opacity 150ms ease, transform 150ms ease";
    iframe.style.pointerEvents = "none";

    document.documentElement.appendChild(iframe);

    const doc = iframe.contentDocument;

    doc.open();

    doc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />

          <style>
            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: 100% !important;
              overflow: hidden !important;
              background: transparent !important;
              font-family: Arial, sans-serif;
              
            }

            * {
              box-sizing: border-box;
            }

            .bar {
              width: 100%;
              height: 42px;
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 0 10px;
              color: white;
              background: rgba(0, 0, 0, 0.9);
              border-bottom: 1px solid rgba(255, 255, 255, 0.12);
              user-select: none;
            }

            button {
              border: none;
              outline: none;
              background: transparent;
              color: white;
              cursor: pointer;
              padding: 0;
              margin: 0;
              height: 32px;
              min-width: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 17px;
              font-weight: 700;
              opacity: 0.95;
              transition:
                transform 100ms ease,
                opacity 100ms ease;
            }

            button:hover {
              opacity: 1;
              transform: scale(1.08);
            }

            button:active {
              transform: scale(0.94);
            }

            .time {
              font-size: 13px;
              font-weight: 700;
              white-space: nowrap;
              font-variant-numeric: tabular-nums;
              min-width: 72px;
              color: white;
            }

            .seek {
              flex: 1;
              min-width: 80px;
              height: 4px;
              cursor: pointer;
              accent-color: white;
            }

            .right-controls {
              display: flex;
              align-items: center;
              gap: 10px;
              height: 100%;
            }

            .download-button {
              font-size: 16px;
            }

            .collapse-button {
              display: none;
              font-size: 16px;
            }

            .speed-select {
              width: 28px;
              height: 30px;
              border: none;
              outline: none;
              background: transparent;
              color: white;
              cursor: pointer;
              font-size: 18px;
              appearance: none;
              -webkit-appearance: none;
              text-align: center;
            }

            .speed-select option {
              color: black;
              font-size: 13px;
            }

            @media (max-width: 430px) {
              .download-button {
                display: none;
              }

              .time {
                min-width: 62px;
                font-size: 12px;
              }

              .bar {
                gap: 7px;
                padding: 0 8px;
              }

              .right-controls {
                gap: 7px;
              }

              .speed-select {
                width: 24px;
                font-size: 16px;
              }
            }
            /* Feed videos can be narrower than 360px. Keep the controls
               inside their iframe instead of spilling into the side column. */
            @media (max-width: 310px) {
              .bar { gap: 4px; padding: 0 5px; }
              .time { min-width: 53px; font-size: 11px; }
              .seek { min-width: 24px; }
              .right-controls { gap: 3px; }
              .speed-select { width: 22px; }
              .download-button { display: none; }
            }
          </style>
        </head>

        <body>
          <div class="bar">
            <button id="playButton" type="button" title="Play / Pause">▶</button>

            <span id="timeText" class="time">0:00 / 0:00</span>

            <input id="seekBar" class="seek" type="range" min="0" max="100" step="0.1" value="0" />

            <div class="right-controls">
              <button id="downloadButton" class="download-button" type="button" title="Download">⬇</button>

              <select id="speedSelect" class="speed-select" title="Speed">
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1" selected>⚙</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="1.75">1.75x</option>
                <option value="2">2x</option>
                <option value="3">3x</option>
                <option value="4">4x</option>
              </select>

              <button id="muteButton" type="button" title="Mute / Sound">🔊</button>
              <button id="collapseButton" class="collapse-button" type="button" title="Collapse controls">×</button>
            </div>
          </div>
        </body>
      </html>
    `);

    doc.close();

    return iframe;
  }

  function createVolumeIframe() {
    const iframe = document.createElement("iframe");

    iframe.setAttribute("title", "Instagram Volume Control");
    iframe.dataset.igvcOverlay = "volume";
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowtransparency", "true");

    iframe.style.position = "fixed";
    iframe.style.left = "0px";
    iframe.style.top = "0px";
    iframe.style.width = `${VOLUME_WIDTH}px`;
    iframe.style.height = `${VOLUME_HEIGHT}px`;
    iframe.style.border = "none";
    iframe.style.outline = "none";

    iframe.style.background = "rgba(0, 0, 0, 0.94)";
    iframe.style.backgroundColor = "rgba(0, 0, 0, 0.94)";
    iframe.style.borderRadius = "999px";

    iframe.style.zIndex = "2147483647";
    iframe.style.display = "none";
    iframe.style.opacity = "0";
    iframe.style.transform = "translateY(8px)";
    iframe.style.transition = "opacity 140ms ease, transform 140ms ease";
    iframe.style.pointerEvents = "none";

    document.documentElement.appendChild(iframe);

    const doc = iframe.contentDocument;

    doc.open();

    doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />

        <style>
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            background: rgba(0, 0, 0, 0.94) !important;
background-color: rgba(0, 0, 0, 0.94) !important;
            font-family: Arial, sans-serif;
          }

          * {
            box-sizing: border-box;
          }

          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .panel {
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.94);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 999px;
            box-shadow: 0 8px 18px rgba(0, 0, 0, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .volume {
            width: 70px;
            height: 4px;
            cursor: pointer;
            accent-color: white;
            transform: rotate(-90deg);
          }
        </style>
      </head>

      <body>
        <div class="panel">
          <input id="volumeSlider" class="volume" type="range" min="0" max="1" step="0.05" value="1" />
        </div>
      </body>
    </html>
  `);

    doc.close();

    return iframe;
  }

  function createCompactLauncherIframe() {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Show video controls");
    iframe.dataset.igvcOverlay = "launcher";
    iframe.setAttribute("frameborder", "0");
    iframe.style.position = "fixed";
    iframe.style.width = "34px";
    iframe.style.height = "30px";
    iframe.style.border = "none";
    iframe.style.borderRadius = "8px";
    iframe.style.zIndex = "2147483647";
    iframe.style.display = "none";
    iframe.style.opacity = "0";
    iframe.style.background = "transparent";
    iframe.style.pointerEvents = "none";
    iframe.style.transition = "opacity 120ms ease";
    document.documentElement.appendChild(iframe);

    const doc = iframe.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8" />
      <style>
        html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden;background:transparent}
        button{width:34px;height:30px;padding:0;border-radius:8px;
          border:1px solid rgba(255,255,255,.55);background:rgba(15,15,15,.82);
          color:white;font-size:23px;line-height:1;cursor:pointer}
        button:focus-visible{outline:2px solid white;outline-offset:-3px}
      </style></head><body>
      <button id="openControls" type="button" title="Show playback controls" aria-label="Show playback controls">☷</button>
      </body></html>`);
    doc.close();
    return iframe;
  }

  igvc.createCompactLauncherIframe = createCompactLauncherIframe;
  igvc.createBarIframe = createBarIframe;
  igvc.createVolumeIframe = createVolumeIframe;
})();
