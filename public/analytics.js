(() => {
  if(window.audiobookAnalytics)return;
  const disabled=navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  const source=()=>{
    try {const h=new URL(document.referrer).hostname;if(h===location.hostname)return 'internal';if(/(^|\.)google\.[a-z.]+$/.test(h))return 'google';if(/(^|\.)bing\.com$/.test(h))return 'bing';if(/(^|\.)duckduckgo\.com$/.test(h))return 'duckduckgo';if(/(^|\.)(facebook|instagram|reddit|t|x)\.com$/.test(h))return 'social';return 'other';}catch{return 'direct';}
  };
  window.audiobookAnalytics=(event,data={})=>{
    if(disabled)return;
    const pathname=data.path||location.pathname;
    const page=pathname.startsWith('/requests/')?'/requests':pathname;
    const body={event,path:page,book:data.book||(/^\/library\/[^/]+\/([^/]+)$/.exec(pathname)?.[1]||''),format:data.format,device:matchMedia('(max-width: 767px)').matches?'mobile':'desktop',source:source()};
    // No cookies, storage IDs, form values, titles, query strings or private URLs.
    fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,credentials:'omit'}).catch(()=>{});
  };
  window.audiobookAnalytics('page_view');
  document.addEventListener('click',event=>{
    const a=event.target.closest('a[href]');if(!a)return;
    try{const url=new URL(a.href,location.href);const format=/\.(m4b|mp3)$/i.exec(url.pathname)?.[1]?.toLowerCase();
      if(format)window.audiobookAnalytics('download_click',{format});
      else if(['podcast:','podcasts:','overcast:'].includes(url.protocol)||a.closest('.lib-podcast-panel'))window.audiobookAnalytics('podcast_open');
    }catch{}
  });
})();
