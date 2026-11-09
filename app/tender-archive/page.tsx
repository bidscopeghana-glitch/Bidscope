import type {Metadata} from "next";
import {OpportunityDashboard} from "../opportunity-dashboard";
export const metadata:Metadata={title:"BidScope | Tender platform archive",robots:{index:false,follow:false}};
export default function Archive(){return <><div style={{padding:16,background:"#fff2cf",color:"#173e31"}}>Tender platform archive preview. Existing records and access controls are preserved. <a href="/shop">Open shopping preview</a></div><OpportunityDashboard/></>;}
