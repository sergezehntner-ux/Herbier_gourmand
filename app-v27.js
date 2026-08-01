let recipes = [], plan = [], shopping = [], pendingImport = [];
let selectionContext = null, viewedRecipeId = null, previousView = 'recipes', shoppingGroupMode = 'store';
const viewScrollPositions={home:0,recipes:0,planner:0,shopping:0,recipeView:0,restaurants:0,restaurantView:0,producers:0,producerView:0};
const days = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const slots = ["Matin","Midi","Soir"];
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const recipeStore='hg-recipes-v271', planStore='hg-plan-v271', shoppingStore='hg-shopping-v271', slotStore='hg-day-slots-v271';
const shoppingAssignmentStore='hg-shopping-assignments-v251';
const APP_VERSION='2.7';
const BACKUP_META_KEY='hg-backup-meta-v26';
const EMERGENCY_BACKUP_KEY='hg-emergency-before-import-v26';
const CHANGE_COUNTER_KEY='hg-changes-since-backup-v26';
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function init(){
  await autoLoadSharedBackup();
  renderDaySlotChoices();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  const stored=JSON.parse(localStorage.getItem(recipeStore)||'null');
  if(stored) recipes=stored; else recipes=await fetch(`recipes.json?_=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());
  recipes=recipes.map(normalizeRecipe);
  fillCategories(); renderRecipes(); loadSaved(); await initRestaurants(); await initProducers(); applyReadonlyMode(); checkForUpdate();
}
function saveRecipes(){localStorage.setItem(recipeStore,JSON.stringify(recipes));registerProtectedChange();markDirty();}
function activeViewId(){return document.querySelector('.view.active')?.id||'home'}
function rememberScroll(view=activeViewId()){viewScrollPositions[view]=scrollY}
function restoreScroll(view){requestAnimationFrame(()=>scrollTo(0,viewScrollPositions[view]||0))}
function keepScroll(action,view=activeViewId()){const y=scrollY;action();requestAnimationFrame(()=>scrollTo(0,y));viewScrollPositions[view]=y}
function switchView(id,{top=false}={}){const from=activeViewId();if(from!==id)rememberScroll(from);$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));if(top)viewScrollPositions[id]=0;restoreScroll(id);}
$$('nav button').forEach(b=>b.onclick=()=>{selectionContext=null;updateSelectionBar();switchView(b.dataset.view)});
$$('[data-go]').forEach(b=>b.onclick=()=>switchView(b.dataset.go));
function slug(s){return (norm(s).replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'recette')+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
function normalizeRecipe(r){return {id:String(r.id||r.uid||slug(r.title||r.name||'recette')),title:r.title||r.name||'Recette sans titre',category:r.category||'Importée',time:Number(r.time)||0,servings:Number(r.servings)||4,ingredients:Array.isArray(r.ingredients)?r.ingredients:[],steps:Array.isArray(r.steps)?r.steps:[],avecViande:!!r.avecViande,temperature:r.temperature||'les-deux',tags:Array.isArray(r.tags)?r.tags:[],source:r.source||'',notes:r.notes||'',paprikaUid:r.paprikaUid||r.uid||''};}
function fillCategories(){const cats=[...new Set(recipes.map(r=>r.category).filter(Boolean))].sort();$('#category').innerHTML='<option value="">Toutes catégories</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join('');$('#categorySuggestions').innerHTML=cats.map(c=>`<option value="${esc(c)}">`).join('');}
function recipeCard(r){const choose=selectionContext?`<button class="primary" data-choose="${esc(r.id)}">Choisir pour ${esc(days[selectionContext.dayIndex])} ${esc(selectionContext.slot.toLowerCase())}</button>`:'';return `<article class="recipe"><div class="recipe-head"><div class="meta">${esc(r.category)} · ${r.time||'?'} min · ${r.servings} pers.</div><h3>${esc(r.title)}</h3><div class="badges">${(r.tags||[]).slice(0,5).map(t=>`<span>${esc(t)}</span>`).join('')}</div></div><div class="recipe-actions">${choose}<button data-view-recipe="${esc(r.id)}">Voir la recette</button><button data-edit="${esc(r.id)}">Modifier</button><button data-print-recipe="${esc(r.id)}">Imprimer</button></div></article>`;}
function renderRecipes(){const q=norm($('#search').value),cat=$('#category').value,max=+$('#maxTime').value||999;const found=recipes.filter(r=>(!cat||r.category===cat)&&(r.time||0)<=max&&(!q||norm(JSON.stringify(r)).includes(q))).sort((a,b)=>a.title.localeCompare(b.title,'fr',{sensitivity:'base'}));$('#recipeCount').textContent=`${found.length} recette${found.length>1?'s':''}`;$('#recipeList').innerHTML=found.map(recipeCard).join('')||'<p>Aucune recette trouvée.</p>';bindRecipeCards($('#recipeList'));}
function bindRecipeCards(root=document){root.querySelectorAll('[data-view-recipe]').forEach(b=>b.onclick=()=>showRecipe(b.dataset.viewRecipe,'recipes'));root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openRecipe(b.dataset.edit));root.querySelectorAll('[data-print-recipe]').forEach(b=>b.onclick=()=>printRecipe(recipes.find(r=>r.id===b.dataset.printRecipe)));root.querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>chooseRecipeForPlan(b.dataset.choose));}
$('#search').oninput=renderRecipes;$('#category').onchange=renderRecipes;$('#maxTime').onchange=renderRecipes;
$('#surpriseBtn').onclick=()=>{if(!recipes.length)return;const r=recipes[Math.floor(Math.random()*recipes.length)];$('#surpriseCard').innerHTML=recipeCard(r);bindRecipeCards($('#surpriseCard'));};
function updateSelectionBar(){const active=!!selectionContext;$('#recipeReturnBar').classList.toggle('hidden',!active);$('#selectionHint').textContent=active?`Choix pour ${days[selectionContext.dayIndex]} ${selectionContext.slot.toLowerCase()}`:'';renderRecipes();}
$('#returnPlanner').onclick=()=>{selectionContext=null;updateSelectionBar();switchView('planner')};
function startRecipeChoice(index,dayIndex=null,slot=null){
  const existing=Number.isInteger(index)&&plan[index];
  selectionContext={index:existing?index:null,dayIndex:existing?existing.dayIndex:dayIndex,slot:existing?existing.slot:slot};
  rememberScroll('planner');updateSelectionBar();switchView('recipes',{top:true});$('#search').focus();
}
function chooseRecipeForPlan(id){if(!selectionContext)return;const r=recipes.find(x=>x.id===id);if(!r)return;const ctx={...selectionContext};if(Number.isInteger(ctx.index)&&plan[ctx.index])plan[ctx.index].recipe=r;else plan.push({dayIndex:ctx.dayIndex,slot:ctx.slot,recipe:r});selectionContext=null;invalidateShopping('Le planning a changé : recrée la liste de courses.');renderPlan();updateSelectionBar();switchView('planner');}
function recipeSourceMarkup(source){if(!source)return '';try{const url=new URL(source);const host=url.hostname.replace(/^www\./,'');return `<p class="recipe-source muted">Source : <a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a></p>`;}catch{return `<p class="recipe-source muted">Source : ${esc(source)}</p>`;}}
function showRecipe(id,from='recipes'){const r=recipes.find(x=>x.id===id);if(!r)return;rememberScroll(from);viewedRecipeId=id;previousView=from;$('#recipeViewContent').innerHTML=`<div class="recipe-title"><div class="meta">${esc(r.category)} · ${r.time||'?'} min · ${r.servings} pers. · ${esc(r.temperature)}</div><h2>${esc(r.title)}</h2>${recipeSourceMarkup(r.source)}</div><div class="recipe-columns"><section><h3>Ingrédients</h3><ul>${scaledIngredients(r).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h3>Préparation</h3><ol>${r.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>${r.notes?`<h3>Notes</h3><p>${esc(r.notes).replace(/\n/g,'<br>')}</p>`:''}</section></div>`;switchView('recipeView');}
$('#backFromRecipe').onclick=()=>switchView(previousView);$('#editViewedRecipe').onclick=()=>openRecipe(viewedRecipeId);$('#printViewedRecipe').onclick=()=>printRecipe(recipes.find(r=>r.id===viewedRecipeId));

function openRecipe(id){const r=recipes.find(x=>x.id===id);$('#recipeDialogTitle').textContent=r?'Modifier la recette':'Nouvelle recette';$('#recipeId').value=r?.id||'';$('#recipeTitle').value=r?.title||'';$('#recipeCategory').value=r?.category||'';$('#recipeTime').value=r?.time||30;$('#recipeServings').value=r?.servings||4;$('#recipeTemperature').value=r?.temperature||'chaud';$('#recipeMeat').checked=!!r?.avecViande;$('#recipeIngredients').value=(r?.ingredients||[]).map(i=>i.join(' / ')).join('\n');$('#recipeSteps').value=(r?.steps||[]).join('\n');$('#recipeTags').value=(r?.tags||[]).join(', ');$('#deleteRecipe').classList.toggle('hidden',!r);$('#duplicateRecipe').classList.toggle('hidden',!r);$('#recipeDialog').showModal();}
$('#newRecipe').onclick=()=>openRecipe();$('#closeRecipe').onclick=()=>$('#recipeDialog').close();
function parseNumber(v){const s=String(v??'').trim().replace(',','.').replace('½','.5').replace('¼','.25').replace('¾','.75');if(/^\d+\s+\d+\/\d+$/.test(s)){const [a,f]=s.split(/\s+/),[n,d]=f.split('/').map(Number);return Number(a)+n/d;}if(/^\d+\/\d+$/.test(s)){const [n,d]=s.split('/').map(Number);return n/d;}const n=Number(s);return Number.isFinite(n)?n:v;}
function formRecipe(newId=false){const ingredients=$('#recipeIngredients').value.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const [n,q='',u='']=line.split('/').map(x=>x.trim());return[n,parseNumber(q),u]});const existing=recipes.find(x=>x.id===$('#recipeId').value);return normalizeRecipe({id:newId||$('#recipeId').value||slug($('#recipeTitle').value),title:$('#recipeTitle').value.trim(),category:$('#recipeCategory').value.trim(),time:+$('#recipeTime').value,servings:+$('#recipeServings').value,temperature:$('#recipeTemperature').value,avecViande:$('#recipeMeat').checked,ingredients,steps:$('#recipeSteps').value.split('\n').map(x=>x.trim()).filter(Boolean),tags:$('#recipeTags').value.split(',').map(x=>x.trim()).filter(Boolean),source:existing?.source||'',notes:existing?.notes||'',paprikaUid:existing?.paprikaUid||''});}
$('#recipeForm').onsubmit=e=>{e.preventDefault();const r=formRecipe();const i=recipes.findIndex(x=>x.id===r.id);if(i>=0)recipes[i]=r;else recipes.unshift(r);saveRecipes();fillCategories();keepScroll(renderRecipes,'recipes');invalidateShopping('Une recette a été modifiée : recrée les courses si nécessaire.');$('#recipeDialog').close();if(viewedRecipeId===r.id)showRecipe(r.id,previousView);};
$('#deleteRecipe').onclick=()=>{const id=$('#recipeId').value;if(id&&confirm('Supprimer définitivement cette recette ?')){recipes=recipes.filter(r=>r.id!==id);plan=plan.filter(x=>x.recipe.id!==id);saveRecipes();fillCategories();keepScroll(renderRecipes,'recipes');renderPlan();invalidateShopping('Une recette du planning a été supprimée.');$('#recipeDialog').close();switchView('recipes')}};
$('#duplicateRecipe').onclick=()=>{const r=formRecipe(slug($('#recipeTitle').value));r.title+=' (copie)';recipes.unshift(r);saveRecipes();fillCategories();keepScroll(renderRecipes,'recipes');$('#recipeDialog').close();};

function defaultDaySlots(){return Object.fromEntries(days.map((_,i)=>[i,{Matin:false,Midi:true,Soir:true}]))}function readDaySlots(){try{return{...defaultDaySlots(),...JSON.parse(localStorage.getItem(slotStore)||'{}')}}catch{return defaultDaySlots()}}
function renderDaySlotChoices(){const state=readDaySlots();$('#daySlotChoices').innerHTML=days.map((day,i)=>`<div class="day-slot-row"><strong>${day}</strong>${slots.map(slot=>`<label class="mini-slot ${state[i]?.[slot]?'selected':''}"><input type="checkbox" data-day-slot="${i}" data-slot="${slot}" ${state[i]?.[slot]?'checked':''}><span>${slot}</span></label>`).join('')}</div>`).join('');$$('[data-day-slot]').forEach(c=>c.onchange=()=>{c.parentElement.classList.toggle('selected',c.checked);saveDaySlots();updateSlotStatus()});updateSlotStatus();}
function saveDaySlots(){const state=defaultDaySlots();Object.keys(state).forEach(k=>slots.forEach(s=>state[k][s]=false));$$('[data-day-slot]').forEach(c=>state[c.dataset.daySlot][c.dataset.slot]=c.checked);localStorage.setItem(slotStore,JSON.stringify(state));}
function selectedDaySlots(){return $$('[data-day-slot]:checked').map(c=>({dayIndex:+c.dataset.daySlot,slot:c.dataset.slot}))}function updateSlotStatus(){const n=selectedDaySlots().length;$('#selectedSlotsStatus').textContent=`${n} repas`;}
$('#allDaySlots').onclick=()=>{$$('[data-day-slot]').forEach(c=>{c.checked=true;c.parentElement.classList.add('selected')});saveDaySlots();updateSlotStatus()};$('#clearDaySlots').onclick=()=>{$$('[data-day-slot]').forEach(c=>{c.checked=false;c.parentElement.classList.remove('selected')});saveDaySlots();updateSlotStatus()};$('#weekEvenings').onclick=()=>{$$('[data-day-slot]').forEach(c=>{c.checked=c.dataset.slot==='Soir';c.parentElement.classList.toggle('selected',c.checked)});saveDaySlots();updateSlotStatus()};
function choices(exclude=[]){const max=+$('#planTime').value||999;let pool=recipes.filter(r=>(!r.time||r.time<=max)&&!exclude.includes(r.id));return pool.length?pool:recipes.filter(r=>!exclude.includes(r.id));}function pickRandom(a){return a[Math.floor(Math.random()*a.length)]}
$('#generatePlan').onclick=()=>{const targets=selectedDaySlots();if(!targets.length)return alert('Choisis au moins un repas.');const used=[];plan=targets.map(t=>{let pool=choices(used);if(!pool.length)pool=choices([]);const recipe=pickRandom(pool);if(recipe)used.push(recipe.id);return{...t,recipe}}).filter(x=>x.recipe);invalidateShopping('Nouvelle proposition : la précédente liste de courses a été effacée.');renderPlan();};
function scaledIngredients(r){const f=(+$('#people').value||4)/(r.servings||4);return r.ingredients.map(([n,q,u])=>`${n} : ${typeof q==='number'?Math.round(q*f*100)/100:q||''} ${u||''}`.trim())}
function movePlanItem(index){
  const item=plan[index];if(!item)return;
  const dayAnswer=prompt(`Déplacer « ${item.recipe.title} » vers quel jour ?\n1 Lundi · 2 Mardi · 3 Mercredi · 4 Jeudi · 5 Vendredi · 6 Samedi · 7 Dimanche`,String(item.dayIndex+1));
  if(dayAnswer===null)return;const dayIndex=Number(dayAnswer)-1;if(dayIndex<0||dayIndex>6)return alert('Jour invalide.');
  const slotAnswer=prompt('Quel repas ?\n1 Matin · 2 Midi · 3 Soir',String(slots.indexOf(item.slot)+1));
  if(slotAnswer===null)return;const slot=slots[Number(slotAnswer)-1];if(!slot)return alert('Repas invalide.');
  const occupied=plan.findIndex((x,i)=>i!==index&&x.dayIndex===dayIndex&&x.slot===slot);
  if(occupied>=0&&!confirm(`${days[dayIndex]} ${slot.toLowerCase()} contient déjà « ${plan[occupied].recipe.title} ». Ajouter quand même cette recette ?`))return;
  item.dayIndex=dayIndex;item.slot=slot;invalidateShopping('Le planning a changé : recrée la liste de courses.');keepScroll(renderPlan,'planner');
}
function removePlanItem(index){const item=plan[index];if(!item)return;if(confirm(`Retirer « ${item.recipe.title} » du planning ?`)){plan.splice(index,1);invalidateShopping('Le planning a changé : recrée la liste de courses.');keepScroll(renderPlan,'planner')}}
function renderPlan(){
  const selected=selectedDaySlots();
  const dayIndexes=[...new Set([...selected.map(x=>x.dayIndex),...plan.map(x=>x.dayIndex)])].sort((a,b)=>a-b);
  if(!dayIndexes.length){$('#weekPlan').innerHTML='<p class="muted">Aucun repas sélectionné.</p>';return}
  $('#weekPlan').innerHTML=dayIndexes.map(d=>{
    const visibleSlots=[...new Set([...selected.filter(x=>x.dayIndex===d).map(x=>x.slot),...plan.filter(x=>x.dayIndex===d).map(x=>x.slot)])].sort((a,b)=>slots.indexOf(a)-slots.indexOf(b));
    return `<article class="day"><h3>${days[d]}</h3>${visibleSlots.map(slot=>{
      const matches=plan.filter(x=>x.dayIndex===d&&x.slot===slot);
      if(!matches.length)return `<div class="meal meal-empty"><div><strong>${slot}</strong><div class="meta">Aucune recette choisie</div></div><div class="meal-actions"><button class="primary" data-add-plan="${d}|${slot}">+ Ajouter une recette</button></div></div>`;
      return matches.map(m=>{const i=plan.indexOf(m),r=m.recipe;return `<div class="meal"><div><strong>${slot}</strong><div class="meta">${r.time||'?'} min · ${esc(r.category)}</div><h4>${esc(r.title)}</h4></div><div class="meal-actions"><button data-show-plan="${i}">Voir</button><button data-print-plan="${i}">Imprimer</button><button data-move-plan="${i}">Déplacer</button><button data-remove-plan="${i}" class="danger-soft">Retirer</button><button class="primary" data-change-plan="${i}">Changer</button></div></div>`}).join('');
    }).join('')}</article>`;
  }).join('');
  $$('[data-add-plan]').forEach(b=>b.onclick=()=>{const [d,s]=b.dataset.addPlan.split('|');startRecipeChoice(null,+d,s)});
  $$('[data-change-plan]').forEach(b=>b.onclick=()=>startRecipeChoice(+b.dataset.changePlan));
  $$('[data-show-plan]').forEach(b=>b.onclick=()=>showRecipe(plan[+b.dataset.showPlan].recipe.id,'planner'));
  $$('[data-print-plan]').forEach(b=>b.onclick=()=>printRecipe(plan[+b.dataset.printPlan].recipe));
  $$('[data-move-plan]').forEach(b=>b.onclick=()=>movePlanItem(+b.dataset.movePlan));
  $$('[data-remove-plan]').forEach(b=>b.onclick=()=>removePlanItem(+b.dataset.removePlan));
}
$('#people').onchange=()=>{localStorage.setItem('hg-people',$('#people').value);renderPlan();invalidateShopping('Le nombre de personnes a changé : recrée les courses.');};$('#clearPlan').onclick=()=>{if(confirm('Vider le planning ?')){plan=[];localStorage.removeItem(planStore);invalidateShopping('Planning vidé.');renderPlan()}};$('#savePlan').onclick=()=>{localStorage.setItem(planStore,JSON.stringify({people:+$('#people').value,time:$('#planTime').value,items:plan.map(x=>({dayIndex:x.dayIndex,slot:x.slot,id:x.recipe.id}))}));$('#planFreshness').textContent='Planning enregistré sur cet appareil.';$('#planFreshness').classList.remove('hidden');};
function invalidateShopping(message){
  $('#planFreshness').textContent=message;
  $('#planFreshness').classList.remove('hidden');
}
function shoppingAssignments(){try{return JSON.parse(localStorage.getItem(shoppingAssignmentStore)||'{}')}catch{return{}}}
function normalizeShoppingItem(x={}){const pref=shoppingAssignments()[norm(x.name||x.ingredient)]||{};return{id:x.id||uid(),name:x.name||x.ingredient||'',qty:x.qty??x.quantite??0,text:x.text||'',unit:x.unit||x.unite||'',store:x.store||x.magasin||pref.store||'',aisle:x.aisle||x.rayon||pref.aisle||'',checked:Boolean(x.checked??x.coche),manual:Boolean(x.manual),origins:Array.isArray(x.origins)?x.origins:Array.isArray(x.sources)?x.sources:Array.isArray(x.origine)?x.origine:[]}}
function rememberShoppingAssignments(){const saved=shoppingAssignments();shopping.forEach(x=>{if(x.name&&(x.store||x.aisle))saved[norm(x.name)]={store:x.store||'',aisle:x.aisle||''}});localStorage.setItem(shoppingAssignmentStore,JSON.stringify(saved))}
function saveShopping(){shopping=shopping.map(normalizeShoppingItem);localStorage.setItem(shoppingStore,JSON.stringify(shopping));rememberShoppingAssignments()}
$('#buildShopping').onclick=()=>{
  if(!plan.length)return alert('Prépare d’abord le planning.');
  const people=+$('#people').value||4,map=new Map(),old=new Map(shopping.map(x=>[`${norm(x.name)}|${norm(x.unit)}`,x])),prefs=shoppingAssignments();
  plan.forEach(m=>m.recipe.ingredients.forEach(([name,q,unit])=>{
    const amount=typeof q==='number'?q*people/(m.recipe.servings||4):0,key=`${norm(name)}|${norm(unit)}`,previous=old.get(key),pref=prefs[norm(name)]||{};
    if(!map.has(key))map.set(key,normalizeShoppingItem({id:previous?.id,name,qty:0,text:'',unit:unit||'',checked:previous?.checked,store:previous?.store||pref.store||'',aisle:previous?.aisle||pref.aisle||'',origins:[]}));
    const x=map.get(key);if(amount)x.qty=(Number(x.qty)||0)+amount;else if(q)x.text=[x.text,q].filter(Boolean).join(' + ');
    const origin=`${days[m.dayIndex]} ${m.slot} · ${m.recipe.title}`;if(!x.origins.includes(origin))x.origins.push(origin);
  }));
  shopping.filter(x=>x.manual).forEach(x=>map.set(`manual|${x.id}`,normalizeShoppingItem(x)));
  shopping=[...map.values()].map(x=>({...x,qty:typeof x.qty==='number'?Math.round(x.qty*100)/100:x.qty}));saveShopping();renderShopping();$('#planFreshness').classList.add('hidden');switchView('shopping');
};
function shoppingGroupKey(x){if(shoppingGroupMode==='store')return x.store||'Magasin à définir';if(shoppingGroupMode==='aisle')return x.aisle||'Rayon à définir';return (x.name?.[0]||'#').toUpperCase()}
function sortedShopping(){return [...shopping].sort((a,b)=>{
  let grouped=0;
  if(shoppingGroupMode==='store')grouped=(a.store||'zzz').localeCompare(b.store||'zzz','fr',{sensitivity:'base'})||(a.aisle||'zzz').localeCompare(b.aisle||'zzz','fr',{sensitivity:'base'});
  else if(shoppingGroupMode==='aisle')grouped=(a.aisle||'zzz').localeCompare(b.aisle||'zzz','fr',{sensitivity:'base'});
  return grouped||a.name.localeCompare(b.name,'fr',{sensitivity:'base'});
})}
function shoppingRow(x){const amount=x.qty?`${Math.round(Number(x.qty)*100)/100} ${esc(x.unit)}`:x.text?`${esc(x.text)} ${esc(x.unit)}`:'';return `<div class="shop-item ${x.checked?'checked':''}" data-shopping-id="${esc(x.id)}"><input type="checkbox" data-shop-check="${esc(x.id)}" ${x.checked?'checked':''}><button class="shop-text" data-edit-shopping="${esc(x.id)}"><strong>${esc(x.name)}</strong>${amount?` <span>— ${amount}</span>`:''}</button></div>`}
function renderStoreSubgroups(items){const aisles={};items.forEach(x=>(aisles[x.aisle||'Rayon à définir']??=[]).push(x));return Object.entries(aisles).map(([aisle,list])=>`<div class="shop-subgroup"><h4>${esc(aisle)}</h4>${list.map(shoppingRow).join('')}</div>`).join('')}
function renderShopping(){
  shopping=shopping.map(normalizeShoppingItem);
  const remaining=shopping.filter(x=>!x.checked).length;$('#shoppingSummary').textContent=`${remaining} à acheter · ${shopping.length} au total`;
  if(!shopping.length){$('#shoppingList').innerHTML='<p class="muted">La liste est vide.</p>';refreshShoppingSuggestions();return}
  const groups={};sortedShopping().forEach(x=>(groups[shoppingGroupKey(x)]??=[]).push(x));
  $('#shoppingList').innerHTML=Object.entries(groups).map(([name,items])=>`<section class="shop-group"><h3>${esc(name)}</h3>${shoppingGroupMode==='store'?renderStoreSubgroups(items):items.map(shoppingRow).join('')}</section>`).join('');
  $$('[data-shop-check]').forEach(c=>c.onchange=()=>{const x=shopping.find(i=>i.id===c.dataset.shopCheck);if(x){x.checked=c.checked;saveShopping();renderShopping()}});
  $$('[data-edit-shopping]').forEach(b=>b.onclick=()=>openShopping(b.dataset.editShopping));refreshShoppingSuggestions();
}
function addSelectOption(select,value){if(value&&!Array.from(select.options).some(o=>o.value===value)){const option=document.createElement('option');option.value=value;option.textContent=value;select.insertBefore(option,select.querySelector('option[value="__other__"]'))}}function refreshShoppingSuggestions(){const stores=[...new Set(shopping.map(x=>x.store).filter(Boolean))].sort(),aisles=[...new Set(shopping.map(x=>x.aisle).filter(Boolean))].sort();stores.forEach(x=>addSelectOption($('#shoppingStore'),x));aisles.forEach(x=>addSelectOption($('#shoppingAisle'),x))}function handleOtherSelect(select,label){if(select.value==='__other__'){const value=prompt(`Nouveau ${label} :`);if(value?.trim()){addSelectOption(select,value.trim());select.value=value.trim()}else select.value=''}}$('#shoppingStore').onchange=()=>handleOtherSelect($('#shoppingStore'),'magasin');$('#shoppingAisle').onchange=()=>handleOtherSelect($('#shoppingAisle'),'rayon');
function openShopping(id=''){const x=shopping.find(i=>i.id===id);$('#shoppingDialogTitle').textContent=x?'Modifier l’article':'Ajouter un article';$('#shoppingId').value=x?.id||'';$('#shoppingName').value=x?.name||'';$('#shoppingQty').value=x?.qty||x?.text||'';$('#shoppingUnit').value=x?.unit||'';addSelectOption($('#shoppingStore'),x?.store||'');addSelectOption($('#shoppingAisle'),x?.aisle||'');$('#shoppingStore').value=x?.store||'';$('#shoppingAisle').value=x?.aisle||'';$('#deleteShopping').classList.toggle('hidden',!x);$('#shoppingOrigins').classList.toggle('hidden',!x?.origins?.length);$('#shoppingOrigins').innerHTML=x?.origins?.length?`<strong>Origine :</strong><br>${x.origins.map(esc).join('<br>')}`:'';refreshShoppingSuggestions();$('#shoppingDialog').showModal()}
function addShopping(){openShopping()}
$('#shoppingForm').onsubmit=e=>{e.preventDefault();const id=$('#shoppingId').value,x=shopping.find(i=>i.id===id),raw=$('#shoppingQty').value.trim(),parsed=parseNumber(raw),item=normalizeShoppingItem({...(x||{}),id:id||uid(),name:$('#shoppingName').value.trim(),qty:typeof parsed==='number'?parsed:0,text:typeof parsed==='number'?'':raw,unit:$('#shoppingUnit').value.trim(),store:$('#shoppingStore').value.trim(),aisle:$('#shoppingAisle').value.trim(),manual:x?.manual??true,origins:x?.origins||['Ajout manuel']});if(x)Object.assign(x,item);else shopping.push(item);saveShopping();renderShopping();$('#shoppingDialog').close()};
$('#closeShopping').onclick=()=>$('#shoppingDialog').close();$('#deleteShopping').onclick=()=>{const id=$('#shoppingId').value;if(id&&confirm('Supprimer cet article ?')){shopping=shopping.filter(x=>x.id!==id);saveShopping();renderShopping();$('#shoppingDialog').close()}};
$('#addShopping').onclick=addShopping;$('#addShoppingBottom').onclick=addShopping;$('#clearChecks').onclick=()=>{shopping.forEach(x=>x.checked=false);saveShopping();renderShopping()};$('#removeChecked').onclick=()=>{const n=shopping.filter(x=>x.checked).length;if(!n)return alert('Aucun article coché.');if(confirm(`Supprimer ${n} article${n>1?'s':''} acheté${n>1?'s':''} ?`)){shopping=shopping.filter(x=>!x.checked);saveShopping();renderShopping()}};$('#clearShopping').onclick=()=>{if(confirm('Vider toute la liste ?')){shopping=[];saveShopping();renderShopping()}};
$$('[data-shop-group]').forEach(b=>b.onclick=()=>{shoppingGroupMode=b.dataset.shopGroup;$$('[data-shop-group]').forEach(x=>x.classList.toggle('active',x===b));renderShopping()});

// Import Paprika : .paprikarecipe (gzip JSON), .paprikarecipes (archive ZIP), JSON, HTML ou texte.
$('#importPaprika').onclick=()=>{pendingImport=[];$('#paprikaFile').value='';$('#importStatus').textContent='Aucun fichier analysé.';$('#importPreview').innerHTML='';$('#confirmImport').disabled=true;$('#importDialog').showModal()};$('#closeImport').onclick=$('#cancelImport').onclick=()=>$('#importDialog').close();
$('#paprikaFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;$('#importStatus').textContent='Analyse en cours…';$('#confirmImport').disabled=true;try{pendingImport=await parseImportFile(file);$('#importStatus').innerHTML=`<strong>${pendingImport.length}</strong> recette${pendingImport.length>1?'s':''} reconnue${pendingImport.length>1?'s':''} dans ${esc(file.name)}.`;$('#importPreview').innerHTML=pendingImport.slice(0,12).map(r=>`<div class="import-row"><strong>${esc(r.title)}</strong><span>${esc(r.category)} · ${r.ingredients.length} ingrédients</span></div>`).join('')+(pendingImport.length>12?`<p class="muted">… et ${pendingImport.length-12} autres.</p>`:'');$('#confirmImport').disabled=!pendingImport.length;}catch(err){console.error(err);pendingImport=[];$('#importStatus').textContent=`Import impossible : ${err.message}`;$('#importPreview').innerHTML='';}};
$('#importForm').onsubmit=e=>{e.preventDefault();if(!pendingImport.length)return;const replace=$('#replaceDuplicates').checked,importTag=`Import du ${new Date().toLocaleDateString('fr-CH')}`;pendingImport=pendingImport.map(r=>({...r,tags:[...new Set([...(r.tags||[]),importTag])]}));let added=0,replaced=0,ignored=0;pendingImport.forEach(r=>{const i=recipes.findIndex(x=>(r.paprikaUid&&x.paprikaUid===r.paprikaUid)||norm(x.title)===norm(r.title));if(i>=0){if(replace){r.id=recipes[i].id;recipes[i]=r;replaced++}else ignored++}else{recipes.unshift(r);added++}});saveRecipes();fillCategories();renderRecipes();$('#importDialog').close();alert(`Import terminé : ${added} ajoutée(s), ${replaced} remplacée(s), ${ignored} ignorée(s).`)};
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
function mapPaprikaRecipe(p){if(!p||typeof p!=='object')return null;const title=String(p.name||p.title||'').trim();if(!title)return null;const categories=Array.isArray(p.categories)?p.categories:String(p.categories||p.category||'Importée').split(',');const ing=Array.isArray(p.ingredients)?p.ingredients.join('\n'):String(p.ingredients||'');const dir=Array.isArray(p.directions)?p.directions.join('\n'):String(p.directions||p.steps||'');const servings=parseInt(String(p.servings||4).match(/\d+/)?.[0]||'4',10);const time=parseDuration(p.total_time||p.cook_time||p.prep_time||p.time);return normalizeRecipe({id:slug(title),paprikaUid:p.uid||p.id||'',title,category:categories.map(x=>String(x).trim()).filter(Boolean)[0]||'Importée',time,servings,ingredients:ing.split(/\r?\n/).map(parseIngredientLine).filter(x=>x[0]),steps:dir.split(/\r?\n/).map(x=>x.replace(/^\s*\d+[.)-]?\s*/, '').trim()).filter(Boolean),tags:categories.map(x=>String(x).trim()).filter(Boolean),temperature:'les-deux',avecViande:false,source:p.source_url||p.source||'',notes:p.notes||p.description||''});}
function parseDuration(v){if(typeof v==='number')return v;const s=String(v||'');const h=+(s.match(/(\d+)\s*h/i)?.[1]||0),m=+(s.match(/(\d+)\s*m/i)?.[1]||0);if(h||m)return h*60+m;return +(s.match(/\d+/)?.[0]||0)}
const unitAliases={'tablespoon':'c. à soupe','tablespoons':'c. à soupe','tbsp':'c. à soupe','tbs':'c. à soupe','cas':'c. à soupe','teaspoon':'c. à café','teaspoons':'c. à café','tsp':'c. à café','cac':'c. à café','gram':'g','grams':'g','kilogram':'kg','kilograms':'kg','milliliter':'ml','milliliters':'ml','liter':'l','liters':'l'};
function parseIngredientLine(line){line=String(line).replace(/^[-•]\s*/,'').trim();if(!line)return['','',''];const m=line.match(/^((?:\d+\s+)?\d+\/\d+|\d+[.,]?\d*|[½¼¾⅓⅔])\s*([\p{L}. à]+)?\s+(.+)$/u);if(!m)return[line,'',''];let q=parseNumber(m[1]),unit=norm(m[2]||'').replace(/\.$/,'').trim(),name=m[3].trim();unit=unitAliases[unit]||m[2]?.trim()||'';return[name,q,unit]}
function dedupeImported(a){const seen=new Set();return a.filter(r=>{const k=r.paprikaUid||norm(r.title);if(seen.has(k))return false;seen.add(k);return true})}

function printDocument(title,body){const w=open('','_blank','width=900,height=700');if(!w)return alert('Fenêtre d’impression bloquée.');w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{margin:10mm}body{font-family:Arial;max-width:850px;margin:auto;line-height:1.25}h1,h2{font-family:Georgia}.columns{display:grid;grid-template-columns:1fr 1.4fr;gap:20px}li{margin:3px 0}.day{border:1px solid #bbb;padding:8px;margin:6px 0;break-inside:avoid}.shop{columns:2}</style></head><body>${body}</body></html>`);w.document.close();setTimeout(()=>w.print(),250)}
function printRecipe(r){if(!r)return;const body=`<h1>${esc(r.title)}</h1><p>${r.time||'?'} min · ${+$('#people').value||r.servings} personnes · ${esc(r.category)}</p><div class="columns"><section><h2>Ingrédients</h2><ul>${scaledIngredients(r).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h2>Préparation</h2><ol>${r.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section></div>`;printDocument(r.title,body)}
$('#printPlan').onclick=()=>{if(!plan.length)return alert('Aucun planning.');printDocument('Planning',`<h1>Planning de la semaine</h1>${days.map((d,i)=>{const ms=plan.filter(x=>x.dayIndex===i);return ms.length?`<div class="day"><h2>${d}</h2>${ms.map(m=>`<p><strong>${m.slot}</strong> — ${esc(m.recipe.title)}</p>`).join('')}</div>`:''}).join('')}`)};$('#printShopping').onclick=()=>{if(!shopping.length)return alert('Liste vide.');const grouped={};sortedShopping().forEach(x=>(grouped[shoppingGroupKey(x)]??=[]).push(x));printDocument('Courses',`<h1>Liste de courses</h1>${Object.entries(grouped).map(([g,items])=>`<div class="day"><h2>${esc(g)}</h2><ul>${items.map(x=>`<li>☐ ${esc(x.name)}${x.qty?` — ${Math.round(x.qty*100)/100} ${esc(x.unit)}`:''}${shoppingGroupMode==='store'&&x.aisle?` <small>(${esc(x.aisle)})</small>`:''}</li>`).join('')}</ul></div>`).join('')}`)};
function loadSaved(){const p=+localStorage.getItem('hg-people');if(p)$('#people').value=p;try{const s=JSON.parse(localStorage.getItem(planStore)||localStorage.getItem('hg-plan-v26')||'null');if(s){$('#people').value=s.people||4;$('#planTime').value=s.time||'';plan=(s.items||[]).map(x=>({...x,recipe:recipes.find(r=>r.id===x.id)})).filter(x=>x.recipe)}shopping=(JSON.parse(localStorage.getItem(shoppingStore)||localStorage.getItem('hg-shopping-v26')||localStorage.getItem('hg-shopping')||'[]')||[]).map(normalizeShoppingItem)}catch(e){console.error(e)}renderPlan();renderShopping()}

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
  return {format:'HerbierGourmandBackup',formatVersion:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),data};
}
function downloadTextFile(filename,text){
  const blob=new Blob([text],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function backupFilename(){
  const d=new Date(),pad=n=>String(n).padStart(2,'0');
  return `Herbier_Gourmand_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.hgbak`;
}
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
$('#exportData').onclick=()=>{
  try{
    const backup=herbierStorageSnapshot(),filename=backupFilename();
    downloadTextFile(filename,JSON.stringify(backup,null,2));markBackupCreated(filename);
    $('#dataTransferStatus').textContent=`Sauvegarde créée : ${Object.keys(backup.data).length} ensemble(s) de données. Range le fichier dans OneDrive/Herbier Gourmand/Sauvegardes.`;
  }catch(err){console.error(err);alert('Impossible de créer la sauvegarde.');}
};
$('#importData').onclick=()=>{$('#dataImportFile').value='';$('#dataImportFile').click()};
$('#dataImportFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const parsed=JSON.parse(await file.text());
    if(parsed?.format!=='HerbierGourmandBackup'||parsed?.formatVersion!==1||!parsed.data||typeof parsed.data!=='object')throw new Error('format de sauvegarde non reconnu');
    const keys=Object.keys(parsed.data).filter(k=>k.startsWith('hg-')&&typeof parsed.data[k]==='string');
    if(!keys.length)throw new Error('aucune donnée Herbier Gourmand trouvée');
    pendingDataImport={...parsed,data:Object.fromEntries(keys.map(k=>[k,parsed.data[k]]))};
    let recipeCount='inconnu',shoppingCount='inconnu',planCount='inconnu';
    try{recipeCount=JSON.parse(pendingDataImport.data[recipeStore]||'[]').length}catch{}
    try{shoppingCount=JSON.parse(pendingDataImport.data[shoppingStore]||'[]').length}catch{}
    try{planCount=(JSON.parse(pendingDataImport.data[planStore]||'{}').items||[]).length}catch{}
    const when=parsed.exportedAt?new Date(parsed.exportedAt).toLocaleString('fr-FR'):'date inconnue';
    $('#dataImportSummary').innerHTML=`<strong>Sauvegarde du ${esc(when)}</strong><br>${recipeCount} recette(s) · ${planCount} repas planifié(s) · ${shoppingCount} article(s) de courses.<br><span class="muted">Les données actuelles de cet appareil seront remplacées.</span>`;
    $('#dataImportDialog').showModal();
  }catch(err){console.error(err);pendingDataImport=null;alert(`Import impossible : ${err.message}`);}
};
$('#closeDataImport').onclick=$('#cancelDataImport').onclick=()=>{$('#dataImportDialog').close();pendingDataImport=null};
$('#dataImportForm').onsubmit=e=>{
  e.preventDefault();if(!pendingDataImport)return;
  try{
    // Double protection : point de restauration local + téléchargement avant remplacement.
    const safety=createEmergencyCheckpoint('avant import'),safetyName=backupFilename().replace('.hgbak','_avant-import.hgbak');
    downloadTextFile(safetyName,JSON.stringify(safety,null,2));
    const currentHgKeys=[];
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('hg-')&&key!==EMERGENCY_BACKUP_KEY)currentHgKeys.push(key)}
    currentHgKeys.forEach(key=>localStorage.removeItem(key));
    Object.entries(pendingDataImport.data).forEach(([key,value])=>localStorage.setItem(key,value));
    localStorage.setItem(BACKUP_META_KEY,JSON.stringify({at:pendingDataImport.exportedAt||new Date().toISOString(),filename:'sauvegarde importée'}));
    localStorage.setItem(CHANGE_COUNTER_KEY,'0');
    $('#dataImportDialog').close();
    alert('Import terminé. Une sauvegarde « avant import » a aussi été téléchargée. Herbier Gourmand va maintenant recharger les données.');
    location.reload();
  }catch(err){console.error(err);alert('Impossible d’importer les données. Le point de restauration local a été conservé lorsque sa création a réussi.');}
};


// v2.7 — partage, lecture seule, GitHub et producteurs locaux
const producerStore='hg-producers-v27';
const READONLY=new URLSearchParams(location.search).get('readonly')==='1';
let producers=[],viewedProducerId=null,dirty=false;
function markDirty(){dirty=true;document.body.classList.add('has-unsaved');const el=$('#saveState');if(el){el.textContent='Modifications non sauvegardées';el.classList.add('dirty')}}
function clearDirty(){dirty=false;document.body.classList.remove('has-unsaved');const el=$('#saveState');if(el){el.textContent='À jour';el.classList.remove('dirty')}}
addEventListener('beforeunload',e=>{if(dirty&&!READONLY){e.preventDefault();e.returnValue='';}});
function inferredGithubConfig(){const host=location.hostname,parts=location.pathname.split('/').filter(Boolean);return {owner:host.endsWith('.github.io')?host.split('.')[0]:'',repo:parts[0]||'',branch:'main',path:'herbier-latest.hgbak'};}
function githubConfig(){try{return {...inferredGithubConfig(),...JSON.parse(localStorage.getItem('hg-github-config-v27')||'{}')}}catch{return inferredGithubConfig()}}
async function autoLoadSharedBackup(){if(!READONLY)return;try{const r=await fetch(`herbier-latest.hgbak?_=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;const b=await r.json();if(b?.format!=='HerbierGourmandBackup'||!b.data)return;Object.entries(b.data).forEach(([k,v])=>{if(k.startsWith('hg-')&&typeof v==='string')localStorage.setItem(k,v)});sessionStorage.setItem('hg-readonly-loaded',b.exportedAt||'loaded');}catch(e){console.warn('Sauvegarde partagée indisponible',e)}}
function applyReadonlyMode(){if(!READONLY)return;document.body.classList.add('readonly-mode');document.querySelector('header p').textContent+=' · Lecture seule';['#newRecipe','#importPaprika','#newRestaurant','#newProducer','#savePlan','#buildShopping','#addShopping','#addShoppingBottom','#clearChecks','#removeChecked','#clearShopping','#exportData','#importData','#saveToGithub','#githubSettings'].forEach(s=>{const e=$(s);if(e)e.classList.add('hidden')});$$('[data-edit],[data-edit-restaurant],#editViewedRecipe,#editViewedRestaurant,#editViewedProducer,.restaurant-card-edit,.producer-card-edit').forEach(e=>e.classList.add('hidden'));}
$('#openReadonly').onclick=()=>open(`${location.origin}${location.pathname}?readonly=1`,'_blank');
$('#githubSettings').onclick=()=>{const c=githubConfig();$('#githubOwner').value=c.owner;$('#githubRepo').value=c.repo;$('#githubBranch').value=c.branch;$('#githubPath').value=c.path;$('#githubToken').value=sessionStorage.getItem('hg-github-token-v27')||'';$('#githubDialog').showModal()};
$('#closeGithub').onclick=$('#cancelGithub').onclick=()=>$('#githubDialog').close();
$('#githubForm').onsubmit=e=>{e.preventDefault();const c={owner:$('#githubOwner').value.trim(),repo:$('#githubRepo').value.trim(),branch:$('#githubBranch').value.trim(),path:$('#githubPath').value.trim()};localStorage.setItem('hg-github-config-v27',JSON.stringify(c));sessionStorage.setItem('hg-github-token-v27',$('#githubToken').value.trim());$('#githubDialog').close();$('#githubStatus').textContent='Configuration enregistrée pour ce navigateur.'};
function bytesToBase64(text){return btoa(unescape(encodeURIComponent(text)))}
async function githubPutFile(path,text,message){const c=githubConfig(),token=sessionStorage.getItem('hg-github-token-v27');if(!c.owner||!c.repo||!token)throw new Error('Configuration GitHub ou jeton manquant');const url=`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(c.branch)}`;let sha='';const old=await fetch(url,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`}});if(old.ok)sha=(await old.json()).sha||'';else if(old.status!==404)throw new Error(`Lecture GitHub impossible (${old.status})`);const body={message,content:bytesToBase64(text),branch:c.branch,...(sha?{sha}:{})};const put=await fetch(url.split('?')[0],{method:'PUT',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!put.ok)throw new Error(`Enregistrement GitHub impossible (${put.status})`);return put.json();}
$('#saveToGithub').onclick=async()=>{try{const btn=$('#saveToGithub');btn.disabled=true;$('#githubStatus').textContent='Sauvegarde en cours…';const snap=herbierStorageSnapshot(),text=JSON.stringify(snap,null,2),c=githubConfig(),d=new Date(),pad=n=>String(n).padStart(2,'0'),dated=`backups/Herbier_Gourmand_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.hgbak`;await githubPutFile(c.path,text,`Herbier Gourmand : sauvegarde ${d.toLocaleString('fr-FR')}`);await githubPutFile(dated,text,`Herbier Gourmand : archive ${d.toLocaleString('fr-FR')}`);markBackupCreated(c.path);clearDirty();$('#githubStatus').textContent='Sauvegarde GitHub terminée. La version en lecture seule est à jour.';btn.disabled=false;}catch(e){console.error(e);$('#githubStatus').textContent=e.message;$('#saveToGithub').disabled=false;}};

function normalizeProducer(p={}){return {id:String(p.id||slug(p.name||'producteur')),name:String(p.name||'Producteur sans nom'),type:String(p.type||''),region:String(p.region||''),city:String(p.city||''),address:String(p.address||''),postalCode:String(p.postalCode||''),country:String(p.country||'Suisse'),phone:String(p.phone||''),website:String(p.website||''),hours:String(p.hours||''),products:Array.isArray(p.products)?p.products:[],tags:Array.isArray(p.tags)?p.tags:[],notes:String(p.notes||''),directSale:String(p.directSale||''),source:String(p.source||'')};}
function saveProducers(){localStorage.setItem(producerStore,JSON.stringify(producers));registerProtectedChange();markDirty()}
async function initProducers(){try{const stored=JSON.parse(localStorage.getItem(producerStore)||'null');if(stored)producers=stored;else{const r=await fetch(`producers.json?_=${Date.now()}`,{cache:'no-store'});producers=r.ok?await r.json():[];localStorage.setItem(producerStore,JSON.stringify(producers))}producers=producers.map(normalizeProducer);renderProducerFilters();renderProducers()}catch(e){console.error(e);producers=[];renderProducers()}}
function producerValues(field){return [...new Set(producers.flatMap(p=>field==='tags'?[...(p.tags||[]),...(p.products||[])]:[p[field]]).map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))}
function fillProducerSelect(id,values,label){const e=$(id),v=e.value;e.innerHTML=`<option value="">${label}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(values.includes(v))e.value=v}
function renderProducerFilters(){fillProducerSelect('#producerRegion',producerValues('region'),'Toutes les régions');fillProducerSelect('#producerCity',producerValues('city'),'Toutes les communes');fillProducerSelect('#producerType',producerValues('type'),'Tous les types');fillProducerSelect('#producerTag',producerValues('tags'),'Tous les produits');$('#producerTypeSuggestions').innerHTML=producerValues('type').map(x=>`<option value="${esc(x)}">`).join('');$('#producerRegionSuggestions').innerHTML=producerValues('region').map(x=>`<option value="${esc(x)}">`).join('');$('#producerCitySuggestions').innerHTML=producerValues('city').map(x=>`<option value="${esc(x)}">`).join('')}
function filteredProducers(){const q=norm($('#producerSearch').value),region=$('#producerRegion').value,city=$('#producerCity').value,type=$('#producerType').value,tag=$('#producerTag').value;return producers.filter(p=>(!q||norm(p.name).includes(q))&&(!region||p.region===region)&&(!city||p.city===city)&&(!type||p.type===type)&&(!tag||[...(p.tags||[]),...(p.products||[])].includes(tag))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}))}
function producerCard(p){return `<article class="restaurant-card producer-card"><button class="restaurant-card-main" data-view-producer="${esc(p.id)}"><div class="meta">${esc([p.type,p.city,p.region].filter(Boolean).join(' · '))}</div><h3>${esc(p.name)}</h3><div class="badges">${[...(p.products||[]),...(p.tags||[])].slice(0,6).map(t=>`<span>${esc(t)}</span>`).join('')}</div></button><button class="restaurant-card-edit producer-card-edit" data-edit-producer="${esc(p.id)}">Modifier</button></article>`}
function renderProducers(){const list=filteredProducers();$('#producerCount').textContent=`${list.length} adresse${list.length>1?'s':''}`;$('#producerList').innerHTML=list.map(producerCard).join('')||'<p>Aucun producteur trouvé.</p>';$$('[data-view-producer]').forEach(b=>b.onclick=()=>showProducer(b.dataset.viewProducer));$$('[data-edit-producer]').forEach(b=>b.onclick=()=>openProducer(b.dataset.editProducer));if(READONLY)applyReadonlyMode()}
['#producerSearch','#producerRegion','#producerCity','#producerType','#producerTag'].forEach(id=>{const e=$(id);e.addEventListener(e.tagName==='INPUT'?'input':'change',renderProducers)});$('#clearProducerFilters').onclick=()=>{$('#producerSearch').value='';$('#producerRegion').value='';$('#producerCity').value='';$('#producerType').value='';$('#producerTag').value='';renderProducers()};
function showProducer(id){const p=producers.find(x=>x.id===id);if(!p)return;rememberScroll('producers');viewedProducerId=id;const address=[p.address,p.postalCode,p.city,p.country].filter(Boolean).map(esc).join('<br>');$('#producerViewContent').innerHTML=`<div class="restaurant-detail-head"><div class="meta">${esc([p.type,p.region].filter(Boolean).join(' · '))}</div><h2>${esc(p.name)}</h2></div><div class="restaurant-detail-grid"><section><h3>Coordonnées</h3>${address?`<p>${address}</p>`:''}${p.phone?`<p><a href="tel:${esc(p.phone.replace(/\s/g,''))}">${esc(p.phone)}</a></p>`:''}${p.website?`<p>${linkMarkup(p.website,'Ouvrir le site internet')}</p>`:''}</section><section><h3>Horaires</h3><p>${p.hours?esc(p.hours).replace(/\n/g,'<br>'):'À compléter'}</p></section><section><h3>Produits proposés</h3><div class="badges">${[...(p.products||[]),...(p.tags||[])].map(t=>`<span>${esc(t)}</span>`).join('')||'À compléter'}</div></section><section><h3>Remarques</h3><p>${p.directSale?`<strong>Vente directe :</strong> ${esc(p.directSale)}<br>`:''}${p.notes?esc(p.notes).replace(/\n/g,'<br>'):'—'}</p></section></div>`;switchView('producerView')}
$('#backFromProducer').onclick=()=>switchView('producers');$('#editViewedProducer').onclick=()=>openProducer(viewedProducerId);
function openProducer(id){if(READONLY)return;const p=producers.find(x=>x.id===id);$('#producerDialogTitle').textContent=p?'Modifier le producteur':'Nouveau producteur';$('#producerId').value=p?.id||'';$('#producerName').value=p?.name||'';$('#producerTypeField').value=p?.type||'';$('#producerRegionField').value=p?.region||'';$('#producerCityField').value=p?.city||'';$('#producerAddress').value=p?.address||'';$('#producerPostal').value=p?.postalCode||'';$('#producerCountry').value=p?.country||'Suisse';$('#producerPhone').value=p?.phone||'';$('#producerWebsite').value=p?.website||'';$('#producerDirectSale').value=p?.directSale||'';$('#producerHours').value=p?.hours||'';$('#producerProducts').value=[...(p?.products||[]),...(p?.tags||[])].filter((x,i,a)=>a.indexOf(x)===i).join(', ');$('#producerNotes').value=p?.notes||'';$('#deleteProducer').classList.toggle('hidden',!p);$('#duplicateProducer').classList.toggle('hidden',!p);$('#producerDialog').showModal()}
$('#newProducer').onclick=()=>openProducer();$('#closeProducer').onclick=()=>$('#producerDialog').close();
function producerFromForm(newId=''){const old=producers.find(x=>x.id===$('#producerId').value),tags=$('#producerProducts').value.split(',').map(x=>x.trim()).filter(Boolean);return normalizeProducer({...old,id:newId||$('#producerId').value||slug($('#producerName').value),name:$('#producerName').value.trim(),type:$('#producerTypeField').value.trim(),region:$('#producerRegionField').value.trim(),city:$('#producerCityField').value.trim(),address:$('#producerAddress').value.trim(),postalCode:$('#producerPostal').value.trim(),country:$('#producerCountry').value.trim(),phone:$('#producerPhone').value.trim(),website:$('#producerWebsite').value.trim(),directSale:$('#producerDirectSale').value.trim(),hours:$('#producerHours').value.trim(),products:tags,tags:tags,notes:$('#producerNotes').value.trim()})}
$('#producerForm').onsubmit=e=>{e.preventDefault();const p=producerFromForm(),i=producers.findIndex(x=>x.id===p.id);if(i>=0)producers[i]=p;else producers.push(p);saveProducers();renderProducerFilters();renderProducers();$('#producerDialog').close();if(viewedProducerId===p.id)showProducer(p.id)};
$('#deleteProducer').onclick=()=>{const id=$('#producerId').value;if(id&&confirm('Supprimer définitivement ce producteur ?')){producers=producers.filter(p=>p.id!==id);saveProducers();renderProducerFilters();renderProducers();$('#producerDialog').close();switchView('producers')}};
$('#duplicateProducer').onclick=()=>{const p=producerFromForm(slug($('#producerName').value));p.name+=' (copie)';producers.push(p);saveProducers();renderProducerFilters();renderProducers();$('#producerDialog').close()};

async function checkForUpdate(){const status=$('#updateStatus');try{const remote=await fetch(`version.json?_=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());status.textContent=`À jour · v${remote.version}`}catch{status.textContent=`Hors connexion · v${APP_VERSION}`}}
let deferredPrompt;addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')}};
init().catch(e=>{console.error(e);alert('Impossible de démarrer Herbier Gourmand.')});


// v2.6 — Envie d’une sortie ?
const restaurantStore='hg-restaurants-v26';
let restaurants=[], viewedRestaurantId=null, previousRestaurantView='restaurants';
function normalizeRestaurant(r={}){return {id:String(r.id||slug(r.name||'restaurant')),name:String(r.name||'Restaurant sans nom'),tenant:String(r.tenant||''),address:String(r.address||''),postalCode:String(r.postalCode||''),city:String(r.city||''),country:String(r.country||''),phone:String(r.phone||''),phones:Array.isArray(r.phones)?r.phones:[],email:String(r.email||''),website:String(r.website||''),hours:String(r.hours||''),specialties:Array.isArray(r.specialties)?r.specialties:[],notes:String(r.notes||''),source:String(r.source||'')};}
function saveRestaurants(){localStorage.setItem(restaurantStore,JSON.stringify(restaurants));registerProtectedChange();markDirty();}
async function initRestaurants(){
  try{const stored=JSON.parse(localStorage.getItem(restaurantStore)||'null');if(stored)restaurants=stored;else{const res=await fetch(`restaurants.json?_=${Date.now()}`,{cache:'no-store'});restaurants=res.ok?await res.json():[];saveRestaurants();}restaurants=restaurants.map(normalizeRestaurant);renderRestaurantFilters();renderRestaurants();}
  catch(e){console.error(e);restaurants=[];renderRestaurants();}
}
function uniqueRestaurantValues(field){return [...new Set(restaurants.flatMap(r=>field==='specialties'?r.specialties:[r[field]]).map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));}
function fillRestaurantSelect(id,values,firstLabel){const el=$(id),current=el.value;el.innerHTML=`<option value="">${firstLabel}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(values.includes(current))el.value=current;}
function renderRestaurantFilters(){fillRestaurantSelect('#restaurantCity',uniqueRestaurantValues('city'),'Tous les lieux');fillRestaurantSelect('#restaurantCountry',uniqueRestaurantValues('country'),'Tous les pays');fillRestaurantSelect('#restaurantSpecialty',uniqueRestaurantValues('specialties'),'Toutes les spécialités');$('#restaurantCitySuggestions').innerHTML=uniqueRestaurantValues('city').map(v=>`<option value="${esc(v)}">`).join('');$('#restaurantCountrySuggestions').innerHTML=uniqueRestaurantValues('country').map(v=>`<option value="${esc(v)}">`).join('');}
function restaurantFiltered(){const q=norm($('#restaurantSearch').value),city=$('#restaurantCity').value,country=$('#restaurantCountry').value,tag=$('#restaurantSpecialty').value;return restaurants.filter(r=>(!q||norm(r.name).includes(q))&&(!city||r.city===city)&&(!country||r.country===country)&&(!tag||r.specialties.includes(tag))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));}
function restaurantCard(r){const locality=[r.postalCode,r.city,r.country].filter(Boolean).join(' · ');return `<article class="restaurant-card"><button class="restaurant-card-main" data-view-restaurant="${esc(r.id)}"><div class="meta">${esc(locality||'Lieu à compléter')}</div><h3>${esc(r.name)}</h3><div class="badges">${r.specialties.map(t=>`<span>${esc(t)}</span>`).join('')}</div></button><button class="restaurant-card-edit" data-edit-restaurant="${esc(r.id)}">Modifier</button></article>`;}
function renderRestaurants(){const found=restaurantFiltered();$('#restaurantCount').textContent=`${found.length} adresse${found.length>1?'s':''}`;$('#restaurantList').innerHTML=found.map(restaurantCard).join('')||'<p>Aucun restaurant trouvé.</p>';$$('[data-view-restaurant]').forEach(b=>b.onclick=()=>showRestaurant(b.dataset.viewRestaurant));$$('[data-edit-restaurant]').forEach(b=>b.onclick=()=>openRestaurant(b.dataset.editRestaurant));}
['#restaurantSearch','#restaurantCity','#restaurantCountry','#restaurantSpecialty'].forEach(id=>{const el=$(id);el.addEventListener(el.tagName==='INPUT'?'input':'change',renderRestaurants)});
$('#clearRestaurantFilters').onclick=()=>{$('#restaurantSearch').value='';$('#restaurantCity').value='';$('#restaurantCountry').value='';$('#restaurantSpecialty').value='';renderRestaurants();};
function linkMarkup(url,label){if(!url)return'';let href=url;if(!/^https?:\/\//i.test(href))href='https://'+href;return `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;}
function showRestaurant(id){const r=restaurants.find(x=>x.id===id);if(!r)return;rememberScroll('restaurants');viewedRestaurantId=id;previousRestaurantView='restaurants';const address=[r.address,r.postalCode,r.city,r.country].filter(Boolean).map(esc).join('<br>');$('#restaurantViewContent').innerHTML=`<div class="restaurant-detail-head"><div><div class="meta">${esc([r.city,r.country].filter(Boolean).join(' · '))}</div><h2>${esc(r.name)}</h2>${r.tenant?`<p><strong>Tenancier :</strong> ${esc(r.tenant)}</p>`:''}</div></div><div class="restaurant-detail-grid"><section><h3>Coordonnées</h3>${address?`<p>${address}</p>`:''}${r.phone?`<p><a href="tel:${esc(r.phone.replace(/\s/g,''))}">${esc(r.phone)}</a></p>`:''}${r.email?`<p><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></p>`:''}${r.website?`<p>${linkMarkup(r.website,'Ouvrir le site internet')}</p>`:''}</section><section><h3>Heures d’ouverture</h3><p>${r.hours?esc(r.hours).replace(/\n/g,'<br>'):'À compléter'}</p></section><section><h3>Spécialités</h3><div class="badges">${r.specialties.length?r.specialties.map(t=>`<span>${esc(t)}</span>`).join(''):'À compléter'}</div></section><section><h3>Remarques</h3><p>${r.notes?esc(r.notes).replace(/\n/g,'<br>'):'—'}</p></section></div>`;switchView('restaurantView');}
$('#backFromRestaurant').onclick=()=>switchView(previousRestaurantView);$('#editViewedRestaurant').onclick=()=>openRestaurant(viewedRestaurantId);
function openRestaurant(id){const r=restaurants.find(x=>x.id===id);$('#restaurantDialogTitle').textContent=r?'Modifier le restaurant':'Nouveau restaurant';$('#restaurantId').value=r?.id||'';$('#restaurantName').value=r?.name||'';$('#restaurantTenant').value=r?.tenant||'';$('#restaurantAddress').value=r?.address||'';$('#restaurantPostal').value=r?.postalCode||'';$('#restaurantCityField').value=r?.city||'';$('#restaurantCountryField').value=r?.country||'';$('#restaurantPhone').value=r?.phone||'';$('#restaurantWebsite').value=r?.website||'';$('#restaurantHours').value=r?.hours||'';$('#restaurantSpecialties').value=(r?.specialties||[]).join(', ');$('#restaurantNotes').value=r?.notes||'';$('#deleteRestaurant').classList.toggle('hidden',!r);$('#duplicateRestaurant').classList.toggle('hidden',!r);$('#restaurantDialog').showModal();}
$('#newRestaurant').onclick=()=>openRestaurant();$('#closeRestaurant').onclick=()=>$('#restaurantDialog').close();
function restaurantFromForm(newId=''){const existing=restaurants.find(x=>x.id===$('#restaurantId').value);return normalizeRestaurant({...existing,id:newId||$('#restaurantId').value||slug($('#restaurantName').value),name:$('#restaurantName').value.trim(),tenant:$('#restaurantTenant').value.trim(),address:$('#restaurantAddress').value.trim(),postalCode:$('#restaurantPostal').value.trim(),city:$('#restaurantCityField').value.trim(),country:$('#restaurantCountryField').value.trim(),phone:$('#restaurantPhone').value.trim(),website:$('#restaurantWebsite').value.trim(),hours:$('#restaurantHours').value.trim(),specialties:$('#restaurantSpecialties').value.split(',').map(x=>x.trim()).filter(Boolean),notes:$('#restaurantNotes').value.trim()});}
$('#restaurantForm').onsubmit=e=>{e.preventDefault();const r=restaurantFromForm();const i=restaurants.findIndex(x=>x.id===r.id);if(i>=0)restaurants[i]=r;else restaurants.unshift(r);saveRestaurants();renderRestaurantFilters();renderRestaurants();$('#restaurantDialog').close();if(viewedRestaurantId===r.id)showRestaurant(r.id);};
$('#deleteRestaurant').onclick=()=>{const id=$('#restaurantId').value;if(id&&confirm('Supprimer définitivement ce restaurant ?')){restaurants=restaurants.filter(r=>r.id!==id);saveRestaurants();renderRestaurantFilters();renderRestaurants();$('#restaurantDialog').close();switchView('restaurants')}};
$('#duplicateRestaurant').onclick=()=>{const r=restaurantFromForm(`${slug($('#restaurantName').value)}-${Date.now()}`);r.name+=' (copie)';restaurants.unshift(r);saveRestaurants();renderRestaurantFilters();renderRestaurants();$('#restaurantDialog').close();};
updateBackupReminder();
