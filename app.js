let recipes = [], plan = [], shopping = [];
const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const slots = ["Midi", "Soir"];
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const recipeStore = "hg-recipes-v26";
const planStore = "hg-plan-v26";
const shoppingStore = "hg-shopping-v26";
const slotStore = "hg-day-slots-v26";

const saveRecipes = () => localStorage.setItem(recipeStore, JSON.stringify(recipes));
const customRecipes = () => JSON.parse(localStorage.getItem(recipeStore) || "null");

async function init() {
  renderDaySlotChoices();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
  const stored = customRecipes();
  if (stored) recipes = stored;
  else {
    const response = await fetch(`recipes.json?_=${Date.now()}`, {cache: "no-store"});
    recipes = await response.json();
  }
  fillCategories();
  renderRecipes();
  loadSaved();
}

function switchView(id) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === id));
  $$("nav button").forEach(b => b.classList.toggle("active", b.dataset.view === id));
  scrollTo(0, 0);
}
$$('nav button').forEach(b => b.onclick = () => switchView(b.dataset.view));
$$('[data-go]').forEach(b => b.onclick = () => switchView(b.dataset.go));

function fillCategories() {
  const old = $('#category').value;
  $('#category').innerHTML = '<option value="">Toutes catégories</option>' +
    [...new Set(recipes.map(r => r.category).filter(Boolean))].sort().map(c => `<option>${esc(c)}</option>`).join('');
  $('#category').value = old;
}

function recipeCard(r) {
  return `<article class="recipe"><button class="recipe-head" data-open="${esc(r.id)}"><div class="meta">${esc(r.category)} · ${r.time} min · ${r.servings} pers. · ${esc(r.temperature)}</div><h3>${esc(r.title)}</h3><div class="badges">${(r.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div></button><div class="details"><h4>Ingrédients</h4><ul>${r.ingredients.map(i => `<li>${esc(i[0])} : ${esc(i[1])} ${esc(i[2])}</li>`).join('')}</ul><h4>Préparation</h4><ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><div class="recipe-actions"><button data-edit="${esc(r.id)}">Modifier</button><button data-print-recipe="${esc(r.id)}">Imprimer la recette</button></div></div></article>`;
}
function bindRecipeCards(root = document) {
  root.querySelectorAll('.recipe-head').forEach(b => b.onclick = () => b.nextElementSibling.classList.toggle('open'));
  root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openRecipe(b.dataset.edit));
  root.querySelectorAll('[data-print-recipe]').forEach(b => b.onclick = () => printRecipe(recipes.find(r => r.id === b.dataset.printRecipe)));
}
function renderRecipes() {
  const q = norm($('#search').value), cat = $('#category').value, max = +$('#maxTime').value || 999;
  const found = recipes.filter(r => (!cat || r.category === cat) && r.time <= max && (!q || norm(JSON.stringify(r)).includes(q)));
  $('#recipeCount').textContent = `${found.length} recette${found.length > 1 ? 's' : ''}`;
  $('#recipeList').innerHTML = found.map(recipeCard).join('') || '<p>Aucune recette trouvée.</p>';
  bindRecipeCards($('#recipeList'));
}
$('#search').oninput = renderRecipes;
$('#category').onchange = renderRecipes;
$('#maxTime').onchange = renderRecipes;
$('#surpriseBtn').onclick = () => {
  if (!recipes.length) return;
  $('#surpriseCard').innerHTML = recipeCard(recipes[Math.floor(Math.random() * recipes.length)]);
  bindRecipeCards($('#surpriseCard'));
};

function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36); }
function openRecipe(id) {
  const r = recipes.find(x => x.id === id);
  $('#recipeDialogTitle').textContent = r ? 'Modifier la recette' : 'Nouvelle recette';
  $('#recipeId').value = r?.id || '';
  $('#recipeTitle').value = r?.title || '';
  $('#recipeCategory').value = r?.category || '';
  $('#recipeTime').value = r?.time || 30;
  $('#recipeServings').value = r?.servings || 4;
  $('#recipeTemperature').value = r?.temperature || 'chaud';
  $('#recipeMeat').checked = !!r?.avecViande;
  $('#recipeIngredients').value = (r?.ingredients || []).map(i => i.join(' | ')).join('\n');
  $('#recipeSteps').value = (r?.steps || []).join('\n');
  $('#recipeTags').value = (r?.tags || []).join(', ');
  $('#deleteRecipe').classList.toggle('hidden', !r);
  $('#duplicateRecipe').classList.toggle('hidden', !r);
  $('#recipeDialog').showModal();
}
$('#newRecipe').onclick = () => openRecipe();
$('#closeRecipe').onclick = () => $('#recipeDialog').close();
function formRecipe(newId = false) {
  const ingredients = $('#recipeIngredients').value.split('\n').map(x => x.trim()).filter(Boolean).map(line => {
    const [n, q = '', u = ''] = line.split('|').map(x => x.trim());
    const number = Number(String(q).replace(',', '.'));
    return [n, Number.isFinite(number) && q !== '' ? number : q, u];
  });
  return {id: newId || $('#recipeId').value || slug($('#recipeTitle').value), title: $('#recipeTitle').value.trim(), category: $('#recipeCategory').value.trim(), time: +$('#recipeTime').value, servings: +$('#recipeServings').value, temperature: $('#recipeTemperature').value, avecViande: $('#recipeMeat').checked, ingredients, steps: $('#recipeSteps').value.split('\n').map(x => x.trim()).filter(Boolean), tags: $('#recipeTags').value.split(',').map(x => x.trim()).filter(Boolean)};
}
$('#recipeForm').onsubmit = e => {
  e.preventDefault();
  const r = formRecipe();
  const i = recipes.findIndex(x => x.id === r.id);
  if (i >= 0) recipes[i] = r; else recipes.unshift(r);
  saveRecipes(); fillCategories(); renderRecipes(); $('#recipeDialog').close();
};
$('#deleteRecipe').onclick = () => {
  const id = $('#recipeId').value;
  if (id && confirm('Supprimer définitivement cette recette ?')) {
    recipes = recipes.filter(r => r.id !== id); saveRecipes(); fillCategories(); renderRecipes(); $('#recipeDialog').close();
  }
};
$('#duplicateRecipe').onclick = () => {
  const r = formRecipe(slug($('#recipeTitle').value)); r.title += ' (copie)'; recipes.unshift(r); saveRecipes(); fillCategories(); renderRecipes(); $('#recipeDialog').close();
};

function defaultDaySlots() {
  return Object.fromEntries(days.map((_, i) => [i, {Midi: true, Soir: true}]));
}
function readDaySlots() {
  try { return {...defaultDaySlots(), ...JSON.parse(localStorage.getItem(slotStore) || '{}')}; }
  catch { return defaultDaySlots(); }
}
function renderDaySlotChoices() {
  const state = readDaySlots();
  $('#daySlotChoices').innerHTML = days.map((day, i) => `<div class="day-slot-row"><strong>${day}</strong>${slots.map(slot => `<label class="mini-slot ${state[i]?.[slot] ? 'selected' : ''}"><input type="checkbox" data-day-slot="${i}" data-slot="${slot}" ${state[i]?.[slot] ? 'checked' : ''}><span>${slot}</span></label>`).join('')}</div>`).join('');
  $$('[data-day-slot]').forEach(c => c.onchange = () => {
    c.parentElement.classList.toggle('selected', c.checked);
    saveDaySlots(); updateSlotStatus();
  });
  updateSlotStatus();
}
function saveDaySlots() {
  const state = defaultDaySlots();
  Object.keys(state).forEach(k => slots.forEach(slot => state[k][slot] = false));
  $$('[data-day-slot]').forEach(c => state[c.dataset.daySlot][c.dataset.slot] = c.checked);
  localStorage.setItem(slotStore, JSON.stringify(state));
}
function selectedDaySlots() {
  return $$('[data-day-slot]:checked').map(c => ({dayIndex: +c.dataset.daySlot, slot: c.dataset.slot}));
}
function updateSlotStatus() {
  const n = selectedDaySlots().length;
  $('#selectedSlotsStatus').textContent = `${n} repas à planifier`;
}
$('#allDaySlots').onclick = () => { $$('[data-day-slot]').forEach(c => {c.checked = true; c.parentElement.classList.add('selected')}); saveDaySlots(); updateSlotStatus(); };
$('#clearDaySlots').onclick = () => { $$('[data-day-slot]').forEach(c => {c.checked = false; c.parentElement.classList.remove('selected')}); saveDaySlots(); updateSlotStatus(); };
$('#weekEvenings').onclick = () => { $$('[data-day-slot]').forEach(c => {c.checked = c.dataset.slot === 'Soir'; c.parentElement.classList.toggle('selected', c.checked)}); saveDaySlots(); updateSlotStatus(); };

function choices(exclude = []) {
  const max = +$('#planTime').value || 999;
  let pool = recipes.filter(r => r.time <= max && !exclude.includes(r.id));
  if (!pool.length) pool = recipes.filter(r => !exclude.includes(r.id));
  return pool;
}
function pickRandom(pool) { return pool[Math.floor(Math.random() * pool.length)]; }
$('#generatePlan').onclick = () => {
  const targets = selectedDaySlots();
  if (!targets.length) return alert('Choisis au moins un repas dans la semaine.');
  plan = [];
  const used = [];
  const meatLimit = Math.floor(targets.length / 3);
  let meatCount = 0;
  const meatDays = new Set();
  targets.sort((a, b) => a.dayIndex - b.dayIndex || slots.indexOf(a.slot) - slots.indexOf(b.slot)).forEach(target => {
    let pool = choices(used);
    const mayUseMeat = meatCount < meatLimit && !meatDays.has(target.dayIndex);
    const preferred = pool.filter(r => !r.avecViande || mayUseMeat);
    if (preferred.length) pool = preferred;
    if (!pool.length) pool = choices([]).filter(r => !r.avecViande || mayUseMeat);
    let recipe = pickRandom(pool);
    if (!recipe) return;
    if (recipe.avecViande && (!mayUseMeat || meatCount >= meatLimit)) {
      const vegetarian = choices(used).filter(r => !r.avecViande);
      if (vegetarian.length) recipe = pickRandom(vegetarian);
    }
    plan.push({...target, recipe});
    used.push(recipe.id);
    if (recipe.avecViande) { meatCount++; meatDays.add(target.dayIndex); }
  });
  renderPlan();
};
function scaled(r) {
  const f = (+$('#people').value || 4) / (r.servings || 4);
  return r.ingredients.map(([n, q, u]) => `${n} : ${typeof q === 'number' ? Math.round(q * f * 10) / 10 : q} ${u}`);
}
function renderPlan() {
  if (!plan.length) { $('#weekPlan').innerHTML = '<p class="muted">Aucun repas planifié.</p>'; return; }
  const plannedDays = [...new Set(plan.map(x => x.dayIndex))].sort((a, b) => a - b);
  const meatCount = plan.filter(x => x.recipe.avecViande).length;
  $('#weekPlan').innerHTML = `<p class="rule-status">Viande : <strong>${meatCount}/${plan.length}</strong> repas (maximum autorisé : ${Math.floor(plan.length / 3)})</p>` + plannedDays.map(d => {
    const meals = plan.filter(x => x.dayIndex === d).sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));
    return `<article class="day"><h3>${days[d]}</h3>${meals.map(m => {
      const idx = plan.indexOf(m), r = m.recipe;
      return `<div class="meal"><div><strong>${m.slot}</strong>${r.avecViande ? '<span class="meat-badge">viande</span>' : ''}<div class="meta">${r.time} min</div><h4>${esc(r.title)}</h4></div><select data-plan="${idx}">${choices([]).map(x => `<option value="${esc(x.id)}" ${x.id === r.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select><details><summary>Voir la recette</summary><ul>${scaled(r).map(x => `<li>${esc(x)}</li>`).join('')}</ul><ol>${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol><button data-print-plan-recipe="${idx}">Imprimer cette recette</button></details></div>`;
    }).join('')}</article>`;
  }).join('');
  $$('[data-plan]').forEach(s => s.onchange = () => { plan[+s.dataset.plan].recipe = recipes.find(r => r.id === s.value); renderPlan(); });
  $$('[data-print-plan-recipe]').forEach(b => b.onclick = () => printRecipe(plan[+b.dataset.printPlanRecipe].recipe));
}
$('#people').onchange = () => { localStorage.setItem('hg-people', $('#people').value); renderPlan(); };
$('#clearPlan').onclick = () => { if (confirm('Vider le planning ?')) { plan = []; localStorage.removeItem(planStore); renderPlan(); } };
$('#savePlan').onclick = () => {
  localStorage.setItem(planStore, JSON.stringify({people: +$('#people').value, time: $('#planTime').value, items: plan.map(x => ({dayIndex: x.dayIndex, slot: x.slot, id: x.recipe.id}))}));
  alert('Planning enregistré.');
};
$('#buildShopping').onclick = () => {
  if (!plan.length) return alert('Génère d’abord un planning.');
  const factorPeople = (+$('#people').value || 4);
  shopping = [];
  plan.forEach(m => m.recipe.ingredients.forEach(([name, q, unit]) => {
    const factor = factorPeople / (m.recipe.servings || 4);
    shopping.push({name, qty: typeof q === 'number' ? q * factor : 0, text: typeof q === 'number' ? '' : q, unit, checked: false});
  }));
  saveShopping(); renderShopping(); switchView('shopping');
};
function saveShopping() { localStorage.setItem(shoppingStore, JSON.stringify(shopping)); }
function renderShopping() {
  if (!shopping.length) { $('#shoppingList').innerHTML = '<p class="muted">La liste est vide.</p>'; return; }
  shopping.sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name));
  $('#shoppingList').innerHTML = `<div class="shop-group">${shopping.map((x, i) => `<label class="shop-item ${x.checked ? 'checked' : ''}"><input type="checkbox" data-shop="${i}" ${x.checked ? 'checked' : ''}><span><strong>${esc(x.name)}</strong>${x.qty ? ` — ${Math.round(x.qty * 10) / 10} ${esc(x.unit)}` : x.text ? ` — ${esc(x.text)} ${esc(x.unit)}` : ''}</span></label>`).join('')}</div>`;
  $$('[data-shop]').forEach(c => c.onchange = () => { shopping[+c.dataset.shop].checked = c.checked; saveShopping(); renderShopping(); });
}
$('#addShopping').onclick = () => { const name = prompt('Article à ajouter :'); if (name?.trim()) { shopping.push({name: name.trim(), qty: 0, unit: '', checked: false}); saveShopping(); renderShopping(); } };
$('#clearChecks').onclick = () => { shopping.forEach(x => x.checked = false); saveShopping(); renderShopping(); };
$('#removeChecked').onclick = () => { shopping = shopping.filter(x => !x.checked); saveShopping(); renderShopping(); };
$('#clearShopping').onclick = () => { if (confirm('Vider toute la liste de courses ?')) { shopping = []; saveShopping(); renderShopping(); } };

function printDocument(title, body) {
  const w = open('', '_blank', 'width=900,height=700');
  if (!w) return alert("Le navigateur a bloqué la fenêtre d’impression.");
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{margin:10mm}body{font-family:Arial,sans-serif;color:#202820;max-width:850px;margin:0 auto;font-size:11pt;line-height:1.18}h1,h2,h3{font-family:Georgia,serif;margin:.25em 0}h1{font-size:20pt}h2{font-size:15pt}h3{font-size:12pt}.print-day{border:1px solid #bbb;border-radius:6px;padding:6px 8px;margin:5px 0;break-inside:avoid}.print-meal{border-top:1px solid #ddd;padding-top:4px;margin-top:4px}.print-meal:first-of-type{border-top:0}.print-meal p{margin:2px 0}.columns{display:grid;grid-template-columns:1fr 1.4fr;gap:16px}ul,ol{padding-left:18px;margin:4px 0}li{margin:1px 0}.shop-print{columns:2;column-gap:25px}.shop-print li{padding:1px 0;break-inside:avoid}.done{text-decoration:line-through;color:#777}@media print{body{max-width:none}.print-day{break-inside:avoid;page-break-inside:avoid}}</style></head><body>${body}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 250);
}
function printPlan() {
  if (!plan.length) return alert('Aucun planning à imprimer.');
  const people = +$('#people').value || 4;
  const plannedDays = [...new Set(plan.map(x => x.dayIndex))].sort((a, b) => a - b);
  const body = `<h1>Planning de la semaine</h1><p>${people} personne${people > 1 ? 's' : ''}</p>` + plannedDays.map(d => `<section class="print-day"><h2>${days[d]}</h2>${plan.filter(x => x.dayIndex === d).sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot)).map(m => `<div class="print-meal"><strong>${m.slot}</strong> — ${esc(m.recipe.title)} <small>(${m.recipe.time} min)</small></div>`).join('')}</section>`).join('');
  printDocument('Planning Herbier Gourmand', body);
}
function printRecipe(r) {
  if (!r) return;
  const people = +$('#people').value || r.servings || 4;
  const body = `<h1>${esc(r.title)}</h1><p><strong>${r.time} min</strong> · ${people} personne${people > 1 ? 's' : ''} · ${esc(r.category || '')}</p><div class="columns"><section><h2>Ingrédients</h2><ul>${scaled(r).map(x => `<li>${esc(x)}</li>`).join('')}</ul></section><section><h2>Préparation</h2><ol>${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></section></div>${(r.tags || []).length ? `<p><strong>Repères :</strong> ${(r.tags || []).map(esc).join(', ')}</p>` : ''}`;
  printDocument(r.title, body);
}
function printShopping() {
  if (!shopping.length) return alert('La liste de courses est vide.');
  const body = `<h1>Liste de courses</h1><ul class="shop-print">${shopping.map(x => `<li class="${x.checked ? 'done' : ''}">☐ ${esc(x.name)}${x.qty ? ` — ${Math.round(x.qty * 10) / 10} ${esc(x.unit)}` : x.text ? ` — ${esc(x.text)} ${esc(x.unit)}` : ''}</li>`).join('')}</ul>`;
  printDocument('Liste de courses', body);
}
$('#printPlan').onclick = printPlan;
$('#printShopping').onclick = printShopping;

function loadSaved() {
  const p = +localStorage.getItem('hg-people'); if (p) $('#people').value = p;
  try {
    const s = JSON.parse(localStorage.getItem(planStore) || localStorage.getItem('hg-plan-v25') || 'null');
    if (s) {
      $('#people').value = s.people || 4; $('#planTime').value = s.time || '';
      plan = (s.items || []).map(x => ({...x, recipe: recipes.find(r => r.id === x.id)})).filter(x => x.recipe); renderPlan();
    }
    shopping = JSON.parse(localStorage.getItem(shoppingStore) || localStorage.getItem('hg-shopping-v25') || '[]'); renderShopping();
  } catch (e) { console.error(e); }
}
let deferredPrompt;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').classList.remove('hidden'); });
$('#installBtn').onclick = async () => { if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').classList.add('hidden'); } };
init().catch(e => { console.error(e); $('#recipeList').innerHTML = '<p>Impossible de charger les recettes.</p>'; });
