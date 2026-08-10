import { createIbossFilterChecker } from "./checker";

const checker = createIbossFilterChecker({
    gatewayHost: "cn1759617341-vnsg10840.ibosscloud.com",
    securityKey: "29XA3PD231",
    userEmail: "whydoihavetoputthisherelmfao",
});

const result = await checker.checkUrl("https://watchpeopledie.tv");

if (result.isErr()) {
    console.error(result.error);
} else {
    console.log(result.value);
}
