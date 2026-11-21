(() => {
  if(window.audiobookAnalytics)return;
  const disabled=navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  // Retire the previous optional browser identifier; never create a replacement.
  if(/(?:^|;\s*)ap_analytics=/.test(document.cookie||''))document.cookie='ap_analytics=; Max-Age=0; Path=/; SameSite=Lax';
  const excluded=()=>{try{const old=JSON.parse(localStorage.getItem('ap_analytics_choice'));return old?.allow===false&&old.expires>Date.now();}catch{return false;}};
  const source=()=>{
    try {const h=new URL(document.referrer).hostname;if(h===location.hostname)return 'internal';if(/(^|\.)google\.[a-z.]+$/.test(h))return 'google';if(/(^|\.)bing\.com$/.test(h))return 'bing';if(/(^|\.)duckduckgo\.com$/.test(h))return 'duckduckgo';if(/(^|\.)(facebook|instagram|reddit|t|x)\.com$/.test(h))return 'social';return 'other';}catch{return 'direct';}
  };
  window.audiobookAnalytics=(event,data={})=>{
    if(disabled)return;
    const pathname=data.path||location.pathname;
    const page=pathname.startsWith('/requests/')?'/requests':pathname;
    const body={event,path:page,book:data.book||(/^\/library\/[^/]+\/([^/]+)$/.exec(pathname)?.[1]||''),format:data.format,device:matchMedia('(max-width: 767px)').matches?'mobile':'desktop',source:source()};
    if(excluded())body.excludeVisitor=true;
    fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,credentials:'omit'}).catch(()=>{});
  };
  window.audiobookAnalytics('page_view');
  document.addEventListener('click',event=>{
    const a=event.target.closest('a[href]');if(!a)return;
    try{const url=new URL(a.href,location.href);const format=/\.(m4b|mp3)$/i.exec(url.pathname)?.[1]?.toLowerCase();
      if(format||(/^\/requests\/[a-f0-9]{64}\/download$/.test(url.pathname)&&url.origin===location.origin))window.audiobookAnalytics('download_click',{format});
      else if(['podcast:','podcasts:','overcast:'].includes(url.protocol)||a.closest('.lib-podcast-panel'))window.audiobookAnalytics('podcast_open');
    }catch{}
  });
})();
