import type {Metadata} from "next";
import {ShopPreview} from "./shop/shop-preview";
import {InvitationRedirect} from "@/components/auth/invitation-redirect";
export const metadata:Metadata={
 title:"BidScope | Shopping & product sourcing preview",
 description:"Explore the BidScope shopping concept. Sample products only; live checkout is disabled.",
 robots:{index:false,follow:false},
 openGraph:{title:"BidScope | Shopping & product sourcing preview",description:"Private concept preview. Sample products only."},
 twitter:{title:"BidScope | Shopping & product sourcing preview",description:"Private concept preview. Sample products only."}
};
export default function Home(){return <><InvitationRedirect/><ShopPreview/></>;}
