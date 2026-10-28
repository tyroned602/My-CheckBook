const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('imports.js','utf8');
const ctx=vm.createContext({});
vm.runInContext(source.split('const originalPayPalParser')[0],ctx);
const manual={id:'manual-1',merchant:'QT',amount:-10,account:'PayPal Business',date:'2026-10-25T12:00:00',category:'Gas',context:'Personal'};
const ledger={accounts:[{name:'PayPal Business',balance:73.37}],transactions:[manual]};
const item={id:'paypal-ABC',externalId:'ABC',merchant:'QT 481 INSIDE',amount:-10,date:'2026-10-26T12:00:00',description:'Card purchase'};
const before=JSON.stringify(ledger);
assert.equal(ctx.possibleImportMatches(ledger,'PayPal Business',item).length,1);
assert.equal(ctx.possibleImportMatches(ledger,'Cash',item).length,0);
assert.equal(ctx.possibleImportMatches(ledger,'PayPal Business',{...item,amount:-11}).length,0);
assert.equal(ctx.possibleImportMatches(ledger,'PayPal Business',{...item,date:'2026-11-01T12:00:00'}).length,0);
const linked=ctx.planStatementImport(ledger,'PayPal Business',[{transaction:item,action:'link',manualId:'manual-1'}]);
assert.equal(linked.next.accounts[0].balance,73.37);
assert.equal(linked.next.transactions.length,1);
assert.equal(linked.next.transactions[0].externalId,'ABC');
assert.equal(linked.next.transactions[0].category,'Gas');
assert.equal(JSON.stringify(ledger),before);
const added=ctx.planStatementImport(ledger,'PayPal Business',[{transaction:item,action:'add'},{transaction:item,action:'add'}]);
assert.equal(added.added,1);assert.equal(added.skipped,1);
assert.equal(added.next.accounts[0].balance,63.37);
const again=ctx.planStatementImport(linked.next,'PayPal Business',[{transaction:item,action:'add'}]);
assert.equal(again.skipped,1);assert.equal(again.next.accounts[0].balance,73.37);
assert.throws(()=>ctx.planStatementImport(ledger,'PayPal Business',[
  {transaction:item,action:'link',manualId:'manual-1'},
  {transaction:{...item,externalId:'DEF'},action:'link',manualId:'manual-1'}
]));
assert.throws(()=>ctx.planStatementImport(ledger,'Missing',[]));
console.log('Passed import matching, safe linking, within-batch deduplication, repeated-import checks, and unchanged source ledger.');
