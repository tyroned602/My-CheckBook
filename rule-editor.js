function renderMerchantRuleEditor(){
  $('merchantRuleList').innerHTML=getMerchantRules(state).map(r=>`<div class="account-row"><div><strong>${categoryEscape(r.aliases.join(', '))}</strong><p class="tx-meta">${categoryEscape(r.context)} · ${categoryEscape(r.category)}${r.subcategory?' → '+categoryEscape(r.subcategory):''}${r.enabled===false?' · Paused':''}</p></div><button class="text-btn" data-edit-rule="${categoryEscape(r.id)}">Edit</button></div>`).join('');
}
function editMerchantRule(rule=null){
  const categories=spendingCategories.filter(c=>c!=='Water');
  openEditor(rule?'Edit merchant default':'Add merchant default',
    field('Merchant names (comma separated)','aliases',rule?.aliases.join(', ')||'','required maxlength="300"')+
    `<label>Category<select name="category">${categories.map(c=>`<option ${c===rule?.category?'selected':''}>${categoryEscape(c)}</option>`).join('')}</select></label><label>Subcategory<select name="subcategory"><option value="">None</option><option ${rule?.subcategory==='Water'?'selected':''}>Water</option></select></label><label>Personal or business<select name="context">${['Personal','Reselling','Detailing'].map(c=>`<option ${c===(rule?.context||'Personal')?'selected':''}>${c}</option>`).join('')}</select></label><label>Status<select name="enabled"><option value="yes">Active</option><option value="no" ${rule?.enabled===false?'selected':''}>Paused</option></select></label><p class="backup-copy">Updates matching purchases that have no individual category override. Earlier rules in this list take priority. Water is available under Groceries.</p>`,form=>{
      const aliases=[...new Set(form.aliases.value.split(',').map(a=>normalizeRuleMerchant(a)).filter(Boolean))];
      if(!aliases.length)throw Error('Enter a merchant name');
      if(form.subcategory.value&&form.category.value!=='Groceries')throw Error('Water belongs under Groceries');
      const next={id:rule?.id||crypto.randomUUID(),aliases,category:form.category.value,subcategory:form.subcategory.value,context:form.context.value,enabled:form.enabled.value==='yes'};
      keepRecovery(state,'Before editing merchant rules');
      state.merchantRules=JSON.parse(JSON.stringify(getMerchantRules(state)));
      const index=state.merchantRules.findIndex(r=>r.id===next.id);
      if(index<0)state.merchantRules.push(next);else state.merchantRules[index]=next;
      save();toast('Merchant default saved; individual choices preserved');
    });
}
$('addMerchantRule').onclick=()=>editMerchantRule();
$('merchantRuleList').addEventListener('click',e=>{const button=e.target.closest('[data-edit-rule]');if(!button)return;const rule=getMerchantRules(state).find(r=>r.id===button.dataset.editRule);if(rule)editMerchantRule(rule);});
const renderBeforeRuleEditor=render;
render=function(){renderBeforeRuleEditor();renderMerchantRuleEditor();};
$('filter').onchange=render;
render();
