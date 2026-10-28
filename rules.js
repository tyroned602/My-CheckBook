const defaultMerchantRules=[
  {id:'qt',aliases:['qt','quiktrip'],category:'Gas',context:'Personal'},
  {id:'frys',aliases:['frys','fry s'],category:'Groceries',context:'Personal'},
  {id:'walmart',aliases:['walmart','wal mart','wm supercenter'],category:'Personal items',context:'Personal'},
  {id:'savers',aliases:['savers'],category:'Resale inventory',context:'Reselling'},
  {id:'goodwill',aliases:['goodwill'],category:'Resale inventory',context:'Reselling'},
  {id:'circlek',aliases:['circlek','circle k'],category:'Gas',context:'Personal'},
  {id:'zip',aliases:['zip app pay later','zip pay later'],category:'Loans',context:'Personal'},
  {id:'watermill',aliases:['watermill','water mill'],category:'Groceries',subcategory:'Water',context:'Personal'}
];
function normalizeRuleMerchant(value){return String(value||'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function getMerchantRules(ledger){return Array.isArray(ledger.merchantRules)?ledger.merchantRules:defaultMerchantRules;}
function matchingMerchantRule(ledger,t){
  if(t.isAdjustment||t.transferId||t.category==='Transfer'||t.amount>=0||t.categoryConfirmed)return null;
  const merchant=' '+normalizeRuleMerchant(t.merchant)+' ';
  return getMerchantRules(ledger).find(r=>r.enabled!==false&&r.aliases.some(a=>merchant.includes(' '+normalizeRuleMerchant(a)+' ')))||null;
}
function applyCategoryRules(ledger){
  for(const t of ledger.transactions){
    if(t.isAdjustment||t.transferId||t.category==='Transfer'||t.categoryConfirmed)continue;
    const rule=matchingMerchantRule(ledger,t);
    if(rule){t.category=rule.category;t.context=rule.context;t.subcategory=rule.subcategory||'';t.categorySource='merchant-rule';t.needsReview=false;}
    else if(t.categorySource==='merchant-rule'){t.category='Needs review';t.subcategory='';t.categorySource='';t.needsReview=true;}
  }
}
