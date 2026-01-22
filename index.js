import axios from "axios";
import qs from "qs";
import dotenv from 'dotenv';
import cron from 'node-cron';

dotenv.config({quiet: true});

// 1. Defina suas credenciais da Battle.net
const CLIENT_ID = process.env.BLIZZARD_CLIENT_ID;
const CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET;
let currentStatus = "Down";

// 2. Função para obter access token com Client Credentials
async function getAccessToken() {
  const data = qs.stringify({ grant_type: "client_credentials" });
  const tokenUrl = "https://us.battle.net/oauth/token";

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const res = await axios.post(tokenUrl, data, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return res.data.access_token;
}

// 3. Função para buscar lista dos servidores
async function getRealms(token) {
  const url = "https://us.api.blizzard.com/data/wow/connected-realm/index?namespace=dynamic-us";
  
  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
}

// 4. Função para buscar o status dos servidores
async function getRealmsStatus(token, realmId) {
  const url = `https://us.api.blizzard.com/data/wow/connected-realm/${realmId}?namespace=dynamic-us`;
  
  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
}

// 5. Função para enviar mensagem ao Discord via webhook
async function sendToDiscord(message) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("Discord webhook URL not set.");
    return;
  }

  try {
    await axios.post(webhookUrl, { content: message });
  } catch (error) {
    console.error("Failed to send message to Discord:", error.response?.data || error.message);
  }
}

// 6. Executa o crawler
async function run() {
    try {
    const token = await getAccessToken();

    console.log("Buscando status dos servidores...");
    const data = await getRealms(token);

    data.connected_realms.forEach(element => {
      let id = element.href.split('/').pop().split('?')[0];
      if(id === "3209"){ // ID do servidor Azralon
        getRealmsStatus(token, id).then(statusData => {
            if(currentStatus !== statusData.status.name["en_US"]){
              sendToDiscord(`Status do servidor Azralon: ${statusData.status.name["en_US"]} - População: ${statusData.population.name["en_US"]}`);
              console.table(statusData.realms.map(r => ({
                  name: r.name["pt_BR"],
                  status: statusData.status.name["en_US"],
                  population: statusData.population.name["en_US"]
              })));
              currentStatus = statusData.status.name["en_US"];
            }
        });
      }
    });

  } catch (err) {
    console.error("Erro ao consultar API:", err.response?.data || err.message);
  }
};

// 7. Inicia o cron job imediatamente
cron.schedule('* * * * *', () => {
  run();
});

// Executa imediatamente na inicialização
run();