import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";

import {
  generateRsaKeyPair,
  exportPubKey,
  exportPrvKey,
  createRandomSymmetricKey,
  symEncrypt,
  rsaEncrypt,
  exportSymKey
} from "../crypto";
import {NodeRegistry} from "@/src/registry/registry";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  // TODO implement the status route
  _user.get("/status/", (req, res) => {
    res.send("live");
  });

  let lastReceivedMessage: null = null;
  const lastSentMessage = null;

  _user.post("/message", (req, res) => {
    const message = req.body.message;

    lastReceivedMessage = message;

    console.log(`Received message: ${message}`);

    // Send a success response
    res.status(200).send("success");
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });
  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body;

    // Fetch the node registry
    const nodeRegistryResponse = await fetch("http://localhost:" + REGISTRY_PORT + "/getNodeRegistry");
    const nodeRegistry: NodeRegistry = <NodeRegistry>await nodeRegistryResponse.json();

    // Select 3 random nodes
    const circuitNodes = [];
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * nodeRegistry.nodes.length);
      circuitNodes.push(nodeRegistry.nodes[randomIndex]);
      nodeRegistry.nodes.splice(randomIndex, 1); // Remove the selected node from the array
    }

    let encryptedMessage = message;
    for (const node of circuitNodes) {
      // Create a unique symmetric key for the node
      const symKey = await createRandomSymmetricKey();
      const symKeyBase64 = await exportSymKey(symKey);

      // Encrypt the message with the symmetric key
      encryptedMessage = await symEncrypt(symKey, encryptedMessage);

      // Encrypt the symmetric key with the node's RSA public key
      const encryptedSymKey = await rsaEncrypt(symKeyBase64, node.pubKey);

      // Concatenate the encrypted symmetric key with the encrypted message
      encryptedMessage = encryptedSymKey + encryptedMessage;
    }

    // Send the encrypted message to the entry node's /message route
    const entryNode = circuitNodes[0];
    await fetch("http://localhost:" + (BASE_ONION_ROUTER_PORT + entryNode.nodeId) + "/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: encryptedMessage }),
    });

    res.status(200).send("Message sent");
  });


  return server;
}
