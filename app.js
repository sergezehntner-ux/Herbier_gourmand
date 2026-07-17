
let recipes=[], plan=[], shopping=[];
const days=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const norm=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

async function init(){
  // Les jours doivent apparaître même si le chargement des recettes échoue.
  renderDayChoices();
  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
  try{
    const response=await fetch(`recipes.json?_=${Date.now()}`,{cache:"no-store"});
    if(!response.ok) throw new Error("recipes.json indisponible");
    recipes=await response.json();
    fillCategories();
    renderRecipes();
    loadSaved();
  }catch(error){
    console.error(error);
    $("#recipeList").innerHTML="<p>Les recettes n’ont pas pu être chargées. Appuie sur « Actualiser ».</p>";
    // Les préférences de jours restent utilisables et mémorisées.
    try{
      const storedDays=JSON.parse(localStorage.getItem("hg-selected-days")||"[0,1,2,3,4,5,6]");
      $$("[data-day]").forEach(c=>{
        c.checked=storedDays.includes(+c.dataset.day);
        c.closest(".day-choice").classList.toggle("selected",c.checked);
      });
      updateSelectedDaysStatus();
    }catch(e){}
  }
}
function switchView(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$("nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));window.scrollTo(0,0)}
$$("nav button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$("[data-go]").forEach(b=>b.onclick=()=>switchView(b.dataset.go));

function fillCategories(){[...new Set(recipes.map(r=>r.category))].sort().forEach(c=>$("#category").insertAdjacentHTML("beforeend",`<option>${c}</option>`))}
function renderRecipes(){
 const q=norm($("#search").value), cat=$("#category").value, max=+$("#maxTime").value||999;
 const found=recipes.filter(r=>(!cat||r.category===cat)&&r.time<=max&&(!q||norm(JSON.stringify(r)).includes(q)));
 $("#recipeList").innerHTML=found.map(recipeCard).join("")||"<p>Aucune recette trouvée.</p>";
 $$(".recipe-head").forEach(b=>b.onclick=()=>b.nextElementSibling.classList.toggle("open"));
}
function recipeCard(r){
 return `<article class="recipe"><button class="recipe-head"><div class="meta">${r.category} · ${r.time} min · ${r.servings} pers. · ${r.temperature}</div><h3>${r.title}</h3><div class="badges">${(r.tags || []).map(t=>`<span>${t}</span>`).join("")}</div></button>
 <div class="details"><h4>Ingrédients</h4><ul>${r.ingredients.map(i=>`<li>${i[0]} : ${i[1]} ${i[2]}</li>`).join("")}</ul><h4>Préparation</h4><ol>${r.steps.map(s=>`<li>${s}</li>`).join("")}</ol></div></article>`
}
$("#search").oninput=renderRecipes;$("#category").onchange=renderRecipes;$("#maxTime").onchange=renderRecipes;
$("#surpriseBtn").onclick=()=>{$("#surpriseCard").innerHTML=recipeCard(recipes[Math.floor(Math.random()*recipes.length)]);$("#surpriseCard .recipe-head").onclick=e=>e.currentTarget.nextElementSibling.classList.toggle("open")};

function renderDayChoices(){
 $("#dayChoices").innerHTML=days.map((d,i)=>`<label class="day-choice selected" role="button" tabindex="0"><input type="checkbox" data-day="${i}" checked><span>${d}</span></label>`).join("");
 $$(".day-choice").forEach(label=>{
   const box=label.querySelector("[data-day]");
   const toggle=()=>{
     box.checked=!box.checked;
     box.dispatchEvent(new Event("change"));
   };
   label.addEventListener("click",event=>{
     event.preventDefault();
     toggle();
   });
   label.addEventListener("keydown",event=>{
     if(event.key==="Enter"||event.key===" "){event.preventDefault();toggle();}
   });
 });
 $$("[data-day]").forEach(box=>box.addEventListener("change",()=>{
   box.closest(".day-choice").classList.toggle("selected",box.checked);
   updateSelectedDaysStatus();
   syncPlanWithSelectedDays();
   saveDayPreferences();
 }));
 $("#selectAllDays").onclick=()=>{
   $$("[data-day]").forEach(box=>{box.checked=true;box.closest(".day-choice").classList.add("selected")});
   updateSelectedDaysStatus();syncPlanWithSelectedDays();saveDayPreferences();
 };
 $("#clearAllDays").onclick=()=>{
   $$("[data-day]").forEach(box=>{box.checked=false;box.closest(".day-choice").classList.remove("selected")});
   updateSelectedDaysStatus();syncPlanWithSelectedDays();saveDayPreferences();
 };
 updateSelectedDaysStatus();
}
function selectedDayIndexes(){return $$("[data-day]:checked").map(x=>+x.dataset.day)}
function updateSelectedDaysStatus(){
 const n=selectedDayIndexes().length;
 $("#selectedDaysStatus").textContent=`${n} jour${n>1?"s":""} sélectionné${n>1?"s":""}`;
}
function saveDayPreferences(){
 localStorage.setItem("hg-selected-days",JSON.stringify(selectedDayIndexes()));
}
function syncPlanWithSelectedDays(){
 if(!plan.length) return;
 const selected=selectedDayIndexes();
 plan=plan.filter(item=>selected.includes(item.dayIndex));
 const used=new Set(plan.map(item=>item.dayIndex));
 const mode=$("#mealTemp").value, maxTime=+$("#planTime").value||999;
 const maxMeat=Math.floor(selected.length/3);
 for(const dayIndex of selected){
   if(used.has(dayIndex)) continue;
   const currentMeat=plan.filter(x=>x.recipe.avecViande).length;
   let choices=recipes.filter(r=>r.time<=maxTime && temperatureAccepted(r,mode) && (!r.avecViande || currentMeat<maxMeat));
   choices=choices.filter(r=>!plan.some(x=>x.recipe.id===r.id));
   if(!choices.length) choices=recipes.filter(r=>!r.avecViande);
   const recipe=choices[Math.floor(Math.random()*choices.length)];
   if(recipe) plan.push({dayIndex,recipe});
 }
 plan.sort((a,b)=>a.dayIndex-b.dayIndex);
 renderPlan();
}
function seasonalTemp(){
 const m=new Date().getMonth()+1;
 return (m>=5 && m<=9) ? "froid" : "chaud";
}
function temperatureAccepted(r, mode){
 if(mode==="mixte") return true;
 if(mode==="saisonnier") mode=seasonalTemp();
 return r.temperature===mode || r.temperature==="les-deux";
}
function shuffled(arr){return [...arr].sort(()=>Math.random()-.5)}

function choosePlan(defaultMenu=false){
 const selected=selectedDayIndexes();
 if(!selected.length) return alert("Choisis au moins un jour.");
 const maxTime=+$("#planTime").value||999;
 const mode=$("#mealTemp").value;
 let pool=recipes.filter(r=>r.time<=maxTime && temperatureAccepted(r,mode));
 if(pool.length<selected.length) pool=recipes.filter(r=>temperatureAccepted(r,mode));
 if(pool.length<selected.length) pool=recipes;

 const maxMeat=Math.floor(selected.length/3);
 const meat=shuffled(pool.filter(r=>r.avecViande)).slice(0,maxMeat);
 const nonMeat=shuffled(pool.filter(r=>!r.avecViande));
 const picked=[];
 let meatUsed=0;

 for(let i=0;i<selected.length;i++){
   const allowMeat=meatUsed<maxMeat && meat.length && (i%3===2 || nonMeat.length<selected.length-i);
   let r;
   if(allowMeat){r=meat.shift();meatUsed++}
   else r=nonMeat.shift() || meat.shift();
   if(r) picked.push({dayIndex:selected[i],recipe:r});
 }
 plan=picked;
 renderPlan();
}
$("#generatePlan").onclick=()=>choosePlan(false);
$("#defaultPlan").onclick=()=>choosePlan(false);

function renderPlan(){
 if(!plan.length){$("#weekPlan").innerHTML="";return}
 const meatCount=plan.filter(x=>x.recipe.avecViande).length;
 const maxMeat=Math.floor(plan.length/3);
 $("#weekPlan").innerHTML=`<div class="notice rule-ok"><strong>${plan.length} repas planifiés :</strong> ${meatCount} avec viande, maximum autorisé ${maxMeat}.</div>`+
 plan.map((item,i)=>{const r=item.recipe;return `<article class="day"><div class="day-top"><div><div class="meta">${days[item.dayIndex]} · ${r.time} min · ${r.temperature}</div><h3>${r.title}</h3></div><button data-replace="${i}">Remplacer</button></div>
 <select data-choice="${i}">${compatibleChoices(i).map(x=>`<option value="${x.id}" ${x.id===r.id?"selected":""}>${x.title} (${x.time} min)</option>`).join("")}</select>
 <details><summary>Voir la recette</summary><ul>${scaledIngredients(r).map(x=>`<li>${x}</li>`).join("")}</ul><ol>${r.steps.map(s=>`<li>${s}</li>`).join("")}</ol></details></article>`}).join("");
 $$("[data-choice]").forEach(s=>s.onchange=()=>{plan[+s.dataset.choice].recipe=recipes.find(r=>r.id===s.value);renderPlan()});
 $$("[data-replace]").forEach(b=>b.onclick=()=>replaceOne(+b.dataset.replace));
}
function compatibleChoices(index){
 const mode=$("#mealTemp").value, maxTime=+$("#planTime").value||999;
 const otherMeat=plan.filter((x,i)=>i!==index && x.recipe.avecViande).length;
 const maxMeat=Math.floor(plan.length/3);
 return recipes.filter(r=>r.time<=maxTime && temperatureAccepted(r,mode) && (!r.avecViande || otherMeat<maxMeat));
}
function replaceOne(index){
 const choices=compatibleChoices(index).filter(r=>!plan.some((x,i)=>i!==index&&x.recipe.id===r.id));
 if(!choices.length) return alert("Aucune autre recette compatible avec ces règles.");
 plan[index].recipe=choices[Math.floor(Math.random()*choices.length)];
 renderPlan();
}
function scaledIngredients(r){
 const factor=(+$("#people").value||4)/r.servings;
 return r.ingredients.map(([n,q,u])=>`${n} : ${typeof q==="number"?(Math.round(q*factor*10)/10):q} ${u}`);
}
$("#people").onchange=()=>{
 localStorage.setItem("hg-people",String(+$("#people").value||4));
 if(plan.length)renderPlan();
};

$("#savePlan").onclick=()=>{
 const selected=selectedDayIndexes();
 localStorage.setItem("hg-plan",JSON.stringify({people:+$("#people").value,days:selected,temp:$("#mealTemp").value,time:$("#planTime").value,items:plan.map(x=>({dayIndex:x.dayIndex,id:x.recipe.id}))}));
 alert("Planning enregistré sur cet appareil.");
};
function loadSaved(){
 try{
  const savedPeople=+localStorage.getItem("hg-people");
  if(savedPeople>=1 && savedPeople<=12) $("#people").value=savedPeople;
  const s=JSON.parse(localStorage.getItem("hg-plan"));
  if(s){
    $("#people").value=s.people||savedPeople||4;localStorage.setItem("hg-people",String(+$("#people").value||4));$("#mealTemp").value=s.temp||"saisonnier";$("#planTime").value=s.time||"";
    const storedDays=Array.isArray(s.days)&&s.days.length?s.days:JSON.parse(localStorage.getItem("hg-selected-days")||"[0,1,2,3,4,5,6]");
    $$("[data-day]").forEach(c=>{
      c.checked=storedDays.includes(+c.dataset.day);
      c.closest(".day-choice").classList.toggle("selected",c.checked);
    });
    updateSelectedDaysStatus();
    plan=(s.items||[]).map(x=>({dayIndex:x.dayIndex,recipe:recipes.find(r=>r.id===x.id)})).filter(x=>x.recipe && storedDays.includes(x.dayIndex));
    renderPlan();
  }
  if(!s){
    const storedDays=JSON.parse(localStorage.getItem("hg-selected-days")||"[0,1,2,3,4,5,6]");
    $$("[data-day]").forEach(c=>{
      c.checked=storedDays.includes(+c.dataset.day);
      c.closest(".day-choice").classList.toggle("selected",c.checked);
    });
    updateSelectedDaysStatus();
  }
  const sh=JSON.parse(localStorage.getItem("hg-shopping"));if(sh){shopping=sh;renderShopping()}
 }catch(e){}
}
$("#buildShopping").onclick=()=>{
 if(!plan.length)return alert("Génère d’abord un planning.");
 const people=(+$("#people").value||4), map={};
 plan.forEach(item=>item.recipe.ingredients.forEach(([n,q,u])=>{
   const key=norm(n)+"|"+u, amount=typeof q==="number"?q*people/item.recipe.servings:q;
   if(!map[key])map[key]={name:n,qty:0,unit:u,checked:false};
   if(typeof amount==="number")map[key].qty+=amount
 }));
 shopping=Object.values(map).sort((a,b)=>a.name.localeCompare(b.name));
 localStorage.setItem("hg-shopping",JSON.stringify(shopping));renderShopping();switchView("shopping")
};
function renderShopping(){
 $("#shoppingList").innerHTML=`<div class="shop-group">${shopping.map((x,i)=>`<label class="shop-item ${x.checked?"checked":""}"><input type="checkbox" data-shop="${i}" ${x.checked?"checked":""}><span>${x.name} — ${Math.round(x.qty*10)/10} ${x.unit}</span></label>`).join("")}</div>`;
 $$("[data-shop]").forEach(c=>c.onchange=()=>{shopping[+c.dataset.shop].checked=c.checked;localStorage.setItem("hg-shopping",JSON.stringify(shopping));renderShopping()})
}
$("#clearChecks").onclick=()=>{shopping.forEach(x=>x.checked=false);localStorage.setItem("hg-shopping",JSON.stringify(shopping));renderShopping()};
$("#printPlan").onclick=()=>window.print();$("#printShopping").onclick=()=>window.print();

let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").classList.remove("hidden")});
$("#installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#installBtn").classList.add("hidden")}};

init();


const APP_VERSION="2.4.3";
const UPDATE_RELOAD_KEY="hg-update-reload";

async function clearAppCaches(){
  if(!("caches" in window)) return;
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith("herbier-")).map(k=>caches.delete(k)));
}
async function activateWaitingWorker(){
  if(!("serviceWorker" in navigator)) return;
  const registration=await navigator.serviceWorker.getRegistration();
  if(registration?.waiting) registration.waiting.postMessage({type:"SKIP_WAITING"});
  await registration?.update();
}
async function reloadFresh(reason){
  sessionStorage.setItem(UPDATE_RELOAD_KEY,reason);
  const url=new URL(window.location.href);
  url.searchParams.set("_v",Date.now().toString());
  window.location.replace(url.toString());
}
async function forceLatestVersion(){
  const status=$("#updateStatus");
  try{
    status.textContent="Actualisation…";
    status.className="update-status loading";
    await activateWaitingWorker();
    await clearAppCaches();
    await reloadFresh("manual");
  }catch(e){
    status.textContent="Échec de mise à jour";
    status.className="update-status error";
  }
}
async function checkForUpdate(){
  const status=$("#updateStatus");
  try{
    status.textContent="Vérification…";
    status.className="update-status loading";
    await activateWaitingWorker();
    const response=await fetch(`version.json?_=${Date.now()}`,{
      cache:"no-store",
      headers:{"Cache-Control":"no-cache, no-store, must-revalidate","Pragma":"no-cache"}
    });
    if(!response.ok) throw new Error("version.json indisponible");
    const remote=await response.json();
    const lastReload=sessionStorage.getItem(UPDATE_RELOAD_KEY);
    if(remote.version!==APP_VERSION && lastReload!=="automatic"){
      status.textContent=`Mise à jour vers v${remote.version}…`;
      status.className="update-status loading";
      await clearAppCaches();
      await activateWaitingWorker();
      await reloadFresh("automatic");
      return;
    }
    sessionStorage.removeItem(UPDATE_RELOAD_KEY);
    status.textContent=`À jour · v${APP_VERSION}`;
    status.className="update-status ok";
  }catch(e){
    status.textContent="Mode hors connexion";
    status.className="update-status error";
  }
}
window.addEventListener("load",()=>{
  checkForUpdate();
  $("#forceUpdateBtn")?.addEventListener("click",forceLatestVersion);
});
navigator.serviceWorker?.addEventListener("controllerchange",()=>{
  if(!sessionStorage.getItem("hg-controller-reloaded")){
    sessionStorage.setItem("hg-controller-reloaded","1");
    window.location.reload();
  }
});
