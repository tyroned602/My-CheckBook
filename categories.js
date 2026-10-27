// Categories describe the purchase; context describes which part of life it belongs to.
const spendingCategories = ['Needs review', 'Groceries', 'Eating out', 'Gas', 'Household', 'Subscriptions', 'Business supplies', 'Resale inventory', 'Water', 'Laundry', 'Storage', 'Insurance', 'Health & fitness', 'Other'];
const receiptCategories = ['Needs review', 'Sales income', 'Other income', 'Refund', 'Cashback', 'Transfer'];
const categoryEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function suggestCategory(t) {
  if (t.isAdjustment) return 'Balance adjustment';
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
  if (/\bqt\b|quiktrip|circle\s*k|circlek|arco|shell|chevron|safeway|fry|walmart|wal-mart|wm supercenter|goodwill|savers|autozone|dollar tree|zip\*/.test(merchant)) return 'Needs review';
  if (/mcdonald|taco bell|burger king|wendy|subway|starbucks/.test(merchant)) return 'Eating out';
  if (/watermill/.test(merchant)) return 'Water';
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
    if(category === 'Transfer') {transfers += Math.abs(t.amount);continue;}
    if(t.amount > 0) {receipts += t.amount;continue;}
    totals.set(category,(totals.get(category)||0)-t.amount);
  }
  const spent = [...totals.values()].reduce((a,b)=>a+b,0);
  $('categoryTotals').textContent = `Purchases ${money(spent)} · Money received ${money(receipts)} · Transfer activity ${money(transfers)}`;
  $('categoryBreakdown').innerHTML = [...totals].sort((a,b)=>b[1]-a[1]).map(([category,total])=>`<details class="category-detail"><summary><span>${categoryEscape(category)}</span><strong>${money(total)}</strong></summary>${visible.filter(t=>t.amount<0&&suggestCategory(t)===category).map(t=>`<p>${formatDate(t.date)} · ${categoryEscape(t.merchant)} <strong>${money(t.amount)}</strong></p>`).join('')}</details>`).join('') || '<p class="backup-copy">No purchases for this selection.</p>';
}

const renderLedgerWithCategories = render;
render = function() {
  renderLedgerWithCategories();
  const total = state.accounts.filter(a=>a.type!=='Credit card').reduce((s,a)=>s+Number(a.balance),0);
  $('cashTotal').textContent = (total<0?'-':'') + money(total);
  // Give old imported entries the same visible suggestions, without altering balances.
  document.querySelectorAll('#transactions .tx-row').forEach((row,i)=>{
    const tx = state.transactions.filter(t=>$('filter').value==='Everything'||t.context===$('filter').value).slice().reverse()[i];
    if(tx && !tx.isAdjustment) row.querySelector('.tx-meta').textContent = `${suggestCategory(tx)} · ${tx.context} · ${tx.account}`;
  });
  renderCategoryReview();
};
$('categoryMonth').onchange = renderCategoryReview;
$('categoryContext').onchange = renderCategoryReview;
$('categoryReviewList').addEventListener('submit', e=>{
  const form = e.target.closest('[data-category-form]');
  if(!form)return;
  e.preventDefault();
  const t = state.transactions.find(t=>String(t.id)===form.dataset.categoryForm);
  if(!t)return;
  const category = form.elements.category.value;
  if(category==='Needs review')return toast('Choose a category before saving');
  t.category=category;
  t.context=form.elements.context.value;
  t.categoryConfirmed=true;
  t.needsReview=false;
  save();
  toast('Category saved');
});
render();
