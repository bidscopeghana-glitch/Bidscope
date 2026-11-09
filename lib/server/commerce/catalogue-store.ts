import {DatabaseSync} from "node:sqlite";
import {mkdirSync} from "node:fs";
import path from "node:path";
import type {CatalogueItem,CatalogueState} from "../../commerce/catalogue.ts";
// Local staging catalogue only. This path is ignored by Git; no production DB writes.
export function openCatalogue(filename=path.join(process.cwd(),".codex-tmp","commerce","catalogue.sqlite")){
 mkdirSync(path.dirname(filename),{recursive:true});const db=new DatabaseSync(filename);
 db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT NOT NULL,sku TEXT NOT NULL,category TEXT NOT NULL,category_id TEXT NOT NULL,image TEXT NOT NULL,price_text TEXT NOT NULL,min_cost INTEGER,max_cost INTEGER,checked_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS category_page ON products(category,id); CREATE INDEX IF NOT EXISTS price_page ON products(min_cost,id); CREATE TABLE IF NOT EXISTS progress(id INTEGER PRIMARY KEY CHECK(id=1),state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS worker(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,expires INTEGER NOT NULL);");
 const count=()=>Number((db.prepare("SELECT count(*) AS n FROM products").get() as {n:number}).n);
 db.exec("CREATE TABLE IF NOT EXISTS cloud_sync(product_id TEXT PRIMARY KEY,checked_at TEXT NOT NULL)");
 return {
  close(){db.close();},count,
  workerActive(now=Date.now()){const row=db.prepare("SELECT expires FROM worker WHERE id=1").get() as {expires:number}|undefined;return Boolean(row&&row.expires>now);},
  claim(owner:string,now=Date.now()){const result=db.prepare("INSERT INTO worker VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE worker.expires<? OR worker.owner=excluded.owner").run(owner,now+120000,now);return result.changes===1;},
  release(owner:string){db.prepare("DELETE FROM worker WHERE id=1 AND owner=?").run(owner);},
  state():CatalogueState|null{const row=db.prepare("SELECT state FROM progress WHERE id=1").get() as {state:string}|undefined;return row?JSON.parse(row.state):null;},
  pendingCloud(){return db.prepare("SELECT p.id AS supplier_product_id,p.name AS title,p.sku,p.category,p.category_id,p.image AS thumbnail_url,p.price_text AS supplier_price_text,p.min_cost AS min_usd_minor,p.max_cost AS max_usd_minor,p.checked_at AS synced_at FROM products p LEFT JOIN cloud_sync c ON c.product_id=p.id WHERE c.checked_at IS NULL OR c.checked_at<>p.checked_at ORDER BY p.id LIMIT 200").all() as unknown as {supplier_product_id:string;title:string;sku:string;category:string;category_id:string;thumbnail_url:string;supplier_price_text:string;min_usd_minor:number|null;max_usd_minor:number|null;synced_at:string}[];},
  markCloud(rows:{supplier_product_id:string;synced_at:string}[]){db.exec("BEGIN IMMEDIATE");try{const statement=db.prepare("INSERT INTO cloud_sync VALUES(?,?) ON CONFLICT(product_id) DO UPDATE SET checked_at=excluded.checked_at");for(const row of rows)statement.run(row.supplier_product_id,row.synced_at);db.exec("COMMIT");}catch(error){db.exec("ROLLBACK");throw error;}},
  save(items:CatalogueItem[],state:CatalogueState){
   db.exec("BEGIN IMMEDIATE");try{
    const insert=db.prepare("INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,sku=excluded.sku,category=excluded.category,category_id=excluded.category_id,image=excluded.image,price_text=excluded.price_text,min_cost=excluded.min_cost,max_cost=excluded.max_cost,checked_at=excluded.checked_at");
    for(const p of items){if(count()>=state.target&&!db.prepare("SELECT id FROM products WHERE id=?").get(p.supplierId))continue;insert.run(p.supplierId,p.name,p.sku,p.category,p.categoryId,p.image,p.priceText,p.minUsdMinor,p.maxUsdMinor,p.checkedAt);}
    db.prepare("INSERT INTO progress VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state").run(JSON.stringify(state));db.exec("COMMIT");
   }catch(error){db.exec("ROLLBACK");throw error;}
  },
  search(q:string,category:string,page:number,sort:string){
   const where:string[]=[],params:string[]=[];
   if(q){where.push("(name LIKE ? ESCAPE '\\' OR sku LIKE ? ESCAPE '\\')");const term="%"+q.replace(/[\\%_]/g,"\\$&")+"%";params.push(term,term);}
   if(category){where.push("category=?");params.push(category);}
   const filter=where.length?" WHERE "+where.join(" AND "):"";
   const total=Number((db.prepare("SELECT count(*) AS n FROM products"+filter).get(...params) as {n:number}).n);
   const order=sort==="low"?"min_cost IS NULL,min_cost ASC,id":sort==="high"?"min_cost IS NULL,min_cost DESC,id":"id";
   const rows=db.prepare("SELECT * FROM products"+filter+" ORDER BY "+order+" LIMIT 24 OFFSET ?").all(...params,(page-1)*24) as unknown as {id:string;name:string;sku:string;category:string;category_id:string;image:string;price_text:string;min_cost:number|null;max_cost:number|null;checked_at:string}[];
   return {total,page,pageSize:24,items:rows.map(p=>({supplierId:p.id,name:p.name,sku:p.sku,category:p.category,categoryId:p.category_id,image:p.image,priceText:p.price_text,minUsdMinor:p.min_cost,maxUsdMinor:p.max_cost,checkedAt:p.checked_at})),categories:(db.prepare("SELECT DISTINCT category FROM products ORDER BY category").all() as {category:string}[]).map(row=>row.category),imported:count(),progress:this.state(),workerActive:this.workerActive()};
  }
 };
}
