import type {Metadata} from "next";
import {AdminShell} from "./admin-shell";

export const metadata:Metadata={title:{default:"Admin Control Panel | BidScope",template:"%s | BidScope Admin"},robots:{index:false,follow:false}};

export default function AdminLayout({children}:{children:React.ReactNode}){return <AdminShell>{children}</AdminShell>;}
