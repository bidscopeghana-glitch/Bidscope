import type { Metadata } from "next";
import { ProcurementFooter, ProcurementHeader } from "@/components/procurement/site-shell";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Your Profile | BidScope Ghana", description: "Manage your BidScope profile and business account." };
export default function ProfilePage(){return <main className="min-h-screen bg-[#f4f7f3]"><ProcurementHeader/><ProfileClient/><ProcurementFooter/></main>;}
