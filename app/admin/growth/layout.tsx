import type{Metadata}from"next";import{AdminShell}from"../command-centre/admin-shell";
export const metadata:Metadata={title:{default:"Growth | BidScope Admin",template:"%s | BidScope Admin"},robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <AdminShell>{children}</AdminShell>}
