(() => {
  if(window.audiobookAnalytics)return;
  const disabled=navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  const consentKey='ap_analytics_choice',lifetime=90*86400000;
  let choice=null;
  try{choice=JSON.parse(localStorage.getItem(consentKey));if(!choice||choice.expires<=Date.now())choice=null;}catch{}
  const clearId=()=>{document.cookie='ap_analytics=; Max-Age=0; Path=/; SameSite=Lax';};
  const existingId=()=>/(?:^|;\s*)ap_analytics=([a-f0-9]{32})(?:;|$)/.exec(document.cookie)?.[1];
  let visitor;
  if(disabled||choice?.allow!==true)clearId();
  const makeId=()=>{
    if(visitor)return visitor;
    visitor=existingId();
    if(!visitor){visitor=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
      document.cookie=`ap_analytics=${visitor}; Max-Age=${Math.max(0,Math.floor((choice.expires-Date.now())/1000))}; Path=/; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
    }
    // If storage is blocked, keep aggregate counts rather than inventing a new unique on each page.
    if(existingId()!==visitor)visitor=undefined;
    return visitor;
  };
  const source=()=>{
    try {const h=new URL(document.referrer).hostname;if(h===location.hostname)return 'internal';if(/(^|\.)google\.[a-z.]+$/.test(h))return 'google';if(/(^|\.)bing\.com$/.test(h))return 'bing';if(/(^|\.)duckduckgo\.com$/.test(h))return 'duckduckgo';if(/(^|\.)(facebook|instagram|reddit|t|x)\.com$/.test(h))return 'social';return 'other';}catch{return 'direct';}
  };
  window.audiobookAnalytics=(event,data={})=>{
    if(disabled)return;
    // Re-read preference so opting out in another tab or the navigation iframe takes effect.
    try{choice=JSON.parse(localStorage.getItem(consentKey));}catch{choice=null;}
    if(!choice||choice.expires<=Date.now()){choice=null;visitor=undefined;clearId();}
    else if(choice.allow!==true){visitor=undefined;clearId();}
    const pathname=data.path||location.pathname;
    const page=pathname.startsWith('/requests/')?'/requests':pathname;
    const body={event,path:page,book:data.book||(/^\/library\/[^/]+\/([^/]+)$/.exec(pathname)?.[1]||''),format:data.format,device:matchMedia('(max-width: 767px)').matches?'mobile':'desktop',source:source()};
    if(choice?.allow===true&&choice.expires>Date.now())body.visitor=makeId();
    fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,credentials:'omit'}).catch(()=>{});
  };
  window.audiobookAnalytics('page_view');
  function showChoice(force=false){
    if(disabled||(!force&&choice))return;
    document.getElementById('analytics-choice')?.remove();
    const box=document.createElement('aside');box.id='analytics-choice';box.className='analytics-choice';box.setAttribute('aria-label','Optional analytics');
    box.innerHTML='<p><strong>Help us improve Audiobook Project</strong><br>May we remember this browser for 90 days to count visitors and understand listening and downloads? No email or book content is linked. <a href="/privacy">Privacy</a></p><div><button type="button" data-choice="yes">Allow visitor analytics</button><button type="button" data-choice="no">No thanks</button></div>';
    box.addEventListener('click',e=>{const action=e.target.closest('[data-choice]');if(!action)return;
      choice={allow:action.dataset.choice==='yes',expires:Date.now()+lifetime};
      try{localStorage.setItem(consentKey,JSON.stringify(choice));}catch{choice={allow:false,expires:Date.now()+lifetime};}
      visitor=undefined;if(!choice.allow)clearId();else window.audiobookAnalytics('visitor_visit');box.remove();
    });document.body.append(box);
  }
  showChoice();
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-analytics-settings]')){event.preventDefault();showChoice(true);return;}
    const a=event.target.closest('a[href]');if(!a)return;
    try{const url=new URL(a.href,location.href);const format=/\.(m4b|mp3)$/i.exec(url.pathname)?.[1]?.toLowerCase();
      if(format)window.audiobookAnalytics('download_click',{format});
      else if(['podcast:','podcasts:','overcast:'].includes(url.protocol)||a.closest('.lib-podcast-panel'))window.audiobookAnalytics('podcast_open');
    }catch{}
  });
})();
