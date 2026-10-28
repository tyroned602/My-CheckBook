// Categories describe the purchase; context describes which part of life it belongs to.
const spendingCategories = ['Needs review', 'Groceries', 'Eating out', 'Gas', 'Personal items', 'Household', 'Subscriptions', 'Loans', 'Business supplies', 'Resale inventory', 'Water', 'Laundry', 'Storage', 'Insurance', 'Health & fitness', 'Other'];
const receiptCategories = ['Needs review', 'Sales income', 'Other income', 'Refund', 'Cashback', 'Transfer'];
const categoryEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function isPersonalGasPurchase(t) {
  return !t.isAdjustment && t.amount < 0 && t.category !== 'Transfer' && /\bqt\b|\bquiktrip\b/i.test(String(t.merchant || ''));
}
function isPersonalGroceryPurchase(t) {
  return !t.isAdjustment && t.amount < 0 && t.category !== 'Transfer' && /\bfry(?:['’]?s)?\b/i.test(String(t.merchant || ''));
}
function isPersonalItemsPurchase(t) {
  return !t.isAdjustment && t.amount < 0 && t.category !== 'Transfer' && /walmart|wal-mart|wm supercenter/i.test(String(t.merchant || ''));
}
function isResaleInventoryPurchase(t) {
  return !t.isAdjustment && t.amount < 0 && t.category !== 'Transfer' && /\bsavers\b|\bgoodwill\b/i.test(String(t.merchant || ''));
}
function isCircleKGasPurchase(t) {
  return !t.isAdjustment && t.amount < 0 && t.category !== 'Transfer' && /circle\s*k|circlek/i.test(String(t.merchant || ''));
}
function isLoanPayment(t) {
  return !t.isAdjustment && t.amount < 0 && t.category !== 'Transfer' && /zip\*\s*(app\s*)?pay\s*later|zip\*\s*app\s*pay\s*later/i.test(String(t.merchant || ''));
}
function suggestCategory(t) {
  if (t.isAdjustment) return 'Balance adjustment';
  if (t.category === 'Water' || /watermill|water mill/i.test(t.merchant || '')) return 'Groceries';
  if (isPersonalGasPurchase(t)) return 'Gas';
  if (isPersonalGroceryPurchase(t)) return 'Groceries';
  if (isPersonalItemsPurchase(t)) return 'Personal items';
  if (isResaleInventoryPurchase(t)) return 'Resale inventory';
  if (isCircleKGasPurchase(t)) return 'Gas';
  if (isLoanPayment(t)) return 'Loans';
  if (t.categoryConfirmed) return t.category;
  // Preserve specific choices made with the existing transaction editor.
  if (t.category && !['General', 'Gas', 'Inventory', 'Supplies', 'Income', 'Needs review'].includes(t.category)) return t.category;
  const merchant = String(t.merchant || '').toLowerCase();
  if (t.category === 'Transfer') return 'Transfer';
  if (t.amount > 0) {
    if (/cashback|cash back/.test(merchant + ' ' + (t.description || ''))) return 'Cashback';
    // Positive card entries may be payouts or refunds; ask instead of treating all as income.
    return 'Needs review';
  }
  if (/arco|shell|chevron|safeway|fry|walmart|wal-mart|wm supercenter|goodwill|savers|autozone|dollar tree|zip\*/.test(merchant)) return 'Needs review';
  if (/mcdonald|taco bell|burger king|wendy|subway|starbucks/.test(merchant)) return 'Eating out';
  if (/watermill/.test(merchant)) return 'Groceries';
  if (/laundry/.test(merchant)) return 'Laundry';
  if (/extra space/.test(merchant)) return 'Storage';
  if (/simply business/.test(merchant)) return 'Insurance';
  return 'Needs review';
}

// Use the same conservative suggestions for new PayPal imports.
classifyImported = function(merchant, amount, description) {
  return {context:'Personal', category:suggestCategory({merchant,amount,description}), needsReview:/^Other:/i.test(description)};
};

function monthOfTransaction(t) { return String(t.date || '').slice(0,7); }
function transactionSubcategory(t) {
  return suggestCategory(t)==='Groceries' && (t.subcategory==='Water'||t.category==='Water'||/watermill|water mill/i.test(t.merchant||'')) ? 'Water' : '';
}
function subcategorySummary(category, visible, total) {
  if(category!=='Groceries')return '';
  const water = visible.filter(t=>t.amount<0&&transactionSubcategory(t)==='Water').reduce((sum,t)=>sum-t.amount,0);
  return water>0 ? `<p class="subcategory-summary">Water · ${(water/total*100).toFixed(1)}% of Groceries <strong>${money(water)}</strong></p>` : '';
}
function interactiveSpendingPie(slices, spent, colors) {
  const icons = {'Groceries':'🛒','Gas':'⛽','Resale inventory':'📦','Eating out':'🍽️','Personal items':'🛍️','Loans':'🏦','Storage':'🔐','Insurance':'🛡️','Laundry':'🧺','Subscriptions':'🔄','Business supplies':'🧰','Household':'🏠','Health & fitness':'💪','Needs review':'❓','Other':'•••'};
  let angle=-Math.PI/2;
  const pieces=slices.map(([name,value],i)=>{
    const share=value/spent, end=angle+share*Math.PI*2, mid=(angle+end)/2;
    const point=a=>[160+125*Math.cos(a),160+125*Math.sin(a)];
    const a=point(angle),b=point(end);
    const path=share>.999999?'M 160 35 A 125 125 0 1 1 160 285 A 125 125 0 1 1 160 35 Z':`M160 160 L${a.join(' ')} A125 125 0 ${share>.5?1:0} 1 ${b.join(' ')} Z`;
    angle=end;
    const label=`${name}: ${(share*100).toFixed(1)}%, ${money(value)}`;
    return `<g class="pie-slice" data-slice="${i}" tabindex="0" role="button" aria-label="${categoryEscape(label)}" aria-pressed="false" style="--lift-x:${Math.cos(mid)*7}px;--lift-y:${Math.sin(mid)*7}px"><title>${categoryEscape(label)}</title><path d="${path}" fill="${colors[i%colors.length]}" stroke="#15211b" stroke-width="2"/>${share>=.075?`<text x="${160+83*Math.cos(mid)}" y="${160+83*Math.sin(mid)-5}" text-anchor="middle" class="pie-label"><tspan>${icons[name]||'●'}</tspan><tspan x="${160+83*Math.cos(mid)}" dy="18">${(share*100).toFixed(1)}%</tspan></text>`:''}</g>`;
  }).join('');
  return `<figure class="spending-figure"><svg class="interactive-pie" viewBox="0 0 320 320" aria-label="Spending by category">${pieces}</svg><div class="pie-detail" id="pieDetail" aria-live="polite"><strong>${money(spent)} in purchases</strong><span>Tap a slice or category for details</span></div><figcaption><p class="backup-copy">Icons label larger slices. Select any category below for its full details. Percentages are before refunds.</p><ul class="pie-legend">${slices.map(([name,value],i)=>`<li><button type="button" class="pie-legend-button" data-slice="${i}" aria-pressed="false"><span class="pie-key" style="background:${colors[i%colors.length]}"></span><span>${icons[name]||'●'} ${categoryEscape(name)}</span><strong>${(value/spent*100).toFixed(1)}% · ${money(value)}</strong></button></li>`).join('')}</ul></figcaption></figure>`;
}
function renderCategoryReview() {
  const tx = state.transactions.filter(t => !t.isAdjustment);
  const months = [...new Set(tx.map(monthOfTransaction).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();
  const selected = $('categoryMonth').value;
  $('categoryMonth').innerHTML = months.map(m => `<option value="${m}" ${m===selected?'selected':''}>${new Date(m+'-15T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'})}</option>`).join('');
  const month = $('categoryMonth').value;
  const context = $('categoryContext').value;
  const visible = tx.filter(t => monthOfTransaction(t) === month && (context === 'All' || t.context === context));
  const pending = visible.filter(t => suggestCategory(t) === 'Needs review');
  $('categoryReviewCount').textContent = `${pending.length} to review`;
  $('categoryReviewList').innerHTML = pending.slice(0,10).map(t => {
    const choices = t.amount < 0 ? [...spendingCategories,'Transfer'] : receiptCategories;
    return `<form class="category-review-row" data-category-form="${categoryEscape(t.id)}"><div class="section-head"><strong>${categoryEscape(t.merchant)}</strong><strong>${signed(t.amount)}</strong></div><p class="tx-date">${formatDate(t.date)} · ${categoryEscape(t.account)}</p><label>Category<select name="category" required>${choices.map(c=>`<option>${c}</option>`).join('')}</select></label><label>Personal or business<select name="context">${['Personal','Reselling','Detailing'].map(c=>`<option ${c===t.context?'selected':''}>${c}</option>`).join('')}</select></label><button class="save-btn">Save category</button></form>`;
  }).join('') || '<p class="backup-copy">Nothing needs review for this selection.</p>';
  if(pending.length>10) $('categoryReviewList').insertAdjacentHTML('beforeend','<p class="backup-copy">Showing 10 at a time. More will appear as you save.</p>');
  const totals = new Map();
  let receipts = 0, transfers = 0;
  for(const t of visible) {
    const category = suggestCategory(t);
    if(category === 'Transfer') {if(t.amount<0)transfers += Math.abs(t.amount);continue;}
    if(t.amount > 0) {receipts += t.amount;continue;}
    totals.set(category,(totals.get(category)||0)-t.amount);
  }
  const spent = [...totals.values()].reduce((a,b)=>a+b,0);
  let chart = $('spendingChart');
  if (!chart) {
    chart = document.createElement('div');
    chart.id = 'spendingChart';
    $('categoryBreakdown').before(chart);
  }
  const colors = ['#8de6b1','#80bfff','#ffbd80','#d4a5ff','#ff91ad','#ffe080','#58d3ce','#b9cf78','#adadff','#e8a878','#a4dbe8','#e7b7cf','#c9d5df','#a3bd95','#d8c0a0','#b69ee0','#f09e92','#8eaecb'];
  const slices = [...totals].filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]);
  let position = 0;
  const stops = slices.map(([,value],i)=>{
    const start = position;
    position += value / spent * 100;
    return `${colors[i%colors.length]} ${start}% ${position}%`;
  });
  chart.innerHTML = spent>0 ? interactiveSpendingPie(slices,spent,colors) : '<p class="backup-copy">The chart will appear when this selection has spending.</p>';
  const highlight = index => {
    chart.querySelectorAll("[data-slice]").forEach(el=>{const active=el.dataset.slice===index;el.classList.toggle("selected",active);el.setAttribute("aria-pressed",String(active));});
    const [name,value]=slices[Number(index)];
    $("pieDetail").innerHTML=`<strong>${categoryEscape(name)} · ${(value/spent*100).toFixed(1)}%</strong><span>${money(value)} of ${money(spent)} in purchases</span>`;
  };
  chart.querySelectorAll("[data-slice]").forEach(el=>{
    el.addEventListener("pointerenter",()=>highlight(el.dataset.slice));
    el.addEventListener("focus",()=>highlight(el.dataset.slice));
    el.addEventListener("click",()=>highlight(el.dataset.slice));
    el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();highlight(el.dataset.slice);}});
  });
  $('categoryTotals').textContent = `Purchases ${money(spent)} · Money received ${money(receipts)} · Transfer activity ${money(transfers)}`;
  $('categoryBreakdown').innerHTML = [...totals].sort((a,b)=>b[1]-a[1]).map(([category,total])=>`<details class="category-detail"><summary><span>${categoryEscape(category)}</span><strong>${money(total)}</strong></summary>${subcategorySummary(category,visible,total)}${visible.filter(t=>t.amount<0&&suggestCategory(t)===category).map(t=>`<p>${formatDate(t.date)} · ${categoryEscape(t.merchant)} <strong>${money(t.amount)}</strong></p>`).join('')}</details>`).join('') || '<p class="backup-copy">No purchases for this selection.</p>';
}

const renderLedgerWithCategories = render;
render = function() {
  state.transactions.filter(t=>!t.isAdjustment&&(t.category==='Water'||/watermill|water mill/i.test(t.merchant||''))).forEach(t=>{
    t.category='Groceries';
    t.subcategory='Water';
    t.context='Personal';
    t.needsReview=false;
  });
  // Tyrone's merchant preference applies to existing entries and future captures.
  state.transactions.filter(isPersonalGasPurchase).forEach(t => {
    t.category = 'Gas';
    t.context = 'Personal';
    t.needsReview = false;
  });
  state.transactions.filter(isPersonalGroceryPurchase).forEach(t => {
    t.category = 'Groceries';
    t.context = 'Personal';
    t.needsReview = false;
  });
  state.transactions.filter(isPersonalItemsPurchase).forEach(t => {
    t.category = 'Personal items';
    t.context = 'Personal';
    t.needsReview = false;
  });
  state.transactions.filter(isResaleInventoryPurchase).forEach(t => {
    t.category = 'Resale inventory';
    t.context = 'Reselling';
    t.needsReview = false;
  });
  state.transactions.filter(isCircleKGasPurchase).forEach(t => {
    t.category = 'Gas';
    t.context = 'Personal';
    t.needsReview = false;
  });
  state.transactions.filter(isLoanPayment).forEach(t => {
    t.category = 'Loans';
    t.context = 'Personal';
    t.needsReview = false;
  });
  renderLedgerWithCategories();
  const total = state.accounts.filter(a=>a.type!=='Credit card').reduce((s,a)=>s+Number(a.balance),0);
  $('cashTotal').textContent = (total<0?'-':'') + money(total);
  // Give old imported entries the same visible suggestions, without altering balances.
  document.querySelectorAll('#transactions .tx-row').forEach((row,i)=>{
    const tx = state.transactions.filter(t=>$('filter').value==='Everything'||t.context===$('filter').value).slice().reverse()[i];
    if(tx && !tx.isAdjustment) row.querySelector('.tx-meta').textContent = `${suggestCategory(tx)}${transactionSubcategory(tx)?" → "+transactionSubcategory(tx):""} · ${tx.context} · ${tx.account}`;
  });
  renderCategoryReview();
};
$('categoryMonth').onchange = renderCategoryReview;
$('categoryContext').onchange = renderCategoryReview;
$('filter').onchange = render;
$('categoryReviewList').addEventListener('submit', e=>{
  const form = e.target.closest('[data-category-form]');
  if(!form)return;
  e.preventDefault();
  const t = state.transactions.find(t=>String(t.id)===form.dataset.categoryForm);
  if(!t)return;
  const category = form.elements.category.value;
  if(category==='Needs review')return toast('Choose a category before saving');
  t.category=category==='Water'?'Groceries':category;
  t.subcategory=category==='Water'?'Water':'';
  t.context=form.elements.context.value;
  t.categoryConfirmed=true;
  t.needsReview=false;
  save();
  toast('Category saved');
});
render();
