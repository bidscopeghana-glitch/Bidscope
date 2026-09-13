export type MatchProfile = { sectors:string[]; services:string[]; products:string[]; region:string|null; preferred_regions:string[]; preferred_minimum_value:number|null; preferred_maximum_value:number|null; certifications:string[] };
export type MatchOpportunity = { title:string; summary:string; sector:string|null; category:string; region:string|null; estimated_value:number|null; eligibility_text:string|null };

const words = (values:string[]) => values.map(value=>value.trim().toLowerCase()).filter(Boolean);
export function calculateOpportunityMatch(profile:MatchProfile, opportunity:MatchOpportunity){
  const haystack=`${opportunity.title} ${opportunity.summary} ${opportunity.sector||""} ${opportunity.category}`.toLowerCase();
  let earned=0;let possible=0;const reasons:string[]=[];
  const businessTerms=words([...profile.sectors,...profile.services,...profile.products]);
  if(businessTerms.length){possible+=50;if(businessTerms.some(term=>haystack.includes(term))){earned+=50;reasons.push("Category or service matches your company profile");}}
  const regions=words(profile.preferred_regions.length?profile.preferred_regions:[profile.region||""]);
  if(regions.length&&opportunity.region){possible+=20;if(regions.includes(opportunity.region.toLowerCase())){earned+=20;reasons.push("Region matches your preferred coverage");}}
  if((profile.preferred_minimum_value!=null||profile.preferred_maximum_value!=null)&&opportunity.estimated_value!=null){possible+=30;const above=profile.preferred_minimum_value==null||opportunity.estimated_value>=profile.preferred_minimum_value;const below=profile.preferred_maximum_value==null||opportunity.estimated_value<=profile.preferred_maximum_value;if(above&&below){earned+=30;reasons.push("Estimated value matches your preferred range");}}
  if(profile.certifications.length&&opportunity.eligibility_text){possible+=15;const eligibility=opportunity.eligibility_text.toLowerCase();if(profile.certifications.some(item=>eligibility.includes(item.toLowerCase()))){earned+=15;reasons.push("A listed certification appears in the eligibility information");}}
  return possible ? { percentage:Math.round(earned/possible*100), reasons, evidenceAvailable:true } : { percentage:null, reasons:["Complete your company profile to calculate a verified match."], evidenceAvailable:false };
}
