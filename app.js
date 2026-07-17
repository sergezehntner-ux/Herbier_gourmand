const herbs=[
{id:"thym",name:"Thym",type:"herbe",latin:"Thymus vulgaris",taste:"Boisé, chaud, légèrement camphré",intensity:"Forte",uses:["Poulet","Agneau","Pommes de terre","Champignons","Tomate"],pairs:["Romarin","Laurier","Ail","Citron"],tradition:"Traditionnellement apprécié en infusion et dans les cuisines méditerranéennes.",benefit:"Apporte surtout du goût, ce qui peut aider à limiter l’excès de sel dans certaines préparations.",caution:"Les usages culinaires habituels sont différents des extraits concentrés et huiles essentielles."},
{id:"basilic",name:"Basilic",type:"herbe",latin:"Ocimum basilicum",taste:"Frais, poivré, légèrement anisé",intensity:"Moyenne",uses:["Tomate","Courgette","Mozzarella","Œufs","Fraises"],pairs:["Persil","Origan","Menthe","Ail"],tradition:"Très présent dans les cuisines méditerranéennes et asiatiques.",benefit:"Permet d’apporter fraîcheur et parfum sans alourdir le plat.",caution:"Ajouter de préférence en fin de cuisson pour préserver son arôme."},
{id:"romarin",name:"Romarin",type:"herbe",latin:"Salvia rosmarinus",taste:"Résineux, puissant, légèrement amer",intensity:"Très forte",uses:["Agneau","Pommes de terre","Pain","Champignons","Haricots blancs"],pairs:["Thym","Ail","Sauge","Citron"],tradition:"Herbe emblématique du bassin méditerranéen.",benefit:"Son intensité permet de parfumer fortement avec une petite quantité.",caution:"Peut dominer les autres saveurs; doser avec modération."},
{id:"estragon",name:"Estragon",type:"herbe",latin:"Artemisia dracunculus",taste:"Anisé, frais, légèrement poivré",intensity:"Moyenne",uses:["Poulet","Œufs","Champignons","Crème","Moutarde"],pairs:["Persil","Ciboulette","Cerfeuil","Citron"],tradition:"Classique de la cuisine française, notamment dans les sauces.",benefit:"Apporte une forte personnalité aromatique aux sauces légères.",caution:"Son caractère anisé ne convient pas à toutes les préparations."},
{id:"menthe",name:"Menthe",type:"herbe",latin:"Mentha spicata",taste:"Très frais, végétal",intensity:"Forte",uses:["Courgette","Petits pois","Yaourt","Concombre","Fruits"],pairs:["Coriandre","Basilic","Citron","Cumin"],tradition:"Utilisée dans de nombreuses cuisines et boissons traditionnelles.",benefit:"Renforce la sensation de fraîcheur et facilite les préparations légères.",caution:"Peut gêner certaines personnes sujettes au reflux."},
{id:"cumin",name:"Cumin",type:"épice",latin:"Cuminum cyminum",taste:"Terreux, chaud, légèrement amer",intensity:"Forte",uses:["Lentilles","Pois chiches","Carottes","Agneau","Yaourt"],pairs:["Coriandre","Paprika","Curcuma","Menthe"],tradition:"Très présent du Maghreb à l’Inde et au Moyen-Orient.",benefit:"Donne profondeur et chaleur aux plats végétaux et aux légumineuses.",caution:"Torréfier brièvement sans brûler pour développer son parfum."},
{id:"paprika",name:"Paprika",type:"épice",latin:"Capsicum annuum",taste:"Doux, fruité ou fumé selon la variété",intensity:"Douce à moyenne",uses:["Poulet","Œufs","Pommes de terre","Poivrons","Haricots"],pairs:["Cumin","Ail","Origan","Thym"],tradition:"Essentiel dans plusieurs cuisines d’Europe centrale et méditerranéennes.",benefit:"Ajoute couleur et rondeur, parfois sans piquant.",caution:"Le paprika brûlé devient amer; éviter une chaleur trop forte."},
{id:"curcuma",name:"Curcuma",type:"épice",latin:"Curcuma longa",taste:"Terreux, chaud, légèrement amer",intensity:"Moyenne",uses:["Riz","Lentilles","Chou-fleur","Œufs","Poulet"],pairs:["Cumin","Coriandre","Poivre","Gingembre"],tradition:"Très utilisé dans les cuisines d’Asie du Sud.",benefit:"Apporte couleur et profondeur aromatique aux plats.",caution:"Les effets d’un usage culinaire ne doivent pas être confondus avec ceux de compléments concentrés."},
{id:"coriandre",name:"Coriandre",type:"épice",latin:"Coriandrum sativum",taste:"Agrumé et floral en graines; frais en feuilles",intensity:"Moyenne",uses:["Carottes","Lentilles","Poulet","Courge","Agrumes"],pairs:["Cumin","Menthe","Gingembre","Curcuma"],tradition:"Présente dans de nombreuses cuisines du monde.",benefit:"Relie facilement notes fraîches, chaudes et citronnées.",caution:"Les feuilles ont un goût très polarisant; proposer du persil en alternative."},
{id:"cannelle",name:"Cannelle",type:"épice",latin:"Cinnamomum verum",taste:"Douce, chaude, boisée",intensity:"Forte",uses:["Pomme","Poire","Courge","Carotte","Agneau"],pairs:["Cardamome","Gingembre","Cumin","Poivre"],tradition:"Employée dans les desserts comme dans les plats salés.",benefit:"Renforce la perception de douceur aromatique.",caution:"Doser très légèrement dans les plats salés."}
];

const foods={
"Poulet":["thym","estragon","paprika","romarin","curcuma"],
"Courgette":["basilic","menthe","thym","cumin","coriandre"],
"Champignons":["thym","estragon","romarin","paprika","coriandre"],
"Lentilles":["cumin","coriandre","curcuma","thym","paprika"],
"Carottes":["cumin","coriandre","thym","curcuma","cannelle"],
"Œufs":["estragon","basilic","paprika","curcuma","thym"],
"Pommes de terre":["thym","romarin","paprika","cumin","coriandre"],
"Agneau":["romarin","thym","cumin","coriandre","cannelle"]
};
const styles={
mediterraneen:["basilic","thym","romarin","paprika"],francais:["estragon","thym","romarin"],oriental:["cumin","coriandre","cannelle","menthe"],indien:["curcuma","cumin","coriandre"],frais:["menthe","basilic","coriandre"],libre:[]
};
const recipes=[
{title:"Poulet au thym et citron",meat:true,temp:"chaud"},
{title:"Lentilles, carottes et cumin",meat:false,temp:"chaud"},
{title:"Omelette aux champignons et estragon",meat:false,temp:"chaud"},
{title:"Salade de courgettes, menthe et yaourt",meat:false,temp:"froid"},
{title:"Pommes de terre rôties au romarin, œuf mollet",meat:false,temp:"chaud"},
{title:"Salade de lentilles au paprika et herbes",meat:false,temp:"froid"},
{title:"Poulet froid au basilic et légumes croquants",meat:true,temp:"froid"},
{title:"Carottes rôties au cumin et pois chiches",meat:false,temp:"chaud"}
];

let currentType="tous";
function go(id){
 document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
 document.getElementById(id).classList.add("active");
 document.querySelectorAll(".bottom button").forEach(b=>b.classList.toggle("active",b.dataset.go===id));
 window.scrollTo({top:0,behavior:"smooth"});
}
document.addEventListener("click",e=>{
 const goBtn=e.target.closest("[data-go]"); if(goBtn) go(goBtn.dataset.go);
 const card=e.target.closest("[data-herb]"); if(card) showDetail(card.dataset.herb);
});
function renderHerbs(){
 const q=document.getElementById("herbSearch").value.toLowerCase();
 const rows=herbs.filter(h=>(currentType==="tous"||h.type===currentType)&&JSON.stringify(h).toLowerCase().includes(q));
 herbList.innerHTML=rows.map(h=>`<article class="card action" data-herb="${h.id}"><div class="meta">${h.type} · ${h.latin}</div><h3>${h.name}</h3><p>${h.taste}</p><div class="tags">${h.uses.slice(0,4).map(x=>`<span class="tag">${x}</span>`).join("")}</div></article>`).join("");
}
document.getElementById("herbSearch").oninput=renderHerbs;
document.getElementById("typeFilters").onclick=e=>{if(e.target.dataset.type){currentType=e.target.dataset.type;document.querySelectorAll("#typeFilters .chip").forEach(x=>x.classList.toggle("active",x===e.target));renderHerbs();}};
function showDetail(id){
 const h=herbs.find(x=>x.id===id);
 detailContent.innerHTML=`<div class="detail-hero"><div class="eyebrow">${h.type} · ${h.latin}</div><h2>${h.name}</h2><p>${h.taste} · Intensité : ${h.intensity}</p></div>
 <div class="detail-grid">
 <div><h3>Accords alimentaires</h3>${h.uses.map((x,i)=>`<p><span class="rating">${"★".repeat(Math.max(3,5-i%3))}</span> ${x}</p>`).join("")}</div>
 <div><h3>Se combine avec</h3><div class="tags">${h.pairs.map(x=>`<span class="tag">${x}</span>`).join("")}</div></div>
 <div><h3>Intérêt culinaire</h3><p>${h.benefit}</p><h3>Tradition</h3><p>${h.tradition}</p></div>
 <div><h3>Précaution</h3><p>${h.caution}</p><p class="muted">Information culinaire générale, sans visée médicale.</p></div></div>`;
 go("detail");
}

foodSelect.innerHTML=Object.keys(foods).map(x=>`<option>${x}</option>`).join("");
suggestBtn.onclick=()=>{
 const food=foodSelect.value, style=styleSelect.value;
 let ids=foods[food].slice();
 if(style!=="libre") ids.sort((a,b)=>(styles[style].includes(b)?1:0)-(styles[style].includes(a)?1:0));
 accordResults.innerHTML=ids.map((id,i)=>{const h=herbs.find(x=>x.id===id);return `<article class="card action" data-herb="${id}"><div class="meta">${i<2?"Accord prioritaire":"Bonne alternative"}</div><h3>${h.name} <span class="rating">${"★".repeat(Math.max(3,5-i))}</span></h3><p>${h.name} apporte un profil ${h.taste.toLowerCase()} qui complète bien ${food.toLowerCase()}.</p></article>`}).join("");
};

const days=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
let selected=JSON.parse(localStorage.getItem("hg_meals")||"{}");
function renderMeals(){
 mealGrid.innerHTML=`<div></div><div class="head">Midi</div><div class="head">Soir</div>`+days.map(d=>`<div class="day">${d}</div>${["midi","soir"].map(p=>{let key=d+"-"+p;return `<button class="meal-toggle ${selected[key]?"selected":""}" data-meal="${key}">${selected[key]?"À la maison":"À l’extérieur"}<small>${p}</small></button>`}).join("")}`).join("");
 mealGrid.querySelectorAll("[data-meal]").forEach(b=>b.onclick=()=>{selected[b.dataset.meal]=!selected[b.dataset.meal];localStorage.setItem("hg_meals",JSON.stringify(selected));renderMeals();});
 const n=Object.values(selected).filter(Boolean).length; mealSummary.innerHTML=`<b>${n} repas sélectionné${n>1?"s":""}</b><br><span class="muted">Maximum indicatif de viande : ${Math.floor(n/3)} repas sur ${n}.</span>`;
}
allMeals.onclick=()=>{days.forEach(d=>["midi","soir"].forEach(p=>selected[d+"-"+p]=true));localStorage.setItem("hg_meals",JSON.stringify(selected));renderMeals()};
clearMeals.onclick=()=>{selected={};localStorage.setItem("hg_meals","{}");renderMeals()};
generatePlan.onclick=()=>{
 let slots=Object.keys(selected).filter(k=>selected[k]), meatMax=Math.floor(slots.length/3), meatUsed=0, idx=0;
 const chosen=slots.map((slot,i)=>{
   let pool=recipes.filter(r=>!r.meat||meatUsed<meatMax);
   let r=pool[(idx++)%pool.length]; if(r.meat) meatUsed++;
   return {slot,r};
 });
 planResults.innerHTML=chosen.length?chosen.map(x=>{let [d,p]=x.slot.split("-");return `<div class="plan-meal"><b>${d} · ${p}</b><br>${x.r.title} <span class="tag">${x.r.temp}</span></div>`}).join(""):`<p class="note">Sélectionnez au moins un repas.</p>`;
};

let shopping=JSON.parse(localStorage.getItem("hg_shopping")||"null")||[
{name:"Tomates",store:"Marché / primeur",aisle:"Fruits et légumes",done:false},
{name:"Œufs",store:"Supermarché",aisle:"Produits laitiers",done:false},
{name:"Thym frais",store:"Marché / primeur",aisle:"Herbes et épices",done:false},
{name:"Poulet",store:"Boucherie",aisle:"Viandes",done:false}
];
let groupMode="store";
function saveShop(){localStorage.setItem("hg_shopping",JSON.stringify(shopping))}
function renderShop(){
 let groups={};
 if(groupMode==="alpha"){groups["Liste alphabétique"]=[...shopping].sort((a,b)=>a.name.localeCompare(b.name))}
 else shopping.forEach(x=>{let k=groupMode==="store"?x.store:x.aisle;(groups[k]??=[]).push(x)});
 shoppingList.innerHTML=Object.entries(groups).map(([g,items])=>`<section class="group"><h3>${g}</h3>${items.map(item=>{let i=shopping.indexOf(item);return `<div class="shop-item ${item.done?"done":""}"><input type="checkbox" data-check="${i}" ${item.done?"checked":""}><span>${item.name}</span><button data-delete="${i}">✕</button></div>`}).join("")}</section>`).join("");
 shoppingList.querySelectorAll("[data-check]").forEach(x=>x.onchange=()=>{shopping[+x.dataset.check].done=x.checked;saveShop();renderShop()});
 shoppingList.querySelectorAll("[data-delete]").forEach(x=>x.onclick=()=>{shopping.splice(+x.dataset.delete,1);saveShop();renderShop()});
}
document.querySelector(".segmented").onclick=e=>{if(e.target.dataset.group){groupMode=e.target.dataset.group;document.querySelectorAll(".segmented button").forEach(x=>x.classList.toggle("active",x===e.target));renderShop()}};
addItem.onclick=()=>{let n=itemInput.value.trim();if(!n)return;shopping.push({name:n,store:storeInput.value,aisle:aisleInput.value,done:false});itemInput.value="";saveShop();renderShop()};

renderHerbs();renderMeals();renderShop();
suggestBtn.click();

let deferredPrompt;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;installBtn.hidden=false});
installBtn.onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;installBtn.hidden=true}};
if("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
