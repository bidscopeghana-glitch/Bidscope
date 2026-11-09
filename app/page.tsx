import type {Metadata} from "next";
import {ShopPreview} from "./shop/shop-preview";
import {InvitationRedirect} from "@/components/auth/invitation-redirect";
export const metadata:Metadata={
 title:"BidScope | Shopping & product sourcing preview",
 description:"Explore the private BidScope shopping preview. Customer checkout remains disabled.",
 robots:{index:false,follow:false},
 openGraph:{title:"BidScope | Shopping & product sourcing preview",description:"Private shopping preview. Checkout is closed."},
 twitter:{title:"BidScope | Shopping & product sourcing preview",description:"Private shopping preview. Checkout is closed."}
};
export default function Home(){return <><InvitationRedirect/><ShopPreview/></>;}
