function parseMoneyCents(value) {
  const text=String(value).trim().replace(/^\$\s*/, '');
  if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))throw Error('Enter an amount such as 20.00 or 1,200.50');
  const [whole,fraction='']=text.replace(/,/g,'').split('.');
  const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents<=0)throw Error('Enter an amount greater than zero');
  return cents;
}
function makeTransfer(ledger,fromId,toId,amount,date,transferId) {
  const from=ledger.accounts.find(a=>String(a.id)===String(fromId));
  const to=ledger.accounts.find(a=>String(a.id)===String(toId));
  if(!from||!to||from.id===to.id)throw Error('Choose two different accounts');
  const cents=parseMoneyCents(amount);
  if(!Number.isFinite(new Date(date).getTime()))throw Error('Choose a valid transfer date');
  return [
    {merchant:`Transfer to ${to.name}`,amount:-cents/100,account:from.name},
    {merchant:`Transfer from ${from.name}`,amount:cents/100,account:to.name}
  ].map(t=>({...t,transferId,category:'Transfer',categoryConfirmed:true,context:'Personal',date,note:'Transfer between your accounts'}));
}
function applyTransfer(ledger,items) {
  const next=JSON.parse(JSON.stringify(ledger));
  for(const t of items){
    const account=next.accounts.find(a=>a.name===t.account);
    if(!account)throw Error('A transfer account no longer exists');
    account.balance=(Math.round(account.balance*100)+Math.round(t.amount*100))/100;
    next.transactions.push({...t,id:`${t.transferId}-${t.amount<0?'out':'in'}`});
  }
  return next;
}

const parseOriginalEntry=parse;
parse=function(text){
  const rawAmount=String(text).match(/\$?\s*(\d[\d,]*(?:\.\d+)?)/)?.[1];
  if(!rawAmount)return null;
  try{
    parseMoneyCents(rawAmount);
    if(/\b(transfer|move|moved)\b/i.test(text)){
      const match=text.match(/\bfrom\s+(.+?)\s+to\s+(.+?)[.!]?$/i);
      if(!match)throw Error('Use the transfer form, or say: Transfer $20 from PayPal Business to Cash');
      const find=name=>state.accounts.find(a=>a.name.toLowerCase()===name.trim().toLowerCase()||String(a.id).toLowerCase()===name.trim().toLowerCase());
      const from=find(match[1]),to=find(match[2]);
      return makeTransfer(state,from?.id,to?.id,rawAmount,new Date().toISOString(),`transfer-${crypto.randomUUID()}`);
    }
    if(/\b(toward|took .* out)\b/i.test(text))throw Error('Use the transfer form to choose both accounts');
    return parseOriginalEntry(text.replace(rawAmount,rawAmount.replace(/,/g,'')));
  }catch(error){toast(error.message);return null;}
};
const saveOriginalEntry=$('saveBtn').onclick;
$('saveBtn').onclick=()=>{
  if(!pending.some(t=>t.transferId))return saveOriginalEntry();
  try{state=applyTransfer(state,pending);save();$('cancelBtn').click();toast('Transfer saved to both accounts');}
  catch(error){toast(error.message);}
};
function refreshTransferAccounts(){
  for(const id of ['transferFrom','transferTo']){
    const old=$(id).value;
    $(id).innerHTML=state.accounts.map(a=>`<option value="${categoryEscape(a.id)}" ${String(a.id)===old?'selected':''}>${categoryEscape(a.name)}</option>`).join('');
  }
  if($('transferFrom').value===$('transferTo').value&&state.accounts.length>1)$('transferTo').selectedIndex=1;
}
const renderBeforeTransfers=render;
render=function(){
  renderBeforeTransfers();refreshTransferAccounts();
  const today=state.transactions.filter(t=>!t.isAdjustment&&t.category!=='Transfer'&&new Date(t.date).toDateString()===new Date().toDateString());
  $('moneyIn').textContent='+'+money(today.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0));
  $('moneyOut').textContent='-'+money(today.filter(t=>t.amount<0).reduce((s,t)=>s-t.amount,0));
  $('txCount').textContent=today.length;
};
$('filter').onchange=render;
$('transferForm').onsubmit=e=>{
  e.preventDefault();
  try{
    const items=makeTransfer(state,$('transferFrom').value,$('transferTo').value,$('transferAmount').value,new Date().toISOString(),`transfer-${crypto.randomUUID()}`);
    state=applyTransfer(state,items);save();$('transferAmount').value='';toast('Transfer saved to both accounts');
  }catch(error){toast(error.message);}
};
// Handle paired entries before the older single-transaction editor receives the click.
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-edit-transaction],[data-delete-transaction]');
  if(!button)return;
  const id=button.dataset.editTransaction||button.dataset.deleteTransaction;
  const t=state.transactions.find(t=>String(t.id)===id);
  if(!t?.transferId)return;
  e.preventDefault();e.stopImmediatePropagation();
  const pair=state.transactions.filter(x=>x.transferId===t.transferId);
  if(button.dataset.editTransaction)return toast('To correct a transfer, remove it and enter it again using the transfer form');
  if(typeof requestTransactionRemoval==='function')return requestTransactionRemoval(t);
  if(pair.length!==2)return toast('Transfer pair is incomplete — keep it for review');
  if(!confirm('Remove this transfer from both accounts and reverse both balance changes?'))return;
  try{
    const next=JSON.parse(JSON.stringify(state));
    for(const entry of pair){const a=next.accounts.find(a=>a.name===entry.account);if(!a)throw Error('A transfer account is missing');a.balance=(Math.round(a.balance*100)-Math.round(entry.amount*100))/100;}
    keepRecovery(state,'Before removing paired transfer');
    next.transactions=next.transactions.filter(x=>x.transferId!==t.transferId);state=next;save();toast('Transfer removed from both accounts');
  }catch(error){toast(error.message);}
},true);
render();
