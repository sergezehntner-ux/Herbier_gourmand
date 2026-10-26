let recipes = [], plan = [], shopping = [], stock = [], stockProducts = [], pendingImport = [];
let currentWeekStart = mondayISO(new Date()), viewedPlanItemId = null;
let selectionContext = null, viewedRecipeId = null, previousView = 'recipes', shoppingGroupMode = 'store';
const viewScrollPositions={library:0,home:0,recipes:0,planner:0,shopping:0,recipeView:0,restaurants:0,restaurantView:0,producers:0,producerView:0,herbs:0,herbView:0,produce:0,produceView:0,stock:0,ingredientCatalog:0};
const days = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const slots = ["Matin","Midi","Soir"];
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/æ/g,'ae').toLowerCase().trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const recipeStore='hg-recipes-v271', planStore='hg-plan-v271', shoppingStore='hg-shopping-v271', slotStore='hg-day-slots-v271', stockStore='hg-stock-v1', stockProductStore='hg-stock-products-v1', stockLocationStore='hg-stock-locations-v1';
const shoppingAssignmentStore='hg-shopping-assignments-v251';
const APP_VERSION='2.9.8.12.14';
const mealTransferStore='hg-meal-transfers-v272', weekStore='hg-current-week-v272';
const weekSlotStore='hg-week-slots-v28', aisleOrderStore='hg-aisle-order-v28';
const mealNoteStore='hg-meal-notes-v294', shoppingStoreMemory='hg-shopping-stores-v294', leftoverAckStore='hg-leftover-notice-acks-v2977';
const BACKUP_META_KEY='hg-backup-meta-v26';
const EMERGENCY_BACKUP_KEY='hg-emergency-before-import-v26';
const CHANGE_COUNTER_KEY='hg-changes-since-backup-v26';
const LAST_DEVICE_ACTION_KEY='hg-last-device-action-v2952';
const HG_DB_NAME='HerbierGourmandData', HG_DB_STORE='kv';
const HG_LOCAL_KEYS=new Set([weekStore,'hg-planning-period-v1',BACKUP_META_KEY,CHANGE_COUNTER_KEY,LAST_DEVICE_ACTION_KEY,'hg-github-config-v27','hg-herb-benefits-migrated-v1','hg-produce-benefits-migrated-v1']);
const hgCache=new Map();let hgDb=null,hgWriteQueue=Promise.resolve();
const hgLocal=window.localStorage;
function hgIsLocalKey(key){return HG_LOCAL_KEYS.has(String(key||''))}
function hgOpenDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(HG_DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(HG_DB_STORE))db.createObjectStore(HG_DB_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function hgIdbGetAll(db){return new Promise((resolve,reject)=>{const tx=db.transaction(HG_DB_STORE,'readonly'),store=tx.objectStore(HG_DB_STORE),req=store.openCursor(),out=[];req.onsuccess=()=>{const c=req.result;if(c){out.push([c.key,c.value]);c.continue()}else resolve(out)};req.onerror=()=>reject(req.error)})}
function hgIdbPut(key,value){if(!hgDb)return Promise.reject(new Error('IndexedDB Herbier non initialisé'));return new Promise((resolve,reject)=>{const tx=hgDb.transaction(HG_DB_STORE,'readwrite');tx.objectStore(HG_DB_STORE).put(String(value),String(key));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Écriture IndexedDB annulée'))})}
function hgIdbDelete(key){if(!hgDb)return Promise.reject(new Error('IndexedDB Herbier non initialisé'));return new Promise((resolve,reject)=>{const tx=hgDb.transaction(HG_DB_STORE,'readwrite');tx.objectStore(HG_DB_STORE).delete(String(key));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function hgQueue(job){
  // An earlier failure must not permanently poison subsequent writes.
  const attempt=hgWriteQueue.catch(()=>{}).then(job);
  hgWriteQueue=attempt.catch(err=>{console.error('Stockage IndexedDB Herbier',err);hgStorageError=err;});
  return attempt;
}
let hgStorageError=null;

function hgGet(key){key=String(key);return hgIsLocalKey(key)?hgLocal.getItem(key):(hgCache.has(key)?hgCache.get(key):null)}
function hgSet(key,value){key=String(key);value=String(value);if(hgIsLocalKey(key)){hgLocal.setItem(key,value);return Promise.resolve()}hgCache.set(key,value);return hgQueue(()=>hgIdbPut(key,value))}
function hgRemove(key){key=String(key);if(hgIsLocalKey(key)){hgLocal.removeItem(key);return Promise.resolve()}hgCache.delete(key);return hgQueue(()=>hgIdbDelete(key))}
async function hgFlush(){await hgWriteQueue}
function hgAllEntries(){const out=new Map(hgCache);for(let i=0;i<hgLocal.length;i++){const k=hgLocal.key(i);if(k?.startsWith('hg-'))out.set(k,hgLocal.getItem(k))}return [...out.entries()]}
async function hgStorageInit(){
  if(!('indexedDB' in window))throw new Error('IndexedDB indisponible : Herbier refuse de placer la base complète dans localStorage.');
  hgDb=await hgOpenDb();for(const [k,v] of await hgIdbGetAll(hgDb))hgCache.set(String(k),String(v));
  const migrate=[];for(let i=0;i<hgLocal.length;i++){const k=hgLocal.key(i);if(k?.startsWith('hg-')&&!hgIsLocalKey(k)){const v=hgLocal.getItem(k);if(v!==null)migrate.push([k,v])}}
  for(const [k,v] of migrate){await hgIdbPut(k,v);hgCache.set(k,v);hgLocal.removeItem(k)}
}
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;

function setStartupStatus(message){const el=$('#startupStatus');if(el)el.textContent=message}
function finishStartup(){const overlay=$('#startupOverlay');if(!overlay)return;overlay.setAttribute('aria-busy','false');overlay.classList.add('ready')}
function failStartup(error){console.error(error);const overlay=$('#startupOverlay');if(!overlay)return alert('Impossible de démarrer Herbier Gourmand.');overlay.setAttribute('aria-busy','false');overlay.classList.add('error');setStartupStatus('Le chargement des données n’a pas pu se terminer. Rien n’a été modifié.');const retry=$('#startupRetry');if(retry)retry.onclick=()=>location.reload()}

function isoDate(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function mondayISO(value){const d=new Date(value);d.setHours(12,0,0,0);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return isoDate(d)}
function addDaysISO(iso,n){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return isoDate(d)}
function dateLabel(iso){return new Intl.DateTimeFormat('fr-CH',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${iso}T12:00:00`))}
function weekLabel(start){const end=addDaysISO(start,6);return `${new Intl.DateTimeFormat('fr-CH',{day:'2-digit',month:'2-digit'}).format(new Date(`${start}T12:00:00`))} – ${new Intl.DateTimeFormat('fr-CH',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${end}T12:00:00`))}`}
function mealKey(date,slot){return `${date}|${slot}`}
function sameMeal(a,b){return a.date===b.date&&a.slot===b.slot}
function mealItems(date,slot){return plan.filter(x=>x.date===date&&x.slot===slot)}
function mealPeople(date,slot){const value=Number(mealItems(date,slot)[0]?.people);return value>=1&&value<=10?value:''}
function setMealPeople(date,slot,value){const n=Number(value),p=n>=1&&n<=10?n:null;mealItems(date,slot).forEach(x=>x.people=p);savePlanData();renderPlan();}
function savePlanData(){hgSet(planStore,JSON.stringify({version:4,weekStart:currentWeekStart,time:$('#planTime')?.value||'',items:plan.map(x=>({uid:x.uid||uid(),date:x.date,slot:x.slot,id:x.recipe.id,people:(Number(x.people)>=1&&Number(x.people)<=10?Number(x.people):null),role:x.role||'',notes:x.notes||'',preparePreviousDay:Boolean(x.preparePreviousDay),isLeftover:Boolean(x.isLeftover),leftoverSourceDate:x.leftoverSourceDate||'',leftoverPortions:Number(x.leftoverPortions)||0,leftoverIdea:x.leftoverIdea||''}))}));markDirty();if(activeViewId()==='planner')markSessionDirty('planner');}
function mealTransfers(){try{return JSON.parse(hgGet(mealTransferStore)||'{}')}catch{return{}}}
function saveMealTransfers(x){hgSet(mealTransferStore,JSON.stringify(x));markDirty()}
async function init(){
  setStartupStatus('Préparation du stockage IndexedDB…');
  await hgStorageInit();
  setStartupStatus('Préparation de l’application…');
  currentWeekStart=mondayISO(new Date());
  hgSet(weekStore,currentWeekStart);
  setStartupStatus('Chargement de vos données partagées…');
  await autoLoadSharedBackup();
  // Initialiser les encyclopédies seulement après chargement IndexedDB et sauvegarde partagée.
  window.dispatchEvent(new Event('hg:storage-ready'));
  migrateLegacyWeekSlots();
  renderDaySlotChoices();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=2981130', {updateViaCache:'none'});
  setStartupStatus('Chargement de vos recettes…');
  const stored=JSON.parse(hgGet(recipeStore)||'null');
  if(stored) recipes=stored; else recipes=await fetch(`recipes.json?_=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());
  recipes=recipes.map(normalizeRecipe);
  // Phase C : compléter uniquement les valeurs Effort/Difficulté non définies.
  // Exécution unique sur les données existantes, conservant toutes les autres propriétés.
  if(stored){
    let corrections=0;
    for(const r of recipes){
      if(!String(r.effort||'').trim() || /^non[ -]?d[eé]fini$/i.test(String(r.effort).trim())){r.effort='moyen';corrections++}
      if(!String(r.difficulty||'').trim() || /^non[ -]?d[eé]finie$/i.test(String(r.difficulty).trim())){r.difficulty='moyenne';corrections++}
    }
    if(corrections)saveRecipes();
  }
  fillCategories(); renderRecipes();
  setStartupStatus('Chargement du planning et des courses…');
  loadSaved();
  setStartupStatus('Chargement des sorties et producteurs…');
  await initRestaurants(); await initProducers();
  setStartupStatus('Chargement du Grand Herbier…');
  await initHerbs(); await initProduce(); await harmoniseValidatedStock(); initStock();
  applyReadonlyMode(); checkForUpdate();
  finishStartup();
}
function saveRecipes(){window.hgAutoLinkRecipeIngredients?.();hgSet(recipeStore,JSON.stringify(recipes));registerProtectedChange();markDirty();}
function activeViewId(){return document.querySelector('.view.active')?.id||'home'}
function rememberScroll(view=activeViewId()){viewScrollPositions[view]=scrollY}
function restoreScroll(view){requestAnimationFrame(()=>scrollTo(0,viewScrollPositions[view]||0))}
function restoreScrollStable(view,y){const target=Math.max(0,Number(y)||0);viewScrollPositions[view]=target;requestAnimationFrame(()=>requestAnimationFrame(()=>scrollTo(0,target)));setTimeout(()=>scrollTo(0,target),120)}
function keepScroll(action,view=activeViewId()){const y=scrollY;action();requestAnimationFrame(()=>scrollTo(0,y));viewScrollPositions[view]=y}
function switchView(id,{top=false}={}){const from=activeViewId();if(from!==id)rememberScroll(from);$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));if(top)viewScrollPositions[id]=0;restoreScroll(id);updateWakeLock(id);}
let plannerSessionDirty=false,shoppingSessionDirty=false,leaveGuardTarget=null,shoppingReturnContext=null;
function markSessionDirty(view=activeViewId()){if(view==='planner')plannerSessionDirty=true;if(view==='shopping')shoppingSessionDirty=true}
function resetSessionDirty(view){if(view==='planner')plannerSessionDirty=false;if(view==='shopping')shoppingSessionDirty=false}
function sessionNeedsBackup(view){return Boolean(dirty&&((view==='planner'&&plannerSessionDirty)||(view==='shopping'&&shoppingSessionDirty)))}
function showLeaveGuard(target){
  const from=activeViewId();
  leaveGuardTarget=target;
  const label=from==='planner'?'Planning':'Courses';
  $('#leaveGuardMessage').textContent=`Des modifications ont été faites dans ${label}. Elles sont déjà enregistrées sur cet appareil, mais pas encore dans une sauvegarde .hgbak.`;
  $('#leaveGuardDialog').showModal();
}
function captureShoppingReturnContext(from=activeViewId(),extra={}){
  if(from==='shopping')return;
  shoppingReturnContext={view:from,scrollY:scrollY,...extra};
  if(from==='planner'){
    shoppingReturnContext.weekStart=currentWeekStart;
    hgSet(weekStore,currentWeekStart);
  }
  updateShoppingReturnButton();
}
function updateShoppingReturnButton(){
  const b=$('#returnToPlannerFromShopping');if(!b)return;
  b.classList.remove('hidden');
  b.textContent='← Retour';
  const source=shoppingReturnContext?.view;
  const labels={planner:'Planning',recipes:'Recettes',recipeView:'Recette',restaurants:'Sorties',restaurantView:'Sortie',producers:'Producteurs',producerView:'Producteur',herbs:'Plantes & Épices',herbView:'Plante / épice',produce:'Fruits & Légumes',produceView:'Fruit / légume',library:'Bibliothèque',home:'Accueil'};
  b.title=source?`Retour à ${labels[source]||source}`:'Retour';
}
function returnFromShoppingContext(){
  const ctx=shoppingReturnContext?{...shoppingReturnContext}:null;
  shoppingReturnContext=null;updateShoppingReturnButton();
  selectionContext=null;updateSelectionBar();resetSessionDirty('shopping');
  if(!ctx){switchView('home');return}
  if(ctx.view==='planner'){
    currentWeekStart=ctx.weekStart||currentWeekStart;
    hgSet(weekStore,currentWeekStart);
    renderDaySlotChoices();renderPlan();
    viewScrollPositions.planner=Number(ctx.scrollY)||0;
    switchView('planner');
    restoreScrollStable('planner',ctx.scrollY);
    return;
  }
  viewScrollPositions[ctx.view]=Number(ctx.scrollY)||0;
  switchView(ctx.view);
  restoreScrollStable(ctx.view,ctx.scrollY);
}
function requestShoppingReturn(){
  /* Navigation interne : aucune sauvegarde .hgbak n'est requise. */
  returnFromShoppingContext();
}
function requestMainView(id){
  const from=activeViewId();
  if(from===id){openMainView(id);return}
  if(id==='shopping'&&from!=='shopping'){
    captureShoppingReturnContext(from);
    selectionContext=null;updateSelectionBar();switchView('shopping');resetSessionDirty('shopping');return;
  }
  if(from==='shopping')shoppingReturnContext=null;
  updateShoppingReturnButton();
  selectionContext=null;updateSelectionBar();openMainView(id);
}
function finishGuardedLeave(saveDone=false){
  const from=activeViewId();resetSessionDirty(from);const target=leaveGuardTarget;leaveGuardTarget=null;$('#leaveGuardDialog').close();
  if(target==='__plannerReturn'){returnFromShoppingContext();return}
  if(target){if(from==='shopping'&&target!=='planner'){shoppingReturnContext=null;updateShoppingReturnButton()}selectionContext=null;updateSelectionBar();openMainView(target)}
}
let wakeLock=null;
async function updateWakeLock(view=activeViewId()){
  const shouldStayAwake=['shopping','recipeView'].includes(view)&&document.visibilityState==='visible';
  try{
    if(shouldStayAwake&&!wakeLock&&'wakeLock' in navigator){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null})}
    else if(!shouldStayAwake&&wakeLock){await wakeLock.release();wakeLock=null}
  }catch(e){console.warn('Maintien de l’écran indisponible',e)}
}
document.addEventListener('visibilitychange',()=>updateWakeLock());
function openMainView(id){
  if(id==='planner'){
    currentWeekStart=mondayISO(new Date());
    hgSet(weekStore,currentWeekStart);
    renderDaySlotChoices();renderPlan();
  }
  switchView(id);
  if(id==='planner'){
    const today=isoDate(new Date());
    requestAnimationFrame(()=>document.querySelector(`[data-plan-date="${today}"]`)?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  if(id==='planner'||id==='shopping')resetSessionDirty(id)
}
$$('nav button').forEach(b=>b.onclick=()=>requestMainView(b.dataset.view));
$$('[data-go]').forEach(b=>b.onclick=()=>requestMainView(b.dataset.go));
/* Ouverture du Catalogue raccordée directement dans le module Catalogue ci-dessous. */
function slug(s){return (norm(s).replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'recette')+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
function normalizeRecipe(r){return {id:String(r.id||r.uid||slug(r.title||r.name||'recette')),title:r.title||r.name||'Recette sans titre',category:r.category||'Importée',time:Number(r.time)||0,servings:Number(r.servings)||4,ingredients:Array.isArray(r.ingredients)?r.ingredients:[],steps:Array.isArray(r.steps)?r.steps:[],avecViande:!!r.avecViande,type:r.type||(r.avecViande?'viande':''),effort:r.effort||'',difficulty:r.difficulty||'',special:r.special||'',temperature:r.temperature||'les-deux',season:r.season||'toute-annee',period:['chaude','froide'].includes(r.period)?r.period:'indifferente',tags:Array.isArray(r.tags)?r.tags:[],source:r.source||'',notes:r.notes||'',paprikaUid:r.paprikaUid||r.uid||'',complementRecipeIds:Array.isArray(r.complementRecipeIds)?r.complementRecipeIds.map(String):[],complementText:r.complementText||'',leftoverIdeas:r.leftoverIdeas||'',cookedDates:Array.isArray(r.cookedDates)?[...new Set(r.cookedDates.filter(Boolean))]:[],favorite:Boolean(r.favorite),cookingComments:Array.isArray(r.cookingComments)?r.cookingComments.filter(x=>x&&x.text).map(x=>({date:x.date||'',text:String(x.text)})):[],photoId:String(r.photoId||''),ingredientCatalogIds:Array.isArray(r.ingredientCatalogIds)?r.ingredientCatalogIds:[],ingredientRawLines:Array.isArray(r.ingredientRawLines)?r.ingredientRawLines:[]};}
function recipeTypeLabel(v){return ({viande:'viande',poisson:'poisson',vegetarien:'végétarien',vegane:'végane'})[v]||'Type non défini'}
function recipeEffortLabel(v){return ({faible:'Effort faible',moyen:'Effort moyen',important:'Effort important'})[v]||'Effort non défini'}
function recipeDifficultyLabel(v){return ({facile:'facile',moyenne:'moyenne',difficile:'difficile',expert:'expert'})[v]||'non définie'}
function recipeSpecialLabel(v){return ({veille:'à préparer la veille'})[v]||'non défini'}
function recipeTemperatureLabel(v){return ({chaud:'chaud',froid:'froid','les-deux':'les deux'})[v]||'non définie'}
function recipeSeasonLabel(v){return ({'printemps':'printemps','ete':'été','automne':'automne','hiver':'hiver','toute-annee':'toute l’année'})[v]||'toute l’année'}
function recipePeriodLabel(v){return ({indifferente:'indifférente',chaude:'chaude',froide:'froide'})[v]||'indifférente'}
function recipeMetaMarkup(r){return `<span><b>Catégorie :</b> ${esc((r.category||'non définie').toLocaleLowerCase('fr-FR'))}</span> <span><b>Type :</b> ${esc(recipeTypeLabel(r.type).replace(/^Type /,''))}</span> <span><b>Effort :</b> ${esc(recipeEffortLabel(r.effort).replace(/^Effort /,''))}</span> <span><b>Difficulté :</b> ${esc(recipeDifficultyLabel(r.difficulty))}</span> <span><b>Température :</b> ${esc(recipeTemperatureLabel(r.temperature))}</span> <span><b>Saison :</b> ${esc(recipeSeasonLabel(r.season))}</span> <span><b>Période :</b> ${esc(recipePeriodLabel(r.period))}</span>`}
function recipeMetaTailMarkup(r,portions=r.servings){return `<span><b>Spécial :</b> ${esc(recipeSpecialLabel(r.special))}</span> <span><b>Portions :</b> ${esc(portions||r.servings||'—')}</span>`}
function isIntertitleText(value){return /:\s*$/.test(String(value||'').trim())}
function ingredientRowsMarkup(rows){return rows.map(x=>isIntertitleText(x.name)?`<li class="recipe-intertitle">${esc(x.name)}</li>`:`<li>${esc(x.text)}</li>`).join('')}
function stepRowsMarkup(steps){return steps.map(x=>isIntertitleText(x)?`<li class="recipe-intertitle">${esc(x)}</li>`:`<li>${esc(x)}</li>`).join('')}
function recipeTagValues(){const defaults=['rapide','végétarien','familial','été','hiver','festif'];return [...new Set([...defaults,...recipes.flatMap(r=>Array.isArray(r.tags)?r.tags:[]).map(x=>String(x||'').trim()).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))}
function fillRecipeTagSuggestions(){const dl=$('#tagSuggestions');if(!dl)return;dl.innerHTML=recipeTagValues().map(t=>`<option value="${esc(t)}"></option>`).join('')}
function fillCategories(){const cats=[...new Set(recipes.map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));const form=$('#recipeCategory'),current=form?.value||'';if(form){form.innerHTML='<option value="">Choisir…</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')+'<option value="__other__">Autre…</option>';if(cats.includes(current))form.value=current;}const filter=$('#category'),filterCurrent=filter?.value||'';if(filter){filter.innerHTML='<option value="">Toutes les catégories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if(cats.includes(filterCurrent))filter.value=filterCurrent;}fillRecipeTagSuggestions();}
let recipeComplementDraft=[];
let recipeListState=null; // v2.9.7.10 — mémorise explicitement les filtres Recettes pendant une modification
function recipeById(id){return recipes.find(r=>r.id===String(id))}
function recipeComplementMarkup(r){const linked=(r.complementRecipeIds||[]).map(recipeById).filter(Boolean);const free=String(r.complementText||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!linked.length&&!free.length)return '';return `<section class="recipe-memory-block"><h3>Choix de compléments</h3>${linked.length?`<div class="link-list">${linked.map(x=>`<button data-complement-recipe="${esc(x.id)}">${esc(x.title)}</button>`).join('')}</div>`:''}${free.length?`<ul>${free.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</section>`}
function recipeMemoryMarkup(r){const dates=[...(r.cookedDates||[])].sort().reverse();const comments=[...(r.cookingComments||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));if(!dates.length&&!r.favorite&&!comments.length)return '';return `<section class="recipe-memory-block"><h3>Mémoire culinaire</h3>${r.favorite?'<p><strong>★ Favori</strong></p>':''}${dates.length?`<p><strong>Cuisiné :</strong> ${dates.map(d=>esc(new Intl.DateTimeFormat('fr-CH',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${d}T12:00:00`)))).join(' · ')}</p>`:''}${comments.length?`<div class="cooking-comments">${comments.map(c=>`<p><strong>${c.date?esc(new Intl.DateTimeFormat('fr-CH',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${c.date}T12:00:00`))):'Note'} :</strong> ${esc(c.text)}</p>`).join('')}</div>`:''}</section>`}
function bindRecipeDetailLinks(){$$('[data-complement-recipe]').forEach(b=>b.onclick=()=>showRecipe(b.dataset.complementRecipe,'recipeView'))}
function fillComplementRecipeSelect(currentId=''){const sel=$('#recipeComplementSelect');if(!sel)return;const opts=recipes.filter(r=>r.id!==currentId).sort((a,b)=>a.title.localeCompare(b.title,'fr',{sensitivity:'base'}));sel.innerHTML='<option value="">Choisir une recette…</option>'+opts.map(r=>`<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('')}
function renderComplementDraft(){const box=$('#recipeComplementList');if(!box)return;box.innerHTML=recipeComplementDraft.map(id=>{const r=recipeById(id);return r?`<span class="complement-chip">${esc(r.title)} <button type="button" data-remove-complement="${esc(id)}">×</button></span>`:''}).join('');$$('[data-remove-complement]').forEach(b=>b.onclick=()=>{recipeComplementDraft=recipeComplementDraft.filter(id=>id!==b.dataset.removeComplement);renderComplementDraft()})}
function toggleRecipeCooked(index){const item=plan[index];if(!item)return;const r=recipeById(item.recipe.id);if(!r)return;const dates=new Set(r.cookedDates||[]);if(dates.has(item.date)){if(!confirm(`Retirer la date ${dateLabel(item.date)} de l’historique de « ${r.title} » ?`))return;dates.delete(item.date);r.cookingComments=(r.cookingComments||[]).filter(c=>c.date!==item.date)}else{dates.add(item.date);if(confirm('Recette marquée comme cuisinée. Voulez-vous ajouter un commentaire ?')){const text=prompt('Commentaire sur ce repas :','');if(text?.trim())r.cookingComments=[...(r.cookingComments||[]),{date:item.date,text:text.trim()}]}}r.cookedDates=[...dates].sort();item.recipe=r;saveRecipes();savePlanData();renderPlan()}
function toggleRecipeFavorite(index){const item=plan[index];if(!item)return;const r=recipeById(item.recipe.id);if(!r)return;r.favorite=!r.favorite;item.recipe=r;saveRecipes();savePlanData();renderPlan()}
function parseComplementShoppingLine(line){const parts=String(line||'').split('/').map(x=>x.trim());if(parts.length>=2)return {name:parts[0],qty:Number(parseNumber(parts[1]))||1,unit:parts[2]||''};const parsed=parseIngredientLine(line);return {name:parsed[0],qty:Number(parsed[1])||1,unit:parsed[2]||''}}
function sourceRecipeIdsForShopping(x){const ids=new Set((x.originRefs||[]).map(o=>o.recipeId).filter(Boolean));if(!ids.size){(x.origins||[]).forEach(origin=>recipes.forEach(r=>{if(String(origin).includes(`· ${r.title}`))ids.add(r.id)}))}return [...ids].filter(id=>recipeById(id))}
function openShoppingSources(id){const x=shopping.find(i=>i.id===id);if(!x)return;const ids=sourceRecipeIdsForShopping(x);if(!ids.length)return openShopping(id);if(ids.length===1){showRecipe(ids[0],'shopping');return}const list=$('#shoppingSourceList');list.innerHTML=ids.map(rid=>{const r=recipeById(rid);return `<button type="button" data-shopping-source-recipe="${esc(r.id)}">${esc(r.title)}</button>`}).join('');$$('[data-shopping-source-recipe]').forEach(b=>b.onclick=()=>{$('#shoppingSourceDialog').close();showRecipe(b.dataset.shoppingSourceRecipe,'shopping')});$('#shoppingSourceDialog').showModal()}
function recipeCard(r){const choose=selectionContext?`<button class="primary" data-choose="${esc(r.id)}">Choisir pour ${esc(dateLabel(selectionContext.date))} ${esc(selectionContext.slot.toLowerCase())}</button>`:`<button type="button" data-plan-add="${esc(r.id)}">Choisir pour…</button>`;return `<article class="recipe" data-recipe-open="${esc(r.id)}"><div class="recipe-head"><div class="meta recipe-meta-line">${recipeMetaMarkup(r)}</div><h3>${esc(r.title)}</h3><div class="recipe-tag-meta-row"><div class="badges">${(r.tags||[]).slice(0,5).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="meta recipe-meta-tail">${recipeMetaTailMarkup(r)}</div></div></div><div class="recipe-actions">${choose}<button data-edit="${esc(r.id)}">Modifier</button><button data-print-recipe="${esc(r.id)}">Imprimer</button></div></article>`;}
let recipeZeroResultAlerted=false,stockRecipeSearchContext=null;
function stockRecipeCriterionTerms(item){
  return [...new Set([item?.name,item?.alias,item?.group].map(v=>norm(v||'')).filter(Boolean))];
}
function stockRecipeIngredientCorpus(r){
  return (r.ingredients||[]).map(row=>norm(Array.isArray(row)?row[0]:row)).filter(Boolean);
}
function stockRecipeCriterionMatches(r,item){
  const terms=stockRecipeCriterionTerms(item),ingredients=stockRecipeIngredientCorpus(r);
  return terms.some(term=>ingredients.some(ing=>ing.includes(term)||term.includes(ing)));
}
function stockRecipeMatches(r){
  const ctx=stockRecipeSearchContext;if(!ctx?.items?.length)return true;
  const hits=ctx.items.map(item=>stockRecipeCriterionMatches(r,item));
  return ctx.mode==='any'?hits.some(Boolean):hits.every(Boolean);
}
function runStockRecipeSearch(mode){
  const selected=stock.filter(x=>x.checked);if(!selected.length)return;
  const ctx={mode:mode==='any'?'any':'all',items:selected.map(x=>({name:x.name,alias:x.alias,group:x.group}))};
  const found=recipes.filter(r=>{const old=stockRecipeSearchContext;stockRecipeSearchContext=ctx;const ok=stockRecipeMatches(r);stockRecipeSearchContext=old;return ok});
  if(!found.length){$('#stockSearchDialog')?.close();alert('Pas de résultat. Réduisez les critères.');return;}
  stockRecipeSearchContext=ctx;
  if($('#search'))$('#search').value='';
  ['#category','#recipeTypeFilter','#recipeTemperatureFilter','#recipeSeasonFilter','#recipePeriodFilter'].forEach(sel=>{if($(sel))$(sel).value=''});
  recipeZeroResultAlerted=false;$('#stockSearchDialog')?.close();switchView('recipes',{top:true});renderRecipes();
}
function recipeSearchTerms(){return String($('#search')?.value||'').split(',').map(norm).filter(Boolean)}
function recipeSearchCorpus(r){return norm([r.title,(r.tags||[]).join(' '),(r.ingredients||[]).flat().join(' '),(r.steps||[]).join(' ')].join(' '))}
function recipeFieldMatches(value,filter){if(!filter)return true;if(filter==='__undefined__')return !String(value||'').trim();const compact=v=>norm(v).replace(/[^a-z0-9]+/g,'');return compact(value)===compact(filter)}
function recipeFiltersActive(){return recipeSearchTerms().length>0||!!($('#category')?.value||'')||!!($('#recipeTypeFilter')?.value||'')||!!($('#recipeTemperatureFilter')?.value||'')||!!($('#recipeSeasonFilter')?.value||'')||!!($('#recipePeriodFilter')?.value||'')}
function plannedRecipeIdsForCurrentWeek(exceptIndex=null){return new Set(plan.filter((item,i)=>i!==exceptIndex&&item.date>=currentWeekStart&&item.date<=addDaysISO(currentWeekStart,6)&&!item.isLeftover).map(item=>item.recipe?.id).filter(Boolean))}
function renderRecipes(){const terms=recipeSearchTerms(),cat=$('#category')?.value||'',type=$('#recipeTypeFilter')?.value||'',temperature=$('#recipeTemperatureFilter')?.value||'',season=$('#recipeSeasonFilter')?.value||'',period=$('#recipePeriodFilter')?.value||'',used=selectionContext?plannedRecipeIdsForCurrentWeek(selectionContext.index):new Set();const found=recipes.filter(r=>{const corpus=recipeSearchCorpus(r);return norm(r.category)!=='sauce'&&!used.has(r.id)&&(!cat||norm(r.category)===norm(cat))&&recipeFieldMatches(r.type,type)&&recipeFieldMatches(r.temperature,temperature)&&recipeFieldMatches(r.season,season)&&recipeFieldMatches(r.period||'indifferente',period)&&(stockRecipeSearchContext?stockRecipeMatches(r):terms.every(term=>corpus.includes(term)))}).sort((a,b)=>a.title.localeCompare(b.title,'fr',{sensitivity:'base'}));$('#recipeCount').textContent=`${found.length} recette${found.length>1?'s':''}`;$('#recipeList').innerHTML=found.map(recipeCard).join('')||'<p>Aucune recette trouvée.</p>';bindRecipeCards($('#recipeList'));const active=recipeFiltersActive();if(found.length===0&&active&&!recipeZeroResultAlerted){recipeZeroResultAlerted=true;setTimeout(()=>alert('Pas de résultat. Réduisez les critères.'),0)}else if(found.length>0||!active)recipeZeroResultAlerted=false;}
function bindRecipeCards(root=document){root.querySelectorAll('[data-recipe-open]').forEach(card=>card.onclick=e=>{if(e.target.closest('button'))return;showRecipe(card.dataset.recipeOpen,'recipes')});root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=e=>{e.stopPropagation();openRecipe(b.dataset.edit)});root.querySelectorAll('[data-print-recipe]').forEach(b=>b.onclick=e=>{e.stopPropagation();printRecipe(recipes.find(r=>r.id===b.dataset.printRecipe))});root.querySelectorAll('[data-choose]').forEach(b=>b.onclick=e=>{e.stopPropagation();chooseRecipeForPlan(b.dataset.choose);});root.querySelectorAll('[data-plan-add]').forEach(b=>b.onclick=e=>{e.stopPropagation();openRecipePlanAdd(b.dataset.planAdd)});}
let recipeSearchTimer=null;if($('#search'))$('#search').oninput=()=>{stockRecipeSearchContext=null;clearTimeout(recipeSearchTimer);recipeSearchTimer=setTimeout(()=>renderRecipes(),220)};['#category','#recipeTypeFilter','#recipeTemperatureFilter','#recipeSeasonFilter','#recipePeriodFilter'].forEach(sel=>{if($(sel))$(sel).onchange=()=>renderRecipes()});
if($('#clearRecipeFilters'))$('#clearRecipeFilters').onclick=()=>{stockRecipeSearchContext=null;clearTimeout(recipeSearchTimer);$('#search').value='';['#category','#recipeTypeFilter','#recipeTemperatureFilter','#recipeSeasonFilter','#recipePeriodFilter'].forEach(sel=>{if($(sel))$(sel).value=''});recipeZeroResultAlerted=false;renderRecipes();};
$('#surpriseBtn').onclick=()=>{if(!recipes.length)return;const r=recipes[Math.floor(Math.random()*recipes.length)];$('#surpriseCard').innerHTML=recipeCard(r);bindRecipeCards($('#surpriseCard'));};
function updateSelectionBar(){const active=!!selectionContext;$('#recipeReturnBar').classList.toggle('hidden',!active);$('#selectionHint').textContent=active?`Choix pour ${dateLabel(selectionContext.date)} ${selectionContext.slot.toLowerCase()}`:'';renderRecipes();}
$('#returnPlanner').onclick=()=>{selectionContext=null;updateSelectionBar();switchView('planner')};
function startRecipeChoice(index,date=null,slot=null){
  const existing=Number.isInteger(index)&&plan[index];
  selectionContext={index:existing?index:null,date:existing?existing.date:date,slot:existing?existing.slot:slot};
  rememberScroll('planner');updateSelectionBar();switchView('recipes',{top:true});$('#search').focus();
}
let recipePlanAddId=null;
function openRecipePlanAdd(id){
  if(!recipes.some(r=>r.id===id))return;
  recipePlanAddId=id;
  const date=$('#recipePlanAddDate');date.value=isoDate(new Date());
  $('#recipePlanAddSlot').value='Midi';
  $('#recipePlanAddDialog').showModal();
}
function closeRecipePlanAdd(){recipePlanAddId=null;$('#recipePlanAddDialog').close()}
if($('#closeRecipePlanAdd'))$('#closeRecipePlanAdd').onclick=closeRecipePlanAdd;
if($('#cancelRecipePlanAdd'))$('#cancelRecipePlanAdd').onclick=closeRecipePlanAdd;
if($('#recipePlanAddForm'))$('#recipePlanAddForm').onsubmit=e=>{
  e.preventDefault();
  const r=recipes.find(x=>x.id===recipePlanAddId),date=$('#recipePlanAddDate').value,slot=$('#recipePlanAddSlot').value;
  if(!r||!date||!slots.includes(slot))return;
  if(plan.some(x=>x.recipe?.id===r.id&&x.date===date))return alert('Cette recette figure déjà au Planning pour cette date.');
  plan.push({uid:uid(),date,slot,recipe:r,people:mealPeople(date,slot)||null,role:'',preparePreviousDay:r.special==='veille'});
  savePlanData();renderPlan();closeRecipePlanAdd();
  alert('Recette ajoutée au Planning.');
};
function chooseRecipeForPlan(id){if(!selectionContext)return;const ctx={...selectionContext};const used=plannedRecipeIdsForCurrentWeek(ctx.index);if(used.has(id))return alert('Cette recette est déjà prévue cette semaine. Choisis-en une autre.');const r=recipes.find(x=>x.id===id);if(!r)return;if(Number.isInteger(ctx.index)&&plan[ctx.index]){plan[ctx.index].recipe=r;plan[ctx.index].preparePreviousDay=r.special==='veille'}else plan.push({uid:uid(),date:ctx.date,slot:ctx.slot,recipe:r,people:mealPeople(ctx.date,ctx.slot)||null,role:'',preparePreviousDay:r.special==='veille'});selectionContext=null;savePlanData();renderPlan();updateSelectionBar();switchView('planner');}
function recipeSourceMarkup(source){if(!source)return '';try{const url=new URL(source);const host=url.hostname.replace(/^www\./,'');return `<p class="recipe-source muted">Source : <a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a></p>`;}catch{return `<p class="recipe-source muted">Source : ${esc(source)}</p>`;}}
function showRecipe(id,from=''){const r=recipes.find(x=>x.id===id);if(!r)return;if(from){rememberScroll(from);previousView=from}else if(!previousView)previousView='recipes';viewedRecipeId=id;$('#recipeViewContent').innerHTML=`<div class="recipe-title"><div class="meta recipe-meta-line">${recipeMetaMarkup(r)}</div><h2>${esc(r.title)}</h2><div class="recipe-tag-meta-row"><div class="badges">${(r.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="meta recipe-meta-tail">${recipeMetaTailMarkup(r)}</div></div>${recipeSourceMarkup(r.source)}</div><div class="recipe-columns"><section><h3>Ingrédients</h3><ul>${ingredientRowsMarkup(scaledIngredientRows(r,r.servings))}</ul></section><section><h3>Préparation</h3><ol>${stepRowsMarkup(r.steps)}</ol>${r.notes?`<h3>Notes</h3><p>${esc(r.notes).replace(/\n/g,'<br>')}</p>`:''}</section></div>${recipeMemoryMarkup(r)}`;switchView('recipeView');bindRecipeDetailLinks();}
$('#backFromRecipe').onclick=()=>switchView(previousView);$('#editViewedRecipe').onclick=()=>openRecipe(viewedRecipeId);$('#printViewedRecipe').onclick=()=>printRecipe(recipes.find(r=>r.id===viewedRecipeId));

function captureRecipeListState(){
  if(activeViewId()!=='recipes')return;
  recipeListState={
    search:$('#search')?.value||'',
    category:$('#category')?.value||'',
    type:$('#recipeTypeFilter')?.value||'',
    temperature:$('#recipeTemperatureFilter')?.value||'',
    season:$('#recipeSeasonFilter')?.value||'',
    period:$('#recipePeriodFilter')?.value||'',
    scroll:viewScrollPositions.recipes||scrollY||0
  };
}
function restoreRecipeListState(){
  if(!recipeListState)return;
  if($('#search'))$('#search').value=recipeListState.search;
  if($('#category'))$('#category').value=recipeListState.category;
  if($('#recipeTypeFilter'))$('#recipeTypeFilter').value=recipeListState.type||'';
  if($('#recipeTemperatureFilter'))$('#recipeTemperatureFilter').value=recipeListState.temperature||'';
  if($('#recipeSeasonFilter'))$('#recipeSeasonFilter').value=recipeListState.season||'';
  if($('#recipePeriodFilter'))$('#recipePeriodFilter').value=recipeListState.period||'';
  viewScrollPositions.recipes=recipeListState.scroll||0;
}
function ensureSelectValue(select,value){if(!select||!value)return;if(!Array.from(select.options).some(o=>o.value===value)){const o=document.createElement('option');o.value=value;o.textContent=value;select.appendChild(o)}select.value=value}
function openRecipe(id){if(id)captureRecipeListState();const r=recipes.find(x=>x.id===id);$('#recipeDialogTitle').textContent=r?'Modifier la recette':'Nouvelle recette';$('#recipeId').value=r?.id||'';$('#recipeTitle').value=r?.title||'';ensureSelectValue($('#recipeCategory'),r?.category||'');fillRecipeTagSuggestions();$('#recipeTags').value=(r?.tags||[]).join(', ');const recipeTypeValue=r?.type||(r?.avecViande?'viande':'');ensureSelectValue($('#recipeType'),recipeTypeValue);$('#recipeType').value=recipeTypeValue;$('#recipeEffort').value=r?.effort||'';$('#recipeDifficulty').value=r?.difficulty||'';$('#recipeSpecial').value=r?.special||'';$('#recipeServings').value=r?.servings||4;$('#recipeTemperature').value=r?.temperature||'chaud';$('#recipeSeason').value=r?.season||'toute-annee';$('#recipePeriod').value=r?.period||'indifferente';$('#recipeIngredients').value=(r?.ingredients||[]).map((i,k)=>r?.ingredientRawLines?.[k]||i.slice(0,3).join(' / ')).join('\n');window.hgRecipeIngredientRefresh?.();$('#recipeSteps').value=(r?.steps||[]).join('\n');$('#deleteRecipe').classList.toggle('hidden',!r);$('#duplicateRecipe').classList.toggle('hidden',!r);$('#recipeDialog').showModal();}
$('#newRecipe').onclick=()=>openRecipe();$('#closeRecipe').onclick=()=>$('#recipeDialog').close();

// v2.9.8.11 — import/export direct Excel .xlsx avec filtres intégrés
const RECIPE_TABLE_COLUMNS=[
  ['ID','id'],['Titre','title'],['Catégorie','category'],['Saison','season'],['Période','period'],['Type','type'],
  ['Effort','effort'],['Difficulté','difficulty'],['Spécial','special'],['Température','temperature'],
  ['Portions','servings'],['Tags','tags']
];
const RECIPE_TABLE_ALLOWED={
  category:null,
  season:new Set(['toute-annee','printemps','ete','automne','hiver']),
  period:new Set(['indifferente','chaude','froide']),
  type:new Set(['','viande','poisson','vegetarien','vegane']),
  effort:new Set(['','faible','moyen','important']),
  difficulty:new Set(['','facile','moyenne','difficile','expert']),
  special:new Set(['','veille']),
  temperature:new Set(['chaud','froid','les-deux']),
  servings:null,
  tags:null
};
const XLSX_CDN='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
let xlsxLoader=null;
function ensureXlsxLib(){
  if(globalThis.XLSX)return Promise.resolve(globalThis.XLSX);
  if(xlsxLoader)return xlsxLoader;
  xlsxLoader=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=XLSX_CDN;
    script.async=true;
    script.onload=()=>globalThis.XLSX?resolve(globalThis.XLSX):reject(new Error('Le module Excel n’a pas pu être initialisé.'));
    script.onerror=()=>reject(new Error('Le module Excel n’a pas pu être chargé. Vérifie la connexion Internet puis réessaie.'));
    document.head.appendChild(script);
  }).catch(err=>{xlsxLoader=null;throw err});
  return xlsxLoader;
}
function recipeTableValue(r,key){if(key==='tags')return (r.tags||[]).join(', ');if(key==='season')return r.season||'toute-annee';return r[key]??''}
const RECIPE_TABLE_DISPLAY={
  season:{'toute-annee':'Toute l’année',printemps:'Printemps',ete:'Été',automne:'Automne',hiver:'Hiver'},
  period:{indifferente:'Indifférente',chaude:'Chaude',froide:'Froide'},
  type:{'':'',viande:'viande',poisson:'poisson',vegetarien:'végétarien',vegane:'végane'},
  effort:{'':'',faible:'faible',moyen:'moyen',important:'important'},
  difficulty:{'':'',facile:'facile',moyenne:'moyenne',difficile:'difficile',expert:'expert'},
  special:{'':'',veille:'à préparer la veille'},
  temperature:{chaud:'chaud',froid:'froid','les-deux':'les deux'}
};
function recipeTableDisplayValue(r,key){const value=recipeTableValue(r,key);return RECIPE_TABLE_DISPLAY[key]?.[value]??value}
async function exportRecipeTable(){
  const st=$('#recipeTableStatus');
  try{
    if(st){st.textContent='Préparation du classeur Excel…';st.classList.remove('hidden')}
    const XLSX=await ensureXlsxLib();
    const sorted=recipes.slice().sort((a,b)=>a.title.localeCompare(b.title,'fr',{sensitivity:'base'}));
    const rows=[RECIPE_TABLE_COLUMNS.map(([label])=>label),...sorted.map(r=>RECIPE_TABLE_COLUMNS.map(([,key])=>recipeTableDisplayValue(r,key)))];
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!autofilter']={ref:`A1:${XLSX.utils.encode_col(RECIPE_TABLE_COLUMNS.length-1)}${Math.max(1,rows.length)}`};
    ws['!cols']=[{wch:26},{wch:42},{wch:28},{wch:18},{wch:18},{wch:16},{wch:14},{wch:16},{wch:24},{wch:18},{wch:10},{wch:32}];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Recettes');
    wb.Props={Title:'Herbier Gourmand — Recettes',Subject:'Tableau de modification des critères de recettes',Author:'Herbier Gourmand'};
    const stamp=new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb,`Herbier_Gourmand_Recettes_${stamp}.xlsx`,{bookType:'xlsx',compression:true});
    if(st)st.textContent=`Classeur Excel exporté : ${recipes.length} recettes. Les titres de colonnes sont filtrables. Modifie le fichier .xlsx, enregistre-le normalement dans Excel, puis réimporte-le ici.`;
  }catch(err){
    if(st)st.textContent=`Export Excel impossible : ${err.message}`;
    else alert(`Export Excel impossible : ${err.message}`);
  }
}
function normTableValue(v){return String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function canonicalTableValue(key,v){
  const raw=String(v??'').trim();const n=normTableValue(raw).replace(/[’']/g,'').replace(/\s+/g,'-');
  if(key==='season'){const m={'toute-lannee':'toute-annee','toute-annee':'toute-annee','printemps':'printemps','ete':'ete','automne':'automne','hiver':'hiver'};return m[n]??raw}
  if(key==='period'){const m={'indifferente':'indifferente','indifferent':'indifferente','chaude':'chaude','froide':'froide'};return m[n]??raw}
  if(key==='type'){const m={'vegetarien':'vegetarien','vegane':'vegane','viande':'viande','poisson':'poisson','non-defini':'','':'','non-definie':''};return m[n]??raw}
  if(key==='difficulty'){const m={'non-definie':'','non-defini':'','facile':'facile','moyenne':'moyenne','difficile':'difficile','expert':'expert','':''};return m[n]??raw}
  if(key==='special'){const m={'a-preparer-la-veille':'veille','veille':'veille','non-defini':'','non-definie':'','':''};return m[n]??raw}
  if(key==='temperature'){const m={'chaud':'chaud','froid':'froid','les-deux':'les-deux','les-2':'les-deux','les-deux':'les-deux'};return m[n]??raw}
  if(key==='effort'){const m={'non-defini':'','non-definie':'','faible':'faible','moyen':'moyen','important':'important','':''};return m[n]??raw}
  return raw;
}
let pendingRecipeTableImport=null;
function analyzeRecipeTableRows(rows){
  if(!rows.length)throw new Error('Tableau vide.');
  const header=rows[0].map(x=>String(x??'').trim());const index=Object.fromEntries(RECIPE_TABLE_COLUMNS.map(([label,key])=>[key,header.indexOf(label)]));
  if(index.id<0)throw new Error('Colonne ID introuvable. Utilise un classeur Excel exporté par Herbier Gourmand.');
  const changes=[];let recognized=0,unknown=0,invalid=0,unchanged=0;const counts={};
  for(const row of rows.slice(1)){
    const id=String(row[index.id]??'').trim();if(!id)continue;const r=recipes.find(x=>x.id===id);if(!r){unknown++;continue}recognized++;
    const patch={};let bad=false;
    for(const key of Object.keys(RECIPE_TABLE_ALLOWED)){
      if(index[key]<0)continue;let value=canonicalTableValue(key,row[index[key]]??'');
      if(key==='servings'){const n=Number(String(value).replace(',','.'));if(!Number.isFinite(n)||n<1||n>100){bad=true;continue}value=n}
      if(key==='tags')value=String(value).split(',').map(x=>x.trim()).filter(Boolean);
      const allowed=RECIPE_TABLE_ALLOWED[key];if(allowed&&!allowed.has(value)){bad=true;continue}
      const old=key==='tags'?JSON.stringify(r.tags||[]):r[key]??'';const neu=key==='tags'?JSON.stringify(value):value;
      if(old!==neu){patch[key]=value;counts[key]=(counts[key]||0)+1}
    }
    if(bad){invalid++;continue}if(Object.keys(patch).length)changes.push({id,patch});else unchanged++;
  }
  pendingRecipeTableImport={changes,recognized,unknown,invalid,unchanged,counts};return pendingRecipeTableImport;
}
async function analyzeRecipeTableFile(file){
  const XLSX=await ensureXlsxLib();
  const data=await file.arrayBuffer();
  let wb;
  try{wb=XLSX.read(data,{type:'array',cellDates:false})}catch{throw new Error('Le fichier Excel est illisible ou endommagé.')}
  const sheetName=wb.SheetNames.includes('Recettes')?'Recettes':wb.SheetNames[0];
  if(!sheetName)throw new Error('Aucune feuille trouvée dans le classeur.');
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:'',raw:true,blankrows:false});
  return analyzeRecipeTableRows(rows);
}
function recipeTableSummary(a){const labels={category:'catégorie',season:'saison',period:'période',type:'type',effort:'effort',difficulty:'difficulté',special:'spécial',temperature:'température',servings:'portions',tags:'tags'};const details=Object.entries(a.counts).map(([k,n])=>`${n} ${labels[k]||k}`).join(' · ')||'aucun champ modifié';return `<strong>${a.recognized} recettes reconnues</strong><br>${a.changes.length} recettes à mettre à jour · ${details}<br>${a.unchanged} sans changement · ${a.unknown} identifiants inconnus · ${a.invalid} lignes avec valeur invalide`}
if($('#exportRecipeTable'))$('#exportRecipeTable').onclick=exportRecipeTable;
if($('#recipeTableFile'))$('#recipeTableFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(!/\.xlsx$/i.test(f.name))throw new Error('Choisis un fichier Excel .xlsx.');const a=await analyzeRecipeTableFile(f);$('#recipeTableImportSummary').innerHTML=recipeTableSummary(a);$('#confirmRecipeTableImport').disabled=!a.changes.length;$('#recipeTableImportDialog').showModal()}catch(err){alert(`Import impossible : ${err.message}`)}finally{e.target.value=''}};
if($('#closeRecipeTableImport'))$('#closeRecipeTableImport').onclick=$('#cancelRecipeTableImport').onclick=()=>{$('#recipeTableImportDialog').close();pendingRecipeTableImport=null};
if($('#recipeTableImportForm'))$('#recipeTableImportForm').onsubmit=e=>{e.preventDefault();const a=pendingRecipeTableImport;if(!a?.changes?.length)return;for(const c of a.changes){const i=recipes.findIndex(r=>r.id===c.id);if(i>=0)recipes[i]=normalizeRecipe({...recipes[i],...c.patch})}plan.forEach(item=>{const fresh=recipes.find(r=>r.id===item.recipe?.id);if(fresh)item.recipe=fresh});saveRecipes();savePlanData();fillCategories();renderRecipes();renderPlan();invalidateShopping('Des critères de recettes ont été modifiés par le tableau Excel. Les ingrédients n’ont pas changé.');markDirty();$('#recipeTableImportDialog').close();const st=$('#recipeTableStatus');if(st){st.textContent=`Import Excel terminé : ${a.changes.length} recettes mises à jour. Ingrédients, préparation, photos et mémoire culinaire conservés.`;st.classList.remove('hidden')}pendingRecipeTableImport=null};

function parseNumber(v){const s=String(v??'').trim().replace(',','.').replace('½','.5').replace('¼','.25').replace('¾','.75');if(/^\d+\s+\d+\/\d+$/.test(s)){const [a,f]=s.split(/\s+/),[n,d]=f.split('/').map(Number);return Number(a)+n/d;}if(/^\d+\/\d+$/.test(s)){const [n,d]=s.split('/').map(Number);return n/d;}const n=Number(s);return Number.isFinite(n)?n:v;}
function formRecipe(newId=false){const rawLines=$('#recipeIngredients').value.split('\n').map(x=>x.trim()).filter(Boolean);const ingredients=rawLines.map(line=>{if(line.endsWith(':'))return[line,'',''];const parts=line.split('/').map(x=>x.trim());if(parts.length!==3)return[line,'',''];return[parts[0],parseNumber(parts[1]),parts[2]]});const existing=recipes.find(x=>x.id===$('#recipeId').value);return normalizeRecipe({id:newId||$('#recipeId').value||slug($('#recipeTitle').value),title:$('#recipeTitle').value.trim(),category:$('#recipeCategory').value.trim(),time:existing?.time||0,servings:+$('#recipeServings').value,temperature:$('#recipeTemperature').value,season:$('#recipeSeason').value||'toute-annee',period:$('#recipePeriod').value||'indifferente',avecViande:$('#recipeType').value==='viande',type:$('#recipeType').value,effort:$('#recipeEffort').value,difficulty:$('#recipeDifficulty').value,special:$('#recipeSpecial').value,ingredients,ingredientRawLines:rawLines,ingredientCatalogIds:rawLines.map((line,k)=>{const name=line.split('/')[0].trim();const previous=existing?.ingredients?.[k]?.[0];return previous===name?existing?.ingredientCatalogIds?.[k]||'':''}),steps:$('#recipeSteps').value.split('\n').map(x=>x.trim()).filter(Boolean),tags:$('#recipeTags').value.split(',').map(x=>x.trim()).filter(Boolean),source:existing?.source||'',notes:existing?.notes||'',paprikaUid:existing?.paprikaUid||'',complementRecipeIds:existing?.complementRecipeIds||[],complementText:existing?.complementText||'',leftoverIdeas:existing?.leftoverIdeas||'',cookedDates:existing?.cookedDates||[],favorite:existing?.favorite||false,cookingComments:existing?.cookingComments||[],photoId:existing?.photoId||''});}
$('#recipeForm').onsubmit=e=>{e.preventDefault();const r=formRecipe();const i=recipes.findIndex(x=>x.id===r.id);if(i>=0)recipes[i]=r;else recipes.unshift(r);plan.forEach(item=>{if(item.recipe?.id===r.id)item.recipe=r});saveRecipes();savePlanData();fillCategories();restoreRecipeListState();keepScroll(renderRecipes,'recipes');renderPlan();invalidateShopping('Une recette a été modifiée : les affichages du planning sont à jour. Retransfère le repas dans les courses si les ingrédients ont changé.');$('#recipeDialog').close();if(norm(r.category)==='sauce'&&document.getElementById('hgEncyclopedia')&&!document.getElementById('hgEncyclopedia').classList.contains('hidden')){document.getElementById('hgCondimentPreparations')?.click();}if(viewedRecipeId===r.id){const pi=plan.findIndex(x=>x.uid===viewedPlanItemId);if(previousView==='planner'&&pi>=0)showPlanRecipe(pi,{rememberPlannerScroll:false});else showRecipe(r.id)}};
$('#deleteRecipe').onclick=()=>{const id=$('#recipeId').value;if(id&&confirm('Supprimer définitivement cette recette ?')){recipes=recipes.filter(r=>r.id!==id);plan=plan.filter(x=>x.recipe.id!==id);saveRecipes();fillCategories();keepScroll(renderRecipes,'recipes');renderPlan();invalidateShopping('Une recette du planning a été supprimée.');$('#recipeDialog').close();switchView('recipes')}};
$('#duplicateRecipe').onclick=()=>{const r=formRecipe(slug($('#recipeTitle').value));r.title+=' (copie)';r.cookedDates=[];r.favorite=false;r.cookingComments=[];recipes.unshift(r);saveRecipes();fillCategories();keepScroll(renderRecipes,'recipes');$('#recipeDialog').close();};

function defaultDaySlots(){return Object.fromEntries(days.map((_,i)=>[i,Object.fromEntries(slots.map(s=>[s,false]))]))}
function readWeekSlots(){try{return JSON.parse(hgGet(weekSlotStore)||'{}')||{}}catch{return{}}}
function migrateLegacyWeekSlots(){
  const map=readWeekSlots();
  if(Object.keys(map).length)return;
  try{const legacy=JSON.parse(hgGet(slotStore)||'null');if(legacy)map[currentWeekStart]={...defaultDaySlots(),...legacy}}catch{}
  hgSet(weekSlotStore,JSON.stringify(map));
}
function readDaySlots(){const map=readWeekSlots();return map[currentWeekStart]?{...defaultDaySlots(),...map[currentWeekStart]}:defaultDaySlots()}
function renderDaySlotChoices(){const state=readDaySlots();$('#daySlotChoices').innerHTML=days.map((day,i)=>`<div class="day-slot-row"><strong>${day}</strong>${slots.map(slot=>`<label class="mini-slot ${state[i]?.[slot]?'selected':''}"><input type="checkbox" data-day-slot="${i}" data-slot="${slot}" ${state[i]?.[slot]?'checked':''}><span>${slot}</span></label>`).join('')}</div>`).join('');$$('[data-day-slot]').forEach(c=>c.onchange=()=>{c.parentElement.classList.toggle('selected',c.checked);saveDaySlots();updateSlotStatus();renderPlan()});updateSlotStatus();}
function saveDaySlots(){const state=defaultDaySlots();$$('[data-day-slot]').forEach(c=>state[c.dataset.daySlot][c.dataset.slot]=c.checked);const map=readWeekSlots();map[currentWeekStart]=state;hgSet(weekSlotStore,JSON.stringify(map));markDirty();if(activeViewId()==='planner')markSessionDirty('planner');}
function selectedDaySlots(){return $$('[data-day-slot]:checked').map(c=>({date:addDaysISO(currentWeekStart,+c.dataset.daySlot),dayIndex:+c.dataset.daySlot,slot:c.dataset.slot}))}
function updateSlotStatus(){/* compteur supprimé : la sélection reste visible directement dans la grille */}
function calendarSeasonForDate(iso){const m=new Date(`${iso}T12:00:00`).getMonth()+1;return m>=3&&m<=5?'printemps':m>=6&&m<=8?'ete':m>=9&&m<=11?'automne':'hiver'}
const planningPeriodStore='hg-planning-period-v1';
function planningPeriod(){const v=hgGet(planningPeriodStore)||'indifferente';return ['chaude','froide'].includes(v)?v:'indifferente'}
function updatePlanningPeriodButton(){const b=$('#planningPeriod');if(!b)return;const p=planningPeriod();b.textContent=p==='chaude'?'Période ☀️':p==='froide'?'Période ❄️':'Période';b.classList.toggle('period-active',p!=='indifferente');b.title=`Période des propositions : ${recipePeriodLabel(p)}`}
function setPlanningPeriod(value){hgSet(planningPeriodStore,['chaude','froide'].includes(value)?value:'indifferente');updatePlanningPeriodButton()}
function proposalChoices(date,exclude=[]){const season=calendarSeasonForDate(date),wanted=planningPeriod();return recipes.filter(r=>{if(exclude.includes(r.id)||!norm(r.category).includes('plat principal'))return false;if(!((r.season||'toute-annee')==='toute-annee'||r.season===season))return false;const rp=r.period||'indifferente';if(wanted==='chaude'&&rp==='froide')return false;if(wanted==='froide'&&rp==='chaude')return false;return true;});}
function pickRandom(a){return a[Math.floor(Math.random()*a.length)]}
if($('#planningPeriod'))$('#planningPeriod').onclick=()=>{$('#planningPeriodDialog').showModal()};
if($('#closePlanningPeriod'))$('#closePlanningPeriod').onclick=()=>$('#planningPeriodDialog').close();
$$('[data-planning-period]').forEach(b=>b.onclick=()=>{setPlanningPeriod(b.dataset.planningPeriod);$('#planningPeriodDialog').close()});
updatePlanningPeriodButton();
$('#generatePlan').onclick=()=>{const targets=selectedDaySlots();if(!targets.length)return alert('Choisis au moins un repas.');const used=[];let missing=0;targets.forEach(t=>{if(mealItems(t.date,t.slot).length)return;let pool=proposalChoices(t.date,used);if(!pool.length)pool=proposalChoices(t.date,[]);const recipe=pickRandom(pool);if(recipe){used.push(recipe.id);plan.push({uid:uid(),date:t.date,slot:t.slot,recipe,people:null,role:'',preparePreviousDay:recipe.special==='veille'})}else missing++});savePlanData();renderPlan();if(missing)alert(`${missing} repas n’a pas reçu de proposition : aucune recette « Plat principal » disponible pour la saison correspondante.`);};
function scaledIngredientRows(r,people=r.servings,overrides={}){const f=(Number(people)||r.servings)/(r.servings||4);return r.ingredients.map(([n,q,u],i)=>{const ov=overrides[i];const amount=ov!==undefined?ov:(typeof q==='number'?Math.round(q*f*100)/100:q||'');const official=window.hgRecipeCatalogName?.(r,i,n)||n;return{name:official,qty:amount,unit:u||'',text:`${official} : ${amount??''} ${u||''}`.trim()}})}
function scaledIngredients(r,people=null,overrides={}){const p=people||Number($('#people')?.value)||r.servings;return scaledIngredientRows(r,p,overrides).map(x=>x.text)}
function mealNotes(){try{return JSON.parse(hgGet(mealNoteStore)||'{}')||{}}catch{return{}}}
function mealNote(date,slot){return mealNotes()[mealKey(date,slot)]||''}
function setMealNote(date,slot,value){const all=mealNotes(),key=mealKey(date,slot),v=String(value||'').trim();if(v)all[key]=v;else delete all[key];hgSet(mealNoteStore,JSON.stringify(all));markDirty();if(activeViewId()==='planner')markSessionDirty('planner')}
let movingPlanIndex=null;
function movePlanItem(index){const item=plan[index];if(!item)return;movingPlanIndex=index;$('#movePlanDate').value=item.date;$('#movePlanSlot').value=item.slot;$('#movePlanDialog').showModal();}
$('#closeMovePlan').onclick=$('#cancelMovePlan').onclick=()=>{$('#movePlanDialog').close();movingPlanIndex=null};
$('#movePlanForm').onsubmit=e=>{e.preventDefault();const item=plan[movingPlanIndex];if(!item)return;const date=$('#movePlanDate').value,slot=$('#movePlanSlot').value;if(!date||!slots.includes(slot))return;item.date=date;item.slot=slot;savePlanData();renderPlan();$('#movePlanDialog').close();movingPlanIndex=null;};
function removeMealTransferFromShopping(date,slot){
  const key=mealKey(date,slot),transfers=mealTransfers(),previous=transfers[key]||[];
  previous.forEach(old=>{const x=shopping.find(s=>!s.manual&&norm(s.name)===norm(old.name)&&norm(s.unit)===norm(old.unit));if(x&&typeof x.qty==='number')x.qty=Math.max(0,Math.round((x.qty-Number(old.qty||0))*100)/100)});
  shopping=shopping.filter(x=>x.manual||Number(x.qty)>0||x.text);delete transfers[key];saveMealTransfers(transfers);saveShopping();
}
function leftoverNoticeKey(sourceDate,targetDate,slot,title){return `restes|${sourceDate}|${targetDate}|${slot}|${title}`}
function leftoverNoticeData(sourceDate,targetDate,slot,title){
  return {key:leftoverNoticeKey(sourceDate,targetDate,slot,title),msg:`Restes du repas du ${dateLabel(sourceDate)} → ${dateLabel(targetDate)} ${slot.toLowerCase()}. Vérifiez si vous devez compléter votre liste des courses.`};
}
function addLeftoverShoppingNotice(sourceDate,targetDate,slot,title){
  const notice=leftoverNoticeData(sourceDate,targetDate,slot,title);
  if(!shopping.some(x=>x.manual&&x.leftoverNoticeKey===notice.key))shopping.push(normalizeShoppingItem({id:uid(),name:'À vérifier — utilisation de restes',text:notice.msg,unit:'',store:'',aisle:'À vérifier',manual:true,origins:[`Restes de ${title}`],leftoverNoticeKey:notice.key}));
  saveShopping();
}
function leftoverNoticeAcks(){try{return new Set(JSON.parse(hgGet(leftoverAckStore)||'[]')||[])}catch{return new Set()}}
function saveLeftoverNoticeAcks(set){hgSet(leftoverAckStore,JSON.stringify([...set]));markDirty()}
function acknowledgeLeftoverNotice(key){
  const acks=leftoverNoticeAcks();acks.add(key);saveLeftoverNoticeAcks(acks);
  shopping=shopping.filter(x=>x.leftoverNoticeKey!==key);saveShopping();renderShopping();
}
function syncLeftoverShoppingNotices(){
  const active=new Map();
  plan.filter(x=>x.isLeftover).forEach(item=>{
    const title=item.recipe?.title||'Recette';
    const sourceDate=item.leftoverSourceDate||item.date;
    const notice=leftoverNoticeData(sourceDate,item.date,item.slot,title);
    active.set(notice.key,{...notice,title});
  });
  const acks=leftoverNoticeAcks();
  let ackChanged=false;
  for(const key of [...acks])if(!active.has(key)){acks.delete(key);ackChanged=true}
  if(ackChanged)saveLeftoverNoticeAcks(acks);
  let changed=false;
  const before=shopping.length;
  shopping=shopping.filter(x=>!x.leftoverNoticeKey||(active.has(x.leftoverNoticeKey)&&!acks.has(x.leftoverNoticeKey)));
  if(shopping.length!==before)changed=true;
  for(const notice of active.values()){
    if(acks.has(notice.key))continue;
    const existing=shopping.find(x=>x.leftoverNoticeKey===notice.key);
    if(existing){
      if(existing.text!==notice.msg){existing.text=notice.msg;changed=true}
      if(existing.name!=='À vérifier — utilisation de restes'){existing.name='À vérifier — utilisation de restes';changed=true}
      if(existing.aisle!=='À vérifier'){existing.aisle='À vérifier';changed=true}
    }else{
      shopping.push(normalizeShoppingItem({id:uid(),name:'À vérifier — utilisation de restes',text:notice.msg,unit:'',store:'',aisle:'À vérifier',manual:true,origins:[`Restes de ${notice.title}`],leftoverNoticeKey:notice.key}));
      changed=true;
    }
  }
  if(changed){shopping=shopping.map(normalizeShoppingItem);hgSet(shoppingStore,JSON.stringify(shopping));}
}
function leftoverChoice(title,message,choices){
  return new Promise(resolve=>{
    const d=$('#leftoverChoiceDialog'),t=$('#leftoverChoiceTitle'),m=$('#leftoverChoiceMessage'),box=$('#leftoverChoiceButtons');
    t.textContent=title||'Utiliser des restes';m.textContent=message||'';box.innerHTML='';
    choices.forEach(c=>{const b=document.createElement('button');b.type='button';b.textContent=c.label;b.className=c.primary?'primary':'';b.disabled=!!c.disabled;b.onclick=()=>{d.close();resolve(c.value)};box.appendChild(b)});
    const cancel=()=>{if(d.open)d.close();resolve(null)};$('#leftoverChoiceCancel').onclick=cancel;d.oncancel=e=>{e.preventDefault();cancel()};d.showModal();
  });
}
async function chooseLeftoverIdea(r){
  const ideas=String(r.leftoverIdeas||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!ideas.length)return `Restes de ${r.title}`;if(ideas.length===1)return ideas[0];
  return await leftoverChoice('Utiliser des restes','Que veux-tu faire avec ces restes ?',ideas.map(x=>({label:x,value:x})));
}
function leftoverDateChoice(sourceDate){
  return new Promise(resolve=>{
    const d=$('#leftoverDateDialog'),input=$('#leftoverDateInput');
    input.min=addDaysISO(sourceDate,1);input.value=addDaysISO(sourceDate,1);
    const done=v=>{if(d.open)d.close();resolve(v)};
    $('#leftoverDateOk').onclick=()=>done(input.value||null);$('#leftoverDateCancel').onclick=()=>done(null);d.oncancel=e=>{e.preventDefault();done(null)};d.showModal();
  });
}
async function planLeftovers(index){
  const source=plan[index];if(!source)return;const r=recipeById(source.recipe.id);if(!r)return;
  if(!(r.cookedDates||[]).includes(source.date))return alert('Marque d’abord ce repas comme « Cuisiné ».');
  const portions=await leftoverChoice('Quantité de restes','Combien de portions de restes sont disponibles ?',Array.from({length:10},(_,i)=>({label:String(i+1),value:i+1,primary:i===0})));if(portions===null)return;
  const mode=await leftoverChoice('Utilisation des restes','Comment veux-tu utiliser ces restes ?',[{label:'Comme complément',value:'C'},{label:'Comme repas',value:'R',primary:true}]);if(!mode)return;
  const idea=await chooseLeftoverIdea(r);if(idea===null)return;
  const date=await leftoverDateChoice(source.date);if(!date)return;if(date<=source.date)return alert('Choisis une date ultérieure au repas d’origine.');
  const slot=await leftoverChoice('Repas','À quel repas veux-tu utiliser ces restes ?',slots.map(x=>({label:x,value:x,primary:x==='Midi'})));if(!slot)return;
  const existing=mealItems(date,slot);
  if(mode==='C'&&!existing.length){
    const switchMode=await leftoverChoice('Repas encore vide',`${dateLabel(date)} ${slot.toLowerCase()} n’a encore rien de planifié. Un complément doit accompagner un repas.`,[{label:'Planifier ces restes comme repas',value:'R',primary:true},{label:'Choisir un autre créneau',value:'BACK'}]);
    if(switchMode==='BACK')return planLeftovers(index);if(switchMode!=='R')return;
  }
  let finalMode=(mode==='C'&&existing.length)?'C':'R';
  if(finalMode==='R'&&existing.length){
    const action=await leftoverChoice('Repas déjà planifié',`Il y a déjà ${existing.length>1?'des éléments':'un élément'} prévu(s) pour ${dateLabel(date)} ${slot.toLowerCase()}.`,[{label:'Ajouter les restes',value:'A',primary:true},{label:'Remplacer le choix existant',value:'R'}]);if(!action)return;
    if(action==='R'){removeMealTransferFromShopping(date,slot);plan=plan.filter(x=>!(x.date===date&&x.slot===slot));}
  }
  const role=finalMode==='C'?'Complément (restes)':'Restes';
  plan.push({uid:uid(),date,slot,recipe:r,people:portions,role,notes:`${idea} — restes du ${dateLabel(source.date)}`,preparePreviousDay:false,isLeftover:true,leftoverSourceDate:source.date,leftoverPortions:portions,leftoverIdea:idea});
  savePlanData();addLeftoverShoppingNotice(source.date,date,slot,r.title);currentWeekStart=mondayISO(new Date(`${date}T12:00:00`));hgSet(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan();
  $('#planFreshness').textContent=`Restes planifiés pour ${dateLabel(date)} ${slot.toLowerCase()}. Vérifie la liste des courses si un complément est nécessaire.`;$('#planFreshness').classList.remove('hidden');switchView('planner');
}
function removePlanItem(index){const item=plan[index];if(!item)return;if(confirm(`Retirer « ${item.recipe.title} » du planning ?`)){plan.splice(index,1);savePlanData();keepScroll(renderPlan,'planner')}}
function setPlanRole(index){const item=plan[index];if(!item)return;const role=prompt('Service dans le repas (entrée, plat, accompagnement, dessert, sauce, boisson…)',item.role||'');if(role===null)return;item.role=role.trim();savePlanData();renderPlan();}
function togglePreparePreviousDay(index){const item=plan[index];if(!item)return;item.preparePreviousDay=!item.preparePreviousDay;savePlanData();renderPlan();}
function preparationsForDate(date){return plan.filter(x=>x.preparePreviousDay&&addDaysISO(x.date,-1)===date)}
function showPlanRecipe(index,{rememberPlannerScroll=true}={}){const m=plan[index];if(!m)return;viewedPlanItemId=m.uid;if(rememberPlannerScroll)rememberScroll('planner');viewedRecipeId=m.recipe.id;previousView='planner';const rows=scaledIngredientRows(m.recipe,m.people,m.qtyOverrides||{});$('#recipeViewContent').innerHTML=`<div class="recipe-title"><div class="meta recipe-meta-line">${recipeMetaMarkup(m.recipe)} · <span><b>Planning :</b> ${esc(dateLabel(m.date))} ${esc(m.slot.toLowerCase())}</span></div><h2>${esc(m.recipe.title)}</h2><div class="recipe-tag-meta-row"><div class="badges">${(m.recipe.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="meta recipe-meta-tail">${recipeMetaTailMarkup(m.recipe,m.people||m.recipe.servings)}</div></div>${recipeSourceMarkup(m.recipe.source)}</div><div class="notice subtle">Cette adaptation appartient uniquement à ce repas. La recette originale reste inchangée.</div><div class="recipe-columns"><section><h3>Ingrédients</h3><ul>${ingredientRowsMarkup(rows)}</ul></section><section><h3>Préparation</h3><ol>${stepRowsMarkup(m.recipe.steps)}</ol>${m.notes?`<h3>Notes du repas</h3><p>${esc(m.notes).replace(/\n/g,'<br>')}</p>`:''}${m.recipe.leftoverIdeas?`<h3>Utiliser des restes</h3><p>${esc(m.recipe.leftoverIdeas).replace(/\n/g,'<br>')}</p>`:''}</section></div>${recipeComplementMarkup(m.recipe)}${recipeMemoryMarkup(m.recipe)}`;switchView('recipeView');bindRecipeDetailLinks();}
function renderPlan(){
  $('#weekLabel').textContent=weekLabel(currentWeekStart);
  const weekDates=days.map((_,i)=>addDaysISO(currentWeekStart,i));
  const selected=selectedDaySlots();
  const activeDates=weekDates.filter(date=>selected.some(x=>x.date===date)||plan.some(x=>x.date===date)||preparationsForDate(date).length);
  if(!activeDates.length){$('#weekPlan').innerHTML='<p class="muted">Aucun repas sélectionné pour cette semaine.</p>';return}
  $('#weekPlan').innerHTML=activeDates.map(date=>{
    const d=new Date(`${date}T12:00:00`);
    const prep=preparationsForDate(date);
    const visibleSlots=[...new Set([...selected.filter(x=>x.date===date).map(x=>x.slot),...plan.filter(x=>x.date===date).map(x=>x.slot)])].sort((a,b)=>slots.indexOf(a)-slots.indexOf(b));
    const prepMarkup=prep.length?`<div class="notice subtle preparation-notice"><strong>À préparer aujourd’hui pour demain</strong>${prep.map(x=>`<div>• ${esc(x.recipe.title)} — ${esc(x.slot.toLowerCase())}${x.people?` · ${x.people} pers.`:''}</div>`).join('')}</div>`:'';
    return `<article class="day" data-plan-date="${date}"><h3>${esc(dateLabel(date))}</h3>${prepMarkup}${visibleSlots.map(slot=>{
      const matches=mealItems(date,slot),p=mealPeople(date,slot);
      return `<section class="meal-group"><div class="meal-group-head"><strong>${slot}</strong><label class="meal-people">Portions <select data-meal-people="${date}|${slot}"><option value="">—</option>${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${p===n?'selected':''}>${n}</option>`).join('')}</select></label><button data-add-plan="${date}|${slot}">+ Ajouter une recette</button><button class="primary" data-transfer-meal="${date}|${slot}" ${matches.length?'':'disabled'}>Transférer dans les courses</button></div><label class="meal-free-note">Ajout / remarque <input data-meal-note="${date}|${slot}" value="${esc(mealNote(date,slot))}" placeholder="Ex. salade, spätzli, raviolis al brodo…"></label>${matches.length?matches.map(m=>{
        const i=plan.indexOf(m),r=m.recipe;
        return `<div class="meal meal-line"><button class="meal-title-link" data-show-plan="${i}"><span>${m.role?`<b>${esc(m.role)}</b> · `:''}${m.isLeftover?`${esc(m.leftoverIdea||r.title)} <small>· restes de ${esc(r.title)}</small>`:esc(r.title)}</span><small>${m.isLeftover?`${m.leftoverPortions||m.people||'?'} portion(s) · du ${esc(dateLabel(m.leftoverSourceDate||m.date))}`:`${esc(r.category)}${m.people?` · adapté à ${m.people} portion(s)`:' · portions à définir'}`}${m.preparePreviousDay?' · à préparer la veille':''}</small></button><div class="meal-actions"><button data-cooked-plan="${i}" class="${(r.cookedDates||[]).includes(m.date)?'primary':''}">${(r.cookedDates||[]).includes(m.date)?'✓ Cuisiné':'Cuisiné'}</button>${(r.cookedDates||[]).includes(m.date)&&!m.isLeftover?`<button data-leftovers-plan="${i}">Utiliser des restes</button>`:''}<button data-favorite-plan="${i}" class="${r.favorite?'primary':''}">${r.favorite?'★ Favori':'☆ Favori'}</button><button data-prepare-plan="${i}" class="${m.preparePreviousDay?'primary':''}">${m.preparePreviousDay?'✓ Veille':'À préparer la veille'}</button><button data-role-plan="${i}">Service</button><button data-change-plan="${i}">Changer</button><button data-move-plan="${i}">Déplacer</button><button data-remove-plan="${i}" class="danger-soft">Retirer</button></div></div>`
      }).join(''):`<div class="meal meal-empty"><span class="meta">Aucune recette choisie</span></div>`}</section>`
    }).join('')}</article>`
  }).join('');
  $$('[data-add-plan]').forEach(b=>b.onclick=()=>{const [date,slot]=b.dataset.addPlan.split('|');startRecipeChoice(null,date,slot)});
  $$('[data-change-plan]').forEach(b=>b.onclick=()=>startRecipeChoice(+b.dataset.changePlan));
  $$('[data-show-plan]').forEach(b=>b.onclick=()=>showPlanRecipe(+b.dataset.showPlan));
  $$('[data-cooked-plan]').forEach(b=>b.onclick=()=>toggleRecipeCooked(+b.dataset.cookedPlan));
  $$('[data-favorite-plan]').forEach(b=>b.onclick=()=>toggleRecipeFavorite(+b.dataset.favoritePlan));
  $$('[data-leftovers-plan]').forEach(b=>b.onclick=()=>planLeftovers(+b.dataset.leftoversPlan));
  $$('[data-prepare-plan]').forEach(b=>b.onclick=()=>togglePreparePreviousDay(+b.dataset.preparePlan));
  $$('[data-move-plan]').forEach(b=>b.onclick=()=>movePlanItem(+b.dataset.movePlan));
  $$('[data-remove-plan]').forEach(b=>b.onclick=()=>removePlanItem(+b.dataset.removePlan));
  $$('[data-role-plan]').forEach(b=>b.onclick=()=>setPlanRole(+b.dataset.rolePlan));
  $$('[data-meal-people]').forEach(i=>i.onchange=()=>{const [date,slot]=i.dataset.mealPeople.split('|');setMealPeople(date,slot,i.value)});
  $$('[data-meal-note]').forEach(i=>i.onchange=()=>{const [date,slot]=i.dataset.mealNote.split('|');setMealNote(date,slot,i.value)});
  $$('[data-transfer-meal]').forEach(b=>b.onclick=()=>{const [date,slot]=b.dataset.transferMeal.split('|');transferMealToShopping(date,slot)});
  if($('#confirmMealTransfer'))$('#confirmMealTransfer').onclick=confirmMealTransfer;
  if($('#closeMealTransfer'))$('#closeMealTransfer').onclick=()=>{$('#mealTransferDialog').close();pendingMealTransfer=null};
  if($('#cancelMealTransfer'))$('#cancelMealTransfer').onclick=()=>{$('#mealTransferDialog').close();pendingMealTransfer=null};
}
$('#prevWeek').onclick=()=>{currentWeekStart=addDaysISO(currentWeekStart,-7);hgSet(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan()};
$('#nextWeek').onclick=()=>{currentWeekStart=addDaysISO(currentWeekStart,7);hgSet(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan()};
$('#currentWeek').onclick=()=>{currentWeekStart=mondayISO(new Date());hgSet(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan()};
$('#clearPlan').onclick=()=>{if(confirm(`Vider uniquement le planning de la semaine ${weekLabel(currentWeekStart)} et remettre ses sélections à zéro ?`)){const dates=new Set(days.map((_,i)=>addDaysISO(currentWeekStart,i)));plan=plan.filter(x=>!dates.has(x.date));$$('[data-day-slot]').forEach(c=>{c.checked=false;c.parentElement.classList.remove('selected')});saveDaySlots();savePlanData();updateSlotStatus();renderPlan()}};
$('#savePlan').onclick=()=>{savePlanData();resetSessionDirty('planner');$('#planFreshness').textContent='Calendrier enregistré sur cet appareil.';$('#planFreshness').classList.remove('hidden')};
function invalidateShopping(message){$('#planFreshness').textContent=message;$('#planFreshness').classList.remove('hidden')}
function shoppingAssignments(){try{return JSON.parse(hgGet(shoppingAssignmentStore)||'{}')}catch{return{}}}
function shoppingAssignmentKey(value){return shoppingMatchKey(String(value||'').replace(/\([^)]*\)/g,' ').replace(/\b\d+(?:[.,]\d+)?\s*(?:g|kg|mg|ml|cl|dl|l|pcs?|pi[eè]ces?)\b/gi,' '))}
function rememberShoppingAssignment(name,store,aisle){if(!name||(!store&&!aisle))return;const saved=shoppingAssignments(),value={store:store||'',aisle:aisle||''};saved[shoppingAssignmentKey(name)]=value;saved[norm(name)]=value;hgSet(shoppingAssignmentStore,JSON.stringify(saved))}
function shoppingAssignmentFor(value){const saved=shoppingAssignments(),key=shoppingAssignmentKey(value),legacy=norm(value);return saved[key]||saved[legacy]||{}}
function normalizeShoppingItem(x={}){const pref=shoppingAssignmentFor(x.name||x.ingredient);return{id:x.id||uid(),name:x.name||x.ingredient||'',qty:x.qty??x.quantite??0,text:x.text||'',unit:x.unit||x.unite||'',store:x.store||x.magasin||pref.store||'',aisle:x.aisle||x.rayon||pref.aisle||'',checked:Boolean(x.checked??x.coche),manual:Boolean(x.manual),origins:Array.isArray(x.origins)?x.origins:Array.isArray(x.sources)?x.sources:Array.isArray(x.origine)?x.origine:[],originRefs:Array.isArray(x.originRefs)?x.originRefs:[],leftoverNoticeKey:x.leftoverNoticeKey||'',photoId:String(x.photoId||'')}}
function rememberShoppingAssignments(){const saved=shoppingAssignments();shopping.forEach(x=>{if(x.name&&(x.store||x.aisle)){const value={store:x.store||'',aisle:x.aisle||''};saved[shoppingAssignmentKey(x.name)]=value;saved[norm(x.name)]=value}});hgSet(shoppingAssignmentStore,JSON.stringify(saved))}
function shoppingMatchKey(value){return norm(String(value||'')).replace(/[\u00a0\u202f]/g,' ').replace(/[’‘`´ʼ']/g,'').replace(/[.،,;:()]/g,' ').replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim()}
function sameShoppingArticle(a,b){return shoppingMatchKey(a?.name)===shoppingMatchKey(b?.name)&&shoppingMatchKey(a?.unit)===shoppingMatchKey(b?.unit)}
function consolidateShopping(){const out=[];shopping.map(normalizeShoppingItem).forEach(x=>{if(x.manual){out.push(x);return}const hit=out.find(y=>!y.manual&&sameShoppingArticle(y,x));if(!hit){out.push(x);return}hit.qty=Math.round((Number(hit.qty||0)+Number(x.qty||0))*100)/100;hit.checked=Boolean(hit.checked&&x.checked);hit.origins=[...new Set([...(hit.origins||[]),...(x.origins||[])])];hit.originRefs=[...(hit.originRefs||[]),...(x.originRefs||[])].filter((v,i,a)=>a.findIndex(z=>z.recipeId===v.recipeId&&z.date===v.date&&z.slot===v.slot)===i);if(!hit.store&&x.store)hit.store=x.store;if(!hit.aisle&&x.aisle)hit.aisle=x.aisle});shopping=out}
function publishMaVieShoppingStatus(){try{localStorage.setItem('mv-companion-herbier-pending',shopping.some(x=>x&&!x.checked)?'1':'0')}catch(_){}}
function saveShopping(){shopping=shopping.map(normalizeShoppingItem);consolidateShopping();hgSet(shoppingStore,JSON.stringify(shopping));rememberShoppingAssignments();publishMaVieShoppingStatus();markDirty();if(activeViewId()==='shopping')markSessionDirty('shopping')}
let pendingMealTransfer=null;
function mealTransferCandidates(date,slot){
  const items=mealItems(date,slot),rows=[];
  items.filter(m=>!m.isLeftover).forEach(m=>scaledIngredientRows(m.recipe,m.people,m.qtyOverrides||{}).forEach(row=>{
    if(isIntertitleText(row.name))return;
    const q=Number(row.qty);if(!Number.isFinite(q)||q===0)return;
    const key=`${shoppingMatchKey(row.name)}|${shoppingMatchKey(row.unit)}`,hit=rows.find(x=>x.key===key);
    if(hit)hit.qty=Math.round((hit.qty+q)*100)/100;
    else rows.push({key,name:row.name,unit:row.unit,qty:q});
  }));
  return rows;
}
function transferMealToShopping(date,slot){
  const items=mealItems(date,slot);
  if(!items.length)return alert('Ajoute d’abord une recette à ce repas.');
  if(!mealPeople(date,slot))return alert('Indique d’abord le nombre de portions pour ce repas.');
  const rows=mealTransferCandidates(date,slot);
  if(!rows.length)return alert('Aucun ingrédient à transférer.');
  pendingMealTransfer={date,slot,rows};
  $('#mealTransferList').innerHTML=rows.map((r,i)=>`<label class="transfer-preview-row"><input type="checkbox" data-transfer-preview="${i}" checked><span><strong>${esc(r.name)}</strong>${r.qty?` — ${esc(Math.round(Number(r.qty)*100)/100)}${r.unit?` ${esc(r.unit)}`:''}`:''}</span></label>`).join('');
  const dlg=$('#mealTransferDialog');
  if(!dlg)return alert('Impossible d’ouvrir la sélection des ingrédients.');
  try{
    if(dlg.open)dlg.close();
    if(typeof dlg.showModal==='function')dlg.showModal();
    else dlg.setAttribute('open','');
  }catch(e){
    console.error('Ouverture sélection ingrédients',e);
    dlg.setAttribute('open','');
  }
}
// Phase B — identification exacte des articles, sans synonymes automatiques.
function shoppingCatalogEntries(){try{const v=JSON.parse(hgGet('hg-ingredient-catalog-v1')||'[]');return Array.isArray(v)?v.filter(x=>x&&String(x.name||'').trim()):[]}catch(_){return []}}
function shoppingCatalogFind(name){return shoppingCatalogEntries().find(x=>norm(x.name)===norm(name))||null}
// Harmonisation explicite : une correspondance choisie s'applique à toutes les recettes.
function harmonizeRecipeIngredient(oldName,product){
  if(!product||!oldName||norm(oldName)===norm(product.name))return 0;
  let count=0;
  recipes.forEach(recipe=>{(recipe.ingredients||[]).forEach(ingredient=>{
    if(Array.isArray(ingredient)&&norm(ingredient[0])===norm(oldName)){ingredient[0]=product.name;count++}
  })});
  if(count){saveRecipes();}
  // Les articles existants et les anciens transferts restent cohérents.
  shopping.forEach(item=>{if(norm(item.name)===norm(oldName)){
    item.name=product.name;item.aisle=product.aisle||'';item.catalogId=product.id||'';
  }});
  const transfers=mealTransfers();let changed=false;
  Object.values(transfers).forEach(rows=>{if(Array.isArray(rows))rows.forEach(row=>{
    if(norm(row.name)===norm(oldName)){row.name=product.name;changed=true}
  })});
  if(changed)saveMealTransfers(transfers);
  if(count||changed)saveShopping();
  return count;
}
function shoppingCatalogResolve(item){const hit=shoppingCatalogFind(item.name);return hit?{...item,name:hit.name,aisle:hit.aisle||'',catalogId:hit.id||''}:{...item,catalogId:''}}
function shoppingCatalogChoose(name){const all=shoppingCatalogEntries();if(!all.length)return null;const query=prompt(`« ${name} » n'est pas dans le Catalogue.\nRecherche manuelle (nom ou partie du nom), ou Annuler pour revenir :`,name);if(query===null)return null;const matches=all.filter(x=>norm(x.name).includes(norm(query.trim()))).slice(0,25);if(!matches.length){alert('Aucun produit trouvé dans le Catalogue.');return null}const choice=prompt(`Choisis le numéro du produit :\n${matches.map((x,i)=>`${i+1}. ${x.name} — ${x.aisle||'À classer'}`).join('\n')}`,matches.length===1?'1':'');const idx=Number(choice)-1;return Number.isInteger(idx)&&idx>=0&&idx<matches.length?matches[idx]:null}
function shoppingCatalogCreate(name){return new Promise(resolve=>{const dialog=$('#catalogAddDialog');if(!dialog||!$('#addIngredientCatalog'))return resolve(null);/* Le dialogue doit sortir de la section Catalogue masquée lorsque Courses est affiché. */if(dialog.parentElement!==document.body)document.body.appendChild(dialog);let finished=false;const clean=()=>{window.removeEventListener('hg:catalog-created',created);dialog.removeEventListener('close',closed)};const done=x=>{if(finished)return;finished=true;clean();resolve(x)};const created=e=>done(e.detail||null);const closed=()=>queueMicrotask(()=>done(null));window.addEventListener('hg:catalog-created',created);dialog.addEventListener('close',closed);window.dispatchEvent(new CustomEvent('hg:open-catalog-create',{detail:{name}}));if(!dialog.open)done(null)})}
async function shoppingCatalogCheck(item){let hit=shoppingCatalogFind(item.name);if(!hit){const action=prompt(`« ${item.name} » est inconnu du Catalogue.\n1 — Chercher un produit existant\n2 — Ajouter au Catalogue\n3 — Transférer tel quel`, '1');if(action===null)return null;if(action.trim()==='1')hit=shoppingCatalogChoose(item.name);else if(action.trim()==='2')hit=await shoppingCatalogCreate(item.name)}if(hit)harmonizeRecipeIngredient(item.name,hit);return hit?{...item,name:hit.name,aisle:hit.aisle||'',catalogId:hit.id||''}:{...item,catalogId:''}}
async function confirmMealTransfer(){
  if(!pendingMealTransfer)return;
  const {date,slot,rows}=pendingMealTransfer,key=mealKey(date,slot),transfers=mealTransfers(),previous=transfers[key]||[];
  const selected=rows.filter((r,i)=>$(`[data-transfer-preview="${i}"]`)?.checked);
  // Vérifier seulement les ingrédients restés cochés, avant de modifier la liste.
  const verified=[];
  for(const item of selected){const result=await shoppingCatalogCheck(item);if(result===null)return;verified.push(result)}
  previous.forEach(old=>{const x=shopping.find(s=>!s.manual&&sameShoppingArticle(s,old));if(x&&typeof x.qty==='number')x.qty=Math.max(0,Math.round((x.qty-Number(old.qty||0))*100)/100)});
  shopping=shopping.filter(x=>x.manual||Number(x.qty)>0||x.text);
  const meal=mealItems(date,slot);
  verified.forEach(row=>{
    let x=shopping.find(s=>!s.manual&&sameShoppingArticle(s,row));const pref=shoppingAssignmentFor(row.name);
    if(!x){x=normalizeShoppingItem({name:row.name,qty:0,unit:row.unit,catalogId:row.catalogId||'',store:pref.store||'',aisle:row.catalogId?row.aisle:(pref.aisle||''),origins:[],originRefs:[]});shopping.push(x)}
    x.qty=Math.round((Number(x.qty||0)+Number(row.qty||0))*100)/100;
    meal.filter(m=>!m.isLeftover).forEach(m=>{const origin=`${dateLabel(date)} ${slot} · ${m.recipe.title}`;if(!x.origins.includes(origin))x.origins.push(origin);x.originRefs=x.originRefs||[];if(!x.originRefs.some(o=>o.recipeId===m.recipe.id&&o.date===date&&o.slot===slot))x.originRefs.push({recipeId:m.recipe.id,title:m.recipe.title,date,slot})});
  });
  transfers[key]=verified.map(r=>({name:r.name,unit:r.unit,qty:r.qty}));
  saveMealTransfers(transfers);saveShopping();renderShopping();
  $('#mealTransferDialog').close();pendingMealTransfer=null;
  $('#planFreshness').textContent=`✓ ${selected.length} ingrédient${selected.length>1?'s':''} ajouté${selected.length>1?'s':''} aux courses pour ${dateLabel(date)} ${slot.toLowerCase()}.`;
  $('#planFreshness').classList.remove('hidden');
  shoppingSessionDirty=false;
}

function aisleOrders(){try{return JSON.parse(hgGet(aisleOrderStore)||'{}')||{}}catch{return{}}}
function saveAisleOrders(value){hgSet(aisleOrderStore,JSON.stringify(value));markDirty()}
function aislesForStore(store){
  const existing=[...new Set(shopping.filter(x=>(x.store||'')===store).map(x=>x.aisle||'Rayon à définir'))];
  const saved=aisleOrders()[store]||[];
  return [...saved.filter(x=>existing.includes(x)),...existing.filter(x=>!saved.includes(x)).sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))];
}
function aisleRank(store,aisle){const list=aislesForStore(store);const i=list.indexOf(aisle||'Rayon à définir');return i<0?9999:i}
function renderAisleOrderEditor(){
  const stores=[...new Set(shopping.map(x=>x.store).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
  const select=$('#aisleOrderStore');select.innerHTML=stores.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')||'<option value="">Aucun magasin</option>';
  const render=()=>{const store=select.value,list=store?aislesForStore(store):[];$('#aisleOrderList').innerHTML=list.map((name,i)=>`<div class="aisle-order-row"><span>${esc(name)}</span><div><button type="button" data-aisle-rename="${i}">Renommer</button><button type="button" data-aisle-delete="${i}" class="danger-soft">Supprimer</button><button type="button" data-aisle-up="${i}" ${i===0?'disabled':''}>↑</button><button type="button" data-aisle-down="${i}" ${i===list.length-1?'disabled':''}>↓</button></div></div>`).join('')||'<p class="muted">Aucun rayon enregistré pour ce magasin.</p>';$$('[data-aisle-rename]').forEach(b=>b.onclick=()=>renameAisle(store,+b.dataset.aisleRename));$$('[data-aisle-delete]').forEach(b=>b.onclick=()=>deleteAisle(store,+b.dataset.aisleDelete));$$('[data-aisle-up]').forEach(b=>b.onclick=()=>moveAisle(store,+b.dataset.aisleUp,-1));$$('[data-aisle-down]').forEach(b=>b.onclick=()=>moveAisle(store,+b.dataset.aisleDown,1));};
  function moveAisle(store,index,delta){const list=aislesForStore(store),target=index+delta;if(target<0||target>=list.length)return;[list[index],list[target]]=[list[target],list[index]];const all=aisleOrders();all[store]=list;saveAisleOrders(all);render();renderShopping()}
  function renameAisle(store,index){const list=aislesForStore(store),oldName=list[index];if(!oldName)return;const asked=prompt('Nouveau nom du rayon / stand :',oldName);if(asked===null)return;const newName=asked.trim();if(!newName||newName===oldName)return;if(list.some((x,i)=>i!==index&&x.localeCompare(newName,'fr',{sensitivity:'base'})===0))return alert('Ce rayon existe déjà pour ce magasin.');shopping.forEach(x=>{if((x.store||'')===store&&(x.aisle||'Rayon à définir')===oldName)x.aisle=newName});const all=aisleOrders();all[store]=list.map(x=>x===oldName?newName:x);saveAisleOrders(all);saveShopping();render();renderShopping()}
  function deleteAisle(store,index){const list=aislesForStore(store),name=list[index];if(!name)return;if(!confirm(`Supprimer le rayon / stand « ${name} » ?\n\nLes articles qui l'utilisent passeront dans « Rayon à définir ».`))return;shopping.forEach(x=>{if((x.store||'')===store&&(x.aisle||'Rayon à définir')===name)x.aisle='Rayon à définir'});const all=aisleOrders();all[store]=list.filter(x=>x!==name);saveAisleOrders(all);saveShopping();render();renderShopping()}
  select.onchange=render;render();
}
$('#manageAisles').onclick=()=>{renderAisleOrderEditor();$('#aisleOrderDialog').showModal()};
$('#closeAisleOrder').onclick=$('#doneAisleOrder').onclick=()=>$('#aisleOrderDialog').close();
function shoppingGroupKey(x){if(shoppingGroupMode==='store')return x.store||'Magasin à définir';if(shoppingGroupMode==='aisle')return x.aisle||'Rayon à définir';return (x.name?.[0]||'#').toUpperCase()}
function sortedShopping(){return [...shopping].sort((a,b)=>{
  let grouped=0;
  if(shoppingGroupMode==='store'){const storeCmp=(a.store||'zzz').localeCompare(b.store||'zzz','fr',{sensitivity:'base'});grouped=storeCmp||(aisleRank(a.store||'',a.aisle)-aisleRank(b.store||'',b.aisle))||(a.aisle||'zzz').localeCompare(b.aisle||'zzz','fr',{sensitivity:'base'});}
  else if(shoppingGroupMode==='aisle')grouped=(a.aisle||'zzz').localeCompare(b.aisle||'zzz','fr',{sensitivity:'base'});
  return grouped||a.name.localeCompare(b.name,'fr',{sensitivity:'base'});
})}
function shoppingRow(x,aisleBand=''){const amount=x.qty?`${Math.round(Number(x.qty)*100)/100} ${esc(x.unit)}`:x.text?`${esc(x.text)} ${esc(x.unit)}`:'';const aisle=x.aisle||'Rayon à définir',hasSource=sourceRecipeIdsForShopping(x).length>0;return `<div class="shop-item ${x.checked?'checked':''} ${aisleBand}" data-shopping-id="${esc(x.id)}"><input type="checkbox" data-shop-check="${esc(x.id)}" ${x.checked?'checked':''}><button class="shop-text" data-shopping-source="${esc(x.id)}"><span class="shop-main"><strong>${esc(x.name)}</strong>${amount?` <span>— ${amount}</span>`:''}${hasSource?' <small class="source-hint">· recette</small>':''}</span><span class="shop-aisle-badge">${esc(aisle)}</span></button><button class="shop-edit-button" data-edit-shopping="${esc(x.id)}" aria-label="Modifier l’article">Modifier</button></div>`}
function leftoverNoticeRow(x){return `<div class="leftover-notice-entry"><div class="leftover-notice-message">${esc(x.text)}</div><div class="leftover-notice-actions"><button type="button" data-leftover-add="${esc(x.leftoverNoticeKey)}">+ Ajouter un article</button><button type="button" class="primary" data-leftover-ack="${esc(x.leftoverNoticeKey)}">✓ Vu / Vérifié</button></div></div>`}
function renderStoreSubgroups(items){
  const store=items[0]?.store||'';
  const sorted=[...items].sort((a,b)=>
    (aisleRank(store,a.aisle||'Rayon à définir')-aisleRank(store,b.aisle||'Rayon à définir'))||
    (a.aisle||'zzz').localeCompare(b.aisle||'zzz','fr',{sensitivity:'base'})||
    a.name.localeCompare(b.name,'fr',{sensitivity:'base'})
  );
  let lastAisle=null,band=-1;
  return sorted.map(x=>{
    const aisle=x.aisle||'Rayon à définir';
    const isNew=aisle!==lastAisle;
    if(isNew){band++;lastAisle=aisle}
    const separator=(isNew&&band>0)
      ? '<div class="aisle-separator" aria-hidden="true"></div>'
      : '';
    return separator+shoppingRow(x,band%2?'shop-aisle-alt':'');
  }).join('')
}
function renderShopping(){
  shopping=shopping.map(normalizeShoppingItem);
  syncLeftoverShoppingNotices();
  const notices=shopping.filter(x=>x.leftoverNoticeKey), articles=shopping.filter(x=>!x.leftoverNoticeKey);
  const remaining=articles.filter(x=>!x.checked).length;$('#shoppingSummary').textContent=`${remaining} à acheter · ${articles.length} au total`;
  if(!articles.length&&!notices.length){$('#shoppingList').innerHTML='<p class="muted">La liste est vide.</p>';refreshShoppingSuggestions();return}
  const groups={};sortedShopping().filter(x=>!x.leftoverNoticeKey).forEach(x=>(groups[shoppingGroupKey(x)]??=[]).push(x));
  const normalHtml=Object.entries(groups).map(([name,items])=>`<section class="shop-group"><h3>${esc(name)}</h3>${shoppingGroupMode==='store'?renderStoreSubgroups(items):items.map(shoppingRow).join('')}</section>`).join('');
  const noticeHtml=notices.length?`<section class="shop-group leftover-notice-group"><h3>À vérifier — utilisation de restes</h3>${notices.map(leftoverNoticeRow).join('')}</section>`:'';
  $('#shoppingList').innerHTML=normalHtml+noticeHtml;
  $$('[data-shop-check]').forEach(c=>c.onchange=()=>{const x=shopping.find(i=>i.id===c.dataset.shopCheck);if(x){x.checked=c.checked;saveShopping();renderShopping()}});
  $$('[data-shopping-source]').forEach(b=>b.onclick=()=>openShoppingSources(b.dataset.shoppingSource));
  $$('[data-edit-shopping]').forEach(b=>b.onclick=()=>openShopping(b.dataset.editShopping));
  $$('[data-leftover-add]').forEach(b=>b.onclick=()=>openShopping());
  $$('[data-leftover-ack]').forEach(b=>b.onclick=()=>acknowledgeLeftoverNotice(b.dataset.leftoverAck));
  refreshShoppingSuggestions();
}
function sortTextSelect(select){if(!select)return;const selected=select.value;const fixed=Array.from(select.options).filter(o=>o.value===''||o.value==='__other__');const text=Array.from(select.options).filter(o=>o.value!==''&&o.value!=='__other__').sort((a,b)=>a.textContent.localeCompare(b.textContent,'fr',{sensitivity:'base'}));select.replaceChildren(...fixed.filter(o=>o.value===''),...text,...fixed.filter(o=>o.value==='__other__'));if(Array.from(select.options).some(o=>o.value===selected))select.value=selected}function addSelectOption(select,value){if(value&&!Array.from(select.options).some(o=>o.value===value)){const option=document.createElement('option');option.value=value;option.textContent=value;select.insertBefore(option,select.querySelector('option[value="__other__"]'))}sortTextSelect(select)}function rememberedShoppingStores(){try{return JSON.parse(hgGet(shoppingStoreMemory)||'[]')||[]}catch{return[]}}function rememberShoppingStore(value){const v=String(value||'').trim();if(!v)return;const list=[...new Set([...rememberedShoppingStores(),v])].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));hgSet(shoppingStoreMemory,JSON.stringify(list))}function refreshShoppingSuggestions(){const assignmentStores=Object.values(shoppingAssignments()).map(x=>x.store).filter(Boolean),stores=[...new Set([...rememberedShoppingStores(),...assignmentStores,...shopping.map(x=>x.store).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'})),aisles=[...new Set(shopping.map(x=>x.aisle).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));stores.forEach(x=>addSelectOption($('#shoppingStore'),x));aisles.forEach(x=>addSelectOption($('#shoppingAisle'),x));sortTextSelect($('#shoppingStore'));sortTextSelect($('#shoppingAisle'))}function handleOtherSelect(select,label){if(select.value==='__other__'){const value=prompt(`Nouveau ${label} :`);if(value?.trim()){addSelectOption(select,value.trim());select.value=value.trim();if(label==='magasin')rememberShoppingStore(value.trim())}else select.value=''}}$('#shoppingStore').onchange=()=>handleOtherSelect($('#shoppingStore'),'magasin');$('#shoppingAisle').onchange=()=>handleOtherSelect($('#shoppingAisle'),'rayon');
function applyRememberedShoppingAssignment(){const name=$('#shoppingName').value.trim();if(!name)return;const catalog=shoppingCatalogFind(name);if(catalog){addSelectOption($('#shoppingAisle'),catalog.aisle||'');$('#shoppingAisle').value=catalog.aisle||'';return;}const pref=shoppingAssignmentFor(name);if(!pref.store&&!pref.aisle)return;if(pref.store){addSelectOption($('#shoppingStore'),pref.store);$('#shoppingStore').value=pref.store}if(pref.aisle){addSelectOption($('#shoppingAisle'),pref.aisle);$('#shoppingAisle').value=pref.aisle}}
function openShopping(id=''){const x=shopping.find(i=>i.id===id);$('#shoppingDialogTitle').textContent=x?'Modifier l’article':'Ajouter un article';$('#shoppingId').value=x?.id||'';$('#shoppingName').value=x?.name||'';$('#shoppingQty').value=x?.qty||x?.text||'';$('#shoppingUnit').value=x?.unit||'';addSelectOption($('#shoppingStore'),x?.store||'');addSelectOption($('#shoppingAisle'),x?.aisle||'');refreshShoppingSuggestions();refreshShoppingCatalogNames();$('#shoppingStore').value=x?.store||'';$('#shoppingAisle').value=x?.aisle||'';$('#deleteShopping').classList.toggle('hidden',!x);$('#shoppingOrigins').classList.toggle('hidden',!x?.origins?.length);$('#shoppingOrigins').innerHTML=x?.origins?.length?`<strong>Origine :</strong><br>${x.origins.map(esc).join('<br>')}`:'';$('#shoppingDialog').showModal();refreshShoppingUnknown()}
function addShopping(){openShopping()}
$('#shoppingName').setAttribute('list','shoppingCatalogNames');function refreshShoppingCatalogNames(){const list=$('#shoppingCatalogNames');if(list)list.innerHTML=shoppingCatalogEntries().map(x=>`<option value="${esc(x.name)}"></option>`).join('')}function refreshShoppingUnknown(){const b=$('#shoppingUnknownAdd'),name=$('#shoppingName').value.trim();if(!b)return;b.hidden=!name||!!shoppingCatalogFind(name);b.textContent=`Inconnu. Ajouter « ${name} » au Catalogue ?`}
$('#shoppingName').addEventListener('input',refreshShoppingUnknown);
$('#shoppingName').addEventListener('change',refreshShoppingUnknown);
$('#shoppingUnknownAdd')?.addEventListener('click',async()=>{
  const name=$('#shoppingName').value.trim();if(!name||shoppingCatalogFind(name))return;
  // Deux dialogues modaux ne peuvent pas être utilisés simultanément sur mobile.
  const dlg=$('#shoppingDialog');dlg.close();
  const product=await shoppingCatalogCreate(name);
  dlg.showModal();
  if(product){$('#shoppingName').value=product.name;addSelectOption($('#shoppingAisle'),product.aisle||'');$('#shoppingAisle').value=product.aisle||'';harmonizeRecipeIngredient(name,product);refreshShoppingCatalogNames()}
  refreshShoppingUnknown();
});
$('#shoppingName').addEventListener('input',applyRememberedShoppingAssignment);$('#shoppingName').addEventListener('change',applyRememberedShoppingAssignment);
$('#shoppingForm').onsubmit=async e=>{e.preventDefault();const id=$('#shoppingId').value,x=shopping.find(i=>i.id===id),raw=$('#shoppingQty').value.trim(),parsed=parseNumber(raw),item=normalizeShoppingItem({...(x||{}),id:id||uid(),name:$('#shoppingName').value.trim(),qty:typeof parsed==='number'?parsed:0,text:typeof parsed==='number'?'':raw,unit:$('#shoppingUnit').value.trim(),store:$('#shoppingStore').value.trim(),aisle:$('#shoppingAisle').value.trim(),manual:x?.manual??true,origins:x?.origins||['Ajout manuel']});const checked=await shoppingCatalogCheck(item);if(checked===null)return;Object.assign(item,checked);const duplicate=!x?shopping.find(i=>sameShoppingArticle(i,item)):null;if(x)Object.assign(x,item);else if(duplicate){if(item.store)duplicate.store=item.store;if(item.aisle)duplicate.aisle=item.aisle;if(item.qty)duplicate.qty=Math.round((Number(duplicate.qty||0)+Number(item.qty))*100)/100;if(item.text)duplicate.text=item.text;if(item.unit)duplicate.unit=item.unit;duplicate.checked=false}else shopping.push(item);rememberShoppingStore(item.store);if(item.name&&(item.store||item.aisle)){rememberShoppingAssignment(item.name,item.store,item.aisle)}saveShopping();renderShopping();$('#shoppingDialog').close()};
$('#closeShopping').onclick=()=>$('#shoppingDialog').close();$('#closeShoppingSource').onclick=()=>$('#shoppingSourceDialog').close();$('#deleteShopping').onclick=()=>{const id=$('#shoppingId').value;if(id&&confirm('Supprimer cet article ?')){shopping=shopping.filter(x=>x.id!==id);saveShopping();renderShopping();$('#shoppingDialog').close()}};
$('#addShopping').onclick=addShopping;$('#addShoppingBottom').onclick=addShopping;if($('#returnToPlannerFromShopping'))$('#returnToPlannerFromShopping').onclick=requestShoppingReturn;if($('#saveShoppingLocal'))$('#saveShoppingLocal').onclick=()=>{saveShopping();resetSessionDirty('shopping');const b=$('#saveShoppingLocal');if(b){const old=b.textContent;b.textContent='Enregistré ✓';setTimeout(()=>{b.textContent=old},1400)}};$('#clearChecks').onclick=()=>{shopping.forEach(x=>x.checked=false);saveShopping();renderShopping()};$('#removeChecked').onclick=()=>{const n=shopping.filter(x=>x.checked).length;if(!n)return alert('Aucun article coché.');if(confirm(`Supprimer ${n} article${n>1?'s':''} acheté${n>1?'s':''} ?`)){shopping=shopping.filter(x=>!x.checked);saveShopping();renderShopping()}};$('#clearShopping').onclick=()=>{if(confirm('Vider toute la liste ?')){shopping=[];saveShopping();renderShopping()}};
$$('[data-shop-group]').forEach(b=>b.onclick=()=>{shoppingGroupMode=b.dataset.shopGroup;$$('[data-shop-group]').forEach(x=>x.classList.toggle('active',x===b));renderShopping()});

// Import Paprika : .paprikarecipe (gzip JSON), .paprikarecipes (archive ZIP), JSON, HTML ou texte.
$('#importPaprika').onclick=()=>{pendingImport=[];$('#paprikaFile').value='';$('#importStatus').textContent='Aucun fichier analysé.';$('#importPreview').innerHTML='';$('#confirmImport').disabled=true;$('#importDialog').showModal()};$('#closeImport').onclick=$('#cancelImport').onclick=()=>$('#importDialog').close();
$('#paprikaFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;$('#importStatus').textContent='Analyse en cours…';$('#confirmImport').disabled=true;try{pendingImport=await parseImportFile(file);$('#importStatus').innerHTML=`<strong>${pendingImport.length}</strong> recette${pendingImport.length>1?'s':''} reconnue${pendingImport.length>1?'s':''} dans ${esc(file.name)}.`;$('#importPreview').innerHTML=pendingImport.slice(0,12).map(r=>`<div class="import-row"><strong>${esc(r.title)}</strong><span>${esc(r.category)} · ${r.ingredients.length} ingrédients</span></div>`).join('')+(pendingImport.length>12?`<p class="muted">… et ${pendingImport.length-12} autres.</p>`:'');$('#confirmImport').disabled=!pendingImport.length;}catch(err){console.error(err);pendingImport=[];$('#importStatus').textContent=`Import impossible : ${err.message}`;$('#importPreview').innerHTML='';}};
$('#importForm').onsubmit=async e=>{e.preventDefault();if(!pendingImport.length)return;
  if($('#photosOnlyImport')?.checked){
    if(!window.hgMediaImportPaprikaPhoto)return alert('Le moteur photo n’est pas disponible. Recharge Herbier Gourmand puis réessaie.');
    $('#confirmImport').disabled=true;$('#importStatus').textContent='Ajout des photos en cours…';
    let added=0,already=0,missing=0,ambiguous=0,noPhoto=0,errors=0;
    for(const r of pendingImport){
      let matches=[];
      if(r.paprikaUid)matches=recipes.filter(x=>x.paprikaUid&&x.paprikaUid===r.paprikaUid);
      if(!matches.length)matches=recipes.filter(x=>norm(x.title)===norm(r.title));
      if(!matches.length){missing++;continue}if(matches.length>1){ambiguous++;continue}
      const target=matches[0];if(target.photoId){already++;continue}if(!r._paprikaPhotoData){noPhoto++;continue}
      try{target.photoId=await window.hgMediaImportPaprikaPhoto(target.id,r._paprikaPhotoData);added++}catch(err){console.error('Photo Paprika',r.title,err);target.photoId='';errors++}
    }
    if(added){saveRecipes();plan.forEach(p=>{const live=recipes.find(r=>r.id===p.recipe?.id);if(live)p.recipe=live});savePlanData();renderRecipes();registerProtectedChange();markDirty()}
    $('#importDialog').close();
    alert(`Photos Paprika : ${added} ajoutée(s) · ${already} déjà présente(s) · ${missing} recette(s) introuvable(s) · ${ambiguous} correspondance(s) ambiguë(s) · ${noPhoto} sans photo${errors?` · ${errors} erreur(s)`:''}.\n\nAucun autre champ des recettes n’a été modifié.`);return;
  }
  const replace=$('#replaceDuplicates').checked;let added=0,replaced=0,ignored=0,photos=0,photoErrors=0;const photoJobs=[];
  for(const raw of pendingImport){
    const isGenuss=/genussdeslebens\.de/i.test(raw.source||'');
    const r={...raw,tags:[...new Set([...(raw.tags||[]),...(isGenuss?['Genuss']:[])])]};
    const photoData=r._paprikaPhotoData||'';delete r._paprikaPhotoData;
    const i=recipes.findIndex(x=>(r.paprikaUid&&x.paprikaUid===r.paprikaUid)||norm(x.title)===norm(r.title));let target=null;
    if(i>=0){if(replace){r.id=recipes[i].id;r.photoId=recipes[i].photoId||r.photoId||'';recipes[i]=r;target=recipes[i];replaced++}else{ignored++;target=recipes[i]}}
    else{recipes.unshift(r);target=r;added++}
    if(photoData&&target&&!target.photoId&&window.hgMediaImportPaprikaPhoto)photoJobs.push({target,photoData});
  }
  if(photoJobs.length){$('#importStatus').textContent=`Import des photos… 0/${photoJobs.length}`;for(let n=0;n<photoJobs.length;n++){const j=photoJobs[n];try{j.target.photoId=await window.hgMediaImportPaprikaPhoto(j.target.id,j.photoData);photos++}catch(err){console.error('Photo import',j.target.title,err);photoErrors++}$('#importStatus').textContent=`Import des photos… ${n+1}/${photoJobs.length}`}}
  saveRecipes();fillCategories();renderRecipes();$('#importDialog').close();alert(`Import terminé : ${added} ajoutée(s), ${replaced} remplacée(s), ${ignored} ignorée(s) · ${photos} photo(s) importée(s)${photoErrors?` · ${photoErrors} erreur(s) photo`:''}.`)};
async function parseImportFile(file){const bytes=new Uint8Array(await file.arrayBuffer());return parseBytes(bytes,file.name)}
async function parseBytes(bytes,name='import'){
  if(bytes[0]===0x50&&bytes[1]===0x4b){const entries=await unzip(bytes);let out=[];for(const e of entries){if(/\.(paprikarecipe|json|txt)$/i.test(e.name)||!e.name.includes('.'))out.push(...await parseBytes(e.data,e.name));}return dedupeImported(out)}
  if(bytes[0]===0x1f&&bytes[1]===0x8b){const raw=await decompress(bytes,'gzip');return parseBytes(raw,name.replace(/\.paprikarecipe$/i,'.json'))}
  const text=new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/,'').trim();if(!text)return[];
  if(/^</.test(text))return parseHtmlRecipes(text);
  const objects=[];try{const j=JSON.parse(text);objects.push(...(Array.isArray(j)?j:j.recipes&&Array.isArray(j.recipes)?j.recipes:[j]))}catch{for(const line of text.split(/\r?\n/)){try{const j=JSON.parse(line);objects.push(j)}catch{}}}
  if(!objects.length)throw new Error('format non reconnu');return dedupeImported(objects.map(mapPaprikaRecipe).filter(Boolean));
}
async function decompress(bytes,format){if(typeof DecompressionStream==='undefined')throw new Error('décompression non prise en charge par ce navigateur');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));return new Uint8Array(await new Response(stream).arrayBuffer())}
async function unzip(bytes){const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}if(eocd<0)throw new Error('archive ZIP illisible');const count=dv.getUint16(eocd+10,true),central=dv.getUint32(eocd+16,true);let p=central,out=[];for(let n=0;n<count;n++){if(dv.getUint32(p,true)!==0x02014b50)break;const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nlen=dv.getUint16(p+28,true),xlen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),local=dv.getUint32(p+42,true),name=new TextDecoder().decode(bytes.slice(p+46,p+46+nlen));const ln=dv.getUint16(local+26,true),lx=dv.getUint16(local+28,true),start=local+30+ln+lx,compressed=bytes.slice(start,start+csize);let data;if(method===0)data=compressed;else if(method===8)data=await decompress(compressed,'deflate-raw');else{p+=46+nlen+xlen+clen;continue}if(!name.endsWith('/'))out.push({name,data});p+=46+nlen+xlen+clen}return out}
function parseHtmlRecipes(text){const doc=new DOMParser().parseFromString(text,'text/html'),blocks=[...doc.querySelectorAll('[itemtype*="Recipe"], .recipe')];if(!blocks.length)blocks.push(doc.body);return blocks.map((b,i)=>mapPaprikaRecipe({name:b.querySelector('[itemprop="name"],h1,h2')?.textContent||`Recette importée ${i+1}`,ingredients:[...b.querySelectorAll('[itemprop="recipeIngredient"],.ingredient')].map(x=>x.textContent).join('\n'),directions:[...b.querySelectorAll('[itemprop="recipeInstructions"],.instructions li')].map(x=>x.textContent).join('\n'),source_url:location.href})).filter(Boolean)}
function mapPaprikaRecipe(p){if(!p||typeof p!=='object')return null;const title=String(p.name||p.title||'').trim();if(!title)return null;const categories=Array.isArray(p.categories)?p.categories:String(p.categories||p.category||'Importée').split(',');const ing=Array.isArray(p.ingredients)?p.ingredients.join('\n'):String(p.ingredients||'');const dir=Array.isArray(p.directions)?p.directions.join('\n'):String(p.directions||p.steps||'');const servings=parseInt(String(p.servings||4).match(/\d+/)?.[0]||'4',10);const time=parseDuration(p.total_time||p.cook_time||p.prep_time||p.time);const r=normalizeRecipe({id:slug(title),paprikaUid:p.uid||p.id||'',title,category:categories.map(x=>String(x).trim()).filter(Boolean)[0]||'Importée',time,servings,ingredients:ing.split(/\r?\n/).map(parseIngredientLine).filter(x=>x[0]),steps:dir.split(/\r?\n/).map(x=>x.replace(/^\s*\d+[.)-]?\s*/, '').trim()).filter(Boolean),tags:categories.map(x=>String(x).trim()).filter(Boolean),temperature:'les-deux',avecViande:false,source:p.source_url||p.source||'',notes:p.notes||p.description||''});r._paprikaPhotoData=typeof p.photo_data==='string'?p.photo_data:'';return r;}
function parseDuration(v){if(typeof v==='number')return v;const s=String(v||'');const h=+(s.match(/(\d+)\s*h/i)?.[1]||0),m=+(s.match(/(\d+)\s*m/i)?.[1]||0);if(h||m)return h*60+m;return +(s.match(/\d+/)?.[0]||0)}
const unitAliases={'tablespoon':'c. à soupe','tablespoons':'c. à soupe','tbsp':'c. à soupe','tbs':'c. à soupe','cas':'c. à soupe','teaspoon':'c. à café','teaspoons':'c. à café','tsp':'c. à café','cac':'c. à café','gram':'g','grams':'g','kilogram':'kg','kilograms':'kg','milliliter':'ml','milliliters':'ml','liter':'l','liters':'l'};
function parseIngredientLine(line){line=String(line).replace(/^[-•]\s*/,'').trim();if(!line)return['','',''];const m=line.match(/^((?:\d+\s+)?\d+\/\d+|\d+[.,]?\d*|[½¼¾⅓⅔])\s*([\p{L}. à]+)?\s+(.+)$/u);if(!m)return[line,'',''];let q=parseNumber(m[1]),unit=norm(m[2]||'').replace(/\.$/,'').trim(),name=m[3].trim();unit=unitAliases[unit]||m[2]?.trim()||'';return[name,q,unit]}
function dedupeImported(a){const seen=new Set();return a.filter(r=>{const k=r.paprikaUid||norm(r.title);if(seen.has(k))return false;seen.add(k);return true})}

function printDocument(title,body){const w=open('','_blank','width=900,height=700');if(!w)return alert('Fenêtre d’impression bloquée.');w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{margin:10mm}body{font-family:Arial;max-width:850px;margin:auto;line-height:1.25}h1,h2{font-family:Georgia}.columns{display:grid;grid-template-columns:1fr 1.4fr;gap:20px}li{margin:3px 0}.recipe-intertitle{font-weight:700;list-style:none;margin-top:8px;margin-left:-18px}.columns ol{list-style:none;counter-reset:recipe-step;padding-left:20px}.columns ol>li:not(.recipe-intertitle){counter-increment:recipe-step;position:relative}.columns ol>li:not(.recipe-intertitle)::before{content:counter(recipe-step) '. ';position:absolute;right:calc(100% + 5px)}.columns ol>.recipe-intertitle{margin-left:0}.day{border:1px solid #bbb;padding:8px;margin:6px 0;break-inside:avoid}.shop{columns:2}</style></head><body>${body}</body></html>`);w.document.close();setTimeout(()=>w.print(),250)}
function printRecipe(r,people=null){if(!r)return;const p=people||r.servings;const body=`<h1>${esc(r.title)}</h1><p>${p} portions · ${esc(r.category)} · ${esc(recipeTypeLabel(r.type))} · ${esc(recipeEffortLabel(r.effort))} · ${esc(recipeDifficultyLabel(r.difficulty))}</p><div class="columns"><section><h2>Ingrédients</h2><ul>${ingredientRowsMarkup(scaledIngredientRows(r,p))}</ul></section><section><h2>Préparation</h2><ol>${stepRowsMarkup(r.steps)}</ol></section></div>`;printDocument(r.title,body)}
$('#printPlan').onclick=()=>{const week=plan.filter(x=>x.date>=currentWeekStart&&x.date<=addDaysISO(currentWeekStart,6));if(!week.length)return alert('Aucun planning.');printDocument('Planning',`<h1>Calendrier culinaire — ${esc(weekLabel(currentWeekStart))}</h1>${days.map((d,i)=>{const date=addDaysISO(currentWeekStart,i),ms=week.filter(x=>x.date===date);return ms.length?`<div class="day"><h2>${esc(dateLabel(date))}</h2>${slots.map(s=>{const si=ms.filter(x=>x.slot===s);return si.length?`<h3>${s} — ${mealPeople(date,s)} pers.</h3>${si.map(m=>`<p>${m.role?`<strong>${esc(m.role)}</strong> · `:''}${esc(m.recipe.title)}</p>`).join('')}`:''}).join('')}</div>`:''}).join('')}`)};$('#printShopping').onclick=()=>{if(!shopping.length)return alert('Liste vide.');const grouped={};sortedShopping().forEach(x=>(grouped[shoppingGroupKey(x)]??=[]).push(x));printDocument('Courses',`<h1>Liste de courses</h1>${Object.entries(grouped).map(([g,items])=>`<div class="day"><h2>${esc(g)}</h2><ul>${items.map(x=>`<li>☐ ${esc(x.name)}${x.qty?` — ${Math.round(x.qty*100)/100} ${esc(x.unit)}`:''}${shoppingGroupMode==='store'&&x.aisle?` <small>(${esc(x.aisle)})</small>`:''}</li>`).join('')}</ul></div>`).join('')}`)};
// Stock anti-gaspillage
function stockLocations(){try{const a=JSON.parse(hgGet(stockLocationStore)||'null');if(Array.isArray(a)&&a.length)return a}catch{}return ['Frigo','Congélateur','Garde-manger','Cave']}
function saveStockLocations(a){hgSet(stockLocationStore,JSON.stringify([...new Set(a.filter(Boolean))]));markDirty()}
function knownAisles(){const set=new Set(['Fruits et légumes','Boucherie','Poissonnerie','Produits laitiers','Épicerie','Surgelés']);try{Object.values(aisleOrders()||{}).flat().forEach(x=>x&&set.add(x))}catch{}shopping.forEach(x=>x.aisle&&set.add(x.aisle));return [...set].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))}
function produceStockProducts(){return (produceItems||[]).map(p=>({name:p.name,group:/fruit/i.test(p.category||'')?'Fruit':/l[eé]gume/i.test(p.category||'')?'Légume':(p.category||''),aisle:'Fruits et légumes',alias:'',source:'produce'}))}
// Phase B : lecture seule du Catalogue maître pour les propositions du Stock.
// Aucun ajout ni correction automatique dans le Catalogue ou dans le Stock existant.
function catalogStockProducts(){try{const rows=JSON.parse(hgGet('hg-ingredient-catalog-v1')||'[]');return Array.isArray(rows)?rows.filter(p=>p&&String(p.name||'').trim()).map(p=>({name:String(p.name).trim(),group:p.group||'',aisle:p.aisle||'',alias:stockProducts.find(x=>norm(x.name)===norm(p.name))?.alias||'',catalogId:p.id,source:'catalog'})):[]}catch(e){console.warn('Catalogue indisponible pour le Stock',e);return []}}
function mergedStockProducts(){const map=new Map();[...produceStockProducts(),...stockProducts,...catalogStockProducts()].forEach(p=>{const k=norm(p.name);if(k)map.set(k,{...(map.get(k)||{}),...p})});return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}))}
function saveStock(){hgSet(stockStore,JSON.stringify(stock));markDirty();renderStock()}
function saveStockProducts(){hgSet(stockProductStore,JSON.stringify(stockProducts));markDirty()}
 
// Harmonisation Stock validée : 14 articles, sans modifier le Catalogue ni les autres rubriques.
const STOCK_HARMONISATION_KEY='hg-stock-harmonisation-2981164';
const STOCK_HARMONISATION_ROWS=[{"id":"01123ff4-939f-497f-a91b-e111eddee166","oldName":"Viande haché ","name":"Viande hachée de bœuf","aisle":"Boucherie","group":"Bœuf"},{"id":"190726aa-cc2e-4b5c-a7cd-605303b863ab","oldName":"Bourrata","name":"Burrata","aisle":"Laiterie","group":"Produits laitiers"},{"id":"28e2f139-16de-4b1d-81ba-92a16a0da10a","oldName":"Salade","name":"Salade","aisle":"Herbes fraîches / Salades","group":"Salades"},{"id":"551686c0-f535-467e-842b-c9f2d9f259ea","oldName":"Vin blanc","name":"Vin blanc","aisle":"Vin","group":"Vins blancs"},{"id":"e680b984-5093-4499-83d8-e0d7d598eb6f","oldName":"Chêvre frais","name":"Chèvre frais","aisle":"Laiterie","group":"Produits laitiers"},{"id":"44006702-0429-48ee-9571-7b97b889159f","oldName":"Feta","name":"Feta","aisle":"Laiterie","group":"Produits laitiers"},{"id":"8274383f-28e0-4f94-ac68-6047554b2938","oldName":"Fondue","name":"Fondue","aisle":"Laiterie","group":"Produits laitiers"},{"id":"927f40ca-74bd-4128-93a6-f2e7ebdb3844","oldName":"Jambon cuit","name":"Jambon cuit","aisle":"Boucherie","group":"Charcuterie"},{"id":"95f59c61-1556-4587-995e-1f79725a21ca","oldName":"Jambon cru","name":"Jambon cru","aisle":"Boucherie","group":"Charcuterie"},{"id":"28344d3d-e720-4229-af96-0e66d7a8da43","oldName":"Lard fumé","name":"Lard fumé","aisle":"Boucherie","group":"Charcuterie"},{"id":"b867d630-b0ff-4037-bc70-6c089641fb8a","oldName":"Courge musquée","name":"Courge musquée","aisle":"Légume","group":"Légumes"},{"id":"c83e5003-3a14-447e-9507-3204d0b64156","oldName":"Pâte à gâteau rectangulaire ","name":"Pâte à gâteau rectangulaire","aisle":"Produits frais","group":"Gâteaux / Gratins"},{"id":"5e9fcea4-f2c4-4596-b4cd-12e73856e3a7","oldName":"Ricotta","name":"Ricotta","aisle":"Laiterie","group":"Produits laitiers"},{"id":"62c4f926-90b5-4670-8465-d6444dcdae80","oldName":"Yoghourt grecque ","name":"Yoghourt grec","aisle":"Laiterie","group":"Produits laitiers"}];
async function harmoniseValidatedStock(){
  if(hgGet(STOCK_HARMONISATION_KEY)==='done')return;
  let entries,products;
  try{
    entries=JSON.parse(hgGet(stockStore)||'[]');
    products=JSON.parse(hgGet(stockProductStore)||'[]');
    if(!Array.isArray(entries)||!Array.isArray(products))return;
  }catch(e){console.warn('Harmonisation Stock non appliquée : données illisibles',e);return}
  // Sécurité : 14 lignes Stock et 13 fiches Produits du Stock correspondantes.
  // Courge musquée n'a pas de fiche produit dans la sauvegarde ; 'Jambon' est distinct.
  const matches=STOCK_HARMONISATION_ROWS.filter(r=>entries.some(e=>e.id===r.id&&
    (e.name===r.oldName||e.name===r.name)));
  const pMatches=STOCK_HARMONISATION_ROWS.filter(r=>products.some(p=>
    (p.name||'').trim()===r.oldName.trim()||(p.name||'')===r.name));
  if(matches.length!==14||pMatches.length!==13){
    console.warn('Harmonisation Stock reportée : données différentes de la sauvegarde validée',
      matches.length,pMatches.length);return;
  }
  const changedEntries=entries.map(e=>{
    const r=STOCK_HARMONISATION_ROWS.find(x=>x.id===e.id);
    return r?{...e,name:r.name,aisle:r.aisle,group:r.group}:e;
  });
  const changedProducts=products.map(p=>{
    const r=STOCK_HARMONISATION_ROWS.find(x=>(p.name||'').trim()===x.oldName.trim()||
      (p.name||'')===x.name);
    return r?{...p,name:r.name,aisle:r.aisle,group:r.group}:p;
  });
  // Conserver la copie originale pour permettre un retour en arrière.
  await hgSet('hg-stock-before-harmonisation-2981164',
    JSON.stringify({stock:entries,stockProducts:products}));
  await hgSet(stockStore,JSON.stringify(changedEntries));
  await hgSet(stockProductStore,JSON.stringify(changedProducts));
  await hgSet(STOCK_HARMONISATION_KEY,'done');
}

function initStock(){try{stock=JSON.parse(hgGet(stockStore)||'[]')||[];stockProducts=JSON.parse(hgGet(stockProductStore)||'[]')||[]}catch{stock=[];stockProducts=[]}renderStock()}
function fillStockSelect(field,values,current='',other=false){if(!field)return;const clean=[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));if(field.tagName==='INPUT'){const listId=field.getAttribute('list'),list=listId&&document.getElementById(listId);if(list)list.innerHTML=clean.map(v=>`<option value="${esc(v)}"></option>`).join('');field.value=current||'';return}field.innerHTML='<option value="">Choisir…</option>'+clean.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')+(other?'<option value="__other__">Autre…</option>':'');if(current&&!clean.includes(current)){const o=document.createElement('option');o.value=current;o.textContent=current;field.insertBefore(o,other?field.lastElementChild:null)}field.value=current||''}
function productForStockName(name){return mergedStockProducts().find(p=>norm(p.name)===norm(name))}
function refreshStockProductFields(){const p=productForStockName($('#stockProduct').value);if(!p)return;fillStockSelect($('#stockGroup'),[...new Set(mergedStockProducts().map(x=>x.group).filter(Boolean))].sort(),p.group||'',true);fillStockSelect($('#stockAisle'),knownAisles(),p.aisle||'',true);$('#stockSearchAlso').value=p.alias||''}
function openStock(id=''){const x=stock.find(i=>i.id===id),products=mergedStockProducts();$('#stockDialogTitle').textContent=x?'Modifier le stock':'Ajouter au stock';$('#stockId').value=x?.id||'';fillStockSelect($('#stockProduct'),products.map(p=>p.name),x?.name||'');fillStockSelect($('#stockLocation'),stockLocations(),x?.location||'',true);fillStockSelect($('#stockGroup'),[...new Set(products.map(p=>p.group).filter(Boolean))].sort(),x?.group||'',true);fillStockSelect($('#stockAisle'),knownAisles(),x?.aisle||'',true);$('#stockSearchAlso').value=x?.alias||'';$('#deleteStock').classList.toggle('hidden',!x);$('#stockDialog').showModal()}
function renderStock(){const list=$('#stockList');if(!list)return;const sorted=[...stock].sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));$('#stockCount').textContent=`${stock.length} produit${stock.length>1?'s':''}`;list.innerHTML=sorted.map(x=>`<div class="stock-row"><input type="checkbox" data-stock-check="${esc(x.id)}" ${x.checked?'checked':''} aria-label="Sélectionner ${esc(x.name)}"><button type="button" class="stock-name" data-stock-edit="${esc(x.id)}">${esc(x.name)}</button><span class="stock-place">${esc(x.location||'À définir')}</span><button type="button" class="stock-delete-inline" data-stock-remove="${esc(x.id)}" aria-label="Supprimer ${esc(x.name)} du Stock" title="Supprimer du Stock">✕</button></div>`).join('')||'<p class="muted">Le stock est vide.</p>';$$('[data-stock-check]').forEach(c=>c.onchange=()=>{const x=stock.find(i=>i.id===c.dataset.stockCheck);if(x)x.checked=c.checked;hgSet(stockStore,JSON.stringify(stock));updateStockSearchButton()});$$('[data-stock-edit]').forEach(b=>b.onclick=()=>openStock(b.dataset.stockEdit));$$('[data-stock-remove]').forEach(b=>b.onclick=()=>{const id=b.dataset.stockRemove;const item=stock.find(x=>x.id===id);if(item&&confirm(`Supprimer « ${item.name} » du Stock uniquement ?`)){stock=stock.filter(x=>x.id!==id);saveStock();}});updateStockSearchButton()}
function updateStockSearchButton(){const n=stock.filter(x=>x.checked).length,b=$('#stockRecipeSearch');if(!b)return;b.disabled=!n;b.textContent=n?`🔎 Chercher dans les recettes (${n})`:'🔎 Chercher dans les recettes'}
function handleStockOther(field,label){if(field.tagName==='INPUT'){if(label==='lieu'&&field.value.trim()&&!stockLocations().some(x=>norm(x)===norm(field.value))){const a=stockLocations();a.push(field.value.trim());saveStockLocations(a)}return}if(field.value!=='__other__')return;const v=prompt(`Nouveau ${label} :`)?.trim();if(!v){field.value='';return}const o=document.createElement('option');o.value=v;o.textContent=v;field.insertBefore(o,field.lastElementChild);field.value=v;if(label==='lieu'){const a=stockLocations();a.push(v);saveStockLocations(a)}}
function stockListValues(kind){
  if(kind==='location')return stockLocations();
  if(kind==='group')return [...new Set([...mergedStockProducts().map(x=>x.group),...stock.map(x=>x.group)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
  if(kind==='aisle')return [...new Set([...knownAisles(),...stock.map(x=>x.aisle)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
  return mergedStockProducts().map(x=>x.name);
}
function renderStockListManager(){
  const kind=$('#stockListKind')?.value||'product',sel=$('#stockListValue');if(!sel)return;
  const values=stockListValues(kind);sel.innerHTML=values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')||'<option value="">Aucun élément</option>';
  updateStockListManagerState();
}
function updateStockListManagerState(){
  const kind=$('#stockListKind')?.value||'product',value=$('#stockListValue')?.value||'',note=$('#stockListSourceNote');
  const produce=kind==='product'&&value&&produceStockProducts().some(p=>norm(p.name)===norm(value));
  if(note){note.classList.toggle('hidden',!produce);note.textContent=produce?'Ce nom vient de Fruits & Légumes. Il se modifie dans cette rubrique afin de garder une seule écriture de référence.':''}
  if($('#renameStockListValue'))$('#renameStockListValue').disabled=!value||produce;
  if($('#deleteStockListValue'))$('#deleteStockListValue').disabled=!value||produce;
}
function openStockProducts(){renderStockListManager();$('#stockProductDialog').showModal()}
function renameStockListValue(){
  const kind=$('#stockListKind').value,old=$('#stockListValue').value;if(!old)return;
  if(kind==='product'&&produceStockProducts().some(p=>norm(p.name)===norm(old)))return alert('Ce nom vient de Fruits & Légumes. Modifie-le dans cette rubrique.');
  const asked=prompt('Nouveau nom :',old);if(asked===null)return;const neu=asked.trim();if(!neu||norm(neu)===norm(old))return;
  if(stockListValues(kind).some(v=>norm(v)===norm(neu)))return alert('Cet élément existe déjà.');
  if(kind==='location'){
    saveStockLocations(stockLocations().map(v=>norm(v)===norm(old)?neu:v));stock.forEach(x=>{if(norm(x.location)===norm(old))x.location=neu});
  }else if(kind==='group'){
    stockProducts.forEach(x=>{if(norm(x.group)===norm(old))x.group=neu});stock.forEach(x=>{if(norm(x.group)===norm(old))x.group=neu});saveStockProducts();
  }else if(kind==='aisle'){
    stockProducts.forEach(x=>{if(norm(x.aisle)===norm(old))x.aisle=neu});stock.forEach(x=>{if(norm(x.aisle)===norm(old))x.aisle=neu});shopping.forEach(x=>{if(norm(x.aisle)===norm(old))x.aisle=neu});
    const all=aisleOrders();Object.keys(all).forEach(store=>all[store]=(all[store]||[]).map(v=>norm(v)===norm(old)?neu:v));saveAisleOrders(all);saveShopping();saveStockProducts();
  }else{
    stockProducts.forEach(x=>{if(norm(x.name)===norm(old))x.name=neu});stock.forEach(x=>{if(norm(x.name)===norm(old))x.name=neu});saveStockProducts();
  }
  hgSet(stockStore,JSON.stringify(stock));markDirty();renderStock();renderStockListManager();$('#stockListValue').value=neu;updateStockListManagerState();
}
function deleteStockListValue(){
  const kind=$('#stockListKind').value,value=$('#stockListValue').value;if(!value)return;
  if(kind==='product'&&produceStockProducts().some(p=>norm(p.name)===norm(value)))return alert('Ce nom vient de Fruits & Légumes. Modifie-le dans cette rubrique.');
  const used=kind==='location'?stock.filter(x=>norm(x.location)===norm(value)).length:kind==='group'?stock.filter(x=>norm(x.group)===norm(value)).length:kind==='aisle'?stock.filter(x=>norm(x.aisle)===norm(value)).length:stock.filter(x=>norm(x.name)===norm(value)).length;
  const extra=used?`\n\n${used} élément${used>1?'s':''} du stock l’utilise${used>1?'nt':''}. ${kind==='product'?'Ces lignes seront supprimées.':'La valeur sera effacée de ces lignes.'}`:'';
  if(!confirm(`Supprimer « ${value} » ?${extra}`))return;
  if(kind==='location'){
    saveStockLocations(stockLocations().filter(v=>norm(v)!==norm(value)));stock.forEach(x=>{if(norm(x.location)===norm(value))x.location=''})
  }else if(kind==='group'){
    stockProducts.forEach(x=>{if(norm(x.group)===norm(value))x.group=''});stock.forEach(x=>{if(norm(x.group)===norm(value))x.group=''});saveStockProducts();
  }else if(kind==='aisle'){
    stockProducts.forEach(x=>{if(norm(x.aisle)===norm(value))x.aisle=''});stock.forEach(x=>{if(norm(x.aisle)===norm(value))x.aisle=''});shopping.forEach(x=>{if(norm(x.aisle)===norm(value))x.aisle='Rayon à définir'});
    const all=aisleOrders();Object.keys(all).forEach(store=>all[store]=(all[store]||[]).filter(v=>norm(v)!==norm(value)));saveAisleOrders(all);saveShopping();saveStockProducts();
  }else{
    stockProducts=stockProducts.filter(x=>norm(x.name)!==norm(value));stock=stock.filter(x=>norm(x.name)!==norm(value));saveStockProducts();
  }
  hgSet(stockStore,JSON.stringify(stock));markDirty();renderStock();renderStockListManager();
}
if($('#addStock'))$('#addStock').onclick=()=>openStock();if($('#closeStockDialog'))$('#closeStockDialog').onclick=()=>$('#stockDialog').close();if($('#stockProduct'))$('#stockProduct').onchange=refreshStockProductFields;if($('#stockLocation'))$('#stockLocation').onchange=()=>handleStockOther($('#stockLocation'),'lieu');if($('#stockGroup'))$('#stockGroup').onchange=()=>handleStockOther($('#stockGroup'),'groupe');if($('#stockAisle'))$('#stockAisle').onchange=()=>handleStockOther($('#stockAisle'),'rayon');
if($('#stockForm'))$('#stockForm').onsubmit=e=>{e.preventDefault();const id=$('#stockId').value,name=$('#stockProduct').value;if(!name)return;const item={id:id||uid(),name,location:$('#stockLocation').value,group:$('#stockGroup').value,aisle:$('#stockAisle').value,alias:$('#stockSearchAlso').value.trim(),checked:false};const old=stock.find(x=>x.id===id);if(old)Object.assign(old,item);else stock.push(item);const p=productForStockName(name);if(!p||!['produce','catalog'].includes(p.source)){const i=stockProducts.findIndex(x=>norm(x.name)===norm(name)),def={name,group:item.group,aisle:item.aisle,alias:item.alias};if(i>=0)stockProducts[i]=def;else stockProducts.push(def);saveStockProducts()}saveStock();$('#stockDialog').close()};
if($('#deleteStock'))$('#deleteStock').onclick=()=>{const id=$('#stockId').value;if(id&&confirm('Supprimer ce produit du stock ?')){stock=stock.filter(x=>x.id!==id);saveStock();$('#stockDialog').close()}};
function printStockGrouped(kind){
  if(!stock.length)return alert('Le stock est vide.');
  const field=kind==='group'?'group':'aisle',label=kind==='group'?'Catégorie':'Rayon';
  const groups={};
  [...stock].sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'})).forEach(x=>{const key=(x[field]||'Non défini').trim()||'Non défini';(groups[key]??=[]).push(x)});
  const entries=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0],'fr',{sensitivity:'base'}));
  const title=kind==='group'?'Stock des réserves – groupées par type':'Stock des réserves – groupées par rayon';
  printDocument(title,`<style>.stock-print{font:11px/1.15 Arial,sans-serif}.stock-print h1{font-family:Georgia,serif;font-size:19px;margin:0 0 2px}.stock-print .count{margin:0 0 5px;color:#666}.stock-print .stock-group{display:grid;grid-template-columns:120px 1fr;border-top:1px solid #bbb;padding:2px 0;break-inside:avoid}.stock-print .stock-group:last-child{border-bottom:1px solid #bbb}.stock-print h2{font:700 11px/1.15 Arial,sans-serif;margin:0;padding:1px 8px 1px 0}.stock-print ul{list-style:none;margin:0;padding:0}.stock-print li{margin:0;padding:1px 0 1px 10px;position:relative}.stock-print li:before{content:'•';position:absolute;left:0}</style><div class="stock-print"><h1>${title}</h1><p class="count">${stock.length} produit${stock.length>1?'s':''}</p>${entries.map(([g,items])=>`<section class="stock-group"><h2>${esc(g)} :</h2><ul>${items.map(x=>`<li>${esc(x.name)}</li>`).join('')}</ul></section>`).join('')}</div>`);
  $('#stockPrintDialog').close();
}
if($('#printStock'))$('#printStock').onclick=()=>$('#stockPrintDialog').showModal();if($('#closeStockPrint'))$('#closeStockPrint').onclick=()=>$('#stockPrintDialog').close();if($('#printStockByGroup'))$('#printStockByGroup').onclick=()=>printStockGrouped('group');if($('#printStockByAisle'))$('#printStockByAisle').onclick=()=>printStockGrouped('aisle');
if($('#manageStockProducts'))$('#manageStockProducts').onclick=openStockProducts;if($('#closeStockProducts'))$('#closeStockProducts').onclick=()=>$('#stockProductDialog').close();
if($('#stockListKind'))$('#stockListKind').onchange=renderStockListManager;if($('#stockListValue'))$('#stockListValue').onchange=updateStockListManagerState;if($('#renameStockListValue'))$('#renameStockListValue').onclick=renameStockListValue;if($('#deleteStockListValue'))$('#deleteStockListValue').onclick=deleteStockListValue;
if($('#stockRecipeSearch'))$('#stockRecipeSearch').onclick=()=>{const selected=stock.filter(x=>x.checked);$('#stockSearchSummary').textContent=selected.map(x=>x.name).join(' · ');$('#stockSearchDialog').showModal()};if($('#closeStockSearch'))$('#closeStockSearch').onclick=()=>$('#stockSearchDialog').close();if($('#stockSearchAll'))$('#stockSearchAll').onclick=()=>runStockRecipeSearch('all');if($('#stockSearchAny'))$('#stockSearchAny').onclick=()=>runStockRecipeSearch('any');

function loadSaved(){try{const s=JSON.parse(hgGet(planStore)||hgGet('hg-plan-v26')||'null');if(s){currentWeekStart=s.weekStart||hgGet(weekStore)||mondayISO(new Date());plan=(s.items||[]).map(x=>{const date=x.date||addDaysISO(currentWeekStart,Number(x.dayIndex)||0);return{uid:x.uid||uid(),date,slot:x.slot,people:(Number(x.people)>=1&&Number(x.people)<=10?Number(x.people):(Number(s.people)>=1&&Number(s.people)<=10?Number(s.people):null)),role:x.role||'',notes:x.notes||'',preparePreviousDay:Boolean(x.preparePreviousDay),isLeftover:Boolean(x.isLeftover),leftoverSourceDate:x.leftoverSourceDate||'',leftoverPortions:Number(x.leftoverPortions)||0,leftoverIdea:x.leftoverIdea||'',recipe:recipes.find(r=>r.id===x.id)}}).filter(x=>x.recipe)}shopping=(JSON.parse(hgGet(shoppingStore)||hgGet('hg-shopping-v26')||hgGet('hg-shopping')||'[]')||[]).map(normalizeShoppingItem);consolidateShopping();hgSet(shoppingStore,JSON.stringify(shopping))}catch(e){console.error(e)}publishMaVieShoppingStatus();hgSet(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan();renderShopping()}

// Sauvegarde et transfert entre appareils
let pendingDataImport = null;
function herbierStorageSnapshot(){
  const data={};
  for(const [key,value] of hgAllEntries()){
    if(key && key.startsWith('hg-') && key!==EMERGENCY_BACKUP_KEY) data[key]=value;
  }
  // Garantit que les collections actuellement chargées figurent dans la sauvegarde.
  data[recipeStore]=JSON.stringify(recipes);
  if(typeof restaurants!=='undefined' && Array.isArray(restaurants)) data[restaurantStore]=JSON.stringify(restaurants);
  if(typeof producers!=='undefined' && Array.isArray(producers)) data[producerStore]=JSON.stringify(producers);
  if(typeof herbs!=='undefined' && Array.isArray(herbs)) data[herbStore]=JSON.stringify(herbs);
  if(typeof produceItems!=='undefined' && Array.isArray(produceItems)) data[produceStore]=JSON.stringify(produceItems);
  return {format:'HerbierGourmandBackup',formatVersion:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),data};
}
function downloadTextFile(filename,text){
  const blob=new Blob([text],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function backupStamp(d=new Date()){
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}
function backupFilename(){return `Herbier-Gourmand_${backupStamp()}.hgbak`;}
function backupDeviceLabel(){
  const ua=navigator.userAgent||'';
  if(/Android|iPhone|iPad|Mobile/i.test(ua))return 'Smartphone';
  if(/Windows|Macintosh|Linux x86_64/i.test(ua))return 'Notebook';
  return 'Appareil';
}
function renderLastDeviceAction(){
  const el=$('#lastDeviceAction');if(!el)return;
  const value=hgGet(LAST_DEVICE_ACTION_KEY);
  el.textContent=value?`Dernière action : ${value}`:'';
}
function rememberLastDeviceAction(kind,filename){
  if(!filename)return;
  hgSet(LAST_DEVICE_ACTION_KEY,`${kind} ${filename}`);
  renderLastDeviceAction();
}
renderLastDeviceAction();
function backupMeta(){try{return JSON.parse(hgGet(BACKUP_META_KEY)||'null')}catch{return null}}
function updateBackupReminder(){
  const el=$('#backupReminder');if(!el)return;
  const meta=backupMeta(),changes=Number(hgGet(CHANGE_COUNTER_KEY)||0);
  if(!meta){el.textContent='Conseil : crée une première sauvegarde et range-la dans ton dossier OneDrive.';return}
  const when=new Date(meta.at).toLocaleString('fr-FR');
  el.textContent=`Dernière sauvegarde : ${when}${changes?` · ${changes} modification${changes>1?'s':''} depuis`:''}.`;
}
function registerProtectedChange(){
  const n=Number(hgGet(CHANGE_COUNTER_KEY)||0)+1;
  hgSet(CHANGE_COUNTER_KEY,String(n));updateBackupReminder();
}
function markBackupCreated(filename){
  hgSet(BACKUP_META_KEY,JSON.stringify({at:new Date().toISOString(),filename}));
  hgSet(CHANGE_COUNTER_KEY,'0');clearDirty();updateBackupReminder();
}
function createEmergencyCheckpoint(reason='opération sensible'){
  const snapshot=herbierStorageSnapshot();
  const record={reason,createdAt:new Date().toISOString(),snapshot};
  hgSet(EMERGENCY_BACKUP_KEY,JSON.stringify(record));
  return snapshot;
}
async function exportBackupNow(){
  try{
    const backup=herbierStorageSnapshot();if(window.hgMediaExport)backup.media=await window.hgMediaExport();const filename=backupFilename(),text=JSON.stringify(backup,null,2);
    if(typeof window.showSaveFilePicker==='function'){
      try{
        const handle=await window.showSaveFilePicker({
          suggestedName:filename,
          types:[{description:'Sauvegarde Herbier Gourmand',accept:{'application/json':['.hgbak']}}]
        });
        const writable=await handle.createWritable();
        await writable.write(text);
        await writable.close();
        markBackupCreated(filename);
        $('#dataTransferStatus').textContent=`Sauvegarde exportée : ${filename} · ${backupDeviceLabel()} · ${new Date().toLocaleString('fr-CH')}`;
        rememberLastDeviceAction('Export',filename);
        return true;
      }catch(e){
        if(e?.name==='AbortError'){
          $('#dataTransferStatus').textContent='Export annulé.';
          return false;
        }
        console.warn('Enregistrer sous indisponible, repli sur téléchargement',e);
      }
    }
    downloadTextFile(filename,text);
    markBackupCreated(filename);
    $('#dataTransferStatus').textContent=`Sauvegarde exportée dans les téléchargements : ${filename} · ${backupDeviceLabel()} · ${new Date().toLocaleString('fr-CH')}`;
    rememberLastDeviceAction('Export',filename);
    return true;
  }catch(err){console.error(err);alert('Impossible de créer la sauvegarde.');return false;}
}
$('#exportData').onclick=()=>exportBackupNow();
$('#leaveGuardStay').onclick=()=>{leaveGuardTarget=null;$('#leaveGuardDialog').close()};
$('#leaveGuardLeave').onclick=()=>finishGuardedLeave(false);
$('#leaveGuardSave').onclick=async()=>{const btn=$('#leaveGuardSave');btn.disabled=true;const ok=await exportBackupNow();btn.disabled=false;if(ok)finishGuardedLeave(true)};
$('#dataImportFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const parsed=JSON.parse(await file.text());
    if(parsed?.format!=='HerbierGourmandBackup'||parsed?.formatVersion!==1||!parsed.data||typeof parsed.data!=='object')throw new Error('format de sauvegarde non reconnu');
    const keys=Object.keys(parsed.data).filter(k=>k.startsWith('hg-')&&typeof parsed.data[k]==='string');
    if(!keys.length)throw new Error('aucune donnée Herbier Gourmand trouvée');
    pendingDataImport={...parsed,data:Object.fromEntries(keys.map(k=>[k,parsed.data[k]])),_filename:file.name};
    let recipeCount='inconnu',shoppingCount='inconnu',planCount='inconnu';
    try{recipeCount=JSON.parse(pendingDataImport.data[recipeStore]||'[]').length}catch{}
    try{shoppingCount=JSON.parse(pendingDataImport.data[shoppingStore]||'[]').length}catch{}
    try{planCount=(JSON.parse(pendingDataImport.data[planStore]||'{}').items||[]).length}catch{}
    const when=parsed.exportedAt?new Date(parsed.exportedAt).toLocaleString('fr-CH'):'date inconnue';
    $('#dataImportSummary').innerHTML=`<strong>${esc(file.name)}</strong><br>Sauvegarde du ${esc(when)}<br>${recipeCount} recette(s) · ${planCount} repas planifié(s) · ${shoppingCount} article(s) de courses.<br><span class="muted">Les données actuelles de cet appareil seront remplacées après confirmation.</span>`;
    $('#dataImportDialog').showModal();
  }catch(err){console.error(err);pendingDataImport=null;alert(`Import impossible : ${err.message}`);}
  finally{e.target.value='';}
};
if($('#importPaprikaBackup'))$('#importPaprikaBackup').onclick=()=>$('#importPaprika')?.click();
$('#closeDataImport').onclick=$('#cancelDataImport').onclick=()=>{$('#dataImportDialog').close();pendingDataImport=null};
$('#dataImportForm').onsubmit=async e=>{
  e.preventDefault();if(!pendingDataImport)return;
  try{
    createEmergencyCheckpoint('avant import');
    const currentHgKeys=hgAllEntries().map(([key])=>key).filter(key=>key?.startsWith('hg-')&&key!==EMERGENCY_BACKUP_KEY);
    currentHgKeys.forEach(key=>hgRemove(key));
    Object.entries(pendingDataImport.data).forEach(([key,value])=>hgSet(key,value));
    if(window.hgMediaImport&&Array.isArray(pendingDataImport.media))await window.hgMediaImport(pendingDataImport.media);
    const importedRecipes=(()=>{try{return JSON.parse(pendingDataImport.data[recipeStore]||'[]')}catch{return []}})();
    const remotePhotos=importedRecipes.filter(r=>r?._importPhotoUrl&&!r.photoId);
    if(remotePhotos.length&&window.hgMediaImportRemotePhoto){
      let ok=0,failed=0;
      for(const r of remotePhotos){try{r.photoId=await window.hgMediaImportRemotePhoto(r.id,r._importPhotoUrl);delete r._importPhotoUrl;ok++}catch(err){console.warn('Photo distante',r.title,err);failed++}}
      hgSet(recipeStore,JSON.stringify(importedRecipes));
      if(failed)console.warn(`${failed} photo(s) distante(s) non importée(s)`);
    }
    const importedName=pendingDataImport._filename||'sauvegarde importée';
    hgSet(BACKUP_META_KEY,JSON.stringify({at:pendingDataImport.exportedAt||new Date().toISOString(),filename:importedName}));
    hgSet(CHANGE_COUNTER_KEY,'0');
    hgSet(LAST_DEVICE_ACTION_KEY,`Import ${importedName}`);
    $('#dataImportDialog').close();
    await hgFlush();
    alert('Import terminé avec succès. Herbier Gourmand va recharger les données.');
    location.reload();
  }catch(err){console.error(err);alert('Impossible d’importer les données. Le point de restauration local a été conservé lorsque sa création a réussi.');}
};


// v2.7 — partage, lecture seule, GitHub et producteurs locaux
const producerStore='hg-producers-v27';
const READONLY=new URLSearchParams(location.search).get('readonly')==='1';
let producers=[],viewedProducerId=null,previousProducerView='producers',dirty=false;
function markDirty(){dirty=true;document.body.classList.add('has-unsaved');const el=$('#saveState');if(el){el.textContent='Modifications non sauvegardées';el.classList.add('dirty')}}
function clearDirty(){dirty=false;document.body.classList.remove('has-unsaved');const el=$('#saveState');if(el){el.textContent='À jour';el.classList.remove('dirty')}}
addEventListener('beforeunload',e=>{if(dirty&&!READONLY){e.preventDefault();e.returnValue='';}});
function inferredGithubConfig(){const host=location.hostname,parts=location.pathname.split('/').filter(Boolean);return {owner:host.endsWith('.github.io')?host.split('.')[0]:'',repo:parts[0]||'',branch:'main',path:'herbier-latest.hgbak'};}
function githubConfig(){try{return {...inferredGithubConfig(),...JSON.parse(hgGet('hg-github-config-v27')||'{}')}}catch{return inferredGithubConfig()}}
async function autoLoadSharedBackup(){if(!READONLY)return;try{const r=await fetch(`herbier-latest.hgbak?_=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;const b=await r.json();if(b?.format!=='HerbierGourmandBackup'||!b.data)return;Object.entries(b.data).forEach(([k,v])=>{if(k.startsWith('hg-')&&typeof v==='string')hgSet(k,v)});sessionStorage.setItem('hg-readonly-loaded',b.exportedAt||'loaded');}catch(e){console.warn('Sauvegarde partagée indisponible',e)}}
function applyReadonlyMode(){if(!READONLY)return;document.body.classList.add('readonly-mode');document.querySelector('header p').textContent+=' · Lecture seule';['#newRecipe','#importPaprika','#exportRecipeTable','#newRestaurant','#newProducer','#newHerb','#newProduce','#savePlan','#buildShopping','#addShopping','#addShoppingBottom','#clearChecks','#removeChecked','#clearShopping','#exportData','#importData','#saveToGithub','#githubSettings','#manageAisles','#addStock','#manageStockProducts'].forEach(s=>{const e=$(s);if(e)e.classList.add('hidden')});$$('[data-edit],[data-edit-restaurant],#editViewedRecipe,#editViewedRestaurant,#editViewedProducer,#editViewedHerb,#editViewedProduce,.restaurant-card-edit,.producer-card-edit').forEach(e=>e.classList.add('hidden'));}
$('#openReadonly').onclick=()=>open(`${location.origin}${location.pathname}?readonly=1`,'_blank');
$('#githubSettings').onclick=()=>{const c=githubConfig();$('#githubOwner').value=c.owner;$('#githubRepo').value=c.repo;$('#githubBranch').value=c.branch;$('#githubPath').value=c.path;$('#githubToken').value=sessionStorage.getItem('hg-github-token-v27')||'';$('#githubDialog').showModal()};
$('#closeGithub').onclick=$('#cancelGithub').onclick=()=>$('#githubDialog').close();
$('#githubForm').onsubmit=e=>{e.preventDefault();const c={owner:$('#githubOwner').value.trim(),repo:$('#githubRepo').value.trim(),branch:$('#githubBranch').value.trim(),path:$('#githubPath').value.trim()};hgSet('hg-github-config-v27',JSON.stringify(c));sessionStorage.setItem('hg-github-token-v27',$('#githubToken').value.trim());$('#githubDialog').close();$('#githubStatus').textContent='Configuration enregistrée pour ce navigateur.'};
function bytesToBase64(text){return btoa(unescape(encodeURIComponent(text)))}
async function githubPutFile(path,text,message){const c=githubConfig(),token=sessionStorage.getItem('hg-github-token-v27');if(!c.owner||!c.repo||!token)throw new Error('Configuration GitHub ou jeton manquant');const url=`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(c.branch)}`;let sha='';const old=await fetch(url,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`}});if(old.ok)sha=(await old.json()).sha||'';else if(old.status!==404)throw new Error(`Lecture GitHub impossible (${old.status})`);const body={message,content:bytesToBase64(text),branch:c.branch,...(sha?{sha}:{})};const put=await fetch(url.split('?')[0],{method:'PUT',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!put.ok)throw new Error(`Enregistrement GitHub impossible (${put.status})`);return put.json();}
$('#saveToGithub').onclick=async()=>{try{const btn=$('#saveToGithub');btn.disabled=true;$('#githubStatus').textContent='Sauvegarde en cours…';const snap=herbierStorageSnapshot(),text=JSON.stringify(snap,null,2),c=githubConfig(),d=new Date(),pad=n=>String(n).padStart(2,'0'),dated=`backups/Herbier_Gourmand_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.hgbak`;await githubPutFile(c.path,text,`Herbier Gourmand : sauvegarde ${d.toLocaleString('fr-FR')}`);await githubPutFile(dated,text,`Herbier Gourmand : archive ${d.toLocaleString('fr-FR')}`);markBackupCreated(c.path);clearDirty();$('#githubStatus').textContent='Sauvegarde GitHub terminée. La version en lecture seule est à jour.';btn.disabled=false;}catch(e){console.error(e);$('#githubStatus').textContent=e.message;$('#saveToGithub').disabled=false;}};

function normalizeProducer(p={}){return {id:String(p.id||slug(p.name||'producteur')),name:String(p.name||'Producteur sans nom'),type:String(p.type||''),categories:Array.isArray(p.categories)?p.categories:[],region:String(p.region||''),city:String(p.city||''),address:String(p.address||''),postalCode:String(p.postalCode||''),country:String(p.country||'Suisse'),phone:String(p.phone||''),website:String(p.website||''),hours:String(p.hours||''),products:Array.isArray(p.products)?p.products:[],featuredProducts:Array.isArray(p.featuredProducts)?p.featuredProducts:[],salesModes:Array.isArray(p.salesModes)?p.salesModes:[],labels:Array.isArray(p.labels)?p.labels:[],tags:Array.isArray(p.tags)?p.tags:[],notes:String(p.notes||''),description:String(p.description||''),services:String(p.services||''),directSale:String(p.directSale||''),source:String(p.source||''),catalogLinks:Array.isArray(p.catalogLinks)?p.catalogLinks:[],legacyProducerMigrated:!!p.legacyProducerMigrated};}
// Migration conservatrice, une seule fois par fiche : aucun effacement automatique du mémo.
function migrateProducerLegacy(){let changed=false;producers.forEach(p=>{if(p.legacyProducerMigrated)return;const terms=producerTerms(p);if(terms.length){const memo='Produits / tags à classer : '+terms.join(', ');if(!p.notes.includes(memo))p.notes=memo+(p.notes?'\n'+p.notes:'')}p.products=[];p.featuredProducts=[];p.tags=[];p.categories=[];p.salesModes=[];p.labels=[];p.legacyProducerMigrated=true;changed=true});if(changed){hgSet(producerStore,JSON.stringify(producers));registerProtectedChange();markDirty()}}
function producerCatalog(){return shoppingCatalogEntries()}
function producerCategories(){return [...new Set(producerCatalog().map(x=>String(x.group||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'))}
function producerLinkName(link){if(link.kind==='category')return link.name;const item=producerCatalog().find(x=>String(x.id)===String(link.id));return item?.name||'Produit absent du Catalogue'}
function producerLinksMarkup(p,editable=false){return (p.catalogLinks||[]).map((l,i)=>`<span class="producer-link-chip">${l.kind==='category'?'▦':'◈'} ${esc(producerLinkName(l))}${editable?` <button type="button" data-remove-producer-link="${i}" title="Retirer cette association">×</button>`:''}</span>`).join('')}
let producerDraftLinks=[];
function producerRenderDraft(){const el=$('#producerLinkedChips');if(!el)return;el.innerHTML=producerLinksMarkup({catalogLinks:producerDraftLinks},true)||'<span class="muted">Aucune association</span>';el.querySelectorAll('[data-remove-producer-link]').forEach(b=>b.onclick=()=>{producerDraftLinks.splice(Number(b.dataset.removeProducerLink),1);producerRenderDraft()})}
function producerSuggest(){const input=$('#producerCatalogQuery'),results=$('#producerCatalogSuggestions');if(!input||!results)return;const q=norm(input.value),kind=$('#producerCatalogKind').value;const choices=(kind==='category'?producerCategories().map(name=>({kind,name})):producerCatalog().map(x=>({kind:'product',id:String(x.id),name:x.name}))).filter(x=>!q||norm(x.name).includes(q)).slice(0,35);results.innerHTML=choices.map((x,i)=>`<button type="button" data-producer-choice="${i}">${esc(x.name)}</button>`).join('');results.querySelectorAll('button').forEach(b=>b.onclick=()=>{const x=choices[Number(b.dataset.producerChoice)];if(!x)return;if(!producerDraftLinks.some(l=>l.kind===x.kind&&(x.kind==='category'?l.name===x.name:String(l.id)===String(x.id))))producerDraftLinks.push(x);input.value='';results.innerHTML='';producerRenderDraft()})}
function producerOpenLink(p,index){const l=p.catalogLinks?.[index];if(!l)return;if(l.kind==='category'){switchView('ingredientCatalog');const group=$('#ingredientCatalogGroup');if(group){group.value=l.name;group.dispatchEvent(new Event('change',{bubbles:true}))}return}const item=producerCatalog().find(x=>String(x.id)===String(l.id));if(!item)return alert('Ce produit n’existe plus dans le Catalogue.');const matches=[...(typeof herbs!=='undefined'?herbs:[]),...(typeof produceItems!=='undefined'?produceItems:[])].filter(x=>norm(x.name)===norm(item.name));const action=matches.length?prompt(`« ${item.name} »\n1 — Catalogue\n2 — Encyclopédie`, '1'):'1';if(action==='2'&&matches.length){const h=(typeof herbs!=='undefined'?herbs:[]).find(x=>norm(x.name)===norm(item.name));if(h)showHerb(h.id,'producerView');else showProduce(matches[0].id,'producerView');return}if(action==='1'){switchView('ingredientCatalog');const search=$('#ingredientCatalogSearch')||$('#catalogSearch');if(search){search.value=item.name;search.dispatchEvent(new Event('input',{bubbles:true}))}}}
function saveProducers(){hgSet(producerStore,JSON.stringify(producers));registerProtectedChange();markDirty()}
async function initProducers(){try{const stored=JSON.parse(hgGet(producerStore)||'null');if(stored)producers=stored;else{const r=await fetch(`producers.json?_=${Date.now()}`,{cache:'no-store'});producers=r.ok?await r.json():[];hgSet(producerStore,JSON.stringify(producers))}producers=producers.map(normalizeProducer);migrateProducerLegacy();renderProducerFilters();refreshProducerCitySuggestions();renderProducers()}catch(e){console.error(e);producers=[];renderProducers()}}
function producerTerms(p){return [...new Set([...(p.products||[]),...(p.featuredProducts||[]),...(p.tags||[]),...(p.categories||[]),...(p.salesModes||[]),...(p.labels||[])].map(x=>String(x||'').trim()).filter(Boolean))]}
function producerTypes(p){return [...new Set([p.type,...(p.categories||[])].map(x=>String(x||'').trim()).filter(Boolean))]}
function producerValues(field){return [...new Set(producers.flatMap(p=>field==='tags'?producerTerms(p):field==='type'?producerTypes(p):[p[field]]).map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))}
function fillProducerSelect(id,values,label){const e=$(id),v=e.value;e.innerHTML=`<option value="">${label}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(values.includes(v))e.value=v}
function producerFacetPool(exclude){const q=norm($('#producerSearch').value),region=$('#producerRegion').value,city=$('#producerCity').value,type=$('#producerType').value,tag=$('#producerTag').value;return producers.filter(p=>(!q||norm(JSON.stringify(p)).includes(q))&&(exclude==='region'||!region||p.region===region)&&(exclude==='city'||!city||p.city===city)&&(exclude==='type'||!type||producerTypes(p).includes(type))&&(exclude==='tags'||!tag||producerTerms(p).includes(tag)))}
function producerFacetValues(field){const pool=producerFacetPool(field);return [...new Set(pool.flatMap(p=>field==='tags'?producerTerms(p):field==='type'?producerTypes(p):[p[field]]).map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))}
function renderProducerFilters(){fillProducerSelect('#producerRegion',producerFacetValues('region'),'Toutes les régions');fillProducerSelect('#producerCity',producerFacetValues('city'),'Tous les lieux');fillProducerSelect('#producerType',producerFacetValues('type'),'Tous les types');fillProducerSelect('#producerTag',producerFacetValues('tags'),'Tous les produits')}
function filteredProducers(){const q=norm($('#producerSearch').value),region=$('#producerRegion').value,city=$('#producerCity').value,type=$('#producerType').value,tag=$('#producerTag').value;return producers.filter(p=>(!q||norm(JSON.stringify(p)).includes(q))&&(!region||p.region===region)&&(!city||p.city===city)&&(!type||producerTypes(p).includes(type))&&(!tag||producerTerms(p).includes(tag))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}))}
function producerCard(p){return `<article class="restaurant-card producer-card"><button class="restaurant-card-main" data-view-producer="${esc(p.id)}"><div class="meta">${esc([p.type,p.city,p.region].filter(Boolean).join(' · '))}</div><h3>${esc(p.name)}</h3><div class="badges">${(p.catalogLinks||[]).slice(0,6).map(l=>`<span>${esc(producerLinkName(l))}</span>`).join('')}</div></button><button class="restaurant-card-edit producer-card-edit" data-edit-producer="${esc(p.id)}">Modifier</button></article>`}
function renderProducers(){const list=filteredProducers();$('#producerCount').textContent=`${list.length} adresse${list.length>1?'s':''}`;$('#producerList').innerHTML=list.map(producerCard).join('')||'<p>Aucun producteur trouvé.</p>';$$('[data-view-producer]').forEach(b=>b.onclick=()=>showProducer(b.dataset.viewProducer,'producers'));$$('[data-edit-producer]').forEach(b=>b.onclick=()=>openProducer(b.dataset.editProducer));if(READONLY)applyReadonlyMode()}
['#producerSearch','#producerRegion','#producerCity','#producerType','#producerTag'].forEach(id=>{const e=$(id);e.addEventListener(e.tagName==='INPUT'?'input':'change',()=>{renderProducerFilters();renderProducers()})});$('#clearProducerFilters').onclick=()=>{$('#producerSearch').value='';$('#producerRegion').value='';$('#producerCity').value='';$('#producerType').value='';$('#producerTag').value='';renderProducerFilters();renderProducers()};
function showProducer(id,from=''){const p=producers.find(x=>x.id===id);if(!p)return;if(from){rememberScroll(from);previousProducerView=from}else if(!previousProducerView)previousProducerView='producers';viewedProducerId=id;const lines=[p.address,[p.postalCode,p.city].filter(Boolean).join(' '),p.country].filter(Boolean);const details=[['Coordonnées',lines.join('\n')+(p.phone?'\n'+p.phone:'')+(p.website?'\n'+p.website:'')],['Horaires',p.hours],['Vente directe',p.directSale],['Produits proposés',''],['Remarques',p.notes]];$('#producerViewContent').innerHTML=`<div class="restaurant-detail-head"><div class="meta">${esc([p.type,p.region].filter(Boolean).join(' · '))}</div><h2>${esc(p.name)}</h2></div><div class="producer-compact-detail">${details.map(([title,value])=>`<section><h3>${title}</h3>${title==='Produits proposés'?`<div class="producer-linked-view">${(p.catalogLinks||[]).map((l,i)=>`<button type="button" data-open-producer-link="${i}" class="producer-link-chip">${l.kind==='category'?'▦':'◈'} ${esc(producerLinkName(l))}</button>`).join('')||'À compléter'}</div>`:`<p>${esc(value||'—').replace(/\n/g,'<br>')}</p>`}</section>`).join('')}</div>`;$$('[data-open-producer-link]').forEach(b=>b.onclick=()=>producerOpenLink(p,Number(b.dataset.openProducerLink)));switchView('producerView')}
$('#backFromProducer').onclick=()=>switchView(previousProducerView);$('#editViewedProducer').onclick=()=>openProducer(viewedProducerId);
function openProducer(id){if(READONLY)return;const p=producers.find(x=>x.id===id);$('#producerDialogTitle').textContent=p?'Modifier le producteur':'Nouveau producteur';$('#producerId').value=p?.id||'';$('#producerName').value=p?.name||'';fillEditableSelect($('#producerTypeField'),producerValues('type'),p?.type||'','Choisir…');fillEditableSelect($('#producerRegionField'),producerValues('region'),p?.region||'','Choisir…');refreshProducerCitySuggestions();$('#producerCityField').value=p?.city||'';$('#producerAddress').value=p?.address||'';$('#producerPostal').value=p?.postalCode||'';$('#producerCountry').value=p?.country||'Suisse';$('#producerPhone').value=p?.phone||'';$('#producerWebsite').value=p?.website||'';$('#producerDirectSale').value=p?.directSale||'';$('#producerHours').value=p?.hours||'';producerDraftLinks=(p?.catalogLinks||[]).map(x=>({...x}));$('#producerCatalogQuery').value='';$('#producerCatalogSuggestions').innerHTML='';producerRenderDraft();$('#producerNotes').value=p?.notes||'';$('#deleteProducer').classList.toggle('hidden',!p);$('#duplicateProducer').classList.toggle('hidden',!p);$('#producerDialog').showModal()}
// Confirmation intégrée : libellés Non / Oui indépendants du navigateur.
function producerConfirmCreate(name){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='hg-producer-confirm';
  const message=document.createElement('p');message.textContent=`« ${name} » n'existe pas dans le Catalogue.\nVoulez-vous l'enregistrer ?`;
  const actions=document.createElement('div');actions.className='hg-confirm-actions';
  const no=document.createElement('button');no.type='button';no.textContent='Non';
  const yes=document.createElement('button');yes.type='button';yes.textContent='Oui';yes.className='primary';
  actions.append(no,yes);dialog.append(message,actions);document.body.appendChild(dialog);
  let result=false;no.onclick=()=>dialog.close();yes.onclick=()=>{result=true;dialog.close()};
  dialog.addEventListener('close',()=>{dialog.remove();resolve(result)},{once:true});dialog.showModal();
 });
}
// Création explicite dans le Catalogue : conserver le brouillon Producteur tant que la création n'est pas validée.
let producerCatalogPending=false;
async function producerCreateUnknown(){
 const input=$('#producerCatalogQuery'),name=input.value.trim();
 if($('#producerCatalogKind').value!=='product'||!name)return;
 const found=producerCatalog().find(x=>norm(x.name)===norm(name));
 if(found){if(!producerDraftLinks.some(l=>l.kind==='product'&&String(l.id)===String(found.id)))producerDraftLinks.push({kind:'product',id:String(found.id),name:found.name});input.value='';$('#producerCatalogSuggestions').innerHTML='';producerRenderDraft();return}
 if(!await producerConfirmCreate(name))return;
 // Réutiliser exactement le parcours Courses : ouverture, attente de l'enregistrement,
 // et restauration du dialogue Producteurs même en cas d'annulation.
 const producerDialog=$('#producerDialog');producerDialog.close();
 let created=null;
 try{created=await shoppingCatalogCreate(name)}finally{if(!producerDialog.open)producerDialog.showModal()}
 if(created?.id){
  if(!producerDraftLinks.some(l=>l.kind==='product'&&String(l.id)===String(created.id)))producerDraftLinks.push({kind:'product',id:String(created.id),name:created.name});
  input.value='';$('#producerCatalogSuggestions').innerHTML='';producerRenderDraft();
 }
}
$('#producerCatalogQuery').addEventListener('input',producerSuggest);
$('#producerCatalogKind').addEventListener('change',producerSuggest);
$('#producerCatalogCreate').addEventListener('click',producerCreateUnknown);
$('#producerCatalogQuery').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();producerCreateUnknown()}});
$('#newProducer').onclick=()=>openProducer();$('#closeProducer').onclick=()=>$('#producerDialog').close();
function producerFromForm(newId=''){const old=producers.find(x=>x.id===$('#producerId').value);return normalizeProducer({...old,id:newId||$('#producerId').value||slug($('#producerName').value),name:$('#producerName').value.trim(),type:$('#producerTypeField').value.trim(),region:$('#producerRegionField').value.trim(),city:$('#producerCityField').value.trim(),address:$('#producerAddress').value.trim(),postalCode:$('#producerPostal').value.trim(),country:$('#producerCountry').value.trim(),phone:$('#producerPhone').value.trim(),website:$('#producerWebsite').value.trim(),directSale:$('#producerDirectSale').value.trim(),hours:$('#producerHours').value.trim(),catalogLinks:producerDraftLinks.map(x=>({...x})),notes:$('#producerNotes').value.trim()})}
$('#producerForm').onsubmit=e=>{e.preventDefault();const p=producerFromForm(),i=producers.findIndex(x=>x.id===p.id);if(i>=0)producers[i]=p;else producers.push(p);saveProducers();renderProducerFilters();refreshProducerCitySuggestions();renderProducers();$('#producerDialog').close();if(viewedProducerId===p.id)showProducer(p.id)};
$('#deleteProducer').onclick=()=>{const id=$('#producerId').value;if(id&&confirm('Supprimer définitivement ce producteur ?')){producers=producers.filter(p=>p.id!==id);saveProducers();renderProducerFilters();refreshProducerCitySuggestions();renderProducers();$('#producerDialog').close();switchView('producers')}};
$('#duplicateProducer').onclick=()=>{const p=producerFromForm(slug($('#producerName').value));p.name+=' (copie)';producers.push(p);saveProducers();renderProducerFilters();renderProducers();$('#producerDialog').close()};
if($('#producerCityField')){
  $('#producerCityField').addEventListener('input',renderProducerCityMatches);
  $('#producerCityField').addEventListener('focus',renderProducerCityMatches);
  $('#producerCityField').addEventListener('keydown',e=>{if(e.key==='Escape')closeProducerCityMatches()});
}
document.addEventListener('click',e=>{if(!e.target.closest('.producer-city-autocomplete'))closeProducerCityMatches()});


// v2.9.7.8 — suggestions tactiles : alternative explicite à Tab sur smartphone
function datalistValuesForInput(input){
  const listId=input?.getAttribute('list');
  if(!listId)return [];
  const dl=document.getElementById(listId);
  if(!dl)return [];
  return [...dl.querySelectorAll('option')].map(o=>String(o.value||'').trim()).filter(Boolean);
}
function suggestionTokenInfo(input){
  const raw=String(input.value||'');
  // Les tags acceptent plusieurs valeurs séparées par des virgules : on complète le dernier terme.
  if(input.id==='recipeTags'){
    const parts=raw.split(',');
    return {prefix:parts.slice(0,-1).join(',').trim(),query:(parts.at(-1)||'').trim()};
  }
  return {prefix:'',query:raw.trim()};
}
function applyTouchSuggestion(input,value){
  if(input.id==='recipeTags'){
    const raw=String(input.value||''), parts=raw.split(',');
    parts[parts.length-1]=' '+value;
    input.value=parts.join(',').replace(/^\s+/, '');
  }else input.value=value;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  closeTouchSuggestions(input);
  input.focus();
}
function ensureTouchSuggestionBox(input){
  if(input?._hgSuggestionBox)return input._hgSuggestionBox;
  const wrap=document.createElement('div');wrap.className='hg-touch-choice-wrap';
  input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
  const box=document.createElement('div');box.className='hg-touch-choice-list';box.setAttribute('role','listbox');
  wrap.appendChild(box);input._hgSuggestionBox=box;return box;
}
function positionTouchSuggestions(input){
  const box=input?._hgSuggestionBox;if(!box||!box.classList.contains('open'))return;
  const stockField=['stockProduct','stockLocation','stockGroup','stockAisle','newStockProductAisle'].includes(input.id);
  if(!stockField){box.style.cssText='';return}
  const vv=window.visualViewport, vr=vv?{top:vv.offsetTop,height:vv.height,width:vv.width}:{top:0,height:innerHeight,width:innerWidth};
  const r=input.getBoundingClientRect(), margin=8, bottom=vr.top+vr.height-margin;
  const roomBelow=bottom-r.bottom-6, desired=Math.min(260,Math.max(110,roomBelow));
  box.style.position='fixed';box.style.left=Math.max(margin,r.left)+'px';box.style.width=Math.min(r.width,vr.width-margin*2)+'px';
  box.style.right='auto';box.style.top=(r.bottom+4)+'px';box.style.maxHeight=desired+'px';box.style.zIndex='10000';
  if(roomBelow<110){
    const roomAbove=r.top-vr.top-margin;
    box.style.maxHeight=Math.min(260,Math.max(90,roomAbove-6))+'px';
    box.style.top='auto';box.style.bottom=Math.max(margin,(window.innerHeight-(r.top-4)))+'px';
  }else box.style.bottom='auto';
}
function closeTouchSuggestions(input){
  const box=input?._hgSuggestionBox;
  if(box){box.classList.remove('open');box.innerHTML='';box.style.cssText=''}
}
function renderTouchSuggestions(input){
  if(!input)return;
  document.querySelectorAll('input[list]').forEach(other=>{if(other!==input)closeTouchSuggestions(other)});
  const values=datalistValuesForInput(input);
  if(!values.length){closeTouchSuggestions(input);return}
  const {query}=suggestionTokenInfo(input), q=norm(query);
  const matches=(q?values.filter(v=>norm(v).startsWith(q)||norm(v).includes(q)):values).slice(0,12);
  const box=ensureTouchSuggestionBox(input);
  box.innerHTML=matches.length?matches.map(v=>`<button type="button" role="option" data-hg-touch-choice="${esc(v)}">${esc(v)}</button>`).join(''):'<div class="hg-touch-choice-empty">Aucun résultat</div>';
  box.classList.add('open');positionTouchSuggestions(input);
  box.querySelectorAll('[data-hg-touch-choice]').forEach(btn=>btn.onclick=()=>applyTouchSuggestion(input,btn.dataset.hgTouchChoice));
}
function initTouchChoiceFields(){
  document.querySelectorAll('input[list]').forEach(input=>{
    if(input.dataset.hgTouchChoiceReady==='1')return;
    input.dataset.hgTouchChoiceReady='1';
    ensureTouchSuggestionBox(input); // créé avant la saisie : le champ ne bouge plus après la première lettre
    input.addEventListener('input',()=>renderTouchSuggestions(input));
    input.addEventListener('focus',()=>renderTouchSuggestions(input));
    input.addEventListener('keydown',e=>{
      const box=input._hgSuggestionBox, first=box?.querySelector('[data-hg-touch-choice]');
      if((e.key==='Enter'||e.key==='Tab')&&first&&box.classList.contains('open')){
        e.preventDefault();applyTouchSuggestion(input,first.dataset.hgTouchChoice);
      }else if(e.key==='Escape')closeTouchSuggestions(input);
    });
  });
}
const repositionOpenTouchSuggestions=()=>document.querySelectorAll('input[list]').forEach(input=>{if(input._hgSuggestionBox?.classList.contains('open'))positionTouchSuggestions(input)});
window.visualViewport?.addEventListener('resize',repositionOpenTouchSuggestions);
window.visualViewport?.addEventListener('scroll',repositionOpenTouchSuggestions);
window.addEventListener('resize',repositionOpenTouchSuggestions);
document.addEventListener('pointerdown',e=>{
  document.querySelectorAll('input[list]').forEach(input=>{if(!e.target.closest('.hg-touch-choice-wrap')&&e.target!==input)closeTouchSuggestions(input)});
});
initTouchChoiceFields();


async function checkForUpdate(){try{await fetch(`version.json?_=${Date.now()}`,{cache:'no-store'}).then(r=>r.json())}catch{}}
/* v2.9.7.15.3 — bouton d’installation retiré du bandeau ; le navigateur garde ses propres commandes d’installation. */
init().catch(failStartup);


function fillEditableSelect(el,values,current='',empty='Choisir…'){if(!el)return;const list=[...new Set(values.map(x=>String(x||'').trim()).filter(Boolean))];if(current&&!list.includes(current))list.push(current);list.sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));el.innerHTML=`<option value="">${empty}</option>`+list.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')+'<option value="__other__">Autre…</option>';el.value=current||'';}
function producerCityMatches(query=''){const q=norm(query);const values=producerValues('city');return (q?values.filter(v=>norm(v).includes(q)):values).slice(0,40)}
function closeProducerCityMatches(){const box=$('#producerCityMatches');if(box)box.classList.remove('open')}
function renderProducerCityMatches(){const input=$('#producerCityField'),box=$('#producerCityMatches');if(!input||!box)return;const typed=input.value.trim(),matches=producerCityMatches(typed);if(!typed){box.innerHTML='';box.classList.remove('open');return}box.innerHTML=matches.map(v=>`<button type="button" role="option" data-producer-city-choice="${esc(v)}">${esc(v)}</button>`).join('');box.classList.toggle('open',matches.length>0);$$('[data-producer-city-choice]').forEach(btn=>btn.onclick=()=>{input.value=btn.dataset.producerCityChoice;closeProducerCityMatches();input.focus()})}
function refreshProducerCitySuggestions(){renderProducerCityMatches()}

// v2.6 — Envie d’une sortie ?
const restaurantStore='hg-restaurants-v26';
let restaurants=[], viewedRestaurantId=null, previousRestaurantView='restaurants', restaurantReturnContext=null;
function normalizeRestaurant(r={}){return {id:String(r.id||slug(r.name||'restaurant')),name:String(r.name||'Restaurant sans nom'),tenant:String(r.tenant||''),address:String(r.address||''),postalCode:String(r.postalCode||''),city:String(r.city||''),country:String(r.country||''),region:String(r.region||''),phone:String(r.phone||''),phones:Array.isArray(r.phones)?r.phones:[],email:String(r.email||''),website:String(r.website||''),hours:String(r.hours||''),specialties:Array.isArray(r.specialties)?r.specialties:[],notes:String(r.notes||''),source:String(r.source||'')};}
function saveRestaurants(){hgSet(restaurantStore,JSON.stringify(restaurants));registerProtectedChange();markDirty();}
async function initRestaurants(){
  try{const stored=JSON.parse(hgGet(restaurantStore)||'null');if(stored)restaurants=stored;else{const res=await fetch(`restaurants.json?_=${Date.now()}`,{cache:'no-store'});restaurants=res.ok?await res.json():[];saveRestaurants();}restaurants=restaurants.map(normalizeRestaurant);renderRestaurantFilters();renderRestaurants();}
  catch(e){console.error(e);restaurants=[];renderRestaurants();}
}
function uniqueRestaurantValues(field){return [...new Set(restaurants.flatMap(r=>field==='specialties'?r.specialties:[r[field]]).map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));}
function fillRestaurantSelect(id,values,firstLabel){const el=$(id),current=el.value;el.innerHTML=`<option value="">${firstLabel}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(values.includes(current))el.value=current;}
function renderRestaurantFilters(){fillRestaurantSelect('#restaurantRegion',uniqueRestaurantValues('region'),'Toutes les régions');fillRestaurantSelect('#restaurantCity',uniqueRestaurantValues('city'),'Tous les lieux');fillRestaurantSelect('#restaurantCountry',uniqueRestaurantValues('country'),'Tous les pays');fillRestaurantSelect('#restaurantSpecialty',uniqueRestaurantValues('specialties'),'Toutes les spécialités');}
function restaurantFiltered(){const q=norm($('#restaurantSearch').value),region=$('#restaurantRegion').value,city=$('#restaurantCity').value,country=$('#restaurantCountry').value,tag=$('#restaurantSpecialty').value;return restaurants.filter(r=>(!q||norm(r.name).includes(q))&&(!region||r.region===region)&&(!city||r.city===city)&&(!country||r.country===country)&&(!tag||r.specialties.includes(tag))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));}
function restaurantCard(r){const locality=[r.postalCode,r.city,r.country].filter(Boolean).join(' · '),hours=String(r.hours||'Horaires à compléter').replace(/\s*\n\s*/g,' · ');return `<article class="restaurant-card restaurant-card-compact"><button class="restaurant-card-main" data-view-restaurant="${esc(r.id)}"><div class="restaurant-line restaurant-line-main"><h3>${esc(r.name)}</h3><span class="meta">${esc(locality||'Lieu à compléter')}</span></div><div class="restaurant-line restaurant-line-info"><span class="restaurant-hours">${esc(hours)}</span><span class="badges restaurant-tags">${r.specialties.slice(0,5).map(t=>`<span>${esc(t)}</span>`).join('')}</span></div></button><button class="restaurant-card-edit" data-edit-restaurant="${esc(r.id)}">Modifier</button></article>`;}
function renderRestaurants(){const found=restaurantFiltered();$('#restaurantCount').textContent=`${found.length} adresse${found.length>1?'s':''}`;$('#restaurantList').innerHTML=found.map(restaurantCard).join('')||'<p>Aucun restaurant trouvé.</p>';$$('[data-view-restaurant]').forEach(b=>b.onclick=()=>showRestaurant(b.dataset.viewRestaurant,'restaurants'));$$('[data-edit-restaurant]').forEach(b=>b.onclick=()=>openRestaurant(b.dataset.editRestaurant));}
['#restaurantSearch','#restaurantRegion','#restaurantCity','#restaurantCountry','#restaurantSpecialty'].forEach(id=>{const el=$(id);el.addEventListener(el.tagName==='INPUT'?'input':'change',renderRestaurants)});
$('#clearRestaurantFilters').onclick=()=>{$('#restaurantSearch').value='';$('#restaurantRegion').value='';$('#restaurantCity').value='';$('#restaurantCountry').value='';$('#restaurantSpecialty').value='';renderRestaurants();};
function linkMarkup(url,label){if(!url)return'';let href=url;if(!/^https?:\/\//i.test(href))href='https://'+href;return `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;}
function showRestaurant(id,from=''){const r=restaurants.find(x=>x.id===id);if(!r)return;if(from){rememberScroll(from);previousRestaurantView=from;if(from==='restaurants')restaurantReturnContext={scrollY:scrollY,search:$('#restaurantSearch').value,region:$('#restaurantRegion').value,city:$('#restaurantCity').value,country:$('#restaurantCountry').value,specialty:$('#restaurantSpecialty').value}}else if(!previousRestaurantView)previousRestaurantView='restaurants';viewedRestaurantId=id;const address=[r.address,[r.postalCode,r.city].filter(Boolean).join(' '),r.country].filter(Boolean).map(esc).join('<br>');$('#restaurantViewContent').innerHTML=`<div class="restaurant-detail-head"><div><div class="meta">${esc([r.city,r.country].filter(Boolean).join(' · '))}</div><h2>${esc(r.name)}</h2>${r.tenant?`<p><strong>Tenancier :</strong> ${esc(r.tenant)}</p>`:''}</div></div><div class="restaurant-detail-grid"><section><h3>Coordonnées</h3>${address?`<p>${address}</p>`:''}${r.phone?`<p><a href="tel:${esc(r.phone.replace(/\s/g,''))}">${esc(r.phone)}</a></p>`:''}${r.email?`<p><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></p>`:''}${r.website?`<p>${linkMarkup(r.website,'Ouvrir le site internet')}</p>`:''}</section><section><h3>Heures d’ouverture</h3><p>${r.hours?esc(r.hours).replace(/\n/g,'<br>'):'À compléter'}</p></section><section><h3>Spécialités</h3><div class="badges">${r.specialties.length?r.specialties.map(t=>`<span>${esc(t)}</span>`).join(''):'À compléter'}</div></section><section><h3>Remarques</h3><p>${r.notes?esc(r.notes).replace(/\n/g,'<br>'):'—'}</p></section></div>`;switchView('restaurantView');}
$('#backFromRestaurant').onclick=()=>{if(previousRestaurantView==='restaurants'&&restaurantReturnContext){$('#restaurantSearch').value=restaurantReturnContext.search||'';$('#restaurantRegion').value=restaurantReturnContext.region||'';$('#restaurantCity').value=restaurantReturnContext.city||'';$('#restaurantCountry').value=restaurantReturnContext.country||'';$('#restaurantSpecialty').value=restaurantReturnContext.specialty||'';renderRestaurants();viewScrollPositions.restaurants=restaurantReturnContext.scrollY||0}switchView(previousRestaurantView)};$('#editViewedRestaurant').onclick=()=>openRestaurant(viewedRestaurantId);
function openRestaurant(id){const r=restaurants.find(x=>x.id===id);$('#restaurantDialogTitle').textContent=r?'Modifier le restaurant':'Nouveau restaurant';$('#restaurantId').value=r?.id||'';$('#restaurantName').value=r?.name||'';$('#restaurantTenant').value=r?.tenant||'';$('#restaurantAddress').value=r?.address||'';$('#restaurantPostal').value=r?.postalCode||'';fillEditableSelect($('#restaurantRegionField'),uniqueRestaurantValues('region'),r?.region||'','Choisir…');fillEditableSelect($('#restaurantCityField'),uniqueRestaurantValues('city'),r?.city||'','Choisir…');fillEditableSelect($('#restaurantCountryField'),uniqueRestaurantValues('country'),r?.country||'Suisse','Choisir…');$('#restaurantPhone').value=r?.phone||'';$('#restaurantWebsite').value=r?.website||'';$('#restaurantHours').value=r?.hours||'';$('#restaurantSpecialties').value=(r?.specialties||[]).join(', ');$('#restaurantNotes').value=r?.notes||'';$('#deleteRestaurant').classList.toggle('hidden',!r);$('#duplicateRestaurant').classList.toggle('hidden',!r);$('#restaurantDialog').showModal();}
$('#newRestaurant').onclick=()=>openRestaurant();$('#closeRestaurant').onclick=()=>$('#restaurantDialog').close();
function restaurantFromForm(newId=''){const existing=restaurants.find(x=>x.id===$('#restaurantId').value);return normalizeRestaurant({...existing,id:newId||$('#restaurantId').value||slug($('#restaurantName').value),name:$('#restaurantName').value.trim(),tenant:$('#restaurantTenant').value.trim(),address:$('#restaurantAddress').value.trim(),postalCode:$('#restaurantPostal').value.trim(),region:$('#restaurantRegionField').value.trim(),city:$('#restaurantCityField').value.trim(),country:$('#restaurantCountryField').value.trim(),phone:$('#restaurantPhone').value.trim(),website:$('#restaurantWebsite').value.trim(),hours:$('#restaurantHours').value.trim(),specialties:$('#restaurantSpecialties').value.split(',').map(x=>x.trim()).filter(Boolean),notes:$('#restaurantNotes').value.trim()});}
$('#restaurantForm').onsubmit=e=>{e.preventDefault();const r=restaurantFromForm();const i=restaurants.findIndex(x=>x.id===r.id);if(i>=0)restaurants[i]=r;else restaurants.unshift(r);saveRestaurants();renderRestaurantFilters();renderRestaurants();$('#restaurantDialog').close();if(viewedRestaurantId===r.id)showRestaurant(r.id);};
$('#deleteRestaurant').onclick=()=>{const id=$('#restaurantId').value;if(id&&confirm('Supprimer définitivement ce restaurant ?')){restaurants=restaurants.filter(r=>r.id!==id);saveRestaurants();renderRestaurantFilters();renderRestaurants();$('#restaurantDialog').close();switchView('restaurants')}};
$('#duplicateRestaurant').onclick=()=>{const r=restaurantFromForm(`${slug($('#restaurantName').value)}-${Date.now()}`);r.name+=' (copie)';restaurants.unshift(r);saveRestaurants();renderRestaurantFilters();renderRestaurants();$('#restaurantDialog').close();};
updateBackupReminder();


// v2.8 Bloc B — Grand Herbier : Plantes & Épices
const herbStore='hg-herbs-spices-v28';
const HERB_HARMONISATION_67=[{"id":"persil-plat","oldName":"Persil plat","name":"Persil plat","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"persil-frise","oldName":"Persil frisé","name":"Persil frisé","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"basilic-genois","oldName":"Basilic génois","name":"Basilic génois","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"basilic-thai","oldName":"Basilic thaï","name":"Basilic thaï","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"basilic-citron","oldName":"Basilic citron","name":"Basilic citron","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"basilic-pourpre","oldName":"Basilic pourpre","name":"Basilic pourpre","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"ciboulette","oldName":"Ciboulette","name":"Ciboulette","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"ciboule","oldName":"Ciboule","name":"Ciboule","botanical":"Herbe aromatique","catalogue":"Légumes"},{"id":"thym-commun","oldName":"Thym","name":"Thym","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"thym-citron","oldName":"Thym citron","name":"Thym citron","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"serpolet","oldName":"Serpolet","name":"Serpolet","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"romarin","oldName":"Romarin","name":"Romarin","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"origan-grec","oldName":"Origan grec","name":"Origan grec","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"origan-mexicain","oldName":"Origan mexicain","name":"Origan mexicain","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"marjolaine","oldName":"Marjolaine","name":"Marjolaine","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"sauge-officinale","oldName":"Sauge officinale","name":"Sauge officinale","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"sauge-ananas","oldName":"Sauge ananas","name":"Sauge ananas","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"menthe-poivree","oldName":"Menthe poivrée","name":"Menthe poivrée","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"menthe-verte","oldName":"Menthe verte","name":"Menthe verte","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"menthe-marocaine","oldName":"Menthe marocaine","name":"Menthe marocaine","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"melisse","oldName":"Mélisse","name":"Mélisse","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"aneth","oldName":"Aneth","name":"Aneth","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"estragon-francais","oldName":"Estragon","name":"Estragon","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"cerfeuil","oldName":"Cerfeuil","name":"Cerfeuil","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"liveche","oldName":"Livèche","name":"Livèche","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"sarriette-d-ete","oldName":"Sarriette d'été","name":"Sarriette d'été","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"sarriette-d-hiver","oldName":"Sarriette d'hiver","name":"Sarriette d'hiver","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"laurier-sauce","oldName":"Laurier sauce","name":"Laurier","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"coriandre-fraiche","oldName":"Coriandre fraîche","name":"Coriandre","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"roquette","oldName":"Roquette","name":"Roquette (Rucola)","botanical":"Herbe aromatique","catalogue":"Salades"},{"id":"oseille","oldName":"Oseille","name":"Oseille","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"hysope","oldName":"Hysope","name":"Hysope","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"verveine-citronnee","oldName":"Verveine citronnée","name":"Verveine citronnée","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"achillee-millefeuille","oldName":"Achillée millefeuille","name":"Achillée millefeuille","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"angelique","oldName":"Angélique","name":"Angélique","botanical":"Herbe aromatique","catalogue":"Épices"},{"id":"armoise","oldName":"Armoise","name":"Armoise","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"bourrache","oldName":"Bourrache","name":"Bourrache","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"capucine","oldName":"Capucine","name":"Capucine","botanical":"Herbe aromatique","catalogue":"Fleurs comestibles"},{"id":"camomille","oldName":"Camomille","name":"Camomille","botanical":"Herbe aromatique","catalogue":"Fleurs comestibles"},{"id":"cresson-alenois","oldName":"Cresson alénois","name":"Cresson alénois","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"fenouil-feuille","oldName":"Fenouil feuille","name":"Fenouil feuille","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"myrte","oldName":"Myrte","name":"Myrte","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"shiso-vert","oldName":"Shiso vert","name":"Shiso vert","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"shiso-rouge","oldName":"Shiso rouge","name":"Shiso rouge","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"stevia-feuille","oldName":"Stévia feuille","name":"Stévia feuille","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"asperule-odorante","oldName":"Aspérule odorante","name":"Aspérule odorante","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"pimprenelle","oldName":"Pimprenelle","name":"Pimprenelle","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"ail-des-ours","oldName":"Ail des ours","name":"Ail des ours","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"mauve","oldName":"Mauve","name":"Mauve","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"ortie","oldName":"Ortie","name":"Ortie","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"pissenlit","oldName":"Pissenlit","name":"Pissenlit (Dent-de-lion)","botanical":"Herbe aromatique","catalogue":"Salades"},{"id":"plantain-lanceole","oldName":"Plantain lancéolé","name":"Plantain lancéolé","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"pourpier","oldName":"Pourpier","name":"Pourpier","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"reine-des-pres","oldName":"Reine-des-prés","name":"Reine-des-Prés","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"melilot","oldName":"Mélilot","name":"Mélilot","botanical":"Herbe aromatique","catalogue":"Épices"},{"id":"monarde","oldName":"Monarde","name":"Monarde","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"agastache","oldName":"Agastache","name":"Agastache","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"epazote","oldName":"Épazote","name":"Épazote","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"culantro","oldName":"Culantro","name":"Culantro","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"feuille-de-curry","oldName":"Kaloupilé (Feuille de curry)","name":"Kaloupilé (Feuille de curry)","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"citronnelle","oldName":"Citronnelle","name":"Citronnelle","botanical":"Herbe aromatique","catalogue":"Légumes"},{"id":"feuille-de-combava","oldName":"Combava feuille","name":"Combava feuille","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"feuille-de-pandan","oldName":"Pandan feuille","name":"Pandan feuille","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"feuille-de-moutarde","oldName":"Moutarde feuille","name":"Moutarde feuille","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"feuille-de-fenugrec","oldName":"Fenugrec feuille","name":"Fenugrec feuille","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"feuille-de-celeri","oldName":"Céleri feuille","name":"Céleri feuille","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"mitsuba","oldName":"Mitsuba","name":"Mitsuba","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"cresson-de-fontaine","oldName":"Cresson de fontaine","name":"Cresson de fontaine","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"tagete-citron","oldName":"Tagète citron","name":"Tagète citron","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"mertensia-maritime","oldName":"Mertensia maritime","name":"Mertensia maritime","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"rau-ram","oldName":"Rau ram","name":"Rau ram (Coriandre vietnamienne)","botanical":"Herbe aromatique","catalogue":"Herbes aromatiques"},{"id":"curcuma","oldName":"Curcuma","name":"Curcuma","botanical":"Épice","catalogue":"Épices"},{"id":"gingembre","oldName":"Gingembre","name":"Gingembre","botanical":"Épice","catalogue":"Épices"},{"id":"galanga","oldName":"Galanga","name":"Galanga","botanical":"Épice","catalogue":"Épices"},{"id":"cannelle-de-ceylan","oldName":"Cannelle de Ceylan","name":"Cannelle de Ceylan","botanical":"Épice","catalogue":"Épices"},{"id":"cannelle-cassia","oldName":"Cannelle Cassia (Cannelle de Chine)","name":"Cannelle Cassia (Cannelle de Chine)","botanical":"Épice","catalogue":"Épices"},{"id":"poivre-noir","oldName":"Poivre noir","name":"Poivre noir","botanical":"Épice","catalogue":"Épices"},{"id":"poivre-blanc","oldName":"Poivre blanc","name":"Poivre blanc","botanical":"Épice","catalogue":"Épices"},{"id":"poivre-vert","oldName":"Poivre vert","name":"Poivre vert","botanical":"Épice","catalogue":"Épices"},{"id":"poivre-long","oldName":"Poivre long","name":"Poivre long","botanical":"Épice","catalogue":"Épices"},{"id":"poivre-de-kampot","oldName":"Poivre de Kampot","name":"Poivre de Kampot","botanical":"Épice","catalogue":"Épices"},{"id":"paprika-doux","oldName":"Paprika doux","name":"Paprika doux","botanical":"Épice","catalogue":"Épices"},{"id":"paprika-fume","oldName":"Paprika fumé","name":"Paprika fumé","botanical":"Épice","catalogue":"Épices"},{"id":"paprika-fort","oldName":"Paprika fort","name":"Paprika fort","botanical":"Épice","catalogue":"Épices"},{"id":"piment-de-cayenne","oldName":"Piment de Cayenne","name":"Piment de Cayenne","botanical":"Épice","catalogue":"Épices"},{"id":"piment-d-espelette","oldName":"Piment d'Espelette","name":"Piment d'Espelette","botanical":"Épice","catalogue":"Épices"},{"id":"piment-chipotle","oldName":"Piment chipotle","name":"Piment chipotle","botanical":"Épice","catalogue":"Épices"},{"id":"piment-ancho","oldName":"Piment ancho","name":"Piment ancho","botanical":"Épice","catalogue":"Épices"},{"id":"piment-guajillo","oldName":"Piment guajillo","name":"Piment guajillo","botanical":"Épice","catalogue":"Épices"},{"id":"piment-habanero","oldName":"Piment habanero","name":"Piment habanero","botanical":"Épice","catalogue":"Épices"},{"id":"piment-oiseau","oldName":"Piment oiseau","name":"Piment oiseau","botanical":"Épice","catalogue":"Épices"},{"id":"cumin","oldName":"Cumin","name":"Cumin","botanical":"Épice","catalogue":"Épices"},{"id":"coriandre-graine","oldName":"Coriandre graine","name":"Coriandre graine","botanical":"Épice","catalogue":"Graines"},{"id":"fenouil-graine","oldName":"Fenouil graine","name":"Fenouil (graine)","botanical":"Épice","catalogue":"Graines"},{"id":"anis-vert","oldName":"Anis vert","name":"Anis vert","botanical":"Épice","catalogue":"Épices"},{"id":"anis-etoile","oldName":"Anis étoilé","name":"Anis étoilé","botanical":"Épice","catalogue":"Épices"},{"id":"cardamome-verte","oldName":"Cardamome verte","name":"Cardamome verte","botanical":"Épice","catalogue":"Épices"},{"id":"cardamome-noire","oldName":"Cardamome noire","name":"Cardamome noire","botanical":"Épice","catalogue":"Épices"},{"id":"clou-de-girofle","oldName":"Clou de girofle","name":"Clou de girofle","botanical":"Épice","catalogue":"Épices"},{"id":"noix-de-muscade","oldName":"Noix de muscade","name":"Noix de muscade","botanical":"Épice","catalogue":"Épices"},{"id":"macis","oldName":"Macis","name":"Macis","botanical":"Épice","catalogue":"Épices"},{"id":"safran","oldName":"Safran","name":"Safran","botanical":"Épice","catalogue":"Épices"},{"id":"nigelle","oldName":"Nigelle","name":"Nigelle","botanical":"Épice","catalogue":"Épices"},{"id":"sumac","oldName":"Sumac","name":"Sumac","botanical":"Épice","catalogue":"Épices"},{"id":"moutarde-jaune","oldName":"Moutarde jaune","name":"Moutarde jaune","botanical":"Épice","catalogue":"Épices"},{"id":"moutarde-noire","oldName":"Moutarde noire","name":"Moutarde noire","botanical":"Épice","catalogue":"Épices"},{"id":"genievre","oldName":"Genièvre","name":"Genièvre","botanical":"Épice","catalogue":"Épices"},{"id":"baies-roses","oldName":"Baie rose","name":"Baie rose","botanical":"Épice","catalogue":"Baies"},{"id":"carvi","oldName":"Carvi","name":"Carvi","botanical":"Épice","catalogue":"Épices"},{"id":"ajowan","oldName":"Ajowan (Cumin royal)","name":"Ajowan (Cumin royal)","botanical":"Épice","catalogue":"Épices"},{"id":"asafoetida","oldName":"Asafoetida","name":"Asafoetida","botanical":"Épice","catalogue":"Épices"},{"id":"vanille","oldName":"Vanille","name":"Vanille","botanical":"Épice","catalogue":"Épices"},{"id":"poivre-de-sichuan","oldName":"Poivre de Sichuan","name":"Poivre de Sichuan","botanical":"Épice","catalogue":"Épices"},{"id":"poivre-sansho","oldName":"Poivre Sansho","name":"Poivre Sansho","botanical":"Épice","catalogue":"Épices"},{"id":"feve-tonka","oldName":"Tonka fève","name":"Tonka fève","botanical":"Épice","catalogue":"Épices"},{"id":"reglisse","oldName":"Réglisse","name":"Réglisse","botanical":"Épice","catalogue":"Épices"},{"id":"mahaleb","oldName":"Mahaleb","name":"Mahaleb","botanical":"Épice","catalogue":"Épices"},{"id":"cubebe","oldName":"Cubèbe","name":"Cubèbe","botanical":"Épice","catalogue":"Épices"},{"id":"maniguette","oldName":"Maniguette","name":"Maniguette","botanical":"Épice","catalogue":"Épices"},{"id":"graines-de-paradis","oldName":"Graines de paradis","name":"Paradis (graine)","botanical":"Épice","catalogue":"Graines"},{"id":"rocou","oldName":"Rocou","name":"Rocou","botanical":"Épice","catalogue":"Épices"},{"id":"amchoor","oldName":"Amchoor","name":"Amchoor","botanical":"Épice","catalogue":"Épices"},{"id":"citron-noir-seche","oldName":"Citron noir séché","name":"Citron noir séché","botanical":"Épice","catalogue":"Épices"},{"id":"piment-de-jamaique","oldName":"Piment de Jamaïque","name":"Piment de Jamaïque","botanical":"Épice","catalogue":"Épices"},{"id":"wasabi-en-poudre","oldName":"Wasabi poudre","name":"Wasabi poudre","botanical":"Épice","catalogue":"Épices"},{"id":"sesame-blanc","oldName":"Sésame blanc","name":"Sésame blanc","botanical":"Graine","catalogue":"Graines"},{"id":"sesame-noir","oldName":"Sésame noir","name":"Sésame noir","botanical":"Graine","catalogue":"Graines"},{"id":"pavot-bleu","oldName":"Pavot bleu","name":"Pavot bleu","botanical":"Graine","catalogue":"Graines"},{"id":"pavot-blanc","oldName":"Pavot blanc","name":"Pavot blanc","botanical":"Graine","catalogue":"Graines"},{"id":"fenugrec","oldName":"Fenugrec","name":"Fenugrec","botanical":"Graine","catalogue":"Graines"},{"id":"lin-brun","oldName":"Lin brun","name":"Lin brun","botanical":"Graine","catalogue":"Graines"},{"id":"lin-dore","oldName":"Lin doré","name":"Lin doré","botanical":"Graine","catalogue":"Graines"},{"id":"chia","oldName":"Chia","name":"Chia","botanical":"Graine","catalogue":"Graines"},{"id":"chanvre-decortique","oldName":"Chanvre graine","name":"Chanvre graine","botanical":"Graine","catalogue":"Graines"},{"id":"tournesol","oldName":"Tournesol","name":"Tournesol","botanical":"Graine","catalogue":"Graines"},{"id":"courge","oldName":"Courge","name":"Courge (graine)","botanical":"Graine","catalogue":"Graines"},{"id":"carthame","oldName":"Carthame","name":"Carthame","botanical":"Graine","catalogue":"Graines"},{"id":"quinoa-souffle","oldName":"Quinoa soufflé","name":"Quinoa soufflé","botanical":"Graine","catalogue":"Graines"},{"id":"amarante-soufflee","oldName":"Amarante soufflée","name":"Amarante soufflée","botanical":"Graine","catalogue":"Graines"},{"id":"coriandre-concassee","oldName":"Coriandre concassée","name":"Coriandre concassée","botanical":"Graine","catalogue":"Graines"},{"id":"moutarde-concassee","oldName":"Moutarde concassée","name":"Moutarde concassée","botanical":"Graine","catalogue":"Graines"},{"id":"cumin-noir","oldName":"Cumin noir","name":"Cumin noir","botanical":"Graine","catalogue":"Graines"},{"id":"graines-de-celeri","oldName":"Céleri graine","name":"Céleri graine","botanical":"Graine","catalogue":"Graines"},{"id":"graines-d-aneth","oldName":"Aneth graine","name":"Aneth graine","botanical":"Graine","catalogue":"Graines"},{"id":"graines-d-oignon","oldName":"Oignon graine","name":"Oignon graine","botanical":"Graine","catalogue":"Graines"},{"id":"rose-comestible","oldName":"Rose comestible","name":"Rose comestible","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"lavande-culinaire","oldName":"Lavande","name":"Lavande","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"fleur-de-sureau","oldName":"Sureau fleur","name":"Sureau fleur","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"hibiscus","oldName":"Hibiscus","name":"Hibiscus","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"bleuet","oldName":"Bleuet","name":"Bleuet","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"calendula","oldName":"Calendula","name":"Calendula","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"violette","oldName":"Violette","name":"Violette","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"jasmin","oldName":"Jasmin","name":"Jasmin","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"fleur-d-oranger","oldName":"Oranger fleur","name":"Fleur d'oranger","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"chrysantheme-comestible","oldName":"Chrysanthème","name":"Chrysanthème","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"trefle-rouge","oldName":"Trèfle rouge","name":"Trèfle rouge","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"primevere","oldName":"Primevère","name":"Primevère","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"fleur-de-courgette","oldName":"Courgette fleur","name":"Courgette fleur","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"fleur-de-fenouil","oldName":"Fenouil fleur","name":"Fenouil fleur","botanical":"Fleur comestible","catalogue":"Fleurs comestibles"},{"id":"fleur-de-basilic","oldName":"Basilic","name":"Basilic","botanical":"Fleur comestible","catalogue":"Herbes aromatiques"},{"id":"ail","oldName":"Ail","name":"Ail","botanical":"Aromate","catalogue":"Légumes"},{"id":"ail-noir","oldName":"Ail noir","name":"Ail noir","botanical":"Aromate","catalogue":"Légumes"},{"id":"echalote","oldName":"Échalote","name":"Échalote","botanical":"Aromate","catalogue":"Légumes"},{"id":"oignon-jaune","oldName":"Oignon jaune","name":"Oignon jaune","botanical":"Aromate","catalogue":"Légumes"},{"id":"oignon-rouge","oldName":"Oignon rouge","name":"Oignon rouge","botanical":"Aromate","catalogue":"Légumes"},{"id":"oignon-nouveau","oldName":"Oignon nouveau","name":"Oignon nouveau","botanical":"Aromate","catalogue":"Légumes"},{"id":"poireau","oldName":"Poireau","name":"Poireau","botanical":"Aromate","catalogue":"Légumes"},{"id":"celeri-branche","oldName":"Céleri branche","name":"Céleri branche","botanical":"Aromate","catalogue":"Légumes"},{"id":"celeri-rave","oldName":"Céleri rave","name":"Céleri rave","botanical":"Aromate","catalogue":"Racines"},{"id":"raifort","oldName":"Raifort","name":"Raifort","botanical":"Aromate","catalogue":"Épices"},{"id":"wasabi-frais","oldName":"Wasabi frais","name":"Wasabi frais","botanical":"Aromate","catalogue":"Épices"},{"id":"citron","oldName":"Citron","name":"Citron","botanical":"Aromate","catalogue":"Agrumes"},{"id":"citron-vert","oldName":"Citron vert","name":"Citron vert","botanical":"Aromate","catalogue":"Agrumes"},{"id":"yuzu","oldName":"Yuzu","name":"Yuzu","botanical":"Aromate","catalogue":"Agrumes"},{"id":"combava","oldName":"Combava (Citrus hystrix)","name":"Combava (Citrus hystrix)","botanical":"Aromate","catalogue":"Agrumes"},{"id":"orange-amere","oldName":"Orange amère","name":"Orange amère","botanical":"Aromate","catalogue":"Agrumes"},{"id":"mandarine","oldName":"Mandarine","name":"Mandarine","botanical":"Aromate","catalogue":"Agrumes"},{"id":"tamarin","oldName":"Tamarin","name":"Tamarin","botanical":"Aromate","catalogue":"Épices"},{"id":"rhubarbe","oldName":"Rhubarbe","name":"Rhubarbe","botanical":"Aromate","catalogue":"Légumes"},{"id":"capres","oldName":"Câpre","name":"Câpre","botanical":"Aromate","catalogue":"Légumineuses"}];
function harmoniseHerbs67(){
 const done='hg-herbs-harmonisation-2981167';if(hgGet(done)==='1')return;
 const byId=new Map(HERB_HARMONISATION_67.map(x=>[x.id,x]));
 if(herbs.length!==180||HERB_HARMONISATION_67.some(x=>!herbs.some(h=>h.id===x.id))){console.warn('Migration Plantes & Épices suspendue : identifiants ou nombre de fiches différents');return;}
 hgSet('hg-herbs-before-harmonisation-2981167',JSON.stringify(herbs));
 for(const h of herbs){const r=byId.get(h.id);if(!r)continue;
  if(h.name===r.oldName)h.name=r.name;
  // Famille d'origine conservée : seul le nouveau champ est renseigné.
  h.catalogCategory=r.catalogue;
 }
 hgSet(herbStore,JSON.stringify(herbs));hgSet(done,'1');
}

let herbs=[], herbKnowledge={accords:[],melanges:[],substitutions:[],techniques:[]}, viewedHerbId=null, previousHerbView='herbs';
function herbUnique(field){return [...new Set(herbs.map(h=>String(h[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));}
function refreshHerbEditorSelects(h={}){fillEditableSelect($('#herbEditFamily'),herbUnique('family'),h.family||'','Choisir…');fillEditableSelect($('#herbEditCatalogCategory'),herbUnique('catalogCategory'),h.catalogCategory||'','Choisir…');fillEditableSelect($('#herbEditSeason'),herbUnique('season'),h.season||'','Choisir…');fillEditableSelect($('#herbEditIntensity'),herbUnique('intensity'),h.intensity||'','Choisir…');fillEditableSelect($('#herbEditForms'),herbUnique('forms'),h.forms||'','Choisir…');}
function fillHerbSelect(id,values,label){const e=$(id),v=e.value;e.innerHTML=`<option value="">${label}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(values.includes(v))e.value=v;}
function herbFacetPool(exclude){const q=norm($('#herbSearch')?.value),family=$('#herbFamily')?.value||'',season=$('#herbSeason')?.value||'',intensity=$('#herbIntensity')?.value||'';return herbs.filter(h=>(exclude==='family'||!family||h.family===family)&&(exclude==='season'||!season||h.season===season)&&(exclude==='intensity'||!intensity||h.intensity===intensity)&&(!q||norm(Object.values(h).join(' ')).includes(q)))}
function herbFacetValues(field){return [...new Set(herbFacetPool(field).map(h=>String(h[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))}
function renderHerbFilters(){fillHerbSelect('#herbFamily',herbFacetValues('family'),'Toutes les familles');fillHerbSelect('#herbSeason',herbFacetValues('season'),'Toutes les saisons');fillHerbSelect('#herbIntensity',herbFacetValues('intensity'),'Toutes les intensités');}
const herbBenefits2984=[["Basilic","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Persil","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Ciboulette","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Coriandre (feuilles)","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Menthe poivrée","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Menthe verte","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Thym","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Romarin","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Origan","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Marjolaine","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Sauge","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Estragon","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Aneth","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Cerfeuil","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Laurier","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Sarriette","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Mélisse","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Verveine citronnée","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Hysope","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Livèche","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Fenouil (feuilles)","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Bourrache","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Capucine","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Oseille","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Ail des ours","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Shiso","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Culantro","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Citronnelle","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Feuille de curry","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Épazote","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Anis vert","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Badiane","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cumin","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Coriandre (graines)","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Fenugrec","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Carvi","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Nigelle","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Moutarde jaune","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Moutarde brune","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Graines de céleri","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Graines d'aneth","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Graines de pavot","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Sésame","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Ajowan","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Cardamome verte","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cardamome noire","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Poivre noir","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre blanc","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre vert","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre long","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Sichuan","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Baies roses","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Piment de la Jamaïque","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Baies de genièvre","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Sumac","Polyphénols, acides organiques","Antioxydants; apporte une acidité qui peut remplacer une partie du sel"],["Paprika doux","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Paprika fumé","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment de Cayenne","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment d'Espelette","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment ancho","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment chipotle","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment guajillo","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment d'Alep","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment oiseau","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Curcuma","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Gingembre","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Galanga","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Zédoaire","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Raifort","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Wasabi","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Safran","Crocin, crocétine, safranal","Riche en composés antioxydants; utilisé en très petites quantités"],["Cannelle de Ceylan","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cannelle cassia","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Clou de girofle","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Noix de muscade","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Macis","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Vanille","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cacao non sucré","Flavanols, magnésium, fer","Antioxydants et apport minéral lorsqu'il est peu sucré"],["Réglisse","Glycyrrhizine et flavonoïdes","Usage traditionnel digestif; prudence en consommation importante ou régulière"],["Asafoetida","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Amchoor","Acides organiques, polyphénols, fibres variables","Saveur acidulée; contribue à aromatiser les plats avec moins de sel"],["Tamarin","Acides organiques, polyphénols, fibres variables","Saveur acidulée; contribue à aromatiser les plats avec moins de sel"],["Kokum","Acides organiques, polyphénols, fibres variables","Saveur acidulée; contribue à aromatiser les plats avec moins de sel"],["Achiote / roucou","Caroténoïdes, notamment bixine","Colorant naturel et apport antioxydant"],["Mahleb","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Mastic de Chios","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cubèbe","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Maniguette","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Timut","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Kampot","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Tasmanie","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Selim","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Voatsiperifery","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Penja","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Sansho","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Lavande culinaire","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Rose (pétales)","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Fleur d'oranger","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Hibiscus","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Camomille","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Tilleul","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Myrte","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Feuille de figuier","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Feuille de combava","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Zeste de citron","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Zeste d'orange","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Zeste de combava","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Pandan","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Menthe chocolat","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Basilic thaï","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Basilic sacré (tulsi)","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Basilic citron","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Origan mexicain","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Thym citron","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Sauge ananas","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Estragon mexicain","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Ciboule","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Ail","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Échalote séchée","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Oignon séché","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Angélique","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Anis hysope","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Mélilot","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Cerfeuil musqué","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Persil plat","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Persil frisé","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Menthe marocaine","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Menthe pomme","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Sarriette d'hiver","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Sarriette d'été","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"]];
function herbBenefitMatchKey2984(value){return norm(String(value||'').replace(/\([^)]*\)/g,' ').replace(/[’']/g,' ').replace(/[-–—]/g,' ')).replace(/\s+/g,' ').trim();}
function applyHerbBenefits2984(items){
  const migrationKey='hg-migration-herb-benefits-2984';
  if(hgGet(migrationKey)==='1')return false;
  const byName=new Map();
  herbBenefits2984.forEach(([name,apports,bienfaits])=>{
    const full=norm(name), simple=herbBenefitMatchKey2984(name);
    byName.set(full,{apports,bienfaits}); if(simple&&!byName.has(simple))byName.set(simple,{apports,bienfaits});
  });
  let changed=0;
  items.forEach(h=>{const info=byName.get(norm(h.name))||byName.get(herbBenefitMatchKey2984(h.name));if(!info)return;h.benefits=`Apports : ${info.apports}\nBienfaits : ${info.bienfaits}`;changed++;});
  hgSet(migrationKey,'1');
  if(changed)hgSet(herbStore,JSON.stringify(items));
  console.info(`v2.9.8.4 — Bienfaits Plantes & Épices : ${changed} fiche(s) mise(s) à jour.`);
  return changed>0;
}
function mergeHerbText(a,b){const x=String(a||'').trim(),y=String(b||'').trim();if(!x)return y;if(!y||x===y)return x;return x+'\n'+y;}
function migrateHerbFields(h){
 const p=mergeHerbText(h.idealFoods,h.recommendedPairings),c=mergeHerbText(h.cookingBehavior,h.preparation);
 if(!Object.prototype.hasOwnProperty.call(h,'pairings'))h.pairings=p;
 else h.pairings=mergeHerbText(h.pairings,p);
 h.preparation=c;
 delete h.idealFoods;delete h.recommendedPairings;delete h.cookingBehavior;
 return h;
}
function normalizeHerb(h={}){return {...h,id:String(h.id||slug(h.name||'plante')),name:String(h.name||'Plante sans nom')};}
async function initHerbs(){
 try{
  const res=await fetch(`herbs-spices.json?_=${Date.now()}`,{cache:'no-store'}),payload=res.ok?await res.json():{herbs:[]};
  herbKnowledge={accords:payload.accords||[],melanges:payload.melanges||[],substitutions:payload.substitutions||[],techniques:payload.techniques||[]};
  const stored=JSON.parse(hgGet(herbStore)||'null');
  herbs=(stored&&stored.length?stored:payload.herbs||[]).map(normalizeHerb).map(migrateHerbFields);
  // v2.9.8.11.48 : harmonisation des noms validés, sans toucher aux autres champs.
  {const m={"achillee-millefeuille":"Achillée millefeuille","agastache":"Agastache","ail":"Ail","ail-des-ours":"Ail des ours","ail-noir":"Ail noir","ajowan":"Ajowan (Cumin royal)","amarante-soufflee":"Amarante soufflée","amchoor":"Amchoor","aneth":"Aneth","angelique":"Angélique","anis-etoile":"Anis étoilé","anis-vert":"Anis vert","armoise":"Armoise","asafoetida":"Asafoetida","asperule-odorante":"Aspérule odorante","baies-roses":"Baie rose","basilic-citron":"Basilic citron","basilic-genois":"Basilic génois","basilic-pourpre":"Basilic pourpre","basilic-thai":"Basilic thaï","bleuet":"Bleuet","bourrache":"Bourrache","calendula":"Calendula","camomille":"Camomille","cannelle-cassia":"Cannelle Cassia (Cannelle de Chine)","cannelle-de-ceylan":"Cannelle de Ceylan","capres":"Câpre","capucine":"Capucine","cardamome-noire":"Cardamome noire","cardamome-verte":"Cardamome verte","carthame":"Carthame","carvi":"Carvi","celeri-branche":"Céleri branche","celeri-rave":"Céleri rave","cerfeuil":"Cerfeuil","chanvre-decortique":"Chanvre graine","chia":"Chia","chrysantheme-comestible":"Chrysanthème","ciboule":"Ciboule","ciboulette":"Ciboulette","citron":"Citron","citron-noir-seche":"Citron noir séché","citron-vert":"Citron vert","citronnelle":"Citronnelle","clou-de-girofle":"Clou de girofle","combava":"Combava (Citrus hystrix)","coriandre-concassee":"Coriandre concassée","coriandre-fraiche":"Coriandre fraîche","coriandre-graine":"Coriandre graine","courge":"Courge","cresson-alenois":"Cresson alénois","cresson-de-fontaine":"Cresson de fontaine","cubebe":"Cubèbe","culantro":"Culantro","cumin":"Cumin","cumin-noir":"Cumin noir","curcuma":"Curcuma","echalote":"Échalote","epazote":"Épazote","estragon-francais":"Estragon","fenouil-feuille":"Fenouil feuille","fenouil-graine":"Fenouil graine","fenugrec":"Fenugrec","feuille-de-celeri":"Céleri feuille","feuille-de-combava":"Combava feuille","feuille-de-curry":"Kaloupilé (Feuille de curry)","feuille-de-fenugrec":"Fenugrec feuille","feuille-de-moutarde":"Moutarde feuille","feuille-de-pandan":"Pandan feuille","feve-tonka":"Tonka fève","fleur-de-basilic":"Basilic","fleur-de-courgette":"Courgette fleur","fleur-de-fenouil":"Fenouil fleur","fleur-de-sureau":"Sureau fleur","fleur-d-oranger":"Oranger fleur","galanga":"Galanga","genievre":"Genièvre","gingembre":"Gingembre","graines-d-aneth":"Aneth graine","graines-de-celeri":"Céleri graine","graines-de-paradis":"Graines de paradis","graines-d-oignon":"Oignon graine","hibiscus":"Hibiscus","hysope":"Hysope","jasmin":"Jasmin","laurier-sauce":"Laurier sauce","lavande-culinaire":"Lavande","lin-brun":"Lin brun","lin-dore":"Lin doré","liveche":"Livèche","macis":"Macis","mahaleb":"Mahaleb","mandarine":"Mandarine","maniguette":"Maniguette","marjolaine":"Marjolaine","mauve":"Mauve","melilot":"Mélilot","melisse":"Mélisse","menthe-marocaine":"Menthe marocaine","menthe-poivree":"Menthe poivrée","menthe-verte":"Menthe verte","mertensia-maritime":"Mertensia maritime","mitsuba":"Mitsuba","monarde":"Monarde","moutarde-concassee":"Moutarde concassée","moutarde-jaune":"Moutarde jaune","moutarde-noire":"Moutarde noire","myrte":"Myrte","nigelle":"Nigelle","noix-de-muscade":"Noix de muscade","oignon-jaune":"Oignon jaune","oignon-nouveau":"Oignon nouveau","oignon-rouge":"Oignon rouge","orange-amere":"Orange amère","origan-grec":"Origan grec","origan-mexicain":"Origan mexicain","ortie":"Ortie","oseille":"Oseille","paprika-doux":"Paprika doux","paprika-fort":"Paprika fort","paprika-fume":"Paprika fumé","pavot-blanc":"Pavot blanc","pavot-bleu":"Pavot bleu","persil-frise":"Persil frisé","persil-plat":"Persil plat","piment-ancho":"Piment ancho","piment-chipotle":"Piment chipotle","piment-de-cayenne":"Piment de Cayenne","piment-de-jamaique":"Piment de Jamaïque","piment-d-espelette":"Piment d'Espelette","piment-guajillo":"Piment guajillo","piment-habanero":"Piment habanero","piment-oiseau":"Piment oiseau","pimprenelle":"Pimprenelle","pissenlit":"Pissenlit","plantain-lanceole":"Plantain lancéolé","poireau":"Poireau","poivre-blanc":"Poivre blanc","poivre-de-kampot":"Poivre de Kampot","poivre-de-sichuan":"Poivre de Sichuan","poivre-long":"Poivre long","poivre-noir":"Poivre noir","poivre-sansho":"Poivre Sansho","poivre-vert":"Poivre vert","pourpier":"Pourpier","primevere":"Primevère","quinoa-souffle":"Quinoa soufflé","raifort":"Raifort","rau-ram":"Rau ram","reglisse":"Réglisse","reine-des-pres":"Reine-des-prés","rhubarbe":"Rhubarbe","rocou":"Rocou","romarin":"Romarin","roquette":"Roquette","rose-comestible":"Rose comestible","safran":"Safran","sarriette-d-ete":"Sarriette d'été","sarriette-d-hiver":"Sarriette d'hiver","sauge-ananas":"Sauge ananas","sauge-officinale":"Sauge officinale","serpolet":"Serpolet","sesame-blanc":"Sésame blanc","sesame-noir":"Sésame noir","shiso-rouge":"Shiso rouge","shiso-vert":"Shiso vert","stevia-feuille":"Stévia feuille","sumac":"Sumac","tagete-citron":"Tagète citron","tamarin":"Tamarin","thym-citron":"Thym citron","thym-commun":"Thym","tournesol":"Tournesol","trefle-rouge":"Trèfle rouge","vanille":"Vanille","verveine-citronnee":"Verveine citronnée","violette":"Violette","wasabi-en-poudre":"Wasabi poudre","wasabi-frais":"Wasabi frais","yuzu":"Yuzu"};let changed=false;for(const item of herbs){const next=m[String(item.id)];if(next&&item.name!==next){item.name=next;changed=true}}if(changed)hgSet(herbStore,JSON.stringify(herbs));}
  harmoniseHerbs67();
  hgSet(herbStore,JSON.stringify(herbs));
  applyHerbBenefits2984(herbs);
  renderHerbFilters();renderHerbs();
 }catch(e){console.error('Grand Herbier',e);herbs=[];renderHerbs();}
}
function herbFiltered(){const q=norm($('#herbSearch')?.value),family=$('#herbFamily')?.value||'',season=$('#herbSeason')?.value||'',intensity=$('#herbIntensity')?.value||'';return herbs.filter(h=>(!family||h.family===family)&&(!season||h.season===season)&&(!intensity||h.intensity===intensity)&&(!q||norm(Object.values(h).join(' ')).includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));}
function herbCard(h){return `<article class="herb-card"><button data-view-herb="${esc(h.id)}"><div class="herb-card-title"><h3>${esc(h.name)}</h3><span class="meta">${esc([h.family,h.intensity].filter(Boolean).join(' · '))}</span></div><p>${esc(h.flavor||h.uses||'')}</p><div class="badges">${[h.season,h.origin,h.dishTypes].filter(Boolean).slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('')}</div></button></article>`;}
function renderHerbs(){const found=herbFiltered(),count=$('#herbCount'),list=$('#herbList');if(!count||!list)return;count.textContent=`${found.length} plante${found.length>1?'s':''} et épice${found.length>1?'s':''}`;list.innerHTML=found.map(herbCard).join('')||'<p>Aucune plante ou épice trouvée.</p>';$$('[data-view-herb]').forEach(b=>b.onclick=()=>showHerb(b.dataset.viewHerb,'herbs'));}
['#herbSearch','#herbFamily','#herbSeason','#herbIntensity'].forEach(id=>{const e=$(id);if(e)e.addEventListener(e.tagName==='INPUT'?'input':'change',()=>{renderHerbFilters();renderHerbs()})});
if($('#clearHerbFilters'))$('#clearHerbFilters').onclick=()=>{$('#herbSearch').value='';$('#herbFamily').value='';$('#herbSeason').value='';$('#herbIntensity').value='';renderHerbFilters();renderHerbs();};
if($('#randomHerb'))$('#randomHerb').onclick=()=>{if(herbs.length)showHerb(herbs[Math.floor(Math.random()*herbs.length)].id)};
function terms(s){return String(s||'').split(/[,;+]|\bou\b/gi).map(x=>norm(x)).filter(x=>x.length>2)}
function linkedRecipes(h){const ts=[h.name,...terms(h.name),...terms(h.pairings),...terms(h.uses)].filter(Boolean);return recipes.filter(r=>r.ingredients.some(i=>ts.some(t=>norm(i[0]).includes(t)||t.includes(norm(i[0]))))).slice(0,30);}
function matchingMixes(h){const n=norm(h.name).split(' ')[0];return herbKnowledge.melanges.filter(m=>norm(m['Proportions en volumes']).includes(n));}
function matchingSubstitutions(h){const n=norm(h.name).split(' ')[0];return herbKnowledge.substitutions.filter(s=>norm(s['Ingrédient manquant']).includes(n)||norm(s['Remplacement']).includes(n));}
function matchingAccords(h){const n=norm(h.name).split(' ')[0];return herbKnowledge.accords.filter(a=>norm(a['Herbes / épices conseillées']).includes(n));}
function fieldBlock(title,value,always=false){return value?`<section><h3>${title}</h3><p>${esc(value).replace(/\n/g,'<br>')}</p></section>`:(always?`<section><h3>${title}</h3><p class="muted">—</p></section>`:'');}
function showHerb(id,from=''){const h=herbs.find(x=>x.id===id);if(!h)return;if(from){rememberScroll(from);previousHerbView=from}else if(!previousHerbView)previousHerbView='herbs';viewedHerbId=id;const rec=linkedRecipes(h),mix=matchingMixes(h),sub=matchingSubstitutions(h),acc=matchingAccords(h);$('#herbViewContent').innerHTML=`<div class="herb-detail-head"><div class="meta">${esc([h.family,h.catalogCategory,h.origin,h.season].filter(Boolean).join(' · '))}</div><h2>${esc(h.name)}</h2><p class="herb-flavor">${esc(h.flavor||'')}</p><div class="badges">${[h.intensity,h.forms,h.worldCuisines].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div><div class="herb-detail-grid">${fieldBlock('Catégorie botanique',h.family)}${fieldBlock('Catégorie Catalogue',h.catalogCategory)}${fieldBlock('Utilisations culinaires',h.uses)}${fieldBlock('Bienfaits',h.benefits,true)}${fieldBlock('À associer avec',h.pairings)}${fieldBlock('Modes de préparation',h.preparation)}${fieldBlock('Quantité indicative',h.quantity)}${fieldBlock('Substitution possible',h.substitution)}${fieldBlock('Erreur à éviter',h.avoid)}${fieldBlock('Conservation',h.conservation)}${fieldBlock('Où l’acheter en Suisse',h.whereToBuy)}${fieldBlock('Idées de recettes',h.recipeIdeas)}${fieldBlock('Astuce du chef',h.chefTip)}</div><section class="knowledge-links"><h3>Recettes de ton Herbier</h3><div class="link-list">${rec.length?rec.map(r=>`<button data-herb-recipe="${esc(r.id)}">${esc(r.title)}</button>`).join(''):'<p class="muted">Aucune correspondance automatique trouvée pour l’instant.</p>'}</div></section><section class="knowledge-links"><h3>Accords par aliment</h3>${acc.length?acc.map(a=>`<article><strong>${esc(a['Aliment principal'])}</strong><p>${esc(a['Techniques idéales'])} · ${esc(a['Association signature'])}</p></article>`).join(''):'<p class="muted">Aucun accord spécifique.</p>'}</section><section class="knowledge-links"><h3>Mélanges maison</h3>${mix.length?mix.map(m=>`<article><strong>${esc(m['Nom du mélange'])}</strong><p>${esc(m['Proportions en volumes'])}</p><small>${esc(m['Utilisations'])}</small></article>`).join(''):'<p class="muted">Aucun mélange référencé.</p>'}</section><section class="knowledge-links"><h3>Substitutions</h3>${sub.length?sub.map(s=>`<article><strong>${esc(s['Ingrédient manquant'])} → ${esc(s['Remplacement'])}</strong><p>${esc(s['Résultat attendu'])}</p></article>`).join(''):'<p class="muted">Voir aussi la substitution indiquée dans la fiche.</p>'}</section><section class="knowledge-links"><h3>Techniques utiles</h3>${herbKnowledge.techniques.map(t=>`<article><strong>${esc(t['Technique'])}</strong><p>${esc(t['Méthode'])}</p><small>${esc(t['Point de vigilance'])}</small></article>`).join('')}</section>`;$$('[data-herb-recipe]').forEach(b=>b.onclick=()=>showRecipe(b.dataset.herbRecipe,'herbView'));switchView('herbView',{top:true});}
function openHerbEditor(id=viewedHerbId){
 if(READONLY)return;
 const existing=herbs.find(x=>x.id===id),h=existing||{id:'',name:''},isNew=!existing;
 $('#herbDialogTitle').textContent=isNew?'Ajouter une plante ou une épice':'Modifier Plante & Épice';
 $('#herbEditId').value=isNew?'':h.id;refreshHerbEditorSelects(h);
 const map={Name:'name',Family:'family',CatalogCategory:'catalogCategory',Origin:'origin',Season:'season',Intensity:'intensity',Forms:'forms',Flavor:'flavor',Uses:'uses',Benefits:'benefits',Pairings:'pairings',Preparation:'preparation',Quantity:'quantity',Substitution:'substitution',Avoid:'avoid',Conservation:'conservation',Where:'whereToBuy',RecipeIdeas:'recipeIdeas',ChefTip:'chefTip'};
 Object.entries(map).forEach(([suffix,key])=>{$(`#herbEdit${suffix}`).value=h[key]||''});if(isNew)$('#herbEditName').value='';$('#deleteHerb')?.classList.toggle('hidden',isNew);$('#herbDialog').showModal()
}
if($('#newHerb'))$('#newHerb').onclick=()=>openHerbEditor('');
if($('#editViewedHerb'))$('#editViewedHerb').onclick=()=>openHerbEditor();
if($('#closeHerbDialog'))$('#closeHerbDialog').onclick=()=>$('#herbDialog').close();
if($('#deleteHerb'))$('#deleteHerb').onclick=async()=>{const id=$('#herbEditId').value,h=herbs.find(x=>x.id===id);if(!h)return;if(!confirm(`Supprimer définitivement « ${h.name} » ?`))return;const photoId=h.photoId||'';herbs=herbs.filter(x=>x.id!==id);hgSet(herbStore,JSON.stringify(herbs));if(photoId&&window.hgMediaDeletePhoto)try{await window.hgMediaDeletePhoto(photoId)}catch(err){console.warn('Suppression photo',err)}registerProtectedChange();markDirty();viewedHerbId=null;renderHerbFilters();renderHerbs();$('#herbDialog').close();switchView('herbs')};
if($('#herbForm'))$('#herbForm').onsubmit=e=>{e.preventDefault();const oldId=$('#herbEditId').value;let h=oldId?herbs.find(x=>x.id===oldId):null;const map={Name:'name',Family:'family',CatalogCategory:'catalogCategory',Origin:'origin',Season:'season',Intensity:'intensity',Forms:'forms',Flavor:'flavor',Uses:'uses',Benefits:'benefits',Pairings:'pairings',Preparation:'preparation',Quantity:'quantity',Substitution:'substitution',Avoid:'avoid',Conservation:'conservation',Where:'whereToBuy',RecipeIdeas:'recipeIdeas',ChefTip:'chefTip'};if(!h){const name=$('#herbEditName').value.trim();let id=slug(name||`plante-${Date.now()}`);if(herbs.some(x=>x.id===id))id=`${id}-${Date.now()}`;h=normalizeHerb({id,name});herbs.push(h)}Object.entries(map).forEach(([suffix,key])=>h[key]=$(`#herbEdit${suffix}`).value.trim());migrateHerbFields(h);hgSet(herbStore,JSON.stringify(herbs));registerProtectedChange();markDirty();renderHerbFilters();renderHerbs();$('#herbDialog').close();showHerb(h.id)};
if($('#backFromHerb'))$('#backFromHerb').onclick=()=>switchView(previousHerbView);


// v2.9.1 — Producteurs consolidés
const produceStore='hg-fruits-vegetables-v282';
let produceItems=[], viewedProduceId=null, previousProduceView='produce';
const produceBenefits2983=[["Pomme","Fibres, vitamine C, polyphénols","Transit, satiété et santé cardiovasculaire"],["Poire","Fibres, cuivre, vitamine C","Transit intestinal et satiété"],["Banane","Potassium, vitamine B6, fibres","Fonction musculaire, énergie et transit"],["Orange","Vitamine C, folates, fibres","Immunité et absorption du fer"],["Mandarine","Vitamine C, flavonoïdes","Immunité et antioxydants"],["Clémentine","Vitamine C, folates","Immunité et formation cellulaire"],["Citron","Vitamine C, flavonoïdes","Antioxydants et absorption du fer"],["Pamplemousse","Vitamine C, vitamine A","Immunité et peau"],["Kiwi","Vitamines C et K, fibres","Immunité et digestion"],["Fraise","Vitamine C, manganèse, polyphénols","Antioxydants et santé cardiovasculaire"],["Framboise","Fibres, vitamine C, manganèse","Transit et satiété"],["Mûre","Fibres, vitamines C et K","Transit et antioxydants"],["Myrtille","Anthocyanes, vitamine C, fibres","Santé cardiovasculaire et antioxydants"],["Cassis","Vitamine C, anthocyanes","Immunité et protection cellulaire"],["Groseille","Vitamine C, fibres","Transit et antioxydants"],["Raisin","Polyphénols, vitamine K","Santé cardiovasculaire et antioxydants"],["Cerise","Polyphénols, vitamine C","Protection antioxydante"],["Pêche","Vitamine C, caroténoïdes, eau","Hydratation, peau et vision"],["Nectarine","Vitamine C, caroténoïdes","Peau, vision et antioxydants"],["Abricot","Bêta-carotène, potassium, fibres","Vision, peau et transit"],["Prune","Fibres, vitamine K, polyphénols","Transit et antioxydants"],["Mirabelle","Fibres, caroténoïdes","Transit et protection cellulaire"],["Quetsche","Fibres, polyphénols","Transit et antioxydants"],["Figue","Fibres, potassium, calcium","Transit et apport minéral"],["Datte","Fibres, potassium, glucides","Énergie et transit"],["Grenade","Polyphénols, vitamine C","Protection antioxydante"],["Kaki","Bêta-carotène, fibres, vitamine C","Vision, transit et immunité"],["Coing","Fibres, vitamine C","Transit et satiété"],["Pastèque","Eau, lycopène, vitamine C","Hydratation et antioxydants"],["Melon","Eau, bêta-carotène, vitamine C","Hydratation, peau et vision"],["Ananas","Vitamine C, manganèse","Immunité et métabolisme"],["Mangue","Vitamines A et C, folates","Vision, peau et immunité"],["Papaye","Vitamines C et A, folates","Immunité, peau et digestion"],["Fruit de la passion","Fibres, vitamines A et C","Transit et antioxydants"],["Goyave","Vitamine C, fibres, folates","Immunité et transit"],["Litchi","Vitamine C, cuivre","Immunité et métabolisme"],["Noix de coco","Fibres, manganèse, lipides","Satiété et énergie"],["Avocat","Graisses insaturées, fibres, folates","Santé cardiovasculaire et satiété"],["Carambole","Vitamine C, fibres","Antioxydants et transit"],["Pitaya","Fibres, vitamine C, magnésium","Transit et antioxydants"],["Physalis","Vitamine C, caroténoïdes","Immunité et protection cellulaire"],["Nèfle","Caroténoïdes, fibres, potassium","Vision et transit"],["Nashi","Eau, fibres, vitamine C","Hydratation et transit"],["Canneberge","Polyphénols, vitamine C","Protection antioxydante"],["Sureau (baies cuites)","Anthocyanes, vitamine C","Antioxydants; à consommer cuit"],["Mûre blanche","Fibres, vitamine C, fer","Transit et micronutriments"],["Feijoa","Vitamine C, fibres","Immunité et transit"],["Chérimole","Vitamines B6 et C, fibres","Métabolisme et transit"],["Corossol","Vitamine C, fibres, potassium","Immunité et transit"],["Tamarin","Fibres, magnésium, potassium","Transit et minéraux"],["Kumquat","Vitamine C, fibres","Immunité et transit"],["Pomelo","Vitamine C, potassium","Immunité et équilibre hydrique"],["Bergamote","Vitamine C, flavonoïdes","Apport antioxydant"],["Yuzu","Vitamine C, composés aromatiques","Immunité et antioxydants"],["Longane","Vitamine C, cuivre","Immunité et métabolisme"],["Ramboutan","Vitamine C, cuivre","Immunité et métabolisme"],["Mangoustan","Fibres, vitamine C","Transit et antioxydants"],["Jacquier","Fibres, vitamine C, potassium","Transit et énergie"],["Durian","Fibres, vitamines B, potassium","Énergie et fonction nerveuse"],["Figue de Barbarie","Fibres, vitamine C, magnésium","Transit et antioxydants"],["Açaï","Polyphénols, fibres, lipides","Antioxydants et satiété"],["Aronia","Anthocyanes, polyphénols","Forte contribution antioxydante"],["Argousier","Vitamine C, caroténoïdes","Immunité et protection cellulaire"],["Jujube","Vitamine C, fibres","Immunité et transit"],["Sapote","Fibres, vitamine C, caroténoïdes","Transit, peau et antioxydants"],["Carotte","Bêta-carotène, fibres, potassium","Vision, peau et transit"],["Brocoli","Vitamines C et K, folates, fibres","Immunité, os et transit"],["Chou-fleur","Vitamine C, folates, fibres","Immunité et digestion"],["Chou vert","Vitamines C et K, fibres","Santé osseuse et transit"],["Chou rouge","Anthocyanes, vitamines C et K","Antioxydants et os"],["Chou frisé (kale)","Vitamines K, A et C","Os, vision et immunité"],["Chou de Bruxelles","Vitamines C et K, fibres","Transit et santé osseuse"],["Chou-rave","Vitamine C, fibres, potassium","Immunité et transit"],["Chou chinois","Vitamines A, C, K, folates","Vision, immunité et os"],["Pak-choï","Vitamines A, C, K, calcium","Os, vision et immunité"],["Épinard","Folates, vitamines K et A, fer","Formation cellulaire, os et vision"],["Blette","Vitamines K et A, magnésium","Os et fonction musculaire"],["Laitue","Folates, vitamine K, eau","Hydratation et formation cellulaire"],["Roquette","Vitamine K, folates, calcium","Santé osseuse"],["Mâche","Folates, vitamine C, caroténoïdes","Immunité et vision"],["Endive","Fibres, folates, vitamine K","Transit et os"],["Chicorée","Fibres, folates, vitamine K","Transit et microbiote"],["Cresson","Vitamines K, C et A","Os, immunité et vision"],["Tomate","Lycopène, vitamine C, potassium","Antioxydants et santé cardiovasculaire"],["Poivron rouge","Vitamine C, caroténoïdes","Immunité, peau et vision"],["Poivron vert","Vitamine C, folates, fibres","Immunité et transit"],["Aubergine","Fibres, polyphénols","Transit et antioxydants"],["Courgette","Eau, vitamine C, potassium","Hydratation et fibres"],["Concombre","Eau, vitamine K","Hydratation"],["Courge butternut","Bêta-carotène, fibres, potassium","Vision, peau et transit"],["Potiron","Bêta-carotène, potassium, fibres","Vision et satiété"],["Potimarron","Bêta-carotène, fibres, potassium","Vision et transit"],["Citrouille","Bêta-carotène, vitamine C, fibres","Vision et immunité"],["Pâtisson","Vitamine C, fibres, potassium","Transit et équilibre hydrique"],["Fenouil","Fibres, vitamine C, potassium","Transit et satiété"],["Céleri-branche","Eau, vitamine K, potassium","Hydratation et équilibre hydrique"],["Céleri-rave","Fibres, vitamine K, phosphore","Transit et os"],["Poireau","Fibres, folates, vitamine K","Transit et formation cellulaire"],["Oignon","Flavonoïdes, composés soufrés","Apport antioxydant"],["Ail","Composés soufrés, manganèse","Santé cardiovasculaire"],["Échalote","Flavonoïdes, composés soufrés","Protection antioxydante"],["Artichaut","Fibres, folates, magnésium","Transit et satiété"],["Asperge","Folates, vitamine K, fibres","Formation cellulaire et transit"],["Haricot vert","Fibres, folates, vitamine K","Transit et os"],["Petit pois","Fibres, protéines végétales, folates","Satiété et transit"],["Pois mange-tout","Fibres, vitamine C, folates","Transit et immunité"],["Fève","Protéines végétales, fibres, folates","Satiété et formation cellulaire"],["Maïs doux","Fibres, vitamines B, caroténoïdes","Énergie et transit"],["Betterave","Folates, nitrates naturels, manganèse","Formation cellulaire et circulation"],["Navet","Vitamine C, fibres, potassium","Immunité et transit"],["Panais","Fibres, folates, potassium","Transit et satiété"],["Radis","Vitamine C, eau, composés soufrés","Hydratation et antioxydants"],["Radis noir","Fibres, vitamine C, composés soufrés","Transit et antioxydants"],["Rutabaga","Vitamine C, fibres, potassium","Immunité et transit"],["Topinambour","Inuline, fibres, potassium","Microbiote et transit"],["Salsifis","Fibres, potassium, folates","Transit et satiété"],["Scorsonère","Fibres, potassium, fer","Transit et minéraux"],["Patate douce","Bêta-carotène, fibres, potassium","Vision, satiété et transit"],["Pomme de terre","Potassium, vitamine C, amidon","Énergie et fonction musculaire"],["Manioc","Amidon, vitamine C, manganèse","Énergie; bien cuire"],["Igname","Fibres, potassium, vitamine C","Énergie et transit"],["Taro","Amidon, fibres, potassium","Énergie et satiété"],["Gombo","Fibres, folates, vitamine C","Transit et formation cellulaire"],["Pousses de bambou","Fibres, cuivre, potassium","Transit et minéraux"],["Cœur de palmier","Fibres, cuivre, manganèse","Satiété et minéraux"],["Champignon de Paris","Vitamines B, sélénium, cuivre","Métabolisme et antioxydants"],["Pleurote","Vitamines B, cuivre, fibres","Métabolisme et transit"],["Shiitaké","Vitamines B, cuivre, fibres","Métabolisme énergétique"],["Cèpe","Fibres, cuivre, vitamines B","Transit et métabolisme"],["Girolle","Fibres, cuivre, caroténoïdes","Transit et micronutriments"]];
function applyProduceBenefits2983(items){
  const migrationKey='hg-migration-produce-benefits-2983';
  if(hgGet(migrationKey)==='1')return false;
  const byName=new Map(produceBenefits2983.map(([name,apports,bienfaits])=>[norm(name),{apports,bienfaits}]));
  let changed=0;
  items.forEach(p=>{const info=byName.get(norm(p.name));if(!info)return;p.benefits=`Apports : ${info.apports}\nBienfaits : ${info.bienfaits}`;changed++;});
  hgSet(migrationKey,'1');
  if(changed)hgSet(produceStore,JSON.stringify(items));
  console.info(`v2.9.8.3 — Bienfaits enrichis : ${changed} fiche(s) mise(s) à jour.`);
  return changed>0;
}

// v2.9.8.11.66 — harmonisation validée Fruits & Légumes ; Catalogue non modifié.
const PRODUCE_HARMONISATION_66=[{"id":"carotte","oldName":"Carotte","name":"Carotte","botanical":"Légume-racine","catalogue":"Racines"},{"id":"panais","oldName":"Panais","name":"Panais","botanical":"Légume-racine","catalogue":"Racines"},{"id":"navet","oldName":"Navet","name":"Navet","botanical":"Légume-racine","catalogue":"Racines"},{"id":"betterave-rouge","oldName":"Betterave rouge","name":"Betterave rouge","botanical":"Légume-racine","catalogue":"Racines"},{"id":"betterave-jaune","oldName":"Betterave jaune","name":"Betterave jaune","botanical":"Légume-racine","catalogue":"Racines"},{"id":"radis-rouge","oldName":"Radis rouge","name":"Radis","botanical":"Légume-racine","catalogue":"Racines"},{"id":"radis-noir","oldName":"Radis noir","name":"Radis noir","botanical":"Légume-racine","catalogue":"Racines"},{"id":"rutabaga","oldName":"Rutabaga","name":"Rutabaga","botanical":"Légume-racine","catalogue":"Racines"},{"id":"celeri-rave","oldName":"Céleri rave","name":"Céleri rave","botanical":"Légume-racine","catalogue":"Racines"},{"id":"persil-tubereux","oldName":"Persil tubéreux","name":"Persil tubéreux","botanical":"Légume-racine","catalogue":"Racines"},{"id":"oignon-jaune","oldName":"Oignon jaune","name":"Oignon jaune","botanical":"Bulbe","catalogue":"Légumes"},{"id":"oignon-rouge","oldName":"Oignon rouge","name":"Oignon rouge","botanical":"Bulbe","catalogue":"Légumes"},{"id":"oignon-blanc","oldName":"Oignon blanc","name":"Oignon blanc","botanical":"Bulbe","catalogue":"Légumes"},{"id":"echalote","oldName":"Échalote","name":"Échalote","botanical":"Bulbe","catalogue":"Légumes"},{"id":"ail","oldName":"Ail","name":"Ail","botanical":"Bulbe","catalogue":"Légumes"},{"id":"poireau","oldName":"Poireau","name":"Poireau","botanical":"Bulbe","catalogue":"Légumes"},{"id":"pomme-de-terre","oldName":"Pomme de terre","name":"Pomme de terre","botanical":"Tubercule","catalogue":"Légumes"},{"id":"patate-douce","oldName":"Patate douce","name":"Patate douce","botanical":"Tubercule","catalogue":"Légumes"},{"id":"topinambour","oldName":"Topinambour","name":"Topinambour","botanical":"Tubercule","catalogue":"Racines"},{"id":"crosne","oldName":"Crosne","name":"Crosne","botanical":"Tubercule","catalogue":"Légumes"},{"id":"salsifis","oldName":"Salsifis","name":"Salsifis","botanical":"Légume","catalogue":"Légumes"},{"id":"scorsonere","oldName":"Scorsonère","name":"Scorsonère (Salsifis)","botanical":"Légume","catalogue":"Légumes"},{"id":"fenouil","oldName":"Fenouil","name":"Fenouil","botanical":"Légume","catalogue":"Légumes"},{"id":"celeri-branche","oldName":"Céleri branche","name":"Céleri branche","botanical":"Légume","catalogue":"Légumes"},{"id":"epinard","oldName":"Épinard","name":"Épinard","botanical":"Légume-feuille","catalogue":"Légumes"},{"id":"bette","oldName":"Côte de bette","name":"Côte de bette","botanical":"Légume-feuille","catalogue":"Légumes"},{"id":"laitue-romaine","oldName":"Laitue romaine","name":"Laitue romaine","botanical":"Salade","catalogue":"Salades"},{"id":"laitue-pommee","oldName":"Laitue pommée","name":"Laitue pommée","botanical":"Salade","catalogue":"Salades"},{"id":"mache","oldName":"Mâche","name":"Mâche","botanical":"Salade","catalogue":"Salades"},{"id":"roquette","oldName":"Roquette","name":"Roquette (Rucola)","botanical":"Salade","catalogue":"Salades"},{"id":"brocoli","oldName":"Brocoli","name":"Brocoli","botanical":"Chou","catalogue":"Choux"},{"id":"chou-fleur","oldName":"Chou-fleur","name":"Chou-fleur","botanical":"Chou","catalogue":"Choux"},{"id":"chou-blanc","oldName":"Chou blanc","name":"Chou blanc","botanical":"Chou","catalogue":"Choux"},{"id":"chou-rouge","oldName":"Chou rouge","name":"Chou rouge","botanical":"Chou","catalogue":"Choux"},{"id":"chou-de-bruxelles","oldName":"Choux de Bruxelles","name":"Chou de Bruxelles","botanical":"Chou","catalogue":"Choux"},{"id":"chou-rave","oldName":"Chou-rave","name":"Chou-rave","botanical":"Chou","catalogue":"Choux"},{"id":"chou-kale","oldName":"Chou kale","name":"Chou kale","botanical":"Chou","catalogue":"Choux"},{"id":"chou-chinois","oldName":"Chou chinois","name":"Chou chinois","botanical":"Chou","catalogue":"Choux"},{"id":"pak-choi","oldName":"Pak-choï","name":"Pak-choï","botanical":"Chou","catalogue":"Choux"},{"id":"romanesco","oldName":"Romanesco","name":"Romanesco","botanical":"Chou","catalogue":"Choux"},{"id":"tomate","oldName":"Tomate","name":"Tomate","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"tomate-cerise","oldName":"Tomate cerise","name":"Tomate cerise","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"courgette","oldName":"Courgette","name":"Courgette","botanical":"Légume-fruit","catalogue":"Cucurbitacés"},{"id":"concombre","oldName":"Concombre","name":"Concombre","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"aubergine","oldName":"Aubergine","name":"Aubergine","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"poivron-vert","oldName":"Poivron vert","name":"Poivron vert","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"poivron-rouge","oldName":"Poivron rouge","name":"Poivron rouge","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"poivron-jaune","oldName":"Poivron jaune","name":"Poivron jaune","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"piment-doux","oldName":"Piment doux","name":"Piment doux","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"courge-spaghetti","oldName":"Courge spaghetti","name":"Courge spaghetti","botanical":"Légume-fruit","catalogue":"Cucurbitacés"},{"id":"potiron","oldName":"Potiron","name":"Potiron","botanical":"Légume-fruit","catalogue":"Cucurbitacés"},{"id":"potimarron","oldName":"Potimarron","name":"Potimarron","botanical":"Légume-fruit","catalogue":"Cucurbitacés"},{"id":"butternut","oldName":"Butternut","name":"Butternut","botanical":"Légume-fruit","catalogue":"Cucurbitacés"},{"id":"courge-musquee","oldName":"Courge musquée","name":"Courge musquée","botanical":"Légume-fruit","catalogue":"Cucurbitacés"},{"id":"patisson","oldName":"Pâtisson","name":"Pâtisson","botanical":"Légume-fruit","catalogue":"Cucurbitacés"},{"id":"mais-doux","oldName":"Maïs doux","name":"Maïs (épi)","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"gombo","oldName":"Gombo","name":"Gombo","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"tomatillo","oldName":"Tomatillo","name":"Tomatillo","botanical":"Légume-fruit","catalogue":"Légumes"},{"id":"physalis","oldName":"Physalis","name":"Physalis","botanical":"Légume-fruit","catalogue":"Fruits exotiques"},{"id":"chayote","oldName":"Chayote","name":"Chayote","botanical":"Légume-fruit","catalogue":"Fruits exotiques"},{"id":"pomme","oldName":"Pomme","name":"Pomme","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"poire","oldName":"Poire","name":"Poire","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"coing","oldName":"Coing","name":"Coing","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"nashi","oldName":"Nashi","name":"Nashi","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"pomme-sauvage","oldName":"Pomme sauvage","name":"Pomme sauvage","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"poire-williams","oldName":"Poire Williams","name":"Poire Williams","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"poire-conference","oldName":"Poire Conférence","name":"Poire Conférence","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"pomme-boskoop","oldName":"Pomme Boskoop","name":"Pomme Boskoop","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"pomme-gala","oldName":"Pomme Gala","name":"Pomme Gala","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"pomme-golden","oldName":"Pomme Golden","name":"Pomme Golden","botanical":"Fruit à pépins","catalogue":"Fruits à pépins"},{"id":"abricot","oldName":"Abricot","name":"Abricot","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"peche","oldName":"Pêche","name":"Pêche","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"nectarine","oldName":"Nectarine","name":"Nectarine","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"prune","oldName":"Prune","name":"Prune","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"mirabelle","oldName":"Mirabelle","name":"Mirabelle","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"quetsche","oldName":"Quetsche","name":"Quetsche","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"reine-claude","oldName":"Reine-Claude","name":"Reine-Claude (Prune Reine-Claude)","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"cerise","oldName":"Cerise","name":"Cerise","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"griotte","oldName":"Griotte","name":"Griotte","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"pruneau","oldName":"Pruneau","name":"Pruneau","botanical":"Fruit à noyau","catalogue":"Fruits à noyau"},{"id":"fraise","oldName":"Fraise","name":"Fraise","botanical":"Petit fruit","catalogue":"Fruits des bois"},{"id":"framboise","oldName":"Framboise","name":"Framboise","botanical":"Petit fruit","catalogue":"Fruits des bois"},{"id":"mure","oldName":"Mûre","name":"Mûre","botanical":"Petit fruit","catalogue":"Fruits des bois"},{"id":"myrtille","oldName":"Myrtille","name":"Myrtille","botanical":"Petit fruit","catalogue":"Fruits des bois"},{"id":"cassis","oldName":"Cassis","name":"Cassis","botanical":"Petit fruit","catalogue":"Fruits des bois"},{"id":"groseille","oldName":"Groseille","name":"Groseille","botanical":"Petit fruit","catalogue":"Fruits des bois"},{"id":"airelle","oldName":"Airelle","name":"Airelle","botanical":"Petit fruit","catalogue":"Fruits des bois"},{"id":"sureau-baies","oldName":"Sureau baie","name":"Sureau baie","botanical":"Petit fruit","catalogue":"Fruits des bois"},{"id":"noix","oldName":"Noix","name":"Noix","botanical":"Fruit à coque","catalogue":"Fruits à coque"},{"id":"noisette","oldName":"Noisette","name":"Noisette","botanical":"Fruit à coque","catalogue":"Fruits à coque"},{"id":"orange","oldName":"Orange","name":"Orange","botanical":"Agrume","catalogue":"Agrumes"},{"id":"mandarine","oldName":"Mandarine","name":"Mandarine","botanical":"Agrume","catalogue":"Agrumes"},{"id":"clementine","oldName":"Clémentine","name":"Clémentine","botanical":"Agrume","catalogue":"Agrumes"},{"id":"citron","oldName":"Citron","name":"Citron","botanical":"Agrume","catalogue":"Agrumes"},{"id":"citron-vert","oldName":"Citron vert","name":"Citron vert","botanical":"Agrume","catalogue":"Agrumes"},{"id":"pamplemousse","oldName":"Pamplemousse","name":"Pamplemousse","botanical":"Agrume","catalogue":"Agrumes"},{"id":"pomelo","oldName":"Pomelo","name":"Pomelo","botanical":"Agrume","catalogue":"Agrumes"},{"id":"kumquat","oldName":"Kumquat","name":"Kumquat","botanical":"Agrume","catalogue":"Agrumes"},{"id":"bergamote","oldName":"Bergamote","name":"Bergamote","botanical":"Agrume","catalogue":"Agrumes"},{"id":"yuzu","oldName":"Yuzu","name":"Yuzu","botanical":"Agrume","catalogue":"Agrumes"},{"id":"banane","oldName":"Banane","name":"Banane","botanical":"Fruit exotique","catalogue":"Fruits exotiques"},{"id":"ananas","oldName":"Ananas","name":"Ananas","botanical":"Fruit exotique","catalogue":"Fruits exotiques"},{"id":"mangue","oldName":"Mangue","name":"Mangue","botanical":"Fruit exotique","catalogue":"Fruits à noyau"},{"id":"papaye","oldName":"Papaye","name":"Papaye","botanical":"Fruit exotique","catalogue":"Fruits à pépins"},{"id":"kiwi","oldName":"Kiwi","name":"Kiwi","botanical":"Fruit exotique","catalogue":"Fruits à pépins"},{"id":"grenade","oldName":"Grenade","name":"Grenade","botanical":"Fruit exotique","catalogue":"Fruits exotiques"},{"id":"litchi","oldName":"Litchi","name":"Litchi","botanical":"Fruit exotique","catalogue":"Fruits à noyau"},{"id":"fruit-de-la-passion","oldName":"Fruit de la passion","name":"Fruit de la passion","botanical":"Fruit exotique","catalogue":"Fruits à pépins"},{"id":"kaki","oldName":"Kaki","name":"Kaki","botanical":"Fruit exotique","catalogue":"Baies"},{"id":"noix-de-coco","oldName":"Noix de coco","name":"Noix de coco","botanical":"Fruit exotique","catalogue":"Fruits exotiques"},{"id":"melon","oldName":"Melon","name":"Melon","botanical":"Fruit","catalogue":"Cucurbitacés"},{"id":"pasteque","oldName":"Pastèque","name":"Pastèque","botanical":"Fruit","catalogue":"Cucurbitacés"},{"id":"figue","oldName":"Figue","name":"Figue","botanical":"Fruit","catalogue":"Fruits exotiques"},{"id":"raisin","oldName":"Raisin","name":"Raisin","botanical":"Fruit","catalogue":"Fruits à pépins"},{"id":"rhubarbe","oldName":"Rhubarbe","name":"Rhubarbe","botanical":"Fruit","catalogue":"Légumes"},{"id":"chataigne","oldName":"Châtaigne","name":"Châtaigne","botanical":"Fruit à coque","catalogue":"Fruits à coque"},{"id":"coqueret-du-perou","oldName":"Coqueret du Pérou","name":"Coqueret du Pérou","botanical":"Fruit","catalogue":"Fruits exotiques"},{"id":"canneberge","oldName":"Canneberge","name":"Canneberge","botanical":"Fruit","catalogue":"Fruits"},{"id":"baie-de-goji","oldName":"Baie de goji","name":"Baie de goji","botanical":"Fruit","catalogue":"Fruits"},{"id":"carambole","oldName":"Carambole","name":"Carambole","botanical":"Fruit","catalogue":"Fruits exotiques"},{"id":"concombre-nostrano-mtg74jsi6oa","oldName":"Concombre Nostrano","name":"Concombre Nostrano","botanical":"Légume-fruit","catalogue":"Légumes"}];
function harmoniseProduce66(){
 const done='hg-produce-harmonisation-2981166';if(hgGet(done)==='1')return;
 const byId=new Map(PRODUCE_HARMONISATION_66.map(x=>[x.id,x]));
 if(produceItems.length!==121||PRODUCE_HARMONISATION_66.some(x=>!produceItems.some(p=>p.id===x.id))){console.warn('Migration Fruits & Légumes suspendue : identifiants ou nombre de fiches différents');return;}
 hgSet('hg-produce-before-harmonisation-2981166',JSON.stringify(produceItems));
 for(const p of produceItems){const r=byId.get(p.id);if(!r)continue;
  if(p.name===r.oldName)p.name=r.name;
  // L'ancienne catégorie botanique reste inchangée.
  p.catalogCategory=r.catalogue;
 }
 hgSet(produceStore,JSON.stringify(produceItems));hgSet(done,'1');
}
function normalizeProduce(p={}){return {...p,id:String(p.id||slug(p.name||'produit')),name:String(p.name||'Produit sans nom')};}
function produceUnique(field){return [...new Set(produceItems.map(p=>String(p[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));}
function refreshProduceEditorSelects(p={}){fillEditableSelect($('#produceEditCategory'),produceUnique('category'),p.category||'','Choisir…');fillEditableSelect($('#produceEditCatalogCategory'),produceUnique('catalogCategory'),p.catalogCategory||'','Choisir…');fillEditableSelect($('#produceEditSeason'),produceUnique('season'),p.season||'','Choisir…');}
function fillProduceSelect(id,values,label){const e=$(id),v=e?.value||'';if(!e)return;e.innerHTML=`<option value="">${label}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(values.includes(v))e.value=v;}
function produceFacetPool(exclude){const q=norm($('#produceSearch')?.value),category=$('#produceCategory')?.value||'',season=$('#produceSeason')?.value||'',availability=$('#produceAvailability')?.value||'';return produceItems.filter(p=>(exclude==='category'||!category||p.category===category)&&(exclude==='season'||!season||p.season===season)&&(exclude==='availability'||!availability||p.availability===availability)&&(!q||norm(Object.values(p).join(' ')).includes(q)))}
function produceFacetValues(field){return [...new Set(produceFacetPool(field).map(p=>String(p[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))}
function renderProduceFilters(){fillProduceSelect('#produceCategory',produceFacetValues('category'),'Toutes les catégories');fillProduceSelect('#produceSeason',produceFacetValues('season'),'Toutes les saisons');fillProduceSelect('#produceAvailability',produceFacetValues('availability'),'Toutes les disponibilités');}
async function initProduce(){
 try{
  const res=await fetch(`fruits-vegetables.json?_=${Date.now()}`,{cache:'no-store'}),payload=res.ok?await res.json():{products:[]};
  const stored=JSON.parse(hgGet(produceStore)||'null');
  produceItems=(stored&&stored.length?stored:payload.products||[]).map(normalizeProduce);
  // v2.9.8.11.48 : harmonisation des noms validés, sans toucher aux autres champs.
  {const m={"abricot":"Abricot","ail":"Ail","airelle":"Airelle","ananas":"Ananas","aubergine":"Aubergine","baie-de-goji":"Baie de goji","banane":"Banane","bergamote":"Bergamote","bette":"Côte de bette","betterave-jaune":"Betterave jaune","betterave-rouge":"Betterave rouge","brocoli":"Brocoli","butternut":"Butternut","canneberge":"Canneberge","carambole":"Carambole","carotte":"Carotte","cassis":"Cassis","celeri-branche":"Céleri branche","celeri-rave":"Céleri rave","cerise":"Cerise","chataigne":"Châtaigne","chayote":"Chayote","chou-blanc":"Chou blanc","chou-chinois":"Chou chinois","chou-de-bruxelles":"Choux de Bruxelles","chou-kale":"Chou kale","chou-rouge":"Chou rouge","chou-fleur":"Chou-fleur","chou-rave":"Chou-rave","citron":"Citron","citron-vert":"Citron vert","clementine":"Clémentine","coing":"Coing","concombre":"Concombre","coqueret-du-perou":"Coqueret du Pérou","courge-musquee":"Courge musquée","courge-spaghetti":"Courge spaghetti","courgette":"Courgette","crosne":"Crosne","echalote":"Échalote","epinard":"Épinard","fenouil":"Fenouil","figue":"Figue","fraise":"Fraise","framboise":"Framboise","fruit-de-la-passion":"Fruit de la passion","gombo":"Gombo","grenade":"Grenade","griotte":"Griotte","groseille":"Groseille","kaki":"Kaki","kiwi":"Kiwi","kumquat":"Kumquat","laitue-pommee":"Laitue pommée","laitue-romaine":"Laitue romaine","litchi":"Litchi","mache":"Mâche","mais-doux":"Maïs doux","mandarine":"Mandarine","mangue":"Mangue","melon":"Melon","mirabelle":"Mirabelle","mure":"Mûre","myrtille":"Myrtille","nashi":"Nashi","navet":"Navet","nectarine":"Nectarine","noisette":"Noisette","noix":"Noix","noix-de-coco":"Noix de coco","oignon-blanc":"Oignon blanc","oignon-jaune":"Oignon jaune","oignon-rouge":"Oignon rouge","orange":"Orange","pak-choi":"Pak-choï","pamplemousse":"Pamplemousse","panais":"Panais","papaye":"Papaye","pasteque":"Pastèque","patate-douce":"Patate douce","patisson":"Pâtisson","peche":"Pêche","persil-tubereux":"Persil tubéreux","physalis":"Physalis","piment-doux":"Piment doux","poire":"Poire","poire-conference":"Poire Conférence","poire-williams":"Poire Williams","poireau":"Poireau","poivron-jaune":"Poivron jaune","poivron-rouge":"Poivron rouge","poivron-vert":"Poivron vert","pomelo":"Pomelo","pomme":"Pomme","pomme-boskoop":"Pomme Boskoop","pomme-de-terre":"Pomme de terre","pomme-gala":"Pomme Gala","pomme-golden":"Pomme Golden","pomme-sauvage":"Pomme sauvage","potimarron":"Potimarron","potiron":"Potiron","prune":"Prune","pruneau":"Pruneau","quetsche":"Quetsche","radis-noir":"Radis noir","radis-rouge":"Radis rouge","raisin":"Raisin","reine-claude":"Reine-Claude","rhubarbe":"Rhubarbe","romanesco":"Romanesco","roquette":"Roquette","rutabaga":"Rutabaga","salsifis":"Salsifis","scorsonere":"Scorsonère","sureau-baies":"Sureau baie","tomate":"Tomate","tomate-cerise":"Tomate cerise","tomatillo":"Tomatillo","topinambour":"Topinambour","yuzu":"Yuzu"};let changed=false;for(const item of produceItems){const next=m[String(item.id)];if(next&&item.name!==next){item.name=next;changed=true}}if(changed)hgSet(produceStore,JSON.stringify(produceItems));}
  if(!stored)hgSet(produceStore,JSON.stringify(produceItems));
  harmoniseProduce66();
  applyProduceBenefits2983(produceItems);
  renderProduceFilters();
  renderProduce();
 }catch(e){console.error('Fruits & Légumes',e);produceItems=[];renderProduce();}
}
function produceFiltered(){const q=norm($('#produceSearch')?.value),category=$('#produceCategory')?.value||'',season=$('#produceSeason')?.value||'',availability=$('#produceAvailability')?.value||'';return produceItems.filter(p=>(!category||p.category===category)&&(!season||p.season===season)&&(!availability||p.availability===availability)&&(!q||norm(Object.values(p).join(' ')).includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));}
function produceCard(p){return `<article class="produce-card"><button data-view-produce="${esc(p.id)}"><div class="produce-card-title"><h3>${esc(p.name)}</h3><span class="meta">${esc([p.category,p.catalogCategory,p.season].filter(Boolean).join(' · '))}</span></div><p>${esc(p.description||p.uses||'')}</p><div class="badges">${[p.availability,p.preparation,p.conservation].filter(Boolean).slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('')}</div></button></article>`;}
function renderProduce(){const found=produceFiltered(),count=$('#produceCount'),list=$('#produceList');if(!count||!list)return;count.textContent=`${found.length} produit${found.length>1?'s':''}`;list.innerHTML=found.map(produceCard).join('')||'<p>Aucun fruit ou légume trouvé.</p>';$$('[data-view-produce]').forEach(b=>b.onclick=()=>showProduce(b.dataset.viewProduce,'produce'));}
['#produceSearch','#produceCategory','#produceSeason','#produceAvailability'].forEach(id=>{const e=$(id);if(e)e.addEventListener(e.tagName==='INPUT'?'input':'change',()=>{renderProduceFilters();renderProduce()})});
if($('#clearProduceFilters'))$('#clearProduceFilters').onclick=()=>{$('#produceSearch').value='';$('#produceCategory').value='';$('#produceSeason').value='';$('#produceAvailability').value='';renderProduceFilters();renderProduce();};
if($('#randomProduce'))$('#randomProduce').onclick=()=>{if(produceItems.length)showProduce(produceItems[Math.floor(Math.random()*produceItems.length)].id)};
function linkedProduceRecipes(p){const names=[p.name,...terms(p.name)].filter(Boolean);return recipes.filter(r=>r.ingredients.some(i=>names.some(t=>norm(i[0]).includes(t)||t.includes(norm(i[0]))))).slice(0,40);}
function linkedProduceHerbs(p){const hay=norm([p.pairings,p.benefitPairings,p.preparation,p.uses].join(' '));return herbs.filter(h=>{const base=norm(h.name).split(' ')[0];return base.length>2&&hay.includes(base)}).slice(0,24);}
function linkedProduceProducers(p){const n=norm(p.name).split(' ')[0];return producers.filter(x=>norm([...(x.products||[]),x.notes||''].join(' ')).includes(n)).slice(0,20);}
function showProduce(id,from=''){const p=produceItems.find(x=>x.id===id);if(!p)return;if(from){rememberScroll(from);previousProduceView=from}else if(!previousProduceView)previousProduceView='produce';viewedProduceId=id;const rec=linkedProduceRecipes(p),hs=linkedProduceHerbs(p),prod=linkedProduceProducers(p);$('#produceViewContent').innerHTML=`<div class="produce-detail-head"><div class="meta">${esc([p.category,p.catalogCategory,p.season,p.availability].filter(Boolean).join(' · '))}</div><h2>${esc(p.name)}</h2>${p.latinName?`<p class="latin-name"><em>${esc(p.latinName)}</em></p>`:''}<p class="produce-description">${esc(p.description||'')}</p></div><div class="produce-detail-grid">${fieldBlock('Catégorie botanique',p.category)}${fieldBlock('Catégorie Catalogue',p.catalogCategory)}${fieldBlock('Utilisations culinaires',p.uses)}${fieldBlock('Bienfaits / Caractéristiques',p.benefits,true)}${fieldBlock('À associer avec',p.pairings)}${fieldBlock('Associations renforçant les bienfaits',p.benefitPairings)}${fieldBlock('Modes de préparation',p.preparation)}${fieldBlock('Conservation',p.conservation)}${fieldBlock('Remarques',p.notes)}</div><section class="knowledge-links"><h3>Recettes de ton Herbier</h3><div class="link-list">${rec.length?rec.map(r=>`<button data-produce-recipe="${esc(r.id)}">${esc(r.title)}</button>`).join(''):'<p class="muted">Aucune correspondance automatique trouvée pour l’instant.</p>'}</div></section><section class="knowledge-links"><h3>Plantes & Épices associées</h3><div class="link-list">${hs.length?hs.map(h=>`<button data-produce-herb="${esc(h.id)}">${esc(h.name)}</button>`).join(''):'<p class="muted">Aucun lien automatique trouvé dans les accords de cette fiche.</p>'}</div></section><section class="knowledge-links"><h3>Producteurs locaux</h3><div class="link-list">${prod.length?prod.map(x=>`<button data-produce-producer="${esc(x.id)}">${esc(x.name)}</button>`).join(''):'<p class="muted">Aucun producteur correspondant automatiquement pour l’instant.</p>'}</div></section>`;$$('[data-produce-recipe]').forEach(b=>b.onclick=()=>showRecipe(b.dataset.produceRecipe,'produceView'));$$('[data-produce-herb]').forEach(b=>b.onclick=()=>showHerb(b.dataset.produceHerb,'produceView'));$$('[data-produce-producer]').forEach(b=>b.onclick=()=>showProducer(b.dataset.produceProducer,'produceView'));switchView('produceView',{top:true});}
function openProduceEditor(id=viewedProduceId){
 if(READONLY)return;
 const existing=produceItems.find(x=>x.id===id),p=existing||{id:'',name:''},isNew=!existing;
 $('#produceDialogTitle').textContent=isNew?'Ajouter un fruit ou un légume':'Modifier Fruit & Légume';
 $('#produceEditId').value=isNew?'':p.id;refreshProduceEditorSelects(p);
 const map={Name:'name',Category:'category',CatalogCategory:'catalogCategory',Latin:'latinName',Availability:'availability',Season:'season',Description:'description',Benefits:'benefits',Pairings:'pairings',BenefitPairings:'benefitPairings',Preparation:'preparation',Conservation:'conservation',Uses:'uses',Notes:'notes'};
 Object.entries(map).forEach(([suffix,key])=>{$(`#produceEdit${suffix}`).value=p[key]||''});if(isNew)$('#produceEditName').value='';$('#deleteProduce')?.classList.toggle('hidden',isNew);$('#produceDialog').showModal()
}
if($('#newProduce'))$('#newProduce').onclick=()=>openProduceEditor('');
if($('#editViewedProduce'))$('#editViewedProduce').onclick=()=>openProduceEditor();
if($('#closeProduceDialog'))$('#closeProduceDialog').onclick=()=>$('#produceDialog').close();
if($('#deleteProduce'))$('#deleteProduce').onclick=async()=>{const id=$('#produceEditId').value,p=produceItems.find(x=>x.id===id);if(!p)return;if(!confirm(`Supprimer définitivement « ${p.name} » ?`))return;const photoId=p.photoId||'';produceItems=produceItems.filter(x=>x.id!==id);hgSet(produceStore,JSON.stringify(produceItems));if(photoId&&window.hgMediaDeletePhoto)try{await window.hgMediaDeletePhoto(photoId)}catch(err){console.warn('Suppression photo',err)}registerProtectedChange();markDirty();viewedProduceId=null;renderProduceFilters();renderProduce();$('#produceDialog').close();switchView('produce')};
if($('#produceForm'))$('#produceForm').onsubmit=e=>{e.preventDefault();const oldId=$('#produceEditId').value;let p=oldId?produceItems.find(x=>x.id===oldId):null;const map={Name:'name',Category:'category',CatalogCategory:'catalogCategory',Latin:'latinName',Availability:'availability',Season:'season',Description:'description',Benefits:'benefits',Pairings:'pairings',BenefitPairings:'benefitPairings',Preparation:'preparation',Conservation:'conservation',Uses:'uses',Notes:'notes'};if(!p){const name=$('#produceEditName').value.trim();let id=slug(name||`produit-${Date.now()}`);if(produceItems.some(x=>x.id===id))id=`${id}-${Date.now()}`;p=normalizeProduce({id,name});produceItems.push(p)}Object.entries(map).forEach(([suffix,key])=>p[key]=$(`#produceEdit${suffix}`).value.trim());hgSet(produceStore,JSON.stringify(produceItems));registerProtectedChange();markDirty();renderProduceFilters();renderProduce();$('#produceDialog').close();showProduce(p.id)};
if($('#backFromProduce'))$('#backFromProduce').onclick=()=>switchView(previousProduceView);



function printField(label,value){return `<section class="print-field"><h3>${esc(label)}</h3><p>${esc(value||'—').replace(/\n/g,'<br>')}</p></section>`}
function printHerb(h){if(!h)return;const body=`<h1>${esc(h.name)}</h1><p>${esc([h.family,h.catalogCategory,h.origin,h.season,h.intensity].filter(Boolean).join(' · '))}</p>${printField('Catégorie botanique',h.family)}${printField('Catégorie Catalogue',h.catalogCategory)}<div class="columns"><div>${printField('Profil gustatif',h.flavor)}${printField('Utilisations culinaires',h.uses)}${printField('Bienfaits / Caractéristiques',h.benefits)}${printField('À associer avec',h.pairings)}</div><div>${printField('Modes de préparation',h.preparation)}${printField('Quantité indicative',h.quantity)}${printField('Substitution possible',h.substitution)}${printField('Erreur à éviter',h.avoid)}${printField('Conservation',h.conservation)}${printField('Où l’acheter en Suisse',h.whereToBuy)}${printField('Idées de recettes',h.recipeIdeas)}${printField('Astuce du chef',h.chefTip)}</div></div>`;printDocument(h.name,body)}
function printProduce(p){if(!p)return;const body=`<h1>${esc(p.name)}</h1><p>${esc([p.category,p.catalogCategory,p.season,p.availability].filter(Boolean).join(' · '))}</p>${p.latinName?`<p><em>${esc(p.latinName)}</em></p>`:''}${printField('Catégorie botanique',p.category)}${printField('Catégorie Catalogue',p.catalogCategory)}${printField('Description',p.description)}<div class="columns"><div>${printField('Utilisations culinaires',p.uses)}${printField('Bienfaits',p.benefits)}${printField('À associer avec',p.pairings)}${printField('Associations renforçant les bienfaits',p.benefitPairings)}</div><div>${printField('Modes de préparation',p.preparation)}${printField('Conservation',p.conservation)}${printField('Remarques',p.notes)}</div></div>`;printDocument(p.name,body)}
function printHerbList(){const found=herbFiltered();if(!found.length)return alert('Aucune fiche à imprimer.');printDocument('Plantes & Épices',`<h1>Plantes & Épices</h1><p>${found.length} fiche${found.length>1?'s':''} affichée${found.length>1?'s':''}</p>${found.map(h=>`<div class="day"><h2>${esc(h.name)}</h2><p><strong>${esc([h.family,h.intensity].filter(Boolean).join(' · '))}</strong></p><p>${esc(h.flavor||h.uses||'')}</p><p>${esc([h.season,h.origin,h.dishTypes].filter(Boolean).join(' · '))}</p></div>`).join('')}`)}
function printProduceList(){const found=produceFiltered();if(!found.length)return alert('Aucune fiche à imprimer.');printDocument('Fruits & Légumes',`<h1>Fruits & Légumes</h1><p>${found.length} fiche${found.length>1?'s':''} affichée${found.length>1?'s':''}</p>${found.map(p=>`<div class="day"><h2>${esc(p.name)}</h2><p><strong>${esc([p.category,p.catalogCategory,p.season].filter(Boolean).join(' · '))}</strong></p><p>${esc(p.description||p.uses||'')}</p><p>${esc([p.availability,p.preparation,p.conservation].filter(Boolean).join(' · '))}</p></div>`).join('')}`)}
if($('#printViewedHerb'))$('#printViewedHerb').onclick=()=>printHerb(herbs.find(x=>x.id===viewedHerbId));
if($('#printHerbList'))$('#printHerbList').onclick=printHerbList;
if($('#printViewedProduce'))$('#printViewedProduce').onclick=()=>printProduce(produceItems.find(x=>x.id===viewedProduceId));
if($('#printProduceList'))$('#printProduceList').onclick=printProduceList;

function bindEditableOtherSelect(selector,label){const el=$(selector);if(!el)return;el.addEventListener('change',()=>{if(el.value==='__other__'){const value=prompt(`Nouveau ${label} :`);if(value?.trim()){addSelectOption(el,value.trim());el.value=value.trim()}else el.value=''}})}
['#recipeCategory','#restaurantRegionField','#restaurantCityField','#restaurantCountryField','#producerTypeField','#producerRegionField','#herbEditFamily','#herbEditSeason','#herbEditIntensity','#herbEditForms','#produceEditCategory','#produceEditCatalogCategory','#produceEditSeason'].forEach((id,i)=>bindEditableOtherSelect(id,['catégorie','région','lieu','pays','type','région','famille','saison','intensité','forme','catégorie','saison'][i]));

/* v2.9.7.15.5 — recherche flottante, extension prudente du mécanisme validé.
   Aucun remplacement de switchView/navigation : chaque bouton observe seulement le scroll. */
(()=>{
  const configs=[
    ['recipeFloatingSearch','recipes','search'],
    ['restaurantFloatingSearch','restaurants','restaurantSearch'],
    ['producerFloatingSearch','producers','producerSearch'],
    ['herbFloatingSearch','herbs','herbSearch'],
    ['produceFloatingSearch','produce','produceSearch']
  ];
  const items=configs.map(([buttonId,viewId,searchId])=>({
    button:document.getElementById(buttonId),
    view:document.getElementById(viewId),
    search:document.getElementById(searchId)
  })).filter(x=>x.button&&x.view&&x.search);
  if(!items.length)return;
  let scheduled=false;
  const refresh=()=>{
    scheduled=false;
    items.forEach(({button,view,search})=>{
      const active=view.classList.contains('active');
      if(!active){button.classList.remove('visible');return;}
      const rect=search.getBoundingClientRect();
      button.classList.toggle('visible',rect.bottom<12);
    });
  };
  const requestRefresh=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(refresh);
  };
  items.forEach(({button,search})=>button.addEventListener('click',()=>{
    search.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>{try{search.focus({preventScroll:true})}catch{search.focus()}},280);
  }));
  window.addEventListener('scroll',requestRefresh,{passive:true});
  window.addEventListener('resize',requestRefresh,{passive:true});
  document.addEventListener('click',requestRefresh);
  requestRefresh();
})();


/* v2.9.8.11.44 — Catalogue maître : Nom · Catégorie · Rayon · Image. */
(()=>{
 const STORE='hg-ingredient-catalog-v1';
 const LIST_STORE='hg-ingredient-catalog-lists-v1';
 let extraLists={aisle:[],group:[]};
 function loadLists(){try{const x=JSON.parse(hgGet(LIST_STORE)||'{}');extraLists={aisle:Array.isArray(x.aisle)?x.aisle:[],group:Array.isArray(x.group)?x.group:[]}}catch(_){extraLists={aisle:[],group:[]}}}
 function saveLists(){hgSet(LIST_STORE,JSON.stringify(extraLists));registerProtectedChange();markDirty()}
 loadLists();
 $('#backHerbsToLibrary')?.addEventListener('click',()=>switchView('library',{top:true}));
 $('#backProduceToLibrary')?.addEventListener('click',()=>switchView('library',{top:true}));
 const source=Array.isArray(window.HG_FRIGO_CATALOG_SOURCE)?window.HG_FRIGO_CATALOG_SOURCE:[];
 let catalog=[];
 const normalizeItem=(x={},migrate=false)=>{const y={...x};delete y._editing;if(migrate&&y.aisle==null){y.aisle=String(y.group||'À classer');y.group=''}else{y.aisle=String(y.aisle||'À classer');y.group=String(y.group||'')}return y};
 const load=()=>{try{const raw=hgGet(STORE),saved=raw?JSON.parse(raw):null;if(Array.isArray(saved)){const needsMigration=saved.some(x=>x.aisle==null);catalog=saved.map(x=>normalizeItem(x,true));if(needsMigration)hgSet(STORE,JSON.stringify(catalog));return true}catalog=source.map(x=>normalizeItem(x,true));return false}catch(err){console.error('Lecture Catalogue',err);catalog=[];return false}};
 const save=()=>{const stable=catalog.map(x=>normalizeItem(x));catalog=stable;hgSet(STORE,JSON.stringify(stable));registerProtectedChange();markDirty()};
 const unique=field=>[...new Set(catalog.map(x=>String(x[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
 const listValues=field=>[...new Set([...unique(field),...(extraLists[field]||[])])].sort((a,b)=>a.localeCompare(b,'fr'));
 const aisles=()=>listValues('aisle'),groups=()=>listValues('group'),names=()=>unique('name');
 function refreshFilters(){const a=$('#ingredientCatalogAisle'),g=$('#ingredientCatalogGroup');if(a){const keep=a.value;a.innerHTML='<option value="">Tous les rayons</option>'+aisles().map(v=>`<option>${esc(v)}</option>`).join('');if([...a.options].some(o=>o.value===keep))a.value=keep}if(g){const keep=g.value;g.innerHTML='<option value="">Toutes les catégories</option>'+groups().map(v=>`<option>${esc(v)}</option>`).join('');if([...g.options].some(o=>o.value===keep))g.value=keep}}
 function filtered(){const q=norm($('#ingredientCatalogSearch')?.value||''),a=$('#ingredientCatalogAisle')?.value||'',g=$('#ingredientCatalogGroup')?.value||'';return catalog.filter(x=>(!a||x.aisle===a)&&(!g||x.group===g)&&(!q||norm(x.name).includes(q)||norm(x.aisle).includes(q)||norm(x.group).includes(q))).sort((x,y)=>x.name.localeCompare(y.name,'fr'))}
 function optionList(values,current,specialLabel,emptyLabel=''){let out=emptyLabel?`<option value=""${!current?' selected':''}>${esc(emptyLabel)}</option>`:'';out+=`<option value="__new__">${esc(specialLabel)}</option>`;out+=values.map(v=>`<option value="${esc(v)}"${v===current?' selected':''}>${esc(v)}</option>`).join('');return out}
 function row(x){const editing=x._editing;return `<div class="ingredient-catalog-row" data-catalog-id="${esc(x.id)}"><button type="button" class="ingredient-catalog-photo-hit" data-catalog-photo aria-label="${x.image?'Modifier la photo de ':'Ajouter une photo à '}${esc(x.name)}" title="${x.image?'Changer ou retirer la photo':'Ajouter une photo'}"><img class="ingredient-catalog-thumb" src="${x.image||''}" alt=""></button><div class="ingredient-catalog-info"><div class="ingredient-catalog-name">${editing?`<textarea class="catalog-edit-name" aria-label="Nom" rows="2" maxlength="200">${esc(x.name)}</textarea>`:esc(x.name)}</div><div class="ingredient-catalog-meta"><span class="ingredient-catalog-aisle">${editing?`<select class="catalog-edit-aisle" aria-label="Rayon">${optionList(aisles(),x.aisle||'À classer','➕ Nouveau rayon…')}</select>`:esc(x.aisle||'À classer')}</span><span class="ingredient-catalog-meta-sep" aria-hidden="true"> · </span><span class="ingredient-catalog-group">${editing?`<select class="catalog-edit-group" aria-label="Catégorie">${optionList(groups(),x.group||'','➕ Nouvelle catégorie…','— Catégorie —')}</select>`:esc(x.group||'—')}</span></div></div><div class="ingredient-catalog-actions">${READONLY?'':`<button type="button" data-catalog-edit>${editing?'Enregistrer':'Modifier'}</button><button type="button" data-catalog-associate>${hgCatalogAssociationLabel(x)}</button><button type="button" data-catalog-delete class="danger">Supprimer</button>`}</div></div>`}

 function bindSpecialSelects(list){
  for(const [cls,field,label,values] of [['.catalog-edit-aisle','aisle','rayon',aisles],['.catalog-edit-group','group','catégorie',groups]])list.querySelectorAll(cls).forEach(sel=>sel.onchange=()=>{if(sel.value!=='__new__')return;const r=sel.closest('[data-catalog-id]'),x=catalog.find(y=>y.id===r.dataset.catalogId);const v=prompt(`Nom du nouveau ${label} :`,x?.[field]||'')?.trim();if(!v){sel.value=x?.[field]||'';return}const existing=values().find(z=>norm(z)===norm(v)),value=existing||v,o=document.createElement('option');o.value=o.textContent=value;sel.insertBefore(o,sel.lastElementChild);sel.value=value});
 }
 const photoInput=$('#ingredientCatalogPhotoFile');
 let photoTargetId='';
 function imageToDataURL(file){return new Promise((resolve,reject)=>{if(!file.type.startsWith('image/'))return reject(new Error('Sélectionne une image.'));const reader=new FileReader();reader.onerror=()=>reject(new Error('Lecture de la photo impossible.'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Format image non reconnu.'));img.onload=()=>{try{const scale=Math.min(1,600/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.84))}catch(e){reject(e)}};img.src=reader.result};reader.readAsDataURL(file)})}
 photoInput?.addEventListener('change',async e=>{const file=e.target.files?.[0],id=photoTargetId;e.target.value='';photoTargetId='';if(!file||!id)return;const item=catalog.find(x=>x.id===id);if(!item)return;try{const data=await imageToDataURL(file);item.image=data;item.filename=file.name;save();render()}catch(err){alert('Photo non enregistrée : '+err.message)}});
 function render(){const previousY=window.scrollY;refreshFilters();const list=$('#ingredientCatalogList'),count=$('#ingredientCatalogCount');if(!list||!count)return;const found=filtered();count.textContent=`${found.length} image${found.length>1?'s':''} affichée${found.length>1?'s':''} · ${catalog.length} au catalogue`;list.innerHTML=found.map(row).join('')||'<p class="ingredient-catalog-empty">Aucun élément trouvé.</p>';bindSpecialSelects(list);list.querySelectorAll('[data-catalog-photo]').forEach(b=>b.onclick=()=>{const r=b.closest('[data-catalog-id]'),x=catalog.find(y=>y.id===r?.dataset.catalogId);if(!x)return;let choice='1';if(x.image){choice=prompt(`Photo de « ${x.name} » :\n1 — Changer la photo\n2 — Retirer la photo\n0 — Annuler`,'1');if(choice===null||choice==='0')return;}if(choice==='2'){if(!confirm(`Retirer la photo de « ${x.name} » ? L'article sera conservé.`))return;x.image='';x.filename='';save();render();return;}if(choice!=='1')return;photoTargetId=x.id;if(photoInput){photoInput.value='';photoInput.click()}});list.querySelectorAll('[data-catalog-edit]').forEach(b=>b.onclick=()=>{const r=b.closest('[data-catalog-id]'),x=catalog.find(y=>y.id===r.dataset.catalogId);if(!x)return;if(x._editing){const n=r.querySelector('.catalog-edit-name').value.trim(),a=r.querySelector('.catalog-edit-aisle').value.trim(),g=r.querySelector('.catalog-edit-group').value.trim();if(!n||n==='__new__')return alert('Choisissez un nom.');if(!a||a==='__new__')return alert('Choisissez un rayon.');if(g==='__new__')return alert('Choisissez une catégorie.');const dup=catalog.find(y=>y.id!==x.id&&norm(y.name)===norm(n));if(dup)return alert(`« ${n} » existe déjà dans le catalogue.`);x.name=n;x.aisle=a;x.group=g;delete x._editing;save()}else{x._editing=true}render()});list.querySelectorAll('[data-catalog-associate]').forEach(b=>b.onclick=()=>{const r=b.closest('[data-catalog-id]'),x=catalog.find(y=>y.id===r?.dataset.catalogId);if(x)window.dispatchEvent(new CustomEvent('hg:catalog-associate',{detail:{...x}}))});list.querySelectorAll('[data-catalog-delete]').forEach(b=>b.onclick=()=>{const r=b.closest('[data-catalog-id]'),x=catalog.find(y=>y.id===r.dataset.catalogId);if(!x)return;if(!confirm(`Supprimer « ${x.name} » du catalogue ?`))return;catalog=catalog.filter(y=>y.id!==x.id);save();render()})}
 window.addEventListener('hg:catalog-associations-changed',()=>{if(document.getElementById('ingredientCatalogList'))render()});
 function catalogBackupName(){return `Herbier-Gourmand_Catalogue_${backupStamp()}.hgcat`}
 function exportCatalog(){const stable=catalog.map(x=>normalizeItem(x)),payload={format:'HerbierGourmandIngredientCatalog',formatVersion:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),catalog:stable,lists:extraLists};downloadTextFile(catalogBackupName(),JSON.stringify(payload,null,2));const st=$('#ingredientCatalogBackupStatus');if(st)st.textContent=`Sauvegarde du catalogue créée · ${stable.length} éléments.`}
 async function importCatalogFile(file){
  try{
   const parsed=JSON.parse(await file.text());
   if(parsed?.format!=='HerbierGourmandIngredientCatalog'||parsed.formatVersion!==1||!Array.isArray(parsed.catalog))throw new Error('format de sauvegarde du catalogue non reconnu');
   // Récupération non destructive : les produits actuels ont toujours priorité.
   await hgFlush();load();
   const before=catalog.map(x=>normalizeItem(x));
   const keys=new Set(before.map(x=>norm(x.name)));
   const additions=[];
   for(const raw of parsed.catalog){if(!raw||!String(raw.name||'').trim())continue;const item=normalizeItem(raw,true),key=norm(item.name);if(keys.has(key))continue;keys.add(key);additions.push(item)}
   const incomingLists=parsed.lists||{};
   const mergedLists={aisle:[...new Set([...(extraLists.aisle||[]),...(Array.isArray(incomingLists.aisle)?incomingLists.aisle:[])])],group:[...new Set([...(extraLists.group||[]),...(Array.isArray(incomingLists.group)?incomingLists.group:[])])]};
   if(!confirm(`Fusionner ${parsed.catalog.length} produits de la sauvegarde avec les ${before.length} produits actuels ?\n\n${additions.length} produits manquants seront ajoutés. Les produits actuels (et leurs photos) seront conservés.\n\nUne sauvegarde de sécurité sera téléchargée avant la fusion.`))return;
   const stamp=new Date().toISOString().replace(/[:.]/g,'-');
   downloadTextFile(`Herbier_Gourmand_Catalogue_AVANT_fusion_${stamp}.hgcat.json`,JSON.stringify({format:'HerbierGourmandIngredientCatalog',formatVersion:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),catalog:before,lists:extraLists},null,2));
   if(!confirm('La sauvegarde AVANT fusion est-elle bien présente dans Téléchargements ?\n\nOK = lancer la fusion ; Annuler = ne rien modifier.'))return;
   const merged=[...before,...additions];const serialized=JSON.stringify(merged);
   await hgQueue(()=>hgIdbPut(STORE,serialized));
   const verified=await new Promise((resolve,reject)=>{const tx=hgDb.transaction(HG_DB_STORE,'readonly'),req=tx.objectStore(HG_DB_STORE).get(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   if(verified!==serialized)throw new Error('Vérification IndexedDB échouée.');
   hgCache.set(STORE,serialized);catalog=merged;extraLists=mergedLists;await hgSet(LIST_STORE,JSON.stringify(extraLists));registerProtectedChange();markDirty();render();
   const st=$('#ingredientCatalogBackupStatus');if(st)st.textContent=`✓ Fusion vérifiée : ${catalog.length} produits (${additions.length} récupérés), listes conservées.`;
   alert(`Fusion réussie : ${catalog.length} produits. Les ${before.length} produits actuels ont été conservés.`);
  }catch(e){console.error('Fusion Catalogue',e);alert(`Fusion interrompue : ${e.message}`)}
 }

 const openCatalogFromLibrary=()=>{const recovered=load();render();switchView('ingredientCatalog',{top:true});const st=$('#ingredientCatalogBackupStatus');if(st&&recovered)st.textContent='Catalogue chargé depuis le stockage permanent.'};
 const listsDialog=$('#catalogListsDialog');
 const kindEl=$('#catalogListKind'), valueEl=$('#catalogListValue');
 function refreshListManager(keep=''){const field=kindEl.value,values=listValues(field);valueEl.innerHTML='<option value="">— Choisir —</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(values.includes(keep))valueEl.value=keep;$('#catalogListCount').textContent=`${values.length} ${field==='aisle'?'rayons':'catégories'}`}
 $('#manageCatalogLists')?.addEventListener('click',()=>{if(READONLY)return;refreshListManager();listsDialog.showModal()});
 $('#catalogListsClose')?.addEventListener('click',()=>listsDialog.close());
 kindEl?.addEventListener('change',()=>refreshListManager());
 $('#catalogListAdd')?.addEventListener('click',()=>{const field=kindEl.value,label=field==='aisle'?'rayon':'catégorie',v=prompt(`Nouveau ${label} :`)?.trim();if(!v)return;if(listValues(field).some(x=>norm(x)===norm(v)))return alert('Ce nom existe déjà.');extraLists[field].push(v);saveLists();refreshListManager(v);render()});
 $('#catalogListRename')?.addEventListener('click',()=>{const field=kindEl.value,old=valueEl.value;if(!old)return alert('Choisis un élément.');const v=prompt('Nouveau nom :',old)?.trim();if(!v||v===old)return;if(listValues(field).some(x=>x!==old&&norm(x)===norm(v)))return alert('Ce nom existe déjà.');const affected=catalog.filter(x=>x[field]===old).length;if(!confirm(`Renommer « ${old} » en « ${v} » pour ${affected} article(s) ?`))return;catalog.forEach(x=>{if(x[field]===old)x[field]=v});extraLists[field]=extraLists[field].filter(x=>x!==old);extraLists[field].push(v);saveLists();save();refreshListManager(v);render()});
 const addDialog=$('#catalogAddDialog');if(addDialog&&addDialog.parentElement!==document.body)document.body.appendChild(addDialog);
 $('#addIngredientCatalog')?.addEventListener('click',()=>{if(READONLY)return;load();for(const [field,values] of [['catalogAisleSuggestions',aisles()],['catalogGroupSuggestions',groups()]]){$('#'+field).innerHTML=values.map(v=>`<option value="${esc(v)}"></option>`).join('')}$('#catalogAddForm').reset();const preview=$('#catalogAddPhotoPreview');if(preview){preview.hidden=true;preview.removeAttribute('src')}addDialog.showModal();$('#catalogAddName').focus()});
 // Suggestions sous le champ, dans le flux du dialogue : compatibles avec le clavier mobile.
 for(const [fieldId,listId,valuesFn] of [['catalogAddAisle','catalogAislePick',aisles],['catalogAddGroup','catalogGroupPick',groups]]){
  const field=$('#'+fieldId),list=$('#'+listId);if(!field||!list)continue;
  field.removeAttribute('list');
  list.style.position='static';list.style.width='100%';list.style.maxHeight='155px';
  list.style.overflowY='auto';list.style.zIndex='1';
  const close=()=>list.classList.remove('open');
  const refresh=()=>{
   const q=norm(field.value.trim());
   const matches=valuesFn().filter(v=>!q||norm(v).includes(q)).slice(0,25);
   list.replaceChildren();
   for(const v of matches){
    const b=document.createElement('button');b.type='button';b.textContent=v;
    b.addEventListener('pointerdown',e=>e.preventDefault());
    b.addEventListener('click',()=>{field.value=v;close();field.dispatchEvent(new Event('change',{bubbles:true}));field.focus()});
    list.appendChild(b);
   }
   list.classList.toggle('open',matches.length>0);
   if(matches.length&&document.activeElement===field){
    requestAnimationFrame(()=>{const rect=list.getBoundingClientRect();const vv=window.visualViewport;const visibleBottom=(vv?.offsetTop||0)+(vv?.height||window.innerHeight);if(rect.top>visibleBottom-55)field.scrollIntoView({block:'center',behavior:'smooth'})});
   }
  };
  field.addEventListener('focus',refresh);field.addEventListener('input',refresh);
  field.addEventListener('blur',()=>setTimeout(close,240));
  field.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Enter'&&list.classList.contains('open')){const first=list.querySelector('button');if(first){e.preventDefault();first.click()}}});
  addDialog.addEventListener('close',close);
 }
 $('#catalogAddClose')?.addEventListener('click',()=>addDialog.close());
 $('#catalogAddCancel')?.addEventListener('click',()=>addDialog.close());
 const addPhoto=$('#catalogAddPhoto'),addPreview=$('#catalogAddPhotoPreview');
 addPhoto?.addEventListener('change',async()=>{const f=addPhoto.files?.[0];if(addPreview){addPreview.hidden=true;addPreview.removeAttribute('src')}if(!f)return;try{const data=await imageToDataURL(f);if(addPreview){addPreview.src=data;addPreview.hidden=false}}catch(e){alert('Photo non reconnue : '+e.message);addPhoto.value=''}});
 $('#catalogAddForm')?.addEventListener('submit',async e=>{e.preventDefault();await hgFlush();load();const name=$('#catalogAddName').value.trim(),aisle=$('#catalogAddAisle').value.trim(),group=$('#catalogAddGroup').value.trim();if(!name||!aisle)return;if(catalog.some(x=>norm(x.name)===norm(name)))return alert(`« ${name} » existe déjà dans le Catalogue.`);const id='catalog-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);let image='',filename='';const file=addPhoto?.files?.[0];if(file){try{image=await imageToDataURL(file);filename=file.name}catch(err){alert('Photo non enregistrée : '+err.message);return}}catalog.push({id,name,aisle,group,image,filename});save();$('#ingredientCatalogSearch').value='';$('#ingredientCatalogAisle').value='';$('#ingredientCatalogGroup').value='';addDialog.close();render();if(window.hgEncyCatalogReturn){const cb=window.hgEncyCatalogReturn;window.hgEncyCatalogReturn=null;cb({id,name,aisle,group});}else window.dispatchEvent(new CustomEvent('hg:catalog-created',{detail:{id,name,aisle,group}}));});
 window.addEventListener('hg:open-catalog-create',e=>{const name=e.detail?.name||'';$('#addIngredientCatalog')?.click();$('#catalogAddName').value=name;$('#catalogAddName').focus()});
 $('#libraryOpenCatalog')?.addEventListener('click',openCatalogFromLibrary);
 $('#openIngredientCatalog')?.addEventListener('click',openCatalogFromLibrary);
 $('#backFromIngredientCatalog')?.addEventListener('click',()=>switchView('library'));
 $('#ingredientCatalogSearch')?.addEventListener('input',render);
 $('#ingredientCatalogAisle')?.addEventListener('change',render);
 $('#ingredientCatalogGroup')?.addEventListener('change',render);
 $('#clearIngredientCatalogFilters')?.addEventListener('click',()=>{$('#ingredientCatalogSearch').value='';$('#ingredientCatalogAisle').value='';$('#ingredientCatalogGroup').value='';render()});
 $('#exportIngredientCatalog')?.addEventListener('click',exportCatalog);
 $('#hgCatalogQuickBackup')?.addEventListener('click',exportCatalog);
 $('#hgCatalogQuickName')?.addEventListener('click',()=>{
  const r=$('#ingredientCatalogList .catalog-edit-name')?.closest('[data-catalog-id]');
  if(!r)return;
  const x=catalog.find(y=>y.id===r.dataset.catalogId);if(!x)return;
  const v=prompt('Corriger ou saisir le nouveau nom :',r.querySelector('.catalog-edit-name')?.value||x.name)?.trim();
  if(!v)return;
  if(catalog.some(y=>y.id!==x.id&&norm(y.name)===norm(v)))return alert(`« ${v} » existe déjà dans le catalogue.`);
  const sel=r.querySelector('.catalog-edit-name');
  sel.value=v;
  r.querySelector('[data-catalog-edit]')?.click();
 });
 $('#ingredientCatalogImportFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importCatalogFile(f);e.target.value=''});

 // Recovery is deliberately distinct from full restore: only missing pictures are added.
 const repairInput=document.createElement('input');
 repairInput.type='file';repairInput.accept='.json,.hgcat,application/json';repairInput.hidden=true;
 repairInput.id='catalogRepairPhotosFile';
 const repairButton=document.createElement('button');repairButton.type='button';
 repairButton.id='catalogRepairPhotos';repairButton.textContent='Récupérer photos';
 const backupButton=$('#exportIngredientCatalog');
 if(backupButton?.parentNode){backupButton.parentNode.insertBefore(repairButton,backupButton.nextSibling);backupButton.parentNode.appendChild(repairInput)}
 repairButton.addEventListener('click',()=>repairInput.click());
 repairInput.addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  const status=$('#ingredientCatalogBackupStatus');
  repairButton.disabled=true;
  try{
   const data=JSON.parse(await file.text());
   if(data?.format!=='HerbierGourmandIngredientCatalog'||!Array.isArray(data.catalog))throw new Error('Fichier de catalogue non reconnu.');
   // Refresh from persisted storage before calculating the merge.
   const persisted=await new Promise((resolve,reject)=>{const tx=hgDb.transaction(HG_DB_STORE,'readonly'),req=tx.objectStore(HG_DB_STORE).get(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   const current=Array.isArray(JSON.parse(persisted||'null'))?JSON.parse(persisted):catalog;
   const byId=new Map(data.catalog.filter(x=>x?.id).map(x=>[String(x.id),x]));
   const byName=new Map();
   for(const x of data.catalog){if(!x?.name)continue;const k=norm(x.name);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(x)}
   let added=0,ambiguous=0;
   const updated=current.map(x=>{
    if(x.image)return x;
    let source=byId.get(String(x.id));
    if(source&&norm(source.name)!==norm(x.name))source=null;
    if(!source){const matches=byName.get(norm(x.name))||[];if(matches.length===1)source=matches[0];else if(matches.length>1)ambiguous++}
    if(!source?.image)return x;
    added++;return {...x,image:source.image,filename:source.filename||x.filename||''};
   });
   if(!added){status.textContent=`Aucune photo manquante récupérable · ${ambiguous} correspondances ambiguës.`;return}
   if(!confirm(`${added} photos manquantes retrouvées.\n\nUne sauvegarde du Catalogue ACTUEL sera d'abord téléchargée. Vérifie sa présence dans Téléchargements avant de confirmer la réparation.\n\nContinuer ?`))return;
   const stamp=new Date().toISOString().replace(/[:.]/g,'-');
   downloadTextFile(`Herbier_Gourmand_Catalogue_AVANT_reparation_${stamp}.hgcat.json`,JSON.stringify({format:'HerbierGourmandIngredientCatalog',formatVersion:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),catalog:current}));
   if(!confirm('La sauvegarde AVANT réparation est-elle bien présente dans Téléchargements ?\n\nOK = enregistrer les photos récupérées ; Annuler = ne rien modifier.'))return;
   status.textContent=`Enregistrement de ${added} photos en cours…`;await new Promise(r=>setTimeout(r,30));
   const serialized=JSON.stringify(updated);
   await hgQueue(()=>hgIdbPut(STORE,serialized));
   const verified=await new Promise((resolve,reject)=>{const tx=hgDb.transaction(HG_DB_STORE,'readonly'),req=tx.objectStore(HG_DB_STORE).get(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   if(verified!==serialized)throw new Error('Vérification de lecture IndexedDB échouée.');
   hgCache.set(STORE,serialized);catalog=updated.map(x=>normalizeItem(x));render();
   registerProtectedChange();markDirty();
   status.textContent=`✓ ${added} photos récupérées et vérifiées dans IndexedDB. ${ambiguous} correspondances ambiguës ignorées. Fais maintenant une sauvegarde du Catalogue.`;
   alert(`${added} photos récupérées et enregistrement vérifié. Les autres informations des articles sont inchangées.`);
  }catch(err){console.error(err);status.textContent='Échec de récupération : '+err.message;alert('Récupération interrompue : '+err.message)}
  finally{repairButton.disabled=false}
 });

})();;


/* v2.9.8.11.56 — Quatre encyclopédies, structure commune et fiches liées au Catalogue. */
(()=>{
 const labels={meat:'Viandes & Volailles',fish:'Poissons & Crustacés',condiments:'Condiments & Sauces',drinks:'Boissons & Cocktails'};
 const STORE='hg-encyclopedias-v1',CATALOG='hg-ingredient-catalog-v1',EXCLUDED='hg-encyclopedias-unlinked-v83';
 const SEED=[{"id":"sauce-teriyaki-maison-mset0slqaja","name":"Sauce Teriyaki maison","category":"Sauce","preparation":"Dans une casserole, mélanger la sauce soja, l'eau, le mirin, le sucre roux et le miel.\nAjouter l'ail écrasé et le gingembre râpé.\nPorter à ébullition, puis laisser mijoter 10 minutes à feu doux afin que les arômes se développent.\nRetirer l'ail et le gingembre si vous souhaitez une sauce lisse (facultatif).\nMélanger la fécule de maïs avec les 2 cuillères à soupe d'eau froide.\nVerser ce mélange dans la casserole en fouettant.\nPoursuivre la cuisson 1 à 2 minutes, jusqu'à ce que la sauce épaississe et devienne brillante.\nAjouter l'huile de sésame si désiré.\nLaisser refroidir avant de verser dans une bouteille ou un bocal propre.\nConservation : au réfrigérateur, jusqu'à 3 semaines dans un récipient hermétique.\nBien secouer avant chaque utilisation.\nUtilisation : Cette sauce est parfaite pour le poulet teriyaki, le saumon, les crevettes, le bœuf sauté, les légumes au wok ou les nouilles et le riz.","sourceRecipeId":"sauce-teriyaki-maison-mset0slqaja","photoId":"","ingredients":[["sauce soja",180,"ml"],["eau",120,"ml"],["mirin",60,"ml"],["sucre roux",2,"c. à soupe"],["miel",2,"c. à soupe"],["gousse d'ail",2,"u"],["gingembre frais",2,"cm"],["fécule de maïs",1,"c. à soupe"],["huile de sésame",1,"c. à café"]]},{"id":"huile-a-l-ail-et-au-piment-garlic-chili-oil-mserjq4a1nc","name":"Huile à l'ail et au piment (Garlic Chili Oil)","category":"Sauce","preparation":"Hacher finement l'ail.\nMélanger dans un bocal résistant à la chaleur : l'ail, les flocons de piment, le sucre, le sel et les graines de sésame.\nChauffer l'huile jusqu'à ce qu'elle soit très chaude (sans la faire fumer).\nVerser délicatement l'huile chaude sur le mélange.\nMélanger et laisser refroidir complètement.\nFermer le bocal et conserver au réfrigérateur.\nDélicieuse avec : des nouilles, du riz, des raviolis, des légumes sautés, des œufs ou pour relever une marinade.","sourceRecipeId":"huile-a-l-ail-et-au-piment-garlic-chili-oil-mserjq4a1nc","photoId":"","ingredients":[["gousse d'ail",12,"u"],["flocons de piment",4,"c. à soupe"],["graines de sésame",1,"c. à café"],["sucre",1,"c. à café"],["sel",1,"c. à café"],["huile neutre",250,"ml"]]},{"id":"sauce-chili-douce-sweet-chili-sauce-msercw7fo6y","name":"Sauce chili douce (Sweet Chili Sauce)","category":"Sauce","preparation":"Mixer les piments, l'ail et l'eau.\nVerser dans une casserole.\nAjouter le sucre, le vinaigre et le sel.\nPorter à ébullition puis laisser mijoter 10 à 15 minutes.\nMélanger la fécule avec les 2 cuillères à soupe d'eau.\nL'incorporer à la sauce en remuant jusqu'à épaississement.\nLaisser refroidir avant de verser dans une bouteille ou un bocal stérilisé.\nConservation : Au réfrigérateur pendant 2 à 3 semaines.","sourceRecipeId":"sauce-chili-douce-sweet-chili-sauce-msercw7fo6y","photoId":"","ingredients":[["piment rouge frais",6,"u"],["gousse d'ail",3,"u"],["eau",250,"ml"],["sucre",200,"g"],["vinaigre de riz (ou vinaigre blanc)",120,"ml"],["fécule de maïs",1,"c. à soupe"],["sel",1,"c. à café"]]},{"id":"vinaigrette-du-jardin-mrryzey5tfk","name":"Vinaigrette du jardin","category":"Sauce","preparation":"Mélanger le vinaigre, l'huile et le bouillon.\nAjouter les petits radis et les herbes, mélanger et assaisonner.","sourceRecipeId":"vinaigrette-du-jardin-mrryzey5tfk","photoId":"photo-1788101408156-9bgx700","ingredients":[["radis rouge",5,"u"],["persil",2,"c. à soupe"],["ciboulette",2,"c. à soupe"],["vinaigre aux herbes",0.75,"dl"],["huile d'olive",1,"dl"],["bouillon de légumes",0.5,"dl"],["aneth",2,"c. à soupe"],["sel",0,""],["poivre",0,""]]},{"id":"sauce-a-salade-asiatique-mrryzetmh71","name":"Sauce à salade asiatique","category":"Sauce","preparation":"Mettre tous les ingrédients dans un bol.\nMixer bien jusqu'à l'obtention d'une crème.\nPeut-être conserver 2-3 jours au frigo.","sourceRecipeId":"sauce-a-salade-asiatique-mrryzetmh71","photoId":"photo-1788101407748-1m7eog6","ingredients":[["vinaigre de riz",80,"g"],["sauce de soja",80,"g"],["huile de colza",60,"g"],["échalote",50,"g"],["carotte",50,"g"],["gousse d'ail",20,"g"],["sucre",10,"g"],["orange",1,"u"],["pomme",1,"u"],["sésame blanc",30,"g"]]},{"id":"pappa-al-pomodoro-mrryzelv781","name":"Pappa al pomodoro","category":"Sauce","preparation":"Tomates:\nRéaliser une incision en croix sous les tomates.\nRecouvrir d'eau bouillante.\nLaisser reposer 30 sec.\nPasser sous l'eau froide.\nPeler et couper en dés.\nOu utiliser des tomates pelées en boîte.\nFaire fondre le beurre, ajouter l'ail, faire revenir.\nAjouter les tomates et le basilic, faire revenir.\nMouiller avec le bouillon et porter à ébullition.\nAjouter le pain et le sucre.\nAssaisonner et laisser mijoter env. 20 min à couvert.\nServir la pappa al pomodoro.\nDécorer avec du basilic.\nServir avec du Sbrinz.","sourceRecipeId":"pappa-al-pomodoro-mrryzelv781","photoId":"photo-1788101407211-o8z9z73","ingredients":[["d'ail pressée",1,"gousse"],["boîte",700,"g tomates ou de tomates pelées en"],["haché",0.5,"bouquet basilic"],["bouillon",6,"dl"],["dés",100,"g pain de la veille coupé en"],["sucre",1,"c. à café"],["sel","",""],["poivre","",""],["basilic pour décorer","",""],["râpé",50,"g Sbrinz"]]},{"id":"feta-fouettee-mrryzeiehc3","name":"Féta fouettée","category":"Sauce","preparation":"Mettre tous les ingrédients dans un bol haut et mixer. Éventuellement ajouter un peu d'eau.","sourceRecipeId":"feta-fouettee-mrryzeiehc3","photoId":"photo-1788101407021-aglqctz","ingredients":[["Féta",200,"g"],["crème",100,"g fromage frais double"],["citron",2,"tsp jus de"],["eau",2,"c. à soupe"],["colza",1,"tbsp huile de"],["sel",0,""],["poivre",0,""]]},{"id":"bolognaise-aux-lentilles-mrryzefkzk0","name":"Bolognaise aux lentilles","category":"Sauce","preparation":"Tremper les champignons séchés dans de l'eau tiède.\nHacher finement l'oignon.\nCouper les carottes et le céleri en petits dés.\nFaire revenir l'oignon dans le beurre à rôtir chaud.\nAjouter les carottes, le céleri, l'ail pressé et le sucre.\nCuire à feu moyen.\nAjouter le concentré de tomates.\nChauffer brièvement.\nMouiller avec le vin rouge ou le bouillon.\nAjouter les tomates pelées, les lentilles, les champignons avec l'eau de trempage, le bouillon restant et la feuille de laurier.\nPorter à ébullition.\nAssaisonner.\nCouvrir et laisser mijoter 40-50 min à feu doux jusqu'à ce que les lentilles soient cuites.\nRetirer la feuille de laurier.","sourceRecipeId":"bolognaise-aux-lentilles-mrryzefkzk0","photoId":"photo-1788101406818-fxx69te","ingredients":[["oignon",1,"u"],["beurre à rôtir",0,""],["carotte",200,"g"],["céleri-rave",150,"g"],["gousse d'ail",2,""],["sucre",1,"c. à café"],["concentré de tomates",2,"c. à soupe"],["vin rouge",0.5,"dl"],["tomate pelée",400,"g"],["lentille verte",230,"g"],["champignon séché",2,"c. à soupe"],["bouillon",3,"dl"],["laurier",1,"feuille"],["sel",0,""],["poivre",0,""]]}];
 const fields={category:'hgEncyFieldCategory',part:'hgEncyPart',season:'hgEncySeason',uses:'hgEncyUses',pairings:'hgEncyPairings',preparation:'hgEncyPreparation',conservation:'hgEncyConservation',description:'hgEncyDescription',benefits:'hgEncyBenefits',benefitPairings:'hgEncyBenefitPairings',notes:'hgEncyNotes',raw:'hgEncyRaw',cooked:'hgEncyCooked',freezable:'hgEncyFreezable',origin:'hgEncyOrigin',latinName:'hgEncyLatin',availability:'hgEncyAvailability',intensity:'hgEncyIntensity',forms:'hgEncyForms',flavor:'hgEncyFlavor',quantity:'hgEncyQuantity',substitution:'hgEncySubstitution',avoid:'hgEncyAvoid',whereToBuy:'hgEncyWhere',recipeIdeas:'hgEncyRecipeIdeas',chefTip:'hgEncyChefTip'};
 const names={category:'Catégorie',part:'Partie utilisée',season:'Saison',uses:'Utilisations culinaires',pairings:'À associer avec',preparation:'Modes de préparation',conservation:'Conservation',description:'Description',benefits:'Bienfaits / caractéristiques',benefitPairings:'Associations renforçant les bienfaits',notes:'Remarques',origin:'Origine',latinName:'Nom latin',availability:'Disponibilité',intensity:'Intensité',forms:'Formes',flavor:'Profil gustatif',quantity:'Quantité indicative',substitution:'Substitution',avoid:'Erreur à éviter',whereToBuy:'Où acheter',recipeIdeas:'Idées de recettes',chefTip:'Astuce du chef'};
 let active='condiments',chosen=null,editing=null,db={meat:[],fish:[],condiments:[],drinks:[]};
 const get=id=>document.getElementById(id), clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 let condimentMode='products';
 function exclusions(){try{return JSON.parse(hgGet(EXCLUDED)||'{}')}catch{return {}}}
 function excluded(kind,id){return !!exclusions()[kind]?.includes(id)}
 function exclude(kind,id){const all=exclusions();all[kind]=[...new Set([...(all[kind]||[]),id])];hgSet(EXCLUDED,JSON.stringify(all));registerProtectedChange();markDirty()}
 function unexclude(kind,id){const all=exclusions();all[kind]=(all[kind]||[]).filter(v=>v!==id);hgSet(EXCLUDED,JSON.stringify(all))}
 const isSauce=r=>clean(r.category)==='sauce';
 const productSauces=()=>catalog().filter(x=>clean(x.group)==='sauces');
 const preparationSauces=()=>recipes.filter(isSauce);
 function showMode(){const bar=get('hgCondimentModes');if(bar)bar.hidden=active!=='condiments';get('hgEncyAdd').hidden=false;const a=get('hgCondimentProducts'),b=get('hgCondimentPreparations');if(a){a.classList.toggle('primary',condimentMode==='products');b.classList.toggle('primary',condimentMode==='preparations')}}
 function sourceItems(){
  if(active==='drinks'){
   // Le Catalogue reste la source des produits; compléter uniquement l'affichage.
   // Aucune écriture ni création automatique dans les données sauvegardées.
   const saved=Array.isArray(db.drinks)?db.drinks:[];
   const drinksCatalog=catalog().filter(c=>!excluded('drinks',c.id)).filter(c=>/^(jus de fruits|boissons|sirops|cocktails|jus)$/i.test(String(c.group||'').trim())||/boissons|jus/i.test(String(c.aisle||'')));
   const linked=drinksCatalog.map(c=>{
    const existing=saved.find(v=>v.catalogId===c.id||v.catalogueId===c.id||clean(v.name)===clean(c.name));
    return {...existing,id:existing?.id||'catalog:'+c.id,name:c.name,category:c.group||existing?.category||'Boissons',catalogId:c.id,catalogue:c};
   });
   return [...linked,...saved.filter(v=>!excluded('drinks',v.catalogId||v.catalogueId||v.id.replace(/^catalog:/,''))&&!linked.some(x=>x.id===v.id||clean(x.name)===clean(v.name)))];
  }
  if(active!=='condiments')return db[active];
  if(condimentMode==='preparations')return preparationSauces().map(r=>({id:'recipe:'+r.id,name:r.title,category:'Sauce',recipe:r}));
  // v77 : les associations explicites priment sur la catégorie du Catalogue.
  // Une fiche liée à Condiments & Sauces reste visible même si son produit
  // est classé, par exemple, dans « Produits laitiers ».
  const allCatalog=catalog(), saved=Array.isArray(db.condiments)?db.condiments:[];
  const linked=allCatalog.filter(c=>!excluded('condiments',c.id)&&(clean(c.group)==='sauces'||saved.some(v=>v.catalogId===c.id||v.catalogueId===c.id||v.id==='catalog:'+c.id)))
   .map(c=>{const existing=saved.find(v=>v.catalogId===c.id||v.catalogueId===c.id||v.id==='catalog:'+c.id);
    return {...existing,id:existing?.id||'catalog:'+c.id,name:c.name,category:c.group||existing?.category||'Sauces',catalogId:c.id,catalogue:c};});
  return [...linked,...saved.filter(v=>!excluded('condiments',v.catalogId||v.catalogueId||v.id.replace(/^catalog:/,''))&&!linked.some(x=>x.id===v.id||(v.catalogId&&x.catalogId===v.catalogId)))];
 }
 function showPreparation(r){chosen='recipe:'+r.id;showRecipe(r.id,'hgEncyclopedia');}

 function catalog(){try{return JSON.parse(hgGet(CATALOG)||'[]')}catch{return []}}
 function init(){try{const x=JSON.parse(hgGet(STORE)||'null');if(x&&typeof x==='object')for(const k of Object.keys(labels))if(Array.isArray(x[k]))db[k]=x[k]}catch(e){console.error('Encyclopédies',e)}
  if(!hgGet(STORE)){db.condiments=SEED.map(x=>({...x,needsCatalogLink:!catalog().some(c=>clean(c.name)===clean(x.name))}));hgSet(STORE,JSON.stringify(db));}
 }
 // v70 : retrait unique des anciennes fiches locales de Condiments & Sauces.
 // Les produits du Catalogue et les recettes originales ne sont jamais effacés.
 const CLEANUP_KEY='hg-condiments-legacy-cleanup-2981170';
 function clearLegacyCondiments(){
  if(hgGet(CLEANUP_KEY))return;
  const old=db.condiments;
  if(!Array.isArray(old))return;
  try{
   if(old.length){
    const backupKey='hg-condiments-legacy-backup-2981170';
    hgSet(backupKey,JSON.stringify(old));
    if(hgGet(backupKey)!==JSON.stringify(old))return;
    db.condiments=[];
    hgSet(STORE,JSON.stringify(db));
    if(JSON.parse(hgGet(STORE)||'{}').condiments?.length!==0)return;
    registerProtectedChange();markDirty();
   }
   hgSet(CLEANUP_KEY,'done');
  }catch(e){console.error('Nettoyage anciennes sauces',e)}
 }
 function save(){hgSet(STORE,JSON.stringify(db));registerProtectedChange();markDirty()}
 function item(){return sourceItems().find(x=>x.id===chosen)}
 function back(){switchView('hgEncyclopedia',{top:true})}
 function open(k){active=k;chosen=null;get('hgEncySearch').value='';get('hgEncyCategory').value='';get('hgEncyTitle').textContent=labels[k];if(k==='condiments')condimentMode='products';showMode();render();switchView('hgEncyclopedia',{top:true})}
 function render(){const q=clean(get('hgEncySearch').value),sel=get('hgEncyCategory'),prev=sel.value;
  const cats=[...new Set(sourceItems().map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  sel.innerHTML='<option value="">Toutes les catégories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');sel.value=cats.includes(prev)?prev:'';
  const filtered=sourceItems().filter(x=>(!sel.value||x.category===sel.value)&&(!q||clean(Object.values(x).filter(v=>typeof v==='string').join(' ')).includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  get('hgEncyCount').textContent=`${filtered.length} fiche${filtered.length>1?'s':''} · ${sourceItems().length} au total`;
  get('hgEncyList').innerHTML=filtered.map(x=>{const c=x.catalogue||catalog().find(v=>v.id===(x.catalogId||x.catalogueId));const photo=x.image||x.photo||c?.image||'';const summary=x.description||x.uses||x.preparation||'';const meta=[x.part,x.season,x.availability].filter(Boolean).join(' · ');const pills=[x.conservation,x.forms,x.flavor].filter(Boolean);return `<button type="button" class="hg-ency-card" data-id="${esc(x.id)}"><div class="hg-ency-card-main"><div class="hg-ency-card-heading"><strong>${esc(x.name)}</strong><small>${esc([x.category,meta].filter(Boolean).join(' · '))}</small></div>${summary?`<p>${esc(summary.length>130?summary.slice(0,127)+'…':summary)}</p>`:''}${pills.length?`<div class="hg-ency-pills">${pills.map(v=>`<span>${esc(v)}</span>`).join('')}</div>`:''}</div>${photo?`<img src="${esc(photo)}" alt="" loading="lazy">`:''}</button>`}).join('')||'<p class="muted">Aucune fiche.</p>';
  get('hgEncyList').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>detail(b.dataset.id));
 }
 function detail(id){chosen=id;const x=item();if(!x)return;if(x.recipe)return showPreparation(x.recipe);get('hgEncyEdit').hidden=false;get('hgEncyDeleteDetail').hidden=!!x.recipe;get('hgEncyDeleteDetail').textContent=(x.catalogId||x.catalogueId||x.catalogue||x.id.startsWith('catalog:'))?'Dissocier':'Supprimer';const sections=Object.entries(names).filter(([k])=>k!=='category'&&x[k]).map(([k,n])=>`<section class="hg-ency-block"><h3>${esc(n)}</h3><p style="white-space:pre-wrap">${esc(x[k])}</p></section>`).join('');
  const catalogInfo=x.catalogue?`<section class="hg-ency-block"><h3>Produit du Catalogue</h3><p>Catégorie : ${esc(x.catalogue.group||'Sauces')} · Rayon : ${esc(x.catalogue.aisle||'Non renseigné')}</p>${x.catalogue.image?`<img src="${x.catalogue.image}" alt="" style="max-width:180px;max-height:160px;object-fit:contain;border-radius:10px">`:''}<p class="muted">Complète les informations avec Modifier. La fiche du Catalogue reste inchangée.</p></section>`:'';
  const linkedCatalog=x.catalogue||catalog().find(c=>(x.catalogId&&c.id===x.catalogId)||(x.catalogueId&&c.id===x.catalogueId)||clean(c.name)===clean(x.name));
 const sharedPhoto=(x.image||x.photo||linkedCatalog?.image||'');
 const sharedPhotoHtml=sharedPhoto&&!x.catalogue?`<img src="${sharedPhoto}" alt="Photo de ${esc(x.name)}" style="max-width:180px;max-height:160px;object-fit:contain;border-radius:10px">`:'';
 const ingredients=Array.isArray(x.ingredients)&&x.ingredients.length?`<section class="hg-ency-block"><h3>Ingrédients de la recette source</h3><p>${x.ingredients.map(i=>esc(Array.isArray(i)?i.filter(v=>v!==null&&v!=='').join(' '):String(i))).join(' · ')}</p></section>`:'';
  get('hgEncyDetailContent').innerHTML=`<h2>${esc(x.name)}</h2><p class="muted">${esc(x.category||'')}${x.needsCatalogLink?' · Nom à relier au Catalogue':''}</p>${sharedPhotoHtml}${catalogInfo}${sections}${ingredients}${x.sourceRecipeId?'<p class="muted">Recette originale conservée dans Recettes.</p>':''}`;
  switchView('hgEncyclopediaDetail',{top:true})
 }
 // v78 : catégories dynamiques, reprise de la catégorie du Catalogue et « Autre… ».
 function refreshEncyCategoryChoices(){
  const list=get('hgEncyCategorySuggestions');if(!list)return;
  const values=[...new Set(sourceItems().map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  list.innerHTML=values.map(v=>`<option value="${esc(v)}"></option>`).join('')+'<option value="Autre…"></option>';
 }
 const categoryField=get('hgEncyFieldCategory');
 categoryField?.addEventListener('change',()=>{
  if(categoryField.value!=='Autre…')return;
  const v=prompt('Nouvelle catégorie :','')?.trim();categoryField.value=v||'';
 });
 get('hgEncyName')?.addEventListener('change',()=>{
  const c=catalog().find(x=>x.name===get('hgEncyName').value);
  if(c&&categoryField)categoryField.value=c.group||'';
 });
 function options(current){const all=catalog().sort((a,b)=>a.name.localeCompare(b.name,'fr'));const values=all.map(x=>x.name);if(current&&!values.some(x=>clean(x)===clean(current)))values.unshift(current);return values.map(n=>`<option value="${esc(n)}">${esc(n)}${n===current&&!all.some(x=>clean(x.name)===clean(current))?' (à relier)':''}</option>`).join('')}
 function edit(id=null){if(active==='condiments'&&id?.startsWith('recipe:'))return openRecipe(id.slice(7));editing=id;const x=id?(db[active].find(v=>v.id===id)||sourceItems().find(v=>v.id===id)):null;get('hgEncyDialogTitle').textContent=x?'Modifier la fiche':'Nouvelle fiche';get('hgEncyName').value=x?.name||'';get('hgEncyNameSuggestions').innerHTML=options(x?.name||'');
  for(const [k,field] of Object.entries(fields)){const el=get(field);if(!el)continue;if(el.type==='checkbox')el.checked=!!x?.[k];else el.value=x?.[k]||''}
  refreshEncyCategoryChoices();const selected=catalog().find(c=>clean(c.name)===clean(get('hgEncyName').value));if(selected&&categoryField)categoryField.value=selected.group||'';
  updateFreezing();get('hgEncyDelete').hidden=!x;get('hgEncyDelete').textContent=(x&&(x.catalogId||x.catalogueId||x.catalogue||x.id.startsWith('catalog:')))?'Dissocier':'Supprimer la fiche';get('hgEncyDialog').showModal();
 }
 const freeze=get('hgEncyFreezable'),raw=get('hgEncyRaw'),cooked=get('hgEncyCooked');
 function updateFreezing(){raw.disabled=cooked.disabled=!freeze.checked;if(!freeze.checked){raw.checked=false;cooked.checked=false}}
 freeze.addEventListener('change',updateFreezing);
 get('hgEncyForm').addEventListener('submit',e=>{e.preventDefault();const name=get('hgEncyName').value.trim();if(!name)return;const c=catalog(),match=c.find(x=>clean(x.name)===clean(name));if(!match&&!editing&&confirm(`Voulez-vous également ajouter « ${name} » au Catalogue ?`)){window.hgEncyCatalogReturn=()=>{get('hgEncyForm').requestSubmit()};window.dispatchEvent(new CustomEvent('hg:open-catalog-create',{detail:{name}}));return;}
  const x=editing?(db[active].find(y=>y.id===editing)||sourceItems().find(y=>y.id===editing)):{id:'ency-'+Date.now()+'-'+Math.random().toString(36).slice(2,6)};
  if(db[active].some(y=>y!==x&&clean(y.name)===clean(name)))return alert('Une fiche porte déjà ce nom dans cette encyclopédie.');
  x.name=name;x.needsCatalogLink=!match;
  updateFreezing();
  for(const [k,field] of Object.entries(fields)){const el=get(field);if(!el)continue;x[k]=el.type==='checkbox'?el.checked:el.value.trim()}
  if(match){x.category=match.group||'';x.catalogId=match.id;unexclude(active,match.id);}if(x.catalogue){delete x.catalogue;}if(!db[active].some(v=>v.id===x.id))db[active].push(x);save();get('hgEncyDialog').close();render();detail(x.id)
 });
 function deleteEncyclopediaItem(id){const x=sourceItems().find(v=>v.id===id);if(!x||x.recipe)return;const linked=!!(x.catalogId||x.catalogueId||x.catalogue||x.id.startsWith('catalog:'));const catalogId=x.catalogId||x.catalogueId||x.catalogue?.id||(x.id.startsWith('catalog:')?x.id.slice(8):'');const question=linked?`Dissocier « ${x.name} » de ${labels[active]} ?\nLe produit du Catalogue et les recettes seront conservés.`:`Supprimer la fiche « ${x.name} » de ${labels[active]} ?\nLe Catalogue et les recettes seront conservés.`;if(!confirm(question))return;if(linked&&catalogId)exclude(active,catalogId);db[active]=db[active].filter(v=>v.id!==x.id&&(!catalogId||v.catalogId!==catalogId));save();get('hgEncyDialog').close();chosen=null;editing=null;render();back()}
 get('hgEncyDelete').onclick=()=>{if(editing)deleteEncyclopediaItem(editing)};
 get('hgEncyDeleteDetail').onclick=()=>{if(chosen)deleteEncyclopediaItem(chosen)};
 get('hgEncyClose').onclick=get('hgEncyCancel').onclick=()=>get('hgEncyDialog').close();
 get('hgEncyBack').onclick=()=>switchView('library',{top:true});get('hgEncyDetailBack').onclick=back;
 get('hgEncyAdd').onclick=()=>{if(active==='condiments'&&condimentMode==='preparations'){openRecipe();ensureSelectValue(document.getElementById('recipeCategory'),'Sauce');document.getElementById('recipeCategory').value='Sauce';}else edit()};get('hgEncyEdit').onclick=()=>edit(chosen);
 get('hgCondimentProducts').onclick=()=>{condimentMode='products';chosen=null;showMode();render()};
 get('hgCondimentPreparations').onclick=()=>{condimentMode='preparations';chosen=null;showMode();render()};
 get('hgEncySearch').oninput=render;get('hgEncyCategory').onchange=render;get('hgEncyClearFilters').onclick=()=>{get('hgEncySearch').value='';get('hgEncyCategory').value='';render()};
 get('hgEncyPrint').onclick=()=>{const x=item();if(x)printDocument(x.name,`<h1>${esc(x.name)}</h1>`+get('hgEncyDetailContent').innerHTML)};
 get('hgEncyPrintList').onclick=()=>{const rows=[...get('hgEncyList').querySelectorAll('[data-id]')].map(b=>sourceItems().find(x=>x.id===b.dataset.id)).filter(Boolean);if(!rows.length)return alert('Aucune fiche à imprimer.');printDocument(labels[active],`<h1>${esc(labels[active])}</h1><p>${rows.length} fiche(s)</p>`+rows.map(x=>`<div class="day"><h2>${esc(x.name)}</h2><p>${esc(x.category||'')}</p><p>${esc(x.uses||x.description||'')}</p></div>`).join(''))};
 document.querySelectorAll('[data-encyclopedia]').forEach(b=>b.onclick=()=>open(b.dataset.encyclopedia));
 window.addEventListener('hg:encyclopedia-edit-target',e=>{const {kind,id}=e.detail||{};if(!labels[kind])return;open(kind);edit(id);window.hgMarkEncyPending?.('hgEncyDialog');});
 window.addEventListener('hg:encyclopedia-linked',e=>{if(labels[e.detail?.kind]){try{const latest=JSON.parse(hgGet(STORE)||'{}');if(Array.isArray(latest[e.detail.kind]))db[e.detail.kind]=latest[e.detail.kind]}catch(err){console.error(err)}}});
 window.addEventListener('hg:storage-ready',()=>{init();clearLegacyCondiments();});
 // Les associations sont chargées depuis les données persistées, sans injection spécifique.

})();

/* v2.9.8.11.75 — référencement volontaire Catalogue → Encyclopédies.
   Les données du Catalogue ne sont jamais réécrites par cette opération. */
function hgAssociateFromCatalog(article,ask=true,chosenKind=null){if(!article?.id)return;
 if(ask){
  // Boîte de dialogue interne : libellés explicites « Non » et « Oui ».
  const dialog=document.createElement('dialog');
  dialog.setAttribute('aria-label','Association à une encyclopédie');
  dialog.style.cssText='border:0;border-radius:16px;padding:0;max-width:min(440px,calc(100vw - 32px));width:100%;box-shadow:0 16px 50px #0004;color:#20382a;background:#fffdf7';
  const panel=document.createElement('div');panel.style.cssText='padding:22px;display:flex;flex-direction:column;gap:18px';
  const question=document.createElement('p');question.style.cssText='margin:0;font-size:1.1rem;line-height:1.5';
  question.textContent=`Voulez-vous également intégrer « ${article.name} » dans une encyclopédie ?`;
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;gap:10px';
  const no=document.createElement('button');no.type='button';no.textContent='Non';
  const yes=document.createElement('button');yes.type='button';yes.textContent='Oui';yes.className='primary';
  const close=()=>{if(dialog.open)dialog.close();dialog.remove()};
  no.addEventListener('click',close);
  yes.addEventListener('click',()=>{close();hgAssociateFromCatalog(article,false,chosenKind)});
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  actions.append(no,yes);panel.append(question,actions);dialog.append(panel);document.body.append(dialog);
  dialog.showModal();return;
 }
 const choices=[['produce','Fruits & Légumes'],['herbs','Plantes & Épices'],['meat','Viandes & Volailles'],['fish','Poissons & Crustacés'],['condiments','Condiments & Sauces'],['drinks','Boissons & Cocktails']];
 const answer=chosenKind===null?prompt('Dans quelle encyclopédie ?\n'+choices.map((c,i)=>`${i+1}. ${c[1]}`).join('\n')+'\n\nIndiquez un numéro (Annuler = plus tard) :'):null;
 if(chosenKind===null&&answer===null)return;
 const choice=chosenKind!==null?choices.find(c=>c[0]===chosenKind):choices[Number(answer)-1];if(!choice){alert('Choix non reconnu : aucune fiche créée.');return;}
 const [kind,label]=choice;
 const normName=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const store=kind==='produce'?'hg-fruits-vegetables-v282':kind==='herbs'?'hg-herbs-spices-v28':'hg-encyclopedias-v1';
 let saved;try{saved=JSON.parse(hgGet(store)||'null')}catch{saved=null}
 const isGeneral=!['produce','herbs'].includes(kind);
 if(isGeneral){if(!saved||typeof saved!=='object'||Array.isArray(saved)){alert('Données de l’encyclopédie indisponibles : aucune modification.');return;}if(!Array.isArray(saved[kind]))saved[kind]=[];}
 else if(!Array.isArray(saved)){alert('Encyclopédie non chargée : aucune modification.');return;}
 const rows=isGeneral?saved[kind]:saved;
 // Une association retirée auparavant peut être rétablie explicitement.
 if(isGeneral){try{const excluded=JSON.parse(hgGet('hg-encyclopedias-unlinked-v83')||'{}');if(Array.isArray(excluded[kind])){excluded[kind]=excluded[kind].filter(id=>id!==article.id);hgSet('hg-encyclopedias-unlinked-v83',JSON.stringify(excluded));}}catch(e){console.error(e)}}
 let item=rows.find(x=>x.catalogId===article.id||x.catalogueId===article.id||normName(x.name)===normName(article.name));
 const existed=!!item;
 if(!item){
  item={id:isGeneral?'catalog:'+article.id:'catalog-'+article.id,name:article.name,catalogId:article.id};
  if(kind==='produce')item.catalogCategory=article.group||'';
  else if(kind==='herbs')item.catalogCategory=article.group||'';
  else item.category=article.group||'';
  rows.push(item);
 }else if(!item.catalogId){item.catalogId=article.id;}
 try{hgSet(store,JSON.stringify(saved));if(kind==='produce')produceItems=saved;else if(kind==='herbs')herbs=saved;window.dispatchEvent(new CustomEvent('hg:encyclopedia-linked',{detail:{kind}}));registerProtectedChange();markDirty()}catch(e){console.error(e);alert('Impossible d’enregistrer le lien : vérifiez votre sauvegarde.');return;}
 // Ouvrir directement la fiche, sans troisième confirmation.
 const openEditor=()=>{
  if(kind==='produce'){renderProduceFilters();renderProduce();openProduceEditor(item.id);window.hgMarkEncyPending?.('produceDialog');}
  else if(kind==='herbs'){renderHerbFilters();renderHerbs();openHerbEditor(item.id);window.hgMarkEncyPending?.('herbDialog');}
  else {window.dispatchEvent(new CustomEvent('hg:encyclopedia-edit-target',{detail:{kind,id:item.id}}));}
 };
 openEditor();
}
/* v85 — associations consultables et modifiables sans toucher au Catalogue. */
const HG_ASSOC_CHOICES=[['produce','Fruits & Légumes'],['herbs','Plantes & Épices'],['meat','Viandes & Volailles'],['fish','Poissons & Crustacés'],['condiments','Condiments & Sauces'],['drinks','Boissons & Cocktails']];
function hgAssocRead(key,fallback){try{return JSON.parse(hgGet(key)||'null')||fallback}catch{return fallback}}
function hgCatalogAssociations(article){
 const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const all=hgAssocRead('hg-encyclopedias-v1',{}), ex=hgAssocRead('hg-encyclopedias-unlinked-v83',{});
 const cat=article.group||'',aisle=article.aisle||'';
 return HG_ASSOC_CHOICES.filter(([kind])=>{
  const rows=kind==='produce'?hgAssocRead('hg-fruits-vegetables-v282',[]):kind==='herbs'?hgAssocRead('hg-herbs-spices-v28',[]):all[kind]||[];
  const linked=Array.isArray(rows)&&rows.some(x=>x.catalogId===article.id||x.catalogueId===article.id||x.id==='catalog:'+article.id||x.id==='catalog-'+article.id);
  const implicit=kind==='condiments'&&norm(cat)==='sauces'||kind==='drinks'&&(/^(jus de fruits|boissons|sirops|cocktails|jus)$/i.test(cat.trim())||/boissons|jus/i.test(aisle));
  return (linked||implicit)&&!(ex[kind]||[]).includes(article.id);
 }).map(([kind])=>kind);
}
function hgCatalogAssociationLabel(article){const kinds=hgCatalogAssociations(article);if(!kinds.length)return 'Associer';if(kinds.length>1)return `${kinds.length} encyclopédies`;return HG_ASSOC_CHOICES.find(([k])=>k===kinds[0])[1]}
function hgOpenCatalogAssociations(article){
 if(!article?.id)return;
 let dialog=document.getElementById('hgCatalogAssociationsDialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='hgCatalogAssociationsDialog';dialog.style.cssText='border:1px solid #d7d4c9;border-radius:16px;padding:20px;max-width:min(94vw,480px);width:100%;background:#f6f1e6;color:#24372b';document.body.append(dialog)}
 const escText=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const draw=()=>{const selected=hgCatalogAssociations(article);dialog.innerHTML=`<h2 style="margin:0 0 8px;font-size:1.35rem">Associations — ${escText(article.name)}</h2><p style="margin:0 0 12px">Cocher pour associer, décocher pour dissocier.</p><div style="display:grid;gap:12px">${HG_ASSOC_CHOICES.map(([kind,label])=>`<label style="display:flex;align-items:center;gap:12px;cursor:pointer"><input type="checkbox" data-assoc-kind="${kind}" ${selected.includes(kind)?'checked':''} style="width:20px;height:20px"><span>${label}</span></label>`).join('')}</div><div style="display:flex;justify-content:flex-end;margin-top:18px"><button type="button" data-assoc-close>Fermer</button></div>`;
 dialog.querySelector('[data-assoc-close]').onclick=()=>dialog.close();
 dialog.querySelectorAll('[data-assoc-kind]').forEach(box=>box.onchange=()=>{
  const kind=box.dataset.assocKind;
  if(box.checked){dialog.close();hgAssociateFromCatalog(article,false,kind);window.dispatchEvent(new Event('hg:catalog-associations-changed'));return}
  if(!confirm(`Dissocier « ${article.name} » de « ${HG_ASSOC_CHOICES.find(([k])=>k===kind)[1]} » ?\nLe produit du Catalogue sera conservé.`)){draw();return}
  if(!hgDissociateCatalog(article,kind)){draw();return}
  window.dispatchEvent(new Event('hg:catalog-associations-changed'));draw();
 });};draw();dialog.showModal();
}
function hgDissociateCatalog(article,kind){
 const key=kind==='produce'?'hg-fruits-vegetables-v282':kind==='herbs'?'hg-herbs-spices-v28':'hg-encyclopedias-v1';
 const saved=hgAssocRead(key,kind==='produce'||kind==='herbs'?[]:{});
 const rows=kind==='produce'||kind==='herbs'?saved:saved[kind];
 if(!Array.isArray(rows)){alert('Encyclopédie indisponible : association inchangée.');return false}
 const found=rows.filter(x=>x.catalogId===article.id||x.catalogueId===article.id||x.id==='catalog:'+article.id||x.id==='catalog-'+article.id);
 // Une fiche renseignée doit rester intacte : on retire seulement son lien.
 for(const x of found){delete x.catalogId;delete x.catalogueId;if(x.id==='catalog:'+article.id||x.id==='catalog-'+article.id)x.id='ency-'+kind+'-'+article.id;}
 // Pour les deux encyclopédies alimentées automatiquement, l'exclusion empêche le retour du produit.
 const ex=hgAssocRead('hg-encyclopedias-unlinked-v83',{});ex[kind]=[...new Set([...(ex[kind]||[]),article.id])];
 try{hgSet(key,JSON.stringify(saved));hgSet('hg-encyclopedias-unlinked-v83',JSON.stringify(ex));registerProtectedChange();markDirty();window.dispatchEvent(new CustomEvent('hg:encyclopedia-linked',{detail:{kind}}));return true}catch(e){console.error(e);alert('Dissociation impossible : aucune modification confirmée.');return false}
}
window.addEventListener('hg:catalog-created',event=>hgAssociateFromCatalog(event.detail,true));
window.addEventListener('hg:catalog-associate',event=>hgOpenCatalogAssociations(event.detail));

/* v2.9.8.11.59 — bouton de retour unique, commun aux six encyclopédies et au Catalogue */
(()=>{const b=document.getElementById('hgLibraryFloatingBack');if(b)b.addEventListener('click',()=>switchView('library',{top:true}));})();

/* v2.9.8.11.82 — protection des saisies des six encyclopédies. */
(()=>{
 const pairs=[['produceDialog','produceForm'],['herbDialog','herbForm'],['hgEncyDialog','hgEncyForm']];
 const initial=new WeakMap(),pending=new WeakSet(),allowClose=new WeakSet();
 const snapshot=form=>Array.from(form.querySelectorAll('input,select,textarea')).map(x=>JSON.stringify([x.id||x.name,x.type==='checkbox'?x.checked:x.value])).join('|');
 const changed=(dialog,form)=>pending.has(dialog)||snapshot(form)!==initial.get(dialog);
 function attempt(dialog,form){
  if(!changed(dialog,form)){allowClose.add(dialog);dialog.close();return;}
  const save=confirm('Vous n’avez pas encore enregistré votre saisie.\n\nOK : continuer la saisie pour enregistrer.\nAnnuler : choisir de quitter sans enregistrer.');
  if(save)return;
  if(!confirm('Quitter sans enregistrer les modifications de cette fiche ?\nLe produit enregistré dans le Catalogue est conservé.'))return;
  pending.delete(dialog);allowClose.add(dialog);dialog.close();
 }
 window.hgMarkEncyPending=id=>{const d=document.getElementById(id);if(d?.open)pending.add(d)};
 for(const [did,fid] of pairs){
  const d=document.getElementById(did),f=document.getElementById(fid);if(!d||!f)continue;
  new MutationObserver(()=>{if(d.open){initial.set(f,snapshot(f));allowClose.delete(d)}else{pending.delete(d)}}).observe(d,{attributes:true,attributeFilter:['open']});
  d.addEventListener('cancel',e=>{e.preventDefault();attempt(d,f)});
  d.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
   if(t.type==='submit'||/supprimer/i.test(t.textContent||''))return;
   if(t.id===({produceDialog:'closeProduceDialog',herbDialog:'closeHerbDialog',hgEncyDialog:'hgEncyClose'}[did])||t.id==='hgEncyCancel'){
    e.preventDefault();e.stopImmediatePropagation();attempt(d,f);
   }
  },true);
  f.addEventListener('submit',()=>{pending.delete(d);allowClose.add(d)},true);
 }
})();


// v2.9.8.12.18 — Association non destructive des ingrédients au Catalogue.
(function(){
 const key='hg-ingredient-catalog-v1',get=id=>document.getElementById(id);
 const entries=()=>{try{return JSON.parse(hgGet(key)||'[]')}catch{return []}};
 const exact=name=>entries().filter(x=>norm(x.name)===norm(name));
 const valid=line=>{const p=String(line).split('/').map(x=>x.trim());return p.length===3&&!!p[0]&&!!p[1]&&!p[0].endsWith(':')};
 const lines=r=>(r.ingredients||[]).map((i,k)=>r.ingredientRawLines?.[k]||i.slice(0,3).join(' / '));
 window.hgRecipeCatalogName=(r,k,name)=>{const id=r.ingredientCatalogIds?.[k];return entries().find(x=>x.id===id)?.name||name};
 window.hgAutoLinkRecipeIngredients=()=>{const catalog=entries();for(const r of recipes){r.ingredientCatalogIds??=[];lines(r).forEach((line,k)=>{if(!valid(line))return;const name=line.split('/')[0].trim(),linked=catalog.find(x=>x.id===r.ingredientCatalogIds[k]);if(linked)return;const matches=catalog.filter(x=>norm(x.name)===norm(name));if(matches.length===1)r.ingredientCatalogIds[k]=matches[0].id})}};
 window.hgRecipeIngredientIssues=r=>{let malformed=0,unlinked=0;const catalog=entries();lines(r).forEach((line,k)=>{if(String(line).trim().endsWith(':'))return;if(!valid(line)){malformed++;return}const name=line.split('/')[0].trim(),id=r.ingredientCatalogIds?.[k];if(!catalog.some(x=>x.id===id)&&exact(name).length!==1)unlinked++});return [...(malformed?[`Structure ingrédients : ${malformed}`]:[]),...(unlinked?[`Ingrédients à associer : ${unlinked}`]:[])];};
 const area=get('recipeIngredients'),panel=get('hgRecipeIngredientPanel');if(!area||!panel)return;
 function refresh(){const raw=area.value.split('\n').map(x=>x.trim()).filter(Boolean);const catalog=entries();panel.innerHTML=raw.map((line,k)=>{if(line.endsWith(':'))return '';const parts=line.split('/').map(x=>x.trim());if(!valid(line))return `<div class="hg-ingredient-action"><small>⚠ Ligne ${k+1} : ordre Nom / quantité / unité à corriger</small></div>`;const name=parts[0],found=catalog.filter(x=>norm(x.name)===norm(name));const original=recipes.find(r=>r.id===get('recipeId').value),id=original?.ingredientCatalogIds?.[k],linked=catalog.find(x=>x.id===id);if(linked&&original?.ingredients?.[k]?.[0]===name)return '';if(found.length===1)return `<div class="hg-ingredient-action"><small>${esc(name)} → ${esc(found[0].name)}</small><button type="button" data-hg-link="${k}">Associer</button></div>`;return `<div class="hg-ingredient-action"><small>${esc(name)} ${found.length?'(plusieurs correspondances)':'(absent du Catalogue)'}</small><button type="button" data-hg-add="${k}">Ajouter au Catalogue</button></div>`}).join('');
 panel.querySelectorAll('[data-hg-link]').forEach(b=>b.onclick=()=>{const k=+b.dataset.hgLink;const line=raw[k],name=line.split('/')[0].trim(),match=exact(name);if(match.length!==1)return;const r=recipes.find(x=>x.id===get('recipeId').value);if(r&&r.ingredients?.[k]?.[0]===name){r.ingredientCatalogIds??=[];r.ingredientCatalogIds[k]=match[0].id;saveRecipes()}refresh()});
 panel.querySelectorAll('[data-hg-add]').forEach(b=>b.onclick=()=>{const k=+b.dataset.hgAdd,name=raw[k].split('/')[0].trim();const cb=window.hgEncyCatalogReturn;window.hgEncyCatalogReturn=created=>{window.hgEncyCatalogReturn=cb||null;const r=recipes.find(x=>x.id===get('recipeId').value);if(r&&r.ingredients?.[k]?.[0]===name){r.ingredientCatalogIds??=[];r.ingredientCatalogIds[k]=created.id;saveRecipes()}refresh()};window.dispatchEvent(new CustomEvent('hg:open-catalog-create',{detail:{name}}))});
 }
 area.addEventListener('input',refresh);window.hgRecipeIngredientRefresh=()=>setTimeout(refresh,0);
 window.addEventListener('hg:catalog-created',refresh);get('recipeDialog')?.addEventListener('close',()=>{panel.innerHTML=''});
})();

// Phase C v2.9.8.12.15 — lecture seule, aucun changement aux fiches.
// Critère unique : champs à sélection (simple ou multiple) vides.
(function(){
 const $p=id=>document.getElementById(id);
 const isEmpty=v=>v==null||String(v).trim()===''||v==='__new__'||v==='__other__'||Array.isArray(v)&&v.length===0;
 const specs=[
  ['Catalogue','catalog',()=>shoppingCatalogEntries(),[['Rayon','aisle'],['Catégorie','group']]],
  ['Recettes','recipe',()=>recipes,[['Catégorie','category'],['Type','type'],['Effort','effort'],['Difficulté','difficulty'],['Spécial','special'],['Température','temperature'],['Saison','season'],['Période','period']]],
  ['Producteurs','producer',()=>producers,[['Type','type'],['Région','region'],['Produits proposés','catalogLinks']]],
  ['Sorties','restaurant',()=>restaurants,[['Région','region'],['Lieu','city'],['Pays','country']]],
  ['Plantes & Épices','herb',()=>herbs,[['Catégorie botanique','family'],['Catégorie Catalogue','catalogCategory'],['Saison','season'],['Intensité','intensity'],['Formes','forms']]],
  ['Fruits & Légumes','produce',()=>produceItems,[['Catégorie botanique','category'],['Catégorie Catalogue','catalogCategory'],['Saison','season']]]
 ];
 let pending=[];
 function collect(){pending=[];for(const [module,kind,get,fields] of specs){let rows=[];try{rows=get()||[]}catch(e){console.warn('Suspens',module,e)}for(const item of rows){if(!item||!item.id&& !item.name)continue;const missing=fields.filter(([label,key])=>isEmpty(item[key])).map(x=>x[0]);if(kind==='recipe'&&window.hgRecipeIngredientIssues){const issues=window.hgRecipeIngredientIssues(item);if(issues.length)missing.push(...issues)}if(missing.length)pending.push({module,kind,id:String(item.id||''),name:String(item.title||item.name||'Sans nom'),missing})}}}
 function render(){collect();const module=$p('pendingModule'),search=$p('pendingSearch'),summary=$p('pendingSummary'),list=$p('pendingList');if(!list)return;const keep=module.value;module.innerHTML='<option value="">Toutes les rubriques</option>'+specs.map(([name])=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');module.value=keep;summary.innerHTML=specs.map(([name])=>{const n=pending.filter(x=>x.module===name).length;return `<button type="button" data-pending-module="${esc(name)}">${esc(name)} : ${n}</button>`}).join('');summary.querySelectorAll('[data-pending-module]').forEach(b=>b.onclick=()=>{module.value=b.dataset.pendingModule;renderList()});renderList()}
 function renderList(){const module=$p('pendingModule').value,q=norm($p('pendingSearch').value),list=$p('pendingList');const rows=pending.filter(x=>(!module||x.module===module)&&(!q||norm(x.name+' '+x.missing.join(' ')).includes(q)));$p('pendingCount').textContent=`${rows.length} fiche${rows.length!==1?'s':''} en suspens${module?' dans '+module:''} · ${pending.length} au total`;list.innerHTML=rows.map((x,i)=>`<div class="pending-row"><div class="pending-info"><strong>${esc(x.name)}</strong><small>${esc(x.module)} · ${esc(x.missing.join(', '))}</small></div><button type="button" data-pending-open="${i}">Ouvrir</button></div>`).join('')||'<div class="pending-empty">Aucune fiche en suspens pour cette recherche.</div>';list.querySelectorAll('[data-pending-open]').forEach(b=>b.onclick=()=>open(rows[Number(b.dataset.pendingOpen)]))}
 function open(x){if(!x)return;try{switch(x.kind){case 'recipe':openRecipe(x.id);break;case 'producer':openProducer(x.id);break;case 'restaurant':openRestaurant(x.id);break;case 'herb':openHerbEditor(x.id);break;case 'produce':openProduceEditor(x.id);break;case 'catalog':{switchView('ingredientCatalog');const input=$p('ingredientCatalogSearch');if(input){input.value=x.name;input.dispatchEvent(new Event('input',{bubbles:true}))}break}}}catch(e){console.error(e);alert('Ouverture indisponible pour cette fiche.')}}
 function printPending(){
  // Impression de la sélection courante, sans modifier aucune fiche.
  collect();const module=$p('pendingModule').value,q=norm($p('pendingSearch').value);
  const rows=pending.filter(x=>(!module||x.module===module)&&(!q||norm(x.name+' '+x.missing.join(' ')).includes(q)));
  if(!rows.length){alert('Aucune fiche en suspens à imprimer pour cette sélection.');return}
  const title='Fiches en suspens'+(module?' — '+module:'');
  const body=`<h1>${esc(title)}</h1><p>${rows.length} fiche${rows.length>1?'s':''} · ${esc(new Date().toLocaleDateString('fr-CH'))}</p><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th style="text-align:left;border-bottom:1px solid #555;padding:5px">Rubrique</th><th style="text-align:left;border-bottom:1px solid #555;padding:5px">Fiche</th><th style="text-align:left;border-bottom:1px solid #555;padding:5px">Champs manquants</th></tr></thead><tbody>${rows.map(x=>`<tr><td style="padding:4px;border-bottom:1px solid #ddd;vertical-align:top">${esc(x.module)}</td><td style="padding:4px;border-bottom:1px solid #ddd;vertical-align:top">${esc(x.name)}</td><td style="padding:4px;border-bottom:1px solid #ddd;vertical-align:top">${esc(x.missing.join(', '))}</td></tr>`).join('')}</tbody></table>`;
  printDocument(title,body);
 }
 $p('pendingPrint')?.addEventListener('click',printPending);
 $p('pendingRefresh')?.addEventListener('click',render);$p('pendingModule')?.addEventListener('change',renderList);$p('pendingSearch')?.addEventListener('input',renderList);
 document.querySelectorAll('nav button[data-view="more"], [data-go="more"]').forEach(b=>b.addEventListener('click',()=>setTimeout(render,0)));
 // Le tableau est recalculé lors de chaque retour à « Plus… » et sur Actualiser.
 window.hgRenderPending=render;
})();
