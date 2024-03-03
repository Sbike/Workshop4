import bodyParser from "body-parser";
import express from "express";
import {BASE_ONION_ROUTER_PORT} from "../config";
import http from "http";
import { REGISTRY_PORT } from "../config";
import {generateRsaKeyPair, exportPubKey, exportPrvKey, rsaDecrypt, symDecrypt} from "../crypto";



export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());
// Generate a pair of RSA keys
  const { publicKey, privateKey } = await generateRsaKeyPair();

  // Convert the private key to a base64 string
  let privateKeyBase64 = await exportPrvKey(privateKey);


  // Convert the public key to a base64 string
  let pubKeyBase64 = await exportPubKey(publicKey);


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


  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;


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





  onionRouter.post("/message", async (req, res) => {
    const {message} = req.body; //getting the message from the body
    //decrypting the symmetric key (beginning of the message) with our private key
    const decryptedKey = await rsaDecrypt(message.slice(0, 344), privateKey);
    //decrypting the rest of the message with our symmetric key
    const decryptedMessage = await symDecrypt(decryptedKey, message.slice(344));
    //getting the next destination from the message
    const nextDestination = parseInt(decryptedMessage.slice(0, 10), 10);
    //getting the rest of the message
    const remainingMessage = decryptedMessage.slice(10);
    //we update everything
    lastReceivedEncryptedMessage = message;
    lastReceivedDecryptedMessage = remainingMessage;
    lastMessageDestination = nextDestination;
    //and send the message to the next destination
    await fetch(`http://localhost:${nextDestination}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: remainingMessage }),
    });
    res.status(200).send("success");
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