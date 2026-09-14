"use client";

export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <html lang="en"><body style={{margin:0,fontFamily:'"Segoe UI",sans-serif',background:"#f7f4eb",color:"#17362d"}}><main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}><section style={{maxWidth:520,textAlign:"center",background:"#fffdf8",padding:40,borderRadius:28,border:"1px solid rgba(23,54,45,.12)"}}><p style={{fontSize:12,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase"}}>BidScope</p><h1 style={{fontSize:38,lineHeight:1.05,margin:"16px 0"}}>We could not open this page.</h1><p style={{lineHeight:1.7,color:"#61736a"}}>Your data has not been changed. Please try again.</p><button onClick={reset} style={{marginTop:22,border:0,borderRadius:999,background:"#116149",color:"white",fontWeight:700,padding:"13px 24px",cursor:"pointer"}}>Try again</button></section></main></body></html>;
}
