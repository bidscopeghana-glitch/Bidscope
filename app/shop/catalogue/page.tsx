import type {Metadata} from "next";
import {Storefront} from "../storefront";
export const metadata:Metadata={title:"Product collection | BidScope",robots:{index:false,follow:false}};
export default function CataloguePage(){return <Storefront/>;}
