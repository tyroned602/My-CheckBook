function validateLedgerBackup(input) {
  if(!input||typeof input!=='object'||!Array.isArray(input.accounts)||!Array.isArray(input.transactions))throw Error('Choose a Checkbook ledger backup');
  const next=JSON.parse(JSON.stringify(input));
  if(next.merchantRules!==undefined){
    if(!Array.isArray(next.merchantRules))throw Error('Backup has invalid merchant rules');
    const ruleIds=new Set();
    for(const r of next.merchantRules){
      if(!r||typeof r.id!=='string'||ruleIds.has(r.id)||!Array.isArray(r.aliases)||!r.aliases.length||r.aliases.some(a=>typeof a!=='string'||!a.trim())||typeof r.category!=='string'||!['Personal','Reselling','Detailing'].includes(r.context)||r.subcategory&&r.subcategory!=='Water'||r.subcategory==='Water'&&r.category!=='Groceries')throw Error('Backup has an invalid merchant default');
      ruleIds.add(r.id);
    }
  }
  const validId=id=>(typeof id==='string'&&id.trim().length>0)||(typeof id==='number'&&Number.isFinite(id));
  const validMoney=value=>typeof value==='number'&&Number.isFinite(value)&&Number.isSafeInteger(Math.round(value*100));
  const ids=new Set(),names=new Set(),txIds=new Set(),externalIds=new Set();
  for(const a of next.accounts){
    if(!validId(a.id)||typeof a.name!=='string'||!a.name.trim()||typeof a.type!=='string'||!validMoney(a.balance))throw Error('Backup has an invalid account or balance');
    if(ids.has(String(a.id))||names.has(a.name.toLowerCase()))throw Error('Backup has duplicate account IDs or names');
    ids.add(String(a.id));names.add(a.name.toLowerCase());
  }
  for(const t of next.transactions){
    if(!validId(t.id)||typeof t.merchant!=='string'||typeof t.account!=='string'||typeof t.category!=='string'||typeof t.context!=='string'||!validMoney(t.amount)||typeof t.date!=='string'||!Number.isFinite(new Date(t.date).getTime()))throw Error('Backup has an invalid transaction, date, or amount');
    if(!next.accounts.some(a=>a.name===t.account))throw Error(`Backup references a missing account: ${t.account}`);
    if(txIds.has(String(t.id)))throw Error('Backup has duplicate transaction IDs');
    txIds.add(String(t.id));
    if(t.externalId){if(typeof t.externalId!=='string'||externalIds.has(t.externalId))throw Error('Backup has duplicate or invalid PayPal IDs');externalIds.add(t.externalId);}
  }
  const groups=new Map();
  for(const t of next.transactions.filter(t=>t.transferId)){
    if(typeof t.transferId!=='string')throw Error('Backup has an invalid transfer ID');
    if(!groups.has(t.transferId))groups.set(t.transferId,[]);groups.get(t.transferId).push(t);
  }
  for(const pair of groups.values())if(pair.length!==2||pair[0].account===pair[1].account||pair.some(t=>t.category!=='Transfer')||pair.reduce((sum,t)=>sum+Math.round(t.amount*100),0)!==0)throw Error('Backup contains an incomplete or unbalanced transfer');
  for(const key of ['reconciliations','closedDays','trash']){if(next[key]===undefined)next[key]=[];if(!Array.isArray(next[key]))throw Error(`Invalid ${key} in backup`);}
  for(const r of next.reconciliations)if(!r||!validMoney(r.actual)||typeof r.date!=='string'||!Number.isFinite(new Date(r.date).getTime()))throw Error('Backup has an invalid balance review');
  for(const day of next.closedDays)if(!day||typeof day.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day.day)||!Array.isArray(day.accounts))throw Error('Backup has an invalid daily review');
  for(const deleted of next.trash)if(!deleted||!validId(deleted.id)||!['transactions','account'].includes(deleted.kind)||!Array.isArray(deleted.items)||!deleted.items.length||deleted.items.some(item=>!item||typeof item!=='object')||typeof deleted.date!=='string'||!Number.isFinite(new Date(deleted.date).getTime()))throw Error('Backup has an invalid removed item');
  return next;
}
function removeLedgerTransactions(ledger,id) {
  const next=JSON.parse(JSON.stringify(ledger));
  const t=next.transactions.find(t=>String(t.id)===String(id));
  if(!t)throw Error('Transaction no longer exists');
  if(t.isAdjustment)throw Error('Use Balance check to correct a balance adjustment');
  const items=t.transferId?next.transactions.filter(x=>x.transferId===t.transferId):[t];
  if(t.transferId&&(items.length!==2||items.reduce((sum,t)=>sum+Math.round(t.amount*100),0)!==0))throw Error('Transfer is incomplete — keep it for review');
  for(const item of items){
    const a=next.accounts.find(a=>a.name===item.account);if(!a)throw Error('A transaction account is missing');
    a.balance=(Math.round(a.balance*100)-Math.round(item.amount*100))/100;
  }
  const removeIds=new Set(items.map(x=>String(x.id)));
  next.transactions=next.transactions.filter(x=>!removeIds.has(String(x.id)));
  next.trash=next.trash||[];
  next.trash.push({id:crypto.randomUUID(),kind:'transactions',date:new Date().toISOString(),items});
  return next;
}
function restoreRemovedItem(ledger,id) {
  const next=JSON.parse(JSON.stringify(ledger));
  const removed=(next.trash||[]).find(x=>String(x.id)===String(id));if(!removed)throw Error('Removed item not found');
  if(removed.kind==='account'){
    const a=removed.items[0];
    if(!a||next.accounts.some(x=>String(x.id)===String(a.id)||x.name.toLowerCase()===a.name.toLowerCase()))throw Error('An account with that name or ID already exists');
    next.accounts.push(a);
  }else{
    for(const t of removed.items){
      if(next.transactions.some(x=>String(x.id)===String(t.id)||(t.externalId&&x.externalId===t.externalId)))throw Error('This transaction is already present');
      const account=next.accounts.find(a=>a.name===t.account);if(!account)throw Error('Restore the account first');
      account.balance=(Math.round(account.balance*100)+Math.round(t.amount*100))/100;
      next.transactions.push(t);
    }
  }
  next.trash=next.trash.filter(x=>x.id!==removed.id);
  return validateLedgerBackup(next);
}
function trashPayPalIds(ledger) {
  return new Set((ledger.trash||[]).flatMap(x=>x.kind==='transactions'?x.items:[]).map(x=>x.externalId).filter(Boolean));
}
function requestTransactionRemoval(t) {
  openEditor(t.transferId?'Remove transfer':'Remove transaction',`<p class="backup-copy">${categoryEscape(t.merchant)} · ${signed(t.amount)}. Both transfer entries are removed together. The balance changes will be reversed. You can restore this from Removed items.</p>`,()=>{
    const next=removeLedgerTransactions(state,t.id);keepRecovery(state,'Before removing transaction');state=next;save();toast('Moved to Removed items — recoverable');
  });
}
// The transfer click handler delegates paired deletion here when this module is loaded.
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-delete-transaction],[data-delete-account],[data-restore-removed]');if(!button)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(button.dataset.restoreRemoved){
    try{const next=restoreRemovedItem(state,button.dataset.restoreRemoved);keepRecovery(state,'Before restoring removed item');state=next;save();toast('Item restored');}catch(error){toast(error.message);}return;
  }
  if(button.dataset.deleteTransaction){const t=state.transactions.find(x=>String(x.id)===button.dataset.deleteTransaction);if(t){if(t.isAdjustment)return toast('Use Balance check to correct this balance');requestTransactionRemoval(t);}return;}
  const a=state.accounts.find(x=>String(x.id)===button.dataset.deleteAccount);if(!a)return;
  if(state.transactions.some(t=>t.account===a.name))return toast('This account has history. Keep it until account archiving is available.');
  openEditor('Remove account',`<p class="backup-copy">Remove ${categoryEscape(a.name)} from the available balance? You can restore it from Removed items.</p>`,()=>{
    if(state.transactions.some(t=>t.account===a.name))throw Error('Account gained transactions — removal cancelled');
    keepRecovery(state,'Before removing account');
    state.trash=state.trash||[];state.trash.push({id:crypto.randomUUID(),kind:'account',date:new Date().toISOString(),items:[JSON.parse(JSON.stringify(a))]});
    state.accounts=state.accounts.filter(x=>x.id!==a.id);save();toast('Account moved to Removed items');
  });
},true);
const parseBeforeSafety=parsePayPalText;
parsePayPalText=function(text){const deleted=trashPayPalIds(state);return parseBeforeSafety(text).filter(t=>!deleted.has(t.externalId));};
const planBeforeSafety=planStatementImport;
planStatementImport=function(ledger,account,selections){
  const deleted=trashPayPalIds(ledger),filtered=selections.filter(s=>!deleted.has(s.transaction?.externalId));
  const result=planBeforeSafety(ledger,account,filtered);result.skipped+=selections.length-filtered.length;return result;
};
function confirmBackupRestore(input,reason) {
  const next=validateLedgerBackup(input);
  openEditor('Review backup before restoring',`<p class="backup-copy">${next.accounts.length} accounts · ${next.transactions.length} transactions</p><p class="backup-copy">${next.accounts.map(a=>`${categoryEscape(a.name)}: ${signed(a.balance)}`).join('<br>')}</p><p class="backup-copy">Replaces this device’s ledger. A recovery copy of your current ledger will be kept. If cloud sync is ready, the restored ledger will also be sent to your account.</p>`,()=>{
    keepRecovery(state,reason);state=next;save();toast('Backup restored; check cloud sync status');
  });
}
$('importFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const input=JSON.parse(await file.text());
    if(input.format==='checkbook-recovery'&&Array.isArray(input.copies)){
      const copies=input.copies;openEditor('Choose a recovery copy',`<label>Recovery copy<select name="copy">${copies.map((c,i)=>`<option value="${i}">${categoryEscape(c.date)} · ${categoryEscape(c.reason)}</option>`).join('')}</select></label>`,()=>{
        const chosen=copies[Number($('editorForm').elements.copy.value)];
        // Defer the replacement dialog until the selection dialog has closed.
        setTimeout(()=>{try{confirmBackupRestore(chosen?.data,'Before restoring recovery file');}catch(error){toast(error.message);}},0);
      });
    }else confirmBackupRestore(input,'Before restoring backup');
  }catch(error){toast(error.message||'Could not read backup');}
  e.target.value='';
};
const renderBeforeSafety=render;
render=function(){
  renderBeforeSafety();
  const removed=state.trash||[];
  $('removedItems').innerHTML=removed.slice().reverse().map(item=>`<div class="account-row"><div><strong>${categoryEscape(item.items[0]?.merchant||item.items[0]?.name||'Removed item')}</strong><p class="tx-date">${formatDate(item.date)} · ${item.items.length} item(s)</p></div><button class="text-btn" data-restore-removed="${categoryEscape(item.id)}">Restore</button></div>`).join('')||'<p class="backup-copy">Nothing removed.</p>';
};
$('filter').onchange=render;
render();
