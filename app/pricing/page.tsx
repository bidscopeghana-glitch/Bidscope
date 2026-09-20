import {PlansClient} from "../plans/plans-client";
import {publicMetadata} from "@/lib/seo/site";
export const metadata=publicMetadata({title:"BidScope Pricing | Tender Intelligence Packages",description:"Compare monthly and annual BidScope packages for tender alerts, procurement intelligence, AI evaluation and team access.",path:"/pricing"});
export default function Page(){return <PlansClient/>;}
