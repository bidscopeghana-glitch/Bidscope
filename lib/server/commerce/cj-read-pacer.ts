import {DatabaseSync} from "node:sqlite";
import {mkdirSync} from "node:fs";
import path from "node:path";
export function reserveCjReadSlot(interval:number,now=Date.now(),filename=path.join(process.cwd(),".codex-tmp","commerce","cj-read-rate.sqlite")){
 mkdirSync(path.dirname(filename),{recursive:true});const db=new DatabaseSync(filename);
 try{db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rate(id INTEGER PRIMARY KEY CHECK(id=1),next_at INTEGER NOT NULL); BEGIN IMMEDIATE");
  const previous=db.prepare("SELECT next_at FROM rate WHERE id=1").get() as {next_at:number}|undefined;
  const slot=Math.max(now,previous?.next_at||0);
  db.prepare("INSERT INTO rate VALUES(1,?) ON CONFLICT(id) DO UPDATE SET next_at=excluded.next_at").run(slot+interval);db.exec("COMMIT");return slot-now;
 }finally{db.close();}
}
