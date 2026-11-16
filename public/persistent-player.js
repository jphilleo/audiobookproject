(() => {
  const embedded = parent !== window && parent.location.origin === location.origin && parent.audiobookPlayer;
  if (embedded) document.documentElement.classList.add("lib-embedded");
  let frame;
  let dockObserver;
  let destination;

  function updateFrame() {
    const doc = frame.contentDocument;
    if (!doc?.body) return;
    document.title = doc.title;
    doc.documentElement.classList.add("lib-embedded");
    const chapterButtons = [...doc.querySelectorAll(".lib-chapters button[data-src]")];
    chapterButtons.forEach(button => {
      const active = button.dataset.src === window.audiobookPlayer.audio.getAttribute("src");
      button.toggleAttribute("aria-current", active);
      button.classList.toggle("playing", active && !window.audiobookPlayer.audio.paused);
    });
  }

  function fitDock() {
    document.documentElement.style.setProperty("--dock-height", window.audiobookPlayer.dock.getBoundingClientRect().height + "px");
  }

  window.openAudiobook = (doc, path, chapter) => {
    let player = window.audiobookPlayer;
    if (player.path !== path) {
      const sourceDock = doc.querySelector(".lib-player-dock");
      if (!sourceDock) { player.audio.pause(); return; }
      player.audio.pause();
      const scope = document.implementation.createHTMLDocument();
      scope.body.append(sourceDock.cloneNode(true));
      scope.body.append(doc.querySelector("main").cloneNode(true));
      player.dock.remove();
      const dock = scope.querySelector(".lib-player-dock");
      // Initialize against the isolated document before moving its audio element.
      player = window.initLibraryPlayer(scope, path);
      document.body.append(dock);
      window.audiobookPlayer = player;
      dockObserver.disconnect();
      dockObserver.observe(dock);
      fitDock();
    }
    player.play(chapter);
    updateFrame();
  };

  window.navigateWithAudiobook = (url, push = true) => {
    if (!frame) {
      frame = document.createElement("iframe");
      frame.className = "lib-site-frame";
      frame.title = "Audiobook Project";
      frame.addEventListener("load", updateFrame);
      document.body.append(frame);
      dockObserver = new ResizeObserver(fitDock);
      dockObserver.observe(window.audiobookPlayer.dock);
      fitDock();
      document.querySelectorAll("body > :not(.lib-player-dock):not(.lib-site-frame):not(script)").forEach(el => { el.hidden = true; });
    }
    destination = url;
    if (push) history.pushState({ audiobookNavigation: true }, "", url);
    frame.contentWindow.location.replace(url);
  };

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    const owner = embedded ? parent : window;
    if (!owner.audiobookPlayer || !link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || /\.[a-z0-9]+$/i.test(url.pathname) ||
        url.pathname.startsWith("/api/") ||
        (url.pathname === location.pathname && url.search === location.search && url.hash)) return;
    event.preventDefault();
    owner.navigateWithAudiobook(url.href);
  });
  addEventListener("popstate", () => {
    if (frame && destination !== location.href) window.navigateWithAudiobook(location.href, false);
  });
  document.addEventListener("play", () => {
    if (embedded) parent.audiobookPlayer.audio.pause();
    if (frame) updateFrame();
  }, true);
  document.addEventListener("pause", () => frame && updateFrame(), true);
})();
