// Merchant-approved on 9 November 2026: 30% markup on supplier cost.
// USD product price only. Freight, payment fees, tax and FX are separate.
export const retailMarkupBps=3000;
export function retailUsdMinor(cost:number){if(!Number.isSafeInteger(cost)||cost<0||cost>Math.floor(Number.MAX_SAFE_INTEGER/130))throw Error("Invalid supplier cost.");return Math.ceil(cost*130/100);}
export const deliveryDestinations=[['GH','Ghana'],['NG','Nigeria'],['KE','Kenya'],['ZA','South Africa'],['GB','United Kingdom'],['US','United States'],['CA','Canada'],['AU','Australia'],['DE','Germany'],['FR','France'],['NL','Netherlands'],['IT','Italy'],['ES','Spain'],['AE','United Arab Emirates'],['SA','Saudi Arabia'],['SG','Singapore'],['IN','India']] as const;
