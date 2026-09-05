let recipes = [], plan = [], shopping = [], pendingImport = [];
let currentWeekStart = mondayISO(new Date()), viewedPlanItemId = null;
let selectionContext = null, viewedRecipeId = null, previousView = 'recipes', shoppingGroupMode = 'store';
const viewScrollPositions={home:0,recipes:0,planner:0,shopping:0,recipeView:0,restaurants:0,restaurantView:0,producers:0,producerView:0,herbs:0,herbView:0,produce:0,produceView:0};
const days = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const slots = ["Matin","Midi","Soir"];
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const recipeStore='hg-recipes-v271', planStore='hg-plan-v271', shoppingStore='hg-shopping-v271', slotStore='hg-day-slots-v271';
const shoppingAssignmentStore='hg-shopping-assignments-v251';
const APP_VERSION='2.9.8.11';
const mealTransferStore='hg-meal-transfers-v272', weekStore='hg-current-week-v272';
const weekSlotStore='hg-week-slots-v28', aisleOrderStore='hg-aisle-order-v28';
const mealNoteStore='hg-meal-notes-v294', shoppingStoreMemory='hg-shopping-stores-v294', leftoverAckStore='hg-leftover-notice-acks-v2977';
const BACKUP_META_KEY='hg-backup-meta-v26';
const EMERGENCY_BACKUP_KEY='hg-emergency-before-import-v26';
const CHANGE_COUNTER_KEY='hg-changes-since-backup-v26';
const LAST_DEVICE_ACTION_KEY='hg-last-device-action-v2952';
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
function savePlanData(){localStorage.setItem(planStore,JSON.stringify({version:4,weekStart:currentWeekStart,time:$('#planTime')?.value||'',items:plan.map(x=>({uid:x.uid||uid(),date:x.date,slot:x.slot,id:x.recipe.id,people:(Number(x.people)>=1&&Number(x.people)<=10?Number(x.people):null),role:x.role||'',notes:x.notes||'',preparePreviousDay:Boolean(x.preparePreviousDay),isLeftover:Boolean(x.isLeftover),leftoverSourceDate:x.leftoverSourceDate||'',leftoverPortions:Number(x.leftoverPortions)||0,leftoverIdea:x.leftoverIdea||''}))}));markDirty();if(activeViewId()==='planner')markSessionDirty('planner');}
function mealTransfers(){try{return JSON.parse(localStorage.getItem(mealTransferStore)||'{}')}catch{return{}}}
function saveMealTransfers(x){localStorage.setItem(mealTransferStore,JSON.stringify(x));markDirty()}
async function init(){
  setStartupStatus('Préparation de l’application…');
  currentWeekStart=mondayISO(new Date());
  localStorage.setItem(weekStore,currentWeekStart);
  setStartupStatus('Chargement de vos données partagées…');
  await autoLoadSharedBackup();
  migrateLegacyWeekSlots();
  renderDaySlotChoices();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=297163', {updateViaCache:'none'});
  setStartupStatus('Chargement de vos recettes…');
  const stored=JSON.parse(localStorage.getItem(recipeStore)||'null');
  if(stored) recipes=stored; else recipes=await fetch(`recipes.json?_=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());
  recipes=recipes.map(normalizeRecipe);
  fillCategories(); renderRecipes();
  setStartupStatus('Chargement du planning et des courses…');
  loadSaved();
  setStartupStatus('Chargement des sorties et producteurs…');
  await initRestaurants(); await initProducers();
  setStartupStatus('Chargement du Grand Herbier…');
  await initHerbs(); await initProduce();
  applyReadonlyMode(); checkForUpdate();
  finishStartup();
}
function saveRecipes(){localStorage.setItem(recipeStore,JSON.stringify(recipes));registerProtectedChange();markDirty();}
function activeViewId(){return document.querySelector('.view.active')?.id||'home'}
function rememberScroll(view=activeViewId()){viewScrollPositions[view]=scrollY}
function restoreScroll(view){requestAnimationFrame(()=>scrollTo(0,viewScrollPositions[view]||0))}
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
  if(from==='planner')shoppingReturnContext.weekStart=currentWeekStart;
  updateShoppingReturnButton();
}
function updateShoppingReturnButton(){
  const b=$('#returnToPlannerFromShopping');if(!b)return;
  b.classList.remove('hidden');
  b.textContent='← Retour';
  const source=shoppingReturnContext?.view;
  const labels={planner:'Planning',recipes:'Recettes',recipeView:'Recette',restaurants:'Sorties',restaurantView:'Sortie',producers:'Producteurs',producerView:'Producteur',herbs:'Plantes & Épices',herbView:'Plante / épice',produce:'Fruits & Légumes',produceView:'Fruit / légume',home:'Accueil'};
  b.title=source?`Retour à ${labels[source]||source}`:'Retour';
}
function returnFromShoppingContext(){
  const ctx=shoppingReturnContext?{...shoppingReturnContext}:null;
  shoppingReturnContext=null;updateShoppingReturnButton();
  selectionContext=null;updateSelectionBar();resetSessionDirty('shopping');
  if(!ctx){switchView('home');return}
  if(ctx.view==='planner'){
    currentWeekStart=ctx.weekStart||currentWeekStart;
    localStorage.setItem(weekStore,currentWeekStart);
    renderDaySlotChoices();renderPlan();
    viewScrollPositions.planner=Number(ctx.scrollY)||0;
    switchView('planner');
    requestAnimationFrame(()=>scrollTo(0,Number(ctx.scrollY)||0));
    return;
  }
  viewScrollPositions[ctx.view]=Number(ctx.scrollY)||0;
  switchView(ctx.view);
  requestAnimationFrame(()=>scrollTo(0,Number(ctx.scrollY)||0));
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
function openMainView(id){if(id==='planner'){currentWeekStart=mondayISO(new Date());localStorage.setItem(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan()}switchView(id);if(id==='planner'||id==='shopping')resetSessionDirty(id)}
$$('nav button').forEach(b=>b.onclick=()=>requestMainView(b.dataset.view));
$$('[data-go]').forEach(b=>b.onclick=()=>openMainView(b.dataset.go));
function slug(s){return (norm(s).replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'recette')+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
function normalizeRecipe(r){return {id:String(r.id||r.uid||slug(r.title||r.name||'recette')),title:r.title||r.name||'Recette sans titre',category:r.category||'Importée',time:Number(r.time)||0,servings:Number(r.servings)||4,ingredients:Array.isArray(r.ingredients)?r.ingredients:[],steps:Array.isArray(r.steps)?r.steps:[],avecViande:!!r.avecViande,type:r.type||(r.avecViande?'viande':''),effort:r.effort||'',difficulty:r.difficulty||'',special:r.special||'',temperature:r.temperature||'les-deux',season:r.season||'toute-annee',tags:Array.isArray(r.tags)?r.tags:[],source:r.source||'',notes:r.notes||'',paprikaUid:r.paprikaUid||r.uid||'',complementRecipeIds:Array.isArray(r.complementRecipeIds)?r.complementRecipeIds.map(String):[],complementText:r.complementText||'',leftoverIdeas:r.leftoverIdeas||'',cookedDates:Array.isArray(r.cookedDates)?[...new Set(r.cookedDates.filter(Boolean))]:[],favorite:Boolean(r.favorite),cookingComments:Array.isArray(r.cookingComments)?r.cookingComments.filter(x=>x&&x.text).map(x=>({date:x.date||'',text:String(x.text)})):[],photoId:String(r.photoId||'')};}
function recipeTypeLabel(v){return ({viande:'viande',poisson:'poisson',vegetarien:'végétarien',vegane:'végane'})[v]||'Type non défini'}
function recipeEffortLabel(v){return ({faible:'Effort faible',moyen:'Effort moyen',important:'Effort important'})[v]||'Effort non défini'}
function recipeDifficultyLabel(v){return ({facile:'facile',moyenne:'moyenne',difficile:'difficile',expert:'expert'})[v]||'non définie'}
function recipeSpecialLabel(v){return ({veille:'à préparer la veille'})[v]||'non défini'}
function recipeTemperatureLabel(v){return ({chaud:'chaud',froid:'froid','les-deux':'les deux'})[v]||'non définie'}
function recipeSeasonLabel(v){return ({'printemps':'printemps','ete':'été','automne':'automne','hiver':'hiver','toute-annee':'toute l’année'})[v]||'toute l’année'}
function recipeMetaMarkup(r){return `<span><b>Catégorie :</b> ${esc((r.category||'non définie').toLocaleLowerCase('fr-FR'))}</span> <span><b>Type :</b> ${esc(recipeTypeLabel(r.type).replace(/^Type /,''))}</span> <span><b>Effort :</b> ${esc(recipeEffortLabel(r.effort).replace(/^Effort /,''))}</span> <span><b>Difficulté :</b> ${esc(recipeDifficultyLabel(r.difficulty))}</span> <span><b>Température :</b> ${esc(recipeTemperatureLabel(r.temperature))}</span> <span><b>Saison :</b> ${esc(recipeSeasonLabel(r.season))}</span>`}
function recipeMetaTailMarkup(r,portions=r.servings){return `<span><b>Spécial :</b> ${esc(recipeSpecialLabel(r.special))}</span> <span><b>Portions :</b> ${esc(portions||r.servings||'—')}</span>`}
function isIntertitleText(value){return /:\s*$/.test(String(value||'').trim())}
function ingredientRowsMarkup(rows){return rows.map(x=>isIntertitleText(x.name)?`<li class="recipe-intertitle">${esc(x.name)}</li>`:`<li>${esc(x.text)}</li>`).join('')}
function stepRowsMarkup(steps){return steps.map(x=>isIntertitleText(x)?`<li class="recipe-intertitle">${esc(x)}</li>`:`<li>${esc(x)}</li>`).join('')}
function recipeTagValues(){const defaults=['rapide','végétarien','familial','été','hiver','festif'];return [...new Set([...defaults,...recipes.flatMap(r=>Array.isArray(r.tags)?r.tags:[]).map(x=>String(x||'').trim()).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))}
function fillRecipeTagSuggestions(){const dl=$('#tagSuggestions');if(!dl)return;dl.innerHTML=recipeTagValues().map(t=>`<option value="${esc(t)}"></option>`).join('')}
function fillCategories(){const cats=[...new Set(recipes.map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));const form=$('#recipeCategory'),current=form?.value||'';if(form){form.innerHTML='<option value="">Choisir…</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')+'<option value="__other__">Autre…</option>';if(cats.includes(current))form.value=current;}fillRecipeTagSuggestions();}
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
function recipeCard(r){const choose=selectionContext?`<button class="primary" data-choose="${esc(r.id)}">Choisir pour ${esc(dateLabel(selectionContext.date))} ${esc(selectionContext.slot.toLowerCase())}</button>`:'';return `<article class="recipe" data-recipe-open="${esc(r.id)}"><div class="recipe-head"><div class="meta recipe-meta-line">${recipeMetaMarkup(r)}</div><h3>${esc(r.title)}</h3><div class="recipe-tag-meta-row"><div class="badges">${(r.tags||[]).slice(0,5).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="meta recipe-meta-tail">${recipeMetaTailMarkup(r)}</div></div></div><div class="recipe-actions">${choose}<button data-edit="${esc(r.id)}">Modifier</button><button data-print-recipe="${esc(r.id)}">Imprimer</button></div></article>`;}
function renderRecipes(){const q=norm($('#search').value),cat=$('#category').value;const found=recipes.filter(r=>(!cat||norm(r.category).includes(norm(cat)))&&(!q||norm(JSON.stringify(r)).includes(q))).sort((a,b)=>a.title.localeCompare(b.title,'fr',{sensitivity:'base'}));$('#recipeCount').textContent=`${found.length} recette${found.length>1?'s':''}`;$('#recipeList').innerHTML=found.map(recipeCard).join('')||'<p>Aucune recette trouvée.</p>';bindRecipeCards($('#recipeList'));}
function bindRecipeCards(root=document){root.querySelectorAll('[data-recipe-open]').forEach(card=>card.onclick=e=>{if(e.target.closest('button'))return;showRecipe(card.dataset.recipeOpen,'recipes')});root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=e=>{e.stopPropagation();openRecipe(b.dataset.edit)});root.querySelectorAll('[data-print-recipe]').forEach(b=>b.onclick=e=>{e.stopPropagation();printRecipe(recipes.find(r=>r.id===b.dataset.printRecipe))});root.querySelectorAll('[data-choose]').forEach(b=>b.onclick=e=>{e.stopPropagation();chooseRecipeForPlan(b.dataset.choose)});}
$('#search').oninput=renderRecipes;$('#category').oninput=renderRecipes;
if($('#clearRecipeFilters'))$('#clearRecipeFilters').onclick=()=>{$('#search').value='';$('#category').value='';renderRecipes();};
$('#surpriseBtn').onclick=()=>{if(!recipes.length)return;const r=recipes[Math.floor(Math.random()*recipes.length)];$('#surpriseCard').innerHTML=recipeCard(r);bindRecipeCards($('#surpriseCard'));};
function updateSelectionBar(){const active=!!selectionContext;$('#recipeReturnBar').classList.toggle('hidden',!active);$('#selectionHint').textContent=active?`Choix pour ${dateLabel(selectionContext.date)} ${selectionContext.slot.toLowerCase()}`:'';renderRecipes();}
$('#returnPlanner').onclick=()=>{selectionContext=null;updateSelectionBar();switchView('planner')};
function startRecipeChoice(index,date=null,slot=null){
  const existing=Number.isInteger(index)&&plan[index];
  selectionContext={index:existing?index:null,date:existing?existing.date:date,slot:existing?existing.slot:slot};
  rememberScroll('planner');updateSelectionBar();switchView('recipes',{top:true});$('#search').focus();
}
function chooseRecipeForPlan(id){if(!selectionContext)return;const r=recipes.find(x=>x.id===id);if(!r)return;const ctx={...selectionContext};if(Number.isInteger(ctx.index)&&plan[ctx.index]){plan[ctx.index].recipe=r;plan[ctx.index].preparePreviousDay=r.special==='veille'}else plan.push({uid:uid(),date:ctx.date,slot:ctx.slot,recipe:r,people:mealPeople(ctx.date,ctx.slot)||null,role:'',preparePreviousDay:r.special==='veille'});selectionContext=null;savePlanData();renderPlan();updateSelectionBar();switchView('planner');}
function recipeSourceMarkup(source){if(!source)return '';try{const url=new URL(source);const host=url.hostname.replace(/^www\./,'');return `<p class="recipe-source muted">Source : <a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a></p>`;}catch{return `<p class="recipe-source muted">Source : ${esc(source)}</p>`;}}
function showRecipe(id,from=''){const r=recipes.find(x=>x.id===id);if(!r)return;if(from){rememberScroll(from);previousView=from}else if(!previousView)previousView='recipes';viewedRecipeId=id;$('#recipeViewContent').innerHTML=`<div class="recipe-title"><div class="meta recipe-meta-line">${recipeMetaMarkup(r)}</div><h2>${esc(r.title)}</h2><div class="recipe-tag-meta-row"><div class="badges">${(r.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="meta recipe-meta-tail">${recipeMetaTailMarkup(r)}</div></div>${recipeSourceMarkup(r.source)}</div><div class="recipe-columns"><section><h3>Ingrédients</h3><ul>${ingredientRowsMarkup(scaledIngredientRows(r,r.servings))}</ul></section><section><h3>Préparation</h3><ol>${stepRowsMarkup(r.steps)}</ol>${r.notes?`<h3>Notes</h3><p>${esc(r.notes).replace(/\n/g,'<br>')}</p>`:''}</section></div>${recipeMemoryMarkup(r)}`;switchView('recipeView');bindRecipeDetailLinks();}
$('#backFromRecipe').onclick=()=>switchView(previousView);$('#editViewedRecipe').onclick=()=>openRecipe(viewedRecipeId);$('#printViewedRecipe').onclick=()=>printRecipe(recipes.find(r=>r.id===viewedRecipeId));

function captureRecipeListState(){
  if(activeViewId()!=='recipes')return;
  recipeListState={
    search:$('#search')?.value||'',
    category:$('#category')?.value||'',
    scroll:viewScrollPositions.recipes||scrollY||0
  };
}
function restoreRecipeListState(){
  if(!recipeListState)return;
  if($('#search'))$('#search').value=recipeListState.search;
  if($('#category'))$('#category').value=recipeListState.category;
  viewScrollPositions.recipes=recipeListState.scroll||0;
}
function openRecipe(id){if(id)captureRecipeListState();const r=recipes.find(x=>x.id===id);$('#recipeDialogTitle').textContent=r?'Modifier la recette':'Nouvelle recette';$('#recipeId').value=r?.id||'';$('#recipeTitle').value=r?.title||'';$('#recipeCategory').value=r?.category||'';fillRecipeTagSuggestions();$('#recipeTags').value=(r?.tags||[]).join(', ');$('#recipeType').value=r?.type||(r?.avecViande?'viande':'');$('#recipeEffort').value=r?.effort||'';$('#recipeDifficulty').value=r?.difficulty||'';$('#recipeSpecial').value=r?.special||'';$('#recipeServings').value=r?.servings||4;$('#recipeTemperature').value=r?.temperature||'chaud';$('#recipeSeason').value=r?.season||'toute-annee';$('#recipeIngredients').value=(r?.ingredients||[]).map(i=>i.join(' / ')).join('\n');$('#recipeSteps').value=(r?.steps||[]).join('\n');$('#deleteRecipe').classList.toggle('hidden',!r);$('#duplicateRecipe').classList.toggle('hidden',!r);$('#recipeDialog').showModal();}
$('#newRecipe').onclick=()=>openRecipe();$('#closeRecipe').onclick=()=>$('#recipeDialog').close();

// v2.9.8.11 — import/export direct Excel .xlsx avec filtres intégrés
const RECIPE_TABLE_COLUMNS=[
  ['ID','id'],['Titre','title'],['Catégorie','category'],['Saison','season'],['Type','type'],
  ['Effort','effort'],['Difficulté','difficulty'],['Spécial','special'],['Température','temperature'],
  ['Portions','servings'],['Tags','tags']
];
const RECIPE_TABLE_ALLOWED={
  category:null,
  season:new Set(['toute-annee','printemps','ete','automne','hiver']),
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
    ws['!autofilter']={ref:`A1:K${Math.max(1,rows.length)}`};
    ws['!cols']=[{wch:26},{wch:42},{wch:28},{wch:18},{wch:16},{wch:14},{wch:16},{wch:24},{wch:18},{wch:10},{wch:32}];
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
function recipeTableSummary(a){const labels={category:'catégorie',season:'saison',type:'type',effort:'effort',difficulty:'difficulté',special:'spécial',temperature:'température',servings:'portions',tags:'tags'};const details=Object.entries(a.counts).map(([k,n])=>`${n} ${labels[k]||k}`).join(' · ')||'aucun champ modifié';return `<strong>${a.recognized} recettes reconnues</strong><br>${a.changes.length} recettes à mettre à jour · ${details}<br>${a.unchanged} sans changement · ${a.unknown} identifiants inconnus · ${a.invalid} lignes avec valeur invalide`}
if($('#exportRecipeTable'))$('#exportRecipeTable').onclick=exportRecipeTable;
if($('#recipeTableFile'))$('#recipeTableFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(!/\.xlsx$/i.test(f.name))throw new Error('Choisis un fichier Excel .xlsx.');const a=await analyzeRecipeTableFile(f);$('#recipeTableImportSummary').innerHTML=recipeTableSummary(a);$('#confirmRecipeTableImport').disabled=!a.changes.length;$('#recipeTableImportDialog').showModal()}catch(err){alert(`Import impossible : ${err.message}`)}finally{e.target.value=''}};
if($('#closeRecipeTableImport'))$('#closeRecipeTableImport').onclick=$('#cancelRecipeTableImport').onclick=()=>{$('#recipeTableImportDialog').close();pendingRecipeTableImport=null};
if($('#recipeTableImportForm'))$('#recipeTableImportForm').onsubmit=e=>{e.preventDefault();const a=pendingRecipeTableImport;if(!a?.changes?.length)return;for(const c of a.changes){const i=recipes.findIndex(r=>r.id===c.id);if(i>=0)recipes[i]=normalizeRecipe({...recipes[i],...c.patch})}plan.forEach(item=>{const fresh=recipes.find(r=>r.id===item.recipe?.id);if(fresh)item.recipe=fresh});saveRecipes();savePlanData();fillCategories();renderRecipes();renderPlan();invalidateShopping('Des critères de recettes ont été modifiés par le tableau Excel. Les ingrédients n’ont pas changé.');markDirty();$('#recipeTableImportDialog').close();const st=$('#recipeTableStatus');if(st){st.textContent=`Import Excel terminé : ${a.changes.length} recettes mises à jour. Ingrédients, préparation, photos et mémoire culinaire conservés.`;st.classList.remove('hidden')}pendingRecipeTableImport=null};

function parseNumber(v){const s=String(v??'').trim().replace(',','.').replace('½','.5').replace('¼','.25').replace('¾','.75');if(/^\d+\s+\d+\/\d+$/.test(s)){const [a,f]=s.split(/\s+/),[n,d]=f.split('/').map(Number);return Number(a)+n/d;}if(/^\d+\/\d+$/.test(s)){const [n,d]=s.split('/').map(Number);return n/d;}const n=Number(s);return Number.isFinite(n)?n:v;}
function formRecipe(newId=false){const ingredients=$('#recipeIngredients').value.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const [n,q='',u='']=line.split('/').map(x=>x.trim());return[n,parseNumber(q),u]});const existing=recipes.find(x=>x.id===$('#recipeId').value);return normalizeRecipe({id:newId||$('#recipeId').value||slug($('#recipeTitle').value),title:$('#recipeTitle').value.trim(),category:$('#recipeCategory').value.trim(),time:existing?.time||0,servings:+$('#recipeServings').value,temperature:$('#recipeTemperature').value,season:$('#recipeSeason').value||'toute-annee',avecViande:$('#recipeType').value==='viande',type:$('#recipeType').value,effort:$('#recipeEffort').value,difficulty:$('#recipeDifficulty').value,special:$('#recipeSpecial').value,ingredients,steps:$('#recipeSteps').value.split('\n').map(x=>x.trim()).filter(Boolean),tags:$('#recipeTags').value.split(',').map(x=>x.trim()).filter(Boolean),source:existing?.source||'',notes:existing?.notes||'',paprikaUid:existing?.paprikaUid||'',complementRecipeIds:existing?.complementRecipeIds||[],complementText:existing?.complementText||'',leftoverIdeas:existing?.leftoverIdeas||'',cookedDates:existing?.cookedDates||[],favorite:existing?.favorite||false,cookingComments:existing?.cookingComments||[],photoId:existing?.photoId||''});}
$('#recipeForm').onsubmit=e=>{e.preventDefault();const r=formRecipe();const i=recipes.findIndex(x=>x.id===r.id);if(i>=0)recipes[i]=r;else recipes.unshift(r);plan.forEach(item=>{if(item.recipe?.id===r.id)item.recipe=r});saveRecipes();savePlanData();fillCategories();restoreRecipeListState();keepScroll(renderRecipes,'recipes');renderPlan();invalidateShopping('Une recette a été modifiée : les affichages du planning sont à jour. Retransfère le repas dans les courses si les ingrédients ont changé.');$('#recipeDialog').close();if(viewedRecipeId===r.id){const pi=plan.findIndex(x=>x.uid===viewedPlanItemId);if(previousView==='planner'&&pi>=0)showPlanRecipe(pi,{rememberPlannerScroll:false});else showRecipe(r.id)}};
$('#deleteRecipe').onclick=()=>{const id=$('#recipeId').value;if(id&&confirm('Supprimer définitivement cette recette ?')){recipes=recipes.filter(r=>r.id!==id);plan=plan.filter(x=>x.recipe.id!==id);saveRecipes();fillCategories();keepScroll(renderRecipes,'recipes');renderPlan();invalidateShopping('Une recette du planning a été supprimée.');$('#recipeDialog').close();switchView('recipes')}};
$('#duplicateRecipe').onclick=()=>{const r=formRecipe(slug($('#recipeTitle').value));r.title+=' (copie)';r.cookedDates=[];r.favorite=false;r.cookingComments=[];recipes.unshift(r);saveRecipes();fillCategories();keepScroll(renderRecipes,'recipes');$('#recipeDialog').close();};

function defaultDaySlots(){return Object.fromEntries(days.map((_,i)=>[i,Object.fromEntries(slots.map(s=>[s,false]))]))}
function readWeekSlots(){try{return JSON.parse(localStorage.getItem(weekSlotStore)||'{}')||{}}catch{return{}}}
function migrateLegacyWeekSlots(){
  const map=readWeekSlots();
  if(Object.keys(map).length)return;
  try{const legacy=JSON.parse(localStorage.getItem(slotStore)||'null');if(legacy)map[currentWeekStart]={...defaultDaySlots(),...legacy}}catch{}
  localStorage.setItem(weekSlotStore,JSON.stringify(map));
}
function readDaySlots(){const map=readWeekSlots();return map[currentWeekStart]?{...defaultDaySlots(),...map[currentWeekStart]}:defaultDaySlots()}
function renderDaySlotChoices(){const state=readDaySlots();$('#daySlotChoices').innerHTML=days.map((day,i)=>`<div class="day-slot-row"><strong>${day}</strong>${slots.map(slot=>`<label class="mini-slot ${state[i]?.[slot]?'selected':''}"><input type="checkbox" data-day-slot="${i}" data-slot="${slot}" ${state[i]?.[slot]?'checked':''}><span>${slot}</span></label>`).join('')}</div>`).join('');$$('[data-day-slot]').forEach(c=>c.onchange=()=>{c.parentElement.classList.toggle('selected',c.checked);saveDaySlots();updateSlotStatus();renderPlan()});updateSlotStatus();}
function saveDaySlots(){const state=defaultDaySlots();$$('[data-day-slot]').forEach(c=>state[c.dataset.daySlot][c.dataset.slot]=c.checked);const map=readWeekSlots();map[currentWeekStart]=state;localStorage.setItem(weekSlotStore,JSON.stringify(map));markDirty();if(activeViewId()==='planner')markSessionDirty('planner');}
function selectedDaySlots(){return $$('[data-day-slot]:checked').map(c=>({date:addDaysISO(currentWeekStart,+c.dataset.daySlot),dayIndex:+c.dataset.daySlot,slot:c.dataset.slot}))}
function updateSlotStatus(){const n=selectedDaySlots().length;$('#selectedSlotsStatus').textContent=`${n} repas`;}
function calendarSeasonForDate(iso){const m=new Date(`${iso}T12:00:00`).getMonth()+1;return m>=3&&m<=5?'printemps':m>=6&&m<=8?'ete':m>=9&&m<=11?'automne':'hiver'}
function proposalChoices(date,exclude=[]){const season=calendarSeasonForDate(date);return recipes.filter(r=>!exclude.includes(r.id)&&norm(r.category).includes('plat principal')&&((r.season||'toute-annee')==='toute-annee'||r.season===season));}
function pickRandom(a){return a[Math.floor(Math.random()*a.length)]}
$('#generatePlan').onclick=()=>{const targets=selectedDaySlots();if(!targets.length)return alert('Choisis au moins un repas.');const used=[];let missing=0;targets.forEach(t=>{if(mealItems(t.date,t.slot).length)return;let pool=proposalChoices(t.date,used);if(!pool.length)pool=proposalChoices(t.date,[]);const recipe=pickRandom(pool);if(recipe){used.push(recipe.id);plan.push({uid:uid(),date:t.date,slot:t.slot,recipe,people:null,role:'',preparePreviousDay:recipe.special==='veille'})}else missing++});savePlanData();renderPlan();if(missing)alert(`${missing} repas n’a pas reçu de proposition : aucune recette « Plat principal » disponible pour la saison correspondante.`);};
function scaledIngredientRows(r,people=r.servings,overrides={}){const f=(Number(people)||r.servings)/(r.servings||4);return r.ingredients.map(([n,q,u],i)=>{const ov=overrides[i];const amount=ov!==undefined?ov:(typeof q==='number'?Math.round(q*f*100)/100:q||'');return{name:n,qty:amount,unit:u||'',text:`${n} : ${amount??''} ${u||''}`.trim()}})}
function scaledIngredients(r,people=null,overrides={}){const p=people||Number($('#people')?.value)||r.servings;return scaledIngredientRows(r,p,overrides).map(x=>x.text)}
function mealNotes(){try{return JSON.parse(localStorage.getItem(mealNoteStore)||'{}')||{}}catch{return{}}}
function mealNote(date,slot){return mealNotes()[mealKey(date,slot)]||''}
function setMealNote(date,slot,value){const all=mealNotes(),key=mealKey(date,slot),v=String(value||'').trim();if(v)all[key]=v;else delete all[key];localStorage.setItem(mealNoteStore,JSON.stringify(all));markDirty();if(activeViewId()==='planner')markSessionDirty('planner')}
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
function leftoverNoticeAcks(){try{return new Set(JSON.parse(localStorage.getItem(leftoverAckStore)||'[]')||[])}catch{return new Set()}}
function saveLeftoverNoticeAcks(set){localStorage.setItem(leftoverAckStore,JSON.stringify([...set]));markDirty()}
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
  if(changed){shopping=shopping.map(normalizeShoppingItem);localStorage.setItem(shoppingStore,JSON.stringify(shopping));}
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
  savePlanData();addLeftoverShoppingNotice(source.date,date,slot,r.title);currentWeekStart=mondayISO(new Date(`${date}T12:00:00`));localStorage.setItem(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan();
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
    return `<article class="day"><h3>${esc(dateLabel(date))}</h3>${prepMarkup}${visibleSlots.map(slot=>{
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
}
$('#prevWeek').onclick=()=>{currentWeekStart=addDaysISO(currentWeekStart,-7);localStorage.setItem(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan()};
$('#nextWeek').onclick=()=>{currentWeekStart=addDaysISO(currentWeekStart,7);localStorage.setItem(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan()};
$('#currentWeek').onclick=()=>{currentWeekStart=mondayISO(new Date());localStorage.setItem(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan()};
$('#clearPlan').onclick=()=>{if(confirm(`Vider uniquement le planning de la semaine ${weekLabel(currentWeekStart)} et remettre ses sélections à zéro ?`)){const dates=new Set(days.map((_,i)=>addDaysISO(currentWeekStart,i)));plan=plan.filter(x=>!dates.has(x.date));$$('[data-day-slot]').forEach(c=>{c.checked=false;c.parentElement.classList.remove('selected')});saveDaySlots();savePlanData();updateSlotStatus();renderPlan()}};
$('#savePlan').onclick=()=>{savePlanData();resetSessionDirty('planner');$('#planFreshness').textContent='Calendrier enregistré sur cet appareil.';$('#planFreshness').classList.remove('hidden')};
function invalidateShopping(message){$('#planFreshness').textContent=message;$('#planFreshness').classList.remove('hidden')}
function shoppingAssignments(){try{return JSON.parse(localStorage.getItem(shoppingAssignmentStore)||'{}')}catch{return{}}}
function normalizeShoppingItem(x={}){const pref=shoppingAssignments()[norm(x.name||x.ingredient)]||{};return{id:x.id||uid(),name:x.name||x.ingredient||'',qty:x.qty??x.quantite??0,text:x.text||'',unit:x.unit||x.unite||'',store:x.store||x.magasin||pref.store||'',aisle:x.aisle||x.rayon||pref.aisle||'',checked:Boolean(x.checked??x.coche),manual:Boolean(x.manual),origins:Array.isArray(x.origins)?x.origins:Array.isArray(x.sources)?x.sources:Array.isArray(x.origine)?x.origine:[],originRefs:Array.isArray(x.originRefs)?x.originRefs:[],leftoverNoticeKey:x.leftoverNoticeKey||'',photoId:String(x.photoId||'')}}
function rememberShoppingAssignments(){const saved=shoppingAssignments();shopping.forEach(x=>{if(x.name&&(x.store||x.aisle))saved[norm(x.name)]={store:x.store||'',aisle:x.aisle||''}});localStorage.setItem(shoppingAssignmentStore,JSON.stringify(saved))}
function shoppingMatchKey(value){return norm(String(value||'')).replace(/[\u00a0\u202f]/g,' ').replace(/[’‘`´ʼ']/g,'').replace(/[.،,;:()]/g,' ').replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim()}
function sameShoppingArticle(a,b){return shoppingMatchKey(a?.name)===shoppingMatchKey(b?.name)&&shoppingMatchKey(a?.unit)===shoppingMatchKey(b?.unit)}
function consolidateShopping(){const out=[];shopping.map(normalizeShoppingItem).forEach(x=>{if(x.manual){out.push(x);return}const hit=out.find(y=>!y.manual&&sameShoppingArticle(y,x));if(!hit){out.push(x);return}hit.qty=Math.round((Number(hit.qty||0)+Number(x.qty||0))*100)/100;hit.checked=Boolean(hit.checked&&x.checked);hit.origins=[...new Set([...(hit.origins||[]),...(x.origins||[])])];hit.originRefs=[...(hit.originRefs||[]),...(x.originRefs||[])].filter((v,i,a)=>a.findIndex(z=>z.recipeId===v.recipeId&&z.date===v.date&&z.slot===v.slot)===i);if(!hit.store&&x.store)hit.store=x.store;if(!hit.aisle&&x.aisle)hit.aisle=x.aisle});shopping=out}
function saveShopping(){shopping=shopping.map(normalizeShoppingItem);consolidateShopping();localStorage.setItem(shoppingStore,JSON.stringify(shopping));rememberShoppingAssignments();markDirty();if(activeViewId()==='shopping')markSessionDirty('shopping')}
function transferMealToShopping(date,slot){const items=mealItems(date,slot);if(!items.length)return alert('Ajoute d’abord une recette à ce repas.');if(!mealPeople(date,slot))return alert('Indique d’abord le nombre de portions pour ce repas.');const key=mealKey(date,slot),transfers=mealTransfers(),previous=transfers[key]||[];
  previous.forEach(old=>{const x=shopping.find(s=>!s.manual&&sameShoppingArticle(s,old));if(x&&typeof x.qty==='number')x.qty=Math.max(0,Math.round((x.qty-Number(old.qty||0))*100)/100)});
  shopping=shopping.filter(x=>x.manual||Number(x.qty)>0||x.text);
  const added=[];const prefs=shoppingAssignments();
  items.filter(m=>!m.isLeftover).forEach(m=>{const rows=scaledIngredientRows(m.recipe,m.people,m.qtyOverrides||{});rows.forEach(row=>{if(isIntertitleText(row.name))return;const q=Number(row.qty);if(!Number.isFinite(q)||q===0)return;let x=shopping.find(s=>!s.manual&&sameShoppingArticle(s,row));const pref=prefs[norm(row.name)]||{};if(!x){x=normalizeShoppingItem({name:row.name,qty:0,unit:row.unit,store:pref.store||'',aisle:pref.aisle||'',origins:[],originRefs:[]});shopping.push(x)}x.qty=Math.round((Number(x.qty||0)+q)*100)/100;const origin=`${dateLabel(date)} ${slot} · ${m.recipe.title}`;if(!x.origins.includes(origin))x.origins.push(origin);x.originRefs=x.originRefs||[];if(!x.originRefs.some(o=>o.recipeId===m.recipe.id&&o.date===date&&o.slot===slot))x.originRefs.push({recipeId:m.recipe.id,title:m.recipe.title,date,slot});added.push({name:row.name,unit:row.unit,qty:q})})});
  transfers[key]=added;saveMealTransfers(transfers);saveShopping();renderShopping();$('#planFreshness').textContent=`${dateLabel(date)} ${slot.toLowerCase()} transféré dans la liste des courses.`;$('#planFreshness').classList.remove('hidden');
  captureShoppingReturnContext('planner',{weekStart:currentWeekStart,scrollY:scrollY,date,slot});shoppingSessionDirty=false;switchView('shopping');
}
function aisleOrders(){try{return JSON.parse(localStorage.getItem(aisleOrderStore)||'{}')||{}}catch{return{}}}
function saveAisleOrders(value){localStorage.setItem(aisleOrderStore,JSON.stringify(value));markDirty()}
function aislesForStore(store){
  const existing=[...new Set(shopping.filter(x=>(x.store||'')===store).map(x=>x.aisle||'Rayon à définir'))];
  const saved=aisleOrders()[store]||[];
  return [...saved.filter(x=>existing.includes(x)),...existing.filter(x=>!saved.includes(x)).sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))];
}
function aisleRank(store,aisle){const list=aislesForStore(store);const i=list.indexOf(aisle||'Rayon à définir');return i<0?9999:i}
function renderAisleOrderEditor(){
  const stores=[...new Set(shopping.map(x=>x.store).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
  const select=$('#aisleOrderStore');select.innerHTML=stores.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')||'<option value="">Aucun magasin</option>';
  const render=()=>{const store=select.value,list=store?aislesForStore(store):[];$('#aisleOrderList').innerHTML=list.map((name,i)=>`<div class="aisle-order-row"><span>${esc(name)}</span><div><button type="button" data-aisle-up="${i}" ${i===0?'disabled':''}>↑</button><button type="button" data-aisle-down="${i}" ${i===list.length-1?'disabled':''}>↓</button></div></div>`).join('')||'<p class="muted">Aucun rayon enregistré pour ce magasin.</p>';$$('[data-aisle-up]').forEach(b=>b.onclick=()=>moveAisle(store,+b.dataset.aisleUp,-1));$$('[data-aisle-down]').forEach(b=>b.onclick=()=>moveAisle(store,+b.dataset.aisleDown,1));};
  function moveAisle(store,index,delta){const list=aislesForStore(store),target=index+delta;if(target<0||target>=list.length)return;[list[index],list[target]]=[list[target],list[index]];const all=aisleOrders();all[store]=list;saveAisleOrders(all);render();renderShopping()}
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
function shoppingRow(x){const amount=x.qty?`${Math.round(Number(x.qty)*100)/100} ${esc(x.unit)}`:x.text?`${esc(x.text)} ${esc(x.unit)}`:'';const aisle=x.aisle||'Rayon à définir',hasSource=sourceRecipeIdsForShopping(x).length>0;return `<div class="shop-item ${x.checked?'checked':''}" data-shopping-id="${esc(x.id)}"><input type="checkbox" data-shop-check="${esc(x.id)}" ${x.checked?'checked':''}><button class="shop-text" data-shopping-source="${esc(x.id)}"><span class="shop-main"><strong>${esc(x.name)}</strong>${amount?` <span>— ${amount}</span>`:''}${hasSource?' <small class="source-hint">· recette</small>':''}</span><span class="shop-aisle-badge">${esc(aisle)}</span></button><button class="shop-edit-button" data-edit-shopping="${esc(x.id)}" aria-label="Modifier l’article">Modifier</button></div>`}
function leftoverNoticeRow(x){return `<div class="leftover-notice-entry"><div class="leftover-notice-message">${esc(x.text)}</div><div class="leftover-notice-actions"><button type="button" data-leftover-add="${esc(x.leftoverNoticeKey)}">+ Ajouter un article</button><button type="button" class="primary" data-leftover-ack="${esc(x.leftoverNoticeKey)}">✓ Vu / Vérifié</button></div></div>`}
function renderStoreSubgroups(items){const store=items[0]?.store||'';return [...items].sort((a,b)=>(aisleRank(store,a.aisle||'Rayon à définir')-aisleRank(store,b.aisle||'Rayon à définir'))||(a.aisle||'zzz').localeCompare(b.aisle||'zzz','fr',{sensitivity:'base'})||a.name.localeCompare(b.name,'fr',{sensitivity:'base'})).map(shoppingRow).join('')}
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
function sortTextSelect(select){if(!select)return;const selected=select.value;const fixed=Array.from(select.options).filter(o=>o.value===''||o.value==='__other__');const text=Array.from(select.options).filter(o=>o.value!==''&&o.value!=='__other__').sort((a,b)=>a.textContent.localeCompare(b.textContent,'fr',{sensitivity:'base'}));select.replaceChildren(...fixed.filter(o=>o.value===''),...text,...fixed.filter(o=>o.value==='__other__'));if(Array.from(select.options).some(o=>o.value===selected))select.value=selected}function addSelectOption(select,value){if(value&&!Array.from(select.options).some(o=>o.value===value)){const option=document.createElement('option');option.value=value;option.textContent=value;select.insertBefore(option,select.querySelector('option[value="__other__"]'))}sortTextSelect(select)}function rememberedShoppingStores(){try{return JSON.parse(localStorage.getItem(shoppingStoreMemory)||'[]')||[]}catch{return[]}}function rememberShoppingStore(value){const v=String(value||'').trim();if(!v)return;const list=[...new Set([...rememberedShoppingStores(),v])].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));localStorage.setItem(shoppingStoreMemory,JSON.stringify(list))}function refreshShoppingSuggestions(){const assignmentStores=Object.values(shoppingAssignments()).map(x=>x.store).filter(Boolean),stores=[...new Set([...rememberedShoppingStores(),...assignmentStores,...shopping.map(x=>x.store).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'})),aisles=[...new Set(shopping.map(x=>x.aisle).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));stores.forEach(x=>addSelectOption($('#shoppingStore'),x));aisles.forEach(x=>addSelectOption($('#shoppingAisle'),x));sortTextSelect($('#shoppingStore'));sortTextSelect($('#shoppingAisle'))}function handleOtherSelect(select,label){if(select.value==='__other__'){const value=prompt(`Nouveau ${label} :`);if(value?.trim()){addSelectOption(select,value.trim());select.value=value.trim();if(label==='magasin')rememberShoppingStore(value.trim())}else select.value=''}}$('#shoppingStore').onchange=()=>handleOtherSelect($('#shoppingStore'),'magasin');$('#shoppingAisle').onchange=()=>handleOtherSelect($('#shoppingAisle'),'rayon');
function openShopping(id=''){const x=shopping.find(i=>i.id===id);$('#shoppingDialogTitle').textContent=x?'Modifier l’article':'Ajouter un article';$('#shoppingId').value=x?.id||'';$('#shoppingName').value=x?.name||'';$('#shoppingQty').value=x?.qty||x?.text||'';$('#shoppingUnit').value=x?.unit||'';addSelectOption($('#shoppingStore'),x?.store||'');addSelectOption($('#shoppingAisle'),x?.aisle||'');refreshShoppingSuggestions();$('#shoppingStore').value=x?.store||'';$('#shoppingAisle').value=x?.aisle||'';$('#deleteShopping').classList.toggle('hidden',!x);$('#shoppingOrigins').classList.toggle('hidden',!x?.origins?.length);$('#shoppingOrigins').innerHTML=x?.origins?.length?`<strong>Origine :</strong><br>${x.origins.map(esc).join('<br>')}`:'';$('#shoppingDialog').showModal()}
function addShopping(){openShopping()}
$('#shoppingForm').onsubmit=e=>{e.preventDefault();const id=$('#shoppingId').value,x=shopping.find(i=>i.id===id),raw=$('#shoppingQty').value.trim(),parsed=parseNumber(raw),item=normalizeShoppingItem({...(x||{}),id:id||uid(),name:$('#shoppingName').value.trim(),qty:typeof parsed==='number'?parsed:0,text:typeof parsed==='number'?'':raw,unit:$('#shoppingUnit').value.trim(),store:$('#shoppingStore').value.trim(),aisle:$('#shoppingAisle').value.trim(),manual:x?.manual??true,origins:x?.origins||['Ajout manuel']});if(x)Object.assign(x,item);else shopping.push(item);rememberShoppingStore(item.store);saveShopping();renderShopping();$('#shoppingDialog').close()};
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
  const replace=$('#replaceDuplicates').checked,importTag=`Import du ${new Date().toLocaleDateString('fr-CH')}`;pendingImport=pendingImport.map(r=>({...r,tags:[...new Set([...(r.tags||[]),importTag])]}));let added=0,replaced=0,ignored=0;pendingImport.forEach(r=>{const i=recipes.findIndex(x=>(r.paprikaUid&&x.paprikaUid===r.paprikaUid)||norm(x.title)===norm(r.title));if(i>=0){if(replace){r.id=recipes[i].id;recipes[i]=r;replaced++}else ignored++}else{recipes.unshift(r);added++}});saveRecipes();fillCategories();renderRecipes();$('#importDialog').close();alert(`Import terminé : ${added} ajoutée(s), ${replaced} remplacée(s), ${ignored} ignorée(s).`)};
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
function loadSaved(){try{const s=JSON.parse(localStorage.getItem(planStore)||localStorage.getItem('hg-plan-v26')||'null');if(s){currentWeekStart=s.weekStart||localStorage.getItem(weekStore)||mondayISO(new Date());plan=(s.items||[]).map(x=>{const date=x.date||addDaysISO(currentWeekStart,Number(x.dayIndex)||0);return{uid:x.uid||uid(),date,slot:x.slot,people:(Number(x.people)>=1&&Number(x.people)<=10?Number(x.people):(Number(s.people)>=1&&Number(s.people)<=10?Number(s.people):null)),role:x.role||'',notes:x.notes||'',preparePreviousDay:Boolean(x.preparePreviousDay),isLeftover:Boolean(x.isLeftover),leftoverSourceDate:x.leftoverSourceDate||'',leftoverPortions:Number(x.leftoverPortions)||0,leftoverIdea:x.leftoverIdea||'',recipe:recipes.find(r=>r.id===x.id)}}).filter(x=>x.recipe)}shopping=(JSON.parse(localStorage.getItem(shoppingStore)||localStorage.getItem('hg-shopping-v26')||localStorage.getItem('hg-shopping')||'[]')||[]).map(normalizeShoppingItem);consolidateShopping();localStorage.setItem(shoppingStore,JSON.stringify(shopping))}catch(e){console.error(e)}localStorage.setItem(weekStore,currentWeekStart);renderDaySlotChoices();renderPlan();renderShopping()}

// Sauvegarde et transfert entre appareils
let pendingDataImport = null;
function herbierStorageSnapshot(){
  const data={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key && key.startsWith('hg-') && key!==EMERGENCY_BACKUP_KEY) data[key]=localStorage.getItem(key);
  }
  // Garantit que les collections actuellement chargées figurent dans la sauvegarde.
  data[recipeStore]=JSON.stringify(recipes);
  if(typeof restaurants!=='undefined' && Array.isArray(restaurants)) data[restaurantStore]=JSON.stringify(restaurants);
  if(typeof producers!=='undefined' && Array.isArray(producers)) data[producerStore]=JSON.stringify(producers);
  if(typeof herbs!=='undefined' && Array.isArray(herbs)) data[herbStore]=JSON.stringify(herbs);
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
  const value=localStorage.getItem(LAST_DEVICE_ACTION_KEY);
  el.textContent=value?`Dernière action : ${value}`:'';
}
function rememberLastDeviceAction(kind,filename){
  if(!filename)return;
  localStorage.setItem(LAST_DEVICE_ACTION_KEY,`${kind} ${filename}`);
  renderLastDeviceAction();
}
renderLastDeviceAction();
function backupMeta(){try{return JSON.parse(localStorage.getItem(BACKUP_META_KEY)||'null')}catch{return null}}
function updateBackupReminder(){
  const el=$('#backupReminder');if(!el)return;
  const meta=backupMeta(),changes=Number(localStorage.getItem(CHANGE_COUNTER_KEY)||0);
  if(!meta){el.textContent='Conseil : crée une première sauvegarde et range-la dans ton dossier OneDrive.';return}
  const when=new Date(meta.at).toLocaleString('fr-FR');
  el.textContent=`Dernière sauvegarde : ${when}${changes?` · ${changes} modification${changes>1?'s':''} depuis`:''}.`;
}
function registerProtectedChange(){
  const n=Number(localStorage.getItem(CHANGE_COUNTER_KEY)||0)+1;
  localStorage.setItem(CHANGE_COUNTER_KEY,String(n));updateBackupReminder();
}
function markBackupCreated(filename){
  localStorage.setItem(BACKUP_META_KEY,JSON.stringify({at:new Date().toISOString(),filename}));
  localStorage.setItem(CHANGE_COUNTER_KEY,'0');clearDirty();updateBackupReminder();
}
function createEmergencyCheckpoint(reason='opération sensible'){
  const snapshot=herbierStorageSnapshot();
  const record={reason,createdAt:new Date().toISOString(),snapshot};
  localStorage.setItem(EMERGENCY_BACKUP_KEY,JSON.stringify(record));
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
    const currentHgKeys=[];
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('hg-')&&key!==EMERGENCY_BACKUP_KEY)currentHgKeys.push(key)}
    currentHgKeys.forEach(key=>localStorage.removeItem(key));
    Object.entries(pendingDataImport.data).forEach(([key,value])=>localStorage.setItem(key,value));
    if(window.hgMediaImport&&Array.isArray(pendingDataImport.media))await window.hgMediaImport(pendingDataImport.media);
    const importedName=pendingDataImport._filename||'sauvegarde importée';
    localStorage.setItem(BACKUP_META_KEY,JSON.stringify({at:pendingDataImport.exportedAt||new Date().toISOString(),filename:importedName}));
    localStorage.setItem(CHANGE_COUNTER_KEY,'0');
    localStorage.setItem(LAST_DEVICE_ACTION_KEY,`Import ${importedName}`);
    $('#dataImportDialog').close();
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
function githubConfig(){try{return {...inferredGithubConfig(),...JSON.parse(localStorage.getItem('hg-github-config-v27')||'{}')}}catch{return inferredGithubConfig()}}
async function autoLoadSharedBackup(){if(!READONLY)return;try{const r=await fetch(`herbier-latest.hgbak?_=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;const b=await r.json();if(b?.format!=='HerbierGourmandBackup'||!b.data)return;Object.entries(b.data).forEach(([k,v])=>{if(k.startsWith('hg-')&&typeof v==='string')localStorage.setItem(k,v)});sessionStorage.setItem('hg-readonly-loaded',b.exportedAt||'loaded');}catch(e){console.warn('Sauvegarde partagée indisponible',e)}}
function applyReadonlyMode(){if(!READONLY)return;document.body.classList.add('readonly-mode');document.querySelector('header p').textContent+=' · Lecture seule';['#newRecipe','#importPaprika','#exportRecipeTable','#newRestaurant','#newProducer','#newHerb','#newProduce','#savePlan','#buildShopping','#addShopping','#addShoppingBottom','#clearChecks','#removeChecked','#clearShopping','#exportData','#importData','#saveToGithub','#githubSettings','#manageAisles'].forEach(s=>{const e=$(s);if(e)e.classList.add('hidden')});$$('[data-edit],[data-edit-restaurant],#editViewedRecipe,#editViewedRestaurant,#editViewedProducer,#editViewedHerb,#editViewedProduce,.restaurant-card-edit,.producer-card-edit').forEach(e=>e.classList.add('hidden'));}
$('#openReadonly').onclick=()=>open(`${location.origin}${location.pathname}?readonly=1`,'_blank');
$('#githubSettings').onclick=()=>{const c=githubConfig();$('#githubOwner').value=c.owner;$('#githubRepo').value=c.repo;$('#githubBranch').value=c.branch;$('#githubPath').value=c.path;$('#githubToken').value=sessionStorage.getItem('hg-github-token-v27')||'';$('#githubDialog').showModal()};
$('#closeGithub').onclick=$('#cancelGithub').onclick=()=>$('#githubDialog').close();
$('#githubForm').onsubmit=e=>{e.preventDefault();const c={owner:$('#githubOwner').value.trim(),repo:$('#githubRepo').value.trim(),branch:$('#githubBranch').value.trim(),path:$('#githubPath').value.trim()};localStorage.setItem('hg-github-config-v27',JSON.stringify(c));sessionStorage.setItem('hg-github-token-v27',$('#githubToken').value.trim());$('#githubDialog').close();$('#githubStatus').textContent='Configuration enregistrée pour ce navigateur.'};
function bytesToBase64(text){return btoa(unescape(encodeURIComponent(text)))}
async function githubPutFile(path,text,message){const c=githubConfig(),token=sessionStorage.getItem('hg-github-token-v27');if(!c.owner||!c.repo||!token)throw new Error('Configuration GitHub ou jeton manquant');const url=`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(c.branch)}`;let sha='';const old=await fetch(url,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`}});if(old.ok)sha=(await old.json()).sha||'';else if(old.status!==404)throw new Error(`Lecture GitHub impossible (${old.status})`);const body={message,content:bytesToBase64(text),branch:c.branch,...(sha?{sha}:{})};const put=await fetch(url.split('?')[0],{method:'PUT',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!put.ok)throw new Error(`Enregistrement GitHub impossible (${put.status})`);return put.json();}
$('#saveToGithub').onclick=async()=>{try{const btn=$('#saveToGithub');btn.disabled=true;$('#githubStatus').textContent='Sauvegarde en cours…';const snap=herbierStorageSnapshot(),text=JSON.stringify(snap,null,2),c=githubConfig(),d=new Date(),pad=n=>String(n).padStart(2,'0'),dated=`backups/Herbier_Gourmand_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.hgbak`;await githubPutFile(c.path,text,`Herbier Gourmand : sauvegarde ${d.toLocaleString('fr-FR')}`);await githubPutFile(dated,text,`Herbier Gourmand : archive ${d.toLocaleString('fr-FR')}`);markBackupCreated(c.path);clearDirty();$('#githubStatus').textContent='Sauvegarde GitHub terminée. La version en lecture seule est à jour.';btn.disabled=false;}catch(e){console.error(e);$('#githubStatus').textContent=e.message;$('#saveToGithub').disabled=false;}};

function normalizeProducer(p={}){return {id:String(p.id||slug(p.name||'producteur')),name:String(p.name||'Producteur sans nom'),type:String(p.type||''),categories:Array.isArray(p.categories)?p.categories:[],region:String(p.region||''),city:String(p.city||''),address:String(p.address||''),postalCode:String(p.postalCode||''),country:String(p.country||'Suisse'),phone:String(p.phone||''),website:String(p.website||''),hours:String(p.hours||''),products:Array.isArray(p.products)?p.products:[],featuredProducts:Array.isArray(p.featuredProducts)?p.featuredProducts:[],salesModes:Array.isArray(p.salesModes)?p.salesModes:[],labels:Array.isArray(p.labels)?p.labels:[],tags:Array.isArray(p.tags)?p.tags:[],notes:String(p.notes||''),description:String(p.description||''),services:String(p.services||''),directSale:String(p.directSale||''),source:String(p.source||'')};}
function saveProducers(){localStorage.setItem(producerStore,JSON.stringify(producers));registerProtectedChange();markDirty()}
async function initProducers(){try{const stored=JSON.parse(localStorage.getItem(producerStore)||'null');if(stored)producers=stored;else{const r=await fetch(`producers.json?_=${Date.now()}`,{cache:'no-store'});producers=r.ok?await r.json():[];localStorage.setItem(producerStore,JSON.stringify(producers))}producers=producers.map(normalizeProducer);renderProducerFilters();refreshProducerCitySuggestions();renderProducers()}catch(e){console.error(e);producers=[];renderProducers()}}
function producerTerms(p){return [...new Set([...(p.products||[]),...(p.featuredProducts||[]),...(p.tags||[]),...(p.categories||[]),...(p.salesModes||[]),...(p.labels||[])].map(x=>String(x||'').trim()).filter(Boolean))]}
function producerTypes(p){return [...new Set([p.type,...(p.categories||[])].map(x=>String(x||'').trim()).filter(Boolean))]}
function producerValues(field){return [...new Set(producers.flatMap(p=>field==='tags'?producerTerms(p):field==='type'?producerTypes(p):[p[field]]).map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))}
function fillProducerSelect(id,values,label){const e=$(id),v=e.value;e.innerHTML=`<option value="">${label}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(values.includes(v))e.value=v}
function renderProducerFilters(){fillProducerSelect('#producerRegion',producerValues('region'),'Toutes les régions');fillProducerSelect('#producerCity',producerValues('city'),'Tous les lieux');fillProducerSelect('#producerType',producerValues('type'),'Tous les types');fillProducerSelect('#producerTag',producerValues('tags'),'Tous les produits')}
function filteredProducers(){const q=norm($('#producerSearch').value),region=$('#producerRegion').value,city=$('#producerCity').value,type=$('#producerType').value,tag=$('#producerTag').value;return producers.filter(p=>(!q||norm(JSON.stringify(p)).includes(q))&&(!region||p.region===region)&&(!city||p.city===city)&&(!type||producerTypes(p).includes(type))&&(!tag||producerTerms(p).includes(tag))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}))}
function producerCard(p){return `<article class="restaurant-card producer-card"><button class="restaurant-card-main" data-view-producer="${esc(p.id)}"><div class="meta">${esc([p.type,p.city,p.region].filter(Boolean).join(' · '))}</div><h3>${esc(p.name)}</h3><div class="badges">${producerTerms(p).slice(0,6).map(t=>`<span>${esc(t)}</span>`).join('')}</div></button><button class="restaurant-card-edit producer-card-edit" data-edit-producer="${esc(p.id)}">Modifier</button></article>`}
function renderProducers(){const list=filteredProducers();$('#producerCount').textContent=`${list.length} adresse${list.length>1?'s':''}`;$('#producerList').innerHTML=list.map(producerCard).join('')||'<p>Aucun producteur trouvé.</p>';$$('[data-view-producer]').forEach(b=>b.onclick=()=>showProducer(b.dataset.viewProducer,'producers'));$$('[data-edit-producer]').forEach(b=>b.onclick=()=>openProducer(b.dataset.editProducer));if(READONLY)applyReadonlyMode()}
['#producerSearch','#producerRegion','#producerCity','#producerType','#producerTag'].forEach(id=>{const e=$(id);e.addEventListener(e.tagName==='INPUT'?'input':'change',renderProducers)});$('#clearProducerFilters').onclick=()=>{$('#producerSearch').value='';$('#producerRegion').value='';$('#producerCity').value='';$('#producerType').value='';$('#producerTag').value='';renderProducers()};
function showProducer(id,from=''){const p=producers.find(x=>x.id===id);if(!p)return;if(from){rememberScroll(from);previousProducerView=from}else if(!previousProducerView)previousProducerView='producers';viewedProducerId=id;const rawAddress=String(p.address||'').trim(),addressNorm=norm(rawAddress),locality=[p.postalCode,p.city].filter(Boolean).join(' '),localityAlready=locality&&addressNorm.includes(norm(locality)),countryAlready=p.country&&addressNorm.includes(norm(p.country));const addressParts=[];if(rawAddress)addressParts.push(esc(rawAddress));if(locality&&!localityAlready)addressParts.push(esc(locality));if(p.country&&!countryAlready)addressParts.push(esc(p.country));const address=addressParts.join('<br>');$('#producerViewContent').innerHTML=`<div class="restaurant-detail-head"><div class="meta">${esc([p.type,p.region].filter(Boolean).join(' · '))}</div><h2>${esc(p.name)}</h2></div><div class="restaurant-detail-grid"><section><h3>Coordonnées</h3>${address?`<p>${address}</p>`:''}${p.phone?`<p><a href="tel:${esc(p.phone.replace(/\s/g,''))}">${esc(p.phone)}</a></p>`:''}${p.website?`<p>${linkMarkup(p.website,'Ouvrir le site internet')}</p>`:''}</section><section><h3>Horaires</h3><p>${p.hours?esc(p.hours).replace(/\n/g,'<br>'):'À compléter'}</p></section><section><h3>Produits proposés</h3><div class="badges">${producerTerms(p).map(t=>`<span>${esc(t)}</span>`).join('')||'À compléter'}</div></section><section><h3>Remarques</h3><p>${p.directSale?`<strong>Vente directe :</strong> ${esc(p.directSale)}<br>`:''}${p.notes?esc(p.notes).replace(/\n/g,'<br>'):'—'}</p></section></div>`;switchView('producerView')}
$('#backFromProducer').onclick=()=>switchView(previousProducerView);$('#editViewedProducer').onclick=()=>openProducer(viewedProducerId);
function openProducer(id){if(READONLY)return;const p=producers.find(x=>x.id===id);$('#producerDialogTitle').textContent=p?'Modifier le producteur':'Nouveau producteur';$('#producerId').value=p?.id||'';$('#producerName').value=p?.name||'';fillEditableSelect($('#producerTypeField'),producerValues('type'),p?.type||'','Choisir…');fillEditableSelect($('#producerRegionField'),producerValues('region'),p?.region||'','Choisir…');refreshProducerCitySuggestions();$('#producerCityField').value=p?.city||'';$('#producerAddress').value=p?.address||'';$('#producerPostal').value=p?.postalCode||'';$('#producerCountry').value=p?.country||'Suisse';$('#producerPhone').value=p?.phone||'';$('#producerWebsite').value=p?.website||'';$('#producerDirectSale').value=p?.directSale||'';$('#producerHours').value=p?.hours||'';$('#producerProducts').value=producerTerms(p||{}).join(', ');$('#producerNotes').value=p?.notes||'';$('#deleteProducer').classList.toggle('hidden',!p);$('#duplicateProducer').classList.toggle('hidden',!p);$('#producerDialog').showModal()}
$('#newProducer').onclick=()=>openProducer();$('#closeProducer').onclick=()=>$('#producerDialog').close();
function producerFromForm(newId=''){const old=producers.find(x=>x.id===$('#producerId').value),tags=$('#producerProducts').value.split(',').map(x=>x.trim()).filter(Boolean);return normalizeProducer({...old,id:newId||$('#producerId').value||slug($('#producerName').value),name:$('#producerName').value.trim(),type:$('#producerTypeField').value.trim(),region:$('#producerRegionField').value.trim(),city:$('#producerCityField').value.trim(),address:$('#producerAddress').value.trim(),postalCode:$('#producerPostal').value.trim(),country:$('#producerCountry').value.trim(),phone:$('#producerPhone').value.trim(),website:$('#producerWebsite').value.trim(),directSale:$('#producerDirectSale').value.trim(),hours:$('#producerHours').value.trim(),products:tags,tags:[],notes:$('#producerNotes').value.trim()})}
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
function closeTouchSuggestions(input){
  const box=input?._hgSuggestionBox;
  if(box){box.classList.remove('open');box.innerHTML=''}
}
function renderTouchSuggestions(input){
  if(!input)return;
  const values=datalistValuesForInput(input);
  if(!values.length){closeTouchSuggestions(input);return}
  const {query}=suggestionTokenInfo(input), q=norm(query);
  if(!q){closeTouchSuggestions(input);return}
  const matches=values.filter(v=>norm(v).startsWith(q)||norm(v).includes(q)).slice(0,8);
  if(!matches.length){closeTouchSuggestions(input);return}
  let box=input._hgSuggestionBox;
  if(!box){
    const wrap=document.createElement('div');wrap.className='hg-touch-choice-wrap';
    input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    box=document.createElement('div');box.className='hg-touch-choice-list';box.setAttribute('role','listbox');
    wrap.appendChild(box);input._hgSuggestionBox=box;
  }
  box.innerHTML=matches.map(v=>`<button type="button" role="option" data-hg-touch-choice="${esc(v)}">${esc(v)}</button>`).join('');
  box.classList.add('open');
  box.querySelectorAll('[data-hg-touch-choice]').forEach(btn=>btn.onclick=()=>applyTouchSuggestion(input,btn.dataset.hgTouchChoice));
}
function initTouchChoiceFields(){
  document.querySelectorAll('input[list]').forEach(input=>{
    if(input.dataset.hgTouchChoiceReady==='1')return;
    input.dataset.hgTouchChoiceReady='1';
    input.addEventListener('input',()=>renderTouchSuggestions(input));
    input.addEventListener('focus',()=>renderTouchSuggestions(input));
    input.addEventListener('keydown',e=>{
      const box=input._hgSuggestionBox, first=box?.querySelector('[data-hg-touch-choice]');
      if((e.key==='Enter'||e.key==='Tab')&&first&&box.classList.contains('open')){
        // Tab reste disponible sur notebook ; Entrée sert d'équivalent clavier/tactile.
        e.preventDefault();applyTouchSuggestion(input,first.dataset.hgTouchChoice);
      }else if(e.key==='Escape')closeTouchSuggestions(input);
    });
  });
}
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
function saveRestaurants(){localStorage.setItem(restaurantStore,JSON.stringify(restaurants));registerProtectedChange();markDirty();}
async function initRestaurants(){
  try{const stored=JSON.parse(localStorage.getItem(restaurantStore)||'null');if(stored)restaurants=stored;else{const res=await fetch(`restaurants.json?_=${Date.now()}`,{cache:'no-store'});restaurants=res.ok?await res.json():[];saveRestaurants();}restaurants=restaurants.map(normalizeRestaurant);renderRestaurantFilters();renderRestaurants();}
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
let herbs=[], herbKnowledge={accords:[],melanges:[],substitutions:[],techniques:[]}, viewedHerbId=null, previousHerbView='herbs';
function herbUnique(field){return [...new Set(herbs.map(h=>String(h[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));}
function refreshHerbEditorSelects(h={}){fillEditableSelect($('#herbEditFamily'),herbUnique('family'),h.family||'','Choisir…');fillEditableSelect($('#herbEditSeason'),herbUnique('season'),h.season||'','Choisir…');fillEditableSelect($('#herbEditIntensity'),herbUnique('intensity'),h.intensity||'','Choisir…');fillEditableSelect($('#herbEditForms'),herbUnique('forms'),h.forms||'','Choisir…');}
function fillHerbSelect(id,values,label){const e=$(id),v=e.value;e.innerHTML=`<option value="">${label}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(values.includes(v))e.value=v;}
function renderHerbFilters(){fillHerbSelect('#herbFamily',herbUnique('family'),'Toutes les familles');fillHerbSelect('#herbSeason',herbUnique('season'),'Toutes les saisons');fillHerbSelect('#herbIntensity',herbUnique('intensity'),'Toutes les intensités');}
const herbBenefits2984=[["Basilic","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Persil","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Ciboulette","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Coriandre (feuilles)","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Menthe poivrée","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Menthe verte","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Thym","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Romarin","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Origan","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Marjolaine","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Sauge","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Estragon","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Aneth","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Cerfeuil","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Laurier","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Sarriette","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Mélisse","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Verveine citronnée","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Hysope","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Livèche","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Fenouil (feuilles)","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Bourrache","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Capucine","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Oseille","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Ail des ours","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Shiso","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Culantro","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Citronnelle","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Feuille de curry","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Épazote","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Anis vert","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Badiane","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cumin","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Coriandre (graines)","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Fenugrec","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Carvi","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Nigelle","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Moutarde jaune","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Moutarde brune","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Graines de céleri","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Graines d'aneth","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Graines de pavot","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Sésame","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Ajowan","Fibres, minéraux et composés aromatiques variables","Soutient la diversité alimentaire; certaines graines contribuent aux apports en fibres et minéraux"],["Cardamome verte","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cardamome noire","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Poivre noir","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre blanc","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre vert","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre long","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Sichuan","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Baies roses","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Piment de la Jamaïque","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Baies de genièvre","Polyphénols et composés aromatiques variables","Contribue à la diversité des saveurs et à l'apport de composés végétaux"],["Sumac","Polyphénols, acides organiques","Antioxydants; apporte une acidité qui peut remplacer une partie du sel"],["Paprika doux","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Paprika fumé","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment de Cayenne","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment d'Espelette","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment ancho","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment chipotle","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment guajillo","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment d'Alep","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Piment oiseau","Capsaïcinoïdes (selon variété), caroténoïdes, vitamine E","Antioxydants; les variétés piquantes peuvent stimuler temporairement la thermogenèse"],["Curcuma","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Gingembre","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Galanga","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Zédoaire","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Raifort","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Wasabi","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Safran","Crocin, crocétine, safranal","Riche en composés antioxydants; utilisé en très petites quantités"],["Cannelle de Ceylan","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cannelle cassia","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Clou de girofle","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Noix de muscade","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Macis","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Vanille","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cacao non sucré","Flavanols, magnésium, fer","Antioxydants et apport minéral lorsqu'il est peu sucré"],["Réglisse","Glycyrrhizine et flavonoïdes","Usage traditionnel digestif; prudence en consommation importante ou régulière"],["Asafoetida","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Amchoor","Acides organiques, polyphénols, fibres variables","Saveur acidulée; contribue à aromatiser les plats avec moins de sel"],["Tamarin","Acides organiques, polyphénols, fibres variables","Saveur acidulée; contribue à aromatiser les plats avec moins de sel"],["Kokum","Acides organiques, polyphénols, fibres variables","Saveur acidulée; contribue à aromatiser les plats avec moins de sel"],["Achiote / roucou","Caroténoïdes, notamment bixine","Colorant naturel et apport antioxydant"],["Mahleb","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Mastic de Chios","Huiles essentielles et polyphénols aromatiques","Apport antioxydant et aromatique; utile pour parfumer sans excès de sucre"],["Cubèbe","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Maniguette","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Timut","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Kampot","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Tasmanie","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Selim","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Voatsiperifery","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Poivre de Penja","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Sansho","Composés aromatiques, polyphénols; pipérine pour certains poivres","Apporte des antioxydants et relève les plats, ce qui peut aider à réduire le sel"],["Lavande culinaire","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Rose (pétales)","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Fleur d'oranger","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Hibiscus","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Camomille","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Tilleul","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Myrte","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Feuille de figuier","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Feuille de combava","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Zeste de citron","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Zeste d'orange","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Zeste de combava","Huiles essentielles, flavonoïdes et composés citronnés","Apport aromatique et antioxydant; aide à parfumer sans ajouter beaucoup de sel ou sucre"],["Pandan","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Menthe chocolat","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Basilic thaï","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Basilic sacré (tulsi)","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Basilic citron","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Origan mexicain","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Thym citron","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Sauge ananas","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Estragon mexicain","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Ciboule","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Ail","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Échalote séchée","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Oignon séché","Composés soufrés ou phénoliques et huiles aromatiques","Apport antioxydant; traditionnellement associé au confort digestif"],["Angélique","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Anis hysope","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Mélilot","Polyphénols et composés aromatiques variables","Apport aromatique et antioxydant; usage traditionnel en cuisine ou infusion"],["Cerfeuil musqué","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Persil plat","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Persil frisé","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Menthe marocaine","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Menthe pomme","Huiles essentielles et polyphénols aromatiques","Traditionnellement utilisé en infusion pour le confort digestif et la détente"],["Sarriette d'hiver","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"],["Sarriette d'été","Polyphénols, composés aromatiques; vitamines variables selon la plante","Contribue à la diversité végétale et antioxydante; permet d'aromatiser avec moins de sel"]];
function herbBenefitMatchKey2984(value){return norm(String(value||'').replace(/\([^)]*\)/g,' ').replace(/[’']/g,' ').replace(/[-–—]/g,' ')).replace(/\s+/g,' ').trim();}
function applyHerbBenefits2984(items){
  const migrationKey='hg-migration-herb-benefits-2984';
  if(localStorage.getItem(migrationKey)==='1')return false;
  const byName=new Map();
  herbBenefits2984.forEach(([name,apports,bienfaits])=>{
    const full=norm(name), simple=herbBenefitMatchKey2984(name);
    byName.set(full,{apports,bienfaits}); if(simple&&!byName.has(simple))byName.set(simple,{apports,bienfaits});
  });
  let changed=0;
  items.forEach(h=>{const info=byName.get(norm(h.name))||byName.get(herbBenefitMatchKey2984(h.name));if(!info)return;h.benefits=`Apports : ${info.apports}\nBienfaits : ${info.bienfaits}`;changed++;});
  localStorage.setItem(migrationKey,'1');
  if(changed)localStorage.setItem(herbStore,JSON.stringify(items));
  console.info(`v2.9.8.4 — Bienfaits Plantes & Épices : ${changed} fiche(s) mise(s) à jour.`);
  return changed>0;
}
function normalizeHerb(h={}){return {...h,id:String(h.id||slug(h.name||'plante')),name:String(h.name||'Plante sans nom')};}
async function initHerbs(){
 try{
  const res=await fetch(`herbs-spices.json?_=${Date.now()}`,{cache:'no-store'}),payload=res.ok?await res.json():{herbs:[]};
  herbKnowledge={accords:payload.accords||[],melanges:payload.melanges||[],substitutions:payload.substitutions||[],techniques:payload.techniques||[]};
  const stored=JSON.parse(localStorage.getItem(herbStore)||'null');
  herbs=(stored&&stored.length?stored:payload.herbs||[]).map(normalizeHerb);
  if(!stored)localStorage.setItem(herbStore,JSON.stringify(herbs));
  applyHerbBenefits2984(herbs);
  renderHerbFilters();renderHerbs();
 }catch(e){console.error('Grand Herbier',e);herbs=[];renderHerbs();}
}
function herbFiltered(){const q=norm($('#herbSearch')?.value),family=$('#herbFamily')?.value||'',season=$('#herbSeason')?.value||'',intensity=$('#herbIntensity')?.value||'';return herbs.filter(h=>(!family||h.family===family)&&(!season||h.season===season)&&(!intensity||h.intensity===intensity)&&(!q||norm(Object.values(h).join(' ')).includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));}
function herbCard(h){return `<article class="herb-card"><button data-view-herb="${esc(h.id)}"><div class="herb-card-title"><h3>${esc(h.name)}</h3><span class="meta">${esc([h.family,h.intensity].filter(Boolean).join(' · '))}</span></div><p>${esc(h.flavor||h.uses||'')}</p><div class="badges">${[h.season,h.origin,h.dishTypes].filter(Boolean).slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('')}</div></button></article>`;}
function renderHerbs(){const found=herbFiltered(),count=$('#herbCount'),list=$('#herbList');if(!count||!list)return;count.textContent=`${found.length} plante${found.length>1?'s':''} et épice${found.length>1?'s':''}`;list.innerHTML=found.map(herbCard).join('')||'<p>Aucune plante ou épice trouvée.</p>';$$('[data-view-herb]').forEach(b=>b.onclick=()=>showHerb(b.dataset.viewHerb,'herbs'));}
['#herbSearch','#herbFamily','#herbSeason','#herbIntensity'].forEach(id=>{const e=$(id);if(e)e.addEventListener(e.tagName==='INPUT'?'input':'change',renderHerbs)});
if($('#clearHerbFilters'))$('#clearHerbFilters').onclick=()=>{$('#herbSearch').value='';$('#herbFamily').value='';$('#herbSeason').value='';$('#herbIntensity').value='';renderHerbs();};
if($('#randomHerb'))$('#randomHerb').onclick=()=>{if(herbs.length)showHerb(herbs[Math.floor(Math.random()*herbs.length)].id)};
function terms(s){return String(s||'').split(/[,;+]|\bou\b/gi).map(x=>norm(x)).filter(x=>x.length>2)}
function linkedRecipes(h){const ts=[h.name,...terms(h.name),...terms(h.idealFoods),...terms(h.uses)].filter(Boolean);return recipes.filter(r=>r.ingredients.some(i=>ts.some(t=>norm(i[0]).includes(t)||t.includes(norm(i[0]))))).slice(0,30);}
function matchingMixes(h){const n=norm(h.name).split(' ')[0];return herbKnowledge.melanges.filter(m=>norm(m['Proportions en volumes']).includes(n));}
function matchingSubstitutions(h){const n=norm(h.name).split(' ')[0];return herbKnowledge.substitutions.filter(s=>norm(s['Ingrédient manquant']).includes(n)||norm(s['Remplacement']).includes(n));}
function matchingAccords(h){const n=norm(h.name).split(' ')[0];return herbKnowledge.accords.filter(a=>norm(a['Herbes / épices conseillées']).includes(n));}
function fieldBlock(title,value,always=false){return value?`<section><h3>${title}</h3><p>${esc(value).replace(/\n/g,'<br>')}</p></section>`:(always?`<section><h3>${title}</h3><p class="muted">—</p></section>`:'');}
function showHerb(id,from=''){const h=herbs.find(x=>x.id===id);if(!h)return;if(from){rememberScroll(from);previousHerbView=from}else if(!previousHerbView)previousHerbView='herbs';viewedHerbId=id;const rec=linkedRecipes(h),mix=matchingMixes(h),sub=matchingSubstitutions(h),acc=matchingAccords(h);$('#herbViewContent').innerHTML=`<div class="herb-detail-head"><div class="meta">${esc([h.family,h.origin,h.season].filter(Boolean).join(' · '))}</div><h2>${esc(h.name)}</h2><p class="herb-flavor">${esc(h.flavor||'')}</p><div class="badges">${[h.intensity,h.forms,h.worldCuisines].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div><div class="herb-detail-grid">${fieldBlock('Usages principaux',h.uses)}${fieldBlock('Bienfaits',h.benefits,true)}${fieldBlock('Aliments idéaux',h.idealFoods)}${fieldBlock('Associations recommandées',h.recommendedPairings)}${fieldBlock('À la cuisson',h.cookingBehavior)}${fieldBlock('Préparation conseillée',h.preparation)}${fieldBlock('Quantité indicative',h.quantity)}${fieldBlock('Substitution possible',h.substitution)}${fieldBlock('Erreur à éviter',h.avoid)}${fieldBlock('Conservation',h.conservation)}${fieldBlock('Où l’acheter en Suisse',h.whereToBuy)}${fieldBlock('Idées de recettes',h.recipeIdeas)}${fieldBlock('Astuce du chef',h.chefTip)}</div><section class="knowledge-links"><h3>Recettes de ton Herbier</h3><div class="link-list">${rec.length?rec.map(r=>`<button data-herb-recipe="${esc(r.id)}">${esc(r.title)}</button>`).join(''):'<p class="muted">Aucune correspondance automatique trouvée pour l’instant.</p>'}</div></section><section class="knowledge-links"><h3>Accords par aliment</h3>${acc.length?acc.map(a=>`<article><strong>${esc(a['Aliment principal'])}</strong><p>${esc(a['Techniques idéales'])} · ${esc(a['Association signature'])}</p></article>`).join(''):'<p class="muted">Aucun accord spécifique.</p>'}</section><section class="knowledge-links"><h3>Mélanges maison</h3>${mix.length?mix.map(m=>`<article><strong>${esc(m['Nom du mélange'])}</strong><p>${esc(m['Proportions en volumes'])}</p><small>${esc(m['Utilisations'])}</small></article>`).join(''):'<p class="muted">Aucun mélange référencé.</p>'}</section><section class="knowledge-links"><h3>Substitutions</h3>${sub.length?sub.map(s=>`<article><strong>${esc(s['Ingrédient manquant'])} → ${esc(s['Remplacement'])}</strong><p>${esc(s['Résultat attendu'])}</p></article>`).join(''):'<p class="muted">Voir aussi la substitution indiquée dans la fiche.</p>'}</section><section class="knowledge-links"><h3>Techniques utiles</h3>${herbKnowledge.techniques.map(t=>`<article><strong>${esc(t['Technique'])}</strong><p>${esc(t['Méthode'])}</p><small>${esc(t['Point de vigilance'])}</small></article>`).join('')}</section>`;$$('[data-herb-recipe]').forEach(b=>b.onclick=()=>showRecipe(b.dataset.herbRecipe,'herbView'));switchView('herbView',{top:true});}
function openHerbEditor(id=viewedHerbId){
 if(READONLY)return;
 const existing=herbs.find(x=>x.id===id),h=existing||{id:'',name:''},isNew=!existing;
 $('#herbDialogTitle').textContent=isNew?'Ajouter une plante ou une épice':'Modifier Plante & Épice';
 $('#herbEditId').value=isNew?'':h.id;refreshHerbEditorSelects(h);
 const map={Name:'name',Family:'family',Origin:'origin',Season:'season',Intensity:'intensity',Forms:'forms',Flavor:'flavor',Uses:'uses',Benefits:'benefits',IdealFoods:'idealFoods',Pairings:'recommendedPairings',Cooking:'cookingBehavior',Preparation:'preparation',Quantity:'quantity',Substitution:'substitution',Avoid:'avoid',Conservation:'conservation',Where:'whereToBuy',RecipeIdeas:'recipeIdeas',ChefTip:'chefTip'};
 Object.entries(map).forEach(([suffix,key])=>{$(`#herbEdit${suffix}`).value=h[key]||''});if(isNew)$('#herbEditName').value='';$('#deleteHerb')?.classList.toggle('hidden',isNew);$('#herbDialog').showModal()
}
if($('#newHerb'))$('#newHerb').onclick=()=>openHerbEditor('');
if($('#editViewedHerb'))$('#editViewedHerb').onclick=()=>openHerbEditor();
if($('#closeHerbDialog'))$('#closeHerbDialog').onclick=()=>$('#herbDialog').close();
if($('#deleteHerb'))$('#deleteHerb').onclick=async()=>{const id=$('#herbEditId').value,h=herbs.find(x=>x.id===id);if(!h)return;if(!confirm(`Supprimer définitivement « ${h.name} » ?`))return;const photoId=h.photoId||'';herbs=herbs.filter(x=>x.id!==id);localStorage.setItem(herbStore,JSON.stringify(herbs));if(photoId&&window.hgMediaDeletePhoto)try{await window.hgMediaDeletePhoto(photoId)}catch(err){console.warn('Suppression photo',err)}registerProtectedChange();markDirty();viewedHerbId=null;renderHerbFilters();renderHerbs();$('#herbDialog').close();switchView('herbs')};
if($('#herbForm'))$('#herbForm').onsubmit=e=>{e.preventDefault();const oldId=$('#herbEditId').value;let h=oldId?herbs.find(x=>x.id===oldId):null;const map={Name:'name',Family:'family',Origin:'origin',Season:'season',Intensity:'intensity',Forms:'forms',Flavor:'flavor',Uses:'uses',Benefits:'benefits',IdealFoods:'idealFoods',Pairings:'recommendedPairings',Cooking:'cookingBehavior',Preparation:'preparation',Quantity:'quantity',Substitution:'substitution',Avoid:'avoid',Conservation:'conservation',Where:'whereToBuy',RecipeIdeas:'recipeIdeas',ChefTip:'chefTip'};if(!h){const name=$('#herbEditName').value.trim();let id=slug(name||`plante-${Date.now()}`);if(herbs.some(x=>x.id===id))id=`${id}-${Date.now()}`;h=normalizeHerb({id,name});herbs.push(h)}Object.entries(map).forEach(([suffix,key])=>h[key]=$(`#herbEdit${suffix}`).value.trim());localStorage.setItem(herbStore,JSON.stringify(herbs));registerProtectedChange();markDirty();renderHerbFilters();renderHerbs();$('#herbDialog').close();showHerb(h.id)};
if($('#backFromHerb'))$('#backFromHerb').onclick=()=>switchView(previousHerbView);


// v2.9.1 — Producteurs consolidés
const produceStore='hg-fruits-vegetables-v282';
let produceItems=[], viewedProduceId=null, previousProduceView='produce';
const produceBenefits2983=[["Pomme","Fibres, vitamine C, polyphénols","Transit, satiété et santé cardiovasculaire"],["Poire","Fibres, cuivre, vitamine C","Transit intestinal et satiété"],["Banane","Potassium, vitamine B6, fibres","Fonction musculaire, énergie et transit"],["Orange","Vitamine C, folates, fibres","Immunité et absorption du fer"],["Mandarine","Vitamine C, flavonoïdes","Immunité et antioxydants"],["Clémentine","Vitamine C, folates","Immunité et formation cellulaire"],["Citron","Vitamine C, flavonoïdes","Antioxydants et absorption du fer"],["Pamplemousse","Vitamine C, vitamine A","Immunité et peau"],["Kiwi","Vitamines C et K, fibres","Immunité et digestion"],["Fraise","Vitamine C, manganèse, polyphénols","Antioxydants et santé cardiovasculaire"],["Framboise","Fibres, vitamine C, manganèse","Transit et satiété"],["Mûre","Fibres, vitamines C et K","Transit et antioxydants"],["Myrtille","Anthocyanes, vitamine C, fibres","Santé cardiovasculaire et antioxydants"],["Cassis","Vitamine C, anthocyanes","Immunité et protection cellulaire"],["Groseille","Vitamine C, fibres","Transit et antioxydants"],["Raisin","Polyphénols, vitamine K","Santé cardiovasculaire et antioxydants"],["Cerise","Polyphénols, vitamine C","Protection antioxydante"],["Pêche","Vitamine C, caroténoïdes, eau","Hydratation, peau et vision"],["Nectarine","Vitamine C, caroténoïdes","Peau, vision et antioxydants"],["Abricot","Bêta-carotène, potassium, fibres","Vision, peau et transit"],["Prune","Fibres, vitamine K, polyphénols","Transit et antioxydants"],["Mirabelle","Fibres, caroténoïdes","Transit et protection cellulaire"],["Quetsche","Fibres, polyphénols","Transit et antioxydants"],["Figue","Fibres, potassium, calcium","Transit et apport minéral"],["Datte","Fibres, potassium, glucides","Énergie et transit"],["Grenade","Polyphénols, vitamine C","Protection antioxydante"],["Kaki","Bêta-carotène, fibres, vitamine C","Vision, transit et immunité"],["Coing","Fibres, vitamine C","Transit et satiété"],["Pastèque","Eau, lycopène, vitamine C","Hydratation et antioxydants"],["Melon","Eau, bêta-carotène, vitamine C","Hydratation, peau et vision"],["Ananas","Vitamine C, manganèse","Immunité et métabolisme"],["Mangue","Vitamines A et C, folates","Vision, peau et immunité"],["Papaye","Vitamines C et A, folates","Immunité, peau et digestion"],["Fruit de la passion","Fibres, vitamines A et C","Transit et antioxydants"],["Goyave","Vitamine C, fibres, folates","Immunité et transit"],["Litchi","Vitamine C, cuivre","Immunité et métabolisme"],["Noix de coco","Fibres, manganèse, lipides","Satiété et énergie"],["Avocat","Graisses insaturées, fibres, folates","Santé cardiovasculaire et satiété"],["Carambole","Vitamine C, fibres","Antioxydants et transit"],["Pitaya","Fibres, vitamine C, magnésium","Transit et antioxydants"],["Physalis","Vitamine C, caroténoïdes","Immunité et protection cellulaire"],["Nèfle","Caroténoïdes, fibres, potassium","Vision et transit"],["Nashi","Eau, fibres, vitamine C","Hydratation et transit"],["Canneberge","Polyphénols, vitamine C","Protection antioxydante"],["Sureau (baies cuites)","Anthocyanes, vitamine C","Antioxydants; à consommer cuit"],["Mûre blanche","Fibres, vitamine C, fer","Transit et micronutriments"],["Feijoa","Vitamine C, fibres","Immunité et transit"],["Chérimole","Vitamines B6 et C, fibres","Métabolisme et transit"],["Corossol","Vitamine C, fibres, potassium","Immunité et transit"],["Tamarin","Fibres, magnésium, potassium","Transit et minéraux"],["Kumquat","Vitamine C, fibres","Immunité et transit"],["Pomelo","Vitamine C, potassium","Immunité et équilibre hydrique"],["Bergamote","Vitamine C, flavonoïdes","Apport antioxydant"],["Yuzu","Vitamine C, composés aromatiques","Immunité et antioxydants"],["Longane","Vitamine C, cuivre","Immunité et métabolisme"],["Ramboutan","Vitamine C, cuivre","Immunité et métabolisme"],["Mangoustan","Fibres, vitamine C","Transit et antioxydants"],["Jacquier","Fibres, vitamine C, potassium","Transit et énergie"],["Durian","Fibres, vitamines B, potassium","Énergie et fonction nerveuse"],["Figue de Barbarie","Fibres, vitamine C, magnésium","Transit et antioxydants"],["Açaï","Polyphénols, fibres, lipides","Antioxydants et satiété"],["Aronia","Anthocyanes, polyphénols","Forte contribution antioxydante"],["Argousier","Vitamine C, caroténoïdes","Immunité et protection cellulaire"],["Jujube","Vitamine C, fibres","Immunité et transit"],["Sapote","Fibres, vitamine C, caroténoïdes","Transit, peau et antioxydants"],["Carotte","Bêta-carotène, fibres, potassium","Vision, peau et transit"],["Brocoli","Vitamines C et K, folates, fibres","Immunité, os et transit"],["Chou-fleur","Vitamine C, folates, fibres","Immunité et digestion"],["Chou vert","Vitamines C et K, fibres","Santé osseuse et transit"],["Chou rouge","Anthocyanes, vitamines C et K","Antioxydants et os"],["Chou frisé (kale)","Vitamines K, A et C","Os, vision et immunité"],["Chou de Bruxelles","Vitamines C et K, fibres","Transit et santé osseuse"],["Chou-rave","Vitamine C, fibres, potassium","Immunité et transit"],["Chou chinois","Vitamines A, C, K, folates","Vision, immunité et os"],["Pak-choï","Vitamines A, C, K, calcium","Os, vision et immunité"],["Épinard","Folates, vitamines K et A, fer","Formation cellulaire, os et vision"],["Blette","Vitamines K et A, magnésium","Os et fonction musculaire"],["Laitue","Folates, vitamine K, eau","Hydratation et formation cellulaire"],["Roquette","Vitamine K, folates, calcium","Santé osseuse"],["Mâche","Folates, vitamine C, caroténoïdes","Immunité et vision"],["Endive","Fibres, folates, vitamine K","Transit et os"],["Chicorée","Fibres, folates, vitamine K","Transit et microbiote"],["Cresson","Vitamines K, C et A","Os, immunité et vision"],["Tomate","Lycopène, vitamine C, potassium","Antioxydants et santé cardiovasculaire"],["Poivron rouge","Vitamine C, caroténoïdes","Immunité, peau et vision"],["Poivron vert","Vitamine C, folates, fibres","Immunité et transit"],["Aubergine","Fibres, polyphénols","Transit et antioxydants"],["Courgette","Eau, vitamine C, potassium","Hydratation et fibres"],["Concombre","Eau, vitamine K","Hydratation"],["Courge butternut","Bêta-carotène, fibres, potassium","Vision, peau et transit"],["Potiron","Bêta-carotène, potassium, fibres","Vision et satiété"],["Potimarron","Bêta-carotène, fibres, potassium","Vision et transit"],["Citrouille","Bêta-carotène, vitamine C, fibres","Vision et immunité"],["Pâtisson","Vitamine C, fibres, potassium","Transit et équilibre hydrique"],["Fenouil","Fibres, vitamine C, potassium","Transit et satiété"],["Céleri-branche","Eau, vitamine K, potassium","Hydratation et équilibre hydrique"],["Céleri-rave","Fibres, vitamine K, phosphore","Transit et os"],["Poireau","Fibres, folates, vitamine K","Transit et formation cellulaire"],["Oignon","Flavonoïdes, composés soufrés","Apport antioxydant"],["Ail","Composés soufrés, manganèse","Santé cardiovasculaire"],["Échalote","Flavonoïdes, composés soufrés","Protection antioxydante"],["Artichaut","Fibres, folates, magnésium","Transit et satiété"],["Asperge","Folates, vitamine K, fibres","Formation cellulaire et transit"],["Haricot vert","Fibres, folates, vitamine K","Transit et os"],["Petit pois","Fibres, protéines végétales, folates","Satiété et transit"],["Pois mange-tout","Fibres, vitamine C, folates","Transit et immunité"],["Fève","Protéines végétales, fibres, folates","Satiété et formation cellulaire"],["Maïs doux","Fibres, vitamines B, caroténoïdes","Énergie et transit"],["Betterave","Folates, nitrates naturels, manganèse","Formation cellulaire et circulation"],["Navet","Vitamine C, fibres, potassium","Immunité et transit"],["Panais","Fibres, folates, potassium","Transit et satiété"],["Radis","Vitamine C, eau, composés soufrés","Hydratation et antioxydants"],["Radis noir","Fibres, vitamine C, composés soufrés","Transit et antioxydants"],["Rutabaga","Vitamine C, fibres, potassium","Immunité et transit"],["Topinambour","Inuline, fibres, potassium","Microbiote et transit"],["Salsifis","Fibres, potassium, folates","Transit et satiété"],["Scorsonère","Fibres, potassium, fer","Transit et minéraux"],["Patate douce","Bêta-carotène, fibres, potassium","Vision, satiété et transit"],["Pomme de terre","Potassium, vitamine C, amidon","Énergie et fonction musculaire"],["Manioc","Amidon, vitamine C, manganèse","Énergie; bien cuire"],["Igname","Fibres, potassium, vitamine C","Énergie et transit"],["Taro","Amidon, fibres, potassium","Énergie et satiété"],["Gombo","Fibres, folates, vitamine C","Transit et formation cellulaire"],["Pousses de bambou","Fibres, cuivre, potassium","Transit et minéraux"],["Cœur de palmier","Fibres, cuivre, manganèse","Satiété et minéraux"],["Champignon de Paris","Vitamines B, sélénium, cuivre","Métabolisme et antioxydants"],["Pleurote","Vitamines B, cuivre, fibres","Métabolisme et transit"],["Shiitaké","Vitamines B, cuivre, fibres","Métabolisme énergétique"],["Cèpe","Fibres, cuivre, vitamines B","Transit et métabolisme"],["Girolle","Fibres, cuivre, caroténoïdes","Transit et micronutriments"]];
function applyProduceBenefits2983(items){
  const migrationKey='hg-migration-produce-benefits-2983';
  if(localStorage.getItem(migrationKey)==='1')return false;
  const byName=new Map(produceBenefits2983.map(([name,apports,bienfaits])=>[norm(name),{apports,bienfaits}]));
  let changed=0;
  items.forEach(p=>{const info=byName.get(norm(p.name));if(!info)return;p.benefits=`Apports : ${info.apports}\nBienfaits : ${info.bienfaits}`;changed++;});
  localStorage.setItem(migrationKey,'1');
  if(changed)localStorage.setItem(produceStore,JSON.stringify(items));
  console.info(`v2.9.8.3 — Bienfaits enrichis : ${changed} fiche(s) mise(s) à jour.`);
  return changed>0;
}
function normalizeProduce(p={}){return {...p,id:String(p.id||slug(p.name||'produit')),name:String(p.name||'Produit sans nom')};}
function produceUnique(field){return [...new Set(produceItems.map(p=>String(p[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));}
function refreshProduceEditorSelects(p={}){fillEditableSelect($('#produceEditCategory'),produceUnique('category'),p.category||'','Choisir…');fillEditableSelect($('#produceEditSeason'),produceUnique('season'),p.season||'','Choisir…');}
function fillProduceSelect(id,values,label){const e=$(id),v=e?.value||'';if(!e)return;e.innerHTML=`<option value="">${label}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(values.includes(v))e.value=v;}
function renderProduceFilters(){fillProduceSelect('#produceCategory',produceUnique('category'),'Toutes les catégories');fillProduceSelect('#produceSeason',produceUnique('season'),'Toutes les saisons');fillProduceSelect('#produceAvailability',produceUnique('availability'),'Toutes les disponibilités');}
async function initProduce(){
 try{
  const res=await fetch(`fruits-vegetables.json?_=${Date.now()}`,{cache:'no-store'}),payload=res.ok?await res.json():{products:[]};
  const stored=JSON.parse(localStorage.getItem(produceStore)||'null');
  produceItems=(stored&&stored.length?stored:payload.products||[]).map(normalizeProduce);
  if(!stored)localStorage.setItem(produceStore,JSON.stringify(produceItems));
  applyProduceBenefits2983(produceItems);
  renderProduceFilters();
  renderProduce();
 }catch(e){console.error('Fruits & Légumes',e);produceItems=[];renderProduce();}
}
function produceFiltered(){const q=norm($('#produceSearch')?.value),category=$('#produceCategory')?.value||'',season=$('#produceSeason')?.value||'',availability=$('#produceAvailability')?.value||'';return produceItems.filter(p=>(!category||p.category===category)&&(!season||p.season===season)&&(!availability||p.availability===availability)&&(!q||norm(Object.values(p).join(' ')).includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));}
function produceCard(p){return `<article class="produce-card"><button data-view-produce="${esc(p.id)}"><div class="produce-card-title"><h3>${esc(p.name)}</h3><span class="meta">${esc([p.category,p.season].filter(Boolean).join(' · '))}</span></div><p>${esc(p.description||p.uses||'')}</p><div class="badges">${[p.availability,p.preparation,p.conservation].filter(Boolean).slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('')}</div></button></article>`;}
function renderProduce(){const found=produceFiltered(),count=$('#produceCount'),list=$('#produceList');if(!count||!list)return;count.textContent=`${found.length} produit${found.length>1?'s':''}`;list.innerHTML=found.map(produceCard).join('')||'<p>Aucun fruit ou légume trouvé.</p>';$$('[data-view-produce]').forEach(b=>b.onclick=()=>showProduce(b.dataset.viewProduce,'produce'));}
['#produceSearch','#produceCategory','#produceSeason','#produceAvailability'].forEach(id=>{const e=$(id);if(e)e.addEventListener(e.tagName==='INPUT'?'input':'change',renderProduce)});
if($('#clearProduceFilters'))$('#clearProduceFilters').onclick=()=>{$('#produceSearch').value='';$('#produceCategory').value='';$('#produceSeason').value='';$('#produceAvailability').value='';renderProduce();};
if($('#randomProduce'))$('#randomProduce').onclick=()=>{if(produceItems.length)showProduce(produceItems[Math.floor(Math.random()*produceItems.length)].id)};
function linkedProduceRecipes(p){const names=[p.name,...terms(p.name)].filter(Boolean);return recipes.filter(r=>r.ingredients.some(i=>names.some(t=>norm(i[0]).includes(t)||t.includes(norm(i[0]))))).slice(0,40);}
function linkedProduceHerbs(p){const hay=norm([p.pairings,p.benefitPairings,p.preparation,p.uses].join(' '));return herbs.filter(h=>{const base=norm(h.name).split(' ')[0];return base.length>2&&hay.includes(base)}).slice(0,24);}
function linkedProduceProducers(p){const n=norm(p.name).split(' ')[0];return producers.filter(x=>norm([...(x.products||[]),x.notes||''].join(' ')).includes(n)).slice(0,20);}
function showProduce(id,from=''){const p=produceItems.find(x=>x.id===id);if(!p)return;if(from){rememberScroll(from);previousProduceView=from}else if(!previousProduceView)previousProduceView='produce';viewedProduceId=id;const rec=linkedProduceRecipes(p),hs=linkedProduceHerbs(p),prod=linkedProduceProducers(p);$('#produceViewContent').innerHTML=`<div class="produce-detail-head"><div class="meta">${esc([p.category,p.season,p.availability].filter(Boolean).join(' · '))}</div><h2>${esc(p.name)}</h2>${p.latinName?`<p class="latin-name"><em>${esc(p.latinName)}</em></p>`:''}<p class="produce-description">${esc(p.description||'')}</p></div><div class="produce-detail-grid">${fieldBlock('Utilisations culinaires',p.uses)}${fieldBlock('Bienfaits',p.benefits,true)}${fieldBlock('À associer avec',p.pairings)}${fieldBlock('Associations renforçant les bienfaits',p.benefitPairings)}${fieldBlock('Modes de préparation',p.preparation)}${fieldBlock('Conservation',p.conservation)}${fieldBlock('Remarques',p.notes)}</div><section class="knowledge-links"><h3>Recettes de ton Herbier</h3><div class="link-list">${rec.length?rec.map(r=>`<button data-produce-recipe="${esc(r.id)}">${esc(r.title)}</button>`).join(''):'<p class="muted">Aucune correspondance automatique trouvée pour l’instant.</p>'}</div></section><section class="knowledge-links"><h3>Plantes & Épices associées</h3><div class="link-list">${hs.length?hs.map(h=>`<button data-produce-herb="${esc(h.id)}">${esc(h.name)}</button>`).join(''):'<p class="muted">Aucun lien automatique trouvé dans les accords de cette fiche.</p>'}</div></section><section class="knowledge-links"><h3>Producteurs locaux</h3><div class="link-list">${prod.length?prod.map(x=>`<button data-produce-producer="${esc(x.id)}">${esc(x.name)}</button>`).join(''):'<p class="muted">Aucun producteur correspondant automatiquement pour l’instant.</p>'}</div></section>`;$$('[data-produce-recipe]').forEach(b=>b.onclick=()=>showRecipe(b.dataset.produceRecipe,'produceView'));$$('[data-produce-herb]').forEach(b=>b.onclick=()=>showHerb(b.dataset.produceHerb,'produceView'));$$('[data-produce-producer]').forEach(b=>b.onclick=()=>showProducer(b.dataset.produceProducer,'produceView'));switchView('produceView',{top:true});}
function openProduceEditor(id=viewedProduceId){
 if(READONLY)return;
 const existing=produceItems.find(x=>x.id===id),p=existing||{id:'',name:''},isNew=!existing;
 $('#produceDialogTitle').textContent=isNew?'Ajouter un fruit ou un légume':'Modifier Fruit & Légume';
 $('#produceEditId').value=isNew?'':p.id;refreshProduceEditorSelects(p);
 const map={Name:'name',Category:'category',Latin:'latinName',Availability:'availability',Season:'season',Description:'description',Benefits:'benefits',Pairings:'pairings',BenefitPairings:'benefitPairings',Preparation:'preparation',Conservation:'conservation',Uses:'uses',Notes:'notes'};
 Object.entries(map).forEach(([suffix,key])=>{$(`#produceEdit${suffix}`).value=p[key]||''});if(isNew)$('#produceEditName').value='';$('#deleteProduce')?.classList.toggle('hidden',isNew);$('#produceDialog').showModal()
}
if($('#newProduce'))$('#newProduce').onclick=()=>openProduceEditor('');
if($('#editViewedProduce'))$('#editViewedProduce').onclick=()=>openProduceEditor();
if($('#closeProduceDialog'))$('#closeProduceDialog').onclick=()=>$('#produceDialog').close();
if($('#deleteProduce'))$('#deleteProduce').onclick=async()=>{const id=$('#produceEditId').value,p=produceItems.find(x=>x.id===id);if(!p)return;if(!confirm(`Supprimer définitivement « ${p.name} » ?`))return;const photoId=p.photoId||'';produceItems=produceItems.filter(x=>x.id!==id);localStorage.setItem(produceStore,JSON.stringify(produceItems));if(photoId&&window.hgMediaDeletePhoto)try{await window.hgMediaDeletePhoto(photoId)}catch(err){console.warn('Suppression photo',err)}registerProtectedChange();markDirty();viewedProduceId=null;renderProduceFilters();renderProduce();$('#produceDialog').close();switchView('produce')};
if($('#produceForm'))$('#produceForm').onsubmit=e=>{e.preventDefault();const oldId=$('#produceEditId').value;let p=oldId?produceItems.find(x=>x.id===oldId):null;const map={Name:'name',Category:'category',Latin:'latinName',Availability:'availability',Season:'season',Description:'description',Benefits:'benefits',Pairings:'pairings',BenefitPairings:'benefitPairings',Preparation:'preparation',Conservation:'conservation',Uses:'uses',Notes:'notes'};if(!p){const name=$('#produceEditName').value.trim();let id=slug(name||`produit-${Date.now()}`);if(produceItems.some(x=>x.id===id))id=`${id}-${Date.now()}`;p=normalizeProduce({id,name});produceItems.push(p)}Object.entries(map).forEach(([suffix,key])=>p[key]=$(`#produceEdit${suffix}`).value.trim());localStorage.setItem(produceStore,JSON.stringify(produceItems));registerProtectedChange();markDirty();renderProduceFilters();renderProduce();$('#produceDialog').close();showProduce(p.id)};
if($('#backFromProduce'))$('#backFromProduce').onclick=()=>switchView(previousProduceView);



function printField(label,value){return `<section class="print-field"><h3>${esc(label)}</h3><p>${esc(value||'—').replace(/\n/g,'<br>')}</p></section>`}
function printHerb(h){if(!h)return;const body=`<h1>${esc(h.name)}</h1><p>${esc([h.family,h.origin,h.season,h.intensity].filter(Boolean).join(' · '))}</p><div class="columns"><div>${printField('Profil gustatif',h.flavor)}${printField('Usages principaux',h.uses)}${printField('Bienfaits',h.benefits)}${printField('Aliments idéaux',h.idealFoods)}${printField('Associations recommandées',h.recommendedPairings)}${printField('À la cuisson',h.cookingBehavior)}</div><div>${printField('Préparation conseillée',h.preparation)}${printField('Quantité indicative',h.quantity)}${printField('Substitution possible',h.substitution)}${printField('Erreur à éviter',h.avoid)}${printField('Conservation',h.conservation)}${printField('Où l’acheter en Suisse',h.whereToBuy)}${printField('Idées de recettes',h.recipeIdeas)}${printField('Astuce du chef',h.chefTip)}</div></div>`;printDocument(h.name,body)}
function printProduce(p){if(!p)return;const body=`<h1>${esc(p.name)}</h1><p>${esc([p.category,p.season,p.availability].filter(Boolean).join(' · '))}</p>${p.latinName?`<p><em>${esc(p.latinName)}</em></p>`:''}${printField('Description',p.description)}<div class="columns"><div>${printField('Utilisations culinaires',p.uses)}${printField('Bienfaits',p.benefits)}${printField('À associer avec',p.pairings)}${printField('Associations renforçant les bienfaits',p.benefitPairings)}</div><div>${printField('Modes de préparation',p.preparation)}${printField('Conservation',p.conservation)}${printField('Remarques',p.notes)}</div></div>`;printDocument(p.name,body)}
function printHerbList(){const found=herbFiltered();if(!found.length)return alert('Aucune fiche à imprimer.');printDocument('Plantes & Épices',`<h1>Plantes & Épices</h1><p>${found.length} fiche${found.length>1?'s':''} affichée${found.length>1?'s':''}</p>${found.map(h=>`<div class="day"><h2>${esc(h.name)}</h2><p><strong>${esc([h.family,h.intensity].filter(Boolean).join(' · '))}</strong></p><p>${esc(h.flavor||h.uses||'')}</p><p>${esc([h.season,h.origin,h.dishTypes].filter(Boolean).join(' · '))}</p></div>`).join('')}`)}
function printProduceList(){const found=produceFiltered();if(!found.length)return alert('Aucune fiche à imprimer.');printDocument('Fruits & Légumes',`<h1>Fruits & Légumes</h1><p>${found.length} fiche${found.length>1?'s':''} affichée${found.length>1?'s':''}</p>${found.map(p=>`<div class="day"><h2>${esc(p.name)}</h2><p><strong>${esc([p.category,p.season].filter(Boolean).join(' · '))}</strong></p><p>${esc(p.description||p.uses||'')}</p><p>${esc([p.availability,p.preparation,p.conservation].filter(Boolean).join(' · '))}</p></div>`).join('')}`)}
if($('#printViewedHerb'))$('#printViewedHerb').onclick=()=>printHerb(herbs.find(x=>x.id===viewedHerbId));
if($('#printHerbList'))$('#printHerbList').onclick=printHerbList;
if($('#printViewedProduce'))$('#printViewedProduce').onclick=()=>printProduce(produceItems.find(x=>x.id===viewedProduceId));
if($('#printProduceList'))$('#printProduceList').onclick=printProduceList;

function bindEditableOtherSelect(selector,label){const el=$(selector);if(!el)return;el.addEventListener('change',()=>{if(el.value==='__other__'){const value=prompt(`Nouveau ${label} :`);if(value?.trim()){addSelectOption(el,value.trim());el.value=value.trim()}else el.value=''}})}
['#recipeCategory','#restaurantRegionField','#restaurantCityField','#restaurantCountryField','#producerTypeField','#producerRegionField','#herbEditFamily','#herbEditSeason','#herbEditIntensity','#herbEditForms','#produceEditCategory','#produceEditSeason'].forEach((id,i)=>bindEditableOtherSelect(id,['catégorie','région','lieu','pays','type','région','famille','saison','intensité','forme','catégorie','saison'][i]));

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
