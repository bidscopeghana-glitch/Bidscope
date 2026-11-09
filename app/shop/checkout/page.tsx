import type {Metadata} from "next";
import {CheckoutReviewPage} from "../checkout-review-page";
export const metadata:Metadata={title:"Review your order | BidScope private preview",robots:{index:false,follow:false}};
export default function Page(){return <CheckoutReviewPage/>;}
