
let recipes=[], plan=[], shopping=[];
const days=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const norm=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

async function init(){
  recipes=await fetch("recipes.json").then(r=>r.json());
  fillCategories(); renderRecipes(); renderDayChoices(); loadSaved();
  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
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
 return `<article class="recipe"><button class="recipe-head"><div class="meta">${r.category} · ${r.time} min · ${r.servings} pers. · ${r.temperature}</div><h3>${r.title}</h3><div class="badges">${r.tags.map(t=>`<span>${t}</span>`).join("")}</div></button>
 <div class="details"><h4>Ingrédients</h4><ul>${r.ingredients.map(i=>`<li>${i[0]} : ${i[1]} ${i[2]}</li>`).join("")}</ul><h4>Préparation</h4><ol>${r.steps.map(s=>`<li>${s}</li>`).join("")}</ol></div></article>`
}
$("#search").oninput=renderRecipes;$("#category").onchange=renderRecipes;$("#maxTime").onchange=renderRecipes;
$("#surpriseBtn").onclick=()=>{$("#surpriseCard").innerHTML=recipeCard(recipes[Math.floor(Math.random()*recipes.length)]);$("#surpriseCard .recipe-head").onclick=e=>e.currentTarget.nextElementSibling.classList.toggle("open")};

function renderDayChoices(){
 $("#dayChoices").innerHTML=days.map((d,i)=>`<label class="day-choice"><input type="checkbox" data-day="${i}" checked><span>${d}</span></label>`).join("");
}
function selectedDayIndexes(){return $$("[data-day]:checked").map(x=>+x.dataset.day)}
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
$("#people").onchange=()=>{if(plan.length)renderPlan()};

$("#savePlan").onclick=()=>{
 const selected=selectedDayIndexes();
 localStorage.setItem("hg-plan",JSON.stringify({people:+$("#people").value,days:selected,temp:$("#mealTemp").value,time:$("#planTime").value,items:plan.map(x=>({dayIndex:x.dayIndex,id:x.recipe.id}))}));
 alert("Planning enregistré sur cet appareil.");
};
function loadSaved(){
 try{
  const s=JSON.parse(localStorage.getItem("hg-plan"));
  if(s){
    $("#people").value=s.people||4;$("#mealTemp").value=s.temp||"saisonnier";$("#planTime").value=s.time||"";
    $$("[data-day]").forEach(c=>c.checked=(s.days||[]).includes(+c.dataset.day));
    plan=(s.items||[]).map(x=>({dayIndex:x.dayIndex,recipe:recipes.find(r=>r.id===x.id)})).filter(x=>x.recipe);
    renderPlan();
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
