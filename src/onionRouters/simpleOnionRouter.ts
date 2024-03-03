import bodyParser from "body-parser";
import express from "express";
import {BASE_ONION_ROUTER_PORT, BASE_USER_PORT} from "../config";
import http from "http";
import { REGISTRY_PORT } from "../config";
import {generateRsaKeyPair, exportPubKey, exportPrvKey, rsaDecrypt} from "../crypto";



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

  onionRouter.post("/message", async (req: express.Request, res: express.Response) => {
    const encryptedMessage = req.body.message;

    // Decrypt the outer layer of the message
    const decryptedMessage = await rsaDecrypt(encryptedMessage, privateKey); // You need the private key to decrypt

    // Determine the next node or user
    const nextNodeOrUser = JSON.parse(decryptedMessage);

    // If the next node or user is a node, forward the message
    if (nextNodeOrUser.type === "node") {
      await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + nextNodeOrUser.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: decryptedMessage }),
      });
    } else {
      // If the next node or user is a user, send the decrypted message
      await fetch(`http://localhost:${BASE_USER_PORT + nextNodeOrUser.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: decryptedMessage }),
      });
    }

    res.status(200).send("Message processed");
  });


  return server;
}