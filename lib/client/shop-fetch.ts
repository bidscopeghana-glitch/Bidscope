"use client";
import {getValidAccessToken} from "./session";
export async function shopFetch(path:string,init:RequestInit={}){
 const headers=new Headers(init.headers),token=await getValidAccessToken();
 if(token)headers.set("Authorization","Bearer "+token);
 return fetch(path,{...init,headers,cache:"no-store"});
}
