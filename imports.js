function importMerchantKey(name) {
  return String(name||'').toLowerCase().replace(/wal[ -]?mart|wm supercenter/g,'walmart').replace(/quiktrip/g,'qt').replace(/circle\s*k/g,'circlek').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}
function possibleImportMatches(ledger,accountName,item) {
  const key=importMerchantKey(item.merchant);
  const time=new Date(item.date).getTime();
  return ledger.transactions.filter(t=>{
    if(t.externalId||t.isAdjustment||t.category==='Transfer'||t.account!==accountName)return false;
    if(Math.round(t.amount*100)!==Math.round(item.amount*100))return false;
    if(!Number.isFinite(time)||!Number.isFinite(new Date(t.date).getTime())||Math.abs(new Date(t.date).getTime()-time)>3*86400000)return false;
    const other=importMerchantKey(t.merchant);
    return key.length>=2&&other.length>=2&&(key===other||key.startsWith(other+' ')||other.startsWith(key+' '));
  });
}
function planStatementImport(ledger,accountName,selections) {
  const next=JSON.parse(JSON.stringify(ledger));
  const account=next.accounts.find(a=>a.name===accountName);
  if(!account)throw Error('Choose an import account');
  const seen=new Set(next.transactions.map(t=>t.externalId).filter(Boolean));
  const linkedIds=new Set();
  let added=0,linked=0,skipped=0,changeCents=0;
  for(const selection of selections){
    const t=selection.transaction;
    if(!t||!t.externalId||!Number.isFinite(t.amount))throw Error('Invalid statement item — read the PDF again');
    if(seen.has(t.externalId)){skipped++;continue;}
    if(selection.action==='link'){
      const manual=next.transactions.find(x=>String(x.id)===String(selection.manualId));
      if(!manual||linkedIds.has(String(manual.id))||!possibleImportMatches(next,accountName,t).some(x=>x.id===manual.id))throw Error('That match changed or was used already. Review your choices again.');
      manual.externalId=t.externalId;
      manual.statementDate=t.date;
      manual.description=t.description;
      manual.importedAt=new Date().toISOString();
      linkedIds.add(String(manual.id));linked++;
    }else if(selection.action==='add'){
      next.transactions.push({...t,account:accountName,note:`Imported from PayPal PDF: ${t.description}`,importedAt:new Date().toISOString()});
      changeCents+=Math.round(t.amount*100);added++;
    }else throw Error('Choose whether to link or add each possible match');
    seen.add(t.externalId);
  }
  account.balance=Math.round((Math.round(Number(account.balance)*100)+changeCents))/100;
  return {next,added,linked,skipped,changeCents};
}

const originalPayPalParser=parsePayPalText;
parsePayPalText=function(text){
  const seen=new Set();
  return originalPayPalParser(text).filter(t=>{if(seen.has(t.externalId))return false;seen.add(t.externalId);return true;});
};
renderImportPreview=function(){
  const account=$('importAccount').value;
  $('importPreview').classList.remove('hidden');
  const dates=importCandidates.map(t=>t.date).sort();
  const total=importCandidates.reduce((sum,t)=>sum+Math.round(t.amount*100),0)/100;
  $('importPreview').innerHTML=`<p class="import-summary">${importCandidates.length} new settled items · ${dates.length?formatDate(dates[0])+' – '+formatDate(dates.at(-1)):''} · Net ${signed(total)}. Dates describe the items found, not the statement’s complete coverage.</p><p class="backup-copy">Possible matches have the same amount, a similar merchant, and a date within three days. Choose Link to keep the existing entry and balance, or Add if it is a separate purchase. Uncheck items to leave them out.</p>${importCandidates.map((t,i)=>{
    const matches=possibleImportMatches(state,account,t);
    return `<div class="statement-item"><label class="import-row"><input type="checkbox" data-import-index="${i}" ${t.needsReview?'':'checked'}><span><strong>${categoryEscape(t.merchant)}</strong><small>${formatDate(t.date)} · ${categoryEscape(t.category)}</small></span><strong>${signed(t.amount)}</strong></label>${matches.length?`<label class="import-label">Possible existing entry<select data-import-choice="${i}" aria-label="Match for ${categoryEscape(t.merchant)}"><option value="">Choose link or add…</option>${matches.map(m=>`<option value="${categoryEscape(m.id)}">Link: ${categoryEscape(m.merchant)} · ${formatDate(m.date)} · ${money(m.amount)}</option>`).join('')}<option value="add">Add as a separate transaction</option></select></label>`:''}</div>`;
  }).join('')}<div class="import-actions"><button class="text-btn backup-btn" id="cancelImportBtn">Cancel</button><button class="save-btn" id="saveImportBtn">Import selected</button></div>`;
  $('cancelImportBtn').onclick=()=>{importCandidates=[];$('importPreview').classList.add('hidden');};
  $('saveImportBtn').onclick=saveImportedTransactions;
};
saveImportedTransactions=function(){
  try{
    const selections=[...document.querySelectorAll('[data-import-index]:checked')].map(box=>{
      const i=Number(box.dataset.importIndex),choice=document.querySelector(`[data-import-choice="${i}"]`);
      if(choice&&!choice.value)throw Error('Choose Link or Add for each selected possible match');
      return {transaction:importCandidates[i],action:!choice||choice.value==='add'?'add':'link',manualId:choice?.value};
    });
    if(!selections.length)return toast('Select at least one statement item');
    const plan=planStatementImport(state,$('importAccount').value,selections);
    keepRecovery(state,'Before statement import');
    state=plan.next;save();
    importCandidates=[];$('importStatus').textContent='Imported';
    $('importPreview').innerHTML=`<p role="status" class="import-summary">Import complete: ${plan.added} added, ${plan.linked} linked to existing entries, ${plan.skipped} duplicates skipped. Balance change: ${signed(plan.changeCents/100)}. Check your account balance if this statement includes history from before your starting point.</p>`;
    toast('Statement import complete');
  }catch(error){toast(error.message||'Import could not be saved');}
};
$('importAccount').onchange=()=>{if(importCandidates.length)renderImportPreview();};
