// updated_at is checked by the database in the same operation as the write.
let syncRevision=null,syncUser=null,syncReady=false,syncBusy=false,syncConflict=null;
let syncChanges=0,syncPending=false;
const copyLedger=value=>JSON.parse(JSON.stringify(value));
function syncMessage(message){$('syncStatus').textContent=message;}
function keepRecovery(data,reason){
  const copies=JSON.parse(localStorage.getItem('checkbook-recovery')||'[]');
  copies.unshift({date:new Date().toISOString(),reason,data:copyLedger(data)});
  localStorage.setItem('checkbook-recovery',JSON.stringify(copies.slice(0,5)));
}
function clearConflict(){syncConflict=null;$('syncConflict').classList.add('hidden');}
save=function(){
  syncChanges++;syncPending=true;render();
  try{localStorage.setItem('checkbook',JSON.stringify(state));}
  catch{return syncMessage('Device storage full — download a backup');}
  syncMessage('Saved on this device');
  if(syncReady)uploadCloud();
};
syncNow=async function(){
  if(!cloud||syncBusy)return;
  syncBusy=true;
  try{
    const {data:{user},error:authError}=await cloud.auth.getUser();
    if(authError||!user){syncReady=false;return syncMessage('Sign in to sync');}
    if(syncUser!==user.id){syncReady=false;syncRevision=null;}
    syncUser=user.id;
    const {data:remote,error}=await cloud.from('ledgers').select('data,updated_at').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(remote&&JSON.stringify(remote.data)!==JSON.stringify(state)){
      syncReady=false;syncConflict=remote;
      $('syncConflict').classList.remove('hidden');
      const describe=ledger=>(ledger.accounts||[]).map(a=>`${a.name}: ${Number(a.balance).toLocaleString('en-US',{style:'currency',currency:'USD'})}`).join('; ');
      $('syncConflictSummary').textContent=`This device: ${state.transactions.length} transactions (${describe(state)}). Cloud: ${remote.data.transactions?.length||0} transactions (${describe(remote.data)}). Choose the copy to use. A recovery copy is kept before replacement.`;
      return syncMessage('Device and cloud differ — choose a copy');
    }
    syncRevision=remote?.updated_at||null;syncReady=true;clearConflict();
    syncPending=!remote;
    syncMessage('Up to date · '+new Date().toLocaleTimeString());
  }catch{syncReady=false;syncMessage('Connection failed — device copy retained');}
  finally{syncBusy=false;}
  if(syncReady&&syncPending)await uploadCloud();
};
uploadCloud=async function(){
  if(!cloud||!syncReady||!syncUser||syncBusy)return;
  syncBusy=true;
  const changes=syncChanges,previous=syncRevision;
  try{
    syncMessage('Syncing…');
    const nextTime=Math.max(Date.now(),(Date.parse(previous)||0)+1);
    const row={user_id:syncUser,data:copyLedger(state),updated_at:new Date(nextTime).toISOString()};
    const result=previous
      ? await cloud.from('ledgers').update(row).eq('user_id',syncUser).eq('updated_at',previous).select('updated_at')
      : await cloud.from('ledgers').insert(row).select('updated_at');
    if(result.error||!result.data?.length){syncReady=false;return syncMessage('Cloud changed or save failed — Sync now to compare');}
    syncRevision=result.data[0].updated_at;syncPending=changes!==syncChanges;
    syncMessage('Last synced '+new Date().toLocaleTimeString());
  }catch{syncReady=false;syncMessage('Connection failed — saved on device; use Sync now');}
  finally{syncBusy=false;}
  if(syncReady&&syncPending&&previous!==syncRevision)await uploadCloud();
};
refreshCloudSession=async function(){
  if(!cloud)return;
  try{
    const {data,error}=await cloud.auth.getSession();if(error)throw error;
    if(!data.session)return;
    $('authForm').classList.add('hidden');$('syncControls').classList.remove('hidden');
    $('syncTitle').textContent='Cloud sync · '+data.session.user.email;
    await syncNow();
  }catch{syncMessage('Sign-in service unavailable — device copy retained');}
};
$('syncNowBtn').onclick=syncNow;
$('useCloudLedger').onclick=()=>{
  if(!syncConflict)return;
  try{
    keepRecovery(state,'Device copy before cloud restore');
    const remote=syncConflict;state=copyLedger(remote.data);normalizeState();render();
    localStorage.setItem('checkbook',JSON.stringify(state));
    syncRevision=remote.updated_at;syncReady=true;syncPending=false;clearConflict();
    syncMessage('Cloud copy loaded — previous device copy in recovery');
  }catch{syncMessage('Could not preserve recovery copy — download a backup first');}
};
$('useDeviceLedger').onclick=async()=>{
  if(!syncConflict)return;
  try{keepRecovery(state,'Device copy before sync');keepRecovery(syncConflict.data,'Cloud copy before replacement');}
  catch{return syncMessage('Recovery storage full — download a backup first');}
  syncRevision=syncConflict.updated_at;syncReady=true;syncPending=true;clearConflict();await uploadCloud();
};
$('downloadRecovery').onclick=()=>{
  const copies=JSON.parse(localStorage.getItem('checkbook-recovery')||'[]');
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:'checkbook-recovery',copies},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='checkbook-recovery-copies.json';a.click();URL.revokeObjectURL(url);
};
const originalSignOut=$('signOutBtn').onclick;
$('signOutBtn').onclick=async()=>{syncReady=false;syncUser=null;syncRevision=null;clearConflict();await originalSignOut();};
window.addEventListener('offline',()=>syncMessage('Offline — changes save on this device'));
refreshCloudSession();
