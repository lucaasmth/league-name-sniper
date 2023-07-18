import crypto from 'crypto';
import makeFetchCookie from 'fetch-cookie';
import 'dotenv/config';

const fetchCookie = makeFetchCookie(fetch);

async function rename(username, password, newName, expiration) {
    let nonce = crypto.randomBytes(16).toString('base64');

    const authorization_response = await fetchCookie("https://auth.riotgames.com/api/v1/authorization", {
        "method": "POST",
        "headers": {
            "Accept": "application/json",
            "Accept-Encoding": "deflate, gzip, zstd",
            "Content-Type": "application/json",
            "User-Agent": "RiotClient/65.0.2.5073401.749 rso-auth (Windows;10;;Professional, x64)"
        },
        "body": JSON.stringify({
            "acr_values": "",
            "claims": "",
            "client_id": "riot-client",
            "code_challenge": "",
            "code_challenge_method": "",
            "nonce": nonce,
            "redirect_uri": "http://localhost/redirect",
            "response_type": "token id_token",
            "scope": "openid link ban lol_region account"
        })
    });

    if (authorization_response.status !== 200) {
        throw new Error("Authorization failed");
    }

    const login_response = await fetchCookie("https://auth.riotgames.com/api/v1/authorization", {
        "method": "PUT",
        "headers": {
            "Accept": "application/json",
            "Accept-Encoding": "deflate, gzip, zstd",
            "Content-Type": "application/json",
            "User-Agent": "RiotClient/65.0.2.5073401.749 rso-auth (Windows;10;;Professional, x64)"
        },
        "body": JSON.stringify({
            "language": "en_GB",
            "password": password,
            "region": null,
            "remember": false,
            "type": "auth",
            "username": username
        })
    });

    if (login_response.status !== 200) {
        throw new Error("Login failed");
    }

    console.log("Login successful");

    const login_response_json = await login_response.json();
    const bearer_token = login_response_json.response.parameters.uri.split("#")[1].split("&")[0].split("=")[1];

    const entitlements_response = await fetchCookie("https://entitlements.auth.riotgames.com/api/token/v1", {
        "method": "POST",
        "headers": {
            "Accept": "application/json",
            "Accept-Encoding": "deflate, gzip, zstd",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
            "Authorization": `Bearer ${bearer_token}`
        }
    });

    if (entitlements_response.status !== 200) {
        throw new Error("Entitlements failed");
    }

    const entitlements_response_json = await entitlements_response.json();
    const entitlements_token = entitlements_response_json.entitlements_token;

    const userinfo_response = await fetchCookie("https://auth.riotgames.com/userinfo", {
        "method": "POST",
        "headers": {
            "Accept": "application/json",
            "Accept-Encoding": "deflate, gzip, zstd",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
            "Authorization": `Bearer ${bearer_token}`,
            "X-Riot-Entitlements-JWT": entitlements_token
        }
    });

    if (userinfo_response.status !== 200) {
        throw new Error("Userinfo failed");
    }

    const userinfo_response_json = await userinfo_response.json();
    console.log(userinfo_response_json);

    const summoner_level = userinfo_response_json.lol_account.summoner_level;
    const summoner_name = userinfo_response_json.lol_account.summoner_name;
    const account_id = userinfo_response_json.pvpnet_account_id;
    console.log(`${username}:${password} ${summoner_level} ${summoner_name} (https://euw.op.gg/summoner/userName=${summoner_name})`);

    const i = setInterval(wait_for_date, 1000);
    let interval;
    async function wait_for_date() {
        if(new Date().getTime() >= expiration) {
            await change_name();
            interval = setInterval(change_name, process.env.DELAY);
            clearInterval(i);
        } else {
            const remaining_seconds = Math.round((expiration - new Date().getTime()) / 1000);
            console.log(`Waiting... ${remaining_seconds} seconds remaining`);
        }
    }

    let nb_tries = 0;

    async function change_name() {
        nb_tries++;
        let change_name_reponse = await fetch("https://euw.store.leagueoflegends.com/storefront/v3/summonerNameChange/purchase?language=en_GB", {
            "method": "POST",
            "headers": {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Origin": "https://euw.store.leagueoflegends.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) LeagueOfLegendsClient/13.13.517.6152 (CEF 91) Safari/537.36",
                "Authorization": `Bearer ${bearer_token}`
            },
            "body": JSON.stringify({
                "accountId": account_id,
                "items": [
                    {
                        "inventoryType": "SUMMONER_CUSTOMIZATION",
                        "ipCost": 13900,
                        "itemId": 1,
                        "quantity": 1,
                        "rpCost": null
                    }
                ],
                "summonerName": newName
            })
        });
        console.log(change_name_reponse.status);
        if(change_name_reponse.status !== 400 || nb_tries > 10) {
            clearInterval(interval);
        }
    }

}

rename(process.env.USERNAME, process.env.PASSWORD, process.env.NEWNAME, process.env.EXPIRATION);
