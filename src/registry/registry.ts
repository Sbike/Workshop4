import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = { nodeId: number; pubKey: string };

export type RegisterNodeBody = {
    nodeId: number;
    pubKey: string;
};

export type GetNodeRegistryBody = {
    nodes: Node[];
};

export async function launchRegistry() {
    const _registry = express();
    _registry.use(express.json());
    _registry.use(bodyParser.json());

    // Implement the status route
    _registry.get("/status", (req, res) => {
        res.send("live");
    });

    // Implement the post route:
    let registeredNodes: Node[] = [];

    _registry.post("/registerNode", (req: Request<{}, {}, RegisterNodeBody>, res: Response) => {
        const newNode: Node = {
            nodeId: req.body.nodeId,
            pubKey: req.body.pubKey,
        };

        registeredNodes.push(newNode);

        res.status(200).send({ message: "Node registered successfully." });
    });

    _registry.get("/getNodeRegistry", (req, res) => {
        res.json({ nodes: registeredNodes });
    });

    const server = _registry.listen(REGISTRY_PORT, () => {
        console.log(`registry is listening on port ${REGISTRY_PORT}`);
    });

    return server;
}