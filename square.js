function readCsvRecords(text){
  const records=[];let row=[],cell='',quoted=false;
  text=String(text).replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(s=>s.trim()))records.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('CSV has an unfinished quoted field');
  row.push(cell);if(row.some(s=>s.trim()))records.push(row);
  if(!records.length)throw Error('CSV is empty');
  const headers=records.shift().map(h=>h.trim());
  for(const h of ['Date','Details','Amount','Balance','Activity Type','Status'])if(!headers.includes(h))throw Error('Choose the Square all-activity CSV');
  return records.map(values=>{if(values.length!==headers.length)throw Error('CSV has a row with missing columns');return Object.fromEntries(headers.map((h,i)=>[h,values[i]]));});
}
function squareAmountCents(text){
  const raw=String(text).trim();
  if(!/^-?\$?(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}$/.test(raw))throw Error('Square CSV has an invalid amount');
  const value=Math.round(Number(raw.replace(/[$,]/g,''))*100);
  if(!Number.isSafeInteger(value))throw Error('Square amount is too large');return value;
}
function parseSquareCsv(text){
  const rows=readCsvRecords(text);let excluded=0;
  const transactions=rows.flatMap(row=>{
    if(row.Status!=='Completed'){excluded++;return [];}
    if(!['Sales','Card spend'].includes(row['Activity Type']))throw Error(`Square activity needs separate handling: ${row['Activity Type']}. Nothing imported.`);
    const m=row.Date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);if(!m)throw Error('Square CSV has an invalid date');
    const year=m[3].length===2?'20'+m[3]:m[3],day=year+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
    const d=new Date(day+'T12:00:00');if(!Number.isFinite(d.getTime())||d.getFullYear()!==Number(year)||d.getMonth()+1!==Number(m[1])||d.getDate()!==Number(m[2]))throw Error('Square CSV has an invalid calendar date');
    const cents=squareAmountCents(row.Amount),balanceCents=squareAmountCents(row.Balance);
    if(!row.Details.trim()||cents===0||row['Activity Type']==='Sales'&&cents<0||row['Activity Type']==='Card spend'&&cents>0)throw Error('Square row needs review before importing');
    const key=JSON.stringify([day,row.Details.trim(),cents,balanceCents,row['Activity Type']]);
    return [{id:'square-'+key,externalId:'square:'+key,merchant:row.Details.trim(),amount:cents/100,date:day+'T12:00:00',source:'square-csv',statementBalance:balanceCents/100,activityType:row['Activity Type'],context:cents>0?'Detailing':'Personal',category:cents>0?'Service income':'Needs review',categoryConfirmed:cents>0,incomeSource:cents>0?'Detailing':'',paymentMethod:cents>0?'Square':'Card',description:`Square ${row['Activity Type']}`,sourceCategory:row.Category||'',sourceExpenseType:row['Expense Type']||''}];
  });
  if(!transactions.length)throw Error('No completed Square activity found');
  const validOrder=list=>list.every((t,i)=>i===0||new Date(t.date)>=new Date(list[i-1].date)&&Math.round(t.statementBalance*100)===Math.round(list[i-1].statementBalance*100)+Math.round(t.amount*100));
  let ordered=transactions;
  if(!validOrder(ordered)){ordered=transactions.slice().reverse();if(!validOrder(ordered))throw Error('Square running balances do not reconcile. Check for missing or duplicated rows.');}
  const seen=new Set();for(const t of ordered){if(seen.has(t.externalId))throw Error('Square CSV has repeated identical activity — review the file');seen.add(t.externalId);}
  const first=ordered[0],last=ordered.at(-1);
  return {transactions:ordered,excluded,openingCents:Math.round(first.statementBalance*100)-Math.round(first.amount*100),closingCents:Math.round(last.statementBalance*100),inCents:ordered.filter(t=>t.amount>0).reduce((s,t)=>s+Math.round(t.amount*100),0),outCents:-ordered.filter(t=>t.amount<0).reduce((s,t)=>s+Math.round(t.amount*100),0)};
}
function prepareSquareImport(ledger,batch,accountName,selections){
  const next=JSON.parse(JSON.stringify(ledger));
  let account=next.accounts.find(a=>a.name===accountName);
  if(!account){
    if(batch.openingCents!==0)throw Error('This file starts with a nonzero balance. Add and reconcile the Square account before importing.');
    if(next.accounts.some(a=>a.name.toLowerCase()===accountName.toLowerCase()))throw Error('Choose the existing Square account');
    account={id:crypto.randomUUID(),name:accountName,type:'Business',balance:0};next.accounts.push(account);
  }
  const plan=planStatementImport(next,accountName,selections);
  for(const selection of selections){
    const imported=selection.transaction,t=plan.next.transactions.find(t=>t.externalId===imported.externalId);
    if(!t)continue;
    Object.assign(t,{source:'square-csv',statementBalance:imported.statementBalance,sourceCategory:imported.sourceCategory,sourceExpenseType:imported.sourceExpenseType});
    if(imported.amount>0){t.incomeSource=t.incomeSource||'Detailing';t.paymentMethod=t.paymentMethod||'Square';if(!t.categoryConfirmed){t.category='Service income';t.context='Detailing';t.categoryConfirmed=true;}}
  }
  for(const t of plan.next.transactions.filter(t=>t.source==='square-csv'))t.note='Imported from Square all-activity CSV';
  return plan;
}
let squareBatch=null;
function renderSquarePreview(){
  if(!squareBatch)return;
  const batch=squareBatch,account=$('squareAccount').value||'Square';
  const seen=new Set([...state.transactions.map(t=>t.externalId),...trashPayPalIds(state)]);
  const fresh=batch.transactions.filter(t=>!seen.has(t.externalId));
  $('squarePreview').classList.remove('hidden');
  $('squarePreview').innerHTML=`<p class="backup-copy">Activity ${formatDate(batch.transactions[0].date)} – ${formatDate(batch.transactions.at(-1).date)}. Sales credits ${money(batch.inCents/100)}; card purchases ${money(batch.outCents/100)}. Opening balance ${signed(batch.openingCents/100)}; last recorded balance ${signed(batch.closingCents/100)}. ${batch.transactions.length-fresh.length} already imported or removed; ${batch.excluded} non-completed rows excluded.</p><p class="backup-copy">Sales credits will be Detailing income received in Square. Purchases follow your merchant defaults. This file does not establish gross sales or processing fees. IDs are matched from the CSV’s date, merchant, amount, balance, and activity type.</p>${fresh.map((t,i)=>{
    const matches=possibleImportMatches(state,account,t);
    return `<div class="statement-item"><label class="import-row"><input type="checkbox" data-square-index="${batch.transactions.indexOf(t)}" checked><span><strong>${categoryEscape(t.merchant)}</strong><small>${formatDate(t.date)} · ${categoryEscape(t.activityType)}</small></span><strong>${signed(t.amount)}</strong></label>${matches.length?`<label class="import-label">Possible existing entry<select data-square-choice="${batch.transactions.indexOf(t)}"><option value="">Choose link or add…</option>${matches.map(m=>`<option value="${categoryEscape(m.id)}">Link ${categoryEscape(m.merchant)} · ${formatDate(m.date)}</option>`).join('')}<option value="add">Add separately</option></select></label>`:''}</div>`;
  }).join('')}<button class="save-btn" id="saveSquareImport" ${fresh.length?'':'disabled'}>Import selected Square activity</button><button class="starting-btn text-btn" id="cancelSquareImport">Cancel</button>`;
  $('cancelSquareImport').onclick=()=>{squareBatch=null;$('squarePreview').classList.add('hidden');};
  $('saveSquareImport').onclick=()=>{
    try{
      const selections=[...document.querySelectorAll('[data-square-index]:checked')].map(box=>{const index=Number(box.dataset.squareIndex),choice=document.querySelector(`[data-square-choice="${index}"]`);if(choice&&!choice.value)throw Error('Choose Link or Add for possible matches');return {transaction:batch.transactions[index],action:!choice||choice.value==='add'?'add':'link',manualId:choice?.value};});
      if(!selections.length)throw Error('Select at least one Square item');
      const plan=prepareSquareImport(state,batch,account,selections);
      const checked=validateLedgerBackup(plan.next);keepRecovery(state,'Before Square CSV import');state=checked;save();
      squareBatch=null;$('squarePreview').innerHTML=`<p class="backup-copy" role="status">Square import complete: ${plan.added} added, ${plan.linked} linked, ${plan.skipped} duplicates skipped. New account balance: ${signed(state.accounts.find(a=>a.name===account).balance)}. Purchases are included in Reports.</p>`;toast('Square activity saved');
    }catch(error){toast(error.message);}
  };
}
function renderSquareAccounts(){
  const old=$('squareAccount').value;
  $('squareAccount').innerHTML='<option value="">Create Square account at zero</option>'+state.accounts.filter(a=>a.type!=='Cash'&&a.type!=='Credit card'&&/square/i.test(a.name)).map(a=>`<option value="${categoryEscape(a.name)}" ${a.name===old||!old&&a.name.toLowerCase()==='square'?'selected':''}>${categoryEscape(a.name)}</option>`).join('');
}
$('chooseSquareCsv').onclick=()=>$('squareCsvFile').click();
$('squareCsvFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{squareBatch=parseSquareCsv(await file.text());renderSquareAccounts();renderSquarePreview();}catch(error){squareBatch=null;$('squarePreview').classList.add('hidden');toast(error.message);}
  e.target.value='';
};
$('squareAccount').onchange=renderSquarePreview;
const renderBeforeSquare=render;
render=function(){renderBeforeSquare();renderSquareAccounts();};
$('filter').onchange=renderHistoryView;
render();
