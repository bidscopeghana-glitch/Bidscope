import type {Metadata} from "next";
import {LivePaymentSetupPage} from "../live-payment-setup-page";
export const metadata:Metadata={title:"Live payment connection | BidScope private setup",robots:{index:false,follow:false}};
export default function Page(){return <LivePaymentSetupPage/>;}
