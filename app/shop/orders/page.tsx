import type {Metadata} from "next";
import {ShopOrders} from "./shop-orders";
export const metadata:Metadata={title:"Your orders | BidScope",robots:{index:false,follow:false}};
export default function Page(){return <ShopOrders/>;}
