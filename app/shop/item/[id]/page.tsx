import type {Metadata} from "next";
import {StoreProduct} from "../../store-product";
export const metadata:Metadata={title:"Product details | BidScope",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <StoreProduct key={id} id={id}/>;}
