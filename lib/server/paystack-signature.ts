import {createHmac,timingSafeEqual} from "node:crypto";

export function isValidPaystackSignature(raw:string,signature:string|null,secretKey:string){
  if(!signature||!secretKey)return false;
  const expected=createHmac("sha512",secretKey).update(raw).digest("hex");
  if(expected.length!==signature.length)return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}
