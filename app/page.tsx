import { OpportunityDashboard } from "./opportunity-dashboard";
import {JsonLd} from "@/components/seo/public-seo";
import {absoluteUrl,publicMetadata} from "@/lib/seo/site";
import {InvitationRedirect} from "@/components/auth/invitation-redirect";

export const metadata=publicMetadata({title:"BidScope | Tenders, Procurement & Contract Opportunities in Ghana",description:"Find tenders and contract opportunities in Ghana, receive matched alerts, evaluate requirements and manage procurement workflows for buyers and suppliers.",path:"/"});

export default function Home() {
  return <><InvitationRedirect /><OpportunityDashboard /><JsonLd data={{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":`${absoluteUrl("/")}#organization`,name:"BidScope",url:absoluteUrl("/"),logo:absoluteUrl("/brand/logo/bidscope-logo.png"),email:"hello@bidscopeghana.com"},{"@type":"WebSite","@id":`${absoluteUrl("/")}#website`,name:"BidScope",url:absoluteUrl("/"),publisher:{"@id":`${absoluteUrl("/")}#organization`},inLanguage:"en"}]}}/></>;
}
