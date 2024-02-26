import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT } from "../config";
import { generateKeyPairSync } from "crypto";
import http from "http";
import { REGISTRY_PORT } from "../config";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  // Generate a pair of RSA keys
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  // Convert the private key to a base64 string
  let privateKeyBase64 = Buffer.from(privateKey.export({ type: "pkcs1", format: "pem" })).toString('base64');

  // Convert the public key to a base64 string
  let pubKeyBase64 = Buffer.from(publicKey.export({ type: "pkcs1", format: "pem" })).toString('base64');

  // Register the node on the registry
  const data = JSON.stringify({
    nodeId,
    pubKey: pubKeyBase64,
  });

  const options = {
    hostname: 'localhost',
    port: REGISTRY_PORT,
    path: '/registerNode',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  };

  const req = http.request(options, (res) => {
    res.on('data', (chunk) => {
      console.log(`Response: ${chunk}`);
    });
  });

  req.on('error', (error) => {
    console.error(`Problem with request: ${error.message}`);
  });

  // Write data to request body
  req.write(data);
  req.end();

  // Implement the status route
  onionRouter.get("/status/", (req, res) => {
    res.send("live");
  });

  const lastReceivedEncryptedMessage = null;
  const lastReceivedDecryptedMessage = null;
  const lastMessageDestination = null;

  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  onionRouter.get("/getPrivateKey", (req, res) => {
    res.json({ result: privateKeyBase64 });
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
        `Onion router ${nodeId} is listening on port ${
            BASE_ONION_ROUTER_PORT + nodeId
        }`
    );
  });

  return server;
}