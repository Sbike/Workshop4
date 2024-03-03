import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT, BASE_ONION_ROUTER_PORT } from "../config";

import {
  createRandomSymmetricKey,
  symEncrypt,
  rsaEncrypt,
  exportSymKey
} from "../crypto";
import {GetNodeRegistryBody, Node} from "@/src/registry/registry";


export interface NodeRegistry {
  nodes: Node[];
}


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

  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;
  let lastCircuit: Node[] = [];

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


  _user.get("/getLastCircuit", (req, res) => {
    res.status(200).json({result: lastCircuit.map((node) => node.nodeId)});
  });

  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body; //extracts the message

    const nodes = await fetch(`http://localhost:8080/getNodeRegistry`)//fetch the nodes list
        .then((res) => res.json() as Promise<GetNodeRegistryBody>)
        .then((body) => body.nodes);

    let circuit: Node[] = [];
    while (circuit.length < 3) { //creates a 3 nodes circuit from the nodes list
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
      if (!circuit.includes(randomNode)) {
        circuit.push(randomNode);
      }
    }

    let destination = `${BASE_USER_PORT + destinationUserId}`.padStart(10, "0"); //prepares the message to send
    let finalMessage = message;
    for(const node of circuit) {
      const symmetricKey = await createRandomSymmetricKey();
      const symmetricKey64 = await exportSymKey(symmetricKey);
      const encryptedMessage = await symEncrypt(symmetricKey, `${destination + finalMessage}`);
      destination = `${BASE_ONION_ROUTER_PORT + node.nodeId}`.padStart(10, '0');
      const encryptedSymKey = await rsaEncrypt(symmetricKey64, node.pubKey);
      finalMessage = encryptedSymKey + encryptedMessage;
    }

    circuit.reverse(); //inverses th circuit to have the node order
    lastCircuit = circuit;
    lastSentMessage = message;
    await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + circuit[0].nodeId}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: finalMessage }),
    });
    res.status(200).send("success");
  });


  return server;
}
