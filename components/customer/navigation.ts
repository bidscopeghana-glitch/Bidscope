import { Bell, BookOpenText, Bookmark, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined, Compass, CreditCard, Eye, FileText, Gavel, Globe2, History, Home, MessageSquareText, Search, Settings, Sparkles, Users, Video } from "lucide-react";

export const navGroups: ReadonlyArray<{ title: string; links: ReadonlyArray<readonly [string, string, typeof Home]> }> = [
  { title: "", links: [["Home", "/customer", Home]] },
  { title: "Discover", links: [["All Opportunities", "/customer/discover", Compass], ["BidScope Tenders", "/customer/bidscope-tenders", Gavel], ["Ghana", "/customer/discover?scope=ghana", Search], ["International", "/customer/discover?scope=international", Globe2], ["Upcoming Procurement", "/customer/discover?stage=upcoming", CalendarDays], ["Closing Soon", "/customer/discover?days=7", History]] },
  { title: "My Opportunities", links: [["Recommended", "/customer/recommended", Sparkles], ["Saved", "/customer/saved", Bookmark], ["Following", "/customer/following", Eye], ["Recently Viewed", "/customer/recent", History]] },
  { title: "Bid Workspace", links: [["My Bids", "/customer/bids", BriefcaseBusiness], ["Tender Messages", "/customer/messages", MessageSquareText], ["Bid Pipeline", "/customer/pipeline", ChartNoAxesCombined], ["Documents", "/customer/documents", FileText], ["Deadlines", "/customer/deadlines", CalendarDays], ["Meetings", "/customer/meetings", Video]] },
  { title: "Intelligence", links: [["Buyers", "/customer/buyers", Building2], ["Market Intelligence", "/customer/intelligence", ChartNoAxesCombined], ["Awards & History", "/customer/awards", History], ["Blog", "/blog", BookOpenText]] },
  { title: "", links: [["AI Tender Evaluation", "/customer/ai", Sparkles], ["Alerts", "/customer/alerts", Bell]] },
  { title: "Account", links: [["Business Profile", "/customer/profile", Building2], ["Team", "/customer/team", Users], ["Tender Readiness", "/customer/readiness", ChartNoAxesCombined], ["Billing", "/customer/billing", CreditCard], ["Notifications", "/customer/notifications", Bell], ["Settings", "/customer/settings", Settings]] },
] as const;
