function localDay(date=new Date()) {
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function accountReviewSignature(ledger,account) {
  return JSON.stringify({balance:account.balance,transactions:ledger.transactions.filter(t=>t.account===account.name)});
}
function changeTransaction(ledger,oldId,item) {
  const next=JSON.parse(JSON.stringify(ledger));
  const old=oldId==null?null:next.transactions.find(t=>String(t.id)===String(oldId));
  if(oldId!=null&&!old)throw Error('This transaction no longer exists');
  if(old?.transferId||old?.isAdjustment)throw Error('Use the transfer or balance-check controls for this entry');
  const account=next.accounts.find(a=>a.name===item.account);
  if(!account)throw Error('Choose an existing account');
  if(old){
    const previous=next.accounts.find(a=>a.name===old.account);
    if(!previous)throw Error('The original account is missing');
    previous.balance=(Math.round(previous.balance*100)-Math.round(old.amount*100))/100;
  }
  account.balance=(Math.round(account.balance*100)+Math.round(item.amount*100))/100;
  if(old)Object.assign(old,item,{modifiedAt:new Date().toISOString()});
  else next.transactions.push({...item,id:crypto.randomUUID()});
  return next;
}
let editorState=null;
function openEditor(title,markup,onSave) {
  $('editorTitle').textContent=title;
  $('editorFields').innerHTML=markup;
  $('editorError').textContent='';
  editorState=onSave;
  $('ledgerEditor').showModal();
}
const field=(label,name,value='',extra='')=>`<label>${label}<input name="${name}" value="${categoryEscape(value)}" ${extra}></label>`;
function openTransactionEditor(t=null,options={}) {
  const account=t?.account||options.account||state.accounts[0]?.name;
  const category=t?.category||'Needs review';
  const categories=[...new Set([...spendingCategories,...receiptCategories,category])].filter(c=>c!=='Transfer');
  const selectedDate=t?localDay(new Date(t.date)):localDay();
  openEditor(options.pending?'Review transaction':t?'Edit transaction':'Add transaction',
    field('Merchant or description','merchant',t?.merchant||'','required maxlength="160"')+
    `<label>Type<select name="direction"><option value="expense" ${(t?.amount||options.amount||-1)<0?'selected':''}>Expense</option><option value="income" ${(t?.amount||options.amount||-1)>0?'selected':''}>Money received</option></select></label>`+
    field('Amount','amount',t?Math.abs(t.amount).toFixed(2):'','required inputmode="decimal" placeholder="12.00"')+
    `<label>Account<select name="account">${state.accounts.map(a=>`<option ${a.name===account?'selected':''}>${categoryEscape(a.name)}</option>`).join('')}</select></label>`+
    field('Date','date',selectedDate,'type="date" required')+
    `<label>Category<select name="category">${categories.map(c=>`<option ${c===category?'selected':''}>${categoryEscape(c)}</option>`).join('')}</select></label><label>Personal or business<select name="context">${['Personal','Reselling','Detailing'].map(c=>`<option ${c===(t?.context||'Personal')?'selected':''}>${c}</option>`).join('')}</select></label>`+
    `<label>Subcategory<select name="subcategory"><option value="">None</option><option ${t?.subcategory==='Water'?'selected':''}>Water</option></select></label><label>Category choice<select name="ruleMode"><option value="manual">This transaction only</option><option value="auto">Use merchant default</option></select></label>`+
    `<details ${t?.amount>0?'open':''}><summary>Income details (money received only)</summary><label>Income source<select name="incomeSource"><option value="">Not recorded</option>${['Detailing','eBay','Facebook','Mercari','Other'].map(s=>`<option ${s===t?.incomeSource?'selected':''}>${s}</option>`).join('')}</select></label><label>Received through<select name="paymentMethod"><option value="">Use receiving account</option>${['Cash','Square','Deposit'].map(s=>`<option ${s===t?.paymentMethod?'selected':''}>${s}</option>`).join('')}</select></label></details>`+
    field('Note (optional)','note',t?.note||'','maxlength="500"'),
    form=>{
      const amount=parseMoneyCents(form.amount.value)/100*(form.direction.value==='expense'?-1:1);
      const date=form.date.value===selectedDate&&t?t.date:form.date.value+'T12:00:00';
      if(!Number.isFinite(new Date(date).getTime()))throw Error('Choose a valid date');
      const merchant=form.merchant.value.trim();if(!merchant)throw Error('Enter a description');
      const item={merchant,amount,date,account:form.account.value,category:form.category.value,context:form.context.value,note:form.note.value.trim()};
      item.subcategory=item.category==='Water'?'Water':form.subcategory.value;
      if(item.category==='Water')item.category='Groceries';
      if(item.subcategory&&item.category!=='Groceries'&&form.ruleMode.value!=='auto')throw Error('Water belongs under Groceries');
      if(form.ruleMode.value==='auto'){item.category='Needs review';item.subcategory='';item.categoryConfirmed=false;item.categorySource='';}
      else item.categoryConfirmed=true;
      item.incomeSource=amount>0?form.incomeSource.value:'';
      item.paymentMethod=amount>0?form.paymentMethod.value:'';
      if(amount>0&&item.paymentMethod){
        const receiving=state.accounts.find(a=>a.name===item.account);
        if(item.paymentMethod==='Cash'&&receiving?.type!=='Cash')throw Error('Choose the Cash account for a cash payment');
        if(item.paymentMethod==='Square'&&!/square/i.test(receiving?.name||''))throw Error('Choose the Square account for a Square payment');
        if(item.paymentMethod==='Deposit'&&receiving?.type==='Cash')throw Error('Choose the account receiving the deposit');
      }
      if(amount>0&&item.incomeSource&&['Needs review','Income'].includes(item.category)){
        item.category=item.incomeSource==='Detailing'?'Service income':item.incomeSource==='Other'?'Other income':'Sales income';
        item.context=item.incomeSource==='Detailing'?'Detailing':item.incomeSource==='Other'?item.context:'Reselling';
        item.categoryConfirmed=true;
      }
      if(options.pending){pending=[{...t,...item}];showParsed(pending);return;}
      state=changeTransaction(state,t?.id,item);save();toast('Transaction saved');
    });
}
function openAccountEditor(account=null) {
  openEditor(account?'Edit account':'Add account',field('Account name','name',account?.name||'','required maxlength="80"')+
    `<label>Account type<select name="type">${['Checking','Savings','Business','Cash','Credit card'].map(type=>`<option ${type===account?.type?'selected':''}>${type}</option>`).join('')}</select></label>`+
    (account?'<p class="backup-copy">Use Balance check to change the current balance.</p>':field('Starting balance','balance','0','required inputmode="decimal"')+'<p class="backup-copy">Use a negative balance for debt.</p>'),form=>{
      const name=form.name.value.trim();if(!name)throw Error('Enter an account name');
      if(state.accounts.some(a=>a!==account&&a.name.toLowerCase()===name.toLowerCase()))throw Error('That account name is already used');
      if(account){
        const current=state.accounts.find(a=>a.id===account.id);if(!current)throw Error('Account no longer exists');
        const old=current.name;current.name=name;current.type=form.type.value;
        state.transactions.forEach(t=>{if(t.account===old)t.account=name;});
      }else{
        const raw=form.balance.value.trim();
        const balance=/^-?\$?0(?:\.0{1,2})?$/.test(raw)?0:parseMoneyCents(raw.replace(/^-/,''))/100*(raw.startsWith('-')?-1:1);
        state.accounts.push({id:crypto.randomUUID(),name,type:form.type.value,balance});
      }
      save();toast('Account saved');
    });
}
$('editorCancel').onclick=()=>$('ledgerEditor').close();
$('editorForm').onsubmit=e=>{
  e.preventDefault();
  try{editorState(e.target.elements);$('ledgerEditor').close();}
  catch(error){$('editorError').textContent=error.message;}
};
$('manualEntryBtn').onclick=()=>openTransactionEditor();
$('addAccountBtn').onclick=()=>openAccountEditor();
$('cashOutBtn').onclick=()=>cashAccount()?openTransactionEditor(null,{account:cashAccount().name,amount:-1}):toast('Add a Cash account first');
$('cashInBtn').onclick=()=>cashAccount()?openTransactionEditor(null,{account:cashAccount().name,amount:1}):toast('Add a Cash account first');
$('startingPointBtn').textContent='Set or check current balances';
$('startingPointBtn').onclick=()=>{$('actualBalance').focus();document.querySelector('.reconcile-section').scrollIntoView({behavior:'smooth'});};
$('editParsedBtn').onclick=()=>{if(pending.length===1&&!pending[0].transferId)openTransactionEditor(pending[0],{pending:true});else toast('Use the transfer form to change both accounts');};
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-edit-account]'),b=e.target.closest('[data-edit-transaction]');
  if(!a&&!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(a){const account=state.accounts.find(x=>String(x.id)===a.dataset.editAccount);if(account)openAccountEditor(account);return;}
  const t=state.transactions.find(x=>String(x.id)===b.dataset.editTransaction);
  if(!t)return;
  if(t.isAdjustment)return toast('Use Balance check to make a new balance correction');
  if(t.transferId)return toast('Use the transfer form to correct this transfer');
  openTransactionEditor(t);
},true);

function finishAccountReview(account,actual) {
  const r={accountId:account.id,accountName:account.name,actual,expected:account.balance,difference:Math.round((actual-account.balance)*100)/100,date:new Date().toISOString()};
  if(r.difference){
    state.transactions.push({id:crypto.randomUUID(),merchant:'Balance reconciliation',amount:r.difference,account:account.name,context:'Adjustment',category:'Balance adjustment',date:r.date,isAdjustment:true});
    account.balance=actual;
  }
  r.signature=accountReviewSignature(state,account);state.reconciliations.push(r);pendingReconciliation=null;
  $('matchBalanceBtn').classList.add('hidden');$('reconcileResult').textContent='Balance checked and recorded';save();
}
checkReconciliation=function(){
  try{
    const account=state.accounts.find(a=>a.name===$('reconcileAccount').value);if(!account)throw Error('Choose an account');
    const raw=$('actualBalance').value.trim();if(!raw)throw Error('Enter the actual balance');
    const actual=Number(raw);if(!Number.isFinite(actual)||!Number.isSafeInteger(Math.round(actual*100))||Math.abs(actual*100-Math.round(actual*100))>.00001)throw Error('Enter a balance with at most two decimal places');
    pendingReconciliation={accountId:account.id,actual,signature:accountReviewSignature(state,account)};
    $('reconcileResult').classList.remove('hidden');
    const diff=(Math.round(actual*100)-Math.round(account.balance*100))/100;
    $('reconcileResult').textContent=`Actual ${signed(actual)} · Difference ${signed(diff)}`;
    $('matchBalanceBtn').classList.toggle('hidden',!diff);
    if(!diff)finishAccountReview(account,actual);
  }catch(error){toast(error.message);}
};
applyReconciliation=function(){
  if(!pendingReconciliation)return;
  const r=pendingReconciliation,account=state.accounts.find(a=>a.id===r.accountId);
  if(!account||$('reconcileAccount').value!==account.name||Number($('actualBalance').value)!==r.actual||r.signature!==accountReviewSignature(state,account)){
    pendingReconciliation=null;$('matchBalanceBtn').classList.add('hidden');return toast('Account or entries changed — check the balance again');
  }
  try{keepRecovery(state,'Before balance adjustment');finishAccountReview(account,r.actual);}
  catch{toast('Could not preserve recovery copy — download a backup first');}
};
$('checkBalanceBtn').onclick=checkReconciliation;$('matchBalanceBtn').onclick=applyReconciliation;
$('closeDayBtn').onclick=()=>{
  const day=localDay();
  const missing=state.accounts.filter(a=>!state.reconciliations.some(r=>r.accountId===a.id&&localDay(new Date(r.date))===day&&r.signature===accountReviewSignature(state,a)));
  if(!state.accounts.length)return toast('Add an account first');
  if(missing.length){$('dayReviewStatus').textContent='Check these balances first: '+missing.map(a=>a.name).join(', ');document.querySelector('.reconcile-section').scrollIntoView({behavior:'smooth'});return;}
  state.closedDays=state.closedDays||[];
  state.closedDays=state.closedDays.filter(d=>d.day!==day);
  state.closedDays.push({day,date:new Date().toISOString(),accounts:state.accounts.map(a=>({id:a.id,balance:a.balance,signature:accountReviewSignature(state,a)}))});
  save();$('dayReviewStatus').textContent='Daily review completed for '+formatDate(day+'T12:00:00');toast('Daily review saved');
};
$('closeDayBtn').textContent='Complete daily review';
const renderBeforeForms=render;
render=function(){
  renderBeforeForms();
  const last=state.closedDays?.at(-1);
  $('dayReviewStatus').textContent=last?'Last completed review: '+formatDate(last.day+'T12:00:00'):'No completed daily review yet';
};
$('filter').onchange=render;
render();
