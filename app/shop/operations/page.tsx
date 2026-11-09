import type {Metadata} from "next";
import {ShopOperations} from "./shop-operations";
export const metadata:Metadata={title:"Shop operations | BidScope",robots:{index:false,follow:false}};
export default function Page(){return <ShopOperations/>;}
