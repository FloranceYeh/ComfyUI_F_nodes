import { app } from "../../scripts/app.js";

const NODE_NAME = "F_DynamicSwitch";
const MAX_OUTPUTS = 64;

function hasLinks(output) {
    return Array.isArray(output?.links) && output.links.length > 0;
}

function normalizeOutputs(node) {
    if (!node.outputs || node.outputs.length === 0) {
        node.addOutput("out_0", "*");
    }

    let lastConnected = -1;
    for (let i = node.outputs.length - 1; i >= 0; i -= 1) {
        if (hasLinks(node.outputs[i])) {
            lastConnected = i;
            break;
        }
    }

    const expected = Math.min(MAX_OUTPUTS, Math.max(1, lastConnected + 2));

    while (node.outputs.length > expected) {
        node.removeOutput(node.outputs.length - 1);
    }

    while (node.outputs.length < expected) {
        const next = node.outputs.length;
        node.addOutput(`out_${next}`, "*");
    }

    for (let i = 0; i < node.outputs.length; i += 1) {
        node.outputs[i].name = `out_${i}`;
        node.outputs[i].type = "*";
    }
}

app.registerExtension({
    name: "F_nodes.DynamicSwitch",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = originalOnNodeCreated ? originalOnNodeCreated.apply(this, arguments) : undefined;

            // 新建节点时保持 n+1 规则（通常为 1 个空输出）。
            normalizeOutputs(this);

            return r;
        };

        const originalOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = originalOnConfigure ? originalOnConfigure.apply(this, arguments) : undefined;

            // 加载工作流后立即压缩多余输出，防止节点过长。
            normalizeOutputs(this);
            this.setDirtyCanvas(true, true);

            return r;
        };

        const originalOnConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type, index, connected, linkInfo) {
            const r = originalOnConnectionsChange
                ? originalOnConnectionsChange.apply(this, arguments)
                : undefined;

            // 2 = outputs
            if (type !== 2 || !this.outputs || this.outputs.length === 0) {
                return r;
            }

            normalizeOutputs(this);

            this.setDirtyCanvas(true, true);
            return r;
        };
    },
});
