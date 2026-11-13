(() => {
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const validEvent = value => /^\d{6,12}$/.test(String(value ?? ''));
  function forNetworks(networks,{sport,eventId,includeEspn = false,allowEspn = true,espnWebUrl,espnWebLabel} = {}) {
    const matches = pattern => networks.some(name => pattern.test(name));
    const options = [];
    if (allowEspn && (includeEspn || matches(/^(ESPN(?:\+|\d+)?|ABC)$/i))) {
      const exact = validEvent(eventId);
      options.push({name:'ESPN',scope:exact ? 'game' : 'service',requiresApp:exact,
        // Published by ESPN's own Watch pages. This is an ESPN event ID,
        // never an NHL game ID or an inferred matchup identifier.
        appUrl:exact ? 'sportscenter://x-callback-url/showWatchStream?playGameID=' + eventId : 'https://www.espn.com/espn/apps/espn',
        webUrl:espnWebUrl || (exact ? 'https://www.espn.com/watch/player/_/eventCalendarId/' + eventId : 'https://www.espn.com/watch/'),
        webLabel:espnWebLabel || 'Watch on ESPN'});
    }
    if (sport === 'basketball' && matches(/^(NBC|Peacock|NBCSN)$/i)) options.push({
      name:'Peacock',scope:'service',appUrl:'https://www.peacocktv.com/watch/home',
      webUrl:'https://www.peacocktv.com/sports/nba',webLabel:'Open Peacock'
    });
    if (matches(/^Prime Video$/i)) options.push({
      name:'Prime Video',scope:'service',appUrl:'https://www.primevideo.com/',
      webUrl:'https://www.primevideo.com/sports',webLabel:'Open Prime Video'
    });
    if (sport === 'hockey' && matches(/^(TNT|TBS|truTV|HBO MAX)$/i)) options.push({
      name:'HBO Max',scope:'service',appUrl:'https://play.hbomax.com/',
      webUrl:'https://www.hbomax.com/sports/nhl',webLabel:'Open HBO Max'
    });
    return options;
  }
  function buttons(option,className = 'primary',{context = '',key = ''} = {}) {
    if (!option) return '';
    const anchor = (url,label,classes,app) => '<a class="' + escape(classes) + '" href="' + escape(url) +
      '" target="' + (app ? '_self' : '_blank') + '" rel="noopener"' + (app ? ' data-open-broadcast="true"' : '') +
      (key ? ' data-stream="' + escape(key + (app ? '-app' : '-web')) + '"' : '') +
      ' aria-label="' + escape(label + (context ? ': ' + context : '')) + '">' + escape(label) + ' <span aria-hidden="true">↗</span></a>';
    if (!appleMobile) return anchor(option.webUrl,option.webLabel,className,false);
    return anchor(option.appUrl,'Open ' + option.name + ' app',className,true) +
      anchor(option.webUrl,'Watch on web','broadcast-web soft-button control',false);
  }
  function note(options) {
    if (!appleMobile || !options.length) return '';
    const exact = options.some(option => option.requiresApp);
    const service = options.filter(option => option.scope === 'service').map(option => option.name).join(', ');
    return '<p class="broadcast-note">' + (exact ? 'The ESPN game button requires the ESPN app. ' : '') +
      (service ? escape(service) + ' opens the service; select this matchup there. ' : '') +
      'If an app doesn’t open, use Watch on web. Sign-in, subscriptions and location restrictions still apply.</p>';
  }
  window.gameDeskBroadcast = {appleMobile,forNetworks,buttons,note};
})();
