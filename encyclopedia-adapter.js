/* Herbier Gourmand — adaptateur commun en lecture seule (v3.0.21).
   Aucune migration ni écriture : les trois stockages historiques restent intacts. */
(function(root){
 'use strict';
 const KINDS=Object.freeze(['produce','herbs','meat','fish','condiments','drinks','dairyPasta','baking']);
 const STORE=Object.freeze({produce:'hg-fruits-vegetables-v282',herbs:'hg-herbs-spices-v28',shared:'hg-encyclopedias-v1',catalog:'hg-ingredient-catalog-v1',excluded:'hg-encyclopedias-unlinked-v83'});
 function parse(storage,key,fallback){
  try {const raw=storage.getItem(key);return raw===null?fallback:JSON.parse(raw)}catch{return fallback}
 }
 function rows(storage,kind){
  if(!KINDS.includes(kind))throw Error('Encyclopédie inconnue : '+kind);
  const value=parse(storage,kind==='produce'?STORE.produce:kind==='herbs'?STORE.herbs:STORE.shared,kind==='produce'||kind==='herbs'?[]:{});
  const result=kind==='produce'||kind==='herbs'?value:value?.[kind];
  return Array.isArray(result)?result:[];
 }
 function catalogId(record){
  if(!record||typeof record!=='object')return null;
  const explicit=record.catalogId??record.catalogueId;
  if(explicit!==undefined&&explicit!==null&&String(explicit)!=='')return String(explicit);
  const id=String(record.id??'');
  if(id.startsWith('catalog:'))return id.slice(8)||null;
  if(id.startsWith('catalog-'))return id.slice(8)||null;
  return null;
 }
 function list(storage,kind,{includeExcluded=false}={}){
  const exclusions=parse(storage,STORE.excluded,{});
  const excluded=new Set(Array.isArray(exclusions?.[kind])?exclusions[kind].map(String):[]);
  return rows(storage,kind).filter(record=>{
   if(includeExcluded)return true;
   const id=catalogId(record);
   return id===null||!excluded.has(id);
  }).map(record=>({kind,id:String(record?.id??''),catalogId:catalogId(record),excluded:catalogId(record)!==null&&excluded.has(catalogId(record)),record}));
 }
 function get(storage,kind,id,options){return list(storage,kind,{includeExcluded:true,...options}).find(entry=>entry.id===String(id))||null}
 function resolveCatalog(storage,record){
  const id=catalogId(record);
  if(id===null)return null;
  const catalog=parse(storage,STORE.catalog,[]);
  return Array.isArray(catalog)?catalog.find(item=>String(item.id)===id)||null:null;
 }
 function audit(storage){
  const catalog=parse(storage,STORE.catalog,[]);
  const known=new Set(Array.isArray(catalog)?catalog.map(x=>String(x.id)):[]);
  const summary={kinds:{},orphanLinks:[],duplicateIds:[]};
  for(const kind of KINDS){
   const entries=list(storage,kind,{includeExcluded:true});const seen=new Set();
   summary.kinds[kind]={total:entries.length,excluded:entries.filter(x=>x.excluded).length};
   for(const entry of entries){
    if(entry.id&&seen.has(entry.id))summary.duplicateIds.push({kind,id:entry.id});
    seen.add(entry.id);
    if(entry.catalogId!==null&&!known.has(entry.catalogId))summary.orphanLinks.push({kind,id:entry.id,catalogId:entry.catalogId});
   }
  }
  return summary;
 }
 const api=Object.freeze({kinds:KINDS,stores:STORE,list,get,catalogId,resolveCatalog,audit});
 root.hgEncyclopediaRead=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
