import type {Metadata} from "next";
import {ShoppingBagPage} from "../shopping-bag-page";
export const metadata:Metadata={title:"Your shopping bag | BidScope",robots:{index:false,follow:false}};
export default function Page(){return <ShoppingBagPage/>;}
