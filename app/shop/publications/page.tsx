import type {Metadata} from "next";
import {PublicationAdmin} from "./publication-admin";
export const metadata:Metadata={title:"Catalogue publication approvals | BidScope",robots:{index:false,follow:false}};
export default function Page(){return <PublicationAdmin/>;}
