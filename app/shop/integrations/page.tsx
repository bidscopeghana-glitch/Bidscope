"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import "../fonts.css";
export default function Integrations(){
 const [status,setStatus]=useState("Ready to configure CJ"),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch("/api/commerce/local-connect",{cache:"no-store"}).then(async response=>{const result=await response.json() as {configured?:boolean;authenticated?:boolean};if(response.ok&&result.configured)setStatus(result.authenticated?"CJ is authenticated on this local server. Sandbox mode only; publication and Ghana shipping are unverified.":"A CJ key is saved on this local server. Use Test saved connection to verify it.");}).catch(()=>{});},[]);
 async function testSaved(){
  setBusy(true);setStatus("Testing the saved CJ connection…");
  try{const response=await fetch("/api/commerce/local-connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"test"})});if(!response.ok)throw Error("The saved connection could not be verified.");setStatus("CJ connection verified. Sandbox mode only; publication approval and Ghana shipping remain unverified.");}catch(error){setStatus((error as Error).message);}finally{setBusy(false);}
 }
 async function connect(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;setBusy(true);setStatus("Verifying with the official CJ API…");
  try{
   const apiKey=String(new FormData(form).get("apiKey")||"");
   const response=await fetch("/api/commerce/local-connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"connect",apiKey})});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||"Connection failed.");
   form.reset();setStatus("CJ credential verified and saved on this local BidScope server. Sandbox mode only. Publication approval and Ghana shipping remain unverified.");
  }catch(error){setStatus((error as Error).message);}finally{setBusy(false);}
 }
 return <main style={{fontFamily:'"Amazon Ember", Arial, sans-serif',background:"#eff3e9",minHeight:"100vh",padding:"40px 20px",color:"#173e31"}}><section style={{maxWidth:620,margin:"auto",background:"white",padding:32,borderRadius:12}}>
 <Link href="/shop">← Back to shopping</Link><p style={{fontSize:11,letterSpacing:2,marginTop:30}}>BIDSCOPE · LOCAL SUPPLIER SETUP</p><h1 style={{fontSize:28,margin:"12px 0"}}>Connect CJdropshipping</h1><p style={{fontSize:14,lineHeight:1.7}}>This form works only on the explicitly enabled local server. The key is sent to CJ for verification, then saved in an ignored server-side secret file. It is never returned to the browser, added to the catalogue or committed to GitHub.</p>
 <form onSubmit={connect}><label htmlFor="cjApiKey" style={{display:"block",marginTop:24}}>CJ API key</label><input id="cjApiKey" name="apiKey" type="password" autoComplete="off" required minLength={10} maxLength={1024} style={{width:"100%",padding:12,margin:"10px 0 18px",border:"1px solid #bbcab0",borderRadius:6}}/><button disabled={busy} style={{background:"#edc45e",border:0,padding:"12px 22px",borderRadius:24,color:"#173e31"}}>{busy?"Connecting…":"Verify and save CJ connection"}</button></form>
 <p role="status" style={{padding:15,background:"#f1f5e9",lineHeight:1.7,marginTop:24}}>{status}</p><button type="button" disabled={busy} onClick={testSaved} style={{border:"1px solid #c1cfb4",background:"white",borderRadius:20,padding:"9px 18px",color:"#173e31"}}>Test saved CJ connection</button><h2 style={{fontSize:19,marginTop:28}}>Alibaba</h2><p style={{fontSize:13,lineHeight:1.7}}>The developer profile requires business verification and provider approval before a usable dropshipping API can be configured. No Alibaba credential or partnership is assumed.</p><p style={{fontSize:12,color:"#72806a",marginTop:25}}>Live checkout and supplier payments remain disabled. This form does not create or pay for orders.</p>
 </section></main>;
}
