import { app } from "../../scripts/app.js";

const SUPPORTED_NODE_NAMES = new Set(["F_DynamicSwitch", "F_DynamicMultiSwitch"]);
const MAX_OUTPUTS = 64;

function hasLinks(output) {
    return Array.isArray(output?.links) && output.links.length > 0;
}

function hideWidget(widget) {
    if (widget.__fHidden) return;
    widget.__fOriginalType = widget.type;
    widget.__fOriginalComputeSize = widget.computeSize;
    widget.__fOriginalHidden = widget.hidden;
    widget.hidden = true;
    widget.type = "hidden";
    widget.computeSize = () => [0, -4];
    widget.__fHidden = true;
}

function showWidget(widget) {
    if (!widget.__fHidden) return;
    widget.type = widget.__fOriginalType || "toggle";
    widget.hidden = widget.__fOriginalHidden ?? false;
    if (widget.__fOriginalComputeSize) {
        widget.computeSize = widget.__fOriginalComputeSize;
    } else {
        delete widget.computeSize;
    }
    delete widget.__fOriginalHidden;
    widget.__fHidden = false;
}

function normalizeMultiSwitchWidgets(node) {
    if (node.comfyClass !== "F_DynamicMultiSwitch" || !Array.isArray(node.widgets)) return;

    const outputCount = Array.isArray(node.outputs) && node.outputs.length > 0 ? node.outputs.length : 1;

    for (const widget of node.widgets) {
        if (!widget?.name) continue;
        const match = String(widget.name).match(/active_(\d+)/i);
        if (!match) continue;
        const idx = Number.parseInt(match[1], 10);
        if (Number.isNaN(idx)) continue;

        if (idx < outputCount) {
            showWidget(widget);
        } else {
            hideWidget(widget);
        }
    }
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
        if (!SUPPORTED_NODE_NAMES.has(nodeData.name)) return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = originalOnNodeCreated ? originalOnNodeCreated.apply(this, arguments) : undefined;

            // 新建节点时保持 n+1 规则（通常为 1 个空输出）。
            normalizeOutputs(this);
            normalizeMultiSwitchWidgets(this);
            this.setSize(this.computeSize());

            return r;
        };

        const originalOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = originalOnConfigure ? originalOnConfigure.apply(this, arguments) : undefined;

            // 加载工作流后立即压缩多余输出，防止节点过长。
            normalizeOutputs(this);
            normalizeMultiSwitchWidgets(this);
            this.setSize(this.computeSize());
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
            normalizeMultiSwitchWidgets(this);
            this.setSize(this.computeSize());

            this.setDirtyCanvas(true, true);
            return r;
        };

        const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            if (this.comfyClass === "F_DynamicMultiSwitch") {
                normalizeMultiSwitchWidgets(this);
            }
            if (originalOnDrawForeground) {
                return originalOnDrawForeground.apply(this, arguments);
            }
            return undefined;
        };
    },
});
