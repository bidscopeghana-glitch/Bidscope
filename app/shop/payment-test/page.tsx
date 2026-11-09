import type {Metadata} from "next";
import {PaymentTestPage} from "../payment-test-page";
export const metadata:Metadata={title:"Private payment validation | BidScope",robots:{index:false,follow:false}};
export default function Page(){return <PaymentTestPage/>;}
