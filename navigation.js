function filteredHistory(transactions,filters={}) {
  const query=String(filters.query||'').trim().toLowerCase();
  return transactions.map((t,index)=>({t,index})).filter(({t})=>{
    const day=localDay(new Date(t.date));
    return (!filters.context||filters.context==='Everything'||t.context===filters.context)&&
      (!filters.account||t.account===filters.account)&&(!filters.start||day>=filters.start)&&(!filters.end||day<=filters.end)&&
      (!query||[t.merchant,t.category,t.subcategory,t.account,t.note,t.date].join(' ').toLowerCase().includes(query));
  }).sort((a,b)=>(new Date(b.t.date)-new Date(a.t.date))||b.index-a.index).map(x=>x.t);
}
function categoryColor(name){
  const palette=['#8de6b1','#80bfff','#ffbd80','#d4a5ff','#ff91ad','#ffe080','#58d3ce','#b9cf78','#adadff','#e8a878','#a4dbe8','#e7b7cf','#c9d5df','#a3bd95','#d8c0a0','#b69ee0','#f09e92','#8eaecb'];
  const names=['Groceries','Gas','Personal items','Resale inventory','Eating out','Loans','Storage','Insurance','Laundry','Subscriptions','Business supplies','Household','Health & fitness','Needs review','Other'];
  let index=names.indexOf(name);if(index<0)index=[...String(name)].reduce((sum,c)=>sum+c.charCodeAt(0),0);
  return palette[index%palette.length];
}
let currentPage='home';
function openAppPage(page,focus=true){
  if(!['home','transactions','reports','settings'].includes(page))return;
  currentPage=page;
  document.querySelectorAll('[data-page-panel]').forEach(panel=>panel.hidden=panel.dataset.pagePanel!==page);
  document.querySelectorAll('[data-app-page]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.appPage===page));});
  $('pageHeading').textContent={home:'Your day at a glance',transactions:'Find and manage transactions',reports:'See where your money goes',settings:'Keep your ledger connected'}[page];
  if(focus){$('pageHeading').focus();window.scrollTo({top:0,behavior:'smooth'});}
}
function setupAppPages(){
  const main=document.querySelector('main');
  for(const page of ['home','transactions','reports','settings']){
    const panel=document.createElement('div');panel.dataset.pagePanel=page;panel.id='page-'+page;main.append(panel);
  }
  const move=(id,page,section=true)=>{const el=$(id);if(el)$('page-'+page).append(section?el.closest('section')||el:el);};
  for(const id of ['micBtn','cashTotal'])move(id,'home');
  move('entryForm','home',false);move('manualEntryBtn','home',false);move('confirmation','home',false);
  for(const id of ['accounts','cashOutBtn','transferForm','moneyIn','reconcileAccount'])move(id,'home');
  move('transactions','transactions');move('choosePdfBtn','transactions');
  move('categoryMonth','reports');
  for(const id of ['authForm','exportBtn','merchantRuleList','removedItems'])move(id,'settings');
  move('downloadRecovery','settings',false);
  move('refreshApp','settings',false);
  $('syncConflict').before($('page-settings'));
  // Balance conflicts remain visible regardless of the selected page.
  openAppPage('home',false);
}
function renderHistoryView(){
  const chosen=$('historyAccount').value;
  $('historyAccount').innerHTML='<option value="">All accounts</option>'+state.accounts.map(a=>`<option value="${categoryEscape(a.name)}" ${a.name===chosen?'selected':''}>${categoryEscape(a.name)}</option>`).join('');
  const rows=filteredHistory(state.transactions,{query:$('historySearch').value,account:$('historyAccount').value,start:$('historyStart').value,end:$('historyEnd').value,context:$('filter').value});
  $('historyCount').textContent=`${rows.length} of ${state.transactions.length} transactions · newest date first`;
  $('transactions').innerHTML=rows.map(t=>`<div class="tx-row"><div><div class="tx-name">${categoryEscape(t.merchant)}</div><div class="tx-date">${formatDate(t.date)}${t.externalId?' · Imported':''}</div><div class="tx-meta">${categoryEscape(suggestCategory(t))}${transactionSubcategory(t)?' → '+categoryEscape(transactionSubcategory(t)):''} · ${categoryEscape(t.context)} · ${categoryEscape(t.account)}</div></div><div class="tx-tools"><div class="account-balance ${t.amount<0?'negative':'positive'}">${signed(t.amount)}</div><button class="account-action" data-edit-transaction="${categoryEscape(t.id)}">Edit</button><button class="account-action danger" data-delete-transaction="${categoryEscape(t.id)}">Remove</button></div></div>`).join('')||'<p class="backup-copy">No transactions match. Try clearing the filters.</p>';
}
setupAppPages();
const historyControls=document.createElement('div');
historyControls.className='history-controls';
historyControls.innerHTML='<label>Search<input id="historySearch" type="search" placeholder="Merchant, category, or note…"></label><label>Account<select id="historyAccount"></select></label><div class="reconcile-form"><label>From date<input id="historyStart" type="date"></label><label>Through date<input id="historyEnd" type="date"></label></div><button type="button" class="text-btn" id="clearHistory">Clear filters</button><p class="backup-copy" id="historyCount" aria-live="polite"></p>';
$('transactions').before(historyControls);
$('transactions').previousElementSibling.previousElementSibling.textContent='Search or filter your history, with the newest transaction dates first.';
for(const id of ['historySearch','historyAccount','historyStart','historyEnd'])$(id).addEventListener('input',renderHistoryView);
$('clearHistory').onclick=()=>{for(const id of ['historySearch','historyAccount','historyStart','historyEnd'])$(id).value='';$('filter').value='Everything';renderHistoryView();};
document.querySelectorAll('[data-app-page]').forEach(button=>button.onclick=()=>openAppPage(button.dataset.appPage));
$('syncShortcut').onclick=()=>openAppPage('settings');
new MutationObserver(()=>{$('syncShortcut').textContent=$('syncStatus').textContent||'Sync & backup';}).observe($('syncStatus'),{childList:true,characterData:true,subtree:true});
function updateNetworkStatus(){$('networkStatus').textContent=!navigator.onLine?'Offline · changes stay on this device until synced':location.protocol==='file:'?'Local file copy · use the online Checkbook for your everyday phone and computer workflow':'';}
window.addEventListener('online',updateNetworkStatus);window.addEventListener('offline',updateNetworkStatus);updateNetworkStatus();
$('refreshApp').onclick=async()=>{
  if($('ledgerEditor').open||pending.length||$('entry').value.trim()||$('transferAmount').value.trim())return toast('Finish or clear your current entry before refreshing');
  try{if('serviceWorker' in navigator&&location.protocol!=='file:'){const registration=await navigator.serviceWorker.getRegistration();if(registration)await registration.update();}location.reload();}
  catch{toast('Could not check for updates — try again when connected');}
};
const showParsedBeforeNavigation=showParsed;
showParsed=function(items){openAppPage('home',false);showParsedBeforeNavigation(items);};
const renderBeforeNavigation=render;
render=function(){renderBeforeNavigation();renderHistoryView();};
$('filter').onchange=renderHistoryView;
document.querySelector('h1').textContent=`${new Date().getHours()<12?'Good morning':new Date().getHours()<18?'Good afternoon':'Good evening'}, Tyrone`;
$('entry').placeholder='Spent $12 at QT on PayPal Business…';
render();
