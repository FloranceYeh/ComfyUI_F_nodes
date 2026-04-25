import { app } from "../../scripts/app.js";

const NODE_NAME = "F_DynamicSwitch";
const MAX_OUTPUTS = 64;

function hasLinks(output) {
    return Array.isArray(output?.links) && output.links.length > 0;
}

app.registerExtension({
    name: "F_nodes.DynamicSwitch",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = originalOnNodeCreated ? originalOnNodeCreated.apply(this, arguments) : undefined;

            // 只保留一个初始输出口，后续按连线自动扩展。
            while (this.outputs && this.outputs.length > 1) {
                this.removeOutput(this.outputs.length - 1);
            }

            if (!this.outputs || this.outputs.length === 0) {
                this.addOutput("out_0", "*");
            } else {
                this.outputs[0].name = "out_0";
                this.outputs[0].type = "*";
            }

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

            const outputs = this.outputs;
            const lastIndex = outputs.length - 1;

            // 如果最后一个输出被连接，新增一个空输出，保持 n+1。
            if (connected && index === lastIndex && outputs.length < MAX_OUTPUTS) {
                const next = outputs.length;
                this.addOutput(`out_${next}`, "*");
            }

            // 连接变化后压缩尾部多余空输出，仅保留 1 个尾部空槽。
            let lastConnected = -1;
            for (let i = outputs.length - 1; i >= 0; i -= 1) {
                if (hasLinks(outputs[i])) {
                    lastConnected = i;
                    break;
                }
            }

            const expected = Math.min(MAX_OUTPUTS, Math.max(1, lastConnected + 2));
            while (this.outputs.length > expected) {
                this.removeOutput(this.outputs.length - 1);
            }

            // 刷新命名，避免中途断开后出现序号错位。
            for (let i = 0; i < this.outputs.length; i += 1) {
                this.outputs[i].name = `out_${i}`;
                this.outputs[i].type = "*";
            }

            this.setDirtyCanvas(true, true);
            return r;
        };
    },
});
