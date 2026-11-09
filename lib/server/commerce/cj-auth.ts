export type CjToken={accessToken:string;accessTokenExpiryDate:string;refreshToken:string;refreshTokenExpiryDate:string};
type Envelope={code?:number;result?:boolean;data?:CjToken};
export function createCjTokenManager(apiKey:()=>Promise<string>,transport:typeof fetch=fetch,clock:()=>number=Date.now){
 let cached:CjToken|null=null,pending:Promise<CjToken>|null=null,lastFailureAt:number|null=null;
 async function request(path:string,body:Record<string,string>){
  let response:Response;
  try{response=await transport("https://developers.cjdropshipping.com/api2.0/v1/authentication/"+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});}
  catch{throw Error("CJ authentication could not be reached. Try again later.");}
  const envelope=await response.json().catch(()=>null) as Envelope|null;
  const data=envelope?.data;
  if(!response.ok||!envelope||envelope.result===false||envelope.code!==undefined&&![0,200].includes(envelope.code)||!data?.accessToken||!data.refreshToken||!Number.isFinite(Date.parse(data.accessTokenExpiryDate))||!Number.isFinite(Date.parse(data.refreshTokenExpiryDate))||Date.parse(data.accessTokenExpiryDate)<=clock()+60000)throw Error("CJ did not verify this credential or returned an unusable token.");
  return data;
 }
 return {
  async token():Promise<CjToken>{
   if(cached&&Date.parse(cached.accessTokenExpiryDate)>clock()+300000)return cached;
   if(pending)return pending;
   if(lastFailureAt!==null&&clock()-lastFailureAt<60000)throw Error("CJ authentication is cooling down after a failed request.");
   pending=(async()=>{
    try{
     if(cached&&Date.parse(cached.refreshTokenExpiryDate)>clock()+60000)cached=await request("refreshAccessToken",{refreshToken:cached.refreshToken});
     else{const key=(await apiKey()).trim();if(!key||key.length>1024)throw Error("A valid CJ API key is required.");cached=await request("getAccessToken",{apiKey:key});}
     lastFailureAt=null;return cached;
    }catch(error){lastFailureAt=clock();throw error;}
    finally{pending=null;}
   })();
   return pending;
  },
  clear(){cached=null;pending=null;lastFailureAt=null;},
  status(){return {authenticated:Boolean(cached&&Date.parse(cached.accessTokenExpiryDate)>clock()),expiresAt:cached?.accessTokenExpiryDate??null};}
 };
}
