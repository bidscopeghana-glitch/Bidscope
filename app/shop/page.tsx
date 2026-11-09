import type {Metadata} from "next";
import {ShopPreview} from "./shop-preview";
export const metadata:Metadata={title:"BidScope | Shopping preview",robots:{index:false,follow:false}};
export default function Shop(){return <ShopPreview/>;}
