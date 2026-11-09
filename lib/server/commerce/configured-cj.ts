import {CjSandboxProvider,type Permission} from "./providers";
import {cjConnection} from "./cj-connection";
export async function configuredCjSandboxProvider(permission:Permission){
 if(!permission.approved||!permission.evidence||!Number.isFinite(Date.parse(permission.expiresAt))||Date.parse(permission.expiresAt)<=Date.now())throw Error("Reviewed CJ publication permission is required before catalogue access.");
 const token=await cjConnection.token();
 return new CjSandboxProvider(token.accessToken,token.accessTokenExpiryDate,permission);
}
