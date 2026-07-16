
let recipes=[], favOnly=false;
const favs=new Set(JSON.parse(localStorage.getItem("hg-favs")||"[]"));
const $=s=>document.querySelector(s);
const norm=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
async function init(){recipes=await fetch("recipes.json").then(r=>r.json());fill();bind();render();if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js")}
function fill(){[...new Set(recipes.map(r=>r.category))].sort().forEach(x=>$("#category").insertAdjacentHTML("beforeend",`<option>${x}</option>`));[...new Set(recipes.flatMap(r=>r.tags))].sort().forEach(x=>$("#tag").insertAdjacentHTML("beforeend",`<option>${x}</option>`))}
function bind(){
$("#search").oninput=render;$("#category").onchange=render;$("#tag").onchange=render;
$("#favOnly").onclick=()=>{favOnly=!favOnly;$("#favOnly").classList.toggle("active",favOnly);render()};
$("#grid").onclick=e=>{let f=e.target.closest("[data-fav]");if(f){toggle(f.dataset.fav);return}let o=e.target.closest("[data-open]");if(o)openRecipe(o.dataset.open)};
$("#close").onclick=()=>$("#dialog").close();$("#home").onclick=()=>window.scrollTo({top:0,behavior:"smooth"});
$("#random").onclick=()=>{let p=filtered();if(p.length)openRecipe(p[Math.floor(Math.random()*p.length)].id)};
$("#favorites").onclick=()=>{favOnly=true;$("#favOnly").classList.add("active");render();window.scrollTo({top:0,behavior:"smooth"})};
$("#pdfCurrent").onclick=()=>printRecipes(filtered(),"Sélection de recettes");
$("#pdfAll").onclick=()=>printRecipes(recipes,"Volume 1");
$("#assistBtn").onclick=runAssistant;

document.querySelectorAll("[data-quick]").forEach(b=>b.onclick=()=>{$("#search").value=b.dataset.quick;render();});
$("#surpriseTop").onclick=()=>{let p=filtered();if(p.length)openRecipe(p[Math.floor(Math.random()*p.length)].id)};
$("#pantryBtn").onclick=()=>renderPantry($("#pantryInput").value.split(",").map(x=>x.trim()).filter(Boolean));
}
function filtered(){let q=norm($("#search").value);return recipes.filter(r=>(!q||norm(JSON.stringify(r)).includes(q))&&(!$("#category").value||r.category===$("#category").value)&&(!$("#tag").value||r.tags.includes($("#tag").value))&&(!favOnly||favs.has(r.id)))}
function render(){let p=filtered();$("#count").textContent=`${p.length} recette${p.length>1?"s":""}`;$("#grid").innerHTML=p.map(card).join("")||"<p>Aucune recette trouvée.</p>"}
function card(r){return `<article class="card"><div class="card-body"><div class="top"><span class="cat">${r.category}</span><button class="fav" data-fav="${r.id}">${favs.has(r.id)?"♥":"♡"}</button></div><h3>${r.title}</h3><div class="meta">${r.time} min · ${r.servings} portion${r.servings>1?"s":""}</div>${r.goals.map(g=>`<span class="pill">${g}</span>`).join("")}</div><button class="open" data-open="${r.id}">Voir la recette</button></article>`}
function toggle(id){favs.has(id)?favs.delete(id):favs.add(id);localStorage.setItem("hg-favs",JSON.stringify([...favs]));render()}
function openRecipe(id){let r=recipes.find(x=>x.id===id);$("#detail").innerHTML=`<span class="cat">${r.category}</span><h2>${r.title}</h2><div class="meta">${r.time} min · ${r.servings} portion${r.servings>1?"s":""} · ${r.tags.join(" · ")}</div><div class="detail-grid"><section><h3>Ingrédients</h3><ul>${r.ingredients.map(x=>`<li>${x}</li>`).join("")}</ul></section><section><h3>Préparation</h3><ol>${r.steps.map(x=>`<li>${x}</li>`).join("")}</ol></section></div><h3>Pourquoi cette combinaison ?</h3><ul>${r.why.map(x=>`<li>${x}</li>`).join("")}</ul><h3>Précaution</h3><div class="warn">${r.caution}</div>`;$("#dialog").showModal()}
function printRecipes(list,subtitle){
 let old=document.getElementById("printArea");if(old)old.remove();
 let area=document.createElement("div");area.id="printArea";
 area.innerHTML=`<section class="print-cover"><h1>Herbier Gourmand</h1><h2>${subtitle}</h2><p>${list.length} recettes</p><p>Guide culinaire et informatif — ne remplace pas un avis médical.</p></section>`+
 list.map(r=>`<article class="print-recipe"><h2>${r.title}</h2><p><b>${r.category}</b> · ${r.time} min · ${r.servings} portion${r.servings>1?"s":""}</p><h3>Ingrédients</h3><ul>${r.ingredients.map(x=>`<li>${x}</li>`).join("")}</ul><h3>Préparation</h3><ol>${r.steps.map(x=>`<li>${x}</li>`).join("")}</ol><h3>Pourquoi cette combinaison ?</h3><ul>${r.why.map(x=>`<li>${x}</li>`).join("")}</ul><p><b>Précaution :</b> ${r.caution}</p></article>`).join("");
 document.body.appendChild(area);setTimeout(()=>window.print(),100);
}
let promptEvent;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();promptEvent=e;$("#install").hidden=false});$("#install").onclick=async()=>{if(promptEvent){promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;$("#install").hidden=true}};
init();

function renderPantry(parts){
  const terms=parts.map(norm);
  const scored=recipes.map(r=>{
    const hay=norm(r.ingredients.join(" "));
    return {r,score:terms.filter(t=>hay.includes(t)).length};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  $("#count").textContent=`${scored.length} recette${scored.length>1?"s":""}`;
  $("#grid").innerHTML=scored.map(x=>card(x.r)).join("")||"<p>Aucune recette trouvée avec ces ingrédients.</p>";
}

function runAssistant(){
  const maxTime=Number($("#assistTime").value||999);
  const type=$("#assistType").value;
  const diet=$("#assistDiet").value;
  const ingredients=$("#assistIngredients").value.split(",").map(x=>norm(x.trim())).filter(Boolean);

  let scored=recipes.map(r=>{
    if(r.time>maxTime) return null;
    if(type && r.category!==type) return null;
    if(diet && !r.tags.includes(diet)) return null;

    const hay=norm(r.ingredients.join(" "));
    const matched=ingredients.filter(i=>hay.includes(i)).length;
    let score=matched*5;
    if(r.time<=15) score+=2;
    else if(r.time<=30) score+=1;
    score+=Math.random()*1.5;
    return {r,score,matched};
  }).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,3);

  const box=$("#assistResults");
  if(!scored.length){
    box.innerHTML="<p>Aucune recette ne correspond exactement. Essayez avec moins de critères.</p>";
    return;
  }
  box.innerHTML="<h3>Mes suggestions</h3>"+scored.map(x=>`
    <article class="assist-card">
      <h3>${x.r.title}</h3>
      <div class="meta">${x.r.time} min · ${x.r.category}${ingredients.length?` · ${x.matched}/${ingredients.length} ingrédient(s) trouvé(s)`:""}</div>
      <button data-assist-open="${x.r.id}">Voir la recette</button>
    </article>`).join("");
  box.querySelectorAll("[data-assist-open]").forEach(b=>b.onclick=()=>openRecipe(b.dataset.assistOpen));
}
