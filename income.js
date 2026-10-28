function reportPaymentChannel(ledger,t){
  const a=ledger.accounts.find(a=>a.name===t.account);
  return a?.type==='Cash'||/^cash$/i.test(t.account)?'Cash':'Account/card';
}
function matchesReportPayment(t){const chosen=$('reportPayment')?.value||'All';return chosen==='All'||reportPaymentChannel(state,t)===chosen;}
function summarizeIncome(ledger,month,context='All',channel='All'){
  const rows=ledger.transactions.filter(t=>t.amount>0&&!t.isAdjustment&&String(t.date).slice(0,7)===month&&(context==='All'||t.context===context)&&(channel==='All'||reportPaymentChannel(ledger,t)===channel));
  const totals={income:0,refund:0,cashback:0,transfer:0,review:0},sources={};
  for(const t of rows){
    const category=t.category;
    const group=category==='Transfer'?'transfer':category==='Refund'?'refund':category==='Cashback'?'cashback':['Sales income','Service income','Other income'].includes(category)?'income':'review';
    const cents=Math.round(t.amount*100);totals[group]+=cents;
    if(group==='income'){const source=t.incomeSource||'Other / source not recorded';sources[source]=(sources[source]||0)+cents;}
  }
  return {totals,sources,rows:rows.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))};
}
function renderIncomeView(){
  const {totals,sources,rows}=summarizeIncome(state,$('categoryMonth').value,$('categoryContext').value,$('reportPayment').value);
  $('incomeReport').innerHTML=`<div class="review-card"><div><span class="muted">Income received</span><strong class="positive">${money(totals.income/100)}</strong></div><div><span class="muted">Needs review</span><strong>${money(totals.review/100)}</strong></div></div><p class="backup-copy">Refunds ${money(totals.refund/100)} · Cashback ${money(totals.cashback/100)} · Transfers in ${money(totals.transfer/100)}. These are excluded from income received. This is a cash-flow view, not a gross-sales tax report.</p>${Object.entries(sources).map(([source,cents])=>`<div class="account-row"><strong>${categoryEscape(source)}</strong><strong>${money(cents/100)}</strong></div>`).join('')}<details><summary>Income & deposit entries (${rows.length})</summary><div class="tx-list">${rows.map(t=>`<div class="tx-row"><div><strong>${categoryEscape(t.merchant)}</strong><p class="tx-date">${formatDate(t.date)} · ${categoryEscape(t.account)}</p><p class="tx-meta">${categoryEscape(t.incomeSource||'Source not recorded')} · ${categoryEscape(t.paymentMethod||reportPaymentChannel(state,t))} · ${categoryEscape(t.category)}</p></div><div><strong class="positive">${signed(t.amount)}</strong><button class="text-btn" data-edit-transaction="${categoryEscape(t.id)}">Edit</button></div></div>`).join('')||'<p class="backup-copy">No money received for this selection.</p>'}</div></details>`;
}
const renderReportBeforeIncome=renderCategoryReview;
renderCategoryReview=function(){renderReportBeforeIncome();renderIncomeView();};
for(const id of ['categoryMonth','categoryContext','reportPayment'])$(id).onchange=renderCategoryReview;
const renderBeforeIncome=render;
render=function(){renderBeforeIncome();renderIncomeView();};
$('filter').onchange=renderHistoryView;
render();
