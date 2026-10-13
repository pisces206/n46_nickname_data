(function () {
  'use strict';
  const C = window.NicknameCore, D = window.NicknameData, P = window.NicknamePage;
  if (!C || !D || !P) return;
  const records = C.decode(D), members = [...D.members].sort(C.memberCompare);
  const byName = new Map(members.map(member => [member.name, member]));
  const root = P.root || '', fmt = value => Number(value).toLocaleString('ja-JP');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const $ = id => document.getElementById(id);
  const pct = value => value == null ? '—' : Number(value).toFixed(1) + '%';
  const params = new URLSearchParams(location.search);
  const defaults = {year:'ALL', from:'', to:'', q:'', person:'', minPerson:'1', minTotal:'1', hideSingle:false,
    generation:'', status:'', collection:'', collectionMode:'total', data:'all', sort:'default', order:'desc', minimum:'20', metric:'total', page:'1', a:'', b:''};
  let state = {...defaults}, searchLimit = 18;
  function readState(restoreSaved = true) {
    let saved = {};
    const explicit = [...params.keys()].some(key => Object.hasOwn(defaults, key) || ['view','focus','s'].includes(key));
    if (!explicit && restoreSaved) {
      try { saved = JSON.parse(sessionStorage.getItem('nickname-v2:' + location.pathname) || '{}'); } catch (_) {}
    }
    const next = {...defaults, ...saved};
    for (const key of Object.keys(defaults)) {
      if (params.has(key)) next[key] = key === 'hideSingle' ? params.get(key) === '1' : params.get(key);
    }
    if (params.has('view') && !params.has('year')) next.year = params.get('view') || 'ALL';
    if (params.has('focus') && !params.has('person')) next.person = params.get('focus') || '';
    if (next.year !== 'ALL' && !D.years.includes(next.year)) next.year = 'ALL';
    if (next.from && next.to && next.from > next.to) [next.from,next.to] = [next.to,next.from];
    return next;
  }
  function syncURL(push = false) {
    const url = new URL(location.href);
    Object.keys(defaults).forEach(key => {
      const value = state[key];
      if (value === defaults[key] || value === '' || value === false) url.searchParams.delete(key);
      else url.searchParams.set(key, value === true ? '1' : value);
    });
    url.searchParams.delete('view'); url.searchParams.delete('focus');
    url.searchParams.set('s','1');
    if (url.href !== location.href) history[push ? 'pushState' : 'replaceState']({}, '', url);
    try { sessionStorage.setItem('nickname-v2:' + location.pathname, JSON.stringify(state)); } catch (_) {}
  }
  function href(path, values = {}) {
    const query = new URLSearchParams();
    Object.entries(values).forEach(([key,value]) => { if (value !== '' && value != null && value !== false && value !== 'ALL') query.set(key, value === true ? '1' : value); });
    query.set('v', P.version);
    query.set('s','1');
    return root + path + '?' + query;
  }
  function detailHref(name, mode, values = {}) {
    return href('data/' + (mode === 'received' ? '_received/reverse_' : '_calling/caller_') + encodeURIComponent(name) + '.html', values);
  }
  function memberLink(name, mode = 'received', values = {}) {
    return '<a href="' + esc(detailHref(name, mode, {year:state.year,from:state.from,to:state.to,...values})) + '">' + esc(name) + '</a>';
  }
  function compareHref(a, b) { return href('compare.html', {a,b,year:state.year,from:state.from,to:state.to}); }
  function badge(count) {
    const item = C.level(count,D.settings.collection_levels);
    return '<span class="badge ' + esc(item.class) + '">' + esc(item.label) + '</span>';
  }
  function option(value, text) { return '<option value="' + esc(value) + '">' + esc(text) + '</option>'; }
  function memberOptions(includeEmpty = true) {
    return (includeEmpty ? option('','全員') : '') + members.map(member => option(member.name,member.name + '（' + member.generation + '）')).join('');
  }
  function scopeText(extra = '') {
    const period = state.year !== 'ALL' ? state.year + '年' : state.from || state.to ? (state.from || '最初') + '〜' + (state.to || '最新') + '年' : '全期間';
    const quantity = ['listing','members'].includes(P.kind) && state.collection ? '収集量：' + state.collection : '';
    return [period,state.person,state.q ? '検索「' + state.q + '」' : '',state.generation,state.status,quantity,extra].filter(Boolean).join('／');
  }
  function cards(items) {
    return '<div class="summary-grid">' + items.map(([label,value,note]) =>
      '<div class="summary-item"><span>' + esc(label) + '</span><strong>' + value + '</strong>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</div>').join('') + '</div>';
  }
  function periodRows() { return records.filter(row => C.inPeriod(row,state)); }
  function selectedMembers() {
    return members.filter(member => (!state.generation || member.generation === state.generation) &&
      (!state.status || member.status === state.status) && (!state.q || C.memberScore(member,state.q) < Infinity));
  }
  function summaryFor(name, mode, rows = periodRows()) {
    return C.summary(rows.filter(row => row[mode === 'received' ? 'target' : 'caller'] === name),mode);
  }
  function pager(container, rows, render, key = 'page') {
    const size = 15, pages = Math.max(1,Math.ceil(rows.length/size));
    const current = Math.min(pages,Math.max(1,Number(state[key]) || 1)); state[key] = String(current);
    container.innerHTML = render(rows.slice((current-1)*size,current*size)) +
      '<div class="pager"><button type="button" data-page="' + (current-1) + '" ' + (current<=1?'disabled':'') + ' aria-label="前のページ">前へ</button>' +
      '<span>' + current + ' / ' + pages + 'ページ・全' + fmt(rows.length) + '件</span><button type="button" data-page="' + (current+1) + '" ' +
      (current>=pages?'disabled':'') + ' aria-label="次のページ">次へ</button></div>';
    container.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click',()=>{state[key]=button.dataset.page;syncURL(true);pager(container,rows,render,key);}));
  }
  function populateControls() {
    if ($('year')) $('year').innerHTML = option('ALL','全期間') + D.years.map(year => option(year, year + (year===String(D.currentYear)?'（途中の集計）':''))).join('');
    ['from','to'].forEach(id=>{if($(id)) $(id).innerHTML=option('','指定なし')+D.years.map(year=>option(year,year)).join('');});
    if ($('person')) $('person').innerHTML = memberOptions();
    if ($('generation')) $('generation').innerHTML=option('','全期')+[...new Set(members.map(member=>member.generation))].map(gen=>option(gen,gen)).join('');
    if ($('status')) $('status').innerHTML=option('','すべて')+[...new Set(members.map(member=>member.status))].map(status=>option(status,status)).join('');
    if ($('collection')) $('collection').innerHTML=option('','全収集量')+D.settings.collection_levels.map(level=>option(level.label,level.label)).join('');
    ['a','b'].forEach(id=>{if($(id)) $(id).innerHTML=option('','選んでください')+memberOptions(false);});
    for (const key of Object.keys(defaults)) {
      if (!$(key)) continue;
      if ($(key).type==='checkbox') $(key).checked=Boolean(state[key]); else $(key).value=state[key];
    }
    const legacyLabels = ['未入力','不足','参考','安定','充実'];
    if (legacyLabels.includes(state.collection)) {state.collection='';if($('collection'))$('collection').value='';}
    if (!['total','calling','received','receivedShare','partnerShare','uniformity'].includes(state.metric)) {
      state.metric='total';if($('metric'))$('metric').value='total';
    }
    if (!['total','calling','received'].includes(state.collectionMode)) {
      state.collectionMode='total';if($('collectionMode'))$('collectionMode').value='total';
    }
    updateSortControl();
  }
  function updateSortControl() {
    if (!$('sort') || !$('order')) return;
    if (state.sort==='default') {
      $('order').innerHTML=option(state.order,'期・あいうえお順（固定）');
      $('order').disabled=true;
      return;
    }
    const nameOrder=state.sort==='name';
    $('order').innerHTML=nameOrder ? option('asc','あ → ん')+option('desc','ん → あ') : option('desc','多い順')+option('asc','少ない順');
    $('order').value=state.order;
    $('order').disabled=false;
  }
  function bindControls() {
    Object.keys(defaults).forEach(key=>{
      const element=$(key);if(!element)return;
      const event=element.tagName==='INPUT'&&element.type!=='checkbox'?'input':'change';
      element.addEventListener(event,()=>{state[key]=element.type==='checkbox'?element.checked:element.value;
        if(key==='year'){state.from='';state.to='';}if(key==='from'||key==='to')state.year='ALL';if(key!=='page')state.page='1';
        if(key==='sort'){state.order=state.sort==='name'?'asc':'desc';updateSortControl();}
        searchLimit=18;syncURL(event==='change');render();
      });
    });
    $('clear-search')?.addEventListener('click',()=>{['q','person','minPerson','minTotal','hideSingle','generation','status','collection','data'].forEach(key=>state[key]=defaults[key]);state.page='1';populateControls();syncURL(true);render();});
    $('all-period')?.addEventListener('click',()=>{state.year='ALL';state.from='';state.to='';state.page='1';populateControls();syncURL(true);render();});
    $('reset-all')?.addEventListener('click',()=>{state={...defaults,a:state.a,b:state.b};populateControls();syncURL(true);render();});
    $('swap')?.addEventListener('click',()=>{[state.a,state.b]=[state.b,state.a];populateControls();syncURL(true);render();});
    $('more-search')?.addEventListener('click',()=>{searchLimit+=18;renderHome();});
  }
  function renderDetail() {
    const mode=P.mode,name=P.member, rows=C.detailRecords(records,name,mode,state,members), s=C.summary(rows,mode);
    $('scope').textContent=scopeText()+'／'+fmt(s.count)+'回（表示対象の記録）';
    $('summary').innerHTML=cards([
      ['合計回数',fmt(s.count)+'回'],
      [mode==='received'?'呼称種類数':'相手別呼称種類数',fmt(s.types)+'種',mode==='received'?'呼び名表記の種類':'相手×呼び名の種類'],
      [mode==='received'?'確認できた呼ぶ人':'確認できた相手',fmt(s.partners)+'人'],
      ['最多呼び名',s.topNames.length?esc(s.topNames.join('・'))+' <em>'+s.topCount+'回</em>':'—','同率はすべて表示'],
      [mode==='received'?'最多呼び名の割合':'最多相手',mode==='received'?pct(s.topShare):esc(s.topPartners.join('・')||'—')+' <em>'+(s.partnerCount||0)+'回</em>'],
      ['収集量の目安',badge(s.count)]
    ]);
    const ownerKey=mode==='received'?'target':'caller';
    const all=records.filter(row=>row[ownerKey]===name), allSummary=C.summary(all,mode);
    $('reference').innerHTML='<summary>全期間・全員の参考値</summary><p>'+fmt(allSummary.count)+'回・'+allSummary.partners+'人・'+allSummary.types+'種</p>';
    $('year-buttons').innerHTML=[['ALL','全期間'],...D.years.map(year=>[year,year])].map(([year,label])=>{
      const count=C.sum(all.filter(row=>year==='ALL'||row.year===year));if(year!=='ALL'&&!count)return '';
      return '<button type="button" data-year="'+esc(year)+'" aria-pressed="'+(state.year===year)+'">'+esc(label)+' <small>'+fmt(count)+'回</small></button>';
    }).join('');
    $('year-buttons').querySelectorAll('[data-year]').forEach(button=>button.addEventListener('click',()=>{state.year=button.dataset.year;state.from='';state.to='';populateControls();syncURL(true);render();}));
    $('mode-links').innerHTML=['received','calling'].map(other=>'<a href="'+esc(detailHref(name,other,{year:state.year,from:state.from,to:state.to}))+'"'+(mode===other?' aria-current="page"':'')+'>'+(other==='received'?'呼ばれ方':'呼び方')+'</a>').join('');
    if(!rows.length){$('detail-results').innerHTML='<div class="empty-result">この条件では未収集です。使用しないことを意味しません。</div>';$('generation-jumps').innerHTML='';return;}
    if(mode==='received') renderReceived(rows,s); else renderCalling(rows,s);
  }
  function renderReceived(rows,s) {
    const byNick=C.groupBy(rows,row=>row.nickname);
    const periodRecords=records.filter(row=>row.target===P.member&&C.inPeriod(row,state));
    const personal=C.groupBy(periodRecords,row=>row.caller);
    const personalTop=new Map([...personal].map(([name,values])=>[name,C.summary(values).topNames]));
    const sorted=[...byNick].sort((a,b)=>C.sum(b[1])-C.sum(a[1])||a[0].localeCompare(b[0],'ja'));
    $('detail-results').innerHTML='<div class="table-scroll"><table class="received-table"><colgroup><col class="nickname-col"><col><col class="total-col"></colgroup><thead><tr><th>呼び名</th><th>呼んでいる人</th><th>合計回数</th></tr></thead><tbody>'+sorted.map(([nickname,values])=>{
      const total=C.sum(values), top=total===s.topCount;
      const callers=[...C.groupBy(values,row=>row.caller)].sort((a,b)=>C.sum(b[1])-C.sum(a[1])||C.memberCompare(byName.get(a[0]),byName.get(b[0])));
      const tokens=callers.map(([name,items])=>{
        const count=C.sum(items),category=count===1?'paren':personalTop.get(name)?.includes(nickname)?'max':'other';
        const text=category==='paren'?'（'+esc(name)+'）':esc(name)+' <b>'+count+'回</b>';
        const label=name+' '+count+'回／'+(category==='paren'?'1回のみ':category==='max'?'この人の最多呼び名':'2回以上・最多以外');
        return '<a class="caller-token badge-'+category+'" data-count="'+count+'" aria-label="'+esc(label)+'" href="'+
          esc(detailHref(name,'calling',{year:state.year,from:state.from,to:state.to,person:P.member,q:nickname}))+'">'+text+'</a>';
      }).join('');
      return '<tr class="'+(top?'top-row':total/s.count>=.2?'share-row':'')+'"><td class="nickname">'+esc(nickname)+
        (top?'<span class="mark-top">最多</span>':'')+'</td><td class="tokens">'+tokens+'</td><td class="total number">'+fmt(total)+'回 <small>'+pct(total/s.count*100)+'</small></td></tr>';
    }).join('')+'</tbody></table></div>';
    $('generation-jumps').innerHTML='';
  }
  function renderCalling(rows,s) {
    const targets=[...C.groupBy(rows,row=>row.target)].sort((a,b)=>C.memberCompare(byName.get(a[0]),byName.get(b[0])));
    const generations=C.groupBy(targets,entry=>byName.get(entry[0]).generation);
    $('detail-results').innerHTML=[...generations].map(([gen,entries],index)=>'<section class="generation" id="generation-'+index+'"><h2 class="gen-title">'+esc(gen)+'<small>'+entries.length+'人</small></h2><div class="target-grid">'+entries.map(([name,values])=>{
      const total=C.sum(values), stats=C.summary(values), nicks=[...C.groupBy(values,row=>row.nickname)].sort((a,b)=>C.sum(b[1])-C.sum(a[1])||a[0].localeCompare(b[0],'ja'));
      return '<article class="target-card"><div class="target-heading"><h3>'+memberLink(name,'received',{year:state.year,from:state.from,to:state.to,person:P.member})+'</h3><strong class="target-total">'+fmt(total)+'回</strong></div>'+
        '<div class="target-meta"><span>'+stats.types+'種</span><span>表示合計の'+pct(total/s.count*100)+'</span></div>'+
        '<table class="calling-table"><colgroup><col><col class="count-col"><col class="share-col"></colgroup><thead><tr><th>呼び名</th><th class="number">回数</th><th class="number" title="この相手への合計に占める割合">割合</th></tr></thead><tbody>'+nicks.map(([nickname,items])=>{
          const count=C.sum(items),top=stats.topNames.includes(nickname);
          return '<tr class="'+(top?'top-row':count/total>=.2?'share-row':'')+'"><td class="nickname">'+esc(nickname)+(top?'<span class="mark-top">最多</span>':'')+'</td><td class="number">'+fmt(count)+'回</td><td class="number">'+pct(count/total*100)+'</td></tr>';
        }).join('')+'</tbody></table></article>';
    }).join('')+'</div></section>').join('');
    $('generation-jumps').innerHTML=[...generations.keys()].map((gen,index)=>'<a href="#generation-'+index+'">'+esc(gen)+'</a>').join('');
  }
  function renderHome() {
    const q=state.q; const found=[];
    members.forEach(member=>{
      const memberScore=C.memberScore(member,q);
      const values=records.filter(row=>row.target===member.name);
      const matches=[...C.groupBy(values,row=>row.nickname)].filter(([nick])=>q&&C.normalize(nick).includes(C.normalize(q)));
      if(q&&(memberScore<Infinity||matches.length))found.push({member,matches,score:Math.min(memberScore,matches.some(([nick])=>C.normalize(nick)===C.normalize(q))?0:matches.length?4:Infinity)});
    });
    found.sort((a,b)=>a.score-b.score||C.memberCompare(a.member,b.member));
    $('search-count').textContent=q?found.length+'人に一致／'+Math.min(found.length,searchLimit)+'人を表示':'';
    $('search-results').innerHTML=found.slice(0,searchLimit).map(({member,matches})=>'<div class="search-result"><div><strong>'+esc(member.name)+'</strong> <small>'+esc(member.generation)+'</small><p>'+esc(member.reading)+
      (matches.length?'<br>'+matches.slice(0,5).map(([nickname,values])=>'<a href="'+esc(detailHref(member.name,'received',{q:nickname,year:'ALL'}))+'">'+esc(nickname)+' '+C.sum(values)+'回</a>').join('・')+(matches.length>5?' ほか'+(matches.length-5)+'種':''):'')+'</p></div><div class="actions"><a href="'+esc(detailHref(member.name,'received',{q:matches.length&&C.memberScore(member,q)===Infinity?q:'',year:'ALL'}))+'">呼ばれ方</a><a href="'+esc(detailHref(member.name,'calling',{year:'ALL'}))+'">呼び方</a><a href="'+esc(href('compare.html',{a:member.name}))+'">2人比較</a></div></div>').join('')||(q?'<p class="empty-result">該当なし</p>':'');
    $('more-search').hidden=found.length<=searchLimit;
    $('home-summary').innerHTML=cards([['登録メンバー',members.length+'人'],['観測回数の合計',fmt(C.sum(records))+'回'],['資料の記録年',esc(D.years[0]||'—')+'〜'+esc(D.years.at(-1)||'—')],['最終公開生成',esc(P.updated)]]);
    $('active-members').innerHTML=members.filter(member=>member.status==='現役').map(member=>'<div class="member-card"><strong>'+memberLink(member.name)+'</strong><div class="member-meta">'+esc(member.generation)+'</div><div class="actions"><a href="'+esc(detailHref(member.name,'received',{year:'ALL'}))+'">呼ばれ方</a><a href="'+esc(detailHref(member.name,'calling',{year:'ALL'}))+'">呼び方</a></div></div>').join('');
  }
  function memberMetrics() {
    const period=periodRows();
    const quantityMode=P.kind==='members'?state.collectionMode:P.mode==='calling'?'calling':'received';
    return selectedMembers().map(member=>{
      const received=summaryFor(member.name,'received',period), calling=summaryFor(member.name,'calling',period);
      return {member,received,calling,total:received.count+calling.count};
    }).filter(item=>(!state.collection||C.level(quantityMode==='total'?item.total:item[quantityMode].count,D.settings.collection_levels).label===state.collection)&&
      (state.data==='all'||(state.data==='has'&&item[P.mode==='calling'?'calling':'received'].count>0)||(state.data==='none'&&item[P.mode==='calling'?'calling':'received'].count===0)));
  }
  function renderMembers() {
    let items=memberMetrics();
    const metric=state.sort;
    if(metric==='name') items.sort((a,b)=>(state.order==='asc'?1:-1)*C.normalize(a.member.reading).localeCompare(C.normalize(b.member.reading),'ja')||C.memberCompare(a.member,b.member));
    else if(metric!=='default') items=C.rank(items,item=>metric==='calling'?item.calling.count:metric==='received'?item.received.count:item.total,state.order!=='asc');
    $('scope').textContent=scopeText()+'／表示'+items.length+'人・登録'+members.length+'人（0件を含む）';
    pager($('members-results'),items,part=>'<div class="table-scroll"><table class="wide"><thead><tr><th>名前・期・状態</th><th>関係する記録の合計</th><th>呼ぶ回数</th><th>呼ばれる回数</th><th>呼び方：相手／相手別呼称種類数／量</th><th>呼ばれ方：呼ぶ人／呼称種類数／量</th></tr></thead><tbody>'+part.map(item=>'<tr><td>'+memberLink(item.member.name)+'<small>'+esc(item.member.reading)+'<br>'+esc(item.member.generation)+'・'+esc(item.member.status)+'</small></td><td class="number">'+fmt(item.total)+'回</td><td>'+memberLink(item.member.name,'calling')+'<br>'+fmt(item.calling.count)+'回</td><td>'+fmt(item.received.count)+'回</td><td>'+item.calling.partners+'人／'+item.calling.types+'種<br>'+badge(item.calling.count)+'</td><td>'+item.received.partners+'人／'+item.received.types+'種<br>'+badge(item.received.count)+'</td></tr>').join('')+'</tbody></table></div>');
  }
  function renderListing() {
    const items=memberMetrics(), mode=P.mode;
    const groups=C.groupBy(items,item=>item.member.generation);
    $('scope').textContent=scopeText()+'／表示'+items.length+'人・登録'+members.length+'人';
    $('listing-results').innerHTML=[...groups].map(([gen,rows],index)=>{
      const registered=members.filter(member=>member.generation===gen).length;
      if(state.sort==='name') rows.sort((a,b)=>(state.order==='asc'?1:-1)*C.normalize(a.member.reading).localeCompare(C.normalize(b.member.reading),'ja'));
      else if(state.sort!=='default')rows=C.rank(rows,item=>state.sort==='calling'?item.calling.count:state.sort==='received'?item.received.count:item.total,state.order!=='asc');
      return '<section class="generation" id="generation-'+index+'"><h2 class="gen-title">'+esc(gen)+'<small>表示'+rows.length+'人／登録'+registered+'人</small></h2><div class="member-grid">'+rows.map(item=>{
        const s=item[mode], member=item.member;
        return '<article class="member-card listing-card"><div class="member-heading"><strong>'+memberLink(member.name,mode,{year:state.year,from:state.from,to:state.to})+'</strong>'+badge(s.count)+'</div><div class="member-meta">'+esc(member.reading)+'／'+esc(member.status)+'</div><dl class="member-stats"><div><dt>'+(mode==='received'?'呼ばれる回数':'呼ぶ回数')+'</dt><dd>'+fmt(s.count)+'<small>回</small></dd></div><div><dt>'+(mode==='received'?'呼ぶ人':'呼ばれる人')+'</dt><dd>'+s.partners+'<small>人</small></dd></div><div><dt>'+(mode==='received'?'呼称の種類':'相手別の呼称')+'</dt><dd>'+s.types+'<small>種</small></dd></div></dl><div class="actions"><a href="'+esc(detailHref(member.name,mode==='received'?'calling':'received',{year:state.year,from:state.from,to:state.to}))+'">'+(mode==='received'?'呼び方':'呼ばれ方')+'</a><a href="'+esc(href('compare.html',{a:member.name,year:state.year}))+'">2人比較</a></div></article>';
      }).join('')+'</div></section>';
    }).join('')||'<p class="empty-result">該当なし</p>';
    $('generation-jumps').innerHTML=[...groups.keys()].map((gen,index)=>'<a href="#generation-'+index+'">'+esc(gen)+'</a>').join('');
  }
  function renderCompare() {
    if(!state.a)state.a=members.find(member=>member.status==='現役')?.name||members[0].name;
    if(!state.b)state.b=members.find(member=>member.name!==state.a&&member.status==='現役')?.name||members.find(member=>member.name!==state.a)?.name;
    $('a').value=state.a;$('b').value=state.b;
    if(state.a===state.b){$('compare-results').innerHTML='<p class="empty-result">異なる2人を選んでください。</p>';return;}
    const allPairs=records.filter(row=>(row.caller===state.a&&row.target===state.b)||(row.caller===state.b&&row.target===state.a));
    const rows=allPairs.filter(row=>C.inPeriod(row,state));
    $('scope').textContent=scopeText()+'／'+state.a+' ↔ '+state.b+'／両方向 '+C.sum(rows)+'回';
    function direction(caller,target) {
      const values=rows.filter(row=>row.caller===caller),s=C.summary(values);
      return '<section class="compare-direction"><h2>'+esc(caller)+' → '+esc(target)+'</h2>'+cards([['方向の合計',s.count+'回'],['最多呼び名',s.topNames.length?esc(s.topNames.join('・'))+' '+s.topCount+'回':'—']])+
        (values.length?'<table><thead><tr><th>呼び名</th><th>回数</th><th>方向内の割合</th></tr></thead><tbody>'+[...C.groupBy(values,row=>row.nickname)].sort((a,b)=>C.sum(b[1])-C.sum(a[1])).map(([nickname,items])=>'<tr class="'+(s.topNames.includes(nickname)?'top-row':'')+'"><td>'+esc(nickname)+(s.topNames.includes(nickname)?'<span class="mark-top">最多</span>':'')+'</td><td>'+C.sum(items)+'回</td><td>'+pct(C.sum(items)/s.count*100)+'<small>'+C.sum(items)+' / '+s.count+'回</small></td></tr>').join('')+'</tbody></table>':'<div class="empty-result">この方向・期間では未収集</div>')+
        '<div class="actions"><a href="'+esc(detailHref(caller,'calling',{year:state.year,from:state.from,to:state.to,person:target}))+'">同条件の呼び方</a><a href="'+esc(detailHref(target,'received',{year:state.year,from:state.from,to:state.to,person:caller}))+'">同条件の呼ばれ方</a></div></section>';
    }
    const pairYears=D.years.filter(year=>C.inPeriod({year},state));
    $('compare-results').innerHTML='<div class="compare-grid">'+direction(state.a,state.b)+direction(state.b,state.a)+'</div><section><h2>年ごとの件数・最多呼称・構成比</h2><div class="table-scroll"><table class="compare-year"><thead><tr><th>記録年</th><th>'+esc(state.a)+' → '+esc(state.b)+'</th><th>'+esc(state.b)+' → '+esc(state.a)+'</th></tr></thead><tbody>'+pairYears.map(year=>'<tr><th>'+esc(year)+'</th>'+[state.a,state.b].map(caller=>{
      const values=allPairs.filter(row=>row.year===year&&row.caller===caller),s=C.summary(values);
      const composition=[...C.groupBy(values,row=>row.nickname)].sort((a,b)=>C.sum(b[1])-C.sum(a[1])).map(([nickname,items])=>'<p>'+esc(nickname)+' '+C.sum(items)+' / '+s.count+'回（'+pct(C.sum(items)/s.count*100)+'）</p>').join('');
      return '<td>'+(s.count?s.count+'回／'+esc(s.topNames.join('・'))+' '+s.topCount+'回（'+pct(s.topShare)+'）<small>最多分母：'+s.count+'回</small><details class="source-box"><summary>呼び名の全構成比</summary>'+composition+'</details>':'未収集')+'</td>';
    }).join('')+'</tr>').join('')+'</tbody></table></div></section>';
  }
  function renderStats() {
    const items=memberMetrics(), period=periodRows(), cohort=new Set(items.map(item=>item.member.name));
    const scopeRows=period.filter(row=>cohort.has(row.caller)||cohort.has(row.target));
    const receivedTypes=new Set(scopeRows.map(row=>JSON.stringify([row.target,row.nickname]))).size;
    const callingTypes=new Set(scopeRows.map(row=>JSON.stringify([row.caller,row.target,row.nickname]))).size;
    $('scope').textContent=scopeText()+'／対象'+items.length+'人（相手は全員）';
    $('stats-summary').innerHTML=cards([['記録した回数の合計',fmt(C.sum(scopeRows))+'回','対象者に関係する記録を一度ずつ計上'],
      ['呼ばれ方の呼称種類数',fmt(receivedTypes)+'種','呼ばれる人×呼び名'],['呼び方の相手別呼称種類数',fmt(callingTypes)+'種','呼ぶ人×相手×呼び名'],
      ['対象を区別しない表記種類数',new Set(scopeRows.map(row=>row.nickname)).size+'種']]);
    const yearly=D.years.map(year=>({year, count:C.sum(records.filter(row=>row.year===year&&(cohort.has(row.caller)||cohort.has(row.target))))}));
    const maximum=Math.max(1,...yearly.map(row=>row.count)),step=maximum>2000?500:maximum>1000?200:maximum>100?50:10,axis=Math.ceil(maximum/step)*step;
    $('year-chart').innerHTML='<p class="note">各年の対象者に関係する収集済み記録。目盛り '+step+'回。'+D.currentYear+'年は途中の集計です。</p>'+yearly.map(row=>'<div class="chart-row"><strong>'+row.year+'</strong><div class="chart-track" style="--step:'+step/axis*100+'%"><div class="chart-bar" style="width:'+row.count/axis*100+'%"></div></div><span class="chart-label">'+fmt(row.count)+'回</span></div>').join('');
    function cohortTable(key) {
      const groups=C.groupBy(items,item=>item.member[key]);
      return '<div class="table-scroll"><table><thead><tr><th>'+(key==='generation'?'期':'登録上の状態')+'</th><th>人数（0件を含む）</th><th>呼ばれる回数</th><th>1人平均</th><th>呼ぶ回数</th><th>1人平均</th></tr></thead><tbody>'+[...groups].map(([name,rows])=>{
        const received=rows.reduce((sum,item)=>sum+item.received.count,0),calling=rows.reduce((sum,item)=>sum+item.calling.count,0);
        return '<tr><th>'+esc(name)+'</th><td>'+rows.length+'人</td><td>'+received+'回</td><td>'+(received/rows.length).toFixed(1)+'回</td><td>'+calling+'回</td><td>'+(calling/rows.length).toFixed(1)+'回</td></tr>';
      }).join('')+'</tbody></table></div>';
    }
    $('cohort-tables').innerHTML=cohortTable('generation')+cohortTable('status')+'<p class="note">平均の母数は表示対象の登録メンバー全員。0件も含みます。現役／卒業は登録上の現在状態で、記録当時の在籍状態ではありません。</p>';
    $('distribution').innerHTML='<table><thead><tr><th>収集量の目安</th><th>呼ばれ方</th><th>呼び方</th></tr></thead><tbody>'+D.settings.collection_levels.map(level=>'<tr><th>'+badge(level.minimum)+'</th><td>'+items.filter(item=>C.level(item.received.count,D.settings.collection_levels).label===level.label).length+'人</td><td>'+items.filter(item=>C.level(item.calling.count,D.settings.collection_levels).label===level.label).length+'人</td></tr>').join('')+'</tbody></table>';
    const metric=state.metric,minimum=Number(state.minimum)||0;
    const metricValue=item=>({total:item.total,calling:item.calling.count,received:item.received.count,receivedShare:item.received.topShare,partnerShare:item.calling.partnerShare,uniformity:item.calling.uniformity})[metric];
    const rankings=C.rank(items.filter(item=>['total','received','calling'].includes(metric)||
      (metric.startsWith('received')?item.received.count:item.calling.count)>=minimum),item=>metricValue(item)??-1);
    const definitions={
      total:'その人に関係する記録の合計＝呼ぶ回数＋呼ばれる回数。全員分を足すと同じ観測を両方向で2回数えます。',
      received:'対象期間に呼ばれた記録のcount合計。',calling:'対象期間に呼んだ記録のcount合計。',
      receivedShare:'最多呼び名の回数÷呼ばれた総回数。最多同率を含みます。',
      partnerShare:'最多相手への回数÷呼んだ総回数。呼称の統一度とは別です。',
      uniformity:'相手別の最多呼び名回数の合計÷呼んだ総回数。'
    };
    $('rank-definition').textContent=definitions[metric]+'／対象'+rankings.length+'人・'+scopeText();
    pager($('rank-results'),rankings,part=>'<div class="table-scroll"><table><thead><tr><th>順位</th><th>メンバー</th><th>指標</th><th>呼ぶ回数</th><th>呼ばれる回数</th></tr></thead><tbody>'+part.map(item=>{
      const value=metricValue(item), formatted=['total','calling','received'].includes(metric)?fmt(value)+'回':pct(value);
      return '<tr><td>'+item.rank+'</td><td>'+memberLink(item.member.name)+'<small>'+esc(item.member.generation)+'</small></td><td>'+formatted+'</td><td>'+item.calling.count+'回</td><td>'+item.received.count+'回</td></tr>';
    }).join('')+'</tbody></table></div>');
  }
  function render() {
    if(P.kind==='detail')renderDetail();else if(P.kind==='home')renderHome();else if(P.kind==='members')renderMembers();
    else if(P.kind==='listing')renderListing();else if(P.kind==='compare')renderCompare();else if(P.kind==='stats')renderStats();
  }
  state=readState();populateControls();bindControls();render();syncURL();
  window.addEventListener('popstate',()=>{const fresh=new URLSearchParams(location.search);[...params.keys()].forEach(key=>params.delete(key));fresh.forEach((value,key)=>params.set(key,value));state=readState(false);populateControls();render();});
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link)return;
    const url=new URL(link.href,location.href);if(url.origin===location.origin&&url.pathname.endsWith('.html')){url.searchParams.set('v',P.version);link.href=url.href;}
  });
  if(location.protocol==='http:'||location.protocol==='https:') fetch(root+'version.json?t='+Date.now(),{cache:'no-store'}).then(response=>response.ok?response.json():null).then(latest=>{
    if(!latest?.version||latest.version===P.version)return;
    const banner=document.createElement('div');banner.className='update-banner';
    banner.innerHTML='<span>新しい更新があります</span><button type="button">条件を保って更新</button>';
    banner.querySelector('button').onclick=()=>{const url=new URL(location.href);url.searchParams.set('v',latest.version);location.href=url.href;};document.body.appendChild(banner);
  }).catch(()=>{});
})();
