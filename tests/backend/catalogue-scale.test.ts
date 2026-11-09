import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import path from "node:path";
import os from "node:os";
import {openCatalogue} from "../../lib/server/commerce/catalogue-store.ts";
import {reserveCjReadSlot} from "../../lib/server/commerce/cj-read-pacer.ts";
import {catalogueItem,priceRange,interleaveDepartments,nextCatalogueDirection,upgradeCatalogueMediaPolicy,type CatalogueState} from "../../lib/commerce/catalogue.ts";
const state:CatalogueState={target:50000,page:1,categoryIndex:0,status:"running",reason:"",updatedAt:new Date().toISOString(),categories:[],quota:null};
const item=(id:string)=>catalogueItem({id,nameEn:"Storage "+id,sku:id,bigImage:"https://cf.cjdropshipping.com/photo.jpg",sellPrice:"2.03 -- 4.50",saleStatus:"3"},{id:"cat",name:"Home / Storage"})!;
test("supplier ranges preserve both prices and reject misleading numeric truncation",()=>{assert.deepEqual(priceRange("2.03 -- 4.50"),{min:203,max:450});assert.deepEqual(priceRange("4.50-2.03"),{min:null,max:null});assert.deepEqual(priceRange("ask supplier"),{min:null,max:null});assert.equal(catalogueItem({id:"p",nameEn:"bad",bigImage:"https://evil.invalid/x",sellPrice:"2"},{id:"c",name:"c"}),null);});
test("catalogue scheduling interleaves departments without inventing or dropping categories",()=>{const categories=[{id:"a",name:"Home / A"},{id:"b",name:"Home / B"},{id:"c",name:"Bags / C"},{id:"d",name:"Travel / D"}];assert.deepEqual(interleaveDepartments(categories).map(c=>c.id),["a","c","d","b"]);assert.equal(categories.length,4);});
test("the bounded newest pass starts once after all oldest categories and resumes its own cursor",()=>{
 const categories=[{id:"a",name:"Home"}];
 assert.equal(nextCatalogueDirection({...state,categories,categoryIndex:0,page:60}),null);
 const next=nextCatalogueDirection({...state,categories,categoryIndex:1,status:"exhausted"});
 assert.equal(next?.direction,"desc");assert.equal(next?.categoryIndex,0);assert.equal(next?.page,1);assert.equal(next?.target,50000);
 assert.equal(nextCatalogueDirection({...next!,categoryIndex:1}),null);
});
test("media policy upgrades replay metadata once without changing the target or losing the resumed cursor",()=>{
 const original={...state,categoryIndex:20,page:7};const upgraded=upgradeCatalogueMediaPolicy(original,true);
 assert.equal(upgraded.categoryIndex,0);assert.equal(upgraded.page,1);assert.equal(upgraded.direction,"desc");assert.equal(upgraded.target,50000);
 const resumed={...upgraded,categoryIndex:3,page:4};assert.deepEqual(upgradeCatalogueMediaPolicy(resumed,true),resumed);
 assert.equal(upgradeCatalogueMediaPolicy(original,false).page,7);
});
test("large catalogue persistence deduplicates products, resumes checkpoints and paginates",()=>{
 const directory=mkdtempSync(path.join(os.tmpdir(),"bidscope-catalogue-test-"));const store=openCatalogue(path.join(directory,"test.sqlite"));
 try{
  const rows=Array.from({length:50000},(_,i)=>item("p"+String(i).padStart(5,"0")));
  store.save(rows,{...state,page:2});assert.equal(store.count(),50000);store.save([rows[0]],{...state,page:3});assert.equal(store.count(),50000);assert.equal(store.state()?.page,3);
  const first=store.search("","",1,"featured"),second=store.search("","",2,"featured");assert.equal(first.total,50000);assert.equal(first.items.length,24);assert.equal(first.workerActive,false);assert.notEqual(first.items[0].supplierId,second.items[0].supplierId);
  const pending=store.pendingCloud();assert.equal(pending.length,200);store.markCloud(pending);assert.equal(store.pendingCloud().some(p=>p.supplier_product_id===pending[0].supplier_product_id),false);
  const changed={...rows[0],checkedAt:"2099-01-01T00:00:00.000Z"};store.save([changed],state);store.markCloud([pending[0]]);assert.equal(store.pendingCloud()[0].supplier_product_id,changed.supplierId);assert.equal(store.pendingCloud()[0].synced_at,changed.checkedAt);
  assert.equal(store.search("p49999","",1,"featured").total,1);assert.equal(store.search("%","",1,"featured").total,0);assert.equal(store.search("' OR 1=1 --","",1,"featured").total,0);
  store.save([item("beyond-target")],state);assert.equal(store.count(),50000);
  assert.equal(store.claim("a",1000),true);assert.equal(store.workerActive(1001),true);assert.equal(store.workerActive(121001),false);assert.equal(store.claim("b",1001),false);assert.equal(store.claim("b",122000),true);store.release("a");assert.equal(store.workerActive(122001),true);assert.equal(store.claim("a",122001),false);store.release("b");assert.equal(store.workerActive(122001),false);
  assert.equal(store.claim("current"),true);assert.equal(store.search("","",1,"featured").workerActive,true);store.release("current");assert.equal(store.search("","",1,"featured").workerActive,false);
 }finally{store.close();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));rmSync(directory,{recursive:true,force:true});}
});
test("independent local clients reserve separate CJ request slots",()=>{
 const directory=mkdtempSync(path.join(os.tmpdir(),"bidscope-cj-rate-test-")),file=path.join(directory,"rate.sqlite");
 try{assert.equal(reserveCjReadSlot(1100,1000,file),0);assert.equal(reserveCjReadSlot(1100,1000,file),1100);assert.equal(reserveCjReadSlot(1100,1000,file),2200);assert.equal(reserveCjReadSlot(1100,10000,file),0);}finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));rmSync(directory,{recursive:true,force:true});}
});
