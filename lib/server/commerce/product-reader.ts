import type {ProductPresentation} from "../../commerce/product-presentation.ts";
import {ApiError} from "../api-error.ts";
export function createProductReader(load:(id:string)=>Promise<ProductPresentation>,now=()=>Date.now()){
 const inFlight=new Map<string,Promise<ProductPresentation>>(),cache=new Map<string,{until:number;value:ProductPresentation}>();
 return async(id:string)=>{
  const saved=cache.get(id);if(saved&&saved.until>now())return saved.value;
  const pending=inFlight.get(id);if(pending)return pending;
  if(inFlight.size>=2)throw new ApiError(429,"Two product checks are already in progress. Please try again shortly.","product_checks_busy");
  const task=(async()=>{const value=await load(id);if(cache.size>=20)cache.delete(cache.keys().next().value!);cache.set(id,{until:now()+60000,value});return value;})();
  inFlight.set(id,task);try{return await task;}finally{inFlight.delete(id);}
 };
}
