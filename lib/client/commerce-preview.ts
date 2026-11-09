"use client";
import {getValidAccessToken} from "./session";
export function isLocalCommercePreview(){return ["localhost","127.0.0.1","[::1]"].includes(window.location.hostname);}
export async function commercePreviewFetch(localUrl:string,hostedUrl:string,init:RequestInit={}){
 if(isLocalCommercePreview())return fetch(localUrl,init);
 const token=await getValidAccessToken();const headers=new Headers(init.headers);if(token)headers.set("Authorization","Bearer "+token);
 return fetch(hostedUrl,{...init,headers,cache:"no-store"});
}
